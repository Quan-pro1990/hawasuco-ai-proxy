// Gọi máy chủ "Quản lý thất thoát nước" (ThatThoatNuoc.exe chạy trên IIS) qua các địa chỉ /api/... có sẵn.
// Trợ lý chỉ ĐỌC số liệu, bằng chính tài khoản người dùng đã đăng nhập (máy chủ tự giới hạn quyền / đội).
//
// Máy chủ IIS dùng chứng chỉ tự ký, nên kiểm tra bằng "mã nhận dạng" (SHA-256 của chứng chỉ) giống phần mềm
// máy tính và app điện thoại: mã khác thì ngắt kết nối trước khi gửi bất kỳ dữ liệu nào (kể cả mật khẩu).

import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';

export class LoiMayChu extends Error {
  constructor(status, thongDiep) {
    super(thongDiep);
    this.status = status;
  }
}

/** "abcd-ef01-2345-6789" hoặc "AB:CD:…" (64 ký tự) → chữ hex hoa liền. */
export function chuanHoaMa(ma) {
  return String(ma || '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
}

export class MayChuThatThoat {
  /**
   * @param {object} o
   * @param {string} o.diaChi      vd "tenmien.vn:8080", "https://localhost:8080/thatthoat"
   * @param {string} [o.maNhanDang] mã nhận dạng chứng chỉ (16 hoặc 64 ký tự hex). Bỏ trống khi máy chủ có chứng chỉ thật.
   * @param {number} [o.thoiGianCho] mili giây chờ mỗi yêu cầu
   */
  constructor({ diaChi, maNhanDang, thoiGianCho = 15000 }) {
    let s = String(diaChi || '').trim();
    if (!s) throw new Error('Thiếu địa chỉ máy chủ thất thoát nước (MAYCHU_DIACHI).');
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    const u = new URL(s);
    this.goc = new URL(u.pathname.replace(/\/+$/, '') + '/api/', u.origin);
    this.thoiGianCho = thoiGianCho;
    this.ma = chuanHoaMa(maNhanDang);
    if (this.ma && this.ma.length !== 16 && this.ma.length !== 64)
      throw new Error('MAYCHU_MANHANDANG phải là mã 16 ký tự (vd ABCD-EF01-2345-6789) hoặc đủ 64 ký tự SHA-256.');

    if (this.goc.protocol === 'http:') {
      this.agent = new http.Agent({ keepAlive: true });
    } else if (this.ma) {
      const ma = this.ma;
      const agent = new https.Agent({ keepAlive: true, rejectUnauthorized: false });
      // Tự bắt tay TLS, so mã nhận dạng rồi mới trao kết nối cho http → không có byte nào của yêu cầu đi ra trước khi kiểm tra.
      agent.createConnection = (opts, xong) => {
        const o = { ...opts, rejectUnauthorized: false };
        if (!o.servername || net.isIP(o.servername)) delete o.servername;   // TLS không cho đặt tên máy chủ là địa chỉ IP
        const sock = tls.connect(o);
        const khiLoi = (e) => xong(e);
        sock.once('error', khiLoi);
        sock.once('secureConnect', () => {
          sock.removeListener('error', khiLoi);
          const cert = sock.getPeerCertificate();
          const vanTay = chuanHoaMa(cert && cert.fingerprint256);
          if (!vanTay || !vanTay.startsWith(ma)) {
            const loi = new LoiMayChu(0, 'Mã nhận dạng chứng chỉ máy chủ không khớp (máy chủ đưa ra ' +
              (vanTay ? maNgan(vanTay) : 'không có chứng chỉ') + ', đã cài ' + maNgan(ma) + '). Đã ngắt kết nối.');
            sock.destroy();
            xong(loi);
            return;
          }
          xong(null, sock);
        });
      };
      this.agent = agent;
    } else {
      this.agent = new https.Agent({ keepAlive: true });
    }
  }

  /** Gọi 1 địa chỉ /api/... → JSON. Lỗi máy chủ trả {loi: "..."} được chuyển thành LoiMayChu. */
  goi(phuongThuc, duong, { token, than, truyVan } = {}) {
    const url = new URL(duong, this.goc);
    for (const [k, v] of Object.entries(truyVan || {})) if (v != null && v !== '') url.searchParams.set(k, String(v));
    const body = than === undefined ? null : Buffer.from(JSON.stringify(than), 'utf8');
    const headers = { Accept: 'application/json', 'User-Agent': 'TroLyAo-ThatThoatNuoc' };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (body) { headers['Content-Type'] = 'application/json; charset=utf-8'; headers['Content-Length'] = body.length; }
    const lib = url.protocol === 'http:' ? http : https;

    return new Promise((ok, hong) => {
      const req = lib.request(url, { method: phuongThuc, headers, agent: this.agent, timeout: this.thoiGianCho }, (res) => {
        const phan = [];
        let dai = 0;
        res.on('data', (c) => {
          dai += c.length;
          if (dai > 20 * 1024 * 1024) { req.destroy(new LoiMayChu(502, 'Máy chủ trả về quá nhiều dữ liệu.')); return; }
          phan.push(c);
        });
        res.on('end', () => {
          const chu = Buffer.concat(phan).toString('utf8');
          let j = null;
          try { j = chu ? JSON.parse(chu) : null; } catch { j = null; }
          if (res.statusCode >= 200 && res.statusCode < 300) {
            if (j === null && chu) return hong(new LoiMayChu(502, 'Máy chủ trả về dữ liệu không đọc được.'));
            return ok(j);
          }
          hong(new LoiMayChu(res.statusCode, (j && j.loi) || 'Máy chủ thất thoát nước báo lỗi ' + res.statusCode + '.'));
        });
        res.on('error', hong);
      });
      req.on('timeout', () => req.destroy(new LoiMayChu(504, 'Máy chủ thất thoát nước không trả lời (quá ' + Math.round(this.thoiGianCho / 1000) + ' giây).')));
      req.on('error', (e) => hong(e instanceof LoiMayChu ? e : new LoiMayChu(0, 'Không kết nối được máy chủ thất thoát nước: ' + e.message)));
      if (body) req.write(body);
      req.end();
    });
  }

  ping() { return this.goi('GET', 'ping'); }
  dangNhap(ten, matKhau) { return this.goi('POST', 'dangnhap', { than: { ten, matKhau, thietBi: 'Trợ lý ảo giọng nói' } }); }
  dangXuat(token) { return this.goi('POST', 'dangxuat', { token, than: {} }); }
  toi(token) { return this.goi('GET', 'toi', { token }); }
  tongQuan(token, nam, thang) { return this.goi('GET', 'tongquan', { token, truyVan: { nam, thang } }); }
  tongHop(token, nam) { return this.goi('GET', 'tonghop', { token, truyVan: { nam } }); }
  cap1(token, nam, thang, doi) { return this.goi('GET', 'cap1', { token, truyVan: { nam, thang, doi } }); }
}

function maNgan(hex) {
  return [0, 1, 2, 3].map((i) => hex.substr(i * 4, 4)).join('-');
}
