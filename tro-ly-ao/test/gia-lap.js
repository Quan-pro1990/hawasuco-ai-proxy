// Máy chủ giả lập để chạy thử không cần khoá API thật và không cần máy chủ IIS:
//  - giaLapClaude(): giả API Messages của Anthropic (trả luồng SSE theo kịch bản cố định)
//  - giaLapThatThoat(): giả máy chủ ThatThoatNuoc.exe (các địa chỉ /api/... trợ lý dùng)
//
// Chạy riêng để thử giao diện trên trình duyệt:  node test/gia-lap.js   (rồi chạy server.js với .env trỏ vào đây)

import http from 'node:http';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

// ------------------------------------------------------------------ giả Claude

function sse(res, events) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'request-id': 'req_gialap' });
  for (const e of events) res.write('event: ' + e.type + '\ndata: ' + JSON.stringify(e) + '\n\n');
  res.end();
}

function luongTraLoi({ model, khoi, stop }) {
  const ev = [{
    type: 'message_start',
    message: { id: 'msg_' + Math.random().toString(36).slice(2), type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null,
      usage: { input_tokens: 120, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } },
  }];
  khoi.forEach((k, i) => {
    if (k.type === 'text') {
      ev.push({ type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } });
      // chia nhỏ như luồng thật
      for (const phan of k.text.match(/.{1,7}/gsu) || []) ev.push({ type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: phan } });
    } else if (k.type === 'thinking') {
      ev.push({ type: 'content_block_start', index: i, content_block: { type: 'thinking', thinking: '', signature: '' } });
      ev.push({ type: 'content_block_delta', index: i, delta: { type: 'signature_delta', signature: 'chu-ky-gia-lap-' + i } });
    } else if (k.type === 'tool_use') {
      ev.push({ type: 'content_block_start', index: i, content_block: { type: 'tool_use', id: k.id, name: k.name, input: {} } });
      const j = JSON.stringify(k.input);
      ev.push({ type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: j.slice(0, 5) } });
      ev.push({ type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: j.slice(5) } });
    } else {
      ev.push({ type: 'content_block_start', index: i, content_block: k });
    }
    ev.push({ type: 'content_block_stop', index: i });
  });
  ev.push({ type: 'message_delta', delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 42 } });
  ev.push({ type: 'message_stop' });
  return ev;
}

function chuCuoi(messages) {
  const m = messages[messages.length - 1];
  if (typeof m.content === 'string') return m.content;
  return m.content.filter((b) => b.type === 'text').map((b) => b.text).join(' ');
}

export function giaLapClaude() {
  const yeuCau = [];
  const tuChoiDuPhong = { bat: false };   // giả tài khoản chưa có tính năng dự phòng
  const sv = http.createServer((req, res) => {
    let s = '';
    req.on('data', (c) => { s += c; });
    req.on('end', () => {
      if (req.method !== 'POST' || !req.url.startsWith('/v1/messages')) { res.writeHead(404); return res.end('{}'); }
      const b = JSON.parse(s);
      yeuCau.push({ url: req.url, headers: req.headers, body: b });
      if (tuChoiDuPhong.bat && b.fallbacks) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'fallbacks: Extra inputs are not permitted' } }));
      }
      const model = b.model;
      const cuoi = b.messages[b.messages.length - 1];
      const ketQua = Array.isArray(cuoi.content) && cuoi.content.find((x) => x.type === 'tool_result');

      if (ketQua) {
        let noi;
        try {
          const d = JSON.parse(ketQua.content);
          if (d.donVi) {
            const toan = d.donVi.find((x) => x.loai === 'Toàn công ty');
            const doi = d.donVi.filter((x) => x.loai === 'Đội').sort((a, c) => c.tyLe - a.tyLe)[0];
            noi = 'Tháng ' + d.thangDangXem.thang + '/' + d.thangDangXem.nam + ', tỷ lệ thất thoát toàn công ty là ' +
              String(toan.tyLe).replace('.', ',') + ' phần trăm. ' + doi.ten + ' cao nhất với ' + String(doi.tyLe).replace('.', ',') + ' phần trăm.';
          } else noi = 'Công cụ báo: ' + (d.loi || 'không rõ');
        } catch {
          noi = 'Công cụ báo lỗi: ' + ketQua.content;
        }
        return sse(res, luongTraLoi({ model, khoi: [{ type: 'thinking' }, { type: 'text', text: noi }], stop: 'end_turn' }));
      }

      const chu = chuCuoi(b.messages).toLowerCase();
      if (chu.includes('từ chối')) return sse(res, luongTraLoi({ model, khoi: [], stop: 'refusal' }));
      if (chu.includes('dự phòng')) {
        return sse(res, luongTraLoi({
          model: 'claude-opus-5',
          khoi: [
            { type: 'thinking' }, { type: 'text', text: 'Phần đầu. ' },
            { type: 'fallback', from: { model }, to: { model: 'claude-opus-5' } },
            { type: 'thinking' }, { type: 'text', text: 'Phần sau từ mô hình dự phòng.' },
          ],
          stop: 'end_turn',
        }));
      }
      if (chu.includes('thất thoát') && b.tools && b.tools.length) {
        return sse(res, luongTraLoi({
          model,
          khoi: [{ type: 'thinking' }, { type: 'tool_use', id: 'toolu_' + yeuCau.length, name: 'that_thoat_thang', input: { nam: 2026, thang: 9 } }],
          stop: 'tool_use',
        }));
      }
      return sse(res, luongTraLoi({ model, khoi: [{ type: 'thinking' }, { type: 'text', text: 'Dạ, em nghe đây. Anh chị cần tra số liệu gì ạ?' }], stop: 'end_turn' }));
    });
  });
  return { sv, yeuCau, tuChoiDuPhong };
}

// ------------------------------------------------------------------ giả máy chủ thất thoát nước

const DON_VI = [
  ['Toàn công ty', 'ToanCongTy', 12.3456, 15, 1.2],
  ['Đội Cấp nước số 1', 'Doi', 9.81, 8.57, -0.4],
  ['KV. Ngã Bảy', 'KhuVuc', 10.2, 8.57, 0.3],
  ['Đội Cấp nước số 2', 'Doi', 8.12, 8.3, 0.1],
  ['Đội Cấp nước số 3', 'Doi', 16.75, 15, 2.6],
  ['DMA 3 Liên - Tám Ngàn', 'Dma', null, null, null],
];

export function giaLapThatThoat({ cert, key } = {}) {
  const nhatKy = [];
  const TOKEN = 'token-gia-lap-123', TOKEN_2 = 'token-gia-lap-456';
  const xl = (req, res) => {
    let s = '';
    req.on('data', (c) => { s += c; });
    req.on('end', () => {
      const u = new URL(req.url, 'http://x');
      nhatKy.push({ method: req.method, path: u.pathname, query: Object.fromEntries(u.searchParams), body: s, auth: req.headers.authorization });
      const tra = (st, o) => { res.writeHead(st, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(o)); };
      const d = u.pathname;
      if (d === '/api/ping') return tra(200, { ungDung: 'ThatThoatNuoc', congTy: 'CÔNG TY TNHH MTV CẤP NƯỚC HẬU GIANG', coDuLieu: true });
      if (d === '/api/dangnhap') {
        const b = JSON.parse(s || '{}');
        if (b.ten === 'quan' && b.matKhau === 'matkhau') return tra(200, { token: TOKEN, ten: 'quan', hoTen: 'Nguyễn Hoàng Quân', tenVaiTro: 'Chỉ xem' });
        if (b.ten === 'lan' && b.matKhau === 'matkhau') return tra(200, { token: TOKEN_2, ten: 'lan', hoTen: 'Trần Thị Lan', tenVaiTro: 'Chỉ xem' });
        return tra(401, { loi: 'Sai tên đăng nhập hoặc mật khẩu.' });
      }
      const ai = { ['Bearer ' + TOKEN]: { ten: 'quan', hoTen: 'Nguyễn Hoàng Quân', tenVaiTro: 'Chỉ xem' },
        ['Bearer ' + TOKEN_2]: { ten: 'lan', hoTen: 'Trần Thị Lan', tenVaiTro: 'Chỉ xem' } }[req.headers.authorization];
      if (!ai) return tra(401, { loi: 'Phiên đăng nhập đã hết — hãy đăng nhập lại.' });
      if (d === '/api/toi') return tra(200, ai);
      if (d === '/api/dangxuat') return tra(200, { ok: true });
      if (d === '/api/tongquan') {
        const thang = Number(u.searchParams.get('thang') || 9), nam = Number(u.searchParams.get('nam') || 2026);
        const coThang = nam === 2026 && thang >= 1 && thang <= 9;
        const chon = coThang ? { nam, thang } : { nam: 2026, thang: 9 };
        return tra(200, {
          thang: [9, 8, 7, 6, 5, 4, 3, 2, 1].map((t) => ({ nam: 2026, thang: t, ten: 'Tháng ' + t + '/2026' })),
          chon: { ...chon, ten: 'Tháng ' + chon.thang + '/' + chon.nam, kyHoaDon: 'Kỳ 9', tuNgay: '21/08/2026', denNgay: '20/09/2026' },
          donVi: DON_VI.map(([ten, vaiTro, tyLe, keHoach, soThangTruoc], i) => ({
            id: i + 1, stt: String(i), ten, tenDay: ten, vaiTro, tyLe, keHoach, soThangTruoc, soKeHoach: tyLe != null && keHoach != null ? tyLe - keHoach : null,
            soCungKy: tyLe != null ? -0.85 : null, phatRa: tyLe != null ? 1234567.4 : null, chuanThu: tyLe != null ? 1082100.6 : null,
            lkTyLe: tyLe != null ? tyLe - 0.5 : null, lkPhatRa: 9876543.2, lkChuanThu: 8765432.1, lkSoCungKy: -1.1,
            thieu: false, tinhTrang: tyLe == null ? 'TLK đứng kim' : '',
          })),
        });
      }
      if (d === '/api/tonghop') {
        return tra(200, {
          cacNam: [2026, 2025], nam: Number(u.searchParams.get('nam') || 2026), coThang: [1, 2, 3, 4, 5, 6, 7, 8, 9], denThang: 9,
          dong: DON_VI.map(([ten, vaiTro, tyLe, keHoach], i) => ({
            id: i + 1, stt: String(i), ten, vaiTro, thang: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((t) => (t > 9 ? null : tyLe == null ? 'TLK đứng kim' : tyLe + t / 10)),
            lkTyLe: tyLe, lkPhatRa: 9876543.2, lkChuanThu: 8765432.1, lkSoCungKy: -1.1, keHoach,
          })),
        });
      }
      if (d === '/api/cap1') {
        const t = (sl) => ({ sanLuong: sl, thangTruoc: sl * 0.97, luyKe: sl * 8.6, soDongHo: 3, soChuaNhap: 0 });
        return tra(200, {
          thang: [{ nam: 2026, thang: 9, ten: 'Tháng 9/2026' }], doi: [{ id: 1, ten: 'Đội Cấp nước số 1' }], doiChon: -1,
          chon: { nam: 2026, thang: 9, ten: 'Tháng 9/2026', tuNgay: '21/08/2026', denNgay: '21/09/2026', laCuoi: true },
          tong: t(900000), gieng: t(300000), mat: t(600000),
          nhom: [{ ...t(900000), id: 1, ten: 'Đội Cấp nước số 1', tram: [{ ...t(900000), id: 1, ten: 'Nhà máy nước Vị Thanh', chot: 'Từ 6h 21/8 đến 6h 21/9',
            dongHo: [{ id: 1, ten: 'TLK cấp I số 1', nguon: 'Nước mặt', heSo: 1, cu: 100, moi: 900100, slNhap: null, sanLuong: 900000, thangTruoc: 873000, luyKe: 7740000, ghiChu: '', thayDongHo: false, amChiSo: false }] }] }],
        });
      }
      return tra(404, { loi: 'Không có địa chỉ này.' });
    });
  };
  const sv = cert ? https.createServer({ cert, key }, xl) : http.createServer(xl);
  return { sv, nhatKy, TOKEN };
}

// Chạy riêng: giả Claude ở cổng 8701, giả máy chủ thất thoát nước (http) ở cổng 8702.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  giaLapClaude().sv.listen(8701, () => console.log('Giả Claude:     http://localhost:8701   (ANTHROPIC_BASE_URL)'));
  giaLapThatThoat().sv.listen(8702, () => console.log('Giả thất thoát: http://localhost:8702   (MAYCHU_DIACHI=http://localhost:8702, tài khoản quan / matkhau)'));
}
