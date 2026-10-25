/* HawaMap — bản đồ dẫn đường. Điều khiển chính: nối bản đồ, tìm kiếm, lộ trình, dẫn đường, cảnh báo, báo cáo, camera. */
import { CAU_HINH } from './cau-hinh.js';
import {
  caiDat, doiCaiDat, ngheDoiCaiDat, khoiPhucCaiDat, diaDiemDaLuu, luuNhaCoQuan, laYeuThich, doiYeuThich, boYeuThich,
  lichSuTim, themLichSu, xoaLichSu
} from './kho.js';
import { khoangCach, catTuyen, diemTaiS, tichLuy } from './hinh-hoc.js';
import { quangDuong, thoiGian, gioDen, ngayGio, thoiGianTruoc, tocDoKmh, kichThuoc, esc } from './dinh-dang.js';
import { doc, ghi } from './kho.js';
import { icon, muiTenRe, muiTenLan, svgBienCam, svgBienVN, XEM_TRUOC_KIEU } from './bieu-tuong.js';
import { BanDo, layKieuBanDo } from './ban-do.js';
import { $, $$, chenBieuTuong, thongBao, hopThoai, hoiXacNhan, TamDuoi, moTrang, dongTrang, taiXuong } from './giao-dien.js';
import { goiY, timDayDu, layToaDo, diaChiTuToaDo, khuVucTuToaDo } from './tim-kiem.js';
import { timDuong, PHUONG_TIEN, tenDuong, thaoTacNgan } from './chi-duong.js';
import { DanDuong } from './dan-duong.js';
import { NguonViTri } from './vi-tri.js';
import { MoPhong } from './mo-phong.js';
import { noi, imLang, moKhoaAmThanh, bip, danhSachGiong, doiGiong, coGiongNoi, datGiongGoc, trangThaiGiongGoc, coTiengViet } from './giong-noi.js';
import { ThongTinDuong } from './duong-xa.js';
import { CanhBao } from './canh-bao.js';
import { LOAI_CANH_BAO, MUC_CANH_BAO, mucCanhBao } from './loai-canh-bao.js';
import { NhacNho, laBanDem } from './nhac-nho.js';
import { NguonDuLieuGiaoThong } from './du-lieu-giao-thong.js';
import { capNhatBangPhi, phiCuaTram, phiTuyen, thongTinBangPhi, LOAI_XE_THU_PHI, dinhDangTien } from './phi-cao-toc.js';
import { xepHangTuyen, baoCaoTrenTuyen, goiYDoiTuyen } from './dan-duong-thong-minh.js';
import { docLienKet } from './lien-ket.js';
import { THONG_SO, PhienElm, DocXe, CongBle, CongGoc } from './obd.js';
import { LOAI_BAO_CAO, kiemTraMayChu, dungMayChu, diaChiApi, taiBaoCao, guiBaoCao, xacNhan, xoaBaoCao, baoCaoHienTai, baoCaoCuaToi } from './bao-cao.js';
import { DANH_MUC, layDanhMuc, timQuanh, timDocTuyen } from './dia-diem.js';
import { GhiHanhTrinh, danhSachHanhTrinh, xoaHanhTrinh, tongKet, xuatGpx, svgBieuDoTocDo } from './hanh-trinh.js';
import { CameraHanhTrinh, hoTroCamera, danhSachDoan, doiKhoaDoan, xoaDoan, layDoan, TuDongGhi, CHAT_LUONG } from './camera-hanh-trinh.js';
import { laAppGoc, cheDoXe, cauHinhGoc, guiGoc } from './cau-noi.js';
import { tepCuaKieu, diaChiVung, demOVung, taiDiaChi, vungDaTai, luuVung, xoaVung, canCapNhat, dangDungWifi, TOI_DA_O, KHO_BAN_DO } from './ban-do-offline.js';

const st = {
  cheDo: 'chinh',          // chinh | diadiem | danhmuc | lotrinh | danduong
  viTri: null,             // vị trí mới nhất
  cbCuoi: null,            // kết quả cảnh báo mới nhất
  nghe: null,              // đang tìm bằng giọng nói: { goiYCu, coKetQua, loi, r (Web Speech) | goc (ứng dụng Android) }
  diaDiem: null,           // địa điểm đang xem
  danhMuc: null,           // { dm, ds, docTuyen }
  lt: null,                // lộ trình đang lập: { diem: [], phuongTien, tuyen: [], chon, loi, choGps, batDauNgay }
  dd: null,                // đang dẫn đường
  moPhong: null,
  laiXe: false,
  tamPhu: false,           // tấm dưới đang hiện nội dung phụ (báo cáo, kiểu bản đồ, các bước…)
  mucDichTim: 'xem',
  ketQuaTim: [],
  lucDiChuyen: 0,
  ddMoRong: false,
  daBayDenViTri: false
};

// ================================================================== khởi tạo
function coWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}
if (!window.maplibregl || !coWebGL()) {
  document.body.innerHTML = '<div class="khong-ho-tro"><img src="icons/icon.svg" alt=""><b>Trình duyệt không hiển thị được bản đồ</b>' +
    '<span>Cần trình duyệt hỗ trợ WebGL (Chrome, Edge, Safari, Firefox bản mới). Hãy cập nhật trình duyệt hoặc bật tăng tốc phần cứng.</span></div>';
  throw new Error('Trình duyệt không hỗ trợ WebGL');
}
chenBieuTuong();
if (cheDoXe) document.body.classList.add('xe', cauHinhGoc.hud === 'phai' ? 'hud-phai' : 'hud-trai');
if (laAppGoc) document.documentElement.classList.add('app-goc', 'app-' + (cauHinhGoc.nenTang || 'goc'));
/** Chữ "3D" / "2D" trên nút đổi góc nhìn bản đồ khi dẫn đường. */
function chu3D(la3D) { return `<span class="chu-3d">${la3D ? '3D' : '2D'}</span>`; }

const banDo = new BanDo('ban-do', {
  nhanGiu: p => chonViTriBanDo(p),
  chamBaoCao: (id, p) => moPopupBaoCao(id, p),
  chamKetQua: i => { if (st.danhMuc && st.danhMuc.ds[i]) chonDiaDiem(st.danhMuc.ds[i], { giuDanhMuc: true }); },
  chamTuyenPhu: i => chonTuyen(i),
  chamDiaDiem: dd => { if (st.cheDo === 'chinh' || st.cheDo === 'diadiem') chonDiaDiem({ ...dd, diaChi: '' }, { timDiaChi: true }); },
  boTheoDoi: () => capNhatNutViTri(),
  daiTaiStyle: () => {
    document.documentElement.dataset.giaoDien = banDo.laKieuToi() ? 'toi' : 'sang';
    setTimeout(tuCapNhatOffline, 15000);
  }
}, kieuMongMuon());
banDo.nghieng = caiDat.dd3D === false ? 0 : 55;
const tam = new TamDuoi($('#tam-duoi'), { doiChieuCao: () => capNhatLe() });
tam.onAn = () => {
  if (st.tamPhu) { st.tamPhu = false; setTimeout(tamQuayLai, 0); }
  else if (st.cheDo === 'diadiem' || st.cheDo === 'danhmuc') veChinh();
};
const nguonViTri = new NguonViTri(xuLyViTri, (loi, ma) => {
  if (ma === 1 || !st.viTri) thongBao(loi, { loai: 'loi', thoiGian: 5000 });
});
// dữ liệu giao thông theo ô: lưu trong máy, lấy từ máy chủ HawaMap (nếu có) hoặc OpenStreetMap, tự làm mới mỗi tuần
const layMayChu = () => (dungMayChu() ? diaChiApi() : null);
const duLieuGT = new NguonDuLieuGiaoThong({ layMayChu });
const thongTinDuong = new ThongTinDuong({ nguon: duLieuGT });
const canhBao = new CanhBao({ thongTinDuong, layBaoCao: baoCaoHienTai, noi, bip, layPhi: phiChoXe });
const laAppAndroid = laAppGoc && cauHinhGoc.nenTang === 'android';
const nhacNho = new NhacNho({ noi, bip, bao: (chu, loai) => thongBao(chu, { loai }) });
const ghiHT = new GhiHanhTrinh();
let camera = null;
const tuGhi = new TuDongGhi();

document.documentElement.dataset.giaoDien = layKieuBanDo(kieuMongMuon()).toi ? 'toi' : 'sang';
// tìm bằng giọng nói: ứng dụng Android dùng bộ nhận dạng giọng nói của máy (WebView không có Web Speech API)
const NhanDangGiong = window.SpeechRecognition || window.webkitSpeechRecognition;
const ngheGoc = laAppAndroid && !!cauHinhGoc.nghe;
if (laAppAndroid ? !ngheGoc : !NhanDangGiong) document.documentElement.classList.add('khong-mic');
renderChip();
datCheDo('chinh');
nguonViTri.batDau();
kiemTraMayChu().then(() => { taiBaoCaoKhuVuc(); capNhatBangPhi({ layMayChu }); });
banDo.map.on('moveend', () => { clearTimeout(st.henBaoCao); st.henBaoCao = setTimeout(taiBaoCaoKhuVuc, 1200); });
banDo.map.on('rotate', capNhatLaBan);
banDo.map.on('pitch', capNhatLaBan);
setInterval(() => banDo.doiKieu(kieuMongMuon()), 5 * 60000);
setInterval(taiBaoCaoKhuVuc, 90000);
setInterval(xetDoiTuyen, 60000);
setTimeout(() => tuCapNhatDuLieu(), 30000);
setInterval(() => tuCapNhatDuLieu(), 6 * 3600000);
window.addEventListener('resize', capNhatLe);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  nhacNho.choThem();
  if (st.dd || st.laiXe) giuManHinh(true);
});
// mất tín hiệu GPS khi đang đi (trình duyệt dừng GPS khi trang bị ẩn nên chỉ xét lúc trang đang hiện)
setInterval(() => {
  if (!laAppGoc && document.visibilityState !== 'visible') return;
  const dangDi = !st.moPhong && !!(st.dd || st.laiXe || cheDoXe || Date.now() - st.lucDiChuyen < 60000);
  const mat = nhacNho.kiemTra(dangDi);
  if (mat !== document.body.classList.contains('mat-gps')) {
    document.body.classList.toggle('mat-gps', mat);
    if (mat) $$('.hud .dong-ho b').forEach(b => { b.textContent = '--'; });
  }
}, 3000);
if (!cheDoXe) moLienKet();
// trong ứng dụng gốc trang được nạp từ gói cài đặt: không cần service worker
if (!laAppGoc && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ================================================================== chế độ màn hình & bố cục
function datCheDo(cd) {
  st.cheDo = cd;
  document.body.dataset.cheDo = cd;
  $('#lop-dd').hidden = cd !== 'danduong';
  $('#khung-lt').hidden = cd !== 'lotrinh';
  capNhatLe();
}

function laMayTinh() { return window.matchMedia('(min-width: 768px)').matches; }

function capNhatLe() {
  if (cheDoXe) { banDo.datLe(st.leXe || { tren: 0, duoi: 0, trai: 0, phai: 0 }); return; }
  const goc = document.documentElement.style;
  const tamEl = $('#tam-duoi');
  const mayTinh = laMayTinh();
  let tren, duoi = 0, trai = 0, leDuoi = 0;
  if (st.cheDo === 'danduong') {
    const br = $('#bang-re').offsetHeight, tdd = $('#thanh-dd').offsetHeight;
    goc.setProperty('--cao-br', br + 'px');
    tren = br + 12;
    if (mayTinh) trai = 424;
    else { duoi = tdd + 66; leDuoi = tdd; }
  } else if (st.cheDo === 'lotrinh') {
    const h = $('#khung-lt').offsetHeight;
    goc.setProperty('--cao-lt', h + 'px');
    tren = mayTinh ? 20 : h + 8;
    if (mayTinh) trai = 424;
  } else {
    tren = mayTinh ? 72 : $('.thanh-tim').offsetHeight + 60;
  }
  if (!tamEl.hidden) {
    if (mayTinh) trai = 424;
    else { duoi = Math.max(duoi, tamEl.offsetHeight); leDuoi = Math.max(leDuoi, tamEl.offsetHeight); }
  }
  banDo.datLe({ tren, duoi, trai });
  goc.setProperty('--le-duoi', leDuoi + 'px');
}

function veChinh() {
  st.diaDiem = null;
  st.danhMuc = null;
  st.tamPhu = false;
  banDo.datGhim(null);
  banDo.datKetQua([]);
  banDo.datHanhTrinh(null);
  datCheDo('chinh');
  if (!tam.el.hidden) tam.dat('an');
}

function hienTamPhu(html, opt = {}) {
  st.tamPhu = true;
  tam.hien(html, { trangThai: 'thu', ...opt });
}

function dongTam() {
  if (st.tamPhu) { st.tamPhu = false; return tamQuayLai(); }
  if (st.cheDo === 'diadiem' || st.cheDo === 'danhmuc') {
    if (st.cheDo === 'diadiem' && st.danhMuc) { datCheDo('danhmuc'); st.diaDiem = null; banDo.datGhim(null); return renderDanhMuc(); }
    return veChinh();
  }
  if (st.cheDo === 'lotrinh') return dongLoTrinh();
  tam.an();
}

function tamQuayLai() {
  if (st.cheDo === 'lotrinh') renderTheTuyen();
  else if (st.cheDo === 'diadiem') renderDiaDiem();
  else if (st.cheDo === 'danhmuc') renderDanhMuc();
  else {
    // nội dung phụ trên màn hình chính / khi dẫn đường: đóng hẳn, dọn kết quả đang vẽ
    if (st.danhMuc) { st.danhMuc = null; banDo.datKetQua([]); }
    if (st.hanhTrinhXem) { st.hanhTrinhXem = null; banDo.datHanhTrinh(null); banDo.datGhim(null); }
    tam.an();
  }
}

// ================================================================== vị trí
function xuLyViTri(vt) {
  const dauTien = !st.viTri;
  st.viTri = vt;
  banDo.capNhatViTri(vt);
  thongTinDuong.capNhat(vt.viTri);

  if (dauTien && !st.daBayDenViTri && st.cheDo === 'chinh' && !st.lienKet) {
    st.daBayDenViTri = true;
    if (cheDoXe) { banDo.datTheoDoi('bac'); capNhatNutViTri(); } else banDo.bayDen(vt.viTri, 16);
  }
  if (st.choBayDenViTri) { st.choBayDenViTri = false; banDo.datTheoDoi('bac'); capNhatNutViTri(); }
  if (st.lt && st.lt.choGps && st.cheDo === 'lotrinh') { st.lt.choGps = false; tinhLoTrinh(); }

  let tt = null;
  if (st.dd) tt = capNhatDanDuong(vt);
  const cb = canhBao.capNhat(vt, st.dd && tt ? { tuyen: st.dd.tuyen, tt } : null, st.dd ? st.dd.phuongTien : caiDat.phuongTien);
  st.cbCuoi = cb;
  if (tt) baoGoc(tt);              // sau khi có tốc độ / giới hạn / cảnh báo của lần cập nhật này
  st.ttCuoi = tt;
  if (st.hud) renderManHud();
  if (laAppAndroid && !cheDoXe) baoBongBong(cb);
  if (cb.kmh >= 5) st.lucDiChuyen = Date.now();
  if (!vt.moPhong) { ghiHT.them(vt, { vuotToc: cb.vuotToc }); nhacNho.viTri(vt, cb.kmh); document.body.classList.remove('mat-gps'); xetTuGhi(cb.kmh); }
  renderHud(cb);
  renderCanhBao(st.dd ? $('#canh-bao-dd') : $('#canh-bao-chinh'), (st.dd || st.laiXe || cheDoXe || cb.kmh >= 5) ? cb.canhBao : null);
  if (st.dd) $('#canh-bao-chinh').hidden = true;

  if (thongTinDuong.phienDiem !== st.phienDiemVe) veDiemCanhBao();
}

/** Mức phí của trạm thu phí cho xe đang dùng (chỉ ô tô; xe máy không đi đường thu phí BOT). */
function phiChoXe(diem) {
  const pt = st.dd ? st.dd.phuongTien : caiDat.phuongTien;
  return pt === 'oto' ? phiCuaTram(diem, caiDat.loaiXeThuPhi) : null;
}

/** Dữ liệu cho bong bóng nổi của ứng dụng Android (cau/BongBong.kt), hiện khi HawaMap chạy nền. */
function baoBongBong(cb) {
  guiGoc('hud', {
    bat: !!caiDat.bongBongNoi, dangDanDuong: !!st.dd, dangDi: !!(st.laiXe || cb.kmh >= 5 || Date.now() - st.lucDiChuyen < 60000),
    tocDo: cb.kmh, gioiHan: cb.gioiHan || 0, vuotToc: !!cb.vuotToc,
    canhBao: cb.canhBao ? { ten: cb.canhBao.ten, kcChu: quangDuong(cb.canhBao.kc), icon: cb.canhBao.icon } : null
  });
}

function veDiemCanhBao() {
  st.phienDiemVe = thongTinDuong.phienDiem;
  banDo.datDiemCanhBao(canhBao.diemBanDo());
}

function batGps() { nguonViTri.batDau(); }

function bamViTri() {
  if (!st.viTri) {
    batGps();
    st.choBayDenViTri = true;
    thongBao('Đang tìm vị trí của bạn…');
    return;
  }
  const td = banDo.theoDoi;
  banDo.datTheoDoi(td === 'khong' ? 'bac' : td === 'bac' ? 'huong' : 'bac');
  capNhatNutViTri();
}

function capNhatNutViTri() {
  const n = $('#nut-vi-tri');
  n.dataset.td = banDo.theoDoi;
  n.innerHTML = icon(banDo.theoDoi === 'huong' ? 'laban' : 'vitri');
  const lech = st.cheDo === 'danduong' && banDo.theoDoi !== 'huong';
  $('#nut-ve-giua').hidden = !lech;
  document.body.classList.toggle('lech-tam', lech);
}

function capNhatLaBan() {
  const svg = $('#nut-la-ban svg');
  if (svg) svg.style.transform = `rotate(${-banDo.map.getBearing()}deg)`;
}

let khoaManHinh = null;
async function giuManHinh(bat) {
  if (laAppGoc) { guiGoc('giuManHinh', { bat: !!(bat && caiDat.giuManHinh) }); return; }
  try {
    if (bat && caiDat.giuManHinh && 'wakeLock' in navigator) {
      if (!khoaManHinh) { khoaManHinh = await navigator.wakeLock.request('screen'); khoaManHinh.addEventListener('release', () => { khoaManHinh = null; }); }
    } else if (!bat && khoaManHinh) {
      await khoaManHinh.release();
      khoaManHinh = null;
    }
  } catch (e) { /* trình duyệt không cho giữ màn hình */ }
}

// ================================================================== HUD tốc độ & cảnh báo
function renderHud(cb) {
  const html = `${cb.gioiHan ? `<div class="bien-toc-do${cb.uocTinh ? ' uoc' : ''}" title="${cb.uocTinh ? 'Giới hạn tốc độ ước tính theo loại đường' : 'Giới hạn tốc độ'}"><b>${cb.gioiHan}</b></div>` : ''}
    ${cb.gioiHan && cb.gioiHanTiep ? `<div class="gh-tiep" title="Giới hạn tốc độ tiếp theo"><div class="bien-toc-do nho"><b>${cb.gioiHanTiep.gioiHan}</b></div><span>${quangDuong(cb.gioiHanTiep.kc)}</span></div>` : ''}
    <div class="dong-ho${cb.vuotToc ? ' vuot' : ''}"><b>${cb.kmh}</b><span>km/h</span></div>
    ${cb.khuDanCu ? `<div class="nhan-kdc" title="Đang trong khu đông dân cư (ước tính)">${icon('khudancu')}<span>Khu dân cư</span></div>` : ''}
    ${bienLuat(cb)}
    ${cb.duong && (cb.duong.ten || cb.duong.ref) ? `<div class="ten-duong">${esc(cb.duong.ten || cb.duong.ref)}</div>` : ''}`;
  if (st.dd && !cheDoXe) return renderHudDd(cb);
  if (st.dd) { $('#hud-dd').innerHTML = html; return; }
  const el = $('#hud-chinh');
  el.hidden = !(st.laiXe || cheDoXe || Date.now() - st.lucDiChuyen < 60000);
  el.innerHTML = html;
}

/**
 * Dẫn đường trên điện thoại: biển giới hạn cạnh tốc độ hiện tại ở góc trên trái, cột cảnh báo phía trước bên dưới
 * (giới hạn kế tiếp, camera, biển cấm… kèm số mét), biển luật đang áp dụng, viên tên đường + khu vực ở dưới.
 */
function renderHudDd(cb) {
  $('#hud-dd').innerHTML = `<div class="cum-toc-do">${cb.gioiHan ? `<div class="bien-toc-do${cb.uocTinh ? ' uoc' : ''}" title="${cb.uocTinh ? 'Giới hạn tốc độ ước tính theo loại đường' : 'Giới hạn tốc độ'}"><b>${cb.gioiHan}</b></div>` : ''}
      <div class="dong-ho${cb.vuotToc ? ' vuot' : ''}"><b>${cb.kmh}</b><span>km/h</span></div></div>
    ${cb.khuDanCu ? `<div class="nhan-kdc" title="Đang trong khu đông dân cư (ước tính)">${icon('khudancu')}<span>Khu dân cư</span></div>` : ''}
    ${cotCanhBao(cb)}
    ${bienLuat(cb, 'hud-luat lon')}`;
  renderVienDuong(cb);
}

/** Viền đỏ như biển cấm cho camera, biển cấm; loại khác viền theo màu của loại. */
const VIEN_DO = new Set(['camera', 'cameraden', 'cameratb', 'cameragiamsat', 'kiemtra', 'camre', 'camvuot', 'duongcam', 'camdungdo', 'biencam', 'bientocdo']);

function cotCanhBao(cb) {
  const ds = [];
  if (cb.canhBao && cb.canhBao.hienTai) ds.push(cb.canhBao);       // đang trên đường cấm / đi ngược chiều
  if (cb.gioiHan && cb.gioiHanTiep) ds.push({ loai: 'ghtiep', ten: 'Giới hạn tốc độ tiếp theo', gioiHan: cb.gioiHanTiep.gioiHan, kc: cb.gioiHanTiep.kc });
  for (const d of cb.phiaTruoc || []) if (d.loai !== 'gioihan' && ds.length < 3 && !ds.some(x => x.id === d.id)) ds.push(d);
  if (!ds.length) return '';
  return `<div class="cot-cb">${ds.map(d => {
    const ten = d.loai === 'ghtiep' ? `${d.ten} ${d.gioiHan} km/h` : d.ten + (d.gioiHan ? ` (tối đa ${d.gioiHan} km/h)` : '');
    const bien = d.loai !== 'ghtiep' && svgBienVN(d.icon);
    const hinh = d.loai === 'ghtiep' ? `<span class="cbt-len">${icon('len')}</span><div class="bien-toc-do nho"><b>${d.gioiHan}</b></div>`
      : bien ? `<span class="cbt-bien">${bien}</span>`
      : `<span class="cbt-icon" style="--vien:${VIEN_DO.has(d.loai) ? '#e53935' : d.mau || '#e53935'}">${icon(d.icon)}</span>`;
    return `<div class="cbt${d.hienTai ? ' hien-tai' : ''}" title="${esc(ten)}">${hinh}<b>${d.hienTai ? 'Ngay đây' : quangDuong(d.kc)}</b><span class="an-chu">${esc(ten)}</span></div>`;
  }).join('')}</div>`;
}

/** Viên tên đường đang đi (chữ xanh) và khu vực (phường, quận, thành phố) ở giữa phía dưới. */
function renderVienDuong(cb) {
  const dd = st.dd;
  const buoc = dd && dd.tt ? dd.tuyen.buoc[dd.tt.buocHienTai] : null;
  const ten = (cb.duong && (cb.duong.ten || cb.duong.ref)) || (buoc ? tenDuong(buoc) : '');
  const kv = st.khuVuc || '';
  const el = $('#vien-duong'), khoa = ten + '|' + kv;
  if (el.dataset.k !== khoa) {
    el.dataset.k = khoa;
    el.innerHTML = `<b>${esc(ten || 'Đường không tên')}</b>${kv ? `<span>${esc(kv)}</span>` : ''}`;
  }
  el.hidden = !(ten || kv);
  traKhuVuc(ten);
}

/** Tra khu vực khi đổi đường hoặc đi xa (giãn cách để không gọi dịch vụ địa chỉ quá nhiều). */
const traKV = { luc: 0, viTri: null, ten: null, dang: false };
function traKhuVuc(ten) {
  const p = st.viTri && st.viTri.viTri;
  if (!p || traKV.dang) return;
  const bayGio = Date.now(), doiDuong = ten !== traKV.ten;
  const xa = !traKV.viTri || khoangCach(p, traKV.viTri) > 500;
  if (!(doiDuong || xa) || bayGio - traKV.luc < (doiDuong ? 15000 : 60000)) return;
  Object.assign(traKV, { luc: bayGio, viTri: p, ten, dang: true });
  khuVucTuToaDo(p).then(kv => { st.khuVuc = kv; }).catch(() => {}).finally(() => { traKV.dang = false; });
}

/** Biển luật của con đường đang đi: cấm vượt; cấm dừng / đỗ (chỉ khi xe đi chậm, sắp dừng). */
function bienLuat(cb, lop = 'hud-luat') {
  const l = cb.luat;
  if (!l) return '';
  const ds = [];
  if (l.camVuot) ds.push(['camvuot', 'Đang trong đoạn cấm vượt']);
  if (l.camDungDo && cb.kmh < 30) ds.push(l.camDungDo === 'camdung' ? ['camdungdo', 'Cấm dừng và đỗ xe'] : ['camdo', 'Cấm đỗ xe']);
  return ds.length ? `<div class="${lop}">${ds.map(([b, t]) => `<span title="${t}" aria-label="${t}">${svgBienCam(b)}</span>`).join('')}</div>` : '';
}

function renderCanhBao(el, d) {
  if (!d) { el.hidden = true; return; }
  el.hidden = false;
  const pt = Math.max(0, Math.min(100, 100 - d.kc / d.kcBao * 100));
  el.dataset.loai = d.loai;
  const bien = svgBienVN(d.icon);
  el.innerHTML = `${bien ? `<div class="cb-icon bien">${bien}</div>` : `<div class="cb-icon" style="background:${d.mau || '#e53935'}">${icon(d.icon)}</div>`}
    <div class="cb-chu"><b>${d.hienTai ? 'Ngay đây' : quangDuong(d.kc)}</b><span>${esc(d.ten)}</span>${d.phu ? `<small>${esc(d.phu)}</small>` : ''}</div>
    ${d.gioiHan ? `<div class="bien-toc-do nho"><b>${d.gioiHan}</b></div>` : ''}
    <div class="cb-thanh"><i style="width:${pt}%"></i></div>`;
}

// ================================================================== chip danh mục trên màn hình chính
function renderChip() {
  $('#hang-chip').innerHTML = DANH_MUC.slice(0, 8).map(d =>
    `<button class="chip" data-hd="danh-muc" data-id="${d.id}"><span style="color:${d.mau}">${icon(d.icon)}</span>${esc(d.ten)}</button>`).join('');
}

// ================================================================== tìm kiếm
let henGoiY = null, huyGoiY = null;
const GOI_Y_O_TIM = {
  xem: 'Tìm kiếm địa điểm, địa chỉ', 'chi-duong': 'Bạn muốn đi đâu?', nha: 'Nhập địa chỉ nhà riêng', coquan: 'Nhập địa chỉ cơ quan',
  'them-dung': 'Thêm điểm dừng'
};

function moTimKiem(mucDich = 'xem', { goPhim = true } = {}) {
  st.mucDichTim = mucDich;
  $('#man-tim').hidden = false;
  const o = $('#o-tim');
  o.value = '';
  o.placeholder = GOI_Y_O_TIM[mucDich] || (mucDich === 'diem:0' ? 'Chọn điểm xuất phát' : 'Chọn điểm đến');
  $('#nut-xoa-tim').hidden = true;
  renderTimRong();
  if (goPhim) setTimeout(() => o.focus(), 60);
}

function dongTimKiem() {
  if (st.nghe) dungNghe();
  $('#man-tim').hidden = true;
  $('#o-tim').blur();
  if (huyGoiY) huyGoiY.abort();
}

function viTriGan() { return st.viTri ? st.viTri.viTri : banDo.tam(); }

function dongKetQua(kq, hd, i) {
  const kc = kq.viTri ? khoangCach(viTriGan(), kq.viTri) : null;
  return `<button class="dong-tim" data-hd="${hd}" data-i="${i}">
    <span class="dt-icon">${icon(kq.icon || (kq.danhMuc ? layDanhMuc(kq.danhMuc).icon : 'ghim'))}</span>
    <span class="dt-chu"><b>${esc(kq.ten)}</b><small>${esc(kq.diaChi || '')}</small></span>
    ${kc != null ? `<span class="dt-kc">${quangDuong(kc)}</span>` : ''}</button>`;
}

function renderTimRong() {
  const ds = diaDiemDaLuu();
  const md = st.mucDichTim;
  const chonDiem = md.startsWith('diem:') || md === 'them-dung';
  let h = '<div class="nhom-tim">';
  if (chonDiem) {
    h += `<button class="dong-tim" data-hd="chon-vi-tri-toi"><span class="dt-icon xanh">${icon('vitri')}</span><span class="dt-chu"><b>Vị trí của bạn</b></span></button>`;
  }
  if (md !== 'nha' && md !== 'coquan') {
    h += `<button class="dong-tim" data-hd="chon-tren-ban-do"><span class="dt-icon">${icon('ghim')}</span><span class="dt-chu"><b>Chọn trên bản đồ</b></span></button>`;
    h += `<button class="dong-tim" data-hd="chon-nha"><span class="dt-icon">${icon('nha')}</span><span class="dt-chu"><b>Nhà riêng</b><small>${esc(ds.nha ? ds.nha.diaChi || ds.nha.ten : 'Bấm để đặt địa chỉ')}</small></span></button>`;
    h += `<button class="dong-tim" data-hd="chon-co-quan"><span class="dt-icon">${icon('coquan')}</span><span class="dt-chu"><b>Cơ quan</b><small>${esc(ds.coQuan ? ds.coQuan.diaChi || ds.coQuan.ten : 'Bấm để đặt địa chỉ')}</small></span></button>`;
  }
  h += '</div>';
  if (md === 'xem' || md === 'chi-duong') {
    h += `<div class="luoi-danh-muc">${DANH_MUC.map(d => `<button data-hd="danh-muc" data-id="${d.id}"><span style="background:${d.mau}">${icon(d.icon)}</span>${esc(d.ten)}</button>`).join('')}</div>`;
  }
  const ls = lichSuTim();
  if (ls.length) {
    h += `<div class="tieu-de-nhom"><span>Tìm kiếm gần đây</span><button class="nut-chu" data-hd="xoa-lich-su">Xoá</button></div>`;
    h += ls.map((x, i) => dongKetQua({ ...x, icon: 'dongho' }, 'chon-lich-su', i)).join('');
  }
  if (ds.yeuThich.length) {
    h += `<div class="tieu-de-nhom"><span>Đã lưu</span></div>`;
    h += ds.yeuThich.slice(0, 8).map((x, i) => dongKetQua({ ...x, icon: 'saodac' }, 'chon-yeu-thich', i)).join('');
  }
  $('#than-tim').innerHTML = h;
}

function renderKetQuaTim(ds, chuoi, loi) {
  const el = $('#than-tim');
  if (ds == null) { el.innerHTML = '<div class="dang-tai"><i></i>Đang tìm…</div>'; return; }
  if (!ds.length) {
    el.innerHTML = `<div class="trong">${loi ? 'Không kết nối được dịch vụ tìm kiếm.' : `Không tìm thấy "${esc(chuoi)}".`}
      <button class="nut vien" data-hd="tim-day-du">Tìm kỹ hơn</button></div>`;
    return;
  }
  el.innerHTML = ds.map((x, i) => dongKetQua(x, 'chon-kq', i)).join('') +
    '<button class="nut-chu tim-them" data-hd="tim-day-du">Không thấy địa điểm? Tìm kỹ hơn</button>';
}

async function timGoiY(chuoi) {
  if (huyGoiY) huyGoiY.abort();
  const huy = huyGoiY = new AbortController();
  renderKetQuaTim(null);
  try {
    const ds = await goiY(chuoi, viTriGan(), huy.signal);
    if (huy.signal.aborted) return;
    st.ketQuaTim = ds;
    renderKetQuaTim(ds, chuoi);
  } catch (e) {
    if (e.name !== 'AbortError') renderKetQuaTim([], chuoi, e.message);
  }
}

async function timDayDuNgay() {
  const chuoi = $('#o-tim').value.trim();
  if (!chuoi) return;
  if (huyGoiY) huyGoiY.abort();
  const huy = huyGoiY = new AbortController();
  renderKetQuaTim(null);
  try {
    const ds = await timDayDu(chuoi, viTriGan(), huy.signal);
    const gop = [...ds, ...st.ketQuaTim.filter(x => !ds.some(y => y.ten === x.ten))];
    st.ketQuaTim = gop;
    renderKetQuaTim(gop, chuoi);
  } catch (e) {
    if (e.name !== 'AbortError') renderKetQuaTim(st.ketQuaTim, chuoi, e.message);
  }
}

async function chonKetQua(kq) {
  try { kq = await layToaDo(kq); } catch (e) { return thongBao(e.message, { loai: 'loi' }); }
  if (kq.nguon !== 'toado' && kq.nguon !== 'bando') themLichSu(kq);
  const md = st.mucDichTim;
  dongTimKiem();
  if (md === 'xem') chonDiaDiem(kq);
  else if (md === 'chi-duong') moLoTrinh(kq);
  else if (md === 'nha' || md === 'coquan') {
    luuNhaCoQuan(md, kq);
    thongBao(`Đã lưu địa chỉ ${md === 'nha' ? 'nhà riêng' : 'cơ quan'}`);
  } else if (md === 'them-dung') {
    st.lt.diem.splice(st.lt.diem.length - 1, 0, kq);
    renderKhungLt();
    tinhLoTrinh();
  } else if (md.startsWith('diem:')) {
    st.lt.diem[+md.slice(5)] = kq;
    renderKhungLt();
    tinhLoTrinh();
  }
}

/** Lỗi nhận dạng giọng nói (mã của Web Speech API và của ứng dụng Android) → câu báo; '' = không báo. */
const LOI_NGHE = {
  'not-allowed': 'Chưa cho phép dùng micro. Hãy cho phép quyền Micro cho trang này (biểu tượng ổ khoá cạnh địa chỉ trang) rồi thử lại',
  'service-not-allowed': 'Trình duyệt không cho dùng nhận dạng giọng nói (Safari: bật Siri và Đọc chính tả trong Cài đặt)',
  'no-speech': 'Không nghe thấy tiếng nói, bấm micro rồi nói lại',
  'audio-capture': 'Không dùng được micro (micro đang bận hoặc không có micro)',
  network: 'Tìm bằng giọng nói cần kết nối Internet',
  'language-not-supported': 'Trình duyệt chưa nhận dạng được tiếng Việt',
  khongco: 'Máy chưa có dịch vụ nhận dạng giọng nói: hãy cài hoặc bật ứng dụng Google rồi thử lại',
  aborted: '', huy: ''
};

/** Bấm micro: nghe tên địa điểm rồi tìm. Bấm lần nữa khi đang nghe thì thôi. */
function noiTim() {
  if (st.nghe) return dungNghe();
  if (!ngheGoc && !NhanDangGiong) return thongBao('Trình duyệt không hỗ trợ tìm bằng giọng nói, hãy dùng Chrome hoặc Edge', { loai: 'loi' });
  if (!ngheGoc && !window.isSecureContext) return thongBao('Tìm bằng giọng nói cần mở HawaMap qua địa chỉ https://', { loai: 'loi', thoiGian: 5000 });
  if ($('#man-tim').hidden) moTimKiem('xem', { goPhim: false });
  else $('#o-tim').blur();
  const o = $('#o-tim');
  st.nghe = { goiYCu: o.placeholder, coKetQua: false, loi: null };
  o.placeholder = 'Đang nghe… hãy nói tên địa điểm';
  document.body.classList.add('dang-nghe');
  if (ngheGoc) { st.nghe.goc = true; guiGoc('ngheTim'); return; }
  const r = st.nghe.r = new NhanDangGiong();
  r.lang = 'vi-VN';
  r.interimResults = false;
  r.maxAlternatives = 1;
  r.onresult = e => nhanLoiNoi(e.results[0] && e.results[0][0] ? e.results[0][0].transcript : '');
  r.onerror = e => { if (st.nghe) st.nghe.loi = e.error || 'loi'; };
  r.onend = () => xongNghe();
  try { r.start(); } catch (e) { st.nghe.loi = 'audio-capture'; xongNghe(); }
}

function dungNghe() {
  const n = st.nghe;
  if (n && n.r) { n.loi = 'aborted'; try { n.r.abort(); } catch (e) { xongNghe(); } } else xongNghe('huy');
}

function nhanLoiNoi(chu) {
  if (!st.nghe || !chu || !chu.trim()) return;
  st.nghe.coKetQua = true;
  const o = $('#o-tim');
  o.value = chu.trim();
  $('#nut-xoa-tim').hidden = false;
  timGoiY(o.value);
}

/** Kết thúc một lần nghe; `loi` (mã lỗi) nếu có. Không có kết quả mà cũng không có lỗi: báo không nghe rõ. */
function xongNghe(loi) {
  const n = st.nghe;
  if (!n) return;
  st.nghe = null;
  $('#o-tim').placeholder = n.goiYCu;
  document.body.classList.remove('dang-nghe');
  if (n.coKetQua) return;
  const ma = loi || n.loi || 'khongnghe';
  const cau = ma in LOI_NGHE ? LOI_NGHE[ma] : 'Không nghe rõ, vui lòng thử lại';
  if (cau) thongBao(cau, { loai: 'loi', thoiGian: cau.length > 50 ? 6000 : 3500 });
}

/** Ứng dụng Android trả kết quả nhận dạng: { chu } hoặc { loi: 'huy' | 'khongnghe' | 'khongco' }. */
function ketQuaNgheGoc(du) {
  const kq = typeof du === 'string' ? JSON.parse(du) : du || {};
  if (!st.nghe || !st.nghe.goc) return;
  if (kq.chu) nhanLoiNoi(kq.chu);
  xongNghe(kq.loi);
}

// ================================================================== chọn trên bản đồ (tâm ngắm)
function batChonTrenBanDo(mucDich) {
  dongTimKiem();
  st.chonBd = mucDich;
  // ghim nằm giữa màn hình: bản đồ phải đứng yên chỗ người dùng kéo tới, không tự chạy theo vị trí GPS
  banDo.datTheoDoi('khong');
  capNhatNutViTri();
  document.body.classList.add('dang-chon-bd');
  $('#chon-ban-do').hidden = false;
}

function tatChonTrenBanDo() {
  st.chonBd = null;
  document.body.classList.remove('dang-chon-bd');
  $('#chon-ban-do').hidden = true;
}

async function xacNhanChonTrenBanDo() {
  const md = st.chonBd;
  const p = banDo.tam();
  tatChonTrenBanDo();
  const dd = { ten: 'Vị trí đã chọn', diaChi: p[1].toFixed(5) + ', ' + p[0].toFixed(5), viTri: p, nguon: 'bando' };
  try { Object.assign(dd, await diaChiTuToaDo(p)); } catch (e) { /* giữ toạ độ */ }
  st.mucDichTim = md;
  chonKetQua(dd);
}

// ================================================================== địa điểm
function chonDiaDiem(dd, { bay = true, timDiaChi = false, giuDanhMuc = false } = {}) {
  if (!giuDanhMuc) { st.danhMuc = null; banDo.datKetQua([]); }
  st.diaDiem = dd;
  st.tamPhu = false;
  datCheDo('diadiem');
  banDo.datGhim(dd.viTri);
  renderDiaDiem();
  if (bay) banDo.bayDen(dd.viTri, Math.max(banDo.map.getZoom(), 16));
  if (timDiaChi) {
    diaChiTuToaDo(dd.viTri).then(kq => {
      if (st.diaDiem !== dd) return;
      if (!dd.ten || dd.ten === 'Vị trí đã chọn') dd.ten = kq.ten || dd.ten;
      dd.diaChi = kq.diaChi;
      if (st.cheDo === 'diadiem' && !st.tamPhu) renderDiaDiem();
    }).catch(() => {
      if (st.diaDiem === dd && !dd.diaChi) { dd.diaChi = dd.viTri[1].toFixed(5) + ', ' + dd.viTri[0].toFixed(5); if (!st.tamPhu) renderDiaDiem(); }
    });
  }
}

function chonViTriBanDo(p) {
  if (st.cheDo === 'danduong' || st.chonBd) return;
  if (st.cheDo === 'lotrinh') {
    // nhấn giữ khi đang lập lộ trình: đổi điểm đến
    st.lt.diem[st.lt.diem.length - 1] = { ten: 'Vị trí đã chọn', diaChi: '', viTri: p };
    renderKhungLt();
    tinhLoTrinh();
    diaChiTuToaDo(p).then(kq => { const d = st.lt && st.lt.diem[st.lt.diem.length - 1]; if (d && d.viTri === p) { Object.assign(d, kq); renderKhungLt(); } }).catch(() => {});
    return;
  }
  if (navigator.vibrate) navigator.vibrate(30);
  chonDiaDiem({ ten: 'Vị trí đã chọn', diaChi: '', viTri: p }, { bay: false, timDiaChi: true });
}

function renderDiaDiem() {
  const dd = st.diaDiem;
  if (!dd) return;
  const kc = st.viTri ? khoangCach(st.viTri.viTri, dd.viTri) : null;
  const yt = laYeuThich(dd);
  const phu = [];
  if (kc != null) phu.push(`<span>${icon('ghim')}Cách ${quangDuong(kc)}</span>`);
  if (dd.gioMoCua) phu.push(`<span>${icon('dongho')}${esc(dd.gioMoCua)}</span>`);
  if (dd.dienThoai) phu.push(`<a href="tel:${esc(dd.dienThoai.replace(/[^\d+]/g, ''))}">${icon('thongtin')}${esc(dd.dienThoai)}</a>`);
  tam.hien(`<div class="dd-dau">
      <div class="dd-ten"><h2>${esc(dd.ten)}</h2><p>${dd.diaChi ? esc(dd.diaChi) : '<i class="mo">Đang tìm địa chỉ…</i>'}</p></div>
      <button class="nut-icon" data-hd="dong-tam" aria-label="Đóng">${icon('dong')}</button>
    </div>
    ${phu.length ? `<div class="dd-phu">${phu.join('')}</div>` : ''}
    <div class="hang-nut">
      <button class="nut chinh" data-hd="chi-duong-den">${icon('chiduong')}Chỉ đường</button>
      <button class="nut xanh" data-hd="bat-dau-ngay">${icon('muiten')}Bắt đầu</button>
      <button class="nut vien" data-hd="luu-dd">${icon(yt ? 'saodac' : 'sao')}${yt ? 'Đã lưu' : 'Lưu'}</button>
      <button class="nut vien" data-hd="chia-se-dd">${icon('chiase')}Chia sẻ</button>
    </div>
    <div class="dd-them">
      <button class="nut-chu" data-hd="dat-nha">${icon('nha')}Đặt làm nhà riêng</button>
      <button class="nut-chu" data-hd="dat-co-quan">${icon('coquan')}Đặt làm cơ quan</button>
      <button class="nut-chu" data-hd="bao-cao-tai-day">${icon('loabao')}Báo cáo tại đây</button>
    </div>
    <p class="toa-do">${dd.viTri[1].toFixed(6)}, ${dd.viTri[0].toFixed(6)}</p>`, { trangThai: 'thu' });
}

async function chiaSe(dd) {
  const url = new URL(location.href.split('#')[0].split('?')[0]);
  url.searchParams.set('diem', dd.viTri[1].toFixed(6) + ',' + dd.viTri[0].toFixed(6));
  url.searchParams.set('ten', dd.ten);
  const chu = dd.ten + (dd.diaChi ? ' — ' + dd.diaChi : '');
  if (navigator.share) {
    try { await navigator.share({ title: dd.ten, text: chu, url: url.href }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(chu + '\n' + url.href);
    thongBao('Đã sao chép liên kết vị trí');
  } catch (e) {
    hopThoai({ tieuDe: 'Liên kết vị trí', noiDung: `<input class="o-nhap" value="${esc(url.href)}" readonly>` });
  }
}

/** Mở theo liên kết chia sẻ: ?diem=lat,lng&ten=… hoặc ?q=từ khoá */
function moLienKet() {
  const q = new URLSearchParams(location.search);
  const d = q.get('diem');
  // chia sẻ từ ứng dụng khác vào HawaMap (share_target của PWA) hoặc ?lienKet=…
  const chiaSe = ['tieuDe', 'chu', 'lienKet'].map(k => q.get(k)).filter(Boolean).join('\n');
  if (chiaSe) {
    moChuoiChiaSe(chiaSe).then(ok => {
      if (ok) return;
      moTimKiem('xem');
      $('#o-tim').value = q.get('chu') || q.get('tieuDe') || '';
      if ($('#o-tim').value) timGoiY($('#o-tim').value);
    });
    history.replaceState(null, '', location.pathname);
  } else if (d) {
    const [lat, lng] = d.split(',').map(Number);
    if (isFinite(lat) && isFinite(lng)) {
      st.lienKet = true;
      chonDiaDiem({ ten: q.get('ten') || 'Vị trí được chia sẻ', diaChi: '', viTri: [lng, lat] }, { timDiaChi: !q.get('ten') });
      if (q.get('ten')) diaChiTuToaDo([lng, lat]).then(kq => { if (st.diaDiem) { st.diaDiem.diaChi = kq.diaChi; renderDiaDiem(); } }).catch(() => {});
    }
  } else if (q.get('q')) {
    st.lienKet = true;
    moTimKiem('xem');
    $('#o-tim').value = q.get('q');
    timGoiY(q.get('q'));
  }
}

/**
 * Mở địa điểm từ liên kết / văn bản chia sẻ (Google Maps, Apple Maps, geo:, toạ độ).
 * Liên kết rút gọn maps.app.goo.gl được máy chủ HawaMap mở ra. Trả về false nếu không nhận ra.
 */
async function moChuoiChiaSe(chuoi) {
  let kq = docLienKet(chuoi);
  if (!kq) return false;
  st.lienKet = true;
  if (kq.rutGon) {
    thongBao('Đang mở liên kết Google Maps…');
    try {
      const r = await fetch(`${diaChiApi()}/mo-lien-ket?url=${encodeURIComponent(kq.rutGon)}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.diaDiem) throw new Error(d.loi || 'máy chủ không trả lời');
      kq = d.diaDiem;
    } catch (e) {
      thongBao('Không mở được liên kết rút gọn: ' + e.message + '. Hãy mở liên kết trong trình duyệt rồi chia sẻ lại liên kết đầy đủ.', { loai: 'loi', thoiGian: 6000 });
      return true;
    }
  }
  if (kq.viTri) {
    const dd = { ten: kq.ten || 'Vị trí được chia sẻ', diaChi: '', viTri: kq.viTri };
    if (kq.chiDuong && !st.dd) { dongTimKiem(); moLoTrinh(dd); return true; }
    dongTimKiem();
    chonDiaDiem(dd, { timDiaChi: !kq.ten });
    if (kq.ten) diaChiTuToaDo(kq.viTri).then(x => { if (st.diaDiem && st.diaDiem.ten === dd.ten) { st.diaDiem.diaChi = x.diaChi; renderDiaDiem(); } }).catch(() => {});
  } else {
    moTimKiem(kq.chiDuong ? 'chi-duong' : 'xem');
    $('#o-tim').value = kq.truyVan;
    $('#nut-xoa-tim').hidden = false;
    timGoiY(kq.truyVan);
  }
  return true;
}

// ================================================================== danh mục (cây xăng, ATM…)
async function timDanhMuc(id, { docTuyen = false } = {}) {
  const dm = layDanhMuc(id);
  if (!dm) return;
  dongTimKiem();
  const goc = viTriGan();
  st.danhMuc = { dm, ds: null, docTuyen };
  if (st.cheDo !== 'danduong') datCheDo('danhmuc');
  else st.tamPhu = true;
  banDo.datGhim(null);
  tam.hien(`<div class="tieu-de-tam">${icon(dm.icon)}${esc(dm.ten)}${docTuyen ? ' dọc đường đi' : ' gần đây'}</div><div class="dang-tai"><i></i>Đang tìm…</div>`, { trangThai: 'thu' });
  try {
    let ds;
    if (docTuyen && st.dd) {
      const t = st.dd.tuyen, s = st.dd.tt ? st.dd.tt.s : 0;
      ds = await timDocTuyen(dm, catTuyen(t.toaDo, t.tichLuy, s, s + 30000), goc);
    } else ds = await timQuanh(dm, goc);
    if (!st.danhMuc || st.danhMuc.dm !== dm) return;
    st.danhMuc.ds = ds;
    banDo.datKetQua(ds);
    renderDanhMuc();
    if (ds.length && st.cheDo !== 'danduong') banDo.vuaKhung([goc, ...ds.slice(0, 12).map(x => x.viTri)]);
  } catch (e) {
    if (st.danhMuc && st.danhMuc.dm === dm) {
      tam.hien(`<div class="tieu-de-tam">${esc(dm.ten)}</div><div class="trong">Không tải được dữ liệu địa điểm. Kiểm tra kết nối mạng.
        <button class="nut vien" data-hd="danh-muc" data-id="${dm.id}">Thử lại</button></div>`);
    }
  }
}

function renderDanhMuc() {
  const { dm, ds, docTuyen } = st.danhMuc;
  if (!ds) return;
  const hd = st.cheDo === 'danduong' ? 'them-dung-dd' : 'chon-dm';
  tam.hien(`<div class="dd-dau"><div class="tieu-de-tam">${icon(dm.icon)}${esc(dm.ten)}${docTuyen ? ' dọc đường đi' : ' gần đây'} <small>(${ds.length})</small></div>
      <button class="nut-icon" data-hd="${st.cheDo === 'danduong' ? 'dong-tam' : 'dong-danh-muc'}" aria-label="Đóng">${icon('dong')}</button></div>
    ${ds.length ? ds.map((x, i) => dongKetQua(x, hd, i)).join('') : '<div class="trong">Không có địa điểm nào trong khu vực.</div>'}`,
  { trangThai: ds.length > 3 ? 'mo' : 'thu' });
}

// ================================================================== lộ trình
function gonDiem(dd) { return { ten: dd.ten, diaChi: dd.diaChi || '', viTri: dd.viTri }; }

function toaDoDiem(d) { return d.toi ? (st.viTri && st.viTri.viTri) : d.viTri; }

function moLoTrinh(den, { batDauNgay = false } = {}) {
  st.lt = { diem: [{ toi: true }, den.toi ? den : gonDiem(den)], phuongTien: caiDat.phuongTien, tuyen: [], chon: 0, batDauNgay };
  st.diaDiem = null;
  st.danhMuc = null;
  st.tamPhu = false;
  banDo.datGhim(null);
  banDo.datKetQua([]);
  datCheDo('lotrinh');
  renderKhungLt();
  return tinhLoTrinh();
}

function dongLoTrinh() {
  if (st.huyLt) st.huyLt.abort();
  st.lt = null;
  banDo.xoaTuyen();
  banDo.datNhanTuyen([]);
  banDo.datDiemLoTrinh([]);
  veChinh();
}

function tenDiem(d, i) {
  if (d.toi) return 'Vị trí của bạn';
  return d.ten || (i === 0 ? 'Chọn điểm xuất phát' : 'Chọn điểm đến');
}

function renderKhungLt() {
  const lt = st.lt;
  const n = lt.diem.length;
  $('#lt-diem').innerHTML = lt.diem.map((d, i) => {
    const kieu = i === 0 ? 'dau' : i === n - 1 ? 'cuoi' : 'dung';
    return `<div class="lt-dong">
      <span class="lt-cham ${kieu}">${kieu === 'dung' ? i : ''}</span>
      <button class="lt-o${d.toi ? ' toi' : ''}" data-hd="sua-diem" data-i="${i}">${esc(tenDiem(d, i))}</button>
      ${kieu === 'dung' ? `<button class="nut-icon nho" data-hd="bo-diem" data-i="${i}" aria-label="Bỏ điểm dừng">${icon('dong')}</button>` : ''}
    </div>`;
  }).join('');
  $('#tab-xe').innerHTML = Object.entries(PHUONG_TIEN).map(([k, v]) => {
    const chon = k === lt.phuongTien;
    const tg = chon && lt.tuyen[lt.chon] ? thoiGian(lt.tuyen[lt.chon].thoiGian) : '';
    return `<button class="tab${chon ? ' chon' : ''}" data-hd="doi-xe" data-xe="${k}">${icon(v.icon)}<span>${chon && tg ? tg : v.ten}</span></button>`;
  }).join('');
  $('[data-hd="them-diem-dung"]').disabled = n >= 5;
  capNhatLe();
}

async function tinhLoTrinh() {
  const lt = st.lt;
  if (!lt) return;
  const ds = lt.diem.map(toaDoDiem);
  if (st.huyLt) st.huyLt.abort();
  if (ds.some(p => !p)) {
    lt.tuyen = [];
    banDo.xoaTuyen();
    banDo.datNhanTuyen([]);
    const thieuViTri = lt.diem.some(d => d.toi) && !st.viTri;
    if (thieuViTri) {
      lt.choGps = true;
      batGps();
      tam.hien(`<div class="trong">${icon('vitri')}<p>Đang chờ tín hiệu GPS để xác định vị trí của bạn…</p>
        <button class="nut vien" data-hd="sua-diem" data-i="0">Chọn điểm xuất phát khác</button></div>`, { coTheAn: false });
    }
    return;
  }
  const huy = st.huyLt = new AbortController();
  lt.dangTai = true;
  tam.hien('<div class="dang-tai"><i></i>Đang tìm đường…</div>', { coTheAn: false });
  try {
    const kq = await timDuong({
      diem: ds, phuongTien: lt.phuongTien, tranhCaoToc: caiDat.tranhCaoToc, tranhThuPhi: caiDat.tranhThuPhi, tinHieu: huy.signal
    });
    if (huy.signal.aborted || st.lt !== lt) return;
    // dẫn đường thông minh: tải báo cáo dọc các tuyến rồi ưu tiên tuyến tránh kẹt xe / tai nạn / cấm đường
    lt.tuyen = caiDat.tranhKetXe ? xepHangTuyen(kq, await baoCaoDocTuyen(kq)) : kq;
    if (huy.signal.aborted || st.lt !== lt) return;
    lt.chon = 0;
    lt.loi = null;
    veLoTrinh(true);
    if (lt.batDauNgay) { lt.batDauNgay = false; batDauDanDuong(); }
  } catch (e) {
    if (e.name === 'AbortError' || st.lt !== lt) return;
    lt.tuyen = [];
    lt.loi = e.message || 'Không tìm được đường đi';
    banDo.xoaTuyen();
    banDo.datNhanTuyen([]);
    renderTheTuyen();
  } finally {
    lt.dangTai = false;
  }
}

function veLoTrinh(vuaKhung) {
  const lt = st.lt;
  banDo.datTuyen(lt.tuyen, lt.chon);
  const n = lt.diem.length;
  banDo.datDiemLoTrinh(lt.diem.map((d, i) => {
    const p = toaDoDiem(d);
    if (!p || (i === 0 && d.toi)) return null;
    return { viTri: p, loai: i === 0 ? 'dau' : i === n - 1 ? 'cuoi' : 'dung', nhan: i > 0 && i < n - 1 ? String(i) : '' };
  }).filter(Boolean));
  banDo.datNhanTuyen(lt.tuyen.map((t, i) => {
    const vt = diemTaiS(t.toaDo, t.tichLuy, t.tichLuy[t.tichLuy.length - 1] * (i === lt.chon ? 0.5 : 0.35 + 0.15 * i)).diem;
    return { viTri: vt, chu: thoiGian(t.thoiGian + (t.phatBaoCao || 0)), chon: i === lt.chon, i };
  }));
  renderTheTuyen();
  renderKhungLt();
  if (vuaKhung) banDo.vuaKhung(lt.tuyen.flatMap(t => t.toaDo));
}

function chonTuyen(i) {
  if (st.cheDo !== 'lotrinh' || !st.lt.tuyen[i]) return;
  st.lt.chon = i;
  st.tamPhu = false;
  veLoTrinh(false);
}

function renderTheTuyen() {
  const lt = st.lt;
  if (!lt) return;
  if (lt.loi) {
    tam.hien(`<div class="trong">${icon('canhbao')}<p>${esc(lt.loi)}</p><button class="nut vien" data-hd="tinh-lai-lt">Thử lại</button></div>`, { coTheAn: false });
    return;
  }
  if (!lt.tuyen.length) return;
  const tgDuKien = t => t.thoiGian + (t.phatBaoCao || 0);
  const nhanh = Math.min(...lt.tuyen.map(tgDuKien));
  const the = lt.tuyen.map((t, i) => {
    const nhan = [];
    if (tgDuKien(t) === nhanh && lt.tuyen.length > 1) nhan.push('<i class="xanh">Nhanh nhất</i>');
    if (t.tranhBaoCao) nhan.push('<i class="xanh">Tránh kẹt xe</i>');
    if (t.baoCaoTren && t.baoCaoTren.length) {
      const loai = [...new Set(t.baoCaoTren.map(x => LOAI_BAO_CAO[x.baoCao.loai].ten))].join(', ');
      nhan.push(`<i class="do">${esc(loai)} trên tuyến</i>`);
    }
    const phi = lt.phuongTien === 'oto' ? phiTuyen(t, caiDat.loaiXeThuPhi) : null;
    if (phi && phi.soTram) nhan.push(`<i class="cam" title="${esc(phi.ds.map(x => `${x.ten}: ${dinhDangTien(x.phi)}`).join('\n'))}">Phí ~ ${dinhDangTien(phi.tong)}</i>`);
    else if (t.coThuPhi) nhan.push('<i class="cam">Có trạm thu phí</i>');
    if (t.coCaoToc) nhan.push(`<i class="${lt.phuongTien === 'xemay' ? 'do' : 'xam'}">Có đoạn cao tốc</i>`);
    if (t.coPha) nhan.push('<i class="xam">Đi phà</i>');
    return `<button class="the-tuyen${i === lt.chon ? ' chon' : ''}" data-hd="chon-tuyen" data-i="${i}">
      <span class="tt-dong"><b class="tt-tg">${thoiGian(tgDuKien(t))}</b><span class="tt-kc">${quangDuong(t.quangDuong)}</span></span>
      <span class="tt-qua">${t.duongChinh ? 'Qua ' + esc(t.duongChinh) : esc(PHUONG_TIEN[lt.phuongTien].ten)}</span>
      <span class="tt-dong"><span class="tt-nhan">${nhan.join('')}</span><span class="tt-den">Đến lúc ${gioDen(tgDuKien(t))}</span></span>
    </button>`;
  }).join('');
  tam.hien(`<div class="ds-tuyen">${the}</div>
    <div class="hang-nut">
      <button class="nut xanh lon" data-hd="bat-dau">${icon('muiten')}Bắt đầu</button>
      <button class="nut vien" data-hd="mo-phong">${icon('phat')}Chạy thử</button>
      <button class="nut vien" data-hd="xem-buoc">${icon('danhsach')}Chi tiết</button>
    </div>
    <div class="lt-tuy-chon">
      ${lt.phuongTien === 'oto' ? `<label class="cong-tac"><input type="checkbox" data-hd-doi="tranhCaoToc"${caiDat.tranhCaoToc ? ' checked' : ''}><span></span>Tránh cao tốc</label>` : ''}
      ${lt.phuongTien === 'oto' || lt.phuongTien === 'xemay' ? `<label class="cong-tac"><input type="checkbox" data-hd-doi="tranhThuPhi"${caiDat.tranhThuPhi ? ' checked' : ''}><span></span>Tránh trạm thu phí</label>` : ''}
    </div>`, { trangThai: 'thu', coTheAn: false });
}

function renderBuoc(tuyen, hienTai = -1) {
  const ds = tuyen.buoc.map((b, i) => `<div class="dong-buoc${i === hienTai ? ' hien-tai' : ''}${i < hienTai ? ' da-qua' : ''}">
      <span class="db-icon">${muiTenRe(b.loai === 'depart' ? null : b)}</span>
      <span class="db-chu"><b>${esc(b.chiDan)}</b>${b.quangDuong > 0 && b.loai !== 'arrive' ? `<small>${quangDuong(b.quangDuong)}</small>` : ''}</span>
    </div>`).join('');
  hienTamPhu(`<div class="dd-dau"><div class="tieu-de-tam">${icon('danhsach')}Các bước · ${quangDuong(tuyen.quangDuong)} · ${thoiGian(tuyen.thoiGian)}</div>
    <button class="nut-icon" data-hd="dong-tam" aria-label="Đóng">${icon('dong')}</button></div>${ds}`, { trangThai: 'mo' });
}

// ================================================================== dẫn đường
function batDauDanDuong({ moPhong = false, tuGoc = false } = {}) {
  const lt = st.lt;
  const t = lt && lt.tuyen[lt.chon];
  if (!t) return;
  moKhoaAmThanh();
  if (!moPhong && !lt.diem[0].toi) {
    moPhong = true;
    thongBao('Điểm xuất phát không phải vị trí hiện tại — chạy thử lộ trình');
  }
  if (st.dd) ketThucDanDuong({ tuGoc: true, imLang: false });
  const den = lt.diem[lt.diem.length - 1];
  st.dd = {
    tuyen: t, may: new DanDuong(t), tt: null,
    diemDen: lt.diem.slice(1).map(d => ({ ten: tenDiem(d, 1), viTri: toaDoDiem(d) })),
    tenDen: den.toi ? 'Vị trí của bạn' : den.ten, phuongTien: lt.phuongTien,
    batDauLuc: Date.now(), lanTinhLai: 0, dangTinhLai: false, moPhong
  };
  st.tamPhu = false;
  st.ddMoRong = false;
  tam.an();
  banDo.datMauTuyen('danduong');
  banDo.datTuyen([t], 0);
  banDo.datNhanTuyen([]);
  st.khuVuc = '';
  veDiemDungDd();
  datCheDo('danduong');
  banDo.datTheoDoi('huong');
  capNhatNutViTri();
  giuManHinh(true);
  if (caiDat.giongNoi && coTiengViet() === false && !st.daNhacGiongViet) {
    st.daNhacGiongViet = true;
    thongBao('Máy chưa có giọng đọc tiếng Việt — vào Cài đặt → Giọng nói để cài', { thoiGian: 6000 });
  }
  if (caiDat.tuGhiHanhTrinh && !moPhong) ghiHT.batDau(st.dd.tenDen);
  if (!moPhong) tuMoCamera();
  noi(st.dd.may.loiBatDau(), { chen: true });
  renderBangRe(null);
  renderThanhDd(null);
  $('#nut-loa').innerHTML = icon(caiDat.giongNoi ? 'loa' : 'tatloa');
  $('#nut-3d').innerHTML = chu3D(caiDat.dd3D);
  // báo ứng dụng gốc để đồng bộ sang màn hình còn lại (điện thoại ↔ Android Auto / CarPlay)
  if (laAppGoc && !tuGoc) {
    guiGoc('batDau', { tuyen: { ...t, tichLuy: undefined }, diemDen: st.dd.diemDen, tenDen: st.dd.tenDen, phuongTien: st.dd.phuongTien, moPhong });
  }
  baoGoc(null);
  if (moPhong) batMoPhong(t);
  else if (st.viTri) xuLyViTri(st.viTri);
}

function veDiemDungDd() {
  const dd = st.dd;
  banDo.datDiemLoTrinh(dd.diemDen.slice(0, -1).map((d, i) => ({ viTri: d.viTri, loai: 'dung', nhan: String(i + 1) })));
  banDo.datGhim(dd.diemDen[dd.diemDen.length - 1].viTri, 'co');
}

function capNhatDanDuong(vt) {
  const dd = st.dd;
  const tt = dd.may.capNhat(vt);
  dd.tt = tt;
  if (tt.noi) noi(tt.noi);
  // đi sai đường: tính lại (tinhLaiDuong tự giãn cách các lần thử)
  if (tt.lech && dd.may.lanLech >= 3 && !dd.moPhong) tinhLaiDuong();
  for (const sk of tt.suKien) {
    if (sk.loai === 'diemdung') {
      noi('Bạn đã đến điểm dừng.', { chen: true });
      bip('den');
      dd.diemDen.shift();
      veDiemDungDd();
    }
    if (sk.loai === 'dennoi') {
      bip('den');
      clearTimeout(dd.henKetThuc);
      dd.henKetThuc = setTimeout(() => { if (st.dd === dd) ketThucDanDuong({ daDen: true }); }, 3500);
    }
  }
  banDo.datDaDi(catTuyen(dd.tuyen.toaDo, dd.tuyen.tichLuy, 0, tt.s));
  renderBangRe(tt);
  renderThanhDd(tt);
  return tt;
}

async function tinhLaiDuong() {
  const dd = st.dd;
  if (!dd || dd.dangTinhLai || Date.now() - dd.lanTinhLai < 8000 || !st.viTri) return;
  dd.dangTinhLai = true;
  renderBangRe(dd.tt);
  baoGoc(dd.tt);
  try {
    const ds = await timDuong({
      diem: [st.viTri.viTri, ...dd.diemDen.map(d => d.viTri)], phuongTien: dd.phuongTien, huongDau: st.viTri.huong, phuongAn: false,
      tranhCaoToc: caiDat.tranhCaoToc, tranhThuPhi: caiDat.tranhThuPhi
    });
    if (st.dd !== dd) return;
    datTuyenDanDuong(ds[0]);
    noi('Đã tính lại đường đi.', { chen: true });
  } catch (e) {
    if (st.dd === dd) thongBao('Không tính lại được đường đi, sẽ thử lại', { loai: 'loi' });
  } finally {
    dd.dangTinhLai = false;
    dd.lanTinhLai = Date.now();
  }
}

/** Thay tuyến đang dẫn (tính lại / thêm điểm dừng) mà không đọc lại lời chào. */
function datTuyenDanDuong(t) {
  const dd = st.dd;
  dd.tuyen = t;
  dd.may = new DanDuong(t);
  dd.may.loiBatDau();
  banDo.datTuyen([t], 0);
  veDiemDungDd();
  if (st.moPhong) st.moPhong.datTuyen(t);
  if (st.viTri) xuLyViTri(st.viTri);
}

async function themDiemDungDd(dd2) {
  const dd = st.dd;
  if (!dd || !st.viTri) return;
  dd.diemDen.splice(dd.diemDen.length - 1, 0, { ten: dd2.ten, viTri: dd2.viTri });
  st.danhMuc = null;
  banDo.datKetQua([]);
  dongTam();
  thongBao('Đang thêm điểm dừng ' + dd2.ten + '…');
  try {
    const ds = await timDuong({ diem: [st.viTri.viTri, ...dd.diemDen.map(d => d.viTri)], phuongTien: dd.phuongTien, huongDau: st.viTri.huong, phuongAn: false });
    if (st.dd !== dd) return;
    datTuyenDanDuong(ds[0]);
    noi('Đã thêm điểm dừng ' + dd2.ten + '.');
  } catch (e) {
    dd.diemDen.splice(dd.diemDen.length - 2, 1);
    thongBao('Không thêm được điểm dừng: ' + e.message, { loai: 'loi' });
  }
}

function tenBuoc(ke) {
  if (!ke) return '';
  if (ke.loai === 'arrive') return ke.diemDung ? 'Điểm dừng' : st.dd.tenDen;
  return tenDuong(ke) || ke.chiDan;
}

/** Chỉ thay nội dung khi thật sự khác: nút không bị tạo lại giữa lúc người dùng đang chạm (vị trí cập nhật liên tục). */
function datHtml(el, html) {
  if (el._html === html) return;
  el._html = html;
  el.innerHTML = html;
}

function renderBangRe(tt) {
  const dd = st.dd, el = $('#bang-re');
  if (!dd) return;
  if (dd.dangTinhLai) {
    datHtml(el, `<div class="br-chinh"><span class="br-icon xoay">${icon('chiduong')}</span><div class="br-chu"><b class="br-kc">Đang tính lại đường…</b></div></div>`);
    banDo.datNhanRe(null);
    return;
  }
  const ke = tt ? tt.ke : dd.tuyen.buoc[1];
  const kc = tt ? tt.kcDenRe : (ke ? ke.batDau : 0);
  const lan = ke && ke.lanes && ke.lanes.length > 1 && kc < 600
    ? `<div class="br-lan">${ke.lanes.map(l => `<span class="${l.valid ? 'dung' : ''}">${muiTenLan(l.indications)}</span>`).join('')}</div>` : '';
  const keNua = tt ? tt.keNua : dd.tuyen.buoc[2];
  const sauDo = ke && keNua && ke.loai !== 'arrive' && keNua.batDau - ke.batDau < 150
    ? `<div class="br-sau">Sau đó ${muiTenRe(keNua)}</div>` : '';
  // khoảng cách lớn ("850m") và tên đường sắp vào (hoặc điểm đến; không có tên thì ghi thao tác)
  const thaoTac = thaoTacNgan(ke);
  const ten = !ke ? '' : ke.loai === 'arrive' ? tenBuoc(ke) : tenDuong(ke);
  const dongTen = ten || (thaoTac ? thaoTac[0].toLocaleUpperCase('vi') + thaoTac.slice(1) : '');
  datHtml(el, `<div class="br-chinh">${muiTenRe(ke, 'br-icon')}
      <div class="br-chu"><b class="br-kc">${quangDuong(kc).replace(' ', '')}</b><span class="br-ten">${esc(dongTen)}</span></div></div>${lan}${sauDo}`);
  // nhãn xanh tại chỗ rẽ trên bản đồ
  banDo.datNhanRe(ke && ke.viTri && ke.loai !== 'arrive' && dongTen ? ke.viTri : null,
    ke ? `${muiTenRe(ke, 'nr-icon')}<span>${esc(dongTen)}</span>` : '');
  capNhatLe();
}

function renderThanhDd(tt) {
  const dd = st.dd;
  if (!dd) return;
  const conLai = tt ? tt.conLai : dd.tuyen.quangDuong;
  const tg = tt ? tt.thoiGianConLai : dd.tuyen.thoiGian;
  datHtml($('#thanh-dd'), `<button class="nut-icon tdd-x tdd-ket-thuc" data-hd="ket-thuc-dd" aria-label="Kết thúc dẫn đường">${icon('dong')}</button>
    <button class="tdd-thong-tin" data-hd="mo-rong-dd" aria-label="Thêm lựa chọn">
      <b class="tdd-con">${quangDuong(conLai)} · ${thoiGian(tg)}</b><span><span class="tdd-gio">${gioDen(tg)}</span> đến nơi</span></button>
    <button class="nut-icon tdd-x" data-hd="mo-rong-dd" aria-label="${st.ddMoRong ? 'Thu gọn' : 'Thêm lựa chọn'}">${icon(st.ddMoRong ? 'xuong' : 'len')}</button>
    ${st.ddMoRong ? `<div class="tdd-them">
      <button data-hd="doi-3d">${chu3D(!caiDat.dd3D)}Bản đồ ${caiDat.dd3D ? '2D' : '3D'}</button>
      <button data-hd="xem-buoc-dd">${icon('danhsach')}Các bước</button>
      <button data-hd="xang-doc-duong">${icon('xang')}Cây xăng</button>
      <button data-hd="doi-loa">${icon(caiDat.giongNoi ? 'loa' : 'tatloa')}${caiDat.giongNoi ? 'Tắt tiếng' : 'Bật tiếng'}</button>
      <button data-hd="bao-cao">${icon('loabao')}Báo cáo</button>
      <button data-hd="mo-camera">${icon('camera')}Camera</button>
    </div>` : ''}`);
  // thanh tiến độ dọc bên phải: phần đã đi (xám) từ dưới lên, mũi tên xanh ở vị trí hiện tại
  const tong = dd.tuyen.quangDuong || 1;
  $('#tien-do-dd').style.setProperty('--da-di', Math.max(0, Math.min(1, 1 - conLai / tong)).toFixed(3));
  capNhatLe();
}

async function ketThucDanDuong({ daDen = false, tuGoc = false, imLang: imDi = true } = {}) {
  const dd = st.dd;
  if (!dd) return;
  st.dd = null;
  clearTimeout(dd.henKetThuc);
  boGoiYTuyen();
  if (st.moPhong) tatMoPhong();
  const ht = ghiHT.ketThuc(dd.tenDen);
  if (!daDen && imDi) imLang();
  if (laAppGoc) {
    guiGoc('danDuong', { dangDanDuong: false, daDen, tenDen: dd.tenDen });
    if (!tuGoc) guiGoc('ketThuc', { daDen });
  }
  if (!st.laiXe) giuManHinh(false);
  banDo.xoaTuyen();
  banDo.datMauTuyen();
  banDo.datNhanRe(null);
  banDo.datDiemLoTrinh([]);
  banDo.datGhim(null);
  banDo.datKetQua([]);
  st.lt = null;
  st.danhMuc = null;
  st.tamPhu = false;
  tam.an();
  $('#canh-bao-dd').hidden = true;
  datCheDo('chinh');
  banDo.datTheoDoi(st.viTri ? 'bac' : 'khong');
  capNhatNutViTri();
  if (daDen && !cheDoXe) {
    hopThoai({
      tieuDe: 'Bạn đã đến nơi',
      noiDung: `<p class="den-noi">${icon('ghim')}<b>${esc(dd.tenDen)}</b></p>` + (ht ? `<p class="mo">Quãng đường ${quangDuong(ht.quangDuong)} · ${thoiGian(ht.thoiGian)} · tốc độ TB ${ht.tocDoTB} km/h</p>` : ''),
      nut: [{ chu: 'Xong', giaTri: true, kieu: 'chinh' }]
    });
  }
}

function batMoPhong(t) {
  st.moPhong = new MoPhong(t, vt => nguonViTri.phat(vt));
  nguonViTri.moPhong = st.moPhong;
  st.moPhong.batDau();
  document.body.classList.add('mo-phong');
  renderDkMoPhong();
}

function tatMoPhong() {
  if (!st.moPhong) return;
  st.moPhong.dung();
  st.moPhong = null;
  nguonViTri.moPhong = null;
  document.body.classList.remove('mo-phong');
  $('#dk-mo-phong').hidden = true;
  if (nguonViTri.truoc) nguonViTri.phat(nguonViTri.truoc);
}

function renderDkMoPhong() {
  const m = st.moPhong, el = $('#dk-mo-phong');
  if (!m) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<button data-hd="mp-dung" aria-label="${m.tamDung ? 'Tiếp tục' : 'Tạm dừng'}">${icon(m.tamDung ? 'phat' : 'dungtam')}</button>
    ${[1, 2, 4].map(h => `<button class="${m.heSo === h ? 'chon' : ''}" data-hd="mp-he-so" data-h="${h}">×${h}</button>`).join('')}
    <button data-hd="mp-toc" data-d="-10" aria-label="Chậm lại">−</button><span class="mp-toc">${m.congThem >= 0 ? '+' : ''}${m.congThem}</span>
    <button data-hd="mp-toc" data-d="10" aria-label="Nhanh hơn">+</button>`;
}

// ================================================================== chế độ lái xe (không có lộ trình)
function batLaiXe(bat) {
  st.laiXe = bat;
  document.body.classList.toggle('lai-xe', bat);
  if (bat) {
    moKhoaAmThanh();
    batGps();
    veChinh();
    banDo.datTheoDoi('huong');
    giuManHinh(true);
    if (caiDat.tuGhiHanhTrinh && !ghiHT.dangGhi) ghiHT.batDau('Lái xe');
    tuMoCamera();
    thongBao('Chế độ lái xe: cảnh báo tốc độ, camera và báo cáo phía trước');
  } else {
    banDo.datTheoDoi(st.viTri ? 'bac' : 'khong');
    giuManHinh(false);
    const ht = ghiHT.ketThuc();
    if (ht) thongBao(`Đã lưu hành trình ${quangDuong(ht.quangDuong)}`);
  }
  capNhatNutViTri();
  if (st.cbCuoi) renderHud(st.cbCuoi);
  capNhatLe();
}

// ================================================================== HUD kính lái
const KIEU_LAT_HUD = { doc: 'Lật dọc (phản chiếu kính lái)', ngang: 'Lật ngang', khong: 'Không lật' };

function batHud(bat) {
  st.hud = bat;
  const el = $('#man-hud');
  el.hidden = !bat;
  if (bat) {
    moKhoaAmThanh();
    batGps();
    giuManHinh(true);
    datKieuLatHud();
    renderManHud();
    if (document.fullscreenEnabled && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    hienNutHud();
  } else {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    giuManHinh(!!(st.dd || st.laiXe));
  }
}

function datKieuLatHud() {
  const el = $('#man-hud');
  el.dataset.lat = caiDat.latHud;
  $('#nut-hud-lat').textContent = KIEU_LAT_HUD[caiDat.latHud] || KIEU_LAT_HUD.doc;
}

/** Chạm vào màn hình HUD: hiện nút (lật / thoát) trong vài giây, không lật theo hình. */
function hienNutHud() {
  $('#hud-nut').hidden = false;
  clearTimeout(st.henNutHud);
  st.henNutHud = setTimeout(() => { $('#hud-nut').hidden = true; }, 4000);
}

function renderManHud() {
  const cb = st.cbCuoi || { kmh: st.viTri ? tocDoKmh(st.viTri.tocDo) : 0 };
  const g = st.dd ? trangThaiGoc(st.ttCuoi) : null;
  const ke = g && g.ke;
  const d = cb.canhBao;
  const matGps = document.body.classList.contains('mat-gps');
  $('#hud-noi').innerHTML = `
    <div class="hn-toc${cb.vuotToc ? ' vuot' : ''}"><b>${matGps ? '--' : cb.kmh}</b><span>${matGps ? 'Mất GPS' : 'km/h'}</span></div>
    ${cb.gioiHan ? `<div class="hn-bien${cb.uocTinh ? ' uoc' : ''}"><b>${cb.gioiHan}</b></div>` : ''}
    ${bienLuat(cb, 'hn-luat')}
    ${ke ? `<div class="hn-re">${muiTenRe(ke)}<div><b>${quangDuong(ke.kc || 0)}</b><span>${esc(ke.ten || ke.chiDan || '')}</span></div></div>` : ''}
    ${d ? `<div class="hn-cb">${icon(d.icon)}<b>${d.hienTai ? 'Ngay đây' : quangDuong(d.kc)}</b><span>${esc(d.ten)}</span></div>` : ''}
    <div class="hn-duoi">${g ? `<span>${esc(g.conLaiChu)}</span><span>Đến ${esc(g.gioDenChu)}</span>`
    : `<span>${esc(cb.duong ? cb.duong.ten || cb.duong.ref || '' : '')}</span><span>${new Date().toTimeString().slice(0, 5)}</span>`}</div>`;
}

// ================================================================== báo cáo giao thông
async function taiBaoCaoKhuVuc() {
  const k = banDo.khungHienTai();
  const rong = Math.max(0.02, (k[2] - k[0]) * 0.25), cao = Math.max(0.02, (k[3] - k[1]) * 0.25);
  let khung = [k[0] - rong, k[1] - cao, k[2] + rong, k[3] + cao];
  // đang dẫn đường: lấy cả báo cáo trên đoạn tuyến còn lại (tối đa ~50 km quanh xe) để kịp tránh kẹt xe
  const dd = st.dd;
  if (dd && dd.tt && st.viTri) {
    const t = dd.tuyen, conLai = t.toaDo.slice(Math.max(0, dd.may.chiSo || 0));
    const p = st.viTri.viTri;
    for (const q of conLai) {
      if (Math.abs(q[0] - p[0]) > 0.45 || Math.abs(q[1] - p[1]) > 0.45) continue;
      khung = [Math.min(khung[0], q[0]), Math.min(khung[1], q[1]), Math.max(khung[2], q[0]), Math.max(khung[3], q[1])];
    }
  }
  await taiBaoCao(khung);
  banDo.datBaoCao(baoCaoHienTai());
}

/** Báo cáo trong khung bao các tuyến (để xếp hạng tuyến khi tìm đường). */
async function baoCaoDocTuyen(dsTuyen) {
  let k = [180, 90, -180, -90];
  for (const t of dsTuyen) for (const q of t.toaDo) k = [Math.min(k[0], q[0]), Math.min(k[1], q[1]), Math.max(k[2], q[0]), Math.max(k[3], q[1])];
  if (k[2] - k[0] < 3 && k[3] - k[1] < 3) {
    try { await taiBaoCao([k[0] - 0.01, k[1] - 0.01, k[2] + 0.01, k[3] + 0.01]); } catch (e) { /* dùng báo cáo đang có */ }
  }
  return baoCaoHienTai();
}

/**
 * Đang dẫn đường mà có báo cáo kẹt xe / tai nạn / cấm đường mới trên 30 km phía trước: tính lại từ vị trí hiện tại,
 * tuyến khác nhanh hơn từ 3 phút thì gợi ý đổi (màn hình xe: tự đổi khi nhanh hơn từ 5 phút).
 */
async function xetDoiTuyen() {
  const dd = st.dd;
  if (!dd || !dd.tt || dd.dangTinhLai || dd.dangXetDoi || !caiDat.tranhKetXe || !st.viTri || st.goiYTuyen) return;
  dd.daXetBc = dd.daXetBc || new Set();
  const moi = baoCaoTrenTuyen(dd.tuyen, baoCaoHienTai(), { sTu: dd.tt.s, xa: 30000 }).filter(x => !dd.daXetBc.has(x.baoCao.id));
  if (!moi.length) return;
  moi.forEach(x => dd.daXetBc.add(x.baoCao.id));
  dd.dangXetDoi = true;
  try {
    const ds = await timDuong({
      diem: [st.viTri.viTri, ...dd.diemDen.map(d => d.viTri)], phuongTien: dd.phuongTien, huongDau: st.viTri.huong,
      phuongAn: dd.diemDen.length === 1, tranhCaoToc: caiDat.tranhCaoToc, tranhThuPhi: caiDat.tranhThuPhi
    });
    if (st.dd !== dd) return;
    const goiY = goiYDoiTuyen({ tuyen: dd.tuyen, s: dd.tt.s, thoiGianConLai: dd.tt.thoiGianConLai }, xepHangTuyen(ds, baoCaoHienTai()), baoCaoHienTai());
    const nangNhat = moi.reduce((a, b) => (b.phut > a.phut ? b : a));
    const tenBc = LOAI_BAO_CAO[nangNhat.baoCao.loai].nghe;
    if (!goiY) { noi(`Phía trước có ${tenBc}, chưa có đường khác nhanh hơn.`); return; }
    const phut = Math.round(goiY.tietKiem / 60);
    if (cheDoXe) {
      if (goiY.tietKiem < 300) return;
      datTuyenDanDuong(goiY.tuyen);
      noi(`Phía trước có ${tenBc}. Đã chuyển sang đường khác nhanh hơn khoảng ${phut} phút.`, { chen: true });
      return;
    }
    st.goiYTuyen = goiY;
    const el = $('#goi-y-tuyen');
    el.hidden = false;
    el.innerHTML = `<div><b>Phía trước có ${esc(tenBc)}</b><span>Đường khác nhanh hơn khoảng ${phut} phút</span></div>
      <button class="nut xanh" data-hd="doi-tuyen-goi-y">Đổi đường</button><button class="nut vien" data-hd="bo-goi-y">Giữ</button>`;
    noi(`Phía trước có ${tenBc}. Có đường khác nhanh hơn khoảng ${phut} phút. Bấm Đổi đường để đi đường khác.`, { chen: true });
    clearTimeout(st.henGoiY);
    st.henGoiY = setTimeout(boGoiYTuyen, 30000);
  } catch (e) {
    /* không tính được tuyến khác: lần sau thử lại với báo cáo mới */
  } finally {
    dd.dangXetDoi = false;
  }
}

function boGoiYTuyen() {
  st.goiYTuyen = null;
  clearTimeout(st.henGoiY);
  $('#goi-y-tuyen').hidden = true;
}

function moBaoCao(viTriRieng) {
  st.viTriBaoCao = viTriRieng || null;
  hienTamPhu(`<div class="dd-dau"><div class="tieu-de-tam">${icon('loabao')}Báo cáo giao thông</div>
      <button class="nut-icon" data-hd="dong-tam" aria-label="Đóng">${icon('dong')}</button></div>
    <div class="luoi-bao-cao">${Object.entries(LOAI_BAO_CAO).map(([k, v]) =>
      `<button data-hd="gui-bc" data-loai="${k}"><span style="background:${v.mau}">${icon(v.icon)}</span>${esc(v.ten)}</button>`).join('')}</div>
    <p class="ghi-chu">${viTriRieng ? 'Báo cáo tại địa điểm đang xem' : (st.viTri ? 'Báo cáo tại vị trí hiện tại của bạn' : 'Chưa có GPS: báo cáo tại giữa bản đồ')}.
    ${dungMayChu() ? 'Báo cáo được chia sẻ với mọi người dùng.' : 'Chưa kết nối máy chủ: báo cáo chỉ lưu trên máy này.'}</p>`);
}

async function guiBc(loai, phu) {
  const kieu = LOAI_BAO_CAO[loai];
  if (kieu.phu && !phu) {
    // camera: hỏi loại camera trước khi gửi
    return hienTamPhu(`<div class="dd-dau"><div class="tieu-de-tam">${icon(kieu.icon)}Loại camera</div>
        <button class="nut-icon" data-hd="bao-cao-lai" aria-label="Quay lại">${icon('quaylai')}</button></div>
      <div class="ds-lua-chon">${Object.entries(kieu.phu).map(([k, v]) =>
        `<button class="dong-ds" data-hd="gui-bc" data-loai="${loai}" data-phu="${k}"><span class="dt-icon tron" style="background:${LOAI_CANH_BAO[v.canhBao].mau}">${icon(LOAI_CANH_BAO[v.canhBao].icon)}</span><span class="dong-ds-chu"><b>${esc(v.ten)}</b></span></button>`).join('')}</div>`);
  }
  const p = st.viTriBaoCao || (st.viTri ? st.viTri.viTri : banDo.tam());
  try {
    await guiBaoCao({ loai, phu, viTri: p, huong: st.viTriBaoCao ? null : st.viTri && st.viTri.huong });
    banDo.datBaoCao(baoCaoHienTai());
    thongBao(`Đã gửi báo cáo "${LOAI_BAO_CAO[loai].ten}". Cảm ơn bạn!`, { loai: 'tot' });
    dongTam();
  } catch (e) {
    thongBao(e.message, { loai: 'loi' });
  }
}

let popupBc = null;
function moPopupBaoCao(id, p) {
  const b = baoCaoHienTai().find(x => x.id === id);
  if (!b) return;
  const k = LOAI_BAO_CAO[b.loai];
  if (popupBc) popupBc.remove();
  popupBc = new maplibregl.Popup({ offset: 18, maxWidth: '280px', className: 'popup-bc' })
    .setLngLat(p)
    .setHTML(`<div class="pbc"><div class="pbc-dau"><span style="background:${k.mau}">${icon(k.icon)}</span><div><b>${esc(k.phu && k.phu[b.phu] ? k.phu[b.phu].ten : k.ten)}</b>
      <small>Báo cáo ${thoiGianTruoc(b.taoLuc)}${b.conTon ? ` · ${b.conTon} người xác nhận` : ''}</small></div></div>
      ${b.ghiChu ? `<p>${esc(b.ghiChu)}</p>` : ''}
      <div class="pbc-nut">${b.cuaToi ? `<button class="nut vien" data-hd="xoa-bc" data-id="${esc(id)}">Xoá báo cáo</button>`
    : `<button class="nut vien" data-hd="xac-nhan-bc" data-id="${esc(id)}" data-con="1">Vẫn còn</button><button class="nut vien" data-hd="xac-nhan-bc" data-id="${esc(id)}" data-con="0">Không còn</button>`}</div></div>`)
    .addTo(banDo.map);
}

// ================================================================== kiểu bản đồ
function kieuMongMuon() {
  if (caiDat.tuDongBanDem && caiDat.kieuBanDo === 'tieuchuan' && laBanDem(st.viTri ? st.viTri.viTri : CAU_HINH.viTriMacDinh.tam)) return 'bandem';
  return caiDat.kieuBanDo;
}

/** Bảng chọn lớp bản đồ kiểu Google Maps: loại bản đồ (ảnh xem trước) và chi tiết bản đồ (ô bật / tắt). */
function moLopBanDo() {
  const kieu = { ...CAU_HINH.kieuBanDo };
  if (caiDat.styleVietmap) kieu.vietmap = { ten: 'VietMap' };
  const chiTiet = (k, ten, ic) => `<label class="o-ct"><input type="checkbox" data-cd="${k}" data-kieu="bat"${caiDat[k] ? ' checked' : ''}>` +
    `<span class="anh-ct">${icon(ic)}</span><span>${esc(ten)}</span></label>`;
  hienTamPhu(`<div class="dd-dau"><div class="tieu-de-tam">Loại bản đồ</div>
      <button class="nut-icon" data-hd="dong-tam" aria-label="Đóng">${icon('dong')}</button></div>
    <div class="luoi-kieu">${Object.entries(kieu).map(([k, v]) =>
      `<button class="${caiDat.kieuBanDo === k ? 'chon' : ''}" data-hd="doi-kieu" data-k="${k}" aria-pressed="${caiDat.kieuBanDo === k}">` +
      `<span class="anh-kieu">${XEM_TRUOC_KIEU[k] || ''}</span>${esc(v.ten)}</button>`).join('')}</div>
    <div class="tieu-de-nho">Chi tiết bản đồ</div>
    <div class="luoi-chi-tiet">${chiTiet('hienBaoCao', 'Báo cáo giao thông', 'ketxe')}${chiTiet('hienDiemCanhBao', 'Camera, biển báo', 'cameratocdo')}
      ${chiTiet('nha3D', 'Nhà 3D', 'nha')}${chiTiet('dd3D', 'Nghiêng 3D khi dẫn đường', 'chiduong')}${chiTiet('tuDongBanDem', 'Tự chuyển ban đêm', 'dongho')}</div>`);
}

// ================================================================== trang: cài đặt
const NHOM_CAI_DAT = [
  { ten: 'Giọng nói', muc: [
    { html: () => ghiChuGiong() },
    { k: 'giongNoi', loai: 'bat', ten: 'Hướng dẫn bằng giọng nói' },
    { k: 'amLuong', loai: 'truot', ten: 'Âm lượng', min: 0.1, max: 1, buoc: 0.1 },
    { k: 'tocDoNoi', loai: 'truot', ten: 'Tốc độ đọc', min: 0.7, max: 1.5, buoc: 0.05 },
    { k: 'tenGiong', loai: 'chon', ten: 'Giọng đọc tiếng Việt', ds: () => [['', 'Tự chọn'], ...dsGiongChon()] },
    { hd: 'nghe-thu', ten: 'Nghe thử giọng đọc', icon: 'loa' }
  ] },
  { ten: 'Cảnh báo', muc: [
    { k: 'canhBaoTocDo', loai: 'bat', ten: 'Cảnh báo vượt tốc độ' },
    { k: 'nguongVuot', loai: 'chon', ten: 'Cảnh báo khi vượt quá', so: true, ds: () => [[0, '0 km/h'], [5, '5 km/h'], [10, '10 km/h'], [15, '15 km/h']] },
    { k: 'bipVuotToc', loai: 'bat', ten: 'Âm báo liên tục khi vượt tốc độ' },
    { k: 'uocTinhGioiHan', loai: 'bat', ten: 'Ước tính giới hạn khi đường chưa có biển trong dữ liệu' },
    { k: 'hieuChinhTocDo', loai: 'chon', ten: 'Hiệu chỉnh tốc độ GPS cho khớp đồng hồ xe', so: true,
      ds: () => [-5, -3, 0, 2, 3, 5, 7, 10].map(x => [x, x ? `${x > 0 ? '+' : ''}${x}%` : 'Không']) },
    { k: 'canhBaoMatGps', loai: 'bat', ten: 'Báo khi mất tín hiệu GPS' },
    { k: 'nhacDen', loai: 'bat', ten: 'Nhắc bật đèn khi trời tối, tắt đèn khi trời sáng' },
    { k: 'bongBongNoi', loai: 'bat', ten: 'Bong bóng tốc độ và cảnh báo nổi trên ứng dụng khác', chiAndroid: true },
    { k: 'kcCanhBaoCamera', loai: 'chon', ten: 'Báo trước camera', so: true, ds: () => [[300, '300 m'], [500, '500 m'], [800, '800 m'], [1000, '1 km']] }
  ] },
  { ten: 'Từng loại cảnh báo', muc: Object.entries(LOAI_CANH_BAO).map(([k, v]) => ({ muc: k, ten: v.ten, icon: v.icon, mau: v.mau })) },
  { ten: 'Dẫn đường', muc: [
    { k: 'phuongTien', loai: 'chon', ten: 'Phương tiện mặc định', ds: () => Object.entries(PHUONG_TIEN).map(([k, v]) => [k, v.ten]) },
    { k: 'tranhCaoToc', loai: 'bat', ten: 'Tránh đường cao tốc' },
    { k: 'tranhThuPhi', loai: 'bat', ten: 'Tránh trạm thu phí' },
    { k: 'giuManHinh', loai: 'bat', ten: 'Giữ màn hình luôn sáng khi dẫn đường' },
    { k: 'tuGhiHanhTrinh', loai: 'bat', ten: 'Tự động ghi lịch sử hành trình' },
    { k: 'tranhKetXe', loai: 'bat', ten: 'Dẫn đường thông minh: tránh kẹt xe, tai nạn, cấm đường theo báo cáo' },
    { k: 'loaiXeThuPhi', loai: 'chon', ten: 'Loại xe tính phí trạm thu phí', so: true, ds: () => LOAI_XE_THU_PHI },
    { hd: 'trang-du-lieu', ten: 'Dữ liệu giao thông và tự động cập nhật', icon: 'capnhat' }
  ] },
  { ten: 'Bản đồ', muc: [
    { k: 'kieuBanDo', loai: 'chon', ten: 'Kiểu bản đồ', ds: () => [...Object.entries(CAU_HINH.kieuBanDo).map(([k, v]) => [k, v.ten]), ...(caiDat.styleVietmap ? [['vietmap', 'VietMap']] : [])] },
    { k: 'tuDongBanDem', loai: 'bat', ten: 'Tự chuyển bản đồ ban đêm (theo giờ mặt trời lặn / mọc)' },
    { k: 'nha3D', loai: 'bat', ten: 'Hiện nhà 3D' },
    { k: 'hienBaoCao', loai: 'bat', ten: 'Hiện báo cáo giao thông' },
    { k: 'hienDiemCanhBao', loai: 'bat', ten: 'Hiện điểm cảnh báo (camera, biển báo…)' }
  ] },
  { ten: 'Camera hành trình', muc: [
    { k: 'doDaiDoanCamera', loai: 'chon', ten: 'Độ dài mỗi đoạn video', so: true, ds: () => [[1, '1 phút'], [3, '3 phút'], [5, '5 phút']] },
    { k: 'soDoanToiDa', loai: 'chon', ten: 'Giữ tối đa (ghi vòng)', so: true, ds: () => [[5, '5 đoạn'], [10, '10 đoạn'], [20, '20 đoạn'], [50, '50 đoạn']] },
    { k: 'camGhiAm', loai: 'bat', ten: 'Ghi âm thanh' },
    { k: 'camTuGhi', loai: 'bat', ten: 'Tự ghi khi xe chạy trên 5 km/h, tự dừng sau 20 giây đứng yên' },
    { k: 'camTuMo', loai: 'bat', ten: 'Tự mở camera (thu nhỏ) khi dẫn đường hoặc lái xe' },
    { k: 'camChatLuong', loai: 'chon', ten: 'Chất lượng video', ds: () => Object.entries(CHAT_LUONG).map(([k, v]) => [k, v.ten]) },
    { k: 'camGioiHanMB', loai: 'chon', ten: 'Dung lượng tối đa cho video', so: true,
      ds: () => [[500, '500 MB'], [1024, '1 GB'], [2048, '2 GB'], [5120, '5 GB'], [0, 'Không giới hạn']] }
  ] },
  { ten: 'Nâng cao', muc: [
    { k: 'mayChuBaoCao', loai: 'chu', ten: 'Máy chủ báo cáo', goiY: 'Để trống = máy chủ của trang này (api)' },
    { k: 'khoaVietmap', loai: 'chu', ten: 'Khoá VietMap API (tìm kiếm, chỉ đường)', goiY: 'Không bắt buộc' },
    { k: 'styleVietmap', loai: 'chu', ten: 'Đường dẫn style bản đồ VietMap', goiY: 'https://…/style.json?apikey=…' },
    { hd: 'xoa-lich-su-cd', ten: 'Xoá lịch sử tìm kiếm', icon: 'xoa' },
    { hd: 'khoi-phuc-cd', ten: 'Khôi phục cài đặt gốc', icon: 'caidat' }
  ] }
];

/** Các giọng tiếng Việt chọn được: của Android (ứng dụng) hoặc của trình duyệt. */
function dsGiongChon() {
  if (laAppAndroid) {
    const tt = trangThaiGiongGoc();
    return ((tt && tt.ds) || []).map((g, i) => {
      const ma = (/-x-([a-z]+)-/.exec(g.ten) || [])[1];
      return [g.ten, `Giọng ${i + 1}${ma ? ' (' + ma + ')' : ''}${g.canMang ? ' · cần mạng' : ''}`];
    });
  }
  return danhSachGiong().map(v => [v.name, v.name]);
}

const TEN_BO_DOC = { 'com.google.android.tts': 'Google', 'com.samsung.SMT': 'Samsung', 'com.huawei.hiai': 'Huawei' };

/** Dòng trạng thái đầu nhóm "Giọng nói": máy có giọng tiếng Việt không, đang dùng bộ đọc nào, nút cài giọng. */
function ghiChuGiong() {
  const co = coTiengViet();
  if (laAppAndroid) {
    const tt = trangThaiGiongGoc();
    if (co === null) return '<p class="ghi-chu cd-ghi-chu">Đang kiểm tra giọng đọc tiếng Việt trên máy…</p>';
    if (!co) {
      return `<div class="ghi-chu cd-ghi-chu canh">Máy chưa có giọng đọc tiếng Việt nên HawaMap tạm không đọc hướng dẫn (để không đọc bằng giọng nước ngoài).
        Cài giọng tiếng Việt cho "Dịch vụ lời nói của Google" rồi quay lại ứng dụng.
        <button class="nut chinh" data-hd="cai-giong-viet">${icon('taive')}Cài giọng tiếng Việt</button></div>`;
    }
    return `<p class="ghi-chu cd-ghi-chu">Đang đọc bằng giọng tiếng Việt của ${esc(TEN_BO_DOC[tt.may] || tt.may || 'Android')}.</p>`;
  }
  if (co === false) {
    return `<div class="ghi-chu cd-ghi-chu canh">Thiết bị chưa có giọng đọc tiếng Việt: câu dẫn đường có thể bị đọc bằng giọng nước ngoài.
      Android: Cài đặt → Hệ thống → Ngôn ngữ → Chuyển văn bản thành giọng nói → chọn "Dịch vụ lời nói của Google" → tải tiếng Việt.
      iPhone: Cài đặt → Trợ năng → Nội dung được đọc → Giọng nói → Tiếng Việt.</div>`;
  }
  return '';
}

/** Một dòng của trang Cài đặt. */
function dongCaiDat(m) {
  if (m.html) return m.html();
  if (m.muc) {
    const v = mucCanhBao(m.muc);
    return `<label class="cd-dong cd-muc"><span class="cd-ic" style="background:${m.mau}">${icon(m.icon)}</span><span>${esc(m.ten)}</span>
      <select data-muc="${m.muc}">${MUC_CANH_BAO.map(([g, t]) => `<option value="${g}"${g === v ? ' selected' : ''}>${t}</option>`).join('')}</select></label>`;
  }
  if (m.hd) return `<button class="cd-dong cd-nut" data-hd="${m.hd}">${icon(m.icon)}<span>${esc(m.ten)}</span></button>`;
  const v = caiDat[m.k];
  if (m.loai === 'bat') return `<label class="cd-dong"><span>${esc(m.ten)}</span><span class="cong-tac"><input type="checkbox" data-cd="${m.k}" data-kieu="bat"${v ? ' checked' : ''}><span></span></span></label>`;
  if (m.loai === 'chon') {
    return `<label class="cd-dong"><span>${esc(m.ten)}</span><select data-cd="${m.k}" data-kieu="${m.so ? 'so' : 'chu'}">${m.ds().map(([g, t]) =>
      `<option value="${esc(g)}"${String(g) === String(v) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  }
  if (m.loai === 'truot') return `<label class="cd-dong"><span>${esc(m.ten)}</span><input type="range" min="${m.min}" max="${m.max}" step="${m.buoc}" value="${v}" data-cd="${m.k}" data-kieu="so"></label>`;
  return `<label class="cd-dong cot"><span>${esc(m.ten)}</span><input class="o-nhap" type="text" value="${esc(v)}" placeholder="${esc(m.goiY || '')}" data-cd="${m.k}" data-kieu="chu" spellcheck="false" autocomplete="off"></label>`;
}

const noiDungNhom = n => `<h4>${esc(n.ten)}</h4>${n.muc.filter(m => !m.chiAndroid || laAppAndroid).map(dongCaiDat).join('')}`;

function trangCaiDat() {
  moTrang('Cài đặt', NHOM_CAI_DAT.map((n, i) => `<div class="nhom" data-nhom="${i}">${noiDungNhom(n)}</div>`).join(''));
}

/**
 * Trạng thái giọng đọc vừa đổi (dò xong, vừa cài / chọn giọng) mà trang Cài đặt đang mở: chỉ vẽ lại nhóm "Giọng nói".
 * Không vẽ lại cả trang và không hỏi lại Android ở đây — hỏi lại thì Android trả lời, trang lại vẽ, lại hỏi… thành vòng lặp,
 * các ô chọn bị thay mới liên tục nên không bấm chọn được.
 */
function veLaiNhomGiong() {
  const el = !$('#trang').hidden && $('#tieu-de-trang').textContent === 'Cài đặt' && $('#than-trang .nhom[data-nhom="0"]');
  if (el) el.innerHTML = noiDungNhom(NHOM_CAI_DAT[0]);
}

ngheDoiCaiDat(thay => {
  if ('kieuBanDo' in thay || 'tuDongBanDem' in thay || 'styleVietmap' in thay) {
    if ('styleVietmap' in thay && caiDat.kieuBanDo === 'vietmap') banDo.kieu = '';
    banDo.doiKieu(kieuMongMuon());
  }
  if ('nha3D' in thay) banDo.dat3D(caiDat.nha3D);
  if ('dd3D' in thay) {
    banDo.nghieng = caiDat.dd3D ? 55 : 0;
    $('#nut-3d').innerHTML = chu3D(caiDat.dd3D);
    if (st.dd) renderThanhDd(st.dd.tt);
  }
  if ('hienBaoCao' in thay) banDo.hienLop(['bao-cao'], caiDat.hienBaoCao);
  if ('hienDiemCanhBao' in thay) banDo.hienLop(['canh-bao', 'canh-bao-nho'], caiDat.hienDiemCanhBao);
  if ('mucCanhBao' in thay || 'phuongTien' in thay) veDiemCanhBao();
  if ('bongBongNoi' in thay && caiDat.bongBongNoi && laAppAndroid) guiGoc('xinQuyenNoi');
  if ('tenGiong' in thay) doiGiong();
  if ('mayChuBaoCao' in thay) kiemTraMayChu().then(taiBaoCaoKhuVuc);
  if ('giongNoi' in thay) { $('#nut-loa').innerHTML = icon(caiDat.giongNoi ? 'loa' : 'tatloa'); if (!caiDat.giongNoi) imLang(); }
  if ('phuongTien' in thay && st.lt && !st.lt.tuyen.length) st.lt.phuongTien = caiDat.phuongTien;
  // đổi chất lượng / âm thanh: mở lại camera nếu đang mở mà chưa ghi (đang ghi thì áp dụng ở lần mở sau)
  if (('camChatLuong' in thay || 'camGhiAm' in thay) && camera && camera.dangMo && !camera.dangGhi) {
    camera.dong();
    camera.mo().catch(e => thongBao('Không mở lại được camera: ' + e.message, { loai: 'loi' }));
  }
});

// ================================================================== trang: bản đồ offline
const MUC_OFFLINE = { tongquat: { ten: 'Tổng quát (đường lớn)', z: 12 }, duong: { ten: 'Đường phố (đủ tên đường)', z: 14 }, chitiet: { ten: 'Chi tiết nhất (ảnh vệ tinh rõ hơn)', z: 16 } };
const KB_MOI_O = 35 * 1024;

function hoTroOffline() {
  return !laAppGoc && typeof caches !== 'undefined' && 'serviceWorker' in navigator;
}

function tepKieuHienTai() {
  const k = layKieuBanDo(banDo.kieu);
  return tepCuaKieu(banDo.map, typeof k.style === 'string' ? k.style : null);
}

async function trangOffline() {
  if (!hoTroOffline()) {
    return moTrang('Bản đồ offline', `<p class="trong">${laAppGoc ? 'Bản đồ offline hiện dùng được trên bản web / PWA (mở HawaMap bằng Chrome hoặc Safari và cài lên màn hình chính). Ứng dụng vẫn giữ các ô bản đồ đã xem gần đây.'
      : 'Trình duyệt này không hỗ trợ lưu bản đồ offline. Hãy mở HawaMap qua HTTPS bằng Chrome, Edge hoặc Safari bản mới.'}</p>`);
  }
  const muc = st.mucOffline || 'duong';
  const t = tepKieuHienTai();
  const khung = banDo.khungHienTai();
  const soO = demOVung(t.nguon, khung, 6, MUC_OFFLINE[muc].z);
  const ds = vungDaTai();
  let boNho = '';
  try {
    const u = await navigator.storage.estimate();
    boNho = `Bộ nhớ trình duyệt đã dùng ${kichThuoc(u.usage)} / ${kichThuoc(u.quota)}.`;
  } catch (e) { /* không hỗ trợ */ }
  const tai = st.taiOffline;
  moTrang('Bản đồ offline', `<div class="nhom"><h4>Vùng đang xem trên bản đồ</h4>
      <label class="cd-dong"><span>Mức chi tiết</span><select id="muc-offline">${Object.entries(MUC_OFFLINE).map(([k, v]) =>
        `<option value="${k}"${k === muc ? ' selected' : ''}>${esc(v.ten)}</option>`).join('')}</select></label>
      <p class="ghi-chu">Kiểu bản đồ: ${esc(layKieuBanDo(banDo.kieu).ten)} · ${soO.toLocaleString('vi-VN')} ô · khoảng ${kichThuoc(soO * KB_MOI_O)}.
      ${soO > TOI_DA_O ? `<b class="chu-do">Vùng quá lớn (tối đa ${TOI_DA_O.toLocaleString('vi-VN')} ô): phóng to bản đồ hoặc chọn mức chi tiết thấp hơn.</b>` : ''}</p>
      ${tai ? `<div class="tien-do-tai"><div class="thanh"><i id="tien-do-offline" style="width:${tai.pt || 0}%"></i></div>
        <span id="chu-tien-do-offline">${esc(tai.chu || 'Đang chuẩn bị…')}</span><button class="nut vien" data-hd="huy-offline">Huỷ</button></div>`
      : `<div class="hang-nut"><button class="nut" data-hd="tai-offline"${soO > TOI_DA_O || !t.nguon.length ? ' disabled' : ''}>${icon('taive')}Tải vùng này</button></div>`}</div>
    <div class="nhom"><h4>Vùng đã tải (${ds.length})</h4>${ds.length ? ds.map(v => `<div class="dong-ds">
      <span class="dt-icon">${icon('lop')}</span>
      <button class="dong-ds-chu" data-hd="xem-vung-offline" data-id="${v.id}"><b>${esc(v.ten)}</b>
        <small>${esc(layKieuBanDo(v.kieu).ten)} · ${ngayGio(v.luc)} · ${kichThuoc(v.kichThuoc || 0)}</small></button>
      <button class="nut-icon" data-hd="cap-nhat-offline" data-id="${v.id}" aria-label="Tải lại">${icon('doicamera')}</button>
      <button class="nut-icon" data-hd="xoa-offline" data-id="${v.id}" aria-label="Xoá">${icon('xoa')}</button></div>`).join('')
    : '<p class="trong">Chưa tải vùng nào. Kéo bản đồ tới khu vực cần dùng khi mất mạng rồi bấm "Tải vùng này".</p>'}
      <label class="cd-dong"><span>Tự cập nhật khi có Wi-Fi (vùng đã tải quá 30 ngày)</span><span class="cong-tac"><input type="checkbox" data-cd="capNhatOffline" data-kieu="bat"${caiDat.capNhatOffline ? ' checked' : ''}><span></span></span></label></div>
    <p class="ghi-chu">${boNho} Khi mất mạng vẫn xem được bản đồ và vị trí của bạn ở vùng đã tải; tìm kiếm, chỉ đường, dữ liệu camera / giới hạn tốc độ cần có mạng.</p>`);
}

function capNhatTienDoOffline() {
  const tai = st.taiOffline;
  const chip = $('#chip-tai');
  chip.hidden = !tai;
  if (!tai) return;
  chip.textContent = `Bản đồ ${tai.pt || 0}%`;
  const thanh = $('#tien-do-offline');
  if (thanh) { thanh.style.width = (tai.pt || 0) + '%'; $('#chu-tien-do-offline').textContent = tai.chu; }
}

/** Tải (hoặc tải lại) một vùng. Không truyền `cu` thì tải vùng đang xem với mức chi tiết đã chọn. */
async function taiVungOffline(cu = null, { imLang = false } = {}) {
  if (st.taiOffline) return thongBao('Đang tải một vùng khác');
  const cungKieu = !cu || cu.kieu === banDo.kieu;
  const t = cungKieu ? tepKieuHienTai() : { nguon: cu.nguon, tepPhu: cu.tepPhu };
  const vung = cu ? { ...cu, ...t } : {
    id: 'vung' + Date.now(), kieu: banDo.kieu, khung: banDo.khungHienTai().map(x => +x.toFixed(5)), zTu: 6,
    zDen: MUC_OFFLINE[st.mucOffline || 'duong'].z, ten: 'Vùng đã tải', ...t
  };
  const ds = diaChiVung(vung);
  const ac = new AbortController();
  st.taiOffline = { ac, pt: 0, chu: 'Đang chuẩn bị…' };
  if (!$('#trang').hidden && $('#tieu-de-trang').textContent === 'Bản đồ offline') trangOffline();
  capNhatTienDoOffline();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* không hỗ trợ */ }
  if (!cu) {
    const tam = [(vung.khung[0] + vung.khung[2]) / 2, (vung.khung[1] + vung.khung[3]) / 2];
    diaChiTuToaDo(tam).then(d => { vung.ten = 'Quanh ' + (d.ten || d.diaChi); }).catch(() => { vung.ten = `Vùng ${tam[1].toFixed(3)}, ${tam[0].toFixed(3)}`; });
  }
  try {
    const kq = await taiDiaChi(ds, {
      tinHieu: ac.signal,
      tienDo: (xong, tong, kt) => {
        st.taiOffline.pt = Math.floor(xong / tong * 100);
        st.taiOffline.chu = `${xong.toLocaleString('vi-VN')} / ${tong.toLocaleString('vi-VN')} tệp · ${kichThuoc(kt)}`;
        capNhatTienDoOffline();
      }
    });
    Object.assign(vung, { luc: Date.now(), soO: ds.length, kichThuoc: kq.kichThuoc });
    luuVung(vung);
    if (!imLang || kq.loi) thongBao(kq.loi ? `Đã tải, ${kq.loi} tệp lỗi (thử tải lại sau)` : `Đã tải bản đồ offline (${kichThuoc(kq.kichThuoc)})`, { loai: kq.loi ? '' : 'tot' });
  } catch (e) {
    if (e.name !== 'AbortError') thongBao('Tải bản đồ lỗi: ' + e.message, { loai: 'loi' });
  } finally {
    st.taiOffline = null;
    capNhatTienDoOffline();
    if (!$('#trang').hidden && $('#tieu-de-trang').textContent === 'Bản đồ offline') trangOffline();
  }
}

/** Được tự cập nhật lúc này không: đang có mạng, và nếu chọn "chỉ Wi-Fi" thì không đang dùng dữ liệu di động. */
function duocTuCapNhat() {
  return navigator.onLine && !(caiDat.capNhatChiWifi && dangDungWifi() === false);
}

/** Mỗi lần mở ứng dụng: tải lại một vùng offline đã cũ (quá 7 ngày hoặc máy chủ bản đồ đổi phiên bản ô). */
function tuCapNhatOffline() {
  if (st.daXetOffline || !caiDat.capNhatOffline || !hoTroOffline() || !duocTuCapNhat()) return;
  st.daXetOffline = true;
  const nguonNay = tepKieuHienTai().nguon;
  const v = vungDaTai().find(x => canCapNhat(x, x.kieu === banDo.kieu ? nguonNay : [], 7));
  if (v) taiVungOffline(v, { imLang: true });
}

/**
 * Tự cập nhật dữ liệu giao thông: ô cảnh báo quá 7 ngày được tải lại, bảng phí trạm thu phí tải lại mỗi tuần.
 * Gọi lúc mở ứng dụng và mỗi 6 giờ; `ep` (bấm "Cập nhật ngay"): tải lại tất cả.
 */
async function tuCapNhatDuLieu({ ep = false } = {}) {
  if (st.dangCapNhatDl || (!ep && (!caiDat.tuCapNhatDuLieu || !duocTuCapNhat()))) return null;
  st.dangCapNhatDl = true;
  try {
    const kq = await duLieuGT.capNhatDinhKy({ tatCa: ep });
    await capNhatBangPhi({ layMayChu, ep });
    ghi('capnhatdl', Date.now());
    if (kq.soLamMoi || ep) { thongTinDuong.khoaDiem = ''; st.phienDiemVe = -1; }
    return kq;
  } finally {
    st.dangCapNhatDl = false;
  }
}

async function trangDuLieu() {
  const [tt, kieu] = [await duLieuGT.trangThai().catch(() => ({ soO: 0, soDiem: 0 })), layKieuBanDo(banDo.kieu)];
  const phi = thongTinBangPhi();
  const lan = doc('capnhatdl', 0);
  const ngayNen = banDo.ngayDuLieuNen();
  const bat = (k, ten) => `<label class="cd-dong"><span>${esc(ten)}</span><span class="cong-tac"><input type="checkbox" data-cd="${k}" data-kieu="bat"${caiDat[k] ? ' checked' : ''}><span></span></span></label>`;
  moTrang('Dữ liệu giao thông', `<div class="nhom"><h4>Dữ liệu trong máy</h4>
      <div class="cd-dong"><span>Camera, biển báo, trạm thu phí… (khu vực ~11 km)</span><b>${tt.soO} khu vực · ${(tt.soDiem || 0).toLocaleString('vi-VN')} điểm</b></div>
      <div class="cd-dong"><span>Cập nhật mới nhất</span><b>${tt.moiNhat ? ngayGio(tt.moiNhat) : 'chưa có'}</b></div>
      <div class="cd-dong"><span>Cũ nhất</span><b>${tt.cuNhat ? ngayGio(tt.cuNhat) : '—'}</b></div>
      <div class="cd-dong"><span>Bảng phí trạm thu phí</span><b>${phi.soTram ? `${phi.soTram} trạm${phi.capNhat ? ' · ' + esc(phi.capNhat) : ''}` : 'chưa có'}</b></div>
      <div class="cd-dong"><span>Lần tự kiểm tra gần nhất</span><b>${lan ? ngayGio(lan) : 'chưa có'}</b></div>
      <div class="hang-nut"><button class="nut" data-hd="cap-nhat-du-lieu"${st.dangCapNhatDl ? ' disabled' : ''}>${icon('capnhat')}${st.dangCapNhatDl ? 'Đang cập nhật…' : 'Cập nhật ngay'}</button></div></div>
    <div class="nhom"><h4>Bản đồ nền</h4>
      <div class="cd-dong"><span>Kiểu bản đồ</span><b>${esc(kieu.ten)}</b></div>
      <div class="cd-dong"><span>Dữ liệu đường, tên đường, địa điểm</span><b id="ngay-ban-do">${ngayNen ? 'OpenStreetMap ngày ' + ngayNen.toLocaleDateString('vi-VN') : 'bản mới nhất của máy chủ bản đồ'}</b></div>
      ${kieu.bienDoi === 'veTinh' ? `<div class="cd-dong"><span>Ảnh vệ tinh</span><b>${esc(CAU_HINH.anhVeTinh.ghiNguon.replace(/^©\s*/, ''))}</b></div>` : ''}
      ${kieu.bienDoi === 'diaHinh' ? `<div class="cd-dong"><span>Bóng đồi núi</span><b>${esc(CAU_HINH.bongDiaHinh.ghiNguon.replace(/^©\s*/, ''))}</b></div>` : ''}
      <div class="hang-nut"><button class="nut vien" data-hd="lam-moi-ban-do">${icon('capnhat')}Tải lại bản đồ nền mới nhất</button></div></div>
    <div class="nhom"><h4>Tự động cập nhật</h4>${bat('tuCapNhatDuLieu', 'Tự cập nhật dữ liệu giao thông mỗi tuần')}
      ${bat('capNhatChiWifi', 'Chỉ tự cập nhật khi dùng Wi-Fi')}${bat('capNhatOffline', 'Tự cập nhật vùng bản đồ offline mỗi tuần')}</div>
    <p class="ghi-chu">Nguồn: đường, biển báo, camera, trạm thu phí lấy từ OpenStreetMap (cộng đồng cập nhật hằng ngày); bản đồ nền
    (kể cả tên đường, địa danh trên bản đồ vệ tinh) do OpenFreeMap dựng lại từ OpenStreetMap mỗi tuần, ứng dụng tự theo phiên bản mới nhất,
    ô đã lưu quá 7 ngày được tải lại; tìm đường dùng dữ liệu mới nhất của máy chủ OSRM;
    báo cáo kẹt xe, tai nạn là thời gian thực. ${dungMayChu() ? 'Máy chủ HawaMap lưu sẵn dữ liệu và tự cập nhật mỗi tuần cho mọi máy.' : 'Chưa kết nối máy chủ HawaMap: dữ liệu được tải thẳng từ OpenStreetMap.'}
    Mức phí lấy từ bảng phí do đơn vị vận hành cập nhật hoặc từ OpenStreetMap; chỉ để tham khảo.</p>`);
}

/** Xoá ô bản đồ đã lưu (trừ vùng tải về để dùng offline) rồi nạp lại kiểu bản đồ: lấy dữ liệu nền mới nhất ngay. */
async function lamMoiBanDoNen() {
  if (!navigator.onLine) return thongBao('Đang mất mạng, chưa tải lại được bản đồ', { loai: 'loi' });
  try { if (window.caches) await caches.delete(KHO_BAN_DO); } catch (e) { /* trình duyệt không cho dùng bộ đệm */ }
  const xong = new Promise(ok => { banDo.map.once('idle', ok); setTimeout(ok, 10000); });
  banDo.taiLaiKieu();
  await xong;
  const ngay = banDo.ngayDuLieuNen();
  thongBao(ngay ? `Đã tải bản đồ nền mới nhất (dữ liệu ngày ${ngay.toLocaleDateString('vi-VN')})` : 'Đã tải lại bản đồ nền mới nhất', { loai: 'tot' });
  if (!$('#trang').hidden && $('#tieu-de-trang').textContent === 'Dữ liệu giao thông') trangDuLieu();
}

// ================================================================== trang: thông số xe (OBD-II)
const TRANG_THAI_OBD = { dangnoi: 'Đang kết nối bộ chuyển…', khoitao: 'Đang kết nối với xe…', ketnoi: 'Đã kết nối', ngat: 'Chưa kết nối' };

function congObd() {
  if (laAppGoc) return cauHinhGoc.nenTang === 'android' ? new CongGoc(guiGoc) : null;
  return CongBle.hoTro() ? new CongBle() : null;
}

function trangObd() {
  const o = st.obd || { trangThai: 'ngat' };
  const v = (o.xe && o.xe.giaTri) || {};
  const hoTro = o.xe && o.xe.hoTro;           // đã kết nối: chỉ hiện thông số xe có
  const o1 = (k, ten, donVi) => `<div class="o-obd"><small>${esc(ten)}</small><b id="obd-${k}">${v[k] != null ? v[k] : '—'}</b><span>${esc(donVi)}</span></div>`;
  const ketNoi = o.trangThai === 'ketnoi';
  moTrang('Thông số xe (OBD-II)', `<div class="obd-dau"><span class="cham ${o.trangThai}"></span><b>${esc(TRANG_THAI_OBD[o.trangThai])}${o.ten ? ' · ' + esc(o.ten) : ''}</b>
      ${o.trangThai === 'ngat' ? `<button class="nut" data-hd="obd-ket-noi">${icon('obd')}Kết nối ELM327</button>` : `<button class="nut vien" data-hd="obd-ngat">Ngắt</button>`}</div>
    ${o.vin ? `<p class="ghi-chu obd-vin">Số khung (VIN): <b>${esc(o.vin)}</b></p>` : ''}
    <div class="luoi-obd">${Object.entries(THONG_SO).filter(([k]) => !hoTro || hoTro.has(k)).map(([k, t]) => o1(k, t.ten, t.donVi)).join('')}${o1('ATRV', 'Điện áp ắc quy', 'V')}</div>
    <div class="nhom"><h4>Mã lỗi động cơ</h4>
      <div id="obd-loi" class="obd-loi">${o.maLoi ? (o.maLoi.length ? o.maLoi.map(m => `<span>${esc(m)}</span>`).join('') : 'Không có mã lỗi.') : 'Bấm "Đọc mã lỗi" khi đã kết nối.'}</div>
      <div class="hang-nut"><button class="nut vien" data-hd="obd-doc-loi"${ketNoi ? '' : ' disabled'}>Đọc mã lỗi</button>
      <button class="nut vien nguy" data-hd="obd-xoa-loi"${ketNoi ? '' : ' disabled'}>Xoá mã lỗi</button></div></div>
    <p class="ghi-chu">Cắm bộ chuyển ELM327 vào cổng OBD-II (thường dưới vô lăng), bật khoá điện hoặc nổ máy.
    ${laAppGoc ? 'Ghép đôi bộ chuyển Bluetooth trong Cài đặt Android trước (mã PIN thường là 1234 hoặc 0000), rồi bấm Kết nối và chọn thiết bị.'
    : 'Trên Chrome / Edge cần bộ chuyển <b>Bluetooth LE</b> (BLE); bộ chuyển Bluetooth thường dùng được trong ứng dụng HawaMap trên Android. Safari / iPhone chưa hỗ trợ Bluetooth trên web.'}
    Xoá mã lỗi cũng xoá dữ liệu tự chẩn đoán của xe; chỉ xoá sau khi đã sửa lỗi.</p>`);
}

function trangObdDangMo() { return !$('#trang').hidden && $('#tieu-de-trang').textContent === 'Thông số xe (OBD-II)'; }

async function ketNoiObd() {
  if (st.obd && st.obd.trangThai !== 'ngat') return;
  const cong = congObd();
  if (!cong) return thongBao(laAppGoc ? 'Thiết bị này chưa hỗ trợ kết nối OBD' : 'Trình duyệt chưa hỗ trợ Bluetooth: dùng Chrome / Edge hoặc ứng dụng HawaMap trên Android', { loai: 'loi', thoiGian: 5000 });
  const o = st.obd = { cong, trangThai: 'dangnoi' };
  const phien = new PhienElm(cong);
  try {
    // gọi ngay trong sự kiện bấm: Web Bluetooth chỉ cho chọn thiết bị khi người dùng vừa bấm
    const cho = cong.ketNoi(s => phien.nhan(s), () => ngatObd('Bộ chuyển OBD đã ngắt kết nối'));
    if (trangObdDangMo()) trangObd();
    o.ten = await cho;
    o.phien = phien;
    o.xe = new DocXe(phien, { baoDoi: capNhatObd });
    o.trangThai = 'khoitao';
    if (trangObdDangMo()) trangObd();
    await o.xe.khoiTao();
    o.trangThai = 'ketnoi';
    o.vin = await o.xe.docVin();
    if (trangObdDangMo()) trangObd();
    thongBao('Đã kết nối OBD-II', { loai: 'tot' });
    o.xe.batDau().catch(e => ngatObd(e.message));
  } catch (e) {
    ngatObd(e.name === 'NotFoundError' ? null : (e.message || 'Không kết nối được bộ chuyển OBD'));
  }
}

function ngatObd(loi) {
  const o = st.obd;
  if (!o || o.trangThai === 'ngat') return;
  if (o.xe) o.xe.dung();
  if (o.phien) o.phien.huy();
  try { o.cong.ngat(); } catch (e) { /* đã ngắt */ }
  o.trangThai = 'ngat';
  if (loi) thongBao(loi, { loai: 'loi', thoiGian: 5000 });
  if (trangObdDangMo()) trangObd();
}

function capNhatObd(v) {
  for (const k of [...Object.keys(THONG_SO), 'ATRV']) { const el = document.getElementById('obd-' + k); if (el && v[k] != null) el.textContent = v[k]; }
  // nước làm mát quá nóng: đọc cảnh báo (tối đa 10 phút một lần)
  if (v['0105'] >= 110 && Date.now() - (st.obd.baoNongLuc || 0) > 600000) {
    st.obd.baoNongLuc = Date.now();
    bip('canhbao');
    noi(`Cảnh báo, nhiệt độ nước làm mát ${v['0105']} độ. Hãy dừng xe kiểm tra.`, { chen: true });
  }
}

// ================================================================== trang: địa điểm đã lưu
function trangDaLuu() {
  const ds = diaDiemDaLuu();
  const dong = (dd, nhan, hdXoa, extra = '') => `<div class="dong-ds">
      <span class="dt-icon">${icon(nhan)}</span>
      <button class="dong-ds-chu" data-hd="xem-da-luu" ${extra}><b>${esc(dd.ten)}</b><small>${esc(dd.diaChi || '')}</small></button>
      <button class="nut-icon" data-hd="${hdXoa}" ${extra} aria-label="Xoá">${icon('xoa')}</button></div>`;
  const nhaCq = (loai, ten, ic) => ds[loai] ? dong(ds[loai], ic, 'xoa-nha-cq', `data-loai="${loai}"`)
    : `<button class="dong-ds trong-dong" data-hd="dat-${loai === 'nha' ? 'nha' : 'co-quan'}-tim">${icon(ic)}<span>Đặt địa chỉ ${ten}</span></button>`;
  moTrang('Địa điểm đã lưu', `<div class="nhom"><h4>Nhà riêng & cơ quan</h4>${nhaCq('nha', 'nhà riêng', 'nha')}${nhaCq('coQuan', 'cơ quan', 'coquan')}</div>
    <div class="nhom"><h4>Yêu thích (${ds.yeuThich.length})</h4>${ds.yeuThich.length ? ds.yeuThich.map((x, i) => dong(x, 'saodac', 'xoa-yeu-thich', `data-i="${i}"`)).join('')
    : '<p class="trong">Bấm "Lưu" trên một địa điểm để thêm vào đây.</p>'}</div>`);
}

// ================================================================== trang: lịch sử hành trình
function trangHanhTrinh() {
  const ds = danhSachHanhTrinh();
  const tk = tongKet();
  moTrang('Lịch sử hành trình', `<div class="tong-ket"><div><b>${tk.so}</b><small>chuyến đi</small></div>
      <div><b>${quangDuong(tk.quangDuong) || '0 km'}</b><small>tổng quãng đường</small></div><div><b>${tk.thoiGian ? thoiGian(tk.thoiGian) : '0 phút'}</b><small>tổng thời gian</small></div></div>
    ${ds.length ? ds.map(h => `<button class="dong-ds" data-hd="xem-hanh-trinh" data-id="${h.id}">
      <span class="dt-icon">${icon('tongquan')}</span>
      <span class="dong-ds-chu"><b>${esc(h.ten)}</b><small>${ngayGio(h.batDau)} · ${quangDuong(h.quangDuong)} · ${thoiGian(h.thoiGian)}</small></span></button>`).join('')
    : '<p class="trong">Chưa có hành trình nào. Hành trình được ghi tự động khi bạn dẫn đường hoặc bật chế độ lái xe.</p>'}`);
}

function xemHanhTrinh(id) {
  const h = danhSachHanhTrinh().find(x => x.id === id);
  if (!h) return;
  dongTrang();
  veChinh();
  banDo.datHanhTrinh(h.toaDo);
  banDo.datGhim(h.toaDo[h.toaDo.length - 1]);
  st.hanhTrinhXem = h;
  hienTamPhu(`<div class="dd-dau"><div class="dd-ten"><h2>${esc(h.ten)}</h2><p>${ngayGio(h.batDau)} → ${ngayGio(h.ketThuc).slice(-5)}</p></div>
      <button class="nut-icon" data-hd="dong-hanh-trinh" aria-label="Đóng">${icon('dong')}</button></div>
    <div class="tong-ket"><div><b>${quangDuong(h.quangDuong)}</b><small>quãng đường</small></div><div><b>${thoiGian(h.thoiGian)}</b><small>thời gian</small></div>
      <div><b>${h.tocDoTB}</b><small>km/h trung bình</small></div><div><b>${h.tocDoMax}</b><small>km/h cao nhất</small></div></div>
    ${h.tgDung != null ? `<div class="tong-ket phu"><div><b>${thoiGian(h.tgDung)}</b><small>dừng / chờ</small></div>
      <div><b class="${h.soLanVuot ? 'chu-do' : ''}">${h.soLanVuot || 0}</b><small>lần vượt tốc độ</small></div>
      <div><b>${thoiGian(h.tgVuot || 0)}</b><small>thời gian vượt</small></div></div>` : ''}
    ${svgBieuDoTocDo(h.bieuDo)}
    <div class="hang-nut"><button class="nut vien" data-hd="gpx-hanh-trinh">${icon('taive')}Xuất GPX</button>
      <button class="nut vien nguy" data-hd="xoa-hanh-trinh">${icon('xoa')}Xoá</button></div>`);
  setTimeout(() => banDo.vuaKhung(h.toaDo), 50);
}

// ================================================================== trang: báo cáo của tôi
function trangBaoCaoCuaToi() {
  const ds = baoCaoCuaToi();
  moTrang('Báo cáo của tôi', ds.length ? ds.map(b => {
    const k = LOAI_BAO_CAO[b.loai] || {};
    return `<div class="dong-ds"><span class="dt-icon tron" style="background:${k.mau}">${icon(k.icon)}</span>
      <button class="dong-ds-chu" data-hd="xem-bc-cua-toi" data-id="${esc(b.id)}"><b>${esc(k.ten)}</b><small>${ngayGio(b.taoLuc)} · ${b.mayChu ? 'đã chia sẻ' : 'trên máy này'}</small></button>
      <button class="nut-icon" data-hd="xoa-bc-cua-toi" data-id="${esc(b.id)}" aria-label="Xoá">${icon('xoa')}</button></div>`;
  }).join('') : '<p class="trong">Bạn chưa gửi báo cáo nào. Bấm nút loa trên bản đồ để báo kẹt xe, tai nạn, CSGT, ngập nước…</p>');
}

// ================================================================== trang: hướng dẫn & giới thiệu
function trangHuongDan() {
  moTrang('Hướng dẫn sử dụng', `<div class="van-ban">
    <h4>Tìm địa điểm</h4><p>Bấm ô tìm kiếm, gõ tên địa điểm / địa chỉ (hoặc bấm micro để nói). Bấm các nút nhanh như <b>Cây xăng</b>, <b>ATM</b> để tìm quanh đây.
    <b>Nhấn giữ</b> trên bản đồ (chuột phải trên máy tính) để chọn một vị trí bất kỳ.</p>
    <h4>Chỉ đường</h4><p>Chọn địa điểm → <b>Chỉ đường</b>. Chọn phương tiện ô tô / xe máy / đi bộ / xe đạp (xe máy tự tránh đường cao tốc).
    Bấm vào tuyến màu xám hoặc nhãn thời gian để chọn tuyến khác. Bấm ô điểm đi / điểm đến để đổi, nút ＋ để thêm điểm dừng.</p>
    <h4>Dẫn đường</h4><p>Bấm <b>Bắt đầu</b>. Ứng dụng đọc hướng dẫn rẽ bằng tiếng Việt, hiện làn đường nên đi, tự tính lại khi đi sai đường.
    Bấm thanh phía dưới để xem tổng quan, các bước, tìm cây xăng dọc đường. <b>Chạy thử</b> để xem trước lộ trình mà không cần di chuyển.</p>
    <h4>Cảnh báo</h4><p>Khi đang đi (kể cả không dẫn đường), góc trái hiện tốc độ của bạn và biển giới hạn tốc độ của con đường.
    Vượt tốc độ: đồng hồ chuyển đỏ và có âm báo; đang vượt tốc độ mà sắp tới camera thì có lời nhắc giảm tốc ngay.
    Đi vào đường cấm xe của bạn (kể cả cấm theo giờ) hoặc đi ngược chiều đường một chiều: cảnh báo đỏ và giọng nói.
    Trong đoạn cấm vượt có biển cấm vượt ở góc màn hình (đọc "Bắt đầu / Hết đoạn cấm vượt"); đường cấm dừng, đỗ được nhắc khi bạn chậm lại để dừng.
    Ứng dụng báo trước camera phạt nguội (phạt tốc độ, đèn đỏ, đo tốc độ trung bình, giám sát), giới hạn tốc độ thay đổi,
    khúc cua, biển cấm rẽ, đường sắt giao cắt, trường học, gờ giảm tốc, hầm, trạm thu phí, trạm dừng nghỉ và các báo cáo kẹt xe, tai nạn, CSGT…
    Trong <b>Cài đặt → Từng loại cảnh báo</b> chọn cho mỗi loại: tắt, chỉ hiển thị, hoặc hiển thị kèm giọng nói (đèn tín hiệu và vạch qua đường mặc định tắt).
    Biển giới hạn có viền nét đứt là giới hạn <i>ước tính</i> theo loại đường (Thông tư 38/2024/TT-BGTVT) khi dữ liệu chưa có biển báo — luôn tuân theo biển báo thực tế.</p>
    <h4>Dẫn đường thông minh</h4><p>Khi tìm đường, tuyến có kẹt xe, tai nạn, ngập, cấm đường do người dùng báo cáo được tính thêm thời gian chậm trễ;
    tuyến tránh được sẽ lên đầu (nhãn <b>Tránh kẹt xe</b>). Đang dẫn đường mà có báo cáo mới phía trước, ứng dụng tìm đường khác và hỏi bạn có <b>Đổi đường</b> không.
    Thẻ tuyến ô tô hiện <b>phí dự kiến</b> các trạm thu phí (chọn loại xe trong Cài đặt → Dẫn đường).</p>
    <h4>Cập nhật dữ liệu</h4><p>Dữ liệu camera, biển báo, trạm thu phí, bảng phí và vùng bản đồ offline tự cập nhật mỗi tuần (mặc định chỉ khi dùng Wi-Fi).
    Menu → <b>Cập nhật dữ liệu</b> để xem ngày cập nhật hoặc cập nhật ngay.</p>
    <h4>Chế độ lái xe</h4><p>Menu → <b>Chế độ lái xe</b>: bản đồ xoay theo hướng đi, chỉ hiện tốc độ, giới hạn và cảnh báo, không cần lộ trình.</p>
    <h4>HUD kính lái</h4><p>Menu → <b>HUD kính lái</b>, đặt điện thoại nằm ngửa dưới kính chắn gió: chữ được lật gương để đọc được trên kính.
    Chạm màn hình để đổi kiểu lật hoặc thoát. Nên dùng ban đêm, độ sáng màn hình cao nhất.</p>
    <h4>Bản đồ offline</h4><p>Menu → <b>Bản đồ offline</b>: kéo bản đồ tới vùng cần dùng khi mất mạng, chọn mức chi tiết rồi bấm <b>Tải vùng này</b>.</p>
    <h4>Mở liên kết Google Maps</h4><p>Dán liên kết Google Maps vào ô tìm kiếm, hoặc trong Google Maps bấm <b>Chia sẻ</b> → HawaMap (ứng dụng Android / PWA đã cài).</p>
    <h4>Thông số xe (OBD-II)</h4><p>Cắm bộ chuyển ELM327 Bluetooth vào cổng OBD-II, bật khoá điện, rồi Menu → <b>Thông số xe</b> → Kết nối:
    xem vòng tua, nhiệt độ nước, điện áp…, đọc và xoá mã lỗi động cơ.</p>
    <h4>Báo cáo giao thông</h4><p>Bấm nút loa đỏ để báo kẹt xe, tai nạn, CSGT, camera, ngập nước, công trình… tại vị trí của bạn.
    Bấm vào biểu tượng báo cáo trên bản đồ để xác nhận "Vẫn còn" hoặc "Không còn".</p>
    <h4>Camera hành trình</h4><p>Dùng camera sau của điện thoại (hoặc webcam USB: nút đổi camera) để quay video, có in giờ, tốc độ, toạ độ lên hình.
    Khi camera đang mở, video tự ghi lúc xe chạy và tự dừng sau 20 giây đứng yên. Video ghi thành từng đoạn, tự xoá đoạn cũ khi vượt số đoạn hoặc dung lượng đặt trong Cài đặt;
    bấm <b>khoá</b> để giữ lại đoạn quan trọng, nút máy ảnh để chụp ảnh. Xem / tải video trong danh sách đoạn.</p>
    <h4>Cài lên điện thoại</h4><p>Mở trang bằng Chrome (Android) hoặc Safari (iPhone) → menu → <b>Thêm vào màn hình chính</b>. Cần mở qua HTTPS để dùng GPS.</p></div>`);
}

function trangGioiThieu() {
  moTrang('Giới thiệu', `<div class="gioi-thieu"><img src="icons/icon.svg" alt=""><h3>${CAU_HINH.tenUngDung}</h3><p>Bản đồ dẫn đường · phiên bản ${CAU_HINH.phienBan}</p></div>
    <div class="van-ban"><h4>Nguồn dữ liệu</h4><p>Dữ liệu bản đồ © những người đóng góp <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> (ODbL).
    Nền bản đồ: OpenFreeMap, CARTO, Esri (vệ tinh). Chỉ đường: OSRM. Tìm kiếm: Photon, Nominatim. Dữ liệu đường, camera: Overpass API.
    Thư viện bản đồ: MapLibre GL JS (BSD-3-Clause). Có thể dùng thêm VietMap Maps API khi nhập khoá trong Cài đặt.</p>
    <h4>Lưu ý</h4><p>Ứng dụng độc lập, không liên kết với VietMap hay cơ quan nhà nước. Thông tin giới hạn tốc độ, camera chỉ mang tính tham khảo —
    luôn tuân theo biển báo và hướng dẫn của người điều khiển giao thông.</p>
    <p class="mo">Máy chủ báo cáo: ${dungMayChu() ? 'đã kết nối' : 'chưa kết nối (báo cáo lưu trên máy)'}.</p></div>`);
}

// ================================================================== camera hành trình
function layHudCamera() {
  return { tocDo: st.cbCuoi ? st.cbCuoi.kmh : st.viTri ? tocDoKmh(st.viTri.tocDo) : null, viTri: st.viTri && st.viTri.viTri, tenDuong: st.cbCuoi && st.cbCuoi.duong ? st.cbCuoi.duong.ten : '' };
}

/** Camera đang mở (kể cả đang thu nhỏ) thì tự ghi khi xe chạy, tự dừng khi xe đứng yên lâu. */
function xetTuGhi(kmh) {
  if (!caiDat.camTuGhi || !camera || !camera.dangMo) return;
  const viec = tuGhi.xet(kmh, { dangGhi: camera.dangGhi, tuBat: camera.tuBat });
  if (viec === 'batdau') { camera.batDauGhi(); camera.tuBat = true; thongBao('Camera hành trình: tự ghi khi xe chạy'); }
  else if (viec === 'dung') { camera.dungGhi(); thongBao('Camera hành trình: đã dừng ghi (xe đứng yên 20 giây)'); }
}

/** Tự mở camera (thu nhỏ, không che bản đồ) khi bắt đầu dẫn đường / lái xe nếu đã bật trong cài đặt. */
function tuMoCamera() {
  if (caiDat.camTuMo && hoTroCamera() && !(camera && camera.dangMo)) moCamera({ an: true });
}

async function moCamera({ an = false } = {}) {
  if (!hoTroCamera()) return thongBao('Trình duyệt không hỗ trợ camera hành trình', { loai: 'loi' });
  if (!an) $('#man-camera').hidden = false;
  if (!camera) camera = new CameraHanhTrinh({ canvas: $('#canvas-camera'), video: $('#video-camera'), layHud: layHudCamera, baoDoi: capNhatCameraUi });
  try {
    await camera.mo();
  } catch (e) {
    $('#man-camera').hidden = true;
    return thongBao('Không mở được camera: ' + (e.name === 'NotAllowedError' ? 'bạn chưa cho phép dùng camera' : e.message), { loai: 'loi', thoiGian: 5000 });
  }
  capNhatCameraUi();
}

function capNhatCameraUi() {
  const ghi = !!(camera && camera.dangGhi);
  $('#nut-ghi').classList.toggle('dang-ghi', ghi);
  $('#nut-ghi').setAttribute('aria-label', ghi ? 'Dừng ghi' : 'Bắt đầu ghi');
  $('#trang-thai-camera').textContent = ghi ? 'Đang ghi' : 'Sẵn sàng';
  $('#chip-rec').hidden = !(ghi && $('#man-camera').hidden);
}

async function trangDoanCamera() {
  let ds = [];
  try { ds = await danhSachDoan(); } catch (e) { /* IndexedDB lỗi */ }
  let tong = 0;
  ds.forEach(d => { tong += d.kichThuoc; });
  const soVideo = ds.filter(d => !d.anh).length, soAnh = ds.length - soVideo;
  const gioiHan = caiDat.camGioiHanMB ? ` hoặc ${kichThuoc(caiDat.camGioiHanMB * 1024 * 1024)}` : '';
  moTrang('Video camera hành trình', `<p class="ghi-chu">${soVideo} đoạn video${soAnh ? `, ${soAnh} ảnh` : ''} · ${kichThuoc(tong)}.
    Đoạn chưa khoá sẽ tự xoá khi vượt ${caiDat.soDoanToiDa} đoạn${gioiHan}.</p>` +
    (ds.length ? ds.map(d => `<div class="dong-ds">
      <span class="dt-icon">${icon(d.anh ? 'mayanh' : d.khoa ? 'khoa' : 'camera')}</span>
      <span class="dong-ds-chu"><b>${ngayGio(d.batDau)}</b><small>${d.anh ? 'Ảnh' : thoiGian((d.ketThuc - d.batDau) / 1000)} · ${kichThuoc(d.kichThuoc)}${d.khoa && !d.anh ? ' · đã khoá' : ''}</small></span>
      <button class="nut-icon" data-hd="xem-doan" data-id="${d.id}" aria-label="Xem">${icon(d.anh ? 'timkiem' : 'phat')}</button>
      <button class="nut-icon" data-hd="tai-doan" data-id="${d.id}" aria-label="Tải về">${icon('taive')}</button>
      ${d.anh ? '' : `<button class="nut-icon" data-hd="khoa-doan-ds" data-id="${d.id}" aria-label="${d.khoa ? 'Mở khoá' : 'Khoá'}">${icon(d.khoa ? 'mokhoa' : 'khoa')}</button>`}
      <button class="nut-icon" data-hd="xoa-doan" data-id="${d.id}" aria-label="Xoá">${icon('xoa')}</button></div>`).join('')
      : '<p class="trong">Chưa có đoạn video nào.</p>'));
}

// ================================================================== menu
function moMenu(mo) {
  $('#menu').hidden = !mo;
  $('#man-che').hidden = !mo;
  $('#menu').classList.toggle('mo', mo);
}

// ================================================================== xử lý bấm nút (uỷ quyền sự kiện)
const HD = {
  // chung
  'menu': () => moMenu(true),
  'dong-menu': () => moMenu(false),
  'dong-tam': () => dongTam(),
  'dong-trang': () => dongTrang(),
  // tìm kiếm
  'mo-tim': () => moTimKiem('xem'),
  'dong-tim': () => dongTimKiem(),
  'xoa-o-tim': () => { $('#o-tim').value = ''; $('#nut-xoa-tim').hidden = true; renderTimRong(); $('#o-tim').focus(); },
  'noi-tim': () => noiTim(),
  'tim-day-du': () => timDayDuNgay(),
  'chon-kq': el => chonKetQua(st.ketQuaTim[+el.dataset.i]),
  'chon-lich-su': el => chonKetQua(lichSuTim()[+el.dataset.i]),
  'chon-yeu-thich': el => chonKetQua(diaDiemDaLuu().yeuThich[+el.dataset.i]),
  'xoa-lich-su': () => { xoaLichSu(); renderTimRong(); },
  'chon-vi-tri-toi': () => {
    const md = st.mucDichTim;
    dongTimKiem();
    if (md.startsWith('diem:')) st.lt.diem[+md.slice(5)] = { toi: true };
    renderKhungLt();
    tinhLoTrinh();
  },
  'chon-tren-ban-do': () => batChonTrenBanDo(st.mucDichTim),
  'huy-chon-bd': () => tatChonTrenBanDo(),
  'xac-nhan-chon-bd': () => xacNhanChonTrenBanDo(),
  'chon-nha': () => chonNhaCoQuan('nha'),
  'chon-co-quan': () => chonNhaCoQuan('coQuan'),
  'danh-muc': el => timDanhMuc(el.dataset.id),
  'dong-danh-muc': () => veChinh(),
  'chon-dm': el => chonDiaDiem(st.danhMuc.ds[+el.dataset.i], { giuDanhMuc: true }),
  // địa điểm
  'chi-duong-den': () => moLoTrinh(st.diaDiem),
  'bat-dau-ngay': () => { moKhoaAmThanh(); moLoTrinh(st.diaDiem, { batDauNgay: true }); },
  'luu-dd': () => { const yt = doiYeuThich(st.diaDiem); thongBao(yt ? 'Đã lưu vào Yêu thích' : 'Đã bỏ khỏi Yêu thích'); renderDiaDiem(); },
  'chia-se-dd': () => chiaSe(st.diaDiem),
  'dat-nha': () => { luuNhaCoQuan('nha', st.diaDiem); thongBao('Đã đặt làm nhà riêng'); },
  'dat-co-quan': () => { luuNhaCoQuan('coQuan', st.diaDiem); thongBao('Đã đặt làm cơ quan'); },
  'bao-cao-tai-day': () => moBaoCao(st.diaDiem.viTri),
  // nút nổi
  'vi-tri': () => bamViTri(),
  'la-ban': () => { banDo.datLaiHuongBac(); capNhatNutViTri(); },
  'lop-ban-do': () => moLopBanDo(),
  'doi-kieu': el => { doiCaiDat({ kieuBanDo: el.dataset.k }); moLopBanDo(); },
  'bao-cao': () => { moKhoaAmThanh(); moBaoCao(); },
  'bao-cao-lai': () => moBaoCao(st.viTriBaoCao),
  'gui-bc': el => guiBc(el.dataset.loai, el.dataset.phu),
  'xac-nhan-bc': async el => {
    try {
      const kq = await xacNhan(el.dataset.id, el.dataset.con === '1');
      thongBao(kq ? 'Cảm ơn bạn đã xác nhận!' : 'Đã gỡ báo cáo khỏi bản đồ', { loai: 'tot' });
      banDo.datBaoCao(baoCaoHienTai());
      if (popupBc) popupBc.remove();
    } catch (e) { thongBao(e.message, { loai: 'loi' }); }
  },
  'xoa-bc': async el => {
    try { await xoaBaoCao(el.dataset.id); banDo.datBaoCao(baoCaoHienTai()); if (popupBc) popupBc.remove(); thongBao('Đã xoá báo cáo'); } catch (e) { thongBao(e.message, { loai: 'loi' }); }
  },
  'chi-duong-nhanh': () => moTimKiem('chi-duong'),
  // lộ trình
  'dong-lt': () => dongLoTrinh(),
  'sua-diem': el => moTimKiem('diem:' + el.dataset.i),
  'bo-diem': el => { st.lt.diem.splice(+el.dataset.i, 1); renderKhungLt(); tinhLoTrinh(); },
  'dao-diem': () => { st.lt.diem.reverse(); renderKhungLt(); tinhLoTrinh(); },
  'them-diem-dung': () => { if (st.lt.diem.length < 5) moTimKiem('them-dung'); },
  'doi-xe': el => { st.lt.phuongTien = el.dataset.xe; renderKhungLt(); tinhLoTrinh(); },
  'chon-tuyen': el => chonTuyen(+el.dataset.i),
  'tinh-lai-lt': () => tinhLoTrinh(),
  'bat-dau': () => batDauDanDuong(),
  'mo-phong': () => batDauDanDuong({ moPhong: true }),
  'xem-buoc': () => renderBuoc(st.lt.tuyen[st.lt.chon]),
  // dẫn đường
  'ket-thuc-dd': async () => { if (await hoiXacNhan('Kết thúc dẫn đường?', { chuCo: 'Kết thúc', nguy: true })) ketThucDanDuong(); },
  'mo-rong-dd': () => { st.ddMoRong = !st.ddMoRong; renderThanhDd(st.dd && st.dd.tt); },
  'tong-quan': () => {
    if (!st.dd) return;
    banDo.vuaKhung(catTuyen(st.dd.tuyen.toaDo, st.dd.tuyen.tichLuy, st.dd.tt ? st.dd.tt.s : 0, Infinity).concat(st.viTri ? [st.viTri.viTri] : []));
    capNhatNutViTri();
  },
  've-giua': () => { banDo.datTheoDoi('huong'); capNhatNutViTri(); },
  'doi-3d': () => { doiCaiDat({ dd3D: !caiDat.dd3D }); thongBao(caiDat.dd3D ? 'Bản đồ 3D' : 'Bản đồ 2D'); },
  'doi-loa': () => { doiCaiDat({ giongNoi: !caiDat.giongNoi }); thongBao(caiDat.giongNoi ? 'Đã bật giọng nói' : 'Đã tắt giọng nói'); if (st.dd) renderThanhDd(st.dd.tt); },
  'xem-buoc-dd': () => { if (st.dd) renderBuoc(st.dd.tuyen, st.dd.tt ? st.dd.tt.buocHienTai + 1 : 1); },
  'xang-doc-duong': () => timDanhMuc('xang', { docTuyen: true }),
  'tim-doc-duong': () => hienTamPhu(`<div class="dd-dau"><div class="tieu-de-tam">${icon('timkiem')}Tìm dọc đường đi</div>
      <button class="nut-icon" data-hd="dong-tam" aria-label="Đóng">${icon('dong')}</button></div>
    <div class="hang-chip trong-tam">${DANH_MUC.slice(0, 8).map(d =>
      `<button class="chip" data-hd="danh-muc-doc-duong" data-id="${d.id}"><span style="color:${d.mau}">${icon(d.icon)}</span>${esc(d.ten)}</button>`).join('')}</div>`),
  'danh-muc-doc-duong': el => timDanhMuc(el.dataset.id, { docTuyen: true }),
  'them-dung-dd': el => themDiemDungDd(st.danhMuc.ds[+el.dataset.i]),
  'mp-dung': () => { st.moPhong.tamDung = !st.moPhong.tamDung; renderDkMoPhong(); },
  'mp-he-so': el => { st.moPhong.heSo = +el.dataset.h; renderDkMoPhong(); },
  'mp-toc': el => { st.moPhong.congThem = Math.max(-40, Math.min(60, st.moPhong.congThem + +el.dataset.d)); renderDkMoPhong(); },
  // lái xe
  'che-do-lai-xe': () => { moMenu(false); batLaiXe(!st.laiXe); },
  'mo-hud': () => { moMenu(false); batHud(true); },
  'trang-offline': () => { moMenu(false); trangOffline(); },
  'trang-du-lieu': () => { moMenu(false); trangDuLieu(); },
  'lam-moi-ban-do': () => lamMoiBanDoNen(),
  'cap-nhat-du-lieu': async () => {
    if (!navigator.onLine) return thongBao('Đang mất mạng, chưa cập nhật được', { loai: 'loi' });
    const cho = tuCapNhatDuLieu({ ep: true });
    trangDuLieu();
    try {
      const kq = await cho;
      if (kq) thongBao(kq.soLoi ? `Đã cập nhật ${kq.soLamMoi} khu vực, ${kq.soLoi} khu vực lỗi (thử lại sau)` : `Đã cập nhật dữ liệu giao thông (${kq.soLamMoi} khu vực)`, { loai: kq.soLoi ? '' : 'tot' });
    } catch (e) {
      thongBao('Cập nhật lỗi: ' + e.message, { loai: 'loi' });
    }
    if (!$('#trang').hidden && $('#tieu-de-trang').textContent === 'Dữ liệu giao thông') trangDuLieu();
  },
  'doi-tuyen-goi-y': () => {
    const g = st.goiYTuyen;
    boGoiYTuyen();
    if (g && st.dd) { datTuyenDanDuong(g.tuyen); noi('Đã đổi sang đường khác.', { chen: true }); }
  },
  'bo-goi-y': () => boGoiYTuyen(),
  'trang-obd': () => { moMenu(false); trangObd(); },
  'obd-ket-noi': () => ketNoiObd(),
  'obd-ngat': () => ngatObd(null),
  'obd-doc-loi': async () => {
    try { st.obd.maLoi = await st.obd.xe.docLoi(); trangObd(); } catch (e) { thongBao(e.message, { loai: 'loi' }); }
  },
  'obd-xoa-loi': async () => {
    if (!await hoiXacNhan('Xoá mã lỗi động cơ? Đèn báo lỗi sẽ tắt cho tới khi xe phát hiện lại lỗi.', { chuCo: 'Xoá', nguy: true })) return;
    try { await st.obd.xe.xoaLoi(); st.obd.maLoi = []; thongBao('Đã xoá mã lỗi', { loai: 'tot' }); trangObd(); } catch (e) { thongBao(e.message, { loai: 'loi' }); }
  },
  'tai-offline': () => taiVungOffline(),
  'huy-offline': () => { if (st.taiOffline) st.taiOffline.ac.abort(); },
  'cap-nhat-offline': el => { const v = vungDaTai().find(x => x.id === el.dataset.id); if (v) taiVungOffline(v); },
  'xoa-offline': async el => {
    if (!await hoiXacNhan('Xoá vùng bản đồ offline này?', { chuCo: 'Xoá', nguy: true })) return;
    await xoaVung(el.dataset.id);
    trangOffline();
  },
  'xem-vung-offline': el => {
    const v = vungDaTai().find(x => x.id === el.dataset.id);
    if (!v) return;
    dongTrang();
    banDo.datTheoDoi('khong');
    banDo.vuaKhung([[v.khung[0], v.khung[1]], [v.khung[2], v.khung[3]]]);
  },
  'thoat-hud': (el, e) => { e.stopPropagation(); batHud(false); },
  'hud-cham': () => hienNutHud(),
  'hud-lat': (el, e) => {
    e.stopPropagation();
    const ds = Object.keys(KIEU_LAT_HUD);
    doiCaiDat({ latHud: ds[(ds.indexOf(caiDat.latHud) + 1) % ds.length] });
    datKieuLatHud();
    hienNutHud();
  },
  'thoat-lai-xe': () => batLaiXe(false),
  // trang
  'trang-cai-dat': () => {
    moMenu(false);
    trangCaiDat();
    if (laAppAndroid) guiGoc('hoiGiong');          // hỏi một lần khi mở trang (vừa cài giọng thì có danh sách mới)
  },
  'trang-da-luu': () => { moMenu(false); trangDaLuu(); },
  'trang-hanh-trinh': () => { moMenu(false); trangHanhTrinh(); },
  'trang-bao-cao': () => { moMenu(false); trangBaoCaoCuaToi(); },
  'trang-huong-dan': () => { moMenu(false); trangHuongDan(); },
  'trang-gioi-thieu': () => { moMenu(false); trangGioiThieu(); },
  'nghe-thu': () => {
    moKhoaAmThanh();
    if (laAppAndroid && coTiengViet() === false) return thongBao('Máy chưa có giọng đọc tiếng Việt: bấm "Cài giọng tiếng Việt" ở trên');
    noi('Sau 300 mét, rẽ phải vào Trần Phú (QL6). Phía trước có camera phạt tốc độ, tốc độ tối đa 50 km/h.', { chen: true, batBuoc: true });
  },
  'cai-giong-viet': () => guiGoc('caiGiongViet'),
  'xoa-lich-su-cd': () => { xoaLichSu(); thongBao('Đã xoá lịch sử tìm kiếm'); },
  'khoi-phuc-cd': async () => { if (await hoiXacNhan('Đưa mọi cài đặt về mặc định?')) { khoiPhucCaiDat(); trangCaiDat(); thongBao('Đã khôi phục cài đặt gốc'); } },
  'xem-da-luu': el => {
    const ds = diaDiemDaLuu();
    const dd = el.dataset.loai ? ds[el.dataset.loai] : ds.yeuThich[+el.dataset.i];
    dongTrang();
    if (dd) chonDiaDiem(dd);
  },
  'xoa-nha-cq': el => { luuNhaCoQuan(el.dataset.loai, null); trangDaLuu(); },
  'xoa-yeu-thich': el => { boYeuThich(+el.dataset.i); trangDaLuu(); },
  'dat-nha-tim': () => { dongTrang(); moTimKiem('nha'); },
  'dat-co-quan-tim': () => { dongTrang(); moTimKiem('coquan'); },
  'xem-hanh-trinh': el => xemHanhTrinh(el.dataset.id),
  'dong-hanh-trinh': () => { st.hanhTrinhXem = null; banDo.datHanhTrinh(null); banDo.datGhim(null); st.tamPhu = false; tam.an(); },
  'gpx-hanh-trinh': () => { const h = st.hanhTrinhXem; if (h) taiXuong(`hanh-trinh-${h.id}.gpx`, xuatGpx(h), 'application/gpx+xml'); },
  'xoa-hanh-trinh': async () => {
    const h = st.hanhTrinhXem;
    if (h && await hoiXacNhan('Xoá hành trình này?', { chuCo: 'Xoá', nguy: true })) { xoaHanhTrinh(h.id); HD['dong-hanh-trinh'](); thongBao('Đã xoá hành trình'); }
  },
  'xem-bc-cua-toi': el => {
    const b = baoCaoCuaToi().find(x => x.id === el.dataset.id);
    if (b) { dongTrang(); veChinh(); banDo.bayDen([b.lng, b.lat], 16); }
  },
  'xoa-bc-cua-toi': async el => {
    try { await xoaBaoCao(el.dataset.id); banDo.datBaoCao(baoCaoHienTai()); trangBaoCaoCuaToi(); } catch (e) { thongBao(e.message, { loai: 'loi' }); }
  },
  // camera hành trình
  'mo-camera': () => { moMenu(false); moCamera(); },
  'thu-camera': () => { $('#man-camera').hidden = true; capNhatCameraUi(); },
  'tat-camera': () => { if (camera) camera.dong(); $('#man-camera').hidden = true; capNhatCameraUi(); },
  'doi-ghi': () => {
    if (!camera) return;
    if (camera.dangGhi) {
      // tự dừng khi xe đang chạy: không tự ghi lại cho tới khi xe dừng hẳn
      if (st.cbCuoi && st.cbCuoi.kmh > 5) tuGhi.boQua = true;
      camera.dungGhi();
    } else camera.batDauGhi();
  },
  'chup-anh': async () => {
    if (!camera || !camera.dangMo) return;
    try { await camera.chupAnh(); thongBao('Đã chụp ảnh (xem trong danh sách video)', { loai: 'tot' }); } catch (e) { thongBao(e.message, { loai: 'loi' }); }
  },
  'doi-camera': async () => {
    if (!camera) return;
    try { thongBao('Đang dùng: ' + await camera.doiCamera(doiCaiDat)); } catch (e) { thongBao(e.message, { loai: 'loi' }); }
  },
  'khoa-doan': () => { if (camera && camera.dangGhi) { camera.khoaDoanHienTai(); thongBao('Đoạn video đang ghi sẽ được giữ lại'); } else thongBao('Chưa ghi hình'); },
  'ds-doan': () => trangDoanCamera(),
  'xem-doan': async el => {
    const d = await layDoan(el.dataset.id);
    if (!d) return;
    const url = URL.createObjectURL(d.blob);
    await hopThoai({ tieuDe: ngayGio(d.batDau), noiDung: d.anh ? `<img class="video-xem" src="${url}" alt="Ảnh chụp camera hành trình">`
      : `<video class="video-xem" src="${url}" controls autoplay playsinline></video>` });
    URL.revokeObjectURL(url);
  },
  'tai-doan': async el => {
    const d = await layDoan(el.dataset.id);
    if (d) taiXuong(`camera-${new Date(d.batDau).toISOString().replace(/[:.]/g, '-')}.${d.anh ? 'jpg' : /mp4/.test(d.kieu) ? 'mp4' : 'webm'}`, d.blob);
  },
  'khoa-doan-ds': async el => { await doiKhoaDoan(el.dataset.id); trangDoanCamera(); },
  'xoa-doan': async el => { if (await hoiXacNhan(el.dataset.id.startsWith('a') ? 'Xoá ảnh này?' : 'Xoá đoạn video này?', { chuCo: 'Xoá', nguy: true })) { await xoaDoan(el.dataset.id); trangDoanCamera(); } }
};

function chonNhaCoQuan(loai) {
  const dd = diaDiemDaLuu()[loai];
  const md = st.mucDichTim;
  if (!dd) { moTimKiem(loai === 'nha' ? 'nha' : 'coquan'); return; }
  if (md === 'xem' || md === 'chi-duong') { dongTimKiem(); moLoTrinh(dd); return; }
  chonKetQua(dd);
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-hd]');
  if (!el || el.disabled) return;
  const f = HD[el.dataset.hd];
  if (f) { e.preventDefault(); f(el, e); }
});

document.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'muc-offline') {
    st.mucOffline = el.value;
    trangOffline();
  } else if (el.dataset.muc) {
    doiCaiDat({ mucCanhBao: { ...caiDat.mucCanhBao, [el.dataset.muc]: Number(el.value) } });
  } else if (el.dataset.cd) {
    const k = el.dataset.cd, kieu = el.dataset.kieu;
    const v = kieu === 'bat' ? el.checked : kieu === 'so' ? Number(el.value) : el.value.trim();
    doiCaiDat({ [k]: v });
  } else if (el.dataset.hdDoi) {
    doiCaiDat({ [el.dataset.hdDoi]: el.checked });
    tinhLoTrinh();
  }
});

$('#o-tim').addEventListener('input', e => {
  const s = e.target.value;
  // dán liên kết Google Maps / geo: / toạ độ vào ô tìm kiếm: mở thẳng địa điểm
  if (/^\s*(https?:\/\/|geo:|google\.navigation:)/i.test(s) && docLienKet(s)) { moChuoiChiaSe(s); return; }
  $('#nut-xoa-tim').hidden = !s;
  clearTimeout(henGoiY);
  if (!s.trim()) { if (huyGoiY) huyGoiY.abort(); renderTimRong(); return; }
  henGoiY = setTimeout(() => timGoiY(s), 300);
});
$('#o-tim').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); clearTimeout(henGoiY); timDayDuNgay(); }
});

/** Đóng lớp giao diện trên cùng (phím Esc, nút Back của Android). Trả về false nếu không còn gì để đóng. */
function quayLai() {
  const hop = $('.hop-thoai-nen');
  if (hop) { hop.click(); return true; }
  if (popupBc && popupBc.isOpen()) { popupBc.remove(); popupBc = null; return true; }
  if (st.hud) { batHud(false); return true; }
  if (!$('#man-camera').hidden) { HD['thu-camera'](); return true; }
  if (!$('#trang').hidden) { dongTrang(); return true; }
  if (!$('#man-tim').hidden) { dongTimKiem(); return true; }
  if (!$('#menu').hidden) { moMenu(false); return true; }
  if (st.chonBd) { tatChonTrenBanDo(); return true; }
  if (!tam.el.hidden && st.cheDo !== 'danduong') { dongTam(); return true; }
  if (st.cheDo === 'lotrinh') { dongLoTrinh(); return true; }
  if (st.laiXe) { batLaiXe(false); return true; }
  return false;
}

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || $('.hop-thoai-nen')) return;
  quayLai();
});

// ================================================================== ứng dụng gốc: Android Auto / CarPlay / WebView điện thoại
function rutGonDiaDiem(x) {
  const kc = x.viTri ? Math.round(khoangCach(viTriGan(), x.viTri)) : null;
  return { ten: x.ten, diaChi: x.diaChi || '', viTri: x.viTri || null, refId: x.refId || null, nguon: x.nguon || '', kc, kcChu: kc != null ? quangDuong(kc) : '' };
}

function tomTatTuyen(t, i) {
  const nhanh = Math.min(...st.lt.tuyen.map(x => x.thoiGian));
  return {
    i, thoiGian: Math.round(t.thoiGian), quangDuong: Math.round(t.quangDuong), thoiGianChu: thoiGian(t.thoiGian), quangDuongChu: quangDuong(t.quangDuong),
    duongChinh: t.duongChinh || '', coThuPhi: !!t.coThuPhi, coCaoToc: !!t.coCaoToc, nhanhNhat: t.thoiGian === nhanh, gioDen: Date.now() + t.thoiGian * 1000,
    diemCuoi: t.toaDo[t.toaDo.length - 1]
  };
}

function rutGonBuoc(b, kc) {
  if (!b) return null;
  return { loai: b.loai, huong: b.huong || '', loiRa: b.loiRa || 0, chiDan: b.chiDan, ten: tenDuong(b), diemDung: !!b.diemDung, kc: kc == null ? null : Math.round(kc) };
}

/** Trạng thái dẫn đường gửi cho ứng dụng gốc để vẽ thẻ chỉ hướng của Android Auto / CarPlay. */
function trangThaiGoc(tt) {
  const dd = st.dd;
  if (!dd) return { dangDanDuong: false };
  const ke = tt ? tt.ke : dd.tuyen.buoc[1];
  const kc = tt ? tt.kcDenRe : (ke ? ke.batDau : 0);
  const keNua = tt ? tt.keNua : dd.tuyen.buoc[2];
  const tg = tt ? tt.thoiGianConLai : dd.tuyen.thoiGian;
  const cb = st.cbCuoi;
  return {
    dangDanDuong: true, dangTinhLai: !!dd.dangTinhLai, moPhong: !!dd.moPhong, tenDen: dd.tenDen,
    diemDen: dd.diemDen.length ? dd.diemDen[dd.diemDen.length - 1].viTri : null,
    ke: rutGonBuoc(ke, kc), sau: rutGonBuoc(keNua, ke && keNua ? keNua.batDau - ke.batDau : null),
    lanes: ke && ke.lanes && kc < 600 ? ke.lanes.map(l => ({ huong: l.indications, dung: !!l.valid })) : null,
    conLai: Math.round(tt ? tt.conLai : dd.tuyen.quangDuong), conLaiChu: quangDuong(tt ? tt.conLai : dd.tuyen.quangDuong),
    thoiGianConLai: Math.round(tg), thoiGianChu: thoiGian(tg), gioDen: Date.now() + tg * 1000, gioDenChu: gioDen(tg),
    tocDo: cb ? cb.kmh : null, gioiHan: cb ? cb.gioiHan : null, vuotToc: !!(cb && cb.vuotToc),
    canhBao: cb && cb.canhBao ? { id: cb.canhBao.id, loai: cb.canhBao.loai, ten: cb.canhBao.ten, icon: cb.canhBao.icon, kc: Math.round(cb.canhBao.kc), gioiHan: cb.canhBao.gioiHan || null } : null
  };
}

function baoGoc(tt) {
  if (laAppGoc && st.dd) guiGoc('danDuong', trangThaiGoc(tt));
}

function dieuKhienBanDo({ loai, dx = 0, dy = 0, tiLe = 1, x, y, donVi = 'css' }) {
  const m = banDo.map, dpr = donVi === 'px' ? (window.devicePixelRatio || 1) : 1;
  if (loai === 'keo') {
    banDo.datTheoDoi('khong');
    m.panBy([dx / dpr, dy / dpr], { animate: false });
  } else if (loai === 'thuPhong') {
    banDo.lucZoomTay = Date.now();
    const quanh = x != null ? m.unproject([x / dpr, y / dpr]) : undefined;
    m.zoomTo(m.getZoom() + Math.log2(Math.max(0.1, tiLe)), { around: quanh, animate: false });
  } else if (loai === 'phongTo' || loai === 'thuNho') {
    banDo.lucZoomTay = Date.now();
    if (banDo.theoDoi === 'khong') m.easeTo({ zoom: m.getZoom() + (loai === 'phongTo' ? 1 : -1), duration: 300 });
    else m.jumpTo({ zoom: m.getZoom() + (loai === 'phongTo' ? 1 : -1) });
  } else if (loai === 'veGiua') {
    if (st.viTri) banDo.datTheoDoi(st.dd ? 'huong' : 'bac');
  } else if (loai === 'tongQuan') {
    if (st.dd) HD['tong-quan']();
    else if (st.lt && st.lt.tuyen.length) banDo.vuaKhung(st.lt.tuyen.flatMap(t => t.toaDo));
  }
  capNhatNutViTri();
  return { theoDoi: banDo.theoDoi };
}

/** Lệnh từ ứng dụng gốc. Mỗi lệnh trả về dữ liệu (JSON) hoặc báo lỗi bằng exception. */
const LENH_GOC = {
  timKiem: async ({ chuoi }) => (await goiY(String(chuoi || ''), viTriGan())).slice(0, 10).map(rutGonDiaDiem),
  quanhDay: async ({ danhMuc }) => {
    const dm = layDanhMuc(danhMuc);
    if (!dm) throw new Error('Danh mục không hợp lệ');
    return (await timQuanh(dm, viTriGan())).slice(0, 12).map(rutGonDiaDiem);
  },
  danhMuc: () => DANH_MUC.map(d => ({ id: d.id, ten: d.ten, icon: d.icon })),
  daLuu: () => {
    const ds = diaDiemDaLuu();
    return {
      nha: ds.nha && rutGonDiaDiem(ds.nha), coQuan: ds.coQuan && rutGonDiaDiem(ds.coQuan),
      yeuThich: ds.yeuThich.slice(0, 10).map(rutGonDiaDiem), ganDay: lichSuTim().slice(0, 8).map(rutGonDiaDiem)
    };
  },
  xemTruoc: async ({ diem }) => {
    let dd = diem;
    if (!dd || (!dd.viTri && !dd.refId)) throw new Error('Thiếu địa điểm');
    if (!dd.viTri) dd = await layToaDo(dd);
    if (dd.nguon !== 'toado') themLichSu(dd);
    if (st.dd) throw new Error('Đang dẫn đường');
    await moLoTrinh({ ten: dd.ten, diaChi: dd.diaChi, viTri: dd.viTri });
    if (st.lt.loi) throw new Error(st.lt.loi);
    if (!st.lt.tuyen.length) throw new Error(st.viTri ? 'Không tìm được đường đi' : 'Đang chờ tín hiệu GPS');
    return st.lt.tuyen.map(tomTatTuyen);
  },
  chonTuyen: ({ i }) => { chonTuyen(+i); return true; },
  moLienKet: async ({ chuoi }) => moChuoiChiaSe(String(chuoi || '')),
  batDau: ({ moPhong }) => { batDauDanDuong({ moPhong: !!moPhong }); return trangThaiGoc(null); },
  ketThuc: () => { ketThucDanDuong(); return true; },
  huyXemTruoc: () => { if (st.cheDo === 'lotrinh') dongLoTrinh(); return true; },
  banDo: o => dieuKhienBanDo(o || {}),
  loaiBaoCao: () => Object.entries(LOAI_BAO_CAO).map(([id, v]) => ({ id, ten: v.ten, mau: v.mau })),
  baoCao: async ({ loai }) => {
    if (!LOAI_BAO_CAO[loai]) throw new Error('Loại báo cáo không hợp lệ');
    await guiBaoCao({ loai, viTri: st.viTri ? st.viTri.viTri : banDo.tam(), huong: st.viTri && st.viTri.huong });
    banDo.datBaoCao(baoCaoHienTai());
    return LOAI_BAO_CAO[loai].ten;
  },
  loa: ({ bat }) => { doiCaiDat({ giongNoi: bat == null ? !caiDat.giongNoi : !!bat }); return caiDat.giongNoi; },
  /** Vùng bản đồ bị giao diện xe che (px của màn hình xe nếu donVi = 'px'). */
  le: ({ tren = 0, duoi = 0, trai = 0, phai = 0, donVi = 'css' }) => {
    const dpr = donVi === 'px' ? (window.devicePixelRatio || 1) : 1;
    st.leXe = { tren: tren / dpr, duoi: duoi / dpr, trai: trai / dpr, phai: phai / dpr };
    const g = document.documentElement.style;
    g.setProperty('--xe-tren', st.leXe.tren + 'px');
    g.setProperty('--xe-duoi', st.leXe.duoi + 'px');
    g.setProperty('--xe-trai', st.leXe.trai + 'px');
    g.setProperty('--xe-phai', st.leXe.phai + 'px');
    capNhatLe();
    return true;
  },
  quayLai: () => ({ daXuLy: quayLai() }),
  trangThai: () => trangThaiGoc(st.dd && st.dd.tt)
};

async function chayLenh(id, ten, thamSo) {
  try {
    const f = LENH_GOC[ten];
    if (!f) throw new Error('Không có lệnh ' + ten);
    const ketQua = await f(thamSo || {});
    guiGoc('traLoi', { id, ketQua: ketQua === undefined ? null : ketQua });
  } catch (e) {
    guiGoc('traLoi', { id, loi: (e && e.message) || String(e) });
  }
}

/** Ứng dụng gốc bắt đầu dẫn đường trên màn hình này theo tuyến đã tính ở màn hình kia. */
function dongBoBatDau(du) {
  const t = du && du.tuyen;
  if (!t || !t.toaDo || !t.buoc) return;
  t.tichLuy = tichLuy(t.toaDo);
  t.buoc.forEach(b => { b.batDau = t.tichLuy[Math.min(b.chiSo, t.toaDo.length - 1)]; });
  st.lt = {
    diem: [{ toi: true }, ...(du.diemDen || []).map(d => ({ ten: d.ten, diaChi: '', viTri: d.viTri }))],
    phuongTien: du.phuongTien || caiDat.phuongTien, tuyen: [t], chon: 0
  };
  dongTimKiem();
  dongTrang();
  batDauDanDuong({ moPhong: !!du.moPhong, tuGoc: true });
}

window.hawamap = {
  // chạy ngay các việc định kỳ (gỡ lỗi, kiểm thử): tải báo cáo, xét đổi tuyến tránh kẹt xe, cập nhật dữ liệu
  chayNgay: { baoCao: () => taiBaoCaoKhuVuc(), doiTuyen: () => xetDoiTuyen(), duLieu: () => tuCapNhatDuLieu({ ep: true }) },
  st, banDo, caiDat,
  goc: {
    viTri: (lng, lat, tocDo, huong, doChinhXac, thoiGian) => nguonViTri.tuGoc(lng, lat, tocDo, huong, doChinhXac, thoiGian),
    lenh: (id, ten, thamSo) => { chayLenh(id, ten, thamSo); },
    dongBoBatDau: du => dongBoBatDau(typeof du === 'string' ? JSON.parse(du) : du),
    dongBoKetThuc: () => ketThucDanDuong({ tuGoc: true }),
    quayLai: () => quayLai(),
    // trạng thái giọng đọc của Android (cau/GiongNoi.kt): có tiếng Việt không, danh sách giọng
    giongNoi: du => {
      const tt = typeof du === 'string' ? JSON.parse(du) : du;
      const doi = JSON.stringify(tt) !== JSON.stringify(trangThaiGiongGoc());
      datGiongGoc(tt);
      caiDat.tenGiong = tt.chon || '';
      if (doi) veLaiNhomGiong();
    },
    // kết quả tìm bằng giọng nói của ứng dụng Android (MainActivity: RecognizerIntent)
    ketQuaNghe: du => ketQuaNgheGoc(du),
    // bộ chuyển OBD-II Bluetooth thường của ứng dụng Android (cau/Obd.kt)
    obd: (loai, du) => { if (st.obd && st.obd.cong instanceof CongGoc) st.obd.cong.suKien(loai, du); }
  }
};
guiGoc('sanSang', { xe: cheDoXe, phienBan: CAU_HINH.phienBan });
