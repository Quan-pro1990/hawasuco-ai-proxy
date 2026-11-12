/* Chế độ máy chủ: khi phần mềm được mở qua máy chủ IIS (ChamCongMayChu.exe), dữ liệu dùng chung nằm trên máy chủ.
   - Đăng nhập bằng tài khoản trên máy chủ.
   - Mọi thay đổi tự lưu lên máy chủ (nén gzip), có số phiên bản để không ghi đè lên thay đổi của người khác.
   - Cứ 15 giây hỏi máy chủ: có ai vừa lưu thì tự tải bản mới (khi mình không có thay đổi chưa lưu).
   Mở trực tiếp file .html (không có máy chủ) thì phần mềm chạy như cũ, lưu trong trình duyệt. */
(function () {
  'use strict';
  var App = window.App, TL = window.TL, h = App.h;
  var MC = App.mayChu = { bat: false, phienBan: 0, nguoi: '', capNhat: '', toi: null, canLuu: false, dangLuu: false, loi: '', luuLuc: null };
  var hen = null, henHoi = null;
  var KHO_CONG = ['cc', 'ot', 'muon', 'vr'];
  var VAI_TRO = { quan_tri: 'Quản trị', nhap_lieu: 'Cấp công ty', cham_cong: 'Cấp phòng / đội' };

  /* ---------------- phân quyền ----------------
     Cấp: quản trị (toàn quyền, tài khoản, sao lưu) · cấp công ty (mọi phòng, đội) · cấp phòng / đội (chỉ nhân viên của đơn vị được giao).
     Mỗi phần Chấm công, Nhân sự, Tiền lương, Thiết lập: Không / Xem / Sửa. Máy chủ kiểm tra lại quyền khi trả và nhận dữ liệu. */
  var PHAN = { cc: 'Chấm công', ns: 'Nhân sự', lg: 'Tiền lương', tl: 'Thiết lập' };
  var MUC = ['Không', 'Xem', 'Sửa'];
  var TRANG_PHAN = { chamcong: 'cc', vaora: 'cc', nhanvien: 'ns', hoso: 'ns', hopdong: 'ns', theodoihd: 'ns', quyetdinh: 'ns', nghiphep: 'ns', bcnhansu: 'ns',
    nangbac: 'lg', bangluong: 'lg', phieuluong: 'lg', baocao: 'lg', mucluong: 'lg', danhmuc: 'tl', caidat: 'tl' };
  var MAU_QUYEN = [
    { ma: 'qt', ten: 'Quản trị – toàn quyền, quản lý tài khoản', vaiTro: 'quan_tri', quyen: { cc: 2, ns: 2, lg: 2, tl: 2 } },
    { ma: 'nl', ten: 'Nhập liệu công ty – sửa tất cả', vaiTro: 'nhap_lieu', quyen: { cc: 2, ns: 2, lg: 2, tl: 2 } },
    { ma: 'ktl', ten: 'Kế toán tiền lương công ty', vaiTro: 'nhap_lieu', quyen: { cc: 1, ns: 1, lg: 2, tl: 2 } },
    { ma: 'tchc', ten: 'Cán bộ tổ chức – nhân sự công ty', vaiTro: 'nhap_lieu', quyen: { cc: 2, ns: 2, lg: 1, tl: 1 } },
    { ma: 'ld', ten: 'Lãnh đạo – xem tất cả', vaiTro: 'nhap_lieu', quyen: { cc: 1, ns: 1, lg: 1, tl: 1 } },
    { ma: 'dt', ten: 'Trưởng phòng, đội trưởng – chấm công, hồ sơ đơn vị, xem lương', vaiTro: 'cham_cong', quyen: { cc: 2, ns: 2, lg: 1, tl: 0 } },
    { ma: 'ccd', ten: 'Chấm công đơn vị – chỉ chấm công', vaiTro: 'cham_cong', quyen: { cc: 2, ns: 0, lg: 0, tl: 0 } },
    { ma: 'nsd', ten: 'Nhân sự đơn vị – chấm công, xem hồ sơ', vaiTro: 'cham_cong', quyen: { cc: 2, ns: 1, lg: 0, tl: 0 } }
  ];
  function laCC() { return !!(MC.bat && MC.toi && MC.toi.vaiTro === 'cham_cong'); }
  function quyenToi() {
    if (!MC.bat || !MC.toi) return { cc: 2, ns: 2, lg: 2, tl: 2 };
    return MC.toi.quyen || (laCC() ? { cc: 2, ns: 0, lg: 0, tl: 0 } : { cc: 2, ns: 2, lg: 2, tl: 2 });
  }
  /** Quyền của tài khoản đang dùng với 1 phần (cc, ns, lg, tl): 0 không, 1 xem, 2 sửa. Chạy 1 file trên máy: toàn quyền. */
  App.quyen = function (p) { return +quyenToi()[p] || 0; };
  App.laTaiKhoanChamCong = laCC;
  App.laCapDonVi = laCC;
  App.duocXem = function (id) {
    if (!MC.bat) return true;
    if (id === 'tongquandoi') return true;
    if (id === 'dashboard') return !laCC() && App.quyen('lg') >= 1;
    var p = TRANG_PHAN[id];
    return !p || App.quyen(p) >= 1;
  };
  App.trangDau = function () { return App.duocXem('dashboard') ? 'dashboard' : 'tongquandoi'; };
  App.dvChamCong = function () { return laCC() ? (MC.toi.donVi || []) : null; };
  function moTaQuyen(q, vaiTro) {
    if (vaiTro === 'quan_tri') return 'Toàn quyền';
    return Object.keys(PHAN).filter(function (k) { return +q[k] > 0; }).map(function (k) { return PHAN[k].toLowerCase() + (+q[k] === 2 ? '' : ' (xem)'); }).join(', ') || 'không có quyền';
  }

  /** Phần chấm công của dữ liệu (để so ô nào vừa sửa) */
  function phanCong(thang) {
    var kq = {};
    Object.keys(thang || {}).forEach(function (k) { var T = thang[k], x = {}; KHO_CONG.forEach(function (l) { x[l] = T[l] || {}; }); kq[k] = x; });
    return JSON.parse(JSON.stringify(kq));
  }
  /** Dữ liệu bỏ phần ô chấm công (để biết người khác có sửa gì ngoài chấm công không) */
  function boCong(db) {
    var x = Object.assign({}, db), th = {};
    Object.keys(db.thang || {}).sort().forEach(function (k) {
      var T = db.thang[k], t = {};
      Object.keys(T).forEach(function (f) {
        if (KHO_CONG.indexOf(f) >= 0) return;
        var v = T[f];
        if (v == null || v === false || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)) return;
        t[f] = v;
      });
      if (Object.keys(t).length) th[k] = t;
    });
    x.thang = th;
    return JSON.stringify(x);
  }
  /** Ghi nhớ bản gốc (lúc tải / lưu gần nhất) để chỉ gửi ô đã sửa, hoặc tự ghép khi người khác vừa chấm công */
  function chupGoc(db) {
    db = db || App.db;
    MC.goc = phanCong(db.thang);
    MC.gocKhac = laCC() ? null : boCong(db);
    MC.gocNS = laCC() ? chupNS(db) : null;
  }
  /** Ảnh hồ sơ nhân viên, đơn nghỉ (tài khoản cấp phòng / đội chỉ gửi những hồ sơ vừa sửa) */
  function chupNS(db) {
    var nv = {}, dn = {};
    (db.nhanVien || []).forEach(function (x) { nv[x.id] = JSON.stringify(x); });
    (db.donNghi || []).forEach(function (x) { dn[x.id] = JSON.stringify(x); });
    return { nv: nv, dn: dn };
  }
  function taoNS() {
    var g = MC.gocNS || { nv: {}, dn: {} }, dv = MC.toi.donVi || [], kq = { nhanVien: [], donNghi: { luu: [], xoa: [] }, boQua: [] }, co = {};
    (App.db.nhanVien || []).forEach(function (x) {
      if (g.nv[x.id] === JSON.stringify(x)) return;
      if (dv.indexOf(x.phongBan) < 0) kq.boQua.push(x.hoTen); else kq.nhanVien.push(x);
    });
    (App.db.donNghi || []).forEach(function (x) { co[x.id] = 1; if (g.dn[x.id] !== JSON.stringify(x)) kq.donNghi.luu.push(x); });
    Object.keys(g.dn).forEach(function (id) { if (!co[id]) kq.donNghi.xoa.push(id); });
    kq.n = kq.nhanVien.length + kq.donNghi.luu.length + kq.donNghi.xoa.length;
    return kq;
  }
  /** Áp các ô người khác vừa sửa (máy chủ khác bản gốc) vào dữ liệu đang có; ô mình cũng sửa thì giữ của mình */
  function gopO(sv) {
    var n = 0, goc = MC.goc || {}, ks = {}, rong = function (v) { return v == null || v === '' ? null : v; };
    Object.keys(sv).concat(Object.keys(goc)).forEach(function (k) { ks[k] = 1; });
    Object.keys(ks).forEach(function (k) {
      KHO_CONG.forEach(function (l) {
        var s = (sv[k] && sv[k][l]) || {}, g = (goc[k] && goc[k][l]) || {}, ids = {};
        Object.keys(s).concat(Object.keys(g)).forEach(function (i) { ids[i] = 1; });
        Object.keys(ids).forEach(function (id) {
          var a = g[id] || {}, b = s[id] || {}, ngay = {};
          Object.keys(a).concat(Object.keys(b)).forEach(function (d) { ngay[d] = 1; });
          Object.keys(ngay).forEach(function (d) {
            var vg = rong(a[d]), vs = rong(b[d]);
            if (JSON.stringify(vg) === JSON.stringify(vs)) return;
            var T = TL.thang(App.db, +k.slice(0, 4), +k.slice(5, 7), true), m = T[l][id], vl = rong(m && m[d]);
            if (JSON.stringify(vl) !== JSON.stringify(vg)) return; // máy này cũng sửa ô đó: giữ của mình
            if (vs == null) { if (m) { delete m[d]; if (!Object.keys(m).length) delete T[l][id]; } }
            else (T[l][id] = m || {})[d] = vs;
            n++;
          });
        });
      });
    });
    return n;
  }
  /** Bị trùng phiên bản khi lưu: nếu người khác chỉ chấm công thì tự ghép rồi lưu lại, ngược lại hỏi người dùng */
  function tuGop(tt) {
    var pbCu = MC.phienBan;
    if (!MC.gocKhac) { xungDot(tt); return; }
    taiDuLieu().then(function (dl) {
      var sv = dl && TL.chuanHoa(dl);
      if (!sv || boCong(sv) !== MC.gocKhac) { MC.phienBan = pbCu; xungDot(tt); return; }
      var n = gopO(sv.thang);
      MC.goc = phanCong(sv.thang);
      MC.canLuu = true; guiLuu();
      var dangSua = App.$('.mo-nen') || (document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName));
      if (n && !dangSua) App.veLai();
      if (n) App.bao('Đã tự ghép ' + n + ' ô chấm công do ' + (MC.nguoi || 'người khác') + ' vừa lưu.');
    }).catch(function () { MC.phienBan = pbCu; xungDot(tt); });
  }
  /** Các ô chấm công đã đổi so với lần tải / lưu trước: { 'yyyy-mm': { cc: { nvId: { ngày: giá trị | null } } } } */
  function taoVa() {
    var thay = {}, n = 0, goc = MC.goc || {}, th = App.db.thang, ks = {};
    var rong = function (v) { return v == null || v === '' ? null : v; };
    Object.keys(th).concat(Object.keys(goc)).forEach(function (k) { ks[k] = 1; });
    Object.keys(ks).forEach(function (k) {
      KHO_CONG.forEach(function (l) {
        var moi = (th[k] && th[k][l]) || {}, cu = (goc[k] && goc[k][l]) || {}, ids = {};
        Object.keys(moi).concat(Object.keys(cu)).forEach(function (i) { ids[i] = 1; });
        Object.keys(ids).forEach(function (id) {
          var a = cu[id] || {}, b = moi[id] || {}, ngay = {};
          Object.keys(a).concat(Object.keys(b)).forEach(function (d) { ngay[d] = 1; });
          Object.keys(ngay).forEach(function (d) {
            var va = rong(a[d]), vb = rong(b[d]);
            if (JSON.stringify(va) === JSON.stringify(vb)) return;
            var t = thay[k] || (thay[k] = {}), x = t[l] || (t[l] = {}), o = x[id] || (x[id] = {});
            o[d] = vb; n++;
          });
        });
      });
    });
    return { thay: thay, n: n };
  }

  function api(duong, o) {
    o = o || {};
    var hd = { 'X-Yeu-Cau': 'ChamCong' };
    Object.keys(o.headers || {}).forEach(function (k) { hd[k] = o.headers[k]; });
    if (o.json !== undefined) { hd['Content-Type'] = 'application/json'; o.body = JSON.stringify(o.json); }
    return fetch('api/' + duong, { method: o.method || 'GET', headers: hd, body: o.body, credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) {
        var ct = r.headers.get('Content-Type') || '';
        var p = ct.indexOf('json') >= 0 ? r.json() : r.text();
        return p.then(function (d) { return { status: r.status, ok: r.ok, data: d }; });
      });
  }
  MC.api = api;

  function nen(text) {
    if (typeof CompressionStream === 'undefined') return Promise.resolve({ body: text, gzip: false });
    try {
      var s = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
      return new Response(s).arrayBuffer().then(function (b) { return { body: b, gzip: true }; });
    } catch (e) { return Promise.resolve({ body: text, gzip: false }); }
  }

  /* ---------------- khởi động ---------------- */
  var khoiDongCu = App.khoiDong;
  App.khoiDong = function () {
    if (location.protocol === 'file:') { khoiDongCu(); return; }
    api('ping').then(function (r) {
      if (!r.ok || !r.data || r.data.ungDung !== 'ChamCong') { khoiDongCu(); return; }
      MC.bat = true;
      return api('toi').then(function (t) {
        if (t.status === 200) { MC.toi = t.data; taiVaBatDau(); } else manHinhDangNhap();
      });
    }).catch(function () { if (!MC.bat) khoiDongCu(); else manHinhDangNhap('Không kết nối được máy chủ.'); });
  };

  function taiDuLieu() {
    return api('dulieu').then(function (r) {
      if (r.status === 401) throw { dangNhap: true };
      if (!r.ok) throw new Error((r.data && r.data.loi) || 'Lỗi ' + r.status);
      MC.phienBan = r.data.phienBan; MC.nguoi = r.data.nguoi; MC.capNhat = r.data.capNhat;
      return r.data.duLieu;
    });
  }

  function taiVaBatDau() {
    App.$('#app').innerHTML = '<div style="padding:40px;text-align:center;color:var(--mo)">Đang tải dữ liệu từ máy chủ…</div>';
    taiDuLieu().then(function (dl) {
      if (dl) { App.db = TL.chuanHoa(dl); chupGoc(); App.batDauGiaoDien(); hoiDinhKy(); return; }
      if (laCC()) { App.$('#app').innerHTML = '<div class="the canh-bao" style="margin:40px">Máy chủ chưa có dữ liệu. Liên hệ quản trị phần mềm để nhập danh sách nhân viên trước. <a href="#" onclick="App.dangXuat();return false">Đăng xuất</a></div>'; return; }
      App.db = TL.duLieuMoi();
      App.batDauGiaoDien();
      hoiDinhKy();
      lanDau();
    }).catch(function (e) {
      if (e && e.dangNhap) manHinhDangNhap();
      else App.$('#app').innerHTML = '<div class="the canh-bao" style="margin:40px">Không tải được dữ liệu từ máy chủ: ' + h(e.message || e) + '. <a href="">Thử lại</a></div>';
    });
  }

  /** Máy chủ chưa có dữ liệu: chọn đưa dữ liệu lên */
  function lanDau() {
    var coCucBo = null;
    try { var s = localStorage.getItem('ChamCongTinhLuong_v1'); if (s) { var d = JSON.parse(s); if (d && d.nhanVien && !d.laMau) coCucBo = d; } } catch (e) { /* bỏ qua */ }
    App.hop({
      tieuDe: 'Máy chủ chưa có dữ liệu', co: 'hep', giu: true, khongFocus: true,
      than: '<p style="margin-top:0">Đây là lần đầu dùng phần mềm trên máy chủ. Chọn dữ liệu ban đầu (mọi người dùng chung):</p>' +
        '<div style="display:grid;gap:8px">' +
        (coCucBo ? '<button class="nut chinh" data-c="cucbo">Đưa dữ liệu đang có trên máy này lên (' + coCucBo.nhanVien.length + ' nhân viên)</button>' : '') +
        '<label class="nut">Nhập từ file sao lưu (.json)…<input type="file" accept=".json" class="an" id="ld-tep"></label>' +
        '<button class="nut" data-c="trong">Bắt đầu với dữ liệu trống</button>' +
        '<button class="nut" data-c="mau">Dùng dữ liệu mẫu để xem thử</button></div>',
      moRa: function (el, dong) {
        el.onclick = function (e) {
          var b = e.target.closest('[data-c]'); if (!b) return;
          var c = b.dataset.c;
          App.db = c === 'cucbo' ? TL.chuanHoa(coCucBo) : c === 'mau' ? App.taoMau() : TL.duLieuMoi();
          dong(); App.luuNgay(); App.ky = App.kyMacDinh(); App.veLai();
        };
        App.$('#ld-tep', el).onchange = function () {
          var f = this.files[0]; if (!f) return;
          f.text().then(function (s) {
            var d = JSON.parse(s);
            if (!d || !Array.isArray(d.nhanVien) || !d.caiDat) throw new Error('File không phải bản sao lưu của phần mềm này.');
            App.db = TL.chuanHoa(d); dong(); App.luuNgay(); App.ky = App.kyMacDinh(); App.veLai();
          }).catch(function (e) { App.bao(e.message, 'loi'); });
        };
      }
    });
  }

  /* ---------------- đăng nhập ---------------- */
  function manHinhDangNhap(loi) {
    var ct = App.db && App.db.congTy ? App.db.congTy : TL.duLieuMoi().congTy;
    App.$('#app').className = '';
    App.$('#app').innerHTML = '<div class="dn-nen"><form class="dn-hop" autocomplete="on" onsubmit="return false">' +
      App.khoiThuongHieu(ct, true) +
      '<label class="o">Tên đăng nhập<input name="ten" autocomplete="username" required></label>' +
      '<label class="o">Mật khẩu<input name="matKhau" type="password" autocomplete="current-password" required></label>' +
      '<div class="dn-loi">' + h(loi || '') + '</div><button class="nut chinh" style="width:100%">Đăng nhập</button>' +
      '<div class="mo nho" style="text-align:center;margin-top:10px">Dữ liệu lưu trên máy chủ, dùng chung cho các phòng.</div></form></div>';
    var f = App.$('.dn-hop');
    f.ten.focus();
    f.onsubmit = function () {
      var nut = App.$('button', f); nut.disabled = true;
      api('dangnhap', { method: 'POST', json: { ten: f.ten.value.trim(), matKhau: f.matKhau.value } }).then(function (r) {
        nut.disabled = false;
        if (r.status === 200) { MC.toi = r.data; taiVaBatDau(); return; }
        App.$('.dn-loi', f).textContent = (r.data && r.data.loi) || 'Đăng nhập không được.';
        f.matKhau.value = ''; f.matKhau.focus();
      }).catch(function () { nut.disabled = false; App.$('.dn-loi', f).textContent = 'Không kết nối được máy chủ.'; });
      return false;
    };
  }

  /** Phiên hết hạn giữa chừng: đăng nhập lại trong hộp thoại, không mất thay đổi đang chờ lưu */
  var dangHoiLai = false;
  function dangNhapLai() {
    if (dangHoiLai) return;
    dangHoiLai = true;
    App.hop({
      tieuDe: 'Phiên đăng nhập đã hết hạn', co: 'hep', giu: true,
      than: '<form class="form" style="grid-template-columns:1fr" onsubmit="return false"><p class="mo" style="margin:0">Đăng nhập lại để tiếp tục lưu dữ liệu (thay đổi chưa lưu vẫn được giữ).</p>' +
        '<label class="o">Tên đăng nhập<input name="ten" value="' + h(MC.toi ? MC.toi.ten : '') + '"></label><label class="o">Mật khẩu<input name="matKhau" type="password"></label></form>',
      khiDong: function () { dangHoiLai = false; },
      nut: [{
        ten: 'Đăng nhập', loai: 'chinh', bam: function (el) {
          var f = App.$('form', el);
          api('dangnhap', { method: 'POST', json: { ten: f.ten.value.trim(), matKhau: f.matKhau.value } }).then(function (r) {
            if (r.status === 200) { MC.toi = r.data; App.$('.mo-nen .dong').click(); App.luuNgay(); veTrangThai(); }
            else App.bao((r.data && r.data.loi) || 'Đăng nhập không được.', 'loi');
          });
          return false;
        }
      }]
    });
  }

  App.dangXuat = function () {
    var xong = function () { location.reload(); };
    if (MC.canLuu || MC.dangLuu) { App.luuNgay(); setTimeout(function () { api('dangxuat', { method: 'POST' }).then(xong, xong); }, 1500); }
    else api('dangxuat', { method: 'POST' }).then(xong, xong);
  };

  /* ---------------- lưu ---------------- */
  var luuCucBo = App.luuNgay, henCucBo = App.luu, henXem = null, boQuaDen = 0;
  /** Trang thuộc phần tài khoản chỉ được xem: không lưu, báo và tải lại bản trên máy chủ */
  function chiXem() {
    var p = TRANG_PHAN[App.trangHienTai];
    if (!MC.bat || !p || App.quyen(p) >= 2) return false;
    if (Date.now() < boQuaDen) return true;
    App.bao('Tài khoản của bạn chỉ được xem phần ' + PHAN[p] + ' – thay đổi không được lưu.', 'loi');
    clearTimeout(henXem); henXem = setTimeout(function () { boQuaDen = Date.now() + 2000; MC.canLuu = false; taiLai(false); }, 300);
    return true;
  }
  App.luu = function () {
    if (!MC.bat) return henCucBo();
    if (chiXem()) return;
    MC.canLuu = true; veTrangThai();
    clearTimeout(hen); hen = setTimeout(guiLuu, 1200);
  };
  App.luuNgay = function () {
    if (!MC.bat) return luuCucBo();
    if (chiXem()) return;
    MC.canLuu = true;
    clearTimeout(hen); guiLuu();
  };

  function guiLuu(ghiDe) {
    if (MC.dangLuu) { MC.lai = true; return; }
    if (!MC.canLuu && !ghiDe) return;
    // tài khoản cấp phòng / đội: chỉ gửi các ô chấm công, hồ sơ, đơn nghỉ vừa sửa; máy chủ ghép (không ghi đè phần người khác)
    var cc = laCC(), va = cc && App.quyen('cc') >= 2 ? taoVa() : { n: 0 }, ns = cc && App.quyen('ns') >= 2 ? taoNS() : { n: 0 };
    var chup = cc ? phanCong(App.db.thang) : null, chupN = cc ? chupNS(App.db) : null, soYC = (va.n ? 1 : 0) + (ns.n ? 1 : 0);
    MC.canLuu = false;
    if (cc && ns.boQua && ns.boQua.length) App.bao('Không lưu thay đổi hồ sơ của ' + ns.boQua.join(', ') + ' (không thuộc phòng / đội được giao).', 'loi');
    if (cc && !soYC) { veTrangThai(); return; }
    MC.dangLuu = true; MC.loi = ''; veTrangThai();
    var guiDi = cc ? null : JSON.stringify(App.db);
    var yc = cc ? [va.n ? function () { return api('chamcong', { method: 'PUT', json: { thang: va.thay } }); } : null,
      ns.n ? function () { return api('nhansu', { method: 'PUT', json: { nhanVien: ns.nhanVien, donNghi: ns.donNghi } }); } : null]
      .filter(Boolean).reduce(function (p, f) { return p.then(function (r) { return r && !r.ok ? r : f(); }); }, Promise.resolve(null)) : nen(guiDi).then(function (n) {
      var hd = { 'X-Phien-Ban': String(ghiDe ? ghiDe : MC.phienBan), 'Content-Type': 'application/json' };
      if (n.gzip) hd['Content-Encoding'] = 'gzip';
      return api('dulieu', { method: 'PUT', headers: hd, body: n.body });
    });
    yc.then(function (r) {
      MC.dangLuu = false;
      if (r.status === 200) {
        if (cc) {
          // có người khác lưu xen giữa thì để lần hỏi định kỳ tải lại bản mới
          MC.goc = chup; MC.gocNS = chupN; MC.phienBan = r.data.phienBan === MC.phienBan + soYC ? r.data.phienBan : r.data.phienBan - 1;
        } else { MC.phienBan = r.data.phienBan; try { chupGoc(TL.chuanHoa(JSON.parse(guiDi))); } catch (e) { MC.gocKhac = null; } }
        MC.nguoi = r.data.nguoi; MC.capNhat = r.data.capNhat; MC.luuLuc = new Date();
      }
      else if (cc && (r.status === 400 || r.status === 403 || r.status === 409 || r.status === 423)) {
        App.bao('Không lưu được: ' + ((r.data && r.data.loi) || 'lỗi ' + r.status) + ' Đã tải lại dữ liệu trên máy chủ.', 'loi');
        taiLai(false);
      }
      else if (r.status === 409) { MC.canLuu = true; tuGop(r.data); }
      else if (r.status === 401) { MC.canLuu = true; MC.loi = 'Hết phiên đăng nhập'; dangNhapLai(); }
      else { MC.canLuu = true; MC.loi = (r.data && r.data.loi) || 'Lỗi ' + r.status; App.bao('Không lưu được lên máy chủ: ' + MC.loi, 'loi'); }
    }).catch(function () {
      MC.dangLuu = false; MC.canLuu = true; MC.loi = 'Mất kết nối máy chủ';
    }).then(function () {
      veTrangThai();
      if (MC.lai) { MC.lai = false; clearTimeout(hen); hen = setTimeout(guiLuu, 300); }
      else if (MC.canLuu && MC.loi && !dangHoiLai) { clearTimeout(hen); hen = setTimeout(guiLuu, 10000); }
    });
  }

  var dangHoiXungDot = false;
  function xungDot(tt) {
    if (dangHoiXungDot) return;
    dangHoiXungDot = true;
    var luc = tt && tt.capNhat ? new Date(tt.capNhat).toLocaleTimeString('vi-VN') : '';
    App.hop({
      tieuDe: 'Có người vừa lưu dữ liệu', co: 'hep', giu: true,
      than: '<p style="margin-top:0"><b>' + h(tt && tt.nguoi || 'Người khác') + '</b> vừa lưu dữ liệu lên máy chủ' + (luc ? ' lúc ' + luc : '') + ', trong khi máy này còn thay đổi chưa lưu.</p>' +
        '<p><b>Tải bản mới nhất</b>: lấy dữ liệu của người kia, bỏ thay đổi vừa làm trên máy này (làm lại thao tác nếu cần).<br>' +
        '<b>Ghi đè</b>: lưu dữ liệu trên máy này, thay đổi của người kia sẽ mất.</p>',
      khiDong: function () { dangHoiXungDot = false; },
      nut: [
        { ten: 'Ghi đè bằng dữ liệu của tôi', loai: 'nguy', bam: function () { MC.phienBan = tt.phienBan; guiLuu(String(tt.phienBan)); } },
        { ten: 'Tải bản mới nhất', loai: 'chinh', bam: function () { MC.canLuu = false; taiLai(true); } }
      ]
    });
  }

  function taiLai(bao) {
    return taiDuLieu().then(function (dl) {
      if (!dl) return;
      boQuaDen = Date.now() + 2000;
      App.db = TL.chuanHoa(dl);
      MC.canLuu = false; chupGoc();
      App.veLai(); veTrangThai();
      if (bao) App.bao('Đã tải dữ liệu mới nhất' + (MC.nguoi ? ' (' + MC.nguoi + ' lưu lúc ' + new Date(MC.capNhat).toLocaleTimeString('vi-VN') + ')' : '') + '.', 'tot');
    }).catch(function (e) { if (e && e.dangNhap) dangNhapLai(); });
  }

  /** Hỏi máy chủ định kỳ: có người khác lưu thì tải bản mới (khi máy này đang rảnh, không có thay đổi chưa lưu) */
  function hoiDinhKy() {
    clearInterval(henHoi);
    henHoi = setInterval(function () {
      if (document.hidden || MC.dangLuu) return;
      api('trangthai').then(function (r) {
        if (r.status === 401) { dangNhapLai(); return; }
        if (!r.ok) return;
        if (MC.loi === 'Mất kết nối máy chủ') { MC.loi = ''; veTrangThai(); if (MC.canLuu) guiLuu(); }
        if (r.data.phienBan > MC.phienBan && !MC.canLuu) {
          var dangSua = App.$('.mo-nen') || (document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && App.$('#noi').contains(document.activeElement));
          if (dangSua) return; // đợi người dùng sửa xong
          taiLai(false).then(function () { App.bao('Đã cập nhật dữ liệu mới do ' + (r.data.nguoi || 'người khác') + ' vừa lưu.'); });
        }
      }).catch(function () { MC.loi = 'Mất kết nối máy chủ'; veTrangThai(); });
    }, 15000);
  }

  window.addEventListener('beforeunload', function (e) {
    if (MC.bat && (MC.canLuu || MC.dangLuu)) { guiLuu(); e.preventDefault(); e.returnValue = ''; }
  });

  /* ---------------- trạng thái ở thanh bên ---------------- */
  function veTrangThai() {
    var el = App.$('#tt-maychu'); if (!el || !MC.bat) return;
    var tt = MC.loi ? '<span class="tt-cham do"></span>' + h(MC.loi) + (MC.canLuu ? ' – chưa lưu' : '')
      : MC.dangLuu ? '<span class="tt-cham cam"></span>Đang lưu lên máy chủ…'
        : MC.canLuu ? '<span class="tt-cham cam"></span>Có thay đổi chưa lưu'
          : '<span class="tt-cham xanh"></span>Đã lưu trên máy chủ' + (MC.luuLuc ? ' ' + MC.luuLuc.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '');
    var vt = !MC.toi ? '' : MC.toi.vaiTro === 'quan_tri' ? ' (quản trị)' : laCC() ? ' (' + (MC.toi.donVi || []).map(function (m) { return TL.tenPhongBan(App.db, m) || m; }).join(', ') + ')' : ' (cấp công ty)';
    el.innerHTML = '<div>' + tt + '</div><div class="mo">' + h((MC.toi ? MC.toi.ten : '') + vt) +
      ' · <a href="#" id="doi-mk">Đổi mật khẩu</a> · <a href="#" id="dang-xuat">Đăng xuất</a></div>';
    App.$('#dang-xuat', el).onclick = function (e) { e.preventDefault(); App.dangXuat(); };
    App.$('#doi-mk', el).onclick = function (e) { e.preventDefault(); doiMatKhau(); };
  }
  App.veTrangThaiMayChu = veTrangThai;

  /* ---------------- Cài đặt → máy chủ: sao lưu, tài khoản, nhật ký ---------------- */
  App.veMayChuCaiDat = function (el) {
    var qt = MC.toi && MC.toi.vaiTro === 'quan_tri';
    el.innerHTML = '<div class="the"><h3>Dữ liệu trên máy chủ</h3>' +
      '<p style="margin-top:0">Dữ liệu dùng chung nằm trên máy chủ, tự lưu sau mỗi thay đổi. Phiên bản hiện tại: <b>' + MC.phienBan + '</b>' +
      (MC.nguoi ? ', lưu gần nhất bởi <b>' + h(MC.nguoi) + '</b> lúc ' + new Date(MC.capNhat).toLocaleString('vi-VN') : '') + '.</p>' +
      '<p class="mo nho">Máy chủ tự sao lưu mỗi ngày (giữ 120 ngày gần nhất). Bạn cũng có thể tải 1 bản về máy để cất riêng.</p>' +
      '<div class="hang"><button class="nut" id="mc-tai">' + App.icon('tai') + 'Tải bản sao lưu về máy</button>' +
      '<label class="nut">' + App.icon('nhap') + 'Khôi phục từ file…<input type="file" id="dl-mo" accept=".json" class="an"></label>' +
      '<button class="nut" id="mc-doimk">Đổi mật khẩu của tôi</button><button class="nut" id="mc-dx">Đăng xuất</button></div></div>' +
      (qt ? '<div class="the"><h3>Nơi lưu dữ liệu và bản sao lưu hằng ngày trên máy chủ</h3><div id="mc-luutru" class="mo nho">Đang tải…</div><div class="cuon" style="max-height:300px"><table class="bang" id="mc-sl"><tbody><tr><td class="trong">Đang tải…</td></tr></tbody></table></div></div>' +
        '<div class="the"><h3>Tài khoản đăng nhập<span class="phai"><button class="nut nho" id="mc-tk-nhanh">Tạo tài khoản cho từng phòng / đội…</button> <button class="nut nho chinh" id="mc-tk-them">' + App.icon('them') + 'Thêm tài khoản</button></span></h3><div class="cuon"><table class="bang" id="mc-tk"><tbody><tr><td class="trong">Đang tải…</td></tr></tbody></table></div>' +
        '<p class="mo nho"><b>Quản trị</b>: mọi chức năng, quản lý tài khoản, sao lưu. <b>Cấp công ty</b>: mọi phòng, đội. <b>Cấp phòng / đội</b>: chỉ nhân viên của đơn vị được giao (tiền lương tối đa được xem, không sửa danh mục, cài đặt). ' +
        'Mỗi phần <b>Chấm công, Nhân sự, Tiền lương, Thiết lập</b> chọn Không / Xem / Sửa; máy chủ kiểm tra lại quyền: phần không được xem thì không gửi về máy, phần chỉ được xem thì thay đổi không được lưu. ' +
        '<b>Chấm công theo phòng / đội</b>: chỉ thấy bảng chấm công và giờ vào / ra của nhân viên thuộc phòng / đội được giao, không xem lương; máy chủ chặn sửa nhân viên ngoài đơn vị và kỳ đã chốt lương.</p></div>' +
        '<div class="the"><h3>Nhật ký máy chủ (300 dòng gần nhất)</h3><pre id="mc-nk" style="max-height:260px;overflow:auto;font-size:12px;background:var(--mat2);padding:10px;border-radius:8px;margin:0">Đang tải…</pre></div>'
        : '<div class="the mo">Chỉ tài khoản <b>quản trị</b> mới thêm, sửa tài khoản đăng nhập và xem bản sao lưu, nhật ký máy chủ. Cần thêm tài khoản: nhờ người quản trị phần mềm.</div>');
    App.$('#mc-tai', el).onclick = function () {
      var d = new Date(), ten = 'SaoLuu_ChamCong_' + d.getFullYear() + TL.pad(d.getMonth() + 1) + TL.pad(d.getDate()) + '.json';
      App.XL.taiXuong(ten, new Blob([JSON.stringify(App.db)], { type: 'application/json' }));
    };
    App.$('#mc-dx', el).onclick = App.dangXuat;
    App.$('#mc-doimk', el).onclick = doiMatKhau;
    if (!qt) return;
    veSaoLuu(el); veTaiKhoan(el);
    api('nhatky').then(function (r) { App.$('#mc-nk', el).textContent = r.ok ? r.data : 'Không đọc được.'; });
    App.$('#mc-tk-them', el).onclick = function () { formTaiKhoan(null, el); };
    App.$('#mc-tk-nhanh', el).onclick = function () { taoNhanh(el); };
  };

  function veSaoLuu(el) {
    api('saoluu').then(function (r) {
      if (!r.ok) return;
      App.$('#mc-luutru', el).innerHTML = noiLuu(r.data);
      var ds = r.data.ds || [];
      App.$('#mc-sl', el).innerHTML = '<thead><tr><th>Bản sao lưu</th><th>Lúc</th><th class="so">Dung lượng</th><th></th></tr></thead><tbody>' +
        (ds.length ? ds.map(function (x) {
          return '<tr><td>' + h(x.ten.replace(/\.gz$/, '')) + (/\.gz$/.test(x.ten) ? ' <span class="mo nho">(nén)</span>' : '') + '</td><td class="giua">' + new Date(x.luc).toLocaleString('vi-VN') + '</td><td class="so">' + kichThuoc(x.kichThuoc) + '</td>' +
            '<td><a class="nut nho" href="api/saoluu/tai?ten=' + encodeURIComponent(x.ten) + '">' + App.icon('tai') + 'Tải về</a> <button class="nut nho nguy" data-kp="' + h(x.ten) + '">Khôi phục</button></td></tr>';
        }).join('') : '<tr><td colspan="4" class="trong">Chưa có bản sao lưu (máy chủ tạo bản đầu tiên vào lần lưu đầu mỗi ngày).</td></tr>') + '</tbody>';
      App.$('#mc-sl', el).onclick = function (e) {
        var b = e.target.closest('[data-kp]'); if (!b) return;
        App.xacNhan('Khôi phục dữ liệu từ bản <b>' + h(b.dataset.kp) + '</b>? Dữ liệu hiện tại trên máy chủ sẽ được thay bằng bản này (bản hiện tại vẫn còn trong bản sao lưu của hôm nay).', { nut: 'Khôi phục', nguy: true }).then(function (ok) {
          if (!ok) return;
          api('saoluu/khoiphuc', { method: 'POST', json: { ten: b.dataset.kp } }).then(function (r2) {
            if (!r2.ok) { App.bao((r2.data && r2.data.loi) || 'Không khôi phục được.', 'loi'); return; }
            taiLai(false).then(function () { App.bao('Đã khôi phục từ ' + b.dataset.kp, 'tot'); });
          });
        });
      };
    });
  }

  function kichThuoc(b) {
    b = +b || 0;
    return b < 1024 ? b + ' byte' : b < 1048576 ? App.so(Math.round(b / 1024)) + ' KB' : b < 1073741824 ? App.so(Math.round(b / 1048576 * 10) / 10) + ' MB' : App.so(Math.round(b / 1073741824 * 10) / 10) + ' GB';
  }
  /** Thư mục dữ liệu, sao lưu trên máy chủ, chỗ trống từng ổ; cảnh báo khi nằm ở ổ hệ thống (C) hoặc ổ sắp đầy */
  function noiLuu(x) {
    var gb = function (b) { return App.so(Math.round(b / 1073741824 * 10) / 10) + ' GB'; };
    var mb = kichThuoc;
    var o = x.o || [], c = o.filter(function (d) { return d.heThong; })[0], day = o.filter(function (d) { return d.tong && d.trong < 2 * 1073741824; })[0];
    return '<div style="line-height:1.8;margin:-4px 0 10px">Dữ liệu: <b>' + h(x.thuMucDuLieu || '') + '</b> · Sao lưu: <b>' + h(x.thuMuc || '') + '</b>' +
      (x.soBan != null ? ' (' + x.soBan + ' bản, ' + mb(x.dungLuongSaoLuu || 0) + ')' : '') +
      o.map(function (d) { return ' · Ổ <b>' + h(d.o) + '</b>' + (d.tong ? ' còn trống ' + gb(d.trong) + ' / ' + gb(d.tong) : ''); }).join('') + '</div>' +
      (c ? '<div class="canh-bao" style="margin-bottom:10px">Dữ liệu / bản sao lưu đang nằm trên <b>ổ hệ thống ' + h(c.o) + '</b>' + (c.tong ? ' (còn trống ' + gb(c.trong) + ')' : '') + ' – dễ làm đầy ổ C. ' +
        'Chuyển sang ổ D: trên máy chủ, mở thư mục bộ cài <b>ChamCong</b>, nhấp đúp <b>ChuyenDuLieu-SangO-D.bat</b> (bấm Yes khi Windows hỏi quyền quản trị). ' +
        'Bộ cài chép dữ liệu, bản sao lưu sang <b>D:\\ChamCongData</b>, kiểm tra từng tệp rồi mới xoá bản trên ổ C; phần mềm tạm dừng khoảng 1 phút, tài khoản và dữ liệu giữ nguyên.</div>'
        : day ? '<div class="canh-bao" style="margin-bottom:10px">Ổ <b>' + h(day.o) + '</b> chỉ còn ' + gb(day.trong) + ' trống. Khi còn dưới 1 GB, máy chủ tự xoá bớt bản sao lưu cũ nhất (giữ ít nhất 30 bản); nên dọn ổ hoặc chuyển sang ổ khác.</div>' : '') +
      '<div style="margin-bottom:8px">Mỗi ngày 1 bản (lần lưu đầu tiên trong ngày), nén lại, giữ 120 bản gần nhất. Hồ sơ scan có thêm 1 bản trong thư mục sao lưu.</div>';
  }

  function veTaiKhoan(el) {
    api('taikhoan').then(function (r) {
      if (!r.ok) return;
      dsTK = r.data;
      App.$('#mc-tk', el).innerHTML = '<thead><tr><th>Tên đăng nhập</th><th>Cấp</th><th>Phạm vi</th>' + Object.keys(PHAN).map(function (k) { return '<th class="giua">' + PHAN[k] + '</th>'; }).join('') + '<th>Tạo lúc</th><th></th></tr></thead><tbody>' +
        r.data.map(function (x) {
          var q = x.quyen || {};
          return '<tr data-ten="' + h(x.ten) + '" data-vt="' + h(x.vaiTro) + '" data-dv="' + h((x.donVi || []).join(',')) + '" data-q="' + h(JSON.stringify(q)) + '"><td class="ten">' + h(x.ten) + (MC.toi && x.ten === MC.toi.ten ? ' <span class="the-tt lam">bạn</span>' : '') + '</td>' +
            '<td>' + h(VAI_TRO[x.vaiTro] || x.vaiTro) + '</td><td>' + (x.vaiTro === 'cham_cong' ? h((x.donVi || []).map(function (m) { return TL.tenPhongBan(App.db, m) || m; }).join(', ')) : '<span class="mo">Toàn công ty</span>') + '</td>' +
            Object.keys(PHAN).map(function (k) { var v = x.vaiTro === 'quan_tri' ? 2 : +q[k] || 0; return '<td class="giua"><span class="the-tt' + (v === 2 ? ' xanh' : v === 1 ? ' lam' : '') + '">' + MUC[v] + '</span></td>'; }).join('') + '<td class="giua">' + (x.taoLuc ? new Date(x.taoLuc).toLocaleDateString('vi-VN') : '') + '</td>' +
            '<td><button class="nut nho" data-a="sua">Đặt lại mật khẩu / vai trò</button> ' + (MC.toi && x.ten === MC.toi.ten ? '' : '<button class="nut nho nguy" data-a="xoa">' + App.icon('xoa') + '</button>') + '</td></tr>';
        }).join('') + '</tbody>';
      App.$('#mc-tk', el).onclick = function (e) {
        var b = e.target.closest('[data-a]'); if (!b) return;
        var tr = b.closest('tr');
        if (b.dataset.a === 'sua') formTaiKhoan({ ten: tr.dataset.ten, vaiTro: tr.dataset.vt, donVi: tr.dataset.dv ? tr.dataset.dv.split(',') : [], quyen: JSON.parse(tr.dataset.q || '{}') }, el);
        else App.xacNhan('Xoá tài khoản <b>' + h(tr.dataset.ten) + '</b>?', { nut: 'Xoá', nguy: true }).then(function (ok) {
          if (!ok) return;
          api('taikhoan?ten=' + encodeURIComponent(tr.dataset.ten), { method: 'DELETE' }).then(function (r2) {
            if (!r2.ok) App.bao((r2.data && r2.data.loi) || 'Không xoá được.', 'loi'); else veTaiKhoan(el);
          });
        });
      };
    });
  }

  function formTaiKhoan(tk, elCha) {
    var f = App.F;
    App.hop({
      tieuDe: tk ? 'Tài khoản ' + tk.ten : 'Thêm tài khoản', co: 'hep',
      than: '<form class="form" style="grid-template-columns:1fr" onsubmit="return false">' +
        f.o('Tên đăng nhập', tk ? '<input name="ten" value="' + h(tk.ten) + '" readonly>' : f.txt('ten', '', 'autocomplete="off"')) +
        f.o(tk ? 'Mật khẩu mới (để trống = giữ nguyên)' : 'Mật khẩu (ít nhất 6 ký tự)', '<input name="matKhau" type="password" autocomplete="new-password">') +
        f.o('Mẫu phân quyền', '<select name="_mau"><option value="">(Chọn mẫu để điền nhanh)</option>' + MAU_QUYEN.map(function (m) { return '<option value="' + m.ma + '">' + h(m.ten) + '</option>'; }).join('') + '</select>') +
        f.o('Cấp', f.sel('vaiTro', tk ? tk.vaiTro : 'nhap_lieu', f.cap(VAI_TRO))) +
        '<div class="o" id="tk-dv">Phòng / đội được giao<div class="tk-dv">' + App.dsDonVi({ chi: null }).map(function (p) {
          return '<label class="chk"><input type="checkbox" data-dv="' + h(p.ma) + '"' + (tk && (tk.donVi || []).indexOf(p.ma) >= 0 ? ' checked' : '') + '> ' + h(p.ten) + '</label>';
        }).join('') + '</div><span class="gc">Tài khoản chỉ thấy nhân viên thuộc các đơn vị này.</span></div>' +
        '<div class="o" id="tk-q">Quyền từng phần<table class="bang" style="margin-top:4px"><tbody>' + Object.keys(PHAN).map(function (k) {
          var v = tk && tk.quyen ? +tk.quyen[k] || 0 : 2;
          return '<tr><td>' + PHAN[k] + '<div class="mo nho">' + { cc: 'Bảng chấm công, giờ vào / ra', ns: 'Hồ sơ, hợp đồng, quyết định, nghỉ phép, theo dõi HĐ', lg: 'Bảng lương, phiếu lương, xếp lương, mức lương', tl: 'Danh mục, cài đặt' }[k] + '</div></td>' +
            '<td><select name="q_' + k + '">' + MUC.map(function (t, i) { return '<option value="' + i + '"' + (v === i ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></td></tr>';
        }).join('') + '</tbody></table><span class="gc" id="tk-q-gc"></span></div></form>',
      moRa: function (el) {
        var fm = App.$('form', el), hien = function () {
          var dv = fm.vaiTro.value === 'cham_cong';
          App.$('#tk-dv', el).style.display = dv ? '' : 'none';
          App.$('#tk-q', el).style.display = fm.vaiTro.value === 'quan_tri' ? 'none' : '';
          // cấp phòng / đội: tiền lương tối đa Xem, không có thiết lập
          Array.prototype.forEach.call(fm.q_lg.options, function (o) { o.disabled = dv && o.value === '2'; });
          if (dv && fm.q_lg.value === '2') fm.q_lg.value = '1';
          fm.q_tl.disabled = dv; if (dv) fm.q_tl.value = '0';
          App.$('#tk-q-gc', el).textContent = dv ? 'Cấp phòng / đội: tiền lương tối đa được xem, không sửa danh mục, cài đặt.' : '';
        };
        fm.vaiTro.onchange = hien;
        fm._mau.onchange = function () {
          var m = MAU_QUYEN.filter(function (x) { return x.ma === fm._mau.value; })[0]; if (!m) return;
          fm.vaiTro.value = m.vaiTro; Object.keys(PHAN).forEach(function (k) { fm['q_' + k].value = String(m.quyen[k]); });
          hien();
        };
        hien();
      },
      nut: [{ ten: 'Huỷ' }, {
        ten: 'Lưu', loai: 'chinh', bam: function (el) {
          var v = f.doc(el), dv = App.$$('[data-dv]:checked', el).map(function (c) { return c.dataset.dv; });
          if (v.vaiTro === 'cham_cong' && !dv.length) { App.bao('Chọn ít nhất 1 phòng / đội cho tài khoản cấp phòng / đội.', 'loi'); return false; }
          var q = {}; Object.keys(PHAN).forEach(function (k) { q[k] = +v['q_' + k] || 0; });
          if (v.vaiTro !== 'quan_tri' && !Object.keys(q).some(function (k) { return q[k] > 0; })) { App.bao('Chọn ít nhất 1 quyền Xem hoặc Sửa.', 'loi'); return false; }
          api('taikhoan', { method: 'POST', json: { ten: v.ten, matKhau: v.matKhau, vaiTro: v.vaiTro, donVi: dv, quyen: q } }).then(function (r) {
            if (!r.ok) { App.bao((r.data && r.data.loi) || 'Không lưu được.', 'loi'); return; }
            App.bao('Đã lưu tài khoản ' + v.ten, 'tot'); App.$('.mo-nen .dong').click(); veTaiKhoan(elCha);
          });
          return false;
        }
      }]
    });
  }

  var dsTK = [];
  function matKhauNgauNhien() {
    var bo = 'abcdefghjkmnpqrstuvwxyz23456789', a = new Uint32Array(8), s = '';
    crypto.getRandomValues(a);
    for (var i = 0; i < a.length; i++) s += bo[a[i] % bo.length];
    return s;
  }

  /** Tạo nhanh mỗi phòng / đội một tài khoản chấm công, mật khẩu ngẫu nhiên, in danh sách để phát cho các đơn vị */
  function taoNhanh(elCha) {
    var daCo = {};
    dsTK.forEach(function (t) { if (t.vaiTro === 'cham_cong') (t.donVi || []).forEach(function (m) { daCo[m] = t.ten; }); });
    var tenDung = {}; dsTK.forEach(function (t) { tenDung[t.ten.toLowerCase()] = 1; });
    var dem = {}; App.db.nhanVien.forEach(function (nv) { if (nv.trangThai !== 'nghi_viec') dem[nv.phongBan] = (dem[nv.phongBan] || 0) + 1; });
    var ds = App.dsDonVi({ chi: null }).map(function (p) {
      var goc = 'cc.' + App.boDau(p.ma).toLowerCase().replace(/[^a-z0-9]/g, ''), ten = goc, n = 2;
      while (tenDung[ten]) ten = goc + n++;
      return { p: p, ten: ten, co: daCo[p.ma], nv: dem[p.ma] || 0 };
    });
    App.hop({
      tieuDe: 'Tạo tài khoản cho từng phòng / đội', co: 'rong',
      than: '<div class="hang" style="margin-bottom:10px"><b>Quyền:</b><select id="tn-mau">' + MAU_QUYEN.filter(function (m) { return m.vaiTro === 'cham_cong'; }).map(function (m) {
          return '<option value="' + m.ma + '">' + h(m.ten) + '</option>'; }).join('') + '</select></div>' +
        '<p class="mo" style="margin-top:0">Mỗi đơn vị được chọn có 1 tài khoản riêng, chỉ thấy nhân viên của đơn vị đó (màn hình Tổng quan đơn vị riêng của đội). Mật khẩu tạo ngẫu nhiên, hiện một lần sau khi tạo để in / phát cho người chấm công (họ nên đổi mật khẩu ở thanh bên sau khi đăng nhập).</p>' +
        '<div class="cuon"><table class="bang"><thead><tr><th></th><th>Phòng / đội</th><th>Nhân viên</th><th>Tên đăng nhập</th><th>Ghi chú</th></tr></thead><tbody>' +
        ds.map(function (x, i) {
          return '<tr data-i="' + i + '"><td class="giua"><input type="checkbox" data-chon' + (!x.co && x.nv ? ' checked' : '') + '></td><td>' + h(x.p.ten) + '</td><td class="giua">' + x.nv + '</td>' +
            '<td><input data-ten value="' + h(x.ten) + '" style="width:150px"></td><td class="mo">' + (x.co ? 'Đã có tài khoản: ' + h(x.co) : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>',
      nut: [{ ten: 'Huỷ' }, {
        ten: 'Tạo tài khoản', loai: 'chinh', bam: function (el) {
          var chon = App.$$('tr[data-i]', el).filter(function (tr) { return App.$('[data-chon]', tr).checked; }).map(function (tr) {
            return { p: ds[+tr.dataset.i].p, ten: App.$('[data-ten]', tr).value.trim(), mk: matKhauNgauNhien() };
          });
          var mau = MAU_QUYEN.filter(function (m) { return m.ma === App.$('#tn-mau', el).value; })[0] || MAU_QUYEN[6];
          if (!chon.length) { App.bao('Chọn ít nhất 1 phòng / đội.', 'loi'); return false; }
          var kq = [], i = 0;
          (function tiep() {
            if (i >= chon.length) { ketQua(kq); veTaiKhoan(elCha); return; }
            var x = chon[i++];
            api('taikhoan', { method: 'POST', json: { ten: x.ten, matKhau: x.mk, vaiTro: 'cham_cong', donVi: [x.p.ma], quyen: mau.quyen } }).then(function (r) {
              x.loi = r.ok ? '' : (r.data && r.data.loi) || 'Lỗi ' + r.status; x.quyen = moTaQuyen(mau.quyen); kq.push(x); tiep();
            }, function () { x.loi = 'Mất kết nối'; kq.push(x); tiep(); });
          })();
        }
      }]
    });
  }

  function ketQua(kq) {
    var ct = App.db.congTy, dc = location.origin + location.pathname;
    var bang = '<table class="bang"><thead><tr><th>STT</th><th>Phòng / đội</th><th>Tên đăng nhập</th><th>Mật khẩu</th><th>Quyền</th><th>Kết quả</th></tr></thead><tbody>' +
      kq.map(function (x, i) {
        return '<tr><td class="giua">' + (i + 1) + '</td><td>' + h(x.p.ten) + '</td><td><b>' + h(x.ten) + '</b></td><td><code style="font-size:15px">' + (x.loi ? '' : h(x.mk)) + '</code></td><td>' + h(x.quyen || '') + '</td><td>' + (x.loi ? '<span style="color:var(--do)">' + h(x.loi) + '</span>' : 'Đã tạo') + '</td></tr>';
      }).join('') + '</tbody></table>';
    App.hop({
      tieuDe: 'Tài khoản phòng / đội đã tạo', co: 'rong',
      than: '<div class="canh-bao" style="margin-bottom:10px">Mật khẩu chỉ hiện <b>một lần</b>. Hãy in hoặc ghi lại ngay.</div>' + bang +
        '<p class="mo nho">Địa chỉ đăng nhập: <b>' + h(dc) + '</b></p>',
      nut: [{ ten: 'In danh sách', bam: function () {
        App.inNoiDung('<div class="vb"><p style="text-align:center"><b>' + h(ct.ten || '') + '</b></p><h2 style="text-align:center">TÀI KHOẢN PHẦN MỀM CÁC PHÒNG, ĐỘI</h2>' +
          '<p>Địa chỉ phần mềm: <b>' + h(dc) + '</b>. Đăng nhập rồi đổi mật khẩu (thanh bên → Đổi mật khẩu). Mỗi tài khoản chỉ thấy nhân viên thuộc đơn vị mình.</p>' + bang + '</div>');
        return false;
      } }, { ten: 'Đóng', loai: 'chinh' }]
    });
  }

  function doiMatKhau() {
    App.hop({
      tieuDe: 'Đổi mật khẩu', co: 'hep',
      than: '<form class="form" style="grid-template-columns:1fr" onsubmit="return false">' +
        '<label class="o">Mật khẩu hiện tại<input name="cu" type="password" autocomplete="current-password"></label>' +
        '<label class="o">Mật khẩu mới (ít nhất 6 ký tự)<input name="moi" type="password" autocomplete="new-password"></label>' +
        '<label class="o">Nhập lại mật khẩu mới<input name="moi2" type="password" autocomplete="new-password"></label></form>',
      nut: [{ ten: 'Huỷ' }, {
        ten: 'Đổi mật khẩu', loai: 'chinh', bam: function (el) {
          var v = App.F.doc(el);
          if (v.moi !== v.moi2) { App.bao('Hai lần nhập mật khẩu mới không giống nhau.', 'loi'); return false; }
          api('doimatkhau', { method: 'POST', json: { cu: v.cu, moi: v.moi } }).then(function (r) {
            if (!r.ok) { App.bao((r.data && r.data.loi) || 'Không đổi được.', 'loi'); return; }
            App.bao('Đã đổi mật khẩu.', 'tot'); App.$('.mo-nen .dong').click();
          });
          return false;
        }
      }]
    });
  }
})();
