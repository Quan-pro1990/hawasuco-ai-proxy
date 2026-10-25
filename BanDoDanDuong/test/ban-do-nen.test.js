import test from 'node:test';
import assert from 'node:assert/strict';
import { veTinhLai } from '../public/js/ve-tinh.js';
import { CAU_HINH } from '../public/js/cau-hinh.js';
import { BIEN_VN, docBienBaoChiTiet, soTuThe, chuBien } from '../public/js/luat-duong.js';
import { svgBienVN, laBienVN } from '../public/js/bieu-tuong.js';
import { LOAI_CANH_BAO } from '../public/js/loai-canh-bao.js';
import { oCanLamMoi, PHIEN_BAN_DIEM } from '../public/js/duong-xa.js';
import { NguonDuLieuGiaoThong, khoBoNho, CHU_KY_CAP_NHAT } from '../public/js/du-lieu-giao-thong.js';

test('bản đồ vệ tinh lai: ảnh vệ tinh dưới cùng, bỏ nền, tô lại đường và chữ, giữ biển số đường', () => {
  const kieu = {
    version: 8, glyphs: 'https://x/fonts/{fontstack}/{range}.pbf', sprite: 'https://x/sprites/ofm',
    sources: { openmaptiles: { type: 'vector', url: 'https://x/planet' }, ne2: { type: 'raster', tiles: ['https://x/{z}/{x}/{y}.png'] } },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#f8f4f0' } },
      { id: 'natural_earth', type: 'raster', source: 'ne2' },
      { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water' },
      { id: 'building-3d', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building' },
      { id: 'road_minor_casing', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', paint: { 'line-color': '#cfcdca', 'line-width': 3 } },
      { id: 'road_path_pedestrian', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', paint: { 'line-dasharray': [1, 1] } },
      { id: 'road_major_rail', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', paint: { 'line-color': '#bbb' } },
      { id: 'road_motorway', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', paint: { 'line-color': '#fc8', 'line-width': 2, 'line-opacity': 0.5 } },
      { id: 'boundary_2', type: 'line', source: 'openmaptiles', 'source-layer': 'boundary', paint: { 'line-color': '#a37', 'line-dasharray': [2, 1] } },
      { id: 'highway-name-major', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name', layout: { 'text-field': '{name}' }, paint: { 'text-color': '#765' } },
      { id: 'highway-shield', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name', layout: { 'text-field': '{ref}', 'icon-image': 'road_{ref_length}' }, paint: { 'text-color': '#333' } },
      { id: 'water_name', type: 'symbol', source: 'openmaptiles', 'source-layer': 'water_name', layout: { 'text-field': '{name}' } }
    ]
  };
  const ra = veTinhLai(null, kieu);
  assert.deepEqual(ra.layers.map(l => l.id), ['ve-tinh', 'road_motorway', 'boundary_2', 'highway-name-major', 'highway-shield', 'water_name']);
  assert.deepEqual(Object.keys(ra.sources).sort(), ['openmaptiles', 've-tinh']);
  assert.deepEqual(ra.sources['ve-tinh'].tiles, CAU_HINH.anhVeTinh.tiles);
  assert.match(ra.sources['ve-tinh'].attribution, /Esri/);
  assert.equal(ra.glyphs, kieu.glyphs);
  assert.equal(ra.sprite, kieu.sprite);
  const lop = id => ra.layers.find(l => l.id === id);
  assert.equal(lop('road_motorway').paint['line-width'], 2);
  assert.equal(lop('road_motorway').paint['line-opacity'], undefined);
  assert.equal(lop('road_motorway').paint['line-color'][0], 'match');
  assert.equal(lop('highway-name-major').paint['text-color'], '#ffffff');
  assert.equal(lop('water_name').paint['text-color'], '#b5dcff');
  assert.equal(lop('highway-shield').paint['text-color'], '#333', 'chữ trên khiên số đường giữ nguyên');
  assert.deepEqual(lop('boundary_2').paint['line-dasharray'], [2, 1]);
  assert.equal(kieu.layers.length, 12, 'không sửa kiểu gốc');
  assert.equal(CAU_HINH.kieuBanDo.vetinh.lai, true);
});

test('đọc biển báo Việt Nam kèm số ghi trên biển', () => {
  assert.deepEqual(docBienBaoChiTiet('VN:P.127[50];VN:W.207a'), [{ ma: 'P127', so: 50 }, { ma: 'W207', so: null }]);
  assert.deepEqual(docBienBaoChiTiet('VN:P.115[2,5],VN:R.122'), [{ ma: 'P115', so: 2.5 }, { ma: 'R122', so: null }]);
  assert.deepEqual(docBienBaoChiTiet('VN:W207L;VN:W.205a;VN:I.408'), [{ ma: 'W207', so: null }, { ma: 'W205A', so: null }]);
  assert.deepEqual(docBienBaoChiTiet('VN:DP.135'), [{ ma: 'DP135', so: null }]);
  assert.equal(soTuThe('tocdo', { maxspeed: '60' }), 60);
  assert.equal(soTuThe('cao', { maxheight: '3.2 m' }), 3.2);
  assert.equal(soTuThe('tai', { maxweight: '10' }), 10);
  assert.equal(soTuThe('tocdo', { maxspeed: 'VN:urban' }), null);
  assert.equal(chuBien('Hạn chế tải trọng {} tấn', 2.5), 'Hạn chế tải trọng 2,5 tấn');
});

test('mọi biển báo có hình biển thật và loại cảnh báo hợp lệ', () => {
  for (const [ma, b] of Object.entries(BIEN_VN)) {
    assert.ok(LOAI_CANH_BAO[b.loai], `${ma}: loại ${b.loai}`);
    const ten = b.so ? `bs-${b.so}-50` : b.icon;
    assert.ok(laBienVN(ten), `${ma}: chưa có hình ${ten}`);
    assert.match(svgBienVN(ten), /^<svg [^>]*viewBox="0 0 32 32"/);
    assert.ok(b.nghe && b.ten, ma);
  }
  assert.match(svgBienVN('bs-tocdo-120'), />120</);
  assert.match(svgBienVN('bs-cao-3.5'), />3,5m</);
  assert.match(svgBienVN('stop'), />STOP</);
  assert.equal(svgBienVN('bs-tocdo-abc'), null);
  assert.equal(svgBienVN('khongco'), null);
});

test('ô dữ liệu đọc bằng phiên bản cũ được tải lại để có biển báo mới', async () => {
  const bayGio = Date.now();
  assert.equal(oCanLamMoi({ capNhat: bayGio, pb: PHIEN_BAN_DIEM }, bayGio, CHU_KY_CAP_NHAT), false);
  assert.equal(oCanLamMoi({ capNhat: bayGio }, bayGio, CHU_KY_CAP_NHAT), true);
  assert.equal(oCanLamMoi({ capNhat: bayGio - CHU_KY_CAP_NHAT - 1, pb: PHIEN_BAN_DIEM }, bayGio, CHU_KY_CAP_NHAT), true);

  const kho = khoBoNho();
  await kho.luu({ khoa: '2859_1110:chinh', ma: '2859_1110', lop: 'chinh', capNhat: bayGio, dungLuc: bayGio, diem: [] });
  const nguon = new NguonDuLieuGiaoThong({ kho, layMayChu: () => null });
  nguon.lamMoiNen = () => {};
  await nguon.layNhieu(['2859_1110'], ['chinh'], bayGio);
  assert.ok(nguon.choLamMoi.has('2859_1110:chinh'), 'ô cũ chưa có phiên bản được xếp tải lại');
});
