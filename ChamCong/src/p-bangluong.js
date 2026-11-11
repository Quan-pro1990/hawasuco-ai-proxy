/* Trang Bảng lương (bảng thanh toán tiền lương) & Phiếu lương */
(function () {
  'use strict';
  var App = window.App, TL = window.TL, h = App.h;
  var st = { pb: '', ld: '', tim: '', nhomPB: true, pl: '' };

  var NHAP = {
    slSP: 'Số lượng sản phẩm chính trong kỳ – nhân đơn giá ra lương sản phẩm',
    thuong: 'Thưởng (chịu thuế TNCN)',
    congKhac: 'Khoản cộng khác (truy lĩnh, hỗ trợ…), chịu thuế; nhập số âm để truy thu',
    tamUng: 'Tạm ứng kỳ I',
    khauTru: 'Khấu trừ khác (bồi thường, …)'
  };

  /** Định nghĩa cột bảng lương – dùng chung cho màn hình, dòng tổng và Excel.
      f(r) đọc được cả 1 dòng nhân viên lẫn dòng tổng (TL.congTong). */
  function dsCot(bl) {
    var cd = App.db.caiDat, rows = bl.rows;
    var co = function (fn) { return rows.some(fn); };
    var c = [
      { t: 'STT', stt: true, kieu: 'giua', w: 5 },
      { t: 'Mã NV', k: 'ma', w: 8, chiManHinh: true },
      { t: 'Họ và tên', k: 'hoTen', w: 22, ten: true },
      { t: 'Chức danh', k: 'chucVu', w: 16 },
      { t: 'Mức lương/HĐ', k: 'luongCB', kieu: 'so', w: 12 }
    ];
    if (cd.luongSP || co(function (r) { return r.slSP || r.luongSP || r.cong.sp; })) {
      var dvt = {};
      rows.forEach(function (r) { var sp = (App.db.sanPham || []).filter(function (x) { return x.ma === r.maSP; })[0]; if (sp && sp.dvt) dvt[sp.dvt] = 1; });
      var dv = Object.keys(dvt);
      c.push({ t: dv.length === 1 ? 'Số ' + dv[0] : 'Số lượng', nhom: 'Lương sản phẩm', k: 'slSP', kieu: 'so', w: 8, nhap: 'slSP' });
      c.push({ t: 'Số tiền', nhom: 'Lương sản phẩm', k: 'luongSP', kieu: 'so', w: 11 });
    }
    c.push({ t: 'Số công', nhom: 'Lương thời gian', kieu: 'cong', w: 6, f: function (r) { return r.cong.congTG; } });
    c.push({ t: 'Số tiền', nhom: 'Lương thời gian', k: 'luongTG', kieu: 'so', w: 12 });
    if (co(function (r) { return r.cong.ngung; })) {
      var nn = 'Nghỉ, ngừng việc hưởng ' + (cd.tiLeNgungViec == null ? 100 : cd.tiLeNgungViec) + '% lương';
      c.push({ t: 'Số công', nhom: nn, kieu: 'cong', w: 6, f: function (r) { return r.cong.ngung; } });
      c.push({ t: 'Số tiền', nhom: nn, k: 'luongNgung', kieu: 'so', w: 11 });
    }
    if (co(function (r) { return r.tienOT; })) {
      c.push({ t: 'Số giờ', nhom: 'Làm thêm giờ', kieu: 'cong', w: 6, f: function (r) { return r.cong.otTong; } });
      c.push({ t: 'Số tiền', nhom: 'Làm thêm giờ', k: 'tienOT', kieu: 'so', w: 11 });
    }
    (bl.phuCap || []).forEach(function (pc) {
      if (!co(function (r) { return (r.phuCap || {})[pc.ma]; })) return;
      var tien = function (r) { return (r.phuCap || {})[pc.ma] || 0; };
      if (pc.cachTinh === 'theo_ngay') {
        var nh = 'Phụ cấp ' + pc.ten.toLowerCase();
        c.push({ t: 'Số công', nhom: nh, kieu: 'cong', w: 6, f: function (r) { return (r.phuCapNgay || {})[pc.ma] || 0; } });
        c.push({ t: 'Số tiền', nhom: nh, kieu: 'so', w: 11, f: tien, pc: pc.ma });
      } else c.push({ t: pc.ten, nhom: 'Phụ cấp', kieu: 'so', w: 11, f: tien, pc: pc.ma });
    });
    c.push(
      { t: 'Thưởng', k: 'thuong', kieu: 'so', w: 11, nhap: 'thuong' }
    );
    if (co(function (r) { return r.thuongQD; })) c.push({ t: 'Thưởng theo QĐ', k: 'thuongQD', kieu: 'so', w: 11 });
    c.push(
      { t: 'Cộng khác', k: 'congKhac', kieu: 'so', w: 10, nhap: 'congKhac' },
      { t: 'Tổng thu nhập', k: 'tongThuNhap', kieu: 'so', w: 13, dam: true },
      { t: 'Tạm ứng kỳ I', k: 'tamUng', kieu: 'so', w: 11, nhap: 'tamUng' }
    );
    var KT = 'Các khoản phải khấu trừ vào lương';
    c.push(
      { t: 'BHXH ' + App.so(cd.bh.nv.bhxh) + '%', nhom: KT, k: 'bhxh', kieu: 'so', w: 10 },
      { t: 'BHYT ' + App.so(cd.bh.nv.bhyt) + '%', nhom: KT, k: 'bhyt', kieu: 'so', w: 9 },
      { t: 'BHTN ' + App.so(cd.bh.nv.bhtn) + '%', nhom: KT, k: 'bhtn', kieu: 'so', w: 9 }
    );
    if (co(function (r) { return r.doanPhi; })) c.push({ t: 'Công đoàn ' + App.so(cd.bh.doanPhi) + '%', nhom: KT, k: 'doanPhi', kieu: 'so', w: 9 });
    c.push({ t: 'Thuế TNCN phải nộp', nhom: KT, k: 'thue', kieu: 'so', w: 10 });
    if (co(function (r) { return r.phatMuon; })) c.push({ t: 'Phạt đi muộn', nhom: KT, k: 'phatMuon', kieu: 'so', w: 9 });
    if (co(function (r) { return r.phatQD; })) c.push({ t: 'Phạt, bồi thường theo QĐ', nhom: KT, k: 'phatQD', kieu: 'so', w: 10 });
    c.push(
      { t: 'Khấu trừ khác', nhom: KT, k: 'khauTru', kieu: 'so', w: 10, nhap: 'khauTru' },
      { t: 'Cộng', nhom: KT, k: 'tongKhauTru', kieu: 'so', w: 11 },
      { t: 'Lãnh kỳ II', k: 'thucLinh', kieu: 'so', w: 13, dam: true }
    );
    return c;
  }
  function gt(c, r) { return c.f ? c.f(r) : r[c.k]; }
  function hien(c, v) {
    if (c.kieu === 'so') return v ? App.tien(v) : '';
    if (c.kieu === 'cong') return v ? App.so(v) : '';
    return h(v == null ? '' : v);
  }

  function locRows(rows) {
    return rows.filter(function (r) {
      if (st.pb && r.phongBan !== st.pb) return false;
      if (st.khoi && r.khoi !== st.khoi) return false;
      if (st.ld && (r.loaiLD || '') !== (st.ld === '-' ? '' : st.ld)) return false;
      if (st.tim && !App.timKhop(r.ma + ' ' + r.hoTen, st.tim)) return false;
      return true;
    });
  }
  function nhomTheoPB(rows) {
    var thuTu = [], g = {};
    rows.forEach(function (r) { var k = r.phongBan || ''; if (!g[k]) { g[k] = []; thuTu.push(k); } g[k].push(r); });
    return thuTu.map(function (k) { return { ma: k, ten: (g[k][0].tenPhongBan || '(Chưa phân phòng)'), rows: g[k] }; });
  }

  /* ================= Bảng lương ================= */
  function veBL(noi) {
    var db = App.db, y = App.ky.y, m = App.ky.m;
    var bl = TL.tinhBangLuong(db, y, m);
    var khoa = bl.khoa, ngay = TL.ngayKy(db, y, m);
    noi.innerHTML =
      '<div class="the khong-in" style="padding:12px 14px"><div class="hang">' +
      (TL.dsKhoi(db).length > 1 ? '<select id="bl-khoi" title="Bảng lương theo khối (văn phòng công ty, từng đội)"><option value="">Tất cả bảng lương</option>' +
        TL.dsKhoi(db).map(function (k) { return '<option' + (st.khoi === k ? ' selected' : '') + '>' + h(k) + '</option>'; }).join('') + '</select>' : '') +
      '<select id="bl-pb">' + App.optDonVi(st.pb, { tatCa: 'Tất cả phòng / đội', ngung: true }) + '</select>' +
      App.chonLoaiLD('bl-ld', st.ld) +
      '<input type="search" id="bl-tim" placeholder="Tìm nhân viên…" value="' + h(st.tim) + '" style="width:170px">' +
      '<label class="chk"><input type="checkbox" id="bl-nhom"' + (st.nhomPB ? ' checked' : '') + '> Nhóm theo phòng / đội</label>' +
      '<span class="gian"></span>' +
      '<button class="nut" id="bl-xuat">' + App.icon('tai') + 'Xuất Excel</button>' +
      '<button class="nut" id="bl-ck" title="Danh sách tạm ứng kỳ I, đề nghị chi lương kỳ I / kỳ II / làm thêm giờ gửi ngân hàng">' + App.icon('ngan') + 'Chi lương kỳ I, kỳ II…</button>' +
      '<button class="nut" id="bl-in">' + App.icon('in') + 'In</button>' +
      (khoa ? '<button class="nut" id="bl-mo">' + App.icon('mo') + 'Mở khoá</button>' : '<button class="nut xanh" id="bl-chot">' + App.icon('khoa') + 'Chốt lương tháng</button>') +
      '</div>' +
      (khoa ? '<div class="canh-bao" style="margin-top:10px">Bảng lương đã <b>chốt</b> lúc ' + new Date(bl.ngayChot).toLocaleString('vi-VN') + '. Số liệu được giữ cố định, không đổi khi sửa cài đặt hay hồ sơ nhân viên. Muốn sửa, bấm <b>Mở khoá</b>.</div>'
        : '<div class="mo nho" style="margin-top:8px">Kỳ công ' + TL.hienNgay(ngay[0].iso) + ' – ' + TL.hienNgay(ngay[ngay.length - 1].iso) + '. Ô nền vàng nhập trực tiếp: sản lượng, thưởng, khoản cộng khác, khấu trừ khác. <b>Tạm ứng kỳ I</b> tự điền theo chức vụ (chữ nghiêng, sửa ở trang Mức lương theo kỳ); gõ số khác để nhập tay, xoá trống để trở về tự động. Bấm tên nhân viên để xem chi tiết cách tính.</div>') +
      '</div>' +
      App.dauIn(st.khoi ? TL.thongTinKhoi(db, st.khoi).tieuDe : (db.congTy.tieuDeBangLuong || 'BẢNG THANH TOÁN TIỀN LƯƠNG').toUpperCase(), 'Tháng ' + m + ' năm ' + y) +
      '<div class="cuon cao"><table class="bang" id="bl-bang"></table></div>' +
      App.kyIn();
    veBangBL(bl);
    App.$('#bl-pb').onchange = function () { st.pb = this.value; veBangBL(TL.tinhBangLuong(App.db, y, m)); };
    var sk = App.$('#bl-khoi'); if (sk) sk.onchange = function () { st.khoi = this.value; App.veLai(); };
    App.$('#bl-tim').oninput = function () { st.tim = this.value; veBangBL(TL.tinhBangLuong(App.db, y, m)); };
    App.$('#bl-ld').onchange = function () { st.ld = this.value; veBangBL(TL.tinhBangLuong(App.db, y, m)); };
    App.$('#bl-nhom').onchange = function () { st.nhomPB = this.checked; veBangBL(TL.tinhBangLuong(App.db, y, m)); };
    App.$('#bl-xuat').onclick = function () { xuatBL(TL.tinhBangLuong(App.db, y, m)); };
    App.$('#bl-ck').onclick = function () { hopChiLuong(TL.tinhBangLuong(App.db, y, m)); };
    App.$('#bl-in').onclick = function () { App.inTrang(); };
    var c = App.$('#bl-chot'); if (c) c.onclick = App.chotLuong;
    var mo = App.$('#bl-mo'); if (mo) mo.onclick = App.moKhoa;
  }

  function veBangBL(bl) {
    var cot = dsCot(bl), rows = locRows(bl.rows), khoa = bl.khoa;
    var coNhom = cot.some(function (c) { return c.nhom; });
    var s = '<thead><tr>', s2 = '';
    for (var i = 0; i < cot.length; i++) {
      var c = cot[i];
      if (c.nhom) {
        var j = i; while (j + 1 < cot.length && cot[j + 1].nhom === c.nhom) j++;
        s += '<th colspan="' + (j - i + 1) + '">' + h(c.nhom) + '</th>';
        for (var k = i; k <= j; k++) s2 += '<th class="so">' + h(cot[k].t) + '</th>';
        i = j;
      } else s += '<th' + (coNhom ? ' rowspan="2"' : '') + ' class="' + (c.kieu === 'so' ? 'so' : '') + (c.ten ? ' dinh' : '') + '"' + (c.ten ? ' style="min-width:170px"' : '') + '>' + h(c.t) + '</th>';
    }
    s += '<th rowspan="2" style="min-width:150px">Ghi chú</th></tr>' + (coNhom ? '<tr>' + s2 + '</tr>' : '') + '</thead><tbody>';
    var stt = 0;
    function dong(r) {
      stt++;
      var x = '<tr data-id="' + r.nvId + '">';
      cot.forEach(function (c, ci) {
        if (c.stt) { x += '<td class="giua">' + stt + '</td>'; return; }
        if (c.nhap === 'slSP' && !khoa) {
          var nhieu = (App.db.sanPham || []).length > 1, khac = (r.spChiTiet || []).some(function (x) { return x.ma !== r.maSP; });
          x += '<td data-c="' + ci + '"><div style="display:flex;gap:3px;align-items:center"><input class="o-nhap" data-f="slSP" data-ma="' + h(r.maSP) + '" value="' + (r.slSP ? App.tien(r.slSP) : '') + '" title="' + h(NHAP.slSP + (r.donGiaSP ? ' (' + App.tien(r.donGiaSP) + ' đ)' : '')) + '" inputmode="numeric" style="min-width:64px">' +
            (nhieu ? '<button class="nut nho" data-spct="' + r.nvId + '" title="Nhập nhiều loại sản phẩm" style="padding:1px 6px;min-height:24px' + (khac ? ';background:var(--nhap);font-weight:700' : '') + '">' + (khac ? '+' + ((r.spChiTiet || []).length - (r.slSP ? 1 : 0)) : '…') + '</button>' : '') + '</div></td>';
          return;
        }
        if (c.nhap === 'tamUng' && !khoa) {
          x += '<td><input class="o-nhap' + (r.tamUngTuDong ? ' tu-dong' : '') + '" data-f="tamUng" value="' + (r.tamUng || !r.tamUngTuDong ? App.tien(r.tamUng) : '') + '" inputmode="numeric" title="' +
            h(r.tamUngTuDong ? 'Tự động theo chức vụ (' + (r.chucVu || 'chức vụ khác') + '). Gõ số khác để nhập tay cho kỳ này.' : 'Nhập tay cho kỳ này (mức theo chức vụ: ' + App.tien(r.tamUngMacDinh) + '). Xoá trống để trở về tự động.') + '"></td>';
          return;
        }
        if (c.nhap && !khoa) { x += '<td><input class="o-nhap" data-f="' + c.nhap + '" value="' + (r[c.nhap] ? App.tien(r[c.nhap]) : '') + '" title="' + h(NHAP[c.nhap]) + '" inputmode="numeric"></td>'; return; }
        var v = gt(c, r);
        x += '<td data-c="' + ci + '" class="' + (c.kieu === 'so' ? 'so' : c.kieu === 'cong' ? 'giua' : '') + (c.ten ? ' ten dinh' : '') + (c.kieu === 'so' && v < 0 ? ' am' : '') + '"' + (c.dam ? ' style="font-weight:700"' : '') + '>' +
          (c.ten ? '<span class="lk" data-ct="' + r.nvId + '">' + h(v) + '</span>' + (r.thuViec ? ' <span class="the-tt cam" title="' + h(App.moTaThuViec(r)) + '">TV ' + App.so(r.thuViec.tiLe) + '%</span>' : '') + (r.canhBao && r.canhBao.length ? ' <span title="' + h(r.canhBao.join('\n')) + '" style="color:var(--cam);cursor:help">⚠</span>' : '') : hien(c, v)) + '</td>';
      });
      x += '<td>' + (khoa ? h(r.ghiChu) : '<input class="o-nhap chu" data-f="ghiChu" value="' + h(r.ghiChu) + '">') + '</td></tr>';
      return x;
    }
    function dongTong(t, nhan, cls) {
      var x = '<tr class="' + cls + '">';
      cot.forEach(function (c) {
        if (c.stt) { x += '<td></td>'; return; }
        if (c.ten) { x += '<td class="dinh">' + h(nhan) + '</td>'; return; }
        if (!c.kieu || c.kieu === 'chu' || c.kieu === 'giua') { x += '<td></td>'; return; }
        x += '<td class="' + (c.kieu === 'so' ? 'so' : 'giua') + '">' + hien(c, gt(c, t)) + '</td>';
      });
      return x + '<td></td></tr>';
    }
    if (!rows.length) s += '<tr><td colspan="' + (cot.length + 1) + '" class="trong">Không có nhân viên trong kỳ này.</td></tr>';
    else if (st.nhomPB) {
      nhomTheoPB(rows).forEach(function (g) {
        s += '<tr class="nhom"><td colspan="' + (cot.length + 1) + '">' + h(g.ten) + ' (' + g.rows.length + ' người)</td></tr>';
        g.rows.forEach(function (r) { s += dong(r); });
        s += dongTong(TL.congTong(g.rows, bl.phuCap), 'Cộng ' + g.ten, 'nhom-tong');
      });
    } else rows.forEach(function (r) { s += dong(r); });
    s += '</tbody><tfoot>' + (rows.length ? dongTong(TL.congTong(rows, bl.phuCap), 'TỔNG CỘNG (' + rows.length + ' người)', 'tong') : '') + '</tfoot>';
    var bang = App.$('#bl-bang');
    bang.innerHTML = s;
    var tr1 = App.$('thead tr', bang); if (tr1) bang.style.setProperty('--h1', tr1.offsetHeight + 'px');
    App.$$('input.o-nhap:not(.chu)', bang).forEach(App.ganOTien);
    bang.onchange = function (e) {
      var i = e.target.closest('.o-nhap'); if (!i) return;
      var id = i.closest('tr').dataset.id, f = i.dataset.f;
      var T = TL.thang(App.db, App.ky.y, App.ky.m, true);
      var dc = T.dc[id] = T.dc[id] || {};
      var v = f === 'ghiChu' ? i.value.trim() : App.docSo(i.value);
      if (f === 'slSP') {
        var ma = i.dataset.ma; delete dc.slSP;
        dc.sp = dc.sp || {};
        if (!v) delete dc.sp[ma]; else dc.sp[ma] = v;
        if (!Object.keys(dc.sp).length) delete dc.sp;
      } else if (f === 'tamUng') {
        // trống = tự động theo chức vụ; số (kể cả 0) = nhập tay cho kỳ này
        if (i.value.trim() === '') delete dc.tamUng; else dc.tamUng = v;
        i.classList.toggle('tu-dong', i.value.trim() === '');
      } else if (!v) delete dc[f]; else dc[f] = v;
      if (!Object.keys(dc).length) delete T.dc[id];
      App.luu();
      capNhatSo();
    };
    bang.onclick = function (e) {
      var a = e.target.closest('[data-ct]'); if (a) App.chiTietLuong(a.dataset.ct);
      var b = e.target.closest('[data-spct]'); if (b) nhapNhieuSP(b.dataset.spct);
    };
  }

  /** Cập nhật các ô tính toán mà không vẽ lại ô nhập (giữ con trỏ khi Tab sang ô khác) */
  function capNhatSo() {
    var bl = TL.tinhBangLuong(App.db, App.ky.y, App.ky.m), cot = dsCot(bl);
    var bang = App.$('#bl-bang');
    // cột hiển thị thay đổi (vd vừa nhập sản lượng đầu tiên) thì vẽ lại cả bảng
    var soCot = App.$$('thead tr:last-child th', bang).length;
    var map = {}; bl.rows.forEach(function (r) { map[r.nvId] = r; });
    App.$$('tr[data-id]', bang).forEach(function (tr) {
      var r = map[tr.dataset.id]; if (!r) return;
      var iu = App.$('input[data-f="tamUng"]', tr);
      if (iu && r.tamUngTuDong && document.activeElement !== iu) iu.value = r.tamUng ? App.tien(r.tamUng) : '';
      App.$$('td[data-c]', tr).forEach(function (td) {
        var c = cot[+td.dataset.c]; if (!c || c.ten || c.nhap) return;
        var v = gt(c, r); td.innerHTML = hien(c, v); td.classList.toggle('am', c.kieu === 'so' && v < 0);
      });
    });
    var rows = locRows(bl.rows);
    var nhom = st.nhomPB ? nhomTheoPB(rows) : [];
    App.$$('tr.nhom-tong, tr.tong', bang).forEach(function (tr) {
      var t;
      if (tr.classList.contains('tong')) t = TL.congTong(rows, bl.phuCap);
      else { var g = nhom.shift(); if (!g) return; t = TL.congTong(g.rows, bl.phuCap); }
      var tds = tr.children;
      cot.forEach(function (c, ci) {
        if (c.stt || c.ten || !c.kieu || c.kieu === 'chu' || c.kieu === 'giua') return;
        if (tds[ci]) tds[ci].innerHTML = hien(c, gt(c, t));
      });
    });
    void soCot;
  }

  function nhapNhieuSP(nvId) {
    var y = App.ky.y, m = App.ky.m, db = App.db;
    var r = TL.tinhBangLuong(db, y, m).rows.filter(function (x) { return x.nvId === nvId; })[0]; if (!r) return;
    var T = TL.thang(db, y, m, true), dc = T.dc[nvId] || {}, sl = Object.assign({}, dc.sp || {});
    if (+dc.slSP && !sl[r.maSP]) sl[r.maSP] = +dc.slSP;
    var nv = db.nhanVien.filter(function (x) { return x.id === nvId; })[0] || {};
    App.hop({
      tieuDe: 'Lương sản phẩm – ' + r.hoTen + ' – tháng ' + m + '/' + y, co: 'hep',
      than: '<table class="bang"><thead><tr><th>Sản phẩm</th><th class="so">Đơn giá</th><th class="so">Số lượng</th></tr></thead><tbody>' +
        db.sanPham.map(function (p) {
          var dg = p.ma === r.maSP && +nv.donGiaSP > 0 ? +nv.donGiaSP : p.donGia;
          return '<tr><td>' + h(p.ten) + (p.ma === r.maSP ? ' <span class="the-tt lam">chính</span>' : '') + '</td><td class="so">' + App.tien(dg) + ' đ/' + h(p.dvt || 'đv') + '</td>' +
            '<td><input class="o-nhap" data-sp="' + h(p.ma) + '" value="' + (sl[p.ma] ? App.tien(sl[p.ma]) : '') + '" inputmode="numeric"></td></tr>';
        }).join('') + '</tbody></table>',
      moRa: function (el) { App.$$('input', el).forEach(App.ganOTien); },
      nut: [{ ten: 'Huỷ' }, {
        ten: 'Lưu', loai: 'chinh', bam: function (el) {
          var moi = {};
          App.$$('input[data-sp]', el).forEach(function (i) { var v = App.docSo(i.value); if (v) moi[i.dataset.sp] = v; });
          var d = T.dc[nvId] = T.dc[nvId] || {};
          delete d.slSP;
          if (Object.keys(moi).length) d.sp = moi; else delete d.sp;
          if (!Object.keys(d).length) delete T.dc[nvId];
          App.luu(); App.veLai();
        }
      }]
    });
  }

  App.chotLuong = function () {
    var y = App.ky.y, m = App.ky.m;
    App.xacNhan('Chốt bảng lương <b>tháng ' + m + '/' + y + '</b>?<br><br>Sau khi chốt, bảng chấm công và bảng lương kỳ này bị khoá; số liệu được lưu cố định để không bị thay đổi khi sau này sửa mức lương, tỷ lệ bảo hiểm, biểu thuế… Có thể mở khoá lại khi cần.', { nut: 'Chốt lương' }).then(function (ok) {
      if (!ok) return;
      TL.chotThang(App.db, y, m); App.luu(); App.bao('Đã chốt lương tháng ' + m + '/' + y, 'tot'); App.veLai();
    });
  };
  App.moKhoa = function () {
    var y = App.ky.y, m = App.ky.m;
    App.xacNhan('Mở khoá tháng ' + m + '/' + y + '? Bảng lương sẽ được tính lại theo dữ liệu và cài đặt hiện tại.', { nut: 'Mở khoá' }).then(function (ok) {
      if (!ok) return;
      TL.moKhoaThang(App.db, y, m); App.luu(); App.bao('Đã mở khoá tháng ' + m + '/' + y); App.veLai();
    });
  };

  /* ---------- Chi tiết cách tính ---------- */
  App.chiTietLuong = function (nvId) {
    var db = App.db, y = App.ky.y, m = App.ky.m, cd = db.caiDat;
    var bl = TL.tinhBangLuong(db, y, m);
    var r = bl.rows.filter(function (x) { return x.nvId === nvId; })[0];
    if (!r) return;
    var c = r.cong, t = App.tien;
    var L = [];
    function m_(a) { L.push('<tr class="m"><td colspan="3">' + a + '</td></tr>'); }
    function d_(a, b, v) { L.push('<tr><td>' + a + '</td><td>' + (b || '') + '</td><td>' + v + '</td></tr>'); }
    m_('1. Ngày công');
    var lld = TL.loaiLDNV(db, { loaiLD: r.loaiLD });
    d_('Công chuẩn của kỳ', lld ? h(lld.ten) : 'Theo cài đặt chung', App.so(r.congChuan));
    if (c.sp) d_('Công hưởng lương sản phẩm (SP)', 'Chỉ hưởng lương sản phẩm, không hưởng lương thời gian, không nhân hệ số ngày lễ', App.so(c.sp));
    d_('Ngày đi làm hưởng lương thời gian', '', App.so(c.lamTG - c.congThemLeTG));
    d_('Nghỉ có hưởng lương', 'Phép ' + App.so(c.phep) + ', lễ ' + App.so(c.le) + ', khác ' + App.so(c.huongKhac), App.so(c.huong - c.ngung));
    if (c.ngung) d_('Nghỉ, ngừng việc hưởng ' + (cd.tiLeNgungViec == null ? 100 : cd.tiLeNgungViec) + '% lương', '', App.so(c.ngung));
    if (c.bhxh || c.khong || c.kp) d_('Nghỉ không hưởng lương', 'Ốm/TS ' + App.so(c.bhxh) + ', không lương ' + App.so(c.khong) + ', không phép ' + App.so(c.kp), '');
    if (c.congThemLeTG) d_('Đi làm ngày lễ, Tết', (c.ngayLamLe ? App.so(c.ngayLamLe) + ' ngày lễ × ' + App.so(cd.heSoCongLe) : '') + (c.ngayLamLe && c.ngayLamTet ? ', ' : '') + (c.ngayLamTet ? App.so(c.ngayLamTet) + ' ngày Tết × ' + App.so(cd.heSoCongTet) : '') + ' công', '+' + App.so(c.congThemLeTG) + ' công');
    d_('<b>Số công lương thời gian</b>', '', '<b>' + App.so(c.congTG) + '</b>');
    d_('Ngày tính cơm', 'Ngày có đi làm (gồm SP, đi làm ngày lễ); nghỉ lễ, nghỉ phép không tính', App.so(c.ngayCom));
    m_('2. Thu nhập');
    (r.spChiTiet || []).forEach(function (x) { d_('Lương sản phẩm: ' + h(x.ten), App.tien(x.sl) + ' ' + h(x.dvt) + ' × ' + t(x.donGia) + ' đ', t(x.tien)); });
    var ht = r.hinhThuc, tv = r.thuViec;
    if (tv) d_('Thử việc', App.moTaThuViec(r), '');
    // kỳ có cả ngày thử việc và ngày chính thức: (công thử việc × % thử việc + công chính thức)
    var phanTV = tv && !tv.toanKy ? '(' + App.so(tv.congTV) + ' × ' + App.so(tv.tiLe * tv.tiLeCT / 100) + '% + ' + App.so(tv.congCT) + (tv.tiLeCT !== 100 ? ' × ' + App.so(tv.tiLeCT) + '%' : '') + ')' : '';
    var cachLuong = ht === 'thang' ? t(r.luongCB) + (phanTV ? ' ÷ ' + App.so(r.congChuan) + ' × ' + phanTV + (r.congTinh != null && r.congTinh < c.congTG ? ' × ' + App.so(r.congTinh) + '/' + App.so(c.congTG) : '')
        : (r.tiLeHuong !== 100 ? ' × ' + App.so(r.tiLeHuong) + '%' : '') + ' ÷ ' + App.so(r.congChuan) + ' × ' + App.so(r.congTinh != null ? r.congTinh : c.congTG))
      : ht === 'ngay' ? t(r.luongCB) + '/ngày' + (phanTV ? ' × ' + phanTV : (r.tiLeHuong !== 100 ? ' × ' + App.so(r.tiLeHuong) + '%' : '') + ' × ' + App.so(c.congTG))
        : ht === 'gio' ? t(r.luongCB) + '/giờ × ' + cd.gioLamNgay + ' giờ × ' + App.so(c.congTG) + ' công'
          : 'Lương khoán';
    d_('Lương thời gian', cachLuong + (r.congTinh != null && r.congTinh < c.congTG ? ' (tính tối đa ' + App.so(r.congTinh) + ' công)' : ''), t(r.luongTG));
    if (r.luongNgung) d_('Lương nghỉ, ngừng việc', 'Lương ngày ' + t(r.luongNgay) + ' × ' + App.so(c.ngung) + ' × ' + (cd.tiLeNgungViec == null ? 100 : cd.tiLeNgungViec) + '%', t(r.luongNgung));
    if (c.otTong) {
      var hs = cd.heSoOT, parts = [];
      if (c.otThuong) parts.push(App.so(c.otThuong) + 'h × ' + hs.thuong + '%');
      if (c.otNghi) parts.push(App.so(c.otNghi) + 'h × ' + hs.nghi + '%');
      if (c.otLe) parts.push(App.so(c.otLe) + 'h × ' + hs.le + '%');
      d_('Tiền làm thêm giờ', 'Lương giờ ' + t(r.luongGio) + ' × (' + parts.join(' + ') + ')', t(r.tienOT));
    }
    (bl.phuCap || []).forEach(function (pc) {
      var v = r.phuCap[pc.ma]; if (!v) return;
      var gc = pc.cachTinh === 'theo_ngay' ? App.so((r.phuCapNgay || {})[pc.ma]) + ' ngày × ' + t(v / ((r.phuCapNgay || {})[pc.ma] || 1)) : App.CACH_PC[pc.cachTinh];
      d_('Phụ cấp ' + h(pc.ten.toLowerCase()), gc + (pc.chiuThue ? '' : ' · không chịu thuế'), t(v));
    });
    if (r.thuong) d_('Thưởng', '', t(r.thuong));
    if (r.thuongQD) d_('Thưởng theo quyết định khen thưởng', '', t(r.thuongQD));
    if (r.congKhac) d_('Khoản cộng khác', '', t(r.congKhac));
    d_('<b>Tổng thu nhập</b>', '', '<b>' + t(r.tongThuNhap) + '</b>');
    m_('3. Bảo hiểm, công đoàn (người lao động đóng)');
    if (!r.dongBH) d_('Không đóng bảo hiểm kỳ này', !r.luongBH ? 'Không tham gia / chưa có lương đóng BH'
      : r.thuViec && (cd.thuViec || {}).khongDongBH !== false ? (r.thuViec.toanKy ? 'Đang thử việc (hợp đồng thử việc)' : 'Thời gian thử việc và nghỉ không lương từ ' + cd.nguongNghiKhongDongBH + ' ngày trong kỳ')
      : 'Nghỉ không lương từ ' + cd.nguongNghiKhongDongBH + ' ngày', '0');
    else {
      d_('Lương đóng bảo hiểm', 'Trần BHXH, BHYT: ' + t(20 * cd.luongCoSo) + ' · trần BHTN: ' + t(20 * cd.luongToiThieuVung), t(r.luongBH));
      d_('BHXH', App.so(cd.bh.nv.bhxh) + '%', t(r.bhxh));
      d_('BHYT', App.so(cd.bh.nv.bhyt) + '%', t(r.bhyt));
      d_('BHTN', App.so(cd.bh.nv.bhtn) + '%', t(r.bhtn));
    }
    if (r.doanPhi) d_('Đoàn phí công đoàn', App.so(cd.bh.doanPhi) + '% (tối đa 10% lương cơ sở)', t(r.doanPhi));
    m_('4. Thuế thu nhập cá nhân');
    if (r.cachTinhThue === 'khong') d_('Không tính thuế', '', '0');
    else {
      d_('Thu nhập chịu thuế', 'Tổng thu nhập − phụ cấp không chịu thuế (' + t(r.pcKhongThue) + ') − phần làm thêm được miễn (' + t(r.otMienThue) + ')', t(r.tnct));
      if (r.cachTinhThue === 'luy_tien') {
        d_('Giảm trừ bản thân', '', t(r.giamTruBT));
        if (r.soNPT) d_('Giảm trừ người phụ thuộc', r.soNPT + ' × ' + t(cd.giamTruNPT), t(r.giamTruNPT));
        d_('Bảo hiểm bắt buộc', '', t(r.tongBH));
        d_('Thu nhập tính thuế', '', t(r.tntt));
        var duoi = 0;
        cd.bieuThue.forEach(function (b, i) {
          var tren = b.den == null || b.den === '' ? Infinity : +b.den;
          if (r.tntt > duoi) d_('Bậc ' + (i + 1) + ' (' + b.ts + '%)', t(duoi) + ' – ' + (tren === Infinity ? '…' : t(tren)), t(Math.round((Math.min(r.tntt, tren) - duoi) * b.ts / 100)));
          duoi = tren;
        });
      } else d_('Khấu trừ ' + cd.thueKhauTru + '%', 'Áp dụng khi thu nhập từ ' + t(cd.nguongKhauTru), '');
      d_('<b>Thuế TNCN phải nộp</b>', '', '<b>' + t(r.thue) + '</b>');
    }
    m_('5. Lãnh kỳ II');
    if (r.phatMuon) d_('Phạt đi muộn / về sớm', c.muonLan + ' lần, ' + c.muonPhut + ' phút', '−' + t(r.phatMuon));
    if (r.khauTru) d_('Khấu trừ khác', h(r.ghiChu), '−' + t(r.khauTru));
    if (r.phatQD) d_('Phạt, bồi thường theo quyết định kỷ luật', '', '−' + t(r.phatQD));
    d_('Cộng các khoản khấu trừ', 'BH + công đoàn + thuế + khấu trừ khác', '−' + t(r.tongKhauTru));
    if (r.tamUng) d_('Tạm ứng kỳ I', r.tamUngTuDong ? 'Theo chức vụ' : 'Nhập tay kỳ này', '−' + t(r.tamUng));
    if (r.otRieng) d_('Tiền làm thêm giờ (chi bảng riêng)', 'Bảng thanh toán tiền làm thêm giờ', '−' + t(r.otRieng));
    d_('<b>Lãnh kỳ II</b>', 'Tổng thu nhập − tạm ứng' + (r.otRieng ? ' − làm thêm giờ chi riêng' : '') + ' − các khoản khấu trừ', '<b style="color:var(--chinh-dam);font-size:15px">' + t(r.thucLinh) + '</b>');
    d_('', '<i>' + TL.docSo(r.thucLinh) + '</i>', '');
    m_('6. Doanh nghiệp đóng thêm');
    d_('BHXH / BHYT / BHTN / KPCĐ', App.so(cd.bh.dn.bhxh) + '% / ' + App.so(cd.bh.dn.bhyt) + '% / ' + App.so(cd.bh.dn.bhtn) + '% / ' + App.so(cd.bh.dn.kpcd) + '%', t(r.dn.tong));
    d_('<b>Tổng chi phí lương của doanh nghiệp</b>', '', '<b>' + t(r.chiPhiDN) + '</b>');
    App.hop({
      tieuDe: r.hoTen + ' – lương ' + App.tenKy(y, m).toLowerCase(),
      than: (r.canhBao && r.canhBao.length ? '<div class="canh-bao" style="margin-bottom:10px">' + r.canhBao.map(h).join('<br>') + '</div>' : '') + '<table class="ct-tinh">' + L.join('') + '</table>',
      nut: [{ ten: 'Xem phiếu lương', bam: function () { st.pl = r.nvId; location.hash = '#phieuluong'; } }, { ten: 'Đóng', loai: 'chinh' }]
    });
  };

  /* ---------- Xuất Excel ---------- */
  function xuatBL(bl) {
    var y = App.ky.y, m = App.ky.m, db = App.db;
    var cot = dsCot(bl).filter(function (c) { return !c.chiManHinh; }).map(function (c) {
      var x = Object.assign({}, c);
      if (!c.k && !c.f && !c.stt) x.f = function () { return ''; };
      return x;
    });
    cot.push({ t: 'Ký nhận', w: 11, f: function () { return ''; }, khongTong: true });
    var tatCa = locRows(bl.rows), khois = [];
    tatCa.forEach(function (r) { if (khois.indexOf(r.khoi) < 0) khois.push(r.khoi); });
    var nhieu = khois.length > 1 && !st.khoi;
    var shs = khois.map(function (k) {
      var rows = tatCa.filter(function (r) { return r.khoi === k; }), dong = [];
      if (st.nhomPB) {
        nhomTheoPB(rows).forEach(function (g) {
          dong.push({ _kieu: 'nhom', _nhan: g.ten });
          g.rows.forEach(function (r) { dong.push(r); });
          dong.push(Object.assign(TL.congTong(g.rows, bl.phuCap), { _kieu: 'tong', _nhan: 'Cộng ' + g.ten }));
        });
      } else dong = rows;
      var tong = Object.assign(TL.congTong(rows, bl.phuCap), { _kieu: 'tong', _nhan: 'TỔNG CỘNG' });
      var tieuDe = TL.dsKhoi(db).length > 1 ? TL.thongTinKhoi(db, k).tieuDe : (db.congTy.tieuDeBangLuong || 'BẢNG THANH TOÁN TIỀN LƯƠNG').toUpperCase();
      return App.sheetBang({
        ten: nhieu ? k.slice(0, 30) : 'Bảng lương T' + m, tieuDe: tieuDe, phuDe: 'Tháng ' + m + ' năm ' + y, quocHieu: true,
        cot: cot, dong: dong, tong: tong, cotNhanTong: 1, coCot: 2,
        dongCuoi: 'Tổng số tiền lãnh kỳ II (viết bằng chữ): ' + TL.docSo(tong.thucLinh)
      });
    });
    App.xuatExcel('Bang_luong_T' + TL.pad(m) + '_' + y + (st.khoi ? '_' + App.tenFile(st.khoi) : ''), shs.concat([sheetBH(bl)]));
  }

  function sheetBH(bl) {
    var cd = App.db.caiDat, y = App.ky.y, m = App.ky.m;
    var rows = locRows(bl.rows).filter(function (r) { return r.dongBH; });
    var cot = [
      { t: 'STT', stt: true, kieu: 'giua', w: 5 }, { t: 'Mã NV', k: 'ma', w: 8 }, { t: 'Họ và tên', k: 'hoTen', w: 22 },
      { t: 'Lương đóng BH', k: 'luongBH', kieu: 'so', w: 13 },
      { t: 'BHXH ' + App.so(cd.bh.nv.bhxh) + '%', nhom: 'Người lao động đóng', k: 'bhxh', kieu: 'so', w: 11 },
      { t: 'BHYT ' + App.so(cd.bh.nv.bhyt) + '%', nhom: 'Người lao động đóng', k: 'bhyt', kieu: 'so', w: 10 },
      { t: 'BHTN ' + App.so(cd.bh.nv.bhtn) + '%', nhom: 'Người lao động đóng', k: 'bhtn', kieu: 'so', w: 10 },
      { t: 'Cộng', nhom: 'Người lao động đóng', k: 'tongBH', kieu: 'so', w: 11 },
      { t: 'BHXH ' + App.so(cd.bh.dn.bhxh) + '%', nhom: 'Doanh nghiệp đóng', kieu: 'so', w: 11, f: function (r) { return r.dn.bhxh; } },
      { t: 'BHYT ' + App.so(cd.bh.dn.bhyt) + '%', nhom: 'Doanh nghiệp đóng', kieu: 'so', w: 10, f: function (r) { return r.dn.bhyt; } },
      { t: 'BHTN ' + App.so(cd.bh.dn.bhtn) + '%', nhom: 'Doanh nghiệp đóng', kieu: 'so', w: 10, f: function (r) { return r.dn.bhtn; } },
      { t: 'KPCĐ ' + App.so(cd.bh.dn.kpcd) + '%', nhom: 'Doanh nghiệp đóng', kieu: 'so', w: 10, f: function (r) { return r.dn.kpcd; } },
      { t: 'Cộng', nhom: 'Doanh nghiệp đóng', kieu: 'so', w: 11, f: function (r) { return r.dn.tong; } },
      { t: 'Tổng cộng', kieu: 'so', w: 13, f: function (r) { return r.tongBH + r.dn.tong; } }
    ];
    return App.sheetBang({ ten: 'Bảo hiểm T' + m, tieuDe: 'BẢNG TRÍCH NỘP BẢO HIỂM BẮT BUỘC VÀ KINH PHÍ CÔNG ĐOÀN', phuDe: 'Tháng ' + m + ' năm ' + y, cot: cot, dong: rows, tong: Object.assign(TL.congTong(rows), { _nhan: 'TỔNG CỘNG' }), cotNhanTong: 2 });
  }
  App.sheetBH = sheetBH;

  /* ================= Chi lương 2 kỳ: danh sách tạm ứng, đề nghị chi gửi ngân hàng, bảng làm thêm giờ ================= */
  var MAU_CHI = {
    ky1_ds: 'Danh sách tạm ứng lương kỳ I (ký nhận)',
    ky1_nh: 'Đề nghị chi lương kỳ I – gửi ngân hàng',
    ky2_nh: 'Đề nghị chi lương kỳ II – gửi ngân hàng',
    ot_bang: 'Bảng thanh toán tiền làm thêm giờ',
    ot_nh: 'Đề nghị chi tiền làm thêm giờ – gửi ngân hàng'
  };
  function hopChiLuong(bl) {
    var db = App.db, y = App.ky.y, m = App.ky.m;
    var rows = bl.rows.filter(function (r) { return (!st.khoi || r.khoi === st.khoi) && (!st.pb || r.phongBan === st.pb); });
    var khois = []; rows.forEach(function (r) { if (khois.indexOf(r.khoi) < 0) khois.push(r.khoi); });
    var sum = function (ds, f) { return ds.reduce(function (s, r) { return s + (+r[f] || 0); }, 0); };
    var bang = '<div class="cuon"><table class="bang"><thead><tr><th>Bảng lương</th><th>Người</th><th class="so">Kỳ I (tạm ứng)</th><th class="so">Kỳ II</th><th class="so">Làm thêm giờ</th><th>Ngân hàng chi / số TK công ty</th><th>Thiếu số TK</th></tr></thead><tbody>' +
      khois.map(function (k) {
        var ds = rows.filter(function (r) { return r.khoi === k; }), tt = TL.thongTinKhoi(db, k);
        var thieu = ds.filter(function (r) { return !r.soTK && (r.tamUng > 0 || r.thucLinh > 0); });
        return '<tr><td class="ten">' + h(k) + '</td><td class="giua">' + ds.length + '</td><td class="so">' + App.tien(sum(ds, 'tamUng')) + '</td><td class="so">' + App.tien(sum(ds, 'thucLinh')) + '</td>' +
          '<td class="so">' + App.tien(sum(ds, db.caiDat.otTraRieng ? 'otRieng' : 'tienOT')) + '</td>' +
          '<td>' + (tt.nganHang ? h(tt.nganHang) + (tt.soTK ? ' – ' + h(tt.soTK) : '') : '<span class="the-tt cam">Chưa khai báo</span>') + '</td>' +
          '<td>' + (thieu.length ? '<span class="the-tt do" title="' + h(thieu.map(function (r) { return r.hoTen; }).join(', ')) + '">' + thieu.length + ' người</span>' : '<span class="mo">—</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    App.hop({
      tieuDe: 'Chi lương tháng ' + m + '/' + y + ': kỳ I, kỳ II, làm thêm giờ', co: 'rong',
      than: '<p class="mo" style="margin-top:0">Kỳ I (giữa tháng) tạm ứng theo chức vụ; kỳ II (cuối tháng) = tổng thu nhập − kỳ I − các khoản khấu trừ' +
        (db.caiDat.otTraRieng ? '; tiền làm thêm giờ chi bằng bảng riêng' : '') + '. Mỗi bảng lương (khối) xuất 1 sheet. Ngân hàng chi lương và số tài khoản công ty khai báo ở <a href="#danhmuc" id="cl-dm">Danh mục → Phòng, đội</a>.</p>' + bang +
        '<div class="form" style="grid-template-columns:1fr 1fr;margin-top:12px">' +
        App.F.o('Mẫu', App.F.sel('mau', 'ky2_nh', App.F.cap(MAU_CHI))) +
        App.F.o('Bảng lương', '<select name="khoi"><option value="">Tất cả (mỗi khối 1 sheet)</option>' + khois.map(function (k) { return '<option' + (st.khoi === k ? ' selected' : '') + '>' + h(k) + '</option>'; }).join('') + '</select>') + '</div>',
      moRa: function (el, dong) { var a = App.$('#cl-dm', el); a.onclick = function () { dong(); App.moDanhMuc && App.moDanhMuc('pb'); }; },
      nut: [{ ten: 'Đóng' }, {
        ten: 'Xuất Excel', loai: 'chinh', bam: function (el) {
          var v = App.F.doc(el), ks = v.khoi ? [v.khoi] : khois;
          var shs = ks.map(function (k) { return sheetChi(v.mau, k, rows.filter(function (r) { return r.khoi === k; })); }).filter(Boolean);
          if (!shs.length) { App.bao('Không có ai có số tiền để chi theo mẫu này.', 'loi'); return false; }
          App.xuatExcel(App.tenFile(MAU_CHI[v.mau] + ' T' + TL.pad(m) + ' ' + y + (v.khoi ? ' ' + v.khoi : '')), shs);
          var thieu = rows.filter(function (r) { return ks.indexOf(r.khoi) >= 0 && !r.soTK && /_nh$/.test(v.mau) && soTienChi(v.mau, r) > 0; });
          if (thieu.length) App.bao(thieu.length + ' người chưa có số tài khoản: ' + thieu.slice(0, 5).map(function (r) { return r.hoTen; }).join(', ') + (thieu.length > 5 ? '…' : ''), 'loi');
          return false;
        }
      }]
    });
  }
  function soTienChi(mau, r) {
    return /^ky1/.test(mau) ? r.tamUng : /^ky2/.test(mau) ? r.thucLinh : (App.db.caiDat.otTraRieng ? r.otRieng : r.tienOT);
  }
  function sheetChi(mau, khoi, rows) {
    var db = App.db, y = App.ky.y, m = App.ky.m, tt = TL.thongTinKhoi(db, khoi), ten = khoi.slice(0, 30);
    var ds = rows.filter(function (r) { return soTienChi(mau, r) > 0; });
    if (!ds.length) return null;
    var tong = ds.reduce(function (s, r) { return s + soTienChi(mau, r); }, 0);
    if (/_nh$/.test(mau)) {
      var loai = mau === 'ky1_nh' ? 'LƯƠNG KỲ I' : mau === 'ky2_nh' ? 'LƯƠNG KỲ II' : 'TIỀN LÀM THÊM GIỜ';
      return App.sheetBang({
        ten: ten, tieuDe: 'DANH SÁCH ĐỀ NGHỊ CHI ' + loai + ' THÁNG ' + m + '/' + y, phuDe: '',
        dongThem: ['BỘ PHẬN: ' + khoi.toUpperCase(), 'Kính gửi: ' + (tt.nganHang || '................................................'), 'Số tài khoản: ' + (tt.soTK || '................................')],
        cot: [{ t: 'STT', stt: true, w: 6, kieu: 'giua' }, { t: 'SỐ TÀI KHOẢN', w: 20, f: function (r) { return r.soTK || ''; } },
          { t: 'TÊN CHỦ TÀI KHOẢN', w: 28, f: function (r) { return r.hoTen; } }, { t: 'SỐ TIỀN GHI CÓ', w: 16, kieu: 'so', f: function (r) { return soTienChi(mau, r); } },
          { t: 'GHI CHÚ', w: 22, khongTong: true, f: function (r) { return r.soTK ? '' : 'Chưa có số tài khoản'; } }],
        dong: ds, tong: { _nhan: 'TỔNG SỐ', tamUng: tong, thucLinh: tong, otRieng: tong, tienOT: tong }, cotNhanTong: 2, ngang: false,
        dongCuoi: 'Số tiền bằng chữ: ' + TL.docSo(tong)
      });
    }
    if (mau === 'ky1_ds') {
      var dong = [];
      nhomTheoPB(ds).forEach(function (g) { dong.push({ _kieu: 'nhom', _nhan: g.ten }); g.rows.forEach(function (r) { dong.push(r); }); });
      return App.sheetBang({
        ten: ten, tieuDe: 'DANH SÁCH TẠM ỨNG LƯƠNG ' + khoi.toUpperCase(), phuDe: 'Tháng ' + m + ' năm ' + y, ngang: false,
        cot: [{ t: 'STT', stt: true, w: 6, kieu: 'giua' }, { t: 'HỌ VÀ TÊN', w: 26, k: 'hoTen' }, { t: 'CHỨC VỤ', w: 24, k: 'chucVu' },
          { t: 'SỐ TIỀN ỨNG', w: 16, kieu: 'so', k: 'tamUng' }, { t: 'KÝ NHẬN', w: 16, khongTong: true, f: function () { return ''; } }],
        dong: dong, tong: { _nhan: 'TỔNG CỘNG', tamUng: tong }, cotNhanTong: 1, dongCuoi: 'Tổng số tiền tạm ứng (bằng chữ): ' + TL.docSo(tong)
      });
    }
    // bảng thanh toán tiền làm thêm giờ (lương giờ = mức lương / công chuẩn / số giờ làm 1 ngày)
    var hs = db.caiDat.heSoOT || {}, sumF = function (f) { return ds.reduce(function (s, r) { return s + (+f(r) || 0); }, 0); };
    var cotOT = [{ t: 'STT', stt: true, w: 5, kieu: 'giua' }, { t: 'Họ và tên', w: 22, k: 'hoTen' }, { t: 'Chức danh', w: 16, k: 'chucVu' },
      { t: 'Mức lương', w: 12, kieu: 'so', k: 'luongCB', khongTong: true }, { t: 'Lương ngày', w: 11, kieu: 'so', k: 'luongNgay', khongTong: true }, { t: 'Lương giờ', w: 10, kieu: 'so', k: 'luongGio', khongTong: true },
      { t: 'Số giờ', nhom: 'Làm thêm ngày làm việc (' + (hs.thuong || 150) + '%)', w: 7, kieu: 'cong', f: function (r) { return r.cong.otThuong; } },
      { t: 'Thành tiền', nhom: 'Làm thêm ngày làm việc (' + (hs.thuong || 150) + '%)', w: 11, kieu: 'so', f: function (r) { return r.otTien.thuong; } },
      { t: 'Số giờ', nhom: 'Làm thêm ngày nghỉ (' + (hs.nghi || 200) + '%)', w: 7, kieu: 'cong', f: function (r) { return r.cong.otNghi; } },
      { t: 'Thành tiền', nhom: 'Làm thêm ngày nghỉ (' + (hs.nghi || 200) + '%)', w: 11, kieu: 'so', f: function (r) { return r.otTien.nghi; } },
      { t: 'Số giờ', nhom: 'Làm thêm ngày lễ, Tết (' + (hs.le || 300) + '%)', w: 7, kieu: 'cong', f: function (r) { return r.cong.otLe; } },
      { t: 'Thành tiền', nhom: 'Làm thêm ngày lễ, Tết (' + (hs.le || 300) + '%)', w: 11, kieu: 'so', f: function (r) { return r.otTien.le; } },
      { t: 'Tổng cộng tiền', w: 13, kieu: 'so', k: 'tienOT' }, { t: 'Ký nhận', w: 10, khongTong: true, f: function () { return ''; } }];
    var tongOT = { _nhan: 'TỔNG CỘNG', tienOT: sumF(function (r) { return r.tienOT; }) };
    return App.sheetBang({
      ten: ten, tieuDe: 'BẢNG THANH TOÁN TIỀN LÀM THÊM GIỜ ' + khoi.toUpperCase(), phuDe: 'Tháng ' + m + ' năm ' + y, quocHieu: true,
      cot: cotOT, dong: ds, cotNhanTong: 1, coCot: 2,
      tong: Object.assign(tongOT, { cong: { otThuong: sumF(function (r) { return r.cong.otThuong; }), otNghi: sumF(function (r) { return r.cong.otNghi; }), otLe: sumF(function (r) { return r.cong.otLe; }) },
        otTien: { thuong: sumF(function (r) { return r.otTien.thuong; }), nghi: sumF(function (r) { return r.otTien.nghi; }), le: sumF(function (r) { return r.otTien.le; }) } }),
      dongCuoi: 'Tổng số tiền làm thêm giờ (bằng chữ): ' + TL.docSo(tongOT.tienOT)
    });
  }

  /* ================= Phiếu lương ================= */
  function vePL(noi) {
    var db = App.db, y = App.ky.y, m = App.ky.m;
    var bl = TL.tinhBangLuong(db, y, m);
    var chon = st.pl;
    var opts = '<option value="">Tất cả nhân viên (' + bl.rows.length + ')</option>' +
      db.phongBan.map(function (p) { return '<option value="pb:' + h(p.ma) + '"' + (chon === 'pb:' + p.ma ? ' selected' : '') + '>' + h(p.ten) + '</option>'; }).join('') +
      '<optgroup label="Từng người">' + bl.rows.map(function (r) { return '<option value="' + r.nvId + '"' + (chon === r.nvId ? ' selected' : '') + '>' + h(r.ma + ' – ' + r.hoTen) + '</option>'; }).join('') + '</optgroup>';
    noi.innerHTML = '<div class="the khong-in" style="padding:12px 14px"><div class="hang"><select id="pl-chon">' + opts + '</select><span class="gian"></span>' +
      '<button class="nut" id="pl-xuat">' + App.icon('tai') + 'Xuất Excel</button><button class="nut chinh" id="pl-in">' + App.icon('in') + 'In phiếu lương</button></div>' +
      '<div class="mo nho" style="margin-top:8px">In ra giấy A4 dọc, mỗi trang 2 phiếu. Có thể chọn “Lưu thành PDF” trong hộp thoại in để gửi qua Zalo / email.</div></div>' +
      '<div class="ds-phieu" id="pl-ds"></div>';
    var ds = dsPhieu(bl, chon);
    App.$('#pl-ds').innerHTML = ds.length ? ds.map(function (r) { return phieu(r, bl); }).join('') : '<div class="trong">Không có nhân viên.</div>';
    App.$('#pl-chon').onchange = function () { st.pl = this.value; App.veLai(); };
    App.$('#pl-in').onclick = function () { App.inTrang(true); };
    App.$('#pl-xuat').onclick = function () { xuatPL(dsPhieu(bl, st.pl), bl); };
  }
  function dsPhieu(bl, chon) {
    return bl.rows.filter(function (r) { return !chon || (chon.indexOf('pb:') === 0 ? r.phongBan === chon.slice(3) : r.nvId === chon); });
  }
  function dongPhieu(r, bl) {
    var cd = App.db.caiDat, c = r.cong, L = [];
    L.push(['m', 'I. THU NHẬP', '']);
    (r.spChiTiet || []).forEach(function (x) { L.push(['c', x.ten + ' (' + App.tien(x.sl) + ' ' + x.dvt + ' × ' + App.tien(x.donGia) + ' đ)', x.tien]); });
    L.push(['c', 'Lương thời gian (' + App.so(c.congTG) + ' công' + (c.congThemLeTG ? ', gồm ' + App.so(c.congThemLeTG) + ' công tăng thêm đi làm lễ, Tết' : '') +
      (r.thuViec ? (r.thuViec.toanKy ? '; thử việc hưởng ' + App.so(r.thuViec.tiLe) + '% lương' : '; ' + App.so(r.thuViec.congTV) + ' công thử việc hưởng ' + App.so(r.thuViec.tiLe) + '%') : '') + ')', r.luongTG]);
    if (r.luongNgung) L.push(['c', 'Nghỉ, ngừng việc hưởng lương (' + App.so(c.ngung) + ' công)', r.luongNgung]);
    if (r.tienOT) L.push(['c', 'Làm thêm giờ (' + App.so(c.otTong) + ' giờ)', r.tienOT]);
    (bl.phuCap || []).forEach(function (pc) {
      if (!r.phuCap[pc.ma]) return;
      L.push(['c', 'Phụ cấp ' + pc.ten.toLowerCase() + (pc.cachTinh === 'theo_ngay' ? ' (' + App.so((r.phuCapNgay || {})[pc.ma]) + ' ngày)' : ''), r.phuCap[pc.ma]]);
    });
    if (r.thuong) L.push(['c', 'Thưởng', r.thuong]);
    if (r.thuongQD) L.push(['c', 'Thưởng theo quyết định', r.thuongQD]);
    if (r.congKhac) L.push(['c', 'Khoản cộng khác', r.congKhac]);
    L.push(['m', 'Tổng thu nhập', r.tongThuNhap]);
    L.push(['m', 'II. CÁC KHOẢN KHẤU TRỪ', '']);
    if (r.bhxh) L.push(['c', 'BHXH (' + App.so(cd.bh.nv.bhxh) + '%)', r.bhxh]);
    if (r.bhyt) L.push(['c', 'BHYT (' + App.so(cd.bh.nv.bhyt) + '%)', r.bhyt]);
    if (r.bhtn) L.push(['c', 'BHTN (' + App.so(cd.bh.nv.bhtn) + '%)', r.bhtn]);
    if (r.doanPhi) L.push(['c', 'Công đoàn (' + App.so(cd.bh.doanPhi) + '%)', r.doanPhi]);
    L.push(['c', 'Thuế TNCN', r.thue]);
    if (r.phatMuon) L.push(['c', 'Phạt đi muộn / về sớm', r.phatMuon]);
    if (r.khauTru) L.push(['c', 'Khấu trừ khác' + (r.ghiChu ? ' (' + r.ghiChu + ')' : ''), r.khauTru]);
    if (r.phatQD) L.push(['c', 'Phạt, bồi thường theo quyết định', r.phatQD]);
    L.push(['m', 'Cộng các khoản khấu trừ', r.tongKhauTru]);
    if (r.tamUng) L.push(['m', 'III. ĐÃ TẠM ỨNG KỲ I', r.tamUng]);
    if (r.otRieng) L.push(['m', 'IV. LÀM THÊM GIỜ (CHI BẢNG RIÊNG)', r.otRieng]);
    L.push(['tl', 'LÃNH KỲ II', r.thucLinh]);
    return L;
  }
  function phieu(r, bl) {
    var db = App.db, y = App.ky.y, m = App.ky.m;
    var nv = db.nhanVien.filter(function (x) { return x.id === r.nvId; })[0];
    var pn = nv ? TL.phepNam(db, nv, y) : null;
    return '<div class="phieu"><div class="p-dau"><span><b>' + h(db.congTy.ten) + '</b></span><span>Kỳ lương: ' + TL.pad(m) + '/' + y + '</span></div>' +
      '<h3>PHIẾU LƯƠNG</h3><div class="p-ky">Tháng ' + m + ' năm ' + y + '</div>' +
      '<div class="p-tt"><div>Họ tên: <b>' + h(r.hoTen) + '</b></div><div>Mã NV: <b>' + h(r.ma) + '</b></div>' +
      '<div>Phòng / đội: ' + h(r.tenPhongBan) + '</div><div>Chức danh: ' + h(r.chucVu) + '</div>' +
      (r.soTK ? '<div>Tài khoản: ' + h(r.soTK) + (r.nganHang ? ' – ' + h(r.nganHang) : '') + '</div>' : '') +
      '<div>Mức lương: <b>' + App.tien(r.luongCB) + '</b>' + (r.hinhThuc !== 'thang' ? ' ' + App.DV_LUONG[r.hinhThuc] : '') + '</div><div>Ngày công: <b>' + App.so(r.cong.congTG) + '</b> / ' + App.so(r.congChuan) + (r.cong.sp ? ' · SP: ' + App.so(r.cong.sp) : '') + '</div>' +
      (pn ? '<div>Phép năm còn lại: <b>' + App.so(pn.conLai) + '</b> ngày</div>' : '') + (r.cong.muonLan ? '<div>Đi muộn / về sớm: ' + r.cong.muonLan + ' lần</div>' : '') + '</div>' +
      '<table>' + dongPhieu(r, bl).map(function (x) { return '<tr class="' + x[0] + '"><td>' + h(x[1]) + '</td><td>' + (x[2] === '' ? '' : App.tien(x[2])) + '</td></tr>'; }).join('') + '</table>' +
      '<div class="bang-chu">Bằng chữ: ' + TL.docSo(r.thucLinh) + '</div>' +
      '<div class="ky-ten"><div>Người lập phiếu<span>(Ký, họ tên)</span>' + h(db.congTy.nguoiLap) + '</div><div>Người nhận<span>(Ký, họ tên)</span>' + h(r.hoTen) + '</div></div></div>';
  }
  function xuatPL(ds, bl) {
    var y = App.ky.y, m = App.ky.m, db = App.db, K = App.KIEU;
    var dong = [], gop = [], cao = {};
    ds.forEach(function (r) {
      var r0 = dong.length;
      dong.push([{ v: db.congTy.ten, s: { b: true } }, { v: 'Kỳ lương: ' + TL.pad(m) + '/' + y, s: { i: true, ngang: 'right' } }]);
      dong.push([{ v: 'PHIẾU LƯƠNG THÁNG ' + m + '/' + y, s: { b: true, sz: 14, ngang: 'center' } }]); gop.push('A' + (r0 + 2) + ':B' + (r0 + 2)); cao[r0 + 1] = 22;
      dong.push(['Họ tên: ' + r.hoTen + ' – Mã NV: ' + r.ma]);
      dong.push(['Phòng / đội: ' + r.tenPhongBan + (r.chucVu ? ' – Chức danh: ' + r.chucVu : '')]);
      if (r.soTK) dong.push(['Tài khoản nhận lương: ' + r.soTK + (r.nganHang ? ' – ' + r.nganHang : '')]);
      dong.push(['Mức lương: ' + App.tien(r.luongCB) + ' – Ngày công: ' + App.so(r.cong.congTG) + '/' + App.so(r.congChuan) + (r.cong.sp ? ' – SP: ' + App.so(r.cong.sp) : '')]);
      dongPhieu(r, bl).forEach(function (x) {
        var s1 = x[0] === 'c' ? K.chu : K.tong, s2 = x[0] === 'c' ? K.so : K.tongSo;
        dong.push([{ v: (x[0] === 'c' ? '   ' : '') + x[1], s: s1 }, { v: x[2] === '' ? '' : x[2], s: s2 }]);
      });
      dong.push([{ v: 'Bằng chữ: ' + TL.docSo(r.thucLinh), s: { i: true } }]);
      dong.push([{ v: 'Người lập phiếu', s: K.kyTen }, { v: 'Người nhận', s: K.kyTen }]);
      dong.push([], [], [], [{ v: db.congTy.nguoiLap || '', s: K.kyTen }, { v: r.hoTen, s: K.kyTen }], []);
    });
    App.xuatExcel('Phieu_luong_T' + TL.pad(m) + '_' + y, [{ ten: 'Phiếu lương', dong: dong, gop: gop, cao: cao, cot: [50, 20], ngang: false }]);
  }

  App.trang.bangluong = { ve: veBL };
  App.trang.phieuluong = { ve: vePL };
  App.moPhieuLuong = function (id) { st.pl = id || ''; if (location.hash !== '#phieuluong') location.hash = '#phieuluong'; else App.veLai(); };
})();
