import test from 'node:test';
import assert from 'node:assert/strict';
import {
  khoangCach, phuongVi, lechGoc, diemDich, chieuLenDoan, tichLuy, timChiSo, bamTuyen, diemTaiS, catTuyen, giaiMaPolyline, donGian, khungBao
} from '../public/js/hinh-hoc.js';
import { quangDuong, quangDuongNoi, thoiGian, huongLaBan, thuongDau } from '../public/js/dinh-dang.js';

test('khoảng cách Hà Nội – TP.HCM khoảng 1.140 km', () => {
  const d = khoangCach([105.8542, 21.0285], [106.7009, 10.7769]);
  assert.ok(d > 1120000 && d < 1160000, String(d));
});

test('phương vị và độ lệch góc', () => {
  assert.ok(Math.abs(phuongVi([105, 21], [106, 21]) - 90) < 1);
  assert.ok(Math.abs(phuongVi([105, 21], [105, 22]) - 0) < 0.01);
  assert.equal(lechGoc(350, 10), 20);
  assert.equal(lechGoc(10, 350), -20);
  assert.equal(lechGoc(0, 180), -180);
});

test('điểm đích cách đúng khoảng cách', () => {
  const p = [105.85, 21.03];
  const q = diemDich(p, 45, 1000);
  assert.ok(Math.abs(khoangCach(p, q) - 1000) < 0.5);
  assert.ok(Math.abs(phuongVi(p, q) - 45) < 0.1);
});

test('chiếu điểm lên đoạn thẳng', () => {
  const a = [105.85, 21.03], b = diemDich(a, 90, 200);
  const giua = diemDich(diemDich(a, 90, 100), 0, 10);
  const r = chieuLenDoan(giua, a, b);
  assert.ok(Math.abs(r.kc - 10) < 0.2, String(r.kc));
  assert.ok(Math.abs(r.t - 0.5) < 0.01);
  assert.equal(chieuLenDoan(diemDich(a, 270, 50), a, b).t, 0);
});

test('bắt điểm lên đường, cắt đường, điểm theo quãng đường', () => {
  const c = [[105.85, 21.03], [105.851, 21.03], [105.851, 21.031]];
  const cum = tichLuy(c);
  assert.equal(timChiSo(cum, 0), 0);
  assert.equal(timChiSo(cum, cum[1] + 1), 1);
  assert.equal(timChiSo(cum, cum[2] + 100), 1);
  const s = cum[1] + 30;
  const p = diemTaiS(c, cum, s);
  assert.equal(p.chiSo, 1);
  assert.ok(Math.abs(p.huong) < 0.01);
  const bam = bamTuyen(c, cum, diemDich(p.diem, 90, 5));
  assert.ok(Math.abs(bam.s - s) < 0.5 && Math.abs(bam.kc - 5) < 0.2);
  const doan = catTuyen(c, cum, 10, cum[2] - 10);
  assert.ok(Math.abs(tichLuy(doan).at(-1) - (cum[2] - 20)) < 0.5);
  assert.deepEqual(catTuyen(c, cum, 50, 40), []);
});

test('giải mã polyline (ví dụ chuẩn của Google)', () => {
  assert.deepEqual(giaiMaPolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@'), [[-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252]]);
});

test('đơn giản hoá đường giữ điểm gấp khúc', () => {
  const thang = [0, 1, 2, 3, 4].map(i => [105.85 + i * 0.001, 21.03]);
  assert.equal(donGian(thang, 2).length, 2);
  const gap = [...thang, [105.854, 21.032]];
  assert.equal(donGian(gap, 2).length, 3);
  assert.deepEqual(khungBao(gap), [[105.85, 21.03], [105.854, 21.032]]);
});

test('định dạng tiếng Việt', () => {
  assert.equal(quangDuong(43), '40 m');
  assert.equal(quangDuong(370), '350 m');
  assert.equal(quangDuong(999), '1 km');
  assert.equal(quangDuong(1234), '1,2 km');
  assert.equal(quangDuong(15600), '16 km');
  assert.equal(quangDuongNoi(180), '180 mét');
  assert.equal(quangDuongNoi(1500), '1,5 ki lô mét');
  assert.equal(thoiGian(20), '1 phút');
  assert.equal(thoiGian(3900), '1 giờ 5 phút');
  assert.equal(thoiGian(3600 * 27), '1 ngày 3 giờ');
  assert.equal(huongLaBan(0), 'Bắc');
  assert.equal(huongLaBan(135), 'Đông Nam');
  assert.equal(huongLaBan(359), 'Bắc');
  assert.equal(thuongDau('Rẽ phải'), 'rẽ phải');
});
