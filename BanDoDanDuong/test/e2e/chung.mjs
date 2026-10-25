/* Phần dùng chung cho các kiểm thử giao diện: nạp Playwright, giả lập các dịch vụ bản đồ bằng dữ liệu mẫu. */
import { createRequire } from 'node:module';
import * as mau from '../du-lieu-mau.js';

const require = createRequire(import.meta.url);
export let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  console.error('Chưa có Playwright. Cài bằng: npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

// ---------------------------------------------------------------- dữ liệu giả cho các dịch vụ ngoài
const { A, B, C, D } = mau.DIEM;
const duongNen = {
  type: 'FeatureCollection',
  features: [[A, B], [B, C], [C, D], [A, [105.8548, 21.025]], [[105.8548, 21.025], D], [[105.846, 21.0304], [105.858, 21.0304]], [[105.846, 21.0325], [105.858, 21.0325]]]
    .map(c => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: c } }))
};
const style = (toi, vector = false) => ({
  version: 8,
  ...(vector ? { glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf' } : {}),
  sources: {
    duong: { type: 'geojson', data: duongNen },
    // như OpenFreeMap: ô vector có ngày dữ liệu trong địa chỉ (ô rỗng khi kiểm thử)
    ...(vector ? { nen: { type: 'vector', tiles: ['https://tiles.openfreemap.org/planet/20251022_001001_pt/{z}/{x}/{y}.pbf'], maxzoom: 14 } } : {})
  },
  layers: [
    { id: 'nen', type: 'background', paint: { 'background-color': toi ? '#1d2330' : '#eef0e6' } },
    { id: 'duong-vien', type: 'line', source: 'duong', paint: { 'line-color': toi ? '#39414f' : '#cfd5dc', 'line-width': 16 } },
    { id: 'duong', type: 'line', source: 'duong', paint: { 'line-color': toi ? '#4a5262' : '#ffffff', 'line-width': 12 } },
    ...(vector ? [
      { id: 'water', type: 'fill', source: 'nen', 'source-layer': 'water', paint: { 'fill-color': '#9ebdff' } },
      { id: 'poi_r1', type: 'symbol', source: 'nen', 'source-layer': 'poi', layout: { 'text-field': ['get', 'name'], 'icon-image': ['get', 'class'], 'text-anchor': 'top', 'text-font': ['Noto Sans Italic'] }, paint: { 'text-color': '#666' } },
      { id: 'road_primary', type: 'line', source: 'nen', 'source-layer': 'transportation', paint: { 'line-color': '#fc8', 'line-width': 3 } },
      { id: 'highway-name-major', type: 'symbol', source: 'nen', 'source-layer': 'transportation_name', layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'] }, paint: { 'text-color': '#666' } }
    ] : [])
  ]
});
const xang = { elements: [
  { type: 'node', id: 7001, lat: 21.0262, lon: 105.8503, tags: { amenity: 'fuel', name: 'Petrolimex Cửa hàng 15', brand: 'Petrolimex', opening_hours: '24/7' } },
  { type: 'node', id: 7002, lat: 21.0281, lon: 105.8531, tags: { amenity: 'fuel', name: 'PVOil Hàng Bài' } }
] };

// ô ảnh 1×1 điểm (cho bản đồ vệ tinh)
const ANH_O = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
/** Overpass giả: điểm cảnh báo, cây xăng, đường quanh vị trí. */
function traLoiOverpass(q) {
  if (q.includes('speed_camera')) return mau.overpassDiem();
  if (q.includes('fuel')) return xang;
  if (q.includes('highway~')) return mau.overpassDuong();
  return { elements: [] };
}

/** fetch giả cho máy chủ HawaMap (kho dữ liệu giao thông gọi Overpass): không ra mạng ngoài khi kiểm thử. */
export async function layMangGia(url, o = {}) {
  return { ok: true, status: 200, json: async () => traLoiOverpass(decodeURIComponent(String(o.body || '').slice(5))) };
}

const json = (route, du) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(du), headers: { 'Access-Control-Allow-Origin': '*' } });

export async function giaLapMang(ctx) {
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (route) => {
    const url = route.request().url();
    if (/openfreemap\.org\/styles/.test(url)) return json(route, style(false, true));
    if (/voyager-gl-style/.test(url)) return json(route, style(false));
    if (/openfreemap\.org\/(planet|fonts)\/.*\.pbf$/.test(url)) return route.fulfill({ status: 200, contentType: 'application/x-protobuf', body: Buffer.alloc(0), headers: { 'Access-Control-Allow-Origin': '*' } });
    if (/dark-matter-gl-style/.test(url)) return json(route, style(true));
    if (/router\.project-osrm\.org|routing\.openstreetmap\.de/.test(url)) return json(route, mau.tuyenOsrm());
    if (/server\.arcgisonline\.com\/.*\/tile\//.test(url)) return route.fulfill({ status: 200, contentType: 'image/png', body: ANH_O, headers: { 'Access-Control-Allow-Origin': '*' } });
    if (/photon\.komoot\.io/.test(url)) return json(route, mau.photon());
    if (/nominatim.*\/reverse/.test(url)) return json(route, mau.nominatimNguoc());
    if (/nominatim.*\/search/.test(url)) return json(route, []);
    if (/api\/interpreter/.test(url)) return json(route, traLoiOverpass(decodeURIComponent((route.request().postData() || '').slice(5))));
    return route.abort();
  });
}

export const THAM_SO_TRINH_DUYET = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'];
