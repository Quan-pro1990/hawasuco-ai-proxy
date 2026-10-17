/*
 * Cảnh báo khi lái xe: vượt tốc độ, camera, đường sắt giao cắt, trạm thu phí và báo cáo giao thông phía trước.
 * Có tuyến dẫn đường thì xét điểm nằm trên tuyến; không có thì xét điểm nằm trong hướng đang đi.
 */
import { caiDat } from './kho.js';
import { khoangCach, phuongVi, lechGoc, chieuLenDoan, timChiSo } from './hinh-hoc.js';
import { quangDuongNoi, thoiGianTruoc, tocDoKmh } from './dinh-dang.js';
import { LOAI_BAO_CAO } from './loai-bao-cao.js';

const DIEM_CO_DINH = {
  camera: { ten: 'Camera tốc độ', icon: 'cameratocdo', bat: 'canhBaoCamera' },
  duongsat: { ten: 'Đường sắt giao cắt', icon: 'duongsat', bat: 'canhBaoDuongSat', kc: 300 },
  thuphi: { ten: 'Trạm thu phí', icon: 'thuphi', bat: 'canhBaoThuPhi', kc: 1000 }
};

export class CanhBao {
  /**
   * @param o.thongTinDuong ThongTinDuong
   * @param o.layBaoCao     () => danh sách báo cáo đang có
   * @param o.noi           (câu, tuỳ chọn) => void
   * @param o.bip           (loại) => void
   */
  constructor(o) {
    Object.assign(this, o);
    this.daBao = new Map();       // id điểm → lúc đã đọc cảnh báo
    this.vuotTocLuc = 0;          // lúc bắt đầu vượt tốc độ (0 = không vượt)
    this.noiVuotTocLuc = 0;
    this.bipLuc = 0;
  }

  /**
   * @param vt   vị trí { viTri, huong, tocDo }
   * @param dd   null hoặc { tuyen, tt } khi đang dẫn đường (tt = trạng thái từ DanDuong)
   */
  capNhat(vt, dd, phuongTien) {
    const kmh = tocDoKmh(vt.tocDo);
    const duong = this.thongTinDuong.duongHienTai(vt.viTri, vt.huong, vt.tocDo || 0, phuongTien);
    let gioiHan = duong ? duong.gioiHan : null, uocTinh = false;
    if (!gioiHan && duong && caiDat.uocTinhGioiHan && duong.gioiHanUocTinh) { gioiHan = duong.gioiHanUocTinh; uocTinh = true; }

    // ---- vượt tốc độ
    const vuotToc = !!(caiDat.canhBaoTocDo && gioiHan && kmh > gioiHan + caiDat.nguongVuot);
    const bayGio = Date.now();
    if (vuotToc) {
      if (!this.vuotTocLuc) {
        this.vuotTocLuc = bayGio;
        if (bayGio - this.noiVuotTocLuc > 60000) {
          this.noi(`Bạn đang chạy quá tốc độ. Tốc độ tối đa ${gioiHan} ki lô mét trên giờ.`, { chen: true });
          this.noiVuotTocLuc = bayGio;
        }
      }
      if (caiDat.bipVuotToc && bayGio - this.bipLuc > 4000) { this.bip('vuottoc'); this.bipLuc = bayGio; }
    } else {
      this.vuotTocLuc = 0;
    }

    // ---- điểm phía trước
    const canhBao = this.diemPhiaTruoc(vt, dd);
    return { duong, gioiHan, uocTinh, kmh, vuotToc, canhBao };
  }

  danhSachDiem() {
    const ds = [];
    for (const d of this.thongTinDuong.danhSachDiem()) {
      const kieu = DIEM_CO_DINH[d.loai];
      if (!caiDat[kieu.bat]) continue;
      ds.push({ ...d, ten: kieu.ten, icon: kieu.icon, kcBao: kieu.kc || caiDat.kcCanhBaoCamera });
    }
    if (caiDat.canhBaoBaoCao) {
      for (const b of this.layBaoCao()) {
        const kieu = LOAI_BAO_CAO[b.loai];
        if (!kieu) continue;
        if (b.loai === 'camera' && !caiDat.canhBaoCamera) continue;
        ds.push({
          id: 'bc' + b.id, loai: b.loai === 'camera' ? 'camera' : 'baocao', loaiBaoCao: b.loai, viTri: [b.lng, b.lat],
          ten: kieu.ten, icon: kieu.icon, kcBao: b.loai === 'camera' ? caiDat.kcCanhBaoCamera : 800, taoLuc: b.taoLuc, gioiHan: null
        });
      }
    }
    return ds;
  }

  diemPhiaTruoc(vt, dd) {
    const p = vt.viTri;
    const coHuong = vt.huong != null && isFinite(vt.huong) && vt.tocDo > 2;
    let gan = null;
    for (const d of this.danhSachDiem()) {
      const thang = khoangCach(p, d.viTri);
      if (thang > 2500) { this.daBao.delete(d.id); continue; }
      let kc = null;
      if (dd) kc = this.kcTrenTuyen(d.viTri, dd);
      else if (coHuong && thang < 1500) {
        const goc = Math.abs(lechGoc(vt.huong, phuongVi(p, d.viTri)));
        if (goc < 60 && thang * Math.sin(goc * Math.PI / 180) < 35) kc = thang;
      }
      if (kc == null || kc > d.kcBao) continue;
      if (!gan || kc < gan.kc) gan = { ...d, kc };
    }
    if (gan && !this.daBao.has(gan.id)) {
      this.daBao.set(gan.id, Date.now());
      this.bip('canhbao');
      this.noi(this.cauCanhBao(gan));
    }
    return gan;
  }

  /** Khoảng cách dọc tuyến tới điểm, null nếu điểm không nằm trên đoạn tuyến phía trước. */
  kcTrenTuyen(diem, dd) {
    const t = dd.tuyen, c = t.toaDo, cum = t.tichLuy, s = dd.tt.s;
    const tu = timChiSo(cum, s), den = timChiSo(cum, s + 1500) + 1;
    let tot = null;
    for (let i = tu; i < Math.min(den, c.length - 1); i++) {
      const r = chieuLenDoan(diem, c[i], c[i + 1]);
      if (r.kc < 35 && (!tot || r.kc < tot.kc)) tot = { kc: r.kc, s: cum[i] + r.t * (cum[i + 1] - cum[i]) };
    }
    if (!tot || tot.s < s - 5) return null;
    return Math.max(0, tot.s - s);
  }

  cauCanhBao(d) {
    const kc = quangDuongNoi(Math.max(50, Math.round(d.kc / 50) * 50));
    if (d.loai === 'camera') {
      return `Phía trước ${kc} có camera giám sát tốc độ` + (d.gioiHan ? `, tốc độ tối đa ${d.gioiHan} ki lô mét trên giờ.` : '.');
    }
    if (d.loai === 'duongsat') return 'Chú ý, phía trước có đường sắt giao cắt. Giảm tốc độ, quan sát tàu.';
    if (d.loai === 'thuphi') return `Phía trước ${kc} có trạm thu phí.`;
    const kieu = LOAI_BAO_CAO[d.loaiBaoCao];
    return `Phía trước ${kc} có ${kieu.nghe}, được báo cáo ${thoiGianTruoc(d.taoLuc)}.`;
  }
}
