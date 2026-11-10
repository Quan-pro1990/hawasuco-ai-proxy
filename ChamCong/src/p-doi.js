/* Tổng quan đơn vị: màn hình riêng của từng phòng / đội – nhân viên, chấm công kỳ này, nghỉ hôm nay, đơn nghỉ chờ duyệt,
   hợp đồng sắp hết hạn, lương của đơn vị (theo quyền tài khoản). Tài khoản cấp phòng / đội vào thẳng màn hình này. */
(function () {
  'use strict';
  var App = window.App, TL = window.TL, h = App.h;
  var st = { dv: '' };

  function soNgay(a, b) { return Math.round((new Date(b) - new Date(a)) / 864e5); }

  function ve(noi) {
    var db = App.db, y = App.ky.y, m = App.ky.m, hn = App.homNay(), nHn = TL.docNgay(hn);
    var dsDV = App.dsDonVi();
    if (!dsDV.length) { noi.innerHTML = '<div class="the trong">Chưa có phòng / đội. Thêm ở Danh mục → Phòng, đội.</div>'; return; }
    if (!dsDV.some(function (p) { return p.ma === st.dv; })) st.dv = dsDV[0].ma;
    var pb = dsDV.filter(function (p) { return p.ma === st.dv; })[0];
    var qNS = App.quyen('ns'), qLG = App.quyen('lg'), qCC = App.quyen('cc');
    var ds = TL.dsNhanVienKy(db, y, m).filter(function (nv) { return TL.donViTheoKy(db, nv, y, m).phongBan === st.dv; })
      .sort(function (a, b) { return String(a.ma).localeCompare(String(b.ma), 'vi', { numeric: true }); });
    var ids = {}; ds.forEach(function (nv) { ids[nv.id] = 1; });
    var kh = TL.bangKyHieu(db), le = TL.bangNgayLe(db), ngayK = TL.ngayKy(db, y, m), kyHomNay = TL.kyCuaNgay(db, nHn.y, nHn.m, nHn.d);
    var laKyNay = kyHomNay.y === y && kyHomNay.m === m;

    // từng người: công kỳ này, ô chưa chấm, hôm nay, hợp đồng
    var thieuO = 0, thieuNV = 0, nghiNay = [], tv = 0, hdSap = 0;
    var dong = ds.map(function (nv) {
      var c = TL.tongHopCong(db, y, m, nv), thieu = 0;
      if (nv.hinhThuc !== 'gio') ngayK.forEach(function (x) {
        if (x.iso > hn || !TL.nvLamNgay(nv, x.y, x.m, x.d)) return;
        if (TL.loaiNgay(db, x.y, x.m, x.d, le, nv) === 'nghi') return;
        if (!TL.oNgay(db, 'cc', nv.id, x.y, x.m, x.d)) thieu++;
      });
      if (thieu) { thieuO += thieu; thieuNV++; }
      var oNay = laKyNay ? TL.oNgay(db, 'cc', nv.id, nHn.y, nHn.m, nHn.d) : '', k = oNay ? kh[String(oNay).toUpperCase()] : null;
      if (k && !(+k.lam > 0)) nghiNay.push(nv.hoTen + ' (' + oNay + ')');
      if (nv.trangThai === 'thu_viec') tv++;
      var hd = qNS && App.hdHieuLuc ? App.hdHieuLuc(nv) : null, con = hd && hd.denNgay ? soNgay(hn, hd.denNgay) : null;
      var daKyTiep = hd && (nv.hopDong || []).some(function (x) { return (x.tuNgay || '') > (hd.tuNgay || ''); });
      if (con != null && con <= 30 && !daKyTiep) hdSap++;
      return { nv: nv, c: c, thieu: thieu, oNay: oNay, hd: hd, con: daKyTiep ? null : con };
    });
    var choDuyet = qNS ? (db.donNghi || []).filter(function (d) { return d.trangThai === 'cho' && ids[d.nvId]; }).length : 0;
    var bl = null, tongTL = 0, tongTU = 0, rowTheoId = {};
    if (qLG) {
      bl = TL.tinhBangLuong(db, y, m);
      bl.rows.forEach(function (r) { if (r.phongBan === st.dv) { rowTheoId[r.nvId] = r; tongTL += r.thucLinh; tongTU += r.tamUng; } });
    }

    function the(nhan, gt, phu, mau, link) {
      return '<div class="kpi' + (link ? ' bam' : '') + '"' + (link ? ' data-link="' + link + '"' : '') + '><div class="nhan">' + nhan + '</div><div class="gt"' + (mau ? ' style="color:' + mau + '"' : '') + '>' + gt + '</div><div class="phu">' + phu + '</div></div>';
    }
    var html = '<div class="the" style="padding:14px 16px"><div class="hang">' +
      (dsDV.length > 1 ? '<select id="doi-dv" style="font-weight:600">' + dsDV.map(function (p) { return '<option value="' + h(p.ma) + '"' + (p.ma === st.dv ? ' selected' : '') + '>' + h(p.ten) + '</option>'; }).join('') + '</select>'
        : '<div style="font-size:18px;font-weight:700">' + h(pb.ten) + '</div>') +
      '<span class="mo">' + h(App.tenKy(y, m)) + ' · từ ' + TL.hienNgay(ngayK[0].iso) + ' đến ' + TL.hienNgay(ngayK[ngayK.length - 1].iso) + '</span><span class="gian"></span>' +
      (qCC ? '<button class="nut chinh" data-link="chamcong">' + App.icon('chamcong') + 'Chấm công đơn vị</button>' : '') +
      (qNS ? '<button class="nut" data-link="nghiphep">' + App.icon('nghiphep') + 'Đơn nghỉ</button><button class="nut" data-link="theodoihd">' + App.icon('theodoi') + 'Hợp đồng</button>' : '') +
      (qLG ? '<button class="nut" data-link="bangluong">' + App.icon('bangluong') + 'Bảng lương</button>' : '') + '</div></div>' +
      '<div class="kpis">' +
      the('Nhân viên trong kỳ', ds.length, tv ? tv + ' người đang thử việc' : 'thuộc ' + h(pb.ten), '', qNS ? 'nhanvien' : '') +
      (qCC ? the('Ô chấm công còn trống', thieuO, thieuNV ? thieuNV + ' người, tính đến hôm nay' : 'đã chấm đủ đến hôm nay', thieuO ? 'var(--cam)' : 'var(--xanh)', 'chamcong') : '') +
      (qCC && laKyNay ? the('Nghỉ hôm nay', nghiNay.length, nghiNay.length ? h(nghiNay.slice(0, 3).join(', ')) + (nghiNay.length > 3 ? '…' : '') : 'theo bảng chấm công', '', '') : '') +
      (qNS ? the('Đơn nghỉ chờ duyệt', choDuyet, 'của nhân viên đơn vị', choDuyet ? 'var(--cam)' : '', 'nghiphep') : '') +
      (qNS ? the('HĐ hết hạn trong 30 ngày', hdSap, 'chưa ký hợp đồng tiếp theo', hdSap ? 'var(--do)' : '', 'theodoihd') : '') +
      (qLG ? the('Thực lĩnh kỳ II của đơn vị', App.tien(tongTL), 'tạm ứng kỳ I ' + App.tien(tongTU) + ' đ', '', 'bangluong') : '') +
      '</div>' +
      '<div class="the" style="padding:0"><div class="cuon cao"><table class="bang"><thead><tr><th>STT</th><th>Mã NV</th><th style="min-width:160px">Họ và tên</th><th>Chức vụ</th><th>Trạng thái</th>' +
      (qCC ? '<th class="so">Công lương TG</th><th class="so">Nghỉ phép</th><th class="so">Nghỉ không lương</th><th class="giua">Ô còn trống</th>' + (laKyNay ? '<th class="giua">Hôm nay</th>' : '') : '') +
      (qNS ? '<th>Hợp đồng hiện tại</th><th class="giua">Hết hạn</th>' : '') + (qLG ? '<th class="so">Thực lĩnh kỳ II</th>' : '') + '</tr></thead><tbody>' +
      (dong.length ? dong.map(function (d, i) {
        var nv = d.nv, tt = nv.trangThai || 'dang_lam', r = rowTheoId[nv.id];
        return '<tr><td class="giua">' + (i + 1) + '</td><td>' + h(nv.ma) + '</td><td class="ten">' + (qNS ? '<span class="lk" data-hs="' + nv.id + '">' + h(nv.hoTen) + '</span>' : h(nv.hoTen)) + '</td><td>' + h(nv.chucVu || '') + '</td>' +
          '<td><span class="the-tt ' + ({ dang_lam: 'xanh', thu_viec: 'cam', tam_nghi: 'lam', nghi_viec: '' }[tt]) + '">' + App.TRANG_THAI[tt] + '</span></td>' +
          (qCC ? '<td class="so">' + App.so(d.c.congTG) + (d.c.sp ? ' <span class="mo nho">+' + App.so(d.c.sp) + ' SP</span>' : '') + '</td><td class="so">' + (d.c.phep ? App.so(d.c.phep) : '') + '</td><td class="so">' + (d.c.khong + d.c.kp ? App.so(d.c.khong + d.c.kp) : '') + '</td>' +
            '<td class="giua">' + (d.thieu ? '<span class="the-tt cam">' + d.thieu + '</span>' : '<span class="mo">—</span>') + '</td>' + (laKyNay ? '<td class="giua">' + h(d.oNay || '') + '</td>' : '') : '') +
          (qNS ? '<td>' + (d.hd ? h(App.tenGiaiDoan ? App.tenGiaiDoan(nv, d.hd) : d.hd.loai) : '<span class="the-tt cam">Chưa có</span>') + '</td><td class="giua">' + (d.hd && d.hd.denNgay ? TL.hienNgay(d.hd.denNgay) + (d.con != null && d.con <= 30 ? ' <span class="the-tt ' + (d.con < 0 ? 'do">quá hạn' : d.con <= 7 ? 'do">còn ' + d.con + ' ngày' : 'cam">còn ' + d.con + ' ngày') + '</span>' : '') : '<span class="mo">—</span>') + '</td>' : '') +
          (qLG ? '<td class="so">' + (r ? App.tien(r.thucLinh) : '') + '</td>' : '') + '</tr>';
      }).join('') : '<tr><td colspan="14" class="trong">Đơn vị chưa có nhân viên trong kỳ này.</td></tr>') + '</tbody></table></div></div>' +
      '<p class="mo nho">Mỗi phòng / đội có màn hình riêng này. Tài khoản cấp phòng / đội chỉ thấy đơn vị được giao; phần hiện ra theo quyền của tài khoản (chấm công, nhân sự, tiền lương).</p>';
    noi.innerHTML = html;
    var s = App.$('#doi-dv'); if (s) s.onchange = function () { st.dv = this.value; App.veLai(); };
    noi.onclick = function (e) {
      var hs = e.target.closest('[data-hs]'); if (hs) { App.moHoSo(hs.dataset.hs); return; }
      var l = e.target.closest('[data-link]'); if (!l) return;
      if (l.dataset.link === 'chamcong' && App.moChamCong) App.moChamCong(st.dv); else location.hash = '#' + l.dataset.link;
    };
  }

  App.trang.tongquandoi = { ve: ve };
})();
