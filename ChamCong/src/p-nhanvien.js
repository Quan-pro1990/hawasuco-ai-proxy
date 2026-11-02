/* Trang Nhân viên: danh sách, thêm / sửa / xoá, nhập – xuất Excel */
(function () {
  'use strict';
  var App = window.App, TL = window.TL, XL = window.XL, h = App.h;

  App.HINH_THUC = { thang: 'Lương tháng', ngay: 'Lương ngày', gio: 'Lương giờ', khoan: 'Lương khoán' };
  App.DV_LUONG = { thang: 'đ/tháng', ngay: 'đ/ngày', gio: 'đ/giờ', khoan: 'đ/tháng' };
  App.TRANG_THAI = { dang_lam: 'Đang làm việc', thu_viec: 'Thử việc', tam_nghi: 'Tạm nghỉ', nghi_viec: 'Đã nghỉ việc' };
  App.CACH_THUE = { luy_tien: 'Lũy tiến từng phần', khau_tru: 'Khấu trừ 10%', khong: 'Không tính thuế' };
  App.LOAI_HD = ['Thử việc', 'Xác định thời hạn', 'Không xác định thời hạn', 'Thời vụ / khoán việc', 'Học việc'];
  App.CACH_PC = { co_dinh: 'Cố định / tháng', theo_cong: 'Theo ngày công', theo_ngay: 'Đơn giá × ngày đi làm' };

  /** Chuẩn hoá ngày nhập (dd/mm/yyyy, yyyy-mm-dd, số Excel) -> 'yyyy-mm-dd' */
  App.chuanNgay = function (v) {
    if (v == null || v === '') return '';
    if (typeof v === 'number') {
      var d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 864e5);
      return TL.iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
    var s = String(v).trim().split(/[ T]/)[0], m;
    if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/))) return TL.iso(+m[1], +m[2], +m[3]);
    if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/))) { var y = +m[3]; if (y < 100) y += 2000; return TL.iso(y, +m[2], +m[1]); }
    if (/^\d{5}(\.\d+)?$/.test(s)) return App.chuanNgay(+s);
    return '';
  };

  var loc = { tim: '', pb: '', tt: 'dang' };

  function dsLoc() {
    return App.db.nhanVien.filter(function (nv) {
      if (loc.pb && nv.phongBan !== loc.pb) return false;
      if (loc.tt === 'dang' && nv.trangThai === 'nghi_viec') return false;
      if (loc.tt === 'nghi' && nv.trangThai !== 'nghi_viec') return false;
      if (loc.tim && !App.timKhop(nv.ma + ' ' + nv.hoTen + ' ' + (nv.chucVu || '') + ' ' + (nv.sdt || ''), loc.tim)) return false;
      return true;
    }).sort(function (a, b) { return String(a.ma).localeCompare(String(b.ma), 'vi', { numeric: true }); });
  }

  function ve(noi) {
    var db = App.db;
    noi.innerHTML =
      '<div class="the khong-in"><div class="hang">' +
      '<input type="search" id="nv-tim" placeholder="Tìm mã, tên, chức vụ, SĐT…" value="' + h(loc.tim) + '" style="width:260px">' +
      '<select id="nv-pb"><option value="">Tất cả phòng ban</option>' + db.phongBan.map(function (p) { return '<option value="' + h(p.ma) + '"' + (loc.pb === p.ma ? ' selected' : '') + '>' + h(p.ten) + '</option>'; }).join('') + '</select>' +
      '<select id="nv-tt"><option value="dang"' + (loc.tt === 'dang' ? ' selected' : '') + '>Đang làm việc</option><option value="nghi"' + (loc.tt === 'nghi' ? ' selected' : '') + '>Đã nghỉ việc</option><option value=""' + (loc.tt === '' ? ' selected' : '') + '>Tất cả</option></select>' +
      '<span class="gian"></span>' +
      '<button class="nut" id="nv-nhap">' + App.icon('nhap') + 'Nhập từ Excel</button>' +
      '<button class="nut" id="nv-xuat">' + App.icon('tai') + 'Xuất Excel</button>' +
      '<button class="nut chinh" id="nv-them">' + App.icon('them') + 'Thêm nhân viên</button>' +
      '</div></div>' +
      App.dauIn('DANH SÁCH NHÂN VIÊN', 'Ngày ' + new Date().toLocaleDateString('vi-VN')) +
      '<div class="cuon cao"><table class="bang" id="nv-bang"></table></div>' +
      '<p class="mo nho khong-in">Bấm vào một dòng để xem / sửa. Mức lương theo hình thức trả lương (tháng, ngày hoặc giờ). “Lịch làm” quyết định công chuẩn: T2-T6 ≈ 22 công, T2-T7 ≈ 26 công.</p>';
    veBang();
    App.$('#nv-tim').oninput = function () { loc.tim = this.value; veBang(); };
    App.$('#nv-pb').onchange = function () { loc.pb = this.value; veBang(); };
    App.$('#nv-tt').onchange = function () { loc.tt = this.value; veBang(); };
    App.$('#nv-them').onclick = function () { moForm(null); };
    App.$('#nv-xuat').onclick = xuatExcel;
    App.$('#nv-nhap').onclick = nhapExcel;
    App.$('#nv-bang').onclick = function (e) {
      var tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      var nv = App.db.nhanVien.filter(function (x) { return x.id === tr.dataset.id; })[0];
      if (e.target.closest('.xoa')) { xoaNV(nv); return; }
      moForm(nv);
    };
  }

  function veBang() {
    var ds = dsLoc(), db = App.db;
    var html = '<thead><tr><th>STT</th><th>Mã NV</th><th style="min-width:170px">Họ và tên</th><th>Phòng ban</th><th>Chức vụ</th><th>Ngày vào</th><th>Loại HĐ</th>' +
      '<th>Lịch làm</th><th>Hình thức</th><th class="so">Mức lương</th><th class="so">Lương đóng BH</th><th>NPT</th><th>Trạng thái</th><th class="khong-in"></th></tr></thead><tbody>';
    if (!ds.length) html += '<tr><td colspan="14" class="trong">' + (db.nhanVien.length ? 'Không có nhân viên phù hợp bộ lọc.' : 'Chưa có nhân viên. Bấm “Thêm nhân viên” hoặc “Nhập từ Excel”.') + '</td></tr>';
    ds.forEach(function (nv, i) {
      var tt = nv.trangThai || 'dang_lam';
      var lbh = nv.thamGiaBH ? (+nv.luongBH > 0 ? App.tien(nv.luongBH) : ((nv.hinhThuc || 'thang') === 'thang' || nv.hinhThuc === 'khoan' ? '<span class="mo" title="Lương CB + phụ cấp đóng BH">' + App.tien(luongBHMacDinh(nv)) + '</span>' : '<span class="the-tt cam">Chưa nhập</span>')) : '<span class="mo">Không tham gia</span>';
      html += '<tr data-id="' + nv.id + '" style="cursor:pointer"><td class="giua">' + (i + 1) + '</td><td>' + h(nv.ma) + '</td><td class="ten">' + h(nv.hoTen) + '</td>' +
        '<td>' + h(TL.tenPhongBan(db, nv.phongBan)) + '</td><td>' + h(nv.chucVu) + '</td><td class="giua">' + TL.hienNgay(nv.ngayVao) + '</td><td>' + h(nv.loaiHD || '') + '</td>' +
        '<td class="giua">' + (nv.congChuanRieng ? nv.congChuanRieng + ' công' : (nv.lichLam || '<span class="mo">chung</span>')) + '</td><td>' + (App.HINH_THUC[nv.hinhThuc || 'thang']) + '</td><td class="so">' + App.tien(nv.luongCB) + (nv.tiLeHuong != null && +nv.tiLeHuong !== 100 ? ' <span class="the-tt cam">' + nv.tiLeHuong + '%</span>' : '') + '</td>' +
        '<td class="so">' + lbh + '</td><td class="giua">' + (nv.soNPT || '') + '</td>' +
        '<td><span class="the-tt ' + ({ dang_lam: 'xanh', thu_viec: 'cam', tam_nghi: 'lam', nghi_viec: '' }[tt]) + '">' + App.TRANG_THAI[tt] + '</span></td>' +
        '<td class="khong-in"><button class="nut nho nguy xoa" title="Xoá">' + App.icon('xoa') + '</button></td></tr>';
    });
    html += '</tbody>';
    App.$('#nv-bang').innerHTML = html;
  }

  function luongBHMacDinh(nv) {
    var s = +nv.luongCB || 0;
    App.db.phuCap.forEach(function (pc) { if (pc.dongBH) s += +(nv.phuCap || {})[pc.ma] || 0; });
    return s;
  }

  function maMoi() {
    var max = 0;
    App.db.nhanVien.forEach(function (nv) { var m = String(nv.ma).match(/(\d+)$/); if (m) max = Math.max(max, +m[1]); });
    return 'NV' + String(max + 1).padStart(3, '0');
  }

  /* ---------- Form thêm / sửa ---------- */
  function o(nhan, input, gc, cls) { return '<label class="o ' + (cls || '') + '">' + nhan + input + (gc ? '<span class="gc">' + gc + '</span>' : '') + '</label>'; }
  function txt(ten, v, attr) { return '<input name="' + ten + '" value="' + h(v == null ? '' : v) + '" ' + (attr || '') + '>'; }
  function tien(ten, v) { return '<input name="' + ten + '" class="so tien" inputmode="numeric" value="' + (v ? App.tien(v) : '') + '">'; }
  function sel(ten, v, opts) {
    return '<select name="' + ten + '">' + opts.map(function (x) { var k = Array.isArray(x) ? x[0] : x, t = Array.isArray(x) ? x[1] : x; return '<option value="' + h(k) + '"' + (String(v) === String(k) ? ' selected' : '') + '>' + h(t) + '</option>'; }).join('') + '</select>';
  }
  function cap(obj) { return Object.keys(obj).map(function (k) { return [k, obj[k]]; }); }

  function moForm(nv) {
    var db = App.db, moi = !nv;
    var d = nv ? JSON.parse(JSON.stringify(nv)) : {
      id: App.uid(), ma: maMoi(), hoTen: '', gioiTinh: 'Nam', phongBan: db.phongBan[0] ? db.phongBan[0].ma : '', hinhThuc: 'thang', luongCB: 0, tiLeHuong: 100,
      thamGiaBH: true, doanVien: false, cachTinhThue: 'luy_tien', soNPT: 0, trangThai: 'dang_lam', loaiHD: 'Không xác định thời hạn', ngayVao: App.homNay(), phuCap: {}, phepNam: ''
    };
    var chucVu = {};
    db.nhanVien.forEach(function (x) { if (x.chucVu) chucVu[x.chucVu] = 1; });
    var pc = db.phuCap.map(function (p) {
      return o('Phụ cấp ' + h(p.ten.toLowerCase()), tien('pc_' + p.ma, (d.phuCap || {})[p.ma]), App.CACH_PC[p.cachTinh] + (p.cachTinh === 'theo_ngay' ? ' (nhập đơn giá 1 ngày)' : '') + (p.chiuThue ? '' : ' · không chịu thuế') + (p.dongBH ? ' · tính vào lương đóng BH' : ''));
    }).join('');
    var than = '<form class="form" autocomplete="off" onsubmit="return false">' +
      '<h4>Thông tin chung</h4>' +
      o('Mã nhân viên *', txt('ma', d.ma, 'required')) + o('Mã chấm công (ID trên máy chấm công)', txt('maChamCong', d.maChamCong), 'Dùng để ghép dữ liệu vân tay / thẻ') +
      o('Họ và tên *', txt('hoTen', d.hoTen, 'required'), '', 'ca') +
      o('Giới tính', sel('gioiTinh', d.gioiTinh, ['Nam', 'Nữ', 'Khác'])) + o('Ngày sinh', txt('ngaySinh', d.ngaySinh, 'type="date"')) +
      o('Số CCCD', txt('cccd', d.cccd)) + o('Điện thoại', txt('sdt', d.sdt, 'type="tel"')) +
      o('Email', txt('email', d.email, 'type="email"')) + o('Địa chỉ', txt('diaChi', d.diaChi)) +
      '<h4>Công việc</h4>' +
      o('Phòng ban', sel('phongBan', d.phongBan, [['', '(Chưa chọn)']].concat(db.phongBan.map(function (p) { return [p.ma, p.ten]; }))), '<a href="#danhmuc" data-dong>Thêm phòng ban…</a>') +
      o('Chức vụ', txt('chucVu', d.chucVu, 'list="ds-chucvu"') + '<datalist id="ds-chucvu">' + Object.keys(chucVu).map(function (c) { return '<option value="' + h(c) + '">'; }).join('') + '</datalist>') +
      o('Loại hợp đồng', sel('loaiHD', d.loaiHD, App.LOAI_HD)) + o('Trạng thái', sel('trangThai', d.trangThai, cap(App.TRANG_THAI))) +
      o('Ngày vào làm', txt('ngayVao', d.ngayVao, 'type="date"')) + o('Ngày hết hạn HĐ / thử việc', txt('ngayHetHD', d.ngayHetHD, 'type="date"')) +
      o('Ngày nghỉ việc', txt('ngayNghi', d.ngayNghi, 'type="date"'), 'Ngày làm việc cuối cùng. Sau ngày này không chấm công, không tính lương.') +
      o('Lịch làm việc', sel('lichLam', d.lichLam || '', [['', 'Theo cài đặt chung'], ['T2-T6', 'Thứ 2 – Thứ 6 (nghỉ T7, CN)'], ['T2-T7', 'Thứ 2 – Thứ 7 (nghỉ CN)'], ['T2-CN', 'Cả tuần (trực, bảo vệ…)']]), 'Quyết định công chuẩn: vd T2–T6 thường 22 công, T2–T7 thường 26 công') +
      '<h4>Lương &amp; phụ cấp</h4>' +
      o('Hình thức trả lương', sel('hinhThuc', d.hinhThuc || 'thang', cap(App.HINH_THUC))) +
      o('Mức lương / HĐ <span id="dv-luong">(' + App.DV_LUONG[d.hinhThuc || 'thang'] + ')</span>', tien('luongCB', d.luongCB)) +
      o('Tỷ lệ hưởng lương (%)', txt('tiLeHuong', d.tiLeHuong == null ? 100 : d.tiLeHuong, 'type="number" min="0" max="200" step="1"'), 'Thử việc thường 85%') +
      o('Công chuẩn riêng (ngày)', txt('congChuanRieng', d.congChuanRieng || '', 'type="number" min="0" step="0.5" placeholder="Tự tính theo lịch làm việc"'), 'Chỉ nhập khi người này có công chuẩn cố định, vd 26') +
      o('Đơn giá lương sản phẩm (đ)', tien('donGiaSP', d.donGiaSP), 'Để trống = đơn giá chung ' + App.tien(db.caiDat.donGiaSP) + ' đ / ' + h((db.caiDat.tenSP || 'sản phẩm').toLowerCase())) + '<span></span>' +
      pc +
      '<h4>Bảo hiểm &amp; thuế TNCN</h4>' +
      '<label class="chk"><input type="checkbox" name="thamGiaBH"' + (d.thamGiaBH ? ' checked' : '') + '> Tham gia BHXH, BHYT, BHTN</label>' +
      '<label class="chk"><input type="checkbox" name="doanVien"' + (d.doanVien ? ' checked' : '') + '> Đoàn viên công đoàn (trừ đoàn phí)</label>' +
      o('Lương đóng bảo hiểm', tien('luongBH', d.luongBH), 'Để trống = lương cơ bản + phụ cấp tính đóng BH. Lương ngày/giờ bắt buộc nhập.') +
      o('Cách tính thuế TNCN', sel('cachTinhThue', d.cachTinhThue || 'luy_tien', cap(App.CACH_THUE)), 'HĐ từ 3 tháng: lũy tiến. HĐ dưới 3 tháng / cộng tác viên: khấu trừ 10%.') +
      o('Mã số thuế cá nhân', txt('mst', d.mst)) + o('Số người phụ thuộc', txt('soNPT', d.soNPT || 0, 'type="number" min="0" step="1"')) +
      '<h4>Ngân hàng &amp; phép năm</h4>' +
      o('Ngân hàng', txt('nganHang', d.nganHang)) + o('Số tài khoản', txt('soTK', d.soTK)) +
      o('Số ngày phép năm', txt('phepNam', d.phepNam, 'type="number" min="0" step="0.5" placeholder="' + db.caiDat.phepNam + '"'), 'Để trống = mặc định ' + db.caiDat.phepNam + ' ngày') +
      o('Phép tồn năm trước chuyển sang', txt('phepTon', d.phepTon, 'type="number" min="0" step="0.5"')) +
      o('Ghi chú', '<textarea name="ghiChu">' + h(d.ghiChu || '') + '</textarea>', '', 'ca') +
      '</form>';
    App.hop({
      tieuDe: moi ? 'Thêm nhân viên' : 'Sửa nhân viên: ' + nv.hoTen, co: 'rong', than: than, giu: true,
      moRa: function (el, dong) {
        App.$$('input.tien', el).forEach(ganOTien);
        App.$('[name=hinhThuc]', el).onchange = function () { App.$('#dv-luong', el).textContent = '(' + App.DV_LUONG[this.value] + ')'; };
        App.$('[name=trangThai]', el).onchange = function () {
          if (this.value === 'thu_viec') { App.$('[name=tiLeHuong]', el).value = 85; App.$('[name=loaiHD]', el).value = 'Thử việc'; }
        };
        App.$('[name=ngayNghi]', el).onchange = function () { if (this.value) App.$('[name=trangThai]', el).value = 'nghi_viec'; };
        var a = App.$('[data-dong]', el); if (a) a.onclick = dong;
      },
      nut: [
        { ten: 'Huỷ' },
        {
          ten: moi ? 'Thêm nhân viên' : 'Lưu thay đổi', loai: 'chinh', bam: function (el) {
            var f = App.$('form', el), v = {};
            App.$$('[name]', f).forEach(function (i) { v[i.name] = i.type === 'checkbox' ? i.checked : i.value; });
            v.ma = String(v.ma || '').trim(); v.hoTen = String(v.hoTen || '').trim();
            if (!v.ma || !v.hoTen) { App.bao('Cần nhập mã nhân viên và họ tên.', 'loi'); return false; }
            var trung = App.db.nhanVien.filter(function (x) { return x.id !== d.id && String(x.ma).toLowerCase() === v.ma.toLowerCase(); })[0];
            if (trung) { App.bao('Mã ' + v.ma + ' đã dùng cho ' + trung.hoTen + '.', 'loi'); return false; }
            if (v.maChamCong) {
              var t2 = App.db.nhanVien.filter(function (x) { return x.id !== d.id && x.maChamCong && String(x.maChamCong) === String(v.maChamCong).trim(); })[0];
              if (t2) { App.bao('Mã chấm công ' + v.maChamCong + ' đã dùng cho ' + t2.hoTen + '.', 'loi'); return false; }
            }
            ['luongCB', 'luongBH', 'donGiaSP'].forEach(function (k) { v[k] = App.docSo(v[k]); });
            v.congChuanRieng = v.congChuanRieng === '' ? '' : +v.congChuanRieng;
            v.tiLeHuong = v.tiLeHuong === '' ? 100 : +v.tiLeHuong;
            v.soNPT = +v.soNPT || 0;
            v.phepNam = v.phepNam === '' ? '' : +v.phepNam;
            v.phepTon = v.phepTon === '' ? '' : +v.phepTon;
            v.maChamCong = String(v.maChamCong || '').trim();
            var pcv = {};
            App.db.phuCap.forEach(function (p) { var x = App.docSo(v['pc_' + p.ma]); if (x) pcv[p.ma] = x; delete v['pc_' + p.ma]; });
            v.phuCap = pcv;
            if (v.trangThai === 'nghi_viec' && !v.ngayNghi) { App.bao('Nhân viên đã nghỉ việc: hãy nhập ngày nghỉ việc.', 'loi'); return false; }
            if (v.ngayNghi && v.trangThai !== 'nghi_viec') v.trangThai = 'nghi_viec';
            Object.assign(d, v);
            if (moi) App.db.nhanVien.push(d);
            else Object.assign(nv, d);
            App.luu();
            App.bao(moi ? 'Đã thêm ' + d.hoTen : 'Đã lưu ' + d.hoTen, 'tot');
            veBang();
          }
        }
      ]
    });
  }

  /** Ô nhập tiền: tự thêm dấu chấm ngăn cách hàng nghìn khi rời ô */
  function ganOTien(i) {
    i.addEventListener('blur', function () { var n = App.docSo(i.value); i.value = n ? App.tien(n) : ''; });
    i.addEventListener('focus', function () { setTimeout(function () { i.select(); }, 0); });
  }
  App.ganOTien = ganOTien;

  function xoaNV(nv) {
    var coDL = Object.keys(App.db.thang).some(function (k) { var T = App.db.thang[k]; return (T.cc && T.cc[nv.id] && Object.keys(T.cc[nv.id]).length) || (T.chot && T.chot.rows.some(function (r) { return r.nvId === nv.id; })); });
    var msg = 'Xoá nhân viên <b>' + h(nv.hoTen) + '</b> (' + h(nv.ma) + ')?' + (coDL ? '<br><br><span style="color:var(--do)">Nhân viên này đã có dữ liệu chấm công / lương. Nếu đã nghỉ việc, nên sửa trạng thái thành “Đã nghỉ việc” và nhập ngày nghỉ để giữ lịch sử. Xoá sẽ mất dữ liệu chấm công của người này (bảng lương các tháng đã chốt vẫn giữ).</span>' : '');
    App.xacNhan(msg, { nut: 'Xoá', nguy: true }).then(function (ok) {
      if (!ok) return;
      App.db.nhanVien = App.db.nhanVien.filter(function (x) { return x !== nv; });
      Object.keys(App.db.thang).forEach(function (k) { var T = App.db.thang[k]; ['cc', 'ot', 'muon', 'vr', 'dc'].forEach(function (f) { if (T[f]) delete T[f][nv.id]; }); });
      App.luu(); veBang(); App.bao('Đã xoá ' + nv.hoTen);
    });
  }

  /* ---------- Excel ---------- */
  function cotNV() {
    var c = [
      ['ma', 'Mã NV', 9], ['maChamCong', 'Mã chấm công', 9], ['hoTen', 'Họ và tên', 24], ['gioiTinh', 'Giới tính', 8], ['ngaySinh', 'Ngày sinh', 11, 'ngay'],
      ['cccd', 'Số CCCD', 14], ['sdt', 'Điện thoại', 12], ['email', 'Email', 18], ['diaChi', 'Địa chỉ', 24],
      ['phongBan', 'Phòng ban', 22, 'pb'], ['chucVu', 'Chức vụ', 18], ['loaiHD', 'Loại hợp đồng', 16], ['ngayVao', 'Ngày vào làm', 11, 'ngay'],
      ['ngayHetHD', 'Ngày hết hạn HĐ', 11, 'ngay'], ['trangThai', 'Trạng thái', 13, 'tt'], ['ngayNghi', 'Ngày nghỉ việc', 11, 'ngay'],
      ['lichLam', 'Lịch làm việc', 10, 'lich'], ['congChuanRieng', 'Công chuẩn riêng', 8, 'so'],
      ['hinhThuc', 'Hình thức lương', 13, 'ht'], ['luongCB', 'Mức lương', 13, 'so'], ['tiLeHuong', '% hưởng lương', 8, 'so'], ['donGiaSP', 'Đơn giá SP', 9, 'so'],
      ['luongBH', 'Lương đóng BH', 13, 'so'], ['thamGiaBH', 'Tham gia BH', 8, 'bool'], ['doanVien', 'Đoàn viên CĐ', 8, 'bool'],
      ['cachTinhThue', 'Cách tính thuế', 16, 'thue'], ['mst', 'MST cá nhân', 13], ['soNPT', 'Số người phụ thuộc', 8, 'so'],
      ['nganHang', 'Ngân hàng', 14], ['soTK', 'Số tài khoản', 16], ['phepNam', 'Phép năm', 7, 'so'], ['phepTon', 'Phép tồn', 7, 'so']
    ];
    App.db.phuCap.forEach(function (p) { c.push(['pc:' + p.ma, 'PC ' + p.ten, 12, 'so']); });
    c.push(['ghiChu', 'Ghi chú', 20]);
    return c;
  }
  function giaTriXuat(nv, c) {
    var k = c[0], v = k.indexOf('pc:') === 0 ? (nv.phuCap || {})[k.slice(3)] : nv[k];
    switch (c[3]) {
      case 'ngay': return TL.hienNgay(v);
      case 'pb': return TL.tenPhongBan(App.db, v);
      case 'tt': return App.TRANG_THAI[v || 'dang_lam'];
      case 'ht': return App.HINH_THUC[v || 'thang'];
      case 'thue': return App.CACH_THUE[v || 'luy_tien'];
      case 'bool': return v ? 'x' : '';
      case 'lich': return v || '';
      case 'so': return v === '' || v == null ? '' : +v;
      default: return v == null ? '' : String(v);
    }
  }

  function xuatExcel() {
    var cot = cotNV();
    var ds = dsLoc();
    var sh = App.sheetBang({
      ten: 'Nhân viên', tieuDe: 'DANH SÁCH NHÂN VIÊN', phuDe: 'Ngày ' + new Date().toLocaleDateString('vi-VN') + ' – ' + ds.length + ' người', chuKy: false, coCot: 3,
      cot: [{ t: 'STT', w: 5, stt: true, kieu: 'giua' }].concat(cot.map(function (c) {
        return { t: c[1], w: c[2], kieu: c[3] === 'so' ? 'so' : (c[3] === 'ngay' || c[3] === 'bool' ? 'giua' : 'chu'), f: function (nv) { return giaTriXuat(nv, c); } };
      })),
      dong: ds
    });
    App.xuatExcel('Danh_sach_nhan_vien', [sh]);
  }

  function taiMau() {
    var cot = cotNV();
    var vd = [{
      ma: 'NV001', maChamCong: '1', hoTen: 'Nguyễn Văn A', gioiTinh: 'Nam', ngaySinh: '1990-05-20', phongBan: App.db.phongBan[0] ? App.db.phongBan[0].ma : 'Phòng Kế toán',
      chucVu: 'Nhân viên', loaiHD: 'Không xác định thời hạn', ngayVao: '2024-01-02', trangThai: 'dang_lam', hinhThuc: 'thang', luongCB: 10000000, tiLeHuong: 100,
      thamGiaBH: true, doanVien: false, cachTinhThue: 'luy_tien', soNPT: 1, phuCap: { AN: 35000 }
    }];
    var dong = [cot.map(function (c) { return { v: c[1], s: App.KIEU.th }; })].concat(vd.map(function (nv) { return cot.map(function (c) { return giaTriXuat(nv, c); }); }));
    App.xuatExcel('Mau_nhap_nhan_vien', [{ ten: 'Nhân viên', dong: dong, cot: cot.map(function (c) { return c[2]; }), co: { r: 1 }, cao: { 0: 32 } }]);
  }

  function khop(a) { return App.boDau(a).toLowerCase().replace(/[^a-z0-9%]/g, ''); }
  function timTheoNhan(map, v) {
    var x = khop(v);
    var ks = Object.keys(map);
    for (var i = 0; i < ks.length; i++) if (khop(map[ks[i]]) === x || khop(ks[i]) === x) return ks[i];
    for (i = 0; i < ks.length; i++) if (x && khop(map[ks[i]]).indexOf(x) >= 0) return ks[i];
    return null;
  }

  function nhapExcel() {
    App.hop({
      tieuDe: 'Nhập nhân viên từ Excel', co: '',
      than: '<p>Chọn file <b>.xlsx</b> hoặc <b>.csv</b> có dòng tiêu đề (Mã NV, Họ và tên, Phòng ban, Lương cơ bản…). ' +
        'Nhân viên trùng <b>Mã NV</b> sẽ được cập nhật, mã mới sẽ được thêm. Phòng ban chưa có sẽ được tự tạo.</p>' +
        '<div class="hang"><input type="file" id="f-nv" accept=".xlsx,.csv,.txt"><button class="nut" id="tai-mau">' + App.icon('tai') + 'Tải file mẫu</button></div>' +
        '<div id="kq-nv" style="margin-top:12px"></div>',
      moRa: function (el, dong) {
        App.$('#tai-mau', el).onclick = taiMau;
        App.$('#f-nv', el).onchange = function () {
          var f = this.files[0]; if (!f) return;
          XL.docFile(f).then(function (sheets) { xuLyNhap(sheets[0].dong, el, dong); }).catch(function (e) { App.bao(e.message, 'loi'); });
        };
      },
      nut: [{ ten: 'Đóng' }]
    });
  }

  function xuLyNhap(rows, el, dongHop) {
    var cot = cotNV();
    // tìm dòng tiêu đề
    var hd = -1;
    for (var i = 0; i < Math.min(rows.length, 15); i++) {
      var r = (rows[i] || []).map(khop);
      if (r.some(function (c) { return c.indexOf('hovaten') >= 0 || c === 'hoten'; })) { hd = i; break; }
    }
    if (hd < 0) { App.$('#kq-nv', el).innerHTML = '<div class="canh-bao">Không tìm thấy dòng tiêu đề có cột “Họ và tên”.</div>'; return; }
    var map = {};
    (rows[hd] || []).forEach(function (t, ci) {
      var k = khop(t);
      if (!k) return;
      cot.forEach(function (c) { if (khop(c[1]) === k || khop(c[0]) === k) map[ci] = c; });
      if (!map[ci]) {
        if (k === 'ma' || k === 'manhanvien') map[ci] = cot[0];
        else if (k === 'hoten') map[ci] = cot[2];
        else if (k.indexOf('phucap') === 0 || k.indexOf('pc') === 0) {
          var ten = k.replace(/^phucap|^pc/, '');
          App.db.phuCap.forEach(function (p) { if (khop(p.ten) === ten || khop(p.ma) === ten) map[ci] = ['pc:' + p.ma, 'PC ' + p.ten, 12, 'so']; });
        }
      }
    });
    var moi = [], capNhat = [], loi = [], pbMoi = {};
    rows.slice(hd + 1).forEach(function (r, ri) {
      if (!r || !r.some(function (x) { return x != null && String(x).trim() !== ''; })) return;
      var v = { phuCap: {} };
      Object.keys(map).forEach(function (ci) {
        var c = map[ci], raw = r[ci], k = c[0];
        if (raw == null || String(raw).trim() === '') return;
        var val;
        switch (c[3]) {
          case 'ngay': val = App.chuanNgay(raw); break;
          case 'so': val = App.docSo(raw); break;
          case 'bool': val = /^(x|có|co|1|true|yes|v)$/i.test(String(raw).trim()); break;
          case 'lich': val = /t2\s*-\s*t6|thu 2.*thu 6|5 ngay/i.test(App.boDau(raw)) ? 'T2-T6' : /t2\s*-\s*t7|thu 2.*thu 7|6 ngay/i.test(App.boDau(raw)) ? 'T2-T7' : /cn|ca tuan/i.test(App.boDau(raw)) ? 'T2-CN' : ''; break;
          case 'tt': val = timTheoNhan(App.TRANG_THAI, raw) || 'dang_lam'; break;
          case 'ht': val = timTheoNhan(App.HINH_THUC, raw) || (/ngay|ngày/i.test(raw) ? 'ngay' : /gio|giờ/i.test(raw) ? 'gio' : 'thang'); break;
          case 'thue': val = /10|khau|khấu/i.test(raw) ? 'khau_tru' : /khong|không/i.test(raw) ? 'khong' : 'luy_tien'; break;
          case 'pb':
            var s = String(raw).trim(), pb = App.db.phongBan.filter(function (p) { return khop(p.ten) === khop(s) || khop(p.ma) === khop(s); })[0];
            if (!pb) { pb = pbMoi[khop(s)] || { ma: 'PB' + (App.db.phongBan.length + Object.keys(pbMoi).length + 1), ten: s }; pbMoi[khop(s)] = pb; }
            val = pb.ma; break;
          default: val = String(raw).trim();
        }
        if (k.indexOf('pc:') === 0) { if (val) v.phuCap[k.slice(3)] = val; } else v[k] = val;
      });
      if (!v.hoTen) { loi.push('Dòng ' + (hd + ri + 2) + ': thiếu họ tên'); return; }
      var cu = v.ma ? App.db.nhanVien.filter(function (x) { return String(x.ma).toLowerCase() === String(v.ma).toLowerCase(); })[0] : null;
      if (cu) capNhat.push([cu, v]); else moi.push(v);
    });
    App.$('#kq-nv', el).innerHTML = '<div class="goi-y">Đọc được <b>' + (moi.length + capNhat.length) + '</b> nhân viên: <b>' + moi.length + '</b> thêm mới, <b>' + capNhat.length + '</b> cập nhật' +
      (Object.keys(pbMoi).length ? ', tạo ' + Object.keys(pbMoi).length + ' phòng ban mới' : '') + '.' +
      (loi.length ? '<br><span style="color:var(--do)">' + loi.slice(0, 5).map(h).join('<br>') + (loi.length > 5 ? '<br>…' : '') + '</span>' : '') +
      '</div><div class="hang" style="margin-top:10px"><span class="gian"></span><button class="nut chinh" id="xn-nhap"' + (moi.length + capNhat.length ? '' : ' disabled') + '>Nhập vào phần mềm</button></div>';
    var b = App.$('#xn-nhap', el);
    if (b) b.onclick = function () {
      Object.keys(pbMoi).forEach(function (k) { App.db.phongBan.push(pbMoi[k]); });
      capNhat.forEach(function (x) { var pcCu = x[0].phuCap || {}; Object.assign(x[0], x[1]); x[0].phuCap = Object.assign({}, pcCu, x[1].phuCap); });
      moi.forEach(function (v) {
        App.db.nhanVien.push(Object.assign({
          id: App.uid(), ma: v.ma || maMoi(), hinhThuc: 'thang', tiLeHuong: 100, thamGiaBH: true, doanVien: false, cachTinhThue: 'luy_tien',
          soNPT: 0, trangThai: 'dang_lam', phuCap: {}
        }, v, { ma: v.ma || maMoi() }));
      });
      App.luu();
      App.bao('Đã nhập ' + (moi.length + capNhat.length) + ' nhân viên.', 'tot');
      dongHop();
      App.veLai();
    };
  }

  App.trang.nhanvien = { ve: ve, khongKy: true };
})();
