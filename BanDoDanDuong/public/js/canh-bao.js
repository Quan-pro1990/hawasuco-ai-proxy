/*
 * Cảnh báo khi lái xe: vượt tốc độ, giới hạn tốc độ thay đổi / phía trước, camera phạt nguội các loại, đường cấm / đi ngược chiều,
 * cấm dừng / đỗ, đoạn cấm vượt, đường sắt, trạm thu phí (kèm mức phí), đèn tín hiệu, gờ giảm tốc, trường học, hầm, khúc cua,
 * biển cấm rẽ, vào / ra khu đông dân cư và báo cáo giao thông.
 * Có tuyến dẫn đường thì xét điểm nằm trên tuyến; không có thì xét điểm nằm trong hướng đang đi.
 */
import { caiDat } from './kho.js';
import { khoangCach, phuongVi, lechGoc, chieuLenDoan, timChiSo, diemTaiS, tichLuy, bamTuyen } from './hinh-hoc.js';
import { quangDuongNoi, thoiGianTruoc, tocDoKmh } from './dinh-dang.js';
import { LOAI_BAO_CAO } from './loai-bao-cao.js';
import { LOAI_CANH_BAO, BIEN_RE, NGUY_HIEM, mucCanhBao, kcBaoTruoc } from './loai-canh-bao.js';
import { camPhuongTien, diNguocChieu, chieuMotChieu, camDungDo, camVuot, BIEN_VN, apDungTheoNgay } from './luat-duong.js';

const LOAI_CAMERA = new Set(['camera', 'cameraden', 'cameratb', 'cameragiamsat', 'kiemtra']);

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
   * @param o.layPhi        (điểm trạm thu phí) => { phi, loaiXe } | null   (mức phí, phi-cao-toc.js) — không bắt buộc
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
    this.luat = { duongCam: null, nguocChieu: false, camDungDo: null, camVuot: null };
    this.demCam = 0;               // số lần liên tiếp thấy đang đi đường cấm / ngược chiều
    this.demNguoc = 0;
    this.cvCho = null;
    this.luatKhoa = '';
    this.luatNoiLuc = 0;
    this.kmhTruoc = 0;
    this.dungDoDaBao = new Map();  // id đường → lúc đã nhắc cấm dừng / đỗ
    this.cameraNhac = new Set();   // camera đã nhắc giảm tốc vì đang vượt tốc độ
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
    const luat = this.theoDoiLuatDuong(duong, kmh, phuongTien, vt);
    if (bayGio - this.donLuc > 600000) this.donDep(bayGio);

    // ---- điểm phía trước
    this.ghTiep = null;
    this.dsTruoc = [];
    let canhBao = this.diemPhiaTruoc(vt, dd, { duong, phuongTien, kmh, gioiHan, luat });
    // đang vượt tốc độ mà sắp tới camera: nhắc giảm tốc ngay (mỗi camera một lần)
    if (vuotToc && canhBao && LOAI_CAMERA.has(canhBao.loai) && canhBao.kc < 400 && !this.cameraNhac.has(canhBao.id)) {
      this.cameraNhac.add(canhBao.id);
      this.noi(`Giảm tốc độ ngay, phía trước có ${canhBao.loai === 'cameragiamsat' ? 'camera phạt nguội' : canhBao.ten.toLowerCase()}.`, { chen: true });
    }
    // đang ở trên đường cấm / đi ngược chiều: hiện thay cho cảnh báo phía trước
    if (luat.duongCam || luat.nguocChieu) {
      const k = LOAI_CANH_BAO.duongcam;
      canhBao = {
        id: 'dangcam', loai: 'duongcam', hienTai: true, kc: 0, kcBao: 1, mau: k.mau, gioiHan: null,
        ten: luat.nguocChieu ? 'Bạn đang đi ngược chiều' : luat.duongCam.ten, icon: luat.nguocChieu ? 'camduong' : 'duongcam'
      };
    }
    return {
      duong, gioiHan, uocTinh, kmh, vuotToc, canhBao, luat, khuDanCu: !!this.kdc && mucCanhBao('khudancu') > 0,
      gioiHanTiep: this.ghTiep,         // { gioiHan, kc }: giới hạn tốc độ kế tiếp trên tuyến
      phiaTruoc: this.dsTruoc           // các điểm cảnh báo phía trước, gần trước (cột cảnh báo bên trái khi dẫn đường)
    };
  }

  /**
   * Luật trên con đường đang đi: đường cấm phương tiện / đi ngược chiều (cần thấy 3 lần liên tiếp khi xe đang chạy),
   * đoạn cấm vượt (đọc "bắt đầu" / "hết" khi đổi trạng thái), cấm dừng / đỗ (nhắc khi xe chậm lại để dừng).
   */
  theoDoiLuatDuong(duong, kmh, phuongTien, vt, luc = new Date()) {
    const L = this.luat, bayGio = luc.getTime();
    const tags = duong && duong.tags;
    const coHuong = vt.huong != null && isFinite(vt.huong) && vt.tocDo > 2;
    const cam = tags && kmh >= 8 ? camPhuongTien(tags, phuongTien, luc) : null;
    const nguoc = !!(tags && coHuong && kmh >= 8 && diNguocChieu(tags, duong.xuoi, phuongTien));
    this.demCam = cam ? this.demCam + 1 : 0;
    this.demNguoc = nguoc ? this.demNguoc + 1 : 0;
    L.duongCam = this.demCam >= 3 ? cam : null;
    L.nguocChieu = this.demNguoc >= 3;
    if ((L.duongCam || L.nguocChieu) && mucCanhBao('duongcam') >= 2) {
      const khoa = (L.nguocChieu ? 'nguoc' : 'cam') + duong.id;
      if (khoa !== this.luatKhoa || bayGio - this.luatNoiLuc > 60000) {
        this.luatKhoa = khoa;
        this.luatNoiLuc = bayGio;
        this.bip('vuottoc');
        this.noi(L.nguocChieu ? 'Cảnh báo, bạn đang đi ngược chiều đường một chiều.' : `Cảnh báo, bạn đang đi vào ${L.duongCam.nghe}.`, { chen: true });
      }
    }

    const cv = tags ? camVuot(tags, duong.xuoi) : null;
    if (cv != null) {
      if (cv === L.camVuot) this.cvCho = null;
      else if (this.cvCho !== cv) this.cvCho = cv;
      else {
        const cu = L.camVuot;
        L.camVuot = cv;
        this.cvCho = null;
        // vừa báo trước "phía trước bắt đầu đoạn cấm vượt" trên tuyến thì không đọc lại
        const vuaBao = bayGio - (this.daBao.get('cv' + duong.id) || 0) < 90000;
        if (cu != null && kmh >= 15 && !vuaBao && mucCanhBao('camvuot') >= 2) this.noi(cv ? 'Bắt đầu đoạn cấm vượt.' : 'Hết đoạn cấm vượt.');
      }
    }

    L.camDungDo = tags ? camDungDo(tags, duong.xuoi, luc) : null;
    if (L.camDungDo && kmh < 10 && this.kmhTruoc >= 10 && mucCanhBao('camdungdo') >= 2 && bayGio - (this.dungDoDaBao.get(duong.id) || 0) > 600000) {
      this.dungDoDaBao.set(duong.id, bayGio);
      this.noi(L.camDungDo === 'camdung' ? 'Đoạn đường này cấm dừng và đỗ xe.' : 'Đoạn đường này cấm đỗ xe.');
    }
    this.kmhTruoc = kmh;
    const bat = l => mucCanhBao(l) > 0;
    return {
      duongCam: bat('duongcam') ? L.duongCam : null, nguocChieu: bat('duongcam') && L.nguocChieu,
      camDungDo: bat('camdungdo') ? L.camDungDo : null, camVuot: bat('camvuot') && !!L.camVuot
    };
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
      if (d.bien) {
        // biển báo Việt Nam: biển riêng cho ô tô / xe máy, biển cấm đỗ ngày chẵn / lẻ chỉ áp dụng đúng ngày
        const b = BIEN_VN[d.bien];
        if ((b.xe && b.xe !== phuongTien) || !apDungTheoNgay(b.ngay)) continue;
        Object.assign(x, { ten: b.ten, icon: b.icon, het: !!b.het });
      }
      if (d.loai === 'thuphi' && this.layPhi) {
        const phi = this.layPhi(d);
        if (phi) Object.assign(x, { phi: phi.phi, phu: `Phí xe loại ${phi.loaiXe}: ${phi.phi.toLocaleString('vi-VN')} đ` });
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

  diemPhiaTruoc(vt, dd, { duong = null, phuongTien = caiDat.phuongTien, kmh = tocDoKmh(vt.tocDo), gioiHan = null, luat = {} } = {}) {
    const p = vt.viTri;
    const coHuong = vt.huong != null && isFinite(vt.huong) && vt.tocDo > 2;
    const ds = [];
    const daXet = new Set();
    for (const d of this.danhSachDiem(phuongTien, duong)) {
      const thang = khoangCach(p, d.viTri);
      if (thang > 2500) { if (!d.cung) this.daBao.delete(d.id); continue; }
      if (d.loai === 'camre' && !d.apDung) continue;
      // biển cấm dừng / đỗ chỉ cần khi xe đi chậm (sắp dừng)
      if (d.loai === 'camdungdo' && kmh >= 30) continue;
      // biển "cấm đi ngược chiều" ở đầu kia đường một chiều mình đang đi đúng chiều: không phải cho mình
      if (d.bien === 'P102' && duong && chieuMotChieu(duong.tags, phuongTien) !== 0 && !diNguocChieu(duong.tags, duong.xuoi, phuongTien)) continue;
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
    if (dd) ds.push(...this.phiaTruocTrenTuyen(dd, phuongTien, gioiHan, luat));
    ds.sort((a, b) => a.kc - b.kc);

    // đọc những điểm vừa vào tầm báo trước (gần trước; tối đa 2 câu mỗi lần để không dồn dập)
    let soCau = 0;
    for (const d of ds) {
      if (this.daBao.has(d.id)) continue;
      this.daBao.set(d.id, Date.now());
      if (d.loai === 'gioihan') this.ghBaoTruocLuc = Date.now();
      if (d.muc < 2 || soCau >= 2) continue;
      if (!soCau) this.bip('canhbao');
      this.noi(this.cauCanhBao(d, gioiHan));
      soCau++;
    }
    // danh sách phía trước (đã xếp gần trước), mỗi điểm một lần
    const daCo = new Set();
    this.dsTruoc = ds.filter(d => d.muc > 0 && !daCo.has(d.id) && daCo.add(d.id)).slice(0, 4);
    // thẻ cảnh báo chính: loại quan trọng hơn trước, cùng mức thì gần hơn trước
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

  /**
   * Đoạn tuyến phía trước (trong vùng dữ liệu đường đã tải): giới hạn tốc độ có biển khác giới hạn hiện tại,
   * bắt đầu đoạn cấm vượt, đường cấm phương tiện (vd. cấm theo giờ mà máy chủ tìm đường không xét).
   * Giới hạn kế tiếp được tìm xa hơn (800 m) để hiện cạnh biển hiện tại (this.ghTiep); chỉ báo / đọc khi còn 300 m.
   */
  phiaTruocTrenTuyen(dd, phuongTien, gioiHan, luat = {}) {
    const t = dd.tuyen, s = dd.tt.s, tong = t.tichLuy[t.tichLuy.length - 1];
    const xa = 300, xaGh = 800, kq = [];
    let ghXong = !gioiHan || !mucCanhBao('gioihan');
    let cvXong = !!luat.camVuot || !mucCanhBao('camvuot');
    let dcXong = !!luat.duongCam || !mucCanhBao('duongcam');
    for (let k = 60; k <= xaGh && s + k < tong; k += 40) {
      if (ghXong && (k > xa || (cvXong && dcXong))) break;
      const q = diemTaiS(t.toaDo, t.tichLuy, s + k);
      const w = this.thongTinDuong.duongTai(q.diem, q.huong, phuongTien);
      if (!w) continue;
      const chung = { viTri: q.diem, kc: k, kcBao: xa, gioiHan: null };
      if (!ghXong && w.gioiHan && w.gioiHan !== gioiHan) {
        ghXong = true;
        this.ghTiep = { gioiHan: w.gioiHan, kc: k };
        if (k <= xa) {
          kq.push({
            ...chung, id: 'gh' + w.id + '-' + w.gioiHan, loai: 'gioihan', muc: mucCanhBao('gioihan'), gioiHan: w.gioiHan,
            ten: w.gioiHan < gioiHan ? 'Giảm giới hạn tốc độ' : 'Tăng giới hạn tốc độ', icon: 'tocke', mau: LOAI_CANH_BAO.gioihan.mau
          });
        }
      }
      if (k > xa) continue;
      if (!cvXong && camVuot(w.tags, w.xuoi)) {
        cvXong = true;
        kq.push({ ...chung, id: 'cv' + w.id, loai: 'camvuot', muc: mucCanhBao('camvuot'), ten: 'Bắt đầu đoạn cấm vượt', icon: 'camvuot', mau: LOAI_CANH_BAO.camvuot.mau });
      }
      if (!dcXong) {
        const c = camPhuongTien(w.tags, phuongTien);
        if (c) {
          dcXong = true;
          kq.push({ ...chung, id: 'dc' + w.id, loai: 'duongcam', muc: mucCanhBao('duongcam'), ten: c.ten, nghe: c.nghe, icon: 'duongcam', mau: LOAI_CANH_BAO.duongcam.mau });
        }
      }
    }
    return kq;
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

  /** Câu đọc cảnh báo. `gioiHanDuong`: giới hạn của con đường đang đi (đọc kèm khi camera không có giới hạn riêng). */
  cauCanhBao(d, gioiHanDuong = null) {
    const kc = quangDuongNoi(Math.max(50, Math.round(d.kc / 50) * 50));
    const gh = d.gioiHan || (LOAI_CAMERA.has(d.loai) ? gioiHanDuong : null);
    const toiDa = gh ? `, tốc độ tối đa ${gh} ki lô mét trên giờ.` : '.';
    switch (d.loai) {
      case 'camera': return `Phía trước ${kc} có camera phạt tốc độ` + toiDa;
      case 'cameraden': return `Phía trước ${kc} có camera phạt đèn đỏ.`;
      case 'cameratb': return `Phía trước ${kc} bắt đầu đoạn đo tốc độ trung bình` + toiDa;
      case 'cameragiamsat': return `Phía trước ${kc} có camera phạt nguội` + toiDa;
      case 'kiemtra': return `Phía trước ${kc} có điểm kiểm tra tốc độ` + toiDa;
      case 'duongcam': return d.bien ? `Phía trước ${kc} có ${BIEN_VN[d.bien].nghe}.` : `Phía trước ${kc} là ${d.nghe}.`;
      case 'camvuot':
        if (d.het) return 'Hết đoạn cấm vượt.';
        return d.bien ? `Phía trước ${kc} có biển cấm vượt.` : `Phía trước ${kc} bắt đầu đoạn cấm vượt.`;
      case 'camdungdo': return `Phía trước có ${BIEN_VN[d.bien].nghe}.`;
      case 'gioihan': return `Phía trước ${kc}, tốc độ tối đa ${d.gioiHan} ki lô mét trên giờ.`;
      case 'khuccua': return `Chú ý, phía trước ${kc} có khúc cua ${d.gap ? 'gấp ' : ''}${d.cuaPhai ? 'bên phải' : 'bên trái'}. Giảm tốc độ.`;
      case 'nguyhiem': return `Chú ý, phía trước ${kc} có ${NGUY_HIEM[d.nguyHiem] || 'đoạn đường nguy hiểm'}.`;
      case 'camre': return `Phía trước ${kc}, giao lộ ${BIEN_RE[d.kieuRe].nghe}.`;
      case 'duongsat': return 'Chú ý, phía trước có đường sắt giao cắt. Giảm tốc độ, quan sát tàu.';
      case 'truonghoc': return `Phía trước ${kc} có trường học, chú ý giảm tốc độ.`;
      case 'gogiam': return 'Phía trước có gờ giảm tốc.';
      case 'ham': return `Phía trước ${kc} có hầm${d.tenRieng ? ' ' + d.tenRieng : ''}. Bật đèn, giữ khoảng cách.`;
      case 'thuphi': return `Phía trước ${kc} có trạm thu phí${d.tenRieng ? ' ' + d.tenRieng : ''}` +
        (d.phi ? `, phí khoảng ${d.phi.toLocaleString('vi-VN')} đồng.` : '.');
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
