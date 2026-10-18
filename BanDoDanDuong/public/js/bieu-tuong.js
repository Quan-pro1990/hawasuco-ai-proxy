/* Biểu tượng SVG (nét 24×24) và mũi tên chỉ hướng rẽ. */

const P = {
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  timkiem: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  quaylai: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  dong: '<path d="M6 6l12 12M18 6L6 18"/>',
  vitri: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  lop: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
  laban: '<path d="M12 2.5l4.2 9.5H7.8z" fill="#e53935" stroke="#e53935"/><path d="M12 21.5L7.8 12h8.4z"/>',
  canhbao: '<path d="M12 3.5L2.5 20h19L12 3.5z"/><path d="M12 10v4.5M12 17.5v.01"/>',
  chiduong: '<path d="M12 2.5l9.5 9.5-9.5 9.5L2.5 12z"/><path d="M9 14.5V12a1.5 1.5 0 0 1 1.5-1.5H15M13 8.5l2 2-2 2"/>',
  oto: '<path d="M3.5 16.5V12l2-5.2A1.5 1.5 0 0 1 6.9 6h10.2a1.5 1.5 0 0 1 1.4.8l2 5.2v4.5M3.5 12h17M9.5 17.5h5"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  xemay: '<circle cx="5.5" cy="16.5" r="3"/><circle cx="18.5" cy="16.5" r="3"/><path d="M5.5 16.5l3.5-6h5l4.5 6M14 10.5l1.5-4H18M8 10.5h3"/>',
  dibo: '<circle cx="13" cy="4.5" r="1.8"/><path d="M10 21l2-6.5 3 3V21M7.5 12.5L10 9l3.5.5 2 3.5 2.5 1M12 14.5l1.5-5"/>',
  xedap: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-7h5l3 7M10 9l2.5 7H6M14 6h2l-1 3"/>',
  dao: '<path d="M7 20V4M3 8l4-4 4 4M17 4v16M21 16l-4 4-4-4"/>',
  sao: '<path d="M12 3l2.7 5.6 6.1.8-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.8z"/>',
  saodac: '<path d="M12 3l2.7 5.6 6.1.8-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.8z" fill="currentColor"/>',
  chiase: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6"/>',
  nha: '<path d="M3 11l9-7.5 9 7.5"/><path d="M5.5 9.5V20h13V9.5M10 20v-5.5h4V20"/>',
  coquan: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  dongho: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  caidat: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M2.5 12h3M18.5 12h3M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  camera: '<rect x="2.5" y="6.5" width="13" height="11" rx="2"/><path d="M15.5 10.5l6-3.5v10l-6-3.5"/>',
  loa: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  tatloa: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  tongquan: '<circle cx="6" cy="18.5" r="2"/><circle cx="18" cy="5.5" r="2"/><path d="M8 18.5h7.5a3 3 0 0 0 0-6h-7a3 3 0 0 1 0-6H16"/>',
  ghim: '<path d="M12 21.5s7-6.3 7-11.5a7 7 0 0 0-14 0c0 5.2 7 11.5 7 11.5z"/><circle cx="12" cy="10" r="2.5"/>',
  xoa: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  phat: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/>',
  dungtam: '<path d="M8 5v14M16 5v14"/>',
  khoa: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  mokhoa: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>',
  taive: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
  cong: '<path d="M12 5v14M5 12h14"/>',
  tru: '<path d="M5 12h14"/>',
  ghi: '<circle cx="12" cy="12" r="7" fill="currentColor" stroke="none"/>',
  dung: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.5" fill="currentColor" stroke="none"/>',
  muiten: '<path d="M12 2.5l7.5 18.5-7.5-4.2-7.5 4.2z" fill="currentColor"/>',
  vegiua: '<path d="M6 12l6-6 6 6M6 18.5l6-6 6 6"/>',
  danhsach: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  thongtin: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  sach: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>',
  tuychon: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  chon: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  loabao: '<path d="M3 10v4h3l7 4V6l-7 4z"/><path d="M17 9a4 4 0 0 1 0 6M6 14l1.5 5H10l-1.3-4.5"/>',
  keo: '<path d="M12 3v18M3 12h18M12 3L9 6M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  capnhat: '<path d="M20 12a8 8 0 1 1-2.4-5.7L20 8.5M20 3.5v5h-5"/>',
  mayanh: '<path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.5l1.5-2.5h7L17 7h2.5A1.5 1.5 0 0 1 21 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/><circle cx="12" cy="13" r="3.5"/>',
  doicamera: '<path d="M4 9a8 8 0 0 1 14-3l2 2M20 4v4h-4M20 15a8 8 0 0 1-14 3l-2-2M4 20v-4h4"/><circle cx="12" cy="12" r="2.5"/>',
  obd: '<path d="M3 9h3l2-2.5h7L17 9h4v8h-3l-2 2.5H8L6 17H3z"/><path d="M9.5 11.5v3M14.5 11.5v3M12 11.5v3"/>',
  hud: '<path d="M5 11L8 4h8l3 7"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M9.5 7.5h5M8 16.5h8"/>',
  laixe: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M3.5 10.5c3-1.5 14-1.5 17 0M10.2 13.5L7 20M13.8 13.5L17 20"/>',
  // danh mục địa điểm
  xang: '<path d="M5 20V5a1.5 1.5 0 0 1 1.5-1.5h6A1.5 1.5 0 0 1 14 5v15M3.5 20h12M5 10h9"/><path d="M14 8h2l2.5 2.5V17a1.5 1.5 0 0 1-3 0v-3H14"/>',
  doxe: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M10 17V7h3.5a3 3 0 0 1 0 6H10"/>',
  atm: '<rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 10h19M6.5 15h4"/>',
  cafe: '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5V6M12 3.5V6"/>',
  nhahang: '<path d="M7 3v18M4.5 3v5a2.5 2.5 0 0 0 5 0V3M17.5 21V3c-2.2 0-3.5 3-3.5 7.5h3.5"/>',
  benhvien: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M12 8v8M8 12h8"/>',
  thuoc: '<path d="M10.5 20.5l10-10a4.95 4.95 0 0 0-7-7l-10 10a4.95 4.95 0 0 0 7 7zM8.5 8.5l7 7"/>',
  khachsan: '<path d="M3 19V6M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6"/><circle cx="7" cy="11.5" r="1.8"/>',
  suaxe: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8z"/>',
  ruaxe: '<path d="M12 3s5.5 6.2 5.5 10.5a5.5 5.5 0 0 1-11 0C6.5 9.2 12 3 12 3z"/>',
  sacdien: '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>',
  wc: '<circle cx="7.5" cy="4.5" r="1.8"/><circle cx="16.5" cy="4.5" r="1.8"/><path d="M5.5 8.5h4v7h-4zM7.5 15.5v5M16.5 8.5l-3 8h6zM15.5 16.5v4M17.5 16.5v4"/>',
  // báo cáo giao thông
  ketxe: '<path d="M2.5 16v-3l1.5-3.4a1 1 0 0 1 .9-.6h6.2a1 1 0 0 1 .9.6l1.5 3.4v3zM2.5 13h11"/><circle cx="5.5" cy="16.5" r="1.4"/><circle cx="10.5" cy="16.5" r="1.4"/><path d="M12.5 9l1-2.4a1 1 0 0 1 .9-.6h4.2a1 1 0 0 1 .9.6l2 3.9V14h-5.5"/>',
  tainan: '<path d="M12 2.5l1.8 4.7 4.9-1.6-2.4 4.5 4.6 2.3-5 .9.9 5-4-3.1-3.1 4-.6-5-5 .3 3.8-3.3-3.4-3.7 5 .6z"/>',
  csgt: '<path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z"/><path d="M12 8l1.2 2.5 2.8.4-2 1.9.5 2.7-2.5-1.3-2.5 1.3.5-2.7-2-1.9 2.8-.4z"/>',
  ngap: '<path d="M2.5 16c1.6 0 1.6-1.5 3.2-1.5s1.6 1.5 3.2 1.5 1.6-1.5 3.1-1.5 1.6 1.5 3.2 1.5 1.6-1.5 3.2-1.5 1.6 1.5 3.1 1.5M2.5 20c1.6 0 1.6-1.5 3.2-1.5s1.6 1.5 3.2 1.5 1.6-1.5 3.1-1.5 1.6 1.5 3.2 1.5 1.6-1.5 3.2-1.5 1.6 1.5 3.1 1.5"/><path d="M12 3s3.5 4 3.5 6.5a3.5 3.5 0 0 1-7 0C8.5 7 12 3 12 3z"/>',
  congtrinh: '<path d="M10 3.5h4l5 16.5H5z"/><path d="M8.2 9.5h7.6M6.6 14.5h10.8M3 20h18"/>',
  vatcan: '<path d="M12 3.5L2.5 20h19L12 3.5z"/><path d="M12 10v4.5M12 17.5v.01"/>',
  camduong: '<circle cx="12" cy="12" r="9"/><path d="M7 12h10" stroke-width="3"/>',
  // điểm cảnh báo cố định
  cameratocdo: '<rect x="3" y="5" width="12" height="7" rx="1.5"/><path d="M15 7l5-2v7l-5-2M8.5 12v8M5.5 20h6"/><circle cx="7" cy="8.5" r="1.2"/>',
  duongsat: '<path d="M5 5l14 14M19 5L5 19" stroke-width="2.6"/>',
  thuphi: '<path d="M3 20.5h18M5 20.5V9h7v11.5M4 9l4.5-4.5L13 9M12 13h9M15 13v-1M18 13v-1"/>',
  cameraden: '<rect x="3" y="3" width="6.5" height="15" rx="2"/><circle cx="6.25" cy="7" r="1.3" fill="currentColor"/><circle cx="6.25" cy="10.5" r="1.3"/><circle cx="6.25" cy="14" r="1.3"/><path d="M6.25 18v3"/><rect x="12" y="6" width="7.5" height="5.5" rx="1.2"/><path d="M19.5 7.8l2-1v3.9l-2-1M15.5 11.5V21M13 21h5"/>',
  cameratb: '<rect x="3" y="3.5" width="11" height="7" rx="1.5"/><path d="M14 5.5l5-2v7l-5-2M3 17.5h18M6 14.5l-3 3 3 3M18 14.5l3 3-3 3"/>',
  cameragiamsat: '<path d="M3 8.5l11.5-4 1.8 5-11.5 4z"/><path d="M16.3 9.5l3.2-1.1M9.5 12l1.2 3.5H5.5M5.5 13v8"/>',
  kiemtra: '<path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  tocke: '<path d="M3.5 17.5a8.5 8.5 0 1 1 17 0"/><path d="M12 17.5l4.5-5.5M6.3 12.5l1 .6M17.7 12.5l-1 .6M12 9.2v1.2"/><circle cx="12" cy="17.5" r="1.3" fill="currentColor"/>',
  cuaphai: '<path d="M7 21v-8c0-5 3.5-7.5 8.5-7.5H19"/><path d="M16 2.5l3 3-3 3"/>',
  cuatrai: '<path d="M17 21v-8c0-5-3.5-7.5-8.5-7.5H5"/><path d="M8 2.5l-3 3 3 3"/>',
  truonghoc: '<circle cx="8" cy="4.8" r="2"/><circle cx="16.5" cy="6.5" r="1.7"/><path d="M8 7.5v6l-2 6.5M8 13.5l2 6.5M4.8 11l3.2-2 3.2 2M16.5 8.7v5l-1.6 6M16.5 13.7l1.6 6M13.9 11.6l2.6-1.8 2.6 1.8"/>',
  gogiam: '<path d="M2.5 18.5h3.5c2.5 0 3.5-6.5 6-6.5s3.5 6.5 6 6.5h3.5M12 4v4.5M9.5 6.5L12 9l2.5-2.5"/>',
  ham: '<path d="M2.5 20.5h19M4 20.5v-8.5a8 8 0 0 1 16 0v8.5"/><path d="M12 20.5v-2.5M12 15.5V14"/>',
  tramdung: '<path d="M4.5 10h11v3.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M15.5 11.5h1.5a2.5 2.5 0 0 1 0 5h-2M3 21h14M8 3.5V7M12 3.5V7"/>',
  dentinhieu: '<rect x="7.5" y="2.5" width="9" height="19" rx="3"/><circle cx="12" cy="7" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="17" r="1.7"/>',
  vachqua: '<circle cx="12" cy="4.3" r="1.8"/><path d="M12 7v5l-2.5 4M12 12l2.5 4M8.8 9.5h6.4M3 20.5h3M8.5 20.5h3M14 20.5h3M19.5 20.5h1.5"/>',
  duongcam: '<circle cx="12" cy="12" r="8" stroke-width="3.4"/>',
  camoto: '<circle cx="12" cy="12" r="9"/><path d="M7.5 14.5v-2.2l1.1-2.8h6.8l1.1 2.8v2.2zM5.6 5.6l12.8 12.8"/>',
  cammoto: '<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="14" r="1.8"/><circle cx="15.5" cy="14" r="1.8"/><path d="M8.5 14l2-3.5h3l2 3.5M5.6 5.6l12.8 12.8"/>',
  camdungdo: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/>',
  camdo: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  camdole: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8M12 7.5v9"/>',
  camdochan: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8M10 7.5v9M14 7.5v9"/>',
  camvuot: '<circle cx="12" cy="12" r="9"/><path d="M6.3 15.5v-2.8l.9-2.2h3l.9 2.2v2.8zM12.9 15.5v-2.8l.9-2.2h3l.9 2.2v2.8z"/>',
  hetcamvuot: '<circle cx="12" cy="12" r="9"/><path d="M6.3 15.5v-2.8l.9-2.2h3l.9 2.2v2.8zM12.9 15.5v-2.8l.9-2.2h3l.9 2.2v2.8zM6 18L18 6"/>',
  khudancu: '<path d="M2.5 20.5h19M4 20.5V12l4.5-4 4.5 4v8.5M13 20.5v-6l3.75-3.5 3.75 3.5v6M7 20.5v-4h3v4"/>'
};

/** Mũi tên trên biển cấm rẽ / chỉ được rẽ (vẽ trong khung 24×24). */
const MUI_BIEN = {
  trai: '<path d="M15 20v-7a3 3 0 0 0-3-3H6.5M9.5 7l-3 3 3 3"/>',
  phai: '<path d="M9 20v-7a3 3 0 0 1 3-3h5.5M14.5 7l3 3-3 3"/>',
  thang: '<path d="M12 20V5M8.5 8.5L12 5l3.5 3.5"/>',
  quaydau: '<path d="M15.5 20v-9a3.75 3.75 0 0 0-7.5 0v4M5 12l3 3 3-3"/>'
};
const GACH_CAM = '<path d="M5 5l14 14"/>';
/** Tên biểu tượng biển → [mũi tên, cấm?]. */
const BIEN = {
  camretrai: ['trai', true], camrephai: ['phai', true], camquaydau: ['quaydau', true], camdithang: ['thang', true],
  chiretrai: ['trai', false], chirephai: ['phai', false], chidithang: ['thang', false]
};
for (const [ten, [mui, cam]] of Object.entries(BIEN)) P[ten] = MUI_BIEN[mui] + (cam ? GACH_CAM : '');

export function coBieuTuong(ten) { return ten in P; }

/** Tên và nội dung SVG của mọi biểu tượng (dùng để sinh biểu tượng cho ứng dụng Android / iOS). */
export function tatCaBieuTuong() { return { ...P }; }

/** SVG nét để chèn vào HTML. */
export function icon(ten, lop = '') {
  return `<svg class="ic ${lop}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[ten] || P.ghim}</svg>`;
}

// ------------------------------------------------------------------ mũi tên rẽ
const GOC = { straight: 0, 'slight right': 45, right: 90, 'sharp right': 135, 'slight left': -45, left: -90, 'sharp left': -135 };
const r1 = x => Math.round(x * 100) / 100;

function dauMuiTen(x, y, goc, dai = 3.4, rong = 3.1) {
  const t = goc * Math.PI / 180, ux = Math.sin(t), uy = -Math.cos(t);
  return `<path d="M${r1(x + ux * dai)} ${r1(y + uy * dai)}L${r1(x - uy * rong)} ${r1(y + ux * rong)}L${r1(x + uy * rong)} ${r1(y - ux * rong)}z" fill="currentColor" stroke="none"/>`;
}

function muiTenGoc(goc, coDau = true) {
  const t = goc * Math.PI / 180, ux = Math.sin(t), uy = -Math.cos(t);
  const ex = 12 + ux * 6.5, ey = 13 + uy * 6.5;
  const qx = 12 + ux * 2.5, qy = 13 + uy * 2.5;
  return `<path d="M12 22V15.5Q12 13 ${r1(qx)} ${r1(qy)}L${r1(ex)} ${r1(ey)}"/>` + (coDau ? dauMuiTen(ex, ey, goc) : '');
}

const QUAY_DAU = '<path d="M15.5 22V11a3.75 3.75 0 0 0-7.5 0v3.5"/>' + dauMuiTen(8, 14.5, 180);

function vongXuyen(goc) {
  const t = goc * Math.PI / 180, ux = Math.sin(t), uy = -Math.cos(t);
  const cx = 12, cy = 9.5, r = 4.2;
  const sx = cx + ux * r, sy = cy + uy * r, ex = cx + ux * (r + 4.3), ey = cy + uy * (r + 4.3);
  return `<circle cx="${cx}" cy="${cy}" r="${r}" stroke-opacity=".55"/><path d="M12 22V${cy + r}"/>` +
    `<path d="M${r1(sx)} ${r1(sy)}L${r1(ex)} ${r1(ey)}"/>` + dauMuiTen(ex, ey, goc, 3, 2.8);
}

const DEN_NOI = '<path d="M12 21.5s6.5-6 6.5-11a6.5 6.5 0 0 0-13 0c0 5 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.4" fill="currentColor"/>';

/** SVG mũi tên cho một bước dẫn đường. */
export function muiTenRe(b, lop = '') {
  let noiDung;
  if (!b) noiDung = muiTenGoc(0);
  else if (b.loai === 'arrive') noiDung = DEN_NOI;
  else if (b.huong === 'uturn') noiDung = QUAY_DAU;
  else if (b.loai === 'roundabout' || b.loai === 'rotary') noiDung = vongXuyen(GOC[b.huong] != null ? GOC[b.huong] : 0);
  else noiDung = muiTenGoc(GOC[b.huong] != null ? GOC[b.huong] : 0);
  return `<svg class="ic mui-ten ${lop}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${noiDung}</svg>`;
}

/** Mũi tên nhỏ cho một làn đường (OSRM lane indications). */
export function muiTenLan(chiDan) {
  const h = (chiDan || []).find(x => x !== 'none') || 'straight';
  const noiDung = h === 'uturn' ? QUAY_DAU : muiTenGoc(GOC[h] != null ? GOC[h] : 0);
  return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${noiDung}</svg>`;
}

// ------------------------------------------------------------------ ảnh cho lớp biểu tượng trên bản đồ (MapLibre)
/** Ảnh tròn màu `mau` có biểu tượng trắng ở giữa, kích thước 64×64 (hiển thị 32×32 với pixelRatio 2). */
export function svgBieuTuongBanDo(ten, mau) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 32 32" color="#fff">` +
    `<circle cx="16" cy="16" r="13.5" fill="${mau}" stroke="#fff" stroke-width="2.5"/>` +
    `<g transform="translate(6.4 6.4) scale(0.8)" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${P[ten] || P.ghim}</g></svg>`;
}

/** Biểu tượng biển báo trên bản đồ: biển cấm (nền trắng viền đỏ, gạch chéo) hoặc biển hiệu lệnh (nền xanh). */
export function svgBienBao(ten) {
  const [mui, cam] = BIEN[ten] || ['thang', true];
  const nen = cam ? '<circle cx="16" cy="16" r="13.5" fill="#fff" stroke="#d32f2f" stroke-width="3.2"/>'
    : '<circle cx="16" cy="16" r="13.5" fill="#1565c0" stroke="#fff" stroke-width="2.2"/>';
  const gach = cam ? '<path d="M7.2 7.2l17.6 17.6" stroke="#d32f2f" stroke-width="3" stroke-linecap="round"/>' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 32 32">${nen}` +
    `<g transform="translate(6.4 6.4) scale(0.8)" fill="none" stroke="${cam ? '#1f2937' : '#fff'}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${MUI_BIEN[mui]}</g>${gach}</svg>`;
}

export function laBienBao(ten) { return ten in BIEN; }

/** Biển cấm / biển báo Việt Nam vẽ như biển thật cho bản đồ: [nền, viền, nội dung]. */
const XE_HOI = (x, mau) => `<path d="M${x} 20.2v-3.4l1.1-2.7h4.2l1.1 2.7v3.4z" fill="${mau}"/><circle cx="${x + 1.6}" cy="20.4" r=".9" fill="#fff"/><circle cx="${x + 4.8}" cy="20.4" r=".9" fill="#fff"/>`;
const GACH = '<path d="M7.2 7.2l17.6 17.6" stroke="#d32f2f" stroke-width="3" stroke-linecap="round"/>';
const BIEN_CAM = {
  duongcam: ['#fff', '#d32f2f', ''],
  camduong: ['#d32f2f', '#d32f2f', '<rect x="7.5" y="13.8" width="17" height="4.4" rx="1" fill="#fff"/>'],
  camoto: ['#fff', '#d32f2f', '<path d="M9.5 19.5v-3l1.4-3.5h10.2l1.4 3.5v3z" fill="#1f2937"/>' + GACH],
  cammoto: ['#fff', '#d32f2f', '<circle cx="11" cy="19" r="2.4" fill="none" stroke="#1f2937" stroke-width="1.6"/><circle cx="21" cy="19" r="2.4" fill="none" stroke="#1f2937" stroke-width="1.6"/><path d="M11 19l3-5h4l3 5" fill="none" stroke="#1f2937" stroke-width="1.6"/>' + GACH],
  camdungdo: ['#1565c0', '#d32f2f', GACH + '<path d="M24.8 7.2L7.2 24.8" stroke="#d32f2f" stroke-width="3" stroke-linecap="round"/>'],
  camdo: ['#1565c0', '#d32f2f', GACH],
  camdole: ['#1565c0', '#d32f2f', GACH + '<path d="M16 10v12" stroke="#fff" stroke-width="2.2"/>'],
  camdochan: ['#1565c0', '#d32f2f', GACH + '<path d="M13.5 10v12M18.5 10v12" stroke="#fff" stroke-width="2.2"/>'],
  camvuot: ['#fff', '#d32f2f', XE_HOI(8.6, '#d32f2f') + XE_HOI(16.8, '#1f2937')],
  hetcamvuot: ['#fff', '#6b7280', XE_HOI(8.6, '#9ca3af') + XE_HOI(16.8, '#9ca3af') + '<path d="M8.5 23.5l15-15M10.5 25l15-15" stroke="#1f2937" stroke-width="1"/>']
};

export function laBienCam(ten) { return ten in BIEN_CAM; }

export function svgBienCam(ten) {
  const [nen, vien, noiDung] = BIEN_CAM[ten] || BIEN_CAM.duongcam;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 32 32">` +
    `<circle cx="16" cy="16" r="13.5" fill="${nen}" stroke="${vien}" stroke-width="3.6"/>${noiDung}</svg>`;
}

export const SVG_MUI_TEN_TUYEN = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 20 20">' +
  '<path d="M7 5l5 5-5 5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function taiAnh(svg) {
  return new Promise((ok, loi) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = loi;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}
