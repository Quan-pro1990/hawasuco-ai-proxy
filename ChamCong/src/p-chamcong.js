/* Trang Bảng chấm công: lưới nhân viên × ngày của kỳ công, chấm bằng chuột / bàn phím, dán từ Excel,
   xuất Excel theo mẫu 01a-LĐTL. */
(function () {
  'use strict';
  var App = window.App, TL = window.TL, h = App.h;

  var CHE = {
    kh: { ten: 'Ký hiệu công', kho: 'cc' },
    ot: { ten: 'Làm thêm ngoài giờ', kho: 'ot' },
    muon: { ten: 'Đi muộn / về sớm (phút)', kho: 'muon' }
  };
  var st = { che: 'kh', pb: '', ld: '', tim: '', anc: null, act: null, sel: null, keo: false, undo: [], kyUndo: '' };
  /** Mở bảng chấm công lọc sẵn 1 phòng / đội (từ màn hình Tổng quan đơn vị) */
  App.moChamCong = function (pb) { st.pb = pb || ''; if (location.hash !== '#chamcong') location.hash = '#chamcong'; else App.veLai(); };
  var C = null; // ngữ cảnh đang hiển thị
  var oSua = null;

  /** Các cột tổng hợp ("quy ra công") theo chế độ xem */
  function cotTong(che, coSP) {
    if (che === 'ot') return [['otThuong', 'Ngày thường'], ['otNghi', 'Ngày nghỉ'], ['otLe', 'Ngày lễ'], ['otDem', 'Ban đêm'], ['otTong', 'Tổng giờ', 1]];
    if (che === 'muon') return [['muonLan', 'Số lần'], ['muonPhut', 'Số phút', 1]];
    var c = [['congChuan', 'Công chuẩn']];
    if (coSP) c.push(['sp', 'Công lương SP']);
    c.push(['congTG', 'Công lương thời gian', 1], ['ngayCom', 'Ngày cơm'], ['ngung', 'Nghỉ hưởng 100% lương'], ['khongHL', 'Nghỉ không lương'], ['bhxh', 'Hưởng BHXH']);
    return c;
  }
  function giaTriTong(th, k) { return k === 'khongHL' ? Math.round((th.khong + th.kp) * 100) / 100 : th[k]; }

  function ve(noi) {
    var db = App.db, y = App.ky.y, m = App.ky.m, key = TL.khoaKy(y, m);
    if (st.kyUndo !== key) { st.undo = []; st.kyUndo = key; st.sel = st.act = st.anc = null; }
    var khoa = App.thangKhoa();
    var ngay = TL.ngayKy(db, y, m), le = TL.bangNgayLe(db);
    var dvc = App.dvChamCong();
    var rows = TL.dsNhanVienKy(db, y, m).filter(function (nv) {
      var dvk = (st.pb || dvc) ? TL.donViTheoKy(db, nv, y, m).phongBan : '';
      if (st.pb && dvk !== st.pb) return false;
      if (dvc && dvc.indexOf(dvk) < 0) return false;
      if (st.ld && (nv.loaiLD || '') !== (st.ld === '-' ? '' : st.ld)) return false;
      if (st.tim && !App.timKhop(nv.ma + ' ' + nv.hoTen, st.tim)) return false;
      return true;
    });
    C = {
      y: y, m: m, ngay: ngay, n: ngay.length, le: le, rows: rows, kh: TL.bangKyHieu(db), khoa: khoa, hn: App.homNay(),
      cc: TL.congChuan(db, y, m), coSP: db.kyHieu.some(function (k) { return k.sp; }), loaiLe: TL.bangLoaiLe(db), heSoLe: TL.bangHeSoLe(db),
      loaiChung: ngay.map(function (x) { return TL.loaiNgay(db, x.y, x.m, x.d, le); })
    };
    var cd = db.caiDat, hs = cd.heSoOT || {}, hsd = TL.heSoOTDem(cd), cdem = TL.cauHinhDem(cd), khDem = TL.hhmm(cdem.tu) + '–' + TL.hhmm(cdem.den);

    var kyHieuNut = db.kyHieu.map(function (k) {
      return '<button data-k="' + h(k.ma) + '" title="' + h(k.ten) + '" style="background:var(--k-' + k.nhom + ')"' + (k.nhom === 'kp' ? ' class="n-kp"' : '') + '>' + h(k.ma) + '</button>';
    }).join('') + '<button class="xoa" data-k="" title="Xoá ô đang chọn (phím Delete)">Xoá</button>';

    noi.innerHTML =
      (khoa ? '<div class="canh-bao khong-in" style="margin-bottom:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span style="flex:1">Kỳ lương tháng ' + m + '/' + y + ' đã <b>chốt</b> nên không sửa được chấm công.</span><button class="nut" id="cc-mokhoa">' + App.icon('mo') + 'Mở khoá để sửa</button></div>' : '') +
      '<div class="the khong-in" style="padding:12px 14px"><div class="cc-cong">' +
      '<div class="nut-nhom" id="cc-che">' + Object.keys(CHE).map(function (k) { return '<button class="nut' + (st.che === k ? ' chon' : '') + '" data-che="' + k + '">' + CHE[k].ten + '</button>'; }).join('') + '</div>' +
      '<select id="cc-pb">' + App.optDonVi(st.pb, { tatCa: 'Tất cả phòng / đội', ngung: true }) + '</select>' +
      App.chonLoaiLD('cc-ld', st.ld) +
      '<input type="search" id="cc-tim" placeholder="Tìm nhân viên…" value="' + h(st.tim) + '" style="width:170px">' +
      '<span class="gian"></span>' +
      '<button class="nut" id="cc-du"' + (khoa ? ' disabled' : '') + '>' + App.icon('dien') + 'Chấm đủ công…</button>' +
      '<button class="nut" id="cc-undo" title="Hoàn tác (Ctrl+Z)"' + (st.undo.length ? '' : ' disabled') + '>' + App.icon('hoantac') + 'Hoàn tác</button>' +
      '<button class="nut" id="cc-xuat">' + App.icon('tai') + 'Xuất Excel (mẫu 01a)</button>' +
      '<button class="nut" id="cc-in">' + App.icon('in') + 'In</button>' +
      '</div>' +
      (st.che === 'kh' ? '<div class="bang-mau" id="cc-mau">' + kyHieuNut + '</div>' : '') +
      '<div class="mo nho" style="margin-top:8px">Kỳ công: <b>' + TL.hienNgay(ngay[0].iso) + ' – ' + TL.hienNgay(ngay[ngay.length - 1].iso) + '</b>. ' + (st.che === 'kh'
        ? 'Chọn ô (kéo chuột để chọn nhiều ô, nhiều người) rồi bấm ký hiệu ở trên. Hoặc gõ ký hiệu trên bàn phím (vd <b>+</b> hoặc <b>x</b>, <b>sp</b>, <b>p</b>, <b>o</b> = Ô) rồi Enter. Dán được vùng ký hiệu từ Excel (Ctrl+V).'
        : st.che === 'ot' ? 'Chọn ô rồi gõ <b>khung giờ làm ngoài giờ</b>: <b>17:30-21:00</b>, <b>17h-21h</b>; nhiều khung cách nhau dấu phẩy: <b>17-19, 22-2</b> (qua nửa đêm: <b>22-2</b>). ' +
          'Hoặc gõ số giờ (vd 2 hoặc 1,5 – tính là ban ngày). Phần mềm tự tính số giờ và tách giờ <b>ban đêm ' + khDem + '</b>. ' +
          'Hệ số: ngày thường ' + App.so(+hs.thuong || 150) + '%, ngày nghỉ ' + App.so(+hs.nghi || 200) + '%, ban đêm ' + App.so(cdem.heSo) + '%, lễ, Tết ' + App.so(+hs.le || 300) + '%. Enter để xuống dòng, Delete để xoá.'
        : 'Chọn ô rồi gõ số phút đi muộn / về sớm của ngày đó. Enter để xuống dòng, Delete để xoá.') +
      '</div></div>' +
      App.dauIn(st.che === 'kh' ? 'BẢNG CHẤM CÔNG' : st.che === 'ot' ? 'BẢNG CHẤM CÔNG LÀM THÊM GIỜ' : 'BẢNG THEO DÕI ĐI MUỘN / VỀ SỚM',
        'Tháng ' + m + ' năm ' + y + ' (từ ' + TL.hienNgay(ngay[0].iso) + ' đến ' + TL.hienNgay(ngay[ngay.length - 1].iso) + ')' + (st.pb ? ' – Bộ phận: ' + TL.tenPhongBan(db, st.pb) : '')) +
      '<div class="cuon cao" id="cc-cuon" style="position:relative"><table class="cc" id="cc-bang"></table></div>' +
      '<div class="chu-giai">' + (st.che === 'kh' ? db.kyHieu.map(function (k) { return '<span><b style="background:var(--k-' + k.nhom + ')">' + h(k.ma) + '</b>' + h(k.ten) + '</span>'; }).join('') : '') +
      (st.che === 'ot' ? '<span><b class="cg-ot ot-khung">3,5</b>Nhập theo khung giờ (rê chuột lên ô để xem khung giờ)</span><span><b class="cg-ot ot-dem">4</b>Có giờ làm thêm ban đêm (' + khDem + ')</span>' +
        '<span><b class="cg-ot ot-vuot">6</b>Vượt mức tối đa (làm bình thường + làm thêm ≤ 12 giờ/ngày; ≤ ' + App.so(+cd.otToiDaThang || 40) + ' giờ/tháng – Điều 107 BLLĐ 2019)</span>' : '') +
      '<span><b style="background:var(--ngay-nghi)">&nbsp;</b>Ngày nghỉ hằng tuần (theo loại lao động)</span><span><b style="background:var(--ngay-le)">&nbsp;</b>Ngày lễ, Tết: nghỉ (L) = 1 công; đi làm (+) = ×' + App.so(cd.heSoCongLe) + ' công ngày lễ, ×' + App.so(cd.heSoCongTet) + ' công ngày Tết (ngày có hệ số riêng: theo Danh mục → Ngày lễ, Tết); SP không nhân (cơm 1 ngày)</span>' +
      '<span><b style="background:repeating-linear-gradient(45deg,var(--soc1),var(--soc1) 4px,var(--soc2) 4px,var(--soc2) 8px)">&nbsp;</b>Chưa vào làm / đã nghỉ việc</span></div>' +
      App.kyIn();

    veBang();

    App.$('#cc-che').onclick = function (e) { var b = e.target.closest('[data-che]'); if (b) { huySua(); st.che = b.dataset.che; App.veLai(); } };
    App.$('#cc-pb').onchange = function () { st.pb = this.value; st.sel = st.act = null; App.veLai(); };
    var ld = App.$('#cc-ld'); if (ld) ld.onchange = function () { st.ld = this.value; st.sel = st.act = null; App.veLai(); };
    App.$('#cc-tim').oninput = function () { st.tim = this.value; st.sel = st.act = null; var v = this.value; App.veLai(); var i = App.$('#cc-tim'); i.focus(); i.setSelectionRange(v.length, v.length); };
    var mau = App.$('#cc-mau');
    if (mau) mau.onclick = function (e) { var b = e.target.closest('[data-k]'); if (b) ganChon(b.dataset.k); };
    App.$('#cc-du').onclick = chamDu;
    App.$('#cc-undo').onclick = hoanTac;
    App.$('#cc-xuat').onclick = xuatExcel;
    App.$('#cc-in').onclick = function () { App.inTrang(); };
    var mk = App.$('#cc-mokhoa');
    if (mk) mk.onclick = function () { App.moKhoa(); };
    var bang = App.$('#cc-bang');
    bang.addEventListener('mousedown', chuotXuong);
    bang.addEventListener('mouseover', chuotQua);
    bang.addEventListener('dblclick', function (e) { var td = e.target.closest('td.d'); if (td && !C.khoa) batDauSua(''); });
    App.$('#cc-cuon').addEventListener('scroll', function () { if (oSua) xongSua(true); });
  }

  /* ---------- Vẽ lưới ---------- */
  function giaTri(nv, i) { var x = C.ngay[i]; return TL.oNgay(App.db, CHE[st.che].kho, nv.id, x.y, x.m, x.d); }
  function lop(loai) { return loai === 'le' ? 'le' : loai === 'nghi' ? 'wk' : ''; }

  /** Nhóm các ngày của kỳ theo tháng dương lịch: [{ten, so}] */
  function bangThang() {
    var ds = [];
    C.ngay.forEach(function (x) {
      var t = 'Tháng ' + TL.pad(x.m) + '/' + x.y;
      if (!ds.length || ds[ds.length - 1].ten !== t) ds.push({ ten: t, so: 0 });
      ds[ds.length - 1].so++;
    });
    return ds;
  }

  function veBang() {
    var db = App.db, n = C.n, che = st.che, cd = db.caiDat, gioNgay = +cd.gioLamNgay || 8, toiDaThang = +cd.otToiDaThang || 0;
    var tong = cotTong(che, C.coSP);
    var bt = bangThang(), coBang = bt.length > 1;
    var top1 = coBang ? 22 : 0, top2 = top1 + 24;
    var rs = coBang ? 3 : 2;
    var s = '<thead>';
    if (coBang) {
      s += '<tr><th class="i dinh1" rowspan="3" style="top:0">STT</th><th class="i dinh2" rowspan="3" style="top:0">Mã NV</th><th class="i dinh3" rowspan="3" style="top:0;text-align:left;padding-left:6px">Họ và tên</th>';
      bt.forEach(function (b, i) { s += '<th colspan="' + b.so + '" style="top:0;height:22px;background:' + (i % 2 ? 'var(--thang2)' : 'var(--thang1)') + '">' + b.ten + '</th>'; });
      tong.forEach(function (t) { s += '<th class="t" rowspan="3" style="top:0' + (t[2] ? ';color:var(--chinh-dam)' : '') + '">' + t[1] + '</th>'; });
      s += '</tr><tr>';
    } else {
      s += '<tr><th class="i dinh1" rowspan="2">STT</th><th class="i dinh2" rowspan="2">Mã NV</th><th class="i dinh3" rowspan="2" style="text-align:left;padding-left:6px">Họ và tên</th>';
    }
    C.ngay.forEach(function (x, i) {
      s += '<th class="d ' + lop(C.loaiChung[i]) + (x.iso === C.hn ? ' hn' : '') + '" style="top:' + top1 + 'px"' + (C.le[x.iso] ? ' title="' + h(C.le[x.iso]) + '"' : '') + '>' + TL.pad(x.d) + '</th>';
    });
    if (!coBang) tong.forEach(function (t) { s += '<th class="t" rowspan="2"' + (t[2] ? ' style="color:var(--chinh-dam)"' : '') + '>' + t[1] + '</th>'; });
    s += '</tr><tr>';
    C.ngay.forEach(function (x, i) { s += '<th class="d ' + lop(C.loaiChung[i]) + '" style="top:' + top2 + 'px">' + TL.TEN_THU[TL.thuTrongTuan(x.y, x.m, x.d)] + '</th>'; });
    s += '</tr></thead><tbody>';
    var chan = C.ngay.map(function () { return 0; });
    var ctx = { kh: C.kh, le: C.le, loaiLe: C.loaiLe, heSoLe: C.heSoLe, ngay: C.ngay };
    C.rows.forEach(function (nv, r) {
      var th = TL.tongHopCong(db, C.y, C.m, nv, ctx);
      s += '<tr><td class="i stt dinh1">' + (r + 1) + '</td><td class="i dinh2">' + h(nv.ma) + '</td><td class="i dinh3" title="' + h(nv.hoTen + (nv.chucVu ? ' – ' + nv.chucVu : '')) + '">' + h(nv.hoTen) + '</td>';
      C.ngay.forEach(function (x, i) {
        var lam = TL.nvLamNgay(nv, x.y, x.m, x.d);
        var v = giaTri(nv, i), ln = TL.loaiNgay(db, x.y, x.m, x.d, C.le, nv), cls = 'd ' + lop(ln), txt = '', tip = '';
        if (!lam) cls += ' ngoai';
        if (v != null && v !== '') {
          if (che === 'kh') {
            var k = C.kh[String(v).toUpperCase()];
            cls += k ? ' n-' + k.nhom : ' n-sai';
            txt = h(v);
            if (k && k.lam > 0 && !k.sp && C.le[x.iso]) { var hsl = TL.heSoCongNgay(db, x.iso, C.loaiLe, C.heSoLe); if (hsl !== 1) { cls += ' nhan'; tip = 'Đi làm ' + (C.loaiLe[x.iso] === 'tet' ? 'ngày Tết' : 'ngày lễ') + ': ×' + App.so(hsl) + ' công, cơm 1 ngày'; txt += '<sup>×' + App.so(hsl) + '</sup>'; } }
            if (k && k.lam > 0) chan[i]++;
          } else if (che === 'ot') {
            var g = TL.gioOT(v, cd), toiDa = ln === 'nghi' || ln === 'le' ? 12 : 12 - (ln === 'nua' ? gioNgay / 2 : gioNgay);
            txt = App.so(g.gio); cls += ' so-ot'; chan[i] += g.gio;
            if (g.khung) { cls += g.dem ? ' ot-dem' : ' ot-khung'; tip = g.khung.replace(/,/g, ', ') + ' = ' + App.so(g.gio) + ' giờ' + (g.dem ? ' (ban đêm ' + App.so(g.dem) + ' giờ)' : ''); }
            else if (!g.gio) { txt = h(v); cls += ' n-sai'; tip = 'Giá trị không đọc được'; }
            if (g.gio > toiDa) { cls += ' ot-vuot'; tip = (tip ? tip + '. ' : '') + 'Vượt mức làm thêm tối đa trong ngày (' + App.so(toiDa) + ' giờ): làm bình thường + làm thêm không quá 12 giờ/ngày – Điều 107 BLLĐ 2019'; }
          } else { txt = App.so(v); cls += ' so-muon'; chan[i] += +v || 0; }
        }
        s += '<td class="' + cls + '" data-r="' + r + '" data-i="' + i + '"' + (tip ? ' title="' + tip + '"' : '') + '>' + txt + '</td>';
      });
      tong.forEach(function (t) {
        var val = giaTriTong(th, t[0]), vuot = che === 'ot' && t[0] === 'otTong' && toiDaThang > 0 && val > toiDaThang;
        s += '<td class="t' + (t[2] ? ' dam' : '') + (vuot ? ' ot-vuot' : '') + '"' + (vuot ? ' title="Vượt ' + App.so(toiDaThang) + ' giờ làm thêm / tháng (Điều 107 BLLĐ 2019)"' : '') + '>' + (val ? App.so(val) : '') + '</td>';
      });
      s += '</tr>';
    });
    if (!C.rows.length) s += '<tr><td colspan="' + (n + 3 + tong.length) + '" class="trong" style="height:80px">Không có nhân viên trong kỳ này. <a href="#nhanvien">Thêm nhân viên</a></td></tr>';
    s += '</tbody>';
    if (C.rows.length) {
      s += '<tfoot><tr><td class="i dinh1"></td><td class="i dinh2"></td><td class="i dinh3">' + (che === 'kh' ? 'Số người đi làm' : che === 'ot' ? 'Tổng giờ làm thêm' : 'Tổng phút') + '</td>';
      C.ngay.forEach(function (x, i) { s += '<td class="d ' + lop(C.loaiChung[i]) + '">' + (chan[i] ? App.so(chan[i]) : '') + '</td>'; });
      tong.forEach(function () { s += '<td class="t"></td>'; });
      s += '</tr></tfoot>';
    }
    var bang = App.$('#cc-bang');
    bang.innerHTML = s;
    C.o = [];
    App.$$('td.d[data-r]', bang).forEach(function (td) { var r = +td.dataset.r; (C.o[r] = C.o[r] || [])[+td.dataset.i] = td; });
    toChon();
    var u = App.$('#cc-undo'); if (u) u.disabled = !st.undo.length;
  }

  /* ---------- Chọn ô ---------- */
  function toChon() {
    App.$$('#cc-bang td.sel, #cc-bang td.act').forEach(function (td) { td.classList.remove('sel', 'act'); });
    if (!st.sel || !C.o) return;
    var s = st.sel;
    for (var r = s.r0; r <= s.r1; r++) for (var i = s.i0; i <= s.i1; i++) { var td = C.o[r] && C.o[r][i]; if (td) td.classList.add('sel'); }
    if (st.act && C.o[st.act.r] && C.o[st.act.r][st.act.i]) C.o[st.act.r][st.act.i].classList.add('act');
  }
  function vung(a, b) { return { r0: Math.min(a.r, b.r), r1: Math.max(a.r, b.r), i0: Math.min(a.i, b.i), i1: Math.max(a.i, b.i) }; }
  function chon(o, mo) {
    o = { r: Math.max(0, Math.min(C.rows.length - 1, o.r)), i: Math.max(0, Math.min(C.n - 1, o.i)) };
    st.act = o;
    if (!mo || !st.anc) st.anc = o;
    st.sel = vung(st.anc, o);
    toChon();
    var td = C.o[o.r] && C.o[o.r][o.i];
    if (td) td.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function chuotXuong(e) {
    var td = e.target.closest('td.d[data-r]');
    if (!td || e.button !== 0) return;
    if (oSua) xongSua(true);
    e.preventDefault();
    chon({ r: +td.dataset.r, i: +td.dataset.i }, e.shiftKey);
    st.keo = true;
  }
  function chuotQua(e) {
    if (!st.keo) return;
    var td = e.target.closest('td.d[data-r]');
    if (!td) return;
    st.act = { r: +td.dataset.r, i: +td.dataset.i };
    st.sel = vung(st.anc, st.act);
    toChon();
  }
  document.addEventListener('mouseup', function () { st.keo = false; });

  /* ---------- Ghi dữ liệu ---------- */
  function chuanKyHieu(s) {
    s = String(s == null ? '' : s).trim();
    if (!s) return '';
    var cd = App.db.caiDat;
    var up = s.toUpperCase();
    if (C.kh[up]) return C.kh[up].ma;
    var bd = App.boDau(s).toUpperCase().replace(/\s+/g, '');
    var ks = App.db.kyHieu;
    for (var i = 0; i < ks.length; i++) if (App.boDau(ks[i].ma).toUpperCase() === bd) return ks[i].ma;
    var diLam = cd.khDiLam || '+', nua = cd.khNuaNgay || '+/2';
    if (/^(X|V|1|\+|=)$/.test(bd) && C.kh[diLam.toUpperCase()]) return C.kh[diLam.toUpperCase()].ma;
    if (/^(X\/2|0[.,]5|1\/2|\/2|\+2|N2)$/.test(bd) && C.kh[nua.toUpperCase()]) return C.kh[nua.toUpperCase()].ma;
    return null;
  }
  function chuanGiaTri(raw) {
    if (st.che === 'kh') return chuanKyHieu(raw);
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return '';
    if (st.che === 'ot') { var k = TL.docKhoangOT(s); if (k === false) return null; if (k) return k.chuoi; }   // khung giờ làm thêm
    var n = App.docSo(s);
    if (isNaN(n) || n < 0) return null;
    return n || '';
  }
  /** ghi danh sách [{r, i, v}] – v đã chuẩn hoá ('' = xoá) */
  function ghi(ds, che) {
    if (C.khoa) { App.bao('Kỳ lương đã chốt, không sửa được.', 'loi'); return 0; }
    var kho = CHE[che || st.che].kho, doi = [];
    ds.forEach(function (z) {
      var nv = C.rows[z.r], x = C.ngay[z.i];
      if (!nv || !x || !TL.nvLamNgay(nv, x.y, x.m, x.d)) return;
      var T = TL.thang(App.db, x.y, x.m, true);
      var o = T[kho][nv.id] || (T[kho][nv.id] = {});
      var cu = o[x.d] == null ? '' : o[x.d];
      if (String(cu) === String(z.v)) return;
      doi.push({ id: nv.id, y: x.y, m: x.m, d: x.d, cu: cu, moi: z.v });
      if (z.v === '' || z.v == null) delete o[x.d]; else o[x.d] = z.v;
    });
    if (!doi.length) return 0;
    st.undo.push({ kho: kho, ds: doi });
    if (st.undo.length > 100) st.undo.shift();
    App.luu();
    veBang();
    return doi.length;
  }
  function ganChon(v) {
    if (!st.sel) { App.bao('Hãy chọn ô cần chấm trước (bấm hoặc kéo chuột trên lưới).'); return; }
    var ds = [], s = st.sel;
    for (var r = s.r0; r <= s.r1; r++) for (var i = s.i0; i <= s.i1; i++) ds.push({ r: r, i: i, v: v });
    ghi(ds);
  }
  function hoanTac() {
    var u = st.undo.pop();
    if (!u) return;
    u.ds.forEach(function (x) {
      var T = TL.thang(App.db, x.y, x.m, true);
      var o = T[u.kho][x.id] || (T[u.kho][x.id] = {});
      if (x.cu === '' || x.cu == null) delete o[x.d]; else o[x.d] = x.cu;
    });
    App.luu(); veBang();
  }

  /* ---------- Sửa trực tiếp ---------- */
  function batDauSua(kyTu) {
    if (!st.act || C.khoa) return;
    var td = C.o[st.act.r] && C.o[st.act.r][st.act.i];
    if (!td || td.classList.contains('ngoai')) return;
    huySua();
    var rc = td.getBoundingClientRect();
    var i = document.createElement('input');
    i.className = 'o-sua';
    i.style.position = 'fixed';
    i.style.left = rc.left + 'px'; i.style.top = rc.top + 'px'; i.style.width = Math.max(rc.width, st.che === 'ot' ? 150 : 46) + 'px'; i.style.height = rc.height + 'px';
    if (st.che === 'ot') i.placeholder = '17:30-21:00 hoặc 2';
    var cu = giaTri(C.rows[st.act.r], st.act.i);
    i.value = kyTu !== '' ? kyTu : (cu == null ? '' : String(cu).replace('.', ','));
    document.body.appendChild(i);
    oSua = { el: i, r: st.act.r, i: st.act.i };
    i.focus();
    if (kyTu === '') i.select();
    i.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); xongSua(true, 1, 0); }
      else if (e.key === 'Tab') { e.preventDefault(); xongSua(true, 0, e.shiftKey ? -1 : 1); }
      else if (e.key === 'Escape') { e.preventDefault(); huySua(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); xongSua(true, e.key === 'ArrowDown' ? 1 : -1, 0); }
      e.stopPropagation();
    });
    i.addEventListener('blur', function () { if (oSua && oSua.el === i) xongSua(true); });
  }
  function huySua() { if (oSua) { var e = oSua.el; oSua = null; e.remove(); } }
  function xongSua(luu, dr, di) {
    if (!oSua) return;
    var x = oSua; oSua = null;
    var raw = x.el.value;
    x.el.remove();
    if (luu) {
      var v = chuanGiaTri(raw);
      if (v === null) App.bao(st.che === 'kh' ? 'Ký hiệu “' + raw + '” chưa có trong danh mục (xem Danh mục → Ký hiệu chấm công).' :
        st.che === 'ot' ? 'Khung giờ không hợp lệ: “' + raw + '”. Viết dạng 17:30-21:00 (nhiều khung cách nhau dấu phẩy, không chồng nhau) hoặc số giờ.' : 'Giá trị không hợp lệ: ' + raw, 'loi');
      else ghi([{ r: x.r, i: x.i, v: v }]);
    }
    if (dr || di) chon({ r: x.r + (dr || 0), i: x.i + (di || 0) });
  }

  /* ---------- Bàn phím, sao chép, dán ---------- */
  function dangHoatDong() {
    return App.trangHienTai === 'chamcong' && C && !App.$('.mo-nen') && !oSua;
  }
  document.addEventListener('keydown', function (e) {
    if (!dangHoatDong() || !st.act) return;
    var tg = e.target;
    if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'SELECT' || tg.tagName === 'TEXTAREA')) return;
    var k = e.key, a = st.act;
    if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'Z')) { e.preventDefault(); hoanTac(); return; }
    if ((e.ctrlKey || e.metaKey) && (k === 'a' || k === 'A')) { e.preventDefault(); st.anc = { r: 0, i: 0 }; st.act = { r: C.rows.length - 1, i: C.n - 1 }; st.sel = vung(st.anc, st.act); toChon(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var mv = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0], Tab: [0, e.shiftKey ? -1 : 1] }[k];
    if (mv) { e.preventDefault(); chon({ r: a.r + mv[0], i: a.i + mv[1] }, e.shiftKey && k !== 'Tab'); return; }
    if (k === 'Home') { e.preventDefault(); chon({ r: a.r, i: 0 }, e.shiftKey); return; }
    if (k === 'End') { e.preventDefault(); chon({ r: a.r, i: C.n - 1 }, e.shiftKey); return; }
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); ganChon(''); return; }
    if (k === 'Enter' || k === 'F2') { e.preventDefault(); batDauSua(''); return; }
    if (k.length === 1 && /\S/.test(k)) {
      e.preventDefault();
      // chọn nhiều ô + gõ 1 phím trùng ký hiệu => gán luôn cho cả vùng
      if (st.sel && (st.sel.r0 !== st.sel.r1 || st.sel.i0 !== st.sel.i1)) {
        var v = chuanGiaTri(k);
        if (v !== null && st.che === 'kh') { ganChon(v); return; }
      }
      batDauSua(k);
    }
  });
  document.addEventListener('copy', function (e) {
    if (!dangHoatDong() || !st.sel) return;
    var tg = e.target; if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA')) return;
    var s = st.sel, lines = [];
    for (var r = s.r0; r <= s.r1; r++) {
      var l = [];
      for (var i = s.i0; i <= s.i1; i++) { var v = giaTri(C.rows[r], i); l.push(v == null ? '' : st.che === 'kh' ? v : String(v).replace('.', ',')); }
      lines.push(l.join('\t'));
    }
    e.clipboardData.setData('text/plain', lines.join('\r\n'));
    e.preventDefault();
    App.bao('Đã sao chép ' + ((s.r1 - s.r0 + 1) * (s.i1 - s.i0 + 1)) + ' ô');
  });
  document.addEventListener('paste', function (e) {
    if (!dangHoatDong() || !st.act) return;
    var tg = e.target; if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA')) return;
    var txt = (e.clipboardData || window.clipboardData).getData('text');
    if (!txt) return;
    e.preventDefault();
    var lines = txt.replace(/\r/g, '').replace(/\n$/, '').split('\n');
    var s0 = st.sel || { r0: st.act.r, i0: st.act.i };
    var ds = [], sai = 0;
    if (lines.length === 1 && lines[0].indexOf('\t') < 0 && st.sel) {
      var v1 = chuanGiaTri(lines[0]);
      if (v1 === null) { App.bao('Giá trị không hợp lệ: ' + lines[0], 'loi'); return; }
      ganChon(v1); return;
    }
    lines.forEach(function (l, a) {
      l.split('\t').forEach(function (c, b) {
        var r = s0.r0 + a, i = s0.i0 + b;
        if (r >= C.rows.length || i >= C.n) return;
        var v = chuanGiaTri(c);
        if (v === null) { sai++; return; }
        ds.push({ r: r, i: i, v: v });
      });
    });
    ghi(ds);
    if (sai) App.bao(sai + ' ô có giá trị không hợp lệ đã bị bỏ qua.', 'loi');
  });

  /* ---------- Chấm đủ công ---------- */
  function chamDu() {
    if (C.khoa) return;
    var cd = App.db.caiDat, kc = cd.khDiLam || '+', kn = cd.khNuaNgay || '+/2', kl = cd.khLe || 'L';
    var idxHn = -1;
    C.ngay.forEach(function (x, i) { if (x.iso === C.hn) idxHn = i; });
    App.hop({
      tieuDe: 'Chấm đủ công kỳ tháng ' + C.m + '/' + C.y, co: 'hep',
      than: '<form class="form" style="grid-template-columns:1fr" onsubmit="return false">' +
        '<label class="o">Nhân viên<select name="pv"><option value="all">Tất cả đang hiển thị (' + C.rows.length + ' người)</option>' +
        (st.sel ? '<option value="sel">Các dòng đang chọn (' + (st.sel.r1 - st.sel.r0 + 1) + ' người)</option>' : '') + '</select></label>' +
        '<label class="o">Đến ngày<select name="den"><option value="' + (C.n - 1) + '">Hết kỳ (' + TL.hienNgay(C.ngay[C.n - 1].iso) + ')</option>' +
        (idxHn >= 0 ? '<option value="' + idxHn + '" selected>Hôm nay (' + TL.hienNgay(C.hn) + ')</option>' : '') + '</select></label>' +
        '<label class="chk"><input type="checkbox" name="le" checked> Đánh <b>' + h(kl) + '</b> vào ngày lễ</label>' +
        '<label class="chk"><input type="checkbox" name="boGio" checked> Bỏ qua nhân viên lương giờ</label>' +
        '<label class="chk"><input type="checkbox" name="de"> Ghi đè các ô đã chấm</label>' +
        '<p class="mo nho" style="margin:0">Ngày làm việc (theo loại lao động của từng người) được chấm <b>' + h(kc) + '</b>' + (cd.nuaNgayT7 ? ', thứ bảy chấm <b>' + h(kn) + '</b>' : '') + '; ngày nghỉ hằng tuần để trống. Sau đó chỉ cần sửa những ngày nghỉ phép, SP, công tác…</p></form>',
      nut: [{ ten: 'Huỷ' }, {
        ten: 'Chấm công', loai: 'chinh', bam: function (el) {
          var f = App.$('form', el), pv = f.pv.value, den = +f.den.value, coLe = f.le.checked, de = f.de.checked, boGio = f.boGio.checked;
          var r0 = 0, r1 = C.rows.length - 1;
          if (pv === 'sel' && st.sel) { r0 = st.sel.r0; r1 = st.sel.r1; }
          var ds = [];
          for (var r = r0; r <= r1; r++) {
            var nv = C.rows[r];
            if (boGio && nv.hinhThuc === 'gio') continue;
            for (var i = 0; i <= den; i++) {
              var x = C.ngay[i];
              if (!TL.nvLamNgay(nv, x.y, x.m, x.d)) continue;
              var cu = TL.oNgay(App.db, 'cc', nv.id, x.y, x.m, x.d);
              if (cu && !de) continue;
              var l = TL.loaiNgay(App.db, x.y, x.m, x.d, C.le, nv), v;
              if (l === 'le') { if (!coLe) continue; v = kl; }
              else if (l === 'nghi') continue;
              else v = l === 'nua' ? kn : kc;
              ds.push({ r: r, i: i, v: v });
            }
          }
          var n = ghi(ds, 'kh');
          App.bao('Đã chấm ' + (n || 0) + ' ô.', 'tot');
          App.veLai();
        }
      }]
    });
  }

  /* ---------- Xuất Excel theo mẫu 01a-LĐTL ---------- */
  var K = function () { return App.KIEU; };
  function sheet01a(pb, rows) {
    var db = App.db, ct = db.congTy, y = C.y, m = C.m, ngay = C.ngay, n = ngay.length, k = K();
    var ctx = { kh: C.kh, le: C.le, loaiLe: C.loaiLe, heSoLe: C.heSoLe, ngay: ngay };
    var data = rows.map(function (nv) { return { nv: nv, th: TL.tongHopCong(db, y, m, nv, ctx) }; });
    var tongCot = [
      ['sp', '32', 'Số công hưởng lương sản phẩm'],
      ['congTG', '33', 'Lương', 'Số công hưởng lương thời gian'],
      ['ngayCom', '', 'Cơm', 'Số công hưởng lương thời gian'],
      ['ngung', '34', 'Số công nghỉ việc, ngừng việc hưởng 100% lương'],
      ['khongHL', '35', 'Số công nghỉ việc, ngừng việc không hưởng lương'],
      ['bhxh', '36', 'Số công hưởng BHXH']
    ];
    var nc = 3 + n + tongCot.length, cuoi = nc - 1, c0 = 3, c1 = 3 + n;
    var dong = [], gop = [], cao = {};
    var oo = function (v, s) { return { v: v, s: s }; };
    var vienTH = Object.assign({}, k.th, { nen: '#FFFFFF' });
    var thongTu = ct.thongTu === '200' ? 'Thông tư số 200/2014/TT-BTC ngày 22/12/2014' : 'Thông tư số 133/2016/TT-BTC ngày 26/8/2016';
    // Đầu trang
    var ph = Math.max(c0 + 8, cuoi - 12); // khối "Mẫu số" bên phải
    var r = [];
    r[0] = oo('Đơn vị: ' + (ct.ten || ''), { b: true, sz: 12 });
    r[ph] = oo('Mẫu số: 01a - LĐTL', { b: true, ngang: 'center' });
    dong.push(r);
    r = []; r[0] = oo('Bộ phận: ' + (pb ? pb.ten : 'Toàn công ty'), { b: true, sz: 12 });
    r[ph] = oo('(Ban hành theo ' + thongTu.replace(/ ngày .*/, ''), { i: true, ngang: 'center' });
    dong.push(r);
    r = []; r[ph] = oo(thongTu.replace(/^.* (ngày .*)$/, '$1') + ' của Bộ Tài chính)', { i: true, ngang: 'center' });
    dong.push(r);
    [0, 1, 2].forEach(function (ri) { gop.push(App.XL.oRef(ri, ph) + ':' + App.XL.oRef(ri, cuoi)); });
    gop.push('A1:' + App.XL.cotChu(ph - 1) + '1', 'A2:' + App.XL.cotChu(ph - 1) + '2');
    dong.push([oo('BẢNG CHẤM CÔNG', { b: true, sz: 16, ngang: 'center' })]); gop.push('A4:' + App.XL.cotChu(cuoi) + '4'); cao[3] = 24;
    dong.push([oo('Tháng ' + m + ' năm ' + y, { b: true, sz: 13, ngang: 'center' })]); gop.push('A5:' + App.XL.cotChu(cuoi) + '5');
    dong.push([oo('(Từ ngày ' + TL.hienNgay(ngay[0].iso) + ' đến ngày ' + TL.hienNgay(ngay[n - 1].iso) + ')', { i: true, ngang: 'center' })]); gop.push('A6:' + App.XL.cotChu(cuoi) + '6');
    dong.push([]);
    // Tiêu đề bảng: 5 dòng
    var h0 = dong.length, H = [[], [], [], [], []];
    ['SỐ TT', 'HỌ VÀ TÊN', 'Ngạch bậc lương hoặc chức vụ'].forEach(function (t, i) {
      H[0][i] = oo(t, k.th); for (var q = 1; q < 4; q++) H[q][i] = oo('', k.th);
      H[4][i] = oo('ABC'[i], Object.assign({}, k.th, { b: false, i: true }));
      gop.push(App.XL.oRef(h0, i) + ':' + App.XL.oRef(h0 + 3, i));
    });
    for (var i = c0; i < c1; i++) H[0][i] = oo(i === c0 ? 'NGÀY TRONG THÁNG' : '', k.th);
    gop.push(App.XL.oRef(h0, c0) + ':' + App.XL.oRef(h0, c1 - 1));
    var bt = bangThang(), pos = c0;
    bt.forEach(function (b, bi) {
      for (var q = 0; q < b.so; q++) H[1][pos + q] = oo(q === 0 ? b.ten : '', Object.assign({}, k.th, { nen: bi % 2 ? '#FFF2CC' : '#FCE4D6' }));
      if (b.so > 1) gop.push(App.XL.oRef(h0 + 1, pos) + ':' + App.XL.oRef(h0 + 1, pos + b.so - 1));
      pos += b.so;
    });
    ngay.forEach(function (x, i) {
      var l = C.loaiChung[i], nen = l === 'le' ? '#F8CBAD' : l === 'nghi' ? '#9DC3E6' : '#DDE7F3';
      H[2][c0 + i] = oo(TL.pad(x.d), Object.assign({}, k.th, { nen: nen }));
      H[3][c0 + i] = oo(TL.TEN_THU[TL.thuTrongTuan(x.y, x.m, x.d)], Object.assign({}, k.th, { b: false, nen: nen }));
      H[4][c0 + i] = oo(i + 1, Object.assign({}, k.th, { b: false, i: true, nen: '#FFFFFF' }));
    });
    for (i = c1; i <= cuoi; i++) H[0][i] = oo(i === c1 ? 'QUY RA CÔNG' : '', k.th);
    gop.push(App.XL.oRef(h0, c1) + ':' + App.XL.oRef(h0, cuoi));
    tongCot.forEach(function (t, j) {
      var c = c1 + j;
      if (t[3]) {
        H[1][c] = oo(t[1] ? t[3] : '', k.th); H[2][c] = oo('', k.th); H[3][c] = oo(t[2], k.th);
        if (t[1]) gop.push(App.XL.oRef(h0 + 1, c) + ':' + App.XL.oRef(h0 + 2, c + 1));
      } else {
        H[1][c] = oo(t[2], k.th); H[2][c] = oo('', k.th); H[3][c] = oo('', k.th);
        gop.push(App.XL.oRef(h0 + 1, c) + ':' + App.XL.oRef(h0 + 3, c));
      }
      H[4][c] = oo(t[1] || '', Object.assign({}, k.th, { b: false, i: true, nen: '#FFFFFF' }));
    });
    H.forEach(function (x) { dong.push(x); });
    cao[h0 + 1] = 20; cao[h0 + 2] = 20; cao[h0 + 3] = 70;
    // Thân bảng
    var sTen = { vien: true }, sGiua = { vien: true, ngang: 'center' }, sCong = k.cong;
    data.forEach(function (d, ri) {
      var row = [oo(ri + 1, sGiua), oo(d.nv.hoTen, sTen), oo(d.nv.chucVu || '', sGiua)];
      ngay.forEach(function (x, i) {
        var l = TL.loaiNgay(db, x.y, x.m, x.d, C.le, d.nv);
        var v = TL.oNgay(db, 'cc', d.nv.id, x.y, x.m, x.d);
        row[c0 + i] = oo(v == null ? '' : v, l === 'le' ? Object.assign({ nen: '#FBE0D2' }, sGiua) : l === 'nghi' ? Object.assign({ nen: '#BDD7EE' }, sGiua) : sGiua);
      });
      tongCot.forEach(function (t, j) { var v = giaTriTong(d.th, t[0]); row[c1 + j] = oo(v || '', sCong); });
      dong.push(row); cao[dong.length - 1] = 18;
    });
    var tr = [oo('', k.tong), oo('Cộng', k.tong), oo('', k.tong)];
    for (i = c0; i < c1; i++) tr[i] = oo('', k.tong);
    tongCot.forEach(function (t, j) { tr[c1 + j] = oo(Math.round(data.reduce(function (s, d) { return s + (giaTriTong(d.th, t[0]) || 0); }, 0) * 100) / 100, k.tongCong); });
    dong.push(tr);
    // Ký hiệu chấm công
    dong.push([]);
    dong.push([null, oo('Ký hiệu chấm công:', { b: true })]);
    var kyHieu = db.kyHieu.map(function (x) { return x.ten + ': ' + x.ma; });
    var buoc = Math.max(6, Math.floor(n / 3));
    for (var a = 0; a < kyHieu.length; a += 3) {
      var lr = [];
      kyHieu.slice(a, a + 3).forEach(function (t, q) { lr[q === 0 ? 1 : c0 + (q - 1) * buoc + 2] = oo('- ' + t, { sz: 10 }); });
      dong.push(lr);
    }
    // Nơi lập, chữ ký
    var hn = new Date();
    dong.push([]);
    var rn = []; rn[cuoi - 9] = oo((ct.diaDanh ? ct.diaDanh + ', ' : '') + 'ngày ' + hn.getDate() + ' tháng ' + (hn.getMonth() + 1) + ' năm ' + hn.getFullYear(), { i: true, ngang: 'center', mau: '#C00000' });
    dong.push(rn); gop.push(App.XL.oRef(dong.length - 1, cuoi - 9) + ':' + App.XL.oRef(dong.length - 1, cuoi));
    var vt = [1, c0 + Math.floor(n / 2) - 4, cuoi - 9], rk = [], rg = [], rt = [];
    [['Người chấm công', ct.nguoiChamCong], ['Phụ trách bộ phận', ct.phuTrachBP], ['Người duyệt', ct.nguoiDuyet || ct.giamDoc]].forEach(function (x, q) {
      rk[vt[q]] = oo(x[0], k.kyTen); rg[vt[q]] = oo('(Ký, họ tên)', k.kyGhi); rt[vt[q]] = oo(x[1] || '', k.kyTen);
    });
    var rkI = dong.length;
    dong.push(rk, rg, [], [], [], rt);
    [rkI, rkI + 1, rkI + 5].forEach(function (ri) {
      gop.push(App.XL.oRef(ri, vt[1]) + ':' + App.XL.oRef(ri, vt[1] + 8));
      gop.push(App.XL.oRef(ri, vt[2]) + ':' + App.XL.oRef(ri, cuoi));
    });
    var cot = [5, 24, 18]; for (i = 0; i < n; i++) cot.push(3.9); tongCot.forEach(function () { cot.push(7.5); });
    return { ten: pb ? pb.ten : 'Chấm công', dong: dong, gop: gop, cao: cao, cot: cot, ngang: true, co: { r: h0 + 5, c: 3 } };
  }

  function sheetPhu(che) {
    var db = App.db, y = C.y, m = C.m, ngay = C.ngay, kho = CHE[che].kho;
    var dvc = App.dvChamCong(), rows = TL.dsNhanVienKy(db, y, m).filter(function (nv) { var d = TL.donViTheoKy(db, nv, y, m).phongBan; return (!st.pb || d === st.pb) && (!dvc || dvc.indexOf(d) >= 0); });
    var ctx = { kh: C.kh, le: C.le, loaiLe: C.loaiLe, heSoLe: C.heSoLe, ngay: ngay };
    var data = rows.map(function (nv) { return { nv: nv, th: TL.tongHopCong(db, y, m, nv, ctx) }; });
    var cot = [
      { t: 'STT', w: 5, stt: true, kieu: 'giua' },
      { t: 'Mã NV', w: 8, f: function (x) { return x.nv.ma; } },
      { t: 'Họ và tên', w: 22, f: function (x) { return x.nv.hoTen; } },
      { t: 'Chức vụ', w: 14, f: function (x) { return x.nv.chucVu || ''; }, khongTong: true }
    ];
    ngay.forEach(function (x, i) {
      cot.push({
        t: TL.pad(x.d) + '\n' + TL.TEN_THU[TL.thuTrongTuan(x.y, x.m, x.d)], w: 4.3, nhom: 'Tháng ' + TL.pad(x.m) + '/' + x.y, kieu: 'cong',
        nen: C.loaiChung[i] === 'le' ? '#FDE2E2' : C.loaiChung[i] === 'nghi' ? '#DDEBF7' : null,
        f: function (r) { if (r._kieu === 'tong') return r['d' + i] || ''; var v = TL.oNgay(db, kho, r.nv.id, x.y, x.m, x.d); return v == null ? '' : che === 'ot' ? (TL.gioOT(v, db.caiDat).gio || '') : v; }
      });
    });
    var tong = cotTong(che);
    tong.forEach(function (t) { cot.push({ t: t[1], w: 8, nhom: che === 'ot' ? 'Giờ làm thêm' : 'Đi muộn / về sớm', kieu: 'cong', f: function (x) { return x._kieu === 'tong' ? x[t[0]] : (x.th[t[0]] || ''); } }); });
    var tongRow = { _nhan: 'Tổng cộng', _kieu: 'tong' };
    tong.forEach(function (t) { tongRow[t[0]] = Math.round(data.reduce(function (s, x) { return s + (x.th[t[0]] || 0); }, 0) * 100) / 100; });
    var soO = function (v) { return che === 'ot' ? TL.gioOT(v, db.caiDat).gio : +v || 0; };
    ngay.forEach(function (x, i) { tongRow['d' + i] = Math.round(data.reduce(function (s, r) { return s + soO(TL.oNgay(db, kho, r.nv.id, x.y, x.m, x.d)); }, 0) * 100) / 100 || ''; });
    return App.sheetBang({
      ten: che === 'ot' ? 'Làm thêm giờ' : 'Đi muộn',
      tieuDe: che === 'ot' ? 'BẢNG CHẤM CÔNG LÀM THÊM GIỜ' : 'BẢNG THEO DÕI ĐI MUỘN / VỀ SỚM',
      phuDe: 'Tháng ' + m + ' năm ' + y + ' (từ ' + TL.hienNgay(ngay[0].iso) + ' đến ' + TL.hienNgay(ngay[ngay.length - 1].iso) + ')',
      cot: cot, dong: data, tong: tongRow, cotNhanTong: 2, coCot: 3
    });
  }

  /** Bảng kê chi tiết làm thêm: mỗi lần làm thêm 1 dòng (ngày, khung giờ, giờ ban ngày / ban đêm, hệ số) – để duyệt, ký xác nhận */
  function sheetChiTietOT() {
    var db = App.db, cd = db.caiDat, hs = cd.heSoOT || {}, hsd = TL.heSoOTDem(cd), ngay = C.ngay, y = C.y, m = C.m;
    var dvc = App.dvChamCong(), ds = [], tong = { _nhan: 'Tổng cộng', gio: 0, ngayG: 0, dem: 0 };
    var TEN = { thuong: 'Ngày thường', nghi: 'Nghỉ hằng tuần', le: 'Lễ, Tết' };
    TL.dsNhanVienKy(db, y, m).forEach(function (nv) {
      var d = TL.donViTheoKy(db, nv, y, m).phongBan;
      if ((st.pb && d !== st.pb) || (dvc && dvc.indexOf(d) < 0)) return;
      if (st.ld && (nv.loaiLD || '') !== (st.ld === '-' ? '' : st.ld)) return;
      ngay.forEach(function (x) {
        var v = TL.oNgay(db, 'ot', nv.id, x.y, x.m, x.d), g = TL.gioOT(v, cd);
        if (!g.gio) return;
        var ln = TL.loaiNgay(db, x.y, x.m, x.d, C.le, nv), loai = ln === 'le' ? 'le' : ln === 'nghi' ? 'nghi' : 'thuong';
        ds.push({ ma: nv.ma, hoTen: nv.hoTen, ngay: TL.hienNgay(x.iso), thu: TL.TEN_THU[TL.thuTrongTuan(x.y, x.m, x.d)], loai: TEN[loai],
          khung: g.khung ? g.khung.replace(/,/g, ', ') : '(nhập số giờ)', gio: g.gio, ngayG: g.ngay, dem: g.dem,
          hsNgay: g.ngay ? (+hs[loai] || { thuong: 150, nghi: 200, le: 300 }[loai]) + '%' : '',
          hsDem: g.dem ? hsd[loai] + '%' : '' });
        tong.gio += g.gio; tong.ngayG += g.ngay; tong.dem += g.dem;
      });
    });
    if (!ds.length) return null;
    ['gio', 'ngayG', 'dem'].forEach(function (k) { tong[k] = Math.round(tong[k] * 100) / 100; });
    return App.sheetBang({
      ten: 'Chi tiết làm thêm', tieuDe: 'BẢNG KÊ CHI TIẾT LÀM THÊM GIỜ',
      phuDe: 'Tháng ' + m + ' năm ' + y + ' (từ ' + TL.hienNgay(ngay[0].iso) + ' đến ' + TL.hienNgay(ngay[ngay.length - 1].iso) + ')' + (st.pb ? ' – Bộ phận: ' + TL.tenPhongBan(db, st.pb) : ''),
      cot: [
        { t: 'STT', w: 5, stt: true, kieu: 'giua' }, { t: 'Mã NV', w: 8, k: 'ma' }, { t: 'Họ và tên', w: 22, k: 'hoTen' },
        { t: 'Ngày', w: 11, k: 'ngay', kieu: 'giua' }, { t: 'Thứ', w: 6, k: 'thu', kieu: 'giua' }, { t: 'Loại ngày', w: 14, k: 'loai' },
        { t: 'Khung giờ làm thêm', w: 26, k: 'khung' }, { t: 'Tổng số giờ', w: 8, k: 'gio', kieu: 'cong' },
        { t: 'Số giờ', nhom: 'Ban ngày', w: 8, k: 'ngayG', kieu: 'cong' }, { t: 'Hệ số', nhom: 'Ban ngày', w: 8, k: 'hsNgay', kieu: 'giua' },
        { t: 'Số giờ', nhom: 'Ban đêm (' + TL.hhmm(TL.cauHinhDem(cd).tu) + '–' + TL.hhmm(TL.cauHinhDem(cd).den) + ')', w: 8, k: 'dem', kieu: 'cong' },
        { t: 'Hệ số', nhom: 'Ban đêm (' + TL.hhmm(TL.cauHinhDem(cd).tu) + '–' + TL.hhmm(TL.cauHinhDem(cd).den) + ')', w: 8, k: 'hsDem', kieu: 'giua' },
        { t: 'Người làm thêm ký', w: 14, khongTong: true, f: function () { return ''; } }
      ],
      dong: ds, tong: tong, cotNhanTong: 2, coCot: 3
    });
  }

  function xuatExcel() {
    var db = App.db, shs = [];
    var all = TL.dsNhanVienKy(db, C.y, C.m).filter(function (nv) { return !st.ld || (nv.loaiLD || '') === (st.ld === '-' ? '' : st.ld); });
    var dvk = {}; all.forEach(function (nv) { dvk[nv.id] = TL.donViTheoKy(db, nv, C.y, C.m).phongBan; });
    var dvc = App.dvChamCong();
    var pbs = st.pb ? db.phongBan.filter(function (p) { return p.ma === st.pb; }) : db.phongBan.filter(function (p) { return !dvc || dvc.indexOf(p.ma) >= 0; });
    pbs.forEach(function (p) {
      var rows = all.filter(function (nv) { return dvk[nv.id] === p.ma; });
      if (rows.length) shs.push(sheet01a(p, rows));
    });
    var khongPB = all.filter(function (nv) { return !db.phongBan.some(function (p) { return p.ma === dvk[nv.id]; }); });
    if (!st.pb && !dvc && khongPB.length) shs.push(sheet01a({ ten: 'Chưa phân phòng, đội' }, khongPB));
    if (!shs.length) { App.bao('Không có nhân viên để xuất.', 'loi'); return; }
    shs.push(sheetPhu('ot'));
    var ctOT = sheetChiTietOT(); if (ctOT) shs.push(ctOT);
    shs.push(sheetPhu('muon'));
    App.xuatExcel('Bang_cham_cong_T' + TL.pad(C.m) + '_' + C.y, shs);
  }

  App.trang.chamcong = { ve: ve, roi: function () { huySua(); } };
})();
