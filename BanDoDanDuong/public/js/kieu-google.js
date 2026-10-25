/*
 * Bản đồ kiểu Google Maps: tải kiểu "Liberty" của OpenFreeMap (dữ liệu OpenStreetMap, dựng lại mỗi tuần) rồi tô lại
 * nền, nước, cây xanh, nhà, đường, chữ và biểu tượng địa điểm theo bảng màu gần giống Google Maps.
 * Ba biến thể: sáng (Mặc định), ban đêm, địa hình (thêm bóng đồi núi). Dùng làm transformStyle của MapLibre (ban-do.js).
 * Chỉ đổi màu, phông, biểu tượng; dữ liệu và bộ lọc giữ nguyên nên luôn theo phiên bản dữ liệu mới nhất.
 */
import { CAU_HINH } from './cau-hinh.js';

export const BANG_SANG = {
  dat: '#f4f3f0', danCu: '#eeede9', nuoc: '#9dd0f2', chuNuoc: '#3d7bbd',
  congVien: '#c4e7c0', rung: '#cde6c4', co: '#d6ebcd', cat: '#f3ebcf', bang: '#eef4f7',
  benhVien: '#f8e0e0', truong: '#ece7f3', theThao: '#cfe9cd', nghiaTrang: '#d8e7d0', sanBay: '#e6e8eb',
  nha: '#e7e5e1', nhaVien: '#d8d5cf', nha3D: '#e1dfda',
  caoToc: '#fbc54e', caoTocVien: '#df9f2c', quocLo: '#fddc84', quocLoVien: '#e3b35a',
  chinh: '#fff1b5', chinhVien: '#e2cb85', phu: '#ffffff', phuVien: '#d2d5da', nho: '#ffffff', nhoVien: '#dcdfe3',
  diBo: '#c3c7cc', duongSat: '#b3b7bd', ranhGioi: '#b5b9bf', bienGioi: '#8f959c',
  chuDuong: '#5f6368', chuThanhPho: '#202124', chuDiaDanh: '#5f6368', chuTinh: '#757b82', halo: '#ffffff', chuGiaoThong: '#1967d2',
  toi: false
};

/** Ban đêm: nền xanh than, đường xám, cao tốc nâu vàng (như chế độ ban đêm của Google Maps). */
export const BANG_TOI = {
  dat: '#242f3e', danCu: '#283444', nuoc: '#17263c', chuNuoc: '#6f8fba',
  congVien: '#263c3f', rung: '#283f3e', co: '#2a4141', cat: '#38382f', bang: '#2c3a4a',
  benhVien: '#3a2f3b', truong: '#2f3147', theThao: '#29403f', nghiaTrang: '#293a37', sanBay: '#2c3646',
  nha: '#2a3546', nhaVien: '#334052', nha3D: '#2c3849',
  caoToc: '#8a7650', caoTocVien: '#1f2835', quocLo: '#746855', quocLoVien: '#1f2835',
  chinh: '#5c5a51', chinhVien: '#212a37', phu: '#3e4756', phuVien: '#212a37', nho: '#38414e', nhoVien: '#212a37',
  diBo: '#4b5563', duongSat: '#4a5568', ranhGioi: '#596373', bienGioi: '#7b8594',
  chuDuong: '#9ca5b3', chuThanhPho: '#d59563', chuDiaDanh: '#9ca5b3', chuTinh: '#8a94a6', halo: '#1d2733', chuGiaoThong: '#8ab4f8',
  toi: true
};

/** Địa hình: nền hơi xanh như bản đồ địa hình của Google, thêm bóng đồi núi. */
export const BANG_DIA_HINH = { ...BANG_SANG, dat: '#eef0e6', danCu: '#e9eae3', diaHinh: true };

/**
 * Nhóm địa điểm (lớp poi của OpenMapTiles, theo thẻ class) → [biểu tượng, màu biểu tượng, màu chữ ban đêm].
 * Màu theo cách Google Maps tô: ăn uống cam, mua sắm xanh dương, y tế đỏ, khách sạn hồng, công viên xanh lá…
 */
export const NHOM_DIEM = {
  anuong: ['nhahang', '#e8710a', '#f2a65a', ['restaurant', 'fast_food', 'food_court', 'bbq']],
  cafe: ['cafe', '#e8710a', '#f2a65a', ['cafe', 'bar', 'pub', 'beer', 'ice_cream', 'bakery']],
  muasam: ['muasam', '#1a73e8', '#8ab4f8', ['shop', 'grocery', 'alcohol_shop', 'clothing_store', 'jewelry', 'music', 'books', 'florist',
    'furniture', 'garden_centre', 'mobile_phone', 'optician', 'butcher', 'car', 'bicycle', 'hairdresser', 'laundry', 'gift', 'convenience', 'supermarket']],
  yte: ['benhvien', '#d93025', '#f28b82', ['hospital', 'doctors', 'dentist', 'clinic', 'veterinary']],
  thuoc: ['thuoc', '#d93025', '#f28b82', ['pharmacy', 'chemist']],
  khachsan: ['khachsan', '#c2185b', '#f48fb1', ['lodging', 'hotel', 'motel', 'hostel', 'guest_house']],
  truong: ['truonghoc', '#7b6b5d', '#c9b9a6', ['school', 'college', 'kindergarten', 'university', 'library']],
  congvien: ['cay', '#188038', '#81c995', ['park', 'garden', 'playground', 'campsite', 'zoo', 'golf', 'pitch', 'swimming', 'stadium', 'sports_centre']],
  giaitri: ['giaitri', '#129eaf', '#78d9ec', ['attraction', 'museum', 'art_gallery', 'cinema', 'theatre', 'castle', 'monument', 'viewpoint']],
  giaothong: ['xebuyt', '#1967d2', '#8ab4f8', ['bus', 'bus_stop', 'ferry_terminal', 'harbor', 'aerialway']],
  tau: ['duongsat', '#1967d2', '#8ab4f8', ['railway', 'rail']],
  sanbay: ['maybay', '#1967d2', '#8ab4f8', ['airport', 'aerodrome']],
  xang: ['xang', '#1a73e8', '#8ab4f8', ['fuel', 'charging_station']],
  doxe: ['doxe', '#1a73e8', '#8ab4f8', ['parking', 'bicycle_parking']],
  nganhang: ['atm', '#5f6368', '#aeb4bb', ['bank', 'atm', 'bureau_de_change']],
  tongiao: ['tongiao', '#5f6368', '#aeb4bb', ['place_of_worship']],
  wc: ['wc', '#5f6368', '#aeb4bb', ['toilets']],
  dichvu: ['coquan', '#5f6368', '#aeb4bb', []]
};

/** Tên ảnh biểu tượng địa điểm trên bản đồ (ảnh tạo trong ban-do.js bằng svgDiemBanDo). */
export const ANH_DIEM = nhom => 'gm-' + nhom;

function theoNhom(chon) {
  const kq = ['match', ['get', 'class']];
  for (const [nhom, v] of Object.entries(NHOM_DIEM)) if (v[3].length) kq.push(v[3], chon(nhom, v));
  kq.push(chon('dichvu', NHOM_DIEM.dichvu));
  return kq;
}

/** Biểu thức chọn ảnh biểu tượng theo nhóm địa điểm (dùng chung với bản đồ vệ tinh). */
export const BIEU_TUONG_DIEM = theoNhom(nhom => ANH_DIEM(nhom));
const mauChuDiem = toi => theoNhom((_, v) => toi ? v[2] : v[1]);

/** Bố cục chữ của địa điểm: chữ cạnh biểu tượng (phải, không đủ chỗ thì trái), phông thường, như Google Maps. */
export function boCucDiem(lay) {
  const { 'text-anchor': _a, 'text-offset': _o, ...con } = lay;
  return {
    ...con, 'icon-image': BIEU_TUONG_DIEM, 'icon-size': 1, 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-max-width': 8,
    'text-variable-anchor': ['left', 'right'], 'text-radial-offset': 0.95, 'text-justify': 'auto'
  };
}

const duongTheoLoai = (B, vien) => ['match', ['get', 'class'],
  'motorway', vien ? B.caoTocVien : B.caoToc,
  'trunk', vien ? B.quocLoVien : B.quocLo,
  'primary', vien ? B.chinhVien : B.chinh,
  ['secondary', 'tertiary'], vien ? B.phuVien : B.phu,
  vien ? B.nhoVien : B.nho];

const MAU_NEN = {
  park: 'congVien', landuse_residential: 'danCu', landcover_wood: 'rung', landcover_grass: 'co', landcover_wetland: 'co',
  landcover_ice: 'bang', landcover_sand: 'cat', landuse_pitch: 'theThao', landuse_track: 'theThao', landuse_cemetery: 'nghiaTrang',
  landuse_hospital: 'benhVien', landuse_school: 'truong', aeroway_fill: 'sanBay'
};

function chu(l, mau, B, them = {}) {
  return { ...l, paint: { ...(l.paint || {}), 'text-color': mau, 'text-halo-color': B.halo, 'text-halo-width': 1.5, 'text-halo-blur': 0.3, ...them } };
}

/** Tô lại một lớp; null = bỏ lớp. */
function toLop(l, B) {
  const lop = l['source-layer'] || '';
  const p = l.paint || {}, lay = l.layout || {};
  switch (l.type) {
    case 'background': return { ...l, paint: { 'background-color': B.dat } };
    case 'raster': case 'hillshade': return null;                      // bóng địa hình Natural Earth của Liberty
    case 'fill-extrusion': return { ...l, paint: { ...p, 'fill-extrusion-color': B.nha3D, 'fill-extrusion-opacity': B.toi ? 0.85 : 0.75 } };
    case 'fill': {
      if (lop === 'water') return { ...l, paint: { 'fill-color': B.nuoc } };
      if (lop === 'building') return { ...l, paint: { 'fill-color': B.nha, 'fill-outline-color': B.nhaVien } };
      if (MAU_NEN[l.id]) return { ...l, paint: { 'fill-color': B[MAU_NEN[l.id]], 'fill-opacity': 1 } };
      if (p['fill-pattern']) return null;                                // mẫu hoa văn (vùng đường đi bộ…)
      return l;
    }
    case 'line': {
      if (lop === 'waterway') return { ...l, paint: { ...p, 'line-color': B.nuoc } };
      if (lop === 'park') return null;
      if (lop === 'boundary') return { ...l, paint: { ...p, 'line-color': l.id === 'boundary_3' ? B.ranhGioi : B.bienGioi } };
      if (lop === 'aeroway') return { ...l, paint: { ...p, 'line-color': B.nho } };
      if (lop !== 'transportation') return l;
      if (/rail|transit/.test(l.id)) return { ...l, paint: { ...p, 'line-color': B.duongSat } };
      if (/path|pedestrian/.test(l.id)) return { ...l, paint: { ...p, 'line-color': /casing/.test(l.id) ? B.nhoVien : B.diBo } };
      const vien = /casing/.test(l.id);
      const paint = { ...p, 'line-color': duongTheoLoai(B, vien) };
      if (/tunnel/.test(l.id)) paint['line-opacity'] = 0.6;
      // đường nhỏ hiện từ mức phóng 12 như Google (Liberty: 13,5)
      if (l.id === 'road_minor') paint['line-width'] = ['interpolate', ['exponential', 1.2], ['zoom'], 12, 0.4, 14, 2.5, 20, 18];
      return { ...l, paint };
    }
    case 'symbol': {
      if (!lay['text-field']) return l;                                 // mũi tên đường một chiều
      if (lay['icon-image'] && (lay['icon-text-fit'] || /shield/.test(l.id))) return l;   // biển số đường (QL, cao tốc)
      if (lop === 'water_name' || lop === 'waterway') return chu(l, B.chuNuoc, B);
      if (lop === 'poi' && l.id !== 'poi_transit') {
        return chu({ ...l, layout: boCucDiem(lay) }, mauChuDiem(B.toi), B, { 'text-halo-width': 1.4 });
      }
      if (l.id === 'poi_transit' || lop === 'aerodrome_label') {
        return chu({ ...l, layout: { ...boCucDiem(lay), 'icon-image': lop === 'aerodrome_label' ? ANH_DIEM('sanbay') : BIEU_TUONG_DIEM } }, B.chuGiaoThong, B);
      }
      if (lop === 'transportation_name') return chu(l, B.chuDuong, B, { 'text-halo-width': 1.6 });
      if (lop === 'place') {
        const cls = /country|city|town/.test(l.id) ? 'chuThanhPho' : l.id === 'label_state' ? 'chuTinh' : 'chuDiaDanh';
        // bỏ chấm tròn cạnh tên thành phố, tên phường / khu không viết hoa toàn bộ
        const { 'icon-image': _i, 'icon-size': _s, 'icon-optional': _o, 'icon-allow-overlap': _a, ...con } = lay;
        const layout = { ...con, 'text-anchor': 'center', 'text-offset': [0, 0] };
        if (l.id === 'label_other') Object.assign(layout, { 'text-transform': 'none', 'text-letter-spacing': 0, 'text-font': ['Noto Sans Regular'] });
        return chu({ ...l, layout }, B[cls], B);
      }
      return chu(l, B.chuDiaDanh, B);
    }
    default: return l;
  }
}

/** Nguồn bóng đồi núi cho kiểu "Địa hình" (cau-hinh.js). */
export function nguonDiaHinh() {
  const a = CAU_HINH.bongDiaHinh;
  return { type: 'raster', tileSize: 256, maxzoom: a.maxzoom, tiles: a.tiles, attribution: a.ghiNguon };
}

/** Tạo hàm transformStyle cho một bảng màu. */
export function kieuGoogle(B) {
  return (_cu, s) => {
    const layers = [];
    for (const l of s.layers || []) {
      if (B.diaHinh && l.id === 'water') layers.push({ id: 'dia-hinh', type: 'raster', source: 'dia-hinh',
        paint: { 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.55, 12, 0.4, 16, 0.2] } });
      const m = toLop(l, B);
      if (m) layers.push(m);
    }
    const dung = new Set(layers.map(l => l.source).filter(Boolean));
    const sources = {};
    for (const [k, v] of Object.entries(s.sources || {})) if (dung.has(k)) sources[k] = v;
    if (dung.has('dia-hinh')) sources['dia-hinh'] = nguonDiaHinh();
    return { ...s, sources, layers };
  };
}

/** Hàm transformStyle theo tên trong cấu hình kiểu bản đồ (bienDoi). */
export const BIEN_DOI = {
  google: kieuGoogle(BANG_SANG),
  googleToi: kieuGoogle(BANG_TOI),
  diaHinh: kieuGoogle(BANG_DIA_HINH)
};
