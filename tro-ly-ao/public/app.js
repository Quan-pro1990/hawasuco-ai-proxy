/* Trợ lý ảo giọng nói — trang web (không dùng thư viện ngoài).
   Nghe: Web Speech API (SpeechRecognition, tiếng Việt). Nói: speechSynthesis (giọng vi-VN có sẵn trên máy).
   Câu trả lời đến dần từ máy chủ (text/event-stream) và được đọc ngay từng câu. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var KHOA = { token: 'troly.token', nguoi: 'troly.nguoi', giong: 'troly.giong', tocDo: 'troly.tocDo', docTo: 'troly.docTo', ranhTay: 'troly.ranhTay' };
  function doc(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function ghi(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* bỏ qua */ } }

  var st = {
    thongTin: null,
    token: doc(KHOA.token),
    nguoi: null,
    hoiThoai: null,          // mã hội thoại trên máy chủ
    trangThai: 'ranh',       // ranh | nghe | nghi | noi
    docTo: doc(KHOA.docTo) !== '0',
    ranhTay: doc(KHOA.ranhTay) === '1',
    tocDo: parseFloat(doc(KHOA.tocDo) || '1') || 1,
    huyYeuCau: null,         // AbortController của câu đang hỏi
    lanKhongNghe: 0
  };
  try { st.nguoi = JSON.parse(doc(KHOA.nguoi) || 'null'); } catch (e) { st.nguoi = null; }

  var GOI_Y_SO_LIEU = [
    'Tỷ lệ thất thoát tháng mới nhất là bao nhiêu?',
    'Đội nào thất thoát cao nhất tháng này?',
    'Đội nào đang vượt kế hoạch?',
    'Lũy kế năm nay so với cùng kỳ thế nào?',
    'Sản lượng khai thác nước mặt tháng này?'
  ];
  var GOI_Y_CHUNG = [
    'Cách giảm thất thoát nước trên mạng lưới?',
    'Vùng DMA là gì?',
    'Soạn giúp thông báo tạm ngưng cấp nước'
  ];

  // ================================================================== gọi máy chủ

  function api(method, duong, than) {
    var h = { 'Accept': 'application/json' };
    if (st.token) h.Authorization = 'Bearer ' + st.token;
    if (than !== undefined) h['Content-Type'] = 'application/json';
    return fetch('api/' + duong, { method: method, headers: h, body: than === undefined ? undefined : JSON.stringify(than), cache: 'no-store' })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null;
          try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
          if (!r.ok) { var e = new Error((j && j.loi) || ('Lỗi máy chủ (' + r.status + ')')); e.status = r.status; throw e; }
          return j;
        });
      }, function () { throw new Error('Không kết nối được máy chủ trợ lý. Kiểm tra mạng rồi thử lại.'); });
  }

  // ================================================================== giọng đọc (nói)

  var tts = window.speechSynthesis || null;
  var giongDoc = null;
  var hangDoc = 0;              // số câu đang chờ / đang đọc
  var hetDoc = null;            // hàm gọi khi đọc xong hết
  var giuDoc = null;            // hẹn giờ chống Chrome máy tính tự dừng sau ~15 giây
  var laAndroid = /Android/i.test(navigator.userAgent);

  function danhSachGiong() {
    if (!tts) return [];
    return tts.getVoices().filter(function (v) { return /^vi([-_]|$)/i.test(v.lang); });
  }

  function diemGiong(v) {
    var n = v.name || '';
    return (/natural|online|neural/i.test(n) ? 4 : 0) + (/google/i.test(n) ? 2 : 0) + (/hoaimy|namminh/i.test(n) ? 1 : 0) + (v.localService ? 0 : 1);
  }

  function chonGiong() {
    var ds = danhSachGiong();
    var daLuu = doc(KHOA.giong);
    giongDoc = ds.filter(function (v) { return v.voiceURI === daLuu; })[0] ||
      ds.slice().sort(function (a, b) { return diemGiong(b) - diemGiong(a); })[0] || null;
    veDanhSachGiong(ds);
  }

  function veDanhSachGiong(ds) {
    var sel = $('cdGiong');
    sel.textContent = '';
    if (!ds.length) {
      var o = document.createElement('option');
      o.textContent = tts ? 'Giọng mặc định của máy' : 'Trình duyệt không hỗ trợ đọc';
      sel.appendChild(o);
    }
    ds.forEach(function (v) {
      var o = document.createElement('option');
      o.value = v.voiceURI;
      o.textContent = v.name + (v.localService ? '' : ' (trực tuyến)');
      if (giongDoc && v.voiceURI === giongDoc.voiceURI) o.selected = true;
      sel.appendChild(o);
    });
    $('cdKhongGiong').hidden = !tts || ds.length > 0;
  }

  if (tts) {
    chonGiong();
    if (typeof tts.addEventListener === 'function') tts.addEventListener('voiceschanged', chonGiong);
    else tts.onvoiceschanged = chonGiong;
  }

  /** Bỏ ký hiệu mà máy đọc sẽ đọc sai. */
  function lamSachDeDoc(s) {
    return String(s)
      .replace(/[*_#`>|~\[\]]/g, ' ')
      .replace(/(\d)\s*%/g, '$1 phần trăm').replace(/%/g, ' phần trăm')
      .replace(/\bm³|\bm3\b/g, 'mét khối')
      .replace(/\bTLK\b/g, 'thủy lượng kế')
      .replace(/→|->/g, ', ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function docCau(cau) {
    if (!tts || !st.docTo) return;
    cau = lamSachDeDoc(cau);
    if (!/[\p{L}\p{N}]/u.test(cau)) return;
    var u = new SpeechSynthesisUtterance(cau);
    u.lang = 'vi-VN';
    if (giongDoc) u.voice = giongDoc;
    u.rate = st.tocDo;
    hangDoc++;
    datTrangThai('noi');
    var daXong = false;
    var xong = function () {
      if (daXong) return;
      daXong = true;
      clearTimeout(baoHiem);
      hangDoc = Math.max(0, hangDoc - 1);
      if (hangDoc === 0) ketThucDoc();
    };
    // Vài máy Android không phát sự kiện "end": tự coi như xong sau thời gian ước tính.
    var baoHiem = setTimeout(xong, 4000 + cau.length * 160 / st.tocDo);
    u.onend = xong;
    u.onerror = xong;
    tts.speak(u);
    if (!giuDoc && !laAndroid && giongDoc && !giongDoc.localService) {
      giuDoc = setInterval(function () { if (tts.speaking && !tts.paused) { tts.pause(); tts.resume(); } }, 10000);
    }
  }

  function dungDoc() {
    hetDoc = null;
    hangDoc = 0;
    if (giuDoc) { clearInterval(giuDoc); giuDoc = null; }
    if (tts) tts.cancel();
  }

  function ketThucDoc() {
    if (giuDoc) { clearInterval(giuDoc); giuDoc = null; }
    var f = hetDoc;
    hetDoc = null;
    if (f) f();
    else if (st.huyYeuCau && st.trangThai === 'noi') datTrangThai('nghi');   // đọc kịp hết, câu trả lời vẫn đang tới
  }

  /** Gọi f khi đã đọc xong mọi câu (ngay lập tức nếu không còn gì đọc). */
  function khiDocXong(f) {
    if (hangDoc === 0) f(); else hetDoc = f;
  }

  // Safari / iOS chỉ cho đọc khi lần đầu được gọi trong 1 lần chạm.
  var daMoKhoaDoc = false;
  function moKhoaDoc() {
    if (daMoKhoaDoc || !tts) return;
    daMoKhoaDoc = true;
    try { var u = new SpeechSynthesisUtterance(' '); u.volume = 0; tts.speak(u); } catch (e) { /* bỏ qua */ }
  }

  // ================================================================== nhận giọng nói (nghe)

  var SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  var nhanDang = null;
  var tinTam = null;          // bong bóng chữ đang nghe

  function batDauNghe() {
    if (!SR) { moOGo(true); thongBaoTrangThai('Trình duyệt này không nhận giọng nói — hãy gõ chữ, hoặc dùng Chrome / Edge.'); return; }
    dungDoc();
    var r = new SR();
    nhanDang = r;
    r.lang = 'vi-VN';
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    var chuChot = '', chuTam = '', loi = null;
    r.onstart = function () { datTrangThai('nghe'); };
    r.onresult = function (ev) {
      chuTam = '';
      chuChot = '';
      for (var i = 0; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) chuChot += ev.results[i][0].transcript;
        else chuTam += ev.results[i][0].transcript;
      }
      var hien = (chuChot + ' ' + chuTam).trim();
      if (hien) {
        anChao();
        if (!tinTam) tinTam = themTin('nguoi tam', '');
        tinTam.textContent = hien;
        cuonXuong();
      }
    };
    r.onerror = function (ev) { loi = ev.error; };
    r.onend = function () {
      if (nhanDang !== r) return;
      nhanDang = null;
      var cau = (chuChot || chuTam).trim();
      if (tinTam) { tinTam.remove(); tinTam = null; }
      if (cau) { st.lanKhongNghe = 0; hoi(cau); return; }
      datTrangThai('ranh');
      if (loi === 'not-allowed' || loi === 'service-not-allowed') {
        thongBaoTrangThai('Chưa được phép dùng micro. Bấm biểu tượng ổ khoá trên thanh địa chỉ → cho phép Micro.');
        tatRanhTay();
      } else if (loi === 'audio-capture') {
        thongBaoTrangThai('Không tìm thấy micro trên máy này.');
        tatRanhTay();
      } else if (loi === 'network') {
        thongBaoTrangThai('Nhận giọng nói cần Internet — kiểm tra mạng rồi thử lại.');
      } else if (st.ranhTay && (loi === 'no-speech' || !loi)) {
        // Rảnh tay: chưa nghe gì thì nghe lại, 2 lần liền không nghe được thì nghỉ.
        if (++st.lanKhongNghe < 2) setTimeout(function () { if (st.trangThai === 'ranh') batDauNghe(); }, 300);
        else { st.lanKhongNghe = 0; thongBaoTrangThai('Em không nghe thấy gì. Chạm micro khi anh chị muốn nói.'); }
      } else if (loi === 'no-speech') {
        thongBaoTrangThai('Em chưa nghe thấy gì. Chạm micro rồi nói nhé.');
      }
    };
    try { r.start(); } catch (e) { nhanDang = null; datTrangThai('ranh'); }
  }

  function dungNghe(guiLuon) {
    if (!nhanDang) return;
    if (guiLuon) nhanDang.stop();      // stop → onend vẫn gửi phần đã nghe
    else { var r = nhanDang; nhanDang = null; r.abort(); if (tinTam) { tinTam.remove(); tinTam = null; } datTrangThai('ranh'); }
  }

  // ================================================================== hỏi trợ lý

  function hoi(cau) {
    cau = String(cau || '').trim();
    if (!cau) return;
    moKhoaDoc();
    dungDoc();
    anChao();
    themTin('nguoi', cau);
    var tin = themTin('tro-ly', '');
    var cho = document.createElement('span');
    cho.className = 'cho';
    cho.innerHTML = '<i></i><i></i><i></i>';
    tin.appendChild(cho);
    var dongTra = null;           // dòng "Đang xem số liệu…"
    var noiDung = document.createElement('span');
    tin.appendChild(noiDung);
    cuonXuong();
    datTrangThai('nghi');

    var boDem = '';                // chữ chưa đọc (chưa đủ 1 câu)
    var toanBo = '';
    var coLoi = false, hetPhien = false;

    function dayChu(t) {
      if (cho.parentNode) cho.remove();
      toanBo += t;
      noiDung.textContent = toanBo;
      boDem += t;
      // Đọc ngay từng câu trọn vẹn (dấu câu + khoảng trắng; "12,5" hay "1.250" không bị cắt).
      var m;
      while ((m = /^([\s\S]*?[.!?…;:\n])(\s+)/.exec(boDem))) {
        docCau(m[1]);
        boDem = boDem.slice(m[0].length);
      }
      if (boDem.length > 260) {
        var cat = boDem.lastIndexOf(', ');
        if (cat > 80) { docCau(boDem.slice(0, cat + 1)); boDem = boDem.slice(cat + 2); }
      }
      cuonXuong();
    }

    var huy = new AbortController();
    st.huyYeuCau = huy;
    var h = { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' };
    if (st.token) h.Authorization = 'Bearer ' + st.token;

    fetch('api/hoi', { method: 'POST', headers: h, body: JSON.stringify({ hoiThoai: st.hoiThoai, cauHoi: cau }), signal: huy.signal, cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) {
          return r.json().catch(function () { return null; }).then(function (j) {
            var e = new Error((j && j.loi) || ('Lỗi máy chủ (' + r.status + ')'));
            e.status = r.status;
            throw e;
          });
        }
        return docLuong(r.body, function (suKien, d) {
          switch (suKien) {
            case 'batdau': st.hoiThoai = d.hoiThoai; try { sessionStorage.setItem('troly.hoiThoai', d.hoiThoai); } catch (e) { /* bỏ qua */ } break;
            case 'doan': if (toanBo && !/\s$/.test(toanBo)) dayChu(' '); break;
            case 'chu': dayChu(d.t); break;
            case 'congcu':
              if (!dongTra) { dongTra = document.createElement('div'); dongTra.className = 'tra'; tin.insertBefore(dongTra, tin.firstChild); }
              dongTra.textContent = d.moTa;
              thongBaoTrangThai(d.moTa);
              break;
            case 'thongbao': themTin('ghi-chu', d.t); break;
            case 'hetphien': hetPhien = true; break;
            case 'loi': coLoi = true; dayChu((toanBo ? ' ' : '') + d.loi + ' '); tin.classList.add('loi-tin'); break;
          }
        });
      })
      .then(function () {
        if (boDem.trim()) docCau(boDem);
        boDem = '';
        if (cho.parentNode) cho.remove();
        if (dongTra) { dongTra.classList.add('xong'); dongTra.textContent = dongTra.textContent.replace(/^Đang /, 'Đã ').replace(/…$/, ''); }
        if (!toanBo.trim() && !coLoi) noiDung.textContent = '(Không có câu trả lời)';
      })
      .catch(function (e) {
        if (cho.parentNode) cho.remove();
        if (huy.signal.aborted) {
          if (!toanBo) tin.remove();
          return;
        }
        coLoi = true;
        tin.classList.add('loi-tin');
        noiDung.textContent = (toanBo ? toanBo + '\n' : '') + e.message;
        docCau(e.message);
        if (e.status === 401) hetPhien = true;
      })
      .then(function () {
        if (st.huyYeuCau === huy) st.huyYeuCau = null;
        cuonXuong();
        if (hetPhien) { khiDocXong(function () { dangXuatCucBo('Phiên đăng nhập đã hết — hãy đăng nhập lại.'); }); return; }
        if (huy.signal.aborted) return;
        if (hangDoc === 0) datTrangThai('ranh');
        khiDocXong(function () {
          datTrangThai('ranh');
          if (st.ranhTay && !coLoi && SR) setTimeout(function () { if (st.trangThai === 'ranh') batDauNghe(); }, 250);
        });
      });
  }

  /** Đọc luồng text/event-stream từ fetch. */
  function docLuong(body, nhan) {
    var reader = body.getReader();
    var giaiMa = new TextDecoder('utf-8');
    var du = '';
    function xuLyKhoi(khoi) {
      var suKien = 'message', data = '';
      khoi.split('\n').forEach(function (dong) {
        if (dong.indexOf('event:') === 0) suKien = dong.slice(6).trim();
        else if (dong.indexOf('data:') === 0) data += dong.slice(5).trim();
      });
      if (!data) return;
      var d;
      try { d = JSON.parse(data); } catch (e) { return; }
      nhan(suKien, d);
    }
    function vong() {
      return reader.read().then(function (kq) {
        if (kq.done) { if (du.trim()) xuLyKhoi(du); return; }
        du += giaiMa.decode(kq.value, { stream: true }).replace(/\r/g, '');
        var i;
        while ((i = du.indexOf('\n\n')) >= 0) { xuLyKhoi(du.slice(0, i)); du = du.slice(i + 2); }
        return vong();
      });
    }
    return vong();
  }

  function huyCauDangHoi() {
    if (st.huyYeuCau) { st.huyYeuCau.abort(); st.huyYeuCau = null; }
    dungDoc();
    datTrangThai('ranh');
  }

  // ================================================================== giao diện

  var CHU_TRANG_THAI = {
    ranh: 'Chạm micro để nói',
    nghe: 'Đang nghe… nói xong em sẽ tự trả lời',
    nghi: 'Đang suy nghĩ… chạm để dừng',
    noi: 'Đang đọc… chạm để ngắt và nói tiếp'
  };
  var NHAN_MIC = { ranh: 'Bắt đầu nói', nghe: 'Dừng nghe', nghi: 'Dừng trả lời', noi: 'Ngắt và nói tiếp' };

  function datTrangThai(s) {
    st.trangThai = s;
    var mic = $('nutMic');
    mic.className = 'mic ' + s;
    mic.setAttribute('aria-label', NHAN_MIC[s]);
    $('trangThai').textContent = CHU_TRANG_THAI[s];
  }

  function thongBaoTrangThai(s) { $('trangThai').textContent = s; }

  function themTin(lop, chu) {
    var d = document.createElement('div');
    d.className = 'tin ' + lop;
    d.textContent = chu;
    $('hoiThoai').appendChild(d);
    return d;
  }

  function anChao() { var c = $('chao'); if (c) c.hidden = true; }

  function cuonXuong() {
    var k = $('hoiThoai');
    k.scrollTop = k.scrollHeight;
  }

  function veGoiY() {
    var g = $('goiY');
    g.textContent = '';
    var ds = (st.thongTin && st.thongTin.coSoLieu ? GOI_Y_SO_LIEU.slice(0, 4).concat(GOI_Y_CHUNG.slice(0, 1)) : GOI_Y_CHUNG);
    ds.forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = s;
      b.addEventListener('click', function () { hoi(s); });
      g.appendChild(b);
    });
  }

  function moOGo(bat) {
    $('oGo').hidden = !bat;
    $('nutBanPhim').setAttribute('aria-pressed', bat ? 'true' : 'false');
    if (bat) $('oGoChu').focus();
  }

  function tatRanhTay() { datRanhTay(false); }
  function datRanhTay(bat) {
    st.ranhTay = bat;
    ghi(KHOA.ranhTay, bat ? '1' : '0');
    $('nutRanhTay').setAttribute('aria-pressed', bat ? 'true' : 'false');
    $('cdRanhTay').checked = bat;
  }

  function cuocTroChuyenMoi() {
    huyCauDangHoi();
    dungNghe(false);
    var cu = st.hoiThoai;
    st.hoiThoai = null;
    try { sessionStorage.removeItem('troly.hoiThoai'); } catch (e) { /* bỏ qua */ }
    if (cu) api('POST', 'hoithoaimoi', { hoiThoai: cu }).catch(function () { /* bỏ qua */ });
    var k = $('hoiThoai');
    Array.prototype.slice.call(k.querySelectorAll('.tin')).forEach(function (x) { x.remove(); });
    $('chao').hidden = false;
    datTrangThai('ranh');
  }

  // ---------- nút

  $('nutMic').addEventListener('click', function () {
    moKhoaDoc();
    switch (st.trangThai) {
      case 'ranh': st.lanKhongNghe = 0; batDauNghe(); break;
      case 'nghe': dungNghe(true); break;
      case 'nghi': huyCauDangHoi(); break;
      case 'noi':
        dungDoc();
        if (st.huyYeuCau) { st.huyYeuCau.abort(); st.huyYeuCau = null; }
        datTrangThai('ranh');
        batDauNghe();
        break;
    }
  });
  $('nutBanPhim').addEventListener('click', function () { moOGo($('oGo').hidden); });
  $('nutRanhTay').addEventListener('click', function () {
    datRanhTay(!st.ranhTay);
    thongBaoTrangThai(st.ranhTay ? 'Rảnh tay: đọc xong em tự nghe câu tiếp theo.' : 'Đã tắt rảnh tay.');
  });
  $('oGo').addEventListener('submit', function (e) {
    e.preventDefault();
    var o = $('oGoChu');
    var s = o.value;
    o.value = '';
    if (st.trangThai === 'nghi') return;
    hoi(s);
  });
  $('nutMoi').addEventListener('click', cuocTroChuyenMoi);
  $('nutCaiDat').addEventListener('click', function () {
    $('cdNguoi').textContent = st.nguoi && (st.nguoi.hoTen || st.nguoi.ten) && st.nguoi.ten !== 'cucbo'
      ? 'Đang đăng nhập: ' + (st.nguoi.hoTen || st.nguoi.ten) : '';
    $('cdDangXuat').hidden = !st.token || st.token === 'cucbo';
    $('hopCaiDat').showModal();
  });
  $('cdGiong').addEventListener('change', function () {
    ghi(KHOA.giong, this.value);
    chonGiong();
  });
  $('cdTocDo').addEventListener('input', function () {
    st.tocDo = parseFloat(this.value) || 1;
    ghi(KHOA.tocDo, String(st.tocDo));
    $('cdTocDoSo').textContent = st.tocDo.toLocaleString('vi-VN', { minimumFractionDigits: 1 });
  });
  $('cdDocTo').addEventListener('change', function () {
    st.docTo = this.checked;
    ghi(KHOA.docTo, st.docTo ? '1' : '0');
    if (!st.docTo) dungDoc();
  });
  $('cdRanhTay').addEventListener('change', function () { datRanhTay(this.checked); });
  $('cdDocThu').addEventListener('click', function () {
    moKhoaDoc();
    dungDoc();
    var docTo = st.docTo;
    st.docTo = true;
    docCau('Xin chào, em là trợ lý ảo. Tỷ lệ thất thoát tháng này là 12,35 phần trăm.');
    st.docTo = docTo;
    khiDocXong(function () { datTrangThai('ranh'); });
  });
  $('cdDangXuat').addEventListener('click', function () {
    $('hopCaiDat').close();
    api('POST', 'dangxuat', {}).catch(function () { /* bỏ qua */ });
    dangXuatCucBo('');
  });

  // Phím tắt máy tính: Ctrl + Space để nói / dừng.
  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space' && e.ctrlKey && !$('manChinh').hidden) { e.preventDefault(); $('nutMic').click(); }
  });

  // ================================================================== đăng nhập

  function hienDangNhap(loi) {
    $('manChinh').hidden = true;
    $('manDangNhap').hidden = false;
    var tt = st.thongTin || {};
    $('dnCongTy').textContent = tt.tenCongTy || '';
    $('dnLoi').textContent = loi || '';
    if (tt.cheDo === 'cucbo') {
      $('dnHuongDan').textContent = 'Trợ lý chưa cài đăng nhập nên chỉ dùng được ngay trên máy chủ. Báo quản trị viên cài MAYCHU_DIACHI hoặc TRO_LY_MAT_KHAU.';
      $('dnHangTen').hidden = true;
      $('dnMatKhau').parentNode.hidden = true;
      $('dnNut').hidden = true;
      return;
    }
    var laMatKhau = tt.cheDo === 'matkhau';
    $('dnHuongDan').textContent = laMatKhau ? 'Nhập mật khẩu trợ lý do quản trị viên cung cấp.' : 'Đăng nhập bằng tài khoản phần mềm thất thoát nước.';
    $('dnHangTen').hidden = laMatKhau;
    (laMatKhau ? $('dnMatKhau') : $('dnTen')).focus();
  }

  $('formDangNhap').addEventListener('submit', function (e) {
    e.preventDefault();
    var nut = $('dnNut');
    nut.disabled = true;
    $('dnLoi').textContent = '';
    api('POST', 'dangnhap', { ten: $('dnTen').value.trim(), matKhau: $('dnMatKhau').value })
      .then(function (r) {
        st.token = r.token;
        st.nguoi = r.nguoi;
        ghi(KHOA.token, r.token);
        ghi(KHOA.nguoi, JSON.stringify(r.nguoi));
        $('dnMatKhau').value = '';
        vaoManChinh();
      })
      .catch(function (err) { $('dnLoi').textContent = err.message; })
      .then(function () { nut.disabled = false; });
  });

  function dangXuatCucBo(loi) {
    dungNghe(false);
    cuocTroChuyenMoi();
    st.token = null;
    st.nguoi = null;
    ghi(KHOA.token, null);
    ghi(KHOA.nguoi, null);
    hienDangNhap(loi);
  }

  function vaoManChinh() {
    $('manDangNhap').hidden = true;
    $('manChinh').hidden = false;
    var tt = st.thongTin || {};
    var ten = st.nguoi && st.nguoi.ten !== 'cucbo' && st.nguoi.ten !== 'nguoidung' ? (st.nguoi.hoTen || st.nguoi.ten) : '';
    $('dauPhu').textContent = [tt.tenCongTy, ten].filter(Boolean).join(' · ');
    var goi = ten ? ten.trim().split(/\s+/).pop() : '';
    $('chaoTieuDe').textContent = 'Xin chào' + (goi ? ' ' + goi : '') + '!';
    veGoiY();
    datRanhTay(st.ranhTay);
    $('cdDocTo').checked = st.docTo;
    $('cdTocDo').value = String(st.tocDo);
    $('cdTocDoSo').textContent = st.tocDo.toLocaleString('vi-VN', { minimumFractionDigits: 1 });
    try { st.hoiThoai = sessionStorage.getItem('troly.hoiThoai') || null; } catch (e) { st.hoiThoai = null; }

    var cb = [];
    if (!window.isSecureContext) cb.push('Trang đang mở bằng http nên trình duyệt chặn micro. Hãy mở bằng địa chỉ https:// (xem hướng dẫn cài đặt).');
    else if (!SR) cb.push('Trình duyệt này không hỗ trợ nhận giọng nói — anh chị gõ chữ ở ô bên dưới, hoặc mở bằng Chrome / Edge.');
    if (!tts) cb.push('Trình duyệt này không đọc được thành tiếng — câu trả lời chỉ hiện chữ.');
    $('canhBao').textContent = cb.join(' ');
    $('canhBao').hidden = cb.length === 0;
    if (!SR || !window.isSecureContext) moOGo(true);
    datTrangThai('ranh');
  }

  // ================================================================== khởi động

  api('GET', 'thongtin')
    .then(function (tt) {
      st.thongTin = tt;
      if (tt.tenCongTy) document.title = 'Trợ lý ảo — ' + tt.tenCongTy;
      if (tt.cheDo === 'cucbo') {
        if (!tt.cucBo) return hienDangNhap('');
        st.token = 'cucbo';
        st.nguoi = { ten: 'cucbo' };
        return vaoManChinh();
      }
      if (!st.token) return hienDangNhap('');
      return api('GET', 'toi').then(function (r) {
        st.nguoi = r.nguoi;
        ghi(KHOA.nguoi, JSON.stringify(r.nguoi));
        vaoManChinh();
      }, function (e) {
        if (e.status === 401 || e.status === 403) { st.token = null; ghi(KHOA.token, null); return hienDangNhap(''); }
        // Máy chủ thất thoát nước tạm không trả lời: vẫn vào, khi hỏi sẽ báo lỗi cụ thể.
        vaoManChinh();
        thongBaoTrangThai(e.message);
      });
    })
    .catch(function (e) {
      document.body.textContent = e.message;
    });
})();
