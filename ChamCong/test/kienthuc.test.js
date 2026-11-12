/* Kiểm thử kho kiến thức & máy tính nhanh của Trợ lý ảo Hawasuco (src/kienthuc.js). Chạy: node test/kienthuc.test.js */
'use strict';
var assert = require('assert');
global.window = global;
global.TL = require('../src/tinhluong.js');
global.AmLich = require('../src/amlich.js');
var db = TL.duLieuMoi();
db.congTy.ten = 'CÔNG TY TNHH MTV CẤP NƯỚC HẬU GIANG';
global.App = {
  db: db, MENU: [], duocXem: function () { return true; },
  h: function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
  boDau: function (s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D'); },
  tien: function (v) { return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); },
  so: function (v) { return String(v).replace('.', ','); }
};
require('../src/kienthuc.js');
var K = App.KienThuc, ok = 0;
function cn(s) { return App.boDau(s).toLowerCase().replace(/[^a-z0-9\/+%]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function tinh(c) { var r = K.tinh(cn(c), c); assert.ok(r, 'không tính được: ' + c); return r.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '); }
function t(ten, fn) { fn(); ok++; console.log('  ✓ ' + ten); }

t('Đọc số tiền trong câu hỏi', function () {
  assert.strictEqual(K.docTien('lương 10 triệu'), 10000000);
  assert.strictEqual(K.docTien('8,5tr'), 8500000);
  assert.strictEqual(K.docTien('đóng 7.500.000 đ'), 7500000);
  assert.strictEqual(K.docTien('12 triệu 500'), 12500000);
  assert.strictEqual(K.docTien('lương 10 triệu 2 người phụ thuộc'), 10000000);
  assert.strictEqual(K.docTien('năm 2026'), null);
});
t('Thuế TNCN, bảo hiểm, thực lĩnh (theo Cài đặt)', function () {
  assert.ok(/thuế TNCN 700\.000/.test(tinh('thu nhập tính thuế 12 triệu thì thuế bao nhiêu')));
  // 25 tr, 1 NPT: BH 10,5% = 2.625.000; TNTT = 25 - 2,625 - 15,5 - 6,2 = 0,675 tr -> 5% = 33.750
  assert.ok(/Thuế TNCN phải nộp \/ tháng 33\.750/.test(tinh('thuế TNCN thu nhập 25 triệu 1 người phụ thuộc')));
  assert.ok(/Người lao động đóng 787\.500/.test(tinh('đóng bảo hiểm 7.500.000 thì trừ bao nhiêu')));
  // 40 tr, 0 NPT: BH 4.200.000; TNTT 20.300.000 -> 500.000 + 1.030.000 = 1.530.000; thực lĩnh 34.270.000
  assert.ok(/Thực lĩnh 34\.270\.000/.test(tinh('lương 40 triệu thực lĩnh bao nhiêu')));
});
t('Làm thêm giờ, trợ cấp thôi việc / mất việc / thất nghiệp, phép năm', function () {
  assert.ok(/Tiền làm thêm 363\.636/.test(tinh('làm thêm 4 giờ chủ nhật lương 8 triệu văn phòng')));
  assert.ok(/Tiền làm thêm 346\.154/.test(tinh('làm thêm ngày lễ 2 giờ lương 12 triệu 26 công')));
  // ban đêm, theo khung giờ: lương giờ 8tr/22/8 = 45.454,5; 5 giờ × 150% + 1 giờ đêm × 210% = 436.364; 4 giờ đêm chủ nhật × 270% = 490.909
  assert.ok(/Tiền làm thêm 436\.364/.test(tinh('làm thêm từ 17h đến 23h lương 8 triệu văn phòng')));
  assert.ok(/ban đêm 1 giờ/.test(tinh('làm thêm từ 17h đến 23h lương 8 triệu văn phòng')));
  assert.ok(/Tiền làm thêm 490\.909/.test(tinh('làm thêm 4 giờ ban đêm chủ nhật lương 8 triệu văn phòng')));
  assert.ok(/27\.000\.000/.test(tinh('trợ cấp thôi việc 6 năm lương 9 triệu')));
  assert.ok(/6,5 năm/.test(tinh('trợ cấp thôi việc 6 năm 5 tháng lương 9 triệu')));    // tháng lẻ đến 6 tháng = 1/2 năm
  assert.ok(/14\.000\.000/.test(tinh('trợ cấp mất việc 1 năm lương 7 triệu')));          // ít nhất 2 tháng
  var tn = tinh('trợ cấp thất nghiệp lương 8 triệu đóng 60 tháng');
  assert.ok(/4\.800\.000/.test(tn) && /hưởng 5 tháng/.test(tn));
  assert.ok(/phép năm 14 ngày/.test(tinh('làm 12 năm thì phép năm bao nhiêu ngày')));
});
t('Tuổi nghỉ hưu, âm lịch, Tết, đọc số bằng chữ', function () {
  assert.ok(/Nữ: đủ tuổi nghỉ hưu ngày 01\/05\/2035/.test(tinh('nữ sinh tháng 5/1975 bao giờ nghỉ hưu')));
  assert.ok(/Nam: đủ tuổi nghỉ hưu ngày 12\/08\/2028/.test(tinh('anh sinh 12/08/1966 khi nào về hưu')));
  assert.ok(/06\/02\/2027/.test(tinh('Tết 2027 vào ngày nào')) && /Đinh Mùi/.test(tinh('Tết 2027 vào ngày nào')));
  assert.ok(/25\/09\/2026/.test(tinh('15/8 âm lịch năm 2026 là ngày nào')));
  assert.ok(/24 tháng 11 năm Bính Ngọ/.test(tinh('ngày 01/01/2027 là ngày bao nhiêu âm lịch')));
  assert.ok(/Hai triệu năm trăm ba mươi nghìn đồng/.test(tinh('đọc 2.530.000 bằng chữ')));
});
t('Về bản thân trợ lý, kho kiến thức', function () {
  assert.ok(/Trợ lý ảo Hawasuco/.test(K.banThan(cn('Bạn là ai?')).html));
  assert.ok(/Hau Giang Water Supply/.test(K.banThan(cn('Hawasuco là gì')).html));
  assert.strictEqual(K.banThan(cn('sửa tỷ lệ bảo hiểm ở đâu')), null);       // "bảo hiểm ở đâu" không phải "em ở đâu"
  assert.strictEqual(K.banThan(cn('em nghỉ phép năm được mấy ngày')), null);
  assert.strictEqual(K.banThan(cn('thống kê giới tính nhân viên')), null);
  [['thử việc tối đa bao lâu', 'thu_viec'], ['nghỉ phép năm bao nhiêu ngày', 'phep_nam'], ['cưới vợ được nghỉ mấy ngày', 'viec_rieng'], ['nghỉ thai sản bao lâu', 'thai_san'],
    ['xin nghỉ việc báo trước bao lâu', 'nghi_viec'], ['quyết toán thuế thu nhập cá nhân', 'thue'], ['hình thức kỷ luật', 'ky_luat'], ['lương tối thiểu vùng', 'luong_toi_thieu']].forEach(function (x) {
    var r = K.tim(cn(x[0]));
    assert.ok(r.length && r[0].k.ma === x[1], x[0] + ' → ' + (r[0] ? r[0].k.ma : 'không có'));
  });
  K.chuDe().forEach(function (td) { assert.ok(K.tim(cn(td)).length, 'tìm được theo tiêu đề: ' + td); });
});
console.log('\n' + ok + ' nhóm kiểm thử trợ lý ảo đạt.');
