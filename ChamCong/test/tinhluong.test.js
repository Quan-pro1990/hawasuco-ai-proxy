/* Kiểm thử lõi tính toán: node ChamCong/test/tinhluong.test.js */
'use strict';
var assert = require('assert');
var TL = require('../src/tinhluong.js');
var AL = require('../src/amlich.js');
var ok = 0;
function t(ten, fn) { fn(); ok++; console.log('  ✓ ' + ten); }

t('Âm lịch: Tết, Giỗ Tổ', function () {
  assert.deepStrictEqual(AL.amSangDuong(1, 1, 2025, 0, 7), [29, 1, 2025]);
  assert.deepStrictEqual(AL.amSangDuong(1, 1, 2026, 0, 7), [17, 2, 2026]);
  assert.deepStrictEqual(AL.amSangDuong(10, 3, 2026, 0, 7), [26, 4, 2026]);
});

t('Ngày lễ 2026 có nghỉ bù Giỗ Tổ (rơi vào Chủ nhật) và 24/11', function () {
  var ds = TL.taoNgayLe(2026, TL.caiDatMacDinh()).map(function (x) { return x.ngay; });
  ['2026-01-01', '2026-02-17', '2026-04-26', '2026-04-27', '2026-04-30', '2026-05-01', '2026-09-02', '2026-11-24'].forEach(function (d) { assert(ds.indexOf(d) >= 0, d); });
});

t('Thuế lũy tiến 5 bậc', function () {
  var b = TL.caiDatMacDinh().bieuThue;
  assert.strictEqual(TL.thueLuyTien(10e6, b), 500000);
  assert.strictEqual(TL.thueLuyTien(30e6, b), 2500000);
  assert.strictEqual(TL.thueLuyTien(60e6, b), 8500000);
  assert.strictEqual(TL.thueLuyTien(150e6, b), 38000000);
});

t('Đọc số bằng chữ', function () {
  assert.strictEqual(TL.docSo(8217091), 'Tám triệu hai trăm mười bảy nghìn không trăm chín mươi mốt đồng');
  assert.strictEqual(TL.docSo(105), 'Một trăm linh năm đồng');
});

// Dữ liệu giống bảng lương mẫu tháng 10/2026: kỳ công 21/9 – 20/10, làm thứ 2 – thứ 6 (công chuẩn 22)
function dbMau() {
  var db = TL.duLieuMoi();
  db.caiDat.ngayDauKy = 21;
  db.ngayLe = [];
  db.phongBan = [{ ma: 'KD', ten: 'Phòng Kinh doanh - Vật tư' }];
  db.nhanVien = [{ id: 'a', ma: 'NV01', hoTen: 'Nhân viên A', phongBan: 'KD', hinhThuc: 'thang', luongCB: 8000000, loaiLD: 'VP',
    thamGiaBH: true, doanVien: true, cachTinhThue: 'luy_tien', soNPT: 0, phuCap: { AN: 50000 }, ngayVao: '2020-01-01' }];
  return db;
}

t('Kỳ công 21/9 – 20/10/2026', function () {
  var db = dbMau(), ds = TL.ngayKy(db, 2026, 10);
  assert.strictEqual(ds[0].iso, '2026-09-21');
  assert.strictEqual(ds[ds.length - 1].iso, '2026-10-20');
  assert.strictEqual(ds.length, 30);
  assert.strictEqual(TL.congChuan(db, 2026, 10, db.nhanVien[0]), 22);
  assert.strictEqual(TL.congChuan(db, 2026, 10, { loaiLD: 'CN' }), 26);
  assert.deepStrictEqual(TL.kyCuaNgay(db, 2026, 10, 25), { y: 2026, m: 11 });
  assert.deepStrictEqual(TL.kyCuaNgay(db, 2026, 10, 20), { y: 2026, m: 10 });
});

t('Bảng lương khớp mẫu: 19 công thời gian + 5 SP, 2.490 HĐ, cơm 50.000/ngày, tạm ứng 2 triệu', function () {
  var db = dbMau(), nv = db.nhanVien[0];
  var ds = TL.ngayKy(db, 2026, 10), them = 0, sp = 0;
  ds.forEach(function (x) {
    var T = TL.thang(db, x.y, x.m, true), cc = T.cc[nv.id] = T.cc[nv.id] || {};
    var thu = TL.thuTrongTuan(x.y, x.m, x.d);
    if (thu === 0 || thu === 6) { if (sp < 5) { cc[x.d] = 'SP'; sp++; } return; }
    if (them < 19) { cc[x.d] = '+'; them++; } else if (sp < 5) { cc[x.d] = 'SP'; sp++; }
  });
  var T10 = TL.thang(db, 2026, 10, true);
  T10.dc[nv.id] = { slSP: 2490, tamUng: 2000000 };
  var r = TL.tinhBangLuong(db, 2026, 10).rows[0];
  assert.strictEqual(r.cong.congTG, 19);
  assert.strictEqual(r.cong.sp, 5);
  assert.strictEqual(r.cong.ngayLamThucTe, 24);
  assert.strictEqual(r.luongSP, 2988000);
  assert.strictEqual(r.luongTG, 6909091);
  assert.strictEqual(r.phuCap.AN, 1200000);
  assert.strictEqual(r.tongThuNhap, 11097091);
  assert.strictEqual(r.bhxh, 640000);
  assert.strictEqual(r.bhyt, 120000);
  assert.strictEqual(r.bhtn, 80000);
  assert.strictEqual(r.doanPhi, 40000);
  assert.strictEqual(r.thue, 0);
  assert.strictEqual(r.tongKhauTru, 880000);
  assert.strictEqual(r.thucLinh, 8217091);
});

t('Công chuẩn cố định theo loại lao động: văn phòng 22, công nhân 26 (kể cả kỳ có 23 / 27 ngày làm)', function () {
  var db = dbMau();
  // kỳ 21/10 – 20/11/2026: lịch có 23 ngày T2–T6 và 27 ngày T2–T7
  assert.strictEqual(TL.congChuan(db, 2026, 11, { loaiLD: 'VP' }), 22);
  assert.strictEqual(TL.congChuan(db, 2026, 11, { loaiLD: 'CN' }), 26);
  db.caiDat.loaiLD[0].congChuan = '';            // để trống = đếm theo lịch
  assert.strictEqual(TL.congChuan(db, 2026, 11, { loaiLD: 'VP' }), 23);
  assert.strictEqual(TL.congChuan(db, 2026, 11, { loaiLD: 'CN', congChuanRieng: 24 }), 24);
  // thứ bảy là ngày nghỉ của văn phòng, ngày làm của công nhân
  assert.strictEqual(TL.loaiNgay(db, 2026, 10, 24, {}, { loaiLD: 'VP' }), 'nghi');
  assert.strictEqual(TL.loaiNgay(db, 2026, 10, 24, {}, { loaiLD: 'CN' }), 'thuong');
});

t('Công nhân 26 công: đi làm 27 ngày được 27/26 lương, bật giới hạn thì tối đa 26', function () {
  var db = dbMau(), nv = db.nhanVien[0];
  nv.loaiLD = 'CN'; nv.luongCB = 9000000; nv.phuCap = {};
  TL.ngayKy(db, 2026, 11).forEach(function (x) {
    if (TL.thuTrongTuan(x.y, x.m, x.d) === 0) return;
    var T = TL.thang(db, x.y, x.m, true); (T.cc[nv.id] = T.cc[nv.id] || {})[x.d] = '+';
  });
  var r = TL.tinhBangLuong(db, 2026, 11).rows[0];
  assert.strictEqual(r.cong.congTG, 27);
  assert.strictEqual(r.luongTG, Math.round(9000000 / 26 * 27));
  db.caiDat.gioiHanCong = true;
  assert.strictEqual(TL.tinhBangLuong(db, 2026, 11).rows[0].luongTG, 9000000);
});

t('Lương sản phẩm nhiều loại, đơn giá riêng của người cho sản phẩm chính', function () {
  var db = dbMau(), nv = db.nhanVien[0];
  db.sanPham.push({ ma: 'DH', ten: 'Lắp đặt đồng hồ', dvt: 'cái', donGia: 85000 });
  nv.maSP = 'DH'; nv.donGiaSP = 90000;
  TL.thang(db, 2026, 10, true).dc[nv.id] = { sp: { DH: 10, HD: 500 } };
  var r = TL.tinhBangLuong(db, 2026, 10).rows[0];
  assert.strictEqual(r.slSP, 10);
  assert.strictEqual(r.luongSP, 10 * 90000 + 500 * 1200);
  assert.strictEqual(r.spChiTiet.length, 2);
});

t('Tiền cơm 50.000 đ/ngày áp dụng chung; mức riêng và 0 = không hưởng', function () {
  var db = dbMau(), nv = db.nhanVien[0];
  nv.phuCap = {}; // không nhập gì trong hồ sơ
  TL.thang(db, 2026, 10, true).cc[nv.id] = { 1: '+', 2: '+', 5: 'SP', 6: 'P', 7: '+/2' };
  var r = TL.tinhBangLuong(db, 2026, 10).rows[0];
  assert.strictEqual(r.phuCapNgay.AN, 3.5);            // +, +, SP, nửa ngày; không tính ngày phép
  assert.strictEqual(r.phuCap.AN, 175000);
  nv.phuCap = { AN: 40000 };
  assert.strictEqual(TL.tinhBangLuong(db, 2026, 10).rows[0].phuCap.AN, 140000);
  nv.phuCap = { AN: 0 };
  assert.strictEqual(TL.tinhBangLuong(db, 2026, 10).rows[0].phuCap.AN, 0);
  assert.strictEqual(TL.chuanHoa({ phuCap: [{ ma: 'AN', ten: 'Ăn ca', cachTinh: 'theo_ngay' }], nhanVien: [], caiDat: {} }).phuCap[0].mucChung, 50000);
});

t('Ngày lễ: nghỉ lễ (L) tính công, không tính cơm; đi làm (+) hoặc SP ngày lễ vẫn tính cơm', function () {
  var db = dbMau(), nv = db.nhanVien[0];
  db.ngayLe = [{ ngay: '2026-09-01', ten: 'Quốc khánh (liền kề)' }, { ngay: '2026-09-02', ten: 'Quốc khánh' }];
  // kỳ 9/2026 = 21/8 – 20/9: 31/8 đi làm, 1/9 nghỉ lễ (L), 2/9 đi làm ngày lễ (+), 3/9 đi làm, 4/9 SP
  TL.thang(db, 2026, 8, true).cc[nv.id] = { 31: '+' };
  TL.thang(db, 2026, 9, true).cc[nv.id] = { 1: 'L', 2: '+', 3: '+', 4: 'SP' };
  var r = TL.tinhBangLuong(db, 2026, 9).rows[0];
  assert.strictEqual(r.cong.congTG, 4);              // 31/8, 1/9 (L), 2/9, 3/9
  assert.strictEqual(r.cong.sp, 1);
  assert.strictEqual(r.cong.ngayCom, 4);             // 31/8, 2/9, 3/9, 4/9 – không tính 1/9 nghỉ lễ
  assert.strictEqual(r.phuCap.AN, 200000);
  // dữ liệu đã lưu từ bản trước có tuỳ chọn cũ thì bỏ đi
  assert.strictEqual(TL.chuanHoa({ phuCap: [{ ma: 'AN', ten: 'Cơm', cachTinh: 'theo_ngay', mucChung: 50000, boNgayLe: true }], nhanVien: [], caiDat: {} }).phuCap[0].boNgayLe, undefined);
});

t('Nghỉ phép tính vào công thời gian; nghỉ không lương ≥ 14 ngày thì không đóng BH', function () {
  var db = dbMau(), nv = db.nhanVien[0];
  var T = TL.thang(db, 2026, 10, true);
  T.cc[nv.id] = { 1: '+', 2: 'P' };
  var r = TL.tinhBangLuong(db, 2026, 10).rows[0];
  assert.strictEqual(r.cong.congTG, 2);
  assert.strictEqual(r.dongBH, false);
  assert.strictEqual(r.bhxh, 0);
});

t('Làm thêm giờ: phần chênh lệch không chịu thuế', function () {
  var db = TL.duLieuMoi(); db.ngayLe = [];
  var nv = { id: 'b', ma: 'B', hoTen: 'B', hinhThuc: 'thang', luongCB: 26000000, thamGiaBH: false, cachTinhThue: 'luy_tien', phuCap: {} };
  db.nhanVien = [nv];
  db.caiDat.congChuan = { cach: 'co_dinh', soNgay: 26 };
  var T = TL.thang(db, 2026, 11, true);
  T.cc.b = {}; for (var d = 1; d <= 26; d++) T.cc.b[d] = '+';
  T.ot.b = { 3: 2 }; // 3/11/2026 là thứ ba: 2 giờ × 150%
  var r = TL.tinhBangLuong(db, 2026, 11).rows[0];
  assert.strictEqual(r.luongGio, 125000);
  assert.strictEqual(r.tienOT, 375000);
  assert.strictEqual(r.otMienThue, 125000);
});

t('Giờ vào / ra', function () {
  var cd = TL.caiDatMacDinh();
  var k = TL.tinhVaoRa(cd, 'thuong', TL.phut('08:12'), TL.phut('18:10'));
  assert.strictEqual(k.kyHieu, '+'); assert.strictEqual(k.muon, 12); assert.strictEqual(k.ot, 1);
  k = TL.tinhVaoRa(cd, 'thuong', TL.phut('07:55'), TL.phut('11:30'));
  assert.strictEqual(k.kyHieu, '+/2'); assert.strictEqual(k.veSom, 330);
  k = TL.tinhVaoRa(cd, 'nghi', TL.phut('08:00'), TL.phut('12:10'));
  assert.strictEqual(k.kyHieu, ''); assert.strictEqual(k.ot, 4);
});

console.log('\n' + ok + ' nhóm kiểm thử đạt.');
