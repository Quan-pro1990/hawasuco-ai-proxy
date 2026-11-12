/* Đóng gói bộ cài: dựng lại ChamCong_TinhLuong.html, chạy kiểm thử cách tính, rồi nén mọi thứ cần để cài
   lên máy chủ IIS thành 1 file: dist/ChamCong_CaiDat_<ngày>.zip
   Chạy: node dong-goi.js */
'use strict';
var fs = require('fs'), path = require('path'), zlib = require('zlib'), cp = require('child_process');

var goc = __dirname;
function chay(lenh) { cp.execFileSync(process.execPath, [path.join(goc, lenh)], { stdio: 'inherit', cwd: goc }); }

chay('build.js');
chay('test/tinhluong.test.js');
chay('test/giongdoc.test.js');
chay('test/kienthuc.test.js');

var d = new Date(), pad = function (n) { return String(n).padStart(2, '0'); };
var ngay = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
var commit = '';
try { commit = cp.execSync('git rev-parse --short HEAD', { cwd: goc }).toString().trim(); } catch (e) { /* không có git */ }

var docTruoc = [
  'BỘ CÀI PHẦN MỀM NHÂN SỰ – CHẤM CÔNG – TIỀN LƯƠNG',
  'Phiên bản đóng gói: ' + ngay + (commit ? ' (mã ' + commit + ')' : ''),
  '',
  'CÀI LÊN MÁY CHỦ IIS (dùng chung, có tài khoản, phân quyền, sao lưu tự động sang ổ D):',
  '  1. Chuột phải file .zip → Properties → đánh dấu Unblock → OK, rồi giải nén vào ổ D của máy chủ,',
  '     vd D:\\CaiDat\\ChamCong (giữ nguyên các file và thư mục iis bên trong).',
  '  2. Nhấp đúp CaiDat-MayChu-IIS.bat → bấm Yes khi Windows hỏi quyền quản trị.',
  '  3. Nhập tên, mật khẩu tài khoản quản trị khi được hỏi. Xong mở https://qlns.capnuochaugiang.vn/',
  '  Chi tiết (tên miền, chứng chỉ, phân quyền, sao lưu, sự cố): iis\\HUONG_DAN_IIS.txt',
  '',
  'DÙNG 1 MÁY, KHÔNG CẦN MÁY CHỦ:',
  '  Mở ChamCong_TinhLuong.html bằng Chrome / Edge / Cốc Cốc.',
  '',
  'HƯỚNG DẪN SỬ DỤNG TỪNG PHẦN: mở HUONG_DAN_SU_DUNG.html (in hoặc gửi cho người dùng).',
  '  Trong phần mềm: menu Trợ giúp → Hướng dẫn sử dụng, hoặc nút "Hướng dẫn" trên đầu mỗi trang.',
  '',
  'CẬP NHẬT PHIÊN BẢN MỚI: giải nén bộ cài mới đè lên thư mục cũ, nhấp đúp CaiDat-MayChu-IIS.bat.',
  'Dữ liệu, tài khoản, tên miền, chứng chỉ giữ nguyên.',
  ''
].join('\r\n');

// [đường dẫn trong zip, nội dung]
var tep = [
  ['ChamCong/DOC_TRUOC.txt', Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(docTruoc, 'utf8')])],
  ['ChamCong/CaiDat-MayChu-IIS.bat', 'CaiDat-MayChu-IIS.bat'],
  ['ChamCong/ChamCong_TinhLuong.html', 'ChamCong_TinhLuong.html'],
  ['ChamCong/HUONG_DAN.md', 'HUONG_DAN.md'],
  ['ChamCong/HUONG_DAN_SU_DUNG.html', 'HUONG_DAN_SU_DUNG.html'],
  // giọng đọc tích hợp (eSpeak NG, GPL v3): giấy phép và nguồn gốc đi kèm bản phân phối
  ['ChamCong/giong-doc/DOC_TOI.md', 'giong-doc/DOC_TOI.md'],
  // giọng đọc AI: danh sách tệp + mã SHA-256 (bộ cài máy chủ tự tải mô hình về), giấy phép ONNX Runtime
  ['ChamCong/giong-doc/ai/NGUON.json', 'giong-doc/ai/NGUON.json'],
  ['ChamCong/giong-doc/ort/LICENSE-onnxruntime.txt', 'giong-doc/ort/LICENSE-onnxruntime.txt'],
  ['ChamCong/giong-doc/COPYING-espeak-ng.txt', 'giong-doc/COPYING-espeak-ng.txt'],
  ['ChamCong/iis/CaiDat-IIS.bat', 'iis/CaiDat-IIS.bat'],
  ['ChamCong/iis/CaiDat-IIS.ps1', 'iis/CaiDat-IIS.ps1'],
  ['ChamCong/iis/MayChuChamCong.cs', 'iis/MayChuChamCong.cs'],
  ['ChamCong/iis/web.config', 'iis/web.config'],
  ['ChamCong/iis/HUONG_DAN_IIS.txt', 'iis/HUONG_DAN_IIS.txt']
].map(function (x) { return { ten: x[0], du: Buffer.isBuffer(x[1]) ? x[1] : fs.readFileSync(path.join(goc, x[1])) }; });

/* ---------- ghi zip (deflate) ---------- */
var BANG = (function () {
  var t = new Uint32Array(256);
  for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = BANG[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
var gio = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
var ngayDos = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;

var phan = [], trungTam = [], viTri = 0;
tep.forEach(function (t) {
  var ten = Buffer.from(t.ten, 'utf8'), nen = zlib.deflateRawSync(t.du, { level: 9 }), crc = crc32(t.du);
  var dau = Buffer.alloc(30);
  dau.writeUInt32LE(0x04034B50, 0); dau.writeUInt16LE(20, 4); dau.writeUInt16LE(0x0800, 6); dau.writeUInt16LE(8, 8);
  dau.writeUInt16LE(gio, 10); dau.writeUInt16LE(ngayDos, 12); dau.writeUInt32LE(crc, 14);
  dau.writeUInt32LE(nen.length, 18); dau.writeUInt32LE(t.du.length, 22); dau.writeUInt16LE(ten.length, 26); dau.writeUInt16LE(0, 28);
  var tt = Buffer.alloc(46);
  tt.writeUInt32LE(0x02014B50, 0); tt.writeUInt16LE(20, 4); tt.writeUInt16LE(20, 6); tt.writeUInt16LE(0x0800, 8); tt.writeUInt16LE(8, 10);
  tt.writeUInt16LE(gio, 12); tt.writeUInt16LE(ngayDos, 14); tt.writeUInt32LE(crc, 16); tt.writeUInt32LE(nen.length, 20);
  tt.writeUInt32LE(t.du.length, 24); tt.writeUInt16LE(ten.length, 28); tt.writeUInt16LE(0, 30); tt.writeUInt16LE(0, 32);
  tt.writeUInt16LE(0, 34); tt.writeUInt16LE(0, 36); tt.writeUInt32LE(0, 38); tt.writeUInt32LE(viTri, 42);
  phan.push(dau, ten, nen);
  trungTam.push(tt, ten);
  viTri += dau.length + ten.length + nen.length;
});
var tt = Buffer.concat(trungTam), cuoi = Buffer.alloc(22);
cuoi.writeUInt32LE(0x06054B50, 0); cuoi.writeUInt16LE(0, 4); cuoi.writeUInt16LE(0, 6); cuoi.writeUInt16LE(tep.length, 8);
cuoi.writeUInt16LE(tep.length, 10); cuoi.writeUInt32LE(tt.length, 12); cuoi.writeUInt32LE(viTri, 16); cuoi.writeUInt16LE(0, 20);

var thuMuc = path.join(goc, 'dist');
fs.mkdirSync(thuMuc, { recursive: true });
fs.readdirSync(thuMuc).filter(function (f) { return /^ChamCong_CaiDat_.*\.zip$/.test(f); }).forEach(function (f) { fs.unlinkSync(path.join(thuMuc, f)); });
var ra = path.join(thuMuc, 'ChamCong_CaiDat_' + ngay + '.zip');
fs.writeFileSync(ra, Buffer.concat(phan.concat([tt, cuoi])));
console.log('Đã đóng gói ' + tep.length + ' file: ' + ra + ' (' + Math.round(fs.statSync(ra).size / 1024) + ' KB)');
