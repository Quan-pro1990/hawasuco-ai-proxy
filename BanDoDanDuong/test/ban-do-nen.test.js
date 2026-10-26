import test from 'node:test';
import assert from 'node:assert/strict';
import { veTinhLai } from '../public/js/ve-tinh.js';
import { BIEN_DOI, BANG_SANG, BANG_TOI, NHOM_DIEM, BIEU_TUONG_DIEM } from '../public/js/kieu-google.js';
import { CAU_HINH, kieuVietmap, KIEU_VIETMAP } from '../public/js/cau-hinh.js';
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
  assert.equal(CAU_HINH.kieuBanDo.vetinh.bienDoi, 'veTinh');
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

/** Kiểu thu nhỏ có đủ các nhóm lớp như Liberty của OpenFreeMap. */
function kieuMau() {
  const nguon = 'openmaptiles';
  const ten = { 'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']] };
  return {
    version: 8, glyphs: 'https://x/fonts/{fontstack}/{range}.pbf', sprite: 'https://x/sprites/ofm',
    sources: { openmaptiles: { type: 'vector', url: 'https://x/planet' }, ne2_shaded: { type: 'raster', tiles: ['https://x/{z}/{x}/{y}.png'] } },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#f8f4f0' } },
      { id: 'natural_earth', type: 'raster', source: 'ne2_shaded' },
      { id: 'park', type: 'fill', source: nguon, 'source-layer': 'park', paint: { 'fill-color': '#d8e8c8' } },
      { id: 'park_outline', type: 'line', source: nguon, 'source-layer': 'park' },
      { id: 'landuse_hospital', type: 'fill', source: nguon, 'source-layer': 'landuse', paint: { 'fill-color': '#fde' } },
      { id: 'water', type: 'fill', source: nguon, 'source-layer': 'water', paint: { 'fill-color': 'rgb(158,189,255)' } },
      { id: 'road_area_pattern', type: 'fill', source: nguon, 'source-layer': 'transportation', paint: { 'fill-pattern': 'pedestrian_polygon' } },
      { id: 'road_trunk_primary_casing', type: 'line', source: nguon, 'source-layer': 'transportation', paint: { 'line-color': '#e9ac77', 'line-width': 4 } },
      { id: 'road_trunk_primary', type: 'line', source: nguon, 'source-layer': 'transportation', paint: { 'line-color': '#fea', 'line-width': 3 } },
      { id: 'road_minor', type: 'line', source: nguon, 'source-layer': 'transportation', paint: { 'line-color': '#fff', 'line-width': 2 } },
      { id: 'road_major_rail', type: 'line', source: nguon, 'source-layer': 'transportation', paint: { 'line-color': '#bbb' } },
      { id: 'building', type: 'fill', source: nguon, 'source-layer': 'building', paint: { 'fill-color': 'hsl(35,8%,85%)' } },
      { id: 'building-3d', type: 'fill-extrusion', source: nguon, 'source-layer': 'building', paint: { 'fill-extrusion-color': 'hsl(35,8%,85%)', 'fill-extrusion-height': ['get', 'render_height'] } },
      { id: 'boundary_2', type: 'line', source: nguon, 'source-layer': 'boundary', paint: { 'line-color': '#666' } },
      { id: 'water_name_point_label', type: 'symbol', source: nguon, 'source-layer': 'water_name', layout: ten, paint: { 'text-color': '#495e91' } },
      { id: 'poi_r1', type: 'symbol', source: nguon, 'source-layer': 'poi', layout: { ...ten, 'icon-image': ['get', 'class'], 'text-anchor': 'top', 'text-offset': [0, 0.6] }, paint: { 'text-color': '#666' } },
      { id: 'highway-name-major', type: 'symbol', source: nguon, 'source-layer': 'transportation_name', layout: ten, paint: { 'text-color': '#666' } },
      { id: 'highway-shield-non-us', type: 'symbol', source: nguon, 'source-layer': 'transportation_name', layout: { 'text-field': '{ref}', 'icon-image': 'road_4' }, paint: {} },
      { id: 'label_city', type: 'symbol', source: nguon, 'source-layer': 'place', layout: { ...ten, 'icon-image': 'circle_11_black', 'text-anchor': 'bottom' }, paint: { 'text-color': '#000' } },
      { id: 'label_other', type: 'symbol', source: nguon, 'source-layer': 'place', layout: { ...ten, 'text-transform': 'uppercase', 'text-font': ['Noto Sans Italic'] }, paint: { 'text-color': '#333' } }
    ]
  };
}

test('bản đồ kiểu Google Maps: tô lại nền, nước, đường, chữ, biểu tượng địa điểm; giữ nguyên dữ liệu', () => {
  const goc = kieuMau();
  const ra = BIEN_DOI.google(null, goc);
  const lop = id => ra.layers.find(l => l.id === id);
  assert.deepEqual(ra.layers.map(l => l.id).filter(id => !lop(id)), []);
  for (const id of ['natural_earth', 'park_outline', 'road_area_pattern']) assert.equal(lop(id), undefined, id + ' phải bỏ');
  assert.deepEqual(Object.keys(ra.sources), ['openmaptiles'], 'bỏ nguồn không dùng');
  assert.equal(lop('background').paint['background-color'], BANG_SANG.dat);
  assert.equal(lop('water').paint['fill-color'], BANG_SANG.nuoc);
  assert.equal(lop('park').paint['fill-color'], BANG_SANG.congVien);
  assert.equal(lop('landuse_hospital').paint['fill-color'], BANG_SANG.benhVien);
  // đường: màu theo cấp đường (cao tốc vàng cam, quốc lộ vàng, đường nhỏ trắng viền xám), độ rộng giữ nguyên
  const mau = lop('road_trunk_primary').paint['line-color'];
  assert.equal(mau[0], 'match');
  assert.equal(mau[mau.indexOf('motorway') + 1], BANG_SANG.caoToc);
  assert.equal(mau[mau.indexOf('trunk') + 1], BANG_SANG.quocLo);
  assert.equal(lop('road_trunk_primary').paint['line-width'], 3);
  const vien = lop('road_trunk_primary_casing').paint['line-color'];
  assert.equal(vien[vien.indexOf('trunk') + 1], BANG_SANG.quocLoVien);
  assert.equal(lop('road_major_rail').paint['line-color'], BANG_SANG.duongSat);
  assert.equal(lop('building-3d').paint['fill-extrusion-color'], BANG_SANG.nha3D);
  assert.deepEqual(lop('building-3d').paint['fill-extrusion-height'], ['get', 'render_height']);
  // địa điểm: biểu tượng tròn màu theo nhóm, chữ cạnh biểu tượng, màu chữ theo nhóm
  const poi = lop('poi_r1');
  assert.equal(poi.layout['icon-image'], BIEU_TUONG_DIEM);
  assert.deepEqual(poi.layout['text-variable-anchor'], ['left', 'right']);
  assert.equal(poi.layout['text-anchor'], undefined);
  assert.equal(poi.layout['text-offset'], undefined);
  const mauPoi = poi.paint['text-color'];
  assert.equal(mauPoi[mauPoi.findIndex(x => Array.isArray(x) && x.includes('restaurant')) + 1], NHOM_DIEM.anuong[1]);
  assert.equal(mauPoi[mauPoi.length - 1], NHOM_DIEM.dichvu[1]);
  assert.equal(lop('highway-name-major').paint['text-color'], BANG_SANG.chuDuong);
  assert.equal(lop('highway-shield-non-us').layout['icon-image'], 'road_4', 'biển số đường giữ nguyên');
  assert.equal(lop('label_city').layout['icon-image'], undefined, 'bỏ chấm tròn cạnh tên thành phố');
  assert.equal(lop('label_city').paint['text-color'], BANG_SANG.chuThanhPho);
  assert.equal(lop('label_other').layout['text-transform'], 'none');
  assert.equal(lop('water_name_point_label').paint['text-color'], BANG_SANG.chuNuoc);
  assert.equal(ra.glyphs, goc.glyphs);
  assert.equal(ra.sprite, goc.sprite);
  assert.equal(goc.layers[0].paint['background-color'], '#f8f4f0', 'không sửa kiểu gốc');

  // ban đêm: cùng lớp, bảng màu tối; địa hình: thêm bóng đồi núi ngay dưới mặt nước
  const dem = BIEN_DOI.googleToi(null, kieuMau());
  assert.equal(dem.layers.find(l => l.id === 'background').paint['background-color'], BANG_TOI.dat);
  assert.deepEqual(dem.layers.map(l => l.id), ra.layers.map(l => l.id));
  const dh = BIEN_DOI.diaHinh(null, kieuMau());
  const ids = dh.layers.map(l => l.id);
  assert.equal(ids.indexOf('dia-hinh'), ids.indexOf('water') - 1);
  assert.deepEqual(dh.sources['dia-hinh'].tiles, CAU_HINH.bongDiaHinh.tiles);
  for (const k of ['tieuchuan', 'diahinh', 'bandem']) assert.ok(BIEN_DOI[CAU_HINH.kieuBanDo[k].bienDoi], k);
  assert.equal(CAU_HINH.kieuBanDo.bandem.toi, true);
});

test('mọi nhóm địa điểm có biểu tượng', async () => {
  const { coBieuTuong } = await import('../public/js/bieu-tuong.js');
  for (const [nhom, [ten]] of Object.entries(NHOM_DIEM)) assert.ok(coBieuTuong(ten), `${nhom}: thiếu biểu tượng ${ten}`);
  // vệ tinh dùng cùng biểu tượng địa điểm
  const vt = veTinhLai(null, kieuMau());
  assert.equal(vt.layers.find(l => l.id === 'poi_r1').layout['icon-image'], BIEU_TUONG_DIEM);
});

test('bản đồ VietMap chính thức: chỉ khi có khoá VietMap Maps API của người dùng', () => {
  assert.equal(kieuVietmap('vietmap', ''), null);
  assert.equal(kieuVietmap('tieuchuan', 'abc'), null);
  const k = kieuVietmap('vietmap', 'khoa của tôi');
  // đường dẫn trong tài liệu SDK của VietMap trước, đường dẫn theo mã kiểu làm dự phòng
  assert.equal(k.style, 'https://maps.vietmap.vn/api/maps/light/styles.json?apikey=khoa%20c%E1%BB%A7a%20t%C3%B4i');
  assert.deepEqual(k.styleDuPhong, ['https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=khoa%20c%E1%BB%A7a%20t%C3%B4i']);
  assert.equal(k.vietmap, true);
  assert.equal(kieuVietmap('vietmapdem', 'x').toi, true);
  assert.match(kieuVietmap('vietmapdem', 'x').style, /\/api\/maps\/dark\/styles\.json/);
  assert.match(kieuVietmap('vietmapvetinh', 'x').styleDuPhong[0], /\/styles\/hm\//);
  assert.deepEqual(Object.keys(KIEU_VIETMAP), ['vietmap', 'vietmapdem', 'vietmapvetinh']);
});
