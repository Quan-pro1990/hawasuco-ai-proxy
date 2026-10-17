/* Chạy thử (mô phỏng) xe đi theo tuyến để xem trước dẫn đường mà không cần di chuyển. */
import { diemTaiS } from './hinh-hoc.js';

const RE_CHAM = new Set(['turn', 'end of road', 'roundabout', 'rotary', 'roundabout turn', 'fork', 'off ramp', 'on ramp', 'merge']);

export class MoPhong {
  /**
   * @param tuyen tuyến dạng chung
   * @param phat  (vt) => void
   * @param o.heSo     tua nhanh thời gian (1, 2, 4)
   * @param o.ketThuc  gọi khi tới cuối tuyến
   */
  constructor(tuyen, phat, { heSo = 1, ketThuc } = {}) {
    this.phat = phat;
    this.heSo = heSo;
    this.ketThuc = ketThuc;
    this.congThem = 0;         // km/h người dùng cộng / trừ để thử cảnh báo tốc độ
    this.tamDung = false;
    this.datTuyen(tuyen);
  }

  datTuyen(tuyen) {
    this.tuyen = tuyen;
    this.s = 0;
    this.v = this.v || 0;
  }

  batDau() {
    this.dung();
    this.dongHo = setInterval(() => this.buoc(), 1000);
    this.buoc(0);
  }

  dung() {
    if (this.dongHo) clearInterval(this.dongHo);
    this.dongHo = null;
  }

  buoc(dtThuc = 1) {
    if (this.tamDung) return;
    const t = this.tuyen, cum = t.tichLuy, tong = cum[cum.length - 1];
    const dt = dtThuc * this.heSo;
    const mucTieu = this.tocDoMucTieu();
    this.v += Math.max(-3 * dt, Math.min(2 * dt, mucTieu - this.v));
    this.v = Math.max(0, this.v);
    this.s = Math.min(tong, this.s + this.v * dt);
    const p = diemTaiS(t.toaDo, cum, this.s);
    const xong = this.s >= tong - 0.5;
    this.phat({ viTri: p.diem, tocDo: xong ? 0 : this.v, huong: p.huong, doChinhXac: 5, thoiGian: Date.now(), moPhong: true });
    if (xong) { this.dung(); if (this.ketThuc) this.ketThuc(); }
  }

  /** Tốc độ (m/s) theo tốc độ trung bình của bước trên tuyến, giảm tốc trước chỗ rẽ. */
  tocDoMucTieu() {
    const b = this.tuyen.buoc;
    let k = 0;
    while (k + 1 < b.length && b[k + 1].batDau <= this.s) k++;
    let v = b[k].thoiGian > 0 ? b[k].quangDuong / b[k].thoiGian : 12;
    v = Math.min(33, Math.max(4, v)) + this.congThem / 3.6;
    const ke = b[k + 1];
    if (ke) {
      const d = ke.batDau - this.s;
      if (ke.loai === 'arrive') v = Math.min(v, 2 + d * 0.12);
      else if (RE_CHAM.has(ke.loai) && ke.huong !== 'straight' && d < 80) v = Math.min(v, 5 + d * 0.12);
    }
    return Math.max(1.5, v);
  }
}
