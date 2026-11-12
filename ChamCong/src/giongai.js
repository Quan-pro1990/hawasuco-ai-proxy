/* Giọng đọc AI tiếng Việt tự nhiên: mô hình Piper vi_VN-vais1000-medium chạy ngay trong trình duyệt bằng ONNX Runtime Web
   (luồng nền Web Worker – màn hình không bị đơ). eSpeak NG (giongdoc.js) chỉ dùng để phiên âm chữ -> âm vị.
   Tệp mô hình + bộ chạy nằm ở giong-doc/ai/ trên máy chủ; tải 1 lần rồi lưu trong trình duyệt (IndexedDB).
   App.GiongAI.noi(chu, { toc, batDau, xong, loi }) đọc; App.GiongAI.dung() dừng. */
(function () {
  'use strict';
  var CH = window.GIONG_AI_CAU_HINH;     // cấu hình mô hình (bảng âm vị, tần số mẫu…), nhúng lúc đóng gói
  var THU_MUC = 'giong-doc/ai/', TEP_MH = 'vi_VN-vais1000-medium.onnx', TEP_ORT = 'ort-wasm-simd.wasm';
  var KHOA_MH = 'mohinh-' + (CH ? CH.sha : ''), KHOA_ORT = 'ort-' + (CH ? CH.shaOrt : '');
  var TT = { trangThai: 'chua', tienDo: 0, loi: '' };   // chua | dangtai | san | cantep | loi
  var worker = null, dangTai = null, cho = {}, soYC = 0, ctx = null, phien = 0, dangPhat = [], henXong = null, theoDoi = [];

  function AC() { return window.AudioContext || window.webkitAudioContext; }
  function coThe() {
    return !!(CH && window.ORT_CORE_JS && window.Worker && window.WebAssembly && AC() && window.indexedDB && typeof BigInt64Array === 'function' &&
      App.GiongDoc && App.GiongDoc.coThe());
  }
  function bao() { theoDoi.forEach(function (f) { try { f(TT); } catch (e) { /* bỏ qua */ } }); }
  function datTT(t, tienDo, loi) { TT.trangThai = t; if (tienDo != null) TT.tienDo = tienDo; TT.loi = loi || ''; bao(); }

  /* ---------- lưu tệp trong trình duyệt (IndexedDB) ---------- */
  function moDB() {
    return new Promise(function (ok, loi) {
      var r = indexedDB.open('ChamCong_GiongAI', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('tep'); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { loi(r.error); };
    });
  }
  function docDB(k) {
    return moDB().then(function (db) {
      return new Promise(function (ok) {
        var r = db.transaction('tep').objectStore('tep').get(k);
        r.onsuccess = function () { ok(r.result || null); }; r.onerror = function () { ok(null); };
      });
    }).catch(function () { return null; });
  }
  function ghiDB(k, v) {
    return moDB().then(function (db) {
      return new Promise(function (ok) {
        var t = db.transaction('tep', 'readwrite');
        // bản cũ (mô hình khác) thì xoá cho nhẹ
        var s = t.objectStore('tep'), dsKhoa = s.getAllKeys ? s.getAllKeys() : null;
        if (dsKhoa) dsKhoa.onsuccess = function () { dsKhoa.result.forEach(function (x) { if (String(x).split('-')[0] === k.split('-')[0] && x !== k) s.delete(x); }); };
        s.put(v, k);
        t.oncomplete = function () { ok(true); }; t.onerror = t.onabort = function () { ok(false); };
      });
    }).catch(function () { return false; });
  }

  /* ---------- tải tệp từ máy chủ (có tiến độ) ---------- */
  function taiTep(url, phan) {
    return fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('Máy chủ chưa có giọng đọc AI (' + r.status + ') – chạy lại CaiDat-MayChu-IIS.bat của bộ cài mới.');
      var tong = +r.headers.get('Content-Length') || 0;
      if (!r.body || !tong) return r.arrayBuffer();
      var doc = r.body.getReader(), buf = new Uint8Array(tong), da = 0;
      function buoc() {
        return doc.read().then(function (x) {
          if (x.done) return buf.buffer;
          buf.set(x.value, da); da += x.value.length;
          datTT('dangtai', Math.round(phan[0] + (phan[1] - phan[0]) * da / tong));
          return buoc();
        });
      }
      return buoc();
    });
  }
  function layTep(khoa, tep, phan) {
    return docDB(khoa).then(function (b) {
      if (b) return b;
      if (location.protocol === 'file:') { var e = new Error('Chạy 1 file trên máy: cần nạp tệp giọng đọc AI (thư mục giong-doc/ai của bộ cài).'); e.canTep = true; throw e; }
      return taiTep(THU_MUC + tep, phan).then(function (b2) { return ghiDB(khoa, b2).then(function () { return b2; }); });
    });
  }

  /* ---------- luồng nền chạy mô hình ---------- */
  function chayTrongWorker() {
    var phienMH = null;
    self.onmessage = function (e) {
      var m = e.data;
      function loi(er) { self.postMessage({ loai: 'loi', ma: m.ma, loi: String(er && er.message || er) }); }
      if (m.loai === 'khoi') {
        ort.env.wasm.numThreads = 1;
        // chạy 1 file trên máy: dữ liệu wasm chuyển vào đây, tạo địa chỉ blob ngay trong luồng nền (trang file:// có nguồn "null")
        if (m.wasm && m.wasm.byteLength) { var map = {}; map['ort-wasm-simd.wasm'] = URL.createObjectURL(new Blob([m.wasm], { type: 'application/wasm' })); ort.env.wasm.wasmPaths = map; }
        else ort.env.wasm.wasmPaths = m.wasm;
        ort.InferenceSession.create(new Uint8Array(m.moHinh), { executionProviders: ['wasm'], graphOptimizationLevel: 'all' })
          .then(function (s) { phienMH = s; self.postMessage({ loai: 'san', ma: m.ma }); }, loi);
      } else if (m.loai === 'doc') {
        try {
          var n = m.ids.length, a = new BigInt64Array(n);
          for (var i = 0; i < n; i++) a[i] = BigInt(m.ids[i]);
          var vao = {
            input: new ort.Tensor('int64', a, [1, n]),
            input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(n)]), [1]),
            scales: new ort.Tensor('float32', Float32Array.from(m.scales), [3])
          };
          phienMH.run(vao).then(function (r) {
            var am = new Float32Array(r[phienMH.outputNames[0]].data);
            self.postMessage({ loai: 'am', ma: m.ma, am: am }, [am.buffer]);
          }, loi);
        } catch (er) { loi(er); }
      }
    };
  }
  function taoWorker() {
    var nguon = window.ORT_CORE_JS + '\n;(' + chayTrongWorker.toString() + ')();';
    var url = URL.createObjectURL(new Blob([nguon], { type: 'text/javascript' }));
    worker = new Worker(url);
    worker.onmessage = function (e) { var m = e.data, c = cho[m.ma]; if (!c) return; delete cho[m.ma]; if (m.loai === 'loi') c.loi(new Error(m.loi)); else c.ok(m); };
    worker.onerror = function (e) {
      var loi = new Error((e && e.message) || 'Luồng nền giọng đọc AI bị lỗi.');
      Object.keys(cho).forEach(function (k) { cho[k].loi(loi); delete cho[k]; });
      worker = null; datTT('loi', null, loi.message); dangTai = null;
    };
  }
  function yeuCau(m, chuyen) {
    return new Promise(function (ok, loi) { m.ma = ++soYC; cho[m.ma] = { ok: ok, loi: loi }; worker.postMessage(m, chuyen || []); });
  }
  function urlOrt() {
    if (location.protocol !== 'file:') return Promise.resolve(new URL(THU_MUC, location.href).href);   // bộ nhớ đệm HTTP lo phần còn lại
    return docDB(KHOA_ORT).then(function (b) {
      if (!b) { var e = new Error('Chạy 1 file trên máy: cần nạp tệp giọng đọc AI (thư mục giong-doc/ai của bộ cài).'); e.canTep = true; throw e; }
      return b;
    });
  }
  /** Nạp giọng AI: lần đầu tải mô hình ~63 MB từ máy chủ rồi lưu trong trình duyệt */
  function tai() {
    if (TT.trangThai === 'san' && worker) return Promise.resolve();
    if (dangTai) return dangTai;
    if (!coThe()) return Promise.reject(new Error('Trình duyệt này chưa chạy được giọng đọc AI.'));
    datTT('dangtai', 0);
    dangTai = Promise.all([layTep(KHOA_MH, TEP_MH, [0, 100]), urlOrt(), App.GiongDoc.tai()]).then(function (r) {
      datTT('dangtai', 100);
      if (!worker) taoWorker();
      return yeuCau({ loai: 'khoi', moHinh: r[0], wasm: r[1] }, typeof r[1] === 'string' ? [r[0]] : [r[0], r[1]]);
    }).then(function () { datTT('san', 100); }, function (e) {
      dangTai = null;
      if (worker) { worker.terminate(); worker = null; }
      datTT(e && e.canTep ? 'cantep' : 'loi', null, e && e.message || String(e));
      throw e;
    });
    return dangTai;
  }
  /** Chạy 1 file trên máy: nạp tệp mô hình (.onnx) và bộ chạy (.wasm) người dùng chọn, lưu trong trình duyệt */
  function napTep(files) {
    var ds = Array.prototype.slice.call(files || []), viec = [];
    ds.forEach(function (f) {
      var k = /\.onnx$/i.test(f.name) ? KHOA_MH : /\.wasm$/i.test(f.name) ? KHOA_ORT : null;
      if (k) viec.push(f.arrayBuffer().then(function (b) { return ghiDB(k, b); }));
    });
    if (!viec.length) return Promise.reject(new Error('Hãy chọn tệp ' + TEP_MH + ' và ' + TEP_ORT + ' trong thư mục giong-doc/ai.'));
    return Promise.all(viec).then(function () { dangTai = null; datTT('chua', 0); return tai(); });
  }

  /* ---------- chữ -> âm vị -> số ---------- */
  var DAU = /[,.;:!?…]/;
  /** Tách câu (dấu . ! ?) và vế (dấu , ; :) */
  function tachCau(t) {
    var ds = [], cau = [], re = /[^,.;:!?…]+[,.;:!?…]*|[,.;:!?…]+/g, x;
    while ((x = re.exec(t))) {
      var tok = x[0], dau = (tok.match(/[,.;:!?…]+$/) || [''])[0], chu = tok.slice(0, tok.length - dau.length).trim();
      var d = dau ? dau.replace(/…/g, '.').slice(-1) : '';
      if (chu) cau.push({ chu: chu, dau: d });
      else if (d && cau.length) cau[cau.length - 1].dau = d;
      // hết câu, hoặc câu dài thì ngắt ở dấu phẩy: đoạn đầu ngắn để bắt đầu đọc ngay, các đoạn sau tổng hợp trong lúc đang đọc
      var dai = cau.reduce(function (s, v) { return s + v.chu.length; }, 0), nguong = ds.length ? 100 : 45;
      if (cau.length && (/[.!?]/.test(d) || (dai > nguong && /[,;:]/.test(d)))) { ds.push(cau); cau = []; }
    }
    if (cau.length) ds.push(cau);
    return ds;
  }
  function amVi(cau) {
    var s = '';
    cau.forEach(function (v) {
      var p = App.GiongDoc.ipa(v.chu).replace(/\([a-z]{2,3}(-[a-z0-9]+)*\)/gi, '').replace(/\s+/g, ' ').trim();
      if (!p) return;
      if (s && !/\s$/.test(s)) s += ' ';
      s += p;
      if (v.dau) s += v.dau + (/[,:;]/.test(v.dau) ? ' ' : '');
    });
    return s.trim();
  }
  function sangSo(s) {
    var m = CH.phoneme_id_map, pad = m._[0], ids = [m['^'][0], pad];
    Array.from(s).forEach(function (c) { if (m[c]) { ids.push(m[c][0]); ids.push(pad); } });
    ids.push(m.$[0]);
    return ids;
  }

  /* ---------- đọc ---------- */
  function dung() {
    phien++;
    clearTimeout(henXong);
    dangPhat.forEach(function (s) { s.onended = null; try { s.stop(); } catch (e) { /* bỏ qua */ } });
    dangPhat = [];
  }
  /** Đọc chu: tổng hợp từng câu trong luồng nền, câu nào xong thì xếp hàng phát ngay (câu sau tổng hợp trong lúc câu trước đang phát) */
  function noi(chu, o) {
    o = o || {};
    dung();
    var ma = phien;
    if (!ctx && AC()) { try { ctx = new (AC())(); } catch (e) { ctx = null; } }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    var toc = Math.max(0.6, Math.min(1.6, o.toc || 1));
    // length_scale > 1: đọc chậm, rõ hơn; noise_scale / noise_w theo mô hình: ngữ điệu tự nhiên, có lên xuống
    var inf = CH.inference || {}, scales = [inf.noise_scale != null ? inf.noise_scale : 0.667, (inf.length_scale || 1) * 1.08 / toc, inf.noise_w != null ? inf.noise_w : 0.8];
    var tanSo = (CH.audio && CH.audio.sample_rate) || 22050;
    return tai().then(function () {
      if (ma !== phien) return;
      if (!ctx) throw new Error('Trình duyệt không phát được âm thanh.');
      var ds = tachCau(chu), luc = 0, daBD = false;
      var chuoi = Promise.resolve();
      ds.forEach(function (cau, i) {
        chuoi = chuoi.then(function () {
          if (ma !== phien) return;
          var ids = sangSo(amVi(cau));
          if (ids.length < 5) return;
          return yeuCau({ loai: 'doc', ids: ids, scales: scales }).then(function (r) {
            if (ma !== phien) return;
            var f = r.am, dinh = 0, j;
            for (j = 0; j < f.length; j++) if (Math.abs(f[j]) > dinh) dinh = Math.abs(f[j]);
            var he = dinh > 0.01 ? 0.92 / dinh : 1;    // chuẩn hoá âm lượng từng câu như Piper
            for (j = 0; j < f.length; j++) f[j] *= he;
            var buf = ctx.createBuffer(1, f.length, tanSo);
            buf.getChannelData(0).set(f);
            var s = ctx.createBufferSource();
            s.buffer = buf; s.connect(ctx.destination);
            var bd = Math.max(ctx.currentTime + 0.04, luc);
            s.start(bd);
            dangPhat.push(s);
            var cuoi = cau[cau.length - 1].dau;
            luc = bd + buf.duration + (cuoi === '?' || cuoi === '!' || cuoi === '.' ? 0.32 : 0.18);   // nghỉ giữa câu
            if (!daBD) { daBD = true; if (o.batDau) setTimeout(o.batDau, Math.max(0, (bd - ctx.currentTime) * 1000)); }
          });
        });
      });
      return chuoi.then(function () {
        if (ma !== phien) return;
        var con = daBD ? Math.max(0, (luc - ctx.currentTime) * 1000 - 150) : 0;
        henXong = setTimeout(function () { if (ma === phien) { dangPhat = []; if (o.xong) o.xong(); } }, con);
      });
    }).catch(function (e) {
      if (ma !== phien) return;
      if (o.loi) o.loi(e && e.message || String(e), e && e.canTep);
    });
  }

  App.GiongAI = {
    coThe: coThe, tai: tai, noi: noi, dung: dung, napTep: napTep,
    trangThai: function () { return TT; },
    theoDoi: function (f) { theoDoi.push(f); },
    dangDoc: function () { return dangPhat.length > 0; },
    /** kiểm thử: âm vị và thời lượng (giây) của 1 câu */
    thu: function (chu, toc) {
      return tai().then(function () {
        var ds = tachCau(chu), ph = ds.map(amVi), t0 = performance.now();
        return yeuCau({ loai: 'doc', ids: sangSo(ph.join(' ')), scales: [0.667, 1.08 / (toc || 1), 0.8] }).then(function (r) {
          return { amVi: ph.join(' | '), giay: r.am.length / ((CH.audio && CH.audio.sample_rate) || 22050), msTongHop: Math.round(performance.now() - t0), am: r.am };
        });
      });
    }
  };
})();
