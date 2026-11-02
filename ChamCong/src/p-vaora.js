/* Trang Giờ vào / ra: nhập file từ máy chấm công (vân tay, thẻ, khuôn mặt), tính công – muộn – làm thêm */
(function () {
  'use strict';
  var App = window.App, TL = window.TL, XL = window.XL, h = App.h;
  var st = { nv: '', loc: '', file: null };

  function khop(a) { return App.boDau(a).toLowerCase().replace(/[^a-z0-9]/g, ''); }

  /* ---------- Đọc ngày giờ ---------- */
  function docThoiDiem(v) { // -> {ngay:'yyyy-mm-dd'|'', gio:[phút,...]}
    var kq = { ngay: '', gio: [] };
    if (v == null || v === '') return kq;
    if (typeof v === 'number') {
      if (v >= 1) kq.ngay = App.chuanNgay(v);
      var p = Math.round((v - Math.floor(v)) * 1440);
      if (p > 0 || v < 1) kq.gio.push(p % 1440);
      return kq;
    }
    var s = String(v).trim(), m;
    if ((m = s.match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) kq.ngay = TL.iso(+m[1], +m[2], +m[3]);
    else if ((m = s.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/))) { var y = +m[3]; if (y < 100) y += 2000; kq.ngay = TL.iso(y, +m[2], +m[1]); }
    else if (/^\d{5}(\.\d+)?$/.test(s)) return docThoiDiem(+s);
    var re = /(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|SA|CH)?/gi, g;
    while ((g = re.exec(s))) {
      var hh = +g[1], mm = +g[2], ap = (g[3] || '').toUpperCase();
      if ((ap === 'PM' || ap === 'CH') && hh < 12) hh += 12;
      if ((ap === 'AM' || ap === 'SA') && hh === 12) hh = 0;
      if (hh < 24 && mm < 60) kq.gio.push(hh * 60 + mm);
    }
    if (!kq.gio.length && /^0?\.\d+$/.test(s)) kq.gio.push(Math.round(+s * 1440));
    return kq;
  }

  function ve(noi) {
    var db = App.db, y = App.ky.y, m = App.ky.m, cd = db.caiDat;
    var dsNV = TL.dsNhanVienKy(db, y, m), ngayK = TL.ngayKy(db, y, m);
    var coDL = dsNV.some(function (nv) { return ngayK.some(function (n) { return TL.oNgay(db, 'vr', nv.id, n.y, n.m, n.d); }); });
    noi.innerHTML =
      '<div class="cot-2-1">' +
      '<div class="the"><h3>Nhập dữ liệu từ máy chấm công</h3>' +
      '<p class="mo" style="margin-top:0">Xuất dữ liệu từ phần mềm máy chấm công (vân tay, thẻ từ, khuôn mặt…) ra file <b>.xlsx</b>, <b>.csv</b> hoặc <b>.txt</b>. ' +
      'Chấp nhận cả 2 dạng: <b>mỗi dòng 1 lần chấm</b> (mã + ngày giờ) hoặc <b>mỗi dòng 1 ngày</b> (mã + ngày + giờ vào + giờ ra). ' +
      'Nhân viên được ghép theo <b>Mã chấm công</b> (hoặc Mã NV) khai báo ở trang Nhân viên.</p>' +
      '<div class="hang"><input type="file" id="vr-file" accept=".xlsx,.csv,.txt,.dat,.tsv"><button class="nut" id="vr-mau">' + App.icon('tai') + 'Tải file mẫu</button></div>' +
      '<div id="vr-ghep" style="margin-top:12px"></div></div>' +
      '<div class="the"><h3>Quy tắc tính</h3><ul class="ds-gon nho">' +
      '<li><span>Giờ làm việc</span><b>' + cd.gioVao + ' – ' + cd.gioRa + '</b></li>' +
      '<li><span>Nghỉ trưa</span><b>' + cd.nghiTruaTu + ' – ' + cd.nghiTruaDen + '</b></li>' +
      '<li><span>Cho phép đi muộn / về sớm</span><b>' + cd.phutChoPhep + ' phút</b></li>' +
      '<li><span>Đủ công (' + h(cd.khDiLam || '+') + ') khi làm từ</span><b>' + cd.nguongCaNgay + ' giờ</b></li>' +
      '<li><span>Nửa công (' + h(cd.khNuaNgay || '+/2') + ') khi làm từ</span><b>' + cd.nguongNuaNgay + ' giờ</b></li>' +
      '<li><span>Tính làm thêm khi ra muộn từ</span><b>' + cd.otToiThieuPhut + ' phút</b></li>' +
      '<li><span>Làm tròn giờ làm thêm</span><b>' + cd.otLamTronPhut + ' phút</b></li></ul>' +
      '<a class="nut nho" href="#caidat" style="margin-top:8px">Sửa quy tắc</a></div>' +
      '</div>' +
      '<div class="the"><h3>Dữ liệu vào / ra kỳ tháng ' + m + '/' + y + '<span class="phai">' + TL.hienNgay(ngayK[0].iso) + ' – ' + TL.hienNgay(ngayK[ngayK.length - 1].iso) + '</span></h3>' +
      '<div class="hang khong-in" style="margin-bottom:10px">' +
      '<select id="vr-nv"><option value="">Tất cả nhân viên</option>' + dsNV.map(function (nv) { return '<option value="' + nv.id + '"' + (st.nv === nv.id ? ' selected' : '') + '>' + h(nv.ma + ' – ' + nv.hoTen) + '</option>'; }).join('') + '</select>' +
      '<select id="vr-loc"><option value="">Mọi ngày</option><option value="vande"' + (st.loc === 'vande' ? ' selected' : '') + '>Chỉ ngày đi muộn / về sớm / thiếu chấm</option><option value="ot"' + (st.loc === 'ot' ? ' selected' : '') + '>Chỉ ngày có làm thêm</option></select>' +
      '<span class="gian"></span>' +
      '<button class="nut" id="vr-them"' + (App.thangKhoa() ? ' disabled' : '') + '>' + App.icon('them') + 'Thêm giờ thủ công</button>' +
      '<button class="nut nguy" id="vr-xoa"' + (coDL && !App.thangKhoa() ? '' : ' disabled') + '>' + App.icon('xoa') + 'Xoá dữ liệu tháng</button>' +
      '<button class="nut chinh" id="vr-apdung"' + (coDL && !App.thangKhoa() ? '' : ' disabled') + '>' + App.icon('chamcong') + 'Áp dụng vào bảng chấm công…</button>' +
      '</div><div class="cuon cao"><table class="bang" id="vr-bang"></table></div>' +
      '<p class="mo nho">Sửa trực tiếp giờ vào / ra trong bảng nếu nhân viên quên chấm. Cột “Đang chấm” là ký hiệu hiện có trên bảng chấm công.</p></div>';

    veBang();
    App.$('#vr-file').onchange = function () {
      var f = this.files[0]; if (!f) return;
      XL.docFile(f).then(function (sheets) { st.file = { ten: f.name, sheets: sheets }; veGhep(); }).catch(function (e) { App.bao(e.message, 'loi'); });
    };
    App.$('#vr-mau').onclick = taiMau;
    App.$('#vr-nv').onchange = function () { st.nv = this.value; veBang(); };
    App.$('#vr-loc').onchange = function () { st.loc = this.value; veBang(); };
    App.$('#vr-apdung').onclick = apDung;
    App.$('#vr-them').onclick = themThuCong;
    App.$('#vr-xoa').onclick = function () {
      App.xacNhan('Xoá toàn bộ giờ vào / ra đã nhập của kỳ tháng ' + m + '/' + y + '? (Bảng chấm công không bị ảnh hưởng.)', { nut: 'Xoá', nguy: true }).then(function (ok) {
        if (!ok) return;
        ngayK.forEach(function (n) { var T = App.db.thang[TL.khoaKy(n.y, n.m)]; if (T && T.vr) Object.keys(T.vr).forEach(function (id) { delete T.vr[id][n.d]; }); });
        App.luu(); App.veLai();
      });
    };
    if (st.file) veGhep();
  }

  function veBang() {
    var db = App.db, y = App.ky.y, m = App.ky.m, cd = db.caiDat;
    var le = TL.bangNgayLe(db), kh = TL.bangKyHieu(db), ngay = TL.ngayKy(db, y, m);
    var khoa = App.thangKhoa();
    var ds = [];
    TL.dsNhanVienKy(db, y, m).forEach(function (nv) {
      if (st.nv && nv.id !== st.nv) return;
      ngay.forEach(function (n) {
        var x = TL.oNgay(db, 'vr', nv.id, n.y, n.m, n.d);
        if (!x) return;
        var loai = TL.loaiNgay(db, n.y, n.m, n.d, le, nv);
        var kq = TL.tinhVaoRa(cd, loai, TL.phut(x.v), TL.phut(x.r));
        if (st.loc === 'vande' && !(kq.muon || kq.veSom || kq.ghiChu)) return;
        if (st.loc === 'ot' && !kq.ot) return;
        ds.push({ nv: nv, n: n, x: x, kq: kq, loai: loai, cc: TL.oNgay(db, 'cc', nv.id, n.y, n.m, n.d) || '' });
      });
    });
    var s = '<thead><tr><th>Ngày</th><th>Thứ</th><th>Mã NV</th><th style="min-width:160px">Họ và tên</th><th>Giờ vào</th><th>Giờ ra</th><th class="so">Giờ làm</th><th class="so">Đi muộn (phút)</th><th class="so">Về sớm (phút)</th><th class="so">Làm thêm (giờ)</th><th>Ký hiệu đề xuất</th><th>Đang chấm</th><th>Ghi chú</th></tr></thead><tbody>';
    if (!ds.length) s += '<tr><td colspan="13" class="trong">Chưa có dữ liệu vào / ra cho kỳ này' + (st.nv || st.loc ? ' (theo bộ lọc)' : '') + '. Hãy nhập file từ máy chấm công ở trên.</td></tr>';
    ds.forEach(function (r) {
      var lt = r.loai === 'le' ? ' <span class="the-tt do">Lễ</span>' : r.loai === 'nghi' ? ' <span class="the-tt">Nghỉ</span>' : '';
      var k = r.cc && kh[String(r.cc).toUpperCase()];
      s += '<tr data-id="' + r.nv.id + '" data-y="' + r.n.y + '" data-m="' + r.n.m + '" data-d="' + r.n.d + '"><td class="giua">' + TL.pad(r.n.d) + '/' + TL.pad(r.n.m) + '</td><td class="giua">' + TL.TEN_THU[TL.thuTrongTuan(r.n.y, r.n.m, r.n.d)] + lt + '</td>' +
        '<td>' + h(r.nv.ma) + '</td><td class="ten">' + h(r.nv.hoTen) + '</td>' +
        '<td><input type="time" class="o-gio" data-f="v" value="' + h(r.x.v || '') + '"' + (khoa ? ' disabled' : '') + '></td>' +
        '<td><input type="time" class="o-gio" data-f="r" value="' + h(r.x.r || '') + '"' + (khoa ? ' disabled' : '') + '></td>' +
        '<td class="so">' + App.soRong(r.kq.gioLam) + '</td><td class="so' + (r.kq.muon ? ' am' : '') + '">' + (r.kq.muon || '') + '</td><td class="so' + (r.kq.veSom ? ' am' : '') + '">' + (r.kq.veSom || '') + '</td>' +
        '<td class="so">' + App.soRong(r.kq.ot) + '</td><td class="giua"><b>' + h(r.kq.kyHieu) + '</b></td>' +
        '<td class="giua">' + (r.cc ? '<span class="the-tt" style="background:var(--k-' + (k ? k.nhom : 'khong') + ')">' + h(r.cc) + '</span>' : '') + '</td><td class="mo">' + h(r.kq.ghiChu) + '</td></tr>';
    });
    s += '</tbody>';
    var bang = App.$('#vr-bang');
    bang.innerHTML = s;
    bang.onchange = function (e) {
      var i = e.target.closest('.o-gio'); if (!i) return;
      var tr = i.closest('tr');
      var T2 = TL.thang(App.db, +tr.dataset.y, +tr.dataset.m, true);
      var o = (T2.vr[tr.dataset.id] = T2.vr[tr.dataset.id] || {});
      var x = o[tr.dataset.d] = o[tr.dataset.d] || { v: '', r: '' };
      x[i.dataset.f] = i.value;
      if (!x.v && !x.r) delete o[tr.dataset.d];
      App.luu(); veBang();
    };
  }

  /* ---------- Ghép cột file ---------- */
  function veGhep() {
    var el = App.$('#vr-ghep'); if (!el || !st.file) return;
    var sheets = st.file.sheets;
    var si = st.file.si || 0;
    var rows = sheets[si].dong;
    var maxC = rows.slice(0, 50).reduce(function (s, r) { return Math.max(s, (r || []).length); }, 0);
    var hdIdx = rows.findIndex(function (r) { return r && r.some(function (c) { return c != null && String(c).trim() !== ''; }); });
    var hd = rows[hdIdx] || [];
    var coTieuDe = hd.some(function (c) { return typeof c === 'string' && /[a-zA-ZÀ-ỹ]{2,}/.test(c) && !/^\d/.test(c); });
    function doan(re) { for (var i = 0; i < maxC; i++) if (coTieuDe && re.test(khop(hd[i] || ''))) return i; return -1; }
    var g = st.file.g || {
      ma: Math.max(0, doan(/^(ma|id|acno|no|userid|mancc|machamcong|manv|enno|maso|sothe|employeeid|personid)/)),
      ngay: doan(/(ngay|date|thoigian|time|datetime|checktime|giocham)/),
      g1: doan(/(giovao|vao|checkin|^in$|timein)/),
      g2: doan(/(giora|^ra$|checkout|^out$|timeout)/),
      tieuDe: coTieuDe
    };
    if (g.ngay < 0) g.ngay = Math.min(1, maxC - 1);
    if (g.g1 === g.ngay) g.g1 = -1;
    st.file.g = g;
    var opt = function (v, khong) {
      var s = khong ? '<option value="-1">(không có)</option>' : '';
      for (var i = 0; i < maxC; i++) s += '<option value="' + i + '"' + (v === i ? ' selected' : '') + '>Cột ' + XL.cotChu(i) + (coTieuDe && hd[i] != null ? ': ' + h(String(hd[i]).slice(0, 24)) : '') + '</option>';
      return s;
    };
    var xem = rows.slice(hdIdx, hdIdx + 7);
    el.innerHTML = '<div class="goi-y" style="margin-bottom:10px">File <b>' + h(st.file.ten) + '</b>: ' + rows.length + ' dòng. Kiểm tra các cột rồi bấm <b>Đọc dữ liệu</b>.</div>' +
      (sheets.length > 1 ? '<label class="o">Trang tính <select id="g-sheet">' + sheets.map(function (s, i) { return '<option value="' + i + '"' + (i === si ? ' selected' : '') + '>' + h(s.ten) + '</option>'; }).join('') + '</select></label>' : '') +
      '<div class="form ba" style="margin-bottom:10px">' +
      '<label class="o">Mã chấm công / Mã NV<select id="g-ma">' + opt(g.ma) + '</select></label>' +
      '<label class="o">Ngày (hoặc ngày giờ chấm)<select id="g-ngay">' + opt(g.ngay) + '</select></label>' +
      '<label class="o">Giờ vào / giờ chấm<select id="g-g1">' + opt(g.g1, true) + '</select></label>' +
      '<label class="o">Giờ ra<select id="g-g2">' + opt(g.g2, true) + '</select></label>' +
      '<label class="chk" style="align-self:end"><input type="checkbox" id="g-td"' + (g.tieuDe ? ' checked' : '') + '> Dòng đầu là tiêu đề</label>' +
      '</div><div class="cuon" style="max-height:200px"><table class="bang"><thead><tr>' +
      Array.from({ length: maxC }, function (_, i) { return '<th>' + XL.cotChu(i) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      xem.map(function (r) { return '<tr>' + Array.from({ length: maxC }, function (_, i) { return '<td>' + h(r && r[i] != null ? r[i] : '') + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></div><div class="hang" style="margin-top:10px"><span class="gian"></span><button class="nut" id="g-huy">Bỏ qua</button><button class="nut chinh" id="g-doc">Đọc dữ liệu</button></div>';
    var gs = App.$('#g-sheet'); if (gs) gs.onchange = function () { st.file.si = +this.value; st.file.g = null; veGhep(); };
    App.$('#g-huy').onclick = function () { st.file = null; el.innerHTML = ''; App.$('#vr-file').value = ''; };
    App.$('#g-doc').onclick = function () {
      g = { ma: +App.$('#g-ma').value, ngay: +App.$('#g-ngay').value, g1: +App.$('#g-g1').value, g2: +App.$('#g-g2').value, tieuDe: App.$('#g-td').checked };
      st.file.g = g;
      docDuLieu(rows.slice(hdIdx + (g.tieuDe ? 1 : 0)), g);
    };
  }

  function docDuLieu(rows, g) {
    var db = App.db, ghepMa = {};
    db.nhanVien.forEach(function (nv) { if (nv.ma) ghepMa['n:' + khop(nv.ma)] = nv; });
    db.nhanVien.forEach(function (nv) { if (nv.maChamCong) ghepMa['c:' + khop(nv.maChamCong)] = nv; });
    var nhom = {}, khongKhop = {}, loiNgay = 0, soDong = 0;
    rows.forEach(function (r) {
      if (!r) return;
      var ma = r[g.ma];
      if (ma == null || String(ma).trim() === '') return;
      soDong++;
      var k = khop(typeof ma === 'number' ? String(Math.round(ma)) : ma);
      var nv = ghepMa['c:' + k] || ghepMa['n:' + k] || ghepMa['c:' + k.replace(/^0+/, '')] || ghepMa['n:' + k.replace(/^0+/, '')];
      if (!nv) { khongKhop[String(ma)] = (khongKhop[String(ma)] || 0) + 1; return; }
      var t = docThoiDiem(r[g.ngay]);
      if (!t.ngay) { loiNgay++; return; }
      var gio = t.gio.slice();
      [g.g1, g.g2].forEach(function (c) { if (c >= 0) gio = gio.concat(docThoiDiem(r[c]).gio); });
      var key = nv.id + '|' + t.ngay;
      (nhom[key] = nhom[key] || { nv: nv, ngay: t.ngay, gio: [] }).gio = nhom[key].gio.concat(gio);
    });
    var demThang = {}, soNgay = 0, khoa = [];
    Object.keys(nhom).forEach(function (k) {
      var x = nhom[k], n = TL.docNgay(x.ngay);
      var T = TL.thang(db, n.y, n.m, true), kyN = TL.kyCuaNgay(db, n.y, n.m, n.d), TK = TL.thang(db, kyN.y, kyN.m);
      if (TK.khoa) { if (khoa.indexOf(kyN.m + '/' + kyN.y) < 0) khoa.push(kyN.m + '/' + kyN.y); return; }
      var gio = x.gio.filter(function (p) { return p != null; }).sort(function (a, b) { return a - b; });
      var vao = gio.length ? gio[0] : null, ra = gio.length > 1 && gio[gio.length - 1] - gio[0] > 1 ? gio[gio.length - 1] : null;
      (T.vr[x.nv.id] = T.vr[x.nv.id] || {})[n.d] = { v: vao == null ? '' : TL.hhmm(vao), r: ra == null ? '' : TL.hhmm(ra) };
      var kk = TL.kyCuaNgay(db, n.y, n.m, n.d), tk = kk.m + '/' + kk.y; demThang[tk] = (demThang[tk] || 0) + 1; soNgay++;
    });
    App.luu();
    var kk = Object.keys(khongKhop);
    var msg = '<p>Đã đọc <b>' + soDong + '</b> dòng → <b>' + soNgay + '</b> ngày công' +
      (Object.keys(demThang).length ? ' (' + Object.keys(demThang).map(function (t) { return 'kỳ tháng ' + t + ': ' + demThang[t]; }).join(', ') + ')' : '') + '.</p>' +
      (kk.length ? '<p style="color:var(--do)">' + kk.length + ' mã chấm công không khớp nhân viên nào: ' + kk.slice(0, 12).map(h).join(', ') + (kk.length > 12 ? '…' : '') + '. Khai báo “Mã chấm công” trong hồ sơ nhân viên rồi nhập lại.</p>' : '') +
      (loiNgay ? '<p style="color:var(--do)">' + loiNgay + ' dòng không đọc được ngày.</p>' : '') +
      (khoa.length ? '<p style="color:var(--cam)">Bỏ qua kỳ đã chốt lương: ' + khoa.join(', ') + '.</p>' : '') +
      '<p class="mo">Bước tiếp theo: xem lại bảng bên dưới rồi bấm <b>Áp dụng vào bảng chấm công</b>.</p>';
    st.file = null;
    var ks = Object.keys(demThang);
    if (ks.length === 1) { var p = ks[0].split('/'); if (+p[0] !== App.ky.m || +p[1] !== App.ky.y) { App.ky = { y: +p[1], m: +p[0] }; } }
    App.veLai();
    App.hop({ tieuDe: 'Kết quả nhập dữ liệu chấm công', than: msg, nut: [{ ten: 'Đóng', loai: 'chinh' }] });
  }

  /* ---------- Áp dụng vào bảng chấm công ---------- */
  function apDung() {
    var y = App.ky.y, m = App.ky.m;
    App.hop({
      tieuDe: 'Áp dụng giờ vào / ra vào bảng chấm công ' + m + '/' + y, co: 'hep',
      than: '<form class="form" style="grid-template-columns:1fr" onsubmit="return false">' +
        '<label class="chk"><input type="checkbox" name="kh" checked> Cập nhật ký hiệu công (' + h(App.db.caiDat.khDiLam || '+') + ', ' + h(App.db.caiDat.khNuaNgay || '+/2') + ')</label>' +
        '<label class="chk" style="margin-left:24px"><input type="checkbox" name="de"> Ghi đè ô đã chấm (P, CT, …)</label>' +
        '<label class="chk"><input type="checkbox" name="muon" checked> Cập nhật số phút đi muộn / về sớm</label>' +
        '<label class="chk"><input type="checkbox" name="ot" checked> Cập nhật giờ làm thêm</label>' +
        '<p class="mo nho" style="margin:0">Chỉ áp dụng cho những ngày có dữ liệu vào / ra' + (st.nv ? ' của nhân viên đang chọn' : '') + '.</p></form>',
      nut: [{ ten: 'Huỷ' }, {
        ten: 'Áp dụng', loai: 'chinh', bam: function (el) {
          var f = App.$('form', el), db = App.db, cd = db.caiDat;
          var le = TL.bangNgayLe(db), n = 0, ngayK = TL.ngayKy(db, y, m);
          TL.dsNhanVienKy(db, y, m).forEach(function (nv) {
            if (st.nv && nv.id !== st.nv) return;
            ngayK.forEach(function (nn) {
              var x = TL.oNgay(db, 'vr', nv.id, nn.y, nn.m, nn.d), d = nn.d;
              if (!x || !TL.nvLamNgay(nv, nn.y, nn.m, d)) return;
              var T = TL.thang(db, nn.y, nn.m, true);
              var kq = TL.tinhVaoRa(cd, TL.loaiNgay(db, nn.y, nn.m, d, le, nv), TL.phut(x.v), TL.phut(x.r));
              var cc = T.cc[nv.id] = T.cc[nv.id] || {}, mu = T.muon[nv.id] = T.muon[nv.id] || {}, ot = T.ot[nv.id] = T.ot[nv.id] || {};
              var laL = String(cc[d] || '').toUpperCase() === String(cd.khLe || 'L').toUpperCase();
              if (f.kh.checked && kq.kyHieu && (!cc[d] || f.de.checked || laL)) cc[d] = kq.kyHieu; // có chấm vân tay ngày lễ => đi làm (nhân công)
              if (f.muon.checked) { var p = kq.muon + kq.veSom; if (p) mu[d] = p; else delete mu[d]; }
              if (f.ot.checked) { if (kq.ot) ot[d] = kq.ot; else delete ot[d]; }
              n++;
            });
          });
          App.luu();
          App.bao('Đã áp dụng ' + n + ' ngày vào bảng chấm công.', 'tot');
          App.veLai();
        }
      }]
    });
  }

  function themThuCong() {
    var y = App.ky.y, m = App.ky.m, ds = TL.dsNhanVienKy(App.db, y, m);
    App.hop({
      tieuDe: 'Thêm giờ vào / ra', co: 'hep',
      than: '<form class="form" style="grid-template-columns:1fr 1fr" onsubmit="return false">' +
        '<label class="o ca">Nhân viên<select name="nv">' + ds.map(function (nv) { return '<option value="' + nv.id + '"' + (st.nv === nv.id ? ' selected' : '') + '>' + h(nv.ma + ' – ' + nv.hoTen) + '</option>'; }).join('') + '</select></label>' +
        '<label class="o ca">Ngày<input type="date" name="ngay" value="' + (App.homNay() >= TL.batDauKy(App.db, y, m) && App.homNay() <= TL.ketThucKy(App.db, y, m) ? App.homNay() : TL.batDauKy(App.db, y, m)) + '" min="' + TL.batDauKy(App.db, y, m) + '" max="' + TL.ketThucKy(App.db, y, m) + '"></label>' +
        '<label class="o">Giờ vào<input type="time" name="v" value="' + App.db.caiDat.gioVao + '"></label>' +
        '<label class="o">Giờ ra<input type="time" name="r" value="' + App.db.caiDat.gioRa + '"></label></form>',
      nut: [{ ten: 'Huỷ' }, {
        ten: 'Thêm', loai: 'chinh', bam: function (el) {
          var f = App.$('form', el), n = TL.docNgay(f.ngay.value);
          if (!n || f.ngay.value < TL.batDauKy(App.db, y, m) || f.ngay.value > TL.ketThucKy(App.db, y, m)) { App.bao('Ngày phải thuộc kỳ công tháng ' + m + '/' + y, 'loi'); return false; }
          var T = TL.thang(App.db, n.y, n.m, true);
          (T.vr[f.nv.value] = T.vr[f.nv.value] || {})[n.d] = { v: f.v.value, r: f.r.value };
          App.luu(); App.veLai();
        }
      }]
    });
  }

  function taiMau() {
    var th = App.KIEU.th, y = App.ky.y, m = App.ky.m;
    var dong = [[{ v: 'Mã chấm công', s: th }, { v: 'Họ tên', s: th }, { v: 'Ngày', s: th }, { v: 'Giờ vào', s: th }, { v: 'Giờ ra', s: th }]];
    App.db.nhanVien.slice(0, 3).forEach(function (nv) {
      for (var d = 1; d <= 3; d++) dong.push([nv.maChamCong || nv.ma, nv.hoTen, TL.pad(d) + '/' + TL.pad(m) + '/' + y, '07:5' + d, '17:0' + d]);
    });
    var dong2 = [[{ v: 'Mã chấm công', s: th }, { v: 'Thời gian chấm', s: th }]];
    App.db.nhanVien.slice(0, 2).forEach(function (nv) {
      dong2.push([nv.maChamCong || nv.ma, TL.pad(1) + '/' + TL.pad(m) + '/' + y + ' 07:55:12']);
      dong2.push([nv.maChamCong || nv.ma, TL.pad(1) + '/' + TL.pad(m) + '/' + y + ' 12:01:40']);
      dong2.push([nv.maChamCong || nv.ma, TL.pad(1) + '/' + TL.pad(m) + '/' + y + ' 17:06:03']);
    });
    App.xuatExcel('Mau_du_lieu_may_cham_cong', [
      { ten: 'Mỗi dòng 1 ngày', dong: dong, cot: [14, 22, 12, 10, 10], co: { r: 1 } },
      { ten: 'Mỗi dòng 1 lần chấm', dong: dong2, cot: [14, 22], co: { r: 1 } }
    ]);
  }

  App.trang.vaora = { ve: ve };
})();
