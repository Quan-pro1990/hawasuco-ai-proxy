import test from 'node:test';
import assert from 'node:assert/strict';
import { doanCanXoa, TuDongGhi } from '../public/js/camera-hanh-trinh.js';

const MB = 1024 * 1024;
const doan = (id, batDau, mb, khoa = false) => ({ id, batDau, kichThuoc: mb * MB, khoa });

test('ghi vòng: xoá đoạn cũ chưa khoá khi vượt số đoạn hoặc dung lượng', () => {
  const ds = [doan('a', 1, 100), doan('b', 2, 100, true), doan('c', 3, 100), doan('d', 4, 100), doan('e', 5, 100)];
  assert.deepEqual(doanCanXoa(ds, 10, 0), []);
  assert.deepEqual(doanCanXoa(ds, 3, 0), ['a']);                       // 4 đoạn chưa khoá > 3
  assert.deepEqual(doanCanXoa(ds, 10, 300 * MB), ['a', 'c']);          // 500 MB > 300 MB (đoạn khoá vẫn tính dung lượng)
  assert.deepEqual(doanCanXoa(ds, 10, 50 * MB), ['a', 'c', 'd']);      // luôn giữ đoạn mới nhất
  assert.deepEqual(doanCanXoa([doan('x', 1, 900)], 1, 100 * MB), []);
});

test('tự ghi khi xe chạy trên 5 km/h, tự dừng sau 20 giây đứng yên', () => {
  const tg = new TuDongGhi();
  let t = 0;
  assert.equal(tg.xet(3, { dangGhi: false, tuBat: false }, t), null);
  assert.equal(tg.xet(12, { dangGhi: false, tuBat: false }, t += 1000), 'batdau');
  assert.equal(tg.xet(0, { dangGhi: true, tuBat: true }, t += 1000), null);
  assert.equal(tg.xet(0, { dangGhi: true, tuBat: true }, t += 15000), null);
  assert.equal(tg.xet(8, { dangGhi: true, tuBat: true }, t += 1000), null);            // chạy lại: đếm lại từ đầu
  assert.equal(tg.xet(0, { dangGhi: true, tuBat: true }, t += 1000), null);
  assert.equal(tg.xet(0, { dangGhi: true, tuBat: true }, t += 19000), null);
  assert.equal(tg.xet(0, { dangGhi: true, tuBat: true }, t += 1500), 'dung');
  // đoạn do người dùng tự bấm ghi thì không tự dừng
  assert.equal(tg.xet(0, { dangGhi: true, tuBat: false }, t += 60000), null);
  // người dùng tự dừng ghi khi xe đang chạy: không tự ghi lại cho tới khi xe dừng hẳn
  tg.boQua = true;
  assert.equal(tg.xet(30, { dangGhi: false, tuBat: false }, t += 1000), null);
  assert.equal(tg.xet(0, { dangGhi: false, tuBat: false }, t += 1000), null);
  assert.equal(tg.xet(30, { dangGhi: false, tuBat: false }, t += 1000), 'batdau');
});
