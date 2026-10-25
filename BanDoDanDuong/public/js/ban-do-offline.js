/*
 * Bản đồ offline: tải trước ô bản đồ (và style, phông chữ, biểu tượng) của một vùng vào bộ nhớ đệm của trình duyệt
 * (Cache Storage "hawamap-ban-do-tai"); service worker (sw.js) lấy ô từ đây khi mất mạng.
 * Vùng đã tải lưu trong localStorage để cập nhật lại (tự cập nhật khi có Wi-Fi) hoặc xoá.
 */
import { doc, ghi } from './kho.js';

export const KHO_TAI = 'hawamap-ban-do-tai';
/** Bộ đệm ô bản đồ đã xem (sw.js tự lưu, tự cắt bớt); xoá đi để tải lại bản đồ nền mới nhất. */
export const KHO_BAN_DO = 'hawamap-ban-do';
export const TOI_DA_O = 8000;
const SONG_SONG = 6;

/** Ô (x, y) chứa điểm [lng, lat] ở mức zoom z (lưới ô Web Mercator). */
export function oCuaDiem(lng, lat, z) {
  const n = 2 ** z;
  const r = Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI / 180;
  const x = Math.floor((lng + 180) / 360 * n);
  const y = Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n);
  return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) };
}

/** Khoảng ô phủ khung [tây, nam, đông, bắc] ở mức z. */
function khoangO(khung, z) {
  const a = oCuaDiem(khung[0], khung[3], z), b = oCuaDiem(khung[2], khung[1], z);
  return { x0: a.x, x1: b.x, y0: a.y, y1: b.y };
}

/** Số ô của khung từ mức zTu tới zDen. */
export function demO(khung, zTu, zDen) {
  let tong = 0;
  for (let z = zTu; z <= zDen; z++) {
    const k = khoangO(khung, z);
    tong += (k.x1 - k.x0 + 1) * (k.y1 - k.y0 + 1);
  }
  return tong;
}

/** Duyệt các ô [z, x, y] của khung. */
export function* danhSachO(khung, zTu, zDen) {
  for (let z = zTu; z <= zDen; z++) {
    const k = khoangO(khung, z);
    for (let x = k.x0; x <= k.x1; x++) for (let y = k.y0; y <= k.y1; y++) yield [z, x, y];
  }
}

/** Địa chỉ một ô theo mẫu ("…/{z}/{x}/{y}.pbf"); nhiều máy chủ thì chọn theo ô cho đều. */
export function urlO(tiles, z, x, y) {
  const mau = tiles[(x + y) % tiles.length];
  return mau.replace('{z}', z).replace('{x}', x).replace('{y}', y).replace('{r}', '')
    .replace(/\{([a-z])-([a-z])\}/, (_, a, b) => String.fromCharCode(a.charCodeAt(0) + (x + y) % (b.charCodeAt(0) - a.charCodeAt(0) + 1)));
}

/** Dải mã ký tự cần cho tiếng Việt trong phông chữ của style (glyphs). */
const DAI_KY_TU = ['0-255', '256-511', '768-1023', '7680-7935', '8192-8447'];

/**
 * Các nguồn ô và tệp phụ của kiểu bản đồ đang hiện.
 * @param map       bản đồ MapLibre đã tải xong style
 * @param diaChiStyle  địa chỉ style (chuỗi) hoặc null nếu style viết sẵn trong mã
 * @returns { nguon: [{ tiles, minzoom, maxzoom }], tepPhu: [địa chỉ] }
 */
export function tepCuaKieu(map, diaChiStyle) {
  const style = map.getStyle();
  const nguon = [], tepPhu = new Set();
  if (typeof diaChiStyle === 'string') tepPhu.add(diaChiStyle);
  for (const [id, s] of Object.entries(style.sources || {})) {
    if (s.type !== 'vector' && s.type !== 'raster') continue;
    const src = map.getSource(id);
    const tiles = (src && src.tiles) || s.tiles;
    if (!tiles || !tiles.length || !/^https?:/.test(tiles[0])) continue;
    if (s.url && /^https?:/.test(s.url)) tepPhu.add(s.url);          // TileJSON
    nguon.push({ tiles, minzoom: (src && src.minzoom) || s.minzoom || 0, maxzoom: Math.min((src && src.maxzoom) || s.maxzoom || 14, 18) });
  }
  const sprite = typeof style.sprite === 'string' ? [style.sprite] : (style.sprite || []).map(x => x.url);
  for (const u of sprite) if (/^https?:/.test(u)) for (const duoi of ['.json', '.png', '@2x.json', '@2x.png']) tepPhu.add(u + duoi);
  if (style.glyphs && /^https?:/.test(style.glyphs)) {
    const phong = new Set();
    for (const l of style.layers || []) {
      const f = l.layout && l.layout['text-font'];
      if (Array.isArray(f) && f.every(x => typeof x === 'string')) phong.add(f.join(','));
    }
    for (const p of phong) for (const d of DAI_KY_TU) tepPhu.add(style.glyphs.replace('{fontstack}', encodeURIComponent(p)).replace('{range}', d));
  }
  return { nguon, tepPhu: [...tepPhu] };
}

/** Tất cả địa chỉ cần tải cho một vùng. */
export function diaChiVung({ nguon, tepPhu, khung, zTu, zDen }) {
  const ds = [...tepPhu];
  for (const n of nguon) {
    const a = Math.max(zTu, n.minzoom), b = Math.min(zDen, n.maxzoom);
    for (const [z, x, y] of danhSachO(khung, a, b)) ds.push(urlO(n.tiles, z, x, y));
  }
  return ds;
}

/** Số ô (tính cả mọi nguồn) của vùng, để báo trước dung lượng. */
export function demOVung(nguon, khung, zTu, zDen) {
  let tong = 0;
  for (const n of nguon) {
    const a = Math.max(zTu, n.minzoom), b = Math.min(zDen, n.maxzoom);
    if (b >= a) tong += demO(khung, a, b);
  }
  return tong;
}

/**
 * Tải các địa chỉ vào Cache Storage. `cache: 'no-store'` để service worker không lưu thêm bản thứ hai vào bộ đệm thường.
 * @returns { so, loi, kichThuoc }
 */
export async function taiDiaChi(ds, { tienDo, tinHieu } = {}) {
  const kho = await caches.open(KHO_TAI);
  let i = 0, xong = 0, loi = 0, kichThuoc = 0;
  async function luong() {
    while (i < ds.length) {
      if (tinHieu && tinHieu.aborted) return;
      const url = ds[i++];
      try {
        const r = await fetch(url, { cache: 'no-store', mode: 'cors', credentials: 'omit', signal: tinHieu });
        if (r.ok) {
          const blob = await r.clone().blob();
          kichThuoc += blob.size;
          await kho.put(url, r);
        } else if (r.status !== 404 && r.status !== 204) loi++;
      } catch (e) {
        if (e.name === 'AbortError') return;
        loi++;
      }
      xong++;
      if (tienDo) tienDo(xong, ds.length, kichThuoc);
    }
  }
  await Promise.all(Array.from({ length: SONG_SONG }, luong));
  if (tinHieu && tinHieu.aborted) throw new DOMException('Đã huỷ', 'AbortError');
  return { so: xong, loi, kichThuoc };
}

// ------------------------------------------------------------------ danh sách vùng đã tải
export function vungDaTai() { return doc('vungtai', []); }

export function luuVung(v) {
  const ds = vungDaTai().filter(x => x.id !== v.id);
  ds.unshift(v);
  ghi('vungtai', ds);
}

/** Xoá vùng và các ô chỉ thuộc vùng đó (ô dùng chung với vùng khác giữ lại). */
export async function xoaVung(id) {
  const ds = vungDaTai();
  const v = ds.find(x => x.id === id);
  ghi('vungtai', ds.filter(x => x.id !== id));
  if (!v || typeof caches === 'undefined') return;
  const giu = new Set();
  for (const x of ds) if (x.id !== id) diaChiVung(x).forEach(u => giu.add(u));
  const kho = await caches.open(KHO_TAI);
  for (const u of diaChiVung(v)) if (!giu.has(u)) await kho.delete(u);
}

/**
 * Vùng cần tải lại: quá `ngay` ngày, hoặc máy chủ đã đổi phiên bản ô (địa chỉ ô hiện tại khác lúc tải).
 * `nguonHienTai`: nguồn ô của kiểu bản đồ đang hiện nếu cùng kiểu với vùng, không thì [].
 */
export function canCapNhat(v, nguonHienTai = [], ngay = 30, bayGio = Date.now()) {
  if (bayGio - v.luc > ngay * 86400000) return true;
  if (!nguonHienTai.length) return false;
  const cu = new Set(v.nguon.map(n => n.tiles[0]));
  return !nguonHienTai.every(n => cu.has(n.tiles[0]));
}

/**
 * Đang dùng Wi-Fi? true / false; null nếu trình duyệt không cho biết loại mạng (máy tính, iPhone).
 * Bật "tiết kiệm dữ liệu" thì coi như không dùng Wi-Fi.
 */
export function dangDungWifi() {
  const c = typeof navigator !== 'undefined' && navigator.connection;
  if (!c) return null;
  if (c.saveData) return false;
  if (c.type) return c.type === 'wifi' || c.type === 'ethernet';
  return null;
}
