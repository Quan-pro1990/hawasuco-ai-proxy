/* Thất thoát nước — trang web cho điện thoại (chạy trên máy chủ IIS). Không dùng thư viện ngoài. */
(function () {
  'use strict';

  var KHOA_TOKEN = 'ttn.token', KHOA_NGUOI = 'ttn.nguoi', KHOA_THE = 'ttn.the';
  var app = document.getElementById('app');
  var ungDung = window.ThatThoatApp || null;   // có khi chạy trong app Android
  var st = {
    token: doc(KHOA_TOKEN), nguoi: null, the: doc(KHOA_THE) || 'thatthoat',
    tq: null, tqNam: null, tqThang: null, cheDo: 'thang', th: null, thNam: null,
    c1: null, c1Nam: null, c1Thang: null, c1Doi: null, bc: null, ping: null
  };
  try { st.nguoi = JSON.parse(doc(KHOA_NGUOI) || 'null'); } catch (e) { st.nguoi = null; }

  function doc(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function ghi(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { } }

  // ------------------------------------------------------------------ định dạng số kiểu Việt Nam
  var fM3 = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
  var fP = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function m3(v) { return v == null ? '' : fM3.format(v); }
  function pt(v) { return v == null ? '' : fP.format(v); }
  function lech(v) {
    if (v == null) return '';
    var x = Math.round(v * 100) / 100;
    return (x > 0 ? '+' : '') + fP.format(x);
  }
  function lopLech(v) { return v == null || Math.abs(v) < 0.005 ? '' : (v > 0 ? 'tang' : 'giam'); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /** Đọc số người gõ giống phần mềm máy tính: "531218", "531.218", "1.234,5". */
  function docSo(s) {
    s = String(s || '').replace(/[\s ]/g, '').replace(/m3|m³|%/g, '');
    if (!s) return null;
    var am = false;
    if (s[0] === '+') s = s.slice(1); else if (s[0] === '-' || s[0] === '−') { am = true; s = s.slice(1); }
    if (s.indexOf(',') >= 0) {
      if (s.indexOf(',') !== s.lastIndexOf(',')) return NaN;
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      var a = s.indexOf('.'), b = s.lastIndexOf('.');
      if (a >= 0 && a !== b) s = s.replace(/\./g, '');
      else if (a > 0 && a <= 3 && s.length - a - 1 === 3 && s[0] !== '0') s = s.replace('.', '');
    }
    if (!/^\d*\.?\d*$/.test(s) || s === '.') return NaN;
    var v = parseFloat(s);
    return am ? -v : v;
  }

  // ------------------------------------------------------------------ gọi máy chủ
  function api(method, duong, than) {
    var h = { 'Accept': 'application/json' };
    if (st.token) h['Authorization'] = 'Bearer ' + st.token;
    if (than !== undefined) h['Content-Type'] = 'application/json';
    return fetch('api/' + duong, { method: method, headers: h, body: than === undefined ? undefined : JSON.stringify(than), cache: 'no-store' })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null;
          try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
          if (r.status === 401 && duong !== 'dangnhap') { dangXuatCucBo(); throw new Error((j && j.loi) || 'Hãy đăng nhập lại.'); }
          if (!r.ok) throw new Error((j && j.loi) || ('Lỗi máy chủ (' + r.status + ')'));
          return j;
        });
      }, function () { throw new Error('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'); });
  }

  function thongBao(s) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = s;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  }

  function hoi(tieuDe, noiDung, nutDongY) {
    return new Promise(function (ok) {
      var h = document.createElement('div');
      h.className = 'hop';
      h.innerHTML = '<div><h3>' + esc(tieuDe) + '</h3><p class="mo">' + esc(noiDung) + '</p><div class="hang">' +
        '<button class="nut" data-k="0">Huỷ</button><button class="nut chinh" data-k="1">' + esc(nutDongY || 'Đồng ý') + '</button></div></div>';
      h.addEventListener('click', function (e) {
        var k = e.target.getAttribute('data-k');
        if (e.target === h || k === '0') { h.remove(); ok(false); }
        if (k === '1') { h.remove(); ok(true); }
      });
      document.body.appendChild(h);
    });
  }

  // ------------------------------------------------------------------ đăng nhập
  function dangXuatCucBo() {
    st.token = null; st.nguoi = null; st.tq = st.th = st.c1 = st.bc = null;
    ghi(KHOA_TOKEN, null); ghi(KHOA_NGUOI, null);
    veDangNhap();
  }

  function veDangNhap(loi) {
    var cty = st.ping && st.ping.congTy ? st.ping.congTy : '';
    app.innerHTML = '<form class="dangnhap" autocomplete="on">' +
      '<div class="logo"><img src="icon-192.png" alt=""></div>' +
      '<h1>Quản lý thất thoát nước</h1><div class="congty">' + esc(cty) + '</div>' +
      (loi ? '<div class="loi">' + esc(loi) + '</div>' : '') +
      (st.ping && !st.ping.coTaiKhoan ? '<div class="bao">Máy chủ chưa có tài khoản. Hãy chạy CaiDat-IIS.bat trên máy chủ để đặt mật khẩu quản trị.</div>' : '') +
      '<label for="ten">Tên đăng nhập</label><input id="ten" name="username" autocapitalize="none" autocorrect="off" required>' +
      '<label for="mk">Mật khẩu</label><input id="mk" name="password" type="password" required>' +
      '<button class="nut chinh" type="submit">Đăng nhập</button>' +
      (st.ping && st.ping.coApp && !ungDung ? '<p class="mo" style="text-align:center;margin-top:18px"><a href="tai-app">Tải app Android</a></p>' : '') +
      '</form>';
    var f = app.querySelector('form');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var nut = f.querySelector('button');
      nut.disabled = true; nut.textContent = 'Đang đăng nhập…';
      api('POST', 'dangnhap', { ten: f.ten.value.trim(), matKhau: f.mk.value, thietBi: (ungDung ? 'App Android' : 'Trình duyệt') + ' · ' + navigator.userAgent.slice(0, 80) })
        .then(function (r) {
          st.token = r.token; delete r.token; st.nguoi = r;
          ghi(KHOA_TOKEN, st.token); ghi(KHOA_NGUOI, JSON.stringify(r));
          veKhung();
        }, function (err) { veDangNhap(err.message); });
    });
  }

  // ------------------------------------------------------------------ khung chính
  var BIEU_TUONG = {
    thatthoat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3c3.5 4.5 6 7.7 6 11a6 6 0 0 1-12 0c0-3.3 2.5-6.5 6-11z"/></svg>',
    cap1: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="13" r="7"/><path d="M12 13l3-3M9 3h6"/></svg>',
    baocao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/></svg>',
    taikhoan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/></svg>'
  };
  var TEN_THE = { thatthoat: 'Thất thoát', cap1: 'Cấp 1', baocao: 'Báo cáo', taikhoan: 'Tài khoản' };

  function veKhung() {
    var n = st.nguoi || {};
    app.innerHTML = '<header class="dau"><img src="icon-192.png" alt=""><div class="tieude"><b>Thất thoát nước</b><span>' +
      esc(n.congTy || '') + '</span></div><button class="lammoi" id="lammoi" type="button">Làm mới</button></header>' +
      '<main class="noidung" id="nd"></main><nav class="dieuhuong">' +
      ['thatthoat', 'cap1', 'baocao', 'taikhoan'].map(function (k) {
        return '<button type="button" data-the="' + k + '">' + BIEU_TUONG[k] + '<span>' + TEN_THE[k] + '</span></button>';
      }).join('') + '</nav>';
    app.querySelector('.dieuhuong').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) chonThe(b.getAttribute('data-the'));
    });
    document.getElementById('lammoi').addEventListener('click', function () { st.tq = st.th = st.c1 = st.bc = null; chonThe(st.the); });
    chonThe(st.the);
  }

  function nd() { return document.getElementById('nd'); }

  function chonThe(k) {
    st.the = k; ghi(KHOA_THE, k);
    app.querySelectorAll('.dieuhuong button').forEach(function (b) { b.classList.toggle('chon', b.getAttribute('data-the') === k); });
    window.scrollTo(0, 0);
    if (k === 'thatthoat') theThatThoat();
    else if (k === 'cap1') theCap1();
    else if (k === 'baocao') theBaoCao();
    else theTaiKhoan();
  }

  function dangTai() { nd().innerHTML = '<div class="dangtai">Đang tải…</div>'; }
  function loiTai(err, thuLai) {
    nd().innerHTML = '<div class="loi">' + esc(err.message) + '</div><button class="nut" id="thulai">Thử lại</button>';
    document.getElementById('thulai').addEventListener('click', thuLai);
  }

  function chonThang(id, ds, nam, thang) {
    return '<select id="' + id + '">' + ds.map(function (t) {
      return '<option value="' + t.nam + '-' + t.thang + '"' + (t.nam === nam && t.thang === thang ? ' selected' : '') + '>' + esc(t.ten) + '</option>';
    }).join('') + '</select>';
  }
  function tachThang(v) { var p = v.split('-'); return { nam: +p[0], thang: +p[1] }; }

  // ------------------------------------------------------------------ thẻ Thất thoát
  function theThatThoat() {
    if (st.cheDo === 'nam') return theTongHop();
    if (st.tq) return veThatThoat();
    dangTai();
    var q = st.tqNam ? '?nam=' + st.tqNam + '&thang=' + st.tqThang : '';
    api('GET', 'tongquan' + q).then(function (r) { st.tq = r; veThatThoat(); }, function (e) { loiTai(e, theThatThoat); });
  }

  function chonCheDo() {
    return '<div class="chon-doan" id="chedo"><button data-c="thang" class="' + (st.cheDo === 'thang' ? 'chon' : '') + '">Theo tháng</button>' +
      '<button data-c="nam" class="' + (st.cheDo === 'nam' ? 'chon' : '') + '">Cả năm</button></div>';
  }
  function ganCheDo() {
    document.getElementById('chedo').addEventListener('click', function (e) {
      var c = e.target.getAttribute('data-c');
      if (c && c !== st.cheDo) { st.cheDo = c; theThatThoat(); }
    });
  }

  function veThatThoat() {
    var r = st.tq;
    if (!r.chon) { nd().innerHTML = '<div class="hang">' + chonCheDo() + '</div><div class="bao">Máy chủ chưa có số liệu tháng nào.</div>'; ganCheDo(); return; }
    var c = r.chon;
    var toan = r.donVi.filter(function (d) { return d.vaiTro === 'ToanCongTy'; })[0];
    var h = '<div class="hang" style="margin-bottom:10px">' + chonThang('tq-thang', r.thang, c.nam, c.thang) + '<span class="gian"></span>' + chonCheDo() + '</div>';
    if (c.tuNgay) h += '<p class="mo" style="margin:0 2px 8px">Hoá đơn kỳ ' + esc(c.kyHoaDon) + ' · nước tiêu thụ ' + esc(c.tuNgay) + ' → ' + esc(c.denNgay) + '</p>';
    if (toan) {
      h += '<div class="the lon"><p class="mo">Tỷ lệ thất thoát toàn công ty — ' + esc(c.ten.toLowerCase()) + '</p>' +
        '<div class="so-lon">' + (toan.tyLe == null ? '—' : pt(toan.tyLe) + '%') + '</div><div class="chips">' +
        (toan.keHoach != null ? '<span>Kế hoạch ' + pt(toan.keHoach) + '%</span>' : '') +
        (toan.soThangTruoc != null ? '<span class="' + lopLech(toan.soThangTruoc) + '">So tháng trước ' + lech(toan.soThangTruoc) + '</span>' : '') +
        (toan.lkTyLe != null ? '<span>Lũy kế ' + pt(toan.lkTyLe) + '%</span>' : '') + '</div>' +
        '<div class="chips"><span>Phát ra ' + m3(toan.phatRa) + ' m³</span><span>Chuẩn thu ' + m3(toan.chuanThu) + ' m³</span></div></div>';
    }
    h += '<div class="the">';
    r.donVi.forEach(function (d, i) {
      if (d.vaiTro === 'ToanCongTy') return;
      var lop = d.vaiTro === 'KhuVuc' ? 'kv' : d.vaiTro === 'Dma' ? 'dma' : '';
      var vuot = d.tyLe != null && d.keHoach != null && d.tyLe > d.keHoach;
      var phu = [];
      if (d.keHoach != null) phu.push('KH ' + pt(d.keHoach) + '%');
      if (d.soThangTruoc != null) phu.push('T.trước <span class="' + lopLech(d.soThangTruoc) + '">' + lech(d.soThangTruoc) + '</span>');
      if (d.lkTyLe != null) phu.push('LK ' + pt(d.lkTyLe) + '%');
      if (d.thieu) phu.push('<span class="tang">chưa đủ số liệu</span>');
      h += '<div class="donvi ' + lop + '" data-i="' + i + '"><div class="ten"><b>' + esc(d.ten) + '</b><small>' + phu.join(' · ') + '</small></div>' +
        '<div class="pt ' + (vuot ? 'tang' : '') + '">' + (d.tyLe != null ? pt(d.tyLe) + '%' : '<small class="mo">' + esc(d.tinhTrang || '—') + '</small>') + '</div>' +
        '<div class="chitiet"><span>Phát ra <b>' + m3(d.phatRa) + '</b></span><span>Chuẩn thu <b>' + m3(d.chuanThu) + '</b></span>' +
        '<span>Thất thoát <b>' + (d.phatRa != null && d.chuanThu != null ? m3(d.phatRa - d.chuanThu) : '') + '</b></span>' +
        '<span>So cùng kỳ <b>' + lech(d.soCungKy) + '</b></span>' +
        '<span>LK phát ra <b>' + m3(d.lkPhatRa) + '</b></span><span>LK chuẩn thu <b>' + m3(d.lkChuanThu) + '</b></span></div></div>';
    });
    h += '</div><p class="mo" style="text-align:center">Chạm vào 1 dòng để xem sản lượng. Số đỏ = cao hơn kế hoạch.</p>';
    nd().innerHTML = h;
    ganCheDo();
    document.getElementById('tq-thang').addEventListener('change', function () {
      var t = tachThang(this.value);
      st.tqNam = t.nam; st.tqThang = t.thang; st.tq = null; theThatThoat();
    });
    nd().querySelectorAll('.donvi').forEach(function (e) { e.addEventListener('click', function () { e.classList.toggle('mo-ra'); }); });
  }

  function theTongHop() {
    if (st.th) return veTongHop();
    dangTai();
    api('GET', 'tonghop' + (st.thNam ? '?nam=' + st.thNam : '')).then(function (r) { st.th = r; veTongHop(); }, function (e) { loiTai(e, theTongHop); });
  }

  function veTongHop() {
    var r = st.th;
    var h = '<div class="hang" style="margin-bottom:10px"><select id="th-nam">' + r.cacNam.map(function (n) {
      return '<option' + (n === r.nam ? ' selected' : '') + '>' + n + '</option>';
    }).join('') + '</select><span class="gian"></span>' + chonCheDo() + '</div>';
    if (!r.dong.length) { nd().innerHTML = h + '<div class="bao">Năm ' + r.nam + ' chưa có số liệu.</div>'; ganCheDo(); return; }
    h += '<p class="mo" style="margin:0 2px 8px">Tỷ lệ thất thoát (%) từng tháng năm ' + r.nam + ', lũy kế đến tháng ' + r.denThang + '. Kéo ngang để xem thêm.</p>';
    h += '<div class="bang-cuon"><table class="bang"><thead><tr><th>Đơn vị</th>' +
      r.coThang.map(function (t) { return '<th>T' + t + '</th>'; }).join('') + '<th>Lũy kế</th><th>KH</th></tr></thead><tbody>';
    r.dong.forEach(function (d) {
      var lop = d.vaiTro === 'Doi' ? 'doi' : d.vaiTro === 'ToanCongTy' ? 'toan' : d.vaiTro === 'Dma' ? 'dma' : '';
      h += '<tr class="' + lop + '"><td>' + esc(d.ten) + '</td>' + r.coThang.map(function (t) {
        var v = d.thang[t - 1];
        if (typeof v === 'string') return '<td class="chu-tt">' + esc(v) + '</td>';
        return '<td>' + pt(v) + '</td>';
      }).join('') + '<td class="' + (d.lkTyLe != null && d.keHoach != null && d.lkTyLe > d.keHoach ? 'tang' : '') + '"><b>' + pt(d.lkTyLe) + '</b></td><td>' + pt(d.keHoach) + '</td></tr>';
    });
    nd().innerHTML = h + '</tbody></table></div>';
    ganCheDo();
    document.getElementById('th-nam').addEventListener('change', function () { st.thNam = +this.value; st.th = null; theTongHop(); });
  }

  // ------------------------------------------------------------------ thẻ Đồng hồ cấp 1
  function q1() {
    var p = [];
    if (st.c1Nam) p.push('nam=' + st.c1Nam, 'thang=' + st.c1Thang);
    if (st.c1Doi != null) p.push('doi=' + st.c1Doi);
    return p.length ? '?' + p.join('&') : '';
  }

  function theCap1() {
    if (st.c1) return veCap1();
    dangTai();
    api('GET', 'cap1' + q1()).then(function (r) { st.c1 = r; veCap1(); }, function (e) { loiTai(e, theCap1); });
  }

  function oTong(lop, ten, t, lk) {
    return '<div class="the ' + lop + '"><small>' + esc(ten) + '</small><b>' + m3(lk ? t.luyKe : t.sanLuong) + ' m³</b>' +
      (lk ? '' : '<small>' + t.soDongHo + ' đồng hồ' + (t.thangTruoc != null && t.thangTruoc !== 0 ? ' · ' + lech((t.sanLuong - t.thangTruoc) / t.thangTruoc * 100) + '%' : '') +
        (t.soChuaNhap ? ' · <span class="tang">' + t.soChuaNhap + ' chưa nhập</span>' : '') + '</small>') + '</div>';
  }

  function veCap1(giuCuon) {
    var r = st.c1, y = window.scrollY;
    var h = '<div class="hang" style="margin-bottom:8px">';
    if (r.thang.length) h += chonThang('c1-thang', r.thang, r.chon && r.chon.nam, r.chon && r.chon.thang);
    if (r.coDinhDoi) h += '<span class="mo">' + esc((r.doi.filter(function (d) { return d.id === r.doiChon; })[0] || {}).ten || '') + '</span>';
    else h += '<select id="c1-doi"><option value="-1">Tất cả các đội</option>' + r.doi.map(function (d) {
      return '<option value="' + d.id + '"' + (d.id === r.doiChon ? ' selected' : '') + '>' + esc(d.ten) + '</option>';
    }).join('') + '</select>';
    h += '</div>';
    if (!r.chon) {
      nd().innerHTML = h + '<div class="bao">Chưa có tháng đồng hồ cấp 1 nào. Tháng đầu tiên tạo trên phần mềm máy tính (trang Đồng hồ cấp 1).</div>';
      ganCap1(); return;
    }
    var c = r.chon;
    if (c.tuNgay) h += '<p class="mo" style="margin:0 2px 8px">Hoá đơn kỳ ' + esc(c.kyHoaDon) + ' · khai thác ' + esc(c.tuNgay) + ' → ' + esc(c.denNgay) + '</p>';
    if (r.duocTaoThang && c.laCuoi) h += '<div class="hang" style="margin-bottom:10px"><button class="nut" id="taothang" type="button">+ Tạo tháng ' + esc(r.thangSau) + '</button></div>';
    h += '<div class="o-tong">' + oTong('lon', 'Tổng khai thác ' + c.ten.toLowerCase(), r.tong) + oTong('gieng', 'Nước giếng (ngầm)', r.gieng) +
      oTong('mat', 'Nước mặt', r.mat) + oTong('', 'Lũy kế năm ' + c.nam, r.tong, true) + '</div>';
    if (!r.nhom.length) h += '<div class="bao">Tháng này chưa có đồng hồ nào' + (r.doiChon >= 0 ? ' của đội đang chọn' : '') + '.</div>';
    r.nhom.forEach(function (nd2) {
      h += '<section class="nhom-doi"><h2><span>' + esc(nd2.ten) + '</span><span>' + m3(nd2.sanLuong) + ' m³</span></h2>';
      nd2.tram.forEach(function (tr) {
        var duocNhapTram = tr.dongHo.some(function (x) { return x.duocNhap; });
        h += '<div class="tram"><div class="dau-tram"><b>' + esc(tr.ten) + '</b><span>' + m3(tr.sanLuong) + ' m³</span></div>';
        if (duocNhapTram && tr.id >= 0) h += '<div class="chot">Chốt số <input data-tram="' + tr.id + '" class="o-chot" aria-label="Thời gian chốt số ' + esc(tr.ten) + '" value="' + esc(tr.chot) + '" placeholder="vd Từ 6h 21/8 đến 6h 21/9"></div>';
        else if (tr.chot) h += '<div class="chot">Chốt số: <i>' + esc(tr.chot) + '</i></div>';
        tr.dongHo.forEach(function (d) { h += veDongHo(d); });
        h += '</div>';
      });
      h += '</section>';
    });
    if (r.duocNhap) h += '<p class="mo" style="text-align:center">Gõ chỉ số rồi bấm Enter / chuyển ô là tự lưu. Thay đồng hồ, quay vòng: sửa trên phần mềm máy tính.</p>';
    nd().innerHTML = h;
    ganCap1();
    if (giuCuon) window.scrollTo(0, y);
  }

  function veDongHo(d) {
    var nguon = d.nguon === 'Giếng' ? 'gieng' : 'mat';
    var slLop = d.amChiSo ? 'am' : d.slNhap != null ? 'nhap' : '';
    var tg = d.thangTruoc != null && d.thangTruoc !== 0 && d.sanLuong != null ? lech((d.sanLuong - d.thangTruoc) / d.thangTruoc * 100) + '%' : '';
    var h = '<div class="dongho" data-id="' + d.id + '" data-cu="' + (d.cu == null ? '' : d.cu) + '" data-hs="' + d.heSo + '">' +
      '<div class="tenh"><b>' + esc(d.ten) + '</b><span class="nhan ' + nguon + '">' + esc(d.nguon) + '</span></div><div class="luoi">' +
      '<div><label>Chỉ số tháng trước</label><div class="gt">' + (d.cu == null ? '<span class="mo">chưa có</span>' : m3(d.cu)) + '</div></div>';
    if (d.duocNhap) h += '<div><label>Chỉ số hiện tại</label><input class="chiso" inputmode="decimal" enterkeyhint="next" value="' + (d.moi == null ? '' : m3(d.moi)) + '" data-truong="moi" aria-label="Chỉ số hiện tại ' + esc(d.ten) + '"></div>';
    else h += '<div><label>Chỉ số hiện tại</label><div class="gt">' + m3(d.moi) + '</div></div>';
    h += '<div><label>Sản lượng (m³)</label><div class="gt sl ' + slLop + '">' + (d.sanLuong == null ? '<span class="mo">—</span>' : m3(d.sanLuong)) + '</div></div>' +
      '<div><label>SL tháng trước / lũy kế</label><div class="gt2">' + (d.thangTruoc == null ? '<small>—</small>' : m3(d.thangTruoc)) +
      (tg ? ' <small>(' + tg + ')</small>' : '') + '<br><small>LK</small> ' + m3(d.luyKe) + '</div></div></div>';
    var phu = [];
    if (d.heSo !== 1) phu.push('hệ số ×' + m3(d.heSo));
    if (d.thayDongHo) phu.push('có thay đồng hồ trong tháng');
    if (d.slNhap != null) phu.push('sản lượng nhập thẳng');
    if (d.amChiSo) phu.push('<span class="tang">chỉ số hiện tại nhỏ hơn tháng trước — quay vòng / thay đồng hồ?</span>');
    if (d.ghiChu && !d.duocNhap) phu.push(esc(d.ghiChu));
    if (phu.length) h += '<div class="phu">' + phu.join(' · ') + '</div>';
    if (d.duocNhap) {
      h += '<details' + (d.ghiChu || d.slNhap != null ? ' open' : '') + '><summary>Ghi chú, đồng hồ hỏng</summary><div class="luoi">' +
        '<div style="grid-column:span 2"><label>Ghi chú</label><input data-truong="ghiChu" class="o-phu" aria-label="Ghi chú ' + esc(d.ten) + '" value="' + esc(d.ghiChu) + '" placeholder="tình trạng đồng hồ…"></div>' +
        '<div style="grid-column:span 2"><label>Sản lượng nhập thẳng (khi đồng hồ hỏng, để trống = tính theo chỉ số)</label>' +
        '<input data-truong="sanLuong" class="o-phu" aria-label="Sản lượng nhập thẳng ' + esc(d.ten) + '" inputmode="decimal" value="' + (d.slNhap == null ? '' : m3(d.slNhap)) + '"></div></div></details>';
    }
    return h + '<div class="thongbao"></div></div>';
  }

  function ganCap1() {
    var s = document.getElementById('c1-thang');
    if (s) s.addEventListener('change', function () { var t = tachThang(this.value); st.c1Nam = t.nam; st.c1Thang = t.thang; st.c1 = null; theCap1(); });
    var d = document.getElementById('c1-doi');
    if (d) d.addEventListener('change', function () { st.c1Doi = +this.value; st.c1 = null; theCap1(); });
    var tt = document.getElementById('taothang');
    if (tt) tt.addEventListener('click', function () {
      hoi('Tạo tháng ' + st.c1.thangSau + '?', 'Chỉ số tháng trước của từng đồng hồ lấy theo chỉ số hiện tại của ' + st.c1.chon.ten.toLowerCase() + '.', 'Tạo tháng').then(function (ok) {
        if (!ok) return;
        api('POST', 'cap1/taothang', {}).then(function (r) { st.c1 = r; st.c1Nam = r.chon.nam; st.c1Thang = r.chon.thang; veCap1(); thongBao('Đã tạo ' + r.chon.ten.toLowerCase()); },
          function (e) { thongBao(e.message); });
      });
    });
    nd().querySelectorAll('input.chiso').forEach(function (i) {
      i.addEventListener('input', function () { xemTruoc(i); });
      i.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); i.blur(); oKeTiep(i); } });
      i.addEventListener('change', function () { luuDongHo(i); });
      i.addEventListener('focus', function () { if (i.dataset.giu) delete i.dataset.giu; else i.select(); });
    });
    nd().querySelectorAll('input.o-phu').forEach(function (i) { i.addEventListener('change', function () { luuDongHo(i); }); });
    nd().querySelectorAll('input.o-chot').forEach(function (i) { i.addEventListener('change', function () { luuChot(i); }); });
  }

  function oKeTiep(i) {
    var tat = Array.prototype.slice.call(nd().querySelectorAll('input.chiso'));
    var k = tat.indexOf(i);
    if (k >= 0 && k + 1 < tat.length) tat[k + 1].focus();
  }

  /** Sản lượng tạm tính ngay khi gõ (máy chủ tính lại khi lưu). */
  function xemTruoc(i) {
    var dh = i.closest('.dongho'), cu = parseFloat(dh.getAttribute('data-cu')), hs = parseFloat(dh.getAttribute('data-hs')) || 1;
    var v = docSo(i.value), sl = dh.querySelector('.sl');
    i.classList.remove('da-luu', 'sai');
    if (v == null || isNaN(v) || isNaN(cu)) return;
    var x = (v - cu) * hs;
    sl.textContent = m3(x);
    sl.classList.toggle('am', x < 0);
  }

  function luuDongHo(i) {
    var dh = i.closest('.dongho'), tb = dh.querySelector('.thongbao'), truong = i.getAttribute('data-truong');
    var v = i.value.trim();
    if (truong !== 'ghiChu' && v && isNaN(docSo(v))) { i.classList.add('sai'); tb.innerHTML = '<div class="loi">"' + esc(v) + '" không phải số. Gõ dạng 531218 hoặc 531.218</div>'; return; }
    var body = { nam: st.c1.chon.nam, thang: st.c1.chon.thang, dongHo: +dh.getAttribute('data-id') };
    body[truong] = v;
    i.classList.add('dang-luu');
    tb.innerHTML = '<span class="mo">Đang lưu…</span>';
    api('POST', 'cap1/chiso', body).then(function (r) {
      var focusId = document.activeElement && document.activeElement.closest && document.activeElement.closest('.dongho') ?
        document.activeElement.closest('.dongho').getAttribute('data-id') : null;
      var focusTruong = document.activeElement ? document.activeElement.getAttribute('data-truong') : null;
      var focusGiaTri = focusId ? document.activeElement.value : null;   // ô đang gõ dở (chưa lưu) — giữ nguyên chữ
      st.c1 = r;
      veCap1(true);
      var moi = nd().querySelector('.dongho[data-id="' + body.dongHo + '"] input[data-truong="' + truong + '"]');
      if (moi) moi.classList.add('da-luu');
      if (focusId && focusTruong) {
        var f = nd().querySelector('.dongho[data-id="' + focusId + '"] input[data-truong="' + focusTruong + '"]');
        if (f) {
          if (f.value === focusGiaTri) {
            f.focus();            // chưa gõ gì: bôi chọn để gõ đè
          } else {
            f.value = focusGiaTri;   // đang gõ dở: giữ chữ, con trỏ ở cuối
            if (f.classList.contains('chiso')) xemTruoc(f);
            f.dataset.giu = '1';
            f.focus();
            try { f.setSelectionRange(f.value.length, f.value.length); } catch (er) { }
          }
        }
      }
    }, function (e) {
      i.classList.remove('dang-luu'); i.classList.add('sai');
      tb.innerHTML = '<div class="loi">' + esc(e.message) + '</div>';
    });
  }

  function luuChot(i) {
    api('POST', 'cap1/chot', { nam: st.c1.chon.nam, thang: st.c1.chon.thang, tram: +i.getAttribute('data-tram'), chot: i.value }).then(function (r) {
      st.c1 = r; veCap1(true); thongBao('Đã lưu thời gian chốt số');
    }, function (e) { thongBao(e.message); });
  }

  // ------------------------------------------------------------------ thẻ Báo cáo
  function theBaoCao() {
    if (st.bc) return veBaoCao();
    dangTai();
    api('GET', 'baocao').then(function (r) { st.bc = r; veBaoCao(); }, function (e) { loiTai(e, theBaoCao); });
  }

  function oChonThang(ds, k) { return '<select data-k="' + k + '">' + ds.map(function (t) { return '<option value="' + t.nam + '-' + t.thang + '">' + esc(t.ten) + '</option>'; }).join('') + '</select>'; }
  function oChonNam(ds) { return '<select data-k="nam">' + ds.map(function (n) { return '<option value="' + n + '">Năm ' + n + '</option>'; }).join('') + '</select>'; }
  function oChonDoi(ds) {
    var n = st.nguoi || {};
    if (n.doi >= 0) return '';
    return '<select data-k="doi"><option value="-1">Tất cả các đội</option>' + ds.map(function (d) { return '<option value="' + d.id + '">' + esc(d.ten) + '</option>'; }).join('') + '</select>';
  }

  function veBaoCao() {
    var r = st.bc, h = '';
    function the(loai, tieuDe, moTa, chon, coPdf) {
      if (!chon) return '';
      h += '<div class="the baocao" data-loai="' + loai + '"><h3>' + esc(tieuDe) + '</h3><p class="mo">' + esc(moTa) + '</p><div class="hang">' + chon + '</div>' +
        '<div class="nut-tai"><button class="nut" data-dd="xlsx" type="button">Tải Excel</button>' +
        (coPdf ? '<button class="nut chinh" data-dd="pdf" type="button">' + (ungDung ? 'In / PDF' : 'Tải PDF để in') + '</button>' : '') + '</div></div>';
    }
    the('thang', 'Báo cáo tỷ lệ thất thoát tháng', 'Mẫu "Tháng N-YYYY": chỉ số TLK, sản lượng, chuẩn thu, tỷ lệ, lũy kế, người ký.', r.thang.length && oChonThang(r.thang, 'thang'), true);
    the('tomtat', 'Bảng tóm tắt tháng', 'Tỷ lệ thất thoát tháng và lũy kế của từng đội, khu vực, toàn công ty (1 trang).', r.thang.length && oChonThang(r.thang, 'thang'), true);
    the('quy', 'Báo cáo quý', 'Cộng 3 tháng của quý, so quý trước, cùng kỳ, kế hoạch.', r.quy.length && '<select data-k="quy">' + r.quy.map(function (q) {
      return '<option value="' + q.nam + '-' + q.quy + '">' + esc(q.ten) + '</option>'; }).join('') + '</select>', true);
    the('tonghop', 'Bảng tổng hợp tỷ lệ thất thoát năm', 'Tỷ lệ từng tháng của mỗi đội / khu vực / DMA, lũy kế, so kế hoạch.', r.nam.length && oChonNam(r.nam), true);
    the('kehoach', 'Kế hoạch năm', 'Kế hoạch giao chỉ tiêu và tình hình thực hiện.', r.namKeHoach.length && oChonNam(r.namKeHoach), true);
    the('cap1thang', 'Sản lượng khai thác tháng (đồng hồ cấp 1)', 'Đội → trạm → đồng hồ, nước giếng / nước mặt, lũy kế.', r.cap1Thang.length && (oChonThang(r.cap1Thang, 'thang') + oChonDoi(r.doi)), true);
    the('cap1nam', 'Tổng hợp khai thác năm (đồng hồ cấp 1)', 'Sản lượng 12 tháng của từng đồng hồ, trạm, đội.', r.cap1Nam.length && (oChonNam(r.cap1Nam) + oChonDoi(r.doi)), true);
    the('socanam', 'Sổ báo cáo cả năm', 'File Excel nhiều trang: kế hoạch, tóm tắt, tổng hợp, từng tháng, từng quý.', r.nam.length && oChonNam(r.nam), false);
    if (!h) h = '<div class="bao">Máy chủ chưa có số liệu để lập báo cáo.</div>';
    h += '<p class="mo" style="text-align:center">' + (ungDung ? 'PDF mở bằng máy in của điện thoại (Wi-Fi / máy in mạng) hoặc lưu lại để gửi.' :
      'File PDF tải về mở bằng trình xem PDF rồi chọn In, hoặc chia sẻ qua Zalo / email.') + '</p>';
    nd().innerHTML = h;
    nd().querySelectorAll('.baocao button').forEach(function (b) {
      b.addEventListener('click', function () { taiBaoCao(b.closest('.baocao'), b.getAttribute('data-dd'), b); });
    });
  }

  function taiBaoCao(the, dd, nut) {
    var body = { loai: the.getAttribute('data-loai'), dinhDang: dd };
    the.querySelectorAll('select').forEach(function (s) {
      var k = s.getAttribute('data-k'), v = s.value;
      if (k === 'thang') { var t = tachThang(v); body.nam = t.nam; body.thang = t.thang; }
      else if (k === 'quy') { var p = v.split('-'); body.nam = +p[0]; body.quy = +p[1]; }
      else if (k === 'nam') body.nam = +v;
      else if (k === 'doi') body.doi = +v;
    });
    var cu = nut.textContent;
    nut.disabled = true; nut.textContent = 'Đang lập…';
    api('POST', 'baocao/lienket', body).then(function (r) {
      nut.disabled = false; nut.textContent = cu;
      var url = new URL(r.url, location.href).href;
      if (ungDung && ungDung.taiVe) { ungDung.taiVe(url, r.ten, dd === 'pdf'); return; }
      var a = document.createElement('a');
      a.href = url; a.download = r.ten; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      thongBao('Đang tải ' + r.ten);
    }, function (e) { nut.disabled = false; nut.textContent = cu; thongBao(e.message); });
  }

  // ------------------------------------------------------------------ thẻ Tài khoản
  function theTaiKhoan() {
    var n = st.nguoi || {};
    var h = '<div class="the"><h3>' + esc(n.hoTen || n.ten) + '</h3><p class="mo">Tên đăng nhập: ' + esc(n.ten) + '</p><p class="mo">Quyền: ' + esc(n.tenVaiTro) +
      (n.tenDoi ? ' — ' + esc(n.tenDoi) : '') + '</p></div>' +
      '<form class="the" id="doimk"><h3>Đổi mật khẩu</h3><div class="hang" style="flex-direction:column;align-items:stretch">' +
      '<input type="password" name="cu" placeholder="Mật khẩu hiện tại" autocomplete="current-password" required>' +
      '<input type="password" name="moi" placeholder="Mật khẩu mới (ít nhất 6 ký tự)" autocomplete="new-password" required>' +
      '<input type="password" name="moi2" placeholder="Nhập lại mật khẩu mới" autocomplete="new-password" required>' +
      '<button class="nut chinh" type="submit">Đổi mật khẩu</button></div><div class="tb"></div></form>' +
      (n.coApp && !ungDung ? '<div class="the"><h3>App Android</h3><p class="mo">Cài app để mở nhanh, in thẳng file PDF.</p><a class="nut" href="tai-app" style="display:inline-block;text-decoration:none">Tải app Android</a></div>' : '') +
      '<div class="the"><button class="nut do" id="dangxuat" type="button">Đăng xuất</button>' +
      (ungDung && ungDung.doiMayChu ? ' <button class="nut" id="doimaychu" type="button">Đổi máy chủ</button>' : '') +
      '<p class="mo">Phiên bản phần mềm ' + esc(n.phienBanPhanMem || '') + '</p></div>';
    nd().innerHTML = h;
    var f = document.getElementById('doimk');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var tb = f.querySelector('.tb');
      if (f.moi.value !== f.moi2.value) { tb.innerHTML = '<div class="loi">Hai lần nhập mật khẩu mới không giống nhau.</div>'; return; }
      api('POST', 'doimatkhau', { cu: f.cu.value, moi: f.moi.value }).then(function () { f.reset(); tb.innerHTML = '<div class="bao">Đã đổi mật khẩu.</div>'; },
        function (er) { tb.innerHTML = '<div class="loi">' + esc(er.message) + '</div>'; });
    });
    document.getElementById('dangxuat').addEventListener('click', function () {
      hoi('Đăng xuất?', 'Lần sau cần nhập lại tên và mật khẩu.', 'Đăng xuất').then(function (ok) {
        if (!ok) return;
        api('POST', 'dangxuat', {}).then(dangXuatCucBo, dangXuatCucBo);
      });
    });
    var dm = document.getElementById('doimaychu');
    if (dm) dm.addEventListener('click', function () { ungDung.doiMayChu(); });
  }

  // ------------------------------------------------------------------ khởi động
  fetch('api/ping', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (p) { st.ping = p; }, function () { }).then(function () {
    if (!st.token) return veDangNhap();
    veKhung();
    api('GET', 'toi').then(function (r) { st.nguoi = r; ghi(KHOA_NGUOI, JSON.stringify(r)); }, function () { });
  });
})();
