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
const style = (toi) => ({
  version: 8,
  sources: { duong: { type: 'geojson', data: duongNen } },
  layers: [
    { id: 'nen', type: 'background', paint: { 'background-color': toi ? '#1d2330' : '#eef0e6' } },
    { id: 'duong-vien', type: 'line', source: 'duong', paint: { 'line-color': toi ? '#39414f' : '#cfd5dc', 'line-width': 16 } },
    { id: 'duong', type: 'line', source: 'duong', paint: { 'line-color': toi ? '#4a5262' : '#ffffff', 'line-width': 12 } }
  ]
});
const xang = { elements: [
  { type: 'node', id: 7001, lat: 21.0262, lon: 105.8503, tags: { amenity: 'fuel', name: 'Petrolimex Cửa hàng 15', brand: 'Petrolimex', opening_hours: '24/7' } },
  { type: 'node', id: 7002, lat: 21.0281, lon: 105.8531, tags: { amenity: 'fuel', name: 'PVOil Hàng Bài' } }
] };

const json = (route, du) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(du), headers: { 'Access-Control-Allow-Origin': '*' } });

export async function giaLapMang(ctx) {
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (route) => {
    const url = route.request().url();
    if (/openfreemap\.org\/styles|voyager-gl-style/.test(url)) return json(route, style(false));
    if (/dark-matter-gl-style/.test(url)) return json(route, style(true));
    if (/router\.project-osrm\.org|routing\.openstreetmap\.de/.test(url)) return json(route, mau.tuyenOsrm());
    if (/photon\.komoot\.io/.test(url)) return json(route, mau.photon());
    if (/nominatim.*\/reverse/.test(url)) return json(route, mau.nominatimNguoc());
    if (/nominatim.*\/search/.test(url)) return json(route, []);
    if (/api\/interpreter/.test(url)) {
      const q = decodeURIComponent((route.request().postData() || '').slice(5));
      if (q.includes('speed_camera')) return json(route, mau.overpassDiem());
      if (q.includes('fuel')) return json(route, xang);
      if (q.includes('highway~')) return json(route, mau.overpassDuong());
      return json(route, { elements: [] });
    }
    return route.abort();
  });
}

export const THAM_SO_TRINH_DUYET = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'];
