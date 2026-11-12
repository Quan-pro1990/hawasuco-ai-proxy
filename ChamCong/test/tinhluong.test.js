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
  assert.strictEqual(r.cong.congTG, 5);              // 31/8 = 1, 1/9 (L) = 1, 2/9 đi làm ngày lễ = 2, 3/9 = 1
  assert.strictEqual(r.cong.sp, 1);
  assert.strictEqual(r.cong.ngayCom, 4);             // 31/8, 2/9, 3/9, 4/9 – không tính 1/9 nghỉ lễ
  assert.strictEqual(r.phuCap.AN, 200000);
  // dữ liệu đã lưu từ bản trước có tuỳ chọn cũ thì bỏ đi
  assert.strictEqual(TL.chuanHoa({ phuCap: [{ ma: 'AN', ten: 'Cơm', cachTinh: 'theo_ngay', mucChung: 50000, boNgayLe: true }], nhanVien: [], caiDat: {} }).phuCap[0].boNgayLe, undefined);
});

t('Đi làm ngày lễ ×2 công, ngày Tết ×3 công; SP không nhân; cơm vẫn 1 ngày; nghỉ lễ L = 1 công', function () {
  var db = dbMau(), nv = db.nhanVien[0];
  db.ngayLe = TL.taoNgayLe(2026, db.caiDat);
  assert.strictEqual(TL.bangLoaiLe(db)['2026-02-17'], 'tet');
  assert.strictEqual(TL.bangLoaiLe(db)['2026-09-02'], 'le');
  // kỳ 9/2026 (21/8 – 20/9): 1/9 nghỉ lễ L, 2/9 đi làm (+), 3/9 đi làm (+), 4/9 SP
  TL.thang(db, 2026, 9, true).cc[nv.id] = { 1: 'L', 2: '+', 3: '+', 4: 'SP' };
  var r = TL.tinhBangLuong(db, 2026, 9).rows[0];
  assert.strictEqual(r.cong.congTG, 1 + 2 + 1);      // L = 1, đi làm 2/9 = 2, 3/9 = 1
  assert.strictEqual(r.cong.congThemLe, 1);
  assert.strictEqual(r.cong.ngayCom, 3);             // 2/9, 3/9, 4/9 – mỗi ngày 1 suất cơm
  assert.strictEqual(r.phuCap.AN, 150000);
  assert.strictEqual(r.luongTG, Math.round(8000000 / 22 * 4));
  // ngày SP trong kỳ 9 (4/9, ngày thường) chỉ là công SP, không vào lương thời gian
  assert.strictEqual(r.cong.sp, 1);
  // kỳ 2/2026 (21/1 – 20/2): làm SP mùng 1 Tết (17/2) = 1 công SP (không nhân), đi làm mùng 2 (18/2) = 3 công
  TL.thang(db, 2026, 2, true).cc[nv.id] = { 16: 'L', 17: 'SP', 18: '+' };
  TL.thang(db, 2026, 2, true).dc[nv.id] = { sp: { HD: 1000 } };
  r = TL.tinhBangLuong(db, 2026, 2).rows[0];
  assert.strictEqual(r.cong.sp, 1);
  assert.strictEqual(r.cong.congTG, 1 + 3);          // SP ngày Tết không có lương thời gian
  assert.strictEqual(r.cong.ngayCom, 2);
  assert.strictEqual(r.luongSP, 1000 * 1200);        // lương sản phẩm = số lượng × đơn giá, không nhân
  // giới hạn công chuẩn không cắt phần tăng thêm ngày lễ
  db.caiDat.gioiHanCong = true;
  assert.strictEqual(TL.tinhBangLuong(db, 2026, 2).rows[0].luongTG, Math.round(8000000 / 22 * 4));
  // chấm giờ vào/ra ngày lễ -> đề xuất "+" (để được nhân công), không tự cộng làm thêm
  var k = TL.tinhVaoRa(db.caiDat, 'le', TL.phut('07:55'), TL.phut('17:05'));
  assert.strictEqual(k.kyHieu, '+'); assert.strictEqual(k.ot, 0);
});

t('Nhân sự: quyết định nâng lương có hiệu lực từ kỳ sau, kỳ trước giữ lương cũ', function () {
  var db = dbMau(), nv = db.nhanVien[0];
  nv.luongCB = 9000000; // đã nâng
  nv.quyetDinh = [{ id: 'q1', loai: 'nang_luong', so: '15/QĐ', hieuLuc: '2026-10-01', luongCu: 8000000, luongMoi: 9000000 }];
  // kỳ 9 (21/8 – 20/9) kết thúc trước 1/10 -> lương cũ; kỳ 10 (21/9 – 20/10) -> lương mới
  assert.strictEqual(TL.luongTheoKy(db, nv, 2026, 9).luongCB, 8000000);
  assert.strictEqual(TL.luongTheoKy(db, nv, 2026, 10).luongCB, 9000000);
  TL.thang(db, 2026, 9, true).cc[nv.id] = { 1: '+' };
  assert.strictEqual(TL.tinhBangLuong(db, 2026, 9).rows[0].luongCB, 8000000);
  assert.strictEqual(TL.tinhBangLuong(db, 2026, 9).rows[0].bhxh, 0); // nghỉ nhiều -> không BH, chỉ kiểm tra không lỗi
  // hai lần nâng lương
  nv.luongCB = 10000000;
  nv.quyetDinh.push({ id: 'q2', loai: 'nang_luong', hieuLuc: '2027-01-01', luongCu: 9000000, luongMoi: 10000000 });
  assert.strictEqual(TL.luongTheoKy(db, nv, 2026, 9).luongCB, 8000000);
  assert.strictEqual(TL.luongTheoKy(db, nv, 2026, 12).luongCB, 9000000);
  assert.strictEqual(TL.luongTheoKy(db, nv, 2027, 1).luongCB, 10000000);
});

t('Nhân sự: người phụ thuộc theo tháng, thưởng / phạt theo quyết định vào đúng kỳ lương', function () {
  var db = dbMau(), nv = db.nhanVien[0];
  nv.soNPT = 5; // bị bỏ qua khi có danh sách
  nv.nguoiPhuThuoc = [{ hoTen: 'Con A', tuThang: '2026-01' }, { hoTen: 'Mẹ', tuThang: '2026-01', denThang: '2026-06' }, { hoTen: 'Con B', tuThang: '2026-11' }];
  assert.strictEqual(TL.soNPTKy(nv, 2026, 3), 2);
  assert.strictEqual(TL.soNPTKy(nv, 2026, 10), 1);
  assert.strictEqual(TL.soNPTKy(nv, 2026, 11), 2);
  nv.quyetDinh = [
    { loai: 'khen_thuong', soTien: 1000000, kyLuong: '2026-10' },
    { loai: 'ky_luat', soTien: 200000, kyLuong: '2026-10' },
    { loai: 'khen_thuong', soTien: 500000, kyLuong: '2026-11' }
  ];
  var ds = TL.ngayKy(db, 2026, 10);
  ds.forEach(function (x) { if ([0, 6].indexOf(TL.thuTrongTuan(x.y, x.m, x.d)) < 0) { var T = TL.thang(db, x.y, x.m, true); (T.cc[nv.id] = T.cc[nv.id] || {})[x.d] = '+'; } });
  var r = TL.tinhBangLuong(db, 2026, 10).rows[0];
  assert.strictEqual(r.thuongQD, 1000000);
  assert.strictEqual(r.phatQD, 200000);
  assert.strictEqual(r.soNPT, 1);
  assert.strictEqual(r.tongThuNhap, r.luongTG + r.tongPhuCap + 1000000);
  assert.strictEqual(r.thucLinh, r.tongThuNhap - r.tamUng - r.tongKhauTru);
  assert(r.tongKhauTru >= 200000 + r.tongBH);
});

t('Nhân sự: duyệt đơn nghỉ tự chấm vào bảng chấm công (bỏ T7, CN, lễ), huỷ duyệt thì xoá', function () {
  var db = dbMau(), nv = db.nhanVien[0];
  db.ngayLe = [{ ngay: '2026-09-02', ten: 'Quốc khánh', loai: 'le' }];
  TL.thang(db, 2026, 8, true).cc[nv.id] = { 31: '+' };
  TL.thang(db, 2026, 9, true).cc[nv.id] = { 1: 'CT' };
  var don = { id: 'd1', nvId: nv.id, tuNgay: '2026-08-31', denNgay: '2026-09-07', kyHieu: 'P' };
  // 31/8 (T2, đang +) chấm P; 1/9 đang CT giữ nguyên; 2/9 lễ bỏ; 3,4/9 P; 5,6/9 T7 CN bỏ; 7/9 P
  var kq = TL.apDungDonNghi(db, don);
  assert.deepStrictEqual(kq.cham, ['2026-08-31', '2026-09-03', '2026-09-04', '2026-09-07']);
  assert.deepStrictEqual(kq.trung, ['2026-09-01']);
  assert.strictEqual(TL.oNgay(db, 'cc', nv.id, 2026, 9, 3), 'P');
  assert.strictEqual(TL.boDonNghi(db, don), 4);
  assert.strictEqual(TL.oNgay(db, 'cc', nv.id, 2026, 9, 3), undefined);
  // kỳ đã chốt thì không chấm
  TL.chotThang(db, 2026, 9);
  kq = TL.apDungDonNghi(db, don);
  assert.strictEqual(kq.cham.length, 0); assert.strictEqual(kq.khoa.length, 5); // cả 5 ngày làm việc đều thuộc kỳ đã chốt
});

t('Nhân sự: tuổi nghỉ hưu theo lộ trình, thâm niên', function () {
  assert.strictEqual(TL.ngayNghiHuu('Nam', '1966-03-15'), '2027-12-15');   // 61 tuổi 9 tháng
  assert.strictEqual(TL.ngayNghiHuu('Nữ', '1970-05-10'), '2027-09-10');    // 57 tuổi 4 tháng
  assert.strictEqual(TL.ngayNghiHuu('Nam', '1980-01-01'), '2042-01-01');   // 62 tuổi
  assert.deepStrictEqual(TL.thamNien('2019-05-06', '2026-11-02'), { nam: 7, thang: 5, tongThang: 89 });
});

t('Mức áp dụng từ kỳ: bậc lương, tiền cơm, lương cơ sở, tạm ứng kỳ I theo chức vụ; kỳ II = phần còn lại', function () {
  var db = dbMau(), nv = db.nhanVien[0];
  db.thangLuong = [{ ma: 'T', ten: 'Bảng lương', kieu: 'tien', apDung: 'cb', namNang: 3, ngach: [{ ma: 'CV', ten: 'Chuyên viên', bac: [8000000, 9000000] }] }];
  db.caiDat.tamUng = { macDinh: 1000000, theoChucVu: [{ chucVu: 'Trưởng phòng', muc: 3000000 }] };
  // từ kỳ 11/2026: tăng bậc lương, tiền cơm 60.000, lương cơ sở mới, tạm ứng mới
  db.dotLuong = [{ id: 'd1', tuKy: '2026-11', soQD: '15/QĐ', luongCoSo: 2800000, phuCap: { AN: 60000 },
    tamUng: { macDinh: 1500000, theoChucVu: [{ chucVu: 'trưởng  PHÒNG', muc: 4000000 }] }, bang: { T: { ngach: { CV: [8500000, 9500000] } } } }];
  db = TL.chuanHoa(db);
  delete nv.phuCap.AN;  // dùng mức chung
  nv.chucVu = 'Trưởng phòng';
  nv.xepLuong = { bang: 'T', ngach: 'CV', bac: 2, ngayHuong: '2026-11-05' };
  // nâng từ bậc 1 lên bậc 2 hiệu lực 05/11/2026 (thuộc kỳ 11: 21/10 – 20/11)
  nv.quyetDinh = [{ loai: 'nang_luong', hieuLuc: '2026-11-05', luongCu: 8000000, luongMoi: 9500000, xepLuongCu: { bang: 'T', ngach: 'CV', bac: 1, ngayHuong: '2023-11-01' }, xepLuongMoi: nv.xepLuong }];
  assert.strictEqual(TL.dotTaiKy(db, '2026-10'), null);
  assert.strictEqual(TL.dotTaiKy(db, '2026-12').id, 'd1');
  assert.strictEqual(TL.luongTheoKy(db, nv, 2026, 10).luongCB, 8000000);   // bậc 1, mức ban đầu
  assert.strictEqual(TL.luongTheoKy(db, nv, 2026, 11).luongCB, 9500000);   // bậc 2, mức mới
  assert.strictEqual(TL.luongCoSoKy(db, '2026-10'), db.caiDat.luongCoSo);
  assert.strictEqual(TL.luongCoSoKy(db, '2027-03'), 2800000);
  var an = db.phuCap.filter(function (p) { return p.ma === 'AN'; })[0];
  assert.strictEqual(TL.mucChungPC(db, an, '2026-10'), 50000);
  assert.strictEqual(TL.mucChungPC(db, an, '2026-11'), 60000);
  // ảnh chụp mức tại kỳ 11 để tạo đợt sau
  var ch = TL.chupMucKy(db, '2026-11');
  assert.deepStrictEqual(ch.bang.T.ngach.CV, [8500000, 9500000]); assert.strictEqual(ch.phuCap.AN, 60000); assert.strictEqual(ch.tamUng.theoChucVu[0].muc, 4000000);
  // chấm công 3 ngày mỗi kỳ
  TL.thang(db, 2026, 10, true).cc[nv.id] = { 1: '+', 2: '+', 5: '+' };
  TL.thang(db, 2026, 11, true).cc[nv.id] = { 3: '+', 4: '+', 5: '+' };
  var r10 = TL.tinhBangLuong(db, 2026, 10).rows[0], r11 = TL.tinhBangLuong(db, 2026, 11).rows[0];
  assert.strictEqual(r10.tamUng, 3000000); assert.ok(r10.tamUngTuDong);
  assert.strictEqual(r11.tamUng, 4000000);                                   // chức vụ khớp không phân biệt hoa thường, dấu cách
  assert.strictEqual(r10.phuCap.AN, 150000); assert.strictEqual(r11.phuCap.AN, 180000);
  assert.strictEqual(r11.thucLinh, Math.round((r11.tongThuNhap - r11.tamUng - r11.tongKhauTru) / (db.caiDat.lamTron || 1)) * (db.caiDat.lamTron || 1));
  // chức vụ khác: mức chung; mức riêng trong hồ sơ; nhập tay kỳ này (kể cả 0)
  nv.chucVu = 'Nhân viên';
  assert.strictEqual(TL.tinhBangLuong(db, 2026, 10).rows[0].tamUng, 1000000);
  assert.strictEqual(TL.tinhBangLuong(db, 2026, 11).rows[0].tamUng, 1500000);
  nv.tamUngRieng = 2500000;
  assert.strictEqual(TL.tinhBangLuong(db, 2026, 11).rows[0].tamUng, 2500000);
  TL.thang(db, 2026, 11, true).dc[nv.id] = { tamUng: 0 };
  var r = TL.tinhBangLuong(db, 2026, 11).rows[0];
  assert.strictEqual(r.tamUng, 0); assert.ok(!r.tamUngTuDong); assert.strictEqual(r.tamUngMacDinh, 2500000);
  // tiền ăn giữa ca: 26 ngày × 50.000 = 1.300.000, vượt mức miễn thuế 1.200.000 → 100.000 chịu thuế (như bảng lương các đội)
  TL.thang(db, 2026, 11, true).cc[nv.id] = {};
  TL.ngayKy(db, 2026, 11).forEach(function (x) { if (TL.thuTrongTuan(x.y, x.m, x.d) !== 0) (TL.thang(db, x.y, x.m, true).cc[nv.id] = TL.thang(db, x.y, x.m, true).cc[nv.id] || {})[x.d] = '+'; });
  db.dotLuong[0].phuCap.AN = 50000; db.dotLuong[0].mienThueAnCa = 1200000;
  r = TL.tinhBangLuong(db, 2026, 11).rows[0];
  assert.strictEqual(r.phuCap.AN, r.cong.ngayCom * 50000);
  assert.strictEqual(r.anCaVuot, Math.max(0, r.phuCap.AN - 1200000));
  assert.strictEqual(r.tnct, r.tongThuNhap - (r.phuCap.AN - r.anCaVuot) - r.otMienThue);
  db.dotLuong[0].mienThueAnCa = 730000;   // mức cũ (trước 01/7/2026)
  assert.strictEqual(TL.tinhBangLuong(db, 2026, 11).rows[0].anCaVuot, r.phuCap.AN - 730000);
  // không có công hưởng lương: không tự tạm ứng
  delete nv.tamUngRieng; TL.thang(db, 2026, 12, true);
  assert.strictEqual(TL.tinhBangLuong(db, 2026, 12).rows[0].tamUng, 0);
});

t('Làm thêm giờ chi bảng riêng: không gộp vào lãnh kỳ II (thuế vẫn tính cả tháng); khối bảng lương theo phòng / đội', function () {
  var db = dbMau(), nv = db.nhanVien[0];
  db.phongBan.push({ ma: 'D1', ten: 'Đội Cấp nước số 1', loai: 'doi' }, { ma: 'TC', ten: 'Phòng TC-KH', khoi: 'Văn phòng công ty' }, { ma: 'X', ten: 'Đội tạm', loai: 'doi', ngung: true });
  db = TL.chuanHoa(db);
  TL.thang(db, 2026, 10, true).cc[nv.id] = { 1: '+', 2: '+' };
  TL.thang(db, 2026, 10, true).ot[nv.id] = { 1: 2 };
  db.caiDat.otTraRieng = false; var a = TL.tinhBangLuong(db, 2026, 10).rows[0];
  db.caiDat.otTraRieng = true; var b = TL.tinhBangLuong(db, 2026, 10).rows[0];
  assert.ok(a.tienOT > 0); assert.strictEqual(a.otRieng, 0); assert.strictEqual(b.otRieng, b.tienOT);
  assert.strictEqual(a.thucLinh - b.thucLinh, b.tienOT); assert.strictEqual(a.thue, b.thue);
  assert.strictEqual(TL.khoiCuaDV(db, 'KD'), 'Văn phòng công ty');
  assert.strictEqual(TL.khoiCuaDV(db, 'D1'), 'Đội Cấp nước số 1');
  assert.deepStrictEqual(TL.dsKhoi(db), ['Văn phòng công ty', 'Đội Cấp nước số 1']);
  assert.strictEqual(TL.thongTinKhoi(db, 'Đội Cấp nước số 1').tieuDe, 'BẢNG THANH TOÁN TIỀN LƯƠNG ĐỘI CẤP NƯỚC SỐ 1');
  db.khoiLuong['Đội Cấp nước số 1'] = { nganHang: 'Ngân hàng Nông nghiệp – Chi nhánh Hậu Giang', soTK: '7001' };
  assert.strictEqual(TL.thongTinKhoi(db, 'Đội Cấp nước số 1').soTK, '7001');
  assert.strictEqual(b.khoi, 'Văn phòng công ty');
});

t('Chuyển chức danh trong thang bảng lương từ một kỳ: kỳ trước giữ chức danh cũ', function () {
  var db = dbMau(), nv = db.nhanVien[0];
  db.thangLuong = [{ ma: 'T', ten: 'Bảng lương', kieu: 'tien', apDung: 'cb', ngach: [
    { ma: 'TP', ten: 'Trưởng phòng', soBac: 2, bac: [14000000, 15000000] }, { ma: 'DT', ten: 'Đội trưởng', soBac: 2, bac: [13000000, 14500000] }] }];
  db = TL.chuanHoa(db);
  // đang Trưởng phòng bậc 2; quyết định chuyển sang Đội trưởng bậc 2 hiệu lực 21/10/2026 (đầu kỳ 11)
  nv.xepLuong = { bang: 'T', ngach: 'DT', bac: 2, ngayHuong: '2024-01-01' };
  nv.quyetDinh = [{ loai: 'nang_luong', hieuLuc: '2026-10-21', luongCu: 15000000, luongMoi: 14500000,
    xepLuongCu: { bang: 'T', ngach: 'TP', bac: 2, ngayHuong: '2024-01-01' }, xepLuongMoi: nv.xepLuong }];
  assert.strictEqual(TL.xepLuongTheoKy(db, nv, 2026, 10).ngach, 'TP');
  assert.strictEqual(TL.xepLuongTheoKy(db, nv, 2026, 11).ngach, 'DT');
  assert.strictEqual(TL.luongTheoKy(db, nv, 2026, 10).luongCB, 15000000);
  assert.strictEqual(TL.luongTheoKy(db, nv, 2026, 11).luongCB, 14500000);
  assert.strictEqual(TL.xepLuongNV(db, nv).ngayHuong, '2024-01-01');   // giữ thời gian hưởng bậc khi chỉ đổi chức danh
});

t('Phòng / đội: chuyển qua lại có hiệu lực theo kỳ, kỳ cũ vẫn thuộc đơn vị cũ', function () {
  var db = dbMau(), nv = db.nhanVien[0];
  db.phongBan = [{ ma: 'KD', ten: 'Phòng Kinh doanh - Vật tư' }, { ma: 'D1', ten: 'Đội Cấp nước số 1' }];
  db = TL.chuanHoa(db);
  assert.strictEqual(db.phongBan[1].loai, 'doi');
  // chuyển sang đội từ 1/10/2026, rồi chuyển về phòng từ 1/12/2026
  nv.phongBan = 'KD'; nv.chucVu = 'Nhân viên';
  nv.quyetDinh = [
    { loai: 'dieu_chuyen', hieuLuc: '2026-10-01', phongBanCu: 'KD', phongBanMoi: 'D1', chucVuCu: 'Nhân viên', chucVuMoi: 'Tổ trưởng' },
    { loai: 'dieu_chuyen', hieuLuc: '2026-12-01', phongBanCu: 'D1', phongBanMoi: 'KD', chucVuCu: 'Tổ trưởng', chucVuMoi: 'Nhân viên' }
  ];
  assert.strictEqual(TL.donViTheoKy(db, nv, 2026, 9).phongBan, 'KD');      // kỳ 21/8 – 20/9
  assert.strictEqual(TL.donViTheoKy(db, nv, 2026, 10).phongBan, 'D1');     // kỳ 21/9 – 20/10
  assert.strictEqual(TL.donViTheoKy(db, nv, 2026, 10).chucVu, 'Tổ trưởng');
  assert.strictEqual(TL.donViTheoKy(db, nv, 2026, 12).phongBan, 'KD');
  TL.thang(db, 2026, 10, true).cc[nv.id] = { 1: '+' };
  var r = TL.tinhBangLuong(db, 2026, 10).rows[0];
  assert.strictEqual(r.phongBan, 'D1'); assert.strictEqual(r.tenPhongBan, 'Đội Cấp nước số 1');
});

t('Thang, bảng lương: bậc theo mức tiền / hệ số, áp vào mức lương, hạn nâng bậc', function () {
  var db = dbMau(), nv = db.nhanVien[0];
  db.caiDat.luongCoSo = 2340000;
  db.thangLuong = [
    { ma: 'T', ten: 'Bảng lương công ty', kieu: 'tien', apDung: 'cb', namNang: 3, ngach: [{ ma: 'CV', ten: 'Chuyên viên', bac: [7500000, 8000000, 8500000] }, { ma: 'CN', ten: 'Công nhân', namNang: 2, bac: [7000000, 7500000] }] },
    { ma: 'H', ten: 'Bảng hệ số', kieu: 'he_so', apDung: 'bh', ngach: [{ ma: 'KS', ten: 'Kỹ sư', bac: [2.34, 2.67, 3.0] }] }
  ];
  db = TL.chuanHoa(db);
  assert.strictEqual(db.thangLuong[0].soBac, 3);
  assert.deepStrictEqual(db.thangLuong[0].ngach[1].bac, [7000000, 7500000, '']);
  assert.strictEqual(TL.soBacNgach(db.thangLuong[0].ngach[1]), 2);
  // mức tiền, dùng cho mức lương
  nv.hinhThuc = 'thang'; nv.luongCB = 1; nv.luongBH = 0;
  nv.xepLuong = { bang: 'T', ngach: 'CV', bac: 2, ngayHuong: '2024-02-29' };
  var xl = TL.xepLuongNV(db, nv);
  assert.strictEqual(xl.tien, 8000000); assert.strictEqual(xl.ngayNang, '2027-02-28'); assert.strictEqual(xl.bacSau.tien, 8500000);
  assert.deepStrictEqual(TL.apXepLuong(db, nv), { luongCB: [1, 8000000] });
  assert.strictEqual(nv.luongCB, 8000000); assert.strictEqual(nv.luongBH, 0);
  // kỷ luật kéo dài thời hạn nâng lương: +6 tháng
  nv.quyetDinh = [{ loai: 'ky_luat', hieuLuc: '2025-05-01', hinhThuc: 'Kéo dài thời hạn nâng lương không quá 6 tháng' }];
  assert.strictEqual(TL.xepLuongNV(db, nv).ngayNang, '2027-08-29');
  // bậc cuối: không còn hạn nâng
  nv.xepLuong.bac = 3; assert.strictEqual(TL.xepLuongNV(db, nv).ngayNang, ''); assert.ok(TL.xepLuongNV(db, nv).bacCuoi);
  // số bậc riêng từng chức danh: bớt Chuyên viên còn 2 bậc thì bậc 3 bỏ qua, bậc 2 là bậc cuối
  assert.strictEqual(db.thangLuong[0].ngach[0].soBac, 3); assert.strictEqual(db.thangLuong[0].ngach[1].soBac, 2);
  db.thangLuong[0].ngach[0].soBac = 2; TL.chuanBangLuong(db.thangLuong[0]);
  assert.strictEqual(TL.soBacNgach(db.thangLuong[0].ngach[0]), 2); assert.strictEqual(db.thangLuong[0].soBac, 2);
  assert.strictEqual(TL.giaTriBac(db, db.thangLuong[0], db.thangLuong[0].ngach[0], 3), null);
  nv.xepLuong.bac = 2; assert.ok(TL.xepLuongNV(db, nv).bacCuoi); assert.strictEqual(TL.xepLuongNV(db, nv).ngayNang, '');
  // thêm lại thành 3 bậc: cột mới trống cho tới khi nhập giá trị
  db.thangLuong[0].ngach[0].soBac = 3; TL.chuanBangLuong(db.thangLuong[0]);
  assert.strictEqual(db.thangLuong[0].soBac, 3); assert.strictEqual(TL.soBacNgach(db.thangLuong[0].ngach[0]), 2);
  db.thangLuong[0].ngach[0].bac[2] = 8500000; assert.strictEqual(TL.soBacNgach(db.thangLuong[0].ngach[0]), 3);
  // hệ số × lương cơ sở, chỉ dùng cho lương đóng BH
  nv.quyetDinh = []; nv.xepLuong = { bang: 'H', ngach: 'KS', bac: 2, ngayHuong: '2025-01-01' };
  xl = TL.xepLuongNV(db, nv);
  assert.strictEqual(xl.heSo, 2.67); assert.strictEqual(xl.tien, 6247800); assert.strictEqual(xl.ngayNang, '2028-01-01');
  TL.apXepLuong(db, nv);
  assert.strictEqual(nv.luongCB, 8000000); assert.strictEqual(nv.luongBH, 6247800);
  // lương ngày / giờ: không ghi đè mức lương bằng mức tháng
  db.thangLuong[1].apDung = 'ca_hai'; nv.hinhThuc = 'ngay'; nv.luongCB = 300000;
  TL.apXepLuong(db, nv); assert.strictEqual(nv.luongCB, 300000);
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

t('Thử việc: 85% lương chính thức, số tháng, kỳ có cả ngày thử việc và chính thức, không đóng BH', function () {
  assert.strictEqual(TL.denNgayThuViec('2026-10-01', 2), '2026-11-30');
  assert.strictEqual(TL.denNgayThuViec('2026-10-15', 2), '2026-12-14');
  assert.strictEqual(TL.denNgayThuViec('2026-01-31', 1), '2026-02-28');
  assert.strictEqual(TL.denNgayThuViec('2026-03-01', 1), '2026-03-31');
  var db = TL.duLieuMoi(); db.ngayLe = [];
  db.caiDat.congChuan = { cach: 'co_dinh', soNgay: 26 };
  var nv = { id: 'tv', ma: 'TV', hoTen: 'Thử Việc', hinhThuc: 'thang', luongCB: 10000000, thamGiaBH: true, cachTinhThue: 'khong', phuCap: {},
    ngayVao: '2026-10-01', trangThai: 'thu_viec', thuViec: { tuNgay: '2026-10-01', soThang: 2 } };
  db.nhanVien = [nv];
  function chamDu(m) { var T = TL.thang(db, 2026, m, true); T.cc.tv = {}; for (var d = 1; d <= 26; d++) T.cc.tv[d] = '+'; }
  [10, 11, 12].forEach(chamDu);
  assert.deepStrictEqual(TL.thuViecNV(db, nv), { tuNgay: '2026-10-01', denNgay: '2026-11-30', soThang: 2, tiLe: 85 });
  assert.ok(TL.dangThuViec(db, nv, '2026-11-30')); assert.ok(!TL.dangThuViec(db, nv, '2026-12-01'));
  // cả kỳ thử việc: 85% lương, không đóng BH (không cảnh báo)
  var r = TL.tinhBangLuong(db, 2026, 10).rows[0];
  assert.strictEqual(r.luongTG, 8500000); assert.strictEqual(r.tiLeHuong, 85); assert.ok(r.thuViec.toanKy);
  assert.strictEqual(r.dongBH, false); assert.strictEqual(r.tongBH, 0); assert.deepStrictEqual(r.canhBao, []);
  // hết thử việc: 100%, đóng BH
  r = TL.tinhBangLuong(db, 2026, 12).rows[0];
  assert.strictEqual(r.luongTG, 10000000); assert.strictEqual(r.thuViec, null); assert.strictEqual(r.bhxh, 800000);
  // thử việc đến 10/11: 10 công × 85% + 16 công × 100%; còn 10 ngày thuộc thử việc (< 14) nên vẫn đóng BH
  nv.thuViec.denNgay = '2026-11-10';
  r = TL.tinhBangLuong(db, 2026, 11).rows[0];
  assert.strictEqual(r.thuViec.congTV, 10); assert.strictEqual(r.thuViec.congCT, 16); assert.ok(!r.thuViec.toanKy);
  assert.strictEqual(r.luongTG, Math.round(10000000 / 26 * (10 * 0.85 + 16)));
  assert.strictEqual(r.dongBH, true);
  // thử việc đến 20/11: 20 công thử việc (≥ 14) -> không đóng BH tháng 11
  nv.thuViec.denNgay = '2026-11-20';
  r = TL.tinhBangLuong(db, 2026, 11).rows[0];
  assert.strictEqual(r.luongTG, Math.round(10000000 / 26 * (20 * 0.85 + 6))); assert.strictEqual(r.dongBH, false);
  // tắt "không đóng BH khi thử việc" -> vẫn đóng
  db.caiDat.thuViec.khongDongBH = false;
  assert.strictEqual(TL.tinhBangLuong(db, 2026, 11).rows[0].dongBH, true);
  // tỷ lệ riêng 90%
  db.caiDat.thuViec.khongDongBH = true; nv.thuViec = { tuNgay: '2026-10-01', soThang: 2, tiLe: 90 };
  assert.strictEqual(TL.tinhBangLuong(db, 2026, 10).rows[0].luongTG, 9000000);
  // dữ liệu cũ: trạng thái thử việc + "% hưởng lương" 85 -> thời gian thử việc riêng, % hưởng lương về 100
  var cu = TL.duLieuMoi();
  cu.nhanVien = [{ id: 'c', ma: 'C', hoTen: 'C', trangThai: 'thu_viec', tiLeHuong: 85, ngayVao: '2026-10-05', loaiHD: 'Thử việc', ngayHetHD: '2026-12-04' }];
  TL.chuanHoa(cu);
  assert.deepStrictEqual(cu.nhanVien[0].thuViec, { tuNgay: '2026-10-05', soThang: 1, tiLe: 85, denNgay: '2026-12-04' });
  assert.strictEqual(cu.nhanVien[0].tiLeHuong, 100);
});

t('Giai đoạn ký HĐ: thử việc 1 tháng -> chính thức 1 năm -> 3 năm -> không xác định thời hạn', function () {
  var db = TL.duLieuMoi();
  assert.deepStrictEqual(TL.dsGiaiDoan(db).map(function (g) { return g.ma + ':' + g.soThang; }), ['TV:1', 'CT1:12', 'CT3:36', 'KXD:0']);
  assert.strictEqual(TL.soThangThuViec(db), 1);
  assert.strictEqual(TL.soThangGiua('2026-10-01', '2026-11-30'), 2); assert.strictEqual(TL.soThangGiua('2026-11-01', '2029-10-31'), 36);
  var nv = { id: 'a', hopDong: [] };
  // chưa có HĐ: giai đoạn đầu (thử việc)
  assert.strictEqual(TL.hdTiepTheo(db, nv).gd.ma, 'TV');
  nv.hopDong.push({ id: 'h1', loai: 'Thử việc', tuNgay: '2026-10-01', denNgay: TL.denNgayHD('2026-10-01', 1) });
  var t = TL.hdTiepTheo(db, nv);
  assert.strictEqual(t.gd.ma, 'CT1'); assert.strictEqual(t.tuNgay, '2026-11-01'); assert.strictEqual(t.denNgay, '2027-10-31');
  nv.hopDong.push({ id: 'h2', loai: 'Xác định thời hạn', giaiDoan: 'CT1', tuNgay: t.tuNgay, denNgay: t.denNgay });
  t = TL.hdTiepTheo(db, nv);
  assert.strictEqual(t.gd.ma, 'CT3'); assert.strictEqual(t.tuNgay, '2027-11-01'); assert.strictEqual(t.denNgay, '2030-10-31'); assert.strictEqual(t.canhBao, '');
  // dữ liệu cũ không ghi giai đoạn: HĐ xác định thời hạn 36 tháng nhận ra là "chính thức 3 năm"
  nv.hopDong.push({ id: 'h3', loai: 'Xác định thời hạn', tuNgay: t.tuNgay, denNgay: t.denNgay });
  assert.strictEqual(TL.giaiDoanCacHD(db, nv)[2].gd.ma, 'CT3'); assert.strictEqual(TL.giaiDoanCacHD(db, nv)[2].lanXD, 2);
  t = TL.hdTiepTheo(db, nv);
  assert.strictEqual(t.gd.ma, 'KXD'); assert.strictEqual(t.denNgay, '');
  // đã 2 lần HĐ xác định thời hạn (1 năm + 1 năm) -> lần sau bắt buộc không xác định thời hạn
  var nv2 = { id: 'b', hopDong: [{ loai: 'Xác định thời hạn', tuNgay: '2024-01-01', denNgay: '2024-12-31', giaiDoan: 'CT1' }, { loai: 'Xác định thời hạn', tuNgay: '2025-01-01', denNgay: '2025-12-31', giaiDoan: 'CT1' }] };
  t = TL.hdTiepTheo(db, nv2);
  assert.strictEqual(t.gd.ma, 'KXD'); assert.ok(/Điều 20/.test(t.canhBao));
  // HĐ đầu tiên của nv: tiếp theo HĐ thử việc (theo hd cụ thể)
  assert.strictEqual(TL.hdTiepTheo(db, nv, nv.hopDong[0]).gd.ma, 'CT1');
});

t('Hệ số công riêng từng ngày lễ, Tết: ×1 / ×2 / ×3 (mặc định theo loại)', function () {
  var db = dbMau(), nv = db.nhanVien[0];
  db.ngayLe = TL.taoNgayLe(2026, db.caiDat);
  var le = function (d) { return db.ngayLe.filter(function (x) { return x.ngay === d; })[0]; };
  // mặc định: 2/9 lễ ×2, mùng 2 Tết ×3
  assert.strictEqual(TL.heSoLeNgay(db, le('2026-09-02')), 2);
  assert.strictEqual(TL.heSoLeNgay(db, le('2026-02-18')), 3);
  // 2/9 chọn ×3, 1/9 (ngày liền kề) chọn ×1 – như ngày thường
  le('2026-09-02').heSo = 3; le('2026-09-01').heSo = 1;
  TL.thang(db, 2026, 9, true).cc[nv.id] = { 1: '+', 2: '+', 3: '+' };
  var c = TL.tinhBangLuong(db, 2026, 9).rows[0].cong;
  assert.strictEqual(c.congTG, 1 + 3 + 1);
  assert.strictEqual(c.congThemLe, 2);
  assert.deepStrictEqual(c.lamLeHS, { 3: 1 });       // chỉ ghi ngày có nhân
  assert.strictEqual(c.ngayCom, 3);
  // đổi mặc định trong Cài đặt: ngày không có hệ số riêng theo mặc định mới, ngày có hệ số riêng giữ nguyên
  db.caiDat.heSoCongLe = 2.5;
  assert.strictEqual(TL.heSoLeNgay(db, le('2026-04-30')), 2.5);
  assert.strictEqual(TL.heSoLeNgay(db, le('2026-09-02')), 3);
  // mùng 2 Tết chọn ×2
  db.caiDat.heSoCongLe = 2; le('2026-02-18').heSo = 2;
  TL.thang(db, 2026, 2, true).cc[nv.id] = { 18: '+', 19: '+' };
  c = TL.tinhBangLuong(db, 2026, 2).rows[0].cong;
  assert.strictEqual(c.congTG, 2 + 3);
  assert.deepStrictEqual(c.lamLeHS, { 2: 1, 3: 1 });
  // dữ liệu cũ / sai: hệ số không hợp lệ bị bỏ, chuỗi số thành số
  var d2 = TL.chuanHoa({ ngayLe: [{ ngay: '2026-09-02', ten: 'Quốc khánh 2/9', heSo: 'abc' }, { ngay: '2026-04-30', ten: '30/4', heSo: '1' }], nhanVien: [], caiDat: {} });
  assert.strictEqual(d2.ngayLe[0].heSo, undefined);
  assert.strictEqual(d2.ngayLe[1].heSo, 1);
});

t('Lương đóng BH theo bậc lương hiện tại (+ phụ cấp đóng BH), đổi theo kỳ khi nâng bậc', function () {
  var db = dbMau(), nv = db.nhanVien[0];
  db.thangLuong = [{ ma: 'T', ten: 'Bảng lương công ty', kieu: 'tien', apDung: 'cb', namNang: 3, ngach: [{ ma: 'CV', ten: 'Chuyên viên', bac: [7500000, 8000000, 8500000] }] }];
  db = TL.chuanHoa(db); nv = db.nhanVien[0];
  assert.strictEqual(db.caiDat.bhTheoBac, true);                       // mặc định bật (kể cả dữ liệu cũ)
  nv.phuCap = { AN: 50000, TN: 500000 };                               // trách nhiệm: tính đóng BH
  nv.luongBH = 5000000;                                                // lương đóng BH nhập tay cũ – không dùng nữa
  // nâng từ bậc 1 lên bậc 2, hiệu lực 25/10/2026 (kỳ 11/2026)
  nv.xepLuong = { bang: 'T', ngach: 'CV', bac: 2, ngayHuong: '2026-10-25' }; nv.luongCB = 8000000;
  nv.quyetDinh = [{ loai: 'nang_luong', hieuLuc: '2026-10-25', luongCu: 7500000, luongMoi: 8000000,
    xepLuongCu: { bang: 'T', ngach: 'CV', bac: 1, ngayHuong: '2023-10-25' }, xepLuongMoi: { bang: 'T', ngach: 'CV', bac: 2, ngayHuong: '2026-10-25' } }];
  [10, 11].forEach(function (m) { var T = TL.thang(db, 2026, m, true); T.cc[nv.id] = {}; TL.ngayKy(db, 2026, m).forEach(function (x) { var t = new Date(x.y, x.m - 1, x.d).getDay(); if (t > 0 && t < 6) T.cc[nv.id][x.d] = '+'; }); });
  var r10 = TL.tinhBangLuong(db, 2026, 10).rows[0], r11 = TL.tinhBangLuong(db, 2026, 11).rows[0];
  assert.strictEqual(r10.bhTheoBac, 7500000); assert.strictEqual(r10.luongBH, 7500000 + 500000);
  assert.strictEqual(r11.bhTheoBac, 8000000); assert.strictEqual(r11.luongBH, 8000000 + 500000);
  assert.strictEqual(r11.bhxh, Math.round(8500000 * 0.08));
  // tắt: dùng lương đóng BH trong hồ sơ như trước
  db.caiDat.bhTheoBac = false;
  r11 = TL.tinhBangLuong(db, 2026, 11).rows[0];
  assert.strictEqual(r11.bhTheoBac, 0); assert.strictEqual(r11.luongBH, 5000000);
  // người chưa xếp bậc: không đổi (nhập tay, hoặc mức lương + phụ cấp đóng BH)
  db.caiDat.bhTheoBac = true; nv.xepLuong = null; nv.quyetDinh = []; nv.luongBH = 0;
  r11 = TL.tinhBangLuong(db, 2026, 11).rows[0];
  assert.strictEqual(r11.bhTheoBac, 0); assert.strictEqual(r11.luongBH, 8000000 + 500000);
});

t('Danh sách lương đóng BH từng người (không cần chấm công) khớp bảng lương; lương cơ sở dùng hay không', function () {
  var db = dbMau(), nv;
  db.thangLuong = [{ ma: 'T', ten: 'Bảng lương công ty', kieu: 'tien', apDung: 'cb', namNang: 3, ngach: [{ ma: 'CV', ten: 'Chuyên viên', bac: [7500000, 8000000, 8500000] }] }];
  db = TL.chuanHoa(db); nv = db.nhanVien[0];
  nv.phuCap = { AN: 50000, TN: 500000 };
  nv.xepLuong = { bang: 'T', ngach: 'CV', bac: 2, ngayHuong: '2026-01-01' }; nv.luongCB = 8000000;
  var T = TL.thang(db, 2026, 11, true); T.cc[nv.id] = {};
  TL.ngayKy(db, 2026, 11).forEach(function (x) { var t = new Date(x.y, x.m - 1, x.d).getDay(); if (t > 0 && t < 6) T.cc[nv.id][x.d] = '+'; });
  var r = TL.tinhBangLuong(db, 2026, 11).rows[0], b = TL.luongDongBH(db, nv, 2026, 11);
  assert.strictEqual(b.nguon, 'bac'); assert.strictEqual(b.xl.bac, 2); assert.strictEqual(b.bhTheoBac, 8000000); assert.strictEqual(b.pcDongBH, 500000);
  assert.strictEqual(b.luongBH, r.luongBH); assert.strictEqual(b.nv.tong, r.tongBH); assert.strictEqual(b.nv.bhxh, r.bhxh);
  assert.strictEqual(b.dn.tong, r.dn.bhxh + r.dn.bhyt + r.dn.bhtn + r.dn.kpcd);
  // không tham gia BH / chưa xếp bậc
  nv.thamGiaBH = false; assert.strictEqual(TL.luongDongBH(db, nv, 2026, 11).nguon, 'khong'); nv.thamGiaBH = true;
  nv.xepLuong = null; assert.strictEqual(TL.luongDongBH(db, nv, 2026, 11).nguon, 'luong');
  // lương cơ sở: bảng mức tiền, lương dưới trần -> không dùng (ẩn ô nhập)
  var u = TL.dungLuongCoSo(db, '2026-11');
  assert.strictEqual(u.dung, false); assert.strictEqual(u.tran, 0);
  // có người đóng BH vượt trần 20 × lương cơ sở -> dùng
  nv.luongBH = 60000000; nv.luongCB = 60000000;
  u = TL.dungLuongCoSo(db, '2026-11'); assert.strictEqual(u.dung, true); assert.strictEqual(u.tran, 1);
  nv.luongBH = 0; nv.luongCB = 8000000;
  // bảng lương hệ số theo lương cơ sở -> dùng; bảng hệ số có mức cơ sở riêng -> không
  db.thangLuong.push({ ma: 'HS', ten: 'Bảng hệ số', kieu: 'he_so', apDung: 'bh', namNang: 3, ngach: [{ ma: 'A', ten: 'A', bac: [2.34, 2.67] }] });
  TL.chuanHoa(db);
  assert.deepStrictEqual(TL.dungLuongCoSo(db, '2026-11').heSo, ['Bảng hệ số']);
  db.thangLuong[1].mucCoSo = 3000000;
  assert.strictEqual(TL.dungLuongCoSo(db, '2026-11').dung, false);
});

t('Thang bảng lương theo Quy chế trả lương 2026 (QĐ 16/QĐ-CNHG): đúng phụ lục, nạp, gợi ý chuyển xếp', function () {
  var ds = TL.thangLuongQuyChe(), giaTri = {};
  ds.forEach(function (b) { b.ngach.forEach(function (g) { giaTri[g.ma] = g.bac.filter(function (x) { return x !== ''; }).map(function (x) { return x / 1000; }); }); });
  assert.deepStrictEqual(giaTri, {
    C01: [23000, 26000], C02: [18500, 20000], C03: [17000, 18500], D01: [15500, 17000], D02: [13000, 15000],
    D03: [8000, 9500, 11000], D04: [7000, 8000, 9000], D05: [6000, 7000, 8000], D06: [5000, 6000],
    A01: [6360, 7320, 8040], A02: [7000, 8000, 9000], A03: [8000, 9000, 10000]
  });
  ds.forEach(function (b) { assert.strictEqual(b.apDung, 'ca_hai'); assert.strictEqual(b.namNang, 3); assert.strictEqual(b.quyChe, '16/QĐ-CNHG'); });
  assert.strictEqual(TL.soBacNgach(ds[0].ngach[0]), 2); assert.strictEqual(TL.soBacNgach(ds[0].ngach[5]), 3);
  // dữ liệu mới có sẵn; dữ liệu cũ nạp thêm, giữ bảng khác, sửa tay thì cập nhật lại đúng quy chế
  assert.strictEqual(TL.duLieuMoi().thangLuong.length, 2);
  var db = dbMau(); db.thangLuong = [{ ma: 'BL1', ten: 'Bảng cũ', kieu: 'tien', apDung: 'cb', ngach: [{ ma: 'X', ten: 'X', bac: [1, 2] }] }];
  assert.deepStrictEqual(TL.apDungThangLuongQuyChe(db), { them: 2, capNhat: 0 });
  TL.timNgach(TL.timBangLuong(db, 'A'), 'A01').bac[0] = 1;
  assert.deepStrictEqual(TL.apDungThangLuongQuyChe(db), { them: 0, capNhat: 2 });
  assert.strictEqual(TL.timNgach(TL.timBangLuong(db, 'A'), 'A01').bac[0], 6360000); assert.strictEqual(db.thangLuong.length, 3);
  // gợi ý (Điều 9): chức danh theo chức vụ / trình độ; quản lý giữ bậc cũ, còn lại căn cứ mức lương cũ
  function gy(nv) { var x = TL.goiYXepQuyChe(db, nv); return x.ngach + '/' + x.bac; }
  assert.strictEqual(gy({ chucVu: 'Giám đốc', xepLuong: { bang: 'BL1', ngach: 'X', bac: 2 } }), 'C01/2');
  assert.strictEqual(gy({ chucVu: 'Phó trưởng phòng' }), 'D02/1');
  assert.strictEqual(gy({ chucVu: 'Nhân viên ghi thu', luongCB: 7320000 }), 'A01/2');
  assert.strictEqual(gy({ chucVu: 'CN LĐ-SC', luongCB: 8500000 }), 'A02/3');
  assert.strictEqual(gy({ chucVu: 'Kế toán viên', trinhDoCM: 'Đại học', luongCB: 9000000 }), 'D03/2');
  assert.strictEqual(gy({ chucVu: 'Văn thư', trinhDoCM: 'Trung cấp', luongCB: 6500000 }), 'D04/1');
  assert.strictEqual(gy({ chucVu: 'Bảo vệ', luongCB: 5500000 }), 'D06/2');
  assert.strictEqual(gy({ chucVu: 'Công nhân trực ca', luongCB: 12000000 }), 'A03/3');
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

t('Phép năm: đủ 12 tháng 12 ngày, +1 ngày mỗi 5 năm, mới vào HĐ chính thức 1 tháng = 1 ngày', function () {
  var db = TL.duLieuMoi(), hn = '2026-09-20';
  var p = function (nv, y) { return TL.phepNam(db, nv, y || 2026, hn); };
  // vào 01/03/2015, chính thức 01/04/2015: hết năm 2026 đủ 11 năm -> +2 ngày
  var a = p({ id: 'a', ngayVao: '2015-03-01', hopDong: [{ loai: 'Thử việc', tuNgay: '2015-03-01' }, { loai: 'Xác định thời hạn', tuNgay: '2015-04-01' }] });
  assert.deepStrictEqual([a.coBan, a.thamNien, a.thang, a.duoc, a.tichLuy], [12, 2, 12, 14, 14]);
  // mới: thử việc 10/5, chính thức 10/6/2026 -> tháng 6 (21/30 ngày) đến tháng 12 = 7 tháng = 7 ngày; đến 20/9 tích lũy 4 ngày
  var b = p({ id: 'b', ngayVao: '2026-05-10', hopDong: [{ loai: 'Thử việc', tuNgay: '2026-05-10' }, { loai: 'Xác định thời hạn', tuNgay: '2026-06-10' }] });
  assert.deepStrictEqual([b.thang, b.duoc, b.tichLuy, b.chinhThuc], [7, 7, 4, '2026-06-10']);
  // chính thức từ 20/6: tháng 6 chỉ 11/30 ngày -> không tính
  assert.strictEqual(p({ id: 'b2', ngayVao: '2026-05-20', hopDong: [{ loai: 'Xác định thời hạn', tuNgay: '2026-06-20' }] }).duoc, 6);
  // đang thử việc: chưa có phép
  var c = p({ id: 'c', ngayVao: '2026-09-01', trangThai: 'thu_viec', hopDong: [{ loai: 'Thử việc', tuNgay: '2026-09-01' }] });
  assert.strictEqual(c.duoc, 0); assert.strictEqual(c.dangThuViec, true);
  // nghỉ việc 30/6/2026, làm từ 2010 (16 năm -> +3): (12 + 3) × 6/12 = 7,5 -> 8
  assert.strictEqual(p({ id: 'd', ngayVao: '2010-01-01', ngayNghi: '2026-06-30' }).duoc, 8);
  // không có ngày vào, hợp đồng: coi như cả năm
  assert.strictEqual(p({ id: 'e' }).duoc, 12);
  // phép cơ bản riêng 14 (nặng nhọc), vào 01/11/2021: hết 2026 đủ 5 năm -> 15; năm 2025 chưa đủ -> 14
  assert.strictEqual(p({ id: 'f', ngayVao: '2021-11-01', phepNam: 14 }).duoc, 15);
  assert.strictEqual(p({ id: 'f', ngayVao: '2021-11-01', phepNam: 14 }, 2025).duoc, 14);
  // tồn năm trước, đã nghỉ (P = 1, P/2 = 0,5)
  var nv = { id: 'g', ngayVao: '2020-01-01', phepTon: 2 }, T = TL.thang(db, 2026, 3, true); T.cc.g = { 2: 'P', 3: 'P/2' };
  var g = p(nv); assert.deepStrictEqual([g.duoc, g.ton, g.daNghi, g.conLai], [13, 2, 1.5, 13.5]);
  assert.ok(/Làm đủ 12 tháng: 12 ngày \+ 1 ngày thâm niên/.test(TL.moTaPhepNam(g)));
  assert.ok(/7 tháng.*× 7\/12 = 7 ngày; đến nay tích lũy 4 ngày/.test(TL.moTaPhepNam(b)));
});

t('Làm thêm ngoài giờ theo khung giờ: đọc khung, tách ban đêm 22h–6h, hệ số ngày thường 150%, nghỉ 200%, đêm 200%, lễ 300%', function () {
  // đọc khung giờ
  assert.strictEqual(TL.docKhoangOT('17h30 - 21h').chuoi, '17:30-21:00');
  assert.strictEqual(TL.docKhoangOT('17-19, 22-2').chuoi, '17:00-19:00,22:00-02:00');
  assert.strictEqual(TL.docKhoangOT('1730-2100').chuoi, '17:30-21:00');
  assert.strictEqual(TL.docKhoangOT('18 đến 22').chuoi, '18:00-22:00');
  assert.strictEqual(TL.docKhoangOT(2), null);
  assert.strictEqual(TL.docKhoangOT('1,5'), null);
  assert.strictEqual(TL.docKhoangOT('17-21,20-22'), false);     // chồng nhau
  assert.strictEqual(TL.docKhoangOT('25-26'), false);
  assert.deepStrictEqual(TL.gioOT('17:00-23:00', {}), { gio: 6, ngay: 5, dem: 1, khung: '17:00-23:00' });
  assert.deepStrictEqual(TL.gioOT('22-2', {}), { gio: 4, ngay: 0, dem: 4, khung: '22:00-02:00' });
  assert.deepStrictEqual(TL.gioOT('05:00-07:30', {}), { gio: 2.5, ngay: 1.5, dem: 1, khung: '05:00-07:30' });
  assert.deepStrictEqual(TL.gioOT(1.5, {}), { gio: 1.5, ngay: 1.5, dem: 0, khung: '' });
  assert.strictEqual(TL.gioOT('2,5', {}).gio, 2.5);
  assert.deepStrictEqual(TL.heSoOTDem(TL.caiDatMacDinh()), { thuong: 200, nghi: 200, le: 300 });
  assert.deepStrictEqual(TL.heSoOTDem({ heSoOT: { thuong: 150, nghi: 200, le: 300 }, otDem: { heSo: 180 } }), { thuong: 180, nghi: 200, le: 300 });
  assert.strictEqual(TL.gioOT('21-23', { otDem: { tu: '21:00', den: '05:00' } }).dem, 2);   // khung đêm theo cài đặt

  // bảng lương: VP làm thứ 2 – thứ 6, lương 8 triệu, công chuẩn 22
  var db = dbMau(), nv = db.nhanVien[0];
  db.ngayLe = [{ ngay: '2026-10-06', ten: 'Lễ thử' }];
  TL.ngayKy(db, 2026, 10).forEach(function (x) {
    var thu = TL.thuTrongTuan(x.y, x.m, x.d), T = TL.thang(db, x.y, x.m, true), cc = T.cc[nv.id] = T.cc[nv.id] || {};
    if (thu !== 0 && thu !== 6) cc[x.d] = x.iso === '2026-10-06' ? 'L' : '+';
  });
  var ot = TL.thang(db, 2026, 10, true).ot[nv.id] = {};
  ot[1] = '17:00-23:00';   // thứ 5: 5 giờ ngày 150% + 1 giờ đêm 200%
  ot[2] = '22-2';          // thứ 6: 4 giờ đêm 200%
  ot[3] = '08:00-12:00';   // thứ 7 (nghỉ tuần): 4 giờ 200%
  ot[4] = '20-23';         // chủ nhật: 2 giờ 200% + 1 giờ đêm 200%
  ot[6] = '22:00-24:00';   // ngày lễ: 2 giờ đêm 300%
  ot[7] = 2;               // nhập số giờ: ban ngày 150%
  var c = TL.tongHopCong(db, 2026, 10, nv);
  assert.strictEqual(c.otThuong, 7); assert.strictEqual(c.otNghi, 6); assert.strictEqual(c.otLe, 0);
  assert.strictEqual(c.otDemThuong, 5); assert.strictEqual(c.otDemNghi, 1); assert.strictEqual(c.otDemLe, 2);
  assert.strictEqual(c.otDem, 8); assert.strictEqual(c.otTong, 21); assert.strictEqual(c.otKhung, 5);
  var r = TL.tinhBangLuong(db, 2026, 10).rows[0], lg = 8000000 / 22 / 8;
  assert.strictEqual(r.otTien.thuong, Math.round(lg * 7 * 1.5));
  assert.strictEqual(r.otTien.nghi, Math.round(lg * 6 * 2));
  assert.strictEqual(r.otTien.dem, Math.round(lg * (5 * 200 + 1 * 200 + 2 * 300) / 100));
  assert.strictEqual(r.tienOT, r.otTien.thuong + r.otTien.nghi + r.otTien.le + r.otTien.dem);
  assert(Math.abs(r.otMienThue - (r.tienOT - lg * 21)) <= 1, 'phần làm thêm cao hơn lương giờ thường được miễn thuế');

  // giờ vào / ra -> khung giờ làm thêm (để tách được giờ ban đêm)
  var cd = TL.caiDatMacDinh();
  var k = TL.tinhVaoRa(cd, 'thuong', TL.phut('07:30'), TL.phut('23:10'));
  assert.strictEqual(k.ot, 6); assert.strictEqual(k.otKhung, '17:00-23:00');
  k = TL.tinhVaoRa(cd, 'nghi', TL.phut('07:30'), TL.phut('17:20'));
  assert.strictEqual(k.ot, 8.5); assert.strictEqual(k.otKhung, '07:30-12:00,13:00-17:00');
  assert.strictEqual(TL.gioOT(k.otKhung, cd).gio, 8.5);
});

console.log('\n' + ok + ' nhóm kiểm thử đạt.');
