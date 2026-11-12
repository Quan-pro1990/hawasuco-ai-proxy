/* Trợ lý ảo: hướng dẫn sử dụng và tìm kiếm thông tin trong phần mềm.
   Chạy hoàn toàn trên máy, không gửi dữ liệu ra ngoài: hiểu câu hỏi tiếng Việt có dấu hoặc không dấu,
   trả lời từ dữ liệu đang mở (theo quyền tài khoản) và từ hướng dẫn sử dụng (HUONG_DAN.md đóng gói kèm khi build).
   Mở bằng nút tròn góc phải dưới hoặc Ctrl + K. */
(function () {
  'use strict';
  var App = window.App, TL = window.TL, h = App.h;

  /* ================= Chuẩn hoá, tách từ ================= */
  function cn(s) { return App.boDau(String(s == null ? '' : s)).toLowerCase().replace(/[^a-z0-9\/+%]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function co(q, cum) { return (' ' + q + ' ').indexOf(' ' + cum + ' ') >= 0; }
  var DUNG = {};
  ('la cua cho the nao gi toi minh em anh chi muon lam nhu co khong duoc bao nhieu o dau trong va voi cac nhung mot hay xin giup can de ve ' +
    'thi ma khi nay do phan mem a nhe vay oi hoi biet cach xem tim kiem hien tai duoc khong roi chua ban oi cho minh').split(' ').forEach(function (w) { DUNG[w] = 1; });
  function boHoi(q) {
    // "sao không…" (tại sao) – khác "sao lưu"
    q = q.replace(/(^| )(lam|tai|vi) sao( |$)/g, ' ').replace(/^sao (?=(khong|ko|chua|lai|toi|minh|em|phan mem|bi|cu) )/, '').trim();
    // "hướng dẫn (cách) nâng bậc lương" -> "nâng bậc lương"
    var m = /^huong dan (su dung |cach |ve )?(.*)$/.exec(q);
    if (m && !/^su dung( phan mem)?$/.test(m[2]) && m[2].split(' ').length >= 2) q = m[2];
    return q;
  }
  function tuKhoa(q) { return boHoi(q).split(' ').filter(function (w) { return w && !DUNG[w]; }); }
  function laHoiCach(q) { return /(^| )(cach|lam sao|lam the nao|nhu the nao|the nao|huong dan|o dau|bang cach|cac buoc|quy trinh|tai sao|vi sao|y nghia)( |$)/.test(q); }

  /* ================= Hướng dẫn sử dụng (chia đoạn để tìm) ================= */
  var KHO = null;
  function khoHuongDan() {
    if (KHO) return KHO;
    var md = window.HUONG_DAN_MD || '', muc = '', tieuDe = '', bo = false, ds = [], cur = null;
    var dem = 0;
    function day() { if (cur && cur.md.trim() && !bo) { cur.thuTu = dem++; ds.push(cur); } cur = null; }
    md.split('\n').forEach(function (l) {
      var m = /^(#{1,3})\s+(.*)$/.exec(l);
      if (m) {
        day();
        dem = 0;
        if (m[1].length === 1) { muc = tieuDe = 'Giới thiệu'; return; }
        if (m[1].length === 2) { muc = m[2]; bo = /người sửa phần mềm/i.test(m[2]); }
        tieuDe = m[2]; return;
      }
      if (!l.trim()) { day(); return; }
      var dau = /^([-*]|\d+\.)\s/.exec(l), bang = /^\|/.test(l);
      if (dau) { day(); cur = { muc: muc, tieuDe: tieuDe, md: l, loai: 'ds' }; return; }
      if (bang) { if (!cur || cur.loai !== 'bang') { day(); cur = { muc: muc, tieuDe: tieuDe, md: '', loai: 'bang' }; } cur.md += (cur.md ? '\n' : '') + l; return; }
      if (!cur) cur = { muc: muc, tieuDe: tieuDe, md: '', loai: 'doan' };
      cur.md += (cur.md ? '\n' : '') + l;
    });
    day();
    var df = {};
    ds.forEach(function (c, i) {
      c.i = i;
      c.chu = ' ' + cn(c.md.replace(/[*`>#|]/g, ' ')) + ' ';
      c.tdChu = ' ' + cn(c.tieuDe) + ' ';
      c.tdSo = Math.max(1, c.tdChu.trim().split(' ').length);
      var u = {};
      (c.tdChu + c.chu).split(' ').forEach(function (w) { if (w) u[w] = 1; });
      c.u = u;
      Object.keys(u).forEach(function (w) { df[w] = (df[w] || 0) + 1; });
    });
    KHO = { ds: ds, df: df, n: ds.length };
    return KHO;
  }
  function timHuongDan(q, soKQ) {
    var kho = khoHuongDan(); if (!kho.n) return [];
    var tk = tuKhoa(q), ds = boHoi(q).split(' '), cap = [], hoiCach = laHoiCach(q);
    for (var i = 0; i + 1 < ds.length; i++) if (!DUNG[ds[i]] || !DUNG[ds[i + 1]]) cap.push(ds[i] + ' ' + ds[i + 1]);
    if (!tk.length) return [];
    var kq = kho.ds.map(function (c) {
      var d = 0, trung = 0, capChu = 0, capTD = 0, heTD = 1 + 2 / Math.sqrt(c.tdSo);   // tiêu đề ngắn, khớp đúng thì nặng hơn
      tk.forEach(function (w) {
        if (!c.u[w]) return;
        var idf = Math.log(1 + kho.n / kho.df[w]);
        d += idf * (c.tdChu.indexOf(' ' + w + ' ') >= 0 ? heTD : 1); trung++;
      });
      cap.forEach(function (p) { if (c.chu.indexOf(' ' + p + ' ') >= 0) { d += 3; capChu++; } if (c.tdChu.indexOf(' ' + p + ' ') >= 0) { d += 9 / Math.sqrt(c.tdSo); capTD++; } });
      if (c.muc === 'Giới thiệu') d *= 0.8;
      if (c.muc === 'Câu hỏi thường gặp' && !/(khong|chua|loi|bi|quen|khac|sai|sao)( |$)/.test(q)) d *= 0.6;   // câu hỏi sự cố
      if (/^(Trợ lý ảo|Hướng dẫn sử dụng từng phần)/.test(c.muc) && !/(tro ly|huong dan su dung|tung phan|giong noi|micro)/.test(q)) d *= 0.45;   // mục nói về trợ giúp, có câu hỏi ví dụ
      if (c.thuTu === 0) d *= 1.15;   // đoạn mở đầu của mục thường là cách làm chính
      return { c: c, d: trung ? d * (0.5 + trung / tk.length) : 0, quaTD: capTD > 0 && (!capChu || hoiCach) };
    }).filter(function (x) { return x.d > 2.5; }).sort(function (a, b) { return b.d - a.d; });
    return kq.slice(0, soKQ || 3);
  }
  /** Markdown đơn giản -> HTML (đậm, nghiêng, mã, danh sách, bảng) */
  function dong(s) {
    return h(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>').replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  }
  function mdHtml(md) {
    var ls = md.split('\n'), out = '', trongDS = false;
    if (/^\|/.test(ls[0])) {
      var hang = ls.filter(function (l) { return !/^\|[\s:|-]+\|$/.test(l); }).map(function (l) { return l.replace(/^\||\|$/g, '').split('|').map(function (x) { return x.trim(); }); });
      return '<table class="bang tl-bang">' + hang.map(function (r, i) { return '<tr>' + r.map(function (x) { return i ? '<td>' + dong(x) + '</td>' : '<th>' + dong(x) + '</th>'; }).join('') + '</tr>'; }).join('') + '</table>';
    }
    ls.forEach(function (l) {
      var m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(l);
      if (m) { if (!trongDS) { out += '<ul>'; trongDS = true; } out += '<li' + (m[1].length >= 2 ? ' style="margin-left:14px"' : '') + '>' + dong(m[3]) + '</li>'; return; }
      if (trongDS && /^\s+\S/.test(l)) { out = out.replace(/<\/li>$/, ' ' + dong(l.trim()) + '</li>'); return; }
      if (trongDS) { out += '</ul>'; trongDS = false; }
      out += '<p>' + dong(l.replace(/^>\s?/, '')) + '</p>';
    });
    return out + (trongDS ? '</ul>' : '');
  }
  // mục hướng dẫn -> trang mở được
  var MUC_TRANG = [
    ['khong them duoc tai khoan', { cd: 'dl', ten: 'Cài đặt → Dữ liệu & tài khoản' }], ['quen mat khau', { cd: 'dl', ten: 'Cài đặt → Dữ liệu & tài khoản' }],
    ['khong sua duoc', { trang: 'bangluong', ten: 'Bảng lương' }], ['khac tinh tay', { trang: 'bangluong', ten: 'Bảng lương' }],
    ['thu viec', { trang: 'nhanvien', ten: 'Hồ sơ nhân viên' }], ['giai doan ky hop dong', { dm: 'hd', ten: 'Danh mục → Giai đoạn hợp đồng' }],
    ['theo doi hop dong', { trang: 'theodoihd', ten: 'Theo dõi hợp đồng' }], ['hop dong lao dong', { trang: 'hopdong', ten: 'Hợp đồng lao động' }],
    ['muc luong theo ky', { trang: 'mucluong', ten: 'Mức lương theo kỳ' }], ['xep luong', { trang: 'nangbac', ten: 'Xếp lương, nâng bậc' }],
    ['ho so nhan vien', { trang: 'nhanvien', ten: 'Hồ sơ nhân viên' }], ['quyet dinh', { trang: 'quyetdinh', ten: 'Quyết định' }],
    ['phong doi', { dm: 'pb', ten: 'Danh mục → Phòng, đội' }], ['don nghi phep', { trang: 'nghiphep', ten: 'Đơn nghỉ phép' }],
    ['bao cao nhan su', { trang: 'bcnhansu', ten: 'Báo cáo nhân sự' }], ['bang cham cong', { trang: 'chamcong', ten: 'Bảng chấm công' }],
    ['gio vao', { trang: 'vaora', ten: 'Giờ vào / ra' }], ['phieu luong', { trang: 'phieuluong', ten: 'Phiếu lương' }],
    ['bang luong', { trang: 'bangluong', ten: 'Bảng lương' }], ['dung chung tren may chu', { cd: 'dl', ten: 'Cài đặt → Dữ liệu & tài khoản' }],
    ['tham so phap ly', { cd: 'bh', ten: 'Cài đặt → Bảo hiểm' }], ['thiet lap ban dau', { cd: 'cty', ten: 'Cài đặt' }], ['huong dan su dung tung phan', { trang: 'huongdan', ten: 'Hướng dẫn sử dụng' }], ['quan ly nhan su', { trang: 'nhanvien', ten: 'Hồ sơ nhân viên' }]
  ];
  function trangCuaMuc(td) { var t = cn(td); for (var i = 0; i < MUC_TRANG.length; i++) if (t.indexOf(MUC_TRANG[i][0]) >= 0) return MUC_TRANG[i][1]; return null; }

  /* ================= Nơi thiết lập (trả lời "sửa ... ở đâu") ================= */
  var NOI = [
    { ten: 'Cài đặt → Đơn vị & chữ ký', tu: 'ten don vi cong ty nguoi ky chu ky tieu de bang luong dia danh thong tu logo', cd: 'cty' },
    { ten: 'Cài đặt → Kỳ công & giờ làm', tu: 'ky cong ngay dau ky ngay nghi hang tuan thu bay gio vao gio ra nghi trua di muon ve som phep nam mac dinh', cd: 'cong' },
    { ten: 'Cài đặt → Lương & làm thêm', tu: 'lam them gio ot he so ngung viec thu viec ty le luong thu viec lam tron phat di muon tra rieng luong san pham', cd: 'luong' },
    { ten: 'Cài đặt → Bảo hiểm & công đoàn', tu: 'ty le dong bao hiem bhxh bhyt bhtn kpcd doan phi cong doan luong toi thieu vung tran dong nghi khong luong', cd: 'bh' },
    { ten: 'Cài đặt → Thuế TNCN', tu: 'thue tncn giam tru gia canh ban than nguoi phu thuoc bieu thue luy tien khau tru 10%', cd: 'thue' },
    { ten: 'Cài đặt → Sao lưu, tài khoản', tu: 'sao luu khoi phuc du lieu tai khoan phan quyen mat khau nhat ky xoa du lieu mau', cd: 'dl' },
    { ten: 'Danh mục → Phòng, đội', tu: 'phong doi don vi bo phan khoi bang luong ngan hang chi luong', dm: 'pb' },
    { ten: 'Danh mục → Loại lao động & công chuẩn', tu: 'loai lao dong cong chuan 22 cong 26 cong van phong cong nhan', dm: 'ld' },
    { ten: 'Danh mục → Giai đoạn hợp đồng', tu: 'giai doan hop dong thoi han hop dong 1 nam 3 nam so thang thu viec', dm: 'hd' },
    { ten: 'Danh mục → Thang, bảng lương', tu: 'thang bang luong bac luong ngach chuc danh he so so bac', dm: 'bl' },
    { ten: 'Danh mục → Sản phẩm (lương SP)', tu: 'san pham don gia luong san pham hoa don ghi thu dong ho', dm: 'sp' },
    { ten: 'Danh mục → Phụ cấp', tu: 'phu cap tien com an ca trach nhiem muc chung', dm: 'pc' },
    { ten: 'Danh mục → Ký hiệu chấm công', tu: 'ky hieu cham cong', dm: 'kh' },
    { ten: 'Danh mục → Ngày lễ, Tết', tu: 'ngay le tet nghi le am lich', dm: 'le' },
    { ten: 'Mức lương theo kỳ', tu: 'muc luong theo ky luong co so tien com tam ung ky i ap dung tu thang dot luong tang luong', trang: 'mucluong' }
  ];
  var TRANG_TU = {
    dashboard: 'tong quan trang chu', tongquandoi: 'tong quan don vi tong quan doi man hinh doi', nhanvien: 'ho so nhan vien danh sach nhan vien',
    hopdong: 'hop dong lao dong danh sach hop dong', theodoihd: 'theo doi hop dong ky lai hop dong', quyetdinh: 'quyet dinh',
    nangbac: 'xep luong nang bac nang luong', nghiphep: 'don nghi phep nghi phep', bcnhansu: 'bao cao nhan su', chamcong: 'bang cham cong cham cong',
    vaora: 'gio vao ra may cham cong', bangluong: 'bang luong tinh luong', phieuluong: 'phieu luong', baocao: 'bao cao luong',
    mucluong: 'muc luong theo ky', danhmuc: 'danh muc', caidat: 'cai dat du lieu', huongdan: 'huong dan su dung tai lieu huong dan'
  };

  /* ================= Tiện ích trả lời ================= */
  function nut(nhan, hd) { return '<button class="nut nho" data-tl="' + h(hd) + '">' + h(nhan) + '</button>'; }
  function nutTrang(id, nhan) { return App.duocXem(id) ? nut(nhan || 'Mở ' + (App.MENU.filter(function (x) { return x.id === id; })[0] || { ten: id }).ten, 'trang:' + id) : ''; }
  function nutNoi(x) { return x.trang ? nutTrang(x.trang, 'Mở ' + x.ten) : x.dm ? (App.duocXem('danhmuc') ? nut('Mở ' + x.ten, 'dm:' + x.dm) : '') : x.cd ? (App.duocXem('caidat') ? nut('Mở ' + x.ten, 'cd:' + x.cd) : '') : ''; }
  function hoi(cau) { return '<button class="tl-chip" data-tl="hoi:' + h(cau) + '">' + h(cau) + '</button>'; }
  function lienKetNV(nv) { return App.duocXem('hoso') ? '<a href="#" data-tl="hs:' + h(nv.id) + '">' + h(nv.hoTen) + '</a>' : h(nv.hoTen); }
  function dsGon(arr, f, toiDa) {
    toiDa = toiDa || 12;
    return '<ul>' + arr.slice(0, toiDa).map(function (x) { return '<li>' + f(x) + '</li>'; }).join('') + '</ul>' + (arr.length > toiDa ? '<div class="mo nho">… và ' + (arr.length - toiDa) + ' người khác</div>' : '');
  }
  function nutHang(html) { return html ? '<div class="tl-nuts">' + html + '</div>' : ''; }
  function khongQuyen(p) { return 'Tài khoản của bạn không có quyền xem phần <b>' + { cc: 'Chấm công', ns: 'Nhân sự', lg: 'Tiền lương', tl: 'Thiết lập' }[p] + '</b>.'; }
  function hn() { return App.homNay(); }
  function soNgay(a, b) { return Math.round((new Date(b) - new Date(a)) / 864e5); }
  function nhanCon(con) { return con < 0 ? '<span class="the-tt do">quá hạn ' + (-con) + ' ngày</span>' : '<span class="the-tt' + (con <= 7 ? ' do' : con <= 30 ? ' cam' : '') + '">còn ' + con + ' ngày</span>'; }
  function dangLam() { return App.db.nhanVien.filter(function (nv) { return nv.trangThai !== 'nghi_viec'; }); }
  function tenKyHT() { return App.tenKy(App.ky.y, App.ky.m).toLowerCase(); }

  /* ================= Nhận ra người, đơn vị ================= */
  var GOI_NGUOI = /(^| )(cua|ho so|nhan vien|anh|chi|ong|ba|ban|em|co|chu|nv|cho|ve|tim|xem)$/;
  function timNguoi(q) {
    var kq = [], so = q.match(/\d{6,}/g) || [];
    App.db.nhanVien.forEach(function (nv) {
      var ten = cn(nv.hoTen).split(' '), d = 0;
      if (nv.ma && co(q, cn(nv.ma))) d = 100;
      for (var k = ten.length; k >= 1 && !d; k--) {
        var cum = ten.slice(ten.length - k).join(' '), vt = (' ' + q + ' ').indexOf(' ' + cum + ' ');
        if (vt < 0) continue;
        if (k >= 2) d = k * 10 + (k === ten.length ? 5 : 0);
        // chỉ có tên (1 tiếng): phải đứng sau từ gọi người ("của Quỳnh", "anh An") hoặc câu chỉ có tên – tránh nhầm "ăn ca", "năm", "thu nhập"
        else if (q === cum || GOI_NGUOI.test(q.slice(0, Math.max(0, vt - 1)).trim())) d = 8;
      }
      if (!d) so.forEach(function (s) { if ([nv.sdt, nv.cccd, nv.soTK].some(function (x) { return x && String(x).replace(/\D/g, '') === s; })) d = 90; });
      if (d) kq.push({ nv: nv, d: d });
    });
    if (!kq.length) return [];
    var max = Math.max.apply(null, kq.map(function (x) { return x.d; }));
    return kq.filter(function (x) { return x.d === max; }).map(function (x) { return x.nv; })
      .sort(function (a, b) { return (a.trangThai === 'nghi_viec') - (b.trangThai === 'nghi_viec'); });
  }
  var CHUNG_DV = { phong: 1, doi: 1, ban: 1, to: 1, xi: 1, nghiep: 1, cong: 1, ty: 1, so: 1, giam: 1, doc: 1 };
  function timDonVi(q) {
    var ds = App.dsDonVi ? App.dsDonVi() : App.db.phongBan, m = /(^| )(doi|phong|to|ban)( so)? (\d+)( |$)/.exec(q), tot = null, diemTot = 0;
    ds.forEach(function (p) {
      var t = cn(p.ten), d = 0;
      if (m && t.indexOf(m[2]) === 0 && new RegExp('(^| )' + m[4] + '$').test(t)) d = 50;
      else if (p.ma && p.ma.length >= 2 && co(q, cn(p.ma)) && /\d/.test(p.ma)) d = 40;
      else {
        var rieng = t.split(' ').filter(function (w) { return !CHUNG_DV[w]; }), lien = 0;
        for (var i = 0; i + 1 < rieng.length; i++) if (co(q, rieng[i] + ' ' + rieng[i + 1])) lien++;
        if (lien && (lien + 1 >= rieng.length || /(^| )(phong|doi|ban|to)( |$)/.test(q))) d = 10 + lien;
        if (co(q, t)) d = 45;
      }
      if (d > diemTot) { diemTot = d; tot = p; }
    });
    return tot;
  }

  /* ================= Các câu hỏi về dữ liệu ================= */
  var Y = [];
  function yDinh(ma, dk, quyen, chay) { Y.push({ ma: ma, dk: dk, quyen: quyen, chay: chay }); }

  yDinh('hd_het', function (q) { return /(het han|sap het|ky lai|can ky|gia han|ky tiep|qua han)/.test(q) && /(hop dong|hd|ky lai|ky tiep)/.test(q); }, 'ns', function (q, c) {
    if (!App.duLieuKyLai) return null;
    var nNgay = /(\d+) ngay/.exec(q), th = /thang (\d{1,2})( nam (\d{4}))?/.exec(q), quaHan = /(qua han|da het)/.test(q) && !/sap/.test(q);
    var N = nNgay ? +nNgay[1] : 30, d = hn();
    var ds = App.duLieuKyLai().filter(function (r) {
      if (!r.hd || r.con == null || r.hdSau || r.td.tt === 'khong') return false;
      if (c.dv && r.nv.phongBan !== c.dv.ma) return false;
      if (quaHan) return r.con < 0;
      if (th) { var y = th[3] ? +th[3] : (+th[1] < +d.slice(5, 7) ? +d.slice(0, 4) + 1 : +d.slice(0, 4)); return r.hd.denNgay.slice(0, 7) === y + '-' + TL.pad(+th[1]); }
      return r.con <= N;
    }).sort(function (a, b) { return a.con - b.con; });
    var tieu = quaHan ? 'đã hết hạn, chưa ký lại' : th ? 'hết hạn trong tháng ' + th[1] : 'hết hạn trong ' + N + ' ngày tới (gồm cả HĐ đã quá hạn chưa ký lại)';
    if (!ds.length) return 'Không có hợp đồng nào ' + tieu + (c.dv ? ' ở ' + h(c.dv.ten) : '') + '.' + nutHang(nutTrang('theodoihd', 'Mở Theo dõi hợp đồng'));
    return '<b>' + ds.length + ' hợp đồng</b> ' + tieu + (c.dv ? ' ở ' + h(c.dv.ten) : '') + ':' +
      dsGon(ds, function (r) { return lienKetNV(r.nv) + ' – ' + h(r.gd ? r.gd.ten : r.hd.loai) + ', hết hạn ' + TL.hienNgay(r.hd.denNgay) + ' ' + nhanCon(r.con) + (r.tiep.gd ? '<div class="mo nho">Ký tiếp: ' + h(r.tiep.gd.ten) + (r.tiep.tuNgay ? ' từ ' + TL.hienNgay(r.tiep.tuNgay) : '') + '</div>' : ''); }) +
      nutHang(nutTrang('theodoihd', 'Mở Theo dõi hợp đồng')) + '<div class="tl-goi">' + hoi('Hợp đồng hết hạn trong 90 ngày') + hoi('Hợp đồng đã quá hạn') + '</div>';
  });
  yDinh('chua_hd', function (q) { return /(chua co|thieu|chua ky|khong co) (hop dong|hd)/.test(q); }, 'ns', function (q, c) {
    var ds = dangLam().filter(function (nv) { return !(nv.hopDong || []).length && (!c.dv || nv.phongBan === c.dv.ma); });
    return ds.length ? '<b>' + ds.length + ' nhân viên</b> đang làm việc chưa có hợp đồng:' + dsGon(ds, function (nv) { return lienKetNV(nv) + ' – ' + h(TL.tenPhongBan(App.db, nv.phongBan)) + ', vào làm ' + TL.hienNgay(nv.ngayVao); }) + nutHang(nutTrang('theodoihd', 'Mở Theo dõi hợp đồng'))
      : 'Mọi nhân viên đang làm việc đều đã có hợp đồng.';
  });
  yDinh('thu_viec', function (q) { return /thu viec/.test(q) && !laHoiCach(q) && !/(luong|ty le|%)/.test(q); }, 'ns', function (q, c) {
    var d = hn(), ds = dangLam().map(function (nv) { return { nv: nv, tv: TL.thuViecNV(App.db, nv) }; })
      .filter(function (x) { return x.tv && x.tv.denNgay >= d && (!c.dv || x.nv.phongBan === c.dv.ma); }).sort(function (a, b) { return a.tv.denNgay < b.tv.denNgay ? -1 : 1; });
    if (!ds.length) return 'Hiện không có ai đang thử việc' + (c.dv ? ' ở ' + h(c.dv.ten) : '') + '.' + '<div class="tl-goi">' + hoi('Cách tính lương thử việc') + '</div>';
    return '<b>' + ds.length + ' người đang thử việc</b>:' + dsGon(ds, function (x) {
      return lienKetNV(x.nv) + ' – ' + h(x.nv.chucVu || '') + ', ' + TL.hienNgay(x.tv.tuNgay) + ' – ' + TL.hienNgay(x.tv.denNgay) + ' ' + nhanCon(soNgay(d, x.tv.denNgay)) + ', hưởng ' + App.so(x.tv.tiLe) + '% lương';
    }) + '<div class="tl-goi">' + hoi('Cách tính lương thử việc') + '</div>';
  });
  yDinh('nghi_nay', function (q) { return /(nghi hom nay|hom nay ai nghi|ai nghi|vang mat|ai vang|nghi ngay hom nay)/.test(q); }, 'cc', function (q, c) {
    var d = TL.docNgay(hn()), kh = TL.bangKyHieu(App.db), ds = [];
    TL.dsNhanVienKy(App.db, App.ky.y, App.ky.m).forEach(function (nv) {
      if (c.dv && nv.phongBan !== c.dv.ma) return;
      var v = TL.oNgay(App.db, 'cc', nv.id, d.y, d.m, d.d), k = v ? kh[String(v).toUpperCase()] : null;
      if (k && !(+k.lam > 0)) ds.push({ nv: nv, v: v, k: k });
    });
    if (!ds.length) return 'Theo bảng chấm công, hôm nay (' + TL.hienNgay(hn()) + ') ' + (c.dv ? h(c.dv.ten) + ' ' : '') + 'chưa có ai nghỉ.' + nutHang(nutTrang('chamcong', 'Mở Bảng chấm công'));
    return '<b>' + ds.length + ' người nghỉ hôm nay</b> (' + TL.hienNgay(hn()) + '):' + dsGon(ds, function (x) { return lienKetNV(x.nv) + ' – ' + h(TL.tenPhongBan(App.db, x.nv.phongBan)) + ': <b>' + h(x.v) + '</b> ' + h(x.k.ten || ''); }) + nutHang(nutTrang('chamcong', 'Mở Bảng chấm công'));
  });
  yDinh('don_cho', function (q) { return /(don nghi|don xin nghi|cho duyet)/.test(q) && !laHoiCach(q); }, 'ns', function (q, c) {
    var ds = (App.db.donNghi || []).filter(function (x) { var nv = App.timNV(x.nvId); return x.trangThai === 'cho' && nv && (!c.dv || nv.phongBan === c.dv.ma); });
    if (!ds.length) return 'Không có đơn nghỉ nào đang chờ duyệt.' + nutHang(nutTrang('nghiphep', 'Mở Đơn nghỉ phép'));
    return '<b>' + ds.length + ' đơn nghỉ chờ duyệt</b>:' + dsGon(ds, function (x) { var nv = App.timNV(x.nvId); return lienKetNV(nv) + ' – ' + h(x.kyHieu || '') + ' ' + TL.hienNgay(x.tuNgay) + (x.denNgay && x.denNgay !== x.tuNgay ? ' – ' + TL.hienNgay(x.denNgay) : '') + (x.lyDo ? '<div class="mo nho">' + h(x.lyDo) + '</div>' : ''); }) + nutHang(nutTrang('nghiphep', 'Mở Đơn nghỉ phép để duyệt'));
  });
  yDinh('cc_trong', function (q) { return /(chua cham|o trong|con trong|thieu cham|chua du cong|thieu cong)/.test(q); }, 'cc', function (q, c) {
    var db = App.db, y = App.ky.y, m = App.ky.m, d = hn(), le = TL.bangNgayLe(db), ngayK = TL.ngayKy(db, y, m), ds = [];
    TL.dsNhanVienKy(db, y, m).forEach(function (nv) {
      if (nv.hinhThuc === 'gio' || (c.dv && TL.donViTheoKy(db, nv, y, m).phongBan !== c.dv.ma)) return;
      var n = 0;
      ngayK.forEach(function (x) { if (x.iso <= d && TL.nvLamNgay(nv, x.y, x.m, x.d) && TL.loaiNgay(db, x.y, x.m, x.d, le, nv) !== 'nghi' && !TL.oNgay(db, 'cc', nv.id, x.y, x.m, x.d)) n++; });
      if (n) ds.push({ nv: nv, n: n });
    });
    if (!ds.length) return 'Bảng chấm công ' + tenKyHT() + (c.dv ? ' của ' + h(c.dv.ten) : '') + ' đã chấm đủ đến hôm nay.';
    var tong = ds.reduce(function (s, x) { return s + x.n; }, 0);
    return 'Bảng chấm công ' + tenKyHT() + ' còn <b>' + tong + ' ô trống</b> (tính đến hôm nay) của <b>' + ds.length + ' người</b>:' +
      dsGon(ds.sort(function (a, b) { return b.n - a.n; }), function (x) { return h(x.nv.hoTen) + ' – ' + h(TL.tenPhongBan(App.db, x.nv.phongBan)) + ': ' + x.n + ' ô'; }) +
      nutHang(c.dv && App.moChamCong ? nut('Chấm công ' + c.dv.ten, 'cc:' + c.dv.ma) : nutTrang('chamcong', 'Mở Bảng chấm công'));
  });
  yDinh('sinh_nhat', function (q) { return /sinh nhat/.test(q); }, 'ns', function (q) {
    var th = /thang (\d{1,2})/.exec(q), m = th ? +th[1] : +hn().slice(5, 7);
    var ds = dangLam().filter(function (nv) { return nv.ngaySinh && +nv.ngaySinh.slice(5, 7) === m; }).sort(function (a, b) { return a.ngaySinh.slice(8) < b.ngaySinh.slice(8) ? -1 : 1; });
    return ds.length ? '<b>' + ds.length + ' người</b> sinh nhật tháng ' + m + ':' + dsGon(ds, function (nv) { return lienKetNV(nv) + ' – ngày ' + nv.ngaySinh.slice(8, 10) + '/' + TL.pad(m) + ' (' + h(TL.tenPhongBan(App.db, nv.phongBan)) + ')'; }, 20)
      : 'Tháng ' + m + ' không có ai sinh nhật.';
  });
  yDinh('nghi_huu', function (q) { return /(nghi huu|ve huu|tuoi huu)/.test(q) && !laHoiCach(q); }, 'ns', function () {
    var d = hn(), ds = dangLam().map(function (nv) { return { nv: nv, nh: TL.ngayNghiHuu(nv.gioiTinh, nv.ngaySinh) }; })
      .filter(function (x) { return x.nh && soNgay(d, x.nh) <= 730; }).sort(function (a, b) { return a.nh < b.nh ? -1 : 1; });
    return ds.length ? '<b>' + ds.length + ' người</b> đến tuổi nghỉ hưu trong 24 tháng tới (lộ trình NĐ 135/2020):' + dsGon(ds, function (x) { return lienKetNV(x.nv) + ' – ' + TL.hienNgay(x.nh); }) + nutHang(nutTrang('bcnhansu', 'Mở Báo cáo nhân sự'))
      : 'Không có ai đến tuổi nghỉ hưu trong 24 tháng tới.';
  });
  yDinh('quan_so', function (q) { return /(bao nhieu (nhan vien|nguoi|lao dong)|so (nhan vien|nguoi|lao dong)|quan so|tong so (nhan vien|lao dong)|co may nguoi)/.test(q); }, '', function (q, c) {
    var ds = dangLam();
    if (c.dv) {
      var cua = ds.filter(function (nv) { return nv.phongBan === c.dv.ma; });
      return h(c.dv.ten) + ' có <b>' + cua.length + ' người</b> đang làm việc' + (cua.filter(function (nv) { return nv.trangThai === 'thu_viec'; }).length ? ' (gồm ' + cua.filter(function (nv) { return nv.trangThai === 'thu_viec'; }).length + ' người thử việc)' : '') + ':' +
        dsGon(cua, function (nv) { return lienKetNV(nv) + ' – ' + h(nv.chucVu || ''); }, 15) + nutHang(nut('Tổng quan ' + c.dv.ten, 'doi:' + c.dv.ma));
    }
    var theoDV = {};
    ds.forEach(function (nv) { theoDV[nv.phongBan] = (theoDV[nv.phongBan] || 0) + 1; });
    return 'Đang có <b>' + ds.length + ' người</b> làm việc' + (App.laCapDonVi && App.laCapDonVi() ? ' (trong phạm vi tài khoản)' : '') + ':' +
      '<ul>' + (App.dsDonVi ? App.dsDonVi() : App.db.phongBan).filter(function (p) { return theoDV[p.ma]; }).map(function (p) { return '<li>' + h(p.ten) + ': <b>' + theoDV[p.ma] + '</b></li>'; }).join('') + '</ul>';
  });
  yDinh('luong_cs', function (q) { return /luong co so/.test(q) && !/(cach|sua|doi|o dau)/.test(q); }, '', function () {
    var k = TL.kyHienHanh(App.db), l = TL.luongCoSoKy(App.db, k);
    return 'Lương cơ sở đang áp dụng (kỳ ' + k.slice(5) + '/' + k.slice(0, 4) + '): <b>' + App.tien(l) + ' đ/tháng</b>. Trần đóng BHXH, BHYT = 20 × lương cơ sở = ' + App.tien(20 * l) + ' đ.' +
      nutHang(nutTrang('mucluong', 'Mở Mức lương theo kỳ'));
  });
  yDinh('com', function (q) { return /(tien com|com trua|an ca|an trua|tien an|an giua ca)/.test(q) && !laHoiCach(q); }, '', function () {
    var k = TL.kyHienHanh(App.db), pc = (App.db.phuCap || []).filter(function (p) { return p.anCa; })[0];
    if (!pc) return 'Chưa có phụ cấp tiền cơm trong danh mục Phụ cấp.' + nutHang(nutNoi(NOI[11]));
    return h(pc.ten) + ' đang áp dụng: <b>' + App.tien(TL.mucChungPC(App.db, pc, k)) + ' đ/' + (pc.cachTinh === 'theo_ngay' ? 'ngày' : 'tháng') + '</b> (mức chung cho mọi người, ai khác mức thì nhập ở hồ sơ). ' +
      'Phần không tính thuế TNCN tối đa ' + App.tien(TL.mienThueAnCaKy(App.db, k)) + ' đ/tháng; phần vượt tính vào thu nhập chịu thuế.' + nutHang(nutTrang('mucluong', 'Mở Mức lương theo kỳ'));
  });
  yDinh('tam_ung', function (q, c) { return /tam ung/.test(q) && !laHoiCach(q) && !c.nv; }, 'lg', function () {
    var cfg = TL.cauHinhTamUng(App.db, TL.kyHienHanh(App.db));
    return 'Tạm ứng kỳ I (giữa tháng) theo chức vụ:' + '<ul>' + (cfg.theoChucVu || []).map(function (x) { return '<li>' + h(x.chucVu) + ': <b>' + App.tien(x.muc) + ' đ</b></li>'; }).join('') +
      '<li>Chức vụ khác: <b>' + App.tien(cfg.macDinh) + ' đ</b></li></ul><div class="mo nho">Kỳ II cuối tháng = phần lương còn lại. Ai có mức riêng thì nhập ở hồ sơ (Tạm ứng kỳ I riêng).</div>' + nutHang(nutTrang('mucluong', 'Mở Mức lương theo kỳ'));
  });
  yDinh('ngay_le', function (q) { return /(ngay le|nghi le|le tet|nghi tet|ngay tet|le sap toi)/.test(q) && !laHoiCach(q); }, '', function () {
    var d = hn(), ds = (App.db.ngayLe || []).filter(function (x) { return x.ngay >= d; }).sort(function (a, b) { return a.ngay < b.ngay ? -1 : 1; }).slice(0, 8);
    return ds.length ? 'Ngày nghỉ lễ, Tết sắp tới:' + '<ul>' + ds.map(function (x) { return '<li>' + TL.hienNgay(x.ngay) + ' (' + TL.TEN_THU_DAY[new Date(x.ngay).getDay()] + ') – ' + h(x.ten) + '</li>'; }).join('') + '</ul>' + nutHang(App.duocXem('danhmuc') ? nut('Mở Danh mục → Ngày lễ, Tết', 'dm:le') : '')
      : 'Chưa có ngày lễ sắp tới trong danh mục – vào Danh mục → Ngày lễ, Tết bấm “Tạo tự động” cho năm sau.' + nutHang(App.duocXem('danhmuc') ? nut('Mở Danh mục → Ngày lễ, Tết', 'dm:le') : '');
  });
  yDinh('ky_hieu', function (q) { return /ky hieu/.test(q); }, '', function (q, c, goc) {
    var ds = App.db.kyHieu || [], m = /ky hieu\s+["“']?([^\s"”']+)/i.exec(App.boDau(goc || '').toLowerCase());
    var mot = m ? ds.filter(function (k) { return cn(k.ma) === cn(m[1]) || k.ma.toLowerCase() === m[1]; })[0] : null;
    if (mot) return 'Ký hiệu <b>' + h(mot.ma) + '</b>: ' + h(mot.ten) + ' – tính ' + App.so(+mot.lam || 0) + ' công đi làm' + (+mot.huong ? ', ' + App.so(+mot.huong) + ' công nghỉ hưởng lương' : '') + '.';
    return 'Ký hiệu chấm công đang dùng:' + '<ul>' + ds.map(function (k) { return '<li><b>' + h(k.ma) + '</b> – ' + h(k.ten) + '</li>'; }).join('') + '</ul>' + nutHang(App.duocXem('danhmuc') ? nut('Mở Danh mục → Ký hiệu', 'dm:kh') : '');
  });
  yDinh('ky_cong', function (q) { return /(ky cong|ky luong|ky nay|ky hien tai)/.test(q) && !laHoiCach(q); }, '', function () {
    var k = TL.kyHienHanh(App.db), y = +k.slice(0, 4), m = +k.slice(5);
    return 'Kỳ công đang chạy: <b>tháng ' + m + '/' + y + '</b>, từ ' + TL.hienNgay(TL.batDauKy(App.db, y, m)) + ' đến ' + TL.hienNgay(TL.ketThucKy(App.db, y, m)) +
      ' (kỳ bắt đầu từ ngày ' + TL.ngayDauKy(App.db) + '). Đang xem: ' + tenKyHT() + '.';
  });
  yDinh('bh', function (q) { return /(bao hiem|bhxh|bhyt|bhtn)/.test(q) && /(ty le|muc dong|bao nhieu|phan tram|%|dong may)/.test(q) && !/(sua|o dau|cai dat|thay doi|chinh)/.test(q); }, '', function () {
    var b = App.db.caiDat.bh, lcs = TL.luongCoSoKy(App.db, TL.kyHienHanh(App.db));
    return 'Tỷ lệ đóng bảo hiểm trên lương đóng BH:<ul><li>Người lao động: BHXH ' + App.so(b.nv.bhxh) + '%, BHYT ' + App.so(b.nv.bhyt) + '%, BHTN ' + App.so(b.nv.bhtn) + '% (cộng ' + App.so(b.nv.bhxh + b.nv.bhyt + b.nv.bhtn) + '%)</li>' +
      '<li>Doanh nghiệp: BHXH ' + App.so(b.dn.bhxh) + '%, BHYT ' + App.so(b.dn.bhyt) + '%, BHTN ' + App.so(b.dn.bhtn) + '%, KPCĐ ' + App.so(b.dn.kpcd) + '%</li>' +
      '<li>Đoàn phí công đoàn: ' + App.so(b.doanPhi) + '% (đoàn viên)</li></ul><div class="mo nho">Trần BHXH, BHYT ' + App.tien(20 * lcs) + ' đ; trần BHTN ' + App.tien(20 * App.db.caiDat.luongToiThieuVung) + ' đ. Nghỉ không lương từ ' + App.db.caiDat.nguongNghiKhongDongBH + ' ngày trong tháng thì không đóng.</div>' +
      nutHang(App.duocXem('caidat') ? nut('Mở Cài đặt → Bảo hiểm', 'cd:bh') : '');
  });
  yDinh('thue', function (q) { return /(giam tru|bieu thue|thue tncn|thue thu nhap)/.test(q) && !laHoiCach(q); }, '', function () {
    var cd = App.db.caiDat, truoc = 0;
    return 'Giảm trừ gia cảnh: bản thân <b>' + App.tien(cd.giamTruBanThan) + ' đ</b>/tháng, mỗi người phụ thuộc <b>' + App.tien(cd.giamTruNPT) + ' đ</b>/tháng.<br>Biểu thuế lũy tiến (thu nhập tính thuế / tháng):<ul>' +
      cd.bieuThue.map(function (b) { var s = '<li>' + (b.den ? (truoc ? 'Trên ' + App.tien(truoc) + ' đến ' : 'Đến ') + App.tien(b.den) : 'Trên ' + App.tien(truoc)) + ' đ: ' + App.so(b.ts) + '%</li>'; truoc = b.den; return s; }).join('') + '</ul>' +
      nutHang(App.duocXem('caidat') ? nut('Mở Cài đặt → Thuế TNCN', 'cd:thue') : '');
  });
  yDinh('mat_khau', function (q) { return /mat khau/.test(q); }, '', function () {
    var mc = App.mayChu && App.mayChu.bat;
    if (!mc) return 'Bạn đang dùng phần mềm trên máy (1 file), không có đăng nhập, mật khẩu. Khi dùng chung trên máy chủ: đổi mật khẩu ở <b>thanh bên trái → Đổi mật khẩu</b>.';
    return 'Đổi mật khẩu: <b>thanh bên trái (dưới cùng) → Đổi mật khẩu</b>, hoặc Cài đặt & dữ liệu → Dữ liệu → <b>Đổi mật khẩu của tôi</b>. Quên mật khẩu: nhờ tài khoản quản trị đặt lại ở Cài đặt & dữ liệu → Dữ liệu → Tài khoản.' +
      nutHang(nut('Đổi mật khẩu ngay', 'mk'));
  });
  yDinh('quyen', function (q) { return /(quyen cua toi|tai khoan cua toi|toi duoc lam gi|quyen han|toi co quyen|duoc phep lam)/.test(q); }, '', function () {
    var M = ['Không', 'Xem', 'Sửa'], ten = { cc: 'Chấm công', ns: 'Nhân sự', lg: 'Tiền lương', tl: 'Thiết lập' };
    if (!(App.mayChu && App.mayChu.bat)) return 'Bạn đang dùng phần mềm trên máy (1 file), có toàn quyền. Phân quyền theo tài khoản chỉ có khi dùng chung trên máy chủ.';
    var t = App.mayChu.toi || {};
    return 'Tài khoản <b>' + h(t.ten || '') + '</b>' + (t.vaiTro === 'quan_tri' ? ' (quản trị – toàn quyền)' : t.vaiTro === 'cham_cong' ? ' – cấp phòng / đội: ' + h((t.donVi || []).map(function (m) { return TL.tenPhongBan(App.db, m); }).join(', ')) : ' – cấp công ty') +
      '<ul>' + Object.keys(ten).map(function (k) { return '<li>' + ten[k] + ': <b>' + M[App.quyen(k)] + '</b></li>'; }).join('') + '</ul>';
  });

  /* ---------- câu hỏi về 1 người ---------- */
  function veNguoi(nv, q) {
    var db = App.db, y = App.ky.y, m = App.ky.m, d = hn();
    if (/(luong|thuc linh|thu nhap|phieu luong|tam ung|ky ii|ky 2|linh)/.test(q)) {
      if (App.quyen('lg') < 1) return khongQuyen('lg');
      var bl = TL.tinhBangLuong(db, y, m), r = bl.rows.filter(function (x) { return x.nvId === nv.id; })[0];
      if (!r) return h(nv.hoTen) + ' không có trong bảng lương ' + tenKyHT() + '.';
      return '<b>' + h(nv.hoTen) + '</b> – lương ' + tenKyHT() + (bl.khoa ? ' (đã chốt)' : '') + ':<ul>' +
        (r.luongSP ? '<li>Lương sản phẩm: ' + App.tien(r.luongSP) + '</li>' : '') +
        '<li>Lương thời gian (' + App.so(r.cong.congTG) + ' công' + (r.thuViec ? ', thử việc ' + App.so(r.thuViec.tiLe) + '%' : '') + '): ' + App.tien(r.luongTG) + '</li>' +
        (r.tongPhuCap ? '<li>Phụ cấp (cơm…): ' + App.tien(r.tongPhuCap) + '</li>' : '') + (r.tienOT ? '<li>Làm thêm giờ: ' + App.tien(r.tienOT) + (r.otRieng ? ' (chi bảng riêng)' : '') + '</li>' : '') +
        '<li><b>Tổng thu nhập: ' + App.tien(r.tongThuNhap) + '</b></li>' +
        '<li>Bảo hiểm: −' + App.tien(r.tongBH) + (r.doanPhi ? ', đoàn phí −' + App.tien(r.doanPhi) : '') + ', thuế TNCN −' + App.tien(r.thue) + '</li>' +
        '<li>Tạm ứng kỳ I: −' + App.tien(r.tamUng) + '</li><li><b>Thực lĩnh kỳ II: ' + App.tien(r.thucLinh) + ' đ</b></li></ul>' +
        nutHang((App.duocXem('phieuluong') ? nut('Xem phiếu lương', 'pl:' + nv.id) : '') + nutTrang('bangluong', 'Mở Bảng lương'));
    }
    if (/(cong|cham cong|nghi phep|phep|ngay nghi|di lam)/.test(q)) {
      if (App.quyen('cc') < 1) return khongQuyen('cc');
      var c = TL.tongHopCong(db, y, m, nv), pn = TL.phepNam(db, nv, +d.slice(0, 4));
      return '<b>' + h(nv.hoTen) + '</b> – chấm công ' + tenKyHT() + ':<ul><li>Công lương thời gian: <b>' + App.so(c.congTG) + '</b> / công chuẩn ' + App.so(c.congChuan) + '</li>' +
        (c.sp ? '<li>Công sản phẩm: ' + App.so(c.sp) + '</li>' : '') + '<li>Nghỉ phép: ' + App.so(c.phep) + ', nghỉ không lương: ' + App.so(c.khong + c.kp) + '</li>' +
        (c.otTong ? '<li>Làm thêm: ' + App.so(c.otTong) + ' giờ</li>' : '') + '<li>Ngày tính cơm: ' + App.so(c.ngayCom) + '</li>' +
        '<li>Phép năm ' + d.slice(0, 4) + ': được ' + App.so(pn.duoc + pn.ton) + ', đã nghỉ ' + App.so(pn.daNghi) + ', <b>còn ' + App.so(pn.conLai) + ' ngày</b></li></ul>' +
        nutHang(App.moChamCong && App.duocXem('chamcong') ? nut('Mở bảng chấm công ' + TL.tenPhongBan(db, nv.phongBan), 'cc:' + nv.phongBan) : '');
    }
    if (/(hop dong|hd|thu viec)/.test(q)) {
      if (App.quyen('ns') < 1) return khongQuyen('ns');
      var hd = App.hdHieuLuc(nv), tv = TL.thuViecNV(db, nv);
      if (!hd) return h(nv.hoTen) + ' chưa có hợp đồng.' + nutHang(nut('Mở hồ sơ – hợp đồng', 'hs:' + nv.id + ':hopdong'));
      var tiep = TL.hdTiepTheo(db, nv, hd);
      return '<b>' + h(nv.hoTen) + '</b>: ' + h(App.tenGiaiDoan(nv, hd)) + ' số ' + h(hd.so || '') + ', từ ' + TL.hienNgay(hd.tuNgay) + (hd.denNgay ? ' đến ' + TL.hienNgay(hd.denNgay) + ' ' + nhanCon(soNgay(d, hd.denNgay)) : ' (không thời hạn)') + '.' +
        (tv && tv.denNgay >= d ? '<br>Đang thử việc đến ' + TL.hienNgay(tv.denNgay) + ', hưởng ' + App.so(tv.tiLe) + '% lương.' : '') +
        (hd.denNgay && tiep.gd ? '<br>Ký tiếp: ' + h(tiep.gd.ten) + (tiep.tuNgay ? ' từ ' + TL.hienNgay(tiep.tuNgay) : '') + '.' : '') + (tiep.canhBao ? '<div class="mo nho">' + h(tiep.canhBao) + '</div>' : '') +
        nutHang(nut('Mở hồ sơ – hợp đồng', 'hs:' + nv.id + ':hopdong'));
    }
    // thẻ thông tin chung
    var tn = TL.thamNien(nv.ngayVao, d), hd2 = App.quyen('ns') >= 1 && App.hdHieuLuc ? App.hdHieuLuc(nv) : null, tt = nv.trangThai || 'dang_lam';
    return '<div class="tl-the"><div style="font-weight:700;font-size:15px">' + h(nv.hoTen) + ' <span class="the-tt ' + ({ dang_lam: 'xanh', thu_viec: 'cam', tam_nghi: 'lam', nghi_viec: '' }[tt]) + '">' + h(App.TRANG_THAI[tt]) + '</span></div>' +
      '<div class="mo">' + h(nv.ma) + ' · ' + h(nv.chucVu || '') + ' · ' + h(TL.tenPhongBan(db, nv.phongBan)) + '</div>' +
      '<div>Vào làm ' + TL.hienNgay(nv.ngayVao) + ' (thâm niên ' + tn.nam + ' năm ' + tn.thang + ' tháng)' + (nv.sdt && App.quyen('ns') >= 1 ? ' · ĐT ' + h(nv.sdt) : '') + '</div>' +
      (hd2 ? '<div>' + h(App.tenGiaiDoan(nv, hd2)) + (hd2.denNgay ? ', hết hạn ' + TL.hienNgay(hd2.denNgay) + ' ' + (soNgay(d, hd2.denNgay) <= 30 ? nhanCon(soNgay(d, hd2.denNgay)) : '') : '') + '</div>' : '') + '</div>' +
      nutHang((App.duocXem('hoso') ? nut('Mở hồ sơ', 'hs:' + nv.id) : '') + (App.duocXem('phieuluong') ? nut('Phiếu lương', 'pl:' + nv.id) : '')) +
      '<div class="tl-goi">' + hoi('Lương của ' + nv.hoTen) + hoi('Chấm công của ' + nv.hoTen) + hoi('Hợp đồng của ' + nv.hoTen) + '</div>';
  }
  function veDonVi(dv) {
    var ds = dangLam().filter(function (nv) { return nv.phongBan === dv.ma; });
    return '<b>' + h(dv.ten) + '</b>: ' + ds.length + ' người đang làm việc.' + dsGon(ds, function (nv) { return lienKetNV(nv) + ' – ' + h(nv.chucVu || ''); }, 10) +
      nutHang(nut('Tổng quan ' + dv.ten, 'doi:' + dv.ma) + (App.moChamCong && App.duocXem('chamcong') ? nut('Chấm công', 'cc:' + dv.ma) : '')) +
      '<div class="tl-goi">' + hoi('Ô chấm công còn trống ' + dv.ten) + hoi('Hợp đồng sắp hết hạn ' + dv.ten) + '</div>';
  }

  /* ================= Xử lý câu hỏi ================= */
  var CX = null;
  function cx(c) { CX = c; }
  // cảm xúc theo loại câu trả lời dữ liệu: [cử chỉ, ms, biểu tượng]
  var CX_YD = { hd_het: ['ngac', 1500, '📋'], chua_hd: ['ngac', 1500, '📄'], thu_viec: ['gat', 1200, '📝'], nghi_nay: ['gat', 1200, '🏖️'], don_cho: ['gat', 1200, '📨'],
    cc_trong: ['gat', 1200, '🗓️'], sinh_nhat: ['mua', 1800, '🎂'], nghi_huu: ['gat', 1200, '🌅'], quan_so: ['gat', 1200, '👥'], luong_cs: ['gat', 1200, '💰'], com: ['yeu', 1400, '🍚'],
    tam_ung: ['gat', 1200, '💵'], ngay_le: ['mung', 1600, '🎉'], ky_hieu: ['gat', 1200, '✏️'], ky_cong: ['gat', 1200, '📅'], bh: ['gat', 1200, '🛡️'], thue: ['gat', 1200, '🧾'],
    mat_khau: ['gat', 1200, '🔑', 'nhaymat'], quyen: ['gat', 1200, '🔐'] };
  /** Trò chuyện xã giao: hỏi tên, hỏi thăm, khen, chê, nhờ nhảy múa… */
  function troChuyen(q) {
    if (/(ban la ai|ban ten gi|ten ban la gi|ban la gi|em la ai|em ten gi)/.test(q)) { cx(['vay', 1500, '🤖']); return 'Tôi là <b>Trợ lý ảo Hawasuco</b> – robot hướng dẫn và tra cứu thông tin nhân sự, chấm công, tiền lương trong phần mềm này. Rất vui được làm việc cùng bạn!'; }
    if (/(ban khoe khong|em khoe khong|khoe khong)/.test(q)) { cx(['then', 1600, '😊']); return 'Tôi khỏe lắm, pin đầy 100% 🔋. Cảm ơn bạn đã hỏi thăm! Bạn cần tôi tra cứu gì không?'; }
    if (/^(nhay|mua|nhay di|mua di|nhay mua|dance)( (di|nao|cho xem|xem nao))?$/.test(q)) { cx(['mua', 2400, '🎵']); return 'Xem tôi nhảy nè! 💃🕺'; }
    if (/^(xoay|quay|xoay vong|quay vong|lon vong)( (di|nao|cho xem|xem nao))?$/.test(q)) { cx(['xoay', 950, '🌀']); return 'Xoay vòng vòng… ôi chóng mặt quá! 😵‍💫'; }
    if (/(ke chuyen cuoi|chuyen cuoi|noi gi vui)/.test(q)) { cx(['cuoi', 1600, '😆']); return 'Vì sao bảng chấm công lúc nào cũng vui? Vì ngày nào cũng có dấu “+”! 😄'; }
    if (/(toi buon|minh buon|met qua|cang thang|chan qua|ap luc)/.test(q)) { cx(['yeu', 1800, '🤗']); return 'Đừng buồn nha! Nghỉ tay uống ngụm nước, hít thở sâu rồi làm tiếp – có việc gì cần tra cứu cứ để tôi lo! 💪'; }
    if (/^(gioi|gioi qua|gioi lam|tuyet|tuyet voi|hay qua|xuat sac|tot lam|dang yeu|de thuong|cute)( qua| lam| ghe)?$/.test(q)) { cx(['then', 1800, '🥰']); return 'Cảm ơn bạn! Tôi sẽ cố gắng hơn nữa 🥰'; }
    if (/^(ngu qua|ngoc|do qua|te qua|vo dung|sai roi|sai bet|kem qua|chan)( qua| the)?$/.test(q)) { cx(['lac', 1200, '😥']); return 'Xin lỗi bạn 😥. Bạn thử hỏi cụ thể hơn (vd “hợp đồng của Nguyễn Văn An”, “cách nâng bậc lương”) hoặc chọn một gợi ý nhé.' + '<div class="tl-goi">' + GOI_Y.slice(0, 4).map(hoi).join('') + '</div>'; }
    return null;
  }
  function traLoi(goc) {
    CX = null;
    var q = cn(goc);
    if (!q) return chao();
    if (/^(xin chao|chao|hello|hi|alo)( |$)/.test(q)) { cx(['vay', 1500, '👋']); return chao(); }
    if (/^(cam on|thank)/.test(q)) { cx(['yeu', 1800, '💙']); return 'Rất vui được giúp bạn!'; }
    var xg = troChuyen(q); if (xg) return xg;
    // mở trang: "mở bảng lương", "vào chấm công"
    var mo = /^(mo|vao|di toi|di den|chuyen den|chuyen sang|toi|den) (trang |muc )?(.+)$/.exec(q);
    if (mo) {
      var dich = timTrang(mo[3]);
      if (dich) { dieuHuong('trang:' + dich.id); cx(['gat', 900, '👉']); return 'Đã mở trang <b>' + h(dich.ten) + '</b>.'; }
      var cam = timTrang(mo[3], true);
      if (cam) cx(['lac', 1200, '🔒']);
      if (cam) return 'Tài khoản của bạn không mở được trang <b>' + h(cam.ten) + '</b>. Cần thêm quyền thì liên hệ người quản trị phần mềm.';
    }
    // số hợp đồng / quyết định
    var so = /(\d{1,4}\/\d{4}\/[a-z0-9\-\/]+|\d{1,4}\/qd[a-z\-]*)/.exec(q);
    if (so) { var tim = timSoVanBan(so[1]); if (tim) { cx(['gat', 1200, '📄']); return tim; } }
    var nguoi = timNguoi(q), dv = nguoi.length ? null : timDonVi(q), ctx = { nv: nguoi.length === 1 ? nguoi[0] : null, dv: dv };
    var hoiCach = laHoiCach(q);
    // câu hỏi dữ liệu
    for (var i = 0; i < Y.length; i++) {
      var y = Y[i];
      if (!y.dk(q, ctx)) continue;
      if (y.quyen && App.quyen(y.quyen) < 1) { cx(['lac', 1200, '🔒']); return khongQuyen(y.quyen); }
      var kq = y.chay(q, ctx, goc);
      if (kq) {
        // tin tốt (không có gì phải lo) thì mừng; có việc quá hạn thì ngạc nhiên
        cx(/không có quyền/.test(kq) ? ['lac', 1200, '🔒'] : /quá hạn/.test(kq) ? ['ngac', 1600, '⚠️'] :
          /^(Không có|Hiện không có|Mọi nhân viên|Tháng \d+ không có)|đã chấm đủ/.test(kq) ? ['mung', 1500, '✅'] : CX_YD[y.ma] || ['gat', 1200]);
        return kq + (hoiCach ? lienQuan(q, 2) : '');
      }
    }
    // nói tới 1 người
    if (!hoiCach && nguoi.length === 1) {
      var tn = veNguoi(nguoi[0], q);
      cx(/không có quyền/.test(tn) ? ['lac', 1200, '🔒'] : /(luong|thuc linh|thu nhap|phieu luong)/.test(q) ? ['gat', 1200, '💰'] : /(cong|phep)/.test(q) ? ['gat', 1200, '🗓️'] : /hop dong/.test(q) ? ['gat', 1200, '📋'] : ['vay', 1300, '🙋']);
      return tn;
    }
    if (!hoiCach && nguoi.length > 1) cx(['gat', 1200, '👥']);
    if (!hoiCach && nguoi.length > 1) return 'Có <b>' + nguoi.length + ' người</b> khớp:' + dsGon(nguoi, function (nv) { return lienKetNV(nv) + ' – ' + h(nv.ma) + ', ' + h(TL.tenPhongBan(App.db, nv.phongBan)); });
    if (!hoiCach && dv && tuKhoa(q).length <= 5) { cx(['gat', 1200, '🏢']); return veDonVi(dv); }
    // gõ một họ tên (viết hoa chữ đầu) mà không có trong dữ liệu đang xem
    if (!nguoi.length && /^(\p{Lu}\p{Ll}*\s+){1,4}\p{Lu}\p{Ll}*$/u.test(String(goc).trim())) cx(['lac', 1200, '🤷']);
    if (!nguoi.length && /^(\p{Lu}\p{Ll}*\s+){1,4}\p{Lu}\p{Ll}*$/u.test(String(goc).trim()))
      return 'Không tìm thấy nhân viên <b>' + h(String(goc).trim()) + '</b>' + (App.laCapDonVi && App.laCapDonVi() ? ' trong phòng / đội của tài khoản' : '') + '. Thử gõ mã NV, số điện thoại hoặc một phần họ tên.';
    // hỏi đúng tên một phần hướng dẫn chung (quy trình hằng tháng, tài khoản & phân quyền, câu hỏi thường gặp…)
    var phan = phanHuongDan(q);
    if (phan) { cx(['gat', 1200, '📖']); return phan; }
    // hỏi cách làm / tìm trong hướng dẫn và nơi thiết lập
    var hd = timHuongDan(q, 3), noi = timNoi(q);
    if (hd.length || noi) cx(['gat', 1200, '📖']);
    if (hd.length || noi) return veHuongDan(hd, noi, !!noi && ((noi.diem >= 7 && !laHoiCach(q)) || noi.diem >= 10 || /(sua|o dau|cai dat|thiet lap|thay doi|chinh|them)( |$)/.test(q)));
    // tìm rộng: tên nhân viên gần đúng
    var gan = timGanDung(q);
    if (gan.length) cx(['ngac', 1200, '🤔']);
    if (gan.length) return 'Tôi chưa hiểu rõ câu hỏi. Có phải bạn tìm:' + dsGon(gan, function (nv) { return lienKetNV(nv) + ' – ' + h(nv.ma) + ', ' + h(TL.tenPhongBan(App.db, nv.phongBan)); }, 8);
    cx(['lac', 1200, '🤔']);
    return 'Tôi chưa tìm thấy thông tin phù hợp. Bạn thử hỏi ngắn gọn theo mẫu:' + '<div class="tl-goi">' + GOI_Y.slice(0, 6).map(hoi).join('') + '</div>';
  }
  function lienQuan(q, n) {
    var hd = timHuongDan(q, n);
    return hd.length ? '<div class="tl-lq">Hướng dẫn liên quan: ' + hd.map(function (x) { return '<a href="#" data-tl="hd:' + x.c.i + '">' + h(x.c.tieuDe) + '</a>'; }).join(' · ') + '</div>' : '';
  }
  /** Phần hướng dẫn chung (không gắn 1 trang) mà câu hỏi nêu đủ các từ của tên phần -> trả lời bằng nội dung phần đó */
  function phanHuongDan(q) {
    if (!App.HD) return null;
    var g = App.HD.tatCa().filter(function (x) {
      if (x.trang.length) return false;
      var tu = tuKhoa(cn(x.tieuDe));
      return tu.length >= 2 && tu.every(function (w) { return co(q, w); });
    })[0];
    if (!g) return null;
    var phan = App.HD.noiDung(g, { boTieuDe: true }).split('<h2>'), con = phan.length > 3;
    return '<div class="tl-muc">' + h(g.tieuDe) + '</div><div class="tl-hdp">' + phan.slice(0, 3).join('<h2>') + '</div>' +
      (con ? '<div class="mo nho">… còn ' + (phan.length - 3) + ' mục nữa.</div>' : '') + nutHang(nut('Mở hướng dẫn: ' + g.tieuDe, 'hdp:' + g.id));
  }
  /** Nút mở hướng dẫn từng bước (trang Hướng dẫn sử dụng) của phần tương ứng */
  function nutHDPhan(tr, c) {
    if (!App.HD) return '';
    var id = tr && (tr.trang || (tr.dm ? 'danhmuc' : tr.cd ? 'caidat' : '')), g = id ? App.HD.theoTrang(id)[0] : null;
    if (/may chu|phan quyen|tai khoan/.test(cn(c.muc + ' ' + c.tieuDe))) g = App.HD.lay('tai-khoan-phan-quyen') || g;
    if (/tro ly/.test(cn(c.muc))) g = App.HD.lay('tro-ly-ao') || g;
    return g ? nut('Hướng dẫn từng bước: ' + g.tieuDe, 'hdp:' + g.id) : '';
  }
  function veHuongDan(ds, noi, noiTruoc) {
    var s = '', khoiNoi = noi ? 'Thiết lập ở <b>' + h(noi.ten) + '</b>.' + nutHang(nutNoi(noi)) : '';
    if (noi && noiTruoc) { s = '<div>' + khoiNoi + '</div>'; noi = null; if (ds.length) s += '<div class="tl-lq" style="border:0;margin-top:4px;padding-top:0">Hướng dẫn:</div>'; }
    if (ds.length) {
      var c = ds[0].c, tr = trangCuaMuc(c.tieuDe) || trangCuaMuc(c.muc), doan = [c];
      if (ds[0].quaTD) doan = khoHuongDan().ds.filter(function (x) { return x.tieuDe === c.tieuDe && x.muc === c.muc; }).slice(0, 3);
      s += '<div class="tl-muc">' + h(c.tieuDe) + '</div>' + doan.map(function (x) { return mdHtml(x.md); }).join('') + nutHang((tr ? nutNoi(tr) : '') + nutHDPhan(tr, c));
      var khac = ds.slice(1).filter(function (x) { return doan.indexOf(x.c) < 0; });
      if (khac.length) s += '<div class="tl-lq">Xem thêm: ' + khac.map(function (x) { return '<a href="#" data-tl="hd:' + x.c.i + '">' + h(x.c.tieuDe) + ': ' + h(x.c.md.replace(/[*`#>|]/g, '').replace(/^\s*([-*]|\d+\.)\s*/, '').slice(0, 50)) + '…</a>'; }).join('<br>') + '</div>';
    }
    if (noi) s += (s ? '<div style="margin-top:8px">' : '<div>') + khoiNoi + '</div>';
    return s;
  }
  function timNoi(q) {
    var tk = tuKhoa(q); if (!tk.length) return null;
    var tot = null, diem = 0;
    NOI.forEach(function (x) {
      var t = ' ' + x.tu + ' ', d = 0, cap = 0;
      tk.forEach(function (w) { if (t.indexOf(' ' + w + ' ') >= 0) d++; });
      if (d < tk.length * 0.6) return;   // phải khớp phần lớn từ khoá
      for (var i = 0; i + 1 < tk.length; i++) if (t.indexOf(' ' + tk[i] + ' ' + tk[i + 1] + ' ') >= 0) cap++;
      d += cap * 2;
      if (d > diem) { diem = d; tot = x; }
    });
    // chỉ trả lời nơi thiết lập khi câu hỏi có ý sửa / đặt / ở đâu, hoặc khớp rõ
    if (!tot || !(diem >= 5 || (diem >= 3 && /(sua|doi|dat|cai dat|thiet lap|o dau|nhap|chinh|them)/.test(q)))) return null;
    tot.diem = diem; return tot;
  }
  function timTrang(t, caTrangCam) {
    var tot = null, diem = 0;
    App.MENU.forEach(function (x) {
      if (!x.id || (!caTrangCam && !App.duocXem(x.id))) return;
      var ten = cn(x.ten), tu = ' ' + ten + ' ' + (TRANG_TU[x.id] || '') + ' ', d = 0;
      if (t === ten) d = 100;
      else tuKhoa(t).forEach(function (w) { if (tu.indexOf(' ' + w + ' ') >= 0) d++; });
      if (co(tu.trim(), t)) d += 5;
      if (d > diem) { diem = d; tot = x; }
    });
    return diem >= 2 ? tot : null;
  }
  function timSoVanBan(so) {
    var kq = [];
    App.db.nhanVien.forEach(function (nv) {
      (nv.hopDong || []).forEach(function (x) { if (cn(x.so).indexOf(so) === 0) kq.push('<li>Hợp đồng <b>' + h(x.so) + '</b> – ' + lienKetNV(nv) + ': ' + h(App.tenGiaiDoan(nv, x)) + ', ' + TL.hienNgay(x.tuNgay) + (x.denNgay ? ' – ' + TL.hienNgay(x.denNgay) : '') + '</li>'); });
      (nv.quyetDinh || []).forEach(function (x) { if (cn(x.so).indexOf(so) === 0) kq.push('<li>Quyết định <b>' + h(x.so) + '</b> – ' + lienKetNV(nv) + ': ' + h(x.noiDung || x.loai || '') + ', hiệu lực ' + TL.hienNgay(x.hieuLuc) + '</li>'); });
    });
    return kq.length ? 'Tìm thấy:<ul>' + kq.slice(0, 10).join('') + '</ul>' : null;
  }
  function timGanDung(q) {
    var tk = tuKhoa(q).filter(function (w) { return w.length >= 3; }); if (!tk.length) return [];
    return App.db.nhanVien.filter(function (nv) { var t = ' ' + cn(nv.hoTen + ' ' + nv.ma) + ' '; return tk.some(function (w) { return t.indexOf(' ' + w + ' ') >= 0; }); }).slice(0, 8);
  }

  var GOI_Y = ['Ai sắp hết hạn hợp đồng?', 'Ai đang thử việc?', 'Hôm nay ai nghỉ?', 'Ô chấm công còn trống', 'Đơn nghỉ chờ duyệt', 'Cách chấm công hằng ngày',
    'Cách tính lương thử việc', 'Lương cơ sở hiện nay', 'Tiền cơm bao nhiêu', 'Ngày lễ sắp tới', 'Tỷ lệ đóng bảo hiểm bao nhiêu', 'Sinh nhật tháng này', 'Quyền của tôi'];
  function goiYTheoQuyen() {
    return GOI_Y.filter(function (g) {
      var q = cn(g);
      if (/(hop dong|thu viec|don nghi|sinh nhat)/.test(q) && !/cach/.test(q)) return App.quyen('ns') >= 1;
      if (/(ai nghi|cham cong con trong|o cham cong)/.test(q)) return App.quyen('cc') >= 1;
      return true;
    });
  }
  function chao() {
    var t = App.mayChu && App.mayChu.toi ? App.mayChu.toi.ten : '';
    return 'Xin chào' + (t ? ' <b>' + h(t) + '</b>' : '') + '! Tôi là <b>Trợ lý ảo Hawasuco</b> của phần mềm Nhân sự – Chấm công – Tiền lương. Tôi có thể:' +
      '<ul><li><b>Hướng dẫn</b> cách làm: “cách chấm công”, “nâng bậc lương thế nào”, “sao lưu dữ liệu”…</li>' +
      '<li><b>Tìm</b> nhân viên, phòng / đội, số hợp đồng, quyết định: gõ tên, mã NV, số điện thoại, số HĐ…</li>' +
      '<li><b>Trả lời nhanh</b> từ dữ liệu: ai sắp hết hạn hợp đồng, ai đang thử việc, ai nghỉ hôm nay, lương của một người…</li>' +
      '<li><b>Mở trang</b>: “mở bảng lương”, “vào chấm công”.</li></ul>' +
      '<div class="tl-goi">' + goiYTheoQuyen().slice(0, 8).map(hoi).join('') + '</div>';
  }

  /* ================= Giao diện (giống trợ lý ảo trên web.capnuochaugiang.vn: linh vật robot, khung chat xanh) ================= */
  var A = window.ANH_TROLY || {};
  var GLOW = 'filter="url(#tlGlow)"', GLOW2 = 'filter="url(#tlGlow2)"';
  var DEFS = '<defs><filter id="tlGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
    '<filter id="tlGlow2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>' +
    '<linearGradient id="tlKim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f7fa"/><stop offset="1" stop-color="#8e9aa6"/></linearGradient>' +
    '<clipPath id="tlNguc"><circle cx="184" cy="228" r="12.2"/></clipPath></defs>';
  var TAI_NGHE = '<g class="tl-tainghe"><path d="M76 122 C64 -10 278 -14 270 118" stroke="#1f262e" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M78 114 C68 -4 274 -8 268 110" stroke="#5b6672" stroke-width="3" fill="none" stroke-linecap="round" opacity=".9"/>' +
    '<path d="M148 18 Q172 15 196 17.5" stroke="#3ee0ff" stroke-width="3" fill="none" stroke-linecap="round" ' + GLOW + '/><circle cx="77" cy="127" r="18" fill="#1f262e"/><circle cx="77" cy="127" r="11" fill="#2e3742" stroke="#3ee0ff" stroke-width="2" ' + GLOW + '/>' +
    '<circle cx="270" cy="122" r="17" fill="#1f262e"/><circle cx="270" cy="122" r="10.5" fill="#2e3742" stroke="#3ee0ff" stroke-width="2" ' + GLOW + '/><path d="M76 142 Q84 180 140 178" stroke="#1f262e" stroke-width="6" fill="none" stroke-linecap="round"/>' +
    '<path d="M78 144 Q86 176 138 175" stroke="#5b6672" stroke-width="1.8" fill="none" stroke-linecap="round"/><rect x="136" y="169" width="22" height="15" rx="7.5" fill="#262e37"/><g stroke="#3d4752" stroke-width="1.2"><path d="M141 171v11M145 170v13M149 170v13M153 171v11"/></g>' +
    '<circle class="tl-led" cx="158.5" cy="176.5" r="2.8" fill="#3ee0ff" ' + GLOW + '/></g>';
  function nenMat(x, y) { return '<circle cx="' + x + '" cy="' + y + '" r="31" fill="#3ee0ff" opacity=".35" ' + GLOW2 + '/><circle cx="' + x + '" cy="' + y + '" r="28.5" fill="#0b1216"/>'; }
  var MAT = '<g class="tl-mat m-vui">' + nenMat(135, 128) + '<path d="M122 133 Q135 115 148 133" stroke="#3ee0ff" stroke-width="5" fill="none" stroke-linecap="round" ' + GLOW + '/>' + nenMat(229, 124) +
      '<path d="M216 129 Q229 111 242 129" stroke="#3ee0ff" stroke-width="5" fill="none" stroke-linecap="round" ' + GLOW + '/></g>' +
    '<g class="tl-mat m-nham">' + nenMat(135, 128) + '<path d="M122 128 Q135 134 148 128" stroke="#3ee0ff" stroke-width="5" fill="none" stroke-linecap="round" ' + GLOW + '/>' + nenMat(229, 124) +
      '<path d="M216 124 Q229 130 242 124" stroke="#3ee0ff" stroke-width="5" fill="none" stroke-linecap="round" ' + GLOW + '/></g>' +
    '<g class="tl-mat m-doc">' + nenMat(135, 128) + '<circle cx="135" cy="128" r="21" fill="none" stroke="#3ee0ff" stroke-width="5" ' + GLOW + '/><circle cx="136" cy="136" r="11" fill="#06121a"/><circle cx="139" cy="132" r="3.6" fill="#fff"/>' +
      '<path d="M108.3 118 A28.5 28.5 0 0 1 161.7 118 Q135 127 108.3 118z" fill="#dfe4e9"/>' + nenMat(229, 124) + '<circle cx="229" cy="124" r="21" fill="none" stroke="#3ee0ff" stroke-width="5" ' + GLOW + '/>' +
      '<circle cx="230" cy="132" r="11" fill="#06121a"/><circle cx="233" cy="128" r="3.6" fill="#fff"/><path d="M202.3 114 A28.5 28.5 0 0 1 255.7 114 Q229 123 202.3 114z" fill="#dfe4e9"/></g>';
  function conNguoi(x, y) { return '<circle cx="' + (x + 1) + '" cy="' + (y + 3) + '" r="11" fill="#06121a"/><circle cx="' + (x + 4) + '" cy="' + (y - 1) + '" r="3.6" fill="#fff"/>'; }
  MAT += '<g class="tl-mat m-thuong">' + nenMat(135, 128) + '<circle cx="135" cy="128" r="21" fill="none" stroke="#3ee0ff" stroke-width="5" ' + GLOW + '/>' + nenMat(229, 124) +
      '<circle cx="229" cy="124" r="21" fill="none" stroke="#3ee0ff" stroke-width="5" ' + GLOW + '/><g class="tl-con">' + conNguoi(135, 128) + conNguoi(229, 124) + '</g></g>' +
    '<g class="tl-mat m-ngac">' + nenMat(135, 128) + '<circle cx="135" cy="128" r="24" fill="none" stroke="#3ee0ff" stroke-width="4" ' + GLOW + '/><circle cx="135" cy="128" r="7" fill="#06121a"/><circle cx="137.5" cy="125.5" r="2.6" fill="#fff"/>' +
      nenMat(229, 124) + '<circle cx="229" cy="124" r="24" fill="none" stroke="#3ee0ff" stroke-width="4" ' + GLOW + '/><circle cx="229" cy="124" r="7" fill="#06121a"/><circle cx="231.5" cy="121.5" r="2.6" fill="#fff"/></g>' +
    '<g class="tl-mat m-tim">' + nenMat(135, 128) + nenMat(229, 124) + '<g fill="#ff5c8a" ' + GLOW + '><path transform="translate(135 130) scale(2.6)" d="M0 5l-5-5a3.1 3.1 0 0 1 5-3.6 3.1 3.1 0 0 1 5 3.6z"/>' +
      '<path transform="translate(229 126) scale(2.6)" d="M0 5l-5-5a3.1 3.1 0 0 1 5-3.6 3.1 3.1 0 0 1 5 3.6z"/></g></g>' +
    '<g class="tl-mat m-chong">' + nenMat(135, 128) + '<path d="M125 118l20 20M145 118l-20 20" stroke="#3ee0ff" stroke-width="5" fill="none" stroke-linecap="round" ' + GLOW + '/>' + nenMat(229, 124) +
      '<path d="M219 114l20 20M239 114l-20 20" stroke="#3ee0ff" stroke-width="5" fill="none" stroke-linecap="round" ' + GLOW + '/></g>' +
    '<g class="tl-mat m-nhay">' + nenMat(229, 124) + '<path d="M216 129 Q229 111 242 129" stroke="#3ee0ff" stroke-width="5" fill="none" stroke-linecap="round" ' + GLOW + '/></g>';
  var MIENG = '<g class="tl-mieng" ' + GLOW + '><path class="tl-mi m-cuoi" d="M166 165 Q182 180 198 164" stroke="#3ee0ff" stroke-width="4" fill="none" stroke-linecap="round"/>' +
    '<g class="tl-mi m-ha"><path d="M164 164 Q182 167 200 163 Q197 184 182 184 Q167 184 164 164z" fill="#0b1216" stroke="#3ee0ff" stroke-width="3" stroke-linejoin="round"/><ellipse cx="182" cy="178.5" rx="9" ry="3.6" fill="#ff7aa0" opacity=".9"/></g>' +
    '<g class="tl-mi m-noi"><rect x="168" y="164" width="28" height="14" rx="7" fill="#0b1216" stroke="#3ee0ff" stroke-width="2.8"/><path d="M174 171h.01M179 168v6M184 167v8M189 169v4M193 171h.01" stroke="#3ee0ff" stroke-width="2.6" stroke-linecap="round"/></g>' +
    '<path class="tl-mi m-bang" d="M170 172 L194 170" stroke="#3ee0ff" stroke-width="4" fill="none" stroke-linecap="round"/>' +
    '<ellipse class="tl-mi m-o" cx="182" cy="172" rx="6.5" ry="8" fill="#0b1216" stroke="#3ee0ff" stroke-width="3"/>' +
    '<path class="tl-mi m-buon" d="M168 178 Q182 166 196 177" stroke="#3ee0ff" stroke-width="4" fill="none" stroke-linecap="round"/>' +
    '<g class="tl-mi m-luoi"><path d="M166 165 Q182 179 198 164" stroke="#3ee0ff" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M177 171 Q177 184 184 184 Q191 184 190 170z" fill="#ff7aa0"/></g></g>';
  var MUI = '<rect x="176" y="146" width="12" height="8" rx="4" fill="url(#tlKim)" stroke="#7d8996" stroke-width="1"/><ellipse cx="179.6" cy="148.2" rx="2.4" ry="1" fill="#fff" opacity=".95"/>';
  var MA = '<g class="tl-ma"><ellipse cx="112" cy="168" rx="10" ry="4.6" fill="#ff9bb3" opacity=".5"/><ellipse cx="250" cy="164" rx="10" ry="4.6" fill="#ff9bb3" opacity=".5"/></g>';
  function svgLinhVat() {
    var logo = App.logoCongTy ? App.logoCongTy(App.db.congTy) : '';
    return '<svg class="tl-bot" viewBox="45 20 270 330" aria-hidden="true">' + DEFS +
      '<ellipse class="tl-bong" cx="182" cy="334" rx="78" ry="10" fill="rgba(10,40,80,.22)"/><g class="tl-than">' +
      (A.than ? '<image href="' + A.than + '" x="0" y="0" width="360" height="360"/>' : '') +
      '<circle cx="184" cy="228" r="15.5" fill="#3ee0ff" opacity=".45" ' + GLOW2 + '/><circle cx="184" cy="228" r="14" fill="#fff" stroke="#3ee0ff" stroke-width="2.2"/>' +
      (logo ? '<image href="' + logo + '" x="171.8" y="215.8" width="24.4" height="24.4" clip-path="url(#tlNguc)"/>' : '') +
      '<g class="tl-sach"><path d="M104 230 Q143 222 182 229 Q221 222 260 230 L262 299 Q222 291 182 298 Q142 291 102 299z" fill="#135f99" stroke="#0b3d66" stroke-width="2"/>' +
      '<path d="M182 236 Q148 228 114 234 L113 291 Q148 285 182 293z" fill="#fffdf6" stroke="#cfc6b0" stroke-width="1.4"/><path d="M182 236 Q216 228 250 234 L251 291 Q216 285 182 293z" fill="#fffaf0" stroke="#cfc6b0" stroke-width="1.4"/>' +
      '<g stroke="#9fb6c9" stroke-width="2.4" stroke-linecap="round" opacity=".8"><path d="M124 245h44M124 254h48M124 263h40M124 272h46M124 281h30"/><path d="M194 245h44M194 254h40M194 263h46M194 272h36"/></g>' +
      '<circle cx="226" cy="280" r="6" fill="#3ee0ff" opacity=".55"/><path d="M182 236V293" stroke="#b8ac90" stroke-width="2"/><g class="tl-lat"><path d="M182 236 Q216 228 250 234 L251 291 Q216 285 182 293z" fill="#fffef9" stroke="#cfc6b0" stroke-width="1.4"/>' +
      '<path d="M194 247h40M194 256h44M194 265h34" stroke="#c3d2de" stroke-width="2.4" stroke-linecap="round"/></g>' +
      '<ellipse cx="103" cy="266" rx="11" ry="15" fill="#2a323b"/><ellipse cx="100" cy="260" rx="3" ry="5" fill="#fff" opacity=".25"/><ellipse cx="261" cy="266" rx="11" ry="15" fill="#2a323b"/><ellipse cx="264" cy="260" rx="3" ry="5" fill="#fff" opacity=".2"/></g>' +
      '<g class="tl-nhin"><g class="tl-dau">' + (A.dau ? '<image href="' + A.dau + '" x="0" y="0" width="360" height="194"/>' : '') + MA + MAT + TAI_NGHE + MUI + MIENG + '</g></g></g></svg>';
  }
  function svgAvatar() {
    return '<svg class="tl-av-svg" viewBox="58 14 232 186" aria-hidden="true">' + (A.dau ? '<image href="' + A.dau + '" x="0" y="0" width="360" height="194"/>' : '') + TAI_NGHE +
      '<g><circle cx="135" cy="128" r="29" fill="#0b1216"/><circle cx="229" cy="124" r="29" fill="#0b1216"/><path d="M122 133 Q135 115 148 133M216 129 Q229 111 242 129" stroke="#3ee0ff" stroke-width="6" fill="none" stroke-linecap="round"/></g>' +
      '<path d="M166 165 Q182 180 198 164" stroke="#3ee0ff" stroke-width="5" fill="none" stroke-linecap="round"/></svg>';
  }
  var ICON_GUI = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20l18-8L3 4v6l12 2-12 2z" fill="currentColor"/></svg>';
  /* ================= Giọng nói: nói câu hỏi (micro) và đọc câu trả lời ================= */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function docKho(k, md) { try { var v = localStorage.getItem(k); return v == null ? md : v; } catch (e) { return md; } }
  function ghiKho(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* bỏ qua */ } }
  var GN = { rec: null, nghe: false, noi: false, tuMic: false, cuoi: '', trenMay: false, daBao: false,
    hoatDong: docKho('tl_hoatdong', '1') === '1', docTuDong: docKho('tl_doc', '0') === '1', lienTuc: docKho('tl_lientuc', '0') === '1', tenGiong: docKho('tl_giong', ''), toc: +docKho('tl_toc', '1') || 1 };
  function choNoi() { return !!SR && App.db && App.db.caiDat.troLyGiongNoi !== false; }
  /** Giọng của máy / trình duyệt (Web Speech) */
  function coHT() { return 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function'; }
  /** Giọng đọc tiếng Việt tích hợp sẵn trong phần mềm (src/giongdoc.js) */
  function coTH() { return !!(App.GiongDoc && App.GiongDoc.coThe()); }
  function coDoc() { return coHT() || coTH(); }
  function dsGiongMay() {
    if (!coHT()) return [];
    return speechSynthesis.getVoices().filter(function (v) { return /^vi([-_]|$)/i.test(v.lang); })
      .sort(function (a, b) { return (b.localService - a.localService) || ((/natural|neural/i.test(b.name)) - (/natural|neural/i.test(a.name))); });
  }
  function dsGiongTH() { return coTH() ? App.GiongDoc.ds.map(function (g) { return { name: g.ten, lang: 'vi-VN', localService: true, tichHop: g.ma }; }) : []; }
  function dsGiong() { return dsGiongTH().concat(dsGiongMay()); }
  /** Giọng đọc: giọng đã chọn; mặc định giọng tiếng Việt cài trên máy (thường tự nhiên hơn), không có thì giọng tích hợp sẵn.
      Giọng "trực tuyến" của trình duyệt gửi văn bản ra ngoài nên chỉ dùng khi người dùng tự chọn. */
  function giong() {
    var ds = dsGiong();
    return ds.filter(function (v) { return v.name === GN.tenGiong; })[0] || dsGiongMay().filter(function (v) { return v.localService; })[0] || dsGiongTH()[0] || null;
  }
  // (không gọi SpeechRecognition.available để dò nhận dạng trên máy: trên một số bản Chromium lệnh này làm treo trang)

  var VIET_TAT = [['HĐLĐ', 'hợp đồng lao động'], ['HĐ', 'hợp đồng'], ['BHXH', 'bảo hiểm xã hội'], ['BHYT', 'bảo hiểm y tế'], ['BHTN', 'bảo hiểm thất nghiệp'],
    ['KPCĐ', 'kinh phí công đoàn'], ['BH', 'bảo hiểm'], ['TNCN', 'thu nhập cá nhân'], ['QĐ', 'quyết định'], ['ĐT', 'điện thoại'], ['CCCD', 'căn cước công dân'],
    ['SP', 'sản phẩm'], ['NV', 'nhân viên'], ['BLLĐ', 'Bộ luật Lao động'], ['NĐ', 'Nghị định'], ['TT', 'Thông tư']];
  /** Chữ để đọc: bỏ nút, đọc số tiền, ngày tháng, chữ viết tắt cho dễ nghe; dài quá thì đọc phần đầu */
  function chuDoc(html) {
    var d = document.createElement('div'); d.innerHTML = html;
    Array.prototype.forEach.call(d.querySelectorAll('.tl-nuts, .tl-goi, .tl-lq, .tl-doclai, button'), function (x) { x.remove(); });
    Array.prototype.forEach.call(d.querySelectorAll('li, p, div, tr'), function (x) { x.insertAdjacentText('afterbegin', ' '); x.insertAdjacentText('beforeend', '. '); });
    var t = d.textContent.replace(/\s+/g, ' ');
    t = t.replace(/(\d{1,3})((?:\.\d{3})+)(?!\d)/g, function (_, a, b) { return a + b.replace(/\./g, ''); })
      // số văn bản 12/2026/HĐLĐ, 05/QĐ-CNHG: đọc từng phần, không nhầm thành ngày tháng
      .replace(/(\d{1,4})\/(\d{4})\/([\p{L}\-]+)/gu, '$1, năm $2, $3').replace(/(\d{1,4})\/([\p{Lu}][\p{L}\-]*)/gu, '$1, $2')
      .replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g, 'ngày $1 tháng $2 năm $3').replace(/tháng (\d{1,2})\/(\d{4})/g, 'tháng $1 năm $2')
      .replace(/(\d{1,2})\/(\d{4})/g, 'tháng $1 năm $2').replace(/(\d{1,2})\/(\d{1,2})(?![\d\/])/g, 'ngày $1 tháng $2')
      .replace(/ đ\/ngày/g, ' đồng một ngày').replace(/ đ\/tháng/g, ' đồng một tháng').replace(/(\d) ?đ(?![\p{L}])/gu, '$1 đồng')
      .replace(/Hawasuco/gi, 'Ha oa su cô').replace(/\p{Extended_Pictographic}|\uFE0F/gu, '')
      .replace(/−\s?/g, 'trừ ').replace(/→/g, ', sang ').replace(/[–·•]/g, ', ').replace(/×/g, ' nhân ').replace(/÷/g, ' chia ').replace(/=/g, ' bằng ').replace(/[“”"*_`]/g, '');
    t = t.replace(/([\p{L}\d])-(?=\p{L})/gu, '$1 ').replace(/(ngày|tháng|năm) \1 /g, '$1 ');
    VIET_TAT.forEach(function (x) { t = t.replace(new RegExp('(^|[^\\p{L}\\p{N}])' + x[0] + '(?=[^\\p{L}]|$)', 'gu'), '$1' + x[1] + ' '); });
    t = t.replace(/(\s*\.\s*){2,}/g, '. ').replace(/:\s*\./g, ':').replace(/\s+/g, ' ').replace(/\s+([.,:;])/g, '$1').replace(/,\s*,/g, ',').trim();
    if (t.length > 700) { var cat = t.slice(0, 700), vt = cat.lastIndexOf('. '); t = (vt > 300 ? cat.slice(0, vt + 1) : cat) + ' Mời bạn xem chi tiết trên màn hình.'; }
    return t;
  }
  function trangThai(chu) { var s = el && el.querySelector('.tl-tt'); if (s) s.textContent = chu || 'Hướng dẫn, tìm thông tin trong phần mềm'; }
  function datNoi(v) {
    GN.noi = v; if (nutLV) nutLV.classList.toggle('dang-noi', v); trangThaiLV('noi', v); trangThai(v ? 'Đang nói… (bấm 🔊 để dừng)' : '');
    var l = el && el.querySelector('.tl-loa'); if (l) l.classList.toggle('dang', v);
  }
  /** Đọc câu trả lời; sauKhi chạy khi đọc xong (dùng cho nói chuyện liên tục) */
  function doc(html, sauKhi) {
    if (!coDoc()) return false;
    var g = giong();
    if (!g) return false;
    dungDoc();
    var t = chuDoc(html); if (!t) return false;
    if (g.tichHop) {
      var xongTH = false;
      App.GiongDoc.noi(t, {
        giong: g.tichHop, toc: GN.toc,
        batDau: function () { datNoi(true); },
        xong: function () { if (xongTH) return; xongTH = true; datNoi(false); if (sauKhi) sauKhi(); },
        loi: function (m) { xongTH = true; datNoi(false); them('tl', '<span class="mo nho">🔇 Không đọc được bằng giọng tích hợp: ' + h(m) + '</span>'); }
      });
      return true;
    }
    var cau = t.match(/[^.!?;]+[.!?;]*/g) || [t], xong = false;   // chia câu ngắn: trình duyệt hay ngắt giọng đọc dài
    function het() { if (xong) return; xong = true; datNoi(false); if (sauKhi) sauKhi(); }
    cau.forEach(function (c, i) {
      var u = new SpeechSynthesisUtterance(c.trim()); u.voice = g; u.lang = g.lang; u.rate = GN.toc;
      if (i === 0) u.onstart = function () { datNoi(true); };
      if (i === cau.length - 1) u.onend = het;
      u.onerror = function (e) { if (e.error !== 'interrupted' && e.error !== 'canceled') het(); else { xong = true; datNoi(false); } };
      speechSynthesis.speak(u);
    });
    return true;
  }
  function dungDoc() { if (coHT()) speechSynthesis.cancel(); if (App.GiongDoc) App.GiongDoc.dung(); }
  function ngungDoc() { dungDoc(); datNoi(false); }
  function datNghe(v) {
    GN.nghe = v; if (nutLV) nutLV.classList.toggle('dang-nghe', v); trangThaiLV('nghe', v); if (v) camXuc('🎤');
    var m = el && el.querySelector('.tl-mic'), o = el && el.querySelector('.tl-f input');
    if (m) { m.classList.toggle('on', v); m.setAttribute('aria-label', v ? 'Đang nghe – bấm để dừng' : 'Nói câu hỏi bằng giọng nói'); }
    if (o) o.placeholder = v ? 'Đang nghe… mời bạn nói câu hỏi' : 'Nhập câu hỏi, tên, mã NV, số HĐ…';
    trangThai(v ? 'Đang nghe…' : '');
  }
  function batNghe() {
    if (GN.nghe) { try { GN.rec.stop(); } catch (e) { /* bỏ qua */ } return; }
    if (!SR) { them('tl', 'Trình duyệt này chưa hỗ trợ nói câu hỏi bằng giọng nói. Hãy dùng <b>Chrome</b> hoặc <b>Edge</b> bản mới.'); return; }
    if (!choNoi()) { them('tl', 'Đơn vị đã tắt tính năng nói câu hỏi bằng giọng nói (Cài đặt & dữ liệu → Đơn vị & chữ ký → Trợ lý ảo).'); return; }
    ngungDoc();
    var rec = new SR(), o = el.querySelector('.tl-f input'), cuoi = '', giu = o.value.trim();
    rec.lang = 'vi-VN'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    rec.onresult = function (e) {
      var tam = '';
      for (var i = e.resultIndex; i < e.results.length; i++) { var t = e.results[i][0].transcript; if (e.results[i].isFinal) cuoi += t; else tam += t; }
      o.value = ((giu ? giu + ' ' : '') + cuoi + tam).replace(/\s+/g, ' ').trim();
    };
    rec.onerror = function (e) {
      datNghe(false);
      var m = { 'not-allowed': 'Trình duyệt chưa cho phép dùng micro. Bấm biểu tượng ổ khoá / cài đặt trang trên thanh địa chỉ → cho phép <b>Micrô</b>, rồi thử lại.',
        'service-not-allowed': 'Trình duyệt chưa cho phép nhận dạng giọng nói trên trang này.', 'no-speech': 'Tôi chưa nghe thấy gì. Bấm micro và nói lại nhé.',
        'audio-capture': 'Không tìm thấy micro trên máy.', 'network': 'Nhận dạng giọng nói của trình duyệt cần kết nối Internet. Bạn có thể gõ câu hỏi.',
        'language-not-supported': 'Trình duyệt chưa hỗ trợ nhận dạng tiếng Việt.' }[e.error];
      if (m && !(e.error === 'no-speech' && GN.phien)) them('tl', m);
      GN.phien = false;
    };
    rec.onend = function () {
      datNghe(false);
      var t = o.value.trim();
      if (cuoi.trim() && t) { o.value = ''; GN.tuMic = true; hoiTL(t); } else GN.phien = false;
    };
    try { rec.start(); GN.rec = rec; datNghe(true); o.focus(); } catch (e) { datNghe(false); return; }
    if (!GN.daBao && !GN.trenMay) {
      GN.daBao = true;
      them('tl', '<span class="mo nho">🎤 Giọng nói được trình duyệt chuyển thành chữ (Chrome / Edge gửi âm thanh câu hỏi tới dịch vụ nhận dạng giọng nói của Google / Microsoft). ' +
        'Câu trả lời và dữ liệu nhân sự vẫn chỉ xử lý trên máy này.</span>');
    }
  }
  function moCaiDatGiong() {
    var p = el.querySelector('.tl-cdgn');
    if (!p.hidden) { p.hidden = true; return; }
    var ds = dsGiong(), g = giong(), th = dsGiongTH(), may = dsGiongMay(), loiTH = App.GiongDoc && App.GiongDoc.loi();
    function opt(v) { return '<option value="' + h(v.name) + '"' + (g && g.name === v.name ? ' selected' : '') + '>' + h(v.name) + (v.localService ? '' : ' (trực tuyến)') + '</option>'; }
    p.innerHTML = '<b>Giọng nói &amp; linh vật</b>' +
      '<label class="chk"><input type="checkbox" data-gn="hoatDong"' + (GN.hoatDong ? ' checked' : '') + '> Linh vật chuyển động, chào hỏi, ngủ gật khi rảnh</label>' +
      '<label class="chk"><input type="checkbox" data-gn="doc"' + (GN.docTuDong ? ' checked' : '') + '> Tự đọc câu trả lời (cả khi gõ câu hỏi)</label>' +
      '<label class="chk"><input type="checkbox" data-gn="lienTuc"' + (GN.lienTuc ? ' checked' : '') + '> Nói chuyện liên tục: đọc xong tự nghe câu tiếp theo (nói “kết thúc” để dừng)</label>' +
      '<label>Giọng đọc<select data-gn="giong">' + (ds.length ?
        (th.length ? '<optgroup label="Tích hợp sẵn – không cần cài, không gửi ra ngoài">' + th.map(opt).join('') + '</optgroup>' : '') +
        (may.length ? '<optgroup label="Giọng của máy / trình duyệt">' + may.map(opt).join('') + '</optgroup>' : '') +
        (g ? '' : '<option value="" selected>(Chưa chọn)</option>') : '<option>Trình duyệt này chưa đọc được tiếng Việt</option>') + '</select></label>' +
      '<label>Tốc độ đọc <input type="range" min="0.7" max="1.5" step="0.1" value="' + GN.toc + '" data-gn="toc"></label>' +
      '<div class="hang"><button type="button" class="nut nho" data-tl="thugiong"' + (ds.length ? '' : ' disabled') + '>Nghe thử</button><button type="button" class="nut nho" data-tl="cdgn">Đóng</button></div>' +
      '<p class="mo nho" style="margin:0">' + (loiTH ? '<b style="color:var(--do)">' + h(loiTH) + '</b><br>' : '') +
      (th.length ? '<b>Giọng tích hợp sẵn</b> chạy ngay trong phần mềm: không cần cài, không cần Internet, chọn được giọng miền Nam / Bắc / Trung. ' : '') +
      'Giọng tiếng Việt cài trên Windows (vd Microsoft An) thường tự nhiên hơn – có thì phần mềm dùng trước: Cài đặt → Thời gian &amp; ngôn ngữ → Giọng nói → Thêm giọng nói → Tiếng Việt. ' +
      (may.some(function (v) { return !v.localService; }) ? 'Giọng “trực tuyến” gửi văn bản câu trả lời tới dịch vụ đọc của trình duyệt.' : '') + (choNoi() ? '' : '<br>Nói câu hỏi bằng micro đang tắt ở Cài đặt của đơn vị.') + '</p>';
    p.hidden = false;
  }
  function nutLoa() {
    var l = el && el.querySelector('.tl-loa'); if (!l) return;
    l.classList.toggle('tat', !GN.docTuDong);
    l.title = GN.docTuDong ? 'Đang tự đọc câu trả lời – bấm để tắt' : 'Bấm để tự đọc câu trả lời bằng giọng nói';
  }
  var ICON_MIC = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-6a3.5 3.5 0 0 0-7 0v6A3.5 3.5 0 0 0 12 15z" fill="currentColor"/><path d="M18.5 11.5a6.5 6.5 0 0 1-13 0M12 18v3.2M8.5 21.2h7" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round"/></svg>';
  var ICON_LOA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path class="song" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round"/><path class="gach" d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';
  var ICON_CD = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="16" cy="7" r="2.2" stroke="currentColor" stroke-width="1.9" fill="none"/><circle cx="10" cy="17" r="2.2" stroke="currentColor" stroke-width="1.9" fill="none"/></svg>';


  var el = null, nutLV = null, daChao = false, henCu = [];
  function gan() {
    if (el) return;
    nutLV = document.createElement('button');
    nutLV.className = 'tl-nut khong-in'; nutLV.type = 'button'; nutLV.title = 'Trợ lý ảo Hawasuco – bấm để hỏi đáp (Ctrl + K)'; nutLV.setAttribute('aria-label', 'Mở trợ lý ảo');
    nutLV.innerHTML = '<span class="tl-noi" aria-hidden="true">Xin chào! 👋</span><span class="tl-emo" aria-hidden="true"></span>' + svgLinhVat() + '<span class="tl-nhan">Hỏi đáp</span>';
    el = document.createElement('section');
    el.className = 'tl-khung khong-in'; el.setAttribute('aria-label', 'Trợ lý ảo'); el.hidden = true;
    el.innerHTML = '<header><span class="tl-av">' + svgAvatar() + '<i class="tl-on"></i></span><div><b>Trợ lý ảo Hawasuco</b><small class="tl-tt">Hướng dẫn, tìm thông tin trong phần mềm</small></div>' +
      (coDoc() ? '<button type="button" class="tl-x tl-loa" data-tl="loa" aria-label="Đọc câu trả lời bằng giọng nói">' + ICON_LOA + '</button>' : '') +
      ((coDoc() || SR) ? '<button type="button" class="tl-x tl-icon" data-tl="cdgn" title="Cài đặt giọng nói" aria-label="Cài đặt giọng nói">' + ICON_CD + '</button>' : '') +
      '<button type="button" class="tl-x" data-tl="xoa" title="Bắt đầu lại" aria-label="Bắt đầu lại">⟲</button><button type="button" class="tl-x" data-tl="dong" title="Đóng (Esc)" aria-label="Đóng">×</button></header>' +
      '<div class="tl-cdgn" hidden></div><div class="tl-ds" aria-live="polite"></div>' +
      '<form class="tl-f" onsubmit="return false"><input maxlength="300" autocomplete="off" placeholder="Nhập câu hỏi, tên, mã NV, số HĐ…" aria-label="Câu hỏi">' +
      (SR ? '<button type="button" class="tl-mic" data-tl="mic" title="Bấm để nói (tiếng Việt)" aria-label="Nói câu hỏi bằng giọng nói">' + ICON_MIC + '</button>' : '') +
      '<button aria-label="Gửi">' + ICON_GUI + '</button></form>' +
      '<p class="tl-note">Trả lời từ dữ liệu trong phần mềm và hướng dẫn sử dụng, theo quyền tài khoản; dữ liệu nhân sự không gửi ra ngoài.</p>';
    document.body.appendChild(nutLV); document.body.appendChild(el);
    nutLoa();
    el.addEventListener('change', function (e) {
      var i = e.target, k = i.dataset.gn; if (!k) return;
      if (k === 'doc') { GN.docTuDong = i.checked; ghiKho('tl_doc', i.checked ? 1 : 0); nutLoa(); if (!i.checked) ngungDoc(); }
      else if (k === 'lienTuc') { GN.lienTuc = i.checked; ghiKho('tl_lientuc', i.checked ? 1 : 0); }
      else if (k === 'hoatDong') { GN.hoatDong = i.checked; ghiKho('tl_hoatdong', i.checked ? 1 : 0); if (!i.checked) { trangThaiLV('ngu', false); nutLV.querySelector('.tl-emo').classList.remove('lap'); } else cuChi('mung', 1400, '✨'); }
      else if (k === 'giong') { GN.tenGiong = i.value; ghiKho('tl_giong', i.value); }
      else if (k === 'toc') { GN.toc = +i.value || 1; ghiKho('tl_toc', GN.toc); }
    });
    nutLV.onclick = function () { bat(el.hidden); };
    var o = el.querySelector('input'), lichSu = [], vt = -1;
    el.querySelector('form').onsubmit = function () { var v = o.value.trim(); if (!v) return false; lichSu.push(v); vt = lichSu.length; o.value = ''; hoiTL(v); return false; };
    o.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp' && lichSu.length) { vt = Math.max(0, vt - 1); o.value = lichSu[vt]; e.preventDefault(); }
      else if (e.key === 'ArrowDown' && lichSu.length) { vt = Math.min(lichSu.length, vt + 1); o.value = lichSu[vt] || ''; e.preventDefault(); }
    });
    el.addEventListener('click', function (e) {
      var a = e.target.closest('[data-tl]'); if (!a) return;
      e.preventDefault();
      var v = a.dataset.tl;
      if (v === 'dong') { bat(false); return; }
      if (v === 'mic') { batNghe(); return; }
      if (v === 'cdgn') { moCaiDatGiong(); return; }
      if (v === 'thugiong') { if (!doc('Xin chào, tôi là trợ lý ảo Hawasuco. Lương cơ sở hiện nay là 2.530.000 đ/tháng.')) them('tl', 'Chưa chọn được giọng đọc tiếng Việt.'); return; }
      if (v === 'loa') {
        if (GN.noi) { ngungDoc(); return; }
        if (!giong()) { moCaiDatGiong(); them('tl', 'Trình duyệt này chưa đọc được tiếng Việt. Hãy dùng <b>Chrome</b> hoặc <b>Edge</b> bản mới (có sẵn giọng đọc tích hợp của phần mềm).'); return; }
        GN.docTuDong = !GN.docTuDong; ghiKho('tl_doc', GN.docTuDong ? 1 : 0); nutLoa();
        if (GN.docTuDong) { var cuoiTN = el.querySelectorAll('.tl-tn.tl'); if (cuoiTN.length) doc(cuoiTN[cuoiTN.length - 1].innerHTML); }
        return;
      }
      if (v === 'doc') { var tn = a.closest('.tl-tn'); if (tn) doc(tn.innerHTML); return; }
      if (v === 'xoa') { el.querySelector('.tl-ds').innerHTML = ''; them('tl', chao()); return; }
      if (v.indexOf('hoi:') === 0) { hoiTL(v.slice(4)); return; }
      if (v === 'mk') { var l = document.getElementById('doi-mk'); if (l) l.click(); return; }
      if (v.indexOf('hd:') === 0) { var c = khoHuongDan().ds[+v.slice(3)]; if (c) them('tl', veHuongDan([{ c: c }], null)); return; }
      dieuHuong(v);
    });
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); bat(true); }
      else if (e.key === 'Escape' && !el.hidden && !document.querySelector('.mo-nen')) { if (GN.noi || GN.nghe) { ngungDoc(); if (GN.nghe) try { GN.rec.abort(); } catch (x) { /* bỏ qua */ } } else bat(false); }
    });
    veMat(); songDong();
  }
  /* ================= Cảm xúc, cử chỉ của linh vật ================= */
  // cử chỉ = chuyển động + nét mặt [mắt, miệng]; trạng thái kéo dài (đang nói, đang nghe, ngủ gật) dùng khi không có cử chỉ
  var CU_CHI = {
    vay: ['vui', 'ha'], nhay: ['vui', 'ha'], gat: ['vui', 'cuoi'], lac: ['thuong', 'buon'], mung: ['vui', 'ha'], yeu: ['tim', 'cuoi'],
    mua: ['nhay', 'luoi'], cuoi: ['vui', 'ha'], xoay: ['chong', 'o'], tambiet: ['vui', 'cuoi'], nghi: ['doc', 'bang'], noi: [null, 'noi'],
    ngac: ['ngac', 'o'], then: ['vui', 'cuoi'], nhaymat: ['nhay', 'luoi'], chong: ['chong', 'bang'], buon: ['thuong', 'buon']
  };
  var TT_MAT = { noi: ['vui', 'noi'], nghe: ['ngac', 'o'], ngu: ['nham', 'o'] };
  var CU = { g: null, fx: null, st: {} }, henG = 0, henFx = 0;
  function veMat() {
    if (!nutLV) return;
    var m = null, mi = null;
    function lay(x) { if (x) { if (!m && x[0]) m = x[0]; if (!mi && x[1]) mi = x[1]; } }
    if (CU.st.noi) mi = 'noi'; else if (CU.st.nghe) mi = 'o';   // đang nói / nghe: miệng theo giọng nói
    lay(CU_CHI[CU.g]); lay(CU_CHI[CU.fx]); ['noi', 'nghe', 'ngu'].forEach(function (k) { if (CU.st[k]) lay(TT_MAT[k]); });
    nutLV.dataset.mat = m || 'thuong'; nutLV.dataset.mieng = mi || 'cuoi';
  }
  /** Cử chỉ trong ms (mili giây); emo: biểu tượng cảm xúc bay lên cạnh đầu */
  function cuChi(g, ms, emo) {
    if (!nutLV) return;
    nutLV.removeAttribute('data-g'); void nutLV.getBoundingClientRect();   // chạy lại hiệu ứng nếu đang cùng cử chỉ
    nutLV.dataset.g = g; CU.g = g; veMat();
    clearTimeout(henG); henG = setTimeout(function () { if (CU.g === g) { CU.g = null; nutLV.removeAttribute('data-g'); veMat(); } }, ms || 1500);
    if (emo) camXuc(emo);
    if (g === 'xoay') setTimeout(function () { netMat('chong', 1300); }, 950);
  }
  /** Chỉ đổi nét mặt một lúc: nhaymat, ngac, then, chong, buon */
  function netMat(fx, ms) { CU.fx = fx; veMat(); clearTimeout(henFx); henFx = setTimeout(function () { CU.fx = null; veMat(); }, ms || 1400); }
  function trangThaiLV(st, v) { CU.st[st] = !!v; if (nutLV) nutLV.classList.toggle('st-' + st, !!v); veMat(); }
  function camXuc(t, lap) {
    var e = nutLV && nutLV.querySelector('.tl-emo'); if (!e) return;
    e.textContent = t; e.classList.remove('pop', 'lap'); void e.offsetWidth; e.classList.add(lap ? 'lap' : 'pop');
  }
  /** Áp cảm xúc dạng [cử chỉ, ms, biểu tượng, nét mặt thêm] */
  function bieuCam(c) { if (!c) return; cuChi(c[0], c[1], c[2]); if (c[3]) setTimeout(function () { netMat(c[3], 1600); }, 60); }
  /** Cảm xúc theo lời người dùng: cảm ơn, chào, cười, khen, chê */
  function camXucLoi(qn) {
    if (/(cam on|thank|tks|cam ta)/.test(qn)) return ['yeu', 1800, '💙'];
    if (/^(xin chao|chao|hello|hi|alo)( |$)/.test(qn)) return ['vay', 1500, '👋'];
    if (/(haha|hihi|hehe|kaka|vui qua|buon cuoi)/.test(qn)) return ['cuoi', 1300, '😆'];
    if (/(gioi qua|gioi lam|tuyet|hay qua|xuat sac|tot lam|dang yeu|de thuong|cute)/.test(qn)) return ['mung', 1500, '🥰'];
    if (/(ngu qua|ngoc|do qua|te qua|vo dung|sai roi|sai bet|chan qua|kem qua)/.test(qn)) return ['lac', 1200, '😥'];
    return null;
  }
  function hoatDong() { return GN.hoatDong && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  var LOI = [['Xin chào! 👋 Cần giúp gì không?', 'vay'], ['Hỏi tôi về chấm công, lương nhé!', 'gat', '💬'], ['Ai sắp hết hạn hợp đồng? Hỏi tôi!', 'mung', '📋'],
    ['Nói với tôi cũng được nè 🎤', 'nhaymat'], ['Bấm vào tôi để hỏi nha!', 'yeu', '💙'], ['Xem tôi xoay nè! 🌀', 'xoay'], ['Nhớ uống đủ nước nha! 💧', 'then'],
    ['Cuối tháng nhớ chốt lương nhé! 💰', 'gat'], ['Tôi trực cả ngày nè!', 'mua', '✨']];
  /** Linh vật "sống": chào hỏi, thỉnh thoảng làm trò, chớp mắt, nhìn theo chuột, ngủ gật khi lâu không ai làm gì */
  function songDong() {
    var i = 0, cuoiTD = Date.now(), ngu = false, demLoi = 0;
    setTimeout(function () { if (el.hidden && hoatDong()) { noi('Xin chào! 👋 Cần giúp gì không?', 4500); cuChi('vay', 1600); } }, 2500);
    setInterval(function () {
      if (!hoatDong() || ngu || document.hidden || !el.hidden || demLoi >= 12 || Date.now() - cuoiTD > 55000) return;
      var x = LOI[i++ % LOI.length]; demLoi++; noi(x[0], 4500);
      if (x[1] === 'nhaymat' || x[1] === 'then') { cuChi('gat', 900); netMat(x[1], 2200); } else cuChi(x[1], 1800, x[2]);
    }, 25000);
    function thuc() {
      cuoiTD = Date.now(); if (!ngu) return;
      ngu = false; trangThaiLV('ngu', false); nutLV.querySelector('.tl-emo').classList.remove('lap');
      cuChi('nhay', 900, '😃'); noi('A, bạn đây rồi!', 3000);
    }
    ['pointermove', 'pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, thuc, { passive: true }); });
    setInterval(function () {
      if (hoatDong() && !ngu && el.hidden && !GN.nghe && !GN.noi && Date.now() - cuoiTD > 90000) {
        ngu = true; nutLV.querySelector('.tl-noi').classList.remove('hien'); trangThaiLV('ngu', true); camXuc('💤', true);
      }
    }, 5000);
    function chop1() { nutLV.classList.add('chop'); setTimeout(function () { nutLV.classList.remove('chop'); }, 130); }
    (function chop() {
      setTimeout(function () {
        if (hoatDong() && !ngu && /^(thuong|vui|doc)$/.test(nutLV.dataset.mat)) { chop1(); if (Math.random() < 0.25) setTimeout(chop1, 260); }
        chop();
      }, 2200 + Math.random() * 3200);
    })();
    // đầu nghiêng, con ngươi nhìn theo con trỏ chuột; không có chuột thì thỉnh thoảng đảo mắt
    var raf = 0, mx = 0, my = 0, diChuot = 0;
    window.addEventListener('pointermove', function (e) {
      if (!hoatDong()) return;
      mx = e.clientX; my = e.clientY; diChuot = Date.now();
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        var r = nutLV.getBoundingClientRect(), dx = mx - (r.left + r.width / 2), dy = my - (r.top + r.height * 0.3);
        var lk = nutLV.querySelector('.tl-nhin'), con = nutLV.querySelector('.tl-con');
        if (lk) lk.style.transform = 'translateY(' + Math.max(-3, Math.min(2, dy / 120)).toFixed(1) + 'px) rotate(' + (Math.tanh(dx / 350) * 9).toFixed(1) + 'deg)';
        if (con) con.style.transform = 'translate(' + Math.max(-6, Math.min(6, dx / 45)).toFixed(1) + 'px,' + Math.max(-5, Math.min(5, dy / 55)).toFixed(1) + 'px)';
      });
    }, { passive: true });
    setInterval(function () {
      if (!hoatDong() || Date.now() - diChuot < 4000) return;
      var con = nutLV.querySelector('.tl-con'), k = Math.random();
      if (con) con.style.transform = 'translate(' + (k < 0.3 ? -5 : k < 0.6 ? 5 : 0) + 'px,' + (Math.random() < 0.3 ? -4 : 0) + 'px)';
    }, 3500);
    // rê chuột vào: vẫy chào, nháy mắt; để lâu thì cười khúc khích
    var henRe = 0;
    nutLV.addEventListener('mouseenter', function () {
      if (!hoatDong()) return;
      if (!CU.g) cuChi('vay', 1400);
      netMat('nhaymat', 1200);
      clearTimeout(henRe); henRe = setTimeout(function () { cuChi('cuoi', 1300, '😆'); if (el.hidden) noi('Hihi, nhột quá!', 2200); }, 2600);
    });
    nutLV.addEventListener('mouseleave', function () { clearTimeout(henRe); });
  }

  function noi(chu, ms) {
    var b = nutLV.querySelector('.tl-noi'); b.textContent = chu; b.classList.add('hien');
    clearTimeout(henCu[1]); henCu[1] = setTimeout(function () { b.classList.remove('hien'); }, ms || 3000);
  }
  function bat(mo) {
    gan();
    el.hidden = !mo; nutLV.classList.toggle('on', mo); nutLV.setAttribute('aria-expanded', mo);
    if (mo) {
      cuChi('nhay', 900); nutLV.querySelector('.tl-noi').classList.remove('hien');
      var mic = el.querySelector('.tl-mic'); if (mic) mic.hidden = !choNoi();
      if (!daChao) { them('tl', chao()); daChao = true; }
      setTimeout(function () { el.querySelector('input').focus(); }, 40);
      // nạp sẵn giọng đọc tích hợp (khoảng 0,1 giây) để câu trả lời đầu tiên đọc ngay
      var gd = giong(); if (gd && gd.tichHop) App.GiongDoc.tai().catch(function () { /* báo khi đọc */ });
    } else { cuChi('tambiet', 1300, '👋'); ngungDoc(); GN.phien = false; if (GN.nghe) try { GN.rec.abort(); } catch (e) { /* bỏ qua */ } }
  }
  function them(ai, html) {
    var ds = el.querySelector('.tl-ds'), d = document.createElement('div');
    d.className = 'tl-tn ' + ai; d.innerHTML = html;
    if (ai === 'tl' && coDoc() && html.length > 20) d.insertAdjacentHTML('afterbegin', '<button type="button" class="tl-doclai" data-tl="doc" title="Đọc câu trả lời" aria-label="Đọc câu trả lời">' + ICON_LOA + '</button>');
    ds.appendChild(d);
    if (ai === 'tl') d.scrollIntoView({ block: 'nearest' }); else ds.scrollTop = ds.scrollHeight;
    return d;
  }
  function hoiTL(cau) {
    var tuMic = GN.tuMic; GN.tuMic = false;
    if (tuMic && GN.lienTuc) GN.phien = true;
    them('toi', (tuMic ? '🎤 ' : '') + h(cau));
    // lệnh giọng nói
    var qn = cn(cau);
    if (/^(dung|dung lai|thoi|im|im lang|ngung|ngung doc|stop)$/.test(qn)) { ngungDoc(); GN.phien = false; them('tl', 'Đã dừng.'); return; }
    if (/^(doc lai|nhac lai|noi lai)$/.test(qn)) { if (GN.cuoi) { them('tl', GN.cuoi); doc(GN.cuoi); } return; }
    if (/^(ket thuc|tam biet|bye|chao tam biet)$/.test(qn)) { GN.phien = false; var tb = 'Tạm biệt! Khi cần, bạn cứ bấm vào tôi hoặc nhấn Ctrl + K nhé.'; them('tl', tb); if (tuMic || GN.docTuDong) doc(tb); cuChi('tambiet', 1500, '👋'); return; }
    var dang = them('tl go', '<span></span><span></span><span></span>'), loi = camXucLoi(qn);
    if (loi) bieuCam(loi); else cuChi('nghi', 600, '🔍');
    setTimeout(function () {
      var kq;
      try { kq = traLoi(cau); } catch (e) { kq = 'Xin lỗi, có lỗi khi tìm câu trả lời: ' + h(e.message); if (window.console) console.error(e); }
      dang.remove();
      them('tl', kq); GN.cuoi = kq;
      bieuCam(CX || ['noi', 1400]);
      // hỏi bằng giọng nói (hoặc bật tự đọc) thì đọc câu trả lời; nói chuyện liên tục: đọc xong tự nghe tiếp
      var tiep = GN.phien && GN.lienTuc ? function () { if (GN.phien && !el.hidden) setTimeout(batNghe, 350); } : null;
      if ((tuMic || GN.docTuDong) && !doc(kq, tiep)) { if (tiep) tiep(); }
    }, 350);
  }
  function dieuHuong(v) {
    var p = v.split(':'), loai = p[0], a = p[1], b = p[2];
    if (loai === 'trang') location.hash = '#' + a;
    else if (loai === 'hdp') location.hash = '#huongdan?p=' + a;
    else if (loai === 'dm') App.moDanhMuc(a);
    else if (loai === 'cd') { if (App.moCaiDat) App.moCaiDat(a); else location.hash = '#caidat'; }
    else if (loai === 'hs') App.moHoSo(a, b || 'canhan');
    else if (loai === 'cc') { if (App.moChamCong) App.moChamCong(a); else location.hash = '#chamcong'; }
    else if (loai === 'doi') { if (App.moTongQuanDoi) App.moTongQuanDoi(a); else location.hash = '#tongquandoi'; }
    else if (loai === 'pl') { if (App.moPhieuLuong) App.moPhieuLuong(a); else location.hash = '#phieuluong'; }
    if (window.innerWidth < 900) bat(false);
  }

  // gắn sau khi giao diện chính đã dựng (có dữ liệu, đã đăng nhập)
  var goc = App.batDauGiaoDien;
  App.batDauGiaoDien = function () { var r = goc.apply(this, arguments); gan(); return r; };
  App.TroLy = { cuChi: function (g, ms, emo) { gan(); cuChi(g, ms, emo); }, netMat: function (f, ms) { gan(); netMat(f, ms); }, chuDoc: chuDoc, traLoi: traLoi, timHuongDan: timHuongDan, timNguoi: timNguoi, timDonVi: timDonVi, bat: function (mo) { gan(); bat(mo !== false); }, hoi: function (c) { gan(); bat(true); hoiTL(c); } };
})();
