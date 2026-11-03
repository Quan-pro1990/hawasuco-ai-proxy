/* Thang, bảng lương: danh mục bảng lương → chức danh / nhóm công việc → bậc lương (mức tiền hoặc hệ số);
   xếp lương cho nhân viên; danh sách đến hạn nâng bậc và lập quyết định nâng bậc. */
(function () {
  'use strict';
  var App = window.App, TL = window.TL, h = App.h;
  var NF_HS = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  var st = { tab: 'xep', pb: '', tim: '', chuaXep: false, han: '3' };

  App.soHS = function (v) { return NF_HS.format(+v || 0); };
  function docHS(s) { var n = parseFloat(String(s == null ? '' : s).trim().replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; }
  function opts(obj, chon) { return Object.keys(obj).map(function (k) { return '<option value="' + k + '"' + (k === chon ? ' selected' : '') + '>' + h(obj[k]) + '</option>'; }).join(''); }

  /** "Bậc 3 – hệ số 3,00 = 7.020.000 đ" */
  App.moTaBac = function (b, g, bac) {
    var gt = TL.giaTriBac(App.db, b, g, bac);
    if (!gt) return 'Bậc ' + bac;
    return 'Bậc ' + bac + ' – ' + (gt.heSo != null ? 'hệ số ' + App.soHS(gt.heSo) + ' = ' : '') + App.tien(gt.tien) + ' đ';
  };
  /** "Chuyên viên, bậc 3/8 (hệ số 3,00)" */
  App.moTaXepLuong = function (nv) {
    var xl = TL.xepLuongNV(App.db, nv);
    if (!xl) return '';
    return xl.ngach.ten + ', bậc ' + xl.bac + '/' + xl.soBac + (xl.heSo != null ? ' (hệ số ' + App.soHS(xl.heSo) + ')' : '');
  };

  function dsXep(maBang, maNgach, bac) {
    return App.db.nhanVien.filter(function (nv) {
      var x = nv.xepLuong;
      return nv.trangThai !== 'nghi_viec' && x && x.bang === maBang && (maNgach == null || x.ngach === maNgach) && (bac == null || +x.bac === bac);
    });
  }

  /** Áp lại mức lương theo bảng cho những người đang xếp (tất cả hoặc một bảng). Trả về số người đã đổi. */
  App.apDungBangLuong = function (maBang, imLang) {
    var doi = [];
    App.db.nhanVien.forEach(function (nv) {
      if (nv.trangThai === 'nghi_viec' || !nv.xepLuong || (maBang && nv.xepLuong.bang !== maBang)) return;
      var d = TL.apXepLuong(App.db, nv);
      if (Object.keys(d).length) { doi.push({ nv: nv, d: d }); if (App.dongBoHoSo) App.dongBoHoSo(nv); }
    });
    if (doi.length && !imLang) App.bao('Đã cập nhật lương theo bảng cho ' + doi.length + ' nhân viên: ' + doi.slice(0, 4).map(function (x) {
      var k = x.d.luongCB || x.d.luongBH; return x.nv.hoTen + ' ' + App.tien(k[0]) + ' → ' + App.tien(k[1]);
    }).join('; ') + (doi.length > 4 ? '…' : ''), 'tot');
    return doi.length;
  };

  /* ================= Danh mục thang, bảng lương ================= */

  App.dmThangLuong = function (el) {
    var db = App.db, ds = db.thangLuong;
    ds.forEach(TL.chuanBangLuong);
    el.innerHTML = '<div class="the"><h3>Thang, bảng lương<span class="phai">' + ds.length + ' bảng · lương cơ sở ' + App.tien(db.caiDat.luongCoSo) + ' đ</span></h3>' +
      '<p class="mo" style="margin:0">Mỗi bảng gồm các <b>chức danh / nhóm công việc</b>, mỗi chức danh có nhiều <b>bậc</b>. Giá trị bậc là <b>mức tiền</b> (đồng / tháng) hoặc <b>hệ số</b> × mức lương cơ sở. ' +
      '“Dùng cho” quyết định bậc lương được ghi vào <b>mức lương</b> (tính lương thời gian), <b>lương đóng bảo hiểm</b>, hay cả hai. ' +
      'Xếp bậc cho từng người ở trang <a href="#nangbac">Xếp lương, nâng bậc</a> hoặc trong hồ sơ nhân viên. ' +
      'Sửa giá trị bậc hoặc mức lương cơ sở sẽ cập nhật ngay lương của người đang xếp ở bậc đó (các kỳ đã chốt không đổi).</p></div>' +
      ds.map(theBang).join('') +
      '<div class="the"><h3>Thêm bảng lương</h3><div class="hang"><input id="tl-ten" placeholder="Tên bảng (vd Bảng lương chức vụ quản lý)" style="width:340px">' +
      '<select id="tl-kieu">' + opts(TL.KIEU_BL, 'tien') + '</select><select id="tl-apdung">' + opts(TL.AP_DUNG_BL, 'cb') + '</select>' +
      '<button class="nut chinh" id="tl-them">' + App.icon('them') + 'Thêm bảng lương</button></div></div>';

    function bang(t) { var c = t.closest('[data-b]'); return c ? ds[+c.dataset.b] : null; }
    function ngach(t, b) { var r = t.closest('[data-g]'); return r ? b.ngach[+r.dataset.g] : null; }
    function veLai() { App.dmThangLuong(el); }

    el.onchange = function (e) {
      var i = e.target, b = bang(i); if (!b) return;
      var f = i.dataset.f, g = ngach(i, b), apLai = false;
      if (i.dataset.bac != null) {
        var k = +i.dataset.bac, v = b.kieu === 'he_so' ? docHS(i.value) : App.docSo(i.value);
        if (!v && dsXep(b.ma, g.ma, k + 1).length) { App.bao('Bậc ' + (k + 1) + ' đang xếp cho ' + dsXep(b.ma, g.ma, k + 1).length + ' nhân viên – không để trống được.', 'loi'); veLai(); return; }
        g.bac[k] = v || ''; apLai = true;
      } else if (f === 'ten') { if (!i.value.trim()) { veLai(); return; } b.ten = i.value.trim(); }
      else if (f === 'apDung') { b.apDung = i.value; apLai = true; }
      else if (f === 'mucCoSo') { b.mucCoSo = App.docSo(i.value) || ''; apLai = true; }
      else if (f === 'namNang') { b.namNang = docHS(i.value) || 3; }
      else if (f === 'gten') { if (!i.value.trim()) { veLai(); return; } g.ten = i.value.trim(); }
      else if (f === 'gnam') { g.namNang = docHS(i.value) || ''; }
      else if (f === 'kieu') {
        var n = dsXep(b.ma).length;
        if (n) { App.bao('Bảng đang xếp cho ' + n + ' nhân viên – không đổi kiểu được. Tạo bảng mới nếu cần.', 'loi'); veLai(); return; }
        var coGT = b.ngach.some(function (x) { return x.bac.some(function (v) { return +v > 0; }); });
        var doiKieu = function () { b.kieu = i.value; b.ngach.forEach(function (x) { x.bac = x.bac.map(function () { return ''; }); }); App.luu(); veLai(); };
        if (coGT) App.xacNhan('Đổi kiểu bảng sẽ xoá giá trị các bậc đã nhập. Tiếp tục?', { nut: 'Đổi kiểu', nguy: true }).then(function (ok) { if (ok) doiKieu(); else veLai(); });
        else doiKieu();
        return;
      } else return;
      App.luu();
      if (apLai) App.apDungBangLuong(b.ma);
      if (i.dataset.bac != null || f === 'mucCoSo' || f === 'apDung') veLai(); else App.bao('Đã lưu');
    };

    el.onclick = function (e) {
      if (e.target.closest('#tl-them')) {
        var ten = App.$('#tl-ten').value.trim();
        if (!ten) { App.bao('Nhập tên bảng lương.', 'loi'); App.$('#tl-ten').focus(); return; }
        var ma = 'BL1', n = 1; while (ds.some(function (x) { return x.ma === ma; })) ma = 'BL' + (++n);
        ds.push(TL.chuanBangLuong({ ma: ma, ten: ten, kieu: App.$('#tl-kieu').value, apDung: App.$('#tl-apdung').value, namNang: 3, soBac: 7, ngach: [] }));
        App.luu(); veLai(); App.bao('Đã thêm ' + ten + '. Thêm chức danh và nhập giá trị từng bậc.', 'tot');
        return;
      }
      var a = e.target.closest('[data-a]'); if (!a) return;
      var b = bang(a); if (!b) return;
      var g = ngach(a, b), act = a.dataset.a;
      if (act === 'thembac') { b.soBac++; b.ngach.forEach(function (x) { x.bac.push(''); }); App.luu(); veLai(); return; }
      if (act === 'botbac') {
        if (b.soBac <= 1) return;
        var nb = dsXep(b.ma, null, b.soBac).length;
        if (nb) { App.bao('Bậc ' + b.soBac + ' đang xếp cho ' + nb + ' nhân viên – không bớt được.', 'loi'); return; }
        var bo = function () { b.soBac--; b.ngach.forEach(function (x) { x.bac.length = b.soBac; }); App.luu(); veLai(); };
        if (b.ngach.some(function (x) { return +x.bac[b.soBac - 1] > 0; })) App.xacNhan('Bớt cột bậc ' + b.soBac + ' (đang có giá trị)?', { nut: 'Bớt bậc', nguy: true }).then(function (ok) { if (ok) bo(); });
        else bo();
        return;
      }
      if (act === 'xoabang') {
        var n1 = dsXep(b.ma).length;
        if (n1) { App.bao('Bảng “' + b.ten + '” đang xếp cho ' + n1 + ' nhân viên. Hãy xếp họ sang bảng khác (trang Xếp lương, nâng bậc) rồi mới xoá.', 'loi'); return; }
        App.xacNhan('Xoá bảng lương <b>' + h(b.ten) + '</b>?', { nut: 'Xoá', nguy: true }).then(function (ok) { if (ok) { ds.splice(ds.indexOf(b), 1); App.luu(); veLai(); } });
        return;
      }
      if (act === 'themngach') {
        var card = a.closest('[data-b]'), iMa = App.$('[data-f="mamoi"]', card), iTen = App.$('[data-f="tenmoi"]', card);
        var ten2 = iTen.value.trim(), ma2 = iMa.value.trim();
        if (!ten2) { App.bao('Nhập tên chức danh / nhóm công việc.', 'loi'); iTen.focus(); return; }
        if (!ma2) ma2 = App.boDau(ten2).split(/[\s,\-–]+/).map(function (w) { return w[0] || ''; }).join('').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) || 'CD';
        var goc = ma2, k2 = 2; while (b.ngach.some(function (x) { return x.ma.toLowerCase() === ma2.toLowerCase(); })) ma2 = goc + k2++;
        b.ngach.push({ ma: ma2, ten: ten2, bac: Array.apply(null, Array(b.soBac)).map(function () { return ''; }), namNang: '' });
        App.luu(); veLai();
        return;
      }
      if (act === 'xoangach' && g) {
        var n2 = dsXep(b.ma, g.ma).length;
        if (n2) { App.bao('“' + g.ten + '” đang xếp cho ' + n2 + ' nhân viên – hãy xếp họ sang chức danh khác trước.', 'loi'); return; }
        App.xacNhan('Xoá chức danh <b>' + h(g.ten) + '</b> khỏi bảng?', { nut: 'Xoá', nguy: true }).then(function (ok) { if (ok) { b.ngach.splice(b.ngach.indexOf(g), 1); App.luu(); veLai(); } });
        return;
      }
      if (act === 'lenngach' && g) { var i0 = b.ngach.indexOf(g); if (i0 > 0) { b.ngach.splice(i0 - 1, 0, b.ngach.splice(i0, 1)[0]); App.luu(); veLai(); } }
    };
  };

  function theBang(b, bi) {
    var db = App.db, hs = b.kieu === 'he_so', cot = '';
    for (var k = 1; k <= b.soBac; k++) cot += '<th class="so" style="min-width:' + (hs ? 70 : 110) + 'px">Bậc ' + k + '</th>';
    var soNV = dsXep(b.ma).length;
    return '<div class="the" data-b="' + bi + '">' +
      '<div class="hang" style="margin-bottom:10px;gap:8px 14px">' +
      '<input class="o-nhap chu" data-f="ten" value="' + h(b.ten) + '" style="flex:1;min-width:340px;font-weight:700;font-size:15px" title="Tên bảng">' +
      '<label class="nho">Kiểu <select data-f="kieu">' + opts(TL.KIEU_BL, b.kieu) + '</select></label>' +
      (hs ? '<label class="nho">Mức lương cơ sở <input class="o-nhap so" data-f="mucCoSo" value="' + (b.mucCoSo ? App.tien(b.mucCoSo) : '') + '" placeholder="' + App.tien(db.caiDat.luongCoSo) + '" style="width:110px" title="Để trống = lương cơ sở trong Cài đặt"></label>' : '') +
      '<label class="nho">Dùng cho <select data-f="apDung">' + opts(TL.AP_DUNG_BL, b.apDung) + '</select></label>' +
      '<label class="nho">Nâng bậc sau <input class="o-nhap so" data-f="namNang" value="' + App.so(b.namNang) + '" style="width:46px"> năm</label>' +
      '<span class="gian"></span><span class="mo nho">' + soNV + ' nhân viên</span>' +
      '<button class="nut nho" data-a="thembac" title="Thêm cột bậc">+ Bậc</button><button class="nut nho" data-a="botbac" title="Bớt cột bậc cuối">− Bậc</button>' +
      '<button class="nut nho nguy" data-a="xoabang" title="Xoá bảng">' + App.icon('xoa') + '</button></div>' +
      '<div class="cuon"><table class="bang bang-bac"><thead><tr><th>Mã</th><th style="min-width:230px">Chức danh / nhóm công việc</th><th title="Thời gian giữ bậc để xét nâng bậc; để trống = theo bảng">Năm nâng</th>' + cot + '<th>NV</th><th></th></tr></thead><tbody>' +
      (b.ngach.length ? b.ngach.map(function (g, gi) {
        var n = dsXep(b.ma, g.ma).length;
        return '<tr data-g="' + gi + '"><td>' + h(g.ma) + '</td><td><input class="o-nhap chu" data-f="gten" value="' + h(g.ten) + '" style="width:100%"></td>' +
          '<td><input class="o-nhap so" data-f="gnam" value="' + (g.namNang ? App.so(g.namNang) : '') + '" placeholder="' + App.so(b.namNang) + '" style="width:46px"></td>' +
          g.bac.map(function (v, k) {
            var gt = TL.giaTriBac(db, b, g, k + 1), nk = dsXep(b.ma, g.ma, k + 1).length;
            return '<td class="so"><input class="o-nhap so" data-bac="' + k + '" value="' + (+v > 0 ? (hs ? App.soHS(v) : App.tien(v)) : '') + '" style="width:100%">' +
              (hs && gt ? '<div class="mo nho">' + App.tien(gt.tien) + '</div>' : '') + (nk ? '<div class="nho" style="color:var(--chinh)" title="Số người đang hưởng bậc này">' + nk + ' người</div>' : '') + '</td>';
          }).join('') +
          '<td class="giua">' + (n || '') + '</td><td style="white-space:nowrap">' + (gi ? '<button class="nut nho" data-a="lenngach" title="Lên">▲</button> ' : '') +
          '<button class="nut nho nguy" data-a="xoangach" title="Xoá chức danh">' + App.icon('xoa') + '</button></td></tr>';
      }).join('') : '<tr><td colspan="' + (b.soBac + 5) + '" class="trong">Chưa có chức danh. Thêm ở dưới.</td></tr>') +
      '</tbody></table></div>' +
      '<div class="hang" style="margin-top:10px"><input data-f="mamoi" placeholder="Mã (vd CV)" style="width:100px"><input data-f="tenmoi" placeholder="Chức danh / nhóm (vd Chuyên viên, kỹ sư)" style="width:320px">' +
      '<button class="nut" data-a="themngach">' + App.icon('them') + 'Thêm chức danh</button></div></div>';
  }

  /* ================= Ô chọn bảng / chức danh / bậc (dùng chung: trang xếp lương, hồ sơ) ================= */

  /** HTML 3 ô chọn; x = nv.xepLuong (có thể null) */
  App.oChonBac = function (x, attr) {
    var db = App.db, b = x && TL.timBangLuong(db, x.bang), g = b && TL.timNgach(b, x.ngach);
    attr = attr || '';
    var s = '<select data-xl="bang" ' + attr + '><option value="">(Chưa xếp)</option>' + db.thangLuong.map(function (t) { return '<option value="' + h(t.ma) + '"' + (b === t ? ' selected' : '') + '>' + h(t.ten) + '</option>'; }).join('') + '</select>';
    s += '<select data-xl="ngach" ' + attr + (b ? '' : ' disabled') + '>' + (b ? b.ngach.map(function (n) { return '<option value="' + h(n.ma) + '"' + (g === n ? ' selected' : '') + '>' + h(n.ten) + '</option>'; }).join('') : '') + '</select>';
    var sb = g ? TL.soBacNgach(g) : 0, bac = x ? +x.bac || 1 : 1, ob = '';
    for (var k = 1; k <= Math.max(sb, g ? bac : 0); k++) ob += '<option value="' + k + '"' + (k === bac ? ' selected' : '') + '>' + h(App.moTaBac(b, g, k)) + '</option>';
    s += '<select data-xl="bac" ' + attr + (g ? '' : ' disabled') + '>' + ob + '</select>';
    return s;
  };
  /** Đọc thay đổi từ ô chọn → xepLuong mới (null = bỏ xếp) */
  App.docChonBac = function (cu, truong, giaTri) {
    var db = App.db, x = cu ? Object.assign({}, cu) : null;
    if (truong === 'bang') {
      if (!giaTri) return null;
      var b = TL.timBangLuong(db, giaTri);
      if (!b || !b.ngach.length) { App.bao('Bảng lương này chưa có chức danh (Danh mục → Thang, bảng lương).', 'loi'); return cu; }
      return { bang: b.ma, ngach: b.ngach[0].ma, bac: 1, ngayHuong: (x && x.ngayHuong) || App.homNay() };
    }
    if (!x) return x;
    if (truong === 'ngach') { x.ngach = giaTri; var g = TL.timNgach(TL.timBangLuong(db, x.bang), giaTri); x.bac = Math.min(+x.bac || 1, Math.max(1, TL.soBacNgach(g))); }
    if (truong === 'bac') x.bac = +giaTri;
    if (truong === 'ngayHuong') x.ngayHuong = giaTri;
    return x;
  };

  /* ================= Trang Xếp lương, nâng bậc ================= */

  var TABS = [['xep', 'Xếp lương nhân viên'], ['han', 'Đến hạn nâng bậc']];

  function ve(noi) {
    noi.innerHTML = '<div class="tabs khong-in">' + TABS.map(function (t) { return '<button data-t="' + t[0] + '"' + (st.tab === t[0] ? ' class="chon"' : '') + '>' + t[1] + '</button>'; }).join('') + '</div><div id="nb-noi"></div>';
    App.$('.tabs', noi).onclick = function (e) { var b = e.target.closest('[data-t]'); if (b) { st.tab = b.dataset.t; App.veLai(); } };
    if (!App.db.thangLuong.length) {
      App.$('#nb-noi').innerHTML = '<div class="the canh-bao">Chưa có thang, bảng lương. Vào <a href="#danhmuc" id="nb-dm">Danh mục → Thang, bảng lương</a> để khai báo các bảng, chức danh và bậc lương.</div>';
      App.$('#nb-dm').onclick = function () { App.moDanhMuc && App.moDanhMuc('bl'); };
      return;
    }
    (st.tab === 'han' ? veHan : veXep)(App.$('#nb-noi'));
  }

  function dsNV() {
    return App.db.nhanVien.filter(function (nv) {
      if (nv.trangThai === 'nghi_viec') return false;
      if (st.pb && nv.phongBan !== st.pb) return false;
      if (st.chuaXep && TL.xepLuongNV(App.db, nv)) return false;
      if (st.tim && !App.timKhop(nv.ma + ' ' + nv.hoTen + ' ' + (nv.chucVu || ''), st.tim)) return false;
      return true;
    }).sort(function (a, b) { return String(a.ma).localeCompare(String(b.ma), 'vi', { numeric: true }); });
  }

  function veXep(el) {
    var db = App.db, ds = dsNV(), hn = App.homNay();
    var lech = 0;
    var rows = ds.map(function (nv, i) {
      var xl = TL.xepLuongNV(db, nv), ht = nv.hinhThuc || 'thang';
      var apCB = xl && (xl.apDung === 'cb' || xl.apDung === 'ca_hai'), apBH = xl && (xl.apDung === 'bh' || xl.apDung === 'ca_hai');
      var lechCB = apCB && (ht === 'thang' || ht === 'khoan') && +nv.luongCB !== xl.tien, lechBH = apBH && +nv.luongBH !== xl.tien;
      if (lechCB || lechBH) lech++;
      var hanTxt = !xl ? '' : xl.bacCuoi ? '<span class="mo">Bậc cuối</span>' : xl.ngayNang ? TL.hienNgay(xl.ngayNang) + (xl.ngayNang <= hn ? ' <span class="the-tt do">Đến hạn</span>' : '') : '<span class="mo">Nhập ngày hưởng</span>';
      return '<tr data-id="' + nv.id + '"><td class="giua">' + (i + 1) + '</td><td>' + h(nv.ma) + '</td><td class="ten"><span class="lk" data-hs="' + nv.id + '">' + h(nv.hoTen) + '</span></td>' +
        '<td>' + h(TL.tenPhongBan(db, nv.phongBan)) + '</td><td>' + h(nv.chucVu || '') + '</td>' +
        '<td><div class="chon-bac">' + App.oChonBac(nv.xepLuong) + '</div></td>' +
        '<td class="so">' + (xl && xl.heSo != null ? App.soHS(xl.heSo) : '') + '</td><td class="so"><b>' + (xl && xl.tien ? App.tien(xl.tien) : '') + '</b></td>' +
        '<td><input type="date" data-xl="ngayHuong" value="' + h(xl ? xl.ngayHuong : '') + '"' + (xl ? '' : ' disabled') + '></td>' +
        '<td class="so">' + App.tien(nv.luongCB) + (ht !== 'thang' && ht !== 'khoan' ? ' <span class="mo nho">' + App.DV_LUONG[ht] + '</span>' : '') + (lechCB ? ' <span class="the-tt cam" title="Khác mức theo bảng">≠</span>' : '') + '</td>' +
        '<td class="so">' + (+nv.luongBH ? App.tien(nv.luongBH) : '<span class="mo">theo lương</span>') + (lechBH ? ' <span class="the-tt cam" title="Khác mức theo bảng">≠</span>' : '') + '</td>' +
        '<td class="giua">' + hanTxt + '</td>' +
        '<td class="khong-in">' + (xl && !xl.bacCuoi ? '<button class="nut nho" data-a="nang">' + App.icon('bac') + 'Nâng bậc…</button>' : '') + '</td></tr>';
    }).join('');
    el.innerHTML = '<div class="the khong-in"><div class="hang">' +
      '<input type="search" id="nb-tim" placeholder="Tìm mã, tên, chức vụ…" value="' + h(st.tim) + '" style="width:220px">' +
      '<select id="nb-pb">' + App.optDonVi(st.pb, { tatCa: 'Tất cả phòng / đội' }) + '</select>' +
      '<label class="chk"><input type="checkbox" id="nb-chua"' + (st.chuaXep ? ' checked' : '') + '> Chỉ người chưa xếp</label><span class="gian"></span>' +
      (lech ? '<button class="nut" id="nb-ap" title="Ghi mức theo bảng vào mức lương / lương đóng BH của những người đang lệch">Áp lương theo bảng (' + lech + ')</button>' : '') +
      '<button class="nut" id="nb-xuat">' + App.icon('tai') + 'Xuất Excel</button></div>' +
      '<p class="mo nho" style="margin:8px 0 0">Chọn bảng – chức danh – bậc để <b>xếp lương ban đầu</b> hoặc sửa sai: mức theo bảng ghi ngay vào mức lương / lương đóng BH (tuỳ “Dùng cho” của bảng), áp dụng cho các kỳ chưa chốt. ' +
      '<b>Nâng bậc</b> có hiệu lực từ một ngày thì bấm “Nâng bậc…” để lập quyết định: các kỳ trước ngày hiệu lực vẫn tính lương cũ.</p></div>' +
      App.dauIn('DANH SÁCH XẾP LƯƠNG', 'Ngày ' + new Date().toLocaleDateString('vi-VN')) +
      '<div class="cuon cao"><table class="bang" id="nb-bang"><thead><tr><th>STT</th><th>Mã NV</th><th style="min-width:150px">Họ và tên</th><th>Phòng / đội</th><th>Chức vụ</th>' +
      '<th>Bảng lương · chức danh · bậc</th><th>Hệ số</th><th class="so">Mức theo bảng</th><th>Hưởng bậc từ</th><th class="so">Mức lương</th><th class="so">Lương đóng BH</th><th>Nâng bậc tiếp</th><th class="khong-in"></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="13" class="trong">Không có nhân viên phù hợp.</td></tr>') + '</tbody></table></div>';

    App.$('#nb-tim').oninput = function () { st.tim = this.value; var p = this.selectionStart; App.veLai(); var t = App.$('#nb-tim'); t.focus(); t.setSelectionRange(p, p); };
    App.$('#nb-pb').onchange = function () { st.pb = this.value; App.veLai(); };
    App.$('#nb-chua').onchange = function () { st.chuaXep = this.checked; App.veLai(); };
    var ba = App.$('#nb-ap'); if (ba) ba.onclick = function () { App.apDungBangLuong(); App.luu(); App.veLai(); };
    App.$('#nb-xuat').onclick = function () { xuatXep(ds); };
    var bang = App.$('#nb-bang');
    bang.onchange = function (e) {
      var i = e.target, tr = i.closest('tr[data-id]'); if (!tr || !i.dataset.xl) return;
      var nv = App.timNV(tr.dataset.id), cu = nv.xepLuong;
      var moi = App.docChonBac(cu, i.dataset.xl, i.value);
      if (moi === cu) { App.veLai(); return; }
      if (moi) nv.xepLuong = moi; else delete nv.xepLuong;
      var d = TL.apXepLuong(db, nv);
      if (App.dongBoHoSo) App.dongBoHoSo(nv);
      App.luu();
      var tb = [];
      if (d.luongCB) tb.push('mức lương ' + App.tien(d.luongCB[0]) + ' → ' + App.tien(d.luongCB[1]));
      if (d.luongBH) tb.push('lương đóng BH ' + App.tien(d.luongBH[0]) + ' → ' + App.tien(d.luongBH[1]));
      App.bao(nv.hoTen + ': ' + (moi ? App.moTaXepLuong(nv) : 'bỏ xếp bảng lương (giữ mức lương hiện tại)') + (tb.length ? '; ' + tb.join(', ') : ''), 'tot');
      App.veLai();
    };
    bang.onclick = function (e) {
      var s = e.target.closest('[data-hs]'); if (s) { App.moHoSo(s.dataset.hs, 'congviec'); return; }
      var a = e.target.closest('[data-a="nang"]'); if (!a) return;
      App.nangBac(App.timNV(a.closest('tr').dataset.id));
    };
  }

  /** Mở quyết định nâng lương điền sẵn bậc kế tiếp */
  App.nangBac = function (nv, hieuLuc) {
    var xl = TL.xepLuongNV(App.db, nv);
    if (!xl || xl.bacCuoi) { App.bao('Nhân viên đã ở bậc cuối hoặc chưa xếp bảng lương.', 'loi'); return; }
    App.formQuyetDinh(nv, null, 'nang_luong', function () { App.veLai(); }, {
      hieuLuc: hieuLuc || (xl.ngayNang && xl.ngayNang > App.homNay() ? xl.ngayNang : App.homNay()), bacMoi: xl.bac + 1,
      noiDung: 'Nâng bậc lương thường xuyên: ' + xl.ngach.ten + ' bậc ' + xl.bac + ' lên bậc ' + (xl.bac + 1)
    });
  };

  function dongHan() {
    var db = App.db, hn = App.homNay(), den;
    if (st.han === 'qua') den = hn;
    else den = TL.themThangISO(hn, +st.han);
    var rows = [];
    db.nhanVien.forEach(function (nv) {
      if (nv.trangThai === 'nghi_viec') return;
      if (st.pb && nv.phongBan !== st.pb) return;
      var xl = TL.xepLuongNV(db, nv);
      if (!xl || !xl.ngayNang || xl.ngayNang > den) return;
      rows.push({ nv: nv, xl: xl, qua: xl.ngayNang <= hn ? Math.round((new Date(hn) - new Date(xl.ngayNang)) / 864e5) : -1 });
    });
    return rows.sort(function (a, b) { return a.xl.ngayNang < b.xl.ngayNang ? -1 : 1; });
  }

  var COT_HAN = [
    { t: 'STT', stt: true, w: 5, kieu: 'giua' }, { t: 'Mã NV', w: 8, f: function (r) { return r.nv.ma; } }, { t: 'Họ và tên', w: 22, f: function (r) { return r.nv.hoTen; } },
    { t: 'Phòng / đội', w: 22, f: function (r) { return TL.tenPhongBan(App.db, r.nv.phongBan); } },
    { t: 'Bảng lương', w: 24, f: function (r) { return r.xl.bang.ten; } }, { t: 'Chức danh', w: 22, f: function (r) { return r.xl.ngach.ten; } },
    { t: 'Bậc hiện tại', w: 8, kieu: 'giua', f: function (r) { return r.xl.bac + '/' + r.xl.soBac; } },
    { t: 'Hệ số / mức hiện tại', w: 14, kieu: 'so', f: function (r) { return r.xl.heSo != null ? App.soHS(r.xl.heSo) : r.xl.tien; } },
    { t: 'Hưởng từ', w: 11, kieu: 'giua', f: function (r) { return TL.hienNgay(r.xl.ngayHuong); } },
    { t: 'Đến hạn nâng', w: 11, kieu: 'giua', f: function (r) { return TL.hienNgay(r.xl.ngayNang); } },
    { t: 'Bậc mới', w: 8, kieu: 'giua', f: function (r) { return r.xl.bac + 1; } },
    { t: 'Hệ số / mức mới', w: 14, kieu: 'so', f: function (r) { return r.xl.bacSau ? (r.xl.bacSau.heSo != null ? App.soHS(r.xl.bacSau.heSo) : r.xl.bacSau.tien) : ''; } },
    { t: 'Ghi chú', w: 30, f: function (r) { return [r.xl.keoDai ? 'Kéo dài ' + r.xl.keoDai + ' tháng do kỷ luật' : '', r.qua > 0 ? 'Đã quá hạn ' + r.qua + ' ngày' : r.qua === 0 ? 'Đến hạn hôm nay' : ''].filter(Boolean).join('; '); } }
  ];

  function veHan(el) {
    var rows = dongHan(), nhan = { qua: 'Đã đến hạn (tính đến hôm nay)', 1: 'Đến hạn trong 1 tháng tới', 3: 'Đến hạn trong 3 tháng tới', 6: 'Đến hạn trong 6 tháng tới', 12: 'Đến hạn trong 12 tháng tới' };
    var tieuDe = 'DANH SÁCH NHÂN VIÊN ĐẾN HẠN NÂNG BẬC LƯƠNG', phuDe = nhan[st.han] + ' – ngày ' + new Date().toLocaleDateString('vi-VN');
    el.innerHTML = '<div class="the khong-in"><div class="hang"><select id="nb-han">' + opts(nhan, st.han) + '</select>' +
      '<select id="nb-pb">' + App.optDonVi(st.pb, { tatCa: 'Tất cả phòng / đội' }) + '</select><span class="gian mo nho">' + rows.length + ' người. Thời gian nâng bậc theo chức danh / bảng lương; kỷ luật “kéo dài thời hạn nâng lương” cộng thêm 6 tháng.</span>' +
      '<button class="nut" id="nb-xuat">' + App.icon('tai') + 'Xuất Excel</button><button class="nut" id="nb-in">' + App.icon('in') + 'In</button></div></div>' +
      App.dauIn(tieuDe, phuDe) +
      '<div class="cuon cao"><table class="bang" id="nb-bang"><thead><tr>' + COT_HAN.map(function (c) { return '<th' + (c.kieu === 'so' ? ' class="so"' : '') + '>' + c.t + '</th>'; }).join('') + '<th class="khong-in"></th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (r, i) {
        return '<tr data-id="' + r.nv.id + '">' + COT_HAN.map(function (c) {
          var v = c.stt ? i + 1 : c.f(r);
          if (c.t === 'Họ và tên') v = '<span class="lk" data-hs="' + r.nv.id + '">' + h(v) + '</span>';
          else if (c.kieu === 'so' && typeof v === 'number') v = App.tien(v);
          else if (c.t === 'Đến hạn nâng') v = h(v) + (r.qua >= 0 ? ' <span class="the-tt do">Đến hạn</span>' : '');
          else v = h(v);
          return '<td' + (c.kieu === 'so' ? ' class="so"' : c.kieu === 'giua' ? ' class="giua"' : '') + '>' + v + '</td>';
        }).join('') + '<td class="khong-in"><button class="nut nho chinh" data-a="nang">' + App.icon('bac') + 'Nâng bậc…</button></td></tr>';
      }).join('') : '<tr><td colspan="' + (COT_HAN.length + 1) + '" class="trong">Không có nhân viên đến hạn nâng bậc trong khoảng này.</td></tr>') +
      '</tbody></table></div>';
    App.$('#nb-han').onchange = function () { st.han = this.value; App.veLai(); };
    App.$('#nb-pb').onchange = function () { st.pb = this.value; App.veLai(); };
    App.$('#nb-in').onclick = function () { App.inTrang(false); };
    App.$('#nb-xuat').onclick = function () {
      App.xuatExcel('Den_han_nang_bac_luong', [App.sheetBang({ ten: 'Đến hạn nâng bậc', tieuDe: tieuDe, phuDe: phuDe, cot: COT_HAN, dong: rows, chuKy: true })]);
    };
    App.$('#nb-bang').onclick = function (e) {
      var s = e.target.closest('[data-hs]'); if (s) { App.moHoSo(s.dataset.hs, 'congviec'); return; }
      var a = e.target.closest('[data-a="nang"]'); if (!a) return;
      var nv = App.timNV(a.closest('tr').dataset.id), xl = TL.xepLuongNV(App.db, nv);
      App.nangBac(nv, xl.ngayNang);
    };
  }

  function xuatXep(ds) {
    var db = App.db;
    var dong = ds.map(function (nv) { return { nv: nv, xl: TL.xepLuongNV(db, nv) }; });
    App.xuatExcel('Xep_luong_nhan_vien', [App.sheetBang({
      ten: 'Xếp lương', tieuDe: 'DANH SÁCH XẾP LƯƠNG NHÂN VIÊN', phuDe: 'Ngày ' + new Date().toLocaleDateString('vi-VN'), chuKy: true,
      cot: [{ t: 'STT', stt: true, w: 5, kieu: 'giua' }, { t: 'Mã NV', w: 8, f: function (r) { return r.nv.ma; } }, { t: 'Họ và tên', w: 22, f: function (r) { return r.nv.hoTen; } },
        { t: 'Phòng / đội', w: 22, f: function (r) { return TL.tenPhongBan(db, r.nv.phongBan); } }, { t: 'Chức vụ', w: 16, f: function (r) { return r.nv.chucVu || ''; } },
        { t: 'Bảng lương', w: 24, f: function (r) { return r.xl ? r.xl.bang.ten : ''; } }, { t: 'Chức danh', w: 22, f: function (r) { return r.xl ? r.xl.ngach.ten : ''; } },
        { t: 'Bậc', w: 6, kieu: 'giua', f: function (r) { return r.xl ? r.xl.bac + '/' + r.xl.soBac : ''; } },
        { t: 'Hệ số', w: 8, f: function (r) { return r.xl && r.xl.heSo != null ? App.soHS(r.xl.heSo) : ''; } },
        { t: 'Mức theo bảng', w: 13, kieu: 'so', f: function (r) { return r.xl ? r.xl.tien : ''; } },
        { t: 'Hưởng từ', w: 11, kieu: 'giua', f: function (r) { return r.xl ? TL.hienNgay(r.xl.ngayHuong) : ''; } },
        { t: 'Nâng bậc tiếp', w: 11, kieu: 'giua', f: function (r) { return r.xl ? (r.xl.bacCuoi ? 'Bậc cuối' : TL.hienNgay(r.xl.ngayNang)) : ''; } },
        { t: 'Mức lương', w: 13, kieu: 'so', f: function (r) { return +r.nv.luongCB || 0; } }, { t: 'Lương đóng BH', w: 13, kieu: 'so', f: function (r) { return +r.nv.luongBH || ''; } }],
      dong: dong
    })]);
  }

  App.trang.nangbac = { ve: ve, khongKy: true };
})();
