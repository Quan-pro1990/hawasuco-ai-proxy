/* Lõi tính toán: ngày tháng, công chuẩn, tổng hợp công, lương, bảo hiểm, thuế TNCN.
   Không phụ thuộc giao diện – chạy được cả trong trình duyệt lẫn Node (để kiểm thử). */
(function (root, factory) {
  var isNode = typeof module === 'object' && module.exports;
  var AL = isNode ? require('./amlich.js') : root.AmLich;
  var TL = factory(AL);
  if (isNode) module.exports = TL; else root.TL = TL;
})(this, function (AmLich) {
  'use strict';

  /* ================= Mặc định ================= */

  var NHOM_KY_HIEU = {
    lam:   'Đi làm',
    phep:  'Nghỉ phép năm',
    le:    'Nghỉ lễ, Tết',
    huong: 'Nghỉ khác có lương',
    ngung: 'Nghỉ / ngừng việc hưởng lương',
    bhxh:  'Ốm, thai sản (BHXH trả)',
    khong: 'Nghỉ không lương',
    kp:    'Nghỉ không phép'
  };

  /** Ký hiệu theo mẫu 01a-LĐTL (TT 133/2016, TT 200/2014) + vài ký hiệu thông dụng.
      lam: công làm việc, huong: công nghỉ có hưởng lương, sp: công hưởng lương sản phẩm */
  function kyHieuMacDinh() {
    return [
      { ma: '+',   ten: 'Lương thời gian (đi làm cả ngày)', lam: 1,   huong: 0,   nhom: 'lam' },
      { ma: '+/2', ten: 'Đi làm nửa ngày',                lam: 0.5, huong: 0,   nhom: 'lam' },
      { ma: 'SP',  ten: 'Lương sản phẩm',                 lam: 1,   huong: 0,   nhom: 'lam', sp: true },
      { ma: 'CT',  ten: 'Đi công tác',                    lam: 1,   huong: 0,   nhom: 'lam' },
      { ma: 'H',   ten: 'Hội nghị, học tập',              lam: 1,   huong: 0,   nhom: 'lam' },
      { ma: 'P',   ten: 'Nghỉ phép',                      lam: 0,   huong: 1,   nhom: 'phep', phep: true },
      { ma: 'P/2', ten: 'Nửa ngày phép, nửa ngày làm',    lam: 0.5, huong: 0.5, nhom: 'phep', phep: true },
      { ma: 'L',   ten: 'Nghỉ lễ, Tết',                   lam: 0,   huong: 1,   nhom: 'le' },
      { ma: 'NB',  ten: 'Nghỉ bù',                        lam: 0,   huong: 1,   nhom: 'huong' },
      { ma: 'R',   ten: 'Nghỉ việc riêng có lương (cưới, tang)', lam: 0, huong: 1, nhom: 'huong' },
      { ma: 'N',   ten: 'Ngừng việc (hưởng lương)',       lam: 0,   huong: 1,   nhom: 'ngung' },
      { ma: 'Ô',   ten: 'Ốm, điều dưỡng',                 lam: 0,   huong: 0,   nhom: 'bhxh' },
      { ma: 'Cô',  ten: 'Con ốm',                         lam: 0,   huong: 0,   nhom: 'bhxh' },
      { ma: 'TS',  ten: 'Thai sản',                       lam: 0,   huong: 0,   nhom: 'bhxh' },
      { ma: 'T',   ten: 'Tai nạn',                        lam: 0,   huong: 0,   nhom: 'bhxh' },
      { ma: 'KL',  ten: 'Nghỉ không lương',               lam: 0,   huong: 0,   nhom: 'khong' },
      { ma: 'KP',  ten: 'Nghỉ không phép',                lam: 0,   huong: 0,   nhom: 'kp' }
    ];
  }

  function phuCapMacDinh() {
    return [
      { ma: 'AN',   ten: 'Cơm trưa',     cachTinh: 'theo_ngay', mucChung: 50000, chiuThue: false, anCa: true, dongBH: false, ghiChu: '50.000 đ × ngày đi làm thực tế (kể cả SP, kể cả đi làm ngày lễ); nghỉ lễ không tính. Phần vượt mức miễn thuế tiền ăn giữa ca tính thuế TNCN' },
      { ma: 'XANG', ten: 'Xăng xe',      cachTinh: 'theo_cong', chiuThue: true,  dongBH: false, ghiChu: '' },
      { ma: 'DT',   ten: 'Điện thoại',   cachTinh: 'co_dinh',   chiuThue: true,  dongBH: false, ghiChu: '' },
      { ma: 'TN',   ten: 'Trách nhiệm',  cachTinh: 'theo_cong', chiuThue: true,  dongBH: true,  ghiChu: 'Tính vào lương đóng BHXH' }
    ];
  }

  /** Loại lao động: công chuẩn cố định và ngày nghỉ hằng tuần (0 = CN, 6 = T7).
      congChuan để trống = đếm theo lịch (số ngày trong kỳ trừ ngày nghỉ tuần). */
  function loaiLDMacDinh() {
    return [
      { ma: 'VP', ten: 'Nhân viên văn phòng', congChuan: 22, nghiTuan: [0, 6] },
      { ma: 'CN', ten: 'Công nhân', congChuan: 26, nghiTuan: [0] }
    ];
  }

  /** Sản phẩm / công việc tính lương sản phẩm: số lượng × đơn giá */
  function sanPhamMacDinh() {
    return [
      { ma: 'HD', ten: 'Hoá đơn ghi thu', dvt: 'HĐ', donGia: 1200 }
    ];
  }

  function caiDatMacDinh() {
    return {
      ngayDauKy: 1,             // kỳ công bắt đầu từ ngày này của tháng trước (1 = theo tháng dương lịch, 21 = từ 21 tháng trước đến 20 tháng này)
      congChuan: { cach: 'theo_thang', soNgay: 26 }, // theo_thang: số ngày trong kỳ trừ ngày nghỉ tuần
      khDiLam: '+', khNuaNgay: '+/2', khLe: 'L',
      nghiTuan: [0],            // 0 = Chủ nhật, 6 = Thứ bảy
      nuaNgayT7: false,         // Thứ bảy làm nửa ngày (0,5 công chuẩn)
      gioLamNgay: 8,
      gioVao: '08:00', gioRa: '17:00', gioRaT7: '12:00',
      nghiTruaTu: '12:00', nghiTruaDen: '13:00',
      phutChoPhep: 5,           // đi muộn / về sớm dưới số phút này thì bỏ qua
      nguongCaNgay: 6,          // giờ làm ≥ ngưỡng này => đủ công (+)
      nguongNuaNgay: 3,         // giờ làm ≥ ngưỡng này => nửa công (+/2)
      otToiThieuPhut: 30,       // làm quá giờ ra từ x phút mới tính làm thêm
      otLamTronPhut: 30,        // làm tròn xuống giờ làm thêm theo bội số phút
      heSoOT: { thuong: 150, nghi: 200, le: 300 },
      // làm thêm ban đêm: hệ số ngày + 30% lương giờ + 20% lương giờ ban ngày của ngày đó (Điều 98 BLLĐ 2019, Điều 57 NĐ 145/2020)
      otDem: { tu: '22:00', den: '06:00', phuCap: 30, themNgay: 20 },
      otToiDaThang: 40,         // cảnh báo làm thêm vượt số giờ / tháng (Điều 107 BLLĐ 2019)
      otTraRieng: true,         // tiền làm thêm giờ chi bằng bảng riêng (không gộp vào lãnh kỳ II)
      tiLeNgungViec: 100,       // % lương cho ngày nghỉ / ngừng việc (ký hiệu nhóm "ngung")
      heSoCongLe: 2,            // đi làm hưởng lương thời gian vào ngày lễ được tính 2 công (SP không nhân)
      heSoCongTet: 3,           // đi làm hưởng lương thời gian vào ngày Tết được tính 3 công (SP không nhân)
      gioiHanCong: false,       // không trả lương thời gian quá công chuẩn
      luongSP: true,            // có lương sản phẩm (số lượng × đơn giá, danh mục Sản phẩm)
      loaiLD: loaiLDMacDinh(),
      phatMuonMoiLan: 0, phatMuonMoiPhut: 0,
      bh: {
        nv: { bhxh: 8, bhyt: 1.5, bhtn: 1 },
        dn: { bhxh: 17.5, bhyt: 3, bhtn: 1, kpcd: 2 },
        doanPhi: 0.5
      },
      luongCoSo: 2530000,
      // lương đóng BH của người đã xếp thang bảng lương = giá trị bậc lương hiện tại (của kỳ) + phụ cấp tính đóng BH
      bhTheoBac: true,
      // tạm ứng kỳ I (giữa tháng) theo chức vụ; kỳ II cuối tháng = lương còn lại
      tamUng: { macDinh: 2000000, theoChucVu: [
        { chucVu: 'Chủ tịch kiêm Giám đốc', muc: 6000000 }, { chucVu: 'Giám đốc', muc: 6000000 },
        { chucVu: 'Phó Giám đốc', muc: 5000000 }, { chucVu: 'Kế toán trưởng', muc: 5000000 },
        { chucVu: 'Trưởng phòng', muc: 3000000 }, { chucVu: 'Phó phòng', muc: 3000000 }, { chucVu: 'Đội trưởng', muc: 3000000 }] },
      // thử việc: lương thử việc = tiLe % lương chính thức (Điều 26 BLLĐ 2019: ít nhất 85%); số tháng theo giai đoạn HĐ thử việc;
      // hợp đồng thử việc riêng thì thời gian thử việc không đóng BHXH, BHYT, BHTN
      thuViec: { tiLe: 85, khongDongBH: true },
      // các giai đoạn ký hợp đồng theo thứ tự: thử việc -> chính thức 1 năm -> chính thức 3 năm -> không xác định thời hạn
      giaiDoanHD: giaiDoanHDMacDinh(),
      mienThueAnCa: 1200000,    // tiền ăn giữa ca không tính thuế TNCN tối đa / tháng (NĐ 253/2026, từ 01/7/2026; trước đó 730.000)
      luongToiThieuVung: 5310000,
      vung: 'I',
      nguongNghiKhongDongBH: 14,
      giamTruBanThan: 15500000,
      giamTruNPT: 6200000,
      bieuThue: [
        { den: 10000000, ts: 5 },
        { den: 30000000, ts: 10 },
        { den: 60000000, ts: 20 },
        { den: 100000000, ts: 30 },
        { den: null, ts: 35 }
      ],
      thueKhauTru: 10, nguongKhauTru: 2000000,
      lamTron: 1,               // làm tròn thực lĩnh: 1, 100, 1000
      troLyGiongNoi: true,      // trợ lý ảo: cho phép nói câu hỏi bằng micro (nhận dạng giọng nói của trình duyệt)
      phepNam: 12
    };
  }

  function duLieuMoi() {
    var nam = new Date().getFullYear();
    var db = {
      phienBan: 1,
      congTy: { ten: 'CÔNG TY TNHH MTV CẤP NƯỚC HẬU GIANG', diaChi: '', mst: '', dienThoai: '', diaDanh: '', thongTu: '133', tieuDeBangLuong: 'BẢNG THANH TOÁN TIỀN LƯƠNG',
        nguoiLap: '', keToan: '', giamDoc: '', nguoiChamCong: '', phuTrachBP: '', nguoiDuyet: '' },
      caiDat: caiDatMacDinh(),
      kyHieu: kyHieuMacDinh(),
      phuCap: phuCapMacDinh(),
      sanPham: sanPhamMacDinh(),
      phongBan: [],
      thangLuong: thangLuongQuyChe(),   // thang bảng lương theo Quy chế trả lương của công ty
      dotLuong: [],
      khoiLuong: {},
      nhanVien: [],
      ngayLe: [],
      donNghi: [],
      thang: {}
    };
    db.ngayLe = taoNgayLe(nam, db.caiDat).concat(taoNgayLe(nam + 1, db.caiDat));
    return db;
  }

  /** Bổ sung trường còn thiếu khi mở dữ liệu cũ. */
  function chuanHoa(db) {
    var md = duLieuMoi();
    if (!db || typeof db !== 'object') return md;
    db.congTy = Object.assign({}, md.congTy, db.congTy || {});
    if (/^(CÔNG TY CỦA BẠN|Công ty TNHH ABC \(dữ liệu mẫu\))$/.test(db.congTy.ten || '')) db.congTy.ten = md.congTy.ten;
    db.caiDat = honHop(md.caiDat, db.caiDat || {});
    if (!Array.isArray(db.kyHieu) || !db.kyHieu.length) db.kyHieu = md.kyHieu;
    if (!Array.isArray(db.phuCap)) db.phuCap = md.phuCap;
    if (!Array.isArray(db.phongBan)) db.phongBan = [];
    db.phongBan.forEach(function (p) { p.loai = loaiDonVi(p); });
    if (!Array.isArray(db.nhanVien)) db.nhanVien = [];
    if (!Array.isArray(db.thangLuong)) db.thangLuong = [];
    if (!Array.isArray(db.dotLuong)) db.dotLuong = [];
    if (!db.khoiLuong || typeof db.khoiLuong !== 'object' || Array.isArray(db.khoiLuong)) db.khoiLuong = {};
    if (!db.caiDat.tamUng || typeof db.caiDat.tamUng !== 'object') db.caiDat.tamUng = { macDinh: 0, theoChucVu: [] };
    if (!Array.isArray(db.caiDat.tamUng.theoChucVu)) db.caiDat.tamUng.theoChucVu = [];
    if (!Array.isArray(db.caiDat.giaiDoanHD) || !db.caiDat.giaiDoanHD.length) db.caiDat.giaiDoanHD = giaiDoanHDMacDinh();
    db.thangLuong.forEach(function (b) {
      // dữ liệu cũ chưa có số bậc từng chức danh: lấy tới bậc cuối có giá trị (mức ban đầu và các mức theo kỳ)
      var cuoi = function (arr) { var k = 0; (arr || []).forEach(function (v, i) { if (+v > 0) k = i + 1; }); return k; };
      (b.ngach || []).forEach(function (g) {
        if (+g.soBac > 0) return;
        var k = cuoi(g.bac);
        db.dotLuong.forEach(function (d) { var x = d.bang && d.bang[b.ma] && d.bang[b.ma].ngach && d.bang[b.ma].ngach[g.ma]; k = Math.max(k, cuoi(x)); });
        g.soBac = k || +b.soBac || 3;
      });
      chuanBangLuong(b);
    });
    if (!Array.isArray(db.ngayLe)) db.ngayLe = md.ngayLe;
    db.ngayLe.forEach(function (x) {
      if (!x.loai) x.loai = loaiNgayLe(x);
      // hệ số công riêng của ngày (đi làm ×1 / ×2 / ×3 công); không có thì theo loại (Cài đặt)
      if (x.heSo != null && !(+x.heSo > 0)) delete x.heSo; else if (x.heSo != null) x.heSo = +x.heSo;
    });
    if (!db.thang || typeof db.thang !== 'object') db.thang = {};
    if (!Array.isArray(db.donNghi)) db.donNghi = [];
    if (!Array.isArray(db.sanPham)) {
      db.sanPham = sanPhamMacDinh();
      if (db.caiDat.donGiaSP) db.sanPham[0].donGia = +db.caiDat.donGiaSP;
    }
    if (!Array.isArray(db.caiDat.loaiLD) || !db.caiDat.loaiLD.length) db.caiDat.loaiLD = loaiLDMacDinh();
    db.phuCap.forEach(function (pc) {
      if (pc.ma === 'AN' && pc.cachTinh === 'theo_ngay' && pc.mucChung == null) pc.mucChung = 50000;
      if (pc.ma === 'AN' && pc.anCa == null) pc.anCa = true;
      delete pc.boNgayLe; // bỏ tuỳ chọn cũ: đi làm ngày lễ vẫn tính cơm
    });
    db.nhanVien.forEach(function (nv) {
      if (!nv.phuCap) nv.phuCap = {};
      ['hopDong', 'quyetDinh', 'nguoiPhuThuoc', 'hoSoTep'].forEach(function (f) { if (!Array.isArray(nv[f])) nv[f] = []; });
      if (nv.lichLam) { nv.loaiLD = nv.lichLam === 'T2-T6' ? 'VP' : nv.lichLam === 'T2-T7' ? 'CN' : ''; delete nv.lichLam; }
      // dữ liệu cũ: thử việc ghi bằng "% hưởng lương" (85) và ngày hết hạn HĐ thử việc -> chuyển sang thời gian thử việc riêng
      if (nv.trangThai === 'thu_viec' && !nv.thuViec && nv.ngayVao) {
        var tlc = +nv.tiLeHuong, ttv = db.caiDat.thuViec || {};
        nv.thuViec = { tuNgay: nv.ngayVao, soThang: soThangThuViec(db), tiLe: tlc > 0 && tlc < 100 ? tlc : (+ttv.tiLe || 85) };
        nv.thuViec.denNgay = nv.loaiHD === 'Thử việc' && nv.ngayHetHD > nv.ngayVao ? nv.ngayHetHD : denNgayThuViec(nv.ngayVao, nv.thuViec.soThang);
        if (tlc > 0 && tlc < 100) nv.tiLeHuong = 100;
      }
    });
    db.phienBan = 1;
    return db;
  }

  function honHop(goc, moi) {
    var kq = Array.isArray(goc) ? goc.slice() : Object.assign({}, goc);
    Object.keys(moi).forEach(function (k) {
      var v = moi[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && goc[k] && typeof goc[k] === 'object' && !Array.isArray(goc[k])) kq[k] = honHop(goc[k], v);
      else kq[k] = v;
    });
    return kq;
  }

  /* ================= Ngày tháng ================= */

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function khoaKy(y, m) { return y + '-' + pad(m); }
  function iso(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
  function soNgay(y, m) { return new Date(y, m, 0).getDate(); }
  function thuTrongTuan(y, m, d) { return new Date(y, m - 1, d).getDay(); }
  var TEN_THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  var TEN_THU_DAY = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

  function docNgay(s) { // 'yyyy-mm-dd' -> {y,m,d}
    if (!s) return null;
    var p = String(s).split('-');
    if (p.length !== 3) return null;
    return { y: +p[0], m: +p[1], d: +p[2] };
  }
  function hienNgay(s) { var n = docNgay(s); return n ? pad(n.d) + '/' + pad(n.m) + '/' + n.y : ''; }
  function phut(hhmm) { // '08:30' -> 510
    if (hhmm == null || hhmm === '') return null;
    var p = String(hhmm).split(':');
    return (+p[0] || 0) * 60 + (+p[1] || 0);
  }
  function hhmm(ph) { if (ph == null) return ''; ph = Math.round(ph); return pad(Math.floor(ph / 60)) + ':' + pad(ph % 60); }

  /* ================= Làm thêm giờ theo khung giờ ================= */

  /** 1 mốc giờ: '17:30', '17h30', '17h', '17.30', '1730', '930', '22' -> phút trong ngày (0–1440); null nếu sai */
  function docMoc(s) {
    s = String(s).trim().toLowerCase().replace(/\s+/g, '').replace(/(p|ph|phut|phút)$/, '');
    var m = /^(\d{1,2})(?:[:h.](\d{1,2})?)?$/.exec(s) || /^(\d{1,2})(\d{2})$/.exec(s);
    if (!m) return null;
    var g = +m[1], p = m[2] ? +m[2] : 0;
    if (g > 24 || p > 59 || (g === 24 && p)) return null;
    return g * 60 + p;
  }
  /** Khung giờ làm thêm: '17:30-21:00', '17h-21h, 22h-2h', '18 đến 22' (qua nửa đêm khi giờ kết thúc ≤ giờ bắt đầu).
      Trả null nếu không phải khung giờ (vd số giờ), false nếu viết sai, hoặc { ds: [[đầu, cuối] phút], phut, chuoi } */
  function docKhoangOT(v) {
    if (v == null || typeof v === 'number') return null;
    var s = String(v).trim().toLowerCase().replace(/(đến|den|tới|toi)/g, '-').replace(/[–—~]/g, '-').replace(/\s*-\s*/g, '-');
    if (s.indexOf('-') < 0) return null;
    var ds = [], sai = false;
    s.split(/[,;+\/\s]+|và|va/).filter(Boolean).forEach(function (x) {
      var p = x.split('-');
      if (p.length !== 2) { sai = true; return; }
      var a = docMoc(p[0]), b = docMoc(p[1]);
      if (a == null || b == null || a === b || a >= 1440) { sai = true; return; }
      if (b < a) b += 1440;
      ds.push([a, b]);
    });
    if (sai || !ds.length) return false;
    ds.sort(function (x, y) { return x[0] - y[0]; });
    for (var i = 1; i < ds.length; i++) if (ds[i][0] < ds[i - 1][1]) return false;   // các khung chồng nhau
    var tong = ds.reduce(function (t, x) { return t + x[1] - x[0]; }, 0);
    if (tong > 1440) return false;
    return { ds: ds, phut: tong, chuoi: ds.map(function (x) { return hhmm(x[0]) + '-' + hhmm(x[1] > 1440 ? x[1] - 1440 : x[1]); }).join(',') };
  }
  /** Khung "ban đêm" và mức cộng thêm khi làm thêm ban đêm (Cài đặt → Lương & làm thêm) */
  function cauHinhDem(cd) {
    var o = (cd && cd.otDem) || {}, so = function (v, md) { return v == null || v === '' || isNaN(+v) ? md : +v; };
    return { tu: phut(o.tu || '22:00'), den: phut(o.den || '06:00'), phuCap: so(o.phuCap, 30), themNgay: so(o.themNgay, 20) };
  }
  /** Số phút của đoạn [a, b] rơi vào khung ban đêm (vd 22:00–06:00) */
  function phutDem(a, b, tu, den) {
    var dai = (den > tu ? den : den + 1440) - tu, tong = 0;
    for (var i = -1; i <= 2; i++) { var s = tu + 1440 * i; tong += Math.max(0, Math.min(b, s + dai) - Math.max(a, s)); }
    return tong;
  }
  /** Giờ làm thêm của 1 ô: số giờ (tính ban ngày) hoặc khung giờ -> { gio, ngay (ban ngày), dem (ban đêm), khung } */
  function gioOT(v, cd) {
    if (v == null || v === '') return { gio: 0, ngay: 0, dem: 0, khung: '' };
    var k = docKhoangOT(v);
    if (!k) { var n = typeof v === 'number' ? v : +String(v).replace(',', '.'); n = n > 0 ? n : 0; return { gio: n, ngay: n, dem: 0, khung: '' }; }
    var d = cauHinhDem(cd), dem = 0;
    k.ds.forEach(function (x) { dem += phutDem(x[0], x[1], d.tu, d.den); });
    var gio = Math.round(k.phut / 60 * 100) / 100, gd = Math.round(dem / 60 * 100) / 100;
    return { gio: gio, ngay: Math.round((gio - gd) * 100) / 100, dem: gd, khung: k.chuoi };
  }
  /** Hệ số (%) làm thêm ban đêm = hệ số làm thêm của ngày + 30% + 20% × lương giờ ban ngày của ngày đó
      (ngày thường: 100%, hoặc 150% nếu trong ngày đã làm thêm ban ngày; nghỉ tuần 200%; lễ, Tết 300%).
      Mặc định: ngày thường 200% (210%), nghỉ hằng tuần 270%, lễ, Tết 390%. */
  function heSoOTDem(cd) {
    var hs = (cd && cd.heSoOT) || {}, d = cauHinhDem(cd), t = +hs.thuong || 150, n = +hs.nghi || 200, l = +hs.le || 300;
    var f = function (b, ngay) { return Math.round((b + d.phuCap + d.themNgay * ngay / 100) * 100) / 100; };
    return { thuong: f(t, 100), thuong2: f(t, t), nghi: f(n, n), le: f(l, l) };
  }
  /** Lấy phutLay phút đầu tiên của các đoạn [[a, b]] -> chuỗi khung giờ '17:00-19:30,…' */
  function khungTuDoan(doan, phutLay) {
    var out = [];
    doan.forEach(function (s) {
      var d = Math.min(s[1] - s[0], phutLay);
      if (d > 0) { out.push(hhmm(s[0] % 1440) + '-' + hhmm((s[0] + d) % 1440)); phutLay -= d; }
    });
    return out.join(',');
  }
  function congNgay(y, m, d, them) { var t = new Date(y, m - 1, d + them); return iso(t.getFullYear(), t.getMonth() + 1, t.getDate()); }

  /* ================= Ngày lễ ================= */

  function taoNgayLe(nam, cd) {
    var ds = [];
    function them(dmy, ten, loai) { ds.push({ ngay: iso(dmy[2], dmy[1], dmy[0]), ten: ten, loai: loai || 'le' }); }
    them([1, 1, nam], 'Tết Dương lịch');
    // Tết Nguyên đán: ngày cuối năm âm lịch + mùng 1 – mùng 4
    var tet = AmLich.amSangDuong(1, 1, nam, 0, 7);
    var jdTet = AmLich.jdFromDate(tet[0], tet[1], tet[2]);
    them(AmLich.jdToDate(jdTet - 1), 'Tết Nguyên đán (ngày cuối năm âm lịch)', 'tet');
    for (var i = 0; i < 4; i++) them(AmLich.jdToDate(jdTet + i), 'Tết Nguyên đán (mùng ' + (i + 1) + ')', 'tet');
    them(AmLich.amSangDuong(10, 3, nam, 0, 7), 'Giỗ Tổ Hùng Vương (10/3 âm lịch)');
    them([30, 4, nam], 'Ngày Chiến thắng 30/4');
    them([1, 5, nam], 'Ngày Quốc tế Lao động 1/5');
    them([2, 9, nam], 'Quốc khánh 2/9');
    // ngày liền kề Quốc khánh: chọn ngày nối với cuối tuần
    var t29 = thuTrongTuan(nam, 9, 2);
    var lienKe = (t29 === 1 || t29 === 4 || t29 === 0) ? 3 : 1;
    them([lienKe, 9, nam], 'Quốc khánh (ngày liền kề)');
    if (nam >= 2026) them([24, 11, nam], 'Ngày Văn hóa Việt Nam 24/11');
    // Nghỉ bù khi ngày lễ trùng ngày nghỉ hằng tuần
    var nghiTuan = (cd && cd.nghiTuan) || [0];
    var daCo = {};
    ds.forEach(function (x) { daCo[x.ngay] = true; });
    var bu = [];
    ds.slice().sort(function (a, b) { return a.ngay < b.ngay ? -1 : 1; }).forEach(function (x) {
      var n = docNgay(x.ngay);
      if (nghiTuan.indexOf(thuTrongTuan(n.y, n.m, n.d)) >= 0) {
        var k = 1, ng;
        do {
          ng = congNgay(n.y, n.m, n.d, k++);
          var nn = docNgay(ng);
          var laNghi = nghiTuan.indexOf(thuTrongTuan(nn.y, nn.m, nn.d)) >= 0;
        } while (daCo[ng] || laNghi);
        daCo[ng] = true;
        bu.push({ ngay: ng, ten: 'Nghỉ bù ' + x.ten, bu: true, loai: x.loai });
      }
    });
    return ds.concat(bu).sort(function (a, b) { return a.ngay < b.ngay ? -1 : 1; });
  }

  function bangNgayLe(db) {
    var s = {};
    (db.ngayLe || []).forEach(function (x) { s[x.ngay] = x.ten || 'Ngày lễ'; });
    return s;
  }
  /** Loại ngày lễ: 'tet' (Tết Nguyên đán) hoặc 'le' */
  function loaiNgayLe(x) { return x.loai || (/tết nguyên đán|tết âm lịch/i.test(x.ten || '') ? 'tet' : 'le'); }
  function bangLoaiLe(db) {
    var s = {};
    (db.ngayLe || []).forEach(function (x) { s[x.ngay] = loaiNgayLe(x); });
    return s;
  }
  /** Hệ số công mặc định theo loại ngày (Cài đặt → Lương & làm thêm): lễ ×2, Tết ×3 */
  function heSoLeMacDinh(db, loai) { var cd = db.caiDat || {}; return loai === 'tet' ? (+cd.heSoCongTet || 1) : (+cd.heSoCongLe || 1); }
  /** Hệ số công của 1 ngày lễ: hệ số riêng của ngày (Danh mục → Ngày lễ, Tết) nếu có, không thì theo loại */
  function heSoLeNgay(db, x) { return +x.heSo > 0 ? +x.heSo : heSoLeMacDinh(db, loaiNgayLe(x)); }
  function bangHeSoLe(db) {
    var s = {};
    (db.ngayLe || []).forEach(function (x) { s[x.ngay] = heSoLeNgay(db, x); });
    return s;
  }
  /** Hệ số công khi đi làm vào ngày lễ / Tết (heSoLe: bảng tính sẵn bằng bangHeSoLe, để nhanh) */
  function heSoCongNgay(db, isoNgay, loaiLe, heSoLe) {
    if (heSoLe) return heSoLe[isoNgay] || 1;
    var x = (db.ngayLe || []).filter(function (n) { return n.ngay === isoNgay; })[0];
    return x ? heSoLeNgay(db, x) : 1;
  }

  /* ================= Kỳ công ================= */

  function ngayDauKy(db) { var s = +((db.caiDat || {}).ngayDauKy) || 1; return Math.max(1, Math.min(28, s)); }

  /** Danh sách ngày của kỳ công tháng m/y: [{y, m, d, iso}] */
  function ngayKy(db, y, m) {
    var s = ngayDauKy(db), ds = [];
    if (s === 1) {
      for (var d = 1; d <= soNgay(y, m); d++) ds.push({ y: y, m: m, d: d, iso: iso(y, m, d) });
      return ds;
    }
    var t = new Date(y, m - 2, 1), y0 = t.getFullYear(), m0 = t.getMonth() + 1;
    for (var d0 = s; d0 <= soNgay(y0, m0); d0++) ds.push({ y: y0, m: m0, d: d0, iso: iso(y0, m0, d0) });
    for (var d1 = 1; d1 < s; d1++) ds.push({ y: y, m: m, d: d1, iso: iso(y, m, d1) });
    return ds;
  }
  function batDauKy(db, y, m) { return ngayKy(db, y, m)[0].iso; }
  function ketThucKy(db, y, m) { var ds = ngayKy(db, y, m); return ds[ds.length - 1].iso; }
  /** Kỳ công chứa ngày y-m-d */
  function kyCuaNgay(db, y, m, d) {
    var s = ngayDauKy(db);
    if (s > 1 && d >= s) { m++; if (m > 12) { m = 1; y++; } }
    return { y: y, m: m };
  }

  function loaiLDNV(db, nv) {
    var ma = nv && nv.loaiLD;
    if (!ma) return null;
    var ds = db.caiDat.loaiLD || [];
    for (var i = 0; i < ds.length; i++) if (ds[i].ma === ma) return ds[i];
    return null;
  }

  /** Ngày nghỉ hằng tuần của nhân viên (theo loại lao động hoặc cài đặt chung) */
  function nghiTuanNV(db, nv) {
    var l = loaiLDNV(db, nv);
    if (l && Array.isArray(l.nghiTuan)) return l.nghiTuan;
    return db.caiDat.nghiTuan || [0];
  }

  /** 'le' | 'nghi' | 'nua' | 'thuong' – nv không bắt buộc */
  function loaiNgay(db, y, m, d, le, nv) {
    le = le || bangNgayLe(db);
    if (le[iso(y, m, d)]) return 'le';
    var t = thuTrongTuan(y, m, d);
    if (nghiTuanNV(db, nv).indexOf(t) >= 0) return 'nghi';
    if (db.caiDat.nuaNgayT7 && t === 6 && !loaiLDNV(db, nv)) return 'nua';
    return 'thuong';
  }

  /** Đếm số ngày làm việc trong kỳ theo ngày nghỉ tuần */
  function demNgayLam(db, y, m, nghi, nua) {
    var c = 0;
    ngayKy(db, y, m).forEach(function (x) {
      var t = thuTrongTuan(x.y, x.m, x.d);
      if (nghi.indexOf(t) >= 0) return;
      c += (nua && t === 6) ? 0.5 : 1;
    });
    return c;
  }

  /** Công chuẩn của kỳ: công chuẩn riêng của người > công chuẩn của loại lao động > cài đặt chung */
  function congChuan(db, y, m, nv) {
    var cd = db.caiDat;
    if (nv && +nv.congChuanRieng > 0) return +nv.congChuanRieng;
    var l = loaiLDNV(db, nv);
    if (l) return +l.congChuan > 0 ? +l.congChuan : demNgayLam(db, y, m, nghiTuanNV(db, nv), false);
    if (cd.congChuan && cd.congChuan.cach === 'co_dinh') return +cd.congChuan.soNgay || 26;
    return demNgayLam(db, y, m, cd.nghiTuan || [0], cd.nuaNgayT7);
  }

  /* ================= Dữ liệu tháng ================= */

  /** Dữ liệu theo tháng dương lịch (chấm công lưu theo ngày thật) và theo kỳ (thưởng, tạm ứng, chốt lương). */
  function thang(db, y, m, taoMoi) {
    var k = khoaKy(y, m);
    var t = db.thang[k];
    if (!t && taoMoi) t = db.thang[k] = { cc: {}, ot: {}, muon: {}, vr: {}, dc: {}, khoa: false, chot: null };
    if (t) { ['cc', 'ot', 'muon', 'vr', 'dc'].forEach(function (f) { if (!t[f]) t[f] = {}; }); }
    return t || { cc: {}, ot: {}, muon: {}, vr: {}, dc: {}, khoa: false, chot: null, rong: true };
  }
  /** Giá trị 1 ô của nhân viên tại 1 ngày thật. kho: cc | ot (số giờ hoặc khung giờ, xem gioOT) | muon | vr */
  function oNgay(db, kho, nvId, y, m, d) {
    var t = db.thang[khoaKy(y, m)];
    var o = t && t[kho] && t[kho][nvId];
    return o ? o[d] : undefined;
  }

  function nvTrongKy(nv, y, m, db) {
    var dau = db ? batDauKy(db, y, m) : iso(y, m, 1), cuoi = db ? ketThucKy(db, y, m) : iso(y, m, soNgay(y, m));
    if (nv.ngayVao && nv.ngayVao > cuoi) return false;
    if (nv.ngayNghi && nv.ngayNghi < dau) return false;
    if (nv.trangThai === 'nghi_viec' && !nv.ngayNghi) return false;
    return true;
  }

  function nvLamNgay(nv, y, m, d) {
    var s = iso(y, m, d);
    if (nv.ngayVao && s < nv.ngayVao) return false;
    if (nv.ngayNghi && s > nv.ngayNghi) return false;
    return true;
  }

  function tenPhongBan(db, ma) {
    for (var i = 0; i < db.phongBan.length; i++) if (db.phongBan[i].ma === ma) return db.phongBan[i].ten;
    return ma || '';
  }

  function dsNhanVienKy(db, y, m) {
    var thuTu = {}, dv = {};
    db.phongBan.forEach(function (p, i) { thuTu[p.ma] = i; });
    var ds = db.nhanVien.filter(function (nv) { return nvTrongKy(nv, y, m, db); });
    ds.forEach(function (nv) { dv[nv.id] = donViTheoKy(db, nv, y, m).phongBan; });
    return ds.sort(function (a, b) {
      var pa = thuTu[dv[a.id]], pb = thuTu[dv[b.id]];
      pa = pa == null ? 999 : pa; pb = pb == null ? 999 : pb;
      if (pa !== pb) return pa - pb;
      return String(a.ma).localeCompare(String(b.ma), 'vi', { numeric: true });
    });
  }

  function bangKyHieu(db) {
    var s = {};
    db.kyHieu.forEach(function (k) { s[String(k.ma).toUpperCase()] = k; });
    return s;
  }

  /* ================= Tổng hợp công ================= */

  function tongHopCong(db, y, m, nv, ctx) {
    ctx = ctx || {};
    var kh = ctx.kh || bangKyHieu(db);
    var le = ctx.le || bangNgayLe(db);
    var ds = ctx.ngay || ngayKy(db, y, m);
    var loaiLe = ctx.loaiLe || bangLoaiLe(db), heSoLe = ctx.heSoLe || bangHeSoLe(db);
    var r = {
      congChuan: congChuan(db, y, m, nv),
      lam: 0, lamTG: 0, sp: 0, huong: 0, phep: 0, le: 0, huongKhac: 0, ngung: 0, bhxh: 0, khong: 0, kp: 0,
      congTG: 0, congHL: 0, ngayLamThucTe: 0, ngayCom: 0, congThemLe: 0, congThemLeTG: 0, congThemLeSP: 0, ngayLamLe: 0, ngayLamTet: 0,
      otThuong: 0, otNghi: 0, otLe: 0, otTong: 0,
      otDemThuong: 0, otDemThuong2: 0, otDemNghi: 0, otDemLe: 0, otDem: 0, otKhung: 0,
      muonLan: 0, muonPhut: 0, demKyHieu: {}, lamLeHS: {}
    };
    var cdc = db.caiDat || {};
    ds.forEach(function (x) {
      var v = oNgay(db, 'cc', nv.id, x.y, x.m, x.d);
      var k = v != null && v !== '' ? kh[String(v).toUpperCase()] : null;
      if (k) {
        var lam = +k.lam || 0, huong = +k.huong || 0, con = Math.max(0, 1 - lam - huong);
        r.lam += lam; r.huong += huong;
        // đi làm hưởng lương thời gian vào ngày lễ ×2 công, ngày Tết ×3 công (cơm vẫn 1 ngày).
        // Ngày SP chỉ hưởng lương sản phẩm (số lượng × đơn giá): không tính lương thời gian, không nhân hệ số.
        var hsl = lam > 0 && !k.sp && le[x.iso] ? heSoCongNgay(db, x.iso, loaiLe, heSoLe) : 1;
        if (hsl !== 1) {
          r.congThemLe += lam * (hsl - 1);
          r.lamLeHS[hsl] = Math.round(((r.lamLeHS[hsl] || 0) + lam) * 100) / 100;   // số ngày đi làm theo từng hệ số (để ghi chi tiết)
          if (k.sp) r.congThemLeSP += lam * (hsl - 1); else r.congThemLeTG += lam * (hsl - 1);
          if (loaiLe[x.iso] === 'tet') r.ngayLamTet += lam; else r.ngayLamLe += lam;
        }
        if (k.sp) r.sp += lam * hsl; else r.lamTG += lam * hsl;
        if (k.phep) r.phep += huong;
        if (k.nhom === 'le') r.le += huong;
        else if (k.nhom === 'ngung') r.ngung += huong;
        else if (!k.phep) r.huongKhac += huong;
        if (k.nhom === 'bhxh') r.bhxh += con;
        if (k.nhom === 'khong') r.khong += con;
        if (k.nhom === 'kp') r.kp += con;
        r.demKyHieu[k.ma] = (r.demKyHieu[k.ma] || 0) + 1;
      }
      // làm thêm: otThuong / otNghi / otLe là giờ ban ngày; giờ ban đêm (khung giờ có phần 22:00–06:00) tính riêng.
      // Ngày thường đã làm thêm ban ngày rồi làm tiếp ban đêm: otDemThuong2 (hệ số cao hơn, xem heSoOTDem)
      var o = gioOT(oNgay(db, 'ot', nv.id, x.y, x.m, x.d), cdc);
      if (o.gio) {
        var loai = loaiNgay(db, x.y, x.m, x.d, le, nv);
        if (loai === 'le') { r.otLe += o.ngay; r.otDemLe += o.dem; }
        else if (loai === 'nghi') { r.otNghi += o.ngay; r.otDemNghi += o.dem; }
        else { r.otThuong += o.ngay; if (o.ngay > 0) r.otDemThuong2 += o.dem; else r.otDemThuong += o.dem; }
        if (o.khung) r.otKhung++;
      }
      var p = +oNgay(db, 'muon', nv.id, x.y, x.m, x.d) || 0;
      if (p > 0) { r.muonLan++; r.muonPhut += p; }
    });
    r.otDem = r.otDemThuong + r.otDemThuong2 + r.otDemNghi + r.otDemLe;
    r.otTong = r.otThuong + r.otNghi + r.otLe + r.otDem;
    r.ngayLamThucTe = r.lam;               // số ngày thật, không nhân hệ số lễ
    r.ngayCom = r.lam;                     // ngày tính cơm = ngày có đi làm (+, SP, CT, H… kể cả đi làm ngày lễ); nghỉ lễ L, phép P không tính
    r.congHL = r.lamTG + r.huong;          // công hưởng lương thời gian (kể cả ngừng việc)
    r.congTG = r.congHL - r.ngung;         // cột "Lương thời gian – số công" (gồm cả phép, lễ)
    ['lam', 'lamTG', 'sp', 'huong', 'phep', 'le', 'huongKhac', 'ngung', 'bhxh', 'khong', 'kp', 'congTG', 'congHL', 'ngayLamThucTe', 'ngayCom', 'congThemLe', 'congThemLeTG', 'congThemLeSP', 'ngayLamLe', 'ngayLamTet', 'otThuong', 'otNghi', 'otLe', 'otTong',
      'otDemThuong', 'otDemThuong2', 'otDemNghi', 'otDemLe', 'otDem']
      .forEach(function (f) { r[f] = Math.round(r[f] * 100) / 100; });
    return r;
  }

  /* ================= Thuế ================= */

  function thueLuyTien(tntt, bieu) {
    var thue = 0, duoi = 0;
    for (var i = 0; i < bieu.length; i++) {
      var tren = bieu[i].den == null || bieu[i].den === '' ? Infinity : +bieu[i].den;
      if (tntt > duoi) thue += (Math.min(tntt, tren) - duoi) * (+bieu[i].ts) / 100;
      if (tntt <= tren) break;
      duoi = tren;
    }
    return Math.round(thue);
  }

  /* ================= Nhân sự: quyết định, người phụ thuộc, đơn nghỉ ================= */

  var LOAI_QD = {
    tiep_nhan: 'Tiếp nhận', bo_nhiem: 'Bổ nhiệm', dieu_chuyen: 'Điều chuyển', nang_luong: 'Nâng lương / điều chỉnh lương',
    khen_thuong: 'Khen thưởng', ky_luat: 'Kỷ luật', thoi_viec: 'Thôi việc', khac: 'Khác'
  };

  /** Mức lương và lương đóng BH áp dụng cho kỳ: nếu có quyết định nâng lương hiệu lực SAU kỳ này
      thì kỳ này dùng mức lương cũ ghi trong quyết định đó (quyết định sớm nhất). */
  function luongTheoKy(db, nv, y, m) {
    var cuoi = ketThucKy(db, y, m);
    var kq = { luongCB: +nv.luongCB || 0, luongBH: +nv.luongBH || 0, qd: null };
    var ds = (nv.quyetDinh || []).filter(function (q) { return q.loai === 'nang_luong' && q.hieuLuc && q.hieuLuc > cuoi; })
      .sort(function (a, b) { return a.hieuLuc < b.hieuLuc ? -1 : 1; });
    if (ds.length) {
      var q = ds[0];
      if (q.luongCu != null && q.luongCu !== '') kq.luongCB = +q.luongCu;
      if (q.luongBHCu != null && q.luongBHCu !== '') kq.luongBH = +q.luongBHCu;
      kq.qd = q;
    }
    // đã xếp thang bảng lương: lấy giá trị bậc theo mức áp dụng của chính kỳ này
    var x = xepLuongTheoKy(db, nv, y, m), xl = x ? xepLuongNV(db, nv, khoaKy(y, m), x) : null;
    if (xl && xl.tien) {
      var ht = nv.hinhThuc || 'thang';
      if ((xl.apDung === 'cb' || xl.apDung === 'ca_hai') && (ht === 'thang' || ht === 'khoan')) kq.luongCB = xl.tien;
      if (xl.apDung === 'bh' || xl.apDung === 'ca_hai') kq.luongBH = xl.tien;
      // đóng BH theo bậc lương hiện tại: bỏ qua lương đóng BH nhập tay / ghi trong quyết định
      if ((db.caiDat || {}).bhTheoBac !== false) { kq.luongBH = 0; kq.bhTheoBac = xl.tien; }
      kq.theoBang = xl;
    }
    return kq;
  }

  /* ----- Thang, bảng lương: bảng → chức danh (nhóm) → bậc ----- */
  var KIEU_BL = { tien: 'Mức tiền (đồng / tháng)', he_so: 'Hệ số × mức lương cơ sở' };
  var AP_DUNG_BL = { cb: 'Mức lương (tính lương)', bh: 'Lương đóng bảo hiểm', ca_hai: 'Mức lương và lương đóng BH' };
  var KL_KEO_DAI = /kéo dài thời hạn nâng lương/i;

  function chuanBangLuong(b) {
    if (!KIEU_BL[b.kieu]) b.kieu = 'tien';
    if (!AP_DUNG_BL[b.apDung]) b.apDung = 'cb';
    if (!(+b.namNang > 0)) b.namNang = 3;
    if (!Array.isArray(b.ngach)) b.ngach = [];
    // mỗi chức danh có số bậc riêng (g.soBac, vd quản lý 2 bậc, nhân viên 3 bậc); số cột của bảng = số bậc lớn nhất
    var n = 0;
    b.ngach.forEach(function (g) { if (!Array.isArray(g.bac)) g.bac = []; n = Math.max(n, +g.soBac > 0 ? +g.soBac : g.bac.length); });
    if (!b.ngach.length) n = +b.soBac || 3;
    b.soBac = Math.max(1, n);
    b.ngach.forEach(function (g) { while (g.bac.length < b.soBac) g.bac.push(''); if (g.bac.length > b.soBac) g.bac.length = b.soBac; });
    return b;
  }
  /* ----- Thang, bảng lương theo Quy chế trả lương của công ty
     (Quyết định 16/QĐ-CNHG ngày 26/5/2026 – điều chỉnh, bổ sung năm 2026, áp dụng từ kỳ lương tháng 5/2026).
     Mức lương trong thang là mức ghi trên hợp đồng, dùng trả lương thời gian và làm căn cứ đóng BHXH, BHYT, BHTN (Điều 3);
     niên hạn nâng lương 3 năm (Điều 10). Đơn vị trong phụ lục: 1.000 đ. ----- */
  var QUY_CHE_LUONG = { so: '16/QĐ-CNHG', ngay: '2026-05-26', tuKy: '2026-05', ten: 'Quy chế trả lương điều chỉnh, bổ sung năm 2026', thay: '101/QĐ-CNHG ngày 31/5/2023' };
  function thangLuongQuyChe() {
    function g(ma, ten, bac) { return { ma: ma, ten: ten, soBac: bac.length, bac: bac.map(function (x) { return Math.round(x * 1000); }) }; }
    return [
      chuanBangLuong({ ma: 'CD', ten: 'Bảng lương quản lý, chuyên môn, nghiệp vụ thừa hành, phục vụ (mã số C, D)', kieu: 'tien', apDung: 'ca_hai', namNang: 3, quyChe: QUY_CHE_LUONG.so, ngach: [
        g('C01', 'Chủ tịch kiêm Giám đốc', [23000, 26000]),
        g('C02', 'Phó Giám đốc Công ty', [18500, 20000]),
        g('C03', 'Kế toán trưởng; Người phụ trách kế toán Công ty', [17000, 18500]),
        g('D01', 'Trưởng phòng', [15500, 17000]),
        g('D02', 'Phó trưởng phòng; Đội trưởng', [13000, 15000]),
        g('D03', 'Nhân viên văn phòng có trình độ đại học trở lên; Nhân viên hoá nghiệm; Thủ kho Công ty', [8000, 9500, 11000]),
        g('D04', 'Nhân viên văn phòng có trình độ cao đẳng, trung cấp', [7000, 8000, 9000]),
        g('D05', 'Nhân viên văn phòng chưa qua đào tạo; Nhân viên thu tiền nước tại quầy (không xét đến trình độ CM)', [6000, 7000, 8000]),
        g('D06', 'Nhân viên tạp vụ, bảo vệ', [5000, 6000])
      ] }),
      chuanBangLuong({ ma: 'A', ten: 'Bảng lương công nhân, nhân viên lao động trực tiếp sản xuất kinh doanh và phục vụ (mã số A)', kieu: 'tien', apDung: 'ca_hai', namNang: 3, quyChe: QUY_CHE_LUONG.so, ngach: [
        g('A01', 'Nhân viên ghi, thu', [6360, 7320, 8040]),
        g('A02', 'Công nhân sửa chữa, lắp đặt; tài xế (ô tô tải, chuyên dùng)', [7000, 8000, 9000]),
        g('A03', 'Công nhân trực ca (đã bao gồm 30% tiền lương làm ca đêm)', [8000, 9000, 10000])
      ] })
    ];
  }
  /** Nạp / cập nhật 2 bảng lương theo quy chế vào danh mục (giữ các bảng, chức danh khác). Trả { them, capNhat } */
  function apDungThangLuongQuyChe(db) {
    var kq = { them: 0, capNhat: 0 };
    if (!Array.isArray(db.thangLuong)) db.thangLuong = [];
    thangLuongQuyChe().forEach(function (moi) {
      var cu = timBangLuong(db, moi.ma);
      if (!cu) { db.thangLuong.push(moi); kq.them++; return; }
      ['ten', 'kieu', 'apDung', 'namNang', 'quyChe'].forEach(function (k) { cu[k] = moi[k]; });
      moi.ngach.forEach(function (g) {
        var c = timNgach(cu, g.ma);
        if (c) { c.ten = g.ten; c.soBac = g.soBac; c.bac = g.bac.slice(); delete c.namNang; } else cu.ngach.push(g);
      });
      chuanBangLuong(cu); kq.capNhat++;
    });
    return kq;
  }
  /** Gợi ý chuyển xếp 1 người sang thang bảng lương theo quy chế (Điều 9): chức danh theo chức vụ / trình độ,
      bậc: quản lý (C01–D02) giữ bậc cũ; còn lại căn cứ mức lương cũ – bậc thấp nhất không thấp hơn lương cũ. */
  var GOI_Y_XEP = [['C02', /pho giam doc/], ['C01', /(chu tich|giam doc)/], ['C03', /(ke toan truong|phu trach ke toan)/],
    ['D02', /(pho (truong )?phong|doi truong|pho doi)/], ['D01', /truong phong/], ['D06', /(tap vu|bao ve|ve sinh|lao cong)/],
    ['D05', /(thu tien (nuoc )?tai quay|thu ngan)/], ['D03', /(hoa nghiem|thu kho)/], ['A03', /(truc ca|van hanh)/],
    ['A01', /(ghi thu|ghi chi so|ghi so|ghi dong ho|thu tien|thu hoa don)/], ['A02', /((^| )cn( |$)|cong nhan|lap dat|sua chua|tai xe|lai xe)/]];
  function goiYXepQuyChe(db, nv) {
    var cv = chuanCV(nv.chucVu), ma = null, lyDo = '';
    for (var i = 0; i < GOI_Y_XEP.length && !ma; i++) if (GOI_Y_XEP[i][1].test(cv)) { ma = GOI_Y_XEP[i][0]; lyDo = 'theo chức vụ'; }
    if (!ma) {
      var td = chuanCV(nv.trinhDoCM);
      ma = /(dai hoc|thac si|tien si|ky su|cu nhan)/.test(td) ? 'D03' : /(cao dang|trung cap)/.test(td) ? 'D04' : 'D05';
      lyDo = 'nhân viên văn phòng theo trình độ' + (nv.trinhDoCM ? ' (' + nv.trinhDoCM + ')' : ' (chưa nhập trình độ)');
    }
    var b = null, g = null;
    (db.thangLuong || []).forEach(function (x) { var y = timNgach(x, ma); if (y && !g) { b = x; g = y; } });
    if (!g) return null;
    var n = soBacNgach(g), ky = QUY_CHE_LUONG.tuKy, bac = 1, cu = nv.xepLuong;
    if (/^(C0|D0[12])/.test(ma) && cu && +cu.bac > 0) { bac = Math.min(+cu.bac, n); lyDo += ', giữ bậc cũ'; }
    else {
      var luong = +nv.luongCB || 0; bac = n;
      for (var k = 1; k <= n; k++) { var v = giaTriBac(db, b, g, k, ky); if (v && v.tien >= luong) { bac = k; break; } }
      lyDo += ', theo mức lương cũ';
    }
    return { bang: b.ma, ngach: g.ma, bac: bac, lyDo: lyDo };
  }

  function timBangLuong(db, ma) { return (db.thangLuong || []).filter(function (b) { return b.ma === ma; })[0] || null; }
  function timNgach(b, ma) { return b ? (b.ngach || []).filter(function (g) { return g.ma === ma; })[0] || null : null; }

  /* ----- Mức áp dụng theo thời gian (đợt điều chỉnh lương) -----
     db.dotLuong = [{ id, tuKy: 'yyyy-mm', soQD, ghiChu, luongCoSo, phuCap: { maPC: mức chung },
                      tamUng: { macDinh, theoChucVu: [{ chucVu, muc }] },
                      bang: { maBang: { mucCoSo, ngach: { maNgach: [giá trị từng bậc] } } } }]
     Mỗi đợt áp dụng từ kỳ lương tuKy cho đến đợt sau. Kỳ trước đợt đầu tiên dùng "mức ban đầu":
     giá trị trong danh mục thang bảng lương, Cài đặt (lương cơ sở, tạm ứng), danh mục Phụ cấp (mức chung). */
  function dsDotLuong(db) { return (db.dotLuong || []).slice().sort(function (a, b) { return a.tuKy < b.tuKy ? -1 : a.tuKy > b.tuKy ? 1 : 0; }); }
  function kyHienHanh(db) { var d = new Date(), k = kyCuaNgay(db, d.getFullYear(), d.getMonth() + 1, d.getDate()); return khoaKy(k.y, k.m); }
  /** Chuẩn hoá tham số kỳ: 'yyyy-mm' | {y, m} | bỏ trống = kỳ chứa hôm nay */
  function kyK(db, ky) { return !ky ? kyHienHanh(db) : typeof ky === 'string' ? ky : khoaKy(ky.y, ky.m); }
  /** Kỳ lương chứa một ngày 'yyyy-mm-dd' */
  function kyCuaISO(db, ngay) { var n = docNgay(ngay); var k = kyCuaNgay(db, n.y, n.m, n.d); return khoaKy(k.y, k.m); }
  /** Đợt điều chỉnh đang áp dụng tại kỳ (null = mức ban đầu) */
  function dotTaiKy(db, ky) {
    var k = kyK(db, ky), kq = null;
    dsDotLuong(db).forEach(function (d) { if (d.tuKy && d.tuKy <= k) kq = d; });
    return kq;
  }
  /** Lấy giá trị từ đợt áp dụng tại kỳ; đợt đó không ghi thì lùi về các đợt trước */
  function traCuuDot(db, ky, lay) {
    var k = kyK(db, ky), ds = dsDotLuong(db);
    for (var i = ds.length - 1; i >= 0; i--) {
      if (!ds[i].tuKy || ds[i].tuKy > k) continue;
      var v = lay(ds[i]);
      if (v !== undefined) return v;
    }
    return undefined;
  }
  function luongCoSoKy(db, ky) {
    var v = traCuuDot(db, ky, function (d) { return +d.luongCoSo > 0 ? +d.luongCoSo : undefined; });
    return v !== undefined ? v : +db.caiDat.luongCoSo || 0;
  }
  /** Mức chung của phụ cấp (vd tiền cơm / ngày) áp dụng tại kỳ */
  function mucChungPC(db, pc, ky) {
    var v = traCuuDot(db, ky, function (d) { var x = d.phuCap && d.phuCap[pc.ma]; return x != null && x !== '' ? +x || 0 : undefined; });
    return v !== undefined ? v : +pc.mucChung || 0;
  }
  /** Mức tạm ứng kỳ I áp dụng tại kỳ: { macDinh, theoChucVu: [{ chucVu, muc }] } */
  function cauHinhTamUng(db, ky) {
    var v = traCuuDot(db, ky, function (d) { return d.tamUng && typeof d.tamUng === 'object' ? d.tamUng : undefined; });
    return v || db.caiDat.tamUng || { macDinh: 0, theoChucVu: [] };
  }
  /** Tiền ăn giữa ca không tính thuế TNCN tối đa / tháng tại kỳ */
  function mienThueAnCaKy(db, ky) {
    var v = traCuuDot(db, ky, function (d) { return +d.mienThueAnCa > 0 ? +d.mienThueAnCa : undefined; });
    return v !== undefined ? v : (db.caiDat.mienThueAnCa == null ? 1200000 : +db.caiDat.mienThueAnCa || 0);
  }
  function chuanCV(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function tamUngTheoChucVu(db, chucVu, ky) {
    var cfg = cauHinhTamUng(db, ky), cv = chuanCV(chucVu);
    var r = (cfg.theoChucVu || []).filter(function (x) { return x.chucVu && chuanCV(x.chucVu) === cv; })[0];
    return r ? +r.muc || 0 : +cfg.macDinh || 0;
  }
  /** Tạm ứng kỳ I tự động của nhân viên trong kỳ: mức riêng trong hồ sơ > mức theo chức vụ > mức chung */
  function tamUngKy1(db, nv, y, m, dvk) {
    if (nv.tamUngRieng != null && nv.tamUngRieng !== '') return +nv.tamUngRieng || 0;
    return tamUngTheoChucVu(db, (dvk || donViTheoKy(db, nv, y, m)).chucVu, khoaKy(y, m));
  }
  /** Mảng giá trị các bậc của chức danh áp dụng tại kỳ */
  function bacNgach(db, b, g, ky) {
    if (!db) return g.bac || [];
    var v = traCuuDot(db, ky, function (d) { var x = d.bang && d.bang[b.ma] && d.bang[b.ma].ngach && d.bang[b.ma].ngach[g.ma]; return Array.isArray(x) ? x : undefined; });
    return v || g.bac || [];
  }
  function mucCoSoBL(db, b, ky) {
    var v = traCuuDot(db, ky, function (d) { var x = d.bang && d.bang[b.ma]; return x && +x.mucCoSo > 0 ? +x.mucCoSo : undefined; });
    return v !== undefined ? v : (+b.mucCoSo || luongCoSoKy(db, ky));
  }
  /** Số bậc thực có của một chức danh: trong giới hạn số bậc của chức danh, tới ô cuối có giá trị; có db, b thì theo mức áp dụng tại kỳ */
  function soBacNgach(g, db, b, ky) {
    var arr = db && b ? bacNgach(db, b, g, ky) : g.bac || [], lim = Math.min(+g.soBac > 0 ? +g.soBac : arr.length, arr.length), n = 0;
    for (var i = 0; i < lim; i++) if (+arr[i] > 0) n = i + 1;
    return n;
  }
  /** Giá trị một bậc tại kỳ (bỏ trống = kỳ hiện hành): { heSo, tien } (bậc tính từ 1) */
  function giaTriBac(db, b, g, bac, ky) {
    if (!g || (+g.soBac > 0 && bac > +g.soBac)) return null;
    var arr = bacNgach(db, b, g, ky), v = +arr[bac - 1];
    if (!(v > 0)) return null;
    return b.kieu === 'he_so' ? { heSo: v, tien: Math.round(v * mucCoSoBL(db, b, ky)) } : { heSo: null, tien: Math.round(v) };
  }
  /** Ảnh chụp mọi mức đang áp dụng tại kỳ (dùng khi tạo đợt điều chỉnh mới) */
  function chupMucKy(db, ky) {
    var tu = cauHinhTamUng(db, ky);
    var kq = { luongCoSo: luongCoSoKy(db, ky), mienThueAnCa: mienThueAnCaKy(db, ky), phuCap: {}, bang: {},
      tamUng: { macDinh: +tu.macDinh || 0, theoChucVu: (tu.theoChucVu || []).map(function (x) { return { chucVu: x.chucVu, muc: +x.muc || 0 }; }) } };
    (db.phuCap || []).forEach(function (pc) { var m = mucChungPC(db, pc, ky); if (m || pc.mucChung) kq.phuCap[pc.ma] = m; });
    (db.thangLuong || []).forEach(function (b) {
      var x = { mucCoSo: '', ngach: {} };
      var mcs = traCuuDot(db, ky, function (d) { var y = d.bang && d.bang[b.ma]; return y && +y.mucCoSo > 0 ? +y.mucCoSo : undefined; });
      if (mcs !== undefined) x.mucCoSo = mcs; else if (+b.mucCoSo) x.mucCoSo = +b.mucCoSo;
      (b.ngach || []).forEach(function (g) { x.ngach[g.ma] = bacNgach(db, b, g, ky).slice(); });
      kq.bang[b.ma] = x;
    });
    return kq;
  }
  function themThangISO(ngay, th) {
    var n = docNgay(ngay), t = new Date(n.y, n.m - 1 + th, 1), y = t.getFullYear(), m = t.getMonth() + 1;
    return iso(y, m, Math.min(n.d, soNgay(y, m)));
  }
  /* ================= Thử việc ================= */

  /** Ngày cuối thử việc: từ ngày + số tháng − 1 ngày (01/10 + 2 tháng -> 30/11; 31/01 + 1 tháng -> 28/02) */
  function denNgayThuViec(tuNgay, soThang) {
    var a = docNgay(tuNgay);
    if (!a) return '';
    var t = new Date(a.y, a.m - 1 + Math.max(1, Math.round(+soThang || 2)), 1), y = t.getFullYear(), m = t.getMonth() + 1;
    return a.d > soNgay(y, m) ? iso(y, m, soNgay(y, m)) : congNgay(y, m, a.d, -1);
  }
  /** Thời gian thử việc của nhân viên: { tuNgay, denNgay, soThang, tiLe } hoặc null */
  function thuViecNV(db, nv) {
    var t = nv && nv.thuViec;
    if (!t || !docNgay(t.tuNgay)) return null;
    var md = (db.caiDat && db.caiDat.thuViec) || {};
    var soThang = +t.soThang > 0 ? +t.soThang : soThangThuViec(db);
    var den = docNgay(t.denNgay) ? t.denNgay : denNgayThuViec(t.tuNgay, soThang);
    var tiLe = t.tiLe == null || t.tiLe === '' ? (md.tiLe == null || md.tiLe === '' ? 85 : +md.tiLe) : +t.tiLe;
    return { tuNgay: t.tuNgay, denNgay: den, soThang: soThang, tiLe: tiLe };
  }
  /* ================= Giai đoạn ký hợp đồng ================= */

  var HD_XD = 'Xác định thời hạn', HD_KXD = 'Không xác định thời hạn';
  function giaiDoanHDMacDinh() {
    return [
      { ma: 'TV', ten: 'Hợp đồng thử việc', loai: 'Thử việc', soThang: 1 },
      { ma: 'CT1', ten: 'Hợp đồng chính thức 1 năm', loai: HD_XD, soThang: 12 },
      { ma: 'CT3', ten: 'Hợp đồng chính thức 3 năm', loai: HD_XD, soThang: 36 },
      { ma: 'KXD', ten: 'Hợp đồng không xác định thời hạn', loai: HD_KXD, soThang: 0 }
    ];
  }
  function dsGiaiDoan(db) { var g = db && db.caiDat && db.caiDat.giaiDoanHD; return Array.isArray(g) && g.length ? g : giaiDoanHDMacDinh(); }
  function timGiaiDoan(db, ma) { return dsGiaiDoan(db).filter(function (g) { return g.ma === ma; })[0] || null; }
  /** Số tháng thử việc mặc định = số tháng của giai đoạn hợp đồng thử việc */
  function soThangThuViec(db) {
    var g = dsGiaiDoan(db).filter(function (x) { return x.loai === 'Thử việc'; })[0];
    return g && +g.soThang > 0 ? +g.soThang : (+((db && db.caiDat && db.caiDat.thuViec) || {}).soThang || 1);
  }
  /** Số tháng từ ngày đến ngày (tính cả ngày cuối), làm tròn: 01/10–30/11 = 2 */
  function soThangGiua(tu, den) {
    var a = docNgay(tu), b0 = docNgay(den);
    if (!a || !b0) return 0;
    var b = docNgay(congNgay(b0.y, b0.m, b0.d, 1)), dd = b.d - a.d;
    return (b.y - a.y) * 12 + b.m - a.m + (dd >= 15 ? 1 : dd <= -15 ? -1 : 0);
  }
  function hdTheoNgay(nv) {
    return (nv.hopDong || []).slice().sort(function (a, b) { return (a.tuNgay || '') < (b.tuNgay || '') ? -1 : (a.tuNgay || '') > (b.tuNgay || '') ? 1 : 0; });
  }
  /** Giai đoạn của từng hợp đồng theo thứ tự hiệu lực: [{ hd, gd, lanXD }].
      HĐ chưa ghi giai đoạn (dữ liệu cũ) thì suy theo loại HĐ, thời hạn (12 / 36 tháng) hoặc thứ tự ký. */
  function giaiDoanCacHD(db, nv) {
    var gd = dsGiaiDoan(db), xd = gd.filter(function (g) { return g.loai === HD_XD; }), lan = 0;
    return hdTheoNgay(nv).map(function (hd) {
      var g = hd.giaiDoan ? timGiaiDoan(db, hd.giaiDoan) : null;
      if (!g && hd.loai === HD_XD) {
        var th = soThangGiua(hd.tuNgay, hd.denNgay);
        g = th ? xd.filter(function (x) { return Math.abs(+x.soThang - th) <= 1; })[0] : null;
        if (!g) g = xd[Math.min(lan, xd.length - 1)] || null;
      } else if (!g) g = gd.filter(function (x) { return x.loai === hd.loai; })[0] || null;
      if (hd.loai === HD_XD) lan++;
      return { hd: hd, gd: g, lanXD: hd.loai === HD_XD ? lan : 0 };
    });
  }
  function giaiDoanCuaHD(db, nv, hd) { var x = giaiDoanCacHD(db, nv).filter(function (y) { return y.hd === hd || (hd.id && y.hd.id === hd.id); })[0]; return x ? x.gd : null; }
  /** Hợp đồng ký tiếp theo sau hd (mặc định HĐ mới nhất): { gd, tuNgay, denNgay, canhBao }.
      Đã ký 2 lần HĐ xác định thời hạn thì lần sau phải là HĐ không xác định thời hạn (khoản 2 Điều 20 BLLĐ 2019). */
  function hdTiepTheo(db, nv, hd) {
    var gd = dsGiaiDoan(db), ds = giaiDoanCacHD(db, nv), i = ds.length - 1;
    if (hd) { i = -1; ds.forEach(function (y, k) { if (y.hd === hd || (hd.id && y.hd.id === hd.id)) i = k; }); }
    if (i < 0) return { gd: gd[0] || null, tuNgay: '', denNgay: '', canhBao: '' };
    var x = ds[i], k = x.gd ? gd.indexOf(x.gd) : -1, tiep = null, canhBao = '';
    if (k >= 0) tiep = gd[Math.min(k + 1, gd.length - 1)];
    else if (x.hd.loai === 'Thử việc') tiep = gd.filter(function (g) { return g.loai !== 'Thử việc'; })[0] || null;
    var soXD = ds.slice(0, i + 1).filter(function (y) { return y.hd.loai === HD_XD; }).length;
    if (tiep && tiep.loai === HD_XD && soXD >= 2) {
      var kxd = gd.filter(function (g) { return g.loai === HD_KXD; })[0];
      if (kxd) { tiep = kxd; canhBao = 'Đã ký ' + soXD + ' lần HĐ xác định thời hạn – lần tiếp theo phải ký HĐ không xác định thời hạn (khoản 2 Điều 20 BLLĐ 2019)'; }
    }
    var n = docNgay(x.hd.denNgay), tu = n ? congNgay(n.y, n.m, n.d, 1) : '';
    return { gd: tiep, tuNgay: tu, denNgay: tiep && +tiep.soThang > 0 && tu ? denNgayThuViec(tu, tiep.soThang) : '', canhBao: canhBao };
  }

  /** Đang thử việc vào ngày (ISO) */
  function dangThuViec(db, nv, ngay) { var t = thuViecNV(db, nv); return !!(t && ngay >= t.tuNgay && ngay <= t.denNgay); }

  /** Xếp lương của nhân viên (bậc hiện tại hoặc x; giá trị theo mức áp dụng tại kỳ ky) và hạn nâng bậc tiếp theo */
  function xepLuongNV(db, nv, ky, x) {
    x = x || nv.xepLuong;
    if (!x || !x.bang) return null;
    var b = timBangLuong(db, x.bang), g = timNgach(b, x.ngach);
    if (!b || !g) return null;
    var bac = Math.max(1, +x.bac || 1), soBac = soBacNgach(g, db, b, ky), gt = giaTriBac(db, b, g, bac, ky);
    var namNang = +g.namNang || +b.namNang || 3, keoDai = 0;
    if (x.ngayHuong) (nv.quyetDinh || []).forEach(function (q) { if (q.loai === 'ky_luat' && KL_KEO_DAI.test(q.hinhThuc || '') && q.hieuLuc >= x.ngayHuong) keoDai += 6; });
    return {
      bang: b, ngach: g, bac: bac, soBac: soBac, bacCuoi: bac >= soBac, heSo: gt ? gt.heSo : null, tien: gt ? gt.tien : 0,
      ngayHuong: x.ngayHuong || '', namNang: namNang, keoDai: keoDai, apDung: b.apDung,
      ngayNang: x.ngayHuong && bac < soBac ? themThangISO(x.ngayHuong, namNang * 12 + keoDai) : '',
      bacSau: bac < soBac ? giaTriBac(db, b, g, bac + 1, ky) : null
    };
  }
  /** Bậc lương nhân viên hưởng trong kỳ: quyết định nâng bậc hiệu lực SAU kỳ thì kỳ này vẫn bậc cũ */
  function xepLuongTheoKy(db, nv, y, m) {
    var cuoi = ketThucKy(db, y, m), x = nv.xepLuong || null;
    var ds = (nv.quyetDinh || []).filter(function (q) { return q.loai === 'nang_luong' && ('xepLuongCu' in q) && q.hieuLuc && q.hieuLuc > cuoi; })
      .sort(function (a, b) { return a.hieuLuc < b.hieuLuc ? -1 : 1; });
    if (ds.length) x = ds[0].xepLuongCu || null;
    return x;
  }
  /** Ghi mức lương theo bảng vào nhân viên (mức lương và / hoặc lương đóng BH). Trả về các trường đã đổi. */
  function apXepLuong(db, nv) {
    var xl = xepLuongNV(db, nv), doi = {};
    if (!xl || !xl.tien) return doi;
    var ht = nv.hinhThuc || 'thang';
    if ((xl.apDung === 'cb' || xl.apDung === 'ca_hai') && (ht === 'thang' || ht === 'khoan') && +nv.luongCB !== xl.tien) { doi.luongCB = [+nv.luongCB || 0, xl.tien]; nv.luongCB = xl.tien; }
    if ((xl.apDung === 'bh' || xl.apDung === 'ca_hai') && +nv.luongBH !== xl.tien) { doi.luongBH = [+nv.luongBH || 0, xl.tien]; nv.luongBH = xl.tien; }
    return doi;
  }

  /* ----- Khối bảng lương: mỗi phòng / đội thuộc 1 bảng lương (vd Văn phòng công ty gồm Ban GĐ và các phòng;
     mỗi đội 1 bảng), có tiêu đề, ngân hàng chi lương, số tài khoản công ty riêng ----- */
  var KHOI_VP = 'Văn phòng công ty';
  function khoiCuaDV(db, maPB) {
    var p = (db.phongBan || []).filter(function (x) { return x.ma === maPB; })[0];
    if (!p) return KHOI_VP;
    if (p.khoi && String(p.khoi).trim()) return String(p.khoi).trim();
    return loaiDonVi(p) === 'doi' ? p.ten : KHOI_VP;
  }
  function dsKhoi(db) {
    var kq = [];
    (db.phongBan || []).forEach(function (p) { if (p.ngung) return; var k = khoiCuaDV(db, p.ma); if (kq.indexOf(k) < 0) kq.push(k); });
    return kq;
  }
  function thongTinKhoi(db, ten) {
    var x = (db.khoiLuong || {})[ten] || {};
    return {
      ten: ten, tieuDe: x.tieuDe || 'BẢNG THANH TOÁN TIỀN LƯƠNG ' + String(ten).toUpperCase(),
      nganHang: x.nganHang != null ? x.nganHang : (db.congTy.nganHangChi || ''), soTK: x.soTK != null ? x.soTK : (db.congTy.soTKChi || '')
    };
  }

  /* ----- Phòng, đội ----- */
  var LOAI_DV = { phong: 'Phòng', doi: 'Đội', ban: 'Ban', to: 'Tổ', xn: 'Xí nghiệp / chi nhánh' };
  function loaiDonVi(p) {
    if (p.loai && LOAI_DV[p.loai]) return p.loai;
    var t = String(p.ten || '');
    return /^đội/i.test(t) ? 'doi' : /^ban/i.test(t) ? 'ban' : /^tổ/i.test(t) ? 'to' : /xí nghiệp|chi nhánh/i.test(t) ? 'xn' : 'phong';
  }

  /** Phòng / đội và chức vụ của nhân viên trong kỳ: nếu có quyết định điều chuyển / bổ nhiệm hiệu lực SAU kỳ này
      thì kỳ này vẫn thuộc đơn vị cũ (ghi trong quyết định sớm nhất đó). */
  function donViTheoKy(db, nv, y, m) {
    var cuoi = ketThucKy(db, y, m), kq = { phongBan: nv.phongBan || '', chucVu: nv.chucVu || '' };
    var ds = (nv.quyetDinh || []).filter(function (q) { return (q.loai === 'dieu_chuyen' || q.loai === 'bo_nhiem') && q.hieuLuc && q.hieuLuc > cuoi; })
      .sort(function (a, b) { return a.hieuLuc < b.hieuLuc ? -1 : 1; });
    if (ds.length) {
      var q = ds[0];
      if (q.phongBanCu) kq.phongBan = q.phongBanCu;
      if (q.chucVuMoi && q.chucVuCu != null) kq.chucVu = q.chucVuCu;
    }
    return kq;
  }

  /** Số người phụ thuộc được giảm trừ trong tháng (theo danh sách có từ tháng – đến tháng) */
  function soNPTKy(nv, y, m) {
    var ds = nv.nguoiPhuThuoc;
    if (!Array.isArray(ds) || !ds.length) return +nv.soNPT || 0;
    var k = khoaKy(y, m);
    return ds.filter(function (p) { return (!p.tuThang || p.tuThang <= k) && (!p.denThang || p.denThang >= k); }).length;
  }

  /** Tiền thưởng / phạt theo quyết định khen thưởng, kỷ luật được đưa vào bảng lương kỳ y-m */
  function thuongPhatQD(nv, y, m) {
    var k = khoaKy(y, m), t = 0, p = 0;
    (nv.quyetDinh || []).forEach(function (q) {
      if (q.kyLuong !== k || !+q.soTien) return;
      if (q.loai === 'khen_thuong') t += +q.soTien; else if (q.loai === 'ky_luat') p += +q.soTien;
    });
    return { thuong: t, phat: p };
  }

  /** Ngày làm việc của nhân viên trong khoảng [tu, den] (bỏ ngày nghỉ tuần, ngày lễ, ngoài thời gian làm việc) */
  function ngayLamTrongKhoang(db, nv, tu, den) {
    var a = docNgay(tu), ds = [], le = bangNgayLe(db);
    if (!a || !den || den < tu) return ds;
    for (var i = 0; i < 400; i++) {
      var s = congNgay(a.y, a.m, a.d, i);
      if (s > den) break;
      var n = docNgay(s);
      if (!nvLamNgay(nv, n.y, n.m, n.d)) continue;
      if (loaiNgay(db, n.y, n.m, n.d, le, nv) === 'nghi' || le[s]) continue;
      ds.push({ y: n.y, m: n.m, d: n.d, iso: s });
    }
    return ds;
  }

  /** Duyệt đơn nghỉ: chấm ký hiệu vào bảng chấm công cho các ngày làm việc trong khoảng.
      Ghi đè ô trống hoặc ô đang chấm đi làm (+, +/2); giữ nguyên ô đã chấm nghỉ khác; bỏ qua kỳ đã chốt. */
  function apDungDonNghi(db, don) {
    var nv = db.nhanVien.filter(function (x) { return x.id === don.nvId; })[0];
    var kq = { cham: [], khoa: [], trung: [] };
    if (!nv) return kq;
    var cd = db.caiDat, diLam = [cd.khDiLam || '+', cd.khNuaNgay || '+/2'].map(function (x) { return String(x).toUpperCase(); });
    ngayLamTrongKhoang(db, nv, don.tuNgay, don.denNgay).forEach(function (x) {
      var k = kyCuaNgay(db, x.y, x.m, x.d), TK = db.thang[khoaKy(k.y, k.m)];
      if (TK && TK.khoa) { kq.khoa.push(x.iso); return; }
      var T = thang(db, x.y, x.m, true), cc = T.cc[nv.id] || (T.cc[nv.id] = {});
      var cu = cc[x.d] ? String(cc[x.d]).toUpperCase() : '';
      if (cu && diLam.indexOf(cu) < 0 && cu !== String(don.kyHieu).toUpperCase()) { kq.trung.push(x.iso); return; }
      cc[x.d] = don.kyHieu;
      kq.cham.push(x.iso);
    });
    don.ngayDaCham = kq.cham;
    return kq;
  }

  /** Huỷ duyệt đơn: xoá các ô đã chấm theo đơn (nếu vẫn còn đúng ký hiệu và kỳ chưa chốt) */
  function boDonNghi(db, don) {
    var n = 0;
    (don.ngayDaCham || []).forEach(function (s) {
      var x = docNgay(s), k = kyCuaNgay(db, x.y, x.m, x.d), TK = db.thang[khoaKy(k.y, k.m)];
      if (TK && TK.khoa) return;
      var T = db.thang[khoaKy(x.y, x.m)], cc = T && T.cc[don.nvId];
      if (cc && String(cc[x.d]) === String(don.kyHieu)) { delete cc[x.d]; n++; }
    });
    don.ngayDaCham = [];
    return n;
  }

  /** Ngày đủ tuổi nghỉ hưu (điều kiện lao động bình thường, lộ trình Nghị định 135/2020/NĐ-CP):
      nam 60 tuổi 3 tháng (2021) +3 tháng/năm đến 62 tuổi; nữ 55 tuổi 4 tháng (2021) +4 tháng/năm đến 60 tuổi. */
  function ngayNghiHuu(gioiTinh, ngaySinh) {
    var n = docNgay(ngaySinh);
    if (!n) return '';
    var nu = /n[ữu]/i.test(gioiTinh || '');
    for (var y = 2021; y <= 2100; y++) {
      var thangTuoi = nu ? Math.min(720, 55 * 12 + 4 * (y - 2020)) : Math.min(744, 60 * 12 + 3 * (y - 2020));
      var t = new Date(n.y, n.m - 1 + thangTuoi, n.d);
      if (t.getFullYear() <= y) return iso(t.getFullYear(), t.getMonth() + 1, t.getDate());
    }
    return '';
  }

  /** Thâm niên (năm, tháng) tính đến ngày */
  function thamNien(ngayVao, denNgay) {
    var a = docNgay(ngayVao), b = docNgay(denNgay);
    if (!a || !b) return { nam: 0, thang: 0, tongThang: 0 };
    var t = (b.y - a.y) * 12 + (b.m - a.m) - (b.d < a.d ? 1 : 0);
    t = Math.max(0, t);
    return { nam: Math.floor(t / 12), thang: t % 12, tongThang: t };
  }

  /* ================= Tính lương 1 nhân viên ================= */

  function r0(x) { return Math.round(x || 0); }

  function tinhLuongNV(db, y, m, nv, ctx) {
    ctx = ctx || {};
    var cd = db.caiDat, kyTinh = khoaKy(y, m);
    var T = ctx.T || thang(db, y, m);
    var c = tongHopCong(db, y, m, nv, ctx);
    var cc = c.congChuan || 1;
    var tl = (nv.tiLeHuong == null || nv.tiLeHuong === '' ? 100 : +nv.tiLeHuong) / 100, tlCT = tl;
    // Thử việc: những ngày trong thời gian thử việc hưởng tỷ lệ thử việc (mặc định 85%) của lương chính thức.
    // Kỳ có cả ngày thử việc và ngày chính thức: lương ngày bình quân theo số công của từng phần.
    var tv = thuViecNV(db, nv), tvKy = null;
    if (tv) {
      var dsKy = ctx.ngay || ngayKy(db, y, m);
      var dsTV = dsKy.filter(function (x) { return x.iso >= tv.tuNgay && x.iso <= tv.denNgay; });
      if (dsTV.length) {
        var toanKy = dsTV.length === dsKy.length;
        var cTV = toanKy ? c : tongHopCong(db, y, m, nv, Object.assign({}, ctx, { ngay: dsTV }));
        var tlTV = tlCT * tv.tiLe / 100, congTV = cTV.congTG, congCT = Math.max(0, c.congTG - congTV);
        if (toanKy) tl = tlTV;
        else if (c.congTG > 0) tl = (congTV * tlTV + congCT * tlCT) / c.congTG;
        else tl = (dsTV.length * tlTV + (dsKy.length - dsTV.length) * tlCT) / dsKy.length;
        tvKy = { tuNgay: tv.tuNgay, denNgay: tv.denNgay, tiLe: tv.tiLe, tiLeCT: tlCT * 100, toanKy: toanKy, soNgay: dsTV.length,
          congTV: congTV, congCT: congCT, congHLTV: Math.max(0, cTV.congHL - cTV.congThemLeTG + cTV.sp - cTV.congThemLeSP) };
      }
    }
    var lk = luongTheoKy(db, nv, y, m), dvk = donViTheoKy(db, nv, y, m);
    var cb = lk.luongCB;
    var gio = +cd.gioLamNgay || 8;
    var hinhThuc = nv.hinhThuc || 'thang';
    var luongNgay, luongGio;
    if (hinhThuc === 'ngay') { luongNgay = cb * tl; luongGio = luongNgay / gio; }
    else if (hinhThuc === 'gio') { luongGio = cb * tl; luongNgay = luongGio * gio; }
    else { luongNgay = cb * tl / cc; luongGio = luongNgay / gio; }
    var luongTG, luongNgung;
    var congTinh = c.congTG;
    // giới hạn tối đa bằng công chuẩn (nếu bật) chỉ áp cho công thường, không cắt phần tăng thêm do đi làm ngày lễ, Tết
    if (cd.gioiHanCong && hinhThuc === 'thang') congTinh = Math.min(c.congTG - c.congThemLeTG, Math.max(0, cc - c.ngung)) + c.congThemLeTG;
    if (hinhThuc === 'khoan') { luongTG = (c.congHL + c.sp) > 0 ? cb * tl : 0; luongNgung = 0; }
    else { luongTG = luongNgay * congTinh; luongNgung = luongNgay * c.ngung * (cd.tiLeNgungViec == null ? 100 : +cd.tiLeNgungViec) / 100; }
    luongTG = r0(luongTG); luongNgung = r0(luongNgung);
    var luongCong = luongTG + luongNgung;

    var dc = (T.dc && T.dc[nv.id]) || {};
    // Lương sản phẩm = Σ số lượng × đơn giá (sản phẩm chính của người dùng đơn giá riêng nếu có)
    var dsSP = ctx.sanPham || db.sanPham || [];
    var maSP = nv.maSP || (dsSP[0] && dsSP[0].ma) || '';
    var slMap = Object.assign({}, dc.sp || {});
    if (+dc.slSP && !slMap[maSP]) slMap[maSP] = +dc.slSP; // dữ liệu cũ
    var spChiTiet = [], luongSP = 0;
    dsSP.forEach(function (sp) {
      var sl = +slMap[sp.ma] || 0;
      if (!sl) return;
      var dg = sp.ma === maSP && +nv.donGiaSP > 0 ? +nv.donGiaSP : (+sp.donGia || 0);
      var tien = r0(sl * dg);
      spChiTiet.push({ ma: sp.ma, ten: sp.ten, dvt: sp.dvt || '', sl: sl, donGia: dg, tien: tien });
      luongSP += tien;
    });
    var slSP = +slMap[maSP] || 0;
    var spChinh = dsSP.filter(function (x) { return x.ma === maSP; })[0];
    var donGiaSP = +nv.donGiaSP > 0 ? +nv.donGiaSP : (spChinh ? +spChinh.donGia || 0 : 0);

    // Làm thêm giờ: phần 100% chịu thuế, phần chênh lệch được miễn thuế
    var hs = cd.heSoOT || {}, hsd = heSoOTDem(cd);
    var otTien = {
      thuong: r0(luongGio * c.otThuong * (+hs.thuong || 150) / 100),
      nghi: r0(luongGio * c.otNghi * (+hs.nghi || 200) / 100),
      le: r0(luongGio * c.otLe * (+hs.le || 300) / 100),
      dem: r0(luongGio * ((c.otDemThuong || 0) * hsd.thuong + (c.otDemThuong2 || 0) * hsd.thuong2 + (c.otDemNghi || 0) * hsd.nghi + (c.otDemLe || 0) * hsd.le) / 100)
    };
    var tienOT = otTien.thuong + otTien.nghi + otTien.le + otTien.dem;
    var otChiuThue = luongGio * c.otTong;
    var otMienThue = r0(Math.max(0, tienOT - otChiuThue));

    // Phụ cấp
    var pcList = ctx.phuCap || db.phuCap;
    var phuCap = {}, phuCapNgay = {}, tongPC = 0, pcKhongThue = 0, pcDongBH = 0, tienAnCa = 0;
    var npc = nv.phuCap || {};
    var coCong = c.congHL + c.sp;
    pcList.forEach(function (pc) {
      // mức riêng của người (kể cả 0 = không hưởng) > mức chung áp dụng cho mọi nhân viên
      var rieng = npc[pc.ma] != null && npc[pc.ma] !== '';
      var muc = rieng ? (+npc[pc.ma] || 0) : mucChungPC(db, pc, kyTinh), tien = 0;
      if (muc) {
        if (pc.cachTinh === 'theo_ngay') { tien = muc * c.ngayCom; phuCapNgay[pc.ma] = c.ngayCom; }
        else if (pc.cachTinh === 'theo_cong') tien = coCong > 0 ? muc * Math.min(coCong, cc) / cc : 0;
        else tien = coCong > 0 ? muc : 0;
      }
      tien = r0(tien);
      phuCap[pc.ma] = tien;
      tongPC += tien;
      if (pc.anCa && !pc.chiuThue) tienAnCa += tien;
      else if (!pc.chiuThue) pcKhongThue += tien;
      if (pc.dongBH) pcDongBH += muc;
    });
    // tiền ăn giữa ca: miễn thuế tối đa theo quy định, phần vượt tính vào thu nhập chịu thuế
    var capAnCa = mienThueAnCaKy(db, kyTinh), anCaVuot = Math.max(0, tienAnCa - capAnCa);
    pcKhongThue += tienAnCa - anCaVuot;

    var thuong = +dc.thuong || 0, congKhac = +dc.congKhac || 0;
    // tạm ứng kỳ I: nhập tay cho kỳ này (kể cả 0) > tự động theo chức vụ / mức riêng (chỉ khi có công hưởng lương)
    var coTU = dc.tamUng != null && dc.tamUng !== '';
    var tamUngTD = coCong > 0 ? tamUngKy1(db, nv, y, m, dvk) : 0;
    var tamUng = coTU ? +dc.tamUng || 0 : tamUngTD, khauTru = +dc.khauTru || 0;
    var qd = thuongPhatQD(nv, y, m), thuongQD = qd.thuong, phatQD = qd.phat;
    var tongThuNhap = luongSP + luongCong + tienOT + tongPC + thuong + thuongQD + congKhac;

    // Bảo hiểm
    var canhBao = [];
    var luongBH = 0;
    if (nv.thamGiaBH) {
      if (lk.bhTheoBac > 0) luongBH = lk.bhTheoBac + pcDongBH;     // theo bậc lương hiện tại + phụ cấp đóng BH
      else if (lk.luongBH > 0) luongBH = lk.luongBH;
      else if (hinhThuc === 'thang' || hinhThuc === 'khoan') luongBH = cb + pcDongBH;
      else canhBao.push('Chưa nhập lương đóng BH');
      if (luongBH > 0 && luongBH < (+cd.luongToiThieuVung || 0)) canhBao.push('Lương đóng BH thấp hơn lương tối thiểu vùng');
    }
    var ngayKhongLuong = Math.max(0, cc - (c.congHL - c.congThemLeTG) - (c.sp - c.congThemLeSP));
    // thời gian thử việc (hợp đồng thử việc riêng) không đóng BH: công thử việc coi như ngày không thuộc hợp đồng lao động
    var tvKhongBH = !!(tvKy && (cd.thuViec || {}).khongDongBH !== false);
    if (tvKhongBH) ngayKhongLuong += tvKy.congHLTV;
    var dongBH = nv.thamGiaBH && luongBH > 0 && !(tvKhongBH && tvKy.toanKy) && ngayKhongLuong < (+cd.nguongNghiKhongDongBH || 14);
    if (nv.thamGiaBH && luongBH > 0 && !dongBH && !tvKhongBH) canhBao.push('Nghỉ từ ' + (cd.nguongNghiKhongDongBH || 14) + ' ngày không lương trở lên: không đóng BH tháng này');
    var lcs = luongCoSoKy(db, kyTinh);
    var capXH = 20 * lcs, capTN = 20 * (+cd.luongToiThieuVung || 0);
    var nenXH = dongBH ? Math.min(luongBH, capXH || luongBH) : 0;
    var nenTN = dongBH ? Math.min(luongBH, capTN || luongBH) : 0;
    var bnv = cd.bh.nv, bdn = cd.bh.dn;
    var bhxh = r0(nenXH * bnv.bhxh / 100), bhyt = r0(nenXH * bnv.bhyt / 100), bhtn = r0(nenTN * bnv.bhtn / 100);
    var tongBH = bhxh + bhyt + bhtn;
    var dn = {
      bhxh: r0(nenXH * bdn.bhxh / 100), bhyt: r0(nenXH * bdn.bhyt / 100),
      bhtn: r0(nenTN * bdn.bhtn / 100), kpcd: r0(nenXH * bdn.kpcd / 100)
    };
    dn.tong = dn.bhxh + dn.bhyt + dn.bhtn + dn.kpcd;
    // Đoàn phí công đoàn: % trên lương đóng BH (chưa tham gia BH thì tính trên mức lương), tối đa 10% lương cơ sở
    var nenDP = luongBH > 0 ? luongBH : ((hinhThuc === 'thang' || hinhThuc === 'khoan') ? cb : 0);
    var doanPhi = (nv.doanVien && nenDP > 0 && tongThuNhap > 0) ? r0(Math.min(nenDP * (+cd.bh.doanPhi || 0) / 100, 0.1 * (lcs || Infinity))) : 0;

    // Thuế TNCN
    var tnct = Math.max(0, tongThuNhap - pcKhongThue - otMienThue);
    var soNPT = soNPTKy(nv, y, m);
    var gtBT = 0, gtNPT = 0, tntt = 0, thue = 0;
    var cachThue = nv.cachTinhThue || 'luy_tien';
    if (cachThue === 'luy_tien') {
      gtBT = +cd.giamTruBanThan || 0;
      gtNPT = soNPT * (+cd.giamTruNPT || 0);
      tntt = Math.max(0, tnct - tongBH - gtBT - gtNPT);
      thue = thueLuyTien(tntt, cd.bieuThue);
    } else if (cachThue === 'khau_tru') {
      tntt = tnct;
      thue = tnct >= (+cd.nguongKhauTru || 0) ? r0(tnct * (+cd.thueKhauTru || 10) / 100) : 0;
    }

    var phatMuon = r0((+cd.phatMuonMoiLan || 0) * c.muonLan + (+cd.phatMuonMoiPhut || 0) * c.muonPhut);
    var tongKhauTru = tongBH + doanPhi + thue + phatMuon + khauTru + phatQD;   // cột "Cộng" các khoản khấu trừ (không gồm tạm ứng)
    // tiền làm thêm giờ chi riêng (bảng thanh toán làm thêm giờ) thì không gộp vào lãnh kỳ II; thuế vẫn tính trên cả tháng
    var otRieng = cd.otTraRieng ? tienOT : 0;
    var thucLinh = tongThuNhap - otRieng - tamUng - tongKhauTru;
    var lt = +cd.lamTron || 1;
    thucLinh = Math.round(thucLinh / lt) * lt;
    if (thucLinh < 0 && tamUng > 0) canhBao.push('Tạm ứng kỳ I lớn hơn số tiền còn được lãnh: kỳ II âm');

    return {
      nvId: nv.id, ma: nv.ma, hoTen: nv.hoTen, phongBan: dvk.phongBan, tenPhongBan: tenPhongBan(db, dvk.phongBan),
      chucVu: dvk.chucVu, mst: nv.mst || '', nganHang: nv.nganHang || '', soTK: nv.soTK || '', chiNhanhNH: nv.chiNhanhNH || '',
      hinhThuc: hinhThuc, cachTinhThue: cachThue, tiLeHuong: Math.round(tl * 10000) / 100, thuViec: tvKy,
      cong: c, congChuan: c.congChuan,
      luongCB: cb, luongNgay: r0(luongNgay), luongGio: r0(luongGio),
      maSP: maSP, slSP: slSP, donGiaSP: donGiaSP, luongSP: luongSP, spChiTiet: spChiTiet, congTinh: congTinh,
      loaiLD: nv.loaiLD || '',
      luongTG: luongTG, luongNgung: luongNgung, luongCong: luongCong,
      tienOT: tienOT, otMienThue: otMienThue,
      phuCap: phuCap, phuCapNgay: phuCapNgay, tongPhuCap: tongPC, pcKhongThue: pcKhongThue,
      thuong: thuong, thuongQD: thuongQD, phatQD: phatQD, congKhac: congKhac, tongThuNhap: tongThuNhap, qdLuong: lk.qd ? lk.qd.so || '' : '',
      luongBH: luongBH, bhTheoBac: lk.bhTheoBac || 0, pcDongBH: pcDongBH, dongBH: !!dongBH, bhxh: bhxh, bhyt: bhyt, bhtn: bhtn, tongBH: tongBH, doanPhi: doanPhi,
      tnct: tnct, giamTruBT: gtBT, soNPT: soNPT, giamTruNPT: gtNPT, tntt: tntt, thue: thue,
      anCaVuot: anCaVuot, otRieng: otRieng, otTien: otTien, khoi: khoiCuaDV(db, dvk.phongBan), tamUng: tamUng, tamUngTuDong: !coTU, tamUngMacDinh: tamUngTD, khauTru: khauTru, phatMuon: phatMuon, tongKhauTru: tongKhauTru, ghiChu: dc.ghiChu || '',
      thucLinh: thucLinh, dn: dn, chiPhiDN: tongThuNhap + dn.tong,
      canhBao: canhBao
    };
  }

  var TRUONG_TONG = ['luongCB', 'slSP', 'luongSP', 'luongTG', 'luongNgung', 'luongCong', 'tienOT', 'otMienThue', 'tongPhuCap', 'pcKhongThue', 'thuong', 'thuongQD', 'phatQD', 'congKhac', 'tongThuNhap',
    'luongBH', 'bhxh', 'bhyt', 'bhtn', 'tongBH', 'doanPhi', 'tnct', 'tntt', 'thue', 'tamUng', 'khauTru', 'phatMuon', 'tongKhauTru', 'thucLinh', 'chiPhiDN'];

  function cong(rows, phuCapList) {
    var t = { phuCap: {}, phuCapNgay: {}, dn: { bhxh: 0, bhyt: 0, bhtn: 0, kpcd: 0, tong: 0 }, soNV: rows.length,
      cong: { congHL: 0, congTG: 0, lam: 0, sp: 0, ngung: 0, ngayLamThucTe: 0, ngayCom: 0, congThemLe: 0, otTong: 0, otDem: 0, phep: 0, muonLan: 0, muonPhut: 0, khong: 0, kp: 0, bhxh: 0 } };
    TRUONG_TONG.forEach(function (f) { t[f] = 0; });
    (phuCapList || []).forEach(function (pc) { t.phuCap[pc.ma] = 0; });
    rows.forEach(function (r) {
      TRUONG_TONG.forEach(function (f) { t[f] += r[f] || 0; });
      Object.keys(r.phuCap || {}).forEach(function (k) { t.phuCap[k] = (t.phuCap[k] || 0) + r.phuCap[k]; });
      Object.keys(r.phuCapNgay || {}).forEach(function (k) { t.phuCapNgay[k] = (t.phuCapNgay[k] || 0) + r.phuCapNgay[k]; });
      Object.keys(t.dn).forEach(function (k) { t.dn[k] += r.dn[k] || 0; });
      Object.keys(t.cong).forEach(function (k) { t.cong[k] += r.cong[k] || 0; });
    });
    Object.keys(t.cong).forEach(function (k) { t.cong[k] = Math.round(t.cong[k] * 100) / 100; });
    return t;
  }

  /** Bảng lương cả kỳ. Kỳ đã chốt thì trả về số liệu đã lưu khi chốt. */
  function tinhBangLuong(db, y, m) {
    var T = thang(db, y, m);
    if (T.khoa && T.chot && T.chot.rows) {
      return { rows: T.chot.rows, phuCap: T.chot.phuCap, congChuan: T.chot.congChuan, khoa: true, ngayChot: T.chot.ngay, tong: cong(T.chot.rows, T.chot.phuCap) };
    }
    var ctx = { T: T, kh: bangKyHieu(db), le: bangNgayLe(db), loaiLe: bangLoaiLe(db), heSoLe: bangHeSoLe(db), ngay: ngayKy(db, y, m), phuCap: db.phuCap, sanPham: db.sanPham };
    var rows = dsNhanVienKy(db, y, m).map(function (nv) { return tinhLuongNV(db, y, m, nv, ctx); });
    return { rows: rows, phuCap: db.phuCap, congChuan: congChuan(db, y, m), khoa: !!T.khoa, tong: cong(rows, db.phuCap) };
  }

  function chotThang(db, y, m) {
    var T = thang(db, y, m, true);
    T.khoa = false; T.chot = null;
    var bl = tinhBangLuong(db, y, m);
    T.chot = { ngay: new Date().toISOString(), rows: JSON.parse(JSON.stringify(bl.rows)), phuCap: JSON.parse(JSON.stringify(bl.phuCap)), congChuan: bl.congChuan };
    T.khoa = true;
    return T.chot;
  }
  function moKhoaThang(db, y, m) { var T = thang(db, y, m, true); T.khoa = false; T.chot = null; }

  /* ================= Vào / ra (máy chấm công) ================= */

  /** Tính công một ngày từ giờ vào/ra (phút trong ngày). */
  function tinhVaoRa(cd, loai, vao, ra) {
    var gv = phut(cd.gioVao), gr = phut(loai === 'nua' ? (cd.gioRaT7 || '12:00') : cd.gioRa);
    var t1 = phut(cd.nghiTruaTu), t2 = phut(cd.nghiTruaDen);
    var cp = +cd.phutChoPhep || 0;
    function chong(a1, a2, b1, b2) { return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1)); }
    var kq = { gioLam: 0, muon: 0, veSom: 0, ot: 0, otKhung: '', kyHieu: '', ghiChu: '' };
    if (vao == null && ra == null) return kq;
    var motLan = vao == null || ra == null || vao === ra;
    if (motLan) {
      var p = vao != null ? vao : ra;
      kq.ghiChu = 'Chỉ có 1 lần chấm';
      if (loai === 'nghi') { kq.kyHieu = ''; return kq; }
      if (p < (t1 || 720) && p - gv > cp) kq.muon = p - gv;
      kq.kyHieu = cd.khDiLam || '+';
      return kq;
    }
    var nghiTrua = (t1 != null && t2 != null && loai !== 'nua') ? chong(vao, ra, t1, t2) : 0;
    var block = +cd.otLamTronPhut || 1;
    if (loai === 'nghi') {
      var tong = Math.max(0, ra - vao - nghiTrua);
      kq.gioLam = Math.round(tong / 60 * 100) / 100;
      kq.ot = Math.floor(tong / block) * block / 60;
      // khung giờ làm thêm (bỏ giờ nghỉ trưa) để tách được phần ban đêm
      var doan = nghiTrua ? [[vao, Math.max(vao, t1)], [Math.min(ra, t2), ra]] : [[vao, ra]];
      kq.otKhung = kq.ot ? khungTuDoan(doan.filter(function (x) { return x[1] > x[0]; }), kq.ot * 60) : '';
      kq.kyHieu = '';
      return kq;
    }
    if (loai === 'le') kq.ghiChu = 'Đi làm ngày lễ, Tết (nhân công)';
    var lam = chong(vao, ra, gv, gr) - nghiTrua;
    kq.gioLam = Math.round(Math.max(0, lam) / 60 * 100) / 100;
    if (vao - gv > cp) kq.muon = vao - gv;
    if (gr - ra > cp) kq.veSom = gr - ra;
    var them = ra - gr;
    if (them >= (+cd.otToiThieuPhut || 0) && them > 0) {
      kq.ot = Math.floor(them / block) * block / 60;
      if (kq.ot) kq.otKhung = khungTuDoan([[gr, ra]], kq.ot * 60);
    }
    var kc = cd.khDiLam || '+', kn = cd.khNuaNgay || '+/2';
    if (kq.gioLam >= (+cd.nguongCaNgay || 6) || (loai === 'nua' && kq.gioLam >= (+cd.nguongNuaNgay || 3))) kq.kyHieu = loai === 'nua' ? kn : kc;
    else if (kq.gioLam >= (+cd.nguongNuaNgay || 3)) kq.kyHieu = kn;
    else kq.ghiChu = (kq.ghiChu ? kq.ghiChu + '; ' : '') + 'Giờ làm quá ít';
    return kq;
  }

  /* ================= Phép năm ================= */

  function phepNam(db, nv, nam) {
    var kh = bangKyHieu(db), daNghi = 0, theoThang = [];
    for (var m = 1; m <= 12; m++) {
      var T = db.thang[khoaKy(nam, m)], s = 0;
      if (T && T.cc && T.cc[nv.id]) {
        var cc = T.cc[nv.id];
        Object.keys(cc).forEach(function (d) { var k = kh[String(cc[d]).toUpperCase()]; if (k && k.phep) s += +k.huong || 0; });
      }
      theoThang.push(s); daNghi += s;
    }
    var duoc = (nv.phepNam == null || nv.phepNam === '' ? +db.caiDat.phepNam : +nv.phepNam) || 0;
    var ton = +nv.phepTon || 0;
    return { duoc: duoc, ton: ton, daNghi: daNghi, conLai: duoc + ton - daNghi, theoThang: theoThang };
  }

  /* ================= Đọc số tiền bằng chữ ================= */

  var CHU_SO = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  function docBaSo(n, day) {
    var tram = Math.floor(n / 100), chuc = Math.floor((n % 100) / 10), dv = n % 10, s = [];
    if (day || tram > 0) { s.push(CHU_SO[tram] + ' trăm'); }
    if (chuc > 1) { s.push(CHU_SO[chuc] + ' mươi'); }
    else if (chuc === 1) s.push('mười');
    else if ((day || tram > 0) && dv > 0) s.push('linh');
    if (dv > 0) {
      if (dv === 1 && chuc > 1) s.push('mốt');
      else if (dv === 5 && chuc > 0) s.push('lăm');
      else if (dv === 4 && chuc > 1) s.push('tư');
      else s.push(CHU_SO[dv]);
    }
    return s.join(' ');
  }
  function docSo(so) {
    so = Math.round(+so || 0);
    if (so === 0) return 'Không đồng';
    var am = so < 0; so = Math.abs(so);
    var donVi = ['', ' nghìn', ' triệu', ' tỷ', ' nghìn tỷ', ' triệu tỷ'];
    var nhom = [];
    while (so > 0) { nhom.push(so % 1000); so = Math.floor(so / 1000); }
    var s = [];
    for (var i = nhom.length - 1; i >= 0; i--) {
      if (nhom[i] === 0) continue;
      var day = i < nhom.length - 1;
      s.push(docBaSo(nhom[i], day) + donVi[i]);
    }
    var kq = s.join(' ').replace(/\s+/g, ' ').trim();
    kq = kq.charAt(0).toUpperCase() + kq.slice(1) + ' đồng';
    return (am ? 'Âm ' + kq.charAt(0).toLowerCase() + kq.slice(1) : kq);
  }

  return {
    NHOM_KY_HIEU: NHOM_KY_HIEU, TEN_THU: TEN_THU, TEN_THU_DAY: TEN_THU_DAY,
    kyHieuMacDinh: kyHieuMacDinh, phuCapMacDinh: phuCapMacDinh, caiDatMacDinh: caiDatMacDinh, loaiLDMacDinh: loaiLDMacDinh, sanPhamMacDinh: sanPhamMacDinh,
    loaiLDNV: loaiLDNV,
    duLieuMoi: duLieuMoi, chuanHoa: chuanHoa,
    pad: pad, khoaKy: khoaKy, iso: iso, soNgay: soNgay, thuTrongTuan: thuTrongTuan, docNgay: docNgay, hienNgay: hienNgay,
    phut: phut, hhmm: hhmm, congNgay: congNgay,
    taoNgayLe: taoNgayLe, bangNgayLe: bangNgayLe, bangLoaiLe: bangLoaiLe, loaiNgayLe: loaiNgayLe, heSoCongNgay: heSoCongNgay, heSoLeNgay: heSoLeNgay, heSoLeMacDinh: heSoLeMacDinh, bangHeSoLe: bangHeSoLe, loaiNgay: loaiNgay, congChuan: congChuan, nghiTuanNV: nghiTuanNV,
    ngayDauKy: ngayDauKy, ngayKy: ngayKy, batDauKy: batDauKy, ketThucKy: ketThucKy, kyCuaNgay: kyCuaNgay, oNgay: oNgay,
    thang: thang, nvTrongKy: nvTrongKy, nvLamNgay: nvLamNgay, dsNhanVienKy: dsNhanVienKy, tenPhongBan: tenPhongBan,
    bangKyHieu: bangKyHieu, tongHopCong: tongHopCong,
    thueLuyTien: thueLuyTien, tinhLuongNV: tinhLuongNV, tinhBangLuong: tinhBangLuong, congTong: cong,
    chotThang: chotThang, moKhoaThang: moKhoaThang,
    tinhVaoRa: tinhVaoRa, docKhoangOT: docKhoangOT, gioOT: gioOT, heSoOTDem: heSoOTDem, cauHinhDem: cauHinhDem, phepNam: phepNam, docSo: docSo,
    KIEU_BL: KIEU_BL, AP_DUNG_BL: AP_DUNG_BL, chuanBangLuong: chuanBangLuong, timBangLuong: timBangLuong, timNgach: timNgach, mucCoSoBL: mucCoSoBL,
    thuViecNV: thuViecNV, denNgayThuViec: denNgayThuViec, denNgayHD: denNgayThuViec, dangThuViec: dangThuViec,
    giaiDoanHDMacDinh: giaiDoanHDMacDinh, dsGiaiDoan: dsGiaiDoan, timGiaiDoan: timGiaiDoan, soThangThuViec: soThangThuViec, soThangGiua: soThangGiua,
    hdTheoNgay: hdTheoNgay, giaiDoanCacHD: giaiDoanCacHD, giaiDoanCuaHD: giaiDoanCuaHD, hdTiepTheo: hdTiepTheo,
    soBacNgach: soBacNgach, giaTriBac: giaTriBac, QUY_CHE_LUONG: QUY_CHE_LUONG, thangLuongQuyChe: thangLuongQuyChe, apDungThangLuongQuyChe: apDungThangLuongQuyChe, goiYXepQuyChe: goiYXepQuyChe, xepLuongNV: xepLuongNV, apXepLuong: apXepLuong, themThangISO: themThangISO,
    dsDotLuong: dsDotLuong, kyHienHanh: kyHienHanh, kyCuaISO: kyCuaISO, dotTaiKy: dotTaiKy, luongCoSoKy: luongCoSoKy, mucChungPC: mucChungPC,
    bacNgach: bacNgach, chupMucKy: chupMucKy, xepLuongTheoKy: xepLuongTheoKy, cauHinhTamUng: cauHinhTamUng, tamUngTheoChucVu: tamUngTheoChucVu,
    tamUngKy1: tamUngKy1, chuanCV: chuanCV, mienThueAnCaKy: mienThueAnCaKy, KHOI_VP: KHOI_VP, khoiCuaDV: khoiCuaDV, dsKhoi: dsKhoi, thongTinKhoi: thongTinKhoi,
    LOAI_QD: LOAI_QD, luongTheoKy: luongTheoKy, LOAI_DV: LOAI_DV, loaiDonVi: loaiDonVi, donViTheoKy: donViTheoKy, soNPTKy: soNPTKy, thuongPhatQD: thuongPhatQD,
    ngayLamTrongKhoang: ngayLamTrongKhoang, apDungDonNghi: apDungDonNghi, boDonNghi: boDonNghi, ngayNghiHuu: ngayNghiHuu, thamNien: thamNien
  };
});
