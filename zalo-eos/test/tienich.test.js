'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { boDau, docSo, chuanKy, chuanSdt, anSdt, tienVn } = require('../src/tienich');
const { tachLenh, docKy, khopSdt } = require('../src/hoithoai');

test('bỏ dấu tiếng Việt', () => {
  assert.equal(boDau('Hóa đơn tiền nước Đợt 1'), 'HOA DON TIEN NUOC DOT 1');
});

test('đọc số kiểu Việt Nam và kiểu Anh', () => {
  assert.equal(docSo('1.234.567'), 1234567);
  assert.equal(docSo('1,234,567'), 1234567);
  assert.equal(docSo('171.000 đ'), 171000);
  assert.equal(docSo('12,5'), 12.5);
  assert.equal(docSo('12.5'), 12.5);
  assert.equal(docSo(42), 42);
  assert.equal(docSo(''), null);
  assert.equal(docSo('abc'), null);
});

test('chuẩn hoá kỳ', () => {
  for (const v of ['9/2026', '09/2026', '09-2026', '2026-09', '202609', '2026-09-01T00:00:00', 'Kỳ 1 tháng 9/2026', '15/09/2026']) {
    assert.equal(chuanKy(v), '09/2026', v);
  }
  assert.equal(chuanKy('quý 3'), 'quý 3');
  assert.equal(docKy('T9/2026'), '09/2026');
  assert.equal(docKy('KH0001'), null);
});

test('số điện thoại: chuẩn hoá, che, so khớp', () => {
  assert.equal(chuanSdt('+84 901 234 567'), '0901234567');
  assert.equal(anSdt('0901234567'), '090****567');
  assert.ok(khopSdt('0901234567', '4567'));
  assert.ok(khopSdt('0901234567', '+84901234567'));
  assert.ok(khopSdt('0291 3876 543 - 0901234567', '4567'));
  assert.ok(!khopSdt('0901234567', '1234'));
  assert.ok(!khopSdt('0901234567', '567'));
  assert.ok(!khopSdt('', '4567'));
});

test('tách lệnh có dấu / không dấu / kèm động từ', () => {
  assert.deepEqual(tachLenh('đk kh0001 4567'), { lenh: 'dk', thamSo: ['KH0001', '4567'] });
  assert.deepEqual(tachLenh('DK: KH0001, 4567'), { lenh: 'dk', thamSo: ['KH0001', '4567'] });
  assert.deepEqual(tachLenh('Tra cứu hóa đơn 9/2026'), { lenh: 'hd', thamSo: ['9/2026'] });
  assert.deepEqual(tachLenh('tra cứu'), { lenh: 'tt', thamSo: [] });
  assert.deepEqual(tachLenh('Lịch sử'), { lenh: 'ls', thamSo: [] });
  assert.deepEqual(tachLenh('huỷ đăng ký'), { lenh: 'huy', thamSo: [] });
  assert.deepEqual(tachLenh('?'), { lenh: 'menu', thamSo: [] });
  assert.equal(tachLenh('nhà tôi bị mất nước').lenh, null);
  assert.equal(tachLenh('HDSD').lenh, null);
});

test('định dạng tiền', () => {
  assert.equal(tienVn(153000), '153.000 đ');
});
