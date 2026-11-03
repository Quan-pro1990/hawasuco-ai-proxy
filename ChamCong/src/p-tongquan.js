/* Trang Tổng quan (dashboard) */
(function () {
  'use strict';
  var App = window.App, TL = window.TL, h = App.h;

  function phanTram(moi, cu) {
    if (!cu) return '';
    var p = Math.round((moi - cu) / cu * 1000) / 10;
    if (!p) return '<span>= tháng trước</span>';
    return '<span class="' + (p > 0 ? 'tang' : 'giam') + '">' + (p > 0 ? '▲ ' : '▼ ') + App.so(Math.abs(p)) + '%</span> so với tháng trước';
  }

  function ve(noi) {
    var db = App.db, y = App.ky.y, m = App.ky.m;
    var bl = TL.tinhBangLuong(db, y, m), t = bl.tong;
    var tr = new Date(y, m - 2, 1), blTruoc = TL.tinhBangLuong(db, tr.getFullYear(), tr.getMonth() + 1);
    var html = '';

    if (db.laMau) {
      html += '<div class="goi-y khong-in" style="margin-bottom:16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div class="gian" style="flex:1;min-width:240px">' +
        '<b>Bạn đang xem dữ liệu mẫu.</b> Hãy thử chấm công, sửa lương, xuất Excel… Khi sẵn sàng dùng thật, bấm nút bên phải để xoá dữ liệu mẫu ' +
        '(giữ lại cài đặt, ký hiệu, phụ cấp, ngày lễ).</div><button class="nut chinh" id="xoa-mau">Xoá dữ liệu mẫu, bắt đầu nhập thật</button></div>';
    } else {
      var ls = db.lanSaoLuu ? new Date(db.lanSaoLuu) : null;
      if (db.nhanVien.length && (!ls || (Date.now() - ls) > 7 * 864e5)) {
        html += '<div class="canh-bao khong-in" style="margin-bottom:16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:240px">' +
          (ls ? 'Lần sao lưu gần nhất: ' + ls.toLocaleDateString('vi-VN') + '. ' : 'Bạn chưa sao lưu dữ liệu lần nào. ') +
          'Dữ liệu đang nằm trong trình duyệt của máy này – nên sao lưu ra file mỗi tuần.</div><a class="nut" href="#caidat">Sao lưu ngay</a></div>';
      }
    }

    var moi = 0, nghi = 0, dau = TL.batDauKy(db, y, m), cuoi = TL.ketThucKy(db, y, m);
    db.nhanVien.forEach(function (nv) {
      if (nv.ngayVao && nv.ngayVao >= dau && nv.ngayVao <= cuoi) moi++;
      if (nv.ngayNghi && nv.ngayNghi >= dau && nv.ngayNghi <= cuoi) nghi++;
    });
    var soThue = bl.rows.filter(function (r) { return r.thue > 0; }).length;
    var bq = t.soNV ? Math.round(t.cong.congHL / t.soNV * 10) / 10 : 0;
    html += '<div class="kpis">' +
      kpi('Nhân viên trong kỳ', App.tien(t.soNV), (moi ? '+' + moi + ' mới vào' : '') + (moi && nghi ? ' · ' : '') + (nghi ? nghi + ' nghỉ việc' : '') || 'Không có biến động') +
      kpi('Ngày công hưởng lương', App.so(t.cong.congHL), 'Bình quân ' + App.so(bq) + ' / ' + App.so(bl.congChuan) + ' công chuẩn') +
      kpi('Tổng thu nhập (gross)', App.tien(t.tongThuNhap), phanTram(t.tongThuNhap, blTruoc.tong.tongThuNhap) || 'Lương + làm thêm + phụ cấp + thưởng') +
      kpi('Lãnh kỳ II (net)', App.tien(t.thucLinh), 'Đã tạm ứng kỳ I: ' + App.tien(t.tamUng)) +
      kpi('Bảo hiểm (NLĐ + DN)', App.tien(t.tongBH + t.dn.tong), 'NLĐ ' + App.tien(t.tongBH) + ' · DN ' + App.tien(t.dn.tong)) +
      kpi('Thuế TNCN khấu trừ', App.tien(t.thue), soThue + ' người phải nộp') +
      '</div>';

    html += '<div class="cot-2-1">' +
      '<div class="the"><h3>Quỹ lương 12 tháng<span class="phai">Tổng thu nhập · bấm vào cột để xem tháng đó</span></h3><div id="bd-12"></div></div>' +
      '<div class="the"><h3>Cơ cấu chi phí lương tháng ' + m + '</h3><div class="kpi" style="border:0;padding:0;margin-bottom:10px"><div class="nhan">Tổng chi phí của doanh nghiệp</div><div class="gt">' + App.tien(t.chiPhiDN) + '</div></div><div id="bd-cc"></div></div>' +
      '</div>';

    html += '<div class="cot3">' +
      '<div class="the"><h3>Quỹ lương theo phòng / đội</h3><div id="bd-pb"></div></div>' +
      '<div class="the"><h3>Tình hình công kỳ tháng ' + m + '</h3><div id="bd-cong"></div></div>' +
      '<div class="the"><h3>Cần chú ý</h3><ul class="ds-gon" id="chu-y"></ul></div>' +
      '</div>';

    var hn = new Date(), hnIso0 = App.homNay();
    if (hnIso0 >= dau && hnIso0 <= cuoi) html += '<div class="the"><h3>Hôm nay ' + TL.TEN_THU_DAY[hn.getDay()].toLowerCase() + ', ' + hn.toLocaleDateString('vi-VN') + '</h3><div id="hom-nay"></div></div>';

    noi.innerHTML = html;

    var nut = App.$('#xoa-mau');
    if (nut) nut.onclick = function () {
      App.xacNhan('Xoá toàn bộ nhân viên, chấm công, bảng lương mẫu? Cài đặt, danh mục ký hiệu, phụ cấp và ngày lễ được giữ lại.', { nut: 'Xoá dữ liệu mẫu', nguy: true }).then(function (ok) {
        if (!ok) return;
        var cu = App.db, moiDb = TL.duLieuMoi();
        moiDb.caiDat = cu.caiDat; moiDb.kyHieu = cu.kyHieu; moiDb.phuCap = cu.phuCap; moiDb.ngayLe = cu.ngayLe;
        moiDb.phongBan = cu.phongBan;
        App.db = moiDb; App.luuNgay();
        App.bao('Đã xoá dữ liệu mẫu. Hãy nhập thông tin công ty và danh sách nhân viên.', 'tot');
        location.hash = '#caidat';
        App.veLai();
      });
    };

    // Biểu đồ 12 tháng
    var du = [];
    for (var i = 11; i >= 0; i--) {
      var d = new Date(y, m - 1 - i, 1), yy = d.getFullYear(), mm = d.getMonth() + 1;
      var b = (i === 0) ? bl : TL.tinhBangLuong(db, yy, mm);
      du.push({
        nhan: 'T' + mm, tieuDe: App.tenKy(yy, mm), gt: b.tong.tongThuNhap, noiBat: i === 0, y: yy, m: mm,
        tip: [['Số nhân viên', App.tien(b.tong.soNV)], ['Tổng thu nhập', App.tien(b.tong.tongThuNhap)], ['Thực lĩnh', App.tien(b.tong.thucLinh)], ['Chi phí doanh nghiệp', App.tien(b.tong.chiPhiDN)]]
      });
    }
    App.bieuDoCot(App.$('#bd-12'), du, { nhan: 'Tổng thu nhập', noiBat: true, bam: function (d) { App.datKy(d.y, d.m); } });

    App.thanhCoCau(App.$('#bd-cc'), [
      { nhan: 'NLĐ thực nhận (gồm tạm ứng)', gt: t.thucLinh + t.tamUng + t.khauTru + t.phatMuon, mau: 'var(--s1)' },
      { nhan: 'BH người lao động đóng', gt: t.tongBH + t.doanPhi, mau: 'var(--s2)' },
      { nhan: 'Thuế TNCN', gt: t.thue, mau: 'var(--s3)' },
      { nhan: 'BH + KPCĐ doanh nghiệp đóng', gt: t.dn.tong, mau: 'var(--s4)' }
    ]);

    // Theo phòng / đội
    var pb = {};
    bl.rows.forEach(function (r) {
      var k = r.tenPhongBan || '(Chưa phân phòng / đội)';
      if (!pb[k]) pb[k] = { gt: 0, n: 0, net: 0 };
      pb[k].gt += r.tongThuNhap; pb[k].n++; pb[k].net += r.thucLinh;
    });
    App.bieuDoNgang(App.$('#bd-pb'), Object.keys(pb).map(function (k) {
      return { nhan: k, phu: pb[k].n + ' NV', gt: pb[k].gt, tip: [['Số nhân viên', pb[k].n], ['Tổng thu nhập', App.tien(pb[k].gt)], ['Thực lĩnh', App.tien(pb[k].net)]] };
    }).sort(function (a, b) { return b.gt - a.gt; }));

    // Tình hình công
    var nhom = { lamTG: 0, sp: 0, phep: 0, le: 0, huong: 0, ngung: 0, bhxh: 0, khong: 0, kp: 0 };
    bl.rows.forEach(function (r) {
      var c = r.cong;
      nhom.lamTG += c.lamTG || 0; nhom.sp += c.sp || 0; nhom.phep += c.phep; nhom.le += c.le; nhom.huong += c.huongKhac; nhom.ngung += c.ngung || 0;
      nhom.bhxh += c.bhxh; nhom.khong += c.khong; nhom.kp += c.kp;
    });
    var tenNhom = Object.assign({}, TL.NHOM_KY_HIEU, { lamTG: 'Đi làm (lương thời gian)', sp: 'Đi làm (lương sản phẩm)' });
    App.bieuDoNgang(App.$('#bd-cong'), Object.keys(nhom).filter(function (k) { return nhom[k] || k === 'lamTG'; }).map(function (k) {
      return { nhan: tenNhom[k], gt: Math.round(nhom[k] * 10) / 10, tip: [['Số ngày công', App.so(nhom[k])]] };
    }), { dinhDang: function (v) { return App.so(v) + ' ngày'; } });

    // Cần chú ý
    var cy = [];
    var hnIso = App.homNay();
    var le = TL.bangNgayLe(db), ngayK = TL.ngayKy(db, y, m);
    var thieu = 0, thieuNV = 0;
    TL.dsNhanVienKy(db, y, m).forEach(function (nv) {
      if (nv.hinhThuc === 'gio') return;
      var n = 0;
      ngayK.forEach(function (x) {
        if (x.iso > hnIso || !TL.nvLamNgay(nv, x.y, x.m, x.d)) return;
        if (TL.loaiNgay(db, x.y, x.m, x.d, le, nv) === 'nghi') return;
        if (!TL.oNgay(db, 'cc', nv.id, x.y, x.m, x.d)) n++;
      });
      if (n) { thieu += n; thieuNV++; }
    });
    if (thieuNV) cy.push(['<a href="#chamcong">' + thieuNV + ' nhân viên còn ô chưa chấm công</a>', '<span class="the-tt cam">' + thieu + ' ô</span>']);
    var canh = bl.rows.filter(function (r) { return r.canhBao && r.canhBao.length; });
    if (canh.length) cy.push(['<a href="#bangluong">' + canh.length + ' nhân viên có lưu ý khi tính lương</a>', '<span class="the-tt cam">Xem</span>']);
    var choDuyet = (db.donNghi || []).filter(function (d) { return d.trangThai === 'cho'; }).length;
    if (choDuyet) cy.push(['<a href="#nghiphep">' + choDuyet + ' đơn nghỉ phép chờ duyệt</a>', '<span class="the-tt cam">Duyệt</span>']);
    var chuaHD = 0;
    db.nhanVien.forEach(function (nv) {
      if (nv.trangThai === 'nghi_viec') return;
      if (nv.ngaySinh && +nv.ngaySinh.slice(5, 7) === m) cy.push(['🎂 Sinh nhật <span class="lk" data-hs="' + nv.id + '">' + h(nv.hoTen) + '</span>', '<span class="the-tt lam">' + nv.ngaySinh.slice(8, 10) + '/' + TL.pad(m) + '</span>']);
      var hd = App.hdHieuLuc ? App.hdHieuLuc(nv) : null, het = hd ? hd.denNgay : nv.ngayHetHD;
      if (App.hdHieuLuc && !hd) chuaHD++;
      if (het) {
        var con = Math.round((new Date(het) - new Date(hnIso)) / 864e5);
        if (con >= -30 && con <= 30) cy.push([(nv.trangThai === 'thu_viec' ? 'Hết thử việc: ' : 'Hết hạn hợp đồng: ') + '<span class="lk" data-hs="' + nv.id + '">' + h(nv.hoTen) + '</span>', '<span class="the-tt ' + (con <= 7 ? 'do' : 'cam') + '">' + (con < 0 ? 'đã hết ' + (-con) + ' ngày' : 'còn ' + con + ' ngày') + '</span>']);
      }
      var nh = TL.ngayNghiHuu(nv.gioiTinh, nv.ngaySinh);
      if (nh) { var cn = Math.round((new Date(nh) - new Date(hnIso)) / 864e5); if (cn >= 0 && cn <= 180) cy.push(['Đến tuổi nghỉ hưu: <span class="lk" data-hs="' + nv.id + '">' + h(nv.hoTen) + '</span>', '<span class="the-tt lam">' + TL.hienNgay(nh) + '</span>']); }
    });
    if (chuaHD) cy.push(['<a href="#hopdong">' + chuaHD + ' nhân viên chưa có hợp đồng lao động</a>', '<span class="the-tt cam">Bổ sung</span>']);
    bl.rows.filter(function (r) { return r.cong.muonLan >= 3; }).sort(function (a, b) { return b.cong.muonPhut - a.cong.muonPhut; }).slice(0, 3).forEach(function (r) {
      cy.push(['Đi muộn / về sớm: ' + h(r.hoTen), '<span class="the-tt do">' + r.cong.muonLan + ' lần · ' + r.cong.muonPhut + ' phút</span>']);
    });
    App.$('#chu-y').innerHTML = cy.length ? cy.map(function (c) { return '<li><span>' + c[0] + '</span>' + c[1] + '</li>'; }).join('') : '<li class="mo">Không có gì cần chú ý.</li>';
    App.$('#chu-y').onclick = function (e) { var a = e.target.closest('[data-hs]'); if (a) App.moHoSo(a.dataset.hs, 'canhan'); };

    // Hôm nay
    var hnEl = App.$('#hom-nay');
    if (hnEl) {
      var hy = hn.getFullYear(), hm = hn.getMonth() + 1, dd = hn.getDate(), kh = TL.bangKyHieu(db), dem = {}, chua = [], nghiTuan = 0;
      TL.dsNhanVienKy(db, y, m).forEach(function (nv) {
        if (!TL.nvLamNgay(nv, hy, hm, dd)) return;
        var c = TL.oNgay(db, 'cc', nv.id, hy, hm, dd);
        var k = c && kh[String(c).toUpperCase()];
        if (k) dem[k.nhom] = (dem[k.nhom] || 0) + 1;
        else if (TL.loaiNgay(db, hy, hm, dd, le, nv) === 'nghi') nghiTuan++;
        else chua.push(nv.hoTen);
      });
      var loaiHn = (!Object.keys(dem).length && !chua.length) ? 'nghi' : '';
      hnEl.innerHTML = loaiHn === 'nghi' ? '<p class="mo">Hôm nay là ngày nghỉ hằng tuần.</p>' :
        '<div class="hang" style="gap:10px">' + Object.keys(TL.NHOM_KY_HIEU).filter(function (k) { return dem[k]; }).map(function (k) {
          return '<span class="the-tt lam" style="font-size:13px;padding:4px 12px">' + TL.NHOM_KY_HIEU[k] + ': <b>' + dem[k] + '</b></span>';
        }).join('') + (chua.length ? '<span class="the-tt cam" style="font-size:13px;padding:4px 12px" title="' + h(chua.join(', ')) + '">Chưa chấm: <b>' + chua.length + '</b></span>' : '') +
        (nghiTuan ? '<span class="the-tt" style="font-size:13px;padding:4px 12px">Nghỉ hằng tuần: <b>' + nghiTuan + '</b></span>' : '') +
        ' <a class="nut nho" href="#chamcong">Mở bảng chấm công</a></div>';
    }
  }

  function kpi(nhan, gt, phu) {
    return '<div class="kpi"><div class="nhan">' + nhan + '</div><div class="gt">' + gt + '</div><div class="phu">' + (phu || '&nbsp;') + '</div></div>';
  }

  App.trang.dashboard = { ve: ve };
})();
