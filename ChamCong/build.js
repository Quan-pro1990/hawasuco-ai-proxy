/* Đóng gói toàn bộ phần mềm thành 1 file HTML duy nhất (mở bằng trình duyệt, không cần cài đặt, chạy offline).
   Cách dùng:  node build.js   -> tạo file ChamCong_TinhLuong.html */
'use strict';
var fs = require('fs'), path = require('path'), zlib = require('zlib');
var src = path.join(__dirname, 'src');
var html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
function anh(f) { return 'data:image/png;base64,' + fs.readFileSync(path.join(src, 'anh', f)).toString('base64'); }
// hướng dẫn sử dụng từng phần: huong-dan/01-ten-phan.md -> { id: 'ten-phan', md }
var thuMucHD = path.join(__dirname, 'huong-dan');
var phanHD = fs.readdirSync(thuMucHD).filter(function (f) { return /\.md$/.test(f); }).sort().map(function (f) {
  return { id: f.replace(/^\d+-/, '').replace(/\.md$/, ''), md: fs.readFileSync(path.join(thuMucHD, f), 'utf8').replace(/\r/g, '') };
});
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, function (_, f) {
  return '<style>\n' + fs.readFileSync(path.join(src, f), 'utf8') + '\n</style>';
});
html = html.replace(/<script src="([^"]+)"><\/script>/g, function (_, f) {
  // hướng dẫn sử dụng đóng gói kèm để trợ lý ảo tìm và trả lời
  var js = f === 'huongdan.md.js' ? 'window.HUONG_DAN_MD = ' + JSON.stringify(fs.readFileSync(path.join(__dirname, 'HUONG_DAN.md'), 'utf8')) + ';'
    // ảnh linh vật trợ lý ảo (giống trợ lý ảo trên web.capnuochaugiang.vn)
    // giọng đọc tiếng Việt tích hợp (eSpeak NG WebAssembly, thư mục giong-doc/): mã nạp + bộ đọc nén gzip
    : f === 'giongdoc-vi.js' ? fs.readFileSync(path.join(__dirname, 'giong-doc', 'espeakng-vi.js'), 'utf8') +
      '\nwindow.GIONG_DOC_WASM = "' + zlib.gzipSync(fs.readFileSync(path.join(__dirname, 'giong-doc', 'espeakng-vi.wasm')), { level: 9 }).toString('base64') + '";'
    // giọng đọc AI (Piper): mã ONNX Runtime Web chạy trong luồng nền + cấu hình mô hình (tệp mô hình, wasm tải từ máy chủ)
    : f === 'giongai-ort.js' ? (function () {
      var cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'giong-doc', 'ai', 'vi_VN-vais1000-medium.onnx.json'), 'utf8'));
      var nguon = JSON.parse(fs.readFileSync(path.join(__dirname, 'giong-doc', 'ai', 'NGUON.json'), 'utf8')).tep;
      var sha = function (t) { return nguon.filter(function (x) { return x.ten === t; })[0].sha256.slice(0, 16); };
      return 'window.ORT_CORE_JS = ' + JSON.stringify(fs.readFileSync(path.join(__dirname, 'giong-doc', 'ort', 'ort.wasm-core.min.js'), 'utf8')) + ';\n' +
        'window.GIONG_AI_CAU_HINH = ' + JSON.stringify({ audio: cfg.audio, inference: cfg.inference, espeak: cfg.espeak, phoneme_id_map: cfg.phoneme_id_map,
          sha: sha('vi_VN-vais1000-medium.onnx'), shaOrt: sha('ort-wasm-simd.wasm') }) + ';';
    })()
    : f === 'huongdan-phan.js' ? 'window.HUONG_DAN_PHAN = ' + JSON.stringify(phanHD) + ';'
    : f === 'anh-troly.js' ? 'window.ANH_TROLY = ' + JSON.stringify({ than: anh('robot-than.png'), dau: anh('robot-dau.png') }) + ';'
    : fs.readFileSync(path.join(src, f), 'utf8');
  js = js.replace(/<\/script/gi, '<\\/script');
  return '<script>\n/* ===== ' + f + ' ===== */\n' + js + '\n</script>';
});
var out = path.join(__dirname, 'ChamCong_TinhLuong.html');
fs.writeFileSync(out, html);
console.log('Đã tạo ' + out + ' (' + Math.round(html.length / 1024) + ' KB)');

/* ---------- Tài liệu hướng dẫn sử dụng (1 file HTML, mở / in / gửi riêng) ---------- */
var MD = require('./src/md.js');
var NHOM = ['Bắt đầu', 'Chung', 'Nhân sự', 'Chấm công – tiền lương', 'Thiết lập', 'Trợ giúp'];
var ds = phanHD.map(function (p) { var t = MD.thongTin(p.md); t.id = p.id; t.md = p.md; return t; });
function lienKet(chu, href) {
  var p = /^#huongdan\?p=([\w-]+)$/.exec(href);
  if (p) return '<a href="#' + p[1] + '">' + chu + '</a>';
  var t = /^#([a-z]+)$/.exec(href), g = t && ds.filter(function (x) { return x.trang.indexOf(t[1]) >= 0; })[0];
  return g ? '<a href="#' + g.id + '">' + chu + '</a>' : '<b>' + chu + '</b>';
}
var logo = (/'(data:image[^']+)'/.exec(fs.readFileSync(path.join(src, 'logo.js'), 'utf8')) || [])[1] || '';
var mucLuc = NHOM.map(function (n) {
  var con = ds.filter(function (g) { return g.nhom === n; });
  return con.length ? '<li><b>' + n + '</b><ol>' + con.map(function (g) { return '<li><a href="#' + g.id + '">' + MD.esc(g.tieuDe) + '</a></li>'; }).join('') + '</ol></li>' : '';
}).join('');
var tl = '<!doctype html>\n<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
  '<title>Hướng dẫn sử dụng – Nhân sự, Chấm công, Tiền lương</title><style>' +
  ':root{--chu:#1d2733;--mo:#5b6775;--xanh:#0b5cad;--vien:#dfe5ec;--nen:#f5f7fa}' +
  '*{box-sizing:border-box}body{margin:0;font:15px/1.6 "Segoe UI",Roboto,Arial,sans-serif;color:var(--chu);background:var(--nen)}' +
  '.khung{max-width:880px;margin:0 auto;padding:24px 16px 60px}.bia{display:flex;gap:16px;align-items:center;margin-bottom:8px}.bia img{width:64px;height:64px}' +
  '.bia h1{margin:0;font-size:24px;color:var(--xanh)}.bia div{color:var(--mo)}' +
  '.ml,section{background:#fff;border:1px solid var(--vien);border-radius:12px;padding:18px 24px;margin:16px 0}' +
  '.ml ol{padding-left:22px}.ml>ol>li{margin:6px 0}.ml a{color:var(--xanh);text-decoration:none}' +
  'section h1{font-size:21px;color:var(--xanh);margin:0 0 6px;border-bottom:2px solid var(--vien);padding-bottom:6px}section h2{font-size:17px;margin:18px 0 6px}' +
  'a{color:var(--xanh)}code{background:#eef2f6;border-radius:4px;padding:0 4px;font-family:Consolas,monospace}' +
  'table{border-collapse:collapse;margin:8px 0;width:100%}th,td{border:1px solid var(--vien);padding:5px 8px;text-align:left;vertical-align:top}th{background:#eef3f9}' +
  '.hd-ghichu{border-left:4px solid #f0b429;background:#fff8e6;padding:8px 12px;border-radius:6px;margin:10px 0}' +
  '.len{float:right;font-size:13px;text-decoration:none}.hd-cuon{overflow-x:auto}' +
  '@media print{body{background:#fff}.khung{padding:0}section,.ml{border:0;padding:0;margin:0}section{page-break-before:always}.len{display:none}a{color:inherit;text-decoration:none}}' +
  '</style></head><body><div class="khung">' +
  '<div class="bia">' + (logo ? '<img src="' + logo + '" alt="">' : '') + '<div><div>CÔNG TY TNHH MTV CẤP NƯỚC HẬU GIANG</div><h1>HƯỚNG DẪN SỬ DỤNG</h1>' +
  '<div>Phần mềm Nhân sự – Chấm công – Tiền lương</div></div></div>' +
  '<nav class="ml" id="muc-luc"><b>Mục lục</b><ol>' + mucLuc + '</ol></nav>' +
  NHOM.map(function (n) { return ds.filter(function (g) { return g.nhom === n; }); }).reduce(function (a, b) { return a.concat(b); }, [])
    .concat(ds.filter(function (g) { return NHOM.indexOf(g.nhom) < 0; }))
    .map(function (g) { return '<section id="' + g.id + '"><a class="len" href="#muc-luc">↑ Mục lục</a>' + MD.html(g.md, { lienKet: lienKet }) + '</section>'; }).join('') +
  '</div></body></html>';
fs.writeFileSync(path.join(__dirname, 'HUONG_DAN_SU_DUNG.html'), tl);
console.log('Đã tạo HUONG_DAN_SU_DUNG.html (' + ds.length + ' phần, ' + Math.round(tl.length / 1024) + ' KB)');
