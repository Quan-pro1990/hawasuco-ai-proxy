/* Kiểm thử giọng đọc tiếng Việt tích hợp (eSpeak NG WebAssembly trong giong-doc/): nạp, chọn giọng, đọc ra âm thanh.
   Chạy: node test/giongdoc.test.js */
'use strict';
var assert = require('assert'), fs = require('fs'), path = require('path');
var GiongDocVN = require('../giong-doc/espeakng-vi.js');
var wasm = fs.readFileSync(path.join(__dirname, '..', 'giong-doc', 'espeakng-vi.wasm'));

GiongDocVN({ wasmBinary: wasm, print: function () {}, printErr: function () {} }).then(function (M) {
  var tanSo = M._gd_khoi();
  assert.strictEqual(tanSo, 22050);
  function chuoiC(s) { var b = Buffer.from(s + '\0', 'utf8'), p = M._malloc(b.length); M.HEAPU8.set(b, p); return p; }
  function doc(giong, chu) {
    var p = chuoiC(giong); assert.strictEqual(M._gd_giong(p), 0, 'chọn được giọng ' + giong); M._free(p);
    M._gd_dat(1, 155);
    p = chuoiC(chu); var n = M._gd_doc(p); M._free(p);
    var o = M._gd_mau() >> 1, mau = M.HEAP16.subarray(o, o + n), max = 0;
    for (var i = 0; i < n; i++) max = Math.max(max, Math.abs(mau[i]));
    return { giay: n / tanSo, max: max };
  }
  ['vi-vn-x-south', 'vi-vn-x-south+f3', 'vi', 'vi+f3', 'vi-vn-x-central'].forEach(function (g) {
    var r = doc(g, 'Xin chào, tôi là trợ lý ảo. Lương cơ sở hiện nay là 2530000 đồng một tháng.');
    assert.ok(r.giay > 3 && r.giay < 8, g + ': thời lượng hợp lý (' + r.giay.toFixed(2) + ' s)');
    assert.ok(r.max > 3000, g + ': có tiếng');
    console.log('  ✓ ' + g + ': ' + r.giay.toFixed(2) + ' s');
  });
  // câu dài hơn thì đọc lâu hơn; chuỗi rỗng không lỗi
  assert.ok(doc('vi', 'Một hai ba bốn năm sáu bảy tám chín mười.').giay > doc('vi', 'Một.').giay);
  assert.ok(doc('vi', '').giay < 0.5);
  // phiên âm IPA cho giọng AI (Piper vi_VN-vais1000-medium): mọi âm vị phải có trong bảng âm vị của mô hình
  var cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'giong-doc', 'ai', 'vi_VN-vais1000-medium.onnx.json'), 'utf8'));
  var p = chuoiC('vi'); M._gd_giong(p); M._free(p);
  ['Xin chào, tôi là trợ lý ảo.', 'Lương cơ sở hiện nay là 2530000 đồng một tháng.', 'Nguyễn Thị Huyền, phường Vị Thanh, tỉnh Hậu Giang; hưởng 85% lương.',
    'Quỳnh, Khánh, Phượng, Nghĩa, Giang, Trịnh, Đặng, Võ, Huỳnh, Ưng, Ở, Ửng, Ỷ.'].forEach(function (cau) {
    var q = chuoiC(cau), am = M.UTF8ToString(M._gd_ipa(q)); M._free(q);
    am = am.replace(/\([a-z]{2,3}(-[a-z0-9]+)*\)/gi, '');
    var thieu = Array.from(am).filter(function (c) { return !/\s/.test(c) && !cfg.phoneme_id_map[c]; });
    assert.ok(am.length > cau.length / 2, 'có âm vị: ' + cau);
    assert.deepStrictEqual(thieu, [], 'âm vị không có trong mô hình: ' + thieu.join(' ') + ' (' + cau + ')');
  });
  console.log('  ✓ phiên âm IPA khớp bảng âm vị của giọng AI');
  console.log('\nGiọng đọc tích hợp: đạt.');
}).catch(function (e) { console.error(e); process.exit(1); });
