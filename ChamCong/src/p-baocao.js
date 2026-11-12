/* Trang Báo cáo: tổng hợp phòng / đội, bảo hiểm, thuế TNCN năm, quỹ lương năm, phép năm, đi muộn – nghỉ */
(function () {
  'use strict';
  var App = window.App, TL = window.TL, h = App.h;
  var st = { tab: 'pb' };
  var TABS = [
    ['pb', 'Tổng hợp theo phòng / đội'],
    ['bh', 'Bảo hiểm & công đoàn'],
    ['thue', 'Thuế TNCN cả năm'],
    ['nam', 'Quỹ lương 12 tháng'],
    ['phep', 'Theo dõi phép năm'],
    ['cong', 'Đi muộn, nghỉ việc']
  ];

  function veBangChung(cot, rows, tong) {
    var s = '<table class="bang"><thead><tr>' + cot.map(function (c) { return '<th class="' + (c.kieu === 'so' ? 'so' : '') + '">' + h(c.t) + '</th>'; }).join('') + '</tr></thead><tbody>';
    if (!rows.length) s += '<tr><td colspan="' + cot.length + '" class="trong">Chưa có số liệu.</td></tr>';
    rows.forEach(function (r, i) {
      s += '<tr>' + cot.map(function (c) {
        var v = c.stt ? i + 1 : c.f ? c.f(r) : r[c.k];
        return '<td class="' + (c.kieu === 'so' ? 'so' : c.kieu === 'cong' || c.kieu === 'giua' || c.stt ? 'giua' : '') + '">' + (c.kieu === 'so' ? App.tienRong(v) : c.kieu === 'cong' ? App.soRong(v) : h(v == null ? '' : v)) + '</td>';
      }).join('') + '</tr>';
    });
    s += '</tbody>';
    if (tong && rows.length) s += '<tfoot><tr class="tong">' + cot.map(function (c, i) {
      if (i === 1) return '<td>Tổng cộng</td>';
      if (c.khongTong || c.stt || !(c.kieu === 'so' || c.kieu === 'cong')) return '<td></td>';
      var v = c.f ? c.f(tong) : tong[c.k];
      return '<td class="' + (c.kieu === 'so' ? 'so' : 'giua') + '">' + (c.kieu === 'so' ? App.tienRong(v) : App.soRong(v)) + '</td>';
    }).join('') + '</tr></tfoot>';
    return s + '</table>';
  }

  function cong(rows, keys) {
    var t = {};
    keys.forEach(function (k) { t[k] = rows.reduce(function (s, r) { return s + (+r[k] || 0); }, 0); });
    return t;
  }

  /* ---------- Từng báo cáo: trả về {tieuDe, phuDe, cot, rows, tong, ghiChu} ---------- */
  var BC = {
    pb: function () {
      var y = App.ky.y, m = App.ky.m, bl = TL.tinhBangLuong(App.db, y, m);
      var g = {}, thuTu = [];
      bl.rows.forEach(function (r) {
        var k = r.phongBan || '';
        if (!g[k]) { g[k] = { ten: r.tenPhongBan || '(Chưa phân phòng)', ds: [] }; thuTu.push(k); }
        g[k].ds.push(r);
      });
      var rows = thuTu.map(function (k) {
        var t = TL.congTong(g[k].ds, bl.phuCap);
        return { ten: g[k].ten, soNV: g[k].ds.length, congTG: t.cong.congTG, luongSP: t.luongSP, luongTG: t.luongTG + t.luongNgung + t.tienOT, phuCap: t.tongPhuCap, thuong: t.thuong + t.congKhac,
          tong: t.tongThuNhap, bh: t.tongBH, doanPhi: t.doanPhi, thue: t.thue, tamUng: t.tamUng, net: t.thucLinh, dn: t.dn.tong, chiPhi: t.chiPhiDN };
      });
      var cot = [
        { t: 'STT', stt: true, w: 5, kieu: 'giua' }, { t: 'Phòng / đội', k: 'ten', w: 30 }, { t: 'Số NV', k: 'soNV', kieu: 'cong', w: 7 }, { t: 'Công lương TG', k: 'congTG', kieu: 'cong', w: 9 },
        { t: 'Lương sản phẩm', k: 'luongSP', kieu: 'so', w: 13 }, { t: 'Lương thời gian, làm thêm', k: 'luongTG', kieu: 'so', w: 14 }, { t: 'Phụ cấp', k: 'phuCap', kieu: 'so', w: 12 },
        { t: 'Thưởng, khoản khác', k: 'thuong', kieu: 'so', w: 12 }, { t: 'Tổng thu nhập', k: 'tong', kieu: 'so', w: 14 }, { t: 'BH NLĐ đóng', k: 'bh', kieu: 'so', w: 12 },
        { t: 'Công đoàn', k: 'doanPhi', kieu: 'so', w: 10 }, { t: 'Thuế TNCN', k: 'thue', kieu: 'so', w: 11 }, { t: 'Tạm ứng kỳ I', k: 'tamUng', kieu: 'so', w: 12 },
        { t: 'Lãnh kỳ II', k: 'net', kieu: 'so', w: 14 }, { t: 'BH, KPCĐ DN đóng', k: 'dn', kieu: 'so', w: 13 }, { t: 'Tổng chi phí DN', k: 'chiPhi', kieu: 'so', w: 14 }
      ];
      return { tieuDe: 'BẢNG TỔNG HỢP TIỀN LƯƠNG THEO PHÒNG BAN', phuDe: 'Tháng ' + m + ' năm ' + y, cot: cot, rows: rows, tong: cong(rows, ['soNV', 'congTG', 'luongSP', 'luongTG', 'phuCap', 'thuong', 'tong', 'bh', 'doanPhi', 'thue', 'tamUng', 'net', 'dn', 'chiPhi']) };
    },
    bh: function () {
      var y = App.ky.y, m = App.ky.m, bl = TL.tinhBangLuong(App.db, y, m), cd = App.db.caiDat;
      var rows = bl.rows.filter(function (r) { return r.dongBH || r.doanPhi; }).map(function (r) {
        return { ma: r.ma, hoTen: r.hoTen, luongBH: r.luongBH, bhxh: r.bhxh, bhyt: r.bhyt, bhtn: r.bhtn, doanPhi: r.doanPhi, nld: r.tongBH + r.doanPhi,
          dnxh: r.dn.bhxh, dnyt: r.dn.bhyt, dntn: r.dn.bhtn, kpcd: r.dn.kpcd, dn: r.dn.tong, tong: r.tongBH + r.doanPhi + r.dn.tong };
      });
      var p = function (x) { return App.so(x) + '%'; };
      var cot = [
        { t: 'STT', stt: true, w: 5, kieu: 'giua' }, { t: 'Họ và tên', k: 'hoTen', w: 22 }, { t: 'Mã NV', k: 'ma', w: 8 }, { t: 'Lương đóng BH', k: 'luongBH', kieu: 'so', w: 13 },
        { t: 'NLĐ: BHXH ' + p(cd.bh.nv.bhxh), k: 'bhxh', kieu: 'so', w: 11 }, { t: 'BHYT ' + p(cd.bh.nv.bhyt), k: 'bhyt', kieu: 'so', w: 10 }, { t: 'BHTN ' + p(cd.bh.nv.bhtn), k: 'bhtn', kieu: 'so', w: 10 },
        { t: 'Công đoàn ' + p(cd.bh.doanPhi), k: 'doanPhi', kieu: 'so', w: 10 }, { t: 'Cộng NLĐ', k: 'nld', kieu: 'so', w: 11 },
        { t: 'DN: BHXH ' + p(cd.bh.dn.bhxh), k: 'dnxh', kieu: 'so', w: 11 }, { t: 'BHYT ' + p(cd.bh.dn.bhyt), k: 'dnyt', kieu: 'so', w: 10 }, { t: 'BHTN ' + p(cd.bh.dn.bhtn), k: 'dntn', kieu: 'so', w: 10 },
        { t: 'KPCĐ ' + p(cd.bh.dn.kpcd), k: 'kpcd', kieu: 'so', w: 10 }, { t: 'Cộng DN', k: 'dn', kieu: 'so', w: 11 }, { t: 'Tổng phải nộp', k: 'tong', kieu: 'so', w: 13 }
      ];
      return { tieuDe: 'BẢNG TRÍCH NỘP BẢO HIỂM BẮT BUỘC, KINH PHÍ VÀ ĐOÀN PHÍ CÔNG ĐOÀN', phuDe: 'Tháng ' + m + ' năm ' + y, cot: cot, rows: rows,
        tong: cong(rows, ['luongBH', 'bhxh', 'bhyt', 'bhtn', 'doanPhi', 'nld', 'dnxh', 'dnyt', 'dntn', 'kpcd', 'dn', 'tong']) };
    },
    thue: function () {
      var y = App.ky.y, nv = {}, thuTu = [];
      for (var m = 1; m <= 12; m++) {
        if (!App.db.thang[TL.khoaKy(y, m)]) continue;
        TL.tinhBangLuong(App.db, y, m).rows.forEach(function (r) {
          if (!nv[r.nvId]) { nv[r.nvId] = { ma: r.ma, hoTen: r.hoTen, mst: r.mst, tnct: 0, gt: 0, tntt: 0, thue: 0, t: {} }; thuTu.push(r.nvId); }
          var x = nv[r.nvId];
          x.tnct += r.tnct; x.gt += r.giamTruBT + r.giamTruNPT + r.tongBH; x.tntt += r.tntt; x.thue += r.thue; x.t[m] = r.thue;
        });
      }
      var rows = thuTu.map(function (id) { var x = nv[id]; for (var i = 1; i <= 12; i++) x['t' + i] = x.t[i] || 0; return x; });
      var cot = [{ t: 'STT', stt: true, w: 5, kieu: 'giua' }, { t: 'Họ và tên', k: 'hoTen', w: 22 }, { t: 'Mã NV', k: 'ma', w: 8 }, { t: 'MST', k: 'mst', w: 12 },
        { t: 'Thu nhập chịu thuế', k: 'tnct', kieu: 'so', w: 14 }, { t: 'Các khoản giảm trừ', k: 'gt', kieu: 'so', w: 14 }, { t: 'Thu nhập tính thuế', k: 'tntt', kieu: 'so', w: 14 }];
      for (var i = 1; i <= 12; i++) cot.push({ t: 'T' + i, k: 't' + i, kieu: 'so', w: 9 });
      cot.push({ t: 'Tổng thuế đã khấu trừ', k: 'thue', kieu: 'so', w: 13 });
      var keys = ['tnct', 'gt', 'tntt', 'thue']; for (i = 1; i <= 12; i++) keys.push('t' + i);
      return { tieuDe: 'BẢNG TỔNG HỢP THUẾ THU NHẬP CÁ NHÂN ĐÃ KHẤU TRỪ', phuDe: 'Năm ' + y + ' (theo kỳ lương)', cot: cot, rows: rows, tong: cong(rows, keys),
        ghiChu: 'Số liệu theo từng kỳ lương trong năm, dùng để đối chiếu khi quyết toán thuế TNCN. Tháng không có dữ liệu được bỏ qua.' };
    },
    nam: function () {
      var y = App.ky.y, rows = [];
      for (var m = 1; m <= 12; m++) {
        var bl = TL.tinhBangLuong(App.db, y, m), t = bl.tong;
        rows.push({ thang: 'Tháng ' + m + (bl.khoa ? ' 🔒' : ''), soNV: t.soNV, cong: t.cong.congTG, sp: t.luongSP, tong: t.tongThuNhap, bh: t.tongBH + t.doanPhi, thue: t.thue, net: t.thucLinh + t.tamUng, dn: t.dn.tong, chiPhi: t.chiPhiDN });
      }
      var cot = [{ t: 'STT', stt: true, w: 5, kieu: 'giua' }, { t: 'Kỳ lương', k: 'thang', w: 14 }, { t: 'Số NV', k: 'soNV', kieu: 'cong', w: 8, khongTong: true }, { t: 'Công lương TG', k: 'cong', kieu: 'cong', w: 10 },
        { t: 'Lương sản phẩm', k: 'sp', kieu: 'so', w: 14 }, { t: 'Tổng thu nhập', k: 'tong', kieu: 'so', w: 15 }, { t: 'BH, công đoàn NLĐ', k: 'bh', kieu: 'so', w: 14 }, { t: 'Thuế TNCN', k: 'thue', kieu: 'so', w: 13 },
        { t: 'NLĐ thực nhận', k: 'net', kieu: 'so', w: 15 }, { t: 'BH, KPCĐ DN đóng', k: 'dn', kieu: 'so', w: 14 }, { t: 'Tổng chi phí DN', k: 'chiPhi', kieu: 'so', w: 15 }];
      return { tieuDe: 'TỔNG HỢP QUỸ LƯƠNG NĂM ' + y, phuDe: '🔒 = kỳ đã chốt lương', cot: cot, rows: rows, tong: cong(rows, ['cong', 'sp', 'tong', 'bh', 'thue', 'net', 'dn', 'chiPhi']) };
    },
    phep: function () {
      var y = App.ky.y;
      var rows = App.db.nhanVien.filter(function (nv) { return nv.trangThai !== 'nghi_viec' || (nv.ngayNghi && nv.ngayNghi >= y + '-01-01'); }).map(function (nv) {
        var p = TL.phepNam(App.db, nv, y), r = { ma: nv.ma, hoTen: nv.hoTen, pb: TL.tenPhongBan(App.db, nv.phongBan), coBan: p.coBan, thamNien: p.thamNien, thang: p.dangThuViec ? 0 : p.thang,
          duoc: p.duoc, tichLuy: p.tichLuy, ton: p.ton, daNghi: p.daNghi, conLai: p.conLai, ghiChu: p.dangThuViec ? 'Đang thử việc' : p.thang < 12 ? 'Chính thức từ ' + TL.hienNgay(p.chinhThuc) : '' };
        p.theoThang.forEach(function (v, i) { r['t' + (i + 1)] = v; });
        return r;
      });
      var cot = [{ t: 'STT', stt: true, w: 5, kieu: 'giua' }, { t: 'Họ và tên', k: 'hoTen', w: 22 }, { t: 'Mã NV', k: 'ma', w: 8 }, { t: 'Phòng / đội', k: 'pb', w: 22 },
        { t: 'Cơ bản', k: 'coBan', kieu: 'cong', w: 6, khongTong: true }, { t: 'Thâm niên (+)', k: 'thamNien', kieu: 'cong', w: 7, khongTong: true },
        { t: 'Tháng làm việc', k: 'thang', kieu: 'cong', w: 7, khongTong: true },
        { t: 'Được hưởng', k: 'duoc', kieu: 'cong', w: 8 }, { t: 'Tích lũy đến nay', k: 'tichLuy', kieu: 'cong', w: 8 }, { t: 'Tồn năm trước', k: 'ton', kieu: 'cong', w: 7 }];
      for (var i = 1; i <= 12; i++) cot.push({ t: 'T' + i, k: 't' + i, kieu: 'cong', w: 5 });
      cot.push({ t: 'Đã nghỉ', k: 'daNghi', kieu: 'cong', w: 7 }, { t: 'Còn lại', k: 'conLai', kieu: 'cong', w: 7 }, { t: 'Ghi chú', k: 'ghiChu', w: 18 });
      var keys = ['duoc', 'tichLuy', 'ton', 'daNghi', 'conLai']; for (i = 1; i <= 12; i++) keys.push('t' + i);
      var cd = App.db.caiDat;
      return { tieuDe: 'BẢNG THEO DÕI NGHỈ PHÉP NĂM ' + y, cot: cot, rows: rows, tong: cong(rows, keys),
        phuDe: 'Đủ 12 tháng: ' + (cd.phepNam || 12) + ' ngày, cứ đủ ' + (cd.phepThamNienNam || 5) + ' năm làm việc thêm 1 ngày; mới vào hợp đồng chính thức: 1 tháng = 1 ngày. Nghỉ theo ngày dương lịch (P = 1 ngày, P/2 = 0,5 ngày)' };
    },
    cong: function () {
      var y = App.ky.y, m = App.ky.m, bl = TL.tinhBangLuong(App.db, y, m);
      var rows = bl.rows.map(function (r) {
        var c = r.cong;
        return { ma: r.ma, hoTen: r.hoTen, pb: r.tenPhongBan, muonLan: c.muonLan, muonPhut: c.muonPhut, phat: r.phatMuon, phep: c.phep, bhxh: c.bhxh, khong: c.khong, kp: c.kp, ot: c.otTong };
      }).filter(function (r) { return r.muonLan || r.phep || r.bhxh || r.khong || r.kp || r.ot; });
      var cot = [{ t: 'STT', stt: true, w: 5, kieu: 'giua' }, { t: 'Họ và tên', k: 'hoTen', w: 22 }, { t: 'Mã NV', k: 'ma', w: 8 }, { t: 'Phòng / đội', k: 'pb', w: 22 },
        { t: 'Đi muộn, về sớm (lần)', k: 'muonLan', kieu: 'cong', w: 9 }, { t: 'Số phút', k: 'muonPhut', kieu: 'cong', w: 8 }, { t: 'Tiền phạt', k: 'phat', kieu: 'so', w: 10 },
        { t: 'Nghỉ phép', k: 'phep', kieu: 'cong', w: 8 }, { t: 'Ốm, thai sản (BHXH)', k: 'bhxh', kieu: 'cong', w: 9 }, { t: 'Nghỉ không lương', k: 'khong', kieu: 'cong', w: 9 },
        { t: 'Nghỉ không phép', k: 'kp', kieu: 'cong', w: 9 }, { t: 'Làm thêm (giờ)', k: 'ot', kieu: 'cong', w: 9 }];
      return { tieuDe: 'THỐNG KÊ ĐI MUỘN, NGHỈ VIỆC, LÀM THÊM GIỜ', phuDe: 'Kỳ tháng ' + m + ' năm ' + y, cot: cot, rows: rows, tong: cong(rows, ['muonLan', 'muonPhut', 'phat', 'phep', 'bhxh', 'khong', 'kp', 'ot']) };
    }
  };

  function ve(noi) {
    var bc = BC[st.tab]();
    noi.innerHTML = '<div class="tabs khong-in">' + TABS.map(function (t) { return '<button data-t="' + t[0] + '"' + (st.tab === t[0] ? ' class="chon"' : '') + '>' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div class="the khong-in" style="padding:12px 14px"><div class="hang"><div class="gian"><b>' + h(bc.tieuDe) + '</b> <span class="mo">– ' + h(bc.phuDe) + '</span>' +
      (bc.ghiChu ? '<div class="mo nho">' + h(bc.ghiChu) + '</div>' : '') + '</div>' +
      '<button class="nut" id="bc-xuat">' + App.icon('tai') + 'Xuất Excel</button><button class="nut" id="bc-in">' + App.icon('in') + 'In</button></div></div>' +
      App.dauIn(bc.tieuDe, bc.phuDe) +
      '<div class="cuon cao">' + veBangChung(bc.cot, bc.rows, bc.tong) + '</div>' + App.kyIn();
    App.$('.tabs', noi).onclick = function (e) { var b = e.target.closest('[data-t]'); if (b) { st.tab = b.dataset.t; App.veLai(); } };
    App.$('#bc-in').onclick = function () { App.inTrang(); };
    App.$('#bc-xuat').onclick = function () {
      var t = Object.assign({ _nhan: 'TỔNG CỘNG' }, bc.tong);
      App.xuatExcel(App.tenFile(bc.tieuDe) + '_' + App.tenFile(bc.phuDe).slice(0, 20), [App.sheetBang({ ten: TABS.filter(function (x) { return x[0] === st.tab; })[0][1], tieuDe: bc.tieuDe, phuDe: bc.phuDe, cot: bc.cot, dong: bc.rows, tong: t, cotNhanTong: 1 })]);
    };
  }

  App.trang.baocao = { ve: ve };
})();
