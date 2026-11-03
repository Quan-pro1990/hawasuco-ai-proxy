/* Trang Nhân viên: danh sách, thêm / sửa / xoá, nhập – xuất Excel */
(function () {
  'use strict';
  var App = window.App, TL = window.TL, XL = window.XL, h = App.h;

  App.HINH_THUC = { thang: 'Lương tháng', ngay: 'Lương ngày', gio: 'Lương giờ', khoan: 'Lương khoán' };
  App.DV_LUONG = { thang: 'đ/tháng', ngay: 'đ/ngày', gio: 'đ/giờ', khoan: 'đ/tháng' };
  App.TRANG_THAI = { dang_lam: 'Đang làm việc', thu_viec: 'Thử việc', tam_nghi: 'Tạm nghỉ', nghi_viec: 'Đã nghỉ việc' };
  App.CACH_THUE = { luy_tien: 'Lũy tiến từng phần', khau_tru: 'Khấu trừ 10%', khong: 'Không tính thuế' };
  App.LOAI_HD = ['Thử việc', 'Xác định thời hạn', 'Không xác định thời hạn', 'Thời vụ / khoán việc', 'Học việc'];
  App.moTaLoaiLD = function (l) {
    var nghi = (l.nghiTuan || []).slice().sort(function (a, b) { return (a || 7) - (b || 7); }).map(function (t) { return TL.TEN_THU[t]; }).join(', ');
    return (+l.congChuan > 0 ? App.so(l.congChuan) + ' công' : 'công theo lịch') + (nghi ? ', nghỉ ' + nghi : ', làm cả tuần');
  };
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

  var loc = { tim: '', pb: '', tt: 'dang' }, chon = {};

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
      '<select id="nv-pb">' + App.optDonVi(loc.pb, { tatCa: 'Tất cả phòng / đội', ngung: true }) + '</select>' +
      '<select id="nv-tt"><option value="dang"' + (loc.tt === 'dang' ? ' selected' : '') + '>Đang làm việc</option><option value="nghi"' + (loc.tt === 'nghi' ? ' selected' : '') + '>Đã nghỉ việc</option><option value=""' + (loc.tt === '' ? ' selected' : '') + '>Tất cả</option></select>' +
      '<span class="gian"></span>' +
      '<button class="nut" id="nv-chuyen" disabled title="Đánh dấu nhân viên ở cột đầu rồi bấm để chuyển sang phòng / đội khác">' + App.icon('chuyen') + 'Chuyển phòng / đội</button>' +
      '<button class="nut" id="nv-nhap">' + App.icon('nhap') + 'Nhập từ Excel</button>' +
      '<button class="nut" id="nv-xuat">' + App.icon('tai') + 'Xuất Excel</button>' +
      '<button class="nut chinh" id="nv-them">' + App.icon('them') + 'Thêm nhân viên</button>' +
      '</div></div>' +
      App.dauIn('DANH SÁCH NHÂN VIÊN', 'Ngày ' + new Date().toLocaleDateString('vi-VN')) +
      '<div class="cuon cao"><table class="bang" id="nv-bang"></table></div>' +
      '<p class="mo nho khong-in">Bấm vào một dòng để mở hồ sơ (lý lịch, hợp đồng, quá trình công tác, nghỉ phép, lương các kỳ). Mức lương theo hình thức trả lương (tháng, ngày hoặc giờ). Công chuẩn theo loại lao động (Danh mục → Loại lao động), vd văn phòng 22 công, công nhân 26 công.</p>';
    veBang();
    App.$('#nv-tim').oninput = function () { loc.tim = this.value; veBang(); };
    App.$('#nv-pb').onchange = function () { loc.pb = this.value; veBang(); };
    App.$('#nv-tt').onchange = function () { loc.tt = this.value; veBang(); };
    App.$('#nv-them').onclick = function () { location.hash = '#hoso?id=moi'; };
    App.$('#nv-xuat').onclick = xuatExcel;
    App.$('#nv-nhap').onclick = nhapExcel;
    App.$('#nv-bang').onclick = function (e) {
      var tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      var nv = App.db.nhanVien.filter(function (x) { return x.id === tr.dataset.id; })[0];
      if (e.target.closest('.chon-nv')) return;
      if (e.target.closest('.xoa')) { xoaNV(nv); return; }
      App.moHoSo(nv.id, 'canhan');
    };
    App.$('#nv-bang').onchange = function (e) {
      var c = e.target;
      if (c.id === 'nv-chon-het') { dsLoc().forEach(function (nv) { if (nv.trangThai !== 'nghi_viec') { if (c.checked) chon[nv.id] = 1; else delete chon[nv.id]; } }); veBang(); return; }
      var tr = c.closest('tr[data-id]'); if (!tr || !c.classList.contains('chon-nv')) return;
      if (c.checked) chon[tr.dataset.id] = 1; else delete chon[tr.dataset.id];
      capNhatNutChuyen();
    };
    App.$('#nv-chuyen').onclick = function () {
      var ds = App.db.nhanVien.filter(function (nv) { return chon[nv.id]; });
      if (!ds.length) return;
      App.hopChuyenDonVi(ds, { sauKhiChuyen: function () { chon = {}; App.veLai(); } });
    };
    capNhatNutChuyen();
  }

  function capNhatNutChuyen() {
    var ids = Object.keys(chon).filter(function (id) { return App.timNV(id); }), b = App.$('#nv-chuyen');
    if (!b) return;
    b.disabled = !ids.length;
    b.lastChild.textContent = ids.length ? 'Chuyển phòng / đội (' + ids.length + ')' : 'Chuyển phòng / đội';
  }

  function veBang() {
    var ds = dsLoc(), db = App.db;
    var conLam = ds.filter(function (nv) { return nv.trangThai !== 'nghi_viec'; });
    var het = conLam.length && conLam.every(function (nv) { return chon[nv.id]; });
    var html = '<thead><tr><th class="khong-in" title="Chọn để chuyển phòng / đội"><input type="checkbox" id="nv-chon-het"' + (het ? ' checked' : '') + '></th><th>STT</th><th>Mã NV</th><th style="min-width:170px">Họ và tên</th><th>Phòng / đội</th><th>Chức vụ</th><th>Ngày vào</th><th>Loại HĐ</th>' +
      '<th>Loại LĐ</th><th>Công chuẩn</th><th>Hình thức</th><th class="so">Mức lương</th><th class="so">Lương đóng BH</th><th>NPT</th><th>Hết hạn HĐ</th><th>Trạng thái</th><th class="khong-in"></th></tr></thead><tbody>';
    if (!ds.length) html += '<tr><td colspan="17" class="trong">' + (db.nhanVien.length ? 'Không có nhân viên phù hợp bộ lọc.' : 'Chưa có nhân viên. Bấm “Thêm nhân viên” hoặc “Nhập từ Excel”.') + '</td></tr>';
    ds.forEach(function (nv, i) {
      var tt = nv.trangThai || 'dang_lam';
      var lbh = nv.thamGiaBH ? (+nv.luongBH > 0 ? App.tien(nv.luongBH) : ((nv.hinhThuc || 'thang') === 'thang' || nv.hinhThuc === 'khoan' ? '<span class="mo" title="Lương CB + phụ cấp đóng BH">' + App.tien(luongBHMacDinh(nv)) + '</span>' : '<span class="the-tt cam">Chưa nhập</span>')) : '<span class="mo">Không tham gia</span>';
      html += '<tr data-id="' + nv.id + '" style="cursor:pointer"><td class="khong-in giua">' + (tt === 'nghi_viec' ? '' : '<input type="checkbox" class="chon-nv"' + (chon[nv.id] ? ' checked' : '') + '>') + '</td><td class="giua">' + (i + 1) + '</td><td>' + h(nv.ma) + '</td><td class="ten">' + h(nv.hoTen) + '</td>' +
        '<td>' + h(TL.tenPhongBan(db, nv.phongBan)) + '</td><td>' + h(nv.chucVu) + '</td><td class="giua">' + TL.hienNgay(nv.ngayVao) + '</td><td>' + h(nv.loaiHD || '') + '</td>' +
        '<td>' + h((TL.loaiLDNV(db, nv) || {}).ten || '') + '</td><td class="giua">' + App.so(TL.congChuan(db, App.ky.y, App.ky.m, nv)) + '</td><td>' + (App.HINH_THUC[nv.hinhThuc || 'thang']) + '</td><td class="so">' + App.tien(nv.luongCB) + (nv.tiLeHuong != null && +nv.tiLeHuong !== 100 ? ' <span class="the-tt cam">' + nv.tiLeHuong + '%</span>' : '') + '</td>' +
        '<td class="so">' + lbh + '</td><td class="giua">' + (TL.soNPTKy(nv, App.ky.y, App.ky.m) || '') + '</td>' +
        '<td class="giua">' + (nv.ngayHetHD ? TL.hienNgay(nv.ngayHetHD) + App.nhanHetHan(nv.ngayHetHD) : '') + '</td>' +
        '<td><span class="the-tt ' + ({ dang_lam: 'xanh', thu_viec: 'cam', tam_nghi: 'lam', nghi_viec: '' }[tt]) + '">' + App.TRANG_THAI[tt] + '</span></td>' +
        '<td class="khong-in"><button class="nut nho nguy xoa" title="Xoá">' + App.icon('xoa') + '</button></td></tr>';
    });
    html += '</tbody>';
    App.$('#nv-bang').innerHTML = html;
    capNhatNutChuyen();
  }

  function luongBHMacDinh(nv) {
    var s = +nv.luongCB || 0;
    App.db.phuCap.forEach(function (pc) { if (pc.dongBH) s += +(nv.phuCap || {})[pc.ma] || 0; });
    return s;
  }

  App.maMoi = maMoi;
  function maMoi() {
    var max = 0;
    App.db.nhanVien.forEach(function (nv) { var m = String(nv.ma).match(/(\d+)$/); if (m) max = Math.max(max, +m[1]); });
    return 'NV' + String(max + 1).padStart(3, '0');
  }

  /** Ô nhập tiền: tự thêm dấu chấm ngăn cách hàng nghìn khi rời ô */
  function ganOTien(i) {
    i.addEventListener('blur', function () { var n = App.docSo(i.value); i.value = n ? App.tien(n) : (/^\s*0+\s*$/.test(i.value) ? '0' : ''); });
    i.addEventListener('focus', function () { setTimeout(function () { i.select(); }, 0); });
  }
  App.ganOTien = ganOTien;

  App.xoaNV = xoaNV;
  function xoaNV(nv, sauKhiXoa) {
    var coDL = Object.keys(App.db.thang).some(function (k) { var T = App.db.thang[k]; return (T.cc && T.cc[nv.id] && Object.keys(T.cc[nv.id]).length) || (T.chot && T.chot.rows.some(function (r) { return r.nvId === nv.id; })); });
    var msg = 'Xoá nhân viên <b>' + h(nv.hoTen) + '</b> (' + h(nv.ma) + ')?' + (coDL ? '<br><br><span style="color:var(--do)">Nhân viên này đã có dữ liệu chấm công / lương. Nếu đã nghỉ việc, nên sửa trạng thái thành “Đã nghỉ việc” và nhập ngày nghỉ để giữ lịch sử. Xoá sẽ mất dữ liệu chấm công của người này (bảng lương các tháng đã chốt vẫn giữ).</span>' : '');
    App.xacNhan(msg, { nut: 'Xoá', nguy: true }).then(function (ok) {
      if (!ok) return;
      App.db.nhanVien = App.db.nhanVien.filter(function (x) { return x !== nv; });
      Object.keys(App.db.thang).forEach(function (k) { var T = App.db.thang[k]; ['cc', 'ot', 'muon', 'vr', 'dc'].forEach(function (f) { if (T[f]) delete T[f][nv.id]; }); });
      App.db.donNghi = (App.db.donNghi || []).filter(function (d) { return d.nvId !== nv.id; });
      App.luu(); if (sauKhiXoa) sauKhiXoa(); else veBang(); App.bao('Đã xoá ' + nv.hoTen);
    });
  }

  /* ---------- Excel ---------- */
  function cotNV() {
    var c = [
      ['ma', 'Mã NV', 9], ['maChamCong', 'Mã chấm công', 9], ['hoTen', 'Họ và tên', 24], ['gioiTinh', 'Giới tính', 8], ['ngaySinh', 'Ngày sinh', 11, 'ngay'],
      ['noiSinh', 'Nơi sinh', 16], ['queQuan', 'Quê quán', 18], ['danToc', 'Dân tộc', 8], ['tonGiao', 'Tôn giáo', 9], ['quocTich', 'Quốc tịch', 10], ['honNhan', 'Hôn nhân', 11],
      ['cccd', 'Số CCCD', 14], ['ngayCapCCCD', 'Ngày cấp CCCD', 11, 'ngay'], ['noiCapCCCD', 'Nơi cấp CCCD', 18],
      ['sdt', 'Điện thoại', 12], ['email', 'Email', 18], ['thuongTru', 'Địa chỉ thường trú', 26], ['diaChi', 'Chỗ ở hiện nay', 24],
      ['trinhDoHV', 'Học vấn', 7], ['trinhDoCM', 'Trình độ chuyên môn', 14], ['chuyenNganh', 'Chuyên ngành', 16], ['truongDT', 'Trường đào tạo', 18], ['namTN', 'Năm tốt nghiệp', 8],
      ['ngoaiNgu', 'Ngoại ngữ', 10], ['dangVien', 'Đảng viên', 7, 'bool'], ['soSoBHXH', 'Số sổ BHXH', 13], ['maTheBHYT', 'Mã thẻ BHYT', 15], ['noiKCB', 'Nơi KCB ban đầu', 18],
      ['phongBan', 'Phòng / đội', 22, 'pb'], ['chucVu', 'Chức vụ', 18], ['loaiHD', 'Loại hợp đồng', 16], ['ngayVao', 'Ngày vào làm', 11, 'ngay'],
      ['ngayHetHD', 'Ngày hết hạn HĐ', 11, 'ngay'], ['trangThai', 'Trạng thái', 13, 'tt'], ['ngayNghi', 'Ngày nghỉ việc', 11, 'ngay'],
      ['loaiLD', 'Loại lao động', 16, 'lld'], ['congChuanRieng', 'Công chuẩn riêng', 8, 'so'],
      ['hinhThuc', 'Hình thức lương', 13, 'ht'], ['luongCB', 'Mức lương', 13, 'so'], ['tiLeHuong', '% hưởng lương', 8, 'so'],
      ['maSP', 'Sản phẩm chính', 16, 'spm'], ['donGiaSP', 'Đơn giá SP riêng', 9, 'so'],
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
      case 'lld': var l = TL.loaiLDNV(App.db, { loaiLD: v }); return l ? l.ten : '';
      case 'spm': var sp = (App.db.sanPham || []).filter(function (x) { return x.ma === v; })[0]; return sp ? sp.ten : '';
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

  function timDM(ds, v) {
    var x = khop(v);
    var t = (ds || []).filter(function (d) { return khop(d.ten) === x || khop(d.ma) === x; })[0];
    return t ? t.ma : null;
  }

  function nhapExcel() {
    App.hop({
      tieuDe: 'Nhập nhân viên từ Excel', co: '',
      than: '<p>Chọn file <b>.xlsx</b> hoặc <b>.csv</b> có dòng tiêu đề (Mã NV, Họ và tên, Phòng / đội, Lương cơ bản…). ' +
        'Nhân viên trùng <b>Mã NV</b> sẽ được cập nhật, mã mới sẽ được thêm. Phòng / đội chưa có sẽ được tự tạo.</p>' +
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
        else if (['phongban', 'bophan', 'donvi', 'doi', 'phong'].indexOf(k) >= 0) map[ci] = cot.filter(function (c) { return c[0] === 'phongBan'; })[0];
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
          case 'lld': val = timDM(App.db.caiDat.loaiLD, raw) || (/van phong|vp/i.test(App.boDau(raw)) ? 'VP' : /cong nhan|cn/i.test(App.boDau(raw)) ? 'CN' : ''); break;
          case 'spm': val = timDM(App.db.sanPham, raw) || ''; break;
          case 'tt': val = timTheoNhan(App.TRANG_THAI, raw) || 'dang_lam'; break;
          case 'ht': val = timTheoNhan(App.HINH_THUC, raw) || (/ngay|ngày/i.test(raw) ? 'ngay' : /gio|giờ/i.test(raw) ? 'gio' : 'thang'); break;
          case 'thue': val = /10|khau|khấu/i.test(raw) ? 'khau_tru' : /khong|không/i.test(raw) ? 'khong' : 'luy_tien'; break;
          case 'pb':
            var s = String(raw).trim(), pb = App.db.phongBan.filter(function (p) { return khop(p.ten) === khop(s) || khop(p.ma) === khop(s); })[0];
            if (!pb) { pb = pbMoi[khop(s)] || { ma: 'PB' + (App.db.phongBan.length + Object.keys(pbMoi).length + 1), ten: s, loai: TL.loaiDonVi({ ten: s }) }; pbMoi[khop(s)] = pb; }
            val = pb.ma; break;
          default: val = String(raw).trim();
        }
        if (k.indexOf('pc:') === 0) v.phuCap[k.slice(3)] = val; else v[k] = val;
      });
      if (!v.hoTen) { loi.push('Dòng ' + (hd + ri + 2) + ': thiếu họ tên'); return; }
      var cu = v.ma ? App.db.nhanVien.filter(function (x) { return String(x.ma).toLowerCase() === String(v.ma).toLowerCase(); })[0] : null;
      if (cu) capNhat.push([cu, v]); else moi.push(v);
    });
    App.$('#kq-nv', el).innerHTML = '<div class="goi-y">Đọc được <b>' + (moi.length + capNhat.length) + '</b> nhân viên: <b>' + moi.length + '</b> thêm mới, <b>' + capNhat.length + '</b> cập nhật' +
      (Object.keys(pbMoi).length ? ', tạo ' + Object.keys(pbMoi).length + ' phòng / đội mới' : '') + '.' +
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
