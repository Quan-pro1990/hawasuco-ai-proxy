/* Quản lý tài sản — trang web cho máy tính và điện thoại (chạy trên máy chủ IIS).
   Quét tem QR bằng camera → xem thông tin, ảnh, lịch sử tài sản; kiểm tra, bảo dưỡng, kiểm kê; in tem QR.
   Không dùng thư viện ngoài, trừ jsQR.js (đọc QR khi trình duyệt không có BarcodeDetector) và maqr.js (tạo QR, viết riêng). */
(function () {
  'use strict';

  var KHOA_TOKEN = 'qlts.token', KHOA_NGUOI = 'qlts.nguoi', KHOA_CHON = 'qlts.chon', KHOA_TEM = 'qlts.tem';
  var app = document.getElementById('app');
  var st = { token: doc(KHOA_TOKEN), nguoi: null, dm: null, ping: null, chon: {}, lan: 0, khung: false, camera: null };
  try { st.nguoi = JSON.parse(doc(KHOA_NGUOI) || 'null'); } catch (e) { st.nguoi = null; }
  try { st.chon = JSON.parse(sessionStorage.getItem(KHOA_CHON) || '{}') || {}; } catch (e) { st.chon = {}; }

  function doc(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function ghi(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { } }
  function luuChon() { try { sessionStorage.setItem(KHOA_CHON, JSON.stringify(st.chon)); } catch (e) { } }
  function soChon() { return Object.keys(st.chon).length; }

  // ------------------------------------------------------------------ biểu tượng
  function svg(d, extra) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' + (extra || '') + '>' + d + '</svg>'; }
  var BT = {
    tongquan: svg('<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>'),
    taisan: svg('<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>'),
    quet: svg('<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="7" y="7" width="4" height="4"/><path d="M13 7h4v4M13 17h4v-4M7 13v4h4"/>'),
    kiemke: svg('<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/>'),
    khac: svg('<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>'),
    hoatdong: svg('<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'),
    danhmuc: svg('<path d="M4 6h16M4 12h16M4 18h10"/>'),
    tem: svg('<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>'),
    excel: svg('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 13l4 5M13 13l-4 5"/>'),
    taikhoan: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>'),
    caidat: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    dangxuat: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
    them: svg('<path d="M12 5v14M5 12h14"/>'),
    camera: svg('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>'),
    anh: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>'),
    sua: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
    kiemtra: svg('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),
    baotri: svg('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8z"/>'),
    dieuchuyen: svg('<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>'),
    thanhly: svg('<path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"/>'),
    tao: svg('<path d="M12 5v14M5 12h14"/>'),
    tim: svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
    den: svg('<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>'),
    ghim: svg('<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>'),
    qr: svg('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>'),
    xoa: svg('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'),
    sao: svg('<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>'),
    donvi: svg('<path d="M3 21h18M5 21V7l7-4 7 4v14"/><path d="M9 21v-5h6v5M9 9h.01M15 9h.01M9 13h.01M15 13h.01"/>'),
    in: svg('<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>'),
    tai: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'),
    len: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>'),
    dong: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
    quaylai: svg('<path d="M15 18l-6-6 6-6"/>'),
    sk_anh: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>'),
    sk_sua: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>')
  };
  BT.sk_tao = BT.tao; BT.sk_kiemtra = BT.kiemtra; BT.sk_baotri = BT.baotri; BT.sk_dieuchuyen = BT.dieuchuyen; BT.sk_thanhly = BT.thanhly; BT.sk_kiemke = BT.kiemke;

  var BT_TT = {
    tot: svg('<circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/>', ' stroke-width="2.4"'),
    theodoi: svg('<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>', ' stroke-width="2.4"'),
    hong: svg('<circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>', ' stroke-width="2.4"'),
    dangsua: svg('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8z"/>', ' stroke-width="2.4"'),
    ngung: svg('<circle cx="12" cy="12" r="10"/><path d="M10 15V9M14 15V9"/>', ' stroke-width="2.4"'),
    thanhly: svg('<path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"/>', ' stroke-width="2.4"'),
    mat: svg('<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>', ' stroke-width="2.4"')
  };
  var TEN_TT = { tot: 'Đang sử dụng tốt', theodoi: 'Cần theo dõi', hong: 'Hỏng, cần sửa chữa', dangsua: 'Đang sửa chữa / bảo dưỡng', ngung: 'Ngừng sử dụng', thanhly: 'Đã thanh lý', mat: 'Mất / không tìm thấy' };
  var MAU_TT = { tot: '#0ca30c', theodoi: '#fab219', hong: '#d03b3b', dangsua: '#ec835a', ngung: '#8a8f98', thanhly: '#5f6875', mat: '#d03b3b' };
  var TT_NGAN = { tot: 'Tốt', theodoi: 'Theo dõi', hong: 'Hỏng', dangsua: 'Đang sửa', ngung: 'Ngừng SD', thanhly: 'Thanh lý', mat: 'Mất' };
  function ttHtml(ma, ngan) { return '<span class="tt tt-' + esc(ma) + '">' + (BT_TT[ma] || '') + esc(ngan ? TT_NGAN[ma] || ma : TEN_TT[ma] || ma) + '</span>'; }
  var MA_TT = ['tot', 'theodoi', 'hong', 'dangsua', 'ngung', 'thanhly', 'mat'];

  // ------------------------------------------------------------------ định dạng
  var fSo = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
  var fNguyen = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
  function so(v) { return v == null ? '' : fSo.format(v); }
  function tien(v) { return v == null ? '' : fNguyen.format(Math.round(v)) + ' đ'; }
  function tienGon(v) {
    if (v == null) return '';
    var a = Math.abs(v);
    if (a >= 1e9) return fSo.format(Math.round(v / 1e7) / 100) + ' tỷ';
    if (a >= 1e6) return fSo.format(Math.round(v / 1e4) / 100) + ' triệu';
    return fNguyen.format(v) + ' đ';
  }
  function ngay(s) { if (!s) return ''; var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? m[3] + '/' + m[2] + '/' + m[1] : s; }
  function luc(s) { if (!s) return ''; var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s); return m ? m[3] + '/' + m[2] + '/' + m[1] + ' ' + m[4] + ':' + m[5] : s; }
  function homNay() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function soNgayTu(s) { if (!s) return null; var d = new Date(s.slice(0, 10) + 'T00:00:00'); var h = new Date(homNay() + 'T00:00:00'); return Math.round((d - h) / 86400000); }
  function tuongDoi(s) {
    if (!s) return '';
    var n = -soNgayTu(s);
    if (n <= 0) return 'hôm nay';
    if (n === 1) return 'hôm qua';
    if (n < 31) return n + ' ngày trước';
    if (n < 365) return Math.round(n / 30) + ' tháng trước';
    return fSo.format(Math.round(n / 36.5) / 10) + ' năm trước';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /** Đọc số người gõ: "350000000", "350.000.000", "1.234,5". */
  function docSo(s) {
    s = String(s == null ? '' : s).replace(/[\s\u00a0đ]/g, '').replace(/vnd/i, '');
    if (!s) return null;
    if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if ((s.match(/\./g) || []).length > 1 || /^\d{1,3}\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
    else if ((s.match(/,/g) || []).length > 1 || /^\d{1,3},\d{3}$/.test(s)) s = s.replace(/,/g, '');
    else s = s.replace(',', '.');
    if (!/^-?\d*\.?\d*$/.test(s) || s === '.' || s === '-') return NaN;
    return parseFloat(s);
  }
  function quyen(n) { return !!st.nguoi && st.nguoi.capQuyen >= n; }   // 1 kiểm tra, 2 cập nhật, 3 quản trị

  // ------------------------------------------------------------------ gọi máy chủ
  function api(method, duong, than, nhiPhan) {
    var h = { 'Accept': 'application/json' };
    if (st.token) h['Authorization'] = 'Bearer ' + st.token;
    var body;
    if (nhiPhan) { h['Content-Type'] = 'application/octet-stream'; body = than; }
    else if (than !== undefined) { h['Content-Type'] = 'application/json'; body = JSON.stringify(than); }
    return fetch('api/' + duong, { method: method, headers: h, body: body, cache: 'no-store' })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null;
          try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
          if (r.status === 401 && duong !== 'dangnhap') { dangXuatCucBo(); throw new Error((j && j.loi) || 'Hãy đăng nhập lại.'); }
          if (!r.ok) { var e = new Error((j && j.loi) || ('Lỗi máy chủ (' + r.status + ')')); e.status = r.status; throw e; }
          return j;
        });
      }, function () { throw new Error('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'); });
  }

  function taiDanhMuc() {
    return api('GET', 'danhmuc').then(function (d) { st.dm = d; return d; });
  }

  function thongBao(s, loi) {
    Array.prototype.forEach.call(document.querySelectorAll('.toast'), function (x) { x.remove(); });   // không chồng thông báo cũ
    var t = document.createElement('div');
    t.className = 'toast';
    if (loi) t.style.background = '#9b1c1c';
    t.textContent = s;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, loi ? 5000 : 3000);
  }

  /** Hộp thoại: trả về phần tử .khunghop; dong() để đóng. */
  function hop(tieuDe, noiDung, rong) {
    var h = document.createElement('div');
    h.className = 'hop';
    h.innerHTML = '<div class="khunghop' + (rong ? ' rong' : '') + '" role="dialog" aria-modal="true"><div class="hang"><h3 class="gian">' + esc(tieuDe) +
      '</h3><button class="nut-icon" data-dong type="button" aria-label="Đóng">' + BT.dong + '</button></div>' + noiDung + '</div>';
    var k = h.firstChild;
    k.dong = function () { h.remove(); document.removeEventListener('keydown', phim); if (k.khiDong) k.khiDong(); };
    function phim(e) { if (e.key === 'Escape') k.dong(); }
    document.addEventListener('keydown', phim);
    h.addEventListener('mousedown', function (e) { if (e.target === h) k.dong(); });
    k.querySelector('[data-dong]').addEventListener('click', function () { k.dong(); });
    document.body.appendChild(h);
    var o = k.querySelector('input:not([type=checkbox]):not([type=hidden]), textarea, select');
    if (o && window.innerWidth > 700) setTimeout(function () { o.focus(); }, 30);
    return k;
  }

  function hoi(tieuDe, noiDung, nutDongY, nguyHiem) {
    return new Promise(function (ok) {
      var k = hop(tieuDe, '<p class="mo">' + esc(noiDung) + '</p><div class="chan"><button class="nut" data-k="0" type="button">Huỷ</button>' +
        '<button class="nut chinh" data-k="1" type="button"' + (nguyHiem ? ' style="background:#c02626;border-color:#c02626"' : '') + '>' + esc(nutDongY || 'Đồng ý') + '</button></div>');
      var tl = false;
      k.khiDong = function () { ok(tl); };
      k.querySelector('[data-k="0"]').onclick = function () { k.dong(); };
      k.querySelector('[data-k="1"]').onclick = function () { tl = true; k.dong(); };
    });
  }

  function taiFile(link) {
    var a = document.createElement('a');
    a.href = link;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function xuatExcel(nut, method, duong, than) {
    var cu = nut.innerHTML;
    nut.disabled = true;
    nut.textContent = 'Đang tạo file…';
    return api(method, duong, than).then(function (r) { taiFile(r.link); thongBao('Đã tạo ' + r.ten); }, function (e) { thongBao(e.message, true); })
      .then(function () { nut.disabled = false; nut.innerHTML = cu; });
  }

  // ------------------------------------------------------------------ ảnh: tải (có đăng nhập), nén trước khi gửi
  var boAnh = {};
  function taiAnh(ts, ma, nho) {
    var k = ts + '/' + ma + (nho ? '/n' : '');
    if (!boAnh[k]) {
      boAnh[k] = fetch('api/anh/' + ts + '/' + encodeURIComponent(ma) + (nho ? '?nho=1' : ''), { headers: { 'Authorization': 'Bearer ' + st.token } })
        .then(function (r) { if (!r.ok) throw new Error('Không tải được ảnh'); return r.blob(); })
        .then(function (b) { return URL.createObjectURL(b); });
      boAnh[k].catch(function () { delete boAnh[k]; });
    }
    return boAnh[k];
  }
  var quanSat = 'IntersectionObserver' in window ? new IntersectionObserver(function (ds) {
    ds.forEach(function (e) { if (e.isIntersecting) { quanSat.unobserve(e.target); napMot(e.target); } });
  }, { rootMargin: '300px' }) : null;
  function napMot(img) {
    var p = img.getAttribute('data-anh').split('/');
    taiAnh(p[0], p[1], img.getAttribute('data-nho') === '1').then(function (u) { img.src = u; }, function () { img.alt = '(ảnh lỗi)'; });
  }
  function napAnh(goc) {
    Array.prototype.forEach.call(goc.querySelectorAll('img[data-anh]'), function (img) {
      img.removeAttribute('data-cho');
      if (quanSat) quanSat.observe(img); else napMot(img);
    });
  }
  function imgAnh(ts, ma, nho, lop) {
    return '<img data-anh="' + esc(ts + '/' + ma) + '" data-nho="' + (nho ? 1 : 0) + '" alt="" class="' + (lop || '') + '">';
  }
  function oAnhNho(t) {
    return t.anh ? imgAnh(t.id, t.anh, true, 'anh-nho') : '<span class="anh-nho trong-anh">' + BT.anh + '</span>';
  }

  function docAnhFile(file) {
    function quaImg() {
      return new Promise(function (ok, loi) {
        var u = URL.createObjectURL(file), i = new Image();
        i.onload = function () { ok(i); setTimeout(function () { URL.revokeObjectURL(u); }, 1000); };
        i.onerror = function () { loi(new Error('Không đọc được ảnh "' + file.name + '"')); };
        i.src = u;
      });
    }
    if (window.createImageBitmap) {
      try { return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(quaImg); } catch (e) { return quaImg(); }
    }
    return quaImg();
  }
  function veJpeg(img, max, q) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    var k = Math.min(1, max / Math.max(w, h));
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k));
    c.height = Math.max(1, Math.round(h * k));
    var g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return new Promise(function (ok, loi) {
      c.toBlob(function (b) {
        if (!b) { loi(new Error('Không nén được ảnh')); return; }
        var fr = new FileReader();
        fr.onload = function () { ok(String(fr.result).split(',')[1]); };
        fr.onerror = function () { loi(new Error('Không đọc được ảnh')); };
        fr.readAsDataURL(b);
      }, 'image/jpeg', q);
    });
  }
  function guiAnh(tsId, file, vaoBoAnh, chinh) {
    return docAnhFile(file).then(function (img) {
      return Promise.all([veJpeg(img, 1600, 0.82), veJpeg(img, 360, 0.72)]).then(function (r) {
        if (img.close) img.close();
        return api('POST', 'taisan/' + tsId + '/anh', { anh: r[0], nho: r[1], boAnh: vaoBoAnh, chinh: !!chinh });
      });
    }).then(function (r) { return r.anh; });
  }
  function guiNhieuAnh(tsId, files, vaoBoAnh, tienDo) {
    var ids = [], i = 0;
    function tiep() {
      if (i >= files.length) return Promise.resolve(ids);
      if (tienDo) tienDo(i + 1, files.length);
      return guiAnh(tsId, files[i++], vaoBoAnh, false).then(function (id) { ids.push(id); return tiep(); });
    }
    return tiep();
  }
  function chonFile(accept, nhieu, chup) {
    return new Promise(function (ok) {
      var i = document.createElement('input');
      i.type = 'file';
      i.accept = accept;
      if (nhieu) i.multiple = true;
      if (chup) i.setAttribute('capture', 'environment');
      i.style.display = 'none';
      i.addEventListener('change', function () { ok(Array.prototype.slice.call(i.files || [])); i.remove(); });
      document.body.appendChild(i);
      i.click();
    });
  }

  /** Ô chọn ảnh trong biểu mẫu: hiện ảnh xem trước, trả danh sách File. */
  function oChonAnh(goc) {
    var files = [];
    goc.innerHTML = '<div class="hang"><button class="nut nho" type="button" data-chup>' + BT.camera + 'Chụp ảnh</button>' +
      '<button class="nut nho" type="button" data-thuvien>' + BT.anh + 'Chọn ảnh</button></div><div class="anh-cho"></div>';
    var cho = goc.querySelector('.anh-cho');
    function ve() {
      cho.innerHTML = '';
      files.forEach(function (f, i) {
        var d = document.createElement('div');
        d.className = 'o-anh';
        var u = URL.createObjectURL(f);
        d.innerHTML = '<img alt="" src="' + u + '"><button type="button" aria-label="Bỏ ảnh">×</button>';
        d.querySelector('button').onclick = function () { files.splice(i, 1); ve(); };
        cho.appendChild(d);
      });
    }
    function them(ds) { files = files.concat(ds.filter(function (f) { return /^image\//.test(f.type) || /\.(jpe?g|png|heic|webp)$/i.test(f.name); })).slice(0, 20); ve(); }
    goc.querySelector('[data-chup]').onclick = function () { chonFile('image/*', false, true).then(them); };
    goc.querySelector('[data-thuvien]').onclick = function () { chonFile('image/*', true, false).then(them); };
    return function () { return files; };
  }

  function layViTri() {
    return new Promise(function (ok, loi) {
      if (!navigator.geolocation) { loi(new Error('Thiết bị không lấy được vị trí.')); return; }
      navigator.geolocation.getCurrentPosition(function (p) {
        ok({ viDo: Math.round(p.coords.latitude * 1e6) / 1e6, kinhDo: Math.round(p.coords.longitude * 1e6) / 1e6, saiSo: Math.round(p.coords.accuracy) });
      }, function (e) {
        loi(new Error(e.code === 1 ? 'Chưa cho phép lấy vị trí (bật quyền Vị trí cho trang này).' : 'Không lấy được vị trí — thử lại ở chỗ thoáng.'));
      }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 });
    });
  }
  function linkBanDo(vd, kd) { return 'https://www.google.com/maps?q=' + vd + ',' + kd; }

  // ------------------------------------------------------------------ đăng nhập
  function dangXuatCucBo() {
    st.token = null; st.nguoi = null; st.dm = null; st.khung = false;
    ghi(KHOA_TOKEN, null); ghi(KHOA_NGUOI, null);
    boAnh = {};
    dungCamera();
    veDangNhap();
  }

  function veDangNhap(loi) {
    dungCamera();
    st.khung = false;
    var cty = st.ping && st.ping.congTy ? st.ping.congTy : '';
    app.innerHTML = '<form class="dangnhap" autocomplete="on">' +
      '<div class="logo"><img src="logo.png" alt="Logo công ty"></div>' +
      '<h1>Quản lý tài sản</h1><div class="congty">' + esc(cty) + '</div>' +
      (/^#\/ma\//.test(location.hash) ? '<div class="tin">Đăng nhập để xem tài sản vừa quét.</div>' : '') +
      (loi ? '<div class="loi">' + esc(loi) + '</div>' : '') +
      (st.ping && !st.ping.coTaiKhoan ? '<div class="bao">Máy chủ chưa có tài khoản. Hãy chạy CaiDat-IIS.bat trên máy chủ để đặt mật khẩu quản trị.</div>' : '') +
      '<label class="nhan" for="ten">Tên đăng nhập</label><input id="ten" name="username" autocapitalize="none" autocorrect="off" required>' +
      '<label class="nhan" for="mk">Mật khẩu</label><input id="mk" name="password" type="password" required>' +
      '<button class="nut chinh" type="submit">Đăng nhập</button></form>';
    var f = app.querySelector('form');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var nut = f.querySelector('button');
      nut.disabled = true; nut.textContent = 'Đang đăng nhập…';
      api('POST', 'dangnhap', { ten: f.ten.value.trim(), matKhau: f.mk.value, thietBi: 'Trình duyệt · ' + navigator.userAgent.slice(0, 90) })
        .then(function (r) {
          st.token = r.token; delete r.token; st.nguoi = r;
          ghi(KHOA_TOKEN, st.token); ghi(KHOA_NGUOI, JSON.stringify(r));
          return taiDanhMuc();
        })
        .then(function () { ve(); }, function (err) { veDangNhap(err.message); });
    });
  }

  // ------------------------------------------------------------------ khung, điều hướng
  var MENU = [
    ['tongquan', 'Tổng quan', 0], ['ds', 'Tài sản', 0], ['donvi', 'Theo đơn vị', 0], ['kiemke', 'Kiểm kê', 0], ['dieuchuyen', 'Điều chuyển', 0], ['hoatdong', 'Hoạt động', 0],
    ['-'], ['nhan', 'In tem QR', 0], ['nhap', 'Nhập từ Excel', 2], ['danhmuc', 'Danh mục', 0], ['taikhoan', 'Tài khoản', 0], ['caidat', 'Cài đặt', 3]
  ];
  var BT_MENU = { tongquan: 'tongquan', ds: 'taisan', donvi: 'donvi', kiemke: 'kiemke', dieuchuyen: 'dieuchuyen', hoatdong: 'hoatdong', nhan: 'tem', nhap: 'excel', danhmuc: 'danhmuc', taikhoan: 'taikhoan', caidat: 'caidat' };

  function veKhung() {
    var n = st.nguoi || {};
    app.innerHTML = '<header class="dau"><img src="logo.png" alt=""><div class="tieude"><b>Quản lý tài sản</b><span>' + esc(n.congTy || '') +
      '</span></div><div class="nguoi">' + esc(n.hoTen || n.ten || '') + '<small>' + esc(n.tenVaiTro || '') + '</small></div></header>' +
      '<div class="khung"><nav class="ben"><a class="quet" href="#/quet">' + BT.quet + 'Quét mã QR</a>' +
      MENU.map(function (m) {
        if (m[0] === '-') return '<div class="tach"></div>';
        if (!quyen(m[2])) return '';
        return '<a href="#/' + m[0] + '" data-m="' + m[0] + '">' + BT[BT_MENU[m[0]]] + esc(m[1]) + '</a>';
      }).join('') + '<div class="tach"></div><a href="#" data-dangxuat>' + BT.dangxuat + 'Đăng xuất</a></nav>' +
      '<main class="noidung" id="nd"></main></div>' +
      '<nav class="dieuhuong"><a href="#/tongquan" data-m="tongquan">' + BT.tongquan + '<span>Tổng quan</span></a>' +
      '<a href="#/ds" data-m="ds">' + BT.taisan + '<span>Tài sản</span></a>' +
      '<a href="#/quet" data-m="quet" class="quet"><span class="tron">' + BT.quet + '</span><span>Quét QR</span></a>' +
      '<a href="#/kiemke" data-m="kiemke">' + BT.kiemke + '<span>Kiểm kê</span></a>' +
      '<a href="#/khac" data-m="khac">' + BT.khac + '<span>Thêm</span></a></nav>';
    app.querySelector('[data-dangxuat]').addEventListener('click', function (e) { e.preventDefault(); dangXuat(); });
    st.khung = true;
  }

  function dangXuat() {
    hoi('Đăng xuất', 'Đăng xuất khỏi thiết bị này?', 'Đăng xuất').then(function (ok) {
      if (!ok) return;
      api('POST', 'dangxuat').then(null, function () { }).then(dangXuatCucBo);
    });
  }

  function duong() {
    var h = location.hash.replace(/^#\/?/, '');
    var i = h.indexOf('?');
    var p = (i < 0 ? h : h.slice(0, i)).split('/').map(function (x) { try { return decodeURIComponent(x); } catch (e) { return x; } });
    var q = {};
    if (i >= 0) h.slice(i + 1).split('&').forEach(function (kv) {
      if (!kv) return;
      var j = kv.indexOf('=');
      try { q[decodeURIComponent(j < 0 ? kv : kv.slice(0, j))] = j < 0 ? '' : decodeURIComponent(kv.slice(j + 1).replace(/\+/g, ' ')); } catch (e) { }
    });
    return { p: p, q: q };
  }
  function chuoiQuery(q) {
    var s = Object.keys(q).filter(function (k) { return q[k] !== '' && q[k] != null; }).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(q[k]); }).join('&');
    return s ? '?' + s : '';
  }
  function thayDuong(h) { history.replaceState(null, '', '#' + h); }
  function di(h) { location.hash = h; }

  window.addEventListener('hashchange', ve);

  function ve() {
    dungCamera();
    Array.prototype.forEach.call(document.querySelectorAll('.xem-anh, .hop'), function (x) { x.remove(); });
    if (!st.token) { veDangNhap(); return; }
    if (!st.dm) { app.innerHTML = '<div class="dangtai">Đang tải…</div>'; taiDanhMuc().then(ve, function (e) { if (st.token) app.innerHTML = '<div class="loi" style="margin:20px">' + esc(e.message) + '</div>'; }); return; }
    if (!st.khung) veKhung();
    var r = duong();
    var trang = r.p[0] || 'tongquan';
    Array.prototype.forEach.call(app.querySelectorAll('[data-m]'), function (a) {
      var m = a.getAttribute('data-m');
      var chon = m === trang || (m === 'ds' && (trang === 'ts' || trang === 'sua' || trang === 'moi' || trang === 'ma')) ||
        (m === 'khac' && ['donvi', 'dieuchuyen', 'hoatdong', 'nhan', 'nhap', 'danhmuc', 'taikhoan', 'caidat', 'khac'].indexOf(trang) >= 0);
      a.classList.toggle('chon', chon);
    });
    var nd = document.getElementById('nd');
    nd.onclick = null;
    st.lan++;
    var lan = st.lan;
    window.scrollTo(0, 0);
    var trangs = {
      tongquan: trangTongQuan, ds: trangDanhSach, donvi: trangDonVi, quet: trangQuet, ts: trangTaiSan, ma: trangMa, sua: trangSua, moi: trangSua,
      kiemke: trangKiemKe, dieuchuyen: trangDieuChuyen, hoatdong: trangHoatDong, nhan: trangNhan, nhap: trangNhap, danhmuc: trangDanhMuc,
      taikhoan: trangTaiKhoan, caidat: trangCaiDat, khac: trangKhac
    };
    (trangs[trang] || trangTongQuan)(nd, r, lan);
  }
  function con(lan) { return lan === st.lan; }
  function dangTai(nd) { nd.innerHTML = '<div class="dangtai">Đang tải…</div>'; }
  function veLoi(nd, e) { nd.innerHTML = '<div class="loi">' + esc(e.message) + '</div><p><a href="#/tongquan">Về trang tổng quan</a></p>'; }

  function tenLoai(id) { var l = (st.dm.loai || []).filter(function (x) { return x.id === id; })[0]; return l ? l.ten : ''; }
  function layLoai(id) { return (st.dm.loai || []).filter(function (x) { return x.id === id; })[0] || null; }
  function tenDonVi(id) { var d = (st.dm.donVi || []).filter(function (x) { return x.id === id; })[0]; return d ? d.ten : ''; }
  function optLoai(chon, rong) {
    return (rong ? '<option value="">' + esc(rong) + '</option>' : '') + st.dm.loai.map(function (l) {
      return '<option value="' + l.id + '"' + (String(l.id) === String(chon) ? ' selected' : '') + '>' + esc(l.ten) + '</option>';
    }).join('');
  }
  /** Danh sách chọn đơn vị, nhóm theo khối (các đội cấp nước / khối văn phòng). coKhoi: thêm dòng "cả khối" (giá trị "k:doi"). */
  function optDonVi(chon, rong, coKhoi) {
    return (rong ? '<option value="">' + esc(rong) + '</option>' : '') + (st.dm.khoi || []).map(function (k) {
      var ds = st.dm.donVi.filter(function (d) { return d.khoi === k.ma; });
      if (!ds.length) return '';
      return '<optgroup label="' + esc(k.ten) + '">' +
        (coKhoi ? '<option value="k:' + k.ma + '"' + ('k:' + k.ma === String(chon) ? ' selected' : '') + '>Cả ' + esc(k.ten.toLowerCase()) + '</option>' : '') +
        ds.map(function (d) {
          return '<option value="' + d.id + '"' + (String(d.id) === String(chon) ? ' selected' : '') + '>' + esc(d.ten) + '</option>';
        }).join('') + '</optgroup>';
    }).join('');
  }
  function tenKhoi(ma) { var k = (st.dm.khoi || []).filter(function (x) { return x.ma === ma; })[0]; return k ? k.ten : ''; }
  function optTT(chon, rong) {
    return (rong ? '<option value="">' + esc(rong) + '</option>' : '') + MA_TT.map(function (m) {
      return '<option value="' + m + '"' + (m === chon ? ' selected' : '') + '>' + esc(TEN_TT[m]) + '</option>';
    }).join('');
  }

  // ------------------------------------------------------------------ tổng quan
  function veThanh(ds, href, mau, icon) {
    if (!ds.length) return '<div class="trong">Chưa có số liệu.</div>';
    var max = Math.max.apply(null, ds.map(function (x) { return x.so; })) || 1;
    return '<div class="thanh">' + ds.map(function (x) {
      var pc = Math.max(1, Math.round(x.so / max * 100));
      var tip = x.ten + ': ' + fNguyen.format(x.so) + ' tài sản' + (x.nguyenGia ? ' · nguyên giá ' + tienGon(x.nguyenGia) : '');
      return '<a class="ten" href="' + href(x) + '" title="' + esc(tip) + '">' + (icon ? icon(x) : '') + '<span>' + esc(x.ten) + '</span></a>' +
        '<div class="cot" title="' + esc(tip) + '"><i style="width:calc(' + pc + '% - 48px);background:' + (mau ? mau(x) : 'var(--cot)') + '"></i><span>' + fNguyen.format(x.so) + '</span></div>';
    }).join('') + '</div>';
  }

  function dongTaiSan(t, phu) {
    return '<li><a class="dong" href="#/ts/' + t.id + '">' + oAnhNho(t) + '<div class="gian"><div class="tieu"><b class="ma">' + esc(t.ma) + '</b> · ' + esc(t.ten) +
      '</div><div class="mo nho tieu">' + phu + '</div></div></a></li>';
  }

  function dongSuKien(s) {
    return '<li><a class="dong" href="#/ts/' + s.taiSan + '"><span class="bt-sk" style="color:var(--chinh)">' + (BT['sk_' + s.loai] || BT.sk_sua).replace('<svg', '<svg width="20" height="20"') +
      '</span><div class="gian"><div class="tieu"><b>' + esc(s.tenLoai) + '</b> · <span class="ma">' + esc(s.ma) + '</span> ' + esc(s.ten) + '</div>' +
      '<div class="mo nho tieu">' + esc(luc(s.luc)) + ' · ' + esc(s.hoTen) + (s.tinhTrang && (s.loai === 'kiemtra' || s.loai === 'kiemke' || s.loai === 'baotri') ? ' · ' + esc(TEN_TT[s.tinhTrang] || '') : '') +
      (s.noiDung ? ' · ' + esc(s.noiDung) : '') + '</div></div></a></li>';
  }

  function trangTongQuan(nd, r, lan) {
    dangTai(nd);
    api('GET', 'thongke').then(function (t) {
      if (!con(lan)) return;
      var hong = t.theoTinhTrang.filter(function (x) { return x.ma === 'hong' || x.ma === 'dangsua'; }).reduce(function (a, x) { return a + x.so; }, 0);
      var o = function (href, gt, ten, canh) { return '<a href="' + href + '"><div class="gt' + (canh ? ' canh' : '') + '">' + gt + '</div><div class="ten">' + ten + '</div></a>'; };
      var h = '<div class="tieude-trang"><h2>Tổng quan</h2><a class="nut chinh" href="#/quet">' + BT.quet + 'Quét mã QR</a>' +
        (quyen(2) ? '<a class="nut" href="#/moi">' + BT.them + 'Thêm tài sản</a>' : '') + '</div>';
      if (t.tong === 0) {
        h += '<div class="the"><h3>Bắt đầu sử dụng</h3><ol style="margin:0;padding-left:20px;line-height:1.9">' +
          '<li>Kiểm tra <a href="#/danhmuc">danh mục</a> loại tài sản, đơn vị quản lý (đã có sẵn danh mục mẫu của ngành nước).</li>' +
          '<li>Đưa danh sách tài sản vào: <a href="#/nhap">nhập từ file Excel</a> (sổ tài sản cố định đang dùng) hoặc <a href="#/moi">thêm từng tài sản</a>.</li>' +
          '<li><a href="#/nhan">In tem QR</a>, dán lên từng tài sản. Có thể in tem trắng trước, dán xong mới quét để khai báo.</li>' +
          '<li>Nhân viên dùng điện thoại <a href="#/quet">quét tem</a> để xem thông tin, chụp ảnh, ghi kiểm tra, bảo dưỡng.</li></ol></div>';
      }
      h += '<div class="o-so">' +
        o('#/ds?them=dangquanly', fNguyen.format(t.dangQuanLy) + (t.tong !== t.dangQuanLy ? ' <small>/ ' + fNguyen.format(t.tong) + '</small>' : ''), 'Tài sản đang quản lý') +
        o('#/ds?them=dangquanly&sap=gia', esc(tienGon(t.nguyenGia)), 'Tổng nguyên giá') +
        o('#/ds?them=dangquanly&sap=gia', esc(tienGon(t.conLai)), 'Giá trị còn lại (tạm tính)') +
        o('#/ds?tinhtrang=hong', fNguyen.format(hong), 'Hỏng / đang sửa chữa', hong > 0) +
        o('#/ds?them=baotri&sap=baotri', fNguyen.format(t.denHanBaoTri), 'Đến hạn bảo dưỡng (≤ 7 ngày)', t.denHanBaoTri > 0) +
        o('#/ds?them=lauchuakiem&sap=kiemtra', fNguyen.format(t.lauChuaKiem), 'Chưa kiểm tra trong ' + t.ngayNhacKiemTra + ' ngày') +
        o('#/hoatdong?loai=kiemtra', fNguyen.format(t.kiemTraThang), 'Đã kiểm tra trong 30 ngày') +
        o('#/ds?them=chuaanh', fNguyen.format(t.chuaAnh), 'Chưa có ảnh') + '</div>';
      var kk = t.kiemKeNam, bieuTuong = BT.kiemke.replace('<svg', '<svg width="18" height="18" style="vertical-align:-3px;color:var(--chinh)"');
      if (kk) {
        var pc = kk.tong ? Math.round(kk.daKiem * 100 / kk.tong) : 0;
        h += '<a class="the" href="#/kiemke/' + kk.id + '" style="display:block;text-decoration:none;color:inherit"><div class="hang"><b class="gian">' + bieuTuong + ' ' + esc(kk.ten) + '</b>' +
          (kk.dong ? '<span class="tt tt-ngung">Đã kết thúc</span>' : '<span class="mo nho">Quét tem = ghi nhận đã kiểm kê</span>') + '</div><div class="tien-do"><i style="width:' + pc + '%"></i></div><div class="mo nho">Đã kiểm kê ' +
          fNguyen.format(kk.daKiem) + ' / ' + fNguyen.format(kk.tong) + ' (' + pc + '%) · chưa kiểm ' + fNguyen.format(kk.tong - kk.daKiem) + (kk.ngoaiSo ? ' · ngoài sổ ' + kk.ngoaiSo : '') + '</div></a>';
      } else if (t.tong > 0) {
        h += '<a class="the" href="#/kiemke" style="display:block;text-decoration:none;color:inherit"><div class="hang"><b class="gian">' + bieuTuong + ' Kiểm kê tài sản năm ' + t.namNay + '</b><span class="mo nho">Chưa bắt đầu</span></div>' +
          '<div class="mo nho">Mỗi năm kiểm kê 1 lần. Quét tem QR của tài sản bất kỳ là tự bắt đầu và ghi nhận tài sản đó đã kiểm kê.</div></a>';
      }
      h += '<div class="luoi2"><div class="the"><h3>Theo tình trạng</h3>' +
        veThanh(t.theoTinhTrang.filter(function (x) { return x.so > 0; }), function (x) { return '#/ds?tinhtrang=' + x.ma; },
          function (x) { return MAU_TT[x.ma]; }, function (x) { return '<span class="tt-' + x.ma + '" style="background:none;display:inline-flex">' + BT_TT[x.ma] + '</span>'; }) + '</div>' +
        '<div class="the"><h3>Theo loại tài sản</h3>' + veThanh(t.theoLoai.slice(0, 12), function (x) { return '#/ds?loai=' + x.id; }) + '</div>' +
        '<div class="the"><h3><span class="gian">Theo đơn vị quản lý</span><a class="nut nho" href="#/donvi">Xem từng đơn vị</a></h3>' +
        (st.dm.khoi || []).map(function (k) {
          var ds = t.theoDonVi.filter(function (x) { return x.khoi === k.ma; });
          if (!ds.length) return '';
          var tong = ds.reduce(function (a, x) { return a + x.so; }, 0);
          return '<div class="hang" style="margin:8px 0 4px"><a class="gian" href="#/ds?khoi=' + k.ma + '" style="font-weight:600;color:var(--chu);text-decoration:none">' + esc(k.ten) + '</a>' +
            '<span class="mo nho">' + fNguyen.format(tong) + ' tài sản</span></div>' + veThanh(ds, function (x) { return '#/ds?donvi=' + x.id; });
        }).join('') + '</div>' +
        '<div class="the"><h3><span class="gian">Đến hạn bảo dưỡng</span><a class="nut nho" href="#/ds?them=baotri&sap=baotri">Xem hết</a></h3>' +
        (t.baoTri.length ? '<ul class="ds-don">' + t.baoTri.map(function (x) {
          var n = soNgayTu(x.hanBaoTri);
          return dongTaiSan(x, '<span class="' + (n < 0 ? 'qua-han' : 'sap-han') + '">' + (n < 0 ? 'Quá hạn ' + (-n) + ' ngày' : n === 0 ? 'Đến hạn hôm nay' : 'Còn ' + n + ' ngày') + '</span> · ' + esc(x.tenDonVi));
        }).join('') + '</ul>' : '<div class="trong">Không có tài sản đến hạn trong 7 ngày tới.</div>') + '</div>' +
        '<div class="the"><h3><span class="gian">Hỏng, cần sửa chữa</span><a class="nut nho" href="#/ds?tinhtrang=hong">Xem hết</a></h3>' +
        (t.hong.length ? '<ul class="ds-don">' + t.hong.map(function (x) { return dongTaiSan(x, esc(x.tenDonVi) + (x.viTri ? ' · ' + esc(x.viTri) : '')); }).join('') + '</ul>' : '<div class="trong">Không có tài sản báo hỏng.</div>') + '</div>' +
        '<div class="the"><h3><span class="gian">Hoạt động gần đây</span><a class="nut nho" href="#/hoatdong">Xem hết</a></h3>' +
        (t.hoatDong.length ? '<ul class="ds-don">' + t.hoatDong.map(dongSuKien).join('') + '</ul>' : '<div class="trong">Chưa có hoạt động.</div>') + '</div></div>';
      nd.innerHTML = h;
      napAnh(nd);
    }, function (e) { if (con(lan)) veLoi(nd, e); });
  }

  // ------------------------------------------------------------------ danh sách tài sản
  var THEM_LOC = { '': 'Lọc thêm…', dangquanly: 'Đang quản lý (bỏ thanh lý, mất)', baotri: 'Đến hạn bảo dưỡng', lauchuakiem: 'Lâu chưa kiểm tra', chuaanh: 'Chưa có ảnh' };
  var SAP = { ma: 'Sắp theo mã', ten: 'Sắp theo tên', moi: 'Mới sửa gần đây', kiemtra: 'Lâu chưa kiểm tra trước', baotri: 'Hạn bảo dưỡng gần nhất', gia: 'Nguyên giá cao trước' };

  function trangDanhSach(nd, r, lan) {
    var q = { q: r.q.q || '', loai: r.q.loai || '', donvi: r.q.donvi || '', khoi: r.q.khoi || '', tinhtrang: r.q.tinhtrang || '', them: r.q.them || '', sap: r.q.sap || 'ma' };
    // tài khoản của 1 đội / phòng ban: mở trang lần đầu thì lọc sẵn tài sản của đơn vị mình (chọn "Mọi đơn vị" để xem cả công ty)
    if (!Object.keys(r.q).length && st.nguoi.donVi >= 0) { q.donvi = String(st.nguoi.donVi); thayDuong('/ds' + chuoiQuery(q)); }
    nd.innerHTML = '<div class="tieude-trang"><h2>Tài sản</h2>' + (quyen(2) ? '<a class="nut chinh" href="#/moi">' + BT.them + 'Thêm tài sản</a>' : '') +
      '<button class="nut" type="button" data-xuat>' + BT.excel + 'Xuất Excel</button><button class="nut" type="button" data-tem>' + BT.tem + 'In tem</button>' +
      (quyen(2) ? '<button class="nut" type="button" data-dc hidden>' + BT.dieuchuyen + 'Điều chuyển</button>' : '') + '</div>' +
      '<div class="loc"><div class="tim">' + BT.tim + '<input type="search" placeholder="Tìm mã, tên, vị trí, số seri…" value="' + esc(q.q) + '" data-k="q"></div>' +
      '<select data-k="loai">' + optLoai(q.loai, 'Mọi loại') + '</select><select data-k="donvi">' + optDonVi(q.khoi ? 'k:' + q.khoi : q.donvi, 'Mọi đơn vị', true) + '</select>' +
      '<select data-k="tinhtrang">' + optTT(q.tinhtrang, 'Mọi tình trạng') + '</select>' +
      '<select data-k="them">' + Object.keys(THEM_LOC).map(function (k) { return '<option value="' + k + '"' + (k === q.them ? ' selected' : '') + '>' + esc(THEM_LOC[k]) + '</option>'; }).join('') + '</select>' +
      '<select data-k="sap">' + Object.keys(SAP).map(function (k) { return '<option value="' + k + '"' + (k === q.sap ? ' selected' : '') + '>' + esc(SAP[k]) + '</option>'; }).join('') + '</select></div>' +
      '<div class="tomtat"><span class="gian" data-tomtat>Đang tải…</span><span data-chon></span></div><div data-ds></div>';
    var dsEl = nd.querySelector('[data-ds]'), tomTat = nd.querySelector('[data-tomtat]'), chonEl = nd.querySelector('[data-chon]');
    var trang = 1, hen = null, phien = 0;

    function veChon() {
      var n = soChon();
      chonEl.innerHTML = n ? 'Đã chọn <b>' + n + '</b> · <a href="#" data-bochon>Bỏ chọn</a>' : '';
      var b = chonEl.querySelector('[data-bochon]');
      if (b) b.onclick = function (e) { e.preventDefault(); st.chon = {}; luuChon(); Array.prototype.forEach.call(dsEl.querySelectorAll('.chk'), function (c) { c.checked = false; }); veChon(); };
      nd.querySelector('[data-tem]').innerHTML = BT.tem + (n ? 'In tem (' + n + ')' : 'In tem');
      var dc = nd.querySelector('[data-dc]');
      if (dc) { dc.hidden = !n; dc.innerHTML = BT.dieuchuyen + 'Điều chuyển (' + n + ')'; }
    }
    function tai(them) {
      var p = ++phien;
      if (!them) { trang = 1; tomTat.textContent = 'Đang tải…'; }
      var qs = chuoiQuery({ q: q.q, loai: q.loai, donvi: q.donvi, khoi: q.khoi, tinhtrang: q.tinhtrang, them: q.them, sap: q.sap, trang: trang, co: 50 });
      api('GET', 'taisan' + qs).then(function (d) {
        if (!con(lan) || p !== phien) return;
        tomTat.innerHTML = '<b>' + fNguyen.format(d.tong) + '</b> tài sản' + (d.tongNguyenGia ? ' · nguyên giá ' + esc(tienGon(d.tongNguyenGia)) + ' · còn lại ' + esc(tienGon(d.tongConLai)) : '');
        var h = d.ds.map(function (t) {
          return '<a class="dong" href="#/ts/' + t.id + '"><input type="checkbox" class="chk" data-id="' + t.id + '"' + (st.chon[t.id] ? ' checked' : '') + ' aria-label="Chọn">' +
            oAnhNho(t) + '<div class="cot-pc ma"><b>' + esc(t.ma) + '</b></div>' +
            '<div class="giua"><div class="t1"><span class="ma-dt ma">' + esc(t.ma) + ' · </span>' + esc(t.ten) + '</div><div class="t2">' + esc(t.tenLoai) + ' · ' + esc(t.tenDonVi) +
            (t.viTri ? ' · ' + esc(t.viTri) : '') + '</div>' + ttHtml(t.tinhTrang, true) + '</div>' +
            '<div class="cot-pc">' + esc(t.tenLoai) + '</div><div class="cot-pc">' + esc(t.tenDonVi) + (t.viTri ? '<div class="mo nho" style="overflow:hidden;text-overflow:ellipsis">' + esc(t.viTri) + '</div>' : '') + '</div>' +
            '<div class="cot-pc">' + ttHtml(t.tinhTrang) + '</div><div class="cot-pc mo nho">' + (t.kiemTraCuoi ? esc(tuongDoi(t.kiemTraCuoi)) : 'Chưa kiểm tra') + '</div></a>';
        }).join('');
        if (!them) {
          dsEl.innerHTML = d.tong ? '<div class="ds-ts"><div class="dong dau-bang"><span></span><span></span><span>Mã</span><span>Tên tài sản</span><span>Loại</span><span>Đơn vị / vị trí</span><span>Tình trạng</span><span>Kiểm tra</span></div>' + h + '</div>' +
            '<div data-them style="text-align:center;margin:12px 0"></div>' : '<div class="the trong">Không có tài sản nào' + (q.q || q.loai || q.donvi || q.tinhtrang || q.them ? ' khớp bộ lọc.' : '. ' + (quyen(2) ? '<a href="#/moi">Thêm tài sản</a> hoặc <a href="#/nhap">nhập từ Excel</a>.' : '')) + '</div>';
        } else {
          dsEl.querySelector('.ds-ts').insertAdjacentHTML('beforeend', h);
        }
        var nutThem = dsEl.querySelector('[data-them]');
        if (nutThem) {
          var con2 = d.tong - trang * d.co;
          nutThem.innerHTML = con2 > 0 ? '<button class="nut" type="button">Xem thêm (' + fNguyen.format(con2) + ')</button>' : '';
          var b = nutThem.querySelector('button');
          if (b) b.onclick = function () { trang++; b.disabled = true; tai(true); };
        }
        napAnh(dsEl);
      }, function (e) { if (con(lan)) dsEl.innerHTML = '<div class="loi">' + esc(e.message) + '</div>'; });
    }
    dsEl.addEventListener('click', function (e) {
      if (e.target.classList.contains('chk')) {
        e.stopPropagation();
        var id = e.target.getAttribute('data-id');
        if (e.target.checked) st.chon[id] = 1; else delete st.chon[id];
        luuChon();
        veChon();
      }
    });
    Array.prototype.forEach.call(nd.querySelectorAll('[data-k]'), function (o) {
      o.addEventListener(o.tagName === 'INPUT' ? 'input' : 'change', function () {
        var k = o.getAttribute('data-k');
        if (k === 'donvi') { q.khoi = /^k:/.test(o.value) ? o.value.slice(2) : ''; q.donvi = q.khoi ? '' : o.value; }
        else q[k] = o.value;
        thayDuong('/ds' + chuoiQuery(q));
        clearTimeout(hen);
        hen = setTimeout(function () { tai(false); }, o.tagName === 'INPUT' ? 300 : 0);
      });
    });
    nd.querySelector('[data-xuat]').onclick = function () {
      var than = { q: q.q, loai: +q.loai || 0, donvi: +q.donvi || 0, khoi: q.khoi, tinhtrang: q.tinhtrang, them: q.them, sap: q.sap };
      if (soChon()) than.ids = Object.keys(st.chon).map(Number);
      xuatExcel(this, 'POST', 'xuat/taisan', than);
    };
    var nutDc = nd.querySelector('[data-dc]');
    if (nutDc) nutDc.onclick = function () {
      nutDc.disabled = true;
      api('POST', 'nhan', { ids: Object.keys(st.chon).map(Number), sap: 'ma' }).then(function (d) {
        nutDc.disabled = false;
        moDieuChuyen(d.ds, function () { st.chon = {}; luuChon(); if (con(lan)) { veChon(); tai(false); } });
      }, function (e) { nutDc.disabled = false; thongBao(e.message, true); });
    };
    nd.querySelector('[data-tem]').onclick = function () {
      if (soChon()) di('/nhan?chon=1');
      else di('/nhan' + chuoiQuery({ q: q.q, loai: q.loai, donvi: q.donvi, khoi: q.khoi, tinhtrang: q.tinhtrang, them: q.them, sap: q.sap }));
    };
    veChon();
    tai(false);
  }

  // ------------------------------------------------------------------ tài sản theo đơn vị (từng đội cấp nước, phòng ban khối văn phòng)
  function trangDonVi(nd, r, lan) {
    dangTai(nd);
    api('GET', 'theodonvi').then(function (d) {
      if (!con(lan)) return;
      var cuaToi = st.nguoi.donVi;
      var viec = function (x) {
        if (!x.so) return 'Chưa có tài sản';
        var c = [];
        if (x.hong) c.push('<span class="canh-do">' + x.hong + ' hỏng / đang sửa</span>');
        if (x.denHanBaoTri) c.push('<span class="canh-cam">' + x.denHanBaoTri + ' đến hạn bảo dưỡng</span>');
        if (x.lauChuaKiem) c.push(x.lauChuaKiem + ' chưa kiểm tra > ' + d.ngayNhacKiemTra + ' ngày');
        if (x.chuaAnh) c.push(x.chuaAnh + ' chưa có ảnh');
        return c.length ? c.join(' · ') : 'Không có việc cần xử lý';
      };
      var h = '<div class="tieude-trang"><h2>Tài sản theo đơn vị</h2><button class="nut" type="button" data-xuat="">' + BT.excel + 'Sổ tài sản các đơn vị (Excel)</button></div>' +
        '<p class="mo nho" style="margin-top:-6px">Tài sản đang quản lý của từng đội cấp nước và phòng ban (không gồm đã thanh lý, mất). Bấm tên đơn vị để xem danh sách.' +
        (quyen(2) ? ' Thêm / đổi khối của đơn vị ở <a href="#/danhmuc">Danh mục</a>.' : '') + '</p>';
      d.khoi.forEach(function (k) {
        if (!k.donVi.length) return;
        h += '<section class="khoi"><div class="khoi-dau"><div class="gian"><h3>' + esc(k.ten) + '</h3><div class="mo nho">' + k.donVi.length + ' đơn vị · ' +
          fNguyen.format(k.so) + ' tài sản · nguyên giá ' + esc(tienGon(k.nguyenGia)) + ' · còn lại ' + esc(tienGon(k.conLai)) +
          (k.hong ? ' · <span class="canh-do">' + k.hong + ' hỏng / đang sửa</span>' : '') + '</div></div>' +
          '<a class="nut nho" href="#/ds?khoi=' + k.ma + '">' + BT.taisan + 'Xem tài sản</a><button class="nut nho" type="button" data-xuat="k:' + k.ma + '">' + BT.excel + 'Sổ Excel của khối</button></div>' +
          '<div class="luoi-dv">' + k.donVi.map(function (x) {
            return '<div class="the dv' + (x.id === cuaToi ? ' cua-toi' : '') + '"><a class="dv-dau" href="#/ds?donvi=' + x.id + '"><b>' + esc(x.ten) + '</b>' +
              '<span class="dv-so"><b>' + fNguyen.format(x.so) + '</b> tài sản</span></a>' +
              (x.id === cuaToi ? '<div><span class="tt tt-tot">' + BT_TT.tot + 'Đơn vị của bạn</span></div>' : '') +
              (x.ghiChu ? '<div class="mo nho">' + esc(x.ghiChu) + '</div>' : '') +
              (x.so ? '<div class="dv-gt">Nguyên giá <b>' + esc(tienGon(x.nguyenGia)) + '</b> · còn lại <b>' + esc(tienGon(x.conLai)) + '</b></div>' : '') +
              (x.theoLoai.length ? '<div class="mo nho">' + x.theoLoai.map(function (l) { return esc(l.ten) + ': ' + l.so; }).join(' · ') + '</div>' : '') +
              '<div class="dv-viec nho">' + viec(x) + '</div>' +
              '<div class="hang" style="margin-top:auto;padding-top:8px"><a class="nut nho" href="#/ds?donvi=' + x.id + '">Danh sách</a>' +
              (x.so ? '<a class="nut nho" href="#/nhan?donvi=' + x.id + '">' + BT.tem + 'In tem</a>' : '') +
              '<button class="nut nho" type="button" data-xuat="' + x.id + '">' + BT.excel + 'Sổ Excel</button></div></div>';
          }).join('') + '</div></section>';
      });
      nd.innerHTML = h;
      nd.onclick = function (e) {
        var b = e.target.closest('[data-xuat]');
        if (!b || b.disabled) return;
        var v = b.getAttribute('data-xuat');
        xuatExcel(b, 'POST', 'xuat/donvi', /^k:/.test(v) ? { khoi: v.slice(2) } : { donvi: +v || 0 });
      };
    }, function (e) { if (con(lan)) veLoi(nd, e); });
  }

  // ------------------------------------------------------------------ quét mã QR
  function dungCamera() {
    var c = st.camera;
    if (!c) return;
    st.camera = null;
    c.dung = true;
    if (c.stream) c.stream.getTracks().forEach(function (t) { t.stop(); });
    if (c.raf) cancelAnimationFrame(c.raf);
  }

  var huaJsQR = null;
  function taiJsQR() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    if (!huaJsQR) huaJsQR = new Promise(function (ok, loi) {
      var s = document.createElement('script');
      s.src = 'jsQR.js';
      s.onload = function () { ok(window.jsQR); };
      s.onerror = function () { huaJsQR = null; loi(new Error('Không tải được bộ đọc QR')); };
      document.head.appendChild(s);
    });
    return huaJsQR;
  }

  function boDocQR() {
    if ('BarcodeDetector' in window) {
      return window.BarcodeDetector.getSupportedFormats().then(function (f) {
        if (f.indexOf('qr_code') < 0) throw new Error('khong');
        var d = new window.BarcodeDetector({ formats: ['qr_code'] });
        return function (nguon) { return d.detect(nguon).then(function (r) { return r.length ? r[0].rawValue : null; }); };
      }).catch(boDocJs);
    }
    return boDocJs();
  }
  function boDocJs() {
    return taiJsQR().then(function (jsQR) {
      var c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true });
      return function (nguon) {
        var w = nguon.videoWidth || nguon.naturalWidth || nguon.width, h = nguon.videoHeight || nguon.naturalHeight || nguon.height;
        if (!w || !h) return Promise.resolve(null);
        var k = Math.min(1, 800 / Math.max(w, h));
        c.width = Math.round(w * k); c.height = Math.round(h * k);
        g.drawImage(nguon, 0, 0, c.width, c.height);
        var d = g.getImageData(0, 0, c.width, c.height);
        var r = jsQR(d.data, c.width, c.height, { inversionAttempts: 'attemptBoth' });
        return Promise.resolve(r ? r.data : null);
      };
    });
  }

  /** Đọc mã QR trong ảnh chụp (khi không mở được camera trực tiếp). */
  function docQRTuFile(file) {
    return docAnhFile(file).then(function (img) {
      return boDocQR().then(function (doc1) { return doc1(img); }).then(function (kq) {
        if (kq) return kq;
        // thử lại với bộ đọc jsQR ở các cỡ ảnh khác
        return taiJsQR().then(function (jsQR) {
          var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
          var c = document.createElement('canvas'), g = c.getContext('2d');
          var co = [1600, 1200, 800, 500];
          for (var i = 0; i < co.length; i++) {
            var k = Math.min(1, co[i] / Math.max(w, h));
            c.width = Math.round(w * k); c.height = Math.round(h * k);
            g.drawImage(img, 0, 0, c.width, c.height);
            var r = jsQR(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
            if (r) return r.data;
          }
          return null;
        });
      });
    });
  }

  /** Quét tem = ghi nhận đã kiểm kê năm nay (chưa mở kiểm kê năm nay thì máy chủ tự mở; đã kiểm trong năm thì giữ lần trước). */
  function ghiKiemKeQuet(id) {
    return api('POST', 'taisan/' + id + '/kiemke', {});
  }
  function nhoKiemKeVuaGhi(id, x, loi) {
    st.kkVuaGhi = { id: id, kq: x, loi: loi, luc: Date.now() };
  }

  function trangQuet(nd, r, lan) {
    var ghiKK = quyen(1);
    var dieuChuyen = quyen(2) && r.q.dc === '1';   // quét gom các tài sản cần chuyển sang đội / phòng ban khác
    var lienTuc = ghiKK && !dieuChuyen && (r.q.lientuc === '1' || !!r.q.dot);
    var oLai = lienTuc || dieuChuyen;              // quét xong ở lại camera để quét tem tiếp
    var namNay = new Date().getFullYear(), kk = null, daTaiKK = false;
    var vuaQuet = [];
    if (dieuChuyen && !st.dcGio) st.dcGio = [];
    var coCamera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && window.isSecureContext !== false;
    var cheDo = dieuChuyen ? 'dc' : lienTuc ? 'kk' : '';
    nd.innerHTML = '<div class="tieude-trang"><h2>' + (dieuChuyen ? 'Quét để điều chuyển' : lienTuc ? 'Quét kiểm kê' : 'Quét mã QR') + '</h2></div>' +
      (ghiKK ? '<div class="phan-doan">' + [['', '#/quet', 'Từng tài sản'], ['kk', '#/quet?lientuc=1', 'Kiểm kê'], ['dc', '#/quet?dc=1', 'Điều chuyển']].filter(function (x) { return x[0] !== 'dc' || quyen(2); }).map(function (x) {
        return '<a href="' + x[1] + '"' + (x[0] === cheDo ? ' class="chon"' : '') + '>' + x[2] + '</a>';
      }).join('') + '</div>' + (dieuChuyen ? '' : '<div class="the kk-dang" data-kk><div class="mo nho">Đang tải tình hình kiểm kê…</div></div>') : '') +
      '<div class="quet-khung' + (oLai ? ' lien-tuc' : '') + '"><video playsinline muted></video><div class="ngam"><div></div></div><div class="tren"></div><div class="thongbao">Đưa tem QR vào giữa khung</div></div>' +
      '<div class="quet-thay"><div data-kq></div>' + (lienTuc ? '<div data-vuaquet></div>' : '') + (dieuChuyen ? '<div data-gio></div>' : '') +
      '<div class="hang" style="margin-top:12px"><button class="nut gian" type="button" data-anh>' + BT.camera + 'Chụp ảnh mã QR</button></div>' +
      '<form class="hang" style="margin-top:8px" data-nhap><input class="gian ma" placeholder="Hoặc gõ mã tài sản, vd MB-00012" autocapitalize="characters" style="flex:1;width:auto">' +
      '<button class="nut chinh" type="submit">Tìm</button></form></div>';
    var video = nd.querySelector('video'), tb = nd.querySelector('.thongbao'), tren = nd.querySelector('.tren'), kqEl = nd.querySelector('[data-kq]');
    var dangXuLy = false, maDaXong = '', ganDay = {};   // ganDay: mã → lúc xử lý, để camera không đọc lại liên tục 1 tem
    var CHO = dieuChuyen ? 'Quét tem từng tài sản cần chuyển' : lienTuc ? 'Quét lần lượt tem từng tài sản' : 'Đưa tem QR vào giữa khung';
    tb.textContent = CHO;

    function veKK() {
      var el = nd.querySelector('[data-kk]');
      if (!el) return;
      if (!kk) {
        el.innerHTML = '<b>Kiểm kê năm ' + namNay + ': chưa bắt đầu</b><div class="mo nho">Quét tem đầu tiên sẽ tự mở kiểm kê năm ' + namNay + ' và ghi nhận tài sản đó đã kiểm kê.</div>';
        return;
      }
      var pc = kk.tong ? Math.round(kk.daKiem * 100 / kk.tong) : 0;
      el.innerHTML = '<div class="hang"><b class="gian">' + esc(kk.ten) + '</b><a class="nho" href="#/kiemke/' + kk.id + '">Xem tiến độ</a></div><div class="tien-do"><i style="width:' + pc + '%"></i></div>' +
        '<div class="mo nho">Đã kiểm kê <b>' + fNguyen.format(kk.daKiem) + '</b> / ' + fNguyen.format(kk.tong) + ' (' + pc + '%)' + (kk.ngoaiSo ? ' · ngoài sổ ' + kk.ngoaiSo : '') +
        (kk.dong ? ' · <b style="color:var(--do)">đã kết thúc — quét tem không ghi nhận kiểm kê nữa</b>' : ' · quét tem là ghi nhận đã kiểm kê') + '</div>';
    }
    if (ghiKK && !dieuChuyen) {
      api('GET', 'kiemke').then(function (d) {
        if (!con(lan)) return;
        namNay = d.namNay;
        kk = d.ds.filter(function (x) { return x.id === d.dotNamNay; })[0] || null;
        daTaiKK = true;
        veKK();
        veVuaQuet();
      }, function () { });
    }

    function veVuaQuet() {
      var el = nd.querySelector('[data-vuaquet]');
      if (!el) return;
      el.innerHTML = vuaQuet.length ? '<div class="the vua-quet"><h3>Vừa quét <span class="mo nho">' + vuaQuet.length + ' tài sản — bấm vào tài sản để ghi tình trạng, ghi chú, ảnh</span></h3><ul class="ds-don">' +
        vuaQuet.map(function (x, i) {
          var t = x.taiSan;
          return '<li><button type="button" class="dong" data-i="' + i + '">' + oAnhNho(t) + '<div class="gian"><div class="tieu"><b class="ma">' + esc(t.ma) + '</b> · ' + esc(t.ten) + '</div>' +
            '<div class="mo nho tieu">' + esc(t.tenDonVi) + (t.viTri ? ' · ' + esc(t.viTri) : '') + '</div><div class="nho">' + ttHtml(x.tinhTrang, true) +
            ' <span class="' + (x.moi ? 'xanh' : 'mo') + '">' + (x.moi ? 'Đã ghi nhận ' + esc(luc(x.luc).slice(11)) : 'Đã kiểm kê trước: ' + esc(luc(x.luc)) + ' · ' + esc(x.hoTen)) + '</span>' +
            (x.ngoaiSo ? ' <span class="cam">· ngoài sổ</span>' : '') + '</div></div></button></li>';
        }).join('') + '</ul></div>' :
        '<p class="mo nho" style="text-align:center;margin:0 8px">Mỗi tem quét được ghi nhận ngay là đã kiểm kê năm ' + namNay + ' (giữ tình trạng hiện có). Tài sản hỏng, sai vị trí… thì bấm vào tài sản trong danh sách để ghi lại.</p>';
      napAnh(el);
    }
    veVuaQuet();
    if (lienTuc) {
      nd.querySelector('[data-vuaquet]').onclick = function (e) {
        var b = e.target.closest('[data-i]');
        if (!b) return;
        var x = vuaQuet[+b.getAttribute('data-i')];
        moKiemKeNhanh(x.taiSan, { luc: x.luc, nguoi: x.hoTen, tinhTrang: x.tinhTrang, ghiChu: x.ghiChu, nam: namNay }, function (y) {
          if (!con(lan)) return;
          kk = y.dot; veKK();
          var i = vuaQuet.indexOf(x);
          if (i >= 0) vuaQuet[i] = y;
          veVuaQuet();
        });
      };
    }

    function daGhiLienTuc(x, text) {
      var t = x.taiSan;
      vuaQuet = vuaQuet.filter(function (v) { return v.taiSan.id !== t.id; });
      vuaQuet.unshift(x);
      if (vuaQuet.length > 100) vuaQuet.length = 100;
      veVuaQuet();
      dangXuLy = false;
      tb.textContent = (x.moi ? 'Đã ghi nhận ' : 'Đã kiểm kê trước đó: ') + t.ma + ' — quét tem tiếp theo';
      if (navigator.vibrate) try { navigator.vibrate(x.moi ? [50, 60, 50] : 250); } catch (e) { }
      thongBao(x.moi ? 'Đã kiểm kê ' + t.ma + (x.ngoaiSo ? ' (ngoài sổ)' : '') + ' — ' + x.dot.daKiem + '/' + x.dot.tong : t.ma + ' đã kiểm kê lúc ' + luc(x.luc) + ' (' + x.hoTen + ')');
    }

    // ---- điều chuyển: danh sách tài sản quét được (giữ trong phiên, sang trang khác quay lại vẫn còn)
    function veGio() {
      var el = nd.querySelector('[data-gio]');
      if (!el) return;
      var g = st.dcGio;
      el.innerHTML = '<div class="the vua-quet"><h3>Tài sản sẽ điều chuyển <span class="mo nho">' + (g.length ? g.length + ' tài sản' : 'quét tem từng tài sản cần chuyển, rồi chọn đội / phòng ban nhận') + '</span></h3>' +
        (g.length ? '<ul class="ds-don">' + g.map(function (t, i) {
          return '<li><div class="dong">' + oAnhNho(t) + '<div class="gian"><div class="tieu"><b class="ma">' + esc(t.ma) + '</b> · ' + esc(t.ten) + '</div>' +
            '<div class="mo nho tieu">' + esc(t.tenDonVi) + (t.viTri ? ' · ' + esc(t.viTri) : '') + '</div></div>' +
            '<button type="button" class="nut-icon" data-bo="' + i + '" aria-label="Bỏ ' + esc(t.ma) + ' khỏi danh sách">' + BT.dong + '</button></div></li>';
        }).join('') + '</ul>' : '') +
        '<div class="hang" style="margin-top:10px"><button class="nut chinh gian" type="button" data-chuyen' + (g.length ? '' : ' disabled') + '>' + BT.dieuchuyen +
        'Điều chuyển' + (g.length ? ' ' + g.length + ' tài sản' : '') + '…</button>' + (g.length ? '<button class="nut" type="button" data-xoagio>Xoá danh sách</button>' : '') + '</div></div>';
      napAnh(el);
    }
    if (dieuChuyen) {
      veGio();
      nd.querySelector('[data-gio]').onclick = function (e) {
        var b = e.target.closest('[data-bo],[data-xoagio],[data-chuyen]');
        if (!b) return;
        if (b.hasAttribute('data-bo')) { st.dcGio.splice(+b.getAttribute('data-bo'), 1); veGio(); }
        else if (b.hasAttribute('data-xoagio')) { st.dcGio = []; veGio(); }
        else moDieuChuyen(st.dcGio.slice(), function () { st.dcGio = []; if (con(lan)) veGio(); });
      };
    }
    function themVaoGio(k) {
      var t = k.taiSan;
      dangXuLy = false;
      tb.textContent = CHO;
      var loi = !k.duocSua ? t.ma + ' thuộc ' + t.tenDonVi + ' — tài khoản này không điều chuyển được tài sản của đơn vị khác' :
        t.tinhTrang === 'thanhly' ? t.ma + ' đã thanh lý, không điều chuyển được' : '';
      if (loi) { thongBao(loi, true); if (navigator.vibrate) try { navigator.vibrate(400); } catch (e) { } return; }
      if (st.dcGio.some(function (x) { return x.id === t.id; })) { thongBao(t.ma + ' đã có trong danh sách'); return; }
      st.dcGio.unshift(t);
      veGio();
      tb.textContent = 'Đã thêm ' + t.ma + ' — quét tem tiếp theo';
      if (navigator.vibrate) try { navigator.vibrate([50, 60, 50]); } catch (e) { }
      thongBao('Đã thêm ' + t.ma + ' (' + st.dcGio.length + ' tài sản)');
      ghiKiemKeQuet(t.id).then(null, function () { });   // quét tem = ghi nhận kiểm kê năm nay (lỗi, vd kiểm kê đã kết thúc: bỏ qua)
    }

    /** tuTay: gõ mã / chụp ảnh — luôn xử lý, kể cả tem vừa quét. */
    function xuLy(text, tuTay) {
      if (dangXuLy || !text) return;
      if (!tuTay && document.querySelector('.hop')) return;   // đang mở hộp thoại: tạm không nhận tem
      var bay = Date.now();
      if (!tuTay) {
        if (text === maDaXong) return;   // quét liên tục: tem vừa xử lý còn trong khung hình — chờ tem khác
        if (ganDay[text] && bay - ganDay[text] < (oLai ? 20000 : 4000)) return;
      }
      ganDay[text] = bay;
      maDaXong = oLai ? text : '';
      dangXuLy = true;
      if (navigator.vibrate) try { navigator.vibrate(60); } catch (e) { }
      tb.textContent = 'Đang tìm…';
      api('GET', 'tim?ma=' + encodeURIComponent(text)).then(function (k) {
        if (!con(lan)) return;
        if (k.id) {
          kqEl.innerHTML = '';
          if (dieuChuyen) { themVaoGio(k); return; }
          if (!ghiKK || (daTaiKK && kk && kk.dong && !lienTuc)) { dungCamera(); di('/ts/' + k.id); return; }
          tb.textContent = 'Đang ghi nhận kiểm kê…';
          return ghiKiemKeQuet(k.id).then(function (x) {
            if (!con(lan)) return;
            kk = x.dot; daTaiKK = true; veKK();
            if (lienTuc) { daGhiLienTuc(x, text); return; }
            nhoKiemKeVuaGhi(k.id, x);
            dungCamera();
            di('/ts/' + k.id);
          }, function (e) {
            if (!con(lan)) return;
            if (lienTuc) { dangXuLy = false; tb.textContent = e.message; thongBao(e.message, true); return; }
            nhoKiemKeVuaGhi(k.id, null, e);
            dungCamera();
            di('/ts/' + k.id);
          });
        }
        dangXuLy = false;
        tb.textContent = CHO;
        kqEl.innerHTML = '<div class="the" style="margin:0 0 12px"><h3>Không có tài sản mã <span class="ma">' + esc(k.ma || text) + '</span></h3>' +
          (k.hopLe ? '<p class="mo">Tem này chưa gắn với tài sản nào (tem in trước), hoặc tài sản đã bị xoá.</p>' + (k.duocTao ? '<a class="nut chinh" href="#/moi?ma=' + encodeURIComponent(k.ma) + '">' + BT.them + 'Khai báo tài sản với mã này</a>' : '') :
            '<p class="mo">Nội dung mã QR không phải tem tài sản: ' + esc(text.slice(0, 120)) + '</p>') + '</div>';
        if (oLai && navigator.vibrate) try { navigator.vibrate(400); } catch (e) { }
      }, function (e) { dangXuLy = false; tb.textContent = e.message; });
    }

    nd.querySelector('[data-nhap]').addEventListener('submit', function (e) {
      e.preventDefault();
      var o = this.querySelector('input'), v = o.value.trim();
      if (v) xuLy(v, true);
      if (oLai) o.value = '';
    });
    nd.querySelector('[data-anh]').onclick = function () {
      chonFile('image/*', false, true).then(function (f) {
        if (!f.length) return;
        tb.textContent = 'Đang đọc mã trong ảnh…';
        docQRTuFile(f[0]).then(function (text) {
          if (!text) { tb.textContent = 'Không thấy mã QR trong ảnh — chụp gần hơn, đủ sáng, không rung.'; return; }
          xuLy(text, true);
        }, function (e) { tb.textContent = e.message; });
      });
    };

    if (!coCamera) {
      nd.querySelector('.quet-khung').innerHTML = '<div class="thongbao" style="position:static;margin:40px 16px;background:rgba(255,255,255,.12)">' +
        (window.isSecureContext === false ? 'Trình duyệt chỉ cho mở camera trong trang https. Bấm "Chụp ảnh mã QR" bên dưới, hoặc dùng ứng dụng Camera của điện thoại quét tem (tem mở thẳng trang tài sản).'
          : 'Thiết bị không mở được camera trong trình duyệt. Bấm "Chụp ảnh mã QR" bên dưới.') + '</div>';
      nd.querySelector('.quet-khung').style.aspectRatio = 'auto';
      return;
    }
    var cam = { dung: false };
    st.camera = cam;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }).then(function (s) {
      if (cam.dung) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
      cam.stream = s;
      video.srcObject = s;
      return video.play().then(function () {
        var track = s.getVideoTracks()[0];
        var caps = track.getCapabilities ? track.getCapabilities() : {};
        if (caps.torch) {
          var bat = false;
          tren.innerHTML = '<button type="button">' + BT.den + 'Đèn</button>';
          var b = tren.querySelector('button');
          b.onclick = function () {
            bat = !bat;
            track.applyConstraints({ advanced: [{ torch: bat }] }).then(function () { b.classList.toggle('bat', bat); }, function () { });
          };
        }
        return boDocQR();
      }).then(function (doc1) {
        if (!doc1 || cam.dung) return;
        var cho = false, lanCuoi = 0;
        function vong(t) {
          if (cam.dung) return;
          cam.raf = requestAnimationFrame(vong);
          if (cho || dangXuLy || t - lanCuoi < 120 || video.readyState < 2) return;
          lanCuoi = t;
          cho = true;
          doc1(video).then(function (text) { cho = false; if (text) xuLy(text); }, function () { cho = false; });
        }
        cam.raf = requestAnimationFrame(vong);
      });
    }).catch(function (e) {
      if (cam.dung) return;
      var tin = e && e.name === 'NotAllowedError' ? 'Chưa cho phép dùng camera. Bấm biểu tượng ổ khoá trên thanh địa chỉ → cho phép Camera, rồi tải lại trang.' :
        'Không mở được camera (' + (e && e.message || e) + '). Bấm "Chụp ảnh mã QR" bên dưới.';
      tb.textContent = tin;
    });
  }

  // ------------------------------------------------------------------ mở tài sản theo mã (địa chỉ trong tem QR)
  function trangMa(nd, r, lan) {
    var ma = r.p.slice(1).join('/');
    dangTai(nd);
    api('GET', 'tim?ma=' + encodeURIComponent(ma)).then(function (k) {
      if (!con(lan)) return;
      if (k.id) {
        // mở tem bằng ứng dụng Camera của điện thoại: cũng ghi nhận đã kiểm kê năm nay như khi quét trong ứng dụng
        var moTrang = function () { if (con(lan)) { thayDuong('/ts/' + k.id); ve(); } };
        if (!quyen(1)) { moTrang(); return; }
        ghiKiemKeQuet(k.id).then(function (x) { nhoKiemKeVuaGhi(k.id, x); moTrang(); }, function (e) { nhoKiemKeVuaGhi(k.id, null, e); moTrang(); });
        return;
      }
      nd.innerHTML = '<div class="the"><h3>Không có tài sản mã <span class="ma">' + esc(k.ma) + '</span></h3><p class="mo">Tem chưa gắn với tài sản nào (tem in trước), hoặc tài sản đã bị xoá.</p>' +
        '<div class="hang">' + (k.duocTao ? '<a class="nut chinh" href="#/moi?ma=' + encodeURIComponent(k.ma) + '">' + BT.them + 'Khai báo tài sản với mã này</a>' : '') +
        '<a class="nut" href="#/quet">' + BT.quet + 'Quét tem khác</a></div></div>';
    }, function (e) { if (con(lan)) veLoi(nd, e); });
  }

  // ------------------------------------------------------------------ trang tài sản
  function diaChiQr(ma) {
    var goc = (st.dm.caiDat.diaChiQr || (location.origin + location.pathname.replace(/[^/]*$/, ''))).replace(/\/+$/, '');
    return goc + '/t/' + encodeURIComponent(ma);
  }

  function trangTaiSan(nd, r, lan) {
    var id = +r.p[1];
    dangTai(nd);
    api('GET', 'taisan/' + id).then(function (t) { if (con(lan)) veTaiSan(nd, t, lan); }, function (e) { if (con(lan)) veLoi(nd, e); });
  }

  /** Ô "kiểm kê năm nay" trên trang tài sản. vg: kết quả vừa ghi khi quét tem (nếu có). */
  function kkBaoHtml(t, kt, vg) {
    var k = t.kiemKeNam;
    if (!k) return '';
    var nut = function (ten, chinh) { return kt && !k.dong ? '<button class="nut nho' + (chinh ? ' chinh' : '') + '" type="button" data-kk>' + ten + '</button>' : ''; };
    if (k.daKiem) {
      var moi = vg && vg.kq && vg.kq.moi;
      return '<div class="kk-bao xong' + (moi ? ' vua' : '') + '">' + BT_TT.tot + '<div class="gian"><b>' + (moi ? 'Vừa ghi nhận kiểm kê năm ' : 'Đã kiểm kê năm ') + k.nam + '</b><br>' +
        esc(luc(k.luc)) + ' — ' + esc(k.nguoi || '') + ' · ' + esc(TEN_TT[k.tinhTrang] || k.tinhTrang || '') + (k.ghiChu ? ' · ' + esc(k.ghiChu) : '') +
        (!k.trongSo ? ' · <i>ngoài sổ sách đầu kỳ</i>' : '') + '</div>' + nut('Ghi tình trạng kiểm kê') + '</div>';
    }
    if (k.dot && k.dong) return '<div class="kk-bao"><div class="gian"><b>Chưa kiểm kê năm ' + k.nam + '</b><br>Kiểm kê năm ' + k.nam + ' đã kết thúc mà chưa ghi nhận tài sản này.</div></div>';
    return '<div class="kk-bao"><div class="gian"><b>Chưa kiểm kê năm ' + k.nam + '</b><br>' +
      (!k.dot ? 'Kiểm kê năm ' + k.nam + ' chưa bắt đầu — quét tem QR (hoặc bấm xác nhận) sẽ tự bắt đầu và ghi nhận tài sản này.' :
        k.trongSo ? 'Quét tem QR hoặc bấm xác nhận khi đã thấy tài sản tại chỗ.' : 'Tài sản không có trong sổ sách đầu kỳ — xác nhận sẽ ghi là "ngoài sổ".') +
      '</div>' + nut('Xác nhận kiểm kê', true) + '</div>';
  }

  function veTaiSan(nd, t, lan) {
    var sua = t.duocSua, kt = quyen(1);
    var vg = st.kkVuaGhi && st.kkVuaGhi.id === t.id && Date.now() - st.kkVuaGhi.luc < 60000 ? st.kkVuaGhi : null;
    st.kkVuaGhi = null;
    if (vg && vg.loi && vg.loi.status !== 409) thongBao('Chưa ghi nhận được kiểm kê: ' + vg.loi.message, true);   // 409: kiểm kê năm nay đã kết thúc (ô kiểm kê đã ghi rõ)
    else if (vg && vg.kq && vg.kq.moi) thongBao('Đã ghi nhận kiểm kê năm ' + t.kiemKeNam.nam + (vg.kq.ngoaiSo ? ' (ngoài sổ)' : '') + ' — ' + fNguyen.format(vg.kq.dot.daKiem) + '/' + fNguyen.format(vg.kq.dot.tong));
    else if (vg && vg.kq) thongBao('Đã kiểm kê năm nay lúc ' + luc(vg.kq.luc) + ' (' + vg.kq.hoTen + ')');
    var anh = t.boAnh || [];
    var dong = function (k, v) { return v === '' || v == null ? '' : '<div class="k">' + esc(k) + '</div><div class="v">' + v + '</div>'; };
    var han = t.hanBaoTri ? soNgayTu(t.hanBaoTri) : null;
    var h = '<div class="ts-dau"><div>' +
      (anh.length ? '<div class="anh-lon" data-xem="0">' + imgAnh(t.id, t.anhChinh || anh[0], false) + (anh.length > 1 ? '<span class="dem">' + anh.length + ' ảnh</span>' : '') + '</div>'
        : '<div class="anh-lon trong-anh">' + BT.anh + '<span>Chưa có ảnh</span>' + (kt ? '<div class="hang"><button class="nut nho" type="button" data-chupanh>' + BT.camera + 'Chụp ảnh</button>' +
          '<button class="nut nho" type="button" data-themanh>' + BT.anh + 'Chọn ảnh</button></div>' : '') + '</div>') +
      (anh.length ? '<div class="dai-anh" style="margin-top:8px">' + anh.map(function (a, i) {
        return '<button type="button" data-xem="' + i + '" class="' + (a === t.anhChinh ? 'chinh' : '') + '" aria-label="Ảnh ' + (i + 1) + '">' + imgAnh(t.id, a, true) + '</button>';
      }).join('') + (kt ? '<button type="button" class="them" data-themanh>' + BT.them + 'Thêm ảnh</button>' : '') + '</div>' : '') +
      '</div><div><div class="hang"><span class="ma-nhan ma">' + esc(t.ma) + '</span>' + ttHtml(t.tinhTrang) + '</div>' +
      '<h2 class="ts-ten">' + esc(t.ten) + '</h2><div class="ts-phu">' + esc(t.tenLoai) + ' · ' + esc(t.tenDonVi) + '</div>' +
      (t.viTri ? '<div class="ts-phu" style="margin-top:2px">' + BT.ghim.replace('<svg', '<svg width="14" height="14" style="vertical-align:-2px"') + ' ' + esc(t.viTri) + '</div>' : '') +
      kkBaoHtml(t, kt, vg) +
      '<div class="hanh-dong">' +
      (kt ? '<button class="nut" type="button" data-hd="kiemtra">' + BT.kiemtra + 'Kiểm tra</button>' : '') +
      (kt ? '<button class="nut" type="button" data-chupanh>' + BT.camera + 'Chụp ảnh</button>' : '') +
      (kt ? '<button class="nut" type="button" data-hd="baotri">' + BT.baotri + 'Bảo dưỡng / sửa</button>' : '') +
      (sua ? '<a class="nut" href="#/sua/' + t.id + '">' + BT.sua + 'Sửa thông tin</a>' : '') +
      (sua ? '<button class="nut" type="button" data-hd="dieuchuyen">' + BT.dieuchuyen + 'Điều chuyển</button>' : '') +
      '<button class="nut" type="button" data-intem>' + BT.tem + 'In tem</button>' +
      (sua && t.tinhTrang !== 'thanhly' ? '<button class="nut" type="button" data-hd="thanhly">' + BT.thanhly + 'Thanh lý</button>' : '') +
      (quyen(3) ? '<button class="nut do" type="button" data-xoa>' + BT.xoa + 'Xoá</button>' : '') +
      '</div></div></div>';

    var tsHtml = (t.thongSo || []).map(function (x) { return dong(x.ten, esc(x.gt)); }).join('');
    h += '<div class="luoi2"><div>' +
      '<div class="the"><h3>Thông tin chung</h3><div class="bang-tt">' +
      dong('Mã tài sản', '<span class="ma">' + esc(t.ma) + '</span>') + dong('Loại', esc(t.tenLoai) + (t.nhom ? '<div class="mo nho">' + esc(t.nhom) + '</div>' : '')) +
      dong('Đơn vị quản lý', '<a href="#/ds?donvi=' + t.donVi + '">' + esc(t.tenDonVi) + '</a><div class="mo nho">' + esc(tenKhoi(t.khoi)) + '</div>') + dong('Vị trí', esc(t.viTri)) +
      dong('Toạ độ', t.viDo != null ? '<a href="' + linkBanDo(t.viDo, t.kinhDo) + '" target="_blank" rel="noopener">' + t.viDo + ', ' + t.kinhDo + ' — xem bản đồ</a>' : '') +
      dong('Người sử dụng', esc(t.nguoiSuDung)) + dong('Hãng sản xuất', esc(t.hangSX)) + dong('Model / quy cách', esc(t.model)) + dong('Số seri', esc(t.soSeri)) +
      dong('Nước sản xuất', esc(t.nuocSX)) + dong('Năm sản xuất', t.namSX != null ? String(t.namSX) : '') +
      dong('Kiểm tra lần cuối', t.kiemTraCuoi ? esc(luc(t.kiemTraCuoi)) + ' <span class="mo">(' + esc(tuongDoi(t.kiemTraCuoi)) + ')</span>' : 'Chưa kiểm tra') +
      '</div></div>' +
      (tsHtml ? '<div class="the"><h3>Thông số kỹ thuật</h3><div class="bang-tt">' + tsHtml + '</div></div>' : '') +
      '<div class="the"><h3>Giá trị &amp; bảo dưỡng</h3><div class="bang-tt">' +
      dong('Ngày đưa vào sử dụng', esc(ngay(t.ngaySuDung))) + dong('Nguyên giá', esc(tien(t.nguyenGia))) +
      dong('Thời gian khấu hao', t.soNamKhauHaoApDung ? t.soNamKhauHaoApDung + ' năm' + (t.soNamKhauHao == null ? ' <span class="mo nho">(theo loại)</span>' : '') : '') +
      dong('Khấu hao luỹ kế', t.khauHaoLuyKe != null ? esc(tien(t.khauHaoLuyKe)) + ' <span class="mo nho">(tạm tính)</span>' : '') +
      dong('Giá trị còn lại', t.giaTriConLai != null ? '<b>' + esc(tien(t.giaTriConLai)) + '</b> <span class="mo nho">(tạm tính)</span>' : '') +
      dong('Bảo hành đến', t.baoHanhDen ? esc(ngay(t.baoHanhDen)) + (soNgayTu(t.baoHanhDen) < 0 ? ' <span class="mo">(hết bảo hành)</span>' : ' <span class="xanh" style="color:var(--xanh)">(còn bảo hành)</span>') : '') +
      dong('Chu kỳ bảo dưỡng', t.chuKyBaoTriApDung ? t.chuKyBaoTriApDung + ' ngày' + (t.chuKyBaoTri == null ? ' <span class="mo nho">(theo loại)</span>' : '') : '') +
      dong('Bảo dưỡng lần cuối', esc(ngay(t.baoTriCuoi))) +
      dong('Hạn bảo dưỡng', t.hanBaoTri ? '<span class="' + (han < 0 ? 'qua-han' : han <= 7 ? 'sap-han' : '') + '">' + esc(ngay(t.hanBaoTri)) +
        (han < 0 ? ' — quá hạn ' + (-han) + ' ngày' : han <= 7 ? ' — còn ' + han + ' ngày' : '') + '</span>' : '') +
      '</div></div>' +
      (t.ghiChu ? '<div class="the"><h3>Ghi chú</h3><div style="white-space:pre-line">' + esc(t.ghiChu) + '</div></div>' : '') +
      '<div class="the"><h3>Tem QR</h3><div class="qr-nho"><div class="qr">' + MaQR.svg(diaChiQr(t.ma), 'M', 2) + '</div><div class="mo nho" style="word-break:break-all">' +
      esc(diaChiQr(t.ma)) + '<div style="margin-top:8px"><button class="nut nho" type="button" data-intem>' + BT.in + 'In tem</button></div></div></div></div>' +
      '</div><div><div class="the"><h3>Lịch sử</h3>' + veLichSu(t) + '</div>' +
      '<p class="mo nho">Khai báo ' + esc(luc(t.tao)) + ' (' + esc(t.nguoiTao) + ') · sửa lần cuối ' + esc(luc(t.sua)) + ' (' + esc(t.nguoiSua) + ')</p></div></div>';
    nd.innerHTML = h;
    napAnh(nd);

    function taiLai() { api('GET', 'taisan/' + t.id).then(function (t2) { if (con(lan)) veTaiSan(nd, t2, lan); }); }
    nd.onclick = function (e) {
      if (!con(lan)) return;
      var x = e.target.closest('[data-xem],[data-hd],[data-chupanh],[data-themanh],[data-intem],[data-xoa],[data-kk],[data-anhsk],[data-bbdc]');
      if (!x) return;
      if (x.hasAttribute('data-xem')) xemAnh(t, anh, +x.getAttribute('data-xem'), sua, taiLai);
      else if (x.hasAttribute('data-anhsk')) { var p = x.getAttribute('data-anhsk').split('|'); xemAnh(t, p[1].split(','), +p[0], false, taiLai); }
      else if (x.getAttribute('data-hd') === 'dieuchuyen') moDieuChuyen([t], taiLai);
      else if (x.hasAttribute('data-hd')) moSuKien(t, x.getAttribute('data-hd'), taiLai);
      else if (x.hasAttribute('data-bbdc')) xuatExcel(x, 'POST', 'xuat/dieuchuyen', { so: x.getAttribute('data-bbdc') });
      else if (x.hasAttribute('data-chupanh') || x.hasAttribute('data-themanh')) {
        chonFile('image/*', true, x.hasAttribute('data-chupanh')).then(function (f) {
          if (!f.length) return;
          thongBao('Đang gửi ' + f.length + ' ảnh…');
          guiNhieuAnh(t.id, f, true).then(function () { thongBao('Đã thêm ' + f.length + ' ảnh'); taiLai(); }, function (e2) { thongBao(e2.message, true); });
        });
      }
      else if (x.hasAttribute('data-intem')) { st.temLe = [{ id: t.id, ma: t.ma, ten: t.ten, tenDonVi: t.tenDonVi, tenLoai: t.tenLoai }]; di('/nhan?le=1'); }
      else if (x.hasAttribute('data-kk')) moKiemKeNhanh(t, t.kiemKeNam.daKiem ? t.kiemKeNam : null, taiLai);
      else if (x.hasAttribute('data-xoa')) {
        hoi('Xoá tài sản', 'Xoá hẳn ' + t.ma + ' "' + t.ten + '" khỏi danh sách? Tài sản không còn dùng nên ghi "Thanh lý" thay vì xoá. Ảnh và lịch sử vẫn giữ trên máy chủ.', 'Xoá', true).then(function (ok) {
          if (!ok) return;
          api('DELETE', 'taisan?id=' + t.id).then(function () { delete st.chon[t.id]; luuChon(); thongBao('Đã xoá ' + t.ma); di('/ds'); }, function (e2) { thongBao(e2.message, true); });
        });
      }
    };
  }

  function veLichSu(t) {
    var ls = t.lichSu || [];
    if (!ls.length) return '<div class="trong">Chưa có.</div>';
    return '<ul class="dong-thoi-gian">' + ls.map(function (s) {
      var tt = s.tinhTrang && (s.loai === 'kiemtra' || s.loai === 'kiemke' || s.loai === 'baotri' || s.loai === 'thanhly') ? ' ' + ttHtml(s.tinhTrang, true) : '';
      return '<li><span class="bt">' + (BT['sk_' + s.loai] || BT.sk_sua) + '</span><div><b>' + esc(s.tenLoai) + '</b>' + tt + '</div>' +
        '<div class="tg">' + esc(luc(s.luc)) + ' · ' + esc(s.hoTen || s.nguoi) + (s.chiPhi != null ? ' · chi phí ' + esc(tien(s.chiPhi)) : '') +
        (s.viDo != null ? ' · <a href="' + linkBanDo(s.viDo, s.kinhDo) + '" target="_blank" rel="noopener">vị trí</a>' : '') + '</div>' +
        (s.noiDung ? '<div class="nd">' + esc(s.noiDung) + '</div>' : '') + (s.chiTiet ? '<div class="ct">' + esc(s.chiTiet) + '</div>' : '') +
        (s.phieu ? '<div class="ct">Phiếu <a href="#/dieuchuyen?so=' + encodeURIComponent(s.phieu) + '">' + esc(s.phieu) + '</a> · <button class="nut-chu" type="button" data-bbdc="' + esc(s.phieu) + '">Biên bản giao nhận</button></div>' : '') +
        (s.anh && s.anh.length ? '<div class="anh-sk">' + s.anh.map(function (a, i) {
          return '<button type="button" data-anhsk="' + i + '|' + esc(s.anh.join(',')) + '">' + imgAnh(t.id, a, true) + '</button>';
        }).join('') + '</div>' : '') + '</li>';
    }).join('') + '</ul>';
  }

  function xemAnh(t, ds, i, duocSua, taiLai) {
    var el = document.createElement('div');
    el.className = 'xem-anh';
    el.innerHTML = '<div class="tren"><span class="gian"></span>' +
      (duocSua ? '<button type="button" data-chinh>' + 'Đặt làm ảnh chính</button><button type="button" data-bo>Bỏ khỏi bộ ảnh</button>' : '') +
      '<button type="button" data-tai>Tải về</button><button type="button" data-dong aria-label="Đóng">✕</button></div>' +
      '<div class="giua"><img alt=""><button class="mui trai" type="button" aria-label="Ảnh trước">‹</button><button class="mui phai" type="button" aria-label="Ảnh sau">›</button></div>';
    document.body.appendChild(el);
    var img = el.querySelector('img'), dem = el.querySelector('.gian');
    function hien() {
      dem.textContent = (i + 1) + ' / ' + ds.length + ' · ' + t.ma;
      img.removeAttribute('src');
      taiAnh(t.id, ds[i], true).then(function (u) { if (!img.src) img.src = u; });
      taiAnh(t.id, ds[i], false).then(function (u) { img.src = u; });
      el.querySelector('.trai').style.display = el.querySelector('.phai').style.display = ds.length > 1 ? '' : 'none';
    }
    function dong() { el.remove(); document.removeEventListener('keydown', phim); }
    function phim(e) {
      if (e.key === 'Escape') dong();
      if (e.key === 'ArrowLeft') { i = (i - 1 + ds.length) % ds.length; hien(); }
      if (e.key === 'ArrowRight') { i = (i + 1) % ds.length; hien(); }
    }
    document.addEventListener('keydown', phim);
    el.querySelector('[data-dong]').onclick = dong;
    el.querySelector('.trai').onclick = function () { i = (i - 1 + ds.length) % ds.length; hien(); };
    el.querySelector('.phai').onclick = function () { i = (i + 1) % ds.length; hien(); };
    el.querySelector('[data-tai]').onclick = function () {
      taiAnh(t.id, ds[i], false).then(function (u) { var a = document.createElement('a'); a.href = u; a.download = t.ma + '-' + ds[i] + '.jpg'; document.body.appendChild(a); a.click(); a.remove(); });
    };
    var x0 = null;
    el.querySelector('.giua').addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    el.querySelector('.giua').addEventListener('touchend', function (e) {
      if (x0 == null || ds.length < 2) return;
      var dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 50) { i = (i + (dx < 0 ? 1 : -1) + ds.length) % ds.length; hien(); }
    });
    if (duocSua) {
      el.querySelector('[data-chinh]').onclick = function () {
        api('POST', 'taisan/' + t.id + '/anhchinh', { anh: ds[i] }).then(function () { thongBao('Đã đặt làm ảnh chính'); dong(); taiLai(); }, function (e) { thongBao(e.message, true); });
      };
      el.querySelector('[data-bo]').onclick = function () {
        hoi('Bỏ ảnh', 'Bỏ ảnh này khỏi bộ ảnh của tài sản?', 'Bỏ ảnh', true).then(function (ok) {
          if (!ok) return;
          api('DELETE', 'taisan/' + t.id + '/anh?anh=' + encodeURIComponent(ds[i])).then(function () { thongBao('Đã bỏ ảnh'); dong(); taiLai(); }, function (e) { thongBao(e.message, true); });
        });
      };
    }
    hien();
  }

  // ------------------------------------------------------------------ ghi kiểm tra, bảo dưỡng, điều chuyển, thanh lý
  function chipTinhTrang(chon, boQua) {
    return '<div class="chip-tt">' + MA_TT.filter(function (m) { return (boQua || []).indexOf(m) < 0; }).map(function (m) {
      return '<button type="button" data-tt="' + m + '"' + (m === chon ? ' class="chon"' : '') + '>' + BT_TT[m] + esc(TEN_TT[m]) + '</button>';
    }).join('') + '</div>';
  }
  function ganChip(goc, khiChon) {
    var c = goc.querySelector('.chip-tt');
    c.onclick = function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      Array.prototype.forEach.call(c.children, function (x) { x.classList.toggle('chon', x === b); });
      khiChon(b.getAttribute('data-tt'));
    };
  }

  /** Điều chuyển 1 hoặc nhiều tài sản sang đội cấp nước / phòng ban khác (chung 1 phiếu, có biên bản giao nhận). xong(phiếu) khi đã chuyển. */
  function moDieuChuyen(ds, xong) {
    var mot = ds.length === 1 ? ds[0] : null;
    var tu = [];
    ds.forEach(function (t) { if (tu.indexOf(t.tenDonVi) < 0) tu.push(t.tenDonVi); });
    var k = hop(mot ? 'Điều chuyển tài sản' : 'Điều chuyển ' + ds.length + ' tài sản',
      (mot ? '<p class="mo nho" style="margin:0"><b class="ma">' + esc(mot.ma) + '</b> · ' + esc(mot.ten) + '</p>' :
        '<div class="dc-ds">' + ds.map(function (t) { return '<div class="tieu"><b class="ma">' + esc(t.ma) + '</b> · ' + esc(t.ten) + '</div>'; }).join('') + '</div>') +
      '<div class="dc-tu"><span class="mo">Từ:</span> <b>' + esc(tu.join(', ')) + '</b></div>' +
      '<label class="nhan">Chuyển đến (đội / phòng ban nhận) <b>*</b></label><select data-dv>' + optDonVi('', '— Chọn đơn vị nhận —') + '</select>' +
      '<label class="nhan">Vị trí mới</label><input data-vt value="' + (mot ? esc(mot.viTri || '') : '') + '"' + (mot ? '' : ' placeholder="Để trống: giữ vị trí cũ của từng tài sản"') + '>' +
      '<label class="nhan">Người sử dụng / phụ trách mới</label><input data-ng value="' + (mot ? esc(mot.nguoiSuDung || '') : '') + '"' + (mot ? '' : ' placeholder="Để trống: giữ như cũ"') + '>' +
      '<label class="nhan">Số quyết định / lý do</label><textarea data-nd placeholder="Vd: QĐ số 45/QĐ-CN ngày 20/10/2026; điều động máy bơm dự phòng cho Đội 2"></textarea>' +
      (mot ? '<label class="nhan">Ảnh (không bắt buộc: tài sản ở chỗ mới, biên bản đã ký…)</label><div data-anh></div>' : '') +
      '<div class="chan"><button class="nut" type="button" data-huy>Huỷ</button><button class="nut chinh" type="button" data-luu>' + BT.dieuchuyen + 'Điều chuyển</button></div>');
    var layAnh = mot ? oChonAnh(k.querySelector('[data-anh]')) : function () { return []; };
    k.querySelector('[data-huy]').onclick = function () { k.dong(); };
    k.querySelector('[data-luu]').onclick = function () {
      var dv = +k.querySelector('[data-dv]').value;
      if (!dv) { thongBao('Chọn đội / phòng ban nhận', true); return; }
      var nut = this, vt = k.querySelector('[data-vt]').value, ng = k.querySelector('[data-ng]').value;
      var than = { taiSan: ds.map(function (t) { return t.id; }), donVi: dv, noiDung: k.querySelector('[data-nd]').value };
      if (mot || vt.trim()) than.viTri = vt;   // nhiều tài sản: để trống = giữ vị trí, người sử dụng cũ
      if (mot || ng.trim()) than.nguoiSuDung = ng;
      nut.disabled = true;
      guiNhieuAnh(mot ? mot.id : 0, layAnh(), false, function (i, n) { nut.textContent = 'Đang gửi ảnh ' + i + '/' + n + '…'; }).then(function (anh) {
        than.anh = anh;
        nut.textContent = 'Đang lưu…';
        return api('POST', 'dieuchuyen', than);
      }).then(function (p) {
        k.dong();
        moKetQuaDieuChuyen(p);
        if (xong) xong(p);
      }, function (e) { nut.disabled = false; nut.innerHTML = BT.dieuchuyen + 'Điều chuyển'; thongBao(e.message, true); });
    };
  }

  function moKetQuaDieuChuyen(p) {
    var k = hop('Đã điều chuyển', '<div class="dc-xong">' + BT_TT.tot + '<div><b>' + p.soTaiSan + ' tài sản → ' + esc(p.tenDenDonVi) + '</b>' +
      '<div class="mo nho">Phiếu <b>' + esc(p.so) + '</b> · từ ' + esc(p.tenTuDonVi) + '</div></div></div>' +
      '<p class="mo nho">In biên bản giao nhận để bên giao, bên nhận ký. Lấy lại được bất cứ lúc nào ở trang Điều chuyển hoặc lịch sử tài sản.</p>' +
      '<div class="chan"><a class="nut" href="#/dieuchuyen?so=' + encodeURIComponent(p.so) + '">Xem phiếu</a><button class="nut chinh" type="button" data-bb>' + BT.excel + 'Biên bản giao nhận</button></div>');
    k.querySelector('[data-bb]').onclick = function () { xuatExcel(this, 'POST', 'xuat/dieuchuyen', { so: p.so }); };
  }

  function moSuKien(t, loai, taiLai) {
    var tieuDe = { kiemtra: 'Ghi kết quả kiểm tra', baotri: 'Ghi bảo dưỡng / sửa chữa', thanhly: 'Thanh lý tài sản' }[loai];
    var tt = loai === 'baotri' ? 'tot' : t.tinhTrang, h = '<p class="mo nho" style="margin:0"><b class="ma">' + esc(t.ma) + '</b> · ' + esc(t.ten) + '</p>';
    if (loai === 'kiemtra') {
      h += '<label class="nhan">Tình trạng</label>' + chipTinhTrang(tt, ['thanhly']) +
        '<label class="nhan">Ghi chú kiểm tra</label><textarea data-nd placeholder="Vd: chạy êm, không rò rỉ; áp lực 2,5 bar…"></textarea>' +
        '<label class="nhan">Ảnh</label><div data-anh></div><label class="chon-o"><input type="checkbox" data-boanh> Đưa ảnh vào bộ ảnh của tài sản</label>' +
        '<label class="chon-o"><input type="checkbox" data-gps> Ghi vị trí GPS hiện tại</label>' +
        (t.duocSua || t.viDo == null ? '<label class="chon-o an" data-capnhat><input type="checkbox" data-capnhattd' + (t.viDo == null ? ' checked' : '') + '> Cập nhật toạ độ của tài sản theo vị trí này</label>' : '');
    } else if (loai === 'baotri') {
      h += '<div class="hang"><div class="gian"><label class="nhan">Ngày thực hiện</label><input type="date" data-ngay value="' + homNay() + '" max="' + homNay() + '"></div>' +
        '<div class="gian"><label class="nhan">Chi phí (đồng)</label><input data-cp inputmode="numeric" placeholder="Không bắt buộc"></div></div>' +
        '<label class="nhan">Nội dung <b>*</b></label><textarea data-nd placeholder="Vd: thay bạc đạn, vệ sinh cánh bơm, thay dầu; đơn vị thực hiện…"></textarea>' +
        '<label class="nhan">Tình trạng sau khi làm</label>' + chipTinhTrang(tt, ['thanhly', 'mat']) +
        '<label class="nhan">Ảnh</label><div data-anh></div><label class="chon-o"><input type="checkbox" data-boanh> Đưa ảnh vào bộ ảnh của tài sản</label>';
    } else {
      h += '<div class="bao">Tài sản chuyển sang "Đã thanh lý": không còn tính bảo dưỡng, không vào sổ kiểm kê các năm sau. Thông tin và lịch sử vẫn giữ.</div>' +
        '<label class="nhan">Số quyết định / biên bản thanh lý <b>*</b></label><textarea data-nd placeholder="Vd: QĐ số 123/QĐ-CN ngày 10/10/2026, bán phế liệu"></textarea>' +
        '<label class="nhan">Giá trị thu hồi (đồng)</label><input data-cp inputmode="numeric" placeholder="Không bắt buộc">';
    }
    h += '<div class="chan"><button class="nut" type="button" data-huy>Huỷ</button><button class="nut chinh" type="button" data-luu>Lưu</button></div>';
    var k = hop(tieuDe, h);
    var layAnh = k.querySelector('[data-anh]') ? oChonAnh(k.querySelector('[data-anh]')) : function () { return []; };
    if (k.querySelector('.chip-tt')) ganChip(k, function (v) { tt = v; });
    var gps = k.querySelector('[data-gps]');
    if (gps) gps.onchange = function () { var c = k.querySelector('[data-capnhat]'); if (c) c.classList.toggle('an', !gps.checked); };
    k.querySelector('[data-huy]').onclick = function () { k.dong(); };
    k.querySelector('[data-luu]').onclick = function () {
      var nut = this;
      var than = { loai: loai, noiDung: (k.querySelector('[data-nd]') || {}).value || '' };
      if (loai === 'kiemtra' || loai === 'baotri') than.tinhTrang = tt;
      if (loai === 'baotri') than.ngay = k.querySelector('[data-ngay]').value;
      var cpEl = k.querySelector('[data-cp]');
      if (cpEl && cpEl.value.trim()) {
        var cp = docSo(cpEl.value);
        if (isNaN(cp)) { thongBao('Số tiền không hợp lệ', true); return; }
        than.chiPhi = cp;
      }
      if ((loai === 'baotri' || loai === 'thanhly') && !than.noiDung.trim()) { thongBao('Ghi nội dung trước khi lưu', true); return; }
      nut.disabled = true;
      var buoc = gps && gps.checked ? (nut.textContent = 'Đang lấy vị trí…', layViTri()) : Promise.resolve(null);
      buoc.then(function (vt) {
        if (vt) { than.viDo = vt.viDo; than.kinhDo = vt.kinhDo; var c = k.querySelector('[data-capnhattd]'); than.capNhatToaDo = !!(c && c.checked); }
        var bo = k.querySelector('[data-boanh]');
        return guiNhieuAnh(t.id, layAnh(), !!(bo && bo.checked), function (i, n) { nut.textContent = 'Đang gửi ảnh ' + i + '/' + n + '…'; });
      }).then(function (ids) {
        than.anh = ids;
        nut.textContent = 'Đang lưu…';
        return api('POST', 'taisan/' + t.id + '/sukien', than);
      }).then(function () {
        k.dong();
        thongBao('Đã lưu');
        taiLai();
      }, function (e) { nut.disabled = false; nut.textContent = 'Lưu'; thongBao(e.message, true); });
    };
  }

  /** Ghi / cập nhật kết quả kiểm kê năm nay của 1 tài sản: tình trạng thực tế, ghi chú, ảnh. kq: lần đã ghi (nếu có). */
  function moKiemKeNhanh(t, kq, xong) {
    var tt = (kq && kq.tinhTrang) || t.tinhTrang;
    var nam = (kq && kq.nam) || (t.kiemKeNam && t.kiemKeNam.nam) || new Date().getFullYear();
    var tenNut = kq ? 'Lưu' : 'Xác nhận';
    var k = hop((kq ? 'Ghi tình trạng kiểm kê năm ' : 'Xác nhận kiểm kê năm ') + nam, '<div class="to-quet"><div class="tom">' + oAnhNho(t) +
      '<div style="min-width:0"><div><b class="ma">' + esc(t.ma) + '</b></div><div>' + esc(t.ten) + '</div><div class="mo nho">' + esc(t.tenDonVi) + (t.viTri ? ' · ' + esc(t.viTri) : '') + '</div></div></div>' +
      (kq ? '<div class="tin">Đã kiểm kê lúc ' + esc(luc(kq.luc)) + ' (' + esc(kq.nguoi || '') + '). Lưu sẽ ghi lại kết quả kiểm kê với tình trạng, ghi chú mới.</div>' : '') +
      '<label class="nhan">Tình trạng thực tế</label>' + chipTinhTrang(tt, ['thanhly']) +
      '<label class="nhan">Ghi chú</label><textarea data-gc placeholder="Vd: đúng vị trí, tem mờ cần dán lại…">' + esc((kq && kq.ghiChu) || '') + '</textarea>' +
      '<label class="nhan">Ảnh (không bắt buộc)</label><div data-anh></div>' +
      '<div class="chan"><button class="nut" type="button" data-huy>Huỷ</button><button class="nut chinh" type="button" data-luu>' + tenNut + '</button></div></div>');
    napAnh(k);
    var layAnh = oChonAnh(k.querySelector('[data-anh]'));
    ganChip(k, function (v) { tt = v; });
    k.querySelector('[data-huy]').onclick = function () { k.dong(); };
    k.querySelector('[data-luu]').onclick = function () {
      var nut = this;
      nut.disabled = true;
      guiNhieuAnh(t.id, layAnh(), false, function (i, n) { nut.textContent = 'Đang gửi ảnh ' + i + '/' + n + '…'; }).then(function (anh) {
        nut.textContent = 'Đang lưu…';
        return api('POST', 'taisan/' + t.id + '/kiemke', { lai: true, tinhTrang: tt, ghiChu: k.querySelector('[data-gc]').value, anh: anh });
      }).then(function (x) {
        k.dong();
        thongBao('Đã ghi kiểm kê ' + t.ma + (x.ngoaiSo ? ' (ngoài sổ)' : '') + ' — ' + fNguyen.format(x.dot.daKiem) + '/' + fNguyen.format(x.dot.tong));
        xong(x);
      }, function (e) { nut.disabled = false; nut.textContent = tenNut; thongBao(e.message, true); });
    };
  }

  // ------------------------------------------------------------------ thêm / sửa tài sản
  function trangSua(nd, r, lan) {
    if (!quyen(2)) { nd.innerHTML = '<div class="loi">Tài khoản này không được thêm / sửa tài sản.</div>'; return; }
    var moi = r.p[0] === 'moi';
    if (moi) { veSua(nd, null, r.q, lan); return; }
    dangTai(nd);
    api('GET', 'taisan/' + (+r.p[1])).then(function (t) { if (con(lan)) veSua(nd, t, r.q, lan); }, function (e) { if (con(lan)) veLoi(nd, e); });
  }

  function veSua(nd, t, q, lan) {
    var moi = !t;
    var gioiHan = st.nguoi.donVi >= 0 && st.nguoi.capQuyen < 3;
    t = t || { id: 0, ma: (q.ma || '').toUpperCase(), ten: '', loai: +q.loai || 0, donVi: gioiHan ? st.nguoi.donVi : (+q.donvi || 0), tinhTrang: 'tot', thongSo: [] };
    var o = function (ten, k, v, them) {
      return '<div class="' + ((them || {}).full ? 'full' : '') + '"><label class="nhan" for="f-' + k + '">' + ten + '</label><input id="f-' + k + '" data-f="' + k + '" value="' + esc(v == null ? '' : v) + '"' + ((them || {}).attr || '') + '></div>';
    };
    nd.innerHTML = '<div class="tieude-trang"><a class="nut-icon" href="' + (moi ? '#/ds' : '#/ts/' + t.id) + '" aria-label="Quay lại">' + BT.quaylai + '</a><h2>' + (moi ? 'Thêm tài sản' : 'Sửa ' + esc(t.ma)) + '</h2></div>' +
      '<form class="ts-sua" autocomplete="off"><div class="the"><h3>Thông tin chính</h3><div class="nhom-o">' +
      '<div><label class="nhan" for="f-loai">Loại tài sản <b>*</b></label><select id="f-loai" data-f="loai" required>' + optLoai(t.loai, '— Chọn loại —') + '</select></div>' +
      '<div><label class="nhan" for="f-ma">Mã tài sản</label><input id="f-ma" data-f="ma" class="ma" value="' + esc(t.ma) + '" autocapitalize="characters" placeholder="Để trống: tự cấp"><div class="goiy" data-goiyma></div></div>' +
      '<div class="full"><label class="nhan" for="f-ten">Tên tài sản <b>*</b></label><input id="f-ten" data-f="ten" value="' + esc(t.ten) + '" required placeholder="Vd: Máy bơm trục ngang số 2 — trạm bơm cấp 2 NMN Vị Thanh"></div>' +
      '<div><label class="nhan" for="f-donVi">Đơn vị quản lý <b>*</b></label><select id="f-donVi" data-f="donVi"' + (gioiHan ? ' disabled' : '') + '>' + optDonVi(t.donVi, '— Chọn đơn vị —') + '</select></div>' +
      '<div><label class="nhan" for="f-tt">Tình trạng</label><select id="f-tt" data-f="tinhTrang">' + optTT(t.tinhTrang) + '</select></div>' +
      o('Vị trí đặt / lắp đặt', 'viTri', t.viTri, { full: true, attr: ' placeholder="Vd: NMN Vị Thanh — nhà bơm cấp 2"' }) +
      o('Người sử dụng / phụ trách', 'nguoiSuDung', t.nguoiSuDung) +
      '<div><label class="nhan">Toạ độ (vĩ độ, kinh độ)</label><div class="hang"><input data-f="toaDo" class="gian" style="width:auto" value="' + (t.viDo != null ? t.viDo + ', ' + t.kinhDo : '') +
      '" placeholder="9.7845, 105.4701"><button class="nut nho" type="button" data-gps>' + BT.ghim + 'Vị trí hiện tại</button></div></div>' +
      '</div></div>' +
      '<div class="the"><h3>Thông số kỹ thuật</h3><div class="nhom-o">' + o('Hãng sản xuất', 'hangSX', t.hangSX) + o('Model / quy cách', 'model', t.model) +
      o('Số seri', 'soSeri', t.soSeri) + o('Nước sản xuất', 'nuocSX', t.nuocSX) + o('Năm sản xuất', 'namSX', t.namSX, { attr: ' inputmode="numeric"' }) + '</div>' +
      '<div data-thongso></div><button class="nut nho" type="button" data-themts style="margin-top:8px">' + BT.them + 'Thêm thông số khác</button></div>' +
      '<div class="the"><h3>Giá trị &amp; bảo dưỡng</h3><div class="nhom-o">' +
      o('Ngày đưa vào sử dụng', 'ngaySuDung', t.ngaySuDung, { attr: ' type="date"' }) + o('Nguyên giá (đồng)', 'nguyenGia', t.nguyenGia != null ? fNguyen.format(t.nguyenGia) : '', { attr: ' inputmode="numeric"' }) +
      o('Số năm khấu hao', 'soNamKhauHao', t.soNamKhauHao, { attr: ' inputmode="numeric" data-goiy="soNamKhauHao"' }) + o('Bảo hành đến', 'baoHanhDen', t.baoHanhDen, { attr: ' type="date"' }) +
      o('Chu kỳ bảo dưỡng (ngày)', 'chuKyBaoTri', t.chuKyBaoTri, { attr: ' inputmode="numeric" data-goiy="chuKyBaoTri"' }) + o('Bảo dưỡng lần cuối', 'baoTriCuoi', t.baoTriCuoi, { attr: ' type="date"' }) +
      '</div><div class="goiy">Để trống số năm khấu hao / chu kỳ bảo dưỡng: dùng số của loại tài sản.</div></div>' +
      '<div class="the"><h3>Ghi chú</h3><textarea data-f="ghiChu">' + esc(t.ghiChu || '') + '</textarea>' +
      (moi ? '<label class="nhan">Ảnh tài sản</label><div data-anh></div>' : '') + '</div>' +
      '<div class="chan-sua"><a class="nut" href="' + (moi ? '#/ds' : '#/ts/' + t.id) + '">Huỷ</a><button class="nut chinh" type="submit">' + (moi ? 'Lưu tài sản' : 'Lưu thay đổi') + '</button></div></form>';
    var f = nd.querySelector('form');
    var layAnh = moi ? oChonAnh(nd.querySelector('[data-anh]')) : null;
    var tsEl = nd.querySelector('[data-thongso]');
    var thongSo = (t.thongSo || []).map(function (x) { return { ten: x.ten, gt: x.gt }; });
    function F(k) { return f.querySelector('[data-f="' + k + '"]'); }
    function docThongSo() {
      thongSo = Array.prototype.map.call(tsEl.querySelectorAll('.thong-so-dong'), function (d) {
        return { ten: d.querySelector('[data-ten]').value.trim(), gt: d.querySelector('[data-gt]').value.trim() };
      });
    }
    function veThongSo() {
      var l = layLoai(+F('loai').value);
      var truong = l ? l.truong : [];
      truong.forEach(function (ten) { if (!thongSo.some(function (x) { return x.ten.toLowerCase() === ten.toLowerCase(); })) thongSo.push({ ten: ten, gt: '' }); });
      tsEl.innerHTML = thongSo.length ? thongSo.map(function (x, i) {
        var coDinh = truong.indexOf(x.ten) >= 0;
        return '<div class="thong-so-dong"><input data-ten value="' + esc(x.ten) + '" placeholder="Tên thông số"' + (coDinh ? ' readonly' : '') + '>' +
          '<input data-gt value="' + esc(x.gt) + '" placeholder="Giá trị"><button class="nut-icon" type="button" data-bo="' + i + '" aria-label="Bỏ"' + (coDinh ? ' style="visibility:hidden"' : '') + '>' + BT.dong + '</button></div>';
      }).join('') : '';
      Array.prototype.forEach.call(f.querySelectorAll('[data-goiy]'), function (i) { i.placeholder = l ? 'Theo loại: ' + (l[i.getAttribute('data-goiy')] || 0) : ''; });
    }
    function goiYMa() {
      var g = nd.querySelector('[data-goiyma]');
      var l = +F('loai').value;
      if (!moi || F('ma').value.trim() || !l) { g.textContent = moi ? 'Chỉ chữ không dấu, số, dấu - . _' : ''; return; }
      api('GET', 'makhaitiep?loai=' + l).then(function (d) { if (!F('ma').value.trim()) g.textContent = 'Sẽ cấp mã ' + d.ma; });
    }
    tsEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-bo]');
      if (!b) return;
      docThongSo();
      thongSo.splice(+b.getAttribute('data-bo'), 1);
      veThongSo();
    });
    nd.querySelector('[data-themts]').onclick = function () { docThongSo(); thongSo.push({ ten: '', gt: '' }); veThongSo(); tsEl.querySelector('.thong-so-dong:last-child [data-ten]').focus(); };
    F('loai').onchange = function () { docThongSo(); thongSo = thongSo.filter(function (x) { return x.gt; }); veThongSo(); goiYMa(); };
    F('ma').oninput = goiYMa;
    nd.querySelector('[data-gps]').onclick = function () {
      var b = this;
      b.disabled = true;
      layViTri().then(function (v) { F('toaDo').value = v.viDo + ', ' + v.kinhDo; thongBao('Đã lấy vị trí (sai số khoảng ' + v.saiSo + ' m)'); }, function (e) { thongBao(e.message, true); })
        .then(function () { b.disabled = false; });
    };
    veThongSo();
    goiYMa();
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      docThongSo();
      var gia = F('nguyenGia').value.trim() ? docSo(F('nguyenGia').value) : null;
      if (gia != null && isNaN(gia)) { thongBao('Nguyên giá không hợp lệ', true); F('nguyenGia').focus(); return; }
      var td = F('toaDo').value.trim(), vd = null, kd = null;
      if (td) {
        var p = td.split(/[,;\s]+/).filter(Boolean).map(Number);
        if (p.length !== 2 || isNaN(p[0]) || isNaN(p[1])) { thongBao('Toạ độ ghi dạng "vĩ độ, kinh độ", vd 9.7845, 105.4701', true); return; }
        vd = p[0]; kd = p[1];
      }
      function soN(k) { var v = F(k).value.trim(); if (!v) return null; var n = docSo(v); return isNaN(n) ? NaN : n; }
      var than = {
        id: t.id, phienBan: t.phienBan || 0, ma: F('ma').value.trim(), ten: F('ten').value.trim(), loai: +F('loai').value, donVi: +F('donVi').value,
        tinhTrang: F('tinhTrang').value, viTri: F('viTri').value, nguoiSuDung: F('nguoiSuDung').value, hangSX: F('hangSX').value, model: F('model').value,
        soSeri: F('soSeri').value, nuocSX: F('nuocSX').value, namSX: soN('namSX'), ngaySuDung: F('ngaySuDung').value, nguyenGia: gia,
        soNamKhauHao: soN('soNamKhauHao'), baoHanhDen: F('baoHanhDen').value, chuKyBaoTri: soN('chuKyBaoTri'), baoTriCuoi: F('baoTriCuoi').value,
        viDo: vd, kinhDo: kd, ghiChu: F('ghiChu').value, thongSo: thongSo.filter(function (x) { return x.ten && x.gt; })
      };
      if ([than.namSX, than.soNamKhauHao, than.chuKyBaoTri].some(function (x) { return x !== null && isNaN(x); })) { thongBao('Năm / số năm / chu kỳ phải là số', true); return; }
      var nut = f.querySelector('[type=submit]');
      nut.disabled = true;
      nut.textContent = 'Đang lưu…';
      api('POST', 'taisan', than).then(function (kq) {
        var files = layAnh ? layAnh() : [];
        var buoc = files.length ? guiNhieuAnh(kq.id, files, true, function (i, n) { nut.textContent = 'Đang gửi ảnh ' + i + '/' + n + '…'; }) : Promise.resolve();
        return buoc.then(function () { return kq; }, function (e2) { thongBao('Đã lưu tài sản, nhưng gửi ảnh lỗi: ' + e2.message, true); return kq; });
      }).then(function (kq) {
        thongBao(moi ? 'Đã thêm ' + kq.ma : 'Đã lưu ' + kq.ma);
        taiDanhMuc();
        if (moi) thayDuong('/ts/' + kq.id); else thayDuong('/ts/' + kq.id);
        ve();
      }, function (e2) { nut.disabled = false; nut.textContent = moi ? 'Lưu tài sản' : 'Lưu thay đổi'; thongBao(e2.message, true); });
    });
  }

  // ------------------------------------------------------------------ kiểm kê
  function theDot(k) {
    var pc = k.tong ? Math.round(k.daKiem * 100 / k.tong) : 0;
    return '<a class="the" href="#/kiemke/' + k.id + '" style="display:block;text-decoration:none;color:inherit"><div class="hang"><b class="gian">' + esc(k.ten) + '</b>' +
      (k.dong ? '<span class="tt tt-ngung">Đã kết thúc</span>' : '<span class="tt tt-tot">' + BT_TT.tot + 'Đang kiểm kê</span>') + '</div>' +
      '<div class="mo nho">' + (k.tenDonVi !== 'Toàn công ty' ? esc(k.tenDonVi) + ' · ' : '') + 'từ ' + esc(ngay(k.tuNgay)) + (k.denNgay ? ' đến ' + esc(ngay(k.denNgay)) : '') + '</div>' +
      '<div class="tien-do"><i style="width:' + pc + '%"></i></div><div class="mo nho">Đã kiểm kê ' + fNguyen.format(k.daKiem) + ' / ' + fNguyen.format(k.tong) + ' (' + pc + '%)' +
      (k.ngoaiSo ? ' · ngoài sổ ' + k.ngoaiSo : '') + '</div></a>';
  }

  /** Kiểm kê: mỗi năm 1 đợt toàn công ty. Đã có đợt năm nay thì mở thẳng trang tiến độ của năm nay. */
  function trangKiemKe(nd, r, lan) {
    if (r.p[1]) { trangDot(nd, +r.p[1], r.q, lan); return; }
    dangTai(nd);
    api('GET', 'kiemke').then(function (d) {
      if (!con(lan)) return;
      if (d.dotNamNay) { thayDuong('/kiemke/' + d.dotNamNay); trangDot(nd, d.dotNamNay, {}, lan); return; }
      var cu = d.ds.filter(function (k) { return k.nam !== d.namNay; });
      nd.innerHTML = '<div class="tieude-trang"><h2>Kiểm kê tài sản</h2></div>' +
        '<div class="the"><h3>Kiểm kê năm ' + d.namNay + ': chưa bắt đầu</h3>' +
        '<ol style="margin:0 0 10px;padding-left:20px;line-height:1.8"><li>Mỗi năm kiểm kê 1 lần cho toàn công ty; sổ sách = mọi tài sản đang quản lý khi bắt đầu (tài sản khai báo thêm trong năm tự vào sổ).</li>' +
        '<li>Nhân viên đi quét tem QR từng tài sản — <b>quét là ghi nhận đã kiểm kê</b>. Tài sản hỏng, sai vị trí… thì ghi thêm tình trạng, ghi chú, ảnh.</li>' +
        '<li>Theo dõi tiến độ từng đội / phòng ban, danh sách chưa tìm thấy; cuối năm xuất biên bản kiểm kê Excel rồi kết thúc.</li></ol>' +
        '<p class="mo nho">Kiểm kê năm ' + d.namNay + ' tự bắt đầu khi quét tem đầu tiên' + (quyen(2) ? ', hoặc bấm "Bắt đầu kiểm kê" để mở trước.' : '.') + '</p>' +
        '<div class="hang">' + (quyen(2) ? '<button class="nut chinh" type="button" data-moi>' + BT.them + 'Bắt đầu kiểm kê năm ' + d.namNay + '</button>' : '') +
        (quyen(1) ? '<a class="nut" href="#/quet?lientuc=1">' + BT.quet + 'Quét kiểm kê</a>' : '') + '</div></div>' +
        (cu.length ? '<h3 style="margin:18px 0 8px">Các năm trước</h3>' + cu.map(theDot).join('') : '');
      var b = nd.querySelector('[data-moi]');
      if (b) b.onclick = function () {
        b.disabled = true;
        api('POST', 'kiemke', { id: 0, nam: d.namNay }).then(function (x) { thongBao('Đã bắt đầu kiểm kê năm ' + d.namNay); di('/kiemke/' + x.id); },
          function (e) { b.disabled = false; thongBao(e.message, true); });
      };
    }, function (e) { if (con(lan)) veLoi(nd, e); });
  }

  function moDot(dot) {
    var k = hop('Sửa thông tin kiểm kê', '<label class="nhan">Tên <b>*</b></label><input data-ten value="' + esc(dot.ten) + '">' +
      '<div class="hang"><div class="gian"><label class="nhan">Từ ngày</label><input type="date" data-tu value="' + esc(dot.tuNgay || '') + '"></div>' +
      '<div class="gian"><label class="nhan">Đến ngày</label><input type="date" data-den value="' + esc(dot.denNgay || '') + '"></div></div>' +
      '<label class="nhan">Ghi chú (quyết định thành lập tổ kiểm kê…)</label><textarea data-gc>' + esc(dot.ghiChu || '') + '</textarea>' +
      '<div class="chan"><button class="nut" type="button" data-huy>Huỷ</button><button class="nut chinh" type="button" data-luu>Lưu</button></div>');
    k.querySelector('[data-huy]').onclick = function () { k.dong(); };
    k.querySelector('[data-luu]').onclick = function () {
      var nut = this;
      nut.disabled = true;
      api('POST', 'kiemke', { id: dot.id, ten: k.querySelector('[data-ten]').value, tuNgay: k.querySelector('[data-tu]').value, denNgay: k.querySelector('[data-den]').value, ghiChu: k.querySelector('[data-gc]').value })
        .then(function () { k.dong(); thongBao('Đã lưu'); ve(); }, function (e) { nut.disabled = false; thongBao(e.message, true); });
    };
  }

  function trangDot(nd, id, q, lan) {
    var loc = q.loc || 'chua', donvi = q.donvi || '', tim = q.q || '';
    dangTai(nd);
    function tai() {
      return api('GET', 'kiemke/' + id + chuoiQuery({ loc: loc, donvi: donvi, q: tim }));
    }
    tai().then(function (d) {
      if (!con(lan)) return;
      var pc = d.tong ? Math.round(d.daKiem * 100 / d.tong) : 0;
      var namNay = d.nam === d.namNay;
      nd.innerHTML = '<div class="tieude-trang">' + (namNay ? '' : '<a class="nut-icon" href="#/kiemke" aria-label="Quay lại">' + BT.quaylai + '</a>') + '<h2>' + esc(d.ten) + '</h2>' +
        (d.cacDot.length > 1 ? '<select data-nam aria-label="Chọn năm kiểm kê" style="width:auto">' + d.cacDot.map(function (x) {
          return '<option value="' + x.id + '"' + (x.id === d.id ? ' selected' : '') + '>' + esc(d.cacDot.filter(function (y) { return y.nam === x.nam; }).length > 1 ? x.ten : 'Năm ' + x.nam) + '</option>';
        }).join('') + '</select>' : '') +
        (namNay && !d.dong && quyen(1) ? '<a class="nut chinh" href="#/quet?lientuc=1">' + BT.quet + 'Quét kiểm kê</a>' : '') +
        '<button class="nut" type="button" data-xuat>' + BT.excel + 'Biên bản Excel</button></div>' +
        '<div class="the"><div class="hang"><span class="gian mo">' + (d.tenDonVi !== 'Toàn công ty' ? esc(d.tenDonVi) + ' · ' : 'Toàn công ty · ') + 'từ ' + esc(ngay(d.tuNgay)) + (d.denNgay ? ' đến ' + esc(ngay(d.denNgay)) : '') + ' · bắt đầu bởi ' + esc(d.nguoiTao) + '</span>' +
        (d.dong ? '<span class="tt tt-ngung">Đã kết thúc</span>' : '<span class="tt tt-tot">' + BT_TT.tot + 'Đang kiểm kê</span>') + '</div>' +
        (namNay && !d.dong ? '<div class="mo nho" style="margin:4px 0 2px">Quét tem QR của tài sản = ghi nhận đã kiểm kê. Tài sản khai báo mới trong năm tự đưa vào sổ sách.</div>' : '') +
        '<div class="tien-do" style="height:12px"><i style="width:' + pc + '%"></i></div><div><b>' + fNguyen.format(d.daKiem) + '</b> / ' + fNguyen.format(d.tong) + ' tài sản đã kiểm kê (' + pc + '%) · chưa tìm thấy <b>' +
        fNguyen.format(d.tong - d.daKiem) + '</b>' + (d.ngoaiSo ? ' · ngoài sổ ' + d.ngoaiSo : '') + '</div>' +
        (d.ghiChu ? '<div class="mo nho" style="margin-top:6px;white-space:pre-line">' + esc(d.ghiChu) + '</div>' : '') +
        (quyen(2) ? '<div class="hang" style="margin-top:10px"><button class="nut nho" type="button" data-sua>' + BT.sua + 'Sửa</button>' +
          (!d.dong ? '<button class="nut nho" type="button" data-bosung>Bổ sung tài sản còn thiếu vào sổ</button>' : '') +
          (!d.dong || namNay ? '<button class="nut nho" type="button" data-dong>' + (d.dong ? 'Mở lại kiểm kê' : 'Kết thúc kiểm kê năm ' + d.nam) + '</button>' : '') +
          (quyen(3) ? '<button class="nut nho do" type="button" data-xoa>' + BT.xoa + 'Xoá</button>' : '') + '</div>' : '') + '</div>' +
        '<div class="luoi2"><div class="the phang"><div class="bang-cuon"><table class="bang" style="min-width:480px"><thead><tr><th>Đơn vị</th><th class="so">Sổ sách</th><th class="so">Đã kiểm</th><th class="so">Còn lại</th><th style="width:30%">Tiến độ</th></tr></thead><tbody>' +
        (st.dm.khoi || []).map(function (kh) {
          var ds = d.theoDonVi.filter(function (x) { return x.khoi === kh.ma; });
          if (!ds.length) return '';
          var tong = ds.reduce(function (a, x) { return a + x.tong; }, 0), da = ds.reduce(function (a, x) { return a + x.daKiem; }, 0);
          var dongTD = function (x, lop) {
            var p2 = x.tong ? Math.round(x.daKiem * 100 / x.tong) : 0;
            return '<td class="so">' + x.tong + '</td><td class="so">' + x.daKiem + '</td><td class="so">' + (x.tong - x.daKiem) +
              '</td><td><div class="tien-do" style="margin:6px 0"><i style="width:' + p2 + '%"></i></div></td></tr>';
          };
          return '<tr style="background:#f2f6fa"><td style="white-space:nowrap"><b>' + esc(kh.ten) + '</b></td>' + dongTD({ tong: tong, daKiem: da }) +
            ds.map(function (x) { return '<tr class="bam" data-dv="' + x.id + '"><td style="white-space:nowrap;padding-left:22px">' + esc(x.ten) + '</td>' + dongTD(x); }).join('');
        }).join('') + '</tbody></table></div></div><div></div></div>' +
        '<div class="tab">' + [['chua', 'Chưa kiểm', d.tong - d.daKiem], ['da', 'Đã kiểm', d.daKiem], ['ngoai', 'Ngoài sổ', d.ngoaiSo], ['tatca', 'Tất cả', d.tong]].map(function (x) {
          return '<button type="button" data-loc="' + x[0] + '"' + (x[0] === loc ? ' class="chon"' : '') + '>' + x[1] + '<span>' + x[2] + '</span></button>';
        }).join('') + '</div><div class="loc" style="grid-template-columns:2fr 1fr"><div class="tim">' + BT.tim + '<input type="search" data-tim placeholder="Tìm trong danh sách…" value="' + esc(tim) + '"></div>' +
        '<select data-locdv><option value="">Mọi đơn vị</option>' + d.theoDonVi.map(function (x) { return '<option value="' + x.id + '"' + (String(x.id) === donvi ? ' selected' : '') + '>' + esc(x.ten) + '</option>'; }).join('') + '</select></div>' +
        '<div data-ds></div>';
      veDs(d);
      function veDs(dd) {
        nd.querySelector('[data-ds]').innerHTML = dd.ds.length ? '<div class="ds-ts">' + dd.ds.map(function (t) {
          return '<a class="dong" href="#/ts/' + t.id + '" style="grid-template-columns:56px 1fr">' + oAnhNho(t) + '<div class="giua" style="min-width:0"><div class="t1" style="white-space:normal"><b class="ma">' + esc(t.ma) + '</b> · ' + esc(t.ten) + '</div>' +
            '<div class="mo nho">' + esc(t.tenDonVi) + (t.viTri ? ' · ' + esc(t.viTri) : '') + '</div>' +
            (t.kq ? '<div class="nho" style="margin-top:3px">' + ttHtml(t.kq.tinhTrang, true) + ' <span class="mo">' + esc(luc(t.kq.luc)) + ' · ' + esc(t.kq.hoTen) + (t.kq.noiDung ? ' · ' + esc(t.kq.noiDung) : '') + '</span></div>' : '<div class="nho mo" style="margin-top:3px">Chưa tìm thấy</div>') +
            '</div></a>';
        }).join('') + '</div>' + (dd.soDong > dd.ds.length ? '<p class="mo nho">Hiện ' + dd.ds.length + ' / ' + dd.soDong + ' — dùng ô tìm hoặc lọc đơn vị để xem tiếp; xuất Excel để có đủ danh sách.</p>' : '') :
          '<div class="the trong">Không có tài sản nào.</div>';
        napAnh(nd);
      }
      function taiLaiDs() {
        thayDuong('/kiemke/' + id + chuoiQuery({ loc: loc, donvi: donvi, q: tim }));
        tai().then(function (dd) { if (con(lan)) veDs(dd); });
      }
      var hen;
      nd.querySelector('.tab').onclick = function (e) {
        var b = e.target.closest('[data-loc]');
        if (!b) return;
        loc = b.getAttribute('data-loc');
        Array.prototype.forEach.call(this.children, function (x) { x.classList.toggle('chon', x === b); });
        taiLaiDs();
      };
      nd.querySelector('[data-tim]').oninput = function () { tim = this.value; clearTimeout(hen); hen = setTimeout(taiLaiDs, 300); };
      nd.querySelector('[data-locdv]').onchange = function () { donvi = this.value; taiLaiDs(); };
      Array.prototype.forEach.call(nd.querySelectorAll('tr[data-dv]'), function (tr) {
        tr.onclick = function () { donvi = tr.getAttribute('data-dv'); nd.querySelector('[data-locdv]').value = donvi; taiLaiDs(); };
      });
      nd.querySelector('[data-xuat]').onclick = function () { xuatExcel(this, 'POST', 'kiemke/' + id + '/xuat'); };
      var b;
      if ((b = nd.querySelector('[data-sua]'))) b.onclick = function () { moDot(d); };
      if ((b = nd.querySelector('[data-nam]'))) b.onchange = function () { di('/kiemke/' + this.value); };
      if ((b = nd.querySelector('[data-bosung]'))) b.onclick = function () {
        api('POST', 'kiemke/' + id + '/bosung').then(function (x) { thongBao(x.them ? 'Đã đưa thêm ' + x.them + ' tài sản vào sổ sách kiểm kê' : 'Không có tài sản mới để bổ sung'); ve(); }, function (e) { thongBao(e.message, true); });
      };
      if ((b = nd.querySelector('[data-dong]'))) b.onclick = function () {
        var dong = !d.dong;
        (dong ? hoi('Kết thúc kiểm kê', 'Kết thúc "' + d.ten + '"? Còn ' + (d.tong - d.daKiem) + ' tài sản chưa tìm thấy. Sau khi kết thúc, quét tem không ghi nhận kiểm kê nữa (có thể mở lại). Nên xuất biên bản Excel trước.', 'Kết thúc') : Promise.resolve(true))
          .then(function (ok) { if (ok) api('POST', 'kiemke/' + id + '/dong', { dong: dong }).then(function () { ve(); }, function (e) { thongBao(e.message, true); }); });
      };
      if ((b = nd.querySelector('[data-xoa]'))) b.onclick = function () {
        hoi('Xoá kiểm kê', 'Xoá "' + d.ten + '"? Kết quả kiểm kê của năm bị xoá (lịch sử kiểm kê trên từng tài sản vẫn giữ).' + (namNay ? ' Lần quét tem tiếp theo sẽ bắt đầu lại kiểm kê năm ' + d.nam + '.' : ''), 'Xoá', true).then(function (ok) {
          if (ok) api('DELETE', 'kiemke?id=' + id).then(function () { di('/kiemke'); }, function (e) { thongBao(e.message, true); });
        });
      };
    }, function (e) { if (con(lan)) veLoi(nd, e); });
  }

  // ------------------------------------------------------------------ điều chuyển: các phiếu, biên bản giao nhận
  function trangDieuChuyen(nd, r, lan) {
    if (r.q.so) { trangPhieu(nd, r.q.so, lan); return; }
    var donvi = r.q.donvi || '';
    dangTai(nd);
    api('GET', 'dieuchuyen' + chuoiQuery({ donvi: donvi })).then(function (d) {
      if (!con(lan)) return;
      nd.innerHTML = '<div class="tieude-trang"><h2>Điều chuyển tài sản</h2>' + (quyen(2) ? '<a class="nut chinh" href="#/quet?dc=1">' + BT.quet + 'Quét tem để điều chuyển</a>' : '') + '</div>' +
        '<p class="mo nho" style="margin-top:-6px">Chuyển tài sản giữa các đội cấp nước và phòng ban: quét tem các tài sản cần chuyển (hoặc đánh dấu chọn trong trang Tài sản, ' +
        'hoặc nút Điều chuyển trên trang 1 tài sản) → chọn đơn vị nhận → in biên bản giao nhận cho hai bên ký.</p>' +
        '<div class="loc" style="grid-template-columns:minmax(0,1fr)"><select data-locdv>' + optDonVi(donvi, 'Mọi đơn vị (giao hoặc nhận)') + '</select></div>' +
        (d.ds.length ? '<div class="the"><ul class="ds-don">' + d.ds.map(function (p) {
          return '<li><a class="dong" href="#/dieuchuyen?so=' + encodeURIComponent(p.so) + '"><span class="bt-sk" style="color:var(--chinh)">' + BT.dieuchuyen.replace('<svg', '<svg width="20" height="20"') + '</span>' +
            '<div class="gian"><div class="tieu"><b class="ma">' + esc(p.so) + '</b> · ' + p.soTaiSan + ' tài sản → <b>' + esc(p.tenDenDonVi) + '</b></div>' +
            '<div class="mo nho tieu">' + esc(luc(p.luc)) + ' · từ ' + esc(p.tenTuDonVi) + ' · ' + esc(p.hoTen) + (p.noiDung ? ' · ' + esc(p.noiDung) : '') + '</div></div></a></li>';
        }).join('') + '</ul></div>' + (d.conNua ? '<p class="mo nho">Hiện 300 phiếu gần nhất — lọc theo đơn vị để xem phiếu cũ hơn.</p>' : '') :
          '<div class="the trong">Chưa có phiếu điều chuyển nào' + (donvi ? ' của đơn vị này' : '') + '.</div>');
      nd.querySelector('[data-locdv]').onchange = function () { di('/dieuchuyen' + chuoiQuery({ donvi: this.value })); };
    }, function (e) { if (con(lan)) veLoi(nd, e); });
  }

  function trangPhieu(nd, so, lan) {
    dangTai(nd);
    api('GET', 'dieuchuyen?so=' + encodeURIComponent(so)).then(function (p) {
      if (!con(lan)) return;
      var dong = function (k, v) { return v === '' || v == null ? '' : '<div class="k">' + esc(k) + '</div><div class="v">' + v + '</div>'; };
      nd.innerHTML = '<div class="tieude-trang"><a class="nut-icon" href="#/dieuchuyen" aria-label="Quay lại">' + BT.quaylai + '</a><h2>Phiếu điều chuyển ' + esc(p.so) + '</h2>' +
        '<button class="nut chinh" type="button" data-bb>' + BT.excel + 'Biên bản giao nhận</button></div>' +
        '<div class="the"><div class="bang-tt">' + dong('Ngày giờ', esc(luc(p.luc))) + dong('Bên giao', esc(p.tenTuDonVi)) +
        dong('Bên nhận', '<b>' + esc(p.tenDenDonVi) + '</b><div class="mo nho">' + esc(tenKhoi(p.khoiDen)) + '</div>') +
        dong('Số quyết định / lý do', esc(p.noiDung)) + dong('Người lập', esc(p.hoTen)) + dong('Số tài sản', String(p.soTaiSan)) + '</div></div>' +
        '<div class="the"><ul class="ds-don">' + p.ds.map(function (t) {
          return dongTaiSan(t, 'Từ ' + esc(t.tenTuDonVi) + (t.chiTiet ? ' · ' + esc(t.chiTiet.replace(/\n/g, '; ')) : ''));
        }).join('') + '</ul></div>';
      napAnh(nd);
      nd.querySelector('[data-bb]').onclick = function () { xuatExcel(this, 'POST', 'xuat/dieuchuyen', { so: p.so }); };
    }, function (e) { if (con(lan)) veLoi(nd, e); });
  }

  // ------------------------------------------------------------------ hoạt động
  function trangHoatDong(nd, r, lan) {
    var loai = r.q.loai || '', trang = 1;
    var LOAI = { '': 'Mọi hoạt động', kiemtra: 'Kiểm tra', baotri: 'Bảo dưỡng / sửa chữa', kiemke: 'Kiểm kê', dieuchuyen: 'Điều chuyển', thanhly: 'Thanh lý', anh: 'Thêm ảnh', tao: 'Khai báo', sua: 'Sửa thông tin' };
    nd.innerHTML = '<div class="tieude-trang"><h2>Hoạt động</h2><select data-loai style="width:auto">' + Object.keys(LOAI).map(function (k) {
      return '<option value="' + k + '"' + (k === loai ? ' selected' : '') + '>' + esc(LOAI[k]) + '</option>';
    }).join('') + '</select></div><div class="the"><ul class="ds-don" data-ds></ul><div data-them style="text-align:center"></div></div>';
    var ds = nd.querySelector('[data-ds]'), them = nd.querySelector('[data-them]');
    function tai() {
      api('GET', 'hoatdong' + chuoiQuery({ loai: loai, trang: trang })).then(function (d) {
        if (!con(lan)) return;
        if (trang === 1 && !d.ds.length) ds.innerHTML = '<li class="trong">Chưa có hoạt động.</li>';
        ds.insertAdjacentHTML('beforeend', d.ds.map(dongSuKien).join(''));
        them.innerHTML = d.conNua ? '<button class="nut" type="button">Xem thêm</button>' : '';
        if (d.conNua) them.querySelector('button').onclick = function () { trang++; tai(); };
      }, function (e) { if (con(lan)) veLoi(nd, e); });
    }
    nd.querySelector('[data-loai]').onchange = function () { di('/hoatdong' + chuoiQuery({ loai: this.value })); };
    tai();
  }

  // ------------------------------------------------------------------ in tem QR
  var MAU_TEM = {
    a4_24: { ten: 'Giấy A4 — 24 tem 70 × 37 mm (3 × 8)', giay: [210, 297], cot: 3, hang: 8, w: 70, h: 37.125, le: [0, 0], khe: [0, 0] },
    a4_40: { ten: 'Giấy A4 — 40 tem 52,5 × 29,7 mm (4 × 10)', giay: [210, 297], cot: 4, hang: 10, w: 52.5, h: 29.7, le: [0, 0], khe: [0, 0] },
    a4_12: { ten: 'Giấy A4 — 12 tem lớn 105 × 49,5 mm (2 × 6), thiết bị ngoài trời', giay: [210, 297], cot: 2, hang: 6, w: 105, h: 49.5, le: [0, 0], khe: [0, 0] },
    a4_65: { ten: 'Giấy A4 — 65 tem nhỏ 38,1 × 21,2 mm (5 × 13)', giay: [210, 297], cot: 5, hang: 13, w: 38.1, h: 21.2, le: [4.7, 10.7], khe: [2.5, 0] },
    cuon_50x30: { ten: 'Máy in tem cuộn — 50 × 30 mm', giay: [50, 30], cot: 1, hang: 1, w: 50, h: 30, le: [0, 0], khe: [0, 0] },
    cuon_60x40: { ten: 'Máy in tem cuộn — 60 × 40 mm', giay: [60, 40], cot: 1, hang: 1, w: 60, h: 40, le: [0, 0], khe: [0, 0] }
  };

  function trangNhan(nd, r, lan) {
    var cfg = { mau: 'a4_24', cty: true, ten: true, dv: true, hd: true, vien: true, boQua: 0, muc: 'M' };
    try { var luu = JSON.parse(doc(KHOA_TEM) || 'null'); if (luu) Object.keys(cfg).forEach(function (k) { if (luu[k] !== undefined && k !== 'boQua') cfg[k] = luu[k]; }); } catch (e) { }
    if (!MAU_TEM[cfg.mau]) cfg.mau = 'a4_24';
    var ds = [], congTy = st.dm.caiDat.tenCongTy;
    nd.innerHTML = '<div class="tieude-trang"><h2>In tem QR</h2><button class="nut chinh" type="button" data-in>' + BT.in + 'In</button></div>' +
      '<div class="luoi2" style="grid-template-columns:minmax(0,1fr)"><div class="the"><div class="hang" style="align-items:flex-end">' +
      '<div class="gian" style="min-width:240px"><label class="nhan">Mẫu tem</label><select data-c="mau">' + Object.keys(MAU_TEM).map(function (k) {
        return '<option value="' + k + '"' + (k === cfg.mau ? ' selected' : '') + '>' + esc(MAU_TEM[k].ten) + '</option>';
      }).join('') + '</select></div><div style="width:150px"><label class="nhan">Bỏ qua ô đầu tờ</label><input data-c="boQua" type="number" min="0" value="0"></div>' +
      '<div style="width:190px"><label class="nhan">Mức chống bẩn / xước</label><select data-c="muc"><option value="M">Thường (15%)</option><option value="Q">Cao (25%)</option><option value="H">Rất cao (30%)</option></select></div></div>' +
      '<div class="hang" style="margin-top:4px">' + [['cty', 'Tên công ty'], ['ten', 'Tên tài sản'], ['dv', 'Đơn vị'], ['hd', 'Dòng "Quét để xem thông tin"'], ['vien', 'Đường cắt (chỉ trên màn hình)']].map(function (x) {
        return '<label class="chon-o" style="margin:6px 12px 0 0"><input type="checkbox" data-c="' + x[0] + '"' + (cfg[x[0]] ? ' checked' : '') + '> ' + x[1] + '</label>';
      }).join('') + '</div><div class="goiy" data-nguon></div>' +
      (quyen(2) ? '<details style="margin-top:10px"><summary style="cursor:pointer;color:var(--chinh)">In tem trắng (cấp trước mã, dán lên tài sản rồi quét để khai báo)</summary>' +
        '<div class="hang" style="margin-top:8px;align-items:flex-end"><div class="gian"><label class="nhan">Loại (tiền tố mã)</label><select data-tt>' + st.dm.loai.map(function (l) {
          return '<option value="' + esc(l.tienTo) + '">' + esc(l.tienTo) + ' — ' + esc(l.ten) + '</option>';
        }).join('') + '</select></div><div style="width:120px"><label class="nhan">Số tem</label><input type="number" data-sl value="24" min="1" max="1000"></div>' +
        '<button class="nut" type="button" data-captruoc>Cấp mã &amp; thêm vào trang in</button></div><div class="goiy">Mã đã cấp không cấp lại cho tài sản khác. Quét tem trắng → "Khai báo tài sản với mã này".</div></details>' : '') +
      '</div></div><div class="hang" style="margin:4px 0 8px"><span class="gian mo" data-dem>Đang tải…</span></div><div class="xem-tem" data-xem></div>';
    var xem = nd.querySelector('[data-xem]'), dem = nd.querySelector('[data-dem]');
    nd.querySelector('[data-c="muc"]').value = cfg.muc;

    function luuCfg() { ghi(KHOA_TEM, JSON.stringify(cfg)); }
    function noiDungTem(t, m) {
      var nho = m.h < 25;
      var qr = MaQR.svg(diaChiQr(t.ma), cfg.muc, 2);
      return '<div class="qr">' + qr + '</div><div class="chu">' + (cfg.cty && !nho ? '<div class="cty">' + esc(congTy) + '</div>' : '') +
        '<div class="mats">' + esc(t.ma) + '</div>' + (cfg.ten && t.ten ? '<div class="tents">' + esc(t.ten) + '</div>' : '') +
        (cfg.dv && t.tenDonVi && !nho ? '<div class="dv">' + esc(t.tenDonVi) + '</div>' : '') + (cfg.hd && !nho ? '<div class="hd">Quét mã để xem thông tin tài sản</div>' : '') + '</div>';
    }
    function dungTo() {
      var m = MAU_TEM[cfg.mau], moiTo = m.cot * m.hang, boQua = Math.max(0, Math.min(moiTo - 1, +cfg.boQua || 0));
      var o = [];
      for (var i = 0; i < boQua; i++) o.push(null);
      o = o.concat(ds);
      var to = [];
      for (i = 0; i < o.length; i += moiTo) to.push(o.slice(i, i + moiTo));
      var co = Math.min(m.h / 37, m.w / 70) * 3.4;   // cỡ chữ gốc (mm) theo kích thước tem
      return to.map(function (tem) {
        return '<div class="to" style="width:' + m.giay[0] + 'mm;height:' + m.giay[1] + 'mm">' + tem.map(function (t, j) {
          if (!t) return '';
          var c = j % m.cot, h2 = Math.floor(j / m.cot);
          var x = m.le[0] + c * (m.w + m.khe[0]), y = m.le[1] + h2 * (m.h + m.khe[1]);
          return '<div class="tem' + (cfg.vien ? ' vien' : '') + '" style="left:' + x + 'mm;top:' + y + 'mm;width:' + m.w + 'mm;height:' + m.h + 'mm;font-size:' + co.toFixed(2) + 'mm">' + noiDungTem(t, m) + '</div>';
        }).join('') + '</div>';
      }).join('');
    }
    function veXem() {
      var m = MAU_TEM[cfg.mau];
      var soTo = Math.ceil((ds.length + Math.max(0, +cfg.boQua || 0)) / (m.cot * m.hang));
      dem.textContent = ds.length ? fNguyen.format(ds.length) + ' tem · ' + soTo + ' ' + (m.giay[0] === 210 ? 'tờ A4' : 'tem in') + (ds.length > 300 ? ' (xem trước 300 tem đầu)' : '') : 'Chưa có tem nào để in.';
      var luu = ds;
      if (ds.length > 300) ds = ds.slice(0, 300);
      xem.innerHTML = ds.length ? dungTo() : '<div class="trong">Chọn tài sản ở trang <a href="#/ds">Tài sản</a> rồi bấm "In tem", hoặc in tem trắng ở trên.</div>';
      ds = luu;
      // thu nhỏ tờ cho vừa màn hình
      var rong = xem.clientWidth - 28;
      Array.prototype.forEach.call(xem.querySelectorAll('.to'), function (to) {
        var w = to.offsetWidth, h = to.offsetHeight, k = Math.min(1, rong / w);
        if (k < 1) { to.style.transform = 'scale(' + k + ')'; to.style.marginBottom = (14 - h * (1 - k)) + 'px'; to.style.marginLeft = '0'; }
      });
      nd.querySelector('[data-nguon]').innerHTML = 'Mã QR chứa địa chỉ: <span class="ma">' + esc(diaChiQr(ds[0] ? ds[0].ma : 'MA-TAI-SAN')) + '</span>' +
        (st.dm.caiDat.diaChiQr ? '' : ' — địa chỉ đang mở trang này; đổi ở <a href="#/caidat">Cài đặt</a> nếu điện thoại vào máy chủ bằng địa chỉ khác.');
    }
    Array.prototype.forEach.call(nd.querySelectorAll('[data-c]'), function (i) {
      i.addEventListener('change', function () {
        var k = i.getAttribute('data-c');
        cfg[k] = i.type === 'checkbox' ? i.checked : i.value;
        luuCfg();
        veXem();
      });
    });
    var nutCap = nd.querySelector('[data-captruoc]');
    if (nutCap) nutCap.onclick = function () {
      var sl = +nd.querySelector('[data-sl]').value || 0;
      nutCap.disabled = true;
      api('POST', 'nhan/datruoc', { tienTo: nd.querySelector('[data-tt]').value, soLuong: sl }).then(function (d) {
        ds = ds.concat(d.ma.map(function (m) { return { id: 0, ma: m, ten: '', tenDonVi: '' }; }));
        thongBao('Đã cấp ' + d.ma.length + ' mã: ' + d.ma[0] + ' … ' + d.ma[d.ma.length - 1]);
        veXem();
      }, function (e) { thongBao(e.message, true); }).then(function () { nutCap.disabled = false; });
    };
    nd.querySelector('[data-in]').onclick = function () {
      if (!ds.length) { thongBao('Chưa có tem nào để in', true); return; }
      var m = MAU_TEM[cfg.mau];
      var vung = document.getElementById('intem');
      vung.innerHTML = '<style>@page { size: ' + m.giay[0] + 'mm ' + m.giay[1] + 'mm; margin: 0; }</style>' + dungTo();
      document.body.classList.add('dang-in');
      var xong = function () { document.body.classList.remove('dang-in'); vung.innerHTML = ''; window.removeEventListener('afterprint', xong); };
      window.addEventListener('afterprint', xong);
      setTimeout(function () { window.print(); setTimeout(function () { if (document.body.classList.contains('dang-in') && !window.matchMedia('print').matches) xong(); }, 1500); }, 60);
    };

    if (r.q.le && st.temLe) { ds = st.temLe.slice(); veXem(); return; }
    if (!r.q.chon && !r.q.q && !r.q.loai && !r.q.donvi && !r.q.khoi && !r.q.tinhtrang && !r.q.them) { ds = []; veXem(); dem.innerHTML = 'Chưa chọn tài sản. Vào <a href="#/ds">Tài sản</a>, chọn (hoặc lọc) rồi bấm "In tem"; hoặc in tem trắng ở trên.'; return; }
    (r.q.chon ? api('POST', 'nhan', { ids: Object.keys(st.chon).map(Number), sap: 'ma' }) :
      api('GET', 'nhan' + chuoiQuery({ q: r.q.q, loai: r.q.loai, donvi: r.q.donvi, khoi: r.q.khoi, tinhtrang: r.q.tinhtrang, them: r.q.them, sap: r.q.sap }))).then(function (d) {
      if (!con(lan)) return;
      ds = d.ds;
      veXem();
    }, function (e) { if (con(lan)) dem.textContent = e.message; });
  }

  // ------------------------------------------------------------------ nhập Excel
  function trangNhap(nd, r, lan) {
    if (!quyen(2)) { nd.innerHTML = '<div class="loi">Tài khoản này không nhập Excel được.</div>'; return; }
    var tep = null;
    nd.innerHTML = '<div class="tieude-trang"><h2>Nhập danh sách tài sản từ Excel</h2></div>' +
      '<div class="the"><h3>1. Chuẩn bị file</h3><p class="mo" style="margin-top:0">Dùng file mẫu, hoặc file sổ tài sản đang có: phần mềm tự nhận các cột theo tiêu đề (Mã tài sản, Tên tài sản, Loại, Đơn vị, Vị trí, Nguyên giá, Ngày đưa vào sử dụng, Số năm khấu hao, Hãng, Model, Số seri, Tình trạng…).</p>' +
      '<button class="nut" type="button" data-mau>' + BT.tai + 'Tải file mẫu</button></div>' +
      '<div class="the"><h3>2. Chọn file .xlsx</h3><button class="nut chinh" type="button" data-chon>' + BT.len + 'Chọn file Excel</button> <span class="mo" data-ten></span>' +
      '<div class="goiy">Mã đã có trong phần mềm = cập nhật (chỉ ghi các ô có số liệu). Loại / đơn vị chưa có sẽ được tạo mới. Xem trước rồi mới nhập.</div></div>' +
      '<div data-kq></div>';
    var kq = nd.querySelector('[data-kq]');
    nd.querySelector('[data-mau]').onclick = function () { xuatExcel(this, 'GET', 'xuat/mau'); };
    nd.querySelector('[data-chon]').onclick = function () {
      chonFile('.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', false, false).then(function (f) {
        if (!f.length) return;
        tep = f[0];
        nd.querySelector('[data-ten]').textContent = tep.name;
        guiTep(true);
      });
    };
    function guiTep(thu) {
      kq.innerHTML = '<div class="the dangtai">' + (thu ? 'Đang đọc file…' : 'Đang nhập…') + '</div>';
      tep.arrayBuffer().then(function (b) { return api('POST', 'nhap' + (thu ? '?thu=1' : ''), b, true); }).then(function (d) {
        if (!con(lan)) return;
        var h = '<div class="the"><h3>' + (thu ? '3. Xem trước' : 'Đã nhập xong') + '</h3>' +
          '<p style="margin-top:0">Trang <b>' + esc(d.trang) + '</b>, tiêu đề ở dòng ' + d.dongTieuDe + ': ' + fNguyen.format(d.soDong) + ' dòng → ' +
          '<b>' + (thu ? 'sẽ thêm ' : 'đã thêm ') + d.them + '</b>, <b>' + (thu ? 'sẽ cập nhật ' : 'đã cập nhật ') + d.capNhat + '</b>' + (d.khongDoi ? ', không đổi ' + d.khongDoi : '') +
          (d.soLoi ? ', <b style="color:var(--do)">' + d.soLoi + ' dòng lỗi (bỏ qua)</b>' : '') + '.</p>' +
          '<details><summary class="mo" style="cursor:pointer">Các cột đã nhận ra (' + d.cot.length + ')</summary><div class="mo nho">' + d.cot.map(esc).join(' · ') + '</div></details>' +
          (d.loaiMoi.length ? '<div class="bao">Loại tài sản mới: ' + d.loaiMoi.map(esc).join(', ') + '</div>' : '') +
          (d.donViMoi.length ? '<div class="bao">Đơn vị mới: ' + d.donViMoi.map(esc).join(', ') + '</div>' : '') +
          (d.loi.length ? '<h4 style="margin:12px 0 4px">Dòng lỗi</h4><div class="bang-cuon"><table class="bang"><tr><th>Dòng</th><th>Mã</th><th>Tên</th><th>Lỗi</th></tr>' + d.loi.map(function (x) {
            return '<tr><td>' + x.dong + '</td><td class="ma">' + esc(x.ma) + '</td><td>' + esc(x.ten) + '</td><td style="color:var(--do)">' + esc(x.loi) + '</td></tr>';
          }).join('') + '</table></div>' : '') +
          (d.canhBao.length ? '<h4 style="margin:12px 0 4px">Lưu ý</h4><div class="bang-cuon"><table class="bang"><tr><th>Dòng</th><th>Nội dung</th></tr>' + d.canhBao.map(function (x) {
            return '<tr><td>' + x.dong + '</td><td>' + esc(x.noiDung) + '</td></tr>';
          }).join('') + '</table></div>' : '') +
          (thu && d.xem.length ? '<h4 style="margin:12px 0 4px">' + d.xem.length + ' dòng đầu</h4><div class="bang-cuon"><table class="bang"><tr><th>Dòng</th><th>Mã</th><th>Tên</th><th>Loại</th><th>Đơn vị</th><th>Thao tác</th></tr>' + d.xem.map(function (x) {
            return '<tr><td>' + x.dong + '</td><td class="ma">' + esc(x.ma) + '</td><td>' + esc(x.ten) + '</td><td>' + esc(x.loai) + '</td><td>' + esc(x.donVi) + '</td><td>' + esc(x.hanhDong) + '</td></tr>';
          }).join('') + '</table></div>' : '') +
          '<div class="hang" style="margin-top:14px">' + (thu && (d.them || d.capNhat) ? '<button class="nut chinh" type="button" data-nhap>Nhập ' + (d.them + d.capNhat) + ' tài sản</button>' : '') +
          (!thu ? '<a class="nut chinh" href="#/ds?sap=moi">Xem danh sách tài sản</a><a class="nut" href="#/nhan?them=chuaanh">In tem cho tài sản mới</a>' : '') + '</div></div>';
        kq.innerHTML = h;
        var b = kq.querySelector('[data-nhap]');
        if (b) b.onclick = function () { guiTep(false); };
        if (!thu) taiDanhMuc();
      }, function (e) { if (con(lan)) kq.innerHTML = '<div class="loi">' + esc(e.message) + '</div>'; });
    }
  }

  // ------------------------------------------------------------------ danh mục
  function trangDanhMuc(nd, r, lan) {
    taiDanhMuc().then(function (dm) {
      if (!con(lan)) return;
      var sua = quyen(2), xoa = quyen(3);
      nd.innerHTML = '<div class="tieude-trang"><h2>Danh mục</h2></div>' +
        '<div class="the phang"><div class="hang" style="padding:14px 16px 6px"><h3 class="gian" style="font-size:16px">Loại tài sản</h3>' + (sua ? '<button class="nut nho" type="button" data-themloai>' + BT.them + 'Thêm loại</button>' : '') + '</div>' +
        '<div class="bang-cuon"><table class="bang"><thead><tr><th>Tên loại</th><th>Tiền tố mã</th><th>Nhóm</th><th class="so">Khấu hao</th><th class="so">Bảo dưỡng</th><th>Thông số riêng</th><th class="so">Số TS</th></tr></thead><tbody>' +
        dm.loai.map(function (l) {
          return '<tr' + (sua ? ' class="bam" data-loai="' + l.id + '"' : '') + '><td><b>' + esc(l.ten) + '</b></td><td class="ma">' + esc(l.tienTo) + '</td><td class="mo">' + esc(l.nhom) + '</td>' +
            '<td class="so">' + (l.soNamKhauHao ? l.soNamKhauHao + ' năm' : '—') + '</td><td class="so">' + (l.chuKyBaoTri ? l.chuKyBaoTri + ' ngày' : '—') + '</td>' +
            '<td class="mo nho">' + esc(l.truong.join('; ')) + '</td><td class="so"><a href="#/ds?loai=' + l.id + '">' + l.soTaiSan + '</a></td></tr>';
        }).join('') + '</tbody></table></div></div>' +
        '<div class="the phang"><div class="hang" style="padding:14px 16px 6px"><h3 class="gian" style="font-size:16px">Đơn vị quản lý</h3>' + (sua ? '<button class="nut nho" type="button" data-themdv>' + BT.them + 'Thêm đơn vị</button>' : '') + '</div>' +
        '<div class="bang-cuon"><table class="bang"><thead><tr><th>Tên đơn vị</th><th>Ghi chú</th><th class="so">Số TS</th></tr></thead><tbody>' +
        dm.khoi.map(function (kh) {
          var ds = dm.donVi.filter(function (d) { return d.khoi === kh.ma; });
          return '<tr style="background:#f2f6fa"><td colspan="2"><b>' + esc(kh.ten) + '</b> <span class="mo nho">(' + ds.length + ' đơn vị)</span></td>' +
            '<td class="so"><a href="#/ds?khoi=' + kh.ma + '">' + ds.reduce(function (a, d) { return a + d.soTaiSan; }, 0) + '</a></td></tr>' +
            ds.map(function (d) {
              return '<tr' + (sua ? ' class="bam" data-dv="' + d.id + '"' : '') + '><td style="padding-left:22px"><b>' + esc(d.ten) + '</b></td><td class="mo">' + esc(d.ghiChu) + '</td><td class="so"><a href="#/ds?donvi=' + d.id + '">' + d.soTaiSan + '</a></td></tr>';
            }).join('');
        }).join('') + '</tbody></table></div></div>' +
        '<p class="mo nho">Nhóm tài sản theo cách phân loại tài sản cố định (nhà cửa, máy móc, phương tiện truyền dẫn…). Số năm khấu hao, chu kỳ bảo dưỡng là mặc định của loại; từng tài sản có thể ghi riêng.' +
        (xoa ? '' : ' Xoá loại / đơn vị cần tài khoản quản trị.') + '</p>';
      function moLoai(l) {
        l = l || { id: 0, ten: '', tienTo: '', nhom: dm.nhom[1], soNamKhauHao: 5, chuKyBaoTri: 0, truong: [] };
        var k = hop(l.id ? 'Sửa loại tài sản' : 'Thêm loại tài sản', '<label class="nhan">Tên loại <b>*</b></label><input data-ten value="' + esc(l.ten) + '">' +
          '<div class="hang"><div style="width:140px"><label class="nhan">Tiền tố mã</label><input data-tt class="ma" value="' + esc(l.tienTo) + '" placeholder="vd MB" autocapitalize="characters"></div>' +
          '<div class="gian"><label class="nhan">Nhóm</label><select data-nhom>' + dm.nhom.map(function (n) { return '<option' + (n === l.nhom ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select></div></div>' +
          '<div class="hang"><div class="gian"><label class="nhan">Số năm khấu hao</label><input data-kh type="number" min="0" max="100" value="' + l.soNamKhauHao + '"></div>' +
          '<div class="gian"><label class="nhan">Chu kỳ bảo dưỡng (ngày, 0 = không)</label><input data-ck type="number" min="0" max="3650" value="' + l.chuKyBaoTri + '"></div></div>' +
          '<label class="nhan">Thông số kỹ thuật riêng của loại (mỗi dòng 1 thông số)</label><textarea data-truong placeholder="Công suất (kW)&#10;Lưu lượng (m³/h)">' + esc(l.truong.join('\n')) + '</textarea>' +
          '<div class="chan">' + (l.id && xoa ? '<button class="nut do" type="button" data-xoa style="margin-right:auto">Xoá</button>' : '') + '<button class="nut" type="button" data-huy>Huỷ</button><button class="nut chinh" type="button" data-luu>Lưu</button></div>');
        k.querySelector('[data-huy]').onclick = function () { k.dong(); };
        k.querySelector('[data-luu]').onclick = function () {
          api('POST', 'loai', { id: l.id, ten: k.querySelector('[data-ten]').value, tienTo: k.querySelector('[data-tt]').value, nhom: k.querySelector('[data-nhom]').value,
            soNamKhauHao: +k.querySelector('[data-kh]').value || 0, chuKyBaoTri: +k.querySelector('[data-ck]').value || 0,
            truong: k.querySelector('[data-truong]').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean)
          }).then(function (d) { st.dm = d; k.dong(); thongBao('Đã lưu'); ve(); }, function (e) { thongBao(e.message, true); });
        };
        var bx = k.querySelector('[data-xoa]');
        if (bx) bx.onclick = function () {
          api('DELETE', 'loai?id=' + l.id).then(function (d) { st.dm = d; k.dong(); thongBao('Đã xoá'); ve(); }, function (e) { thongBao(e.message, true); });
        };
      }
      function moDv(d) {
        d = d || { id: 0, ten: '', ghiChu: '', khoi: 'doi' };
        var k = hop(d.id ? 'Sửa đơn vị' : 'Thêm đơn vị', '<label class="nhan">Tên đơn vị <b>*</b></label><input data-ten value="' + esc(d.ten) + '" placeholder="Vd: Đội Cấp nước số 7, Phòng Kế hoạch - Vật tư">' +
          '<label class="nhan">Thuộc khối</label><select data-khoi>' + dm.khoi.map(function (kh) { return '<option value="' + kh.ma + '"' + (kh.ma === d.khoi ? ' selected' : '') + '>' + esc(kh.ten) + '</option>'; }).join('') + '</select>' +
          '<label class="nhan">Ghi chú (địa chỉ, người phụ trách…)</label><input data-gc value="' + esc(d.ghiChu) + '">' +
          '<div class="chan">' + (d.id && xoa ? '<button class="nut do" type="button" data-xoa style="margin-right:auto">Xoá</button>' : '') + '<button class="nut" type="button" data-huy>Huỷ</button><button class="nut chinh" type="button" data-luu>Lưu</button></div>');
        k.querySelector('[data-huy]').onclick = function () { k.dong(); };
        k.querySelector('[data-luu]').onclick = function () {
          api('POST', 'donvi', { id: d.id, ten: k.querySelector('[data-ten]').value, ghiChu: k.querySelector('[data-gc]').value, khoi: k.querySelector('[data-khoi]').value })
            .then(function (x) { st.dm = x; k.dong(); thongBao('Đã lưu'); ve(); }, function (e) { thongBao(e.message, true); });
        };
        var bx = k.querySelector('[data-xoa]');
        if (bx) bx.onclick = function () {
          api('DELETE', 'donvi?id=' + d.id).then(function (x) { st.dm = x; k.dong(); thongBao('Đã xoá'); ve(); }, function (e) { thongBao(e.message, true); });
        };
      }
      if (sua) {
        nd.querySelector('[data-themloai]').onclick = function () { moLoai(null); };
        nd.querySelector('[data-themdv]').onclick = function () { moDv(null); };
        Array.prototype.forEach.call(nd.querySelectorAll('tr[data-loai]'), function (tr) {
          tr.onclick = function (e) { if (e.target.closest('a')) return; moLoai(dm.loai.filter(function (l) { return l.id === +tr.getAttribute('data-loai'); })[0]); };
        });
        Array.prototype.forEach.call(nd.querySelectorAll('tr[data-dv]'), function (tr) {
          tr.onclick = function (e) { if (e.target.closest('a')) return; moDv(dm.donVi.filter(function (d) { return d.id === +tr.getAttribute('data-dv'); })[0]); };
        });
      }
    }, function (e) { if (con(lan)) veLoi(nd, e); });
  }

  // ------------------------------------------------------------------ tài khoản
  function trangTaiKhoan(nd, r, lan) {
    var n = st.nguoi;
    nd.innerHTML = '<div class="tieude-trang"><h2>Tài khoản</h2></div><div class="the"><h3>' + esc(n.hoTen || n.ten) + '</h3><div class="bang-tt">' +
      '<div class="k">Tên đăng nhập</div><div class="v">' + esc(n.ten) + '</div><div class="k">Quyền</div><div class="v">' + esc(n.tenVaiTro) + '</div>' +
      (n.tenDonVi ? '<div class="k">Giới hạn đơn vị</div><div class="v">' + esc(n.tenDonVi) + '</div>' : '') + '</div>' +
      '<div class="hang" style="margin-top:12px"><button class="nut" type="button" data-doimk>Đổi mật khẩu</button><button class="nut do" type="button" data-dx>' + BT.dangxuat + 'Đăng xuất</button></div></div>' +
      (quyen(3) ? '<div class="the phang"><div class="hang" style="padding:14px 16px 6px"><h3 class="gian" style="font-size:16px">Người dùng</h3><button class="nut nho" type="button" data-them>' + BT.them + 'Thêm tài khoản</button></div><div data-ds class="bang-cuon"><div class="dangtai">Đang tải…</div></div></div>' : '');
    nd.querySelector('[data-dx]').onclick = dangXuat;
    nd.querySelector('[data-doimk]').onclick = function () {
      var k = hop('Đổi mật khẩu', '<label class="nhan">Mật khẩu hiện tại</label><input type="password" data-cu autocomplete="current-password"><label class="nhan">Mật khẩu mới (ít nhất 6 ký tự)</label>' +
        '<input type="password" data-moi autocomplete="new-password"><label class="nhan">Nhập lại mật khẩu mới</label><input type="password" data-lai autocomplete="new-password">' +
        '<div class="chan"><button class="nut" type="button" data-huy>Huỷ</button><button class="nut chinh" type="button" data-luu>Đổi mật khẩu</button></div>');
      k.querySelector('[data-huy]').onclick = function () { k.dong(); };
      k.querySelector('[data-luu]').onclick = function () {
        var moi = k.querySelector('[data-moi]').value;
        if (moi !== k.querySelector('[data-lai]').value) { thongBao('Hai lần nhập mật khẩu mới không giống nhau', true); return; }
        api('POST', 'doimatkhau', { cu: k.querySelector('[data-cu]').value, moi: moi }).then(function () { k.dong(); thongBao('Đã đổi mật khẩu. Các thiết bị khác phải đăng nhập lại.'); }, function (e) { thongBao(e.message, true); });
      };
    };
    if (!quyen(3)) return;
    var dsEl = nd.querySelector('[data-ds]'), vaiTro = [];
    function veDs(d) {
      vaiTro = d.vaiTro;
      dsEl.innerHTML = '<table class="bang"><thead><tr><th>Tên đăng nhập</th><th>Họ tên</th><th>Quyền</th><th>Giới hạn đơn vị</th><th>Trạng thái</th></tr></thead><tbody>' + d.ds.map(function (t) {
        return '<tr class="bam" data-ten="' + esc(t.ten) + '"><td><b>' + esc(t.ten) + '</b></td><td>' + esc(t.hoTen) + '</td><td>' + esc(t.tenVaiTro) + '</td><td>' + esc(t.tenDonVi || 'Mọi đơn vị') + '</td>' +
          '<td>' + (t.khoa ? '<span class="tt tt-hong">' + BT_TT.hong + 'Đã khoá</span>' : '<span class="mo nho">' + t.soPhien + ' thiết bị đăng nhập</span>') + '</td></tr>';
      }).join('') + '</tbody></table>';
      Array.prototype.forEach.call(dsEl.querySelectorAll('tr[data-ten]'), function (tr) {
        tr.onclick = function () { moTk(d.ds.filter(function (t) { return t.ten === tr.getAttribute('data-ten'); })[0]); };
      });
    }
    function moTk(t) {
      var moi = !t;
      t = t || { ten: '', hoTen: '', vaiTro: 'KiemTra', donVi: -1, khoa: false };
      var k = hop(moi ? 'Thêm tài khoản' : 'Sửa tài khoản ' + t.ten, '<label class="nhan">Tên đăng nhập <b>*</b></label><input data-ten value="' + esc(t.ten) + '"' + (moi ? '' : ' readonly') + ' autocapitalize="none">' +
        '<label class="nhan">Họ tên</label><input data-ht value="' + esc(t.hoTen) + '">' +
        '<label class="nhan">Quyền</label><select data-vt>' + vaiTro.map(function (v) { return '<option value="' + v.ma + '"' + (v.ma === t.vaiTro ? ' selected' : '') + '>' + esc(v.ten) + '</option>'; }).join('') + '</select>' +
        '<div class="goiy" data-mota></div>' +
        '<label class="nhan">Giới hạn đơn vị (chỉ sửa / khai báo tài sản của đơn vị này)</label><select data-dv><option value="-1">Mọi đơn vị</option>' + optDonVi(t.donVi) + '</select>' +
        '<label class="nhan">' + (moi ? 'Mật khẩu <b>*</b>' : 'Đặt lại mật khẩu (để trống: giữ nguyên)') + '</label><input type="password" data-mk autocomplete="new-password">' +
        (moi ? '' : '<label class="chon-o"><input type="checkbox" data-khoa' + (t.khoa ? ' checked' : '') + '> Khoá tài khoản (đăng xuất khỏi mọi thiết bị)</label>') +
        '<div class="chan">' + (moi ? '' : '<button class="nut do" type="button" data-xoa style="margin-right:auto">Xoá</button>') + '<button class="nut" type="button" data-huy>Huỷ</button><button class="nut chinh" type="button" data-luu>Lưu</button></div>');
      var vt = k.querySelector('[data-vt]');
      function moTa() { var v = vaiTro.filter(function (x) { return x.ma === vt.value; })[0]; k.querySelector('[data-mota]').textContent = v ? v.moTa : ''; }
      vt.onchange = moTa;
      moTa();
      k.querySelector('[data-huy]').onclick = function () { k.dong(); };
      k.querySelector('[data-luu]').onclick = function () {
        var kh = k.querySelector('[data-khoa]');
        api('POST', 'taikhoan', { moi: moi, ten: k.querySelector('[data-ten]').value.trim(), hoTen: k.querySelector('[data-ht]').value, vaiTro: vt.value, donVi: +k.querySelector('[data-dv]').value,
          matKhau: k.querySelector('[data-mk]').value, khoa: !!(kh && kh.checked) }).then(function (d) { k.dong(); thongBao('Đã lưu'); veDs(d); }, function (e) { thongBao(e.message, true); });
      };
      var bx = k.querySelector('[data-xoa]');
      if (bx) bx.onclick = function () {
        hoi('Xoá tài khoản', 'Xoá tài khoản "' + t.ten + '"?', 'Xoá', true).then(function (ok) {
          if (ok) api('DELETE', 'taikhoan?ten=' + encodeURIComponent(t.ten)).then(function (d) { k.dong(); veDs(d); }, function (e) { thongBao(e.message, true); });
        });
      };
    }
    nd.querySelector('[data-them]').onclick = function () { moTk(null); };
    api('GET', 'taikhoan').then(function (d) { if (con(lan)) veDs(d); }, function (e) { if (con(lan)) dsEl.innerHTML = '<div class="loi">' + esc(e.message) + '</div>'; });
  }

  // ------------------------------------------------------------------ cài đặt
  function trangCaiDat(nd, r, lan) {
    if (!quyen(3)) { nd.innerHTML = '<div class="loi">Cần tài khoản quản trị.</div>'; return; }
    var c = st.dm.caiDat;
    var o = function (ten, k, goiy) { return '<label class="nhan">' + ten + '</label><input data-k="' + k + '" value="' + esc(c[k]) + '">' + (goiy ? '<div class="goiy">' + goiy + '</div>' : ''); };
    nd.innerHTML = '<div class="tieude-trang"><h2>Cài đặt</h2></div><form class="the" style="max-width:720px">' +
      o('Tên công ty (in trên tem, biên bản)', 'tenCongTy') +
      o('Địa chỉ in trong mã QR', 'diaChiQr', 'Địa chỉ điện thoại dùng để vào máy chủ, vd <span class="ma">https://tenmien.vn:8080/taisan</span>. Để trống = địa chỉ đang mở (<span class="ma">' +
        esc(location.origin + location.pathname.replace(/[^/]*$/, '')) + '</span>). Tem đã in vẫn quét được trong trang "Quét QR" kể cả khi đổi địa chỉ.') +
      o('Địa danh ghi ngày lập biên bản', 'diaDanh') + o('Người lập biểu', 'nguoiLap') + o('Kế toán trưởng', 'keToanTruong') + o('Giám đốc', 'giamDoc') +
      '<label class="nhan">Nhắc tài sản chưa kiểm tra sau (ngày)</label><input data-k="ngayNhacKiemTra" type="number" min="1" max="3650" value="' + c.ngayNhacKiemTra + '">' +
      '<div class="chan" style="position:static"><button class="nut chinh" type="submit">Lưu cài đặt</button></div></form>' +
      '<p class="mo nho">Phiên bản ' + esc(st.nguoi.phienBanPhanMem) + '. Dữ liệu, ảnh và lịch sử nằm trong thư mục dữ liệu trên máy chủ (mặc định C:\\QuanLyTaiSanData) — sao lưu cả thư mục này định kỳ.</p>';
    nd.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var than = {};
      Array.prototype.forEach.call(this.querySelectorAll('[data-k]'), function (i) { than[i.getAttribute('data-k')] = i.type === 'number' ? +i.value : i.value; });
      api('POST', 'caidat', than).then(function (d) { st.dm = d; thongBao('Đã lưu cài đặt'); }, function (e2) { thongBao(e2.message, true); });
    });
  }

  // ------------------------------------------------------------------ menu "Thêm" trên điện thoại
  function trangKhac(nd) {
    var muc = [['donvi', 'Theo đơn vị', 'Tài sản của từng đội cấp nước, phòng ban', 0],
      ['dieuchuyen', 'Điều chuyển', 'Chuyển tài sản giữa đội, phòng ban; biên bản giao nhận', 0], ['hoatdong', 'Hoạt động', 'Kiểm tra, bảo dưỡng, kiểm kê gần đây', 0], ['nhan', 'In tem QR', 'Tem dán tài sản, tem trắng', 0], ['nhap', 'Nhập từ Excel', 'Đưa sổ tài sản vào phần mềm', 2],
      ['danhmuc', 'Danh mục', 'Loại tài sản, đơn vị quản lý', 0], ['taikhoan', 'Tài khoản', 'Đổi mật khẩu' + (quyen(3) ? ', quản lý người dùng' : ''), 0], ['caidat', 'Cài đặt', 'Tên công ty, địa chỉ QR, người ký', 3]];
    nd.innerHTML = '<div class="tieude-trang"><h2>Thêm</h2></div><div class="the menu-khac">' + muc.filter(function (m) { return quyen(m[3]); }).map(function (m) {
      return '<a href="#/' + m[0] + '">' + BT[BT_MENU[m[0]]] + '<div>' + esc(m[1]) + '<small>' + esc(m[2]) + '</small></div></a>';
    }).join('') + '<a href="#" data-dx>' + BT.dangxuat + '<div>Đăng xuất<small>' + esc(st.nguoi.hoTen || st.nguoi.ten) + ' · ' + esc(st.nguoi.tenVaiTro) + '</small></div></a></div>';
    nd.querySelector('[data-dx]').onclick = function (e) { e.preventDefault(); dangXuat(); };
  }

  // ------------------------------------------------------------------ khởi động
  fetch('api/ping', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (p) { st.ping = p; }, function () { }).then(function () {
    if (!st.token) { veDangNhap(); return; }
    api('GET', 'toi').then(function (n) {
      st.nguoi = n;
      ghi(KHOA_NGUOI, JSON.stringify(n));
      ve();
    }, function (e) {
      if (!st.token) return;   // 401: đã về trang đăng nhập
      app.innerHTML = '<div class="dangnhap"><div class="loi">' + esc(e.message) + '</div><button class="nut chinh" type="button">Thử lại</button></div>';
      app.querySelector('button').onclick = function () { location.reload(); };
    });
  });
})();
