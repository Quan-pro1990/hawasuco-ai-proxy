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
      ten: 'CÔNG TY TNHH MTV CẤP NƯỚC HẬU GIANG', diaChi: 'Số 1 đường Mẫu, phường Mẫu, tỉnh Mẫu', mst: '0100000000', diaDanh: 'Cần Thơ',
      nguoiLap: 'Bùi Thị Lan', keToan: 'Trần Thị Bình', giamDoc: 'Nguyễn Văn An', nguoiChamCong: 'Bùi Thị Lan', phuTrachBP: '', nguoiDuyet: 'Nguyễn Văn An'
    });
    db.phongBan = [
      { ma: 'BGD', ten: 'Ban Giám đốc', loai: 'ban' },
      { ma: 'TCHC', ten: 'Phòng Tổ chức - Hành chính', loai: 'phong' },
      { ma: 'KTTV', ten: 'Phòng Kế toán - Tài vụ', loai: 'phong' },
      { ma: 'KDVT', ten: 'Phòng Kinh doanh - Vật tư', loai: 'phong' },
      { ma: 'KTH', ten: 'Phòng Kỹ thuật', loai: 'phong' },
      { ma: 'D1', ten: 'Đội Cấp nước số 1', loai: 'doi' },
      { ma: 'D2', ten: 'Đội Cấp nước số 2', loai: 'doi' },
      { ma: 'DTC', ten: 'Đội Thi công – Sửa chữa', loai: 'doi' }
    ];
    // bảng lương: Văn phòng công ty (Ban GĐ + các phòng) và mỗi đội 1 bảng; ngân hàng chi lương (số TK mẫu)
    db.khoiLuong = {
      'Văn phòng công ty': { nganHang: 'Ngân hàng TMCP Công Thương Việt Nam – Chi nhánh Hậu Giang', soTK: '000000000001' },
      'Đội Cấp nước số 1': { nganHang: 'Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam – Chi nhánh Hậu Giang', soTK: '000000000002' },
      'Đội Cấp nước số 2': { nganHang: 'Ngân hàng TMCP Công Thương Việt Nam – Chi nhánh Hậu Giang', soTK: '000000000001' },
      'Đội Thi công – Sửa chữa': { nganHang: 'Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam – Chi nhánh Hậu Giang', soTK: '000000000002' }
    };
    var kyThuat = function (nv) { return ['KTH', 'D1', 'D2', 'DTC'].indexOf(nv.phongBan) >= 0; };
    function lui(thang) { var t = new Date(Y, M - 1 - thang, 1); return { y: t.getFullYear(), m: t.getMonth() + 1 }; }
    var vaoTV = lui(1), nghiNV = lui(4);
    db.sanPham = [
      { ma: 'HD', ten: 'Hoá đơn ghi thu', dvt: 'HĐ', donGia: 1200 },
      { ma: 'DH', ten: 'Lắp đặt, thay đồng hồ nước', dvt: 'cái', donGia: 60000 }
    ];
    // [mã, họ tên, giới tính, ngày sinh, phòng, chức vụ, ngày vào, lương, phụ cấp, NPT, loại lao động]
    var ds = [
      ['NV001', 'Nguyễn Văn An', 'Nam', '1975-03-12', 'BGD', 'Giám đốc', '2015-01-05', 30000000, { DT: 1000000, TN: 4000000 }, 2, 'VP'],
      ['NV002', 'Trần Thị Bình', 'Nữ', '1982-07-21', 'KTTV', 'Kế toán trưởng', '2016-03-01', 18000000, { DT: 500000, TN: 2000000 }, 1, 'VP'],
      ['NV003', 'Lê Hoàng Cường', 'Nam', '1985-11-02', 'KDVT', 'Trưởng phòng', '2017-06-15', 15500000, { TN: 1500000 }, 2, 'VP'],
      ['NV004', 'Phạm Thu Dung', 'Nữ', '1990-' + TL.pad(M) + '-14', 'TCHC', 'Trưởng phòng', '2018-04-02', 14000000, { TN: 1500000 }, 1, 'VP'],
      ['NV005', 'Hoàng Minh Đức', 'Nam', '1988-09-30', 'KTH', 'Trưởng phòng', '2017-09-01', 15000000, { TN: 1500000 }, 2, 'VP'],
      ['NV006', 'Vũ Thị Hà', 'Nữ', '1993-05-18', 'KTTV', 'Kế toán viên', '2020-07-01', 9000000, {}, 0, 'VP'],
      ['NV007', 'Đặng Quốc Huy', 'Nam', '1995-12-05', 'KDVT', 'Nhân viên ghi thu', '2021-02-22', 8040000, {}, 0, 'CN'],
      ['NV008', 'Bùi Thị Lan', 'Nữ', '1996-08-08', 'TCHC', 'Chuyên viên nhân sự', '2021-10-11', 9000000, {}, 0, 'VP'],
      ['NV009', 'Đỗ Văn Long', 'Nam', '1992-04-25', 'DTC', 'CN LĐ-SC', '2019-05-06', 9000000, {}, 1, 'CN'],
      ['NV010', 'Ngô Thị Mai', 'Nữ', '1997-' + TL.pad(M) + '-25', 'D2', 'Nhân viên ghi thu', '2022-03-01', 7320000, {}, 0, 'CN'],
      ['NV011', 'Dương Văn Nam', 'Nam', '1994-06-11', 'D1', 'CN LĐ-SC', '2020-11-16', 8000000, {}, 1, 'CN'],
      ['NV012', 'Lý Thị Oanh', 'Nữ', '1999-10-03', 'KDVT', 'Thủ kho', '2023-02-13', 8040000, {}, 0, 'VP'],
      ['NV013', 'Phan Thanh Phong', 'Nam', '1998-03-27', 'KDVT', 'Tài xế', '2024-08-05', 9000000, {}, 0, 'CN'],
      ['NV014', 'Trịnh Thị Quỳnh', 'Nữ', '2000-12-12', 'KDVT', 'Nhân viên ghi thu', TL.iso(vaoTV.y, vaoTV.m, 1), 7000000, {}, 0, 'CN'],
      ['NV015', 'Mai Văn Sơn', 'Nam', '1979-07-07', 'TCHC', 'Bảo vệ', '2019-01-02', 300000, {}, 1, ''],
      ['NV016', 'Hồ Thị Thu', 'Nữ', '2003-05-05', 'TCHC', 'Cộng tác viên', '2025-09-08', 30000, { AN: 0 }, 0, ''],
      ['NV017', 'Tạ Văn Tâm', 'Nam', '1990-01-20', 'KDVT', 'Nhân viên ghi thu', '2022-05-01', 7320000, {}, 0, 'T2-T7']
    ];
    db.nhanVien = ds.map(function (x, i) {
      return {
        id: 'nv' + (i + 1), ma: x[0], maChamCong: String(i + 1), hoTen: x[1], gioiTinh: x[2], ngaySinh: x[3], phongBan: x[4], chucVu: x[5],
        ngayVao: x[6], luongCB: x[7], phuCap: x[8], soNPT: x[9], loaiLD: x[10], maSP: x[5] === 'CN LĐ-SC' ? 'DH' : '', hinhThuc: 'thang', tiLeHuong: 100, thamGiaBH: true, doanVien: true,
        cachTinhThue: 'luy_tien', trangThai: 'dang_lam', loaiHD: 'Không xác định thời hạn', luongBH: 0,
        cccd: '0010' + (90000000 + i * 7919), sdt: '09' + String(10000000 + i * 1234567).slice(0, 8), email: '', diaChi: '',
        mst: '80' + String(10000000 + i * 271828).slice(0, 8), nganHang: i % 3 ? 'Công thương (VietinBank)' : 'Nông nghiệp (Agribank)', chiNhanhNH: 'Chi nhánh Hậu Giang', soTK: '10' + String(20000000 + i * 3141592).slice(0, 10),
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

    // ---- Hồ sơ nhân sự: lý lịch, trình độ, bảo hiểm, người phụ thuộc, hợp đồng, quyết định ----
    var tinh = ['Cần Thơ', 'Hậu Giang', 'Vĩnh Long', 'Sóc Trăng', 'An Giang', 'Kiên Giang', 'Bạc Liêu', 'Cà Mau'];
    var tdo = function (nv) {
      if (/Giám đốc|Kế toán trưởng|Trưởng phòng/.test(nv.chucVu)) return ['Đại học', /Kế toán/.test(nv.chucVu) ? 'Kế toán' : /Kỹ thuật/.test(nv.phongBan === 'KTH' ? 'Kỹ thuật' : '') ? 'Cấp thoát nước' : 'Quản trị kinh doanh'];
      if (/CN LĐ-SC|Bảo vệ|Tài xế/.test(nv.chucVu)) return [nv.chucVu === 'CN LĐ-SC' ? 'Trung cấp' : 'Sơ cấp nghề', nv.chucVu === 'CN LĐ-SC' ? 'Cấp thoát nước' : nv.chucVu === 'Tài xế' ? 'Lái xe hạng C' : ''];
      return [nv.chucVu === 'Kế toán viên' || nv.chucVu === 'Chuyên viên nhân sự' ? 'Đại học' : 'Cao đẳng', nv.chucVu === 'Kế toán viên' ? 'Kế toán' : nv.chucVu === 'Chuyên viên nhân sự' ? 'Quản trị nhân lực' : 'Quản trị kinh doanh'];
    };
    function cong12(iso, th) { var n = TL.docNgay(iso), t = new Date(n.y, n.m - 1 + th, n.d - 1); return TL.iso(t.getFullYear(), t.getMonth() + 1, t.getDate()); }
    db.nhanVien.forEach(function (nv, i) {
      var t = tdo(nv);
      Object.assign(nv, {
        noiSinh: tinh[i % tinh.length], queQuan: tinh[(i * 3 + 1) % tinh.length], danToc: 'Kinh', tonGiao: i % 5 === 2 ? 'Phật giáo' : 'Không', quocTich: 'Việt Nam',
        honNhan: i % 3 === 0 ? 'Độc thân' : 'Đã kết hôn', ngayCapCCCD: (2021 + i % 4) + '-0' + (1 + i % 9) + '-1' + (i % 9), noiCapCCCD: 'Cục Cảnh sát QLHC về TTXH',
        thuongTru: 'Số ' + (10 + i) + ' đường Mẫu ' + (i % 4 + 1) + ', phường Mẫu, ' + tinh[i % tinh.length], diaChi: 'Số ' + (10 + i) + ' đường Mẫu ' + (i % 4 + 1) + ', phường Mẫu, ' + tinh[i % tinh.length],
        trinhDoHV: '12/12', trinhDoCM: t[0], chuyenNganh: t[1], truongDT: t[0] === 'Đại học' ? 'Trường Đại học (mẫu)' : 'Trường Cao đẳng nghề (mẫu)', namTN: String(+nv.ngaySinh.slice(0, 4) + 22),
        ngoaiNgu: t[0] === 'Đại học' ? 'Tiếng Anh B1' : '', tinHoc: 'Văn phòng', dangVien: i < 3, ngayVaoDang: i < 3 ? (2005 + i * 2) + '-05-19' : '',
        soSoBHXH: '79' + String(10000000 + i * 1234567).slice(0, 8), maTheBHYT: nv.thamGiaBH ? 'DN479' + String(1000000000 + i * 98765431).slice(0, 10) : '', noiKCB: nv.thamGiaBH ? 'Bệnh viện Đa khoa (mẫu)' : '',
        lienHeKhanCap: 'Người thân – 09' + String(20000000 + i * 7654321).slice(0, 8), hopDong: [], quyetDinh: [], nguoiPhuThuoc: []
      });
      // người phụ thuộc theo số đã có
      for (var k = 0; k < (nv.soNPT || 0); k++) nv.nguoiPhuThuoc.push({ hoTen: (k === 0 && i % 2 ? 'Mẹ của ' : 'Con của ') + nv.hoTen.split(' ').pop(), quanHe: k === 0 && i % 2 ? 'Mẹ' : 'Con', ngaySinh: (2012 + k * 3) + '-0' + (k + 3) + '-15', maSo: '0' + String(80000000000 + i * 1111 + k), tuThang: (2019 + k) + '-01' });
      // hợp đồng: thử việc 2 tháng -> xác định thời hạn 12 tháng -> không xác định thời hạn
      var so = 0, tvHet = cong12(nv.ngayVao, 2);
      function hd(loai, tu, den, luong) { so++; nv.hopDong.push({ id: 'hd' + i + '_' + so, so: TL.pad(so) + '/' + tu.slice(0, 4) + '/HĐLĐ-' + nv.ma, loai: loai, ngayKy: tu, tuNgay: tu, denNgay: den, chucDanh: nv.chucVu, luongCB: luong, diaDiem: db.congTy.diaChi, phuCap: 'Cơm trưa 50.000 đ/ngày làm việc' }); }
      if (nv.trangThai === 'thu_viec') hd('Thử việc', nv.ngayVao, nv.ngayHetHD, nv.luongCB);
      else if (nv.hinhThuc === 'gio') hd('Thời vụ / khoán việc', nv.ngayVao, cong12(nv.ngayVao, 18), nv.luongCB);
      else {
        hd('Thử việc', nv.ngayVao, tvHet, nv.luongCB);
        var tu2 = TL.congNgay(+tvHet.slice(0, 4), +tvHet.slice(5, 7), +tvHet.slice(8), 1);
        if (nv.ma === 'NV013' || nv.ma === 'NV015') { hd('Xác định thời hạn', tu2, cong12(tu2, 12), nv.luongCB); var tu3 = TL.congNgay(+nv.hopDong[1].denNgay.slice(0, 4), +nv.hopDong[1].denNgay.slice(5, 7), +nv.hopDong[1].denNgay.slice(8), 1); hd('Xác định thời hạn', tu3, TL.congNgay(Y, M, D, nv.ma === 'NV013' ? 18 : 40), nv.luongCB); }
        else { hd('Xác định thời hạn', tu2, cong12(tu2, 12), nv.luongCB); var hdx = nv.hopDong[nv.hopDong.length - 1]; hd('Không xác định thời hạn', TL.congNgay(+hdx.denNgay.slice(0, 4), +hdx.denNgay.slice(5, 7), +hdx.denNgay.slice(8), 1), '', nv.luongCB); }
      }
      var cuoi = nv.hopDong[nv.hopDong.length - 1];
      nv.loaiHD = cuoi.loai; nv.ngayHetHD = cuoi.denNgay || '';
      nv.quyetDinh.push({ id: 'qd' + i + '_0', loai: 'tiep_nhan', so: TL.pad(i + 1) + '/QĐ-TN', ngay: nv.ngayVao, hieuLuc: nv.ngayVao, noiDung: 'Tiếp nhận vào làm việc tại ' + TL.tenPhongBan(db, { NV009: 'KDVT', NV010: 'KDVT', NV011: 'KTH' }[nv.ma] || nv.phongBan) });
    });
    function qd(ma, q) { var nv = db.nhanVien.filter(function (x) { return x.ma === ma; })[0]; q.id = App.uid(); nv.quyetDinh.push(q); return nv; }
    var dau = function (k) { return TL.iso(k.y, k.m, 1); };
    var kyTruoc = (function () { var k = TL.kyCuaNgay(db, Y, M, D), t = new Date(k.y, k.m - 2, 1); return TL.khoaKy(t.getFullYear(), t.getMonth() + 1); })();
    qd('NV001', { loai: 'bo_nhiem', so: '01/QĐ-HĐTV', ngay: '2019-12-20', hieuLuc: '2020-01-01', phongBanCu: 'BGD', phongBanMoi: 'BGD', chucVuCu: 'Phó Giám đốc', chucVuMoi: 'Giám đốc', noiDung: 'Bổ nhiệm Giám đốc công ty' });
    qd('NV001', { loai: 'khen_thuong', so: '120/QĐ-UBND', ngay: (Y - 1) + '-12-28', hieuLuc: (Y - 1) + '-12-28', hinhThuc: 'Bằng khen', noiDung: 'Hoàn thành xuất sắc nhiệm vụ năm ' + (Y - 1) });
    qd('NV009', { loai: 'dieu_chuyen', so: '45/QĐ-CT', ngay: '2023-02-25', hieuLuc: '2023-03-01', phongBanCu: 'KDVT', phongBanMoi: 'KTH', chucVuCu: 'CN LĐ-SC', chucVuMoi: 'CN LĐ-SC', noiDung: 'Điều chuyển về Phòng Kỹ thuật' });
    qd('NV009', { loai: 'dieu_chuyen', so: '12/QĐ-CT', ngay: '2025-01-20', hieuLuc: '2025-02-01', phongBanCu: 'KTH', phongBanMoi: 'DTC', chucVuCu: 'CN LĐ-SC', chucVuMoi: 'CN LĐ-SC', noiDung: 'Điều chuyển đến Đội Thi công – Sửa chữa' });
    // kỳ hiện tại mới chuyển: các kỳ trước vẫn thuộc đơn vị cũ
    var dauKy = (function () { var k = TL.kyCuaNgay(db, Y, M, D); return TL.batDauKy(db, k.y, k.m); })();
    qd('NV011', { loai: 'dieu_chuyen', so: '98/QĐ-CT', ngay: TL.congNgay(+dauKy.slice(0, 4), +dauKy.slice(5, 7), +dauKy.slice(8), -5), hieuLuc: dauKy, phongBanCu: 'KTH', phongBanMoi: 'D1', chucVuCu: 'CN LĐ-SC', chucVuMoi: 'CN LĐ-SC', noiDung: 'Điều chuyển đến Đội Cấp nước số 1' });
    qd('NV010', { loai: 'dieu_chuyen', so: '99/QĐ-CT', ngay: TL.congNgay(+dauKy.slice(0, 4), +dauKy.slice(5, 7), +dauKy.slice(8), -5), hieuLuc: dauKy, phongBanCu: 'KDVT', phongBanMoi: 'D2', chucVuCu: 'Nhân viên ghi thu', chucVuMoi: 'Nhân viên ghi thu', noiDung: 'Điều chuyển đến Đội Cấp nước số 2' });
    var nl1 = qd('NV006', { loai: 'nang_luong', so: '88/QĐ-CT', ngay: dau(lui(2)), hieuLuc: dau(lui(2)), luongCu: 8500000, luongMoi: 9000000, noiDung: 'Nâng bậc lương thường xuyên' });
    var nl2 = qd('NV011', { loai: 'nang_luong', so: '61/QĐ-CT', ngay: dau(lui(5)), hieuLuc: dau(lui(5)), luongCu: 7500000, luongMoi: 8000000, noiDung: 'Nâng bậc lương thường xuyên' });
    [nl1, nl2].forEach(function (nv) { nv.hopDong[nv.hopDong.length - 1].luongCB = nv.quyetDinh[nv.quyetDinh.length - 1].luongCu; });

    // ---- Thang, bảng lương (mức tiền) và xếp bậc ----
    db.thangLuong = [TL.chuanBangLuong({
      ma: 'BL1', ten: 'Thang lương, bảng lương của công ty', kieu: 'tien', apDung: 'cb', namNang: 3, soBac: 8,
      ngach: [
        { ma: 'GD', ten: 'Giám đốc', bac: [28000000, 30000000] },
        { ma: 'PGD', ten: 'Phó Giám đốc, Kế toán trưởng', bac: [17000000, 18000000] },
        { ma: 'TP', ten: 'Trưởng phòng, Đội trưởng', bac: [14000000, 14500000, 15000000, 15500000] },
        { ma: 'CV', ten: 'Chuyên viên, kỹ sư, kế toán viên', bac: [7500000, 8000000, 8500000, 9000000, 9500000, 10000000, 10500000, 11000000] },
        { ma: 'NV', ten: 'Nhân viên nghiệp vụ (ghi thu, thủ kho)', namNang: 2, bac: [6600000, 7000000, 7320000, 7680000, 8040000, 8400000, 8800000] },
        { ma: 'CN', ten: 'Công nhân lắp đặt – sửa chữa, lái xe', namNang: 2, bac: [7000000, 7500000, 8000000, 8500000, 9000000, 9500000, 10000000] }
      ]
    })];
    var xep = {
      NV001: ['GD', 2, '2023-01-01'], NV002: ['PGD', 2, '2022-03-01'], NV003: ['TP', 4, '2021-07-01'], NV004: ['TP', 1, '2024-04-01'], NV005: ['TP', 3, '2023-09-01'],
      NV006: ['CV', 4, dau(lui(2))], NV007: ['NV', 5, TL.themThangISO(TL.iso(Y, M, 1), -24)], NV008: ['CV', 4, '2024-01-10'], NV009: ['CN', 5, '2025-02-01'],
      NV010: ['NV', 3, TL.themThangISO(TL.iso(Y, M, 1), -23)], NV011: ['CN', 3, dau(lui(5))], NV012: ['NV', 5, '2025-06-01'], NV013: ['CN', 5, '2025-08-05'],
      NV014: ['NV', 2, null], NV017: ['NV', 3, '2023-05-01']
    };
    db.nhanVien.forEach(function (nv) { var x = xep[nv.ma]; if (x) nv.xepLuong = { bang: 'BL1', ngach: x[0], bac: x[1], ngayHuong: x[2] || nv.ngayVao }; });
    [nl1, nl2].forEach(function (nv) {
      var q = nv.quyetDinh[nv.quyetDinh.length - 1];
      q.xepLuongMoi = Object.assign({}, nv.xepLuong); q.xepLuongCu = Object.assign({}, nv.xepLuong, { bac: nv.xepLuong.bac - 1, ngayHuong: '' });
      q.noiDung = 'Nâng bậc lương thường xuyên: bậc ' + (nv.xepLuong.bac - 1) + ' lên bậc ' + nv.xepLuong.bac;
    });
    // ---- Mức lương áp dụng từ kỳ 01 năm sau (mẫu): các bậc tăng 5%, tiền cơm 55.000 đ/ngày ----
    var kyMoi = (Y + 1) + '-01', dot = Object.assign({ id: 'dot_mau', tuKy: kyMoi, soQD: '01/QĐ-CT (mẫu)', ghiChu: 'Điều chỉnh lương năm ' + (Y + 1) + ' (dữ liệu mẫu)' }, TL.chupMucKy(db, kyMoi));
    Object.keys(dot.bang.BL1.ngach).forEach(function (m) { dot.bang.BL1.ngach[m] = dot.bang.BL1.ngach[m].map(function (x) { return +x > 0 ? Math.round(x * 1.05 / 1000) * 1000 : x; }); });
    dot.phuCap.AN = 55000;
    db.dotLuong = [dot];
    db.nhanVien.forEach(function (nv) { TL.apXepLuong(db, nv); });
    nv16.tamUngRieng = 0;   // cộng tác viên theo giờ: không tạm ứng kỳ I
    qd('NV010', { loai: 'khen_thuong', so: '95/QĐ-CT', ngay: TL.congNgay(Y, M, D, -10), hieuLuc: TL.congNgay(Y, M, D, -10), hinhThuc: 'Tiền thưởng', soTien: 1000000, kyLuong: kyTruoc, noiDung: 'Hoàn thành vượt chỉ tiêu thu tiền nước' });
    qd('NV013', { loai: 'ky_luat', so: '96/QĐ-CT', ngay: TL.congNgay(Y, M, D, -8), hieuLuc: TL.congNgay(Y, M, D, -8), hinhThuc: 'Khiển trách', soTien: 300000, kyLuong: kyTruoc, noiDung: 'Bồi thường chi phí sửa xe do vi phạm quy định vận hành' });
    var nv17q = db.nhanVien[16];
    qd('NV017', { loai: 'thoi_viec', so: '70/QĐ-CT', ngay: TL.congNgay(+nv17q.ngayNghi.slice(0, 4), +nv17q.ngayNghi.slice(5, 7), +nv17q.ngayNghi.slice(8), -15), hieuLuc: TL.congNgay(+nv17q.ngayNghi.slice(0, 4), +nv17q.ngayNghi.slice(5, 7), +nv17q.ngayNghi.slice(8), 1), lyDo: 'Người lao động xin nghỉ việc', trangThaiCu: 'dang_lam', ngayNghiCu: '' });

    db.ngayLe = TL.taoNgayLe(Y - 1, db.caiDat).concat(TL.taoNgayLe(Y, db.caiDat), TL.taoNgayLe(Y + 1, db.caiDat));
    var le = TL.bangNgayLe(db);
    var thaiSan = [lui(6), lui(5), lui(4)].map(function (k) { return TL.khoaKy(k.y, k.m); });
    var ghiThu = function (nv) { return nv.chucVu === 'Nhân viên ghi thu'; };
    var congNhanSC = function (nv) { return nv.chucVu === 'CN LĐ-SC'; };

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
          if (loai === 'le') {
            // công nhân kỹ thuật trực sự cố ngày lễ: đi làm (được nhân công)
            if (congNhanSC(nv) && R() < 0.4) { cc[d] = '+'; continue; }
            if (nv.hinhThuc !== 'gio') cc[d] = 'L';
            continue;
          }
          // nhân viên ghi thu: đợt ghi chỉ số ngày 17–22 hằng tháng chấm SP (kể cả chủ nhật)
          if (ghiThu(nv) && d >= 17 && d <= 22 && R() < 0.85) { cc[d] = 'SP'; continue; }
          // công nhân lắp đặt – sửa chữa: vài ngày khoán theo sản phẩm
          if (congNhanSC(nv) && loai === 'thuong' && d >= 18 && d <= 20 && R() < 0.7) { cc[d] = 'SP'; continue; }
          if (loai === 'nghi') {
            if (kyThuat(nv) && TL.thuTrongTuan(y, m, d) === 0 && R() < 0.15) {
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
            var gioOT = kyThuat(nv) && kh === '+' && R() < 0.14 ? 1 + Math.floor(R() * 5) * 0.5 : 0;
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
        if (ghiThu(nv)) dc.sp = { HD: 1500 + Math.floor(R() * 1100) };
        if (congNhanSC(nv)) dc.sp = { DH: 6 + Math.floor(R() * 15) };
        if (nv.id === 'nv7' && R() < 0.5) dc.sp = Object.assign(dc.sp || {}, { DH: 2 + Math.floor(R() * 4) });
        if (R() < 0.04 && idx > 3) { dc.khauTru = 150000; dc.ghiChu = 'Bồi thường làm hỏng dụng cụ'; }
        if (Object.keys(dc).length) TK.dc[nv.id] = dc;
      });
      if (lk >= 3) TL.chotThang(db, ky, km);
    }

    // ---- Đơn nghỉ phép: 1 đơn đã duyệt (tự chấm P vào những ngày tới), 1 đơn chờ duyệt, 1 đơn bị từ chối ----
    var timNgay = function (tu) { var s = TL.congNgay(Y, M, D, tu); var n = TL.docNgay(s); while ([0, 6].indexOf(TL.thuTrongTuan(n.y, n.m, n.d)) >= 0) { s = TL.congNgay(n.y, n.m, n.d, 1); n = TL.docNgay(s); } return s; };
    var a1 = timNgay(3), a2 = timNgay(6), a3 = timNgay(9);
    var don1 = { id: 'dn1', nvId: 'nv8', kyHieu: 'P', tuNgay: a1, denNgay: a1, lyDo: 'Việc gia đình', trangThai: 'cho', ngayTao: TL.congNgay(Y, M, D, -1) };
    TL.apDungDonNghi(db, don1); don1.trangThai = 'duyet'; don1.ngayDuyet = TL.congNgay(Y, M, D, -1);
    db.donNghi = [don1,
      { id: 'dn2', nvId: 'nv4', kyHieu: 'P', tuNgay: a2, denNgay: TL.congNgay(+a2.slice(0, 4), +a2.slice(5, 7), +a2.slice(8), 1), lyDo: 'Về quê', trangThai: 'cho', ngayTao: TL.congNgay(Y, M, D, 0) },
      { id: 'dn3', nvId: 'nv12', kyHieu: 'KL', tuNgay: a3, denNgay: a3, lyDo: 'Việc riêng', trangThai: 'tuchoi', ngayTao: TL.congNgay(Y, M, D, -2) }];
    return db;
  };
})();
