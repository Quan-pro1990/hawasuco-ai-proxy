/* Trang Hồ sơ nhân viên: lý lịch, công việc & lương, bảo hiểm – thuế – người phụ thuộc, hợp đồng,
   quá trình công tác (quyết định), nghỉ phép, lương các kỳ. */
(function () {
  'use strict';
  var App = window.App, TL = window.TL, h = App.h;

  /* ---------- Ô nhập dùng chung (cả trang hồ sơ và các hộp thoại nhân sự) ---------- */
  var F = App.F = {
    o: function (nhan, input, gc, cls) { return '<label class="o ' + (cls || '') + '">' + nhan + input + (gc ? '<span class="gc">' + gc + '</span>' : '') + '</label>'; },
    txt: function (ten, v, attr) { return '<input name="' + ten + '" value="' + h(v == null ? '' : v) + '" ' + (attr || '') + '>'; },
    ngay: function (ten, v) { return '<input type="date" name="' + ten + '" value="' + h(v || '') + '">'; },
    tien: function (ten, v, ph) { if (typeof v === 'string' && v.trim() !== '') v = App.docSo(v); return '<input name="' + ten + '" class="so tien" inputmode="numeric" value="' + (v || v === 0 && v !== '' ? App.tien(v) : '') + '"' + (ph ? ' placeholder="' + h(ph) + '"' : '') + '>'; },
    sel: function (ten, v, opts) {
      return '<select name="' + ten + '">' + opts.map(function (x) {
        var k = Array.isArray(x) ? x[0] : x, t = Array.isArray(x) ? x[1] : x;
        return '<option value="' + h(k) + '"' + (String(v == null ? '' : v) === String(k) ? ' selected' : '') + '>' + h(t) + '</option>';
      }).join('') + '</select>';
    },
    chk: function (ten, v, nhan) { return '<label class="chk"><input type="checkbox" name="' + ten + '"' + (v ? ' checked' : '') + '> ' + nhan + '</label>'; },
    vung: function (ten, v) { return '<textarea name="' + ten + '">' + h(v || '') + '</textarea>'; },
    cap: function (obj) { return Object.keys(obj).map(function (k) { return [k, obj[k]]; }); },
    /** Đọc giá trị các ô [name] trong el vào object */
    doc: function (el) {
      var v = {};
      App.$$('[name]', el).forEach(function (i) { v[i.name] = i.type === 'checkbox' ? i.checked : i.value; });
      return v;
    }
  };
  App.TRINH_DO_CM = ['', 'Lao động phổ thông', 'Sơ cấp nghề', 'Trung cấp', 'Cao đẳng', 'Đại học', 'Thạc sĩ', 'Tiến sĩ'];
  App.HON_NHAN = ['', 'Độc thân', 'Đã kết hôn', 'Ly hôn', 'Góa'];
  App.QUAN_HE = ['Con', 'Vợ', 'Chồng', 'Cha', 'Mẹ', 'Cha vợ / chồng', 'Mẹ vợ / chồng', 'Anh, chị, em', 'Khác'];

  var TABS = [
    ['canhan', 'Thông tin cá nhân'], ['congviec', 'Công việc & lương'], ['bhthue', 'Bảo hiểm, thuế & người phụ thuộc'],
    ['hopdong', 'Hợp đồng lao động'], ['scan', 'Hồ sơ scan'], ['quatrinh', 'Quá trình công tác'], ['phep', 'Nghỉ phép'], ['luong', 'Lương các kỳ']
  ];
  var st = { id: null, tab: 'canhan', d: null, ban: false };

  App.timNV = function (id) { return App.db.nhanVien.filter(function (x) { return x.id === id; })[0]; };
  App.moHoSo = function (id, tab) { st.tab = tab || st.tab || 'canhan'; location.hash = '#hoso?id=' + encodeURIComponent(id); };

  function nvMoi() {
    var db = App.db;
    return {
      id: App.uid(), ma: App.maMoi(), hoTen: '', gioiTinh: 'Nam', danToc: 'Kinh', tonGiao: 'Không', quocTich: 'Việt Nam',
      phongBan: db.phongBan[0] ? db.phongBan[0].ma : '', hinhThuc: 'thang', luongCB: 0, tiLeHuong: 100, loaiLD: (db.caiDat.loaiLD[0] || {}).ma || '',
      thamGiaBH: true, doanVien: false, cachTinhThue: 'luy_tien', soNPT: 0, trangThai: 'dang_lam', loaiHD: 'Không xác định thời hạn',
      ngayVao: App.homNay(), phuCap: {}, phepNam: '', hopDong: [], quyetDinh: [], nguoiPhuThuoc: [], moi: true
    };
  }

  function ve(noi) {
    var id = App.thamSo('id');
    if (id !== st.id) { st.id = id; st.ban = false; st.d = null; if (id === 'moi') st.tab = 'canhan'; }
    var nv = id === 'moi' ? null : App.timNV(id);
    if (!st.d) st.d = nv ? JSON.parse(JSON.stringify(nv)) : (id === 'moi' ? nvMoi() : null);
    if (!st.d) { noi.innerHTML = '<div class="the trong">Không tìm thấy nhân viên. <a href="#nhanvien">Về danh sách</a></div>'; return; }
    var d = st.d, moi = !!d.moi, db = App.db;
    if (moi && ['canhan', 'congviec', 'bhthue'].indexOf(st.tab) < 0) st.tab = 'canhan';
    App.$('#tieu-de').textContent = moi ? 'Thêm nhân viên' : 'Hồ sơ: ' + (nv ? nv.hoTen : '');

    var hn = App.homNay(), tt = d.trangThai || 'dang_lam';
    var tn = TL.thamNien(d.ngayVao, d.ngayNghi && d.ngayNghi < hn ? d.ngayNghi : hn);
    var pn = nv ? TL.phepNam(db, nv, App.ky.y) : null;
    var hdHL = App.hdHieuLuc(d);
    var nh = TL.ngayNghiHuu(d.gioiTinh, d.ngaySinh);
    var thongTin = [];
    if (d.ngayVao) thongTin.push('Thâm niên <b>' + (tn.nam ? tn.nam + ' năm ' : '') + tn.thang + ' tháng</b>');
    if (pn) thongTin.push('Phép năm ' + App.ky.y + ' còn <b>' + App.so(pn.conLai) + '</b> ngày');
    if (hdHL) thongTin.push('HĐ: ' + h(hdHL.loai) + (hdHL.denNgay ? ' đến ' + TL.hienNgay(hdHL.denNgay) + App.nhanHetHan(hdHL.denNgay) : ''));
    else if (!moi) thongTin.push('<span class="the-tt cam">Chưa có hợp đồng</span>');
    if (nh && tt !== 'nghi_viec') thongTin.push('Đủ tuổi nghỉ hưu: ' + TL.hienNgay(nh));

    noi.innerHTML =
      '<div class="the khong-in" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">' +
      '<div class="anh-nv">' + (d.anh ? '<img src="' + d.anh + '" alt="">' : '<span>' + h(chuDau(d.hoTen)) + '</span>') + '</div>' +
      '<div style="flex:1;min-width:240px"><div style="font-size:20px;font-weight:700">' + h(d.hoTen || 'Nhân viên mới') + ' <span class="the-tt ' + ({ dang_lam: 'xanh', thu_viec: 'cam', tam_nghi: 'lam', nghi_viec: '' }[tt]) + '">' + App.TRANG_THAI[tt] + (tt === 'thu_viec' && d.thuViec && d.thuViec.denNgay ? ' đến ' + TL.hienNgay(d.thuViec.denNgay) : '') + '</span></div>' +
      '<div class="mo">' + h(d.ma) + (d.chucVu ? ' · ' + h(d.chucVu) : '') + (d.phongBan ? ' · ' + h(TL.tenPhongBan(db, d.phongBan)) : '') + '</div>' +
      '<div class="nho" style="margin-top:4px;display:flex;gap:4px 18px;flex-wrap:wrap">' + thongTin.map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div></div>' +
      '<div class="hang"><a class="nut" href="#nhanvien">← Danh sách</a>' +
      (moi ? '' : '<button class="nut" id="hs-in">' + App.icon('in') + 'In sơ yếu lý lịch</button><button class="nut nguy" id="hs-xoa">' + App.icon('xoa') + '</button>') +
      '<button class="nut chinh" id="hs-luu">' + (moi ? 'Thêm nhân viên' : 'Lưu hồ sơ') + (st.ban ? ' ●' : '') + '</button></div>' +
      (st.ban ? '<div class="nho" style="width:100%;color:var(--cam)">● Có thay đổi chưa lưu</div>' : '') + '</div>' +
      '<div class="tabs khong-in">' + TABS.map(function (t) {
        var tat = moi && ['canhan', 'congviec', 'bhthue'].indexOf(t[0]) < 0;
        return '<button data-t="' + t[0] + '"' + (st.tab === t[0] ? ' class="chon"' : '') + (tat ? ' disabled title="Lưu hồ sơ trước"' : '') + '>' + t[1] + demTab(t[0], d) + '</button>';
      }).join('') + '</div><div id="hs-noi"></div>';

    App.$('.tabs', noi).onclick = function (e) { var b = e.target.closest('[data-t]'); if (b && !b.disabled) { st.tab = b.dataset.t; App.veLai(); } };
    App.$('#hs-luu').onclick = function () { luu(true); };
    var bi = App.$('#hs-in'); if (bi) bi.onclick = function () { App.inSoYeu(App.timNV(st.id)); };
    var bx = App.$('#hs-xoa'); if (bx) bx.onclick = function () { App.xoaNV(App.timNV(st.id), function () { st.d = null; location.hash = '#nhanvien'; }); };
    var el = App.$('#hs-noi');
    ({ canhan: tabCaNhan, congviec: tabCongViec, bhthue: tabBHThue, hopdong: tabHopDong, scan: tabScan, quatrinh: tabQuaTrinh, phep: tabPhep, luong: tabLuong })[st.tab](el, d, nv);
    if (['canhan', 'congviec', 'bhthue'].indexOf(st.tab) >= 0) ganForm(el);
  }

  function demTab(t, d) {
    var n = t === 'hopdong' ? (d.hopDong || []).length : t === 'scan' ? (d.hoSoTep || []).length : t === 'quatrinh' ? (d.quyetDinh || []).length : t === 'bhthue' ? (d.nguoiPhuThuoc || []).length : 0;
    return n ? ' <span class="the-tt">' + n + '</span>' : '';
  }
  function chuDau(t) { var p = String(t || '?').trim().split(/\s+/); return (p.length > 1 ? p[p.length - 2][0] : '') + (p[p.length - 1][0] || ''); }

  /** Gắn sự kiện: ô nhập trong tab ghi ngay vào bản nháp st.d */
  function ganForm(el) {
    App.$$('input.tien', el).forEach(App.ganOTien);
    el.addEventListener('change', function (e) {
      var i = e.target; if (!st.d || !i.name || i.name.indexOf('_') === 0) return;
      var v = i.type === 'checkbox' ? i.checked : i.value;
      if (i.name.indexOf('tv_') === 0) { danhDau(); suaThuViec(i.name.slice(3), v); return; }
      var vaoCu = st.d.ngayVao;
      if (i.name.indexOf('pc_') === 0) { st.d['_' + i.name] = v; }
      else st.d[i.name] = v;
      if (i.name === 'hinhThuc') { var dv = App.$('#dv-luong'); if (dv) dv.textContent = '(' + App.DV_LUONG[v] + ')'; }
      if (i.name === 'trangThai' && v === 'thu_viec') {
        if (!st.d.thuViec) st.d.thuViec = thuViecMoi(st.d);
        st.d.loaiHD = 'Thử việc'; st.d.ngayHetHD = st.d.thuViec.denNgay; st.ban = true; App.veLai(); return;
      }
      // đổi ngày vào làm thì ngày bắt đầu thử việc (đang trùng ngày vào làm) đổi theo
      if (i.name === 'ngayVao' && v && st.d.thuViec && (!st.d.thuViec.tuNgay || st.d.thuViec.tuNgay === vaoCu)) {
        suaThuViec('tuNgay', v); var o = App.$('input[name=tv_tuNgay]'); if (o) o.value = v;
      }
      if (i.name === 'luongCB' || i.name === 'hinhThuc') capNhatTV();
      if (i.name === 'ngayNghi' && v) { st.d.trangThai = 'nghi_viec'; }
      danhDau();
    });
  }
  function danhDau() { if (!st.ban) { st.ban = true; var b = App.$('#hs-luu'); if (b) b.textContent = (st.d.moi ? 'Thêm nhân viên' : 'Lưu hồ sơ') + ' ●'; } }

  /* ---------- Thử việc ---------- */
  function tvMacDinh() { return App.db.caiDat.thuViec || { soThang: 2, tiLe: 85, khongDongBH: true }; }
  function thuViecMoi(d) {
    // bắt đầu từ ngày vào làm (người mới); người đã vào làm lâu (quá 180 ngày) thì từ hôm nay
    var md = tvMacDinh(), hn = App.homNay(), n = TL.docNgay(hn), tu = d.ngayVao && d.ngayVao >= TL.congNgay(n.y, n.m, n.d, -180) ? d.ngayVao : hn, soThang = +md.soThang || 2;
    return { tuNgay: tu, soThang: soThang, denNgay: TL.denNgayThuViec(tu, soThang), tiLe: md.tiLe == null || md.tiLe === '' ? 85 : +md.tiLe };
  }
  function suaThuViec(k, v) {
    var t = st.d.thuViec;
    if (k === 'co') {
      if (v) { st.d.thuViec = t || thuViecMoi(st.d); if (!st.d.ngayHetHD || st.d.loaiHD === 'Thử việc') st.d.ngayHetHD = st.d.thuViec.denNgay; }
      else delete st.d.thuViec;
      App.veLai(); return;
    }
    if (!t) return;
    t[k] = v;
    if (k === 'tuNgay' || k === 'soThang') {
      t.denNgay = TL.denNgayThuViec(t.tuNgay, t.soThang) || t.denNgay;
      var o = App.$('input[name=tv_denNgay]'); if (o) o.value = t.denNgay || '';
    }
    if (k !== 'tiLe' && st.d.loaiHD === 'Thử việc') { st.d.ngayHetHD = t.denNgay; var o2 = App.$('input[name=ngayHetHD]'); if (o2) o2.value = t.denNgay || ''; }
    capNhatTV();
  }
  function capNhatTV() { var x = App.$('#tv-tinh'); if (x && st.d) x.innerHTML = moTaTV(st.d); }
  /** Dòng giải thích: lương thử việc = % × mức lương chính thức, số ngày thử việc */
  function moTaTV(d) {
    var t = d.thuViec; if (!t) return '';
    var md = tvMacDinh(), tiLe = t.tiLe === '' || t.tiLe == null ? +md.tiLe || 85 : +t.tiLe, cb = App.docSo(d.luongCB);
    var s = 'Lương thử việc = ' + App.so(tiLe) + '% × ' + App.tien(cb) + ' = <b>' + App.tien(Math.round(cb * tiLe / 100)) + '</b> ' + App.DV_LUONG[d.hinhThuc || 'thang'];
    if (tiLe < 85) s += ' <b style="color:var(--do)">– thấp hơn mức tối thiểu 85% lương của công việc (Điều 26 BLLĐ 2019)</b>';
    var n = t.tuNgay && t.denNgay ? Math.round((new Date(t.denNgay) - new Date(t.tuNgay)) / 864e5) + 1 : 0;
    if (t.tuNgay && t.denNgay) s += ' · thử việc ' + TL.hienNgay(t.tuNgay) + ' – ' + TL.hienNgay(t.denNgay) + ' (' + n + ' ngày)';
    if (n <= 0 && t.tuNgay && t.denNgay) s += ' <b style="color:var(--do)">– ngày kết thúc phải sau ngày bắt đầu</b>';
    if (n > 180) s += ' <b style="color:var(--do)">– quá 180 ngày (tối đa theo Điều 25 BLLĐ 2019)</b>';
    return s + '. Kỳ lương có cả ngày thử việc và ngày chính thức: tính theo số công của từng phần' + (md.khongDongBH !== false ? '; thời gian thử việc không đóng BH' : '') + '.';
  }

  /* ---------- Lưu ---------- */
  function luu(baoThanhCong, khongVeLai) {
    var d = st.d, db = App.db, moi = !!d.moi;
    var v = Object.assign({}, d);
    v.ma = String(v.ma || '').trim(); v.hoTen = String(v.hoTen || '').trim();
    if (!v.ma || !v.hoTen) { App.bao('Cần nhập mã nhân viên và họ tên (tab Thông tin cá nhân).', 'loi'); return false; }
    var trung = db.nhanVien.filter(function (x) { return x.id !== d.id && String(x.ma).toLowerCase() === v.ma.toLowerCase(); })[0];
    if (trung) { App.bao('Mã ' + v.ma + ' đã dùng cho ' + trung.hoTen + '.', 'loi'); return false; }
    v.maChamCong = String(v.maChamCong || '').trim();
    if (v.maChamCong) {
      var t2 = db.nhanVien.filter(function (x) { return x.id !== d.id && x.maChamCong && String(x.maChamCong) === v.maChamCong; })[0];
      if (t2) { App.bao('Mã chấm công ' + v.maChamCong + ' đã dùng cho ' + t2.hoTen + '.', 'loi'); return false; }
    }
    ['luongCB', 'luongBH', 'donGiaSP'].forEach(function (k) { v[k] = App.docSo(v[k]); });
    v.tamUngRieng = v.tamUngRieng == null || String(v.tamUngRieng).trim() === '' ? '' : App.docSo(v.tamUngRieng);
    v.soTK = String(v.soTK || '').replace(/\s+/g, '');
    v.congChuanRieng = v.congChuanRieng === '' || v.congChuanRieng == null ? '' : +v.congChuanRieng;
    v.tiLeHuong = v.tiLeHuong === '' || v.tiLeHuong == null ? 100 : +v.tiLeHuong;
    if (v.trangThai === 'thu_viec' && !v.thuViec && v.ngayVao) v.thuViec = thuViecMoi(v);
    if (v.thuViec) {
      var tv = v.thuViec, mdTV = tvMacDinh();
      if (!tv.tuNgay) { App.bao('Nhập ngày bắt đầu thử việc (tab Công việc & lương) hoặc bỏ chọn “Có thời gian thử việc”.', 'loi'); return false; }
      var soThang = Math.max(1, Math.round(+tv.soThang || +mdTV.soThang || 2)), den = tv.denNgay || TL.denNgayThuViec(tv.tuNgay, soThang);
      if (den < tv.tuNgay) { App.bao('Ngày kết thúc thử việc phải sau ngày bắt đầu.', 'loi'); return false; }
      var tiLe = tv.tiLe === '' || tv.tiLe == null ? +mdTV.tiLe || 85 : +tv.tiLe;
      if (!(tiLe > 0 && tiLe <= 100)) { App.bao('Lương thử việc nhập từ 1 đến 100 (% lương chính thức).', 'loi'); return false; }
      v.thuViec = { tuNgay: tv.tuNgay, soThang: soThang, denNgay: den, tiLe: tiLe };
    }
    v.soNPT = +v.soNPT || 0;
    ['phepNam', 'phepTon'].forEach(function (k) { v[k] = v[k] === '' || v[k] == null ? '' : +v[k]; });
    var pcv = Object.assign({}, d.phuCap || {});
    db.phuCap.forEach(function (p) {
      var k = '_pc_' + p.ma; if (!(k in v)) return;
      var raw = String(v[k] == null ? '' : v[k]).trim(), x = App.docSo(raw);
      if (raw !== '' && (x || p.mucChung)) pcv[p.ma] = x; else delete pcv[p.ma];
      delete v[k];
    });
    v.phuCap = pcv;
    if (v.trangThai === 'nghi_viec' && !v.ngayNghi) { App.bao('Nhân viên đã nghỉ việc: hãy nhập ngày nghỉ việc (tab Công việc & lương).', 'loi'); return false; }
    if (v.ngayNghi && v.trangThai !== 'nghi_viec') v.trangThai = 'nghi_viec';
    delete v.moi;
    if (moi) {
      db.nhanVien.push(v);
    } else {
      var nv = App.timNV(d.id);
      // giữ các danh sách đang được sửa trực tiếp (hợp đồng, quyết định, người phụ thuộc)
      ['hopDong', 'quyetDinh', 'nguoiPhuThuoc', 'hoSoTep'].forEach(function (k) { v[k] = nv[k]; });
      Object.keys(nv).forEach(function (k) { if (!(k in v)) delete nv[k]; });
      Object.assign(nv, v);
    }
    App.luu();
    st.ban = false; st.d = null;
    if (baoThanhCong) App.bao(moi ? 'Đã thêm ' + v.hoTen + '. Có thể nhập tiếp hợp đồng, quá trình công tác.' : 'Đã lưu hồ sơ ' + v.hoTen, 'tot');
    if (khongVeLai) return true;
    if (moi) { st.id = null; location.hash = '#hoso?id=' + v.id; } else App.veLai();
    return true;
  }

  /* ---------- Tab: thông tin cá nhân ---------- */
  function tabCaNhan(el, d) {
    el.innerHTML = '<div class="the"><div class="form ba">' +
      '<div class="ca hang" style="gap:14px"><div class="anh-nv lon">' + (d.anh ? '<img src="' + d.anh + '" alt="">' : '<span>' + h(chuDau(d.hoTen)) + '</span>') + '</div>' +
      '<div><label class="nut">' + App.icon('nhap') + 'Chọn ảnh…<input type="file" accept="image/*" id="hs-anh" class="an"></label> ' +
      (d.anh ? '<button class="nut nguy" id="hs-boanh">Xoá ảnh</button>' : '') + '<div class="mo nho" style="margin-top:6px">Ảnh 3×4, tự thu nhỏ khi lưu.</div></div></div>' +
      '<h4>Lý lịch</h4>' +
      F.o('Mã nhân viên *', F.txt('ma', d.ma)) + F.o('Họ và tên *', F.txt('hoTen', d.hoTen)) + F.o('Mã chấm công (ID máy chấm công)', F.txt('maChamCong', d.maChamCong)) +
      F.o('Giới tính', F.sel('gioiTinh', d.gioiTinh, ['Nam', 'Nữ'])) + F.o('Ngày sinh', F.ngay('ngaySinh', d.ngaySinh)) + F.o('Nơi sinh', F.txt('noiSinh', d.noiSinh)) +
      F.o('Quê quán', F.txt('queQuan', d.queQuan)) + F.o('Dân tộc', F.txt('danToc', d.danToc)) + F.o('Tôn giáo', F.txt('tonGiao', d.tonGiao)) +
      F.o('Quốc tịch', F.txt('quocTich', d.quocTich)) + F.o('Tình trạng hôn nhân', F.sel('honNhan', d.honNhan, App.HON_NHAN)) + '<span></span>' +
      F.o('Số CCCD', F.txt('cccd', d.cccd)) + F.o('Ngày cấp', F.ngay('ngayCapCCCD', d.ngayCapCCCD)) + F.o('Nơi cấp', F.txt('noiCapCCCD', d.noiCapCCCD, 'placeholder="Cục Cảnh sát QLHC về TTXH"')) +
      '<h4>Liên hệ</h4>' +
      F.o('Điện thoại', F.txt('sdt', d.sdt, 'type="tel"')) + F.o('Email', F.txt('email', d.email, 'type="email"')) + F.o('Người liên hệ khi cần (tên – SĐT)', F.txt('lienHeKhanCap', d.lienHeKhanCap)) +
      F.o('Địa chỉ thường trú', F.txt('thuongTru', d.thuongTru), '', 'ca') + F.o('Chỗ ở hiện nay', F.txt('diaChi', d.diaChi), '', 'ca') +
      '<h4>Trình độ</h4>' +
      F.o('Học vấn phổ thông', F.txt('trinhDoHV', d.trinhDoHV, 'placeholder="12/12"')) + F.o('Trình độ chuyên môn', F.sel('trinhDoCM', d.trinhDoCM, App.TRINH_DO_CM)) + F.o('Chuyên ngành', F.txt('chuyenNganh', d.chuyenNganh)) +
      F.o('Trường đào tạo', F.txt('truongDT', d.truongDT)) + F.o('Năm tốt nghiệp', F.txt('namTN', d.namTN, 'inputmode="numeric"')) + F.o('Ngoại ngữ', F.txt('ngoaiNgu', d.ngoaiNgu)) +
      F.o('Tin học', F.txt('tinHoc', d.tinHoc)) + F.o('Lý luận chính trị', F.sel('lyLuanCT', d.lyLuanCT, ['', 'Sơ cấp', 'Trung cấp', 'Cao cấp, cử nhân'])) + '<span></span>' +
      F.chk('dangVien', d.dangVien, 'Đảng viên') + F.o('Ngày vào Đảng', F.ngay('ngayVaoDang', d.ngayVaoDang)) +
      '</div></div>';
    App.$('#hs-anh', el).onchange = function () {
      var f = this.files[0]; if (!f) return;
      thuNhoAnh(f, function (url) { st.d.anh = url; st.ban = true; App.veLai(); });
    };
    var bo = App.$('#hs-boanh', el); if (bo) bo.onclick = function () { delete st.d.anh; st.ban = true; App.veLai(); };
  }

  function thuNhoAnh(file, xong) {
    var r = new FileReader();
    r.onload = function () {
      var img = new Image();
      img.onload = function () {
        var w = 240, hh = 320, c = document.createElement('canvas'); c.width = w; c.height = hh;
        var tl = Math.max(w / img.width, hh / img.height), sw = w / tl, sh = hh / tl;
        c.getContext('2d').drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, hh);
        xong(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = function () { App.bao('Không đọc được ảnh.', 'loi'); };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  }

  /* ---------- Tab: công việc & lương ---------- */
  function tabCongViec(el, d, nv) {
    var db = App.db, chucVu = {};
    var xlh = TL.xepLuongNV(db, d), ht0 = d.hinhThuc || 'thang';
    var theoBang = !!(xlh && xlh.tien && (xlh.apDung === 'cb' || xlh.apDung === 'ca_hai') && (ht0 === 'thang' || ht0 === 'khoan'));
    db.nhanVien.forEach(function (x) { if (x.chucVu) chucVu[x.chucVu] = 1; });
    var pc = db.phuCap.map(function (p) {
      var k = '_pc_' + p.ma, v = k in d ? d[k] : (d.phuCap || {})[p.ma], coRieng = v != null && v !== '';
      return F.o('Phụ cấp ' + h(p.ten.toLowerCase()) + (p.cachTinh === 'theo_ngay' ? ' (đ/ngày)' : ''),
        '<input name="pc_' + p.ma + '" class="so tien" inputmode="numeric" value="' + (coRieng ? App.tien(v) : '') + '"' + (p.mucChung ? ' placeholder="Mức chung ' + App.tien(p.mucChung) + '"' : '') + '>',
        (p.mucChung ? 'Để trống = mức chung; 0 = không hưởng. ' : '') + App.CACH_PC[p.cachTinh]);
    }).join('');
    var coQDLuong = (d.quyetDinh || []).some(function (q) { return q.loai === 'nang_luong'; });
    el.innerHTML = '<div class="the"><div class="form ba">' +
      '<h4>Công việc</h4>' +
      F.o('Phòng / đội', '<select name="phongBan"><option value="">(Chưa chọn)</option>' + App.optDonVi(d.phongBan) + '</select>', nv ? '<button type="button" class="nut nho" id="hs-chuyen">Điều chuyển (lập quyết định)…</button>' : 'Chọn trực tiếp = sửa sai dữ liệu') +
      F.o('Chức vụ / chức danh', F.txt('chucVu', d.chucVu, 'list="ds-chucvu"') + '<datalist id="ds-chucvu">' + Object.keys(chucVu).map(function (c) { return '<option value="' + h(c) + '">'; }).join('') + '</datalist>') +
      F.o('Loại lao động', F.sel('loaiLD', d.loaiLD || '', [['', '(Theo cài đặt chung)']].concat((db.caiDat.loaiLD || []).map(function (l) { return [l.ma, l.ten + ' – ' + App.moTaLoaiLD(l)]; })))) +
      F.o('Trạng thái', F.sel('trangThai', d.trangThai, F.cap(App.TRANG_THAI))) + F.o('Ngày vào làm', F.ngay('ngayVao', d.ngayVao)) +
      F.o('Ngày nghỉ việc', F.ngay('ngayNghi', d.ngayNghi), 'Ngày làm việc cuối cùng (hoặc dùng quyết định thôi việc)') +
      F.o('Loại hợp đồng hiện tại', F.sel('loaiHD', d.loaiHD, App.LOAI_HD), 'Tự cập nhật khi thêm hợp đồng mới') + F.o('Hết hạn HĐ / thử việc', F.ngay('ngayHetHD', d.ngayHetHD)) + '<span></span>' +
      '<h4>Thử việc</h4>' +
      '<div class="ca">' + F.chk('tv_co', !!d.thuViec, 'Có thời gian thử việc – hưởng lương thử việc (mặc định ' + App.so(+tvMacDinh().tiLe || 85) + '% lương chính thức)') + '</div>' +
      (d.thuViec ? F.o('Thử việc từ ngày', F.ngay('tv_tuNgay', d.thuViec.tuNgay)) +
        F.o('Số tháng thử việc', F.txt('tv_soThang', d.thuViec.soThang, 'type="number" min="1" max="6" step="1"'), 'Tự tính ngày kết thúc') +
        F.o('Thử việc đến ngày', F.ngay('tv_denNgay', d.thuViec.denNgay), 'Sửa được khi thử việc tính theo số ngày') +
        F.o('Lương thử việc (% lương chính thức)', F.txt('tv_tiLe', d.thuViec.tiLe, 'type="number" min="1" max="100" step="1"'), 'Ít nhất 85% (Điều 26 BLLĐ 2019)') +
        '<div class="ca mo nho" id="tv-tinh">' + moTaTV(d) + '</div>' : '') +
      '<h4>Lương</h4>' + oBacLuong(db, d) +
      F.o('Hình thức trả lương', F.sel('hinhThuc', d.hinhThuc || 'thang', F.cap(App.HINH_THUC))) +
      (theoBang ? F.o('Mức lương / HĐ <span id="dv-luong">(' + App.DV_LUONG[d.hinhThuc || 'thang'] + ')</span>',
          '<input name="luongCB" class="so tien" readonly value="' + App.tien(d.luongCB) + '" title="Theo thang bảng lương">',
          'Theo bảng lương (kỳ hiện hành). Mỗi kỳ tính theo mức áp dụng của kỳ đó – đổi bậc / mức ở trên hoặc trang Mức lương theo kỳ')
        : F.o('Mức lương / HĐ <span id="dv-luong">(' + App.DV_LUONG[d.hinhThuc || 'thang'] + ')</span>', F.tien('luongCB', d.luongCB),
        coQDLuong ? 'Mức hiện hành. Các kỳ trước ngày hiệu lực quyết định nâng lương vẫn tính lương cũ.' : 'Nâng lương có hiệu lực từ 1 ngày: dùng tab Quá trình công tác → Quyết định nâng lương')) +
      F.o('Tạm ứng kỳ I riêng (đ)', F.tien('tamUngRieng', d.tamUngRieng, 'Theo chức vụ: ' + App.tien(TL.tamUngTheoChucVu(db, d.chucVu))),
        'Để trống = theo chức vụ (trang Mức lương theo kỳ); 0 = không tạm ứng') +
      F.o('Tỷ lệ hưởng lương (%)', F.txt('tiLeHuong', d.tiLeHuong == null ? 100 : d.tiLeHuong, 'type="number" min="0" max="200" step="1"'), 'Thường 100%. Lương thử việc: mục Thử việc ở trên') +
      F.o('Công chuẩn riêng (ngày)', F.txt('congChuanRieng', d.congChuanRieng || '', 'type="number" min="0" step="0.5" placeholder="Theo loại lao động"')) +
      F.o('Sản phẩm chính (lương SP)', F.sel('maSP', d.maSP || '', [['', '(Sản phẩm đầu danh mục)']].concat((db.sanPham || []).map(function (p) { return [p.ma, p.ten + ' – ' + App.tien(p.donGia) + ' đ/' + (p.dvt || 'đv')]; })))) +
      F.o('Đơn giá SP riêng (đ)', F.tien('donGiaSP', d.donGiaSP, 'Theo danh mục')) +
      pc +
      '<h4>Tài khoản ngân hàng nhận lương</h4>' +
      F.o('Số tài khoản', F.txt('soTK', d.soTK, 'inputmode="numeric" autocomplete="off" placeholder="vd 103881293726"'), 'Dùng cho danh sách đề nghị chi lương kỳ I, kỳ II gửi ngân hàng') +
      F.o('Ngân hàng', F.txt('nganHang', d.nganHang, 'list="ds-nganhang" placeholder="vd Công thương (VietinBank)"') + '<datalist id="ds-nganhang">' +
        App.NGAN_HANG.map(function (n) { return '<option value="' + h(n) + '">'; }).join('') + '</datalist>') +
      F.o('Chi nhánh', F.txt('chiNhanhNH', d.chiNhanhNH, 'placeholder="vd Chi nhánh Hậu Giang"')) +
      '<h4>Phép năm</h4>' +
      F.o('Số ngày phép năm', F.txt('phepNam', d.phepNam, 'type="number" min="0" step="0.5" placeholder="' + db.caiDat.phepNam + '"'), 'Để trống = ' + db.caiDat.phepNam + ' ngày') +
      F.o('Phép tồn năm trước', F.txt('phepTon', d.phepTon, 'type="number" min="0" step="0.5"')) + '<span></span>' +
      F.o('Ghi chú', F.vung('ghiChu', d.ghiChu), '', 'ca') +
      '</div></div>';
    el.addEventListener('change', function (e) {
      var i = e.target; if (!i.dataset || !i.dataset.xl || !st.d) return;
      var cu = st.d.xepLuong, moi = App.docChonBac(cu, i.dataset.xl, i.value);
      if (moi === cu) { App.veLai(); return; }
      if (moi) st.d.xepLuong = moi; else delete st.d.xepLuong;
      st.d.luongCB = App.docSo(st.d.luongCB); st.d.luongBH = App.docSo(st.d.luongBH);
      var dd = TL.apXepLuong(db, st.d);
      st.ban = true; App.veLai();
      if (dd.luongCB || dd.luongBH) App.bao('Theo bảng lương: ' + [dd.luongCB ? 'mức lương ' + App.tien(dd.luongCB[1]) : '', dd.luongBH ? 'lương đóng BH ' + App.tien(dd.luongBH[1]) : ''].filter(Boolean).join(', ') + ' (bấm Lưu hồ sơ)');
    });
    var bc = App.$('#hs-chuyen', el);
    if (bc) bc.onclick = function (e) {
      e.preventDefault();
      if (st.ban && d.phongBan !== nv.phongBan) { App.bao('Phòng / đội đang được sửa trực tiếp – hãy lưu hồ sơ hoặc chọn lại như cũ trước khi điều chuyển.', 'loi'); return; }
      App.hopChuyenDonVi([nv], { sauKhiChuyen: function () { App.veLai(); } });
    };
  }

  /** Ô xếp bảng lương – chức danh – bậc trong tab Công việc & lương */
  function oBacLuong(db, d) {
    if (!db.thangLuong.length) return '<div class="o ca"><span class="gc">Chưa có thang, bảng lương (Danh mục → Thang, bảng lương). Khi có, chọn bậc ở đây để tự điền mức lương.</span></div>';
    var xl = TL.xepLuongNV(db, d), gc = '';
    if (xl) {
      gc = 'Mức theo bảng: <b>' + App.tien(xl.tien) + ' đ</b> – dùng cho ' + h(TL.AP_DUNG_BL[xl.apDung]).toLowerCase() + '. ' +
        (xl.bacCuoi ? 'Đã ở bậc cuối.' : xl.ngayNang ? 'Nâng bậc tiếp: <b>' + TL.hienNgay(xl.ngayNang) + '</b>' + (xl.keoDai ? ' (kéo dài ' + xl.keoDai + ' tháng do kỷ luật)' : '') + '.' : 'Nhập ngày hưởng bậc để tính hạn nâng bậc.') +
        ' Nâng bậc có hiệu lực từ một ngày: tab Quá trình công tác → Quyết định nâng lương.';
    } else gc = 'Chọn bảng lương để xếp bậc; mức theo bảng sẽ tự điền vào mức lương / lương đóng BH.';
    return '<div class="o ca">Thang, bảng lương · chức danh · bậc<div class="chon-bac">' + App.oChonBac(d.xepLuong) +
      '<label class="nho" style="display:flex;align-items:center;gap:6px">hưởng từ <input type="date" data-xl="ngayHuong" value="' + h(xl ? xl.ngayHuong : '') + '"' + (xl ? '' : ' disabled') + '></label></div>' +
      '<span class="gc">' + gc + '</span></div>';
  }

  /* ---------- Tab: bảo hiểm, thuế, người phụ thuộc ---------- */
  function tabBHThue(el, d, nv) {
    var ds = d.nguoiPhuThuoc || [];
    el.innerHTML = '<div class="the"><div class="form ba">' +
      '<h4>Bảo hiểm & công đoàn</h4>' +
      F.chk('thamGiaBH', d.thamGiaBH, 'Tham gia BHXH, BHYT, BHTN') + F.chk('doanVien', d.doanVien, 'Đoàn viên công đoàn (trừ đoàn phí)') + '<span></span>' +
      F.o('Lương đóng bảo hiểm', F.tien('luongBH', d.luongBH, 'Mức lương + phụ cấp đóng BH'), 'Để trống = mức lương + phụ cấp tính đóng BH') +
      F.o('Số sổ BHXH (mã số BHXH)', F.txt('soSoBHXH', d.soSoBHXH)) + F.o('Mã thẻ BHYT', F.txt('maTheBHYT', d.maTheBHYT)) +
      F.o('Nơi đăng ký KCB ban đầu', F.txt('noiKCB', d.noiKCB), '', 'ca') +
      '<h4>Thuế thu nhập cá nhân</h4>' +
      F.o('Cách tính thuế', F.sel('cachTinhThue', d.cachTinhThue || 'luy_tien', F.cap(App.CACH_THUE))) + F.o('Mã số thuế cá nhân', F.txt('mst', d.mst)) +
      (ds.length ? F.o('Số người phụ thuộc kỳ này', '<input readonly value="' + TL.soNPTKy(d, App.ky.y, App.ky.m) + '">', 'Tính theo danh sách bên dưới') : F.o('Số người phụ thuộc', F.txt('soNPT', d.soNPT || 0, 'type="number" min="0" step="1"'), 'Hoặc nhập danh sách bên dưới để tính theo từng tháng')) +
      '</div></div>' +
      '<div class="the"><h3>Người phụ thuộc (giảm trừ gia cảnh)<span class="phai">' + (nv ? '<button class="nut nho chinh" id="npt-them">' + App.icon('them') + 'Thêm người phụ thuộc</button>' : 'Lưu hồ sơ trước khi thêm') + '</span></h3>' +
      '<div class="cuon"><table class="bang"><thead><tr><th>Họ và tên</th><th>Quan hệ</th><th>Ngày sinh</th><th>MST / CCCD</th><th>Giảm trừ từ tháng</th><th>Đến tháng</th><th></th></tr></thead><tbody>' +
      (ds.length ? ds.map(function (p, i) {
        return '<tr data-i="' + i + '"><td class="ten">' + h(p.hoTen) + '</td><td>' + h(p.quanHe) + '</td><td class="giua">' + TL.hienNgay(p.ngaySinh) + '</td><td>' + h(p.maSo) + '</td>' +
          '<td class="giua">' + thangHien(p.tuThang) + '</td><td class="giua">' + (p.denThang ? thangHien(p.denThang) : '<span class="mo">—</span>') + '</td>' +
          '<td><button class="nut nho" data-a="sua">' + App.icon('sua') + '</button> <button class="nut nho nguy" data-a="xoa">' + App.icon('xoa') + '</button></td></tr>';
      }).join('') : '<tr><td colspan="7" class="trong">Chưa có người phụ thuộc.</td></tr>') + '</tbody></table></div></div>';
    if (!nv) return;
    el.onclick = function (e) {
      if (e.target.closest('#npt-them')) { formNPT(nv, null); return; }
      var b = e.target.closest('[data-a]'); if (!b) return;
      var i = +b.closest('tr').dataset.i;
      if (b.dataset.a === 'sua') formNPT(nv, i);
      else App.xacNhan('Xoá người phụ thuộc <b>' + h(nv.nguoiPhuThuoc[i].hoTen) + '</b>?', { nut: 'Xoá', nguy: true }).then(function (ok) {
        if (!ok) return; nv.nguoiPhuThuoc.splice(i, 1); dongBoDS(nv); App.luu(); App.veLai();
      });
    };
  }
  function thangHien(k) { return k ? k.slice(5, 7) + '/' + k.slice(0, 4) : ''; }
  function dongBoDS(nv) { if (st.d) { st.d.hoSoTep = JSON.parse(JSON.stringify(nv.hoSoTep || [])); st.d.nguoiPhuThuoc = JSON.parse(JSON.stringify(nv.nguoiPhuThuoc)); st.d.hopDong = JSON.parse(JSON.stringify(nv.hopDong)); st.d.quyetDinh = JSON.parse(JSON.stringify(nv.quyetDinh)); } }
  App.dongBoHoSo = function (nv) { if (st.d && st.d.id === nv.id) { var ban = st.ban; dongBoDS(nv); ['luongCB', 'luongBH', 'phongBan', 'chucVu', 'loaiHD', 'ngayHetHD', 'trangThai', 'ngayNghi', 'ngayVao', 'tiLeHuong', 'xepLuong'].forEach(function (k) { if (k in nv) st.d[k] = nv[k] && typeof nv[k] === 'object' ? JSON.parse(JSON.stringify(nv[k])) : nv[k]; else delete st.d[k]; }); st.ban = ban; } };

  function formNPT(nv, i) {
    var p = i == null ? { tuThang: TL.khoaKy(App.ky.y, App.ky.m) } : nv.nguoiPhuThuoc[i];
    App.hop({
      tieuDe: (i == null ? 'Thêm' : 'Sửa') + ' người phụ thuộc – ' + nv.hoTen, co: 'hep',
      than: '<form class="form" onsubmit="return false">' +
        F.o('Họ và tên *', F.txt('hoTen', p.hoTen), '', 'ca') + F.o('Quan hệ', F.sel('quanHe', p.quanHe || 'Con', App.QUAN_HE)) + F.o('Ngày sinh', F.ngay('ngaySinh', p.ngaySinh)) +
        F.o('MST / số CCCD / số định danh', F.txt('maSo', p.maSo), '', 'ca') +
        F.o('Giảm trừ từ tháng', '<input type="month" name="tuThang" value="' + h(p.tuThang || '') + '">') + F.o('Đến tháng (để trống = chưa kết thúc)', '<input type="month" name="denThang" value="' + h(p.denThang || '') + '">') +
        '</form>',
      nut: [{ ten: 'Huỷ' }, {
        ten: 'Lưu', loai: 'chinh', bam: function (el) {
          var v = F.doc(el);
          if (!v.hoTen.trim()) { App.bao('Nhập họ tên người phụ thuộc.', 'loi'); return false; }
          if (v.denThang && v.tuThang && v.denThang < v.tuThang) { App.bao('Tháng kết thúc phải sau tháng bắt đầu.', 'loi'); return false; }
          var x = Object.assign({}, p, v, { hoTen: v.hoTen.trim() });
          if (i == null) nv.nguoiPhuThuoc.push(x); else nv.nguoiPhuThuoc[i] = x;
          dongBoDS(nv); App.luu(); App.veLai();
        }
      }]
    });
  }

  /* ---------- Tab: hợp đồng ---------- */
  function tabHopDong(el, d, nv) {
    var ds = (nv.hopDong || []).map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) { return (b.x.tuNgay || '') < (a.x.tuNgay || '') ? -1 : 1; });
    el.innerHTML = '<div class="the"><h3>Hợp đồng lao động<span class="phai"><button class="nut nho chinh" id="hd-them">' + App.icon('them') + 'Thêm hợp đồng</button></span></h3>' +
      '<div class="cuon"><table class="bang"><thead><tr><th>Số HĐ</th><th>Loại hợp đồng</th><th>Ngày ký</th><th>Từ ngày</th><th>Đến ngày</th><th>Chức danh</th><th class="so">Mức lương</th><th>Tình trạng</th><th>Bản scan</th><th></th></tr></thead><tbody>' +
      (ds.length ? ds.map(function (o) {
        var x = o.x;
        return '<tr data-i="' + o.i + '"><td>' + h(x.so) + '</td><td>' + h(x.loai) + '</td><td class="giua">' + TL.hienNgay(x.ngayKy) + '</td><td class="giua">' + TL.hienNgay(x.tuNgay) + '</td>' +
          '<td class="giua">' + (x.denNgay ? TL.hienNgay(x.denNgay) : '<span class="mo">—</span>') + '</td><td>' + h(x.chucDanh) + '</td><td class="so">' + App.tienRong(x.luongCB) + '</td>' +
          '<td>' + App.ttHopDong(x) + '</td>' +
          '<td style="white-space:nowrap">' + (function () { var n = (nv.hoSoTep || []).filter(function (t) { return x.id && t.hopDongId === x.id; }).length;
            return (n ? '<span class="lk" data-a="xemscan" title="Xem trong tab Hồ sơ scan">' + n + ' tệp</span> ' : '<span class="the-tt cam">Chưa có</span> ') +
              '<button class="nut nho" data-a="scan" title="Tải bản scan hợp đồng này lên">' + App.icon('nhap') + '</button>'; })() + '</td>' +
          '<td style="white-space:nowrap"><button class="nut nho" data-a="in" title="In hợp đồng">' + App.icon('in') + '</button> <button class="nut nho" data-a="sua">' + App.icon('sua') + '</button> <button class="nut nho nguy" data-a="xoa">' + App.icon('xoa') + '</button></td></tr>';
      }).join('') : '<tr><td colspan="10" class="trong">Chưa có hợp đồng. Bấm “Thêm hợp đồng”.</td></tr>') + '</tbody></table></div></div>';
    el.onclick = function (e) {
      if (e.target.closest('#hd-them')) { App.formHopDong(nv, null); return; }
      var b = e.target.closest('[data-a]'); if (!b) return;
      var i = +b.closest('tr').dataset.i, x = nv.hopDong[i];
      if (b.dataset.a === 'scan') { if (!x.id) x.id = App.uid(); App.chonTepHoSo(nv, { loai: 'hop_dong', hopDongId: x.id }); return; }
      if (b.dataset.a === 'xemscan') { st.tab = 'scan'; App.veLai(); return; }
      if (b.dataset.a === 'in') App.inHopDong(nv, x);
      else if (b.dataset.a === 'sua') App.formHopDong(nv, i);
      else App.xacNhan('Xoá hợp đồng số <b>' + h(x.so || '') + '</b>?', { nut: 'Xoá', nguy: true }).then(function (ok) {
        if (!ok) return; nv.hopDong.splice(i, 1); App.dongBoHoSo(nv); App.luu(); App.veLai();
      });
    };
  }

  /* ---------- Tab: hồ sơ scan (lưu trữ hợp đồng, quyết định, giấy tờ để khi cần thì tải xuống) ---------- */
  var stScan = { loai: 'hop_dong', hd: '' };
  function tabScan(el, d, nv) {
    var T = App.TEP, thuTu = Object.keys(T.LOAI);
    var ds = (nv.hoSoTep || []).map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) {
      var la = thuTu.indexOf(a.x.loai), lb = thuTu.indexOf(b.x.loai);
      return la !== lb ? la - lb : (b.x.ngay || '') < (a.x.ngay || '') ? -1 : 1;
    });
    var tong = ds.reduce(function (s, o) { return s + (+o.x.kichThuoc || 0); }, 0);
    var hdTen = function (x) { return (x.so || 'Không số') + ' – ' + (x.loai || '') + (x.tuNgay ? ' từ ' + TL.hienNgay(x.tuNgay) : ''); };
    var optHD = function (chon) { return '<option value="">(Không gắn)</option>' + (nv.hopDong || []).filter(function (x) { return x.id; }).map(function (x) { return '<option value="' + h(x.id) + '"' + (x.id === chon ? ' selected' : '') + '>' + h(hdTen(x)) + '</option>'; }).join(''); };
    var optLoai = function (chon) { return Object.keys(T.LOAI).map(function (k) { return '<option value="' + k + '"' + (k === chon ? ' selected' : '') + '>' + h(T.LOAI[k]) + '</option>'; }).join(''); };
    (nv.hopDong || []).forEach(function (x) { if (!x.id) x.id = App.uid(); });
    var trongTD = ds.filter(function (o) { return o.x.noiLuu !== 'may_chu'; }).length;
    el.innerHTML = '<div class="the"><h3>Hồ sơ scan, tài liệu lưu trữ<span class="phai">' + ds.length + ' tệp' + (tong ? ' · ' + T.dungLuong(tong) : '') +
      (ds.length ? ' <button class="nut nho" id="sc-zip" title="Tải toàn bộ hồ sơ scan của nhân viên thành 1 tệp nén, chia thư mục theo loại">' + App.icon('tai') + 'Tải tất cả (.zip)</button>' : '') + '</span></h3>' +
      '<div class="vung-tha" id="sc-tha"><div style="margin-bottom:8px">' + App.icon('nhap') + ' <b>Kéo thả tệp scan vào đây</b> hoặc <button class="nut chinh" id="sc-chon">Chọn tệp…</button></div>' +
      '<div class="hang" style="justify-content:center">Loại: <select id="sc-loai">' + optLoai(stScan.loai) + '</select> Gắn với hợp đồng: <select id="sc-hd">' + optHD(stScan.hd) + '</select></div></div>' +
      '<p class="mo nho">Nhận PDF, ảnh (JPG, PNG…), Word, Excel; tối đa 25 MB / tệp; chọn được nhiều tệp một lần. ' +
      (T.mayChu() ? 'Tệp lưu trên <b>máy chủ</b> (thư mục dữ liệu, kèm 1 bản trong thư mục sao lưu) – máy nào đăng nhập cũng xem, tải về được.'
        : 'Đang chạy 1 file trên máy: tệp lưu trong <b>trình duyệt của máy này</b> (không nằm trong file sao lưu .json). Để lưu trữ lâu dài, nên dùng phần mềm qua máy chủ.') + '</p>' +
      '<div class="cuon"><table class="bang" id="sc-bang"><thead><tr><th>Loại</th><th style="min-width:220px">Tên tệp</th><th>Gắn với hợp đồng</th><th style="min-width:160px">Ghi chú</th><th>Ngày tải lên</th><th class="so">Dung lượng</th><th></th></tr></thead><tbody>' +
      (ds.length ? ds.map(function (o) {
        var x = o.x, xem = T.xemDuoc(x), td = x.noiLuu !== 'may_chu';
        return '<tr data-i="' + o.i + '"><td><select data-f="loai" style="min-width:150px">' + optLoai(x.loai) + '</select></td>' +
          '<td class="ten">' + (xem ? '<span class="lk" data-a="xem" title="Mở xem">' + h(x.ten) + '</span>' : h(x.ten)) +
            (td && T.mayChu() ? ' <span class="the-tt cam" title="Tệp đang nằm trong trình duyệt của máy đã tải lên trước khi dùng máy chủ">trong trình duyệt</span>' : '') + '</td>' +
          '<td><select data-f="hopDongId">' + optHD(x.hopDongId) + '</select></td>' +
          '<td><input class="o-nhap chu" data-f="ghiChu" value="' + h(x.ghiChu || '') + '" placeholder="vd bản gốc lưu tủ 2" style="width:100%"></td>' +
          '<td class="giua nho">' + (x.ngay ? new Date(x.ngay).toLocaleDateString('vi-VN') : '') + (x.nguoi ? '<div class="mo">' + h(x.nguoi) + '</div>' : '') + '</td>' +
          '<td class="so">' + T.dungLuong(+x.kichThuoc || 0) + '</td>' +
          '<td style="white-space:nowrap">' + (xem ? '<button class="nut nho" data-a="xem" title="Mở xem">Xem</button> ' : '') +
            '<button class="nut nho" data-a="tai" title="Tải về máy">' + App.icon('tai') + '</button> ' +
            (td && T.mayChu() ? '<button class="nut nho" data-a="dualen" title="Đưa tệp từ trình duyệt máy này lên máy chủ">Đưa lên máy chủ</button> ' : '') +
            '<button class="nut nho nguy" data-a="xoa" title="Xoá">' + App.icon('xoa') + '</button></td></tr>';
      }).join('') : '<tr><td colspan="7" class="trong">Chưa có tệp. Kéo thả bản scan hợp đồng, quyết định, CCCD, bằng cấp… vào khung trên.</td></tr>') +
      '</tbody></table></div>' + (trongTD && T.mayChu() ? '<p class="mo nho">' + trongTD + ' tệp chưa nằm trên máy chủ: mở hồ sơ này trên máy đã tải tệp lên rồi bấm “Đưa lên máy chủ”.</p>' : '') + '</div>';

    var tha = App.$('#sc-tha', el), chon = function () { return { loai: App.$('#sc-loai', el).value, hopDongId: App.$('#sc-hd', el).value }; };
    App.$('#sc-loai', el).onchange = function () { stScan.loai = this.value; };
    App.$('#sc-hd', el).onchange = function () { stScan.hd = this.value; if (this.value) { stScan.loai = 'hop_dong'; App.$('#sc-loai', el).value = 'hop_dong'; } };
    App.$('#sc-chon', el).onclick = function () { App.chonTepHoSo(nv, chon()); };
    tha.ondragover = function (e) { e.preventDefault(); tha.classList.add('keo'); };
    tha.ondragleave = function () { tha.classList.remove('keo'); };
    tha.ondrop = function (e) { e.preventDefault(); tha.classList.remove('keo'); App.taiTepHoSo(nv, Array.prototype.slice.call(e.dataTransfer.files || []), chon()); };
    var bao = function (e) { App.bao(e.message || String(e), 'loi'); };
    var bz = App.$('#sc-zip', el);
    if (bz) bz.onclick = function () {
      App.bao('Đang gom ' + ds.length + ' tệp…');
      T.taiTatCa(nv, nv.hoSoTep).then(function (loi) { if (loi.length) App.bao('Không lấy được: ' + loi.join('; '), 'loi'); }, bao);
    };
    App.$('#sc-bang', el).onchange = function (e) {
      var f = e.target.dataset.f, tr = e.target.closest('tr[data-i]'); if (!f || !tr) return;
      var t = nv.hoSoTep[+tr.dataset.i];
      t[f] = f === 'ghiChu' ? e.target.value.trim() : e.target.value;
      if (f === 'hopDongId' && t.hopDongId) t.loai = 'hop_dong';
      App.dongBoHoSo(nv); App.luu(); App.bao('Đã lưu'); if (f !== 'ghiChu') App.veLai();
    };
    App.$('#sc-bang', el).onclick = function (e) {
      var b = e.target.closest('[data-a]'); if (!b) return;
      var tr = b.closest('tr[data-i]'), t = nv.hoSoTep[+tr.dataset.i];
      if (b.dataset.a === 'xem') T.xem(nv, t).catch(bao);
      else if (b.dataset.a === 'tai') T.taiVe(nv, t).catch(bao);
      else if (b.dataset.a === 'dualen') {
        T.layBlob(nv, t).then(function (blob) {
          var cu = Object.assign({}, t), f = new File([blob], t.ten, { type: blob.type });
          return T.taiLen(nv, f, { loai: t.loai, hopDongId: t.hopDongId, ghiChu: t.ghiChu, ngay: t.ngay, nguoi: t.nguoi }).then(function (moi) {
            nv.hoSoTep[nv.hoSoTep.indexOf(t)] = moi;
            App.dongBoHoSo(nv); App.luuNgay(); App.veLai(); App.bao('Đã đưa “' + t.ten + '” lên máy chủ.', 'tot');
            return T.xoa(nv, cu).catch(function () { /* giữ bản trong trình duyệt nếu không xoá được */ });
          });
        }).catch(bao);
      } else if (b.dataset.a === 'xoa') {
        App.xacNhan('Xoá tệp <b>' + h(t.ten) + '</b> khỏi hồ sơ ' + h(nv.hoTen) + '?' + (t.noiLuu === 'may_chu' ? '<br><span class="mo">Máy chủ vẫn giữ 1 bản trong thư mục sao lưu.</span>' : ''), { nut: 'Xoá', nguy: true }).then(function (ok) {
          if (!ok) return;
          T.xoa(nv, t).then(function () {
            nv.hoSoTep.splice(nv.hoSoTep.indexOf(t), 1); App.dongBoHoSo(nv); App.luu(); App.veLai(); App.bao('Đã xoá ' + t.ten);
          }, bao);
        });
      }
    };
  }

  /* ---------- Tab: quá trình công tác ---------- */
  function tabQuaTrinh(el, d, nv) {
    var ds = (nv.quyetDinh || []).map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) { return (b.x.hieuLuc || b.x.ngay || '') < (a.x.hieuLuc || a.x.ngay || '') ? -1 : 1; });
    el.innerHTML = '<div class="the"><h3>Quá trình công tác, khen thưởng, kỷ luật<span class="phai"><button class="nut nho chinh" id="qd-them">' + App.icon('them') + 'Thêm quyết định</button></span></h3>' +
      '<div class="cuon"><table class="bang"><thead><tr><th>Hiệu lực</th><th>Loại</th><th>Số quyết định</th><th>Ngày ký</th><th style="min-width:280px">Nội dung</th><th></th></tr></thead><tbody>' +
      (ds.length ? ds.map(function (o) {
        var x = o.x;
        return '<tr data-i="' + o.i + '"><td class="giua">' + TL.hienNgay(x.hieuLuc) + '</td><td><span class="the-tt ' + App.mauQD(x.loai) + '">' + h(TL.LOAI_QD[x.loai] || x.loai) + '</span></td>' +
          '<td>' + h(x.so) + '</td><td class="giua">' + TL.hienNgay(x.ngay) + '</td><td style="white-space:normal">' + App.tomTatQD(x) + '</td>' +
          '<td style="white-space:nowrap"><button class="nut nho" data-a="sua">' + App.icon('sua') + '</button> <button class="nut nho nguy" data-a="xoa">' + App.icon('xoa') + '</button></td></tr>';
      }).join('') : '<tr><td colspan="6" class="trong">Chưa có quyết định nào.</td></tr>') + '</tbody></table></div>' +
      '<p class="mo nho">Quyết định nâng lương: các kỳ lương kết thúc trước ngày hiệu lực vẫn tính lương cũ. Khen thưởng / kỷ luật có số tiền được đưa vào bảng lương của kỳ đã chọn.</p></div>';
    el.onclick = function (e) {
      if (e.target.closest('#qd-them')) { App.formQuyetDinh(nv, null); return; }
      var b = e.target.closest('[data-a]'); if (!b) return;
      var i = +b.closest('tr').dataset.i;
      if (b.dataset.a === 'sua') App.formQuyetDinh(nv, i); else App.xoaQuyetDinh(nv, i);
    };
  }

  /* ---------- Tab: nghỉ phép ---------- */
  function tabPhep(el, d, nv) {
    var y = App.ky.y, pn = TL.phepNam(App.db, nv, y);
    var don = (App.db.donNghi || []).filter(function (x) { return x.nvId === nv.id; }).sort(function (a, b) { return a.tuNgay < b.tuNgay ? 1 : -1; });
    el.innerHTML = '<div class="the"><h3>Phép năm ' + y + '</h3><div class="kpis" style="margin-bottom:10px">' +
      [['Được hưởng', pn.duoc], ['Tồn năm trước', pn.ton], ['Đã nghỉ', pn.daNghi], ['Còn lại', pn.conLai]].map(function (k) { return '<div class="kpi"><div class="nhan">' + k[0] + '</div><div class="gt">' + App.so(k[1]) + '</div><div class="phu">ngày</div></div>'; }).join('') +
      '</div><div class="cuon"><table class="bang"><thead><tr>' + pn.theoThang.map(function (_, i) { return '<th>T' + (i + 1) + '</th>'; }).join('') + '</tr></thead><tbody><tr>' +
      pn.theoThang.map(function (v) { return '<td class="giua">' + App.soRong(v) + '</td>'; }).join('') + '</tr></tbody></table></div></div>' +
      '<div class="the"><h3>Đơn xin nghỉ<span class="phai"><button class="nut nho chinh" id="dn-them">' + App.icon('them') + 'Tạo đơn nghỉ</button></span></h3>' +
      App.bangDonNghi(don, true) + '</div>';
    el.onclick = function (e) {
      if (e.target.closest('#dn-them')) { App.formDonNghi(nv.id); return; }
      App.xuLyNutDon(e);
    };
  }

  /* ---------- Tab: lương các kỳ ---------- */
  function tabLuong(el, d, nv) {
    var db = App.db, rows = [];
    for (var i = 0; i < 12; i++) {
      var t = new Date(App.ky.y, App.ky.m - 1 - i, 1), y = t.getFullYear(), m = t.getMonth() + 1;
      var bl = TL.tinhBangLuong(db, y, m), r = bl.rows.filter(function (x) { return x.nvId === nv.id; })[0];
      if (r) rows.push({ y: y, m: m, r: r, khoa: bl.khoa });
    }
    el.innerHTML = '<div class="the"><h3>Lương 12 kỳ gần nhất<span class="phai">Bấm 1 dòng để mở bảng lương kỳ đó</span></h3><div class="cuon"><table class="bang"><thead><tr>' +
      '<th>Kỳ</th><th class="so">Mức lương</th><th class="so">Công TG</th><th class="so">Công SP</th><th class="so">Lương SP</th><th class="so">Lương TG</th><th class="so">Phụ cấp</th><th class="so">Thưởng</th>' +
      '<th class="so">Tổng thu nhập</th><th class="so">BH, CĐ</th><th class="so">Thuế</th><th class="so">Tạm ứng</th><th class="so">Lãnh kỳ II</th><th></th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (o) {
        var r = o.r;
        return '<tr data-y="' + o.y + '" data-m="' + o.m + '" style="cursor:pointer"><td>' + TL.pad(o.m) + '/' + o.y + '</td><td class="so">' + App.tien(r.luongCB) + '</td><td class="so">' + App.soRong(r.cong.congTG) + '</td><td class="so">' + App.soRong(r.cong.sp) + '</td>' +
          '<td class="so">' + App.tienRong(r.luongSP) + '</td><td class="so">' + App.tienRong(r.luongTG) + '</td><td class="so">' + App.tienRong(r.tongPhuCap) + '</td><td class="so">' + App.tienRong(r.thuong + (r.thuongQD || 0)) + '</td>' +
          '<td class="so"><b>' + App.tien(r.tongThuNhap) + '</b></td><td class="so">' + App.tienRong(r.tongBH + r.doanPhi) + '</td><td class="so">' + App.tienRong(r.thue) + '</td><td class="so">' + App.tienRong(r.tamUng) + '</td>' +
          '<td class="so"><b>' + App.tien(r.thucLinh) + '</b></td><td>' + (o.khoa ? '🔒' : '') + '</td></tr>';
      }).join('') : '<tr><td colspan="14" class="trong">Chưa có kỳ lương nào.</td></tr>') + '</tbody></table></div></div>';
    el.onclick = function (e) {
      var tr = e.target.closest('tr[data-y]'); if (!tr) return;
      App.ky = { y: +tr.dataset.y, m: +tr.dataset.m };
      try { sessionStorage.setItem('ChamCong_ky', JSON.stringify(App.ky)); } catch (er) { /* bỏ qua */ }
      location.hash = '#bangluong';
    };
  }

  App.trang.hoso = {
    ve: ve, khongKy: true, menu: 'nhanvien',
    roi: function () {
      if (st.ban && st.d) {
        if (luu(false, true)) App.bao('Đã tự lưu hồ sơ trước khi chuyển trang.', 'tot');
        else App.bao('Hồ sơ chưa lưu được – thay đổi đã bị bỏ.', 'loi');
      }
      st.d = null; st.ban = false; st.id = null;
    }
  };
})();
