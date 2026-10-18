import test from 'node:test';
import assert from 'node:assert/strict';
import { baoCaoTrenTuyen, xepHangTuyen, goiYDoiTuyen, trungTuyen, phutCham } from '../public/js/dan-duong-thong-minh.js';
import { chuanHoaOsrm } from '../public/js/chi-duong.js';
import { tuyenOsrm } from './du-lieu-mau.js';

const ds = () => tuyenOsrm().routes.map(chuanHoaOsrm);   // tuyến 0: Hàng Bài – Tràng Tiền – Lý Thái Tổ (155 s); tuyến 1: Hai Bà Trưng – Đinh Lễ (190 s)
const bc = (id, loai, lng, lat, them = {}) => ({ id, loai, lng, lat, taoLuc: Date.now(), hetHan: Date.now() + 3600000, conTon: 0, ...them });

test('báo cáo nằm trên tuyến và chậm trễ ước tính', () => {
  const [t] = ds();
  const tren = baoCaoTrenTuyen(t, [
    bc('a', 'ketxe', 105.8524, 21.0304),            // trên Tràng Tiền
    bc('b', 'ketxe', 105.8524, 21.0320),            // cách tuyến ~180 m
    bc('c', 'csgt', 105.8500, 21.0270),             // CSGT không làm chậm
    bc('d', 'tainan', 105.8500, 21.0280, { hetHan: Date.now() - 1 })   // đã hết hạn
  ]);
  assert.deepEqual(tren.map(x => x.baoCao.id), ['a']);
  assert.ok(Math.abs(tren[0].s - (600 + 250)) < 30, String(tren[0].s));
  assert.equal(phutCham({ loai: 'ketxe', conTon: 0 }), 6);
  assert.equal(phutCham({ loai: 'ketxe', conTon: 4 }), 12);
  assert.equal(baoCaoTrenTuyen(t, [bc('a', 'ketxe', 105.8524, 21.0304)], { sTu: 900 }).length, 0, 'đã đi qua');
});

test('xếp hạng tuyến tránh kẹt xe theo báo cáo', () => {
  const kq = xepHangTuyen(ds(), [bc('a', 'ketxe', 105.8524, 21.0304, { conTon: 2 })]);
  assert.equal(kq[0].duongChinh.includes('Đinh Lễ') || kq[0].toaDo[1][0] > 105.85, true);
  assert.equal(kq[0].tranhBaoCao, true);
  assert.equal(kq[1].phatBaoCao, 540);                 // 6 phút × 1,5
  const binhThuong = xepHangTuyen(ds(), []);
  assert.equal(binhThuong[0].thoiGian, 155);
  assert.equal(binhThuong[0].tranhBaoCao, false);
});

test('đang dẫn đường: gợi ý đổi tuyến khi tuyến khác nhanh hơn từ 3 phút, bỏ qua tuyến trùng', () => {
  const [t0, t1] = ds();
  const ketXe = [bc('a', 'tainan', 105.8524, 21.0304, { conTon: 4 })];     // 16 phút
  const goiY = goiYDoiTuyen({ tuyen: t0, s: 100, thoiGianConLai: 140 }, xepHangTuyen([t1], ketXe), ketXe);
  assert.ok(goiY && goiY.tuyen === t1 && goiY.tietKiem > 600, JSON.stringify(goiY && goiY.tietKiem));
  assert.equal(goiYDoiTuyen({ tuyen: t0, s: 100, thoiGianConLai: 140 }, xepHangTuyen([t1], []), []), null, 'không có báo cáo phía trước');
  assert.equal(goiYDoiTuyen({ tuyen: t0, s: 100, thoiGianConLai: 140 }, xepHangTuyen([ds()[0]], ketXe), ketXe), null, 'tuyến mới trùng tuyến cũ');
  assert.equal(trungTuyen(t0, t0), true);
  assert.equal(trungTuyen(t0, t1), false);
});
