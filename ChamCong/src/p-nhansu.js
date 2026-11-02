/* Phân hệ Nhân sự: hợp đồng lao động, quyết định (quá trình công tác, khen thưởng, kỷ luật), đơn nghỉ phép,
   báo cáo nhân sự; mẫu in hợp đồng và sơ yếu lý lịch. */
(function () {
  'use strict';
  var App = window.App, TL = window.TL, h = App.h;
  function F() { return App.F; }
  function hn() { return App.homNay(); }
  function soNgay(a, b) { return Math.round((new Date(b) - new Date(a)) / 864e5); }
  function cong(iso, ngay) { var n = TL.docNgay(iso); return TL.congNgay(n.y, n.m, n.d, ngay); }
  function themThang(iso, th) { var n = TL.docNgay(iso), t = new Date(n.y, n.m - 1 + th, n.d - 1); return TL.iso(t.getFullYear(), t.getMonth() + 1, t.getDate()); }
  function chonNV(ten, v, chiDangLam) {
    return '<select name="' + ten + '">' + App.db.nhanVien.filter(function (n) { return !chiDangLam || n.trangThai !== 'nghi_viec'; })
      .sort(function (a, b) { return String(a.ma).localeCompare(String(b.ma), 'vi', { numeric: true }); })
      .map(function (n) { return '<option value="' + n.id + '"' + (n.id === v ? ' selected' : '') + '>' + h(n.ma + ' – ' + n.hoTen) + '</option>'; }).join('') + '</select>';
  }
  function luuVaVe(nv) { if (nv) App.dongBoHoSo(nv); App.luu(); App.veLai(); }

  /* ================= Hợp đồng ================= */

  /** Hợp đồng đang có hiệu lực hôm nay (hoặc hợp đồng mới nhất) */
  App.hdHieuLuc = function (nv) {
    var ds = (nv.hopDong || []).slice().sort(function (a, b) { return (b.tuNgay || '') < (a.tuNgay || '') ? -1 : 1; });
    var d = hn();
    return ds.filter(function (x) { return (!x.tuNgay || x.tuNgay <= d) && (!x.denNgay || x.denNgay >= d); })[0] || ds[0] || null;
  };
  App.nhanHetHan = function (iso) {
    if (!iso) return '';
    var con = soNgay(hn(), iso);
    if (con < 0) return ' <span class="the-tt">đã hết</span>';
    if (con <= 30) return ' <span class="the-tt ' + (con <= 7 ? 'do' : 'cam') + '">còn ' + con + ' ngày</span>';
    return '';
  };
  App.ttHopDong = function (x) {
    var d = hn();
    if (x.tuNgay && x.tuNgay > d) return '<span class="the-tt lam">Chưa hiệu lực</span>';
    if (x.denNgay && x.denNgay < d) return '<span class="the-tt">Đã hết hạn</span>';
    if (x.denNgay && soNgay(d, x.denNgay) <= 30) return '<span class="the-tt ' + (soNgay(d, x.denNgay) <= 7 ? 'do' : 'cam') + '">Sắp hết hạn (' + soNgay(d, x.denNgay) + ' ngày)</span>';
    return '<span class="the-tt xanh">Còn hiệu lực</span>';
  };
  function soHDMoi() {
    var y = new Date().getFullYear(), max = 0;
    App.db.nhanVien.forEach(function (nv) { (nv.hopDong || []).forEach(function (x) { var m = String(x.so || '').match(/^(\d+)\/(\d{4})/); if (m && +m[2] === y) max = Math.max(max, +m[1]); }); });
    return TL.pad(max + 1) + '/' + y + '/HĐLĐ';
  }

  App.formHopDong = function (nv, i, sauKhiLuu) {
    var db = App.db, moi = i == null;
    var x = moi ? {
      so: soHDMoi(), loai: nv.trangThai === 'thu_viec' ? 'Thử việc' : 'Xác định thời hạn', ngayKy: hn(), tuNgay: hn(), chucDanh: nv.chucVu || '',
      luongCB: nv.luongCB, diaDiem: db.congTy.diaChi || '', congViec: ''
    } : JSON.parse(JSON.stringify(nv.hopDong[i]));
    if (moi) x.denNgay = themThang(x.tuNgay, x.loai === 'Thử việc' ? 2 : 12);
    var f = F();
    App.hop({
      tieuDe: (moi ? 'Thêm hợp đồng – ' : 'Sửa hợp đồng – ') + nv.hoTen, co: 'rong',
      than: '<form class="form ba" onsubmit="return false">' +
        f.o('Số hợp đồng', f.txt('so', x.so)) + f.o('Loại hợp đồng', f.sel('loai', x.loai, App.LOAI_HD)) + f.o('Ngày ký', f.ngay('ngayKy', x.ngayKy)) +
        f.o('Có hiệu lực từ ngày', f.ngay('tuNgay', x.tuNgay)) + f.o('Đến ngày', f.ngay('denNgay', x.denNgay), 'Để trống nếu không xác định thời hạn') +
        f.o('Chức danh chuyên môn', f.txt('chucDanh', x.chucDanh)) +
        f.o('Mức lương theo hợp đồng (đ)', f.tien('luongCB', x.luongCB)) + f.o('Phụ cấp, thưởng (ghi trong HĐ)', f.txt('phuCap', x.phuCap, 'placeholder="vd Cơm trưa 50.000 đ/ngày làm việc"'), '', '') +
        f.o('Địa điểm làm việc', f.txt('diaDiem', x.diaDiem)) +
        f.o('Công việc phải làm', f.vung('congViec', x.congViec), '', 'ca') + f.o('Ghi chú', f.txt('ghiChu', x.ghiChu), '', 'ca') +
        '<div class="ca" id="hd-cn">' +
        f.chk('capNhat', true, 'Cập nhật hồ sơ theo hợp đồng này (loại HĐ, ngày hết hạn, chức danh; hết thử việc thì chuyển “Đang làm việc”, hưởng 100% lương)') + '<br>' +
        '<span id="hd-luong">' + f.chk('apLuong', false, 'Áp dụng mức lương này từ ngày hiệu lực (tạo quyết định điều chỉnh lương; các kỳ trước giữ lương cũ ' + App.tien(nv.luongCB) + ' đ)') + '</span></div>' +
        '</form>',
      moRa: function (el) {
        App.$$('input.tien', el).forEach(App.ganOTien);
        var fm = App.$('form', el);
        function capNhat() {
          var l = App.docSo(fm.luongCB.value);
          App.$('#hd-luong', el).style.display = l && l !== +nv.luongCB ? '' : 'none';
          fm.denNgay.disabled = fm.loai.value === 'Không xác định thời hạn';
          if (fm.denNgay.disabled) fm.denNgay.value = '';
        }
        fm.loai.onchange = function () {
          if (this.value === 'Thử việc' && fm.tuNgay.value) fm.denNgay.value = themThang(fm.tuNgay.value, 2);
          else if (this.value === 'Xác định thời hạn' && fm.tuNgay.value) fm.denNgay.value = themThang(fm.tuNgay.value, 12);
          capNhat();
        };
        fm.luongCB.addEventListener('change', capNhat);
        fm.luongCB.addEventListener('blur', capNhat);
        capNhat();
        if (!moi) { var cn = App.$('[name=capNhat]', el); cn.checked = App.hdHieuLuc(nv) === nv.hopDong[i]; }
      },
      nut: [{ ten: 'Huỷ' }, {
        ten: 'Lưu hợp đồng', loai: 'chinh', bam: function (el) {
          var v = F().doc(el);
          if (!v.tuNgay) { App.bao('Nhập ngày hiệu lực.', 'loi'); return false; }
          if (v.denNgay && v.denNgay < v.tuNgay) { App.bao('Ngày kết thúc phải sau ngày hiệu lực.', 'loi'); return false; }
          var hd = Object.assign(x, {
            so: v.so.trim(), loai: v.loai, ngayKy: v.ngayKy, tuNgay: v.tuNgay, denNgay: v.loai === 'Không xác định thời hạn' ? '' : v.denNgay,
            chucDanh: v.chucDanh.trim(), luongCB: App.docSo(v.luongCB), phuCap: v.phuCap.trim(), diaDiem: v.diaDiem.trim(), congViec: v.congViec.trim(), ghiChu: v.ghiChu.trim()
          });
          if (!hd.id) hd.id = App.uid();
          if (moi) nv.hopDong.push(hd); else nv.hopDong[i] = hd;
          var tb = [];
          if (v.apLuong && hd.luongCB && hd.luongCB !== +nv.luongCB) {
            var loi = App.themNangLuong(nv, { so: 'Theo HĐ ' + hd.so, ngay: hd.ngayKy, hieuLuc: hd.tuNgay, luongMoi: hd.luongCB, noiDung: 'Điều chỉnh lương theo hợp đồng số ' + hd.so });
            if (loi) { App.bao(loi, 'loi'); return false; }
            tb.push('đã tạo quyết định điều chỉnh lương');
          }
          if (v.capNhat) {
            nv.loaiHD = hd.loai; nv.ngayHetHD = hd.denNgay || '';
            if (hd.chucDanh) nv.chucVu = hd.chucDanh;
            if (nv.trangThai === 'thu_viec' && hd.loai !== 'Thử việc') { nv.trangThai = 'dang_lam'; nv.tiLeHuong = 100; tb.push('chuyển sang Đang làm việc, hưởng 100% lương'); }
            if (hd.loai === 'Thử việc' && nv.trangThai === 'dang_lam' && !(nv.hopDong.length > 1)) nv.trangThai = 'thu_viec';
          }
          luuVaVe(nv);
          App.bao('Đã lưu hợp đồng ' + hd.so + (tb.length ? ' (' + tb.join(', ') + ')' : ''), 'tot');
          if (sauKhiLuu) sauKhiLuu();
        }
      }]
    });
  };

  /** Mẫu in hợp đồng lao động (tham khảo theo Bộ luật Lao động 2019, Thông tư 10/2020/TT-BLĐTBXH) */
  App.inHopDong = function (nv, hd) {
    var ct = App.db.congTy, cd = App.db.caiDat;
    var lld = TL.loaiLDNV(App.db, nv), nghi = (lld ? lld.nghiTuan : cd.nghiTuan || [0]).slice().sort(function (a, b) { return (a || 7) - (b || 7); }).map(function (t) { return TL.TEN_THU_DAY[t].toLowerCase(); }).join(', ');
    var ngay = TL.docNgay(hd.ngayKy || hn());
    var pn = (nv.phepNam === '' || nv.phepNam == null ? cd.phepNam : nv.phepNam);
    var dong = function (a, b) { return '<tr><td style="width:42%">' + a + '</td><td>' + b + '</td></tr>'; };
    var html = '<div class="vb trang">' +
      '<div class="qh"><div>' + h((ct.ten || '').toUpperCase()) + '<span>Số: ' + h(hd.so || '……') + '</span></div><div>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<span><u>Độc lập – Tự do – Hạnh phúc</u></span></div></div>' +
      '<h1>HỢP ĐỒNG LAO ĐỘNG</h1>' +
      '<p class="giua"><i>(' + h(hd.loai || '') + ')</i></p>' +
      '<p><i>Căn cứ Bộ luật Lao động số 45/2019/QH14 ngày 20 tháng 11 năm 2019;<br>Căn cứ nhu cầu và năng lực của hai bên,</i></p>' +
      '<p>Hôm nay, ngày ' + ngay.d + ' tháng ' + ngay.m + ' năm ' + ngay.y + ', tại ' + h(ct.ten || '') + ', chúng tôi gồm:</p>' +
      '<p class="dieu">Bên A (Người sử dụng lao động): ' + h(ct.ten || '') + '</p><table class="tt">' +
      dong('Đại diện: Ông/Bà', '<b>' + h(ct.giamDoc || '………………………') + '</b> – Chức vụ: Giám đốc') +
      dong('Địa chỉ', h(ct.diaChi || '………………………')) + dong('Điện thoại', h(ct.dienThoai || '……………')) + dong('Mã số thuế', h(ct.mst || '……………')) + '</table>' +
      '<p class="dieu">Bên B (Người lao động): Ông/Bà ' + h(nv.hoTen) + '</p><table class="tt">' +
      dong('Ngày sinh', TL.hienNgay(nv.ngaySinh) + (nv.noiSinh ? ' – Nơi sinh: ' + h(nv.noiSinh) : '')) + dong('Giới tính', h(nv.gioiTinh || '')) +
      dong('Số CCCD', h(nv.cccd || '……………') + ' – cấp ngày ' + (TL.hienNgay(nv.ngayCapCCCD) || '……') + ' tại ' + h(nv.noiCapCCCD || '……………')) +
      dong('Địa chỉ thường trú', h(nv.thuongTru || nv.diaChi || '……………')) + dong('Chỗ ở hiện nay', h(nv.diaChi || '……………')) + dong('Điện thoại', h(nv.sdt || '……………')) + '</table>' +
      '<p>Thỏa thuận ký kết hợp đồng lao động và cam kết thực hiện đúng những điều khoản sau đây:</p>' +
      '<p class="dieu">Điều 1. Công việc, địa điểm làm việc và thời hạn hợp đồng</p>' +
      '<p>– Loại hợp đồng: ' + h(hd.loai || '') + '; có hiệu lực từ ngày ' + TL.hienNgay(hd.tuNgay) + (hd.denNgay ? ' đến ngày ' + TL.hienNgay(hd.denNgay) : '') + '.</p>' +
      '<p>– Chức danh chuyên môn: ' + h(hd.chucDanh || nv.chucVu || '') + '; bộ phận: ' + h(TL.tenPhongBan(App.db, nv.phongBan)) + '.</p>' +
      '<p>– Công việc phải làm: ' + h(hd.congViec || 'Theo sự phân công của người phụ trách bộ phận và quy chế của công ty.') + '</p>' +
      '<p>– Địa điểm làm việc: ' + h(hd.diaDiem || ct.diaChi || '……………') + '.</p>' +
      '<p class="dieu">Điều 2. Thời giờ làm việc, thời giờ nghỉ ngơi</p>' +
      '<p>– Thời giờ làm việc: ' + cd.gioLamNgay + ' giờ/ngày, từ ' + cd.gioVao + ' đến ' + cd.gioRa + ', nghỉ trưa ' + cd.nghiTruaTu + ' – ' + cd.nghiTruaDen + '; nghỉ hằng tuần: ' + h(nghi || 'theo lịch phân công') + '.</p>' +
      '<p>– Nghỉ lễ, Tết, nghỉ việc riêng theo Bộ luật Lao động; nghỉ hằng năm ' + pn + ' ngày/năm (tăng theo thâm niên theo quy định).</p>' +
      '<p class="dieu">Điều 3. Tiền lương, phụ cấp và các chế độ</p>' +
      '<p>– Mức lương: <b>' + App.tien(hd.luongCB) + ' đồng/' + ({ ngay: 'ngày', gio: 'giờ' }[nv.hinhThuc] || 'tháng') + '</b> (' + TL.docSo(hd.luongCB).replace(/ đồng$/, '') + ' đồng)' + (nv.tiLeHuong && +nv.tiLeHuong !== 100 && hd.loai === 'Thử việc' ? '; trong thời gian thử việc hưởng ' + nv.tiLeHuong + '% mức lương' : '') + '.</p>' +
      (hd.phuCap ? '<p>– Phụ cấp, các khoản bổ sung: ' + h(hd.phuCap) + '.</p>' : '') +
      '<p>– Hình thức trả lương: ' + (nv.soTK ? 'chuyển khoản vào tài khoản ' + h(nv.soTK) + (nv.nganHang ? ' tại ' + h(nv.nganHang) : '') : 'tiền mặt hoặc chuyển khoản') + '; trả 2 kỳ/tháng (tạm ứng kỳ I, thanh toán kỳ II).</p>' +
      '<p>– Chế độ nâng lương, thưởng: theo quy chế của công ty và kết quả công việc.</p>' +
      '<p>– Bảo hiểm xã hội, bảo hiểm y tế, bảo hiểm thất nghiệp: ' + (hd.loai === 'Thử việc' ? 'thực hiện khi ký hợp đồng lao động chính thức' : 'hai bên đóng theo quy định của pháp luật') + '.</p>' +
      '<p class="dieu">Điều 4. Quyền và nghĩa vụ của người lao động</p>' +
      '<p>Được hưởng đầy đủ quyền lợi theo hợp đồng và pháp luật; chấp hành nội quy lao động, quy chế, sự điều hành hợp pháp của người sử dụng lao động; bồi thường thiệt hại khi vi phạm theo quy định.</p>' +
      '<p class="dieu">Điều 5. Quyền và nghĩa vụ của người sử dụng lao động</p>' +
      '<p>Bảo đảm việc làm, trả lương đầy đủ, đúng hạn và các chế độ theo hợp đồng; được điều hành, khen thưởng, xử lý kỷ luật lao động theo quy định của pháp luật và nội quy lao động.</p>' +
      '<p class="dieu">Điều 6. Điều khoản thi hành</p>' +
      '<p>Những vấn đề chưa ghi trong hợp đồng này thực hiện theo nội quy lao động, thỏa ước lao động tập thể (nếu có) và pháp luật lao động. Hợp đồng lập thành 02 bản có giá trị như nhau, mỗi bên giữ 01 bản.</p>' +
      (hd.ghiChu ? '<p><i>Ghi chú: ' + h(hd.ghiChu) + '</i></p>' : '') +
      '<div class="ky2"><div>NGƯỜI LAO ĐỘNG<span>(Ký, ghi rõ họ tên)</span>' + h(nv.hoTen) + '</div><div>NGƯỜI SỬ DỤNG LAO ĐỘNG<span>(Ký, ghi rõ họ tên, đóng dấu)</span>' + h(ct.giamDoc || '') + '</div></div>' +
      '</div>';
    App.inNoiDung(html);
    App.bao('Mẫu hợp đồng tham khảo – kiểm tra lại điều khoản theo quy chế công ty trước khi ký.');
  };

  /* ================= Quyết định ================= */

  App.mauQD = function (l) { return { nang_luong: 'xanh', khen_thuong: 'xanh', ky_luat: 'do', thoi_viec: 'do', bo_nhiem: 'lam', dieu_chuyen: 'lam', tiep_nhan: 'lam' }[l] || ''; };
  App.tomTatQD = function (q) {
    var s = [], db = App.db;
    if (q.loai === 'nang_luong') s.push('Lương: ' + App.tien(q.luongCu) + ' → <b>' + App.tien(q.luongMoi) + '</b>' + (q.luongBHMoi ? '; lương đóng BH → ' + App.tien(q.luongBHMoi) : ''));
    if (q.loai === 'bo_nhiem' || q.loai === 'dieu_chuyen') {
      if (q.phongBanMoi && q.phongBanMoi !== q.phongBanCu) s.push(h(TL.tenPhongBan(db, q.phongBanCu) || '—') + ' → <b>' + h(TL.tenPhongBan(db, q.phongBanMoi)) + '</b>');
      if (q.chucVuMoi && q.chucVuMoi !== q.chucVuCu) s.push('Chức vụ: ' + h(q.chucVuCu || '—') + ' → <b>' + h(q.chucVuMoi) + '</b>');
    }
    if (q.loai === 'khen_thuong' || q.loai === 'ky_luat') {
      if (q.hinhThuc) s.push(h(q.hinhThuc));
      if (+q.soTien) s.push((q.loai === 'khen_thuong' ? 'Thưởng ' : 'Phạt / bồi thường ') + '<b>' + App.tien(q.soTien) + ' đ</b>' + (q.kyLuong ? ' vào lương kỳ ' + q.kyLuong.slice(5) + '/' + q.kyLuong.slice(0, 4) : ''));
    }
    if (q.loai === 'thoi_viec') s.push('Nghỉ việc từ ngày ' + TL.hienNgay(q.hieuLuc) + (q.lyDo ? ' – ' + h(q.lyDo) : ''));
    if (q.noiDung) s.push('<span class="mo">' + h(q.noiDung) + '</span>');
    return s.join('; ');
  };

  /** Thêm quyết định nâng lương (dùng chung cho hợp đồng): trả về thông báo lỗi nếu không hợp lệ */
  App.themNangLuong = function (nv, q) {
    var sau = (nv.quyetDinh || []).filter(function (x) { return x.loai === 'nang_luong' && x.hieuLuc > q.hieuLuc; });
    if (sau.length) return 'Đã có quyết định nâng lương hiệu lực ' + TL.hienNgay(sau[0].hieuLuc) + ' (sau ngày ' + TL.hienNgay(q.hieuLuc) + '). Hãy sửa quyết định đó thay vì thêm mới.';
    var x = Object.assign({ id: App.uid(), loai: 'nang_luong', luongCu: +nv.luongCB || 0 }, q);
    if (x.luongBHMoi) x.luongBHCu = +nv.luongBH || 0;
    nv.quyetDinh.push(x);
    nv.luongCB = +x.luongMoi;
    if (x.luongBHMoi) nv.luongBH = +x.luongBHMoi;
    return '';
  };

  function kyKhoa(k) { if (!k) return false; var T = App.db.thang[k]; return !!(T && T.khoa); }

  App.formQuyetDinh = function (nv, i, loaiMacDinh, sauKhiLuu) {
    var db = App.db, moi = i == null, f = F();
    var q = moi ? { loai: loaiMacDinh || 'khen_thuong', ngay: hn(), hieuLuc: hn(), kyLuong: TL.khoaKy(App.ky.y, App.ky.m) } : JSON.parse(JSON.stringify(nv.quyetDinh[i]));
    function phan(loai, nvx) {
      nvx = nvx || nv;
      var hl = '<label class="o">' + (loai === 'thoi_viec' ? 'Nghỉ việc kể từ ngày' : 'Ngày hiệu lực') + f.ngay('hieuLuc', q.hieuLuc) + '</label>';
      var x = hl;
      if (loai === 'bo_nhiem' || loai === 'dieu_chuyen') {
        x += f.o('Phòng ban / bộ phận mới', f.sel('phongBanMoi', q.phongBanMoi || (nvx && nvx.phongBan), db.phongBan.map(function (p) { return [p.ma, p.ten]; }))) +
          f.o('Chức vụ mới', f.txt('chucVuMoi', q.chucVuMoi != null ? q.chucVuMoi : (nvx && nvx.chucVu)));
      } else if (loai === 'nang_luong') {
        x += f.o('Mức lương mới (đ)', f.tien('luongMoi', q.luongMoi || (nvx && nvx.luongCB)), moi && nvx ? 'Hiện tại: ' + App.tien(nvx.luongCB) : 'Lương cũ: ' + App.tien(q.luongCu)) +
          f.o('Lương đóng BH mới (nếu đặt riêng)', f.tien('luongBHMoi', q.luongBHMoi, 'Không đổi'));
      } else if (loai === 'khen_thuong' || loai === 'ky_luat') {
        x += f.o(loai === 'khen_thuong' ? 'Hình thức khen thưởng' : 'Hình thức kỷ luật', loai === 'khen_thuong' ? f.txt('hinhThuc', q.hinhThuc, 'placeholder="vd Giấy khen, Lao động tiên tiến"') :
          f.sel('hinhThuc', q.hinhThuc || 'Khiển trách', ['Khiển trách', 'Kéo dài thời hạn nâng lương không quá 6 tháng', 'Cách chức', 'Sa thải', 'Bồi thường thiệt hại', 'Khác'])) +
          f.o(loai === 'khen_thuong' ? 'Tiền thưởng (đ)' : 'Tiền bồi thường / khấu trừ (đ)', f.tien('soTien', q.soTien, '0')) +
          f.o('Đưa vào bảng lương kỳ', '<input type="month" name="kyLuong" value="' + h(q.kyLuong || '') + '">', 'Để trống = không đưa vào lương');
      } else if (loai === 'thoi_viec') {
        x += f.o('Lý do', f.txt('lyDo', q.lyDo, 'placeholder="vd Đơn phương chấm dứt HĐ, nghỉ hưu…"'));
      }
      return x;
    }
    var dsNV = !nv;
    App.hop({
      tieuDe: (moi ? 'Thêm quyết định' : 'Sửa quyết định') + (nv ? ' – ' + nv.hoTen : ''), co: '',
      than: '<form class="form" onsubmit="return false">' +
        (dsNV ? f.o('Nhân viên', chonNV('nvId', '', false), '', 'ca') : '') +
        f.o('Loại quyết định', moi ? f.sel('loai', q.loai, f.cap(TL.LOAI_QD)) : '<input readonly value="' + h(TL.LOAI_QD[q.loai]) + '"><input type="hidden" name="loai" value="' + q.loai + '">') +
        f.o('Số quyết định', f.txt('so', q.so, 'placeholder="vd 25/QĐ-CT"')) + f.o('Ngày ký', f.ngay('ngay', q.ngay)) + '<span></span>' +
        '<div class="ca form" id="qd-phan" style="padding:0">' + phan(q.loai) + '</div>' +
        f.o('Nội dung / trích yếu', f.vung('noiDung', q.noiDung), '', 'ca') + '</form>',
      moRa: function (el) {
        var fm = App.$('form', el);
        var nvHT = function () { return nv || App.timNV(fm.nvId.value); };
        var ve2 = function () {
          var cu = F().doc(App.$('#qd-phan', el)); Object.assign(q, cu);
          App.$('#qd-phan', el).innerHTML = phan(fm.loai.value, nvHT());
          App.$$('#qd-phan input.tien', el).forEach(App.ganOTien);
        };
        if (fm.loai.tagName === 'SELECT') fm.loai.onchange = function () { q.loai = this.value; ve2(); };
        if (fm.nvId) fm.nvId.onchange = function () { q.luongMoi = ''; q.phongBanMoi = ''; q.chucVuMoi = null; ve2(); };
        ve2();
      },
      nut: [{ ten: 'Huỷ' }, {
        ten: 'Lưu quyết định', loai: 'chinh', bam: function (el) {
          var v = F().doc(el), nvx = nv || App.timNV(v.nvId);
          if (!nvx) { App.bao('Chọn nhân viên.', 'loi'); return false; }
          if (!v.hieuLuc) { App.bao('Nhập ngày hiệu lực.', 'loi'); return false; }
          var tb = [];
          if (moi) {
            var x = { id: App.uid(), loai: v.loai, so: v.so.trim(), ngay: v.ngay, hieuLuc: v.hieuLuc, noiDung: v.noiDung.trim() };
            if (v.loai === 'nang_luong') {
              var lm = App.docSo(v.luongMoi);
              if (!lm) { App.bao('Nhập mức lương mới.', 'loi'); return false; }
              var loi = App.themNangLuong(nvx, Object.assign(x, { luongMoi: lm, luongBHMoi: App.docSo(v.luongBHMoi) || '' }));
              if (loi) { App.bao(loi, 'loi'); return false; }
              tb.push('mức lương mới áp dụng từ kỳ có ngày ' + TL.hienNgay(v.hieuLuc));
            } else {
              if (v.loai === 'bo_nhiem' || v.loai === 'dieu_chuyen') {
                Object.assign(x, { phongBanCu: nvx.phongBan, chucVuCu: nvx.chucVu, phongBanMoi: v.phongBanMoi, chucVuMoi: v.chucVuMoi.trim() });
                nvx.phongBan = v.phongBanMoi; if (x.chucVuMoi) nvx.chucVu = x.chucVuMoi;
                tb.push('đã cập nhật phòng ban, chức vụ');
              }
              if (v.loai === 'khen_thuong' || v.loai === 'ky_luat') {
                Object.assign(x, { hinhThuc: v.hinhThuc, soTien: App.docSo(v.soTien), kyLuong: v.kyLuong });
                if (x.soTien && x.kyLuong) tb.push(kyKhoa(x.kyLuong) ? 'kỳ lương ' + x.kyLuong.slice(5) + '/' + x.kyLuong.slice(0, 4) + ' đã chốt: cần mở khoá để tính vào lương' : 'đã đưa vào bảng lương kỳ ' + x.kyLuong.slice(5) + '/' + x.kyLuong.slice(0, 4));
              }
              if (v.loai === 'thoi_viec') {
                x.lyDo = v.lyDo.trim(); x.trangThaiCu = nvx.trangThai; x.ngayNghiCu = nvx.ngayNghi || '';
                nvx.ngayNghi = cong(v.hieuLuc, -1); nvx.trangThai = 'nghi_viec';
                tb.push('ngày làm việc cuối: ' + TL.hienNgay(nvx.ngayNghi));
              }
              if (v.loai === 'tiep_nhan' && (!nvx.ngayVao || nvx.ngayVao > v.hieuLuc)) { nvx.ngayVao = v.hieuLuc; tb.push('ngày vào làm ' + TL.hienNgay(v.hieuLuc)); }
              nvx.quyetDinh.push(x);
            }
          } else {
            var y0 = nvx.quyetDinh[i];
            Object.assign(y0, { so: v.so.trim(), ngay: v.ngay, noiDung: v.noiDung.trim() });
            if (y0.loai === 'nang_luong') {
              var lm2 = App.docSo(v.luongMoi), sau = nvx.quyetDinh.filter(function (z) { return z !== y0 && z.loai === 'nang_luong' && z.hieuLuc > v.hieuLuc; });
              if (!lm2) { App.bao('Nhập mức lương mới.', 'loi'); return false; }
              var laMoiNhat = !nvx.quyetDinh.some(function (z) { return z !== y0 && z.loai === 'nang_luong' && z.hieuLuc > y0.hieuLuc; });
              if (laMoiNhat && sau.length) { App.bao('Ngày hiệu lực mới nằm trước quyết định nâng lương khác – không đổi được.', 'loi'); return false; }
              y0.hieuLuc = v.hieuLuc; y0.luongMoi = lm2; y0.luongBHMoi = App.docSo(v.luongBHMoi) || '';
              if (laMoiNhat) { nvx.luongCB = lm2; if (y0.luongBHMoi) nvx.luongBH = y0.luongBHMoi; }
            } else {
              y0.hieuLuc = v.hieuLuc;
              if (y0.loai === 'khen_thuong' || y0.loai === 'ky_luat') Object.assign(y0, { hinhThuc: v.hinhThuc, soTien: App.docSo(v.soTien), kyLuong: v.kyLuong });
              if (y0.loai === 'thoi_viec') { y0.lyDo = v.lyDo.trim(); nvx.ngayNghi = cong(v.hieuLuc, -1); }
              if (y0.loai === 'bo_nhiem' || y0.loai === 'dieu_chuyen') { y0.phongBanMoi = v.phongBanMoi; y0.chucVuMoi = v.chucVuMoi.trim(); nvx.phongBan = v.phongBanMoi; if (y0.chucVuMoi) nvx.chucVu = y0.chucVuMoi; }
            }
          }
          luuVaVe(nvx);
          App.bao('Đã lưu quyết định' + (tb.length ? ': ' + tb.join('; ') : ''), 'tot');
          if (sauKhiLuu) sauKhiLuu();
        }
      }]
    });
  };

  App.xoaQuyetDinh = function (nv, i) {
    var q = nv.quyetDinh[i];
    var moiNhat = !nv.quyetDinh.some(function (z) { return z !== q && z.loai === q.loai && (z.hieuLuc || '') > (q.hieuLuc || ''); });
    var them = q.loai === 'nang_luong' && moiNhat ? '<br>Mức lương sẽ trở về ' + App.tien(q.luongCu) + ' đ.' :
      q.loai === 'thoi_viec' ? '<br>Nhân viên sẽ được chuyển lại trạng thái đang làm việc.' :
        (q.loai === 'bo_nhiem' || q.loai === 'dieu_chuyen') && moiNhat ? '<br>Phòng ban, chức vụ trở về như trước quyết định.' : '';
    App.xacNhan('Xoá quyết định <b>' + h(TL.LOAI_QD[q.loai]) + '</b> ' + h(q.so || '') + '?' + them, { nut: 'Xoá', nguy: true }).then(function (ok) {
      if (!ok) return;
      if (q.loai === 'nang_luong' && moiNhat) { nv.luongCB = +q.luongCu || 0; if (q.luongBHCu != null && q.luongBHCu !== '') nv.luongBH = +q.luongBHCu; }
      if (q.loai === 'thoi_viec') { nv.ngayNghi = q.ngayNghiCu || ''; nv.trangThai = q.trangThaiCu && q.trangThaiCu !== 'nghi_viec' ? q.trangThaiCu : 'dang_lam'; }
      if ((q.loai === 'bo_nhiem' || q.loai === 'dieu_chuyen') && moiNhat) { if (q.phongBanCu) nv.phongBan = q.phongBanCu; if (q.chucVuCu != null) nv.chucVu = q.chucVuCu; }
      nv.quyetDinh.splice(i, 1);
      luuVaVe(nv);
    });
  };

  /* ================= Đơn nghỉ ================= */

  var TT_DON = { cho: ['Chờ duyệt', 'cam'], duyet: ['Đã duyệt', 'xanh'], tuchoi: ['Từ chối', ''] };
  function kyHieuNghi() { return App.db.kyHieu.filter(function (k) { return !(k.lam > 0 && !k.phep) && k.nhom !== 'kp'; }); }

  App.bangDonNghi = function (ds, anTen) {
    var kh = TL.bangKyHieu(App.db);
    return '<div class="cuon"><table class="bang"><thead><tr>' + (anTen ? '' : '<th>Nhân viên</th><th>Phòng ban</th>') +
      '<th>Loại nghỉ</th><th>Từ ngày</th><th>Đến ngày</th><th class="so">Số ngày làm việc</th><th style="min-width:180px">Lý do</th><th>Trạng thái</th><th></th></tr></thead><tbody>' +
      (ds.length ? ds.map(function (d) {
        var nv = App.timNV(d.nvId) || {}, k = kh[String(d.kyHieu).toUpperCase()], t = TT_DON[d.trangThai] || TT_DON.cho;
        var so = nv.id ? TL.ngayLamTrongKhoang(App.db, nv, d.tuNgay, d.denNgay).length * ((k && k.huong + k.lam < 1) || /\/2$/.test(d.kyHieu) ? 0.5 : 1) : 0;
        return '<tr data-don="' + d.id + '">' + (anTen ? '' : '<td class="ten"><span class="lk" data-hs="' + d.nvId + '">' + h(nv.hoTen || '?') + '</span></td><td>' + h(TL.tenPhongBan(App.db, nv.phongBan)) + '</td>') +
          '<td><b style="background:var(--k-' + (k ? k.nhom : 'khong') + ');padding:1px 6px;border-radius:4px">' + h(d.kyHieu) + '</b> ' + h(k ? k.ten : '') + '</td>' +
          '<td class="giua">' + TL.hienNgay(d.tuNgay) + '</td><td class="giua">' + TL.hienNgay(d.denNgay) + '</td><td class="so">' + App.so(so) + '</td>' +
          '<td style="white-space:normal">' + h(d.lyDo) + '</td><td><span class="the-tt ' + t[1] + '">' + t[0] + '</span></td><td style="white-space:nowrap">' +
          (d.trangThai === 'cho' ? '<button class="nut nho xanh" data-a="duyet">Duyệt</button> <button class="nut nho" data-a="tuchoi">Từ chối</button> ' : '') +
          (d.trangThai === 'duyet' ? '<button class="nut nho" data-a="huy" title="Huỷ duyệt: xoá các ngày đã chấm">Huỷ duyệt</button> ' : '') +
          '<button class="nut nho nguy" data-a="xoa" title="Xoá đơn">' + App.icon('xoa') + '</button></td></tr>';
      }).join('') : '<tr><td colspan="9" class="trong">Không có đơn nghỉ.</td></tr>') + '</tbody></table></div>';
  };

  function duyetDon(d) {
    var kq = TL.apDungDonNghi(App.db, d);
    d.trangThai = 'duyet'; d.ngayDuyet = hn();
    App.luu();
    var tb = 'Đã duyệt: chấm “' + d.kyHieu + '” ' + kq.cham.length + ' ngày vào bảng chấm công.';
    if (kq.trung.length) tb += ' Giữ nguyên ' + kq.trung.length + ' ngày đã chấm nghỉ khác (' + kq.trung.map(TL.hienNgay).join(', ') + ').';
    if (kq.khoa.length) tb += ' ' + kq.khoa.length + ' ngày thuộc kỳ đã chốt lương – chưa chấm.';
    App.bao(tb, kq.khoa.length ? 'loi' : 'tot');
  }

  App.xuLyNutDon = function (e) {
    var hs = e.target.closest('[data-hs]'); if (hs) { App.moHoSo(hs.dataset.hs, 'phep'); return; }
    var b = e.target.closest('[data-a]'), tr = e.target.closest('tr[data-don]');
    if (!b || !tr) return;
    var d = App.db.donNghi.filter(function (x) { return x.id === tr.dataset.don; })[0]; if (!d) return;
    var a = b.dataset.a;
    if (a === 'duyet') { duyetDon(d); App.veLai(); }
    else if (a === 'tuchoi') { d.trangThai = 'tuchoi'; App.luu(); App.veLai(); }
    else if (a === 'huy') { var n = TL.boDonNghi(App.db, d); d.trangThai = 'cho'; App.luu(); App.bao('Đã huỷ duyệt, xoá ' + n + ' ngày đã chấm.'); App.veLai(); }
    else if (a === 'xoa') App.xacNhan('Xoá đơn nghỉ này?' + (d.trangThai === 'duyet' ? ' Các ngày đã chấm theo đơn sẽ được xoá khỏi bảng chấm công.' : ''), { nut: 'Xoá', nguy: true }).then(function (ok) {
      if (!ok) return;
      if (d.trangThai === 'duyet') TL.boDonNghi(App.db, d);
      App.db.donNghi = App.db.donNghi.filter(function (x) { return x !== d; }); App.luu(); App.veLai();
    });
  };

  App.formDonNghi = function (nvId) {
    var f = F(), ds = kyHieuNghi();
    App.hop({
      tieuDe: 'Tạo đơn xin nghỉ', co: 'hep',
      than: '<form class="form" style="grid-template-columns:1fr 1fr" onsubmit="return false">' +
        f.o('Nhân viên', chonNV('nvId', nvId, true), '', 'ca') +
        f.o('Loại nghỉ', f.sel('kyHieu', 'P', ds.map(function (k) { return [k.ma, k.ma + ' – ' + k.ten]; })), '', 'ca') +
        f.o('Từ ngày', f.ngay('tuNgay', hn())) + f.o('Đến ngày', f.ngay('denNgay', hn())) +
        f.o('Lý do', f.txt('lyDo', ''), '', 'ca') + '<div class="ca goi-y" id="dn-thongtin"></div></form>',
      moRa: function (el) {
        var fm = App.$('form', el);
        var tinh = function () {
          var nv = App.timNV(fm.nvId.value); if (!nv) return;
          if (fm.denNgay.value < fm.tuNgay.value) fm.denNgay.value = fm.tuNgay.value;
          var so = TL.ngayLamTrongKhoang(App.db, nv, fm.tuNgay.value, fm.denNgay.value).length;
          var k = TL.bangKyHieu(App.db)[fm.kyHieu.value.toUpperCase()];
          var nua = k && (k.huong + k.lam) < 1 || /\/2$/.test(fm.kyHieu.value);
          var pn = TL.phepNam(App.db, nv, +fm.tuNgay.value.slice(0, 4) || App.ky.y);
          App.$('#dn-thongtin', el).innerHTML = '<b>' + App.so(so * (nua ? 0.5 : 1)) + '</b> ngày làm việc (đã bỏ ngày nghỉ tuần, ngày lễ).' +
            (k && k.phep ? ' Phép năm còn lại: <b>' + App.so(pn.conLai) + '</b> ngày' + (pn.conLai < so * (nua ? 0.5 : 1) ? ' – <span style="color:var(--do)">không đủ phép</span>' : '') + '.' : '');
        };
        ['nvId', 'kyHieu', 'tuNgay', 'denNgay'].forEach(function (n) { fm[n].addEventListener('change', tinh); });
        tinh();
      },
      nut: [{ ten: 'Huỷ' }, { ten: 'Lưu (chờ duyệt)', bam: function (el) { return luuDon(el, false); } }, { ten: 'Lưu và duyệt', loai: 'chinh', bam: function (el) { return luuDon(el, true); } }]
    });
    function luuDon(el, duyet) {
      var v = F().doc(el);
      if (!v.nvId || !v.tuNgay || !v.denNgay) { App.bao('Chọn nhân viên và ngày nghỉ.', 'loi'); return false; }
      var d = { id: App.uid(), nvId: v.nvId, kyHieu: v.kyHieu, tuNgay: v.tuNgay, denNgay: v.denNgay < v.tuNgay ? v.tuNgay : v.denNgay, lyDo: v.lyDo.trim(), trangThai: 'cho', ngayTao: hn() };
      App.db.donNghi.push(d);
      if (duyet) duyetDon(d); else { App.luu(); App.bao('Đã lưu đơn nghỉ – chờ duyệt.'); }
      App.veLai();
    }
  };

  /* ================= Sơ yếu lý lịch ================= */
  App.inSoYeu = function (nv) {
    var db = App.db, ct = db.congTy;
    var r = function (a, b) { return '<tr><td style="width:36%">' + a + '</td><td>' + (b || '') + '</td></tr>'; };
    var hdHL = App.hdHieuLuc(nv);
    var qd = (nv.quyetDinh || []).slice().sort(function (a, b) { return (a.hieuLuc || '') < (b.hieuLuc || '') ? -1 : 1; });
    var html = '<div class="vb trang">' +
      '<div class="qh"><div>' + h((ct.ten || '').toUpperCase()) + '</div><div>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<span><u>Độc lập – Tự do – Hạnh phúc</u></span></div></div>' +
      '<div class="anh34">' + (nv.anh ? '<img src="' + nv.anh + '">' : 'Ảnh 3×4') + '</div>' +
      '<h1 style="margin-top:28px">SƠ YẾU LÝ LỊCH</h1><p class="giua"><i>Mã nhân viên: ' + h(nv.ma) + '</i></p><div style="clear:both"></div>' +
      '<p class="dieu">I. THÔNG TIN CÁ NHÂN</p><table class="kb">' +
      r('Họ và tên', '<b>' + h((nv.hoTen || '').toUpperCase()) + '</b>') + r('Giới tính', h(nv.gioiTinh)) + r('Ngày sinh', TL.hienNgay(nv.ngaySinh)) +
      r('Nơi sinh', h(nv.noiSinh)) + r('Quê quán', h(nv.queQuan)) + r('Dân tộc / Tôn giáo / Quốc tịch', h([nv.danToc, nv.tonGiao, nv.quocTich].filter(Boolean).join(' / '))) +
      r('Số CCCD, ngày cấp, nơi cấp', h(nv.cccd || '') + (nv.ngayCapCCCD ? ' – ' + TL.hienNgay(nv.ngayCapCCCD) : '') + (nv.noiCapCCCD ? ' – ' + h(nv.noiCapCCCD) : '')) +
      r('Tình trạng hôn nhân', h(nv.honNhan)) + r('Địa chỉ thường trú', h(nv.thuongTru)) + r('Chỗ ở hiện nay', h(nv.diaChi)) +
      r('Điện thoại / Email', h([nv.sdt, nv.email].filter(Boolean).join(' / '))) + r('Người liên hệ khi cần', h(nv.lienHeKhanCap)) +
      r('Đảng viên', nv.dangVien ? 'Có' + (nv.ngayVaoDang ? ', ngày vào Đảng ' + TL.hienNgay(nv.ngayVaoDang) : '') : 'Không') + '</table>' +
      '<p class="dieu">II. TRÌNH ĐỘ</p><table class="kb">' +
      r('Học vấn phổ thông', h(nv.trinhDoHV)) + r('Trình độ chuyên môn', h([nv.trinhDoCM, nv.chuyenNganh].filter(Boolean).join(' – '))) +
      r('Trường, năm tốt nghiệp', h([nv.truongDT, nv.namTN].filter(Boolean).join(', '))) + r('Ngoại ngữ / Tin học', h([nv.ngoaiNgu, nv.tinHoc].filter(Boolean).join(' / '))) +
      r('Lý luận chính trị', h(nv.lyLuanCT)) + '</table>' +
      '<p class="dieu">III. CÔNG VIỆC HIỆN TẠI</p><table class="kb">' +
      r('Phòng ban / chức vụ', h(TL.tenPhongBan(db, nv.phongBan)) + ' – ' + h(nv.chucVu)) + r('Ngày vào làm', TL.hienNgay(nv.ngayVao)) +
      r('Hợp đồng lao động', hdHL ? h(hdHL.loai) + ' số ' + h(hdHL.so || '') + ', từ ' + TL.hienNgay(hdHL.tuNgay) + (hdHL.denNgay ? ' đến ' + TL.hienNgay(hdHL.denNgay) : '') : '') +
      r('Mã số BHXH / thẻ BHYT', h([nv.soSoBHXH, nv.maTheBHYT].filter(Boolean).join(' / '))) + r('Mã số thuế cá nhân', h(nv.mst)) + '</table>' +
      '<p class="dieu">IV. QUÁ TRÌNH CÔNG TÁC, KHEN THƯỞNG, KỶ LUẬT</p><table class="kb"><tr><th style="width:18%">Từ ngày</th><th style="width:24%">Quyết định</th><th>Nội dung</th></tr>' +
      (qd.length ? qd.map(function (q) { return '<tr><td>' + TL.hienNgay(q.hieuLuc) + '</td><td>' + h(TL.LOAI_QD[q.loai]) + (q.so ? '<br>' + h(q.so) : '') + '</td><td>' + App.tomTatQD(q).replace(/<[^>]+>/g, '') + '</td></tr>'; }).join('') : '<tr><td colspan="3">&nbsp;</td></tr>') + '</table>' +
      ((nv.nguoiPhuThuoc || []).length ? '<p class="dieu">V. NGƯỜI PHỤ THUỘC</p><table class="kb"><tr><th>Họ và tên</th><th>Quan hệ</th><th>Ngày sinh</th></tr>' +
        nv.nguoiPhuThuoc.map(function (p) { return '<tr><td>' + h(p.hoTen) + '</td><td>' + h(p.quanHe) + '</td><td>' + TL.hienNgay(p.ngaySinh) + '</td></tr>'; }).join('') + '</table>' : '') +
      '<p><i>Tôi xin cam đoan những lời khai trên là đúng sự thật.</i></p>' +
      '<div class="ky2"><div>XÁC NHẬN CỦA ĐƠN VỊ<span>(Ký, đóng dấu)</span></div><div>' + h(ct.diaDanh || '………') + ', ngày …… tháng …… năm ……<br>NGƯỜI KHAI<span>(Ký, ghi rõ họ tên)</span>' + h(nv.hoTen) + '</div></div></div>';
    App.inNoiDung(html);
  };

  /* ================= Trang: Hợp đồng lao động ================= */
  var stHD = { loc: '', pb: '', tim: '', tatCa: false };
  function veHD(noi) {
    var db = App.db, d = hn();
    var dong = [];
    db.nhanVien.forEach(function (nv) {
      if (stHD.pb && nv.phongBan !== stHD.pb) return;
      if (stHD.tim && !App.timKhop(nv.ma + ' ' + nv.hoTen, stHD.tim)) return;
      var ds = (nv.hopDong || []).slice().sort(function (a, b) { return (b.tuNgay || '') < (a.tuNgay || '') ? -1 : 1; });
      if (!stHD.tatCa) { var hl = App.hdHieuLuc(nv); ds = hl ? [hl] : []; }
      if (!ds.length && nv.trangThai !== 'nghi_viec') dong.push({ nv: nv, hd: null });
      ds.forEach(function (x) { dong.push({ nv: nv, hd: x }); });
    });
    dong = dong.filter(function (o) {
      var x = o.hd, dangLam = o.nv.trangThai !== 'nghi_viec';
      if (stHD.loc === 'chua') return !x;
      if (stHD.loc === 'sap') return x && x.denNgay && x.denNgay >= d && soNgay(d, x.denNgay) <= 30 && dangLam;
      if (stHD.loc === 'het') return x && x.denNgay && x.denNgay < d && dangLam;
      if (stHD.loc === 'hl') return x && (!x.denNgay || x.denNgay >= d) && x.tuNgay <= d;
      return stHD.tatCa || dangLam;
    });
    var dem = { sap: 0, het: 0, chua: 0 };
    db.nhanVien.forEach(function (nv) {
      if (nv.trangThai === 'nghi_viec') return;
      var x = App.hdHieuLuc(nv);
      if (!x) dem.chua++; else if (x.denNgay && x.denNgay < d) dem.het++; else if (x.denNgay && soNgay(d, x.denNgay) <= 30) dem.sap++;
    });
    noi.innerHTML = '<div class="kpis">' +
      '<div class="kpi"><div class="nhan">Sắp hết hạn (30 ngày)</div><div class="gt" style="color:var(--cam)">' + dem.sap + '</div><div class="phu">cần gia hạn / ký mới</div></div>' +
      '<div class="kpi"><div class="nhan">Đã hết hạn, chưa ký mới</div><div class="gt" style="color:var(--do)">' + dem.het + '</div><div class="phu">nhân viên đang làm việc</div></div>' +
      '<div class="kpi"><div class="nhan">Chưa có hợp đồng</div><div class="gt">' + dem.chua + '</div><div class="phu">nhân viên đang làm việc</div></div></div>' +
      '<div class="the khong-in" style="padding:12px 14px"><div class="hang">' +
      '<select id="hd-loc"><option value="">Hợp đồng của nhân viên đang làm</option><option value="hl"' + (stHD.loc === 'hl' ? ' selected' : '') + '>Còn hiệu lực</option><option value="sap"' + (stHD.loc === 'sap' ? ' selected' : '') + '>Sắp hết hạn (30 ngày)</option><option value="het"' + (stHD.loc === 'het' ? ' selected' : '') + '>Đã hết hạn</option><option value="chua"' + (stHD.loc === 'chua' ? ' selected' : '') + '>Chưa có hợp đồng</option></select>' +
      '<select id="hd-pb"><option value="">Tất cả phòng ban</option>' + db.phongBan.map(function (p) { return '<option value="' + h(p.ma) + '"' + (stHD.pb === p.ma ? ' selected' : '') + '>' + h(p.ten) + '</option>'; }).join('') + '</select>' +
      '<input type="search" id="hd-tim" placeholder="Tìm nhân viên…" value="' + h(stHD.tim) + '" style="width:170px">' +
      '<label class="chk"><input type="checkbox" id="hd-tatca"' + (stHD.tatCa ? ' checked' : '') + '> Hiện cả hợp đồng cũ</label><span class="gian"></span>' +
      '<button class="nut" id="hd-xuat">' + App.icon('tai') + 'Xuất Excel</button><button class="nut chinh" id="hd-moi">' + App.icon('them') + 'Ký hợp đồng mới</button></div></div>' +
      App.dauIn('DANH SÁCH HỢP ĐỒNG LAO ĐỘNG', 'Ngày ' + new Date().toLocaleDateString('vi-VN')) +
      '<div class="cuon cao"><table class="bang"><thead><tr><th>STT</th><th>Mã NV</th><th style="min-width:160px">Họ và tên</th><th>Phòng ban</th><th>Số HĐ</th><th>Loại hợp đồng</th><th>Ngày ký</th><th>Từ ngày</th><th>Đến ngày</th><th class="so">Mức lương</th><th>Tình trạng</th><th class="khong-in"></th></tr></thead><tbody>' +
      (dong.length ? dong.map(function (o, i) {
        var x = o.hd;
        return '<tr data-nv="' + o.nv.id + '" data-hd="' + (x ? x.id || '' : '') + '"><td class="giua">' + (i + 1) + '</td><td>' + h(o.nv.ma) + '</td><td class="ten"><span class="lk" data-hs="' + o.nv.id + '">' + h(o.nv.hoTen) + '</span></td><td>' + h(TL.tenPhongBan(db, o.nv.phongBan)) + '</td>' +
          (x ? '<td>' + h(x.so) + '</td><td>' + h(x.loai) + '</td><td class="giua">' + TL.hienNgay(x.ngayKy) + '</td><td class="giua">' + TL.hienNgay(x.tuNgay) + '</td><td class="giua">' + (TL.hienNgay(x.denNgay) || '—') + '</td><td class="so">' + App.tienRong(x.luongCB) + '</td><td>' + App.ttHopDong(x) + '</td>' +
            '<td class="khong-in" style="white-space:nowrap"><button class="nut nho" data-a="in" title="In hợp đồng">' + App.icon('in') + '</button> <button class="nut nho" data-a="sua" title="Sửa">' + App.icon('sua') + '</button> <button class="nut nho" data-a="moi" title="Ký hợp đồng tiếp theo">' + App.icon('them') + '</button></td>'
            : '<td colspan="6" class="mo">Chưa có hợp đồng</td><td><span class="the-tt cam">Thiếu HĐ</span></td><td class="khong-in"><button class="nut nho chinh" data-a="moi">' + App.icon('them') + 'Thêm</button></td>') + '</tr>';
      }).join('') : '<tr><td colspan="12" class="trong">Không có hợp đồng phù hợp bộ lọc.</td></tr>') + '</tbody></table></div>';
    App.$('#hd-loc').onchange = function () { stHD.loc = this.value; App.veLai(); };
    App.$('#hd-pb').onchange = function () { stHD.pb = this.value; App.veLai(); };
    App.$('#hd-tim').oninput = function () { stHD.tim = this.value; var v = this.value; App.veLai(); var i = App.$('#hd-tim'); i.focus(); i.setSelectionRange(v.length, v.length); };
    App.$('#hd-tatca').onchange = function () { stHD.tatCa = this.checked; App.veLai(); };
    App.$('#hd-moi').onclick = function () {
      App.hop({
        tieuDe: 'Ký hợp đồng mới', co: 'hep', than: '<form class="form" style="grid-template-columns:1fr" onsubmit="return false">' + F().o('Nhân viên', chonNV('nvId', '', true)) + '</form>',
        nut: [{ ten: 'Huỷ' }, { ten: 'Tiếp tục', loai: 'chinh', bam: function (el) { var nv = App.timNV(F().doc(el).nvId); if (nv) setTimeout(function () { App.formHopDong(nv, null); }, 0); } }]
      });
    };
    App.$('#hd-xuat').onclick = function () {
      App.xuatExcel('Danh_sach_hop_dong', [App.sheetBang({
        ten: 'Hợp đồng', tieuDe: 'DANH SÁCH HỢP ĐỒNG LAO ĐỘNG', phuDe: 'Ngày ' + new Date().toLocaleDateString('vi-VN'), chuKy: false, coCot: 3,
        cot: [{ t: 'STT', stt: true, w: 5, kieu: 'giua' }, { t: 'Mã NV', w: 8, f: function (o) { return o.nv.ma; } }, { t: 'Họ và tên', w: 24, f: function (o) { return o.nv.hoTen; } },
          { t: 'Phòng ban', w: 24, f: function (o) { return TL.tenPhongBan(db, o.nv.phongBan); } }, { t: 'Số HĐ', w: 16, f: function (o) { return o.hd ? o.hd.so : ''; } },
          { t: 'Loại hợp đồng', w: 22, f: function (o) { return o.hd ? o.hd.loai : 'Chưa có hợp đồng'; } }, { t: 'Ngày ký', w: 11, kieu: 'giua', f: function (o) { return o.hd ? TL.hienNgay(o.hd.ngayKy) : ''; } },
          { t: 'Từ ngày', w: 11, kieu: 'giua', f: function (o) { return o.hd ? TL.hienNgay(o.hd.tuNgay) : ''; } }, { t: 'Đến ngày', w: 11, kieu: 'giua', f: function (o) { return o.hd ? TL.hienNgay(o.hd.denNgay) : ''; } },
          { t: 'Mức lương', w: 13, kieu: 'so', f: function (o) { return o.hd ? o.hd.luongCB : 0; } },
          { t: 'Tình trạng', w: 20, f: function (o) { return o.hd ? App.ttHopDong(o.hd).replace(/<[^>]+>/g, '') : 'Thiếu hợp đồng'; } }],
        dong: dong
      })]);
    };
    noi.onclick = function (e) {
      var hs = e.target.closest('[data-hs]'); if (hs) { App.moHoSo(hs.dataset.hs, 'hopdong'); return; }
      var b = e.target.closest('[data-a]'), tr = e.target.closest('tr[data-nv]'); if (!b || !tr) return;
      var nv = App.timNV(tr.dataset.nv), i = (nv.hopDong || []).findIndex(function (x) { return x.id === tr.dataset.hd; });
      if (b.dataset.a === 'in' && i >= 0) App.inHopDong(nv, nv.hopDong[i]);
      else if (b.dataset.a === 'sua' && i >= 0) App.formHopDong(nv, i);
      else if (b.dataset.a === 'moi') App.formHopDong(nv, null);
    };
  }

  /* ================= Trang: Quyết định ================= */
  var stQD = { nam: '', loai: '', tim: '' };
  function veQD(noi) {
    var db = App.db, nam = stQD.nam || String(App.ky.y);
    var ds = [];
    db.nhanVien.forEach(function (nv) {
      (nv.quyetDinh || []).forEach(function (q, i) {
        var y = (q.hieuLuc || q.ngay || '').slice(0, 4);
        if (nam !== 'all' && y !== nam) return;
        if (stQD.loai && q.loai !== stQD.loai) return;
        if (stQD.tim && !App.timKhop(nv.ma + ' ' + nv.hoTen + ' ' + (q.so || '') + ' ' + (q.noiDung || ''), stQD.tim)) return;
        ds.push({ nv: nv, q: q, i: i });
      });
    });
    ds.sort(function (a, b) { return (b.q.hieuLuc || '') < (a.q.hieuLuc || '') ? -1 : 1; });
    var nams = {}; nams[App.ky.y] = 1; db.nhanVien.forEach(function (nv) { (nv.quyetDinh || []).forEach(function (q) { if (q.hieuLuc) nams[q.hieuLuc.slice(0, 4)] = 1; }); });
    var tong = { khen_thuong: 0, ky_luat: 0 };
    ds.forEach(function (o) { if (tong[o.q.loai] != null) tong[o.q.loai] += +o.q.soTien || 0; });
    noi.innerHTML = '<div class="the khong-in" style="padding:12px 14px"><div class="hang">' +
      '<select id="qd-nam"><option value="all"' + (nam === 'all' ? ' selected' : '') + '>Mọi năm</option>' + Object.keys(nams).sort().reverse().map(function (y) { return '<option' + (y === nam ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select>' +
      '<select id="qd-loai"><option value="">Mọi loại quyết định</option>' + Object.keys(TL.LOAI_QD).map(function (k) { return '<option value="' + k + '"' + (stQD.loai === k ? ' selected' : '') + '>' + TL.LOAI_QD[k] + '</option>'; }).join('') + '</select>' +
      '<input type="search" id="qd-tim" placeholder="Tìm tên, số QĐ, nội dung…" value="' + h(stQD.tim) + '" style="width:220px"><span class="gian"></span>' +
      '<button class="nut" id="qd-xuat">' + App.icon('tai') + 'Xuất Excel</button><button class="nut chinh" id="qd-moi">' + App.icon('them') + 'Thêm quyết định</button></div>' +
      '<div class="mo nho" style="margin-top:8px">' + ds.length + ' quyết định' + (tong.khen_thuong ? ' · tiền thưởng ' + App.tien(tong.khen_thuong) + ' đ' : '') + (tong.ky_luat ? ' · tiền phạt / bồi thường ' + App.tien(tong.ky_luat) + ' đ' : '') +
      '. Nâng lương tự áp dụng từ kỳ có ngày hiệu lực; thưởng / phạt có tiền tự vào bảng lương kỳ đã chọn.</div></div>' +
      App.dauIn('DANH SÁCH QUYẾT ĐỊNH', nam === 'all' ? '' : 'Năm ' + nam) +
      '<div class="cuon cao"><table class="bang"><thead><tr><th>Hiệu lực</th><th>Loại</th><th>Số QĐ</th><th>Ngày ký</th><th style="min-width:160px">Nhân viên</th><th>Phòng ban</th><th style="min-width:300px">Nội dung</th><th class="khong-in"></th></tr></thead><tbody>' +
      (ds.length ? ds.map(function (o) {
        return '<tr data-nv="' + o.nv.id + '" data-i="' + o.i + '"><td class="giua">' + TL.hienNgay(o.q.hieuLuc) + '</td><td><span class="the-tt ' + App.mauQD(o.q.loai) + '">' + h(TL.LOAI_QD[o.q.loai]) + '</span></td><td>' + h(o.q.so) + '</td><td class="giua">' + TL.hienNgay(o.q.ngay) + '</td>' +
          '<td class="ten"><span class="lk" data-hs="' + o.nv.id + '">' + h(o.nv.hoTen) + '</span></td><td>' + h(TL.tenPhongBan(db, o.nv.phongBan)) + '</td><td style="white-space:normal">' + App.tomTatQD(o.q) + '</td>' +
          '<td class="khong-in" style="white-space:nowrap"><button class="nut nho" data-a="sua">' + App.icon('sua') + '</button> <button class="nut nho nguy" data-a="xoa">' + App.icon('xoa') + '</button></td></tr>';
      }).join('') : '<tr><td colspan="8" class="trong">Chưa có quyết định.</td></tr>') + '</tbody></table></div>';
    App.$('#qd-nam').onchange = function () { stQD.nam = this.value; App.veLai(); };
    App.$('#qd-loai').onchange = function () { stQD.loai = this.value; App.veLai(); };
    App.$('#qd-tim').oninput = function () { stQD.tim = this.value; var v = this.value; App.veLai(); var i = App.$('#qd-tim'); i.focus(); i.setSelectionRange(v.length, v.length); };
    App.$('#qd-moi').onclick = function () { App.formQuyetDinh(null, null, stQD.loai || 'khen_thuong'); };
    App.$('#qd-xuat').onclick = function () {
      App.xuatExcel('Danh_sach_quyet_dinh', [App.sheetBang({
        ten: 'Quyết định', tieuDe: 'DANH SÁCH QUYẾT ĐỊNH', phuDe: nam === 'all' ? '' : 'Năm ' + nam, chuKy: false,
        cot: [{ t: 'STT', stt: true, w: 5, kieu: 'giua' }, { t: 'Hiệu lực', w: 11, kieu: 'giua', f: function (o) { return TL.hienNgay(o.q.hieuLuc); } }, { t: 'Loại', w: 20, f: function (o) { return TL.LOAI_QD[o.q.loai]; } },
          { t: 'Số QĐ', w: 14, f: function (o) { return o.q.so || ''; } }, { t: 'Ngày ký', w: 11, kieu: 'giua', f: function (o) { return TL.hienNgay(o.q.ngay); } },
          { t: 'Mã NV', w: 8, f: function (o) { return o.nv.ma; } }, { t: 'Họ và tên', w: 22, f: function (o) { return o.nv.hoTen; } },
          { t: 'Nội dung', w: 60, f: function (o) { return App.tomTatQD(o.q).replace(/<[^>]+>/g, ''); } }, { t: 'Số tiền', w: 13, kieu: 'so', f: function (o) { return +o.q.soTien || 0; } }],
        dong: ds
      })]);
    };
    noi.onclick = function (e) {
      var hs = e.target.closest('[data-hs]'); if (hs) { App.moHoSo(hs.dataset.hs, 'quatrinh'); return; }
      var b = e.target.closest('[data-a]'), tr = e.target.closest('tr[data-nv]'); if (!b || !tr) return;
      var nv = App.timNV(tr.dataset.nv), i = +tr.dataset.i;
      if (b.dataset.a === 'sua') App.formQuyetDinh(nv, i); else App.xoaQuyetDinh(nv, i);
    };
  }

  /* ================= Trang: Đơn nghỉ phép ================= */
  var stDN = { tt: 'cho', tim: '' };
  function veDN(noi) {
    var db = App.db;
    var ds = (db.donNghi || []).filter(function (d) {
      if (stDN.tt && d.trangThai !== stDN.tt) return false;
      var nv = App.timNV(d.nvId);
      if (stDN.tim && !(nv && App.timKhop(nv.ma + ' ' + nv.hoTen, stDN.tim))) return false;
      return true;
    }).sort(function (a, b) { return a.tuNgay < b.tuNgay ? 1 : -1; });
    var cho = (db.donNghi || []).filter(function (d) { return d.trangThai === 'cho'; }).length;
    noi.innerHTML = '<div class="the khong-in" style="padding:12px 14px"><div class="hang">' +
      '<div class="nut-nhom" id="dn-tt">' + [['cho', 'Chờ duyệt' + (cho ? ' (' + cho + ')' : '')], ['duyet', 'Đã duyệt'], ['tuchoi', 'Từ chối'], ['', 'Tất cả']].map(function (t) { return '<button class="nut' + (stDN.tt === t[0] ? ' chon' : '') + '" data-tt="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<input type="search" id="dn-tim" placeholder="Tìm nhân viên…" value="' + h(stDN.tim) + '" style="width:180px"><span class="gian"></span>' +
      '<button class="nut chinh" id="dn-moi">' + App.icon('them') + 'Tạo đơn nghỉ</button></div>' +
      '<div class="mo nho" style="margin-top:8px">Khi <b>duyệt</b>, phần mềm tự chấm ký hiệu nghỉ (P, Ô, KL…) vào bảng chấm công cho các ngày làm việc trong khoảng nghỉ (bỏ ngày nghỉ tuần, ngày lễ), thay cho ô đang chấm đi làm. Huỷ duyệt hoặc xoá đơn thì xoá lại các ô đó.</div></div>' +
      App.bangDonNghi(ds, false);
    App.$('#dn-tt').onclick = function (e) { var b = e.target.closest('[data-tt]'); if (b) { stDN.tt = b.dataset.tt; App.veLai(); } };
    App.$('#dn-tim').oninput = function () { stDN.tim = this.value; var v = this.value; App.veLai(); var i = App.$('#dn-tim'); i.focus(); i.setSelectionRange(v.length, v.length); };
    App.$('#dn-moi').onclick = function () { App.formDonNghi(''); };
    noi.onclick = App.xuLyNutDon;
  }

  /* ================= Trang: Báo cáo nhân sự ================= */
  var stBC = { tab: 'cocau', thangSN: new Date().getMonth() + 1 };
  var TABS_BC = [['cocau', 'Cơ cấu lao động'], ['biendong', 'Biến động lao động'], ['trichngang', 'Danh sách trích ngang'], ['sinhnhat', 'Sinh nhật'], ['hethan', 'Hợp đồng sắp hết hạn'], ['nghihuu', 'Đến tuổi nghỉ hưu'], ['ktkl', 'Khen thưởng, kỷ luật']];

  function tuoi(ns, ngay) { var a = TL.docNgay(ns), b = TL.docNgay(ngay); if (!a || !b) return null; return b.y - a.y - ((b.m < a.m || (b.m === a.m && b.d < a.d)) ? 1 : 0); }
  function dangLamNgay(nv, ngay) { return (!nv.ngayVao || nv.ngayVao <= ngay) && (!nv.ngayNghi || nv.ngayNghi >= ngay) && !(nv.trangThai === 'nghi_viec' && !nv.ngayNghi); }

  function bangDon(cot, rows, tong) {
    var s = '<table class="bang"><thead><tr>' + cot.map(function (c) { return '<th class="' + (c.kieu === 'so' || c.kieu === 'cong' ? 'so' : '') + '">' + h(c.t) + '</th>'; }).join('') + '</tr></thead><tbody>';
    if (!rows.length) s += '<tr><td colspan="' + cot.length + '" class="trong">Không có dữ liệu.</td></tr>';
    rows.forEach(function (r, i) {
      s += '<tr' + (r.nv ? ' data-hs="' + r.nv.id + '" style="cursor:pointer"' : '') + '>' + cot.map(function (c) {
        var v = c.stt ? i + 1 : c.f ? c.f(r) : r[c.k];
        return '<td class="' + (c.kieu === 'so' || c.kieu === 'cong' ? 'so' : c.kieu === 'giua' || c.stt ? 'giua' : '') + '">' + (c.kieu === 'so' ? App.tienRong(v) : c.kieu === 'cong' ? App.soRong(v) : (c.html ? v : h(v == null ? '' : v))) + '</td>';
      }).join('') + '</tr>';
    });
    s += '</tbody>';
    if (tong) s += '<tfoot><tr class="tong">' + cot.map(function (c, i) { var v = tong[c.k]; return '<td class="' + (c.kieu ? 'so' : '') + '">' + (i === 1 ? 'Tổng cộng' : v != null ? (c.kieu === 'so' ? App.tien(v) : App.so(v)) : '') + '</td>'; }).join('') + '</tr></tfoot>';
    return s + '</table>';
  }

  var BCNS = {
    cocau: function () {
      var d = hn(), ds = App.db.nhanVien.filter(function (nv) { return dangLamNgay(nv, d); }), n = ds.length || 1;
      function nhom(fn, thuTu) {
        var g = {}; ds.forEach(function (nv) { var k = fn(nv) || '(Chưa nhập)'; g[k] = (g[k] || 0) + 1; });
        var ks = Object.keys(g);
        if (thuTu) ks.sort(function (a, b) { var ia = thuTu.indexOf(a), ib = thuTu.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); }); else ks.sort(function (a, b) { return g[b] - g[a]; });
        return ks.map(function (k) { return { nhan: k, so: g[k], tl: Math.round(g[k] / n * 1000) / 10 }; });
      }
      var tuoiNhom = function (nv) { var t = tuoi(nv.ngaySinh, d); return t == null ? '' : t < 30 ? 'Dưới 30' : t < 40 ? '30 – 39' : t < 50 ? '40 – 49' : 'Từ 50 trở lên'; };
      var tnNhom = function (nv) { var t = TL.thamNien(nv.ngayVao, d).nam; return !nv.ngayVao ? '' : t < 1 ? 'Dưới 1 năm' : t < 3 ? '1 – dưới 3 năm' : t < 5 ? '3 – dưới 5 năm' : t < 10 ? '5 – dưới 10 năm' : 'Từ 10 năm trở lên'; };
      var tongTuoi = 0, coTuoi = 0, tongTN = 0;
      ds.forEach(function (nv) { var t = tuoi(nv.ngaySinh, d); if (t != null) { tongTuoi += t; coTuoi++; } tongTN += TL.thamNien(nv.ngayVao, d).tongThang; });
      return {
        kpi: [['Tổng số lao động', ds.length], ['Lao động nữ', ds.filter(function (x) { return /n[ữu]/i.test(x.gioiTinh || ''); }).length], ['Tuổi bình quân', coTuoi ? Math.round(tongTuoi / coTuoi * 10) / 10 : 0],
          ['Thâm niên bình quân (năm)', ds.length ? Math.round(tongTN / ds.length / 12 * 10) / 10 : 0], ['Đảng viên', ds.filter(function (x) { return x.dangVien; }).length], ['Đoàn viên công đoàn', ds.filter(function (x) { return x.doanVien; }).length]],
        nhom: [
          ['Theo phòng ban', nhom(function (nv) { return TL.tenPhongBan(App.db, nv.phongBan); }, App.db.phongBan.map(function (p) { return p.ten; }))],
          ['Theo giới tính', nhom(function (nv) { return nv.gioiTinh; }, ['Nam', 'Nữ'])],
          ['Theo độ tuổi', nhom(tuoiNhom, ['Dưới 30', '30 – 39', '40 – 49', 'Từ 50 trở lên'])],
          ['Theo trình độ chuyên môn', nhom(function (nv) { return nv.trinhDoCM; }, App.TRINH_DO_CM.slice().reverse())],
          ['Theo loại hợp đồng', nhom(function (nv) { var x = App.hdHieuLuc(nv); return x ? x.loai : nv.loaiHD; }, App.LOAI_HD)],
          ['Theo loại lao động', nhom(function (nv) { return (TL.loaiLDNV(App.db, nv) || {}).ten || '(Theo cài đặt chung)'; })],
          ['Theo thâm niên', nhom(tnNhom, ['Dưới 1 năm', '1 – dưới 3 năm', '3 – dưới 5 năm', '5 – dưới 10 năm', 'Từ 10 năm trở lên'])]
        ]
      };
    },
    biendong: function () {
      var y = App.ky.y, rows = [];
      for (var m = 1; m <= 12; m++) {
        var dau = TL.iso(y, m, 1), cuoi = TL.iso(y, m, TL.soNgay(y, m)), truocDau = TL.congNgay(y, m, 1, -1);
        var tang = App.db.nhanVien.filter(function (nv) { return nv.ngayVao && nv.ngayVao >= dau && nv.ngayVao <= cuoi; });
        var giam = App.db.nhanVien.filter(function (nv) { return nv.ngayNghi && nv.ngayNghi >= truocDau && nv.ngayNghi < cuoi; });
        rows.push({
          thang: 'Tháng ' + m, dau: App.db.nhanVien.filter(function (nv) { return dangLamNgay(nv, dau); }).length, tang: tang.length, giam: giam.length,
          cuoi: App.db.nhanVien.filter(function (nv) { return dangLamNgay(nv, cuoi); }).length,
          ct: tang.map(function (x) { return '+ ' + x.hoTen; }).concat(giam.map(function (x) { return '− ' + x.hoTen; })).join('; ')
        });
      }
      return {
        tieuDe: 'BIẾN ĐỘNG LAO ĐỘNG NĂM ' + y, phuDe: 'Giảm: tính theo ngày nghỉ việc (ngày làm việc cuối cùng)',
        cot: [{ t: 'STT', stt: true, w: 5 }, { t: 'Tháng', k: 'thang', w: 12 }, { t: 'Đầu tháng', k: 'dau', kieu: 'cong', w: 10 }, { t: 'Tăng', k: 'tang', kieu: 'cong', w: 8 }, { t: 'Giảm', k: 'giam', kieu: 'cong', w: 8 }, { t: 'Cuối tháng', k: 'cuoi', kieu: 'cong', w: 10 }, { t: 'Chi tiết', k: 'ct', w: 60 }],
        rows: rows, tong: { tang: rows.reduce(function (s, r) { return s + r.tang; }, 0), giam: rows.reduce(function (s, r) { return s + r.giam; }, 0) }
      };
    },
    trichngang: function () {
      var d = hn(), db = App.db;
      var rows = db.nhanVien.filter(function (nv) { return nv.trangThai !== 'nghi_viec'; }).sort(function (a, b) { return String(a.ma).localeCompare(String(b.ma), 'vi', { numeric: true }); }).map(function (nv) { return { nv: nv }; });
      return {
        tieuDe: 'DANH SÁCH TRÍCH NGANG CÁN BỘ, NHÂN VIÊN', phuDe: 'Ngày ' + new Date().toLocaleDateString('vi-VN'),
        cot: [{ t: 'STT', stt: true, w: 5 }, { t: 'Mã NV', w: 8, f: function (r) { return r.nv.ma; } }, { t: 'Họ và tên', w: 22, f: function (r) { return r.nv.hoTen; } },
          { t: 'Giới tính', w: 7, f: function (r) { return r.nv.gioiTinh; } }, { t: 'Ngày sinh', w: 11, f: function (r) { return TL.hienNgay(r.nv.ngaySinh); } },
          { t: 'Quê quán', w: 18, f: function (r) { return r.nv.queQuan || ''; } }, { t: 'Số CCCD', w: 14, f: function (r) { return r.nv.cccd || ''; } },
          { t: 'Phòng ban', w: 22, f: function (r) { return TL.tenPhongBan(db, r.nv.phongBan); } }, { t: 'Chức vụ', w: 16, f: function (r) { return r.nv.chucVu || ''; } },
          { t: 'Trình độ', w: 18, f: function (r) { return [r.nv.trinhDoCM, r.nv.chuyenNganh].filter(Boolean).join(' – '); } },
          { t: 'Ngày vào', w: 11, f: function (r) { return TL.hienNgay(r.nv.ngayVao); } }, { t: 'Thâm niên', w: 9, f: function (r) { var t = TL.thamNien(r.nv.ngayVao, d); return r.nv.ngayVao ? t.nam + 'n ' + t.thang + 't' : ''; } },
          { t: 'Loại HĐ', w: 18, f: function (r) { var x = App.hdHieuLuc(r.nv); return x ? x.loai : r.nv.loaiHD || ''; } }, { t: 'Mức lương', w: 12, kieu: 'so', f: function (r) { return r.nv.luongCB; } },
          { t: 'Số sổ BHXH', w: 13, f: function (r) { return r.nv.soSoBHXH || ''; } }, { t: 'Điện thoại', w: 12, f: function (r) { return r.nv.sdt || ''; } }],
        rows: rows
      };
    },
    sinhnhat: function () {
      var m = stBC.thangSN, y = new Date().getFullYear();
      var rows = App.db.nhanVien.filter(function (nv) { return nv.trangThai !== 'nghi_viec' && nv.ngaySinh && +nv.ngaySinh.slice(5, 7) === m; })
        .sort(function (a, b) { return a.ngaySinh.slice(8) < b.ngaySinh.slice(8) ? -1 : 1; }).map(function (nv) { return { nv: nv }; });
      return {
        tieuDe: 'DANH SÁCH SINH NHẬT THÁNG ' + m, phuDe: '', chonThang: true,
        cot: [{ t: 'STT', stt: true, w: 5 }, { t: 'Ngày', w: 8, f: function (r) { return r.nv.ngaySinh.slice(8) + '/' + TL.pad(m); } }, { t: 'Họ và tên', w: 22, f: function (r) { return r.nv.hoTen; } },
          { t: 'Tuổi', w: 6, kieu: 'cong', f: function (r) { return y - +r.nv.ngaySinh.slice(0, 4); } }, { t: 'Phòng ban', w: 24, f: function (r) { return TL.tenPhongBan(App.db, r.nv.phongBan); } },
          { t: 'Chức vụ', w: 18, f: function (r) { return r.nv.chucVu || ''; } }, { t: 'Điện thoại', w: 12, f: function (r) { return r.nv.sdt || ''; } }],
        rows: rows
      };
    },
    hethan: function () {
      var d = hn(), rows = [];
      App.db.nhanVien.forEach(function (nv) {
        if (nv.trangThai === 'nghi_viec') return;
        var x = App.hdHieuLuc(nv);
        if (x && x.denNgay && soNgay(d, x.denNgay) <= 60) rows.push({ nv: nv, hd: x, con: soNgay(d, x.denNgay) });
      });
      rows.sort(function (a, b) { return a.con - b.con; });
      return {
        tieuDe: 'HỢP ĐỒNG LAO ĐỘNG HẾT HẠN TRONG 60 NGÀY', phuDe: 'Tính đến ngày ' + new Date().toLocaleDateString('vi-VN'),
        cot: [{ t: 'STT', stt: true, w: 5 }, { t: 'Họ và tên', w: 22, f: function (r) { return r.nv.hoTen; } }, { t: 'Phòng ban', w: 22, f: function (r) { return TL.tenPhongBan(App.db, r.nv.phongBan); } },
          { t: 'Số HĐ', w: 14, f: function (r) { return r.hd.so || ''; } }, { t: 'Loại', w: 20, f: function (r) { return r.hd.loai; } }, { t: 'Hết hạn', w: 11, f: function (r) { return TL.hienNgay(r.hd.denNgay); } },
          { t: 'Còn (ngày)', w: 9, kieu: 'cong', f: function (r) { return r.con < 0 ? 'Đã hết' : r.con; } }],
        rows: rows
      };
    },
    nghihuu: function () {
      var d = hn(), rows = [];
      App.db.nhanVien.forEach(function (nv) {
        if (nv.trangThai === 'nghi_viec') return;
        var nh = TL.ngayNghiHuu(nv.gioiTinh, nv.ngaySinh);
        if (nh && soNgay(d, nh) <= 730) rows.push({ nv: nv, nh: nh, con: soNgay(d, nh) });
      });
      rows.sort(function (a, b) { return a.con - b.con; });
      return {
        tieuDe: 'DANH SÁCH LAO ĐỘNG ĐẾN TUỔI NGHỈ HƯU TRONG 24 THÁNG TỚI', phuDe: 'Điều kiện lao động bình thường, theo lộ trình Nghị định 135/2020/NĐ-CP',
        cot: [{ t: 'STT', stt: true, w: 5 }, { t: 'Họ và tên', w: 22, f: function (r) { return r.nv.hoTen; } }, { t: 'Giới tính', w: 8, f: function (r) { return r.nv.gioiTinh; } },
          { t: 'Ngày sinh', w: 11, f: function (r) { return TL.hienNgay(r.nv.ngaySinh); } }, { t: 'Phòng ban', w: 22, f: function (r) { return TL.tenPhongBan(App.db, r.nv.phongBan); } },
          { t: 'Đủ tuổi nghỉ hưu', w: 13, f: function (r) { return TL.hienNgay(r.nh); } }, { t: 'Còn (ngày)', w: 9, kieu: 'cong', f: function (r) { return r.con < 0 ? 'Đã đủ' : r.con; } }],
        rows: rows
      };
    },
    ktkl: function () {
      var y = String(App.ky.y), rows = [];
      App.db.nhanVien.forEach(function (nv) { (nv.quyetDinh || []).forEach(function (q) { if ((q.loai === 'khen_thuong' || q.loai === 'ky_luat') && (q.hieuLuc || '').slice(0, 4) === y) rows.push({ nv: nv, q: q }); }); });
      rows.sort(function (a, b) { return a.q.hieuLuc < b.q.hieuLuc ? -1 : 1; });
      return {
        tieuDe: 'TỔNG HỢP KHEN THƯỞNG, KỶ LUẬT NĂM ' + y, phuDe: '',
        cot: [{ t: 'STT', stt: true, w: 5 }, { t: 'Ngày hiệu lực', w: 11, f: function (r) { return TL.hienNgay(r.q.hieuLuc); } }, { t: 'Loại', w: 12, f: function (r) { return TL.LOAI_QD[r.q.loai]; } },
          { t: 'Số QĐ', w: 14, f: function (r) { return r.q.so || ''; } }, { t: 'Họ và tên', w: 22, f: function (r) { return r.nv.hoTen; } }, { t: 'Hình thức', w: 26, f: function (r) { return r.q.hinhThuc || ''; } },
          { t: 'Số tiền', w: 13, kieu: 'so', k: 'tien', f: function (r) { return +r.q.soTien || 0; } }, { t: 'Nội dung', w: 40, f: function (r) { return r.q.noiDung || ''; } }],
        rows: rows
      };
    }
  };

  function veBCNS(noi) {
    noi.innerHTML = '<div class="tabs khong-in">' + TABS_BC.map(function (t) { return '<button data-t="' + t[0] + '"' + (stBC.tab === t[0] ? ' class="chon"' : '') + '>' + t[1] + '</button>'; }).join('') + '</div><div id="bcns"></div>';
    App.$('.tabs', noi).onclick = function (e) { var b = e.target.closest('[data-t]'); if (b) { stBC.tab = b.dataset.t; App.veLai(); } };
    var el = App.$('#bcns'), bc = BCNS[stBC.tab]();
    if (stBC.tab === 'cocau') {
      el.innerHTML = '<div class="kpis">' + bc.kpi.map(function (k) { return '<div class="kpi"><div class="nhan">' + k[0] + '</div><div class="gt">' + App.so(k[1]) + '</div></div>'; }).join('') + '</div>' +
        '<div class="hang khong-in" style="margin-bottom:12px"><span class="gian mo nho">Lao động đang làm việc tại ngày ' + new Date().toLocaleDateString('vi-VN') + '. Rê chuột lên thanh để xem tỷ lệ.</span><button class="nut" id="bc-xuat">' + App.icon('tai') + 'Xuất Excel</button><button class="nut" id="bc-in">' + App.icon('in') + 'In</button></div>' +
        App.dauIn('BÁO CÁO CƠ CẤU LAO ĐỘNG', 'Ngày ' + new Date().toLocaleDateString('vi-VN')) +
        '<div class="cot3">' + bc.nhom.map(function (g, i) { return '<div class="the"><h3>' + g[0] + '</h3><div id="cc-' + i + '"></div></div>'; }).join('') + '</div>';
      bc.nhom.forEach(function (g, i) {
        App.bieuDoNgang(App.$('#cc-' + i), g[1].map(function (x) { return { nhan: x.nhan, gt: x.so, tip: [['Số người', x.so], ['Tỷ lệ', App.so(x.tl) + '%']] }; }), { dinhDang: function (v) { return v + ' người'; } });
      });
      App.$('#bc-xuat').onclick = function () {
        var rows = [];
        bc.nhom.forEach(function (g) { rows.push({ _kieu: 'nhom', _nhan: g[0] }); g[1].forEach(function (x) { rows.push(x); }); });
        App.xuatExcel('Co_cau_lao_dong', [App.sheetBang({ ten: 'Cơ cấu lao động', tieuDe: 'BÁO CÁO CƠ CẤU LAO ĐỘNG', phuDe: 'Ngày ' + new Date().toLocaleDateString('vi-VN'),
          cot: [{ t: 'STT', stt: true, w: 5, kieu: 'giua' }, { t: 'Nhóm', k: 'nhan', w: 34 }, { t: 'Số người', k: 'so', kieu: 'cong', w: 10 }, { t: 'Tỷ lệ (%)', k: 'tl', kieu: 'cong', w: 10 }], dong: rows })]);
      };
      App.$('#bc-in').onclick = function () { App.inTrang(true); };
      return;
    }
    el.innerHTML = '<div class="the khong-in" style="padding:12px 14px"><div class="hang"><div class="gian"><b>' + h(bc.tieuDe) + '</b>' + (bc.phuDe ? ' <span class="mo">– ' + h(bc.phuDe) + '</span>' : '') + '</div>' +
      (bc.chonThang ? '<select id="bc-thang">' + Array.from({ length: 12 }, function (_, i) { return '<option value="' + (i + 1) + '"' + (stBC.thangSN === i + 1 ? ' selected' : '') + '>Tháng ' + (i + 1) + '</option>'; }).join('') + '</select>' : '') +
      '<button class="nut" id="bc-xuat">' + App.icon('tai') + 'Xuất Excel</button><button class="nut" id="bc-in">' + App.icon('in') + 'In</button></div></div>' +
      App.dauIn(bc.tieuDe, bc.phuDe) + '<div class="cuon cao">' + bangDon(bc.cot, bc.rows, bc.tong) + '</div>';
    var st2 = App.$('#bc-thang'); if (st2) st2.onchange = function () { stBC.thangSN = +this.value; App.veLai(); };
    App.$('#bc-in').onclick = function () { App.inTrang(stBC.tab !== 'trichngang'); };
    App.$('#bc-xuat').onclick = function () {
      App.xuatExcel(App.tenFile(bc.tieuDe), [App.sheetBang({ ten: TABS_BC.filter(function (t) { return t[0] === stBC.tab; })[0][1], tieuDe: bc.tieuDe, phuDe: bc.phuDe,
        cot: bc.cot.map(function (c) { return Object.assign({}, c, { kieu: c.stt ? 'giua' : c.kieu }); }), dong: bc.rows, tong: bc.tong ? Object.assign({ _nhan: 'TỔNG CỘNG' }, bc.tong) : null, cotNhanTong: 1, chuKy: stBC.tab !== 'sinhnhat' })]);
    };
    el.onclick = function (e) { var tr = e.target.closest('tr[data-hs]'); if (tr) App.moHoSo(tr.dataset.hs, stBC.tab === 'hethan' ? 'hopdong' : stBC.tab === 'ktkl' ? 'quatrinh' : 'canhan'); };
  }

  App.trang.hopdong = { ve: veHD, khongKy: true };
  App.trang.quyetdinh = { ve: veQD };
  App.trang.nghiphep = { ve: veDN, khongKy: true };
  App.trang.bcnhansu = { ve: veBCNS };
})();
