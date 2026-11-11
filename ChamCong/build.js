/* Đóng gói toàn bộ phần mềm thành 1 file HTML duy nhất (mở bằng trình duyệt, không cần cài đặt, chạy offline).
   Cách dùng:  node build.js   -> tạo file ChamCong_TinhLuong.html */
'use strict';
var fs = require('fs'), path = require('path');
var src = path.join(__dirname, 'src');
var html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
function anh(f) { return 'data:image/png;base64,' + fs.readFileSync(path.join(src, 'anh', f)).toString('base64'); }
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, function (_, f) {
  return '<style>\n' + fs.readFileSync(path.join(src, f), 'utf8') + '\n</style>';
});
html = html.replace(/<script src="([^"]+)"><\/script>/g, function (_, f) {
  // hướng dẫn sử dụng đóng gói kèm để trợ lý ảo tìm và trả lời
  var js = f === 'huongdan.md.js' ? 'window.HUONG_DAN_MD = ' + JSON.stringify(fs.readFileSync(path.join(__dirname, 'HUONG_DAN.md'), 'utf8')) + ';'
    // ảnh linh vật trợ lý ảo (giống trợ lý ảo trên web.capnuochaugiang.vn)
    : f === 'anh-troly.js' ? 'window.ANH_TROLY = ' + JSON.stringify({ than: anh('robot-than.png'), dau: anh('robot-dau.png') }) + ';'
    : fs.readFileSync(path.join(src, f), 'utf8');
  js = js.replace(/<\/script/gi, '<\\/script');
  return '<script>\n/* ===== ' + f + ' ===== */\n' + js + '\n</script>';
});
var out = path.join(__dirname, 'ChamCong_TinhLuong.html');
fs.writeFileSync(out, html);
console.log('Đã tạo ' + out + ' (' + Math.round(html.length / 1024) + ' KB)');
