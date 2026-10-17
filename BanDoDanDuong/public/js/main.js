/* HawaMap — bản đồ dẫn đường. Điều khiển chính: nối bản đồ, tìm kiếm, lộ trình, dẫn đường, cảnh báo, báo cáo, camera. */
import { CAU_HINH } from './cau-hinh.js';
import {
  caiDat, doiCaiDat, ngheDoiCaiDat, khoiPhucCaiDat, diaDiemDaLuu, luuNhaCoQuan, laYeuThich, doiYeuThich, boYeuThich,
  lichSuTim, themLichSu, xoaLichSu
} from './kho.js';
import { khoangCach, catTuyen, diemTaiS } from './hinh-hoc.js';
import { quangDuong, thoiGian, gioDen, ngayGio, thoiGianTruoc, tocDoKmh, kichThuoc, esc } from './dinh-dang.js';
import { icon, muiTenRe, muiTenLan } from './bieu-tuong.js';
import { BanDo, layKieuBanDo } from './ban-do.js';
import { $, $$, chenBieuTuong, thongBao, hopThoai, hoiXacNhan, TamDuoi, moTrang, dongTrang, taiXuong } from './giao-dien.js';
import { goiY, timDayDu, layToaDo, diaChiTuToaDo } from './tim-kiem.js';
import { timDuong, PHUONG_TIEN, tenDuong } from './chi-duong.js';
import { DanDuong } from './dan-duong.js';
import { NguonViTri } from './vi-tri.js';
import { MoPhong } from './mo-phong.js';
import { noi, imLang, moKhoaAmThanh, bip, danhSachGiong, doiGiong, coGiongNoi } from './giong-noi.js';
import { ThongTinDuong } from './duong-xa.js';
import { CanhBao } from './canh-bao.js';
import { LOAI_BAO_CAO, kiemTraMayChu, dungMayChu, taiBaoCao, guiBaoCao, xacNhan, xoaBaoCao, baoCaoHienTai, baoCaoCuaToi } from './bao-cao.js';
import { DANH_MUC, layDanhMuc, timQuanh, timDocTuyen } from './dia-diem.js';
import { GhiHanhTrinh, danhSachHanhTrinh, xoaHanhTrinh, tongKet, xuatGpx } from './hanh-trinh.js';
import { CameraHanhTrinh, hoTroCamera, danhSachDoan, doiKhoaDoan, xoaDoan, layDoan } from './camera-hanh-trinh.js';

const st = {
  cheDo: 'chinh',          // chinh | diadiem | danhmuc | lotrinh | danduong
  viTri: null,             // vị trí mới nhất
  cbCuoi: null,            // kết quả cảnh báo mới nhất
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
const banDo = new BanDo('ban-do', {
  nhanGiu: p => chonViTriBanDo(p),
  chamBaoCao: (id, p) => moPopupBaoCao(id, p),
  chamKetQua: i => { if (st.danhMuc && st.danhMuc.ds[i]) chonDiaDiem(st.danhMuc.ds[i], { giuDanhMuc: true }); },
  chamTuyenPhu: i => chonTuyen(i),
  chamDiaDiem: dd => { if (st.cheDo === 'chinh' || st.cheDo === 'diadiem') chonDiaDiem({ ...dd, diaChi: '' }, { timDiaChi: true }); },
  boTheoDoi: () => capNhatNutViTri(),
  daiTaiStyle: () => document.documentElement.dataset.giaoDien = banDo.laKieuToi() ? 'toi' : 'sang'
}, kieuMongMuon());
const tam = new TamDuoi($('#tam-duoi'), { doiChieuCao: () => capNhatLe() });
tam.onAn = () => {
  if (st.tamPhu) { st.tamPhu = false; setTimeout(tamQuayLai, 0); }
  else if (st.cheDo === 'diadiem' || st.cheDo === 'danhmuc') veChinh();
};
const nguonViTri = new NguonViTri(xuLyViTri, (loi, ma) => {
  if (ma === 1 || !st.viTri) thongBao(loi, { loai: 'loi', thoiGian: 5000 });
});
const thongTinDuong = new ThongTinDuong();
const canhBao = new CanhBao({ thongTinDuong, layBaoCao: baoCaoHienTai, noi, bip });
const ghiHT = new GhiHanhTrinh();
let camera = null;

document.documentElement.dataset.giaoDien = layKieuBanDo(kieuMongMuon()).toi ? 'toi' : 'sang';
if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) document.documentElement.classList.add('khong-mic');
renderChip();
datCheDo('chinh');
nguonViTri.batDau();
kiemTraMayChu().then(taiBaoCaoKhuVuc);
banDo.map.on('moveend', () => { clearTimeout(st.henBaoCao); st.henBaoCao = setTimeout(taiBaoCaoKhuVuc, 1200); });
banDo.map.on('rotate', capNhatLaBan);
banDo.map.on('pitch', capNhatLaBan);
setInterval(() => banDo.doiKieu(kieuMongMuon()), 5 * 60000);
setInterval(taiBaoCaoKhuVuc, 90000);
window.addEventListener('resize', capNhatLe);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && (st.dd || st.laiXe)) giuManHinh(true);
});
moLienKet();
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
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
  const goc = document.documentElement.style;
  const tamEl = $('#tam-duoi');
  const mayTinh = laMayTinh();
  let tren, duoi = 0, trai = 0, leDuoi = 0;
  if (st.cheDo === 'danduong') {
    const br = $('#bang-re').offsetHeight, tdd = $('#thanh-dd').offsetHeight;
    goc.setProperty('--cao-br', br + 'px');
    tren = br + 12;
    if (mayTinh) trai = 424;
    else { duoi = tdd + 12; leDuoi = tdd; }
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
  if (!vt.moPhong) ghiHT.them(vt);
  thongTinDuong.capNhat(vt.viTri);

  if (dauTien && !st.daBayDenViTri && st.cheDo === 'chinh' && !st.lienKet) {
    st.daBayDenViTri = true;
    banDo.bayDen(vt.viTri, 16);
  }
  if (st.choBayDenViTri) { st.choBayDenViTri = false; banDo.datTheoDoi('bac'); capNhatNutViTri(); }
  if (st.lt && st.lt.choGps && st.cheDo === 'lotrinh') { st.lt.choGps = false; tinhLoTrinh(); }

  let tt = null;
  if (st.dd) tt = capNhatDanDuong(vt);
  const cb = canhBao.capNhat(vt, st.dd && tt ? { tuyen: st.dd.tuyen, tt } : null, st.dd ? st.dd.phuongTien : caiDat.phuongTien);
  st.cbCuoi = cb;
  if (cb.kmh >= 5) st.lucDiChuyen = Date.now();
  renderHud(cb);
  renderCanhBao(st.dd ? $('#canh-bao-dd') : $('#canh-bao-chinh'), (st.dd || st.laiXe || cb.kmh >= 5) ? cb.canhBao : null);
  if (st.dd) $('#canh-bao-chinh').hidden = true;

  const soDiem = thongTinDuong.diem.size;
  if (soDiem !== st.soDiemCanhBao) { st.soDiemCanhBao = soDiem; banDo.datDiemCanhBao(thongTinDuong.danhSachDiem()); }
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
  $('#nut-ve-giua').hidden = !(st.cheDo === 'danduong' && banDo.theoDoi !== 'huong');
}

function capNhatLaBan() {
  const svg = $('#nut-la-ban svg');
  if (svg) svg.style.transform = `rotate(${-banDo.map.getBearing()}deg)`;
}

let khoaManHinh = null;
async function giuManHinh(bat) {
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
    <div class="dong-ho${cb.vuotToc ? ' vuot' : ''}"><b>${cb.kmh}</b><span>km/h</span></div>
    ${cb.duong && (cb.duong.ten || cb.duong.ref) ? `<div class="ten-duong">${esc(cb.duong.ten || cb.duong.ref)}</div>` : ''}`;
  if (st.dd) { $('#hud-dd').innerHTML = html; return; }
  const el = $('#hud-chinh');
  el.hidden = !(st.laiXe || Date.now() - st.lucDiChuyen < 60000);
  el.innerHTML = html;
}

function mauCanhBao(d) {
  if (d.loai === 'baocao' || d.loaiBaoCao) return (LOAI_BAO_CAO[d.loaiBaoCao] || {}).mau || '#e53935';
  return { camera: '#6d28d9', duongsat: '#b45309', thuphi: '#0f766e' }[d.loai] || '#e53935';
}

function renderCanhBao(el, d) {
  if (!d) { el.hidden = true; return; }
  el.hidden = false;
  const pt = Math.max(0, Math.min(100, 100 - d.kc / d.kcBao * 100));
  el.innerHTML = `<div class="cb-icon" style="background:${mauCanhBao(d)}">${icon(d.icon)}</div>
    <div class="cb-chu"><b>${quangDuong(d.kc)}</b><span>${esc(d.ten)}</span></div>
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

function moTimKiem(mucDich = 'xem') {
  st.mucDichTim = mucDich;
  $('#man-tim').hidden = false;
  const o = $('#o-tim');
  o.value = '';
  o.placeholder = GOI_Y_O_TIM[mucDich] || (mucDich === 'diem:0' ? 'Chọn điểm xuất phát' : 'Chọn điểm đến');
  $('#nut-xoa-tim').hidden = true;
  renderTimRong();
  setTimeout(() => o.focus(), 60);
}

function dongTimKiem() {
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

function noiTim() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return thongBao('Trình duyệt không hỗ trợ tìm bằng giọng nói');
  if ($('#man-tim').hidden) moTimKiem(st.mucDichTim === 'xem' ? 'xem' : st.mucDichTim);
  const o = $('#o-tim');
  const r = new SR();
  r.lang = 'vi-VN';
  r.interimResults = false;
  r.maxAlternatives = 1;
  const goiYCu = o.placeholder;
  o.placeholder = 'Đang nghe… hãy nói tên địa điểm';
  document.body.classList.add('dang-nghe');
  r.onresult = e => {
    const s = e.results[0][0].transcript;
    o.value = s;
    $('#nut-xoa-tim').hidden = false;
    timGoiY(s);
  };
  r.onerror = () => thongBao('Không nghe rõ, vui lòng thử lại');
  r.onend = () => { o.placeholder = goiYCu; document.body.classList.remove('dang-nghe'); };
  try { r.start(); } catch (e) { thongBao('Không bật được micro'); }
}

// ================================================================== chọn trên bản đồ (tâm ngắm)
function batChonTrenBanDo(mucDich) {
  dongTimKiem();
  st.chonBd = mucDich;
  document.body.classList.add('chon-ban-do');
  $('#chon-ban-do').hidden = false;
}

function tatChonTrenBanDo() {
  st.chonBd = null;
  document.body.classList.remove('chon-ban-do');
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
  if (d) {
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
  tinhLoTrinh();
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
    lt.tuyen = kq;
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
    return { viTri: vt, chu: thoiGian(t.thoiGian), chon: i === lt.chon, i };
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
  const nhanh = Math.min(...lt.tuyen.map(t => t.thoiGian));
  const the = lt.tuyen.map((t, i) => {
    const nhan = [];
    if (t.thoiGian === nhanh && lt.tuyen.length > 1) nhan.push('<i class="xanh">Nhanh nhất</i>');
    if (t.coThuPhi) nhan.push('<i class="cam">Có trạm thu phí</i>');
    if (t.coCaoToc) nhan.push(`<i class="${lt.phuongTien === 'xemay' ? 'do' : 'xam'}">Có đoạn cao tốc</i>`);
    if (t.coPha) nhan.push('<i class="xam">Đi phà</i>');
    return `<button class="the-tuyen${i === lt.chon ? ' chon' : ''}" data-hd="chon-tuyen" data-i="${i}">
      <span class="tt-dong"><b class="tt-tg">${thoiGian(t.thoiGian)}</b><span class="tt-kc">${quangDuong(t.quangDuong)}</span></span>
      <span class="tt-qua">${t.duongChinh ? 'Qua ' + esc(t.duongChinh) : esc(PHUONG_TIEN[lt.phuongTien].ten)}</span>
      <span class="tt-dong"><span class="tt-nhan">${nhan.join('')}</span><span class="tt-den">Đến lúc ${gioDen(t.thoiGian)}</span></span>
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
function batDauDanDuong({ moPhong = false } = {}) {
  const lt = st.lt;
  const t = lt && lt.tuyen[lt.chon];
  if (!t) return;
  moKhoaAmThanh();
  if (!moPhong && !lt.diem[0].toi) {
    moPhong = true;
    thongBao('Điểm xuất phát không phải vị trí hiện tại — chạy thử lộ trình');
  }
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
  banDo.datTuyen([t], 0);
  banDo.datNhanTuyen([]);
  veDiemDungDd();
  datCheDo('danduong');
  banDo.datTheoDoi('huong');
  capNhatNutViTri();
  giuManHinh(true);
  if (caiDat.tuGhiHanhTrinh && !moPhong) ghiHT.batDau(st.dd.tenDen);
  noi(st.dd.may.loiBatDau(), { chen: true });
  renderBangRe(null);
  renderThanhDd(null);
  $('#nut-loa').innerHTML = icon(caiDat.giongNoi ? 'loa' : 'tatloa');
  if (moPhong) batMoPhong(t);
  else if (st.viTri) xuLyViTri(st.viTri);
}

function veDiemDungDd() {
  const dd = st.dd;
  banDo.datDiemLoTrinh(dd.diemDen.slice(0, -1).map((d, i) => ({ viTri: d.viTri, loai: 'dung', nhan: String(i + 1) })));
  banDo.datGhim(dd.diemDen[dd.diemDen.length - 1].viTri);
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

function renderBangRe(tt) {
  const dd = st.dd, el = $('#bang-re');
  if (!dd) return;
  if (dd.dangTinhLai) {
    el.innerHTML = `<div class="br-chinh"><span class="br-icon xoay">${icon('chiduong')}</span><div class="br-chu"><b class="br-kc">Đang tính lại đường…</b></div></div>`;
    return;
  }
  const ke = tt ? tt.ke : dd.tuyen.buoc[1];
  const kc = tt ? tt.kcDenRe : (ke ? ke.batDau : 0);
  const lan = ke && ke.lanes && ke.lanes.length > 1 && kc < 600
    ? `<div class="br-lan">${ke.lanes.map(l => `<span class="${l.valid ? 'dung' : ''}">${muiTenLan(l.indications)}</span>`).join('')}</div>` : '';
  const keNua = tt ? tt.keNua : dd.tuyen.buoc[2];
  const sauDo = ke && keNua && ke.loai !== 'arrive' && keNua.batDau - ke.batDau < 150
    ? `<div class="br-sau">Sau đó ${muiTenRe(keNua)}</div>` : '';
  el.innerHTML = `<div class="br-chinh">${muiTenRe(ke, 'br-icon')}
      <div class="br-chu"><b class="br-kc">${quangDuong(kc)}</b><span class="br-ten">${esc(tenBuoc(ke))}</span>
      ${ke && tenDuong(ke) && ke.loai !== 'arrive' ? `<small class="br-chi-dan">${esc(ke.chiDan)}</small>` : ''}</div></div>${lan}${sauDo}`;
  capNhatLe();
}

function renderThanhDd(tt) {
  const dd = st.dd;
  if (!dd) return;
  const conLai = tt ? tt.conLai : dd.tuyen.quangDuong;
  const tg = tt ? tt.thoiGianConLai : dd.tuyen.thoiGian;
  $('#thanh-dd').innerHTML = `<button class="tdd-thong-tin" data-hd="mo-rong-dd">
      <b class="tdd-gio">${gioDen(tg)}</b><span>${thoiGian(tg)} · ${quangDuong(conLai)}</span></button>
    <button class="nut-icon tdd-ket-thuc" data-hd="ket-thuc-dd" aria-label="Kết thúc dẫn đường">${icon('dong')}</button>
    ${st.ddMoRong ? `<div class="tdd-them">
      <button data-hd="tong-quan">${icon('tongquan')}Tổng quan</button>
      <button data-hd="xem-buoc-dd">${icon('danhsach')}Các bước</button>
      <button data-hd="xang-doc-duong">${icon('xang')}Cây xăng</button>
      <button data-hd="doi-loa">${icon(caiDat.giongNoi ? 'loa' : 'tatloa')}${caiDat.giongNoi ? 'Tắt tiếng' : 'Bật tiếng'}</button>
      <button data-hd="bao-cao">${icon('loabao')}Báo cáo</button>
      <button data-hd="mo-camera">${icon('camera')}Camera</button>
    </div>` : ''}`;
  capNhatLe();
}

async function ketThucDanDuong({ daDen = false } = {}) {
  const dd = st.dd;
  if (!dd) return;
  st.dd = null;
  clearTimeout(dd.henKetThuc);
  if (st.moPhong) tatMoPhong();
  const ht = ghiHT.ketThuc(dd.tenDen);
  if (!daDen) imLang();
  if (!st.laiXe) giuManHinh(false);
  banDo.xoaTuyen();
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
  if (daDen) {
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

// ================================================================== báo cáo giao thông
async function taiBaoCaoKhuVuc() {
  const k = banDo.khungHienTai();
  const rong = Math.max(0.02, (k[2] - k[0]) * 0.25), cao = Math.max(0.02, (k[3] - k[1]) * 0.25);
  await taiBaoCao([k[0] - rong, k[1] - cao, k[2] + rong, k[3] + cao]);
  banDo.datBaoCao(baoCaoHienTai());
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

async function guiBc(loai) {
  const p = st.viTriBaoCao || (st.viTri ? st.viTri.viTri : banDo.tam());
  try {
    await guiBaoCao({ loai, viTri: p, huong: st.viTriBaoCao ? null : st.viTri && st.viTri.huong });
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
    .setHTML(`<div class="pbc"><div class="pbc-dau"><span style="background:${k.mau}">${icon(k.icon)}</span><div><b>${esc(k.ten)}</b>
      <small>Báo cáo ${thoiGianTruoc(b.taoLuc)}${b.conTon ? ` · ${b.conTon} người xác nhận` : ''}</small></div></div>
      ${b.ghiChu ? `<p>${esc(b.ghiChu)}</p>` : ''}
      <div class="pbc-nut">${b.cuaToi ? `<button class="nut vien" data-hd="xoa-bc" data-id="${esc(id)}">Xoá báo cáo</button>`
    : `<button class="nut vien" data-hd="xac-nhan-bc" data-id="${esc(id)}" data-con="1">Vẫn còn</button><button class="nut vien" data-hd="xac-nhan-bc" data-id="${esc(id)}" data-con="0">Không còn</button>`}</div></div>`)
    .addTo(banDo.map);
}

// ================================================================== kiểu bản đồ
function kieuMongMuon() {
  if (caiDat.tuDongBanDem && caiDat.kieuBanDo === 'tieuchuan') {
    const h = new Date().getHours();
    if (h >= 18 || h < 6) return 'bandem';
  }
  return caiDat.kieuBanDo;
}

function moLopBanDo() {
  const kieu = { ...CAU_HINH.kieuBanDo };
  if (caiDat.styleVietmap) kieu.vietmap = { ten: 'VietMap', mau: '#cfe3d4' };
  const bat = (k, ten) => `<label class="cong-tac"><input type="checkbox" data-cd="${k}" data-kieu="bat"${caiDat[k] ? ' checked' : ''}><span></span>${ten}</label>`;
  hienTamPhu(`<div class="dd-dau"><div class="tieu-de-tam">${icon('lop')}Kiểu bản đồ</div>
      <button class="nut-icon" data-hd="dong-tam" aria-label="Đóng">${icon('dong')}</button></div>
    <div class="luoi-kieu">${Object.entries(kieu).map(([k, v]) =>
      `<button class="${caiDat.kieuBanDo === k ? 'chon' : ''}" data-hd="doi-kieu" data-k="${k}"><span style="background:${v.mau}"></span>${esc(v.ten)}</button>`).join('')}</div>
    <div class="ds-cong-tac">${bat('tuDongBanDem', 'Tự chuyển bản đồ ban đêm (18h – 6h)')}${bat('nha3D', 'Nhà 3D')}
      ${bat('hienBaoCao', 'Báo cáo giao thông')}${bat('hienDiemCanhBao', 'Camera, đường sắt, trạm thu phí')}</div>`);
}

// ================================================================== trang: cài đặt
const NHOM_CAI_DAT = [
  { ten: 'Giọng nói', muc: [
    { k: 'giongNoi', loai: 'bat', ten: 'Hướng dẫn bằng giọng nói' },
    { k: 'amLuong', loai: 'truot', ten: 'Âm lượng', min: 0.1, max: 1, buoc: 0.1 },
    { k: 'tocDoNoi', loai: 'truot', ten: 'Tốc độ đọc', min: 0.7, max: 1.5, buoc: 0.05 },
    { k: 'tenGiong', loai: 'chon', ten: 'Giọng đọc', ds: () => [['', 'Tự chọn'], ...danhSachGiong().map(v => [v.name, v.name])] },
    { hd: 'nghe-thu', ten: 'Nghe thử giọng đọc', icon: 'loa' }
  ] },
  { ten: 'Cảnh báo', muc: [
    { k: 'canhBaoTocDo', loai: 'bat', ten: 'Cảnh báo vượt tốc độ' },
    { k: 'nguongVuot', loai: 'chon', ten: 'Cảnh báo khi vượt quá', so: true, ds: () => [[0, '0 km/h'], [5, '5 km/h'], [10, '10 km/h'], [15, '15 km/h']] },
    { k: 'bipVuotToc', loai: 'bat', ten: 'Âm báo liên tục khi vượt tốc độ' },
    { k: 'uocTinhGioiHan', loai: 'bat', ten: 'Ước tính giới hạn khi đường chưa có biển trong dữ liệu' },
    { k: 'canhBaoCamera', loai: 'bat', ten: 'Cảnh báo camera giám sát' },
    { k: 'kcCanhBaoCamera', loai: 'chon', ten: 'Báo trước camera', so: true, ds: () => [[300, '300 m'], [500, '500 m'], [800, '800 m'], [1000, '1 km']] },
    { k: 'canhBaoDuongSat', loai: 'bat', ten: 'Cảnh báo đường sắt giao cắt' },
    { k: 'canhBaoThuPhi', loai: 'bat', ten: 'Cảnh báo trạm thu phí' },
    { k: 'canhBaoBaoCao', loai: 'bat', ten: 'Cảnh báo báo cáo giao thông (kẹt xe, tai nạn…)' }
  ] },
  { ten: 'Dẫn đường', muc: [
    { k: 'phuongTien', loai: 'chon', ten: 'Phương tiện mặc định', ds: () => Object.entries(PHUONG_TIEN).map(([k, v]) => [k, v.ten]) },
    { k: 'tranhCaoToc', loai: 'bat', ten: 'Tránh đường cao tốc' },
    { k: 'tranhThuPhi', loai: 'bat', ten: 'Tránh trạm thu phí' },
    { k: 'giuManHinh', loai: 'bat', ten: 'Giữ màn hình luôn sáng khi dẫn đường' },
    { k: 'tuGhiHanhTrinh', loai: 'bat', ten: 'Tự động ghi lịch sử hành trình' }
  ] },
  { ten: 'Bản đồ', muc: [
    { k: 'kieuBanDo', loai: 'chon', ten: 'Kiểu bản đồ', ds: () => [...Object.entries(CAU_HINH.kieuBanDo).map(([k, v]) => [k, v.ten]), ...(caiDat.styleVietmap ? [['vietmap', 'VietMap']] : [])] },
    { k: 'tuDongBanDem', loai: 'bat', ten: 'Tự chuyển bản đồ ban đêm (18h – 6h)' },
    { k: 'nha3D', loai: 'bat', ten: 'Hiện nhà 3D' },
    { k: 'hienBaoCao', loai: 'bat', ten: 'Hiện báo cáo giao thông' },
    { k: 'hienDiemCanhBao', loai: 'bat', ten: 'Hiện camera, đường sắt, trạm thu phí' }
  ] },
  { ten: 'Camera hành trình', muc: [
    { k: 'doDaiDoanCamera', loai: 'chon', ten: 'Độ dài mỗi đoạn video', so: true, ds: () => [[1, '1 phút'], [3, '3 phút'], [5, '5 phút']] },
    { k: 'soDoanToiDa', loai: 'chon', ten: 'Giữ tối đa (ghi vòng)', so: true, ds: () => [[5, '5 đoạn'], [10, '10 đoạn'], [20, '20 đoạn'], [50, '50 đoạn']] },
    { k: 'camGhiAm', loai: 'bat', ten: 'Ghi âm thanh' }
  ] },
  { ten: 'Nâng cao', muc: [
    { k: 'mayChuBaoCao', loai: 'chu', ten: 'Máy chủ báo cáo', goiY: 'Để trống = máy chủ của trang này (api)' },
    { k: 'khoaVietmap', loai: 'chu', ten: 'Khoá VietMap API (tìm kiếm, chỉ đường)', goiY: 'Không bắt buộc' },
    { k: 'styleVietmap', loai: 'chu', ten: 'Đường dẫn style bản đồ VietMap', goiY: 'https://…/style.json?apikey=…' },
    { hd: 'xoa-lich-su-cd', ten: 'Xoá lịch sử tìm kiếm', icon: 'xoa' },
    { hd: 'khoi-phuc-cd', ten: 'Khôi phục cài đặt gốc', icon: 'caidat' }
  ] }
];

function trangCaiDat() {
  const dong = m => {
    if (m.hd) return `<button class="cd-dong cd-nut" data-hd="${m.hd}">${icon(m.icon)}<span>${esc(m.ten)}</span></button>`;
    const v = caiDat[m.k];
    if (m.loai === 'bat') return `<label class="cd-dong"><span>${esc(m.ten)}</span><span class="cong-tac"><input type="checkbox" data-cd="${m.k}" data-kieu="bat"${v ? ' checked' : ''}><span></span></span></label>`;
    if (m.loai === 'chon') {
      return `<label class="cd-dong"><span>${esc(m.ten)}</span><select data-cd="${m.k}" data-kieu="${m.so ? 'so' : 'chu'}">${m.ds().map(([g, t]) =>
        `<option value="${esc(g)}"${String(g) === String(v) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
    }
    if (m.loai === 'truot') return `<label class="cd-dong"><span>${esc(m.ten)}</span><input type="range" min="${m.min}" max="${m.max}" step="${m.buoc}" value="${v}" data-cd="${m.k}" data-kieu="so"></label>`;
    return `<label class="cd-dong cot"><span>${esc(m.ten)}</span><input class="o-nhap" type="text" value="${esc(v)}" placeholder="${esc(m.goiY || '')}" data-cd="${m.k}" data-kieu="chu" spellcheck="false" autocomplete="off"></label>`;
  };
  moTrang('Cài đặt', NHOM_CAI_DAT.map(n => `<div class="nhom"><h4>${esc(n.ten)}</h4>${n.muc.map(dong).join('')}</div>`).join('') +
    (coGiongNoi() && !danhSachGiong().length ? '<p class="ghi-chu">Thiết bị chưa có giọng đọc tiếng Việt. Trên Android: Cài đặt → Hệ thống → Ngôn ngữ → Chuyển văn bản thành giọng nói → tải gói tiếng Việt.</p>' : ''));
}

ngheDoiCaiDat(thay => {
  if ('kieuBanDo' in thay || 'tuDongBanDem' in thay || 'styleVietmap' in thay) {
    if ('styleVietmap' in thay && caiDat.kieuBanDo === 'vietmap') banDo.kieu = '';
    banDo.doiKieu(kieuMongMuon());
  }
  if ('nha3D' in thay) banDo.dat3D(caiDat.nha3D);
  if ('hienBaoCao' in thay) banDo.hienLop(['bao-cao'], caiDat.hienBaoCao);
  if ('hienDiemCanhBao' in thay) banDo.hienLop(['canh-bao'], caiDat.hienDiemCanhBao);
  if ('tenGiong' in thay) doiGiong();
  if ('mayChuBaoCao' in thay) kiemTraMayChu().then(taiBaoCaoKhuVuc);
  if ('giongNoi' in thay) { $('#nut-loa').innerHTML = icon(caiDat.giongNoi ? 'loa' : 'tatloa'); if (!caiDat.giongNoi) imLang(); }
  if ('phuongTien' in thay && st.lt && !st.lt.tuyen.length) st.lt.phuongTien = caiDat.phuongTien;
});

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
    Vượt tốc độ: đồng hồ chuyển đỏ và có âm báo. Ứng dụng báo trước camera giám sát, đường sắt giao cắt, trạm thu phí và các báo cáo kẹt xe, tai nạn, CSGT…
    Biển giới hạn có viền nét đứt là giới hạn <i>ước tính</i> theo loại đường (Thông tư 38/2024/TT-BGTVT) khi dữ liệu chưa có biển báo — luôn tuân theo biển báo thực tế.</p>
    <h4>Chế độ lái xe</h4><p>Menu → <b>Chế độ lái xe</b>: bản đồ xoay theo hướng đi, chỉ hiện tốc độ, giới hạn và cảnh báo, không cần lộ trình.</p>
    <h4>Báo cáo giao thông</h4><p>Bấm nút loa đỏ để báo kẹt xe, tai nạn, CSGT, camera, ngập nước, công trình… tại vị trí của bạn.
    Bấm vào biểu tượng báo cáo trên bản đồ để xác nhận "Vẫn còn" hoặc "Không còn".</p>
    <h4>Camera hành trình</h4><p>Dùng camera sau của điện thoại để quay video, có in giờ, tốc độ, toạ độ lên hình. Video ghi thành từng đoạn, tự xoá đoạn cũ khi đầy;
    bấm <b>khoá</b> để giữ lại đoạn quan trọng. Xem / tải video trong danh sách đoạn.</p>
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
  return { tocDo: st.viTri ? tocDoKmh(st.viTri.tocDo) : null, viTri: st.viTri && st.viTri.viTri, tenDuong: st.cbCuoi && st.cbCuoi.duong ? st.cbCuoi.duong.ten : '' };
}

async function moCamera() {
  if (!hoTroCamera()) return thongBao('Trình duyệt không hỗ trợ camera hành trình', { loai: 'loi' });
  $('#man-camera').hidden = false;
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
  moTrang('Video camera hành trình', `<p class="ghi-chu">${ds.length} đoạn · ${kichThuoc(tong)}. Đoạn chưa khoá sẽ tự xoá khi vượt ${caiDat.soDoanToiDa} đoạn.</p>` +
    (ds.length ? ds.map(d => `<div class="dong-ds">
      <span class="dt-icon">${icon(d.khoa ? 'khoa' : 'camera')}</span>
      <span class="dong-ds-chu"><b>${ngayGio(d.batDau)}</b><small>${thoiGian((d.ketThuc - d.batDau) / 1000)} · ${kichThuoc(d.kichThuoc)}${d.khoa ? ' · đã khoá' : ''}</small></span>
      <button class="nut-icon" data-hd="xem-doan" data-id="${d.id}" aria-label="Xem">${icon('phat')}</button>
      <button class="nut-icon" data-hd="tai-doan" data-id="${d.id}" aria-label="Tải về">${icon('taive')}</button>
      <button class="nut-icon" data-hd="khoa-doan-ds" data-id="${d.id}" aria-label="${d.khoa ? 'Mở khoá' : 'Khoá'}">${icon(d.khoa ? 'mokhoa' : 'khoa')}</button>
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
  'gui-bc': el => guiBc(el.dataset.loai),
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
  'doi-loa': () => { doiCaiDat({ giongNoi: !caiDat.giongNoi }); thongBao(caiDat.giongNoi ? 'Đã bật giọng nói' : 'Đã tắt giọng nói'); if (st.dd) renderThanhDd(st.dd.tt); },
  'xem-buoc-dd': () => { if (st.dd) renderBuoc(st.dd.tuyen, st.dd.tt ? st.dd.tt.buocHienTai + 1 : 1); },
  'xang-doc-duong': () => timDanhMuc('xang', { docTuyen: true }),
  'them-dung-dd': el => themDiemDungDd(st.danhMuc.ds[+el.dataset.i]),
  'mp-dung': () => { st.moPhong.tamDung = !st.moPhong.tamDung; renderDkMoPhong(); },
  'mp-he-so': el => { st.moPhong.heSo = +el.dataset.h; renderDkMoPhong(); },
  'mp-toc': el => { st.moPhong.congThem = Math.max(-40, Math.min(60, st.moPhong.congThem + +el.dataset.d)); renderDkMoPhong(); },
  // lái xe
  'che-do-lai-xe': () => { moMenu(false); batLaiXe(!st.laiXe); },
  'thoat-lai-xe': () => batLaiXe(false),
  // trang
  'trang-cai-dat': () => { moMenu(false); trangCaiDat(); },
  'trang-da-luu': () => { moMenu(false); trangDaLuu(); },
  'trang-hanh-trinh': () => { moMenu(false); trangHanhTrinh(); },
  'trang-bao-cao': () => { moMenu(false); trangBaoCaoCuaToi(); },
  'trang-huong-dan': () => { moMenu(false); trangHuongDan(); },
  'trang-gioi-thieu': () => { moMenu(false); trangGioiThieu(); },
  'nghe-thu': () => { moKhoaAmThanh(); noi('Sau 300 mét, rẽ phải vào đường Trần Phú.', { chen: true, batBuoc: true }); },
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
  'doi-ghi': () => { if (!camera) return; if (camera.dangGhi) camera.dungGhi(); else camera.batDauGhi(); },
  'khoa-doan': () => { if (camera && camera.dangGhi) { camera.khoaDoanHienTai(); thongBao('Đoạn video đang ghi sẽ được giữ lại'); } else thongBao('Chưa ghi hình'); },
  'ds-doan': () => trangDoanCamera(),
  'xem-doan': async el => {
    const d = await layDoan(el.dataset.id);
    if (!d) return;
    const url = URL.createObjectURL(d.blob);
    await hopThoai({ tieuDe: ngayGio(d.batDau), noiDung: `<video class="video-xem" src="${url}" controls autoplay playsinline></video>` });
    URL.revokeObjectURL(url);
  },
  'tai-doan': async el => {
    const d = await layDoan(el.dataset.id);
    if (d) taiXuong(`camera-${new Date(d.batDau).toISOString().replace(/[:.]/g, '-')}.${/mp4/.test(d.kieu) ? 'mp4' : 'webm'}`, d.blob);
  },
  'khoa-doan-ds': async el => { await doiKhoaDoan(el.dataset.id); trangDoanCamera(); },
  'xoa-doan': async el => { if (await hoiXacNhan('Xoá đoạn video này?', { chuCo: 'Xoá', nguy: true })) { await xoaDoan(el.dataset.id); trangDoanCamera(); } }
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
  if (el.dataset.cd) {
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
  $('#nut-xoa-tim').hidden = !s;
  clearTimeout(henGoiY);
  if (!s.trim()) { if (huyGoiY) huyGoiY.abort(); renderTimRong(); return; }
  henGoiY = setTimeout(() => timGoiY(s), 300);
});
$('#o-tim').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); clearTimeout(henGoiY); timDayDuNgay(); }
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if ($('.hop-thoai-nen')) return;
  if (!$('#trang').hidden) return dongTrang();
  if (!$('#man-tim').hidden) return dongTimKiem();
  if (!$('#menu').hidden) return moMenu(false);
  if (st.chonBd) return tatChonTrenBanDo();
  if (!tam.el.hidden && st.cheDo !== 'danduong') dongTam();
});

// cho phép kiểm thử / gỡ lỗi từ bảng điều khiển trình duyệt
window.hawamap = { st, banDo, caiDat };
