/* Dữ liệu mẫu cho lần mở đầu tiên – để xem ngay các chức năng. Xoá được ở trang Tổng quan / Cài đặt. */
(function () {
  'use strict';
  var TL = window.TL, App = window.App;

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  App.taoMau = function () {
    var db = TL.duLieuMoi();
    var R = rng(20261102);
    var hn = new Date(), Y = hn.getFullYear(), M = hn.getMonth() + 1, D = hn.getDate();
    db.laMau = true;
    db.caiDat.ngayDauKy = 21; // kỳ công từ ngày 21 tháng trước đến ngày 20 tháng này
    db.congTy = Object.assign(db.congTy, {
      ten: 'Công ty TNHH ABC (dữ liệu mẫu)', diaChi: 'Số 1 đường Mẫu, phường Mẫu, tỉnh Mẫu', mst: '0100000000', diaDanh: 'Cần Thơ',
      nguoiLap: 'Bùi Thị Lan', keToan: 'Trần Thị Bình', giamDoc: 'Nguyễn Văn An', nguoiChamCong: 'Bùi Thị Lan', phuTrachBP: '', nguoiDuyet: 'Nguyễn Văn An'
    });
    db.phongBan = [
      { ma: 'BGD', ten: 'Ban Giám đốc' },
      { ma: 'TCHC', ten: 'Phòng Tổ chức - Hành chính' },
      { ma: 'KTTV', ten: 'Phòng Kế toán - Tài vụ' },
      { ma: 'KDVT', ten: 'Phòng Kinh doanh - Vật tư' },
      { ma: 'KTH', ten: 'Phòng Kỹ thuật' }
    ];
    function lui(thang) { var t = new Date(Y, M - 1 - thang, 1); return { y: t.getFullYear(), m: t.getMonth() + 1 }; }
    var vaoTV = lui(1), nghiNV = lui(4);
    // [mã, họ tên, giới tính, ngày sinh, phòng, chức vụ, ngày vào, lương, phụ cấp, NPT, lịch làm]
    var ds = [
      ['NV001', 'Nguyễn Văn An', 'Nam', '1975-03-12', 'BGD', 'Giám đốc', '2015-01-05', 30000000, { AN: 50000, DT: 1000000, TN: 4000000 }, 2, 'T2-T6'],
      ['NV002', 'Trần Thị Bình', 'Nữ', '1982-07-21', 'KTTV', 'Kế toán trưởng', '2016-03-01', 18000000, { AN: 50000, DT: 500000, TN: 2000000 }, 1, 'T2-T6'],
      ['NV003', 'Lê Hoàng Cường', 'Nam', '1985-11-02', 'KDVT', 'Trưởng phòng', '2017-06-15', 15500000, { AN: 50000, TN: 1500000 }, 2, 'T2-T6'],
      ['NV004', 'Phạm Thu Dung', 'Nữ', '1990-' + TL.pad(M) + '-14', 'TCHC', 'Trưởng phòng', '2018-04-02', 14000000, { AN: 50000, TN: 1500000 }, 1, 'T2-T6'],
      ['NV005', 'Hoàng Minh Đức', 'Nam', '1988-09-30', 'KTH', 'Trưởng phòng', '2017-09-01', 15000000, { AN: 50000, TN: 1500000 }, 2, 'T2-T6'],
      ['NV006', 'Vũ Thị Hà', 'Nữ', '1993-05-18', 'KTTV', 'Kế toán viên', '2020-07-01', 9000000, { AN: 50000 }, 0, 'T2-T6'],
      ['NV007', 'Đặng Quốc Huy', 'Nam', '1995-12-05', 'KDVT', 'Nhân viên ghi thu', '2021-02-22', 8040000, { AN: 50000 }, 0, 'T2-T7'],
      ['NV008', 'Bùi Thị Lan', 'Nữ', '1996-08-08', 'TCHC', 'Chuyên viên nhân sự', '2021-10-11', 9000000, { AN: 50000 }, 0, 'T2-T6'],
      ['NV009', 'Đỗ Văn Long', 'Nam', '1992-04-25', 'KTH', 'CN LĐ-SC', '2019-05-06', 9000000, { AN: 50000 }, 1, 'T2-T7'],
      ['NV010', 'Ngô Thị Mai', 'Nữ', '1997-' + TL.pad(M) + '-25', 'KDVT', 'Nhân viên ghi thu', '2022-03-01', 7320000, { AN: 50000 }, 0, 'T2-T7'],
      ['NV011', 'Dương Văn Nam', 'Nam', '1994-06-11', 'KTH', 'CN LĐ-SC', '2020-11-16', 8000000, { AN: 50000 }, 1, 'T2-T7'],
      ['NV012', 'Lý Thị Oanh', 'Nữ', '1999-10-03', 'KDVT', 'Thủ kho', '2023-02-13', 8000000, { AN: 50000 }, 0, 'T2-T6'],
      ['NV013', 'Phan Thanh Phong', 'Nam', '1998-03-27', 'KDVT', 'Tài xế', '2024-08-05', 9000000, { AN: 50000 }, 0, 'T2-T7'],
      ['NV014', 'Trịnh Thị Quỳnh', 'Nữ', '2000-12-12', 'KDVT', 'Nhân viên ghi thu', TL.iso(vaoTV.y, vaoTV.m, 1), 7000000, { AN: 50000 }, 0, 'T2-T7'],
      ['NV015', 'Mai Văn Sơn', 'Nam', '1979-07-07', 'TCHC', 'Bảo vệ', '2019-01-02', 300000, { AN: 50000 }, 1, 'T2-CN'],
      ['NV016', 'Hồ Thị Thu', 'Nữ', '2003-05-05', 'TCHC', 'Cộng tác viên', '2025-09-08', 30000, {}, 0, ''],
      ['NV017', 'Tạ Văn Tâm', 'Nam', '1990-01-20', 'KDVT', 'Nhân viên ghi thu', '2022-05-01', 7320000, { AN: 50000 }, 0, 'T2-T7']
    ];
    db.nhanVien = ds.map(function (x, i) {
      return {
        id: 'nv' + (i + 1), ma: x[0], maChamCong: String(i + 1), hoTen: x[1], gioiTinh: x[2], ngaySinh: x[3], phongBan: x[4], chucVu: x[5],
        ngayVao: x[6], luongCB: x[7], phuCap: x[8], soNPT: x[9], lichLam: x[10], hinhThuc: 'thang', tiLeHuong: 100, thamGiaBH: true, doanVien: true,
        cachTinhThue: 'luy_tien', trangThai: 'dang_lam', loaiHD: 'Không xác định thời hạn', luongBH: 0,
        cccd: '0010' + (90000000 + i * 7919), sdt: '09' + String(10000000 + i * 1234567).slice(0, 8), email: '', diaChi: '',
        mst: '80' + String(10000000 + i * 271828).slice(0, 8), nganHang: i % 3 ? 'Vietcombank' : 'BIDV', soTK: '10' + String(20000000 + i * 3141592).slice(0, 10),
        phepNam: i < 3 ? 14 : 12, phepTon: i % 4 === 0 ? 2 : 0, ghiChu: ''
      };
    });
    var nv3 = db.nhanVien[2], nv14 = db.nhanVien[13], nv15 = db.nhanVien[14], nv16 = db.nhanVien[15], nv17 = db.nhanVien[16];
    nv3.thamGiaBH = false; nv3.ghiChu = 'Đã nghỉ hưu, làm việc theo hợp đồng – không đóng BHXH';
    nv14.trangThai = 'thu_viec'; nv14.tiLeHuong = 85; nv14.thamGiaBH = false; nv14.loaiHD = 'Thử việc'; nv14.doanVien = false;
    nv14.ngayHetHD = TL.iso(Y, M, TL.soNgay(Y, M));
    nv15.hinhThuc = 'ngay'; nv15.luongBH = 6000000; nv15.loaiHD = 'Xác định thời hạn'; nv15.ngayHetHD = TL.congNgay(Y, M, D, 20);
    nv16.hinhThuc = 'gio'; nv16.thamGiaBH = false; nv16.cachTinhThue = 'khau_tru'; nv16.loaiHD = 'Thời vụ / khoán việc'; nv16.doanVien = false;
    nv17.trangThai = 'nghi_viec'; nv17.ngayNghi = TL.iso(nghiNV.y, nghiNV.m, 20);

    db.ngayLe = TL.taoNgayLe(Y - 1, db.caiDat).concat(TL.taoNgayLe(Y, db.caiDat), TL.taoNgayLe(Y + 1, db.caiDat));
    var le = TL.bangNgayLe(db);
    var thaiSan = [lui(6), lui(5), lui(4)].map(function (k) { return TL.khoaKy(k.y, k.m); });
    var ghiThu = function (nv) { return nv.chucVu === 'Nhân viên ghi thu'; };

    // 1) Chấm công theo ngày thật (13 tháng gần nhất đến hôm nay)
    for (var lu = 13; lu >= 0; lu--) {
      var k = lui(lu), y = k.y, m = k.m;
      var T = TL.thang(db, y, m, true);
      var nd = TL.soNgay(y, m);
      var coVaoRa = lu <= 2;
      db.nhanVien.forEach(function (nv) {
        var cc = {}, ot = {}, mu = {}, vr = {};
        for (var d = 1; d <= nd; d++) {
          if (lu === 0 && d > D) break;
          if (!TL.nvLamNgay(nv, y, m, d)) continue;
          var loai = TL.loaiNgay(db, y, m, d, le, nv);
          if (loai === 'le') { if (nv.hinhThuc !== 'gio') cc[d] = 'L'; continue; }
          // nhân viên ghi thu: đợt ghi chỉ số ngày 17–22 hằng tháng chấm SP (kể cả chủ nhật)
          if (ghiThu(nv) && d >= 17 && d <= 22 && R() < 0.85) { cc[d] = 'SP'; continue; }
          if (loai === 'nghi') {
            if (nv.phongBan === 'KTH' && TL.thuTrongTuan(y, m, d) === 0 && R() < 0.15) {
              ot[d] = 4;
              if (coVaoRa) vr[d] = { v: '07:5' + Math.floor(R() * 9), r: TL.hhmm(13 * 60 + Math.floor(R() * 12)) };
            }
            continue;
          }
          if (nv.id === 'nv6' && thaiSan.indexOf(TL.khoaKy(y, m)) >= 0) { cc[d] = 'TS'; continue; }
          var r = R(), kh = '+';
          if (nv.hinhThuc === 'gio') { kh = r < 0.45 ? '+/2' : r < 0.75 ? '+' : ''; }
          else if (r < 0.022) kh = 'P';
          else if (r < 0.03) kh = 'Ô';
          else if (r < 0.034) kh = 'KL';
          else if (r < 0.036) kh = 'KP';
          else if (r < 0.042) kh = 'P/2';
          else if (nv.phongBan === 'KDVT' && !ghiThu(nv) && r < 0.08) kh = 'CT';
          if (!kh) continue;
          cc[d] = kh;
          if (kh === '+' || kh === '+/2' || kh === 'P/2') {
            var muon = R() < 0.06 ? 6 + Math.floor(R() * 35) : 0;
            var gioOT = nv.phongBan === 'KTH' && kh === '+' && R() < 0.14 ? 1 + Math.floor(R() * 5) * 0.5 : 0;
            if (muon) mu[d] = muon;
            if (gioOT) ot[d] = gioOT;
            if (coVaoRa) {
              var v = 7 * 60 + 25 - Math.floor(R() * 20) + (muon ? muon + 35 : 0);
              var ra = kh === '+' ? 17 * 60 + Math.floor(R() * 14) + gioOT * 60 : 11 * 60 + 30 + Math.floor(R() * 10);
              if (kh === 'P/2') { v = 13 * 60 - Math.floor(R() * 10); ra = 17 * 60 + Math.floor(R() * 10); }
              vr[d] = { v: TL.hhmm(v), r: TL.hhmm(ra) };
            }
          }
        }
        if (Object.keys(cc).length) T.cc[nv.id] = cc;
        if (Object.keys(ot).length) T.ot[nv.id] = ot;
        if (Object.keys(mu).length) T.muon[nv.id] = mu;
        if (coVaoRa && Object.keys(vr).length) T.vr[nv.id] = vr;
      });
    }

    // 2) Thưởng, tạm ứng, sản lượng theo kỳ lương; chốt các kỳ cũ
    var tet = TL.taoNgayLe(Y, db.caiDat).filter(function (x) { return /mùng 1/.test(x.ten); })[0];
    var kyTet = tet ? TL.kyCuaNgay(db, +tet.ngay.slice(0, 4), +tet.ngay.slice(5, 7), +tet.ngay.slice(8, 10)) : null;
    var kyNay = TL.kyCuaNgay(db, Y, M, D);
    for (var lk = 12; lk >= 0; lk--) {
      var t = new Date(kyNay.y, kyNay.m - 1 - lk, 1), ky = t.getFullYear(), km = t.getMonth() + 1;
      var TK = TL.thang(db, ky, km, true);
      TL.dsNhanVienKy(db, ky, km).forEach(function (nv, idx) {
        var dc = {};
        if (kyTet && kyTet.y === ky && kyTet.m === km && nv.hinhThuc === 'thang') dc.thuong = Math.round(nv.luongCB / 100000) * 100000;
        if (ghiThu(nv)) dc.slSP = 1500 + Math.floor(R() * 1100);
        if (nv.hinhThuc === 'thang' && idx > 0 && R() < 0.6) dc.tamUng = nv.luongCB >= 15000000 ? 3000000 : 2000000;
        if (R() < 0.04 && idx > 3) { dc.khauTru = 150000; dc.ghiChu = 'Bồi thường làm hỏng dụng cụ'; }
        if (Object.keys(dc).length) TK.dc[nv.id] = dc;
      });
      if (lk >= 3) TL.chotThang(db, ky, km);
    }
    return db;
  };
})();
