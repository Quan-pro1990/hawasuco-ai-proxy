// Lõi trợ lý: gửi lời người dùng cho Claude, phát chữ trả lời ra dần (để trình duyệt đọc ngay từng câu),
// chạy các công cụ tra số liệu khi Claude cần, rồi lưu lượt nói vào lịch sử hội thoại.

import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { DINH_NGHIA, chayCongCu, kiemTraDauVao, moTaDangTra } from './cong-cu.js';

const SO_VONG_TOI_DA = 8;          // số lần gọi Claude tối đa trong 1 lượt (mỗi lần tra công cụ là 1 vòng)
const SO_TIN_TOI_DA = 80;          // hội thoại dài hơn thì bắt đầu lại (lời nói thường ngắn, hiếm khi tới)

const LOI_SO_LIEU_CO =
  '- Mọi con số về thất thoát nước, sản lượng phát ra, chuẩn thu, kế hoạch, đồng hồ cấp 1 phải lấy từ công cụ tra cứu. Không bao giờ tự đoán hay bịa số. Nếu công cụ báo lỗi hoặc chưa có số liệu thì nói rõ như vậy.\n' +
  '- "Tháng này", "tháng mới nhất" là tháng gần nhất có số liệu (báo cáo thường chậm khoảng một tháng so với hôm nay). "Tháng trước" là tháng liền trước tháng đó, trừ khi người dùng nói rõ tháng nào.\n' +
  '- Tỷ lệ thất thoát = (sản lượng phát ra − sản lượng chuẩn thu) ÷ sản lượng phát ra × 100. Tỷ lệ cao hơn kế hoạch là vượt kế hoạch (chưa tốt), thấp hơn là đạt kế hoạch. Chênh lệch giữa hai tỷ lệ nói bằng "điểm phần trăm".\n' +
  '- Khi có nhiều đơn vị, nêu đơn vị nổi bật trước (cao nhất, vượt kế hoạch nhiều nhất, tăng mạnh nhất), không đọc hết danh sách trừ khi được yêu cầu.\n' +
  '- Số liệu xem được tùy quyền tài khoản của người dùng; nếu máy chủ báo không có quyền hoặc hết phiên đăng nhập, nói lại đúng như vậy.';
const LOI_SO_LIEU_KHONG =
  'Trợ lý chưa được nối với máy chủ số liệu thất thoát nước. Nếu người dùng hỏi số liệu, nói rằng em chưa xem được số liệu và nhờ quản trị viên cài đặt kết nối; không đoán số.';
const LOI_WEB_CO = 'Khi cần tin tức, thời tiết hay thông tin mới, hãy dùng công cụ tìm kiếm web và nói ngắn gọn nguồn tin.';
const LOI_WEB_KHONG = 'Bạn không xem được tin tức, thời tiết hay thông tin trên mạng; nếu được hỏi những điều đó thì nói rõ là không tra được.';

export class LoiNguoiDung extends Error {}

/** Thời điểm hiện tại theo giờ Việt Nam, vd "Thứ Sáu, 20/11/2026, 15:04". */
export function thoiDiem(d = new Date()) {
  const s = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Sau khi API chuyển sang mô hình dự phòng giữa chừng, các khối thinking / tool_use (và server_tool_use không có kết quả)
 * nằm TRƯỚC khối "fallback" cuối cùng không được gửi lại; khối fallback giữ nguyên vị trí.
 */
export function chuanHoaNoiDung(content) {
  let iFb = -1;
  content.forEach((b, i) => { if (b.type === 'fallback') iFb = i; });
  if (iFb < 0) return content;
  const coKetQua = new Set(content.filter((b) => b.type.endsWith('_tool_result') && b.tool_use_id).map((b) => b.tool_use_id));
  return content.filter((b, i) => {
    if (i >= iFb) return true;
    if (b.type === 'text' || b.type.endsWith('_tool_result')) return true;
    if (b.type === 'server_tool_use') return coKetQua.has(b.id);
    return false;   // thinking, redacted_thinking, tool_use, khối nội bộ lạ
  });
}

/** Các khối tool_use cần chạy: chỉ những khối sau khối fallback cuối (nếu có). */
function khoiCongCu(content) {
  let iFb = -1;
  content.forEach((b, i) => { if (b.type === 'fallback') iFb = i; });
  return content.filter((b, i) => i > iFb && b.type === 'tool_use');
}

export class TroLy {
  /**
   * @param {object} o
   * @param {Anthropic} o.client
   * @param {string} o.model
   * @param {string} o.effort       low | medium | high | xhigh | max
   * @param {string} o.tenCongTy
   * @param {boolean} o.coSoLieu    có máy chủ thất thoát nước để tra không
   * @param {boolean} o.timKiemWeb
   * @param {import('./thatthoat.js').MayChuThatThoat|null} o.mayChu
   * @param {string} o.loiDanGoc    nội dung loi-dan.txt
   */
  constructor({ client, model, effort, tenCongTy, coSoLieu, timKiemWeb, mayChu, loiDanGoc, duPhong = true }) {
    this.client = client;
    this.duPhong = duPhong;   // mô hình dự phòng phía máy chủ Anthropic (beta) khi bị bộ lọc an toàn từ chối
    this.model = model;
    this.effort = effort;
    this.mayChu = coSoLieu ? mayChu : null;
    // Lời dặn và danh sách công cụ cố định suốt đời máy chủ → không phá bộ nhớ đệm prompt và "preserved thinking".
    this.system = loiDanGoc
      .replaceAll('{{TEN_CONG_TY}}', tenCongTy)
      .replaceAll('{{SO_LIEU}}', coSoLieu ? LOI_SO_LIEU_CO : LOI_SO_LIEU_KHONG)
      .replaceAll('{{TIM_KIEM_WEB}}', timKiemWeb ? LOI_WEB_CO : LOI_WEB_KHONG)
      .trim();
    this.tools = [...(coSoLieu ? DINH_NGHIA : [])];
    if (timKiemWeb) {
      this.tools.push({
        type: 'web_search_20260209', name: 'web_search', max_uses: 3,
        user_location: { type: 'approximate', country: 'VN', timezone: 'Asia/Ho_Chi_Minh' },
      });
    }
  }

  static docLoiDan(duong) {
    return fs.readFileSync(duong, 'utf8');
  }

  /**
   * Trả lời 1 lượt nói. Lịch sử chỉ được ghi khi lượt hoàn tất (bị huỷ / lỗi thì như chưa hỏi).
   * @param {{messages: any[]}} hoiThoai
   * @param {string} cauHoi
   * @param {object} o
   * @param {string|null} o.token          token máy chủ thất thoát nước của người dùng
   * @param {(suKien: string, duLieu: object) => void} o.phat
   * @param {AbortSignal} o.signal
   * @returns {Promise<{usage: object, soVong: number}>}
   */
  async traLoi(hoiThoai, cauHoi, { token, phat, signal }) {
    if (hoiThoai.messages.length > SO_TIN_TOI_DA) {
      hoiThoai.messages = [];
      phat('thongbao', { t: 'Cuộc trò chuyện đã dài, em bắt đầu lại từ đầu.' });
    }
    const messages = [
      ...hoiThoai.messages,
      {
        role: 'user',
        content: [{ type: 'text', text: '<thoi_diem>' + thoiDiem() + '</thoi_diem>\n' + cauHoi }],
      },
    ];
    const tong = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
    let loiJson = 0;

    for (let vong = 1; vong <= SO_VONG_TOI_DA; vong++) {
      if (signal.aborted) throw signal.reason ?? new Error('Đã huỷ');
      const params = {
        model: this.model,
        max_tokens: 16000,
        output_config: { effort: this.effort },
        cache_control: { type: 'ephemeral' },
        system: this.system,
        messages,
      };
      if (this.tools.length) params.tools = this.tools;
      if (this.duPhong) {
        // Bị bộ lọc an toàn từ chối thì API tự chạy lại bằng mô hình dự phòng phù hợp (cùng 1 lời gọi).
        params.betas = ['server-side-fallback-2026-07-01'];
        params.fallbacks = 'default';
      }

      const stream = this.client.beta.messages.stream(params, { signal });
      let daCoChu = false;
      stream.on('text', (delta) => {
        if (!daCoChu) { daCoChu = true; phat('doan', {}); }   // bắt đầu 1 đoạn trả lời mới
        phat('chu', { t: delta });
      });

      let msg;
      try {
        msg = await stream.finalMessage();
        loiJson = 0;
      } catch (e) {
        if (signal.aborted) throw signal.reason ?? e;
        if (this.duPhong && e instanceof Anthropic.BadRequestError && /fallback/i.test(e.message)) {
          // Tài khoản / mô hình chưa hỗ trợ tính năng dự phòng: tắt hẳn rồi hỏi lại (lỗi 400 đến trước khi có chữ nào).
          console.warn('[tro-ly] Tắt mô hình dự phòng (API không nhận): ' + e.message);
          this.duPhong = false;
          vong--;
          continue;
        }
        if (e instanceof Anthropic.APIError || loiJson++ >= 2) throw e;
        // Đầu vào công cụ không đọc được hoặc mất kết nối giữa chừng → gửi lại vòng này.
        console.warn('[tro-ly] luong tra loi bi ngat, gui lai:', e.message);
        continue;
      }

      for (const k of Object.keys(tong)) tong[k] += (msg.usage && msg.usage[k]) || 0;

      if (msg.stop_reason === 'refusal') {
        // Cả chuỗi mô hình đều từ chối: không lưu lượt này vào lịch sử.
        phat('chu', { t: (daCoChu ? ' ' : '') + 'Xin lỗi, em không thể trả lời câu này.' });
        return { usage: tong, soVong: vong, tuChoi: true };
      }

      const noiDung = chuanHoaNoiDung(msg.content);
      const cacCongCu = khoiCongCu(noiDung);
      // Đầu vào công cụ bị cắt ở max_tokens vẫn có thể "đọc được" → không chạy, không lưu.
      if (msg.stop_reason === 'max_tokens' && cacCongCu.length) throw new Error('Đầu vào công cụ bị cắt ngang (max_tokens).');
      messages.push({ role: 'assistant', content: noiDung });

      if (msg.stop_reason === 'pause_turn') continue;   // công cụ phía máy chủ (tìm web) cần chạy tiếp

      if (msg.stop_reason !== 'tool_use' || cacCongCu.length === 0) {
        hoiThoai.messages = messages;   // end_turn / max_tokens (chữ bị cắt) → lưu lượt
        return { usage: tong, soVong: vong };
      }

      const ketQua = await Promise.all(cacCongCu.map((b) => this.#chayMot(b, token, phat)));
      messages.push({ role: 'user', content: ketQua });
    }
    throw new LoiNguoiDung('Câu hỏi cần tra cứu quá nhiều bước. Anh chị hỏi gọn hơn giúp em nhé.');
  }

  async #chayMot(block, token, phat) {
    const kt = kiemTraDauVao(block.name, block.input);
    if (!kt.ok) return { type: 'tool_result', tool_use_id: block.id, is_error: true, content: 'Đầu vào không hợp lệ: ' + kt.loi };
    phat('congcu', { ten: block.name, moTa: moTaDangTra(block.name, kt.vao) });
    try {
      const noiDung = await chayCongCu(this.mayChu, token, block.name, kt.vao);
      return { type: 'tool_result', tool_use_id: block.id, content: noiDung };
    } catch (e) {
      if (e.hetPhien) phat('hetphien', {});
      return { type: 'tool_result', tool_use_id: block.id, is_error: true, content: e.message || String(e) };
    }
  }
}

/** Đổi lỗi API thành câu tiếng Việt cho người dùng (không lộ chi tiết kỹ thuật). */
export function loiChoNguoiDung(e) {
  if (e instanceof LoiNguoiDung) return e.message;
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
    return 'Khoá API của trợ lý không hợp lệ hoặc hết hạn. Báo quản trị viên kiểm tra ANTHROPIC_API_KEY.';
  if (e instanceof Anthropic.RateLimitError) return 'Trợ lý đang nhận quá nhiều câu hỏi. Anh chị thử lại sau ít phút nhé.';
  if (e instanceof Anthropic.BadRequestError) return 'Yêu cầu gửi tới trợ lý không hợp lệ. Anh chị bấm "Cuộc trò chuyện mới" rồi hỏi lại nhé.';
  if (e instanceof Anthropic.InternalServerError || (e instanceof Anthropic.APIError && e.status >= 500))
    return 'Dịch vụ trí tuệ nhân tạo đang bận. Anh chị thử lại sau giây lát nhé.';
  if (e instanceof Anthropic.APIConnectionError) return 'Máy chủ trợ lý không kết nối được dịch vụ trí tuệ nhân tạo. Kiểm tra mạng Internet của máy chủ.';
  return 'Có lỗi khi trả lời. Anh chị thử lại nhé.';
}
