/*
 * Bộ máy dẫn đường (không dùng DOM): nhận từng vị trí GPS, bắt lên tuyến, tính bước kế tiếp,
 * quãng đường / thời gian còn lại, câu nhắc giọng nói, phát hiện đi sai đường và đến nơi.
 */
import { chieuLenDoan, phuongVi, lechGoc, timChiSo } from './hinh-hoc.js';
import { quangDuongNoi, thuongDau } from './dinh-dang.js';
import { canNhac } from './chi-duong.js';

const SO_LAN_LECH = 3;          // số lần liên tiếp ở xa tuyến thì coi là đi sai đường

export class DanDuong {
  /** @param tuyen tuyến đường dạng chung (xem chi-duong.js) */
  constructor(tuyen) {
    this.tuyen = tuyen;
    this.s = 0;                 // quãng đường đã đi dọc tuyến (m)
    this.chiSo = 0;             // đoạn tuyến đang bám
    this.k = 0;                 // bước hiện tại (đã qua thao tác của bước k)
    this.lanLech = 0;
    this.daNoi = new Set();     // "chỉSốBước:mức" đã đọc
    this.daDen = false;
    this.daCoViTri = false;
  }

  get tongDai() { return this.tuyen.tichLuy[this.tuyen.tichLuy.length - 1]; }

  /** Câu đọc khi bắt đầu dẫn đường. */
  loiBatDau() {
    const b = this.tuyen.buoc;
    const ke = b[1];
    let cau = 'Bắt đầu dẫn đường. ' + b[0].chiDan + '.';
    if (ke && ke.loai !== 'arrive') {
      const kc = ke.batDau;
      cau += ` Sau ${quangDuongNoi(kc)}, ${thuongDau(ke.chiDan)}.`;
      this.daNoi.add('1:xa');
      if (kc < 200) this.daNoi.add('1:gan');
    }
    return cau;
  }

  /**
   * @param vt { viTri: [lng, lat], tocDo (m/s), huong (độ), doChinhXac (m) }
   * @returns trạng thái hiển thị + `noi` (câu cần đọc) + `suKien` ('lechtuyen' | 'diemdung' | 'dennoi')
   */
  capNhat(vt) {
    const t = this.tuyen, c = t.toaDo, cum = t.tichLuy;
    const v = vt.tocDo > 0 ? vt.tocDo : 0;
    const suKien = [];

    // 1. Bắt lên tuyến: tìm quanh vị trí cũ trước, không thấy mới tìm toàn tuyến
    let tot = null;
    if (this.daCoViTri) {
      const tu = timChiSo(cum, this.s - 60);
      const den = timChiSo(cum, this.s + Math.max(400, v * 25)) + 1;
      tot = this.bam(vt, tu, den);
    }
    if (!tot || tot.kc > 40) {
      const toanBo = this.bam(vt, 0, c.length - 1);
      if (toanBo && (!tot || toanBo.diemSo + 5 < tot.diemSo)) tot = toanBo;
    }
    const nguong = Math.min(80, Math.max(30, (vt.doChinhXac || 10) * 1.5));
    const lech = !tot || tot.kc > nguong;
    if (lech) this.lanLech++; else this.lanLech = 0;
    if (tot && (!lech || !this.daCoViTri)) {
      this.s = tot.s;
      this.chiSo = tot.chiSo;
      this.daCoViTri = true;
    }
    if (this.lanLech === SO_LAN_LECH) suKien.push({ loai: 'lechtuyen' });

    // 2. Bước hiện tại và thao tác kế tiếp
    const buoc = t.buoc;
    let k = this.k;
    while (k + 1 < buoc.length && buoc[k + 1].batDau <= this.s + 2) {
      k++;
      if (buoc[k].diemDung) suKien.push({ loai: 'diemdung', buoc: buoc[k] });
    }
    while (k > 0 && buoc[k].batDau > this.s + 2) k--;
    const quaBuoc = k > this.k;
    this.k = k;
    const ke = buoc[k + 1] || null;
    const conLai = Math.max(0, this.tongDai - this.s);
    const kcDenRe = ke ? Math.max(0, ke.batDau - this.s) : conLai;

    // 3. Thời gian còn lại: phần còn lại của bước hiện tại + các bước sau
    const bk = buoc[k];
    const daiBuoc = (ke ? ke.batDau : this.tongDai) - bk.batDau;
    let tg = daiBuoc > 0 ? bk.thoiGian * Math.min(1, kcDenRe / daiBuoc) : 0;
    for (let j = k + 1; j < buoc.length; j++) tg += buoc[j].thoiGian;

    // 4. Đến nơi
    if (!this.daDen && this.daCoViTri && !lech && conLai < 25) {
      this.daDen = true;
      suKien.push({ loai: 'dennoi' });
    }

    // 5. Câu nhắc
    let noi = null;
    if (!this.daDen && !lech) noi = this.nhac(k, ke, kcDenRe, v, quaBuoc);
    if (this.daDen && suKien.some(e => e.loai === 'dennoi')) {
      const cuoi = buoc[buoc.length - 1];
      noi = 'Bạn đã đến nơi.' + (/left/.test(cuoi.huong) ? ' Điểm đến ở bên trái.' : /right/.test(cuoi.huong) ? ' Điểm đến ở bên phải.' : '');
    }

    const huongTuyen = phuongVi(c[this.chiSo], c[Math.min(this.chiSo + 1, c.length - 1)]);
    return {
      s: this.s, conLai, thoiGianConLai: tg, kcDenRe, buocHienTai: k, ke,
      keNua: ke ? buoc[k + 2] || null : null,
      diemBam: tot && !lech ? tot.diemChieu : vt.viTri, kcLech: tot ? tot.kc : Infinity, lech,
      huongTuyen, noi, suKien, daDen: this.daDen
    };
  }

  /** Bắt điểm lên đoạn [tu, den], có xét hướng đi để không nhảy sang chiều ngược lại của tuyến. */
  bam(vt, tu, den) {
    const c = this.tuyen.toaDo, cum = this.tuyen.tichLuy;
    const coHuong = vt.huong != null && isFinite(vt.huong) && vt.tocDo > 2;
    let tot = null;
    for (let i = Math.max(0, tu); i < Math.min(den, c.length - 1); i++) {
      const r = chieuLenDoan(vt.viTri, c[i], c[i + 1]);
      let diem = r.kc;
      if (coHuong) {
        const lg = Math.abs(lechGoc(phuongVi(c[i], c[i + 1]), vt.huong));
        if (lg > 100) diem += 40;
      }
      // tránh nhảy xa khỏi chỗ đang đi (tuyến vòng lại gần chính nó)
      if (this.daCoViTri) diem += Math.max(0, Math.abs(cum[i] - this.s) - 300) * 0.02;
      if (!tot || diem < tot.diemSo) tot = { chiSo: i, kc: r.kc, diemSo: diem, diemChieu: r.diem, s: cum[i] + r.t * (cum[i + 1] - cum[i]) };
    }
    return tot;
  }

  /** Chọn câu nhắc theo khoảng cách tới chỗ rẽ và tốc độ. */
  nhac(k, ke, d, v, quaBuoc) {
    if (!ke) return null;
    const i = k + 1;
    const buoc = this.tuyen.buoc;
    const laDen = ke.loai === 'arrive';
    const xa = v > 22 ? 2000 : v > 14 ? 1000 : 500;
    const gan = Math.max(150, v * 12);
    const ngay = Math.max(30, v * 4);
    const da = muc => this.daNoi.has(i + ':' + muc);
    const danh = (...muc) => muc.forEach(m => this.daNoi.add(i + ':' + m));

    if (!laDen && !canNhac(ke)) { danh('xa', 'gan', 'ngay'); return null; }

    if (d <= ngay) {
      if (da('ngay')) return null;
      danh('xa', 'gan', 'ngay');
      if (laDen) return null;               // câu "đã đến nơi" do sự kiện đến nơi đọc
      let cau = ke.chiDan;
      const sau = buoc[i + 1];
      if (sau && sau.batDau - ke.batDau < 120 && (sau.loai === 'arrive' || canNhac(sau))) {
        cau += ', sau đó ' + thuongDau(sau.chiDan);
        this.daNoi.add((i + 1) + ':xa');
        this.daNoi.add((i + 1) + ':gan');
      }
      return cau + '.';
    }
    if (d <= gan) {
      if (da('gan')) return null;
      danh('xa', 'gan');
      return `Sau ${quangDuongNoi(d)}, ${thuongDau(ke.chiDan)}.`;
    }
    if (d <= xa) {
      if (da('xa')) return null;
      danh('xa');
      return `Sau ${quangDuongNoi(d)}, ${thuongDau(ke.chiDan)}.`;
    }
    // Vừa qua chỗ rẽ mà chỗ rẽ sau còn xa: báo đi thẳng bao lâu
    if (quaBuoc && !da('dai')) {
      danh('dai');
      return `Tiếp tục đi thẳng ${quangDuongNoi(d)}.`;
    }
    return null;
  }
}
