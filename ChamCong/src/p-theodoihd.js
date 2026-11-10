/* Theo dõi hợp đồng: bảng điều khiển hợp đồng sắp hết hạn, cần ký lại theo giai đoạn
   (thử việc -> chính thức 1 năm -> chính thức 3 năm -> không xác định thời hạn) và danh sách để người phụ trách theo dõi. */
(function () {
  'use strict';
  var App = window.App, TL = window.TL, h = App.h;
  var st = { khoang: 90, pb: '', nhom: '', thang: '', daKy: false };
  var TT = { cho: 'Chưa xử lý', trinh: 'Đang trình ký', khong: 'Không ký tiếp' };
  var MAU = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)'];
  function hn() { return App.homNay(); }
  function soNgay(a, b) { return Math.round((new Date(b) - new Date(a)) / 864e5); }

  /** Mỗi nhân viên đang làm: HĐ hiện tại (HĐ mới nhất đã có hiệu lực), HĐ đã ký tiếp (nếu có), giai đoạn cần ký tiếp */
  function duLieu() {
    var db = App.db, d = hn(), ds = [];
    db.nhanVien.forEach(function (nv) {
      if (nv.trangThai === 'nghi_viec') return;
      var cac = TL.giaiDoanCacHD(db, nv);
      if (!cac.length) { ds.push({ nv: nv, hd: null, nhom: 'chua' }); return; }
      var k = 0;
      cac.forEach(function (x, i) { if ((x.hd.tuNgay || '') <= d) k = i; });
      var x = cac[k], sau = cac[k + 1] || null, r = {
        nv: nv, hd: x.hd, gd: x.gd, con: x.hd.denNgay ? soNgay(d, x.hd.denNgay) : null, tiep: TL.hdTiepTheo(db, nv, x.hd),
        hdSau: sau ? sau.hd : null, gdSau: sau ? sau.gd : null, td: x.hd.theoDoi || {}
      };
      r.nhom = r.con == null ? 'kxd' : r.hdSau ? 'daky' : r.td.tt === 'khong' ? 'khong' : r.con < 0 ? 'het' : r.con <= 30 ? 's30' : r.con <= 90 ? 's90' : 'xa';
      r.tv = x.hd.loai === 'Thử việc' && r.con != null && r.con >= 0;
      ds.push(r);
    });
    return ds;
  }
  /** Số liệu nhanh cho trang Tổng quan */
  App.demKyLai = function () {
    var dem = { het: 0, s30: 0, s90: 0 };
    duLieu().forEach(function (r) { if (dem[r.nhom] != null) dem[r.nhom]++; });
    return dem;
  };

  function canKy(r) { return r.hd && r.con != null && !r.hdSau && r.td.tt !== 'khong'; }
  function tenGD(g, hd) { return g ? g.ten : (hd ? hd.loai || '' : ''); }
  function nhanCon(r) {
    if (r.con == null) return '<span class="mo">—</span>';
    if (r.con < 0) return '<span class="the-tt do">Quá hạn ' + (-r.con) + ' ngày</span>';
    return '<span class="the-tt' + (r.con <= 7 ? ' do' : r.con <= 30 ? ' cam' : '') + '">còn ' + r.con + ' ngày</span>';
  }
  function chuCon(r) { return r.con == null ? '' : r.con < 0 ? 'Quá hạn ' + (-r.con) + ' ngày' : 'Còn ' + r.con + ' ngày'; }
  function chuTiep(r) {
    if (r.hdSau) return 'Đã ký ' + tenGD(r.gdSau, r.hdSau).toLowerCase() + ' số ' + (r.hdSau.so || '') + ' từ ' + TL.hienNgay(r.hdSau.tuNgay);
    return r.tiep.gd ? r.tiep.gd.ten : '';
  }
  function chuDuKien(r) { return r.hdSau || !r.tiep.tuNgay ? '' : TL.hienNgay(r.tiep.tuNgay) + ' – ' + (r.tiep.denNgay ? TL.hienNgay(r.tiep.denNgay) : 'không thời hạn'); }
  function chuTT(r) { return r.hdSau ? 'Đã ký' : TT[r.td.tt || 'cho']; }

  /** Danh sách theo bộ lọc */
  function locDS(ds) {
    return ds.filter(function (r) {
      if (st.pb && r.nv.phongBan !== st.pb) return false;
      if (st.nhom === 'chua') return !r.hd;
      if (!r.hd || r.con == null) return false;
      if (st.nhom === 'tv') return r.tv;
      if (st.nhom) return r.nhom === st.nhom;
      if (st.thang) return canKy(r) && (st.thang === 'qua' ? r.con < 0 : r.hd.denNgay.slice(0, 7) === st.thang);
      if (r.hdSau && !st.daKy) return false;
      return r.con <= st.khoang;
    }).sort(function (a, b) { return (a.con == null ? 1e9 : a.con) - (b.con == null ? 1e9 : b.con) || String(a.nv.ma).localeCompare(String(b.nv.ma), 'vi', { numeric: true }); });
  }

  function moTaLoc() {
    if (st.nhom) return { het: 'Đã hết hạn, chưa ký lại', s30: 'Hết hạn trong 30 ngày', s90: 'Hết hạn sau 31 – 90 ngày', tv: 'Đang thử việc', chua: 'Chưa có hợp đồng', daky: 'Đã ký hợp đồng tiếp theo', khong: 'Không ký tiếp' }[st.nhom];
    if (st.thang) return st.thang === 'qua' ? 'Đã quá hạn, chưa ký lại' : 'Hết hạn trong tháng ' + +st.thang.slice(5) + '/' + st.thang.slice(0, 4);
    return 'Hết hạn trong ' + st.khoang + ' ngày tới (gồm cả HĐ đã quá hạn chưa ký lại)';
  }

  /* ---------- Trang ---------- */
  function ve(noi, chiDS) {
    var db = App.db, d = hn(), tatCa = duLieu(), ds = locDS(tatCa);
    var dem = { het: 0, s30: 0, s90: 0, tv: 0, tv30: 0, chua: 0, daky: 0, khong: 0 };
    tatCa.forEach(function (r) {
      if (st.pb && r.nv.phongBan !== st.pb) return;
      if (dem[r.nhom] != null) dem[r.nhom]++;
      if (r.tv) { dem.tv++; if (r.con <= 30) dem.tv30++; }
    });
    function the(k, nhan, gt, phu, mau) {
      return '<div class="kpi bam' + (st.nhom === k ? ' chon' : '') + '" data-nhom="' + k + '" title="Bấm để lọc danh sách"><div class="nhan">' + nhan + '</div>' +
        '<div class="gt"' + (mau && gt ? ' style="color:' + mau + '"' : '') + '>' + gt + '</div><div class="phu">' + phu + '</div></div>';
    }
    var html = chiDS ? '' : '<div class="kpis khong-in">' +
      the('het', 'Đã hết hạn, chưa ký lại', dem.het, 'nhân viên vẫn đang làm việc', 'var(--do)') +
      the('s30', 'Hết hạn trong 30 ngày', dem.s30, 'cần trình ký ngay', 'var(--cam)') +
      the('s90', 'Hết hạn sau 31 – 90 ngày', dem.s90, 'chuẩn bị đánh giá, gia hạn') +
      the('tv', 'Đang thử việc', dem.tv, dem.tv30 ? dem.tv30 + ' người hết thử việc trong 30 ngày' : 'theo HĐ thử việc') +
      the('chua', 'Chưa có hợp đồng', dem.chua, 'nhân viên đang làm việc', dem.chua ? 'var(--cam)' : '') +
      the('daky', 'Đã ký hợp đồng tiếp theo', dem.daky, 'ký trước khi HĐ cũ hết hạn') + '</div>';
    html += '<div class="the khong-in" style="padding:12px 14px"><div class="hang">' +
      '<select id="td-khoang" title="Khoảng thời gian">' + [[30, '30 ngày tới'], [60, '60 ngày tới'], [90, '90 ngày tới'], [180, '6 tháng tới'], [365, '12 tháng tới']].map(function (x) {
        return '<option value="' + x[0] + '"' + (st.khoang === x[0] ? ' selected' : '') + '>Hết hạn trong ' + x[1] + '</option>'; }).join('') + '</select>' +
      '<select id="td-pb">' + App.optDonVi(st.pb, { tatCa: 'Tất cả phòng / đội', ngung: true }) + '</select>' +
      '<label class="chk"><input type="checkbox" id="td-daky"' + (st.daKy ? ' checked' : '') + '> Hiện cả HĐ đã ký tiếp</label>' +
      (st.nhom || st.thang ? '<span class="the-tt lam">' + h(moTaLoc()) + ' <a href="#" id="td-bo" title="Bỏ lọc" style="margin-left:4px">✕</a></span>' : '') +
      '<span class="gian"></span><a class="nut" href="#danhmuc" onclick="App.moDanhMuc(\'hd\');return false">Giai đoạn hợp đồng…</a>' +
      '<button class="nut" id="td-xuat">' + App.icon('tai') + 'Xuất Excel</button><button class="nut" id="td-in">' + App.icon('in') + 'In danh sách</button></div></div>';
    if (!chiDS) html += '<div class="the khong-in"><h3>Hợp đồng hết hạn theo tháng – chưa ký lại <span class="mo nho" style="font-weight:400">· bấm cột để xem danh sách</span></h3><div id="td-bd1"></div></div>' +
      '<div class="cot2 khong-in"><div class="the"><h3>Hợp đồng đang hiệu lực theo giai đoạn</h3><div id="td-bd2"></div></div>' +
      '<div class="the"><h3>Cần ký lại trong ' + st.khoang + ' ngày theo phòng / đội</h3><div id="td-bd3"></div></div></div>';
    html += App.dauIn('DANH SÁCH HỢP ĐỒNG SẮP HẾT HẠN CẦN KÝ LẠI', moTaLoc() + ' – ngày ' + new Date().toLocaleDateString('vi-VN')) +
      '<div class="the" style="padding:0"><div class="cuon cao"><table class="bang" id="td-bang"><thead><tr><th>STT</th><th>Mã NV</th><th style="min-width:150px">Họ và tên</th><th>Phòng / đội</th><th>Chức vụ</th>' +
      '<th style="min-width:170px">Hợp đồng hiện tại</th><th>Hết hạn</th><th>Còn lại</th><th style="min-width:170px">Ký tiếp</th><th>Dự kiến hiệu lực</th><th>Theo dõi</th><th style="min-width:160px">Ghi chú</th><th class="khong-in"></th></tr></thead><tbody>' +
      (ds.length ? ds.map(function (r, i) {
        var nv = r.nv;
        if (!r.hd) return '<tr data-nv="' + nv.id + '"><td class="giua">' + (i + 1) + '</td><td>' + h(nv.ma) + '</td><td class="ten"><span class="lk" data-hs="' + nv.id + '">' + h(nv.hoTen) + '</span></td><td>' + h(TL.tenPhongBan(db, nv.phongBan)) + '</td><td>' + h(nv.chucVu || '') + '</td>' +
          '<td colspan="7" class="mo">Chưa có hợp đồng – vào làm ' + TL.hienNgay(nv.ngayVao) + '</td><td class="khong-in"><button class="nut nho chinh" data-a="ky">Ký HĐ</button></td></tr>';
        var tt = r.td.tt || 'cho';
        return '<tr data-nv="' + nv.id + '" data-hd="' + h(r.hd.id || '') + '"><td class="giua">' + (i + 1) + '</td><td>' + h(nv.ma) + '</td><td class="ten"><span class="lk" data-hs="' + nv.id + '">' + h(nv.hoTen) + '</span></td>' +
          '<td>' + h(TL.tenPhongBan(db, nv.phongBan)) + '</td><td>' + h(nv.chucVu || '') + '</td>' +
          '<td>' + h(tenGD(r.gd, r.hd)) + '<div class="mo nho">Số ' + h(r.hd.so || '') + ' · từ ' + TL.hienNgay(r.hd.tuNgay) + '</div></td>' +
          '<td class="giua">' + TL.hienNgay(r.hd.denNgay) + '</td><td class="giua"><span class="khong-in">' + nhanCon(r) + '</span><span class="chi-in">' + chuCon(r) + '</span></td>' +
          '<td>' + (r.hdSau ? '<span class="the-tt xanh">Đã ký</span> ' + h(tenGD(r.gdSau, r.hdSau)) + '<div class="mo nho">Số ' + h(r.hdSau.so || '') + ' · từ ' + TL.hienNgay(r.hdSau.tuNgay) + '</div>'
            : h(r.tiep.gd ? r.tiep.gd.ten : '—') + (r.tiep.canhBao ? ' <span title="' + h(r.tiep.canhBao) + '" style="color:var(--cam);cursor:help">⚠</span>' : '')) + '</td>' +
          '<td class="giua" style="white-space:nowrap">' + h(chuDuKien(r)) + '</td>' +
          '<td>' + (r.hdSau ? '<span class="the-tt xanh">Đã ký</span>' : '<select class="o-nhap khong-in" data-td="tt">' + Object.keys(TT).map(function (k) { return '<option value="' + k + '"' + (k === tt ? ' selected' : '') + '>' + TT[k] + '</option>'; }).join('') + '</select><span class="chi-in">' + TT[tt] + '</span>') +
            (r.td.ngay && !r.hdSau ? '<div class="mo nho">' + TL.hienNgay(r.td.ngay) + (r.td.nguoi ? ' · ' + h(r.td.nguoi) : '') + '</div>' : '') + '</td>' +
          '<td><input class="o-nhap chu khong-in" data-td="ghiChu" value="' + h(r.td.ghiChu || '') + '" placeholder="vd Đã gửi phiếu đánh giá" style="width:100%"><span class="chi-in">' + h(r.td.ghiChu || '') + '</span></td>' +
          '<td class="khong-in" style="white-space:nowrap">' + (r.hdSau ? '' : '<button class="nut nho chinh" data-a="ky" title="Ký ' + h(r.tiep.gd ? r.tiep.gd.ten.toLowerCase() : 'hợp đồng tiếp theo') + '">Ký tiếp</button> ') +
            '<button class="nut nho" data-a="in" title="In hợp đồng hiện tại">' + App.icon('in') + '</button></td></tr>';
      }).join('') : '<tr><td colspan="13" class="trong">Không có hợp đồng cần ký lại trong khoảng này.</td></tr>') + '</tbody></table></div></div>' +
      '<p class="mo nho khong-in">Thứ tự ký: ' + TL.dsGiaiDoan(db).map(function (g) { return h(g.ten) + (+g.soThang ? ' (' + App.thoiHan(g.soThang) + ')' : ''); }).join(' → ') +
      '. Cột “Theo dõi”, “Ghi chú” để người phụ trách ghi tiến độ trình ký; ký xong hợp đồng mới thì dòng tự chuyển “Đã ký”.</p>';
    noi.innerHTML = html;

    if (!chiDS) veBieuDo(tatCa);
    App.$('#td-khoang').onchange = function () { st.khoang = +this.value; st.thang = ''; App.veLai(); };
    App.$('#td-pb').onchange = function () { st.pb = this.value; App.veLai(); };
    App.$('#td-daky').onchange = function () { st.daKy = this.checked; App.veLai(); };
    var bo = App.$('#td-bo'); if (bo) bo.onclick = function (e) { e.preventDefault(); st.nhom = ''; st.thang = ''; App.veLai(); };
    App.$('#td-in').onclick = function () { App.inTrang(false); };
    App.$('#td-xuat').onclick = function () { xuatExcel(ds); };
    noi.onclick = function (e) {
      var k = e.target.closest('[data-nhom]');
      if (k) { st.nhom = st.nhom === k.dataset.nhom ? '' : k.dataset.nhom; st.thang = ''; App.veLai(); return; }
      var hs = e.target.closest('[data-hs]'); if (hs) { App.moHoSo(hs.dataset.hs, 'hopdong'); return; }
      var b = e.target.closest('[data-a]'), tr = e.target.closest('tr[data-nv]'); if (!b || !tr) return;
      var nv = App.timNV(tr.dataset.nv);
      if (b.dataset.a === 'ky') App.formHopDong(nv, null);
      else if (b.dataset.a === 'in') { var hd = (nv.hopDong || []).filter(function (x) { return x.id === tr.dataset.hd; })[0]; if (hd) App.inHopDong(nv, hd); }
    };
    noi.onchange = function (e) {
      var i = e.target, f = i.dataset.td, tr = i.closest('tr[data-hd]'); if (!f || !tr) return;
      var nv = App.timNV(tr.dataset.nv), hd = (nv.hopDong || []).filter(function (x) { return x.id === tr.dataset.hd; })[0]; if (!hd) return;
      hd.theoDoi = Object.assign({}, hd.theoDoi || {}, { ngay: hn(), nguoi: App.mayChu && App.mayChu.toi ? App.mayChu.toi.ten : '' });
      hd.theoDoi[f] = f === 'ghiChu' ? i.value.trim() : i.value;
      App.luu(); App.bao('Đã lưu theo dõi hợp đồng ' + (hd.so || '') + ' – ' + nv.hoTen, 'tot');
      if (f === 'tt') App.veLai();
    };
  }

  /* ---------- Biểu đồ ---------- */
  function veBieuDo(tatCa) {
    var db = App.db, d = TL.docNgay(hn()), gdAll = TL.dsGiaiDoan(db);
    var rows = tatCa.filter(function (r) { return !st.pb || r.nv.phongBan === st.pb; });
    // 1) HĐ hết hạn theo tháng (quá hạn + 12 tháng tới), chồng theo giai đoạn – tối đa 3 giai đoạn có thời hạn, còn lại gộp "Khác"
    var coHan = gdAll.filter(function (g) { return +g.soThang > 0; }), chuoi = coHan.slice(0, 3).map(function (g, i) { return { ma: g.ma, ten: g.ten, mau: MAU[i] }; });
    var coKhac = rows.some(function (r) { return canKy(r) && !chuoi.some(function (c) { return r.gd && c.ma === r.gd.ma; }); });
    if (coKhac || coHan.length > 3) chuoi.push({ ma: '_khac', ten: 'Khác', mau: MAU[3] });
    var cot = [{ khoa: 'qua', nhan: 'Quá hạn', tieuDe: 'Đã quá hạn, chưa ký lại' }];
    for (var k = 0; k < 12; k++) { var t = new Date(d.y, d.m - 1 + k, 1), y = t.getFullYear(), m = t.getMonth() + 1; cot.push({ khoa: TL.khoaKy(y, m), nhan: 'T' + m + (m === 1 || k === 0 ? '/' + String(y).slice(2) : ''), tieuDe: 'Tháng ' + m + '/' + y }); }
    cot.forEach(function (c) { c.gt = chuoi.map(function () { return 0; }); c.noiBat = st.thang === c.khoa; });
    rows.forEach(function (r) {
      if (!canKy(r)) return;
      var khoa = r.con < 0 ? 'qua' : r.hd.denNgay.slice(0, 7), c = cot.filter(function (x) { return x.khoa === khoa; })[0]; if (!c) return;
      var j = -1; chuoi.forEach(function (s, i) { if (r.gd && s.ma === r.gd.ma) j = i; });
      if (j < 0) j = chuoi.length - 1;
      c.gt[j]++;
    });
    App.bieuDoCotChong(App.$('#td-bd1'), cot, chuoi, { cao: 230, soNguyen: true, donVi: 'hợp đồng', chon: st.thang,
      bam: function (c) { st.thang = st.thang === c.khoa ? '' : c.khoa; st.nhom = ''; App.veLai(); setTimeout(function () { var b = App.$('#td-bang'); if (b) b.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50); } });
    // 2) HĐ đang hiệu lực theo giai đoạn
    var demGD = {}, chua = 0, het = 0;
    rows.forEach(function (r) {
      if (!r.hd) { chua++; return; }
      if (r.con != null && r.con < 0 && !r.hdSau) { het++; return; }
      var ten = tenGD(r.gd, r.hd); demGD[ten] = (demGD[ten] || 0) + 1;
    });
    var du2 = gdAll.map(function (g) { return { nhan: g.ten, gt: demGD[g.ten] || 0 }; });
    Object.keys(demGD).forEach(function (t) { if (!gdAll.some(function (g) { return g.ten === t; })) du2.push({ nhan: t, gt: demGD[t] }); });
    if (het) du2.push({ nhan: 'Đã hết hạn, chưa ký lại', gt: het });
    if (chua) du2.push({ nhan: 'Chưa có hợp đồng', gt: chua });
    var tong2 = du2.reduce(function (s, x) { return s + x.gt; }, 0) || 1;
    du2.forEach(function (x) { x.tip = [['Số người', x.gt], ['Tỷ lệ', App.so(Math.round(x.gt / tong2 * 1000) / 10) + '%']]; });
    App.bieuDoNgang(App.$('#td-bd2'), du2, { dinhDang: function (v) { return v + ' người'; } });
    // 3) Cần ký lại trong khoảng theo phòng / đội
    var demPB = {};
    rows.forEach(function (r) { if (canKy(r) && r.con <= st.khoang) demPB[r.nv.phongBan] = (demPB[r.nv.phongBan] || 0) + 1; });
    var du3 = Object.keys(demPB).map(function (p) { return { nhan: TL.tenPhongBan(db, p) || '(Chưa chọn)', gt: demPB[p], tip: [['Cần ký lại', demPB[p] + ' hợp đồng']] }; })
      .sort(function (a, b) { return b.gt - a.gt; });
    App.bieuDoNgang(App.$('#td-bd3'), du3, { dinhDang: function (v) { return v + ' HĐ'; } });
  }

  function xuatExcel(ds) {
    var db = App.db;
    App.xuatExcel('Hop_dong_can_ky_lai', [App.sheetBang({
      ten: 'Cần ký lại', tieuDe: 'DANH SÁCH HỢP ĐỒNG SẮP HẾT HẠN CẦN KÝ LẠI', phuDe: moTaLoc() + ' – ngày ' + new Date().toLocaleDateString('vi-VN'), coCot: 3,
      cot: [{ t: 'STT', stt: true, w: 5, kieu: 'giua' }, { t: 'Mã NV', w: 8, f: function (r) { return r.nv.ma; } }, { t: 'Họ và tên', w: 24, f: function (r) { return r.nv.hoTen; } },
        { t: 'Phòng / đội', w: 22, f: function (r) { return TL.tenPhongBan(db, r.nv.phongBan); } }, { t: 'Chức vụ', w: 18, f: function (r) { return r.nv.chucVu || ''; } },
        { t: 'Hợp đồng hiện tại', w: 30, f: function (r) { return r.hd ? tenGD(r.gd, r.hd) : 'Chưa có hợp đồng'; } }, { t: 'Số HĐ', w: 16, f: function (r) { return r.hd ? r.hd.so || '' : ''; } },
        { t: 'Từ ngày', w: 11, kieu: 'giua', f: function (r) { return r.hd ? TL.hienNgay(r.hd.tuNgay) : ''; } }, { t: 'Hết hạn', w: 11, kieu: 'giua', f: function (r) { return r.hd ? TL.hienNgay(r.hd.denNgay) : ''; } },
        { t: 'Còn lại', w: 16, f: function (r) { return chuCon(r); } }, { t: 'Ký tiếp', w: 34, f: function (r) { return r.hd ? chuTiep(r) : ''; } },
        { t: 'Dự kiến hiệu lực', w: 24, kieu: 'giua', f: function (r) { return r.hd ? chuDuKien(r) : ''; } }, { t: 'Theo dõi', w: 15, f: function (r) { return r.hd ? chuTT(r) : ''; } },
        { t: 'Ghi chú', w: 30, f: function (r) { return (r.td && r.td.ghiChu) || (r.tiep && r.tiep.canhBao) || ''; } }],
      dong: ds
    })]);
  }

  App.veTheoDoiHD = ve;
  App.trang.theodoihd = { ve: function (noi) { ve(noi, false); }, khongKy: true };
})();
