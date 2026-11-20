// Ai được dùng trợ lý (để không ai lạ dùng khoá API của công ty):
//  - "thatthoat": đăng nhập bằng tài khoản phần mềm thất thoát nước trên máy chủ IIS (khuyên dùng).
//    Token trả cho trình duyệt chính là token của máy chủ đó → trợ lý tra số liệu đúng quyền của người đăng nhập.
//  - "matkhau":  không có máy chủ thất thoát nước → 1 mật khẩu chung (TRO_LY_MAT_KHAU).
//  - "cucbo":    không cài gì → chỉ dùng được ngay trên máy chạy trợ lý (localhost).

import crypto from 'node:crypto';
import { LoiMayChu } from './thatthoat.js';

const HAN_TOKEN_MAT_KHAU = 30 * 24 * 3600 * 1000;   // 30 ngày
const NHO_PHIEN = 5 * 60 * 1000;                     // nhớ kết quả kiểm tra token 5 phút

export class LoiXacThuc extends Error {
  constructor(status, thongDiep) { super(thongDiep); this.status = status; }
}

export const bam = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

export class XacThuc {
  constructor({ mayChu, matKhau }) {
    this.mayChu = mayChu || null;
    this.cheDo = this.mayChu ? 'thatthoat' : matKhau ? 'matkhau' : 'cucbo';
    this.khoaMatKhau = matKhau ? crypto.createHash('sha256').update('tro-ly-ao|' + matKhau).digest() : null;
    this.matKhau = matKhau || '';
    this.nho = new Map();      // bam(token) → { nguoi, het }
    this.sai = new Map();      // ip → { lan, tu }
  }

  #ghiSai(ip) {
    const now = Date.now();
    const s = this.sai.get(ip);
    if (!s || now - s.tu > 10 * 60 * 1000) this.sai.set(ip, { lan: 1, tu: now });
    else s.lan++;
  }

  #kiemTraSai(ip) {
    const s = this.sai.get(ip);
    if (s && s.lan >= 10 && Date.now() - s.tu < 10 * 60 * 1000)
      throw new LoiXacThuc(429, 'Đăng nhập sai quá nhiều lần. Thử lại sau 10 phút.');
  }

  /** @returns {Promise<{token: string, nguoi: object}>} */
  async dangNhap({ ten, matKhau }, ip) {
    this.#kiemTraSai(ip);
    if (this.cheDo === 'thatthoat') {
      if (!ten || !matKhau) throw new LoiXacThuc(400, 'Nhập tên đăng nhập và mật khẩu.');
      try {
        const r = await this.mayChu.dangNhap(String(ten).slice(0, 100), String(matKhau).slice(0, 200));
        const nguoi = { ten: r.ten, hoTen: r.hoTen, tenVaiTro: r.tenVaiTro, tenDoi: r.tenDoi, congTy: r.congTy };
        this.nho.set(bam(r.token), { nguoi, het: Date.now() + NHO_PHIEN });
        return { token: r.token, nguoi };
      } catch (e) {
        if (e instanceof LoiMayChu && (e.status === 401 || e.status === 429)) {
          if (e.status === 401) this.#ghiSai(ip);
          throw new LoiXacThuc(e.status, e.message);
        }
        throw new LoiXacThuc(502, e.message || 'Không kết nối được máy chủ thất thoát nước.');
      }
    }
    if (this.cheDo === 'matkhau') {
      const a = Buffer.from(bam(matKhau || '')), b = Buffer.from(bam(this.matKhau));
      if (!crypto.timingSafeEqual(a, b)) { this.#ghiSai(ip); throw new LoiXacThuc(401, 'Sai mật khẩu.'); }
      const het = Date.now() + HAN_TOKEN_MAT_KHAU;
      const ky = crypto.createHmac('sha256', this.khoaMatKhau).update('v1.' + het).digest('base64url');
      return { token: 'v1.' + het + '.' + ky, nguoi: { ten: 'nguoidung', hoTen: '' } };
    }
    return { token: 'cucbo', nguoi: { ten: 'cucbo', hoTen: '' } };
  }

  /**
   * Kiểm tra token của 1 yêu cầu.
   * @returns {Promise<{chuSo: string, nguoi: object, tokenMayChu: string|null}>}
   *   chuSo: mã chủ sở hữu (để mỗi người chỉ thấy hội thoại của mình)
   */
  async kiemTra(token, laCucBo) {
    if (this.cheDo === 'cucbo') {
      if (!laCucBo) throw new LoiXacThuc(403, 'Trợ lý chưa cài đăng nhập nên chỉ dùng được trên chính máy chủ. Hãy cài MAYCHU_DIACHI hoặc TRO_LY_MAT_KHAU trong file .env.');
      return { chuSo: 'cucbo', nguoi: { ten: 'cucbo', hoTen: '' }, tokenMayChu: null };
    }
    if (!token) throw new LoiXacThuc(401, 'Hãy đăng nhập.');
    if (this.cheDo === 'matkhau') {
      const m = /^v1\.(\d{10,16})\.([A-Za-z0-9_-]{43})$/.exec(token);
      if (!m || Number(m[1]) < Date.now()) throw new LoiXacThuc(401, 'Phiên đăng nhập đã hết — hãy đăng nhập lại.');
      const ky = crypto.createHmac('sha256', this.khoaMatKhau).update('v1.' + m[1]).digest();
      const nhan = Buffer.from(m[2], 'base64url');
      if (nhan.length !== ky.length || !crypto.timingSafeEqual(nhan, ky)) throw new LoiXacThuc(401, 'Phiên đăng nhập không hợp lệ — hãy đăng nhập lại.');
      return { chuSo: bam(token), nguoi: { ten: 'nguoidung', hoTen: '' }, tokenMayChu: null };
    }
    // thatthoat: hỏi máy chủ (có nhớ 5 phút)
    const k = bam(token);
    const n = this.nho.get(k);
    if (n && n.het > Date.now()) return { chuSo: k, nguoi: n.nguoi, tokenMayChu: token };
    try {
      const r = await this.mayChu.toi(token);
      const nguoi = { ten: r.ten, hoTen: r.hoTen, tenVaiTro: r.tenVaiTro, tenDoi: r.tenDoi, congTy: r.congTy };
      if (this.nho.size > 5000) this.nho.clear();
      this.nho.set(k, { nguoi, het: Date.now() + NHO_PHIEN });
      return { chuSo: k, nguoi, tokenMayChu: token };
    } catch (e) {
      if (e instanceof LoiMayChu && e.status === 401) { this.nho.delete(k); throw new LoiXacThuc(401, e.message); }
      throw new LoiXacThuc(502, e.message || 'Không kết nối được máy chủ thất thoát nước.');
    }
  }

  async dangXuat(token) {
    if (!token) return;
    this.nho.delete(bam(token));
    if (this.cheDo === 'thatthoat') {
      try { await this.mayChu.dangXuat(token); } catch { /* đã hết phiên thì thôi */ }
    }
  }

  /** Token máy chủ vừa báo hết hạn (lúc chạy công cụ) → quên ngay. */
  quen(token) { if (token) this.nho.delete(bam(token)); }
}
