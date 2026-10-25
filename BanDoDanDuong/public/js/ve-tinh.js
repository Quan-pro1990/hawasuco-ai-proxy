/*
 * Bản đồ vệ tinh lai (giống chế độ "Vệ tinh" của Google Maps): ảnh vệ tinh ở dưới, phủ lên trên đường giao thông
 * bán trong suốt, ranh giới, tên đường, số nhà, địa danh, địa điểm (kèm biểu tượng) bằng tiếng Việt.
 *
 * Phần chữ và đường lấy từ kiểu bản đồ "Tiêu chuẩn" (OpenFreeMap, dữ liệu OpenStreetMap cập nhật hằng tuần):
 * MapLibre tải kiểu đó rồi gọi veTinhLai() (tuỳ chọn transformStyle) để bỏ phần nền, tô lại đường và chữ cho hợp
 * với nền ảnh. Nhờ vậy lớp chữ luôn theo phiên bản dữ liệu mới nhất, cùng phông chữ, biểu tượng với bản đồ thường.
 */
import { CAU_HINH } from './cau-hinh.js';

/** Màu đường trên nền ảnh: cao tốc vàng cam, quốc lộ / đường chính vàng nhạt, còn lại trắng mờ. */
const MAU_DUONG = ['match', ['get', 'class'],
  ['motorway'], 'rgba(255, 196, 64, 0.92)',
  ['trunk', 'primary'], 'rgba(255, 226, 120, 0.85)',
  ['secondary', 'tertiary'], 'rgba(255, 255, 255, 0.78)',
  'rgba(255, 255, 255, 0.5)'];

/** Lớp đường không vẽ trên ảnh: viền đường, hầm, đường sắt, lối đi bộ, phà, cáp treo (hẻm, đường đất vẫn vẽ). */
const BO_DUONG = /casing|tunnel|rail|transit|path|pedestrian|pier|ferry|aerialway|cable|area|construction/;

/** Chữ trắng viền tối (nước: xanh nhạt) như bản đồ vệ tinh của Google; biển số đường (chữ trên khiên) giữ nguyên. */
function chuTrenAnh(l) {
  const lay = l.layout || {};
  if (!lay['text-field'] || (lay['icon-image'] && (lay['icon-text-fit'] || /shield/.test(l.id)))) return l;
  const nuoc = /^(water_name|waterway)$/.test(l['source-layer'] || '');
  const paint = { ...(l.paint || {}), 'text-color': nuoc ? '#b5dcff' : '#ffffff', 'text-halo-color': 'rgba(0, 0, 0, 0.8)', 'text-halo-width': 1.4, 'text-halo-blur': 0.4 };
  return { ...l, paint };
}

function duongTrenAnh(l) {
  const p = l.paint || {};
  return { ...l, paint: { 'line-color': MAU_DUONG, 'line-width': p['line-width'] != null ? p['line-width'] : 1 } };
}

function ranhGioi(l) {
  return { ...l, paint: { ...(l.paint || {}), 'line-color': 'rgba(255, 255, 255, 0.75)', 'line-opacity': 1 } };
}

/** Nguồn ảnh vệ tinh (cấu hình trong cau-hinh.js). */
export function nguonAnhVeTinh() {
  const a = CAU_HINH.anhVeTinh;
  return { type: 'raster', tileSize: 256, maxzoom: a.maxzoom, tiles: a.tiles, attribution: a.ghiNguon };
}

/**
 * Biến kiểu bản đồ vector (lược đồ OpenMapTiles) thành bản đồ vệ tinh lai. Dùng làm transformStyle của MapLibre.
 * @param _cu  kiểu đang hiện (không dùng)
 * @param s    kiểu vừa tải
 */
export function veTinhLai(_cu, s) {
  const layers = [{ id: 've-tinh', type: 'raster', source: 've-tinh' }];
  for (const l of s.layers || []) {
    const lop = l['source-layer'];
    if (l.type === 'symbol') layers.push(chuTrenAnh(l));
    else if (l.type === 'line' && lop === 'transportation' && !BO_DUONG.test(l.id) && !(l.paint || {})['line-dasharray']) layers.push(duongTrenAnh(l));
    else if (l.type === 'line' && lop === 'boundary') layers.push(ranhGioi(l));
    // nền, mặt nước, rừng, công viên, nhà (cả nhà 3D), bóng địa hình… bỏ: ảnh vệ tinh đã có
  }
  const dung = new Set(layers.map(l => l.source));
  const sources = { 've-tinh': nguonAnhVeTinh() };
  for (const [k, v] of Object.entries(s.sources || {})) if (dung.has(k)) sources[k] = v;
  return { ...s, sources, layers };
}
