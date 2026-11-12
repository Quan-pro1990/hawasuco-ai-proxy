/* Khung ứng dụng: lưu trữ, điều hướng, hộp thoại, thông báo, biểu đồ, xuất Excel, in. */
(function () {
  'use strict';
  var TL = window.TL, XL = window.XL;
  var App = window.App = { trang: {}, TL: TL, XL: XL };

  /* ================= Tiện ích ================= */
  App.$ = function (s, el) { return (el || document).querySelector(s); };
  App.$$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  App.h = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };
  var NF0 = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
  var NF2 = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
  App.tien = function (n) { return NF0.format(Math.round(+n || 0)); };
  App.so = function (n) { return NF2.format(+n || 0); };
  App.soRong = function (n) { return n ? NF2.format(n) : ''; };
  App.tienRong = function (n) { return n ? NF0.format(Math.round(n)) : ''; };
  App.gon = function (n) { // số rút gọn cho trục biểu đồ
    n = +n || 0; var a = Math.abs(n);
    if (a >= 1e9) return NF2.format(Math.round(n / 1e7) / 100) + ' tỷ';
    if (a >= 1e6) return NF2.format(Math.round(n / 1e5) / 10) + ' tr';
    if (a >= 1e3) return NF0.format(n / 1e3) + ' N';
    return NF0.format(n);
  };
  App.docSo = function (s) {
    if (typeof s === 'number') return s;
    s = String(s == null ? '' : s).trim().replace(/\s|đ|vnđ|vnd/gi, '');
    if (!s) return 0;
    var am = /^-/.test(s); s = s.replace(/^[-+]/, '');
    var cham = s.indexOf('.') >= 0, phay = s.indexOf(',') >= 0;
    if (cham && phay) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (cham) { if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); }
    else if (phay) { if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, ''); else s = s.replace(',', '.'); }
    var n = parseFloat(s);
    return isNaN(n) ? 0 : (am ? -n : n);
  };
  App.uid = function () { return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };
  App.boDau = function (s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  };
  App.timKhop = function (chuoi, tu) { return App.boDau(chuoi).toLowerCase().indexOf(App.boDau(tu).toLowerCase().trim()) >= 0; };
  App.homNay = function () { var d = new Date(); return TL.iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
  App.tenKy = function (y, m) { return 'Tháng ' + TL.pad(m) + '/' + y; };
  App.tenFile = function (s) { return App.boDau(s).replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''); };

  /* ================= Biểu tượng ================= */
  var P = {
    tongquan: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    nhanvien: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.6c2.4.2 4.2 1.9 4.9 5.4"/>',
    chamcong: '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="M8 14.5l2.5 2.5 5-5"/>',
    vaora: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    bangluong: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>',
    phieuluong: '<path d="M6 2.5h9l4 4V21.5H6z"/><path d="M15 2.5v4h4M9 11h7M9 14.5h7M9 18h4"/>',
    baocao: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
    danhmuc: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    caidat: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    them: '<path d="M12 5v14M5 12h14"/>',
    tai: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
    nhap: '<path d="M12 15V3M7 8l5-5 5 5M4 21h16"/>',
    in: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
    khoa: '<rect x="4" y="10.5" width="16" height="10.5" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
    mo: '<rect x="4" y="10.5" width="16" height="10.5" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 7.7-1.5"/>',
    xoa: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    sua: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    tim: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    hoantac: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    dien: '<path d="M4 20l6-6M14 4l6 6-8 8-6-6z"/>',
    ngan: '<path d="M3 10l9-6 9 6M5 10v8M19 10v8M9 10v8M15 10v8M3 20h18"/>',
    quyetdinh: '<path d="M7 3h10v18H7z"/><path d="M10 7h4M10 11h4M10 15h2"/><circle cx="16.5" cy="17.5" r="2.5"/>',
    nghiphep: '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M9 14l6 4M15 14l-6 4"/>',
    chuyen: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
    bac: '<path d="M4 20h4v-5h4v-5h4V5h4"/>',
    cocau: '<circle cx="12" cy="12" r="9"/><path d="M12 3v9l7 5"/>',
    theodoi: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 12.5l2 2 4-4"/>',
    sach: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M8 7h8M8 11h6"/>',
    sang: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    toi: '<path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/>',
    hoi: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2.2-2.4 3.7"/><path d="M12 17.2h.01"/>'
  };
  App.icon = function (ten) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[ten] || '') + '</svg>';
  };

  /* ================= Lưu trữ ================= */
  var KHOA = 'ChamCongTinhLuong_v1';
  var hen = null;
  App.taiDuLieu = function () {
    var s = null;
    try { s = localStorage.getItem(KHOA); } catch (e) { /* trình duyệt chặn */ }
    if (s) {
      try { App.db = TL.chuanHoa(JSON.parse(s)); return; } catch (e) { console.error(e); }
    }
    App.db = App.taoMau ? App.taoMau() : TL.duLieuMoi();
    App.luuNgay();
  };
  App.luuNgay = function () {
    clearTimeout(hen); hen = null;
    try { localStorage.setItem(KHOA, JSON.stringify(App.db)); App.loiLuu = false; }
    catch (e) { if (!App.loiLuu) App.bao('Không lưu được dữ liệu vào trình duyệt: ' + e.message + '. Hãy Sao lưu ra file ngay.', 'loi'); App.loiLuu = true; }
  };
  App.luu = function () { clearTimeout(hen); hen = setTimeout(App.luuNgay, 300); };
  window.addEventListener('beforeunload', function () { if (hen) App.luuNgay(); });

  /* ================= Thông báo & hộp thoại ================= */
  App.bao = function (msg, loai) {
    var box = App.$('.thongbao');
    if (!box) { box = document.createElement('div'); box.className = 'thongbao'; document.body.appendChild(box); }
    var d = document.createElement('div');
    d.className = loai || '';
    d.textContent = msg;
    box.appendChild(d);
    setTimeout(function () { d.remove(); }, loai === 'loi' ? 6000 : 3200);
  };

  App.hop = function (o) {
    var nen = document.createElement('div');
    nen.className = 'mo-nen';
    nen.innerHTML = '<div class="mo-hop ' + (o.co || '') + '" role="dialog" aria-modal="true">' +
      '<div class="mo-dau"><h3>' + App.h(o.tieuDe || '') + '</h3><button class="dong" title="Đóng" aria-label="Đóng">×</button></div>' +
      '<div class="mo-than"></div>' + ((o.nut && o.nut.length) ? '<div class="mo-chan"></div>' : '') + '</div>';
    var than = App.$('.mo-than', nen);
    if (typeof o.than === 'string') than.innerHTML = o.than; else if (o.than) than.appendChild(o.than);
    var daDong = false;
    function dong() { if (daDong) return; daDong = true; nen.remove(); document.removeEventListener('keydown', phim, true); if (o.khiDong) o.khiDong(); }
    function phim(e) { if (e.key === 'Escape') { e.stopPropagation(); dong(); } }
    document.addEventListener('keydown', phim, true);
    App.$('.dong', nen).onclick = dong;
    nen.addEventListener('mousedown', function (e) { if (e.target === nen) nen._ngoai = true; });
    nen.addEventListener('click', function (e) { if (e.target === nen && nen._ngoai && !o.giu) dong(); nen._ngoai = false; });
    if (o.nut) {
      var chan = App.$('.mo-chan', nen);
      o.nut.forEach(function (n) {
        var b = document.createElement('button');
        b.className = 'nut ' + (n.loai || '');
        b.textContent = n.ten;
        b.onclick = function () { var kq = n.bam ? n.bam(than, dong) : undefined; if (kq !== false) dong(); };
        chan.appendChild(b);
      });
    }
    document.body.appendChild(nen);
    if (o.moRa) o.moRa(than, dong);
    var f = App.$('input:not([type=hidden]):not([readonly]), select, textarea', than);
    if (f && !o.khongFocus) setTimeout(function () { f.focus(); }, 30);
    return { el: than, dong: dong };
  };

  App.xacNhan = function (msg, o) {
    o = o || {};
    return new Promise(function (ok) {
      var xong = false;
      App.hop({
        tieuDe: o.tieuDe || 'Xác nhận', co: 'hep', than: '<p style="margin:0">' + msg + '</p>', khongFocus: true,
        nut: [{ ten: 'Hủy', bam: function () { xong = true; ok(false); } },
              { ten: o.nut || 'Đồng ý', loai: o.nguy ? 'chinh nguy-hop' : 'chinh', bam: function () { xong = true; ok(true); } }],
        khiDong: function () { if (!xong) ok(false); }
      });
    });
  };

  /* ================= Tooltip ================= */
  var tip;
  App.hienTip = function (e, html) {
    if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; document.body.appendChild(tip); }
    tip.innerHTML = html;
    tip.style.display = 'block';
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var x = e.clientX + 14, y = e.clientY + 14;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - 14;
    if (y + h > window.innerHeight - 8) y = e.clientY - h - 14;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  };
  App.anTip = function () { if (tip) tip.style.display = 'none'; };
  App.dongTip = function (cap) { // cap: [[nhãn, giá trị], ...]
    return cap.map(function (c) { return '<div class="d"><span>' + App.h(c[0]) + '</span><span>' + App.h(c[1]) + '</span></div>'; }).join('');
  };

  /* ================= Biểu đồ ================= */
  function tronDep(max) {
    if (max <= 0) return 1;
    var mu = Math.pow(10, Math.floor(Math.log10(max))), n = max / mu;
    var b = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return b * mu;
  }
  /** Biểu đồ cột (1 chuỗi). du: [{nhan, gt, tip, noiBat}] */
  App.bieuDoCot = function (el, du, o) {
    o = o || {};
    var W = Math.max(320, el.clientWidth || 600), H = o.cao || 240;
    var m = { t: 12, r: 8, b: 26, l: 56 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var max = tronDep(Math.max.apply(null, du.map(function (d) { return d.gt; }).concat([0])) * 1.05);
    var buoc = iw / Math.max(1, du.length), bw = Math.min(40, buoc * 0.6);
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + App.h(o.nhan || 'Biểu đồ') + '">';
    for (var i = 0; i <= 4; i++) {
      var v = max * i / 4, y = m.t + ih - ih * i / 4;
      s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y + '" y2="' + y + '" style="stroke:' + (i ? 'var(--duong)' : 'var(--vien-dam)') + '"/>';
      s += '<text x="' + (m.l - 8) + '" y="' + (y + 4) + '" text-anchor="end" font-size="11" style="fill:var(--mo)">' + App.gon(v) + '</text>';
    }
    du.forEach(function (d, i) {
      var cx = m.l + buoc * i + buoc / 2, h = max ? ih * d.gt / max : 0, x = cx - bw / 2, y = m.t + ih - h;
      s += '<rect class="vung" data-i="' + i + '" x="' + (m.l + buoc * i) + '" y="' + m.t + '" width="' + buoc + '" height="' + ih + '" fill="transparent"/>';
      if (h > 0) {
        var r = Math.min(4, bw / 2, h);
        s += '<path d="M' + x + ' ' + (y + h) + 'V' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'H' + (x + bw - r) + 'Q' + (x + bw) + ' ' + y + ' ' + (x + bw) + ' ' + (y + r) + 'V' + (y + h) + 'Z" fill="' + (d.noiBat || !o.noiBat ? 'var(--s1)' : '#9ec5f4') + '" pointer-events="none"/>';
      }
      s += '<text x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" style="fill:' + (d.noiBat ? 'var(--chu)' : 'var(--mo)') + '"' + (d.noiBat ? ' font-weight="600"' : '') + '>' + App.h(d.nhan) + '</text>';
    });
    s += '<rect class="dong-hl" x="0" y="' + m.t + '" width="0" height="' + ih + '" fill="rgba(42,120,214,.07)" pointer-events="none"/>';
    s += '</svg>';
    el.innerHTML = '<div class="bd">' + s + '</div>';
    var svg = App.$('svg', el), hl = App.$('.dong-hl', el);
    svg.addEventListener('mousemove', function (e) {
      var t = e.target.closest('.vung');
      if (!t) { App.anTip(); hl.setAttribute('width', 0); return; }
      var d = du[+t.dataset.i];
      hl.setAttribute('x', t.getAttribute('x')); hl.setAttribute('width', t.getAttribute('width'));
      App.hienTip(e, '<b>' + App.h(d.tieuDe || d.nhan) + '</b>' + App.dongTip(d.tip || [[o.nhan || 'Giá trị', App.tien(d.gt)]]));
    });
    svg.addEventListener('mouseleave', function () { App.anTip(); hl.setAttribute('width', 0); });
    if (o.bam) svg.addEventListener('click', function (e) { var t = e.target.closest('.vung'); if (t) o.bam(du[+t.dataset.i]); });
  };

  /** Biểu đồ cột chồng. cot: [{nhan, tieuDe, gt: [giá trị theo chuỗi], noiBat}], chuoi: [{ten, mau}]
      o: { cao, soNguyen (trục số nguyên), donVi, bam(cot, i) } – có chú thích, rê chuột xem từng chuỗi */
  App.bieuDoCotChong = function (el, cot, chuoi, o) {
    o = o || {};
    var W = Math.max(320, el.clientWidth || 600), H = o.cao || 240, m = { t: 12, r: 8, b: 26, l: 40 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b, GAP = 2;
    var tong = cot.map(function (c) { return c.gt.reduce(function (s, v) { return s + (v || 0); }, 0); });
    var maxT = Math.max.apply(null, tong.concat([0]));
    var max = o.soNguyen ? Math.max(4, Math.ceil(maxT / 4) * 4) : tronDep(maxT * 1.05);
    var buoc = iw / Math.max(1, cot.length), bw = Math.min(24, buoc * 0.6);
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + App.h(o.nhan || 'Biểu đồ') + '">';
    for (var i = 0; i <= 4; i++) {
      var v = max * i / 4, y = m.t + ih - ih * i / 4;
      s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y + '" y2="' + y + '" style="stroke:' + (i ? 'var(--duong)' : 'var(--vien-dam)') + '"/>';
      s += '<text x="' + (m.l - 8) + '" y="' + (y + 4) + '" text-anchor="end" font-size="11" style="fill:var(--mo)">' + (o.soNguyen ? App.so(v) : App.gon(v)) + '</text>';
    }
    cot.forEach(function (c, ci) {
      var x0 = m.l + buoc * ci, x = x0 + (buoc - bw) / 2, day = m.t + ih, cuoi = -1;
      if (c.noiBat) s += '<rect x="' + x0 + '" y="' + m.t + '" width="' + buoc + '" height="' + ih + '" fill="rgba(42,120,214,.09)"/>';
      c.gt.forEach(function (v, j) { if (v > 0) cuoi = j; });
      c.gt.forEach(function (v, j) {
        if (!(v > 0)) return;
        var hh = ih * v / max, top = day - hh, cao = Math.max(1, hh - (j === cuoi ? 0 : GAP));   // khe 2px giữa các đoạn
        if (j === cuoi) {
          var r = Math.min(4, bw / 2, cao);
          s += '<path d="M' + x + ' ' + (top + cao) + 'V' + (top + r) + 'Q' + x + ' ' + top + ' ' + (x + r) + ' ' + top + 'H' + (x + bw - r) + 'Q' + (x + bw) + ' ' + top + ' ' + (x + bw) + ' ' + (top + r) + 'V' + (top + cao) + 'Z" fill="' + chuoi[j].mau + '" pointer-events="none"/>';
        } else s += '<rect x="' + x + '" y="' + (top + GAP) + '" width="' + bw + '" height="' + cao + '" fill="' + chuoi[j].mau + '" pointer-events="none"/>';
        day = top;
      });
      if (tong[ci] > 0 && ih * tong[ci] / max > 0) s += '<text x="' + (x + bw / 2) + '" y="' + (day - 4) + '" text-anchor="middle" font-size="11" font-weight="600" style="fill:var(--chu)" pointer-events="none">' + App.so(tong[ci]) + '</text>';
      s += '<rect class="vung" data-i="' + ci + '" x="' + x0 + '" y="' + m.t + '" width="' + buoc + '" height="' + (ih + m.b) + '" fill="transparent"' + (o.bam ? ' style="cursor:pointer"' : '') + '/>';
      s += '<text x="' + (x0 + buoc / 2) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" style="fill:' + (c.noiBat ? 'var(--chu)' : 'var(--mo)') + '"' + (c.noiBat ? ' font-weight="600"' : '') + ' pointer-events="none">' + App.h(c.nhan) + '</text>';
    });
    s += '<rect class="dong-hl" x="0" y="' + m.t + '" width="0" height="' + ih + '" fill="rgba(42,120,214,.07)" pointer-events="none"/></svg>';
    el.innerHTML = '<div class="bd">' + s + '</div><div class="chu-thich">' + chuoi.map(function (c) { return '<span><i style="background:' + c.mau + '"></i>' + App.h(c.ten) + '</span>'; }).join('') + '</div>';
    var svg = App.$('svg', el), hl = App.$('.dong-hl', el);
    svg.addEventListener('mousemove', function (e) {
      var t = e.target.closest('.vung');
      if (!t) { App.anTip(); hl.setAttribute('width', 0); return; }
      var ci = +t.dataset.i, c = cot[ci];
      hl.setAttribute('x', t.getAttribute('x')); hl.setAttribute('width', t.getAttribute('width'));
      App.hienTip(e, '<b>' + App.h(c.tieuDe || c.nhan) + '</b>' + chuoi.map(function (ch, j) {
        return '<div class="d"><span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px;background:' + ch.mau + '"></i>' + App.h(ch.ten) + '</span><span>' + App.so(c.gt[j] || 0) + '</span></div>';
      }).join('') + App.dongTip([['Tổng', App.so(tong[ci]) + (o.donVi ? ' ' + o.donVi : '')]]));
    });
    svg.addEventListener('mouseleave', function () { App.anTip(); hl.setAttribute('width', 0); });
    if (o.bam) svg.addEventListener('click', function (e) { var t = e.target.closest('.vung'); if (t) { App.anTip(); o.bam(cot[+t.dataset.i], +t.dataset.i); } });
  };

  /** Thanh ngang (HTML). du: [{nhan, gt, phu, tip}] */
  App.bieuDoNgang = function (el, du, o) {
    o = o || {};
    var max = Math.max.apply(null, du.map(function (d) { return d.gt; }).concat([1]));
    el.innerHTML = du.length ? du.map(function (d, i) {
      return '<div class="bdn" data-i="' + i + '" style="display:grid;grid-template-columns:minmax(90px,38%) 1fr auto;gap:10px;align-items:center;padding:5px 0">' +
        '<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + App.h(d.nhan) + '">' + App.h(d.nhan) + (d.phu ? ' <span class="mo nho">' + App.h(d.phu) + '</span>' : '') + '</div>' +
        '<div style="height:14px;background:var(--duong);border-radius:0 4px 4px 0"><div style="height:100%;width:' + Math.max(0.5, d.gt / max * 100) + '%;background:' + (d.mau || 'var(--s1)') + ';border-radius:0 4px 4px 0"></div></div>' +
        '<div style="font-variant-numeric:tabular-nums;font-weight:600;min-width:70px;text-align:right">' + (o.dinhDang ? o.dinhDang(d.gt) : App.gon(d.gt)) + '</div></div>';
    }).join('') : '<div class="trong">Chưa có số liệu</div>';
    el.onmousemove = function (e) {
      var r = e.target.closest('.bdn'); if (!r) { App.anTip(); return; }
      var d = du[+r.dataset.i];
      App.hienTip(e, '<b>' + App.h(d.nhan) + '</b>' + App.dongTip(d.tip || [['Giá trị', App.tien(d.gt)]]));
    };
    el.onmouseleave = App.anTip;
  };

  /** Thanh cơ cấu 100%. phan: [{nhan, gt, mau}] */
  App.thanhCoCau = function (el, phan) {
    var tong = phan.reduce(function (s, p) { return s + Math.max(0, p.gt); }, 0) || 1;
    el.innerHTML = '<div style="display:flex;height:22px;border-radius:5px;overflow:hidden;gap:2px;background:var(--mat)">' +
      phan.filter(function (p) { return p.gt > 0; }).map(function (p) {
        return '<div class="ccau" data-n="' + App.h(p.nhan) + '" data-g="' + p.gt + '" style="flex:' + p.gt + ' 1 0;background:' + p.mau + '"></div>';
      }).join('') + '</div>' +
      '<div class="chu-thich">' + phan.map(function (p) {
        return '<span><i style="background:' + p.mau + '"></i>' + App.h(p.nhan) + ': <b>' + App.tien(p.gt) + '</b> (' + App.so(Math.round(p.gt / tong * 1000) / 10) + '%)</span>';
      }).join('') + '</div>';
    el.onmousemove = function (e) {
      var r = e.target.closest('.ccau'); if (!r) { App.anTip(); return; }
      App.hienTip(e, '<b>' + App.h(r.dataset.n) + '</b>' + App.dongTip([['Số tiền', App.tien(+r.dataset.g)], ['Tỷ trọng', App.so(Math.round(r.dataset.g / tong * 1000) / 10) + '%']]));
    };
    el.onmouseleave = App.anTip;
  };

  /* ================= Xuất Excel ================= */
  var K = {
    cty: { b: true, sz: 11 },
    dc: { i: true, sz: 10 },
    tieuDe: { b: true, sz: 15, ngang: 'center' },
    phuDe: { i: true, ngang: 'center' },
    th: { b: true, vien: true, ngang: 'center', doc: 'center', xuong: true, nen: '#DDE7F3' },
    chu: { vien: true },
    giua: { vien: true, ngang: 'center' },
    so: { vien: true, so: '#,##0' },
    cong: { vien: true, so: 'General', ngang: 'center' },
    ngay: { vien: true, ngang: 'center' },
    tong: { b: true, vien: true, nen: '#EEF3F9' },
    tongSo: { b: true, vien: true, nen: '#EEF3F9', so: '#,##0' },
    tongCong: { b: true, vien: true, nen: '#EEF3F9', so: 'General', ngang: 'center' },
    nhom: { b: true, vien: true, nen: '#F3F6FA' },
    nhomSo: { b: true, vien: true, nen: '#F3F6FA', so: '#,##0' },
    kyTen: { b: true, ngang: 'center' },
    kyGhi: { i: true, ngang: 'center' }
  };
  App.KIEU = K;

  /** Tạo 1 sheet dạng bảng có đầu đề công ty, tiêu đề, (nhóm) cột, dòng tổng và chữ ký. */
  App.sheetBang = function (o) {
    var db = App.db, cot = o.cot, n = cot.length, dong = [], gop = [], cao = {};
    var cuoi = XL.cotChu(n - 1);
    var r0 = [{ v: (db.congTy.ten || '').toUpperCase(), s: K.cty }], r1 = [{ v: db.congTy.diaChi ? 'Địa chỉ: ' + db.congTy.diaChi : '', s: K.dc }];
    if (o.quocHieu && n >= 8) {
      var qh = Math.max(0, n - Math.max(6, Math.round(n / 3)));
      r0[qh] = { v: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', s: { b: true, ngang: 'center' } };
      r1[qh] = { v: 'Độc lập - Tự do - Hạnh phúc', s: { b: true, ngang: 'center' } };
      gop.push(XL.oRef(0, qh) + ':' + XL.oRef(0, n - 1), XL.oRef(1, qh) + ':' + XL.oRef(1, n - 1));
      gop.push('A1:' + XL.cotChu(Math.max(1, qh - 1)) + '1', 'A2:' + XL.cotChu(Math.max(1, qh - 1)) + '2');
      r0[0].s = { b: true, sz: 12, ngang: 'center' }; r1[0].s = { i: true, sz: 10, ngang: 'center' };
    }
    dong.push(r0, r1);
    dong.push([]);
    dong.push([{ v: o.tieuDe, s: K.tieuDe }]); gop.push('A4:' + cuoi + '4'); cao[3] = 24;
    dong.push([{ v: o.phuDe || '', s: K.phuDe }]); gop.push('A5:' + cuoi + '5');
    (o.dongThem || []).forEach(function (t, i) {
      gop.push(XL.oRef(dong.length, 0) + ':' + XL.oRef(dong.length, n - 1));
      dong.push([{ v: t, s: i === 0 ? { b: true } : {} }]);
    });
    dong.push([]);
    var coNhom = cot.some(function (c) { return c.nhom; });
    var r1 = dong.length;
    var h1 = [], h2 = [];
    if (coNhom) {
      var i = 0;
      while (i < n) {
        var c = cot[i];
        if (c.nhom) {
          var j = i; while (j + 1 < n && cot[j + 1].nhom === c.nhom) j++;
          for (var k = i; k <= j; k++) { h1[k] = { v: k === i ? c.nhom : '', s: K.th }; h2[k] = { v: cot[k].t, s: K.th }; }
          if (j > i) gop.push(XL.oRef(r1, i) + ':' + XL.oRef(r1, j));
          i = j + 1;
        } else {
          h1[i] = { v: c.t, s: K.th }; h2[i] = { v: '', s: K.th };
          gop.push(XL.oRef(r1, i) + ':' + XL.oRef(r1 + 1, i));
          i++;
        }
      }
      dong.push(h1, h2); cao[r1] = 22; cao[r1 + 1] = 36;
    } else { dong.push(cot.map(function (c) { return { v: c.t, s: K.th }; })); cao[r1] = 36; }
    var batDau = dong.length;
    function giaTri(c, r, i) { return c.f ? c.f(r, i) : r[c.k]; }
    var stt = 0;
    o.dong.forEach(function (r) {
      if (r._kieu === 'nhom') {
        var row = [{ v: r._nhan, s: K.nhom }];
        for (var x = 1; x < n; x++) row.push({ v: '', s: K.nhom });
        gop.push(XL.oRef(dong.length, 0) + ':' + XL.oRef(dong.length, n - 1));
        dong.push(row); return;
      }
      var laTong = r._kieu === 'tong';
      if (!laTong) stt++;
      dong.push(cot.map(function (c, ci) {
        var kieu0 = c.kieu || 'chu', laSo = kieu0 === 'so' || kieu0 === 'cong';
        var v = c.stt ? (laTong ? '' : stt) : (laTong && ci === (o.cotNhanTong || 1) ? r._nhan : (laTong && (!laSo || c.khongTong) ? '' : giaTri(c, r, stt)));
        var kieu = c.kieu || 'chu';
        var s = laTong ? (kieu === 'so' ? K.nhomSo : kieu === 'cong' ? K.tongCong : K.nhom) : (K[kieu] || K.chu);
        if (c.nen && !laTong) { s = Object.assign({}, s, { nen: typeof c.nen === 'function' ? c.nen(r) : c.nen }); if (!s.nen) delete s.nen; }
        return { v: v === 0 && (kieu === 'so' || kieu === 'cong') ? '' : v, s: s };
      }));
    });
    if (o.tong) {
      var t = o.tong;
      dong.push(cot.map(function (c, ci) {
        var kieu = c.kieu || 'chu';
        var v = ci === (o.cotNhanTong || 1) ? (t._nhan || 'TỔNG CỘNG') : (c.khongTong || c.stt || !(kieu === 'so' || kieu === 'cong') ? '' : giaTri(c, t));
        return { v: v === 0 ? '' : v, s: kieu === 'so' ? K.tongSo : kieu === 'cong' ? K.tongCong : K.tong };
      }));
    }
    if (o.dongCuoi) { dong.push([], [{ v: o.dongCuoi, s: { i: true, b: true } }]); }
    if (o.chuKy !== false) {
      var ct = App.db.congTy, hn = new Date();
      dong.push([]);
      var r = dong.length, ba = [0, Math.floor(n / 2) - 1, Math.max(n - 4, 2)];
      if (n < 6) ba = [0, 2, 4];
      var rowNgay = []; rowNgay[ba[2]] = { v: (ct.diaDanh || '.......') + ', ngày ' + hn.getDate() + ' tháng ' + (hn.getMonth() + 1) + ' năm ' + hn.getFullYear(), s: K.kyGhi };
      dong.push(rowNgay);
      var tieu = [], ghi = [], ten = [];
      [['NGƯỜI LẬP BIỂU', ct.nguoiLap], ['KẾ TOÁN TRƯỞNG', ct.keToan], ['GIÁM ĐỐC', ct.giamDoc]].forEach(function (x, i) {
        tieu[ba[i]] = { v: x[0], s: K.kyTen }; ghi[ba[i]] = { v: i === 2 ? '(Ký, họ tên, đóng dấu)' : '(Ký, họ tên)', s: K.kyGhi }; ten[ba[i]] = { v: x[1] || '', s: K.kyTen };
      });
      dong.push(tieu, ghi, [], [], [], ten);
      [r + 1, r + 2, r + 6].forEach(function (rr) {
        ba.forEach(function (c0, i) {
          var c1 = i < 2 ? Math.max(c0, ba[i + 1] - 1) : Math.min(n - 1, c0 + 3);
          if (c1 > c0) gop.push(XL.oRef(rr, c0) + ':' + XL.oRef(rr, c1));
        });
      });
      gop.push(XL.oRef(r, ba[2]) + ':' + XL.oRef(r, Math.min(n - 1, ba[2] + 3)));
    }
    return {
      ten: o.ten || 'Sheet1', dong: dong, gop: gop, cao: cao, ngang: o.ngang !== false,
      cot: cot.map(function (c) { return c.w || 12; }), co: { r: batDau, c: o.coCot || 0 }
    };
  };
  App.xuatExcel = function (tenFile, sheets) {
    try {
      XL.taiXuong(App.tenFile(tenFile) + '.xlsx', XL.ghi(sheets));
      App.bao('Đã xuất file ' + tenFile + '.xlsx', 'tot');
    } catch (e) { console.error(e); App.bao('Lỗi xuất Excel: ' + e.message, 'loi'); }
  };

  /* ----- Xem trước / in đúng nội dung file Excel sắp xuất (sheet do App.sheetBang hoặc tự dựng: dong, gop, cot) ----- */
  function giaiRef(ref) {
    var m = /^([A-Z]+)(\d+)$/.exec(ref); if (!m) return null;
    var c = 0; for (var i = 0; i < m[1].length; i++) c = c * 26 + (m[1].charCodeAt(i) - 64);
    return { r: +m[2] - 1, c: c - 1 };
  }
  function giaTriO(o) {
    var v = o && o.v, s = (o && o.s) || {};
    if (v == null || v === '') return '';
    if (typeof v === 'number') return s.so && s.so !== 'General' ? App.tien(v) : App.so(v);
    return App.h(v).replace(/\n/g, '<br>');
  }
  /** 1 sheet -> bảng HTML (gộp ô, đậm, nghiêng, căn lề, nền, viền, độ rộng cột) */
  App.sheetHtml = function (sh) {
    var dong = sh.dong || [], n = (sh.cot || []).length;
    dong.forEach(function (r) { if (r && r.length > n) n = r.length; });
    var bo = {}, gop = {};
    (sh.gop || []).forEach(function (g) {
      var p = g.split(':'), a = giaiRef(p[0]), b = giaiRef(p[1] || p[0]); if (!a || !b) return;
      gop[a.r + ',' + a.c] = { rs: b.r - a.r + 1, cs: b.c - a.c + 1 };
      for (var r = a.r; r <= b.r; r++) for (var c = a.c; c <= b.c; c++) if (r !== a.r || c !== a.c) bo[r + ',' + c] = 1;
    });
    var rong = [], tongRong = 0;
    for (var c = 0; c < n; c++) { rong[c] = Math.round(((sh.cot || [])[c] || 10) * 7 + 8); tongRong += rong[c]; }
    var s = '<table class="xt-bang" style="width:' + tongRong + 'px"><colgroup>' + rong.map(function (w) { return '<col style="width:' + w + 'px">'; }).join('') + '</colgroup>';
    var coGiaTri = function (o) { return o && o.v != null && o.v !== ''; };
    dong.forEach(function (r, ri) {
      r = r || [];
      var trong = !r.some(function (o) { return o && ((o.v != null && o.v !== '') || (o.s && o.s.vien)); });
      s += '<tr' + (trong ? ' class="xt-trong"' : '') + '>';
      for (var c2 = 0; c2 < n; c2++) {
        if (bo[ri + ',' + c2]) continue;
        var o = r[c2], st = (o && o.s) || {}, g = gop[ri + ',' + c2], css = [];
        // chữ không viền, ô bên phải trống: tràn sang như Excel
        if (!g && coGiaTri(o) && typeof o.v === 'string' && !st.vien && st.ngang !== 'right') {
          var k = c2 + 1;
          while (k < n && !coGiaTri(r[k]) && !(r[k] && r[k].s && r[k].s.vien) && !bo[ri + ',' + k] && !gop[ri + ',' + k]) k++;
          if (k - c2 > 1) { g = { rs: 1, cs: k - c2 }; for (var q = c2 + 1; q < k; q++) bo[ri + ',' + q] = 1; }
        }
        if (st.b) css.push('font-weight:700');
        if (st.i) css.push('font-style:italic');
        if (st.sz && st.sz !== 11) css.push('font-size:' + Math.round(st.sz / 11 * 100) + '%');
        var ngang = st.ngang || (o && typeof o.v === 'number' ? 'right' : '');
        if (ngang) css.push('text-align:' + ngang);
        if (st.nen) css.push('background:' + st.nen);
        if (st.mau) css.push('color:' + st.mau);
        if (st.xuong) css.push('white-space:normal');
        s += '<td' + (g ? (g.rs > 1 ? ' rowspan="' + g.rs + '"' : '') + (g.cs > 1 ? ' colspan="' + g.cs + '"' : '') : '') + (st.vien ? ' class="v"' : '') +
          (css.length ? ' style="' + css.join(';') + '"' : '') + '>' + giaTriO(o) + '</td>';
      }
      s += '</tr>';
    });
    return s + '</table>';
  };
  /** In các sheet (mỗi sheet 1 trang mới); có sheet khổ ngang thì in khổ ngang */
  App.inSheets = function (shs) {
    var ngang = shs.some(function (x) { return x.ngang !== false; });
    App.inNoiDung('<div class="xt-in">' + shs.map(function (x) { return '<div class="trang">' + App.sheetHtml(x) + '</div>'; }).join('') + '</div>', ngang ? false : true);
  };
  /** Xem trước nội dung file Excel (mỗi sheet 1 tab) – từ đây In hoặc Xuất Excel */
  App.xemTruocExcel = function (tenFile, shs, o) {
    o = o || {};
    var chon = 0;
    return App.hop({
      tieuDe: 'Xem trước: ' + (o.tieuDe || tenFile), co: 'toan', giu: true,
      than: (shs.length > 1 ? '<div class="tabs xt-tab">' + shs.map(function (x, i) { return '<button data-sh="' + i + '"' + (i ? '' : ' class="chon"') + '>' + App.h(x.ten) + '</button>'; }).join('') + '</div>' : '') +
        '<div class="xt-khung"></div>',
      moRa: function (el) {
        var ve = function () { App.$('.xt-khung', el).innerHTML = App.sheetHtml(shs[chon]); };
        ve();
        var tab = App.$('.xt-tab', el);
        if (tab) tab.onclick = function (e) {
          var b = e.target.closest('[data-sh]'); if (!b) return;
          chon = +b.dataset.sh;
          App.$$('[data-sh]', tab).forEach(function (x) { x.classList.toggle('chon', x === b); });
          ve();
        };
      },
      nut: [{ ten: 'Đóng' },
        { ten: shs.length > 1 ? 'In trang này' : 'In', bam: function () { App.inSheets([shs[chon]]); return false; } }]
        .concat(shs.length > 1 ? [{ ten: 'In tất cả (' + shs.length + ' bảng)', bam: function () { App.inSheets(shs); return false; } }] : [])
        .concat([{ ten: 'Xuất Excel', loai: 'chinh', bam: function () { if (o.xuat) o.xuat(); else App.xuatExcel(tenFile, shs); return false; } }])
    });
  };

  /* ----- Giao diện Sáng / Tối / Theo Windows: lưu theo từng máy (localStorage), khi in luôn màu sáng ----- */
  var GIAO_DIEN = { sang: 'Sáng', toi: 'Tối (dịu mắt)', tudong: 'Theo Windows' };
  var mqToi = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  App.GIAO_DIEN = GIAO_DIEN;
  App.giaoDien = function () { var g = 'sang'; try { g = localStorage.getItem('ChamCong_giaoDien') || 'sang'; } catch (e) { /* bỏ qua */ } return GIAO_DIEN[g] ? g : 'sang'; };
  App.giaoDienToi = function () { return document.documentElement.classList.contains('gd-toi'); };
  function apGiaoDien() {
    var g = App.giaoDien(), toi = g === 'toi' || (g === 'tudong' && !!(mqToi && mqToi.matches)), d = document.documentElement;
    d.setAttribute('data-giaodien', g);
    d.classList.toggle('gd-toi', toi);
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', toi ? '#0b1520' : '#15324d');
    nutGiaoDien();
  }
  function nutGiaoDien() {
    var b = document.getElementById('tb-gd'); if (!b) return;
    var toi = App.giaoDienToi();
    b.innerHTML = App.icon(toi ? 'sang' : 'toi');
    b.title = 'Giao diện đang dùng: ' + GIAO_DIEN[App.giaoDien()] + (App.giaoDien() === 'tudong' ? (toi ? ' (tối)' : ' (sáng)') : '') + ' – bấm để chuyển sang ' + (toi ? 'Sáng' : 'Tối');
    b.setAttribute('aria-label', toi ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối');
  }
  App.datGiaoDien = function (g) {
    try { localStorage.setItem('ChamCong_giaoDien', g); } catch (e) { /* bỏ qua */ }
    apGiaoDien();
    if (App.trangHienTai === 'caidat') App.veLai();
  };
  if (mqToi) { var doiMQ = function () { if (App.giaoDien() === 'tudong') { apGiaoDien(); if (App.veLai && App.db) App.veLai(); } };
    if (mqToi.addEventListener) mqToi.addEventListener('change', doiMQ); else if (mqToi.addListener) mqToi.addListener(doiMQ); }
  apGiaoDien();

  /** Tham số trên địa chỉ trang: #hoso?id=nv1 */
  App.thamSo = function (ten) {
    var q = (location.hash.split('?')[1] || '').split('&');
    for (var i = 0; i < q.length; i++) { var p = q[i].split('='); if (decodeURIComponent(p[0]) === ten) return decodeURIComponent(p[1] || ''); }
    return '';
  };

  /** In một nội dung riêng (hợp đồng, sơ yếu lý lịch…) mà không in cả trang */
  App.inNoiDung = function (html, doc) {
    var d = document.createElement('div');
    d.className = 'in-rieng';
    d.innerHTML = html;
    document.body.appendChild(d);
    document.body.classList.add('dang-in-rieng');
    var st = document.createElement('style');
    st.textContent = '@page { size: A4 ' + (doc === false ? 'landscape' : 'portrait') + '; margin: 15mm 15mm 15mm 20mm; }';
    document.head.appendChild(st);
    var xong = function () { d.remove(); st.remove(); document.body.classList.remove('dang-in-rieng'); window.removeEventListener('afterprint', xong); };
    window.addEventListener('afterprint', xong);
    setTimeout(function () { window.print(); setTimeout(xong, 1500); }, 60);
  };

  /** Ô chọn loại lao động để lọc */
  App.chonLoaiLD = function (id, v) {
    var ds = App.db.caiDat.loaiLD || [];
    if (!ds.length) return '';
    var chua = App.db.nhanVien.some(function (nv) { return !nv.loaiLD && nv.trangThai !== 'nghi_viec'; });
    return '<select id="' + id + '"><option value="">Mọi loại lao động</option>' + ds.map(function (l) { return '<option value="' + App.h(l.ma) + '"' + (v === l.ma ? ' selected' : '') + '>' + App.h(l.ten) + '</option>'; }).join('') +
      (chua ? '<option value="-"' + (v === '-' ? ' selected' : '') + '>(Chưa chọn loại)</option>' : '') + '</select>';
  };

  /* ================= In ================= */
  App.dauIn = function (tieuDe, phuDe) {
    var ct = App.db.congTy;
    return '<div class="dau-in chi-in"><div class="cty">' + App.h(ct.ten) + '</div>' + (ct.diaChi ? '<div>' + App.h(ct.diaChi) + '</div>' : '') +
      '<h2>' + App.h(tieuDe) + '</h2>' + (phuDe ? '<div class="ky-in">' + App.h(phuDe) + '</div>' : '') + '</div>';
  };
  App.kyIn = function () {
    var ct = App.db.congTy, d = new Date();
    return '<div class="chi-in"><div style="text-align:right;font-style:italic;margin-top:10px">' + App.h(ct.diaDanh || '.......') + ', ngày ' + d.getDate() + ' tháng ' + (d.getMonth() + 1) + ' năm ' + d.getFullYear() + '</div>' +
      '<div class="ky-in-cuoi"><div>NGƯỜI LẬP BIỂU<span>(Ký, họ tên)</span>' + App.h(ct.nguoiLap) + '</div><div>KẾ TOÁN TRƯỞNG<span>(Ký, họ tên)</span>' + App.h(ct.keToan) + '</div><div>GIÁM ĐỐC<span>(Ký, họ tên, đóng dấu)</span>' + App.h(ct.giamDoc) + '</div></div></div>';
  };
  App.inTrang = function (doc) {
    var st = document.createElement('style');
    st.textContent = '@page { size: A4 ' + (doc ? 'portrait' : 'landscape') + '; margin: 10mm; }';
    document.head.appendChild(st);
    setTimeout(function () { window.print(); setTimeout(function () { st.remove(); }, 500); }, 50);
  };

  /* ================= Kỳ (tháng) đang chọn ================= */
  /** Kỳ mặc định: kỳ công đang chạy; nếu kỳ mới bắt đầu chưa quá 20 ngày thì lấy kỳ vừa kết thúc (đang làm lương). */
  App.kyMacDinh = function () {
    var d = new Date(), k = TL.kyCuaNgay(App.db, d.getFullYear(), d.getMonth() + 1, d.getDate());
    var bd = TL.docNgay(TL.batDauKy(App.db, k.y, k.m));
    // kế toán: đầu kỳ thường còn làm lương kỳ trước; tài khoản chấm công hằng ngày: luôn mở kỳ chứa hôm nay
    var chamHangNgay = App.laTaiKhoanChamCong && App.laTaiKhoanChamCong();
    if (!chamHangNgay && (d - new Date(bd.y, bd.m - 1, bd.d)) / 864e5 < 20) { k.m--; if (k.m < 1) { k.m = 12; k.y--; } }
    var s = null;
    try { s = JSON.parse(sessionStorage.getItem('ChamCong_ky') || 'null'); } catch (e) { /* bỏ qua */ }
    return (s && s.y && s.m) ? s : k;
  };
  App.datKy = function (y, m) {
    if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; }
    App.ky = { y: y, m: m };
    try { sessionStorage.setItem('ChamCong_ky', JSON.stringify(App.ky)); } catch (e) { /* bỏ qua */ }
    App.veLai();
  };
  App.thangKhoa = function () { var T = App.db.thang[TL.khoaKy(App.ky.y, App.ky.m)]; return !!(T && T.khoa); };

  /* ================= Khung & điều hướng ================= */
  var MENU = [
    { id: 'dashboard', ten: 'Tổng quan', icon: 'tongquan' },
    { id: 'tongquandoi', ten: 'Tổng quan đơn vị', icon: 'cocau' },
    { nhom: 'Nhân sự' },
    { id: 'nhanvien', ten: 'Hồ sơ nhân viên', icon: 'nhanvien' },
    { id: 'hopdong', ten: 'Hợp đồng lao động', icon: 'phieuluong' },
    { id: 'theodoihd', ten: 'Theo dõi hợp đồng', icon: 'theodoi' },
    { id: 'quyetdinh', ten: 'Quyết định', icon: 'quyetdinh' },
    { id: 'nangbac', ten: 'Xếp lương, nâng bậc', icon: 'bac' },
    { id: 'nghiphep', ten: 'Đơn nghỉ phép', icon: 'nghiphep' },
    { id: 'bcnhansu', ten: 'Báo cáo nhân sự', icon: 'cocau' },
    { nhom: 'Chấm công – tiền lương' },
    { id: 'chamcong', ten: 'Bảng chấm công', icon: 'chamcong' },
    { id: 'vaora', ten: 'Giờ vào / ra', icon: 'vaora' },
    { id: 'bangluong', ten: 'Bảng lương', icon: 'bangluong' },
    { id: 'phieuluong', ten: 'Phiếu lương', icon: 'phieuluong' },
    { id: 'baocao', ten: 'Báo cáo lương', icon: 'baocao' },
    { nhom: 'Thiết lập' },
    { id: 'mucluong', ten: 'Mức lương theo kỳ', icon: 'bac' },
    { id: 'danhmuc', ten: 'Danh mục', icon: 'danhmuc' },
    { id: 'caidat', ten: 'Cài đặt & dữ liệu', icon: 'caidat' },
    { nhom: 'Trợ giúp' },
    { id: 'huongdan', ten: 'Hướng dẫn sử dụng', icon: 'sach' }
  ];
  App.MENU = MENU;
  /** Phân quyền trang (chế độ máy chủ ghi đè cho tài khoản chấm công) */
  App.duocXem = function () { return true; };
  App.quyen = function () { return 2; };   // chạy 1 file trên máy: toàn quyền (chế độ máy chủ ghi đè)
  App.trangDau = function () { return 'dashboard'; };
  /** Mã các phòng / đội tài khoản được chấm công (null = tất cả) */
  App.dvChamCong = function () { return null; };

  function dungKhung() {
    var root = document.getElementById('app');
    root.className = 'app';
    root.innerHTML =
      '<aside class="sb"><div class="thuong-hieu" id="thuong-hieu"></div><nav>' +
      MENU.filter(function (x, i) {
        if (!x.nhom) return App.duocXem(x.id);
        for (var j = i + 1; j < MENU.length && !MENU[j].nhom; j++) if (App.duocXem(MENU[j].id)) return true;
        return false;
      }).map(function (x) {
        if (x.nhom) return '<div class="nhom-nav">' + x.nhom + '</div>';
        return '<a href="#' + x.id + '" data-id="' + x.id + '">' + App.icon(x.icon) + '<span>' + x.ten + '</span></a>';
      }).join('') +
      '</nav><div class="tt-mc" id="tt-maychu"></div><div class="chan" id="chan-sb"></div></aside>' +
      '<div class="chinh-khung"><header class="tb"><button class="menu" aria-label="Menu">' + App.icon('menu') + '</button><h1 id="tieu-de"></h1>' +
      '<button class="nut nho tb-hd" id="tb-hd" hidden aria-expanded="false" title="Hướng dẫn sử dụng trang này">' + App.icon('hoi') + '<span>Hướng dẫn</span></button>' +
      '<button class="nut nho tb-gd" id="tb-gd"></button>' +
      '<div class="ky" id="chon-ky"></div></header><main class="noi" id="noi"></main></div>';
    App.$('.menu', root).onclick = function () { root.classList.toggle('mo-menu'); };
    App.$('#tb-gd', root).onclick = function () { App.datGiaoDien(App.giaoDienToi() ? 'sang' : 'toi'); };
    nutGiaoDien();
    App.$('nav', root).addEventListener('click', function () { root.classList.remove('mo-menu'); });
  }

  function veKy() {
    var el = App.$('#chon-ky'), y = App.ky.y, m = App.ky.m;
    var nams = {}, hn = new Date().getFullYear();
    for (var i = hn - 2; i <= hn + 1; i++) nams[i] = 1;
    nams[y] = 1;
    Object.keys(App.db.thang).forEach(function (k) { nams[+k.slice(0, 4)] = 1; });
    var optT = '', optN = '';
    for (var t = 1; t <= 12; t++) optT += '<option value="' + t + '"' + (t === m ? ' selected' : '') + '>Tháng ' + t + '</option>';
    Object.keys(nams).sort().forEach(function (n) { optN += '<option' + (+n === y ? ' selected' : '') + '>' + n + '</option>'; });
    el.innerHTML = '<button data-b="-1" title="Tháng trước" aria-label="Tháng trước">‹</button><select id="ky-t" aria-label="Tháng">' + optT + '</select>' +
      '<select id="ky-n" aria-label="Năm">' + optN + '</select><button data-b="1" title="Tháng sau" aria-label="Tháng sau">›</button>' +
      (App.thangKhoa() ? '<span class="khoa" title="Tháng đã chốt lương">' + '🔒 Đã chốt' + '</span>' : '');
    el.onclick = function (e) { var b = e.target.closest('button'); if (b) App.datKy(App.ky.y, App.ky.m + (+b.dataset.b)); };
    App.$('#ky-t').onchange = function () { App.datKy(App.ky.y, +this.value); };
    App.$('#ky-n').onchange = function () { App.datKy(+this.value, App.ky.m); };
  }

  App.trangHienTai = 'dashboard';
  App.veLai = function () {
    var id = (location.hash || '#dashboard').slice(1).split('?')[0];
    if (!App.trang[id] || !App.duocXem(id)) id = App.trangDau();
    if (App.trangHienTai !== id && App.trang[App.trangHienTai] && App.trang[App.trangHienTai].roi) App.trang[App.trangHienTai].roi();
    App.trangHienTai = id;
    var tg = App.trang[id], idMenu = tg.menu || id;
    var muc = MENU.filter(function (x) { return x.id === idMenu; })[0];
    App.$$('.sb nav a').forEach(function (a) { a.classList.toggle('chon', a.dataset.id === idMenu); });
    App.$('#tieu-de').textContent = muc ? muc.ten : '';
    document.title = (muc ? muc.ten + ' – ' : '') + 'Nhân sự – Chấm công – Tiền lương';
    App.$('#chon-ky').style.display = tg.khongKy ? 'none' : '';
    veKy();
    var noi = App.$('#noi');
    App.anTip();
    try { tg.ve(noi); }
    catch (e) { console.error(e); noi.innerHTML = '<div class="the canh-bao">Có lỗi khi hiển thị trang: ' + App.h(e.message) + '</div>'; }
    var chan = App.$('#chan-sb');
    if (chan) chan.innerHTML = App.db.nhanVien.filter(function (n) { return n.trangThai !== 'nghi_viec'; }).length + ' nhân viên đang làm việc';
    var th = App.$('#thuong-hieu');
    if (th) th.innerHTML = App.khoiThuongHieu(App.db.congTy, false);
    App.datFavicon();
    if (App.veTrangThaiMayChu) App.veTrangThaiMayChu();
    if (App.HD) App.HD.capNhat(id);
  };

  /* ================= Logo, tên công ty ================= */
  App.TEN_PHAN_MEM = 'Nhân sự – Chấm công – Tiền lương';
  /** Logo đang dùng: logo tải lên trong Cài đặt, logo mặc định, hoặc null nếu đã chọn "không dùng logo" */
  App.logoCongTy = function (ct) {
    ct = ct || App.db.congTy;
    if (ct.logo === '') return null;
    return ct.logo || window.LOGO_MAC_DINH || null;
  };
  /** Logo chìm (mờ) in trên phiếu lương: ảnh riêng đã chọn ở Cài đặt, hoặc logo đơn vị + tên viết tắt (HAWASUCO); '' = không dùng */
  App.logoChim = function (ct) {
    ct = ct || App.db.congTy;
    if (ct.logoChim === '') return '';
    if (ct.logoChim) return '<img src="' + ct.logoChim + '" alt="">';
    var lg = App.logoCongTy(ct);
    if (!lg) return '';
    return '<img src="' + lg + '" alt="">' + (ct.tenVietTat ? '<svg class="chim-chu" viewBox="0 0 300 48" aria-hidden="true"><text x="150" y="40" text-anchor="middle" ' +
      'font-family="Times New Roman, Times, serif" font-weight="700" font-size="46" fill="#1747a6" textLength="290" lengthAdjust="spacingAndGlyphs">' + App.h(ct.tenVietTat) + '</text></svg>' : '');
  };
  /** Tên công ty chia 2 dòng như phần mềm Thất thoát nước: "CÔNG TY TNHH MTV" / "CẤP NƯỚC HẬU GIANG" */
  App.tenHaiDong = function (ten) {
    var s = String(ten || '').trim().toUpperCase();
    var m = s.match(/^(CÔNG TY (?:TNHH(?: MTV| MỘT THÀNH VIÊN| HAI THÀNH VIÊN TRỞ LÊN)?|CỔ PHẦN|CP))\s+(.+)$/);
    return m ? [m[1], m[2]] : [s];
  };
  App.khoiThuongHieu = function (ct, lon) {
    var logo = App.logoCongTy(ct), dong = App.tenHaiDong(ct.ten);
    return (logo ? '<img class="logo-cty" src="' + logo + '" alt="Logo">' : '') +
      '<div class="ten-cty">' + dong.map(App.h).join('<br>') + '</div><div class="ten-pm">' + App.TEN_PHAN_MEM + '</div>' + (lon ? '' : '');
  };
  App.datFavicon = function () {
    var logo = App.logoCongTy();
    var l = document.querySelector('link[rel="icon"]');
    if (logo && l && l.getAttribute('href') !== logo) l.setAttribute('href', logo);
  };

  var daGanHash = false;
  /** Dựng giao diện sau khi đã có dữ liệu (App.db) */
  App.batDauGiaoDien = function () {
    App.ky = App.kyMacDinh();
    dungKhung();
    if (!daGanHash) { window.addEventListener('hashchange', App.veLai); daGanHash = true; }
    App.veLai();
  };
  App.khoiDong = function () {
    App.taiDuLieu();
    App.batDauGiaoDien();
  };
  document.addEventListener('DOMContentLoaded', function () { App.khoiDong(); });
})();
