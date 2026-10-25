import test from 'node:test';
import assert from 'node:assert/strict';
import {
  trongDieuKien, docConditional, camPhuongTien, diNguocChieu, chieuMotChieu, camDungDo, camVuot, docBienBao, apDungTheoNgay
} from '../public/js/luat-duong.js';

const luc = (thu, gio, phut = 0) => new Date(2026, 9, 18 + thu, gio, phut);   // 18/10/2026 là Chủ nhật (thu = 0)

test('điều kiện thời gian kiểu opening_hours', () => {
  assert.equal(trongDieuKien('06:00-09:00,16:00-19:00', luc(1, 7)), true);
  assert.equal(trongDieuKien('06:00-09:00,16:00-19:00', luc(1, 12)), false);
  assert.equal(trongDieuKien('Mo-Fr 06:00-09:00', luc(1, 7)), true);
  assert.equal(trongDieuKien('Mo-Fr 06:00-09:00', luc(6, 7)), false);          // thứ Bảy
  assert.equal(trongDieuKien('Sa,Su', luc(0, 15)), true);
  assert.equal(trongDieuKien('22:00-05:00', luc(2, 23, 30)), true);           // qua nửa đêm
  assert.equal(trongDieuKien('22:00-05:00', luc(2, 6)), false);
  assert.equal(trongDieuKien('Mo-Fr 07:00-09:00; Sa 08:00-10:00', luc(6, 9)), true);
  assert.equal(trongDieuKien('wet', luc(1, 7)), null);
  assert.deepEqual(docConditional('no @ (06:00-09:00,16:00-19:00); yes @ (Su)'),
    [{ giaTri: 'no', dieuKien: '06:00-09:00,16:00-19:00' }, { giaTri: 'yes', dieuKien: 'Su' }]);
});

test('đường cấm theo loại xe và theo giờ', () => {
  assert.equal(camPhuongTien({ highway: 'primary' }, 'oto'), null);
  assert.match(camPhuongTien({ highway: 'primary', motorcar: 'no' }, 'oto').ten, /cấm ô tô/);
  assert.equal(camPhuongTien({ highway: 'primary', motorcar: 'no' }, 'xemay'), null);
  assert.match(camPhuongTien({ highway: 'primary', motor_vehicle: 'no' }, 'xemay').ten, /cấm xe máy/);
  assert.equal(camPhuongTien({ highway: 'primary', access: 'no', motorcar: 'yes' }, 'oto'), null);   // thẻ cụ thể thắng
  assert.match(camPhuongTien({ highway: 'motorway' }, 'xemay').ten, /Cao tốc cấm xe máy/);
  const theoGio = { highway: 'secondary', 'motorcar:conditional': 'no @ (06:00-09:00,16:00-19:00)' };
  const c = camPhuongTien(theoGio, 'oto', luc(1, 17));
  assert.ok(c && c.dieuKien === '06:00-09:00,16:00-19:00' && /trong giờ này/.test(c.nghe));
  assert.equal(camPhuongTien(theoGio, 'oto', luc(1, 12)), null);
  assert.equal(camPhuongTien({ motorcar: 'no' }, 'dibo'), null);
});

test('đường một chiều và đi ngược chiều', () => {
  assert.equal(chieuMotChieu({ oneway: 'yes' }, 'oto'), 1);
  assert.equal(chieuMotChieu({ oneway: '-1' }, 'oto'), -1);
  assert.equal(chieuMotChieu({ junction: 'roundabout' }, 'oto'), 1);
  assert.equal(chieuMotChieu({ highway: 'motorway' }, 'oto'), 1);
  assert.equal(chieuMotChieu({ highway: 'motorway', oneway: 'no' }, 'oto'), 0);
  assert.equal(diNguocChieu({ oneway: 'yes' }, false, 'oto'), true);
  assert.equal(diNguocChieu({ oneway: 'yes' }, true, 'oto'), false);
  assert.equal(diNguocChieu({ oneway: '-1' }, true, 'oto'), true);
  assert.equal(diNguocChieu({ oneway: 'yes', 'oneway:motorcycle': 'no' }, false, 'xemay'), false);   // xe máy được đi hai chiều
  assert.equal(diNguocChieu({ oneway: 'yes', 'oneway:motorcycle': 'no' }, false, 'oto'), true);
});

test('cấm dừng / đỗ và cấm vượt theo chiều đi', () => {
  assert.equal(camDungDo({ 'parking:both': 'no', 'parking:both:restriction': 'no_stopping' }, true), 'camdung');
  assert.equal(camDungDo({ 'parking:right': 'no' }, true), 'camdo');
  assert.equal(camDungDo({ 'parking:right': 'no' }, false), null);             // đi ngược chiều vẽ: bên phải là "left"
  assert.equal(camDungDo({ 'parking:lane:left': 'no_stopping' }, false), 'camdung');
  assert.equal(camDungDo({ 'parking:condition:both': 'no_parking' }, true), 'camdo');
  const theoGio = { 'parking:both:restriction:conditional': 'no_stopping @ (07:00-19:00)' };
  assert.equal(camDungDo(theoGio, true, luc(1, 8)), 'camdung');
  assert.equal(camDungDo(theoGio, true, luc(1, 21)), null);
  assert.equal(camDungDo({ highway: 'primary' }, true), null);
  assert.equal(camVuot({ overtaking: 'no' }, true), true);
  assert.equal(camVuot({ 'overtaking:forward': 'no' }, true), true);
  assert.equal(camVuot({ 'overtaking:forward': 'no' }, false), false);
  assert.equal(camVuot({ overtaking: 'no', 'overtaking:backward': 'yes' }, false), false);
});

test('đọc biển báo Việt Nam trong thẻ traffic_sign', () => {
  assert.deepEqual(docBienBao('VN:P.130'), ['P130']);
  assert.deepEqual(docBienBao('VN:P.131a;VN:P.125'), ['P131A', 'P125']);
  assert.deepEqual(docBienBao('VN:DP.133'), ['DP133']);
  assert.deepEqual(docBienBao('VN:P102,VN:P.127[50]'), ['P102', 'P127']);
  assert.deepEqual(docBienBao('DE:274'), []);
  assert.equal(apDungTheoNgay('le', new Date(2026, 9, 17)), true);             // ngày 17: lẻ
  assert.equal(apDungTheoNgay('chan', new Date(2026, 9, 17)), false);
  assert.equal(apDungTheoNgay(undefined), true);
});
