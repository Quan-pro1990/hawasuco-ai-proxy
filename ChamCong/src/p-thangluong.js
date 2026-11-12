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
  App.moTaBac = function (b, g, bac, ky) {
    var gt = TL.giaTriBac(App.db, b, g, bac, ky);
    if (!gt) return 'Bậc ' + bac;
    return 'Bậc ' + bac + ' – ' + (gt.heSo != null ? 'hệ số ' + App.soHS(gt.heSo) + ' = ' : '') + App.tien(gt.tien) + ' đ';
  };
  /** "Chuyên viên, bậc 3/8 (hệ số 3,00)" */
  App.moTaXepLuong = function (nv) {
    var xl = TL.xepLuongNV(App.db, nv);
    if (!xl) return '';
    return xl.ngach.ten + ', bậc ' + xl.bac + '/' + xl.soBac + (xl.heSo != null ? ' (hệ số ' + App.soHS(xl.heSo) + ')' : '');
  };

  /** Thẻ "Theo Quy chế trả lương của công ty" ở Danh mục → Thang, bảng lương */
  function theQuyChe() {
    var QC = TL.QUY_CHE_LUONG, co = App.db.thangLuong.some(function (x) { return x.quyChe === QC.so; });
    return '<div class="the the-qc"><h3>Theo Quy chế trả lương của công ty<span class="phai">QĐ ' + h(QC.so) + ' ngày ' + TL.hienNgay(QC.ngay) + ' · áp dụng từ kỳ lương tháng ' + QC.tuKy.slice(5) + '/' + QC.tuKy.slice(0, 4) + '</span></h3>' +
      '<p class="mo nho" style="margin:0 0 8px">' + h(QC.ten) + ' (thay QĐ ' + h(QC.thay) + '): <b>bảng lương quản lý, chuyên môn, nghiệp vụ thừa hành, phục vụ</b> (mã C01–C03, D01–D06) và ' +
      '<b>bảng lương công nhân, nhân viên trực tiếp sản xuất kinh doanh, phục vụ</b> (mã A01–A03). Mức lương trong thang là mức ghi trên hợp đồng, dùng trả lương thời gian và làm căn cứ đóng BHXH, BHYT, BHTN; ' +
      'niên hạn nâng lương 3 năm.</p><div class="hang"><button class="nut' + (co ? '' : ' chinh') + '" id="tl-quyche">' + App.icon(co ? 'chuyen' : 'nhap') + (co ? 'Cập nhật lại theo quy chế' : 'Nạp thang bảng lương theo quy chế') + '</button>' +
      (co ? '<a class="nut chinh" href="#nangbac" id="tl-xepqc">' + App.icon('bac') + 'Chuyển xếp lương nhân viên theo quy chế…</a>' : '') + '</div></div>';
  }

  /** Chuyển xếp lương nhân viên sang thang bảng lương theo quy chế (Điều 9): lập quyết định có hiệu lực từ kỳ lương tháng 5/2026,
      các kỳ trước giữ lương cũ; bảo lưu thời gian nâng bậc. */
  App.chuyenXepQuyChe = function () {
    var db = App.db, QC = TL.QUY_CHE_LUONG, bangQC = db.thangLuong.filter(function (x) { return x.quyChe === QC.so; });
    if (!bangQC.length) { App.bao('Chưa có thang bảng lương theo quy chế – vào Danh mục → Thang, bảng lương bấm “Nạp thang bảng lương theo quy chế”.', 'loi'); return; }
    var hl0 = TL.batDauKy(db, +QC.tuKy.slice(0, 4), +QC.tuKy.slice(5)), maQC = bangQC.map(function (b) { return b.ma; });
    var optCD = bangQC.map(function (b) { return '<optgroup label="' + h(b.ten) + '">' + b.ngach.map(function (g) { var t = g.ma + ' – ' + g.ten; return '<option value="' + h(b.ma + '|' + g.ma) + '" title="' + h(t) + '">' + h(t.length > 48 ? t.slice(0, 46) + '…' : t) + '</option>'; }).join('') + '</optgroup>'; }).join('');
    var ds = db.nhanVien.filter(function (nv) { return nv.trangThai !== 'nghi_viec'; }).sort(function (a, b) { return String(a.ma).localeCompare(String(b.ma), 'vi', { numeric: true }); });
    var rows = ds.map(function (nv) {
      var cu = TL.xepLuongNV(db, nv), da = nv.xepLuong && maQC.indexOf(nv.xepLuong.bang) >= 0, gy = da ? { bang: nv.xepLuong.bang, ngach: nv.xepLuong.ngach, bac: +nv.xepLuong.bac, lyDo: 'đã xếp theo quy chế' } : TL.goiYXepQuyChe(db, nv);
      var thang = (nv.hinhThuc || 'thang') === 'thang' || nv.hinhThuc === 'khoan', chon = gy && !da && thang;
      return '<tr data-id="' + nv.id + '"><td class="giua"><input type="checkbox" data-c' + (chon ? ' checked' : '') + (da ? ' disabled' : '') + '></td><td>' + h(nv.ma) + '</td><td>' + h(nv.hoTen) + '<div class="mo nho">' + h(nv.chucVu || '') + (nv.trinhDoCM ? ' · ' + h(nv.trinhDoCM) : '') + '</div></td>' +
        '<td class="nho" style="white-space:normal;max-width:170px">' + (cu ? h(cu.ngach.ten) + ', bậc ' + cu.bac : '<span class="mo">chưa xếp</span>') + '<div>' + App.tien(nv.luongCB) + (thang ? '' : ' <span class="mo">' + h(App.DV_LUONG[nv.hinhThuc] || '') + '</span>') + '</div></td>' +
        '<td><select data-g style="max-width:270px"' + (da ? ' disabled' : '') + '>' + optCD.replace('value="' + h(gy ? gy.bang + '|' + gy.ngach : '') + '"', 'value="' + h(gy ? gy.bang + '|' + gy.ngach : '') + '" selected') + '</select><div class="mo nho" style="white-space:normal;max-width:270px">' + h(gy ? gy.lyDo : 'chưa gợi ý được') + '</div></td>' +
        '<td><select data-b' + (da ? ' disabled' : '') + '></select></td><td class="so" data-m></td></tr>';
    }).join('');
    var hop = App.hop({
      tieuDe: 'Chuyển xếp lương theo ' + QC.ten, co: 'rong', khongFocus: true,
      than: '<div class="form ba"><label class="o">Số quyết định<input name="so" value="' + h(QC.so) + '"></label>' +
        '<label class="o">Ngày hiệu lực<input type="date" name="hieuLuc" value="' + hl0 + '"><span class="gc">Mặc định đầu kỳ lương tháng ' + QC.tuKy.slice(5) + '/' + QC.tuKy.slice(0, 4) + ' (Điều 15 quy chế); các kỳ trước giữ lương cũ</span></label>' +
        '<label class="chk" style="align-self:end"><input type="checkbox" name="baoLuu" checked> Bảo lưu thời gian nâng bậc (Điều 9 khoản 3c)</label></div>' +
        '<p class="mo nho">Gợi ý theo Điều 9: chức danh theo chức vụ (nhân viên văn phòng theo trình độ chuyên môn); quản lý C01–D02 giữ bậc cũ, còn lại căn cứ mức lương cũ – bậc thấp nhất không thấp hơn lương cũ. ' +
        'Kiểm tra, sửa từng dòng rồi bấm <b>Lập quyết định</b>: mỗi người 1 quyết định chuyển xếp lương, mức lương và lương đóng BH lấy theo bậc mới.</p>' +
        '<div class="cuon" style="max-height:52vh"><table class="bang"><thead><tr><th><input type="checkbox" data-tatca checked></th><th>Mã NV</th><th>Họ tên, chức vụ</th><th>Đang xếp · mức lương</th><th>Chức danh theo quy chế</th><th>Bậc</th><th class="so">Mức mới</th></tr></thead><tbody>' + rows + '</tbody></table></div>',
      giu: true,
      nut: [{ ten: 'Huỷ' }, { ten: 'Lập quyết định', loai: 'chinh', bam: function (el) {
        var so = el.querySelector('[name=so]').value.trim(), hl = el.querySelector('[name=hieuLuc]').value, baoLuu = el.querySelector('[name=baoLuu]').checked;
        if (!hl) { App.bao('Chọn ngày hiệu lực.', 'loi'); return false; }
        var ky = TL.kyCuaISO(db, hl), xong = 0, loi = [];
        Array.prototype.forEach.call(el.querySelectorAll('tr[data-id]'), function (tr) {
          if (!tr.querySelector('[data-c]').checked) return;
          var nv = App.timNV(tr.dataset.id), v = tr.querySelector('[data-g]').value.split('|'), bac = +tr.querySelector('[data-b]').value;
          var b = TL.timBangLuong(db, v[0]), g = TL.timNgach(b, v[1]), gt = g ? TL.giaTriBac(db, b, g, bac, ky) : null;
          if (!gt) { loi.push(nv.hoTen + ': chưa chọn chức danh, bậc'); return; }
          var thang = (nv.hinhThuc || 'thang') === 'thang' || nv.hinhThuc === 'khoan';
          var e = App.themNangLuong(nv, { so: so, ngay: QC.ngay, hieuLuc: hl, luongMoi: thang ? gt.tien : +nv.luongCB || 0, luongBHMoi: gt.tien,
            xepLuongMoi: { bang: b.ma, ngach: g.ma, bac: bac, ngayHuong: baoLuu && nv.xepLuong && nv.xepLuong.ngayHuong ? nv.xepLuong.ngayHuong : hl },
            noiDung: 'Chuyển xếp lương theo ' + QC.ten + ' (QĐ ' + QC.so + '): ' + g.ma + ' – ' + g.ten + ', bậc ' + bac });
          if (e) loi.push(nv.hoTen + ': ' + e); else xong++;
        });
        App.luu(); App.veLai();
        App.bao('Đã lập ' + xong + ' quyết định chuyển xếp lương.' + (loi.length ? ' ' + loi.length + ' người chưa chuyển được.' : ''), loi.length ? 'loi' : 'tot');
        if (loi.length) App.thongBao ? App.thongBao(loi.join('<br>')) : App.hop({ tieuDe: 'Chưa chuyển được', than: '<ul><li>' + loi.map(h).join('</li><li>') + '</li></ul>', nut: [{ ten: 'Đóng' }] });
      } }]
    });
    var nen = hop.el;
    function capNhatDong(tr) {
      var v = tr.querySelector('[data-g]').value.split('|'), b = TL.timBangLuong(db, v[0]), g = TL.timNgach(b, v[1]), sb = tr.querySelector('[data-b]');
      var bacCu = +sb.value || +(sb.dataset.goiy || 1), n = g ? TL.soBacNgach(g) : 0, ky = TL.kyCuaISO(db, nen.querySelector('[name=hieuLuc]').value || hl0), s = '';
      for (var k = 1; k <= n; k++) s += '<option value="' + k + '"' + (k === Math.min(bacCu, n) ? ' selected' : '') + '>Bậc ' + ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][k - 1] + '</option>';
      sb.innerHTML = s;
      var gt = g ? TL.giaTriBac(db, b, g, +sb.value, ky) : null;
      tr.querySelector('[data-m]').innerHTML = gt ? '<b>' + App.tien(gt.tien) + '</b>' : '';
    }
    Array.prototype.forEach.call(nen.querySelectorAll('tr[data-id]'), function (tr) {
      var nv = App.timNV(tr.dataset.id), da = nv.xepLuong && maQC.indexOf(nv.xepLuong.bang) >= 0, gy = da ? { bac: +nv.xepLuong.bac } : TL.goiYXepQuyChe(db, nv);
      tr.querySelector('[data-b]').dataset.goiy = gy ? gy.bac : 1;
      capNhatDong(tr);
    });
    nen.addEventListener('change', function (e) {
      var tr = e.target.closest('tr[data-id]');
      if (e.target.hasAttribute('data-tatca')) { Array.prototype.forEach.call(nen.querySelectorAll('[data-c]:not(:disabled)'), function (c) { c.checked = e.target.checked; }); return; }
      if (e.target.name === 'hieuLuc') { Array.prototype.forEach.call(nen.querySelectorAll('tr[data-id]'), capNhatDong); return; }
      if (tr && (e.target.hasAttribute('data-g') || e.target.hasAttribute('data-b'))) capNhatDong(tr);
    });
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
      'Bảng lương thay đổi từ một tháng (bậc, lương cơ sở, tiền cơm, tạm ứng): dùng trang <a href="#mucluong">Mức lương theo kỳ</a> – các kỳ trước giữ mức cũ.</p>' +
      '<div style="margin-top:10px"><div class="mo nho" style="margin-bottom:4px">Giá trị các bậc bên dưới là của mức:</div>' + App.ML.thanh(false) + '</div></div>' +
      theQuyChe() +
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
        App.ML.ghiBac(b, g, k, v || ''); apLai = true;
      } else if (f === 'ten') { if (!i.value.trim()) { veLai(); return; } b.ten = i.value.trim(); }
      else if (f === 'apDung') { b.apDung = i.value; apLai = true; }
      else if (f === 'mucCoSo') { App.ML.ghiMucCoSo(b, App.docSo(i.value) || ''); apLai = true; }
      else if (f === 'namNang') { b.namNang = docHS(i.value) || 3; }
      else if (f === 'gten') { if (!i.value.trim()) { veLai(); return; } g.ten = i.value.trim(); }
      else if (f === 'gnam') { g.namNang = docHS(i.value) || ''; }
      else if (f === 'kieu') {
        var n = dsXep(b.ma).length;
        if (n) { App.bao('Bảng đang xếp cho ' + n + ' nhân viên – không đổi kiểu được. Tạo bảng mới nếu cần.', 'loi'); veLai(); return; }
        var coGT = b.ngach.some(function (x) { return x.bac.some(function (v) { return +v > 0; }); }) || App.db.dotLuong.some(function (d) { return d.bang && d.bang[b.ma]; });
        var doiKieu = function () { b.kieu = i.value; b.ngach.forEach(function (x) { x.bac = x.bac.map(function () { return ''; }); }); App.ML.xoaGiaTri(b); App.luu(); veLai(); };
        if (coGT) App.xacNhan('Đổi kiểu bảng sẽ xoá giá trị các bậc đã nhập. Tiếp tục?', { nut: 'Đổi kiểu', nguy: true }).then(function (ok) { if (ok) doiKieu(); else veLai(); });
        else doiKieu();
        return;
      } else return;
      App.luu();
      if (apLai) App.apDungBangLuong(b.ma);
      if (i.dataset.bac != null || f === 'mucCoSo' || f === 'apDung') veLai(); else App.bao('Đã lưu');
    };

    el.onclick = function (e) {
      var cm = e.target.closest('[data-muc]');
      if (cm) { App.ML.datChon(cm.dataset.muc); veLai(); return; }
      if (e.target.closest('#tl-quyche')) {
        var QC = TL.QUY_CHE_LUONG, co = ds.some(function (x) { return x.quyChe === QC.so; });
        App.xacNhan((co ? 'Cập nhật lại' : 'Nạp') + ' 2 bảng lương theo <b>' + h(QC.ten) + '</b> (Quyết định ' + h(QC.so) + ' ngày ' + TL.hienNgay(QC.ngay) + ')?<br>' +
          'Bảng quản lý, chuyên môn, nghiệp vụ, phục vụ (C01–C03, D01–D06) và bảng công nhân, nhân viên trực tiếp (A01–A03); mức tiền đúng phụ lục, dùng cho mức lương và lương đóng BH, nâng bậc 3 năm. ' +
          'Các bảng lương khác giữ nguyên.' + (co ? '<br><b>Giá trị bậc đang sửa tay của 2 bảng này sẽ trở về đúng quy chế.</b>' : ''), { nut: co ? 'Cập nhật' : 'Nạp' }).then(function (ok) {
          if (!ok) return;
          var kq = TL.apDungThangLuongQuyChe(App.db);
          App.luu(); if (App.apDungBangLuong) App.apDungBangLuong(null, true); veLai();
          App.bao((kq.them ? 'Đã nạp ' + kq.them + ' bảng lương' : 'Đã cập nhật ' + kq.capNhat + ' bảng lương') + ' theo quy chế. Tiếp theo: Xếp lương, nâng bậc → Chuyển xếp theo quy chế.', 'tot');
        });
        return;
      }
      if (e.target.closest('#tl-them')) {
        var ten = App.$('#tl-ten').value.trim();
        if (!ten) { App.bao('Nhập tên bảng lương.', 'loi'); App.$('#tl-ten').focus(); return; }
        var ma = 'BL1', n = 1; while (ds.some(function (x) { return x.ma === ma; })) ma = 'BL' + (++n);
        ds.push(TL.chuanBangLuong({ ma: ma, ten: ten, kieu: App.$('#tl-kieu').value, apDung: App.$('#tl-apdung').value, namNang: 3, soBac: 3, ngach: [] }));
        App.luu(); veLai(); App.bao('Đã thêm ' + ten + '. Thêm chức danh và nhập giá trị từng bậc.', 'tot');
        return;
      }
      var a = e.target.closest('[data-a]'); if (!a) return;
      var b = bang(a); if (!b) return;
      var g = ngach(a, b), act = a.dataset.a;
      if (act === 'tachngach' && g) { tachNgach(b, g, veLai); return; }
      if (act === 'thembacg' && g) {
        if (g.soBac >= 20) return;
        g.soBac++; TL.chuanBangLuong(b); App.luu(); veLai();
        App.bao(g.ten + ': ' + g.soBac + ' bậc. Nhập giá trị bậc ' + g.soBac + (App.db.dotLuong.length ? ' (cho mức đang chọn và các mức theo kỳ cần áp dụng)' : '') + '.', 'tot');
        return;
      }
      if (act === 'botbacg' && g) {
        if (g.soBac <= 1) return;
        var nbg = dsXep(b.ma, g.ma, g.soBac).length;
        if (nbg) { App.bao('Bậc ' + g.soBac + ' của “' + g.ten + '” đang xếp cho ' + nbg + ' nhân viên – hãy xếp họ sang bậc khác (trang Xếp lương, nâng bậc) rồi mới bớt.', 'loi'); return; }
        var k0 = g.soBac - 1, coGT = +g.bac[k0] > 0 || App.db.dotLuong.some(function (d) { var x = d.bang && d.bang[b.ma] && d.bang[b.ma].ngach && d.bang[b.ma].ngach[g.ma]; return x && +x[k0] > 0; });
        var bot = function () {
          g.bac[k0] = '';
          App.db.dotLuong.forEach(function (d) { var x = d.bang && d.bang[b.ma] && d.bang[b.ma].ngach && d.bang[b.ma].ngach[g.ma]; if (x && x.length > k0) x[k0] = ''; });
          g.soBac--; TL.chuanBangLuong(b); App.ML.botBac(b); App.luu(); veLai(); App.bao(g.ten + ': còn ' + g.soBac + ' bậc.', 'tot');
        };
        if (coGT) App.xacNhan('Bớt <b>bậc ' + g.soBac + '</b> của “' + h(g.ten) + '”? Giá trị bậc này (ở mọi mức áp dụng) sẽ bị xoá.', { nut: 'Bớt bậc', nguy: true }).then(function (ok) { if (ok) bot(); });
        else bot();
        return;
      }
      if (act === 'xoabang') {
        var n1 = dsXep(b.ma).length;
        if (n1) { App.bao('Bảng “' + b.ten + '” đang xếp cho ' + n1 + ' nhân viên. Hãy xếp họ sang bảng khác (trang Xếp lương, nâng bậc) rồi mới xoá.', 'loi'); return; }
        App.xacNhan('Xoá bảng lương <b>' + h(b.ten) + '</b>?', { nut: 'Xoá', nguy: true }).then(function (ok) { if (ok) { ds.splice(ds.indexOf(b), 1); App.ML.xoaBang(b); App.luu(); veLai(); } });
        return;
      }
      if (act === 'themngach') {
        var card = a.closest('[data-b]'), iMa = App.$('[data-f="mamoi"]', card), iTen = App.$('[data-f="tenmoi"]', card);
        var ten2 = iTen.value.trim(), ma2 = iMa.value.trim();
        if (!ten2) { App.bao('Nhập tên chức danh / nhóm công việc.', 'loi'); iTen.focus(); return; }
        if (!ma2) ma2 = App.boDau(ten2).split(/[\s,\-–]+/).map(function (w) { return w[0] || ''; }).join('').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) || 'CD';
        var goc = ma2, k2 = 2; while (b.ngach.some(function (x) { return x.ma.toLowerCase() === ma2.toLowerCase(); })) ma2 = goc + k2++;
        var sb = Math.max(1, Math.min(20, parseInt(App.$('[data-f="sobacmoi"]', card).value, 10) || b.soBac || 3));
        b.ngach.push({ ma: ma2, ten: ten2, soBac: sb, bac: [], namNang: '' });
        TL.chuanBangLuong(b); App.luu(); veLai();
        return;
      }
      if (act === 'xoangach' && g) {
        var n2 = dsXep(b.ma, g.ma).length;
        if (n2) { App.bao('“' + g.ten + '” đang xếp cho ' + n2 + ' nhân viên – hãy xếp họ sang chức danh khác trước.', 'loi'); return; }
        App.xacNhan('Xoá chức danh <b>' + h(g.ten) + '</b> khỏi bảng?', { nut: 'Xoá', nguy: true }).then(function (ok) { if (ok) { b.ngach.splice(b.ngach.indexOf(g), 1); App.ML.xoaNgach(b, g); App.luu(); veLai(); } });
        return;
      }
      if (act === 'lenngach' && g) { var i0 = b.ngach.indexOf(g); if (i0 > 0) { b.ngach.splice(i0 - 1, 0, b.ngach.splice(i0, 1)[0]); App.luu(); veLai(); } }
    };
  };

  /** Tách 1 chức danh thành 2 (vd "Trưởng phòng, Đội trưởng" → "Trưởng phòng" và "Đội trưởng"):
      chức danh mới chép số bậc, thời gian nâng bậc, giá trị các bậc ở mọi mức áp dụng; chọn nhân viên chuyển sang (giữ nguyên bậc) */
  function tachNgach(b, g, xong) {
    var db = App.db;
    var ds = db.nhanVien.filter(function (nv) { return nv.trangThai !== 'nghi_viec' && nv.xepLuong && nv.xepLuong.bang === b.ma && nv.xepLuong.ngach === g.ma; });
    var phan = g.ten.split(/\s*,\s*/), tenCu = phan.length > 1 ? phan.slice(0, -1).join(', ') : g.ten, tenMoi = phan.length > 1 ? phan[phan.length - 1] : '';
    var khop = function (nv, ten) { var t = TL.chuanCV(ten); return !!t && TL.chuanCV(nv.chucVu).indexOf(t) >= 0; };
    App.hop({
      tieuDe: 'Tách chức danh “' + g.ten + '”', co: 'rong',
      than: '<form class="form" style="grid-template-columns:1fr 1fr" onsubmit="return false">' +
        App.F.o('Chức danh hiện tại (đổi tên thành)', App.F.txt('tenCu', tenCu)) +
        App.F.o('Chức danh mới *', App.F.txt('tenMoi', tenMoi, 'placeholder="vd Đội trưởng"')) +
        '<p class="mo nho ca" style="margin:0">Chức danh mới chép <b>' + g.soBac + ' bậc</b> và giá trị các bậc (mức ban đầu và các mức theo kỳ) của chức danh hiện tại; ' +
        'sau đó sửa giá trị riêng cho từng chức danh. Nhân viên được đánh dấu chuyển sang chức danh mới, giữ nguyên bậc.</p>' +
        App.F.o('Nhân viên chuyển sang áp dụng từ kỳ lương', '<input type="month" name="tuKy" value="' + TL.kyHienHanh(db) + '">',
          'Lập quyết định chuyển chức danh hiệu lực từ đầu kỳ này: các kỳ trước vẫn tính theo chức danh cũ. Để trống = áp dụng cho mọi kỳ chưa chốt') + '</form>' +
        (ds.length ? '<div class="cuon" style="margin-top:10px"><table class="bang"><thead><tr><th>Chuyển sang<br>chức danh mới</th><th>Mã NV</th><th>Họ và tên</th><th>Chức vụ</th><th>Phòng / đội</th><th>Bậc</th></tr></thead><tbody>' +
          ds.map(function (nv) {
            return '<tr><td class="giua"><input type="checkbox" data-nv="' + nv.id + '"' + (khop(nv, tenMoi) ? ' checked' : '') + '></td><td>' + h(nv.ma) + '</td><td class="ten">' + h(nv.hoTen) + '</td><td>' + h(nv.chucVu || '') + '</td>' +
              '<td>' + h(TL.tenPhongBan(db, nv.phongBan)) + '</td><td class="giua">' + nv.xepLuong.bac + '</td></tr>';
          }).join('') + '</tbody></table></div>' : '<p class="mo">Chưa có nhân viên nào xếp ở chức danh này.</p>'),
      moRa: function (el) {
        var fm = App.$('form', el);
        fm.tenMoi.oninput = function () { var t = this.value; App.$$('[data-nv]', el).forEach(function (c) { c.checked = khop(App.timNV(c.dataset.nv), t); }); };
      },
      nut: [{ ten: 'Huỷ' }, {
        ten: 'Tách chức danh', loai: 'chinh', bam: function (el) {
          var v = App.F.doc(el), moi = v.tenMoi.trim(), cu = v.tenCu.trim() || g.ten;
          if (!moi) { App.bao('Nhập tên chức danh mới.', 'loi'); return false; }
          if (b.ngach.some(function (x) { return x !== g && TL.chuanCV(x.ten) === TL.chuanCV(moi); })) { App.bao('Đã có chức danh “' + moi + '” trong bảng này.', 'loi'); return false; }
          var ma = App.boDau(moi).split(/[\s,\-–]+/).map(function (w) { return w[0] || ''; }).join('').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) || 'CD', goc = ma, k = 2;
          while (b.ngach.some(function (x) { return x.ma.toLowerCase() === ma.toLowerCase(); })) ma = goc + k++;
          var gm = { ma: ma, ten: moi, soBac: g.soBac, namNang: g.namNang || '', bac: g.bac.slice() };
          b.ngach.splice(b.ngach.indexOf(g) + 1, 0, gm);
          db.dotLuong.forEach(function (d) { var x = d.bang && d.bang[b.ma] && d.bang[b.ma].ngach; if (x && Array.isArray(x[g.ma])) x[ma] = x[g.ma].slice(); });
          g.ten = cu;
          var chuyen = App.$$('[data-nv]:checked', el).map(function (c) { return App.timNV(c.dataset.nv); }), loiQD = [];
          var tuKy = /^\d{4}-\d{2}$/.test(v.tuKy || '') ? v.tuKy : '', hl = tuKy ? TL.batDauKy(db, +tuKy.slice(0, 4), +tuKy.slice(5, 7)) : '';
          chuyen.forEach(function (nv) {
            var moiX = Object.assign({}, nv.xepLuong, { ngach: ma });
            if (hl && App.themNangLuong) {
              var gtX = TL.giaTriBac(db, b, gm, +moiX.bac, tuKy);
              var e = App.themNangLuong(nv, { so: '', ngay: App.homNay(), hieuLuc: hl, luongMoi: gtX && b.apDung !== 'bh' ? gtX.tien : +nv.luongCB || 0,
                xepLuongMoi: moiX, noiDung: 'Chuyển xếp lương từ chức danh ' + cu + ' sang ' + moi });
              if (e) { loiQD.push(nv.hoTen); nv.xepLuong = moiX; }
            } else nv.xepLuong = moiX;
            if (App.dongBoHoSo) App.dongBoHoSo(nv);
          });
          if (loiQD.length) App.bao('Đã chuyển thẳng (không lập quyết định vì có quyết định nâng lương sau kỳ này): ' + loiQD.join(', '), 'loi');
          TL.chuanBangLuong(b); App.luu(); if (App.apDungBangLuong) App.apDungBangLuong(b.ma, true); xong();
          App.bao('Đã tách: “' + cu + '” và “' + moi + '” (mã ' + ma + ')' + (chuyen.length ? ', chuyển ' + chuyen.length + ' nhân viên' : '') + '. Sửa giá trị bậc riêng nếu khác.', 'tot');
        }
      }]
    });
  }

  function theBang(b, bi) {
    var db = App.db, hs = b.kieu === 'he_so', cot = '';
    for (var k = 1; k <= b.soBac; k++) cot += '<th class="so" style="min-width:' + (hs ? 70 : 110) + 'px">Bậc ' + k + '</th>';
    var soNV = dsXep(b.ma).length;
    return '<div class="the" data-b="' + bi + '">' +
      '<div class="hang" style="margin-bottom:10px;gap:8px 14px">' +
      '<input class="o-nhap chu" data-f="ten" value="' + h(b.ten) + '" style="flex:1;min-width:340px;font-weight:700;font-size:15px" title="Tên bảng">' +
      '<label class="nho">Kiểu <select data-f="kieu">' + opts(TL.KIEU_BL, b.kieu) + '</select></label>' +
      (hs ? '<label class="nho">Mức lương cơ sở <input class="o-nhap so" data-f="mucCoSo" value="' + (App.ML.docMucCoSo(b) ? App.tien(App.ML.docMucCoSo(b)) : '') + '" placeholder="' + App.tien(TL.luongCoSoKy(db, App.ML.ky())) + '" style="width:110px" title="Để trống = lương cơ sở của mức đang chọn"></label>' : '') +
      '<label class="nho">Dùng cho <select data-f="apDung">' + opts(TL.AP_DUNG_BL, b.apDung) + '</select></label>' +
      '<label class="nho">Nâng bậc sau <input class="o-nhap so" data-f="namNang" value="' + App.so(b.namNang) + '" style="width:46px"> năm</label>' +
      '<span class="gian"></span><span class="mo nho">' + soNV + ' nhân viên</span>' +
      '<button class="nut nho nguy" data-a="xoabang" title="Xoá bảng">' + App.icon('xoa') + '</button></div>' +
      '<div class="cuon"><table class="bang bang-bac"><thead><tr><th>Mã</th><th style="min-width:230px">Chức danh / nhóm công việc</th><th title="Thời gian giữ bậc để xét nâng bậc; để trống = theo bảng">Năm nâng</th><th title="Số bậc của chức danh: bấm − / + để bớt, thêm bậc">Số bậc</th>' + cot + '<th>NV</th><th></th></tr></thead><tbody>' +
      (b.ngach.length ? b.ngach.map(function (g, gi) {
        var n = dsXep(b.ma, g.ma).length;
        return '<tr data-g="' + gi + '"><td>' + h(g.ma) + '</td><td><input class="o-nhap chu" data-f="gten" value="' + h(g.ten) + '" style="width:100%"></td>' +
          '<td><input class="o-nhap so" data-f="gnam" value="' + (g.namNang ? App.so(g.namNang) : '') + '" placeholder="' + App.so(b.namNang) + '" style="width:46px"></td>' +
          '<td class="giua" style="white-space:nowrap"><button class="nut nho" data-a="botbacg" title="Bớt bậc cuối của chức danh này"' + (g.soBac > 1 ? '' : ' disabled') + '>−</button> ' +
          '<b style="display:inline-block;min-width:16px">' + g.soBac + '</b> <button class="nut nho" data-a="thembacg" title="Thêm 1 bậc cho chức danh này">+</button></td>' +
          g.bac.map(function (v0, k) {
            if (k >= g.soBac) return '<td class="bac-tat" title="' + h(g.ten) + ' có ' + g.soBac + ' bậc"></td>';
            var v = App.ML.docBac(b, g, k), gt = TL.giaTriBac(db, b, g, k + 1, App.ML.ky()), nk = dsXep(b.ma, g.ma, k + 1).length;
            return '<td class="so"><input class="o-nhap so" data-bac="' + k + '" value="' + (+v > 0 ? (hs ? App.soHS(v) : App.tien(v)) : '') + '" style="width:100%">' +
              (hs && gt ? '<div class="mo nho">' + App.tien(gt.tien) + '</div>' : '') + (nk ? '<div class="nho" style="color:var(--chinh)" title="Số người đang hưởng bậc này">' + nk + ' người</div>' : '') + '</td>';
          }).join('') +
          '<td class="giua">' + (n || '') + '</td><td style="white-space:nowrap"><button class="nut nho" data-a="tachngach" title="Tách thành 2 chức danh riêng (vd Trưởng phòng và Đội trưởng): chép số bậc, giá trị bậc, chọn nhân viên chuyển sang">Tách…</button> ' +
          (gi ? '<button class="nut nho" data-a="lenngach" title="Lên">▲</button> ' : '') +
          '<button class="nut nho nguy" data-a="xoangach" title="Xoá chức danh">' + App.icon('xoa') + '</button></td></tr>';
      }).join('') : '<tr><td colspan="' + (b.soBac + 6) + '" class="trong">Chưa có chức danh. Thêm ở dưới.</td></tr>') +
      '</tbody></table></div>' +
      '<div class="hang" style="margin-top:10px"><input data-f="mamoi" placeholder="Mã (vd CV)" style="width:100px"><input data-f="tenmoi" placeholder="Chức danh / nhóm (vd Chuyên viên, kỹ sư)" style="width:320px">' +
      '<label class="nho">Số bậc <input data-f="sobacmoi" type="number" min="1" max="20" value="' + (b.soBac || 3) + '" style="width:56px"></label>' +
      '<button class="nut" data-a="themngach">' + App.icon('them') + 'Thêm chức danh</button></div></div>';
  }

  /* ================= Ô chọn bảng / chức danh / bậc (dùng chung: trang xếp lương, hồ sơ) ================= */

  /** HTML 3 ô chọn; x = nv.xepLuong (có thể null) */
  App.oChonBac = function (x, attr) {
    var db = App.db, b = x && TL.timBangLuong(db, x.bang), g = b && TL.timNgach(b, x.ngach);
    attr = attr || '';
    var s = '<select data-xl="bang" ' + attr + '><option value="">(Chưa xếp)</option>' + db.thangLuong.map(function (t) { return '<option value="' + h(t.ma) + '"' + (b === t ? ' selected' : '') + '>' + h(t.ten) + '</option>'; }).join('') + '</select>';
    s += '<select data-xl="ngach" ' + attr + (b ? '' : ' disabled') + '>' + (b ? b.ngach.map(function (n) { return '<option value="' + h(n.ma) + '"' + (g === n ? ' selected' : '') + '>' + h(n.ten) + '</option>'; }).join('') : '') + '</select>';
    var sb = g ? TL.soBacNgach(g, db, b) : 0, bac = x ? +x.bac || 1 : 1, ob = '';
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
    if (truong === 'ngach') { x.ngach = giaTri; var g = TL.timNgach(TL.timBangLuong(db, x.bang), giaTri); x.bac = Math.min(+x.bac || 1, Math.max(1, TL.soBacNgach(g, db, TL.timBangLuong(db, x.bang)))); }
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
      var bhBac = !!(xl && xl.tien && db.caiDat.bhTheoBac !== false);   // lương đóng BH theo bậc lương hiện tại
      var lechCB = apCB && (ht === 'thang' || ht === 'khoan') && +nv.luongCB !== xl.tien, lechBH = apBH && !bhBac && +nv.luongBH !== xl.tien;
      if (lechCB || lechBH) lech++;
      var hanTxt = !xl ? '' : xl.bacCuoi ? '<span class="mo">Bậc cuối</span>' : xl.ngayNang ? TL.hienNgay(xl.ngayNang) + (xl.ngayNang <= hn ? ' <span class="the-tt do">Đến hạn</span>' : '') : '<span class="mo">Nhập ngày hưởng</span>';
      return '<tr data-id="' + nv.id + '"><td class="giua">' + (i + 1) + '</td><td>' + h(nv.ma) + '</td><td class="ten"><span class="lk" data-hs="' + nv.id + '">' + h(nv.hoTen) + '</span></td>' +
        '<td>' + h(TL.tenPhongBan(db, nv.phongBan)) + '</td><td>' + h(nv.chucVu || '') + '</td>' +
        '<td><div class="chon-bac">' + App.oChonBac(nv.xepLuong) + '</div></td>' +
        '<td class="so">' + (xl && xl.heSo != null ? App.soHS(xl.heSo) : '') + '</td><td class="so"><b>' + (xl && xl.tien ? App.tien(xl.tien) : '') + '</b></td>' +
        '<td><input type="date" data-xl="ngayHuong" value="' + h(xl ? xl.ngayHuong : '') + '"' + (xl ? '' : ' disabled') + '></td>' +
        '<td class="so">' + App.tien(nv.luongCB) + (ht !== 'thang' && ht !== 'khoan' ? ' <span class="mo nho">' + App.DV_LUONG[ht] + '</span>' : '') + (lechCB ? ' <span class="the-tt cam" title="Khác mức theo bảng">≠</span>' : '') + '</td>' +
        '<td class="so">' + (bhBac ? App.tien(xl.tien) + ' <span class="mo nho" title="Đóng BH theo bậc lương hiện tại + phụ cấp đóng BH">theo bậc</span>' : +nv.luongBH ? App.tien(nv.luongBH) : '<span class="mo">theo lương</span>') + (lechBH ? ' <span class="the-tt cam" title="Khác mức theo bảng">≠</span>' : '') + '</td>' +
        '<td class="giua">' + hanTxt + '</td>' +
        '<td class="khong-in">' + (xl ? '<button class="nut nho" data-a="nang" title="Lập quyết định nâng bậc hoặc chuyển chức danh, áp dụng từ kỳ lương của ngày hiệu lực">' + App.icon('bac') + (xl.bacCuoi ? 'Chuyển chức danh…' : 'Nâng / chuyển bậc…') + '</button>' : '') + '</td></tr>';
    }).join('');
    el.innerHTML = '<div class="the khong-in"><div class="hang">' +
      '<input type="search" id="nb-tim" placeholder="Tìm mã, tên, chức vụ…" value="' + h(st.tim) + '" style="width:220px">' +
      '<select id="nb-pb">' + App.optDonVi(st.pb, { tatCa: 'Tất cả phòng / đội' }) + '</select>' +
      '<label class="chk"><input type="checkbox" id="nb-chua"' + (st.chuaXep ? ' checked' : '') + '> Chỉ người chưa xếp</label><span class="gian"></span>' +
      (lech ? '<button class="nut" id="nb-ap" title="Ghi mức theo bảng vào mức lương / lương đóng BH của những người đang lệch">Áp lương theo bảng (' + lech + ')</button>' : '') +
      (db.thangLuong.some(function (x) { return x.quyChe === TL.QUY_CHE_LUONG.so; }) ? '<button class="nut" id="nb-qc" title="Chuyển xếp lương sang thang bảng lương theo Quy chế trả lương 2026 (QĐ ' + h(TL.QUY_CHE_LUONG.so) + ')">' + App.icon('bac') + 'Chuyển xếp theo quy chế…</button>' : '') +
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
    var bq = App.$('#nb-qc'); if (bq) bq.onclick = App.chuyenXepQuyChe;
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
    if (!xl) { App.bao('Nhân viên chưa xếp thang bảng lương.', 'loi'); return; }
    if (xl.bacCuoi) { App.formQuyetDinh(nv, null, 'nang_luong', function () { App.veLai(); }, { hieuLuc: hieuLuc || App.homNay(), noiDung: 'Chuyển xếp lương' }); return; }
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
