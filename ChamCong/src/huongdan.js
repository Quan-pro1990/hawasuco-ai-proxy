/* Hướng dẫn sử dụng từng phần: trang "Hướng dẫn sử dụng" (mục lục, tìm, in) và nút "Hướng dẫn" trên mỗi trang
   (mở ngăn bên phải với hướng dẫn của đúng trang đang xem). Nội dung: thư mục huong-dan/*.md, đóng gói vào window.HUONG_DAN_PHAN. */
(function () {
  'use strict';
  var h = App.h, MD = window.MD;
  var NHOM = ['Bắt đầu', 'Chung', 'Nhân sự', 'Chấm công – tiền lương', 'Thiết lập', 'Trợ giúp'];
  var st = { q: '' }, DS = null;

  function cn(s) { return App.boDau(String(s == null ? '' : s)).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function tatCa() {
    if (DS) return DS;
    DS = (window.HUONG_DAN_PHAN || []).map(function (x, i) {
      var t = MD.thongTin(x.md);
      t.id = x.id; t.md = x.md; t.i = i;
      t.chu = ' ' + cn(x.md.replace(/<!--[\s\S]*?-->/g, '')) + ' ';
      return t;
    });
    return DS;
  }
  /** Phần hướng dẫn tài khoản này dùng được (ẩn hướng dẫn của trang không có quyền xem) */
  function hien(g) { return !g.trang.length || g.trang.some(function (t) { return App.duocXem(t); }); }
  function dsHien() { return tatCa().filter(hien); }
  function lay(id) { return tatCa().filter(function (g) { return g.id === id; })[0] || null; }
  /** Hướng dẫn của 1 trang: phần chính trước, phần liên quan (them) sau */
  function theoTrang(id) {
    var ds = tatCa();
    return ds.filter(function (g) { return g.trang.indexOf(id) >= 0; }).concat(ds.filter(function (g) { return g.them.indexOf(id) >= 0 && hien(g); }));
  }
  function tenTrang(id) { var m = App.MENU.filter(function (x) { return x.id === id; })[0]; return m ? m.ten : ''; }

  // liên kết trong hướng dẫn: #huongdan?p=… mở phần khác; #trang mở trang phần mềm (nếu được xem)
  function lienKet(chu, href) {
    var p = /^#huongdan\?p=([\w-]+)$/.exec(href);
    if (p) return '<a href="#huongdan?p=' + p[1] + '">' + chu + '</a>';
    var t = /^#([a-z]+)$/.exec(href);
    if (t && App.trang[t[1]]) return App.duocXem(t[1]) ? '<a href="#' + t[1] + '" class="hd-lk-trang" title="Mở trang ' + h(tenTrang(t[1]) || chu) + '">' + chu + '</a>' : '<b>' + chu + '</b>';
    return chu;
  }
  function noiDung(g, o) { return MD.html(g.md, Object.assign({ lienKet: lienKet }, o || {})); }

  /* ---------------- Tìm trong hướng dẫn ---------------- */
  function tim(q) {
    var tk = cn(q).split(' ').filter(function (w) { return w.length > 1 || /\d/.test(w); });
    if (!tk.length) return [];
    var cum = cn(q);
    return dsHien().map(function (g) {
      var td = ' ' + cn(g.tieuDe) + ' ', d = 0, trung = 0;
      tk.forEach(function (w) {
        var c = g.chu.split(' ' + w + ' ').length - 1;
        if (c || td.indexOf(' ' + w + ' ') >= 0) trung++;
        d += Math.min(c, 5) + (td.indexOf(' ' + w + ' ') >= 0 ? 6 : 0);
      });
      if (tk.length > 1 && g.chu.indexOf(' ' + cum + ' ') >= 0) d += 8;
      return { g: g, d: trung === tk.length ? d : 0 };
    }).filter(function (x) { return x.d > 0; }).sort(function (a, b) { return b.d - a.d; });
  }
  /** Đoạn trích có từ khoá (để hiện dưới kết quả tìm) */
  function trich(g, q) {
    var tk = cn(q).split(' ').filter(Boolean), dong = g.md.replace(/<!--[\s\S]*?-->/g, '').split('\n').filter(function (l) { return l.trim() && !/^#/.test(l) && !/^\|[\s:|-]+\|$/.test(l); });
    var tot = '', diem = 0;
    dong.forEach(function (l) { var c = ' ' + cn(l) + ' ', d = 0; tk.forEach(function (w) { if (c.indexOf(' ' + w + ' ') >= 0) d++; }); if (d > diem) { diem = d; tot = l; } });
    tot = tot.replace(/^\s*([-*>]|\d+\.)\s*/, '').replace(/\|/g, ' · ').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    return MD.dong(tot.length > 170 ? tot.slice(0, 168) + '…' : tot);
  }

  /* ---------------- Trang Hướng dẫn sử dụng ---------------- */
  function mucLuc(chon) {
    var ds = dsHien();
    return NHOM.concat(ds.map(function (g) { return g.nhom; }).filter(function (n, i, a) { return NHOM.indexOf(n) < 0 && a.indexOf(n) === i; })).map(function (n) {
      var con = ds.filter(function (g) { return (g.nhom || 'Trợ giúp') === n; });
      if (!con.length) return '';
      return '<div class="hd-nhom">' + h(n) + '</div>' + con.map(function (g) {
        return '<a href="#huongdan?p=' + g.id + '"' + (g.id === chon ? ' class="chon" aria-current="page"' : '') + '>' + h(g.tieuDe) + '</a>';
      }).join('');
    }).join('');
  }
  function ketQuaTim(q) {
    var kq = tim(q);
    if (!kq.length) return '<div class="mo nho" style="padding:8px 4px">Không thấy phần nào có “' + h(q) + '”. Thử từ khác, hoặc hỏi trợ lý ảo.</div>';
    return '<div class="hd-nhom">' + kq.length + ' phần có “' + h(q) + '”</div>' + kq.slice(0, 12).map(function (x) {
      return '<a href="#huongdan?p=' + x.g.id + '" class="hd-kq"><b>' + h(x.g.tieuDe) + '</b><span>' + trich(x.g, q) + '</span></a>';
    }).join('');
  }
  function veTrang(noi) {
    var ds = dsHien(), id = App.thamSo('p'), g = lay(id);
    if (!g || !hien(g)) g = ds[0];
    if (!g) { noi.innerHTML = '<div class="the">Chưa có tài liệu hướng dẫn.</div>'; return; }
    var vt = ds.indexOf(g), truoc = ds[vt - 1], sau = ds[vt + 1];
    var moTrang = g.trang.filter(function (t) { return App.duocXem(t) && App.MENU.some(function (m) { return m.id === t; }); })[0];
    noi.innerHTML = '<div class="hd-trang">' +
      '<aside class="the hd-muc khong-in"><input type="search" id="hd-tim" placeholder="Tìm trong hướng dẫn…" aria-label="Tìm trong hướng dẫn" value="' + h(st.q) + '">' +
      '<nav id="hd-ds">' + (st.q.trim() ? ketQuaTim(st.q) : mucLuc(g.id)) + '</nav>' +
      '<div class="hd-muc-chan"><button class="nut nho" id="hd-intat">' + App.icon('in') + 'In toàn bộ hướng dẫn</button></div></aside>' +
      '<article class="the hd-bai" id="hd-bai">' +
      '<div class="hd-cong khong-in"><span class="hd-vitri">' + h(g.nhom || '') + ' · Phần ' + (vt + 1) + '/' + ds.length + '</span><span class="gian"></span>' +
      (moTrang ? '<a class="nut nho" href="#' + moTrang + '">' + App.icon('chuyen') + 'Mở trang ' + h(tenTrang(moTrang)) + '</a>' : '') +
      '<button class="nut nho" id="hd-in">' + App.icon('in') + 'In phần này</button>' +
      (App.TroLy ? '<button class="nut nho" id="hd-hoi">' + App.icon('hoi') + 'Hỏi trợ lý ảo</button>' : '') + '</div>' +
      '<div class="hd-nd">' + noiDung(g) + '</div>' +
      '<div class="hd-chuyen khong-in">' + (truoc ? '<a href="#huongdan?p=' + truoc.id + '">‹ ' + h(truoc.tieuDe) + '</a>' : '<span></span>') +
      (sau ? '<a href="#huongdan?p=' + sau.id + '" class="sau">' + h(sau.tieuDe) + ' ›</a>' : '') + '</div></article></div>';
    var o = App.$('#hd-tim', noi), dsEl = App.$('#hd-ds', noi), hen;
    o.oninput = function () {
      clearTimeout(hen);
      hen = setTimeout(function () { st.q = o.value; dsEl.innerHTML = st.q.trim() ? ketQuaTim(st.q) : mucLuc(g.id); }, 120);
    };
    o.onkeydown = function (e) {
      if (e.key === 'Escape' && o.value) { e.stopPropagation(); o.value = ''; o.oninput(); }
      if (e.key === 'Enter') { var a = App.$('a', dsEl); if (a && st.q.trim()) location.hash = a.getAttribute('href'); }
    };
    App.$('#hd-in', noi).onclick = function () { inPhan([g]); };
    App.$('#hd-intat', noi).onclick = function () { inPhan(dsHien(), true); };
    var hoi = App.$('#hd-hoi', noi);
    if (hoi) hoi.onclick = function () { App.TroLy.bat(true); };
    // chuyển phần: cuộn lên đầu bài
    var bai = App.$('#hd-bai', noi);
    if (bai && bai.getBoundingClientRect().top < 0) bai.scrollIntoView();
  }
  function inPhan(ds, caBo) {
    var ct = App.db.congTy || {};
    var dau = caBo ? '<div class="hd-in-bia"><div class="mo">' + h(ct.ten || '') + '</div><h1>HƯỚNG DẪN SỬ DỤNG</h1><div>Phần mềm ' + h(App.TEN_PHAN_MEM) + '</div>' +
      '<ol class="hd-in-ml">' + ds.map(function (g) { return '<li>' + h(g.tieuDe) + '</li>'; }).join('') + '</ol></div>' : '';
    App.inNoiDung('<div class="hd-in">' + dau + ds.map(function (g, i) {
      return '<section' + (caBo || i ? ' class="hd-in-moi"' : '') + '>' + noiDung(g, { lienKet: function (chu) { return chu; } }) + '</section>';
    }).join('') + '</div>');
  }

  App.trang.huongdan = { khongKy: true, ve: veTrang };

  /* ---------------- Ngăn hướng dẫn theo trang (nút "Hướng dẫn" trên đầu trang) ---------------- */
  var ngan = null, nganTrang = null, nganChon = 0;
  function veNgan() {
    var ds = theoTrang(nganTrang);
    if (!ds.length) ds = [lay('bat-dau')].filter(Boolean);
    if (nganChon >= ds.length) nganChon = 0;
    var g = ds[nganChon];
    if (!g) { dongNgan(); return; }
    ngan.innerHTML = '<div class="hd-ngan-dau">' + App.icon('hoi') + '<div class="hd-ngan-td"><div class="mo nho">Hướng dẫn</div><b>' + h(g.tieuDe) + '</b></div>' +
      '<button class="nut nho" data-hd="in" title="In phần hướng dẫn này">' + App.icon('in') + '</button>' +
      '<button class="dong" data-hd="dong" title="Đóng (Esc)" aria-label="Đóng hướng dẫn">×</button></div>' +
      (ds.length > 1 ? '<div class="hd-ngan-tab">' + ds.map(function (x, i) { return '<button data-hd="tab" data-i="' + i + '"' + (i === nganChon ? ' class="chon"' : '') + '>' + h(x.tieuDe) + '</button>'; }).join('') + '</div>' : '') +
      '<div class="hd-ngan-than"><div class="hd-nd">' + noiDung(g, { boTieuDe: true }) + '</div>' +
      '<div class="hd-ngan-chan"><a class="nut nho" href="#huongdan?p=' + g.id + '">' + App.icon('sach') + 'Mở trang Hướng dẫn sử dụng</a>' +
      (App.TroLy ? '<button class="nut nho" data-hd="hoi">' + App.icon('hoi') + 'Hỏi trợ lý ảo</button>' : '') + '</div></div>';
    ngan._g = g;
  }
  function moNgan(id) {
    nganTrang = id || App.trangHienTai; nganChon = 0;
    if (!ngan) {
      ngan = document.createElement('aside');
      ngan.className = 'hd-ngan khong-in';
      ngan.setAttribute('role', 'complementary');
      ngan.setAttribute('aria-label', 'Hướng dẫn trang này');
      ngan.addEventListener('click', function (e) {
        var b = e.target.closest('[data-hd]');
        if (b) {
          var a = b.dataset.hd;
          if (a === 'dong') dongNgan();
          else if (a === 'tab') { nganChon = +b.dataset.i; veNgan(); }
          else if (a === 'in') inPhan([ngan._g]);
          else if (a === 'hoi') App.TroLy.bat(true);
          return;
        }
        // màn hình hẹp: bấm liên kết thì đóng ngăn
        if (e.target.closest('a[href^="#"]') && window.innerWidth < 900) dongNgan();
      });
      document.body.appendChild(ngan);
    }
    veNgan();
    ngan.hidden = false;
    document.body.classList.add('co-hd-ngan');
    var n = App.$('#tb-hd'); if (n) n.setAttribute('aria-expanded', 'true');
  }
  function dongNgan() {
    if (ngan) ngan.hidden = true;
    document.body.classList.remove('co-hd-ngan');
    var n = App.$('#tb-hd'); if (n) n.setAttribute('aria-expanded', 'false');
  }
  function dangMo() { return !!(ngan && !ngan.hidden); }
  /** Gọi sau mỗi lần vẽ trang: ngăn đang mở thì đổi theo trang mới */
  function capNhat(id) {
    var n = App.$('#tb-hd');
    if (n) { n.hidden = id === 'huongdan'; n.setAttribute('aria-expanded', dangMo() ? 'true' : 'false'); }
    if (!dangMo()) return;
    if (id === 'huongdan') { dongNgan(); return; }
    if (id !== nganTrang) { nganTrang = id; nganChon = 0; veNgan(); }
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dangMo() && !document.querySelector('.mo-nen') && !(document.querySelector('.tl-khung') && !document.querySelector('.tl-khung').hidden)) dongNgan();
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('#tb-hd')) return;
    if (dangMo() && nganTrang === App.trangHienTai) dongNgan(); else moNgan(App.trangHienTai);
  });

  App.HD = { tatCa: tatCa, theoTrang: theoTrang, lay: lay, tim: tim, moNgan: moNgan, dongNgan: dongNgan, capNhat: capNhat, dangMo: dangMo, noiDung: noiDung };
})();
