/* Trang Danh mục (phòng ban, phụ cấp, ký hiệu chấm công, ngày lễ) và Cài đặt & dữ liệu */
(function () {
  'use strict';
  var App = window.App, TL = window.TL, h = App.h;
  var st = { tab: 'pb', namLe: new Date().getFullYear(), tabCD: 'cty' };

  function layPath(o, p) { return p.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function datPath(o, p, v) { var ks = p.split('.'), x = o; for (var i = 0; i < ks.length - 1; i++) { if (x[ks[i]] == null) x[ks[i]] = {}; x = x[ks[i]]; } x[ks[ks.length - 1]] = v; }

  /* ================= DANH MỤC ================= */
  var TABS_DM = [['pb', 'Phòng ban / bộ phận'], ['ld', 'Loại lao động & công chuẩn'], ['sp', 'Sản phẩm (lương SP)'], ['pc', 'Phụ cấp'], ['kh', 'Ký hiệu chấm công'], ['le', 'Ngày lễ, Tết']];

  function veDM(noi) {
    noi.innerHTML = '<div class="tabs">' + TABS_DM.map(function (t) { return '<button data-t="' + t[0] + '"' + (st.tab === t[0] ? ' class="chon"' : '') + '>' + t[1] + '</button>'; }).join('') + '</div><div id="dm-noi"></div>';
    App.$('.tabs', noi).onclick = function (e) { var b = e.target.closest('[data-t]'); if (b) { st.tab = b.dataset.t; App.veLai(); } };
    ({ pb: dmPB, ld: dmLD, sp: dmSP, pc: dmPC, kh: dmKH, le: dmLe })[st.tab](App.$('#dm-noi'));
  }

  function dmPB(el) {
    var db = App.db;
    var dem = {}; db.nhanVien.forEach(function (nv) { if (nv.trangThai !== 'nghi_viec') dem[nv.phongBan] = (dem[nv.phongBan] || 0) + 1; });
    el.innerHTML = '<div class="the"><h3>Phòng ban / bộ phận<span class="phai">Thứ tự ở đây là thứ tự trên bảng chấm công, bảng lương</span></h3>' +
      '<div class="cuon"><table class="bang"><thead><tr><th>STT</th><th>Mã</th><th style="min-width:280px">Tên phòng ban / bộ phận</th><th>Nhân viên</th><th></th></tr></thead><tbody>' +
      db.phongBan.map(function (p, i) {
        return '<tr data-i="' + i + '"><td class="giua">' + (i + 1) + '</td><td>' + h(p.ma) + '</td><td><input class="o-nhap chu" data-f="ten" value="' + h(p.ten) + '" style="width:100%"></td>' +
          '<td class="giua">' + (dem[p.ma] || 0) + '</td><td><button class="nut nho" data-a="len" title="Lên">▲</button> <button class="nut nho" data-a="xuong" title="Xuống">▼</button> <button class="nut nho nguy" data-a="xoa">' + App.icon('xoa') + '</button></td></tr>';
      }).join('') + (db.phongBan.length ? '' : '<tr><td colspan="5" class="trong">Chưa có phòng ban.</td></tr>') +
      '</tbody></table></div><div class="hang" style="margin-top:12px"><input id="pb-ma" placeholder="Mã (vd KD)" style="width:120px"><input id="pb-ten" placeholder="Tên phòng ban" style="width:300px"><button class="nut chinh" id="pb-them">' + App.icon('them') + 'Thêm</button></div></div>';
    el.onchange = function (e) {
      var i = e.target.closest('[data-f]'); if (!i) return;
      db.phongBan[+i.closest('tr').dataset.i].ten = i.value.trim(); App.luu(); App.bao('Đã lưu');
    };
    el.onclick = function (e) {
      var b = e.target.closest('[data-a]');
      if (b) {
        var i = +b.closest('tr').dataset.i, a = b.dataset.a, ds = db.phongBan;
        if (a === 'len' && i > 0) { ds.splice(i - 1, 0, ds.splice(i, 1)[0]); }
        else if (a === 'xuong' && i < ds.length - 1) { ds.splice(i + 1, 0, ds.splice(i, 1)[0]); }
        else if (a === 'xoa') {
          if (dem[ds[i].ma]) { App.bao('Phòng ban còn ' + dem[ds[i].ma] + ' nhân viên, hãy chuyển họ sang phòng khác trước.', 'loi'); return; }
          ds.splice(i, 1);
        }
        App.luu(); dmPB(el); return;
      }
      if (e.target.closest('#pb-them')) {
        var ma = App.$('#pb-ma').value.trim(), ten = App.$('#pb-ten').value.trim();
        if (!ten) { App.bao('Nhập tên phòng ban.', 'loi'); return; }
        if (!ma) ma = App.boDau(ten).split(/\s+/).map(function (w) { return w[0] || ''; }).join('').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'PB' + (db.phongBan.length + 1);
        if (db.phongBan.some(function (p) { return p.ma.toLowerCase() === ma.toLowerCase(); })) ma += db.phongBan.length + 1;
        db.phongBan.push({ ma: ma, ten: ten }); App.luu(); dmPB(el);
      }
    };
  }

  function dmLD(el) {
    var db = App.db, ds = db.caiDat.loaiLD;
    var dem = {}; db.nhanVien.forEach(function (nv) { if (nv.trangThai !== 'nghi_viec') dem[nv.loaiLD || ''] = (dem[nv.loaiLD || ''] || 0) + 1; });
    var thu = [1, 2, 3, 4, 5, 6, 0];
    el.innerHTML = '<div class="the"><h3>Loại lao động & công chuẩn</h3><p class="mo" style="margin-top:0">Lương thời gian = Mức lương ÷ <b>công chuẩn</b> × số công. ' +
      'Vd nhân viên văn phòng 22 công (nghỉ thứ 7, chủ nhật), công nhân 26 công (nghỉ chủ nhật). Để trống ô công chuẩn thì phần mềm đếm số ngày làm việc thực tế trong kỳ. ' +
      'Ngày nghỉ tuần dùng để tô màu bảng chấm công, “Chấm đủ công” và tính làm thêm ngày nghỉ (' + db.caiDat.heSoOT.nghi + '%).</p>' +
      '<div class="cuon"><table class="bang"><thead><tr><th>Mã</th><th style="min-width:220px">Tên loại lao động</th><th>Công chuẩn / tháng</th>' +
      thu.map(function (t) { return '<th>Nghỉ ' + TL.TEN_THU[t] + '</th>'; }).join('') + '<th>Nhân viên</th><th></th></tr></thead><tbody>' +
      ds.map(function (l, i) {
        return '<tr data-i="' + i + '"><td>' + h(l.ma) + '</td><td><input class="o-nhap chu" data-f="ten" value="' + h(l.ten) + '" style="width:100%"></td>' +
          '<td><input class="o-nhap" data-f="congChuan" value="' + (l.congChuan ? App.so(l.congChuan) : '') + '" placeholder="theo lịch" style="min-width:80px;width:90px"></td>' +
          thu.map(function (t) { return '<td class="giua"><input type="checkbox" data-nghi="' + t + '"' + ((l.nghiTuan || []).indexOf(t) >= 0 ? ' checked' : '') + '></td>'; }).join('') +
          '<td class="giua">' + (dem[l.ma] || 0) + '</td><td><button class="nut nho nguy" data-a="xoa">' + App.icon('xoa') + '</button></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="hang" style="margin-top:12px"><input id="ld-ten" placeholder="Tên loại mới (vd Bảo vệ, trực ca)" style="width:280px"><button class="nut chinh" id="ld-them">' + App.icon('them') + 'Thêm loại lao động</button></div>' +
      (dem[''] ? '<p class="mo nho">' + dem[''] + ' nhân viên chưa chọn loại lao động (đang dùng công chuẩn chung trong Cài đặt).</p>' : '') + '</div>';
    el.onchange = function (e) {
      var i = e.target, tr = i.closest('tr[data-i]'); if (!tr) return;
      var l = ds[+tr.dataset.i];
      if (i.dataset.nghi != null) {
        var t = +i.dataset.nghi, n = (l.nghiTuan || []).filter(function (x) { return x !== t; });
        if (i.checked) n.push(t);
        l.nghiTuan = n.sort();
      } else if (i.dataset.f === 'congChuan') l.congChuan = App.docSo(i.value) || '';
      else l.ten = i.value.trim();
      App.luu(); App.bao('Đã lưu'); dmLD(el);
    };
    el.onclick = function (e) {
      var b = e.target.closest('[data-a="xoa"]');
      if (b) {
        var l = ds[+b.closest('tr').dataset.i];
        if (dem[l.ma]) { App.bao('Còn ' + dem[l.ma] + ' nhân viên thuộc loại này, hãy chuyển họ sang loại khác trước.', 'loi'); return; }
        db.caiDat.loaiLD = ds.filter(function (x) { return x !== l; }); App.luu(); dmLD(el); return;
      }
      if (e.target.closest('#ld-them')) {
        var ten = App.$('#ld-ten').value.trim(); if (!ten) { App.bao('Nhập tên loại lao động.', 'loi'); return; }
        var ma = App.boDau(ten).split(/\s+/).map(function (w) { return w[0] || ''; }).join('').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'LD';
        while (ds.some(function (x) { return x.ma === ma; })) ma += '1';
        ds.push({ ma: ma, ten: ten, congChuan: 26, nghiTuan: [0] }); App.luu(); dmLD(el);
      }
    };
  }

  function dmSP(el) {
    var db = App.db, ds = db.sanPham;
    var dem = {}; db.nhanVien.forEach(function (nv) { if (nv.trangThai !== 'nghi_viec') { var m = nv.maSP || (ds[0] && ds[0].ma); dem[m] = (dem[m] || 0) + 1; } });
    el.innerHTML = '<div class="the"><h3>Sản phẩm / công việc tính lương sản phẩm</h3><p class="mo" style="margin-top:0">Lương sản phẩm = số lượng × đơn giá. ' +
      'Mỗi nhân viên có 1 <b>sản phẩm chính</b> (chọn trong hồ sơ, có thể đặt đơn giá riêng); số lượng nhập hằng tháng ở <b>Bảng lương</b>. ' +
      'Người làm nhiều loại sản phẩm trong tháng: bấm nút “…” cạnh ô số lượng để nhập từng loại.</p>' +
      '<div class="hang" style="margin-bottom:10px">' + o('Hiện cột “Lương sản phẩm” trên bảng lương', 'caiDat.luongSP', 'bool') + '</div>' +
      '<div class="cuon"><table class="bang"><thead><tr><th>Mã</th><th style="min-width:240px">Tên sản phẩm / công việc</th><th>Đơn vị tính</th><th class="so">Đơn giá (đ)</th><th>Là SP chính của</th><th></th></tr></thead><tbody>' +
      ds.map(function (p, i) {
        return '<tr data-i="' + i + '"><td>' + h(p.ma) + '</td><td><input class="o-nhap chu" data-f="ten" value="' + h(p.ten) + '" style="width:100%"></td>' +
          '<td><input class="o-nhap chu" data-f="dvt" value="' + h(p.dvt || '') + '" style="min-width:70px;width:90px"></td>' +
          '<td><input class="o-nhap" data-f="donGia" value="' + App.tien(p.donGia) + '"></td><td class="giua">' + (dem[p.ma] || 0) + ' người</td>' +
          '<td><button class="nut nho nguy" data-a="xoa">' + App.icon('xoa') + '</button></td></tr>';
      }).join('') + (ds.length ? '' : '<tr><td colspan="6" class="trong">Chưa có sản phẩm.</td></tr>') + '</tbody></table></div>' +
      '<div class="hang" style="margin-top:12px"><input id="sp-ten" placeholder="Tên (vd Lắp đặt đồng hồ nước)" style="width:260px"><input id="sp-dvt" placeholder="ĐVT (vd cái)" style="width:110px">' +
      '<input id="sp-gia" class="so" placeholder="Đơn giá" style="width:130px"><button class="nut chinh" id="sp-them">' + App.icon('them') + 'Thêm sản phẩm</button></div></div>';
    App.$$('input.o-nhap:not(.chu)', el).forEach(App.ganOTien);
    el.onchange = function (e) {
      var i = e.target;
      if (i.dataset.p) { datPath(App.db, i.dataset.p, i.checked); App.luu(); App.bao('Đã lưu'); return; }
      var tr = i.closest('tr[data-i]'); if (!tr || !i.dataset.f) return;
      var p = ds[+tr.dataset.i];
      p[i.dataset.f] = i.dataset.f === 'donGia' ? App.docSo(i.value) : i.value.trim();
      App.luu(); App.bao('Đã lưu');
    };
    el.onclick = function (e) {
      var b = e.target.closest('[data-a="xoa"]');
      if (b) {
        var p = ds[+b.closest('tr').dataset.i];
        App.xacNhan('Xoá sản phẩm <b>' + h(p.ten) + '</b>? Số lượng đã nhập của sản phẩm này ở các kỳ chưa chốt sẽ không còn được tính.', { nut: 'Xoá', nguy: true }).then(function (ok) {
          if (!ok) return; db.sanPham = ds.filter(function (x) { return x !== p; }); App.luu(); dmSP(el);
        });
        return;
      }
      if (e.target.closest('#sp-them')) {
        var ten = App.$('#sp-ten').value.trim(); if (!ten) { App.bao('Nhập tên sản phẩm.', 'loi'); return; }
        var ma = App.boDau(ten).split(/\s+/).map(function (w) { return w[0] || ''; }).join('').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'SP';
        while (ds.some(function (x) { return x.ma === ma; })) ma += '1';
        ds.push({ ma: ma, ten: ten, dvt: App.$('#sp-dvt').value.trim(), donGia: App.docSo(App.$('#sp-gia').value) }); App.luu(); dmSP(el);
      }
    };
  }

  function dmPC(el) {
    var db = App.db;
    el.innerHTML = '<div class="the"><h3>Các khoản phụ cấp</h3><p class="mo" style="margin-top:0"><b>Mức chung</b> áp dụng cho mọi nhân viên (vd cơm trưa 50.000 đ/ngày); ' +
      'ai hưởng mức khác thì nhập mức riêng trong hồ sơ nhân viên (nhập 0 = không hưởng). ' +
      '<b>Đơn giá × ngày đi làm</b>: mức × số ngày có đi làm (gồm ngày SP và ngày đi làm vào ngày lễ; ngày nghỉ lễ L, nghỉ phép, ốm… không tính). <b>Theo ngày công</b>: mức tháng × công hưởng lương ÷ công chuẩn.</p>' +
      '<div class="cuon"><table class="bang"><thead><tr><th>Mã</th><th style="min-width:180px">Tên phụ cấp</th><th>Cách tính</th><th class="so">Mức chung (đ)</th><th>Chịu thuế TNCN</th><th>Tính vào lương đóng BH</th><th style="min-width:200px">Ghi chú</th><th></th></tr></thead><tbody>' +
      db.phuCap.map(function (p, i) {
        return '<tr data-i="' + i + '"><td>' + h(p.ma) + '</td><td><input class="o-nhap chu" data-f="ten" value="' + h(p.ten) + '" style="width:100%"></td>' +
          '<td><select data-f="cachTinh">' + Object.keys(App.CACH_PC).map(function (k) { return '<option value="' + k + '"' + (p.cachTinh === k ? ' selected' : '') + '>' + App.CACH_PC[k] + '</option>'; }).join('') + '</select></td>' +
          '<td><input class="o-nhap" data-f="mucChung" value="' + (p.mucChung ? App.tien(p.mucChung) : '') + '" placeholder="theo từng người" title="' + (p.cachTinh === 'theo_ngay' ? 'Đơn giá 1 ngày' : 'Mức 1 tháng') + '"></td>' +
          '<td class="giua"><input type="checkbox" data-f="chiuThue"' + (p.chiuThue ? ' checked' : '') + '></td><td class="giua"><input type="checkbox" data-f="dongBH"' + (p.dongBH ? ' checked' : '') + '></td>' +
          '<td><input class="o-nhap chu" data-f="ghiChu" value="' + h(p.ghiChu || '') + '" style="width:100%"></td><td><button class="nut nho nguy" data-a="xoa">' + App.icon('xoa') + '</button></td></tr>';
      }).join('') + '</tbody></table></div><div class="hang" style="margin-top:12px"><input id="pc-ten" placeholder="Tên phụ cấp mới (vd Độc hại)" style="width:280px"><button class="nut chinh" id="pc-them">' + App.icon('them') + 'Thêm phụ cấp</button></div></div>';
    App.$$('input[data-f="mucChung"]', el).forEach(App.ganOTien);
    el.onchange = function (e) {
      var i = e.target.closest('[data-f]'); if (!i) return;
      var p = db.phuCap[+i.closest('tr').dataset.i];
      p[i.dataset.f] = i.type === 'checkbox' ? i.checked : i.dataset.f === 'mucChung' ? (App.docSo(i.value) || '') : i.value;
      App.luu(); App.bao('Đã lưu');
      if (i.dataset.f === 'cachTinh') dmPC(el);
    };
    el.onclick = function (e) {
      var b = e.target.closest('[data-a="xoa"]');
      if (b) {
        var p = db.phuCap[+b.closest('tr').dataset.i];
        App.xacNhan('Xoá phụ cấp <b>' + h(p.ten) + '</b>? Mức phụ cấp này trong hồ sơ nhân viên sẽ không còn được tính (các kỳ đã chốt không đổi).', { nut: 'Xoá', nguy: true }).then(function (ok) {
          if (!ok) return; db.phuCap = db.phuCap.filter(function (x) { return x !== p; }); App.luu(); dmPC(el);
        });
        return;
      }
      if (e.target.closest('#pc-them')) {
        var ten = App.$('#pc-ten').value.trim(); if (!ten) { App.bao('Nhập tên phụ cấp.', 'loi'); return; }
        var ma = App.boDau(ten).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'PC';
        while (db.phuCap.some(function (x) { return x.ma === ma; })) ma += '1';
        db.phuCap.push({ ma: ma, ten: ten, cachTinh: 'co_dinh', chiuThue: true, dongBH: false, ghiChu: '' }); App.luu(); dmPC(el);
      }
    };
  }

  function dmKH(el) {
    var db = App.db, cd = db.caiDat;
    var opt = function (v) { return db.kyHieu.map(function (k) { return '<option' + (k.ma === v ? ' selected' : '') + '>' + h(k.ma) + '</option>'; }).join(''); };
    el.innerHTML = '<div class="the"><h3>Ký hiệu chấm công</h3><p class="mo" style="margin-top:0">Theo mẫu 01a-LĐTL. <b>Công làm việc</b> và <b>công nghỉ có lương</b> tính theo ngày (1 = cả ngày, 0,5 = nửa ngày). ' +
      'Ký hiệu có đánh dấu <b>Lương SP</b> chỉ hưởng lương sản phẩm (số lượng × đơn giá): không hưởng lương thời gian, không nhân hệ số ngày lễ, nhưng vẫn tính ngày ăn cơm. <b>Trừ phép</b>: trừ vào số ngày phép năm.</p>' +
      '<div class="hang" style="margin-bottom:12px">Ký hiệu đi làm cả ngày <select data-cd="khDiLam">' + opt(cd.khDiLam) + '</select> nửa ngày <select data-cd="khNuaNgay">' + opt(cd.khNuaNgay) + '</select> ngày lễ <select data-cd="khLe">' + opt(cd.khLe) + '</select>' +
      '<span class="mo nho">(dùng khi “Chấm đủ công” và khi đọc giờ vào / ra)</span></div>' +
      '<div class="cuon"><table class="bang"><thead><tr><th>Ký hiệu</th><th style="min-width:240px">Ý nghĩa</th><th>Công làm việc</th><th>Công nghỉ có lương</th><th>Nhóm</th><th>Lương SP</th><th>Trừ phép</th><th></th></tr></thead><tbody>' +
      db.kyHieu.map(function (k, i) {
        return '<tr data-i="' + i + '"><td><input class="o-nhap chu" data-f="ma" value="' + h(k.ma) + '" style="min-width:60px;width:70px;text-align:center;font-weight:700;background:var(--k-' + k.nhom + ')"></td>' +
          '<td><input class="o-nhap chu" data-f="ten" value="' + h(k.ten) + '" style="width:100%"></td>' +
          '<td><input class="o-nhap" data-f="lam" value="' + App.so(k.lam) + '" style="min-width:60px;width:70px"></td><td><input class="o-nhap" data-f="huong" value="' + App.so(k.huong) + '" style="min-width:60px;width:70px"></td>' +
          '<td><select data-f="nhom">' + Object.keys(TL.NHOM_KY_HIEU).map(function (n) { return '<option value="' + n + '"' + (k.nhom === n ? ' selected' : '') + '>' + TL.NHOM_KY_HIEU[n] + '</option>'; }).join('') + '</select></td>' +
          '<td class="giua"><input type="checkbox" data-f="sp"' + (k.sp ? ' checked' : '') + '></td><td class="giua"><input type="checkbox" data-f="phep"' + (k.phep ? ' checked' : '') + '></td>' +
          '<td><button class="nut nho" data-a="len">▲</button> <button class="nut nho" data-a="xuong">▼</button> <button class="nut nho nguy" data-a="xoa">' + App.icon('xoa') + '</button></td></tr>';
      }).join('') + '</tbody></table></div><div class="hang" style="margin-top:12px"><button class="nut chinh" id="kh-them">' + App.icon('them') + 'Thêm ký hiệu</button><span class="gian"></span><button class="nut" id="kh-goc">Khôi phục danh sách mặc định</button></div></div>';
    el.onchange = function (e) {
      var s = e.target.closest('[data-cd]');
      if (s) { cd[s.dataset.cd] = s.value; App.luu(); App.bao('Đã lưu'); return; }
      var i = e.target.closest('[data-f]'); if (!i) return;
      var k = db.kyHieu[+i.closest('tr').dataset.i], f = i.dataset.f;
      if (f === 'ma') {
        var v = i.value.trim();
        if (!v || db.kyHieu.some(function (x) { return x !== k && x.ma.toUpperCase() === v.toUpperCase(); })) { App.bao('Ký hiệu trống hoặc bị trùng.', 'loi'); i.value = k.ma; return; }
        App.bao('Lưu ý: các ô đã chấm bằng ký hiệu cũ “' + k.ma + '” sẽ không còn được hiểu. Nên đổi trước khi bắt đầu chấm công.');
        k.ma = v;
      } else if (f === 'lam' || f === 'huong') k[f] = Math.max(0, Math.min(1, App.docSo(i.value)));
      else if (i.type === 'checkbox') k[f] = i.checked;
      else k[f] = i.value;
      App.luu(); dmKH(el);
    };
    el.onclick = function (e) {
      var b = e.target.closest('[data-a]');
      if (b) {
        var i = +b.closest('tr').dataset.i, a = b.dataset.a, ds = db.kyHieu;
        if (a === 'len' && i > 0) ds.splice(i - 1, 0, ds.splice(i, 1)[0]);
        else if (a === 'xuong' && i < ds.length - 1) ds.splice(i + 1, 0, ds.splice(i, 1)[0]);
        else if (a === 'xoa') ds.splice(i, 1);
        App.luu(); dmKH(el); return;
      }
      if (e.target.closest('#kh-them')) { var ma = 'K' + (db.kyHieu.length + 1); db.kyHieu.push({ ma: ma, ten: 'Ký hiệu mới', lam: 0, huong: 0, nhom: 'khong' }); App.luu(); dmKH(el); }
      if (e.target.closest('#kh-goc')) App.xacNhan('Thay danh sách ký hiệu hiện tại bằng danh sách mặc định theo mẫu 01a-LĐTL?', { nut: 'Khôi phục' }).then(function (ok) {
        if (!ok) return; db.kyHieu = TL.kyHieuMacDinh(); App.luu(); dmKH(el);
      });
    };
  }

  function dmLe(el) {
    var db = App.db, y = st.namLe;
    var ds = db.ngayLe.map(function (x, i) { return { x: x, i: i }; }).filter(function (o) { return o.x.ngay.slice(0, 4) === String(y); }).sort(function (a, b) { return a.x.ngay < b.x.ngay ? -1 : 1; });
    el.innerHTML = '<div class="the"><h3>Ngày lễ, Tết năm <select id="le-nam">' + [y - 2, y - 1, y, y + 1, y + 2].map(function (n) { return '<option' + (n === y ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select>' +
      '<span class="phai">Nghỉ lễ (L) = 1 công · đi làm (+) ngày lễ = ' + App.so(db.caiDat.heSoCongLe) + ' công, ngày Tết = ' + App.so(db.caiDat.heSoCongTet) + ' công · làm SP không nhân · cơm tính 1 ngày</span></h3>' +
      '<div class="cuon"><table class="bang"><thead><tr><th>Ngày</th><th>Thứ</th><th style="min-width:320px">Tên ngày lễ</th><th>Loại</th><th></th></tr></thead><tbody>' +
      (ds.length ? ds.map(function (o) {
        var n = TL.docNgay(o.x.ngay);
        var lo = TL.loaiNgayLe(o.x);
        return '<tr data-i="' + o.i + '"><td class="giua">' + TL.hienNgay(o.x.ngay) + '</td><td class="giua">' + TL.TEN_THU_DAY[TL.thuTrongTuan(n.y, n.m, n.d)] + '</td><td>' + h(o.x.ten) + '</td>' +
          '<td><select data-loai><option value="le"' + (lo === 'le' ? ' selected' : '') + '>Lễ – đi làm ×' + App.so(db.caiDat.heSoCongLe) + ' công</option><option value="tet"' + (lo === 'tet' ? ' selected' : '') + '>Tết – đi làm ×' + App.so(db.caiDat.heSoCongTet) + ' công</option></select></td>' +
          '<td><button class="nut nho nguy" data-a="xoa">' + App.icon('xoa') + '</button></td></tr>';
      }).join('') : '<tr><td colspan="5" class="trong">Chưa có ngày lễ của năm ' + y + '. Bấm “Tạo tự động”.</td></tr>') +
      '</tbody></table></div><div class="hang" style="margin-top:12px"><input type="date" id="le-ngay"><input id="le-ten" placeholder="Tên ngày lễ / ngày nghỉ (vd Nghỉ hoán đổi Tết)" style="width:300px">' +
      '<select id="le-loai"><option value="le">Lễ (×' + App.so(db.caiDat.heSoCongLe) + ')</option><option value="tet">Tết (×' + App.so(db.caiDat.heSoCongTet) + ')</option></select><button class="nut" id="le-them">' + App.icon('them') + 'Thêm ngày</button>' +
      '<span class="gian"></span><button class="nut chinh" id="le-tao">Tạo tự động năm ' + y + '</button></div>' +
      '<p class="mo nho">Tạo tự động gồm: Tết Dương lịch, Tết Âm lịch (ngày cuối năm + mùng 1–4, tính theo lịch âm), Giỗ Tổ 10/3 âm lịch, 30/4, 1/5, Quốc khánh 2/9 + 1 ngày liền kề' + (y >= 2026 ? ', Ngày Văn hóa Việt Nam 24/11' : '') +
      ' và ngày nghỉ bù khi trùng ngày nghỉ hằng tuần. Các ngày Tết Nguyên đán được đặt loại <b>Tết</b>, còn lại là <b>Lễ</b> (sửa được ở cột Loại). Lịch nghỉ hoán đổi do Chính phủ thông báo từng năm – hãy kiểm tra và thêm / xoá cho đúng.</p></div>';
    App.$('#le-nam', el).onchange = function () { st.namLe = +this.value; dmLe(el); };
    el.onchange = function (e) {
      var s = e.target.closest('[data-loai]'); if (!s) return;
      db.ngayLe[+s.closest('tr').dataset.i].loai = s.value; App.luu(); App.bao('Đã lưu');
    };
    el.onclick = function (e) {
      var b = e.target.closest('[data-a="xoa"]');
      if (b) { db.ngayLe.splice(+b.closest('tr').dataset.i, 1); App.luu(); dmLe(el); return; }
      if (e.target.closest('#le-them')) {
        var ng = App.$('#le-ngay').value, ten = App.$('#le-ten').value.trim() || 'Ngày nghỉ';
        if (!ng) { App.bao('Chọn ngày.', 'loi'); return; }
        if (db.ngayLe.some(function (x) { return x.ngay === ng; })) { App.bao('Ngày này đã có trong danh sách.', 'loi'); return; }
        db.ngayLe.push({ ngay: ng, ten: ten, loai: App.$('#le-loai').value }); st.namLe = +ng.slice(0, 4); App.luu(); dmLe(el); return;
      }
      if (e.target.closest('#le-tao')) {
        App.xacNhan('Tạo lại danh sách ngày lễ năm ' + y + '? Các ngày lễ năm ' + y + ' hiện có sẽ được thay thế.', { nut: 'Tạo' }).then(function (ok) {
          if (!ok) return;
          db.ngayLe = db.ngayLe.filter(function (x) { return x.ngay.slice(0, 4) !== String(y); }).concat(TL.taoNgayLe(y, db.caiDat));
          App.luu(); dmLe(el); App.bao('Đã tạo ngày lễ năm ' + y, 'tot');
        });
      }
    };
  }

  /* ================= CÀI ĐẶT ================= */
  var TABS_CD = [['cty', 'Đơn vị & chữ ký'], ['cong', 'Kỳ công & giờ làm'], ['luong', 'Lương & làm thêm'], ['bh', 'Bảo hiểm & công đoàn'], ['thue', 'Thuế TNCN'], ['dl', 'Sao lưu dữ liệu']];
  var LTTV = { I: 5310000, II: 4730000, III: 4140000, IV: 3700000 };

  function o(nhan, p, kieu, gc, attr) {
    var v = layPath(App.db, p), inp;
    if (kieu === 'bool') return '<label class="chk"><input type="checkbox" data-p="' + p + '" data-k="bool"' + (v ? ' checked' : '') + '> ' + nhan + '</label>';
    if (kieu === 'tien') inp = '<input class="so tien" data-p="' + p + '" data-k="so" value="' + (v ? App.tien(v) : '') + '" inputmode="numeric">';
    else if (kieu === 'so') inp = '<input class="so" data-p="' + p + '" data-k="so" value="' + (v == null ? '' : App.so(v)) + '" inputmode="decimal"' + (attr || '') + '>';
    else if (kieu === 'gio') inp = '<input type="time" data-p="' + p + '" data-k="chu" value="' + h(v || '') + '">';
    else if (Array.isArray(kieu)) inp = '<select data-p="' + p + '" data-k="' + (typeof kieu[0][0] === 'number' ? 'so' : 'chu') + '">' + kieu.map(function (x) { return '<option value="' + x[0] + '"' + (String(v) === String(x[0]) ? ' selected' : '') + '>' + h(x[1]) + '</option>'; }).join('') + '</select>';
    else inp = '<input data-p="' + p + '" data-k="chu" value="' + h(v == null ? '' : v) + '"' + (attr || '') + '>';
    return '<label class="o">' + nhan + inp + (gc ? '<span class="gc">' + gc + '</span>' : '') + '</label>';
  }

  function veCD(noi) {
    noi.innerHTML = '<div class="tabs">' + TABS_CD.map(function (t) { return '<button data-t="' + t[0] + '"' + (st.tabCD === t[0] ? ' class="chon"' : '') + '>' + t[1] + '</button>'; }).join('') + '</div><div id="cd-noi"></div>';
    App.$('.tabs', noi).onclick = function (e) { var b = e.target.closest('[data-t]'); if (b) { st.tabCD = b.dataset.t; App.veLai(); } };
    var el = App.$('#cd-noi'), db = App.db, cd = db.caiDat, html = '';
    switch (st.tabCD) {
      case 'cty':
        html = '<div class="the"><h3>Thông tin đơn vị</h3><div class="form">' +
          o('Tên đơn vị', 'congTy.ten', 'chu') + o('Mã số thuế', 'congTy.mst', 'chu') +
          o('Địa chỉ', 'congTy.diaChi', 'chu') + o('Điện thoại', 'congTy.dienThoai', 'chu') +
          o('Địa danh (nơi lập biểu)', 'congTy.diaDanh', 'chu', 'In ở dòng “…, ngày … tháng … năm …”, vd Cần Thơ') +
          o('Mẫu biểu ban hành theo', 'congTy.thongTu', [['133', 'Thông tư 133/2016/TT-BTC (DN nhỏ và vừa)'], ['200', 'Thông tư 200/2014/TT-BTC']]) +
          o('Tiêu đề bảng lương', 'congTy.tieuDeBangLuong', 'chu', 'vd BẢNG THANH TOÁN TIỀN LƯƠNG VĂN PHÒNG CÔNG TY') + '<span></span>' +
          '<h4>Người ký trên bảng lương, phiếu lương</h4>' +
          o('Người lập biểu', 'congTy.nguoiLap', 'chu') + o('Kế toán trưởng', 'congTy.keToan', 'chu') + o('Giám đốc', 'congTy.giamDoc', 'chu') + '<span></span>' +
          '<h4>Người ký trên bảng chấm công (mẫu 01a-LĐTL)</h4>' +
          o('Người chấm công', 'congTy.nguoiChamCong', 'chu') + o('Phụ trách bộ phận', 'congTy.phuTrachBP', 'chu') + o('Người duyệt', 'congTy.nguoiDuyet', 'chu') +
          '</div></div>';
        break;
      case 'cong':
        var thu = [1, 2, 3, 4, 5, 6, 0];
        html = '<div class="the"><h3>Kỳ công & ngày công chuẩn</h3><div class="form">' +
          o('Kỳ công bắt đầu từ ngày', 'caiDat.ngayDauKy', [[1, 'Ngày 1 – chấm công theo tháng dương lịch']].concat(Array.from({ length: 27 }, function (_, i) { return [i + 2, 'Ngày ' + (i + 2) + ' tháng trước đến ngày ' + (i + 1) + ' tháng này']; })),
            'Vd chọn ngày 21: bảng chấm công tháng 10 tính từ 21/9 đến 20/10') +
          o('Không trả lương thời gian quá công chuẩn', 'caiDat.gioiHanCong', 'bool') +
          '<div class="ca goi-y">Công chuẩn đặt theo <b>loại lao động</b> ở <a href="#danhmuc">Danh mục → Loại lao động</a>: ' +
          (cd.loaiLD || []).map(function (l) { return '<b>' + h(l.ten) + '</b> ' + App.moTaLoaiLD(l); }).join('; ') + '. ' +
          'Các ô dưới đây chỉ dùng cho nhân viên chưa chọn loại lao động.</div>' +
          o('Cách tính công chuẩn (chung)', 'caiDat.congChuan.cach', [['theo_thang', 'Theo lịch: số ngày trong kỳ trừ ngày nghỉ tuần'], ['co_dinh', 'Cố định số ngày']]) +
          o('Số công chuẩn cố định (chung)', 'caiDat.congChuan.soNgay', 'so', 'Chỉ dùng khi chọn “Cố định”, vd 26') +
          o('Số giờ làm 1 ngày', 'caiDat.gioLamNgay', 'so') +
          '<div class="ca"><div class="mo nho" style="margin-bottom:6px">Ngày nghỉ hằng tuần (chung – cho nhân viên chưa chọn loại lao động)</div><div class="hang">' +
          thu.map(function (t) { return '<label class="chk"><input type="checkbox" data-nghi="' + t + '"' + (cd.nghiTuan.indexOf(t) >= 0 ? ' checked' : '') + '> ' + TL.TEN_THU_DAY[t] + '</label>'; }).join('') + '</div></div>' +
          o('Thứ bảy làm nửa ngày (0,5 công chuẩn)', 'caiDat.nuaNgayT7', 'bool') +
          o('Số ngày phép năm mặc định', 'caiDat.phepNam', 'so') +
          '</div><p class="mo nho">Kỳ ' + App.tenKy(App.ky.y, App.ky.m).toLowerCase() + ' (' + TL.hienNgay(TL.batDauKy(db, App.ky.y, App.ky.m)) + ' – ' + TL.hienNgay(TL.ketThucKy(db, App.ky.y, App.ky.m)) + '): ' +
          (cd.loaiLD || []).map(function (l) { return h(l.ten) + ' <b>' + App.so(TL.congChuan(db, App.ky.y, App.ky.m, { loaiLD: l.ma })) + '</b> công'; }).join(' · ') +
          ' · chung <b>' + App.so(TL.congChuan(db, App.ky.y, App.ky.m)) + '</b> công.</p></div>' +
          '<div class="the"><h3>Giờ làm việc (dùng khi đọc dữ liệu máy chấm công)</h3><div class="form ba">' +
          o('Giờ vào', 'caiDat.gioVao', 'gio') + o('Giờ ra', 'caiDat.gioRa', 'gio') + o('Giờ ra thứ bảy (nếu làm nửa ngày)', 'caiDat.gioRaT7', 'gio') +
          o('Nghỉ trưa từ', 'caiDat.nghiTruaTu', 'gio') + o('Nghỉ trưa đến', 'caiDat.nghiTruaDen', 'gio') + o('Cho phép đi muộn / về sớm (phút)', 'caiDat.phutChoPhep', 'so') +
          o('Đủ công khi làm từ (giờ)', 'caiDat.nguongCaNgay', 'so') + o('Nửa công khi làm từ (giờ)', 'caiDat.nguongNuaNgay', 'so') + '<span></span>' +
          o('Tính làm thêm khi ra muộn từ (phút)', 'caiDat.otToiThieuPhut', 'so') + o('Làm tròn giờ làm thêm (phút)', 'caiDat.otLamTronPhut', 'so') +
          '</div></div>';
        break;
      case 'luong':
        html = '<div class="the"><h3>Lương sản phẩm</h3><div class="form">' +
          o('Có lương sản phẩm (cột “Lương sản phẩm” trên bảng lương)', 'caiDat.luongSP', 'bool') +
          '<div class="mo">Đơn giá từng sản phẩm: <a href="#danhmuc">Danh mục → Sản phẩm</a> (' + (db.sanPham || []).map(function (p) { return h(p.ten) + ' ' + App.tien(p.donGia) + ' đ/' + h(p.dvt || 'đv'); }).join('; ') + ').</div>' +
          '</div></div>' +
          '<div class="the"><h3>Làm thêm giờ, ngừng việc</h3><div class="form ba">' +
          o('Làm thêm ngày thường (%)', 'caiDat.heSoOT.thuong', 'so') + o('Làm thêm ngày nghỉ tuần (%)', 'caiDat.heSoOT.nghi', 'so') + o('Làm thêm ngày lễ, Tết (%)', 'caiDat.heSoOT.le', 'so') +
          o('Lương ngày nghỉ / ngừng việc (ký hiệu N) (%)', 'caiDat.tiLeNgungViec', 'so') +
          o('Đi làm (lương thời gian) ngày lễ được tính (công)', 'caiDat.heSoCongLe', 'so', 'Mặc định 2 công; nghỉ lễ (L) vẫn 1 công; làm SP không nhân') +
          o('Đi làm (lương thời gian) ngày Tết được tính (công)', 'caiDat.heSoCongTet', 'so', 'Mặc định 3 công; tiền cơm vẫn tính 1 ngày') +
          '</div><p class="mo nho">Theo Bộ luật Lao động 2019: làm thêm ngày thường ít nhất 150%, ngày nghỉ hằng tuần 200%, ngày lễ 300% (chưa kể lương ngày lễ). Phần chênh lệch so với lương giờ bình thường không chịu thuế TNCN.</p></div>' +
          '<div class="the"><h3>Khác</h3><div class="form ba">' +
          o('Làm tròn số tiền lãnh', 'caiDat.lamTron', [[1, 'Không làm tròn'], [100, 'Đến 100 đ'], [1000, 'Đến 1.000 đ']]) +
          o('Phạt đi muộn / về sớm mỗi lần (đ)', 'caiDat.phatMuonMoiLan', 'tien') + o('Phạt mỗi phút (đ)', 'caiDat.phatMuonMoiPhut', 'tien') +
          '</div></div>';
        break;
      case 'bh':
        html = '<div class="the"><h3>Tỷ lệ đóng (%)</h3><div class="form ba">' +
          '<h4>Người lao động</h4>' + o('BHXH', 'caiDat.bh.nv.bhxh', 'so') + o('BHYT', 'caiDat.bh.nv.bhyt', 'so') + o('BHTN', 'caiDat.bh.nv.bhtn', 'so') +
          o('Đoàn phí công đoàn (đoàn viên)', 'caiDat.bh.doanPhi', 'so', 'Tính trên lương đóng BHXH, tối đa 10% lương cơ sở') + '<span></span><span></span>' +
          '<h4>Doanh nghiệp</h4>' + o('BHXH (gồm ốm đau – thai sản, TNLĐ-BNN)', 'caiDat.bh.dn.bhxh', 'so') + o('BHYT', 'caiDat.bh.dn.bhyt', 'so') + o('BHTN', 'caiDat.bh.dn.bhtn', 'so') +
          o('Kinh phí công đoàn', 'caiDat.bh.dn.kpcd', 'so') +
          '</div></div><div class="the"><h3>Mức lương làm căn cứ</h3><div class="form ba">' +
          o('Lương cơ sở (đ/tháng)', 'caiDat.luongCoSo', 'tien', 'Trần đóng BHXH, BHYT = 20 × lương cơ sở = ' + App.tien(20 * cd.luongCoSo)) +
          o('Vùng lương tối thiểu', 'caiDat.vung', [['I', 'Vùng I'], ['II', 'Vùng II'], ['III', 'Vùng III'], ['IV', 'Vùng IV']], 'Chọn vùng sẽ điền mức lương tối thiểu năm 2026') +
          o('Lương tối thiểu vùng (đ/tháng)', 'caiDat.luongToiThieuVung', 'tien', 'Trần đóng BHTN = 20 × lương tối thiểu vùng = ' + App.tien(20 * cd.luongToiThieuVung)) +
          o('Không đóng BH khi nghỉ không lương từ (ngày)', 'caiDat.nguongNghiKhongDongBH', 'so') +
          '</div><p class="mo nho">Mặc định: lương cơ sở 2.530.000 đ (từ 01/7/2026), lương tối thiểu vùng theo Nghị định 293/2025/NĐ-CP (vùng I 5.310.000 đ). Khi Nhà nước điều chỉnh, sửa lại ở đây rồi tính lại các kỳ chưa chốt.</p></div>';
        break;
      case 'thue':
        html = '<div class="the"><h3>Giảm trừ gia cảnh</h3><div class="form">' +
          o('Giảm trừ bản thân (đ/tháng)', 'caiDat.giamTruBanThan', 'tien') + o('Giảm trừ mỗi người phụ thuộc (đ/tháng)', 'caiDat.giamTruNPT', 'tien') +
          o('Thuế suất khấu trừ (HĐ dưới 3 tháng) (%)', 'caiDat.thueKhauTru', 'so') + o('Khấu trừ khi thu nhập từ (đ)', 'caiDat.nguongKhauTru', 'tien') +
          '</div></div><div class="the"><h3>Biểu thuế lũy tiến từng phần (thu nhập tính thuế / tháng)</h3><div class="cuon" style="max-width:520px"><table class="bang" id="bieu-thue"><thead><tr><th>Bậc</th><th class="so">Đến (đ)</th><th class="so">Thuế suất (%)</th><th></th></tr></thead><tbody>' +
          cd.bieuThue.map(function (b, i) {
            return '<tr data-i="' + i + '"><td class="giua">' + (i + 1) + '</td><td><input class="o-nhap" data-b="den" value="' + (b.den ? App.tien(b.den) : '') + '" placeholder="trở lên"></td><td><input class="o-nhap" data-b="ts" value="' + App.so(b.ts) + '"></td><td><button class="nut nho nguy" data-a="xoa">' + App.icon('xoa') + '</button></td></tr>';
          }).join('') + '</tbody></table></div><div class="hang" style="margin-top:10px"><button class="nut" id="bt-them">' + App.icon('them') + 'Thêm bậc</button><button class="nut" id="bt-goc">Khôi phục biểu 5 bậc (Luật Thuế TNCN 2025)</button></div>' +
          '<p class="mo nho">Mặc định theo Luật Thuế TNCN số 109/2025/QH15, áp dụng cho thu nhập từ tiền lương, tiền công từ kỳ tính thuế 2026: đến 10 triệu 5%, 10–30 triệu 10%, 30–60 triệu 20%, 60–100 triệu 30%, trên 100 triệu 35%; giảm trừ bản thân 15,5 triệu, người phụ thuộc 6,2 triệu. Bậc cuối để trống ô “Đến”.</p></div>';
        break;
      case 'dl':
        var kb = Math.round(JSON.stringify(db).length / 1024);
        html = '<div class="the"><h3>Sao lưu & khôi phục</h3><p style="margin-top:0">Dữ liệu được lưu tự động trong trình duyệt của máy này (' + App.so(kb) + ' KB). Nếu xoá lịch sử trình duyệt hoặc đổi máy sẽ mất, nên <b>sao lưu ra file mỗi tuần</b> (chép vào USB, Google Drive…). ' +
          (db.lanSaoLuu ? 'Lần sao lưu gần nhất: <b>' + new Date(db.lanSaoLuu).toLocaleString('vi-VN') + '</b>.' : '<b style="color:var(--do)">Chưa sao lưu lần nào.</b>') + '</p>' +
          '<div class="hang"><button class="nut chinh" id="dl-luu">' + App.icon('tai') + 'Sao lưu ra file</button><label class="nut">' + App.icon('nhap') + 'Khôi phục từ file…<input type="file" id="dl-mo" accept=".json" class="an"></label></div>' +
          '<p class="mo nho">Khôi phục sẽ thay toàn bộ dữ liệu hiện tại bằng dữ liệu trong file sao lưu. Muốn dùng trên máy khác: sao lưu ở máy này rồi khôi phục ở máy kia.</p></div>' +
          '<div class="the"><h3>Làm lại từ đầu</h3><div class="hang"><button class="nut" id="dl-mau">Nạp lại dữ liệu mẫu</button><button class="nut nguy" id="dl-xoa">' + App.icon('xoa') + 'Xoá toàn bộ dữ liệu</button></div>' +
          '<p class="mo nho">Cả hai thao tác đều xoá dữ liệu hiện tại – hãy sao lưu trước.</p></div>';
        break;
    }
    el.innerHTML = html;
    App.$$('input.tien', el).forEach(App.ganOTien);
    el.onchange = function (e) {
      var i = e.target;
      if (i.dataset.nghi != null) {
        var t = +i.dataset.nghi, ds = cd.nghiTuan.filter(function (x) { return x !== t; });
        if (i.checked) ds.push(t);
        cd.nghiTuan = ds.sort(); App.luu(); App.bao('Đã lưu'); return;
      }
      if (i.dataset.b) {
        var b = cd.bieuThue[+i.closest('tr').dataset.i];
        if (i.dataset.b === 'den') b.den = App.docSo(i.value) || null; else b.ts = App.docSo(i.value);
        App.luu(); App.bao('Đã lưu'); return;
      }
      if (i.id === 'dl-mo') { khoiPhuc(i.files[0]); return; }
      var p = i.dataset.p; if (!p) return;
      var v = i.dataset.k === 'bool' ? i.checked : i.dataset.k === 'so' ? App.docSo(i.value) : i.value;
      datPath(App.db, p, v);
      if (p === 'caiDat.vung' && LTTV[v]) { cd.luongToiThieuVung = LTTV[v]; }
      App.luu(); App.bao('Đã lưu');
      if (p === 'caiDat.ngayDauKy') { try { sessionStorage.removeItem('ChamCong_ky'); } catch (er) { /* bỏ qua */ } App.ky = App.kyMacDinh(); }
      if (/^caiDat\.(vung|ngayDauKy|congChuan|luongCoSo|luongToiThieuVung)/.test(p) || p === 'congTy.ten') App.veLai();
    };
    el.onclick = function (e) {
      if (e.target.closest('[data-a="xoa"]') && e.target.closest('#bieu-thue')) { cd.bieuThue.splice(+e.target.closest('tr').dataset.i, 1); App.luu(); App.veLai(); return; }
      if (e.target.closest('#bt-them')) { cd.bieuThue.push({ den: null, ts: 35 }); App.luu(); App.veLai(); return; }
      if (e.target.closest('#bt-goc')) { cd.bieuThue = TL.caiDatMacDinh().bieuThue; App.luu(); App.veLai(); return; }
      if (e.target.closest('#dl-luu')) { saoLuu(); return; }
      if (e.target.closest('#dl-mau')) {
        App.xacNhan('Xoá dữ liệu hiện tại và nạp lại dữ liệu mẫu?', { nut: 'Nạp dữ liệu mẫu', nguy: true }).then(function (ok) {
          if (!ok) return; App.db = App.taoMau(); App.luuNgay(); App.ky = App.kyMacDinh(); App.veLai(); App.bao('Đã nạp dữ liệu mẫu', 'tot');
        });
        return;
      }
      if (e.target.closest('#dl-xoa')) {
        App.xacNhan('<b>Xoá toàn bộ dữ liệu</b> (nhân viên, chấm công, bảng lương, cài đặt)? Không thể hoàn tác nếu chưa sao lưu.', { nut: 'Xoá hết', nguy: true }).then(function (ok) {
          if (!ok) return; App.db = TL.duLieuMoi(); App.luuNgay(); App.veLai(); App.bao('Đã xoá toàn bộ dữ liệu');
        });
      }
    };
  }

  function saoLuu() {
    App.db.lanSaoLuu = new Date().toISOString();
    App.luuNgay();
    var d = new Date(), ten = 'SaoLuu_ChamCong_' + d.getFullYear() + TL.pad(d.getMonth() + 1) + TL.pad(d.getDate()) + '_' + TL.pad(d.getHours()) + TL.pad(d.getMinutes()) + '.json';
    App.XL.taiXuong(ten, new Blob([JSON.stringify(App.db)], { type: 'application/json' }));
    App.bao('Đã sao lưu: ' + ten, 'tot');
    App.veLai();
  }

  function khoiPhuc(f) {
    if (!f) return;
    f.text().then(function (s) {
      var d = JSON.parse(s);
      if (!d || !Array.isArray(d.nhanVien) || !d.caiDat) throw new Error('File không phải bản sao lưu của phần mềm này.');
      return App.xacNhan('Khôi phục từ file <b>' + h(f.name) + '</b> (' + d.nhanVien.length + ' nhân viên, ' + Object.keys(d.thang || {}).length + ' tháng dữ liệu)? Dữ liệu hiện tại sẽ bị thay thế.', { nut: 'Khôi phục', nguy: true }).then(function (ok) {
        if (!ok) return;
        App.db = TL.chuanHoa(d); App.luuNgay(); App.ky = App.kyMacDinh(); App.veLai(); App.bao('Đã khôi phục dữ liệu', 'tot');
      });
    }).catch(function (e) { App.bao('Không đọc được file: ' + e.message, 'loi'); });
  }

  App.trang.danhmuc = { ve: veDM, khongKy: true };
  App.trang.caidat = { ve: veCD, khongKy: true };
})();
