/* Đóng gói toàn bộ phần mềm thành 1 file HTML duy nhất (mở bằng trình duyệt, không cần cài đặt, chạy offline).
   Cách dùng:  node build.js   -> tạo file ChamCong_TinhLuong.html */
'use strict';
var fs = require('fs'), path = require('path');
var src = path.join(__dirname, 'src');
var html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, function (_, f) {
  return '<style>\n' + fs.readFileSync(path.join(src, f), 'utf8') + '\n</style>';
});
html = html.replace(/<script src="([^"]+)"><\/script>/g, function (_, f) {
  var js = fs.readFileSync(path.join(src, f), 'utf8').replace(/<\/script/gi, '<\\/script');
  return '<script>\n/* ===== ' + f + ' ===== */\n' + js + '\n</script>';
});
var out = path.join(__dirname, 'ChamCong_TinhLuong.html');
fs.writeFileSync(out, html);
console.log('Đã tạo ' + out + ' (' + Math.round(html.length / 1024) + ' KB)');
