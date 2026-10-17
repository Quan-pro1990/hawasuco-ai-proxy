/*
 * Cảnh báo khi lái xe: vượt tốc độ, giới hạn tốc độ thay đổi / phía trước, camera các loại, đường sắt, trạm thu phí,
 * đèn tín hiệu, gờ giảm tốc, trường học, hầm, khúc cua, biển cấm rẽ, vào / ra khu đông dân cư và báo cáo giao thông.
 * Có tuyến dẫn đường thì xét điểm nằm trên tuyến; không có thì xét điểm nằm trong hướng đang đi.
 */
import { caiDat } from './kho.js';
import { khoangCach, phuongVi, lechGoc, chieuLenDoan, timChiSo, diemTaiS, tichLuy, bamTuyen } from './hinh-hoc.js';
import { quangDuongNoi, thoiGianTruoc, tocDoKmh } from './dinh-dang.js';
import { LOAI_BAO_CAO } from './loai-bao-cao.js';
import { LOAI_CANH_BAO, BIEN_RE, NGUY_HIEM, mucCanhBao, kcBaoTruoc } from './loai-canh-bao.js';

const XE_OSM = { oto: 'motorcar', xemay: 'motorcycle', xedap: 'bicycle', dibo: 'foot' };

/**
 * Tìm khúc cua trên đường gấp khúc: lấy mẫu mỗi `buoc` m, cộng độ đổi hướng trong cửa sổ `cuaSo` m;
 * đổi hướng từ `nguong` độ trở lên là khúc cua. Trả về [{ s, viTri, goc (độ, dương = cua phải), dai }].
 */
export function timKhucCua(toaDo, cum = tichLuy(toaDo), { buoc = 10, cuaSo = 80, nguong = 55 } = {}) {
  const kq = [];
  const tong = cum[cum.length - 1];
  if (!(tong > cuaSo)) return kq;
  const n = Math.floor(tong / buoc);
  const mau = [];
  for (let i = 0; i <= n; i++) mau.push(diemTaiS(toaDo, cum, i * buoc).diem);
  const re = [0];                       // re[i]: đổi hướng tại điểm mẫu i
  let truoc = phuongVi(mau[0], mau[1]);
  for (let i = 1; i < n; i++) {
    const h = phuongVi(mau[i], mau[i + 1]);
    re.push(lechGoc(truoc, h));
    truoc = h;
  }
  const w = Math.max(2, Math.round(cuaSo / buoc));
  let i = 1;
  while (i + w <= re.length) {
    let goc = 0;
    for (let j = i; j < i + w; j++) goc += re[j];
    if (Math.abs(goc) < nguong) { i++; continue; }
    const chieu = Math.sign(goc);
    // mở rộng ra hai phía chừng nào còn cua cùng chiều, bỏ phần thẳng ở đầu cửa sổ
    let dau = i;
    while (dau > 1 && re[dau - 1] * chieu >= 2) dau--;
    while (dau < i + w && re[dau] * chieu < 2) dau++;
    let het = i + w;
    while (het < re.length && re[het] * chieu >= 2) het++;
    goc = 0;
    for (let j = dau; j < het; j++) goc += re[j];
    kq.push({ s: dau * buoc, viTri: mau[dau], goc: Math.round(goc), dai: (het - dau) * buoc });
    i = het + 1;
  }
  return kq;
}

/** Thẻ biển cấm rẽ áp dụng cho phương tiện đang đi, null nếu không áp dụng. */
export function bienReChoXe(the, phuongTien) {
  const xe = XE_OSM[phuongTien] || 'motorcar';
  const kieu = the['restriction:' + xe] || the.restriction;
  if (!kieu || !BIEN_RE[kieu]) return null;
  if (String(the.except || '').split(';').map(s => s.trim()).includes(xe)) return null;
  return kieu;
}

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
    this.cuaTuyen = new WeakMap(); // tuyến → khúc cua trên tuyến
    this.cuaDuong = new Map();     // id đường + chiều → khúc cua trên đường
    this.ghDaBao = null;           // giới hạn có biển đã đọc gần nhất
    this.ghCho = null;             // giới hạn mới đang chờ xác nhận (gặp 2 lần liên tiếp)
    this.ghBaoTruocLuc = 0;
    this.phienDuong = -1;
    this.kdc = null;               // đang trong khu đông dân cư?
    this.kdcGanDay = [];
    this.donLuc = Date.now();
    if (this.thongTinDuong) this.thongTinDuong.layLoaiCan = () => this.loaiCanTai();
  }

  /** Các loại điểm cần tải từ dữ liệu đường (loại đang bật). */
  loaiCanTai() {
    const s = new Set();
    for (const [k, v] of Object.entries(LOAI_CANH_BAO)) if (!v.khongBanDo && mucCanhBao(k) > 0) s.add(k);
    return s;
  }

  /**
   * @param vt   vị trí { viTri, huong, tocDo }
   * @param dd   null hoặc { tuyen, tt } khi đang dẫn đường (tt = trạng thái từ DanDuong)
   */
  capNhat(vt, dd, phuongTien) {
    // tốc độ hiển thị: tốc độ GPS cộng phần hiệu chỉnh cho khớp đồng hồ trên xe
    const kmh = tocDoKmh(vt.tocDo == null ? null : vt.tocDo * (1 + (caiDat.hieuChinhTocDo || 0) / 100));
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

    this.theoDoiGioiHan(duong, kmh, vuotToc);
    this.theoDoiKhuDanCu(kmh, phuongTien);
    if (bayGio - this.donLuc > 600000) this.donDep(bayGio);

    // ---- điểm phía trước
    const canhBao = this.diemPhiaTruoc(vt, dd, { duong, phuongTien, kmh, gioiHan });
    return { duong, gioiHan, uocTinh, kmh, vuotToc, canhBao, khuDanCu: !!this.kdc && mucCanhBao('khudancu') > 0 };
  }

  /** Đọc giới hạn mới khi giới hạn có biển của con đường thay đổi. */
  theoDoiGioiHan(duong, kmh, vuotToc) {
    const gh = duong ? duong.gioiHan : null;
    if (!gh) { this.ghCho = null; return; }
    if (gh === this.ghDaBao) { this.ghCho = null; return; }
    if (this.ghCho !== gh) { this.ghCho = gh; return; }
    this.ghCho = null;
    const daCo = this.ghDaBao;
    this.ghDaBao = gh;
    // lần đầu chỉ ghi nhận; vừa báo trước giới hạn này hoặc đang báo vượt tốc độ thì không đọc lại
    if (daCo == null || kmh < 10 || vuotToc || Date.now() - this.ghBaoTruocLuc < 45000) return;
    if (mucCanhBao('gioihan') >= 2) this.noi(`Tốc độ tối đa ${gh} ki lô mét trên giờ.`);
  }

  /** Vào / ra khu đông dân cư (ước tính theo mật độ đường nhỏ quanh vị trí, cần 2 lần tải dữ liệu liên tiếp giống nhau). */
  theoDoiKhuDanCu(kmh, phuongTien) {
    const ttd = this.thongTinDuong;
    if (ttd.phienDuong === this.phienDuong) return;
    this.phienDuong = ttd.phienDuong;
    if (!ttd.phienDuong) return;
    const v = ttd.dongDanCu;
    this.kdcGanDay = [...this.kdcGanDay.slice(-1), v];
    if (this.kdc == null) { this.kdc = v; return; }
    if (v === this.kdc || this.kdcGanDay.length < 2 || this.kdcGanDay.some(x => x !== v)) return;
    this.kdc = v;
    if (mucCanhBao('khudancu') >= 2 && kmh >= 15 && (phuongTien === 'oto' || phuongTien === 'xemay')) {
      this.noi(v ? 'Vào khu vực đông dân cư, chú ý tốc độ.' : 'Ra khỏi khu vực đông dân cư.');
    }
  }

  donDep(bayGio) {
    this.donLuc = bayGio;
    for (const [id, luc] of this.daBao) if (bayGio - luc > 30 * 60000) this.daBao.delete(id);
    if (this.cuaDuong.size > 200) this.cuaDuong.clear();
  }

  /** Điểm cảnh báo cố định và báo cáo đang bật (mức > 0). */
  danhSachDiem(phuongTien = caiDat.phuongTien, duong = null) {
    const ds = [];
    for (const d of this.thongTinDuong.danhSachDiem()) {
      const kieu = LOAI_CANH_BAO[d.loai];
      const muc = kieu ? mucCanhBao(d.loai) : 0;
      if (!muc) continue;
      const x = { ...d, ten: kieu.ten, tenRieng: d.ten, icon: kieu.icon, mau: kieu.mau, muc, kcBao: kcBaoTruoc(d.loai) };
      if (d.loai === 'camre') {
        const kieuRe = bienReChoXe(d.the || {}, phuongTien);
        if (!kieuRe) continue;
        Object.assign(x, { kieuRe, ten: BIEN_RE[kieuRe].ten, icon: BIEN_RE[kieuRe].icon });
        // chỉ báo khi đang đi trên đường "from" của biển (đi tới giao lộ từ hướng bị cấm)
        x.apDung = !!(duong && d.tuDuong.includes(duong.id));
      }
      if (d.loai === 'nguyhiem' && NGUY_HIEM[d.nguyHiem]) x.ten = NGUY_HIEM[d.nguyHiem][0].toUpperCase() + NGUY_HIEM[d.nguyHiem].slice(1);
      if (d.ten && (d.loai === 'tramdung' || d.loai === 'ham')) x.ten += ' ' + d.ten;
      ds.push(x);
    }
    const mucBc = mucCanhBao('baocao');
    for (const b of this.layBaoCao()) {
      const kieu = LOAI_BAO_CAO[b.loai];
      if (!kieu) continue;
      const viTri = [b.lng, b.lat];
      if (b.loai === 'camera') {
        const loai = (kieu.phu[b.phu] || {}).canhBao || 'camera', k = LOAI_CANH_BAO[loai], muc = mucCanhBao(loai);
        if (muc) ds.push({ id: 'bc' + b.id, loai, viTri, ten: k.ten, icon: k.icon, mau: k.mau, muc, kcBao: kcBaoTruoc(loai), gioiHan: null, baoCao: true });
      } else if (mucBc) {
        ds.push({
          id: 'bc' + b.id, loai: 'baocao', loaiBaoCao: b.loai, viTri, ten: kieu.ten, icon: kieu.icon, mau: kieu.mau, muc: mucBc,
          kcBao: kcBaoTruoc('baocao'), taoLuc: b.taoLuc, gioiHan: null
        });
      }
    }
    return ds;
  }

  /** Điểm để vẽ trên bản đồ: { id, viTri, icon, nho }. */
  diemBanDo() {
    return this.danhSachDiem().filter(d => !d.loaiBaoCao && !d.baoCao)
      .map(d => ({ id: d.id, viTri: d.viTri, icon: d.icon, nho: !!LOAI_CANH_BAO[d.loai].nho }));
  }

  diemPhiaTruoc(vt, dd, { duong = null, phuongTien = caiDat.phuongTien, kmh = tocDoKmh(vt.tocDo), gioiHan = null } = {}) {
    const p = vt.viTri;
    const coHuong = vt.huong != null && isFinite(vt.huong) && vt.tocDo > 2;
    const ds = [];
    const daXet = new Set();
    for (const d of this.danhSachDiem(phuongTien, duong)) {
      const thang = khoangCach(p, d.viTri);
      if (thang > 2500) { if (!d.cung) this.daBao.delete(d.id); continue; }
      if (d.loai === 'camre' && !d.apDung) continue;
      const lech = LOAI_CANH_BAO[d.loai].lech || 35;
      let kc = null;
      if (dd) kc = this.kcTrenTuyen(d.viTri, dd, lech, d.kcBao + 50);
      else if (coHuong && thang < d.kcBao + 100) {
        const goc = Math.abs(lechGoc(vt.huong, phuongVi(p, d.viTri)));
        if (goc < 60 && thang * Math.sin(goc * Math.PI / 180) < lech) kc = thang;
      }
      if (kc == null || kc > d.kcBao) continue;
      // hai cửa của một hầm: chỉ lấy cửa gần hơn
      if (d.cung) { if (daXet.has(d.cung)) continue; daXet.add(d.cung); d.id = d.cung; }
      ds.push({ ...d, kc });
    }
    if (kmh >= 25) ds.push(...this.khucCuaPhiaTruoc(vt, dd, duong));
    if (dd) { const g = this.gioiHanPhiaTruoc(dd, phuongTien, gioiHan); if (g) ds.push(g); }
    ds.sort((a, b) => a.kc - b.kc);

    // đọc những điểm vừa vào tầm báo trước (gần trước; tối đa 2 câu mỗi lần để không dồn dập)
    let soCau = 0;
    for (const d of ds) {
      if (this.daBao.has(d.id)) continue;
      this.daBao.set(d.id, Date.now());
      if (d.loai === 'gioihan') this.ghBaoTruocLuc = Date.now();
      if (d.muc < 2 || soCau >= 2) continue;
      if (!soCau) this.bip('canhbao');
      this.noi(this.cauCanhBao(d));
      soCau++;
    }
    // hiển thị: loại quan trọng hơn trước, cùng mức thì gần hơn trước
    ds.sort((a, b) => (LOAI_CANH_BAO[b.loai].uuTien - LOAI_CANH_BAO[a.loai].uuTien) || (a.kc - b.kc));
    return ds[0] || null;
  }

  /** Khúc cua phía trước: theo hình dạng tuyến khi dẫn đường (trừ chỗ rẽ đã có hướng dẫn), hoặc theo con đường đang đi. */
  khucCuaPhiaTruoc(vt, dd, duong) {
    const muc = mucCanhBao('khuccua');
    if (!muc) return [];
    const kcBao = kcBaoTruoc('khuccua');
    let ds = [], s0;
    if (dd) {
      const t = dd.tuyen;
      if (!this.cuaTuyen.has(t)) {
        const re = (t.buoc || []).filter(b => b.loai !== 'depart' && b.loai !== 'arrive').map(b => b.batDau);
        this.cuaTuyen.set(t, timKhucCua(t.toaDo, t.tichLuy).filter(c => !re.some(r => r > c.s - 40 && r < c.s + c.dai + 40)));
      }
      ds = this.cuaTuyen.get(t);
      s0 = dd.tt.s;
    } else if (duong && duong.toaDo && vt.huong != null && vt.tocDo > 2) {
      const khoa = duong.id + (duong.xuoi ? '+' : '-');
      let x = this.cuaDuong.get(khoa);
      if (!x) {
        const toaDo = duong.xuoi ? duong.toaDo : duong.toaDo.slice().reverse();
        const cum = tichLuy(toaDo);
        x = { toaDo, cum, cua: timKhucCua(toaDo, cum) };
        this.cuaDuong.set(khoa, x);
      }
      const b = bamTuyen(x.toaDo, x.cum, vt.viTri);
      if (!b || b.kc > 40) return [];
      ds = x.cua;
      s0 = b.s;
    } else return [];
    const kq = [];
    for (const c of ds) {
      const kc = c.s - s0;
      if (kc < 0 || kc > kcBao) continue;
      const phai = c.goc > 0, gap = Math.abs(c.goc) >= 80;
      kq.push({
        id: 'cua' + c.viTri[0].toFixed(4) + ',' + c.viTri[1].toFixed(4), loai: 'khuccua', viTri: c.viTri, kc, kcBao, muc,
        ten: `Khúc cua ${gap ? 'gấp ' : ''}${phai ? 'phải' : 'trái'}`, icon: phai ? 'cuaphai' : 'cuatrai', mau: LOAI_CANH_BAO.khuccua.mau,
        cuaPhai: phai, gap, gioiHan: null
      });
    }
    return kq;
  }

  /** Giới hạn tốc độ có biển khác giới hạn hiện tại trên đoạn tuyến phía trước (trong vùng dữ liệu đường đã tải). */
  gioiHanPhiaTruoc(dd, phuongTien, gioiHan) {
    const muc = mucCanhBao('gioihan');
    if (!muc || !gioiHan) return null;
    const t = dd.tuyen, s = dd.tt.s, tong = t.tichLuy[t.tichLuy.length - 1];
    const xa = kcBaoTruoc('gioihan');
    for (let k = 60; k <= xa && s + k < tong; k += 40) {
      const q = diemTaiS(t.toaDo, t.tichLuy, s + k);
      const g = this.thongTinDuong.gioiHanTai(q.diem, q.huong, phuongTien);
      if (!g || !g.gioiHan || g.gioiHan === gioiHan) continue;
      return {
        id: 'gh' + g.id + '-' + g.gioiHan, loai: 'gioihan', viTri: q.diem, kc: k, kcBao: xa, muc, gioiHan: g.gioiHan,
        ten: g.gioiHan < gioiHan ? 'Giảm giới hạn tốc độ' : 'Tăng giới hạn tốc độ', icon: 'tocke', mau: LOAI_CANH_BAO.gioihan.mau
      };
    }
    return null;
  }

  /** Khoảng cách dọc tuyến tới điểm, null nếu điểm không nằm trên đoạn tuyến phía trước. */
  kcTrenTuyen(diem, dd, lech = 35, xa = 1500) {
    const t = dd.tuyen, c = t.toaDo, cum = t.tichLuy, s = dd.tt.s;
    const tu = timChiSo(cum, s), den = timChiSo(cum, s + xa) + 1;
    let tot = null;
    for (let i = tu; i < Math.min(den, c.length - 1); i++) {
      const r = chieuLenDoan(diem, c[i], c[i + 1]);
      if (r.kc < lech && (!tot || r.kc < tot.kc)) tot = { kc: r.kc, s: cum[i] + r.t * (cum[i + 1] - cum[i]) };
    }
    if (!tot || tot.s < s - 5) return null;
    return Math.max(0, tot.s - s);
  }

  cauCanhBao(d) {
    const kc = quangDuongNoi(Math.max(50, Math.round(d.kc / 50) * 50));
    const toiDa = d.gioiHan ? `, tốc độ tối đa ${d.gioiHan} ki lô mét trên giờ.` : '.';
    switch (d.loai) {
      case 'camera': return `Phía trước ${kc} có camera phạt tốc độ` + toiDa;
      case 'cameraden': return `Phía trước ${kc} có camera phạt đèn đỏ.`;
      case 'cameratb': return `Phía trước ${kc} bắt đầu đoạn đo tốc độ trung bình` + toiDa;
      case 'cameragiamsat': return `Phía trước ${kc} có camera giám sát giao thông.`;
      case 'kiemtra': return `Phía trước ${kc} có điểm kiểm tra tốc độ` + toiDa;
      case 'gioihan': return `Phía trước ${kc}, tốc độ tối đa ${d.gioiHan} ki lô mét trên giờ.`;
      case 'khuccua': return `Chú ý, phía trước ${kc} có khúc cua ${d.gap ? 'gấp ' : ''}${d.cuaPhai ? 'bên phải' : 'bên trái'}. Giảm tốc độ.`;
      case 'nguyhiem': return `Chú ý, phía trước ${kc} có ${NGUY_HIEM[d.nguyHiem] || 'đoạn đường nguy hiểm'}.`;
      case 'camre': return `Phía trước ${kc}, giao lộ ${BIEN_RE[d.kieuRe].nghe}.`;
      case 'duongsat': return 'Chú ý, phía trước có đường sắt giao cắt. Giảm tốc độ, quan sát tàu.';
      case 'truonghoc': return `Phía trước ${kc} có trường học, chú ý giảm tốc độ.`;
      case 'gogiam': return 'Phía trước có gờ giảm tốc.';
      case 'ham': return `Phía trước ${kc} có hầm${d.tenRieng ? ' ' + d.tenRieng : ''}. Bật đèn, giữ khoảng cách.`;
      case 'thuphi': return `Phía trước ${kc} có trạm thu phí.`;
      case 'tramdung': return `Phía trước ${kc} có trạm dừng nghỉ.`;
      case 'dentinhieu': return 'Phía trước có đèn tín hiệu giao thông.';
      case 'vachqua': return 'Phía trước có vạch người đi bộ qua đường.';
      default: {
        const kieu = LOAI_BAO_CAO[d.loaiBaoCao];
        return kieu ? `Phía trước ${kc} có ${kieu.nghe}, được báo cáo ${thoiGianTruoc(d.taoLuc)}.` : `Phía trước ${kc} có ${d.ten.toLowerCase()}.`;
      }
    }
  }
}
