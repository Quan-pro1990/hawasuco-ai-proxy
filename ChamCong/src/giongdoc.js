/* Giọng đọc tiếng Việt tích hợp sẵn: eSpeak NG (WebAssembly, thư mục giong-doc/) chạy ngay trong trình duyệt –
   không cần cài giọng tiếng Việt cho Windows, không cần Internet, văn bản không gửi ra ngoài.
   App.GiongDoc.noi(chu, { giong, toc, batDau, xong }) đọc; App.GiongDoc.dung() dừng. */
(function () {
  'use strict';
  var DS = [
    { ma: 'nam', ten: 'Giọng máy eSpeak – miền Nam', espeak: 'vi-vn-x-south' },
    { ma: 'nam-nu', ten: 'Giọng máy eSpeak – miền Nam, nữ', espeak: 'vi-vn-x-south+f3' },
    { ma: 'bac', ten: 'Giọng máy eSpeak – miền Bắc', espeak: 'vi' },
    { ma: 'bac-nu', ten: 'Giọng máy eSpeak – miền Bắc, nữ', espeak: 'vi+f3' },
    { ma: 'trung', ten: 'Giọng máy eSpeak – miền Trung', espeak: 'vi-vn-x-central' }
  ];
  var M = null, dangTai = null, loiTai = null, ctx = null, nguon = null, phien = 0, giongDat = '', tanSo = 22050, henXong = null;

  function AC() { return window.AudioContext || window.webkitAudioContext; }
  /** Trình duyệt chạy được bộ đọc tích hợp không (WebAssembly, Web Audio, giải nén gzip) */
  function coThe() { return !!(window.WebAssembly && AC() && typeof window.GiongDocVN === 'function' && window.GIONG_DOC_WASM && typeof window.DecompressionStream === 'function'); }

  function giaiNen(b64) {
    var s = atob(b64), b = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  }
  /** Nạp bộ đọc (lần đầu ~0,1–0,3 giây) */
  function tai() {
    if (M) return Promise.resolve(M);
    if (dangTai) return dangTai;
    if (!coThe()) return Promise.reject(new Error('Trình duyệt này chưa chạy được giọng đọc tích hợp.'));
    dangTai = giaiNen(window.GIONG_DOC_WASM).then(function (bin) {
      return window.GiongDocVN({ wasmBinary: bin, print: function () {}, printErr: function () {} });
    }).then(function (m) {
      tanSo = m._gd_khoi();
      if (!(tanSo > 0)) throw new Error('Không khởi tạo được bộ đọc.');
      M = m; loiTai = null; return m;
    });
    dangTai.catch(function (e) {
      dangTai = null;
      // máy chủ cũ chặn WebAssembly (Content-Security-Policy thiếu 'wasm-unsafe-eval')
      loiTai = /Content Security Policy|CSP|unsafe-eval|CompileError/i.test(String(e && (e.message || e))) ?
        'Máy chủ đang chặn giọng đọc tích hợp – cần cài bản máy chủ mới (chạy lại CaiDat-MayChu-IIS.bat).' : String(e && e.message || e);
    });
    return dangTai;
  }
  function chuoiC(s) { var b = new TextEncoder().encode(s + '\0'), p = M._malloc(b.length); M.HEAPU8.set(b, p); return p; }
  function timGiong(ma) { return DS.filter(function (g) { return g.ma === ma; })[0] || DS[0]; }
  /** Văn bản -> mẫu âm thanh Float32 (đọc cả đoạn một lần: eSpeak tự ngắt câu, ngắt nghỉ) */
  function tongHop(chu, ma, toc) {
    var g = timGiong(ma), p;
    if (giongDat !== g.espeak) { p = chuoiC(g.espeak); M._gd_giong(p); M._free(p); giongDat = g.espeak; }
    M._gd_dat(1, Math.round(155 * (toc || 1)));   // tốc độ (từ/phút; tiếng Việt: tiếng/phút)
    M._gd_dat(2, 75);                              // âm lượng: bớt méo tiếng
    p = chuoiC(chu);
    var n = M._gd_doc(p); M._free(p);
    var o = M._gd_mau() >> 1, nguonMau = M.HEAP16.subarray(o, o + n), f = new Float32Array(n);
    for (var i = 0; i < n; i++) f[i] = nguonMau[i] / 32768;
    return f;
  }
  function dung() {
    phien++;
    clearTimeout(henXong);
    if (nguon) { var s = nguon; nguon = null; s.onended = null; try { s.stop(); } catch (e) { /* bỏ qua */ } }
  }
  /** Đọc chu; o.batDau() khi bắt đầu phát, o.xong() khi đọc hết, o.loi(thongBao) khi không đọc được. Trả Promise. */
  function noi(chu, o) {
    o = o || {};
    dung();
    var ma = phien;
    if (!ctx && AC()) { try { ctx = new (AC())(); } catch (e) { ctx = null; } }   // tạo ngay trong lúc người dùng vừa bấm / gõ
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return tai().then(function () {
      if (ma !== phien) return;
      if (!ctx) throw new Error('Trình duyệt không phát được âm thanh.');
      var f = tongHop(chu, o.giong, o.toc);
      if (!f.length) { if (o.xong) o.xong(); return; }
      var buf = ctx.createBuffer(1, f.length, tanSo);
      buf.getChannelData(0).set(f);
      var s = ctx.createBufferSource();
      s.buffer = buf; s.connect(ctx.destination);
      s.onended = function () { if (nguon !== s) return; nguon = null; clearTimeout(henXong); if (o.xong) o.xong(); };
      nguon = s;
      s.start();
      if (o.batDau) o.batDau();
      // phòng khi trình duyệt không báo onended (thẻ bị ẩn…)
      henXong = setTimeout(function () { if (nguon === s) { nguon = null; if (o.xong) o.xong(); } }, f.length / tanSo * 1000 + 1500);
    }).catch(function (e) {
      if (ma !== phien) return;
      if (o.loi) o.loi(loiTai || (e && e.message) || 'Không đọc được.');
    });
  }

  /** Phiên âm IPA tiếng Việt (cho giọng AI Piper); gọi sau khi tai() xong */
  function ipa(chu) {
    if (!M) throw new Error('Bộ phiên âm chưa nạp.');
    if (giongDat !== 'vi') { var g = chuoiC('vi'); M._gd_giong(g); M._free(g); giongDat = 'vi'; }
    var p = chuoiC(chu), kq = M.UTF8ToString(M._gd_ipa(p));
    M._free(p);
    return kq;
  }

  App.GiongDoc = {
    ds: DS, coThe: coThe, tai: tai, noi: noi, dung: dung, ipa: ipa,
    dangDoc: function () { return !!nguon; },
    loi: function () { return loiTai; },
    /** dùng cho kiểm thử: số mẫu âm thanh của 1 câu */
    thu: function (chu, ma) { return tai().then(function () { return tongHop(chu, ma, 1).length / tanSo; }); }
  };
})();
