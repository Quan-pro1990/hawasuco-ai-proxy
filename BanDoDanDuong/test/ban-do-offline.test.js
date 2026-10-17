import test from 'node:test';
import assert from 'node:assert/strict';
import { oCuaDiem, demO, danhSachO, urlO, tepCuaKieu, diaChiVung, demOVung, canCapNhat } from '../public/js/ban-do-offline.js';

test('ô bản đồ chứa một điểm và số ô của khung', () => {
  assert.deepEqual(oCuaDiem(0, 0, 1), { x: 1, y: 1 });
  assert.deepEqual(oCuaDiem(-180, 85, 2), { x: 0, y: 0 });
  // Hồ Hoàn Kiếm ở mức 14 (đối chiếu với công thức chuẩn của OSM)
  assert.deepEqual(oCuaDiem(105.8522, 21.0287, 14), { x: 13009, y: 7212 });
  const khung = [105.84, 21.02, 105.86, 21.04];
  const so = demO(khung, 12, 14);
  assert.equal(so, [...danhSachO(khung, 12, 14)].length);
  assert.ok(so >= 3 && so < 30, String(so));
  assert.equal(demO(khung, 14, 14) > demO(khung, 12, 12), true);
});

test('địa chỉ ô theo mẫu, chia đều nhiều máy chủ', () => {
  assert.equal(urlO(["https://t.vn/{z}/{x}/{y}.pbf"], 14, 13009, 7212), "https://t.vn/14/13009/7212.pbf");
  assert.equal(urlO(['https://{a-c}.t.vn/{z}/{y}/{x}{r}.png'], 3, 1, 1), 'https://c.t.vn/3/1/1.png');
  assert.equal(urlO(['https://a.vn/{z}/{x}/{y}', 'https://b.vn/{z}/{x}/{y}'], 1, 0, 1), 'https://b.vn/1/0/1');
});

test('tệp cần tải của một kiểu bản đồ: ô, TileJSON, sprite, phông chữ tiếng Việt', () => {
  const map = {
    getStyle: () => ({
      sources: {
        omt: { type: 'vector', url: 'https://tiles.vn/planet' },
        hinh: { type: 'raster', tiles: ['https://anh.vn/{z}/{x}/{y}.png'], maxzoom: 19 },
        dl: { type: 'geojson', data: {} }
      },
      sprite: 'https://tiles.vn/sprites/ofm',
      glyphs: 'https://tiles.vn/fonts/{fontstack}/{range}.pbf',
      layers: [{ id: 'a', type: 'symbol', layout: { 'text-font': ['Noto Sans Regular'] } }, { id: 'b', type: 'symbol', layout: { 'text-font': ['Noto Sans Bold'] } }]
    }),
    getSource: id => (id === 'omt' ? { tiles: ['https://tiles.vn/v2/{z}/{x}/{y}.pbf'], minzoom: 0, maxzoom: 14 } : null)
  };
  const t = tepCuaKieu(map, 'https://tiles.vn/styles/liberty');
  assert.equal(t.nguon.length, 2);
  assert.deepEqual(t.nguon[0], { tiles: ['https://tiles.vn/v2/{z}/{x}/{y}.pbf'], minzoom: 0, maxzoom: 14 });
  assert.equal(t.nguon[1].maxzoom, 18);
  assert.ok(t.tepPhu.includes('https://tiles.vn/styles/liberty'));
  assert.ok(t.tepPhu.includes('https://tiles.vn/planet'));
  assert.ok(t.tepPhu.includes('https://tiles.vn/sprites/ofm@2x.png'));
  assert.ok(t.tepPhu.includes('https://tiles.vn/fonts/Noto%20Sans%20Bold/7680-7935.pbf'));   // chữ có dấu tiếng Việt
  const khung = [105.84, 21.02, 105.86, 21.04];
  const ds = diaChiVung({ ...t, khung, zTu: 13, zDen: 15 });
  // nguồn vector chỉ tới mức 14 (bản đồ tự phóng to ô mức 14), nguồn ảnh tải đủ tới 15
  assert.equal(ds.length, t.tepPhu.length + demO(khung, 13, 14) + demO(khung, 13, 15));
  assert.equal(demOVung(t.nguon, khung, 13, 15), demO(khung, 13, 14) + demO(khung, 13, 15));
  assert.ok(!ds.some(u => /\/15\/.*\.pbf$/.test(u)));
});

test('vùng cần cập nhật khi quá hạn hoặc máy chủ đổi phiên bản ô', () => {
  const bayGio = Date.UTC(2026, 9, 17);
  const v = { luc: bayGio - 5 * 86400000, nguon: [{ tiles: ['https://t.vn/v1/{z}/{x}/{y}.pbf'] }] };
  assert.equal(canCapNhat(v, [], 30, bayGio), false);
  assert.equal(canCapNhat(v, [{ tiles: ['https://t.vn/v1/{z}/{x}/{y}.pbf'] }], 30, bayGio), false);
  assert.equal(canCapNhat(v, [{ tiles: ['https://t.vn/v2/{z}/{x}/{y}.pbf'] }], 30, bayGio), true);
  assert.equal(canCapNhat({ ...v, luc: bayGio - 40 * 86400000 }, [], 30, bayGio), true);
});
