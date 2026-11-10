/* Trang "Mức lương theo kỳ": nhập các mức thay đổi theo thời gian, mỗi lần thay đổi là 1 "mức áp dụng từ kỳ":
   giá trị từng bậc của thang bảng lương, lương cơ sở, tiền cơm (phụ cấp mức chung), tạm ứng kỳ I theo chức vụ.
   Kỳ trước mức đầu tiên dùng "mức ban đầu" (danh mục, cài đặt). Bảng lương mỗi kỳ tự lấy đúng mức của kỳ đó. */
(function () {
  'use strict';
  var App = window.App, TL = window.TL, h = App.h;
  var NF_HS = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  var st = { chon: null };

  function docHS(s) { var n = parseFloat(String(s == null ? '' : s).trim().replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; }
  function kyHien(k) { return k ? k.slice(5, 7) + '/' + k.slice(0, 4) : ''; }
  function kySau(k, n) { var y = +k.slice(0, 4), m = +k.slice(5, 7) + (n || 1); while (m > 12) { m -= 12; y++; } return TL.khoaKy(y, m); }

  /* ================= Mức đang chọn (dùng chung với Danh mục → Thang, bảng lương) ================= */
  var ML = App.ML = {
    /** id mức đang chọn: 'goc' = mức ban đầu, hoặc id đợt */
    chon: function () {
      var db = App.db;
      if (st.chon && (st.chon === 'goc' || db.dotLuong.some(function (d) { return d.id === st.chon; }))) return st.chon;
      var d = TL.dotTaiKy(db, TL.kyHienHanh(db));
      return d ? d.id : 'goc';
    },
    datChon: function (id) { st.chon = id; },
    dot: function () { var id = ML.chon(); return id === 'goc' ? null : App.db.dotLuong.filter(function (d) { return d.id === id; })[0] || null; },
    /** Kỳ đại diện của mức đang chọn (để đọc giá trị đã áp dụng) */
    ky: function () { var d = ML.dot(); return d ? d.tuKy : '0000-00'; },
    ten: function (d) { return d ? 'Từ kỳ ' + kyHien(d.tuKy) : 'Mức ban đầu'; },
    /** Giá trị bậc (số gốc: tiền hoặc hệ số) của mức đang chọn */
    docBac: function (b, g, k) {
      var d = ML.dot();
      if (!d) return (g.bac || [])[k];
      var x = d.bang && d.bang[b.ma] && d.bang[b.ma].ngach && d.bang[b.ma].ngach[g.ma];
      if (Array.isArray(x)) return x[k];
      return TL.bacNgach(App.db, b, g, d.tuKy)[k];
    },
    ghiBac: function (b, g, k, v) {
      var d = ML.dot();
      if (!d) { while (g.bac.length <= k) g.bac.push(''); g.bac[k] = v; return; }
      d.bang = d.bang || {};
      var x = d.bang[b.ma] = d.bang[b.ma] || { mucCoSo: '', ngach: {} };
      x.ngach = x.ngach || {};
      if (!Array.isArray(x.ngach[g.ma])) x.ngach[g.ma] = TL.bacNgach(App.db, b, g, d.tuKy).slice();
      while (x.ngach[g.ma].length <= k) x.ngach[g.ma].push('');
      x.ngach[g.ma][k] = v;
    },
    docMucCoSo: function (b) { var d = ML.dot(); return d ? (d.bang && d.bang[b.ma] && d.bang[b.ma].mucCoSo) || '' : b.mucCoSo || ''; },
    ghiMucCoSo: function (b, v) {
      var d = ML.dot();
      if (!d) { b.mucCoSo = v; return; }
      d.bang = d.bang || {};
      (d.bang[b.ma] = d.bang[b.ma] || { mucCoSo: '', ngach: {} }).mucCoSo = v;
    },
    /** Dọn dữ liệu các mức khi đổi cấu trúc danh mục */
    botBac: function (b) { App.db.dotLuong.forEach(function (d) { var x = d.bang && d.bang[b.ma]; if (x && x.ngach) Object.keys(x.ngach).forEach(function (m) { if (x.ngach[m].length > b.soBac) x.ngach[m].length = b.soBac; }); }); },
    xoaNgach: function (b, g) { App.db.dotLuong.forEach(function (d) { var x = d.bang && d.bang[b.ma]; if (x && x.ngach) delete x.ngach[g.ma]; }); },
    xoaBang: function (b) { App.db.dotLuong.forEach(function (d) { if (d.bang) delete d.bang[b.ma]; }); },
    xoaGiaTri: function (b) { App.db.dotLuong.forEach(function (d) { var x = d.bang && d.bang[b.ma]; if (x) x.ngach = {}; }); },
    /** Thanh chọn mức (chip) */
    thanh: function (coThem) {
      var db = App.db, hien = TL.dotTaiKy(db, TL.kyHienHanh(db)), id = ML.chon(), hn = TL.kyHienHanh(db);
      var chip = function (d) {
        var ma = d ? d.id : 'goc', dang = (d || null) === (hien || null);
        var sap = d && d.tuKy > hn;
        return '<button class="chip-muc' + (ma === id ? ' chon' : '') + '" data-muc="' + h(ma) + '">' + h(ML.ten(d)) +
          (dang ? ' <span class="the-tt xanh">đang áp dụng</span>' : sap ? ' <span class="the-tt cam">sắp áp dụng</span>' : '') + '</button>';
      };
      return '<div class="hang muc-thanh">' + chip(null) + TL.dsDotLuong(db).map(chip).join('') +
        (coThem ? '<button class="nut chinh" id="ml-moi">' + App.icon('them') + 'Mức mới áp dụng từ tháng…</button>' : '') + '</div>';
    }
  };

  /** Sau khi đổi giá trị: lưu, cập nhật mức lương hiện hành của nhân viên đang xếp bậc */
  function daDoi() { App.luu(); if (App.apDungBangLuong) App.apDungBangLuong(null, true); }

  /* ================= Trang ================= */

  function ve(noi) {
    var db = App.db, d = ML.dot(), goc = !d, kyD = ML.ky();
    db.thangLuong.forEach(TL.chuanBangLuong);
    var hn = TL.kyHienHanh(db);
    var pcs = db.phuCap.filter(function (p) { return p.ma === 'AN' || p.mucChung || (d && d.phuCap && d.phuCap[p.ma] != null); });
    var lcs = goc ? db.caiDat.luongCoSo : d.luongCoSo;
    var tu = goc ? db.caiDat.tamUng : (d.tamUng || (d.tamUng = TL.chupMucKy(db, d.tuKy).tamUng));
    var demCV = {}, tenCV = {};
    db.nhanVien.forEach(function (nv) { if (nv.trangThai === 'nghi_viec' || !nv.chucVu) return; var k = TL.chuanCV(nv.chucVu); demCV[k] = (demCV[k] || 0) + 1; tenCV[k] = tenCV[k] || nv.chucVu; });
    var daCo = {}; (tu.theoChucVu || []).forEach(function (x) { daCo[TL.chuanCV(x.chucVu)] = 1; });
    var conLai = Object.keys(tenCV).filter(function (k) { return !daCo[k]; });
    var dsKhoa = Object.keys(db.thang).filter(function (k) { return db.thang[k].khoa && (!d || k >= d.tuKy); }).sort();

    noi.innerHTML =
      '<div class="the"><h3>Mức lương áp dụng theo kỳ<span class="phai">Kỳ hiện hành: ' + kyHien(hn) + '</span></h3>' +
      '<p class="mo" style="margin-top:0">Số bậc của từng chức danh (vd từ Đội trưởng trở lên 2 bậc, còn lại 3 bậc) chỉnh ở Danh mục → Thang, bảng lương. Khi Nhà nước hoặc công ty thay đổi bảng lương, bậc lương, lương cơ sở, tiền cơm hay mức tạm ứng: bấm <b>Mức mới áp dụng từ tháng…</b>, ' +
      'chọn kỳ lương bắt đầu áp dụng, sửa các số thay đổi rồi thôi. Bảng lương mỗi kỳ tự lấy đúng mức của kỳ đó – các kỳ trước vẫn giữ mức cũ, kỳ đã chốt không đổi.</p>' +
      ML.thanh(true) + '</div>' +

      // thông tin mức
      '<div class="the"><h3>' + h(ML.ten(d)) + (d && d.soQD ? ' – ' + h(d.soQD) : '') + '<span class="phai">' +
      (goc ? '' : '<button class="nut nho" id="ml-xuat">' + App.icon('tai') + 'Xuất Excel</button> <button class="nut nho nguy" id="ml-xoa">' + App.icon('xoa') + 'Xoá mức này</button>') +
      (goc ? '<button class="nut nho" id="ml-xuat">' + App.icon('tai') + 'Xuất Excel</button>' : '') + '</span></h3>' +
      (goc ? '<p class="mo" style="margin:0">Áp dụng cho các kỳ <b>trước</b> mọi mức điều chỉnh' + (db.dotLuong.length ? ' (trước kỳ ' + kyHien(TL.dsDotLuong(db)[0].tuKy) + ')' : ' (hiện là mức duy nhất)') + '.</p>'
        : '<div class="form ba" id="ml-tt">' +
          App.F.o('Áp dụng từ kỳ lương *', '<input type="month" data-tt="tuKy" value="' + h(d.tuKy) + '">', 'Kỳ lương tháng này trở đi (tới mức sau)') +
          App.F.o('Số quyết định / căn cứ', '<input data-tt="soQD" value="' + h(d.soQD || '') + '" placeholder="vd 15/QĐ-CT ngày 20/12/2026">') +
          App.F.o('Ghi chú', '<input data-tt="ghiChu" value="' + h(d.ghiChu || '') + '">') + '</div>' +
          (dsKhoa.length ? '<p class="mo nho" style="margin:8px 0 0">Các kỳ đã chốt lương từ kỳ này trở đi (' + dsKhoa.map(kyHien).join(', ') + ') giữ nguyên số đã chốt; mở khoá kỳ đó nếu muốn tính lại theo mức này.</p>' : '')) +
      '</div>' +

      '<div class="cot2">' +
      // lương cơ sở, phụ cấp mức chung
      '<div class="the"><h3>Lương cơ sở, tiền cơm</h3><div class="form" style="grid-template-columns:1fr 1fr">' +
      App.F.o('Lương cơ sở (đ/tháng)', '<input class="so tien" data-ml="luongCoSo" value="' + (lcs ? App.tien(lcs) : '') + '" placeholder="' + App.tien(TL.luongCoSoKy(db, kyD)) + '">',
        'Dùng cho bảng lương hệ số và trần đóng BHXH, BHYT (20 × lương cơ sở)') +
      App.F.o('Tiền ăn giữa ca miễn thuế tối đa (đ/tháng)', '<input class="so tien" data-ml="mienThueAnCa" value="' + ((goc ? db.caiDat.mienThueAnCa : d.mienThueAnCa) ? App.tien(goc ? db.caiDat.mienThueAnCa : d.mienThueAnCa) : '') + '" placeholder="' + App.tien(TL.mienThueAnCaKy(db, kyD)) + '">',
        'Phần tiền cơm vượt mức này tính thuế TNCN. NĐ 253/2026: 1.200.000 từ 01/7/2026 (trước đó 730.000)') +
      pcs.map(function (p) {
        var v = goc ? p.mucChung : (d.phuCap || {})[p.ma];
        var nhan = p.ma === 'AN' ? 'Tiền cơm (đ/ngày)' : p.ten + (p.cachTinh === 'theo_ngay' ? ' (đ/ngày)' : ' (đ/tháng)');
        return App.F.o(h(nhan), '<input class="so tien" data-pc="' + h(p.ma) + '" value="' + (v != null && v !== '' ? App.tien(v) : '') + '" placeholder="' + App.tien(TL.mucChungPC(db, p, kyD)) + '">',
          p.ma === 'AN' ? 'Mức chung cho mọi nhân viên × ngày đi làm (người có mức riêng trong hồ sơ thì theo mức riêng)' : 'Mức chung');
      }).join('') +
      '</div></div>' +
      // tạm ứng kỳ I
      '<div class="the"><h3>Tạm ứng kỳ I theo chức vụ<span class="phai">Kỳ II = lương còn lại</span></h3>' +
      '<p class="mo nho" style="margin-top:0">Mỗi tháng trả lương 2 lần: <b>kỳ I</b> (giữa tháng) tạm ứng theo chức vụ, <b>kỳ II</b> (cuối tháng) là số còn lại = tổng thu nhập − kỳ I − các khoản khấu trừ. ' +
      'Người có mức riêng (hồ sơ) hoặc nhập tay trong bảng lương thì theo số đó.</p>' +
      '<div class="cuon"><table class="bang" id="ml-tu"><thead><tr><th style="min-width:180px">Chức vụ</th><th class="so">Tạm ứng kỳ I (đ)</th><th>Nhân viên</th><th></th></tr></thead><tbody>' +
      (tu.theoChucVu || []).map(function (x, i) {
        return '<tr data-i="' + i + '"><td><input class="o-nhap chu" data-tu="chucVu" value="' + h(x.chucVu) + '" style="width:100%"></td>' +
          '<td><input class="o-nhap so tien" data-tu="muc" value="' + (x.muc || x.muc === 0 ? App.tien(x.muc) : '') + '"></td>' +
          '<td class="giua">' + (demCV[TL.chuanCV(x.chucVu)] || '<span class="mo">0</span>') + '</td><td><button class="nut nho nguy" data-a="xoatu">' + App.icon('xoa') + '</button></td></tr>';
      }).join('') +
      '<tr class="dong-tong"><td><b>Chức vụ khác</b> (mức chung)</td><td><input class="o-nhap so tien" data-tu="macDinh" value="' + App.tien(tu.macDinh || 0) + '"></td><td class="giua mo">' +
      conLai.reduce(function (s, k) { return s + demCV[k]; }, 0) + '</td><td></td></tr></tbody></table></div>' +
      '<div class="hang" style="margin-top:10px"><input id="tu-cv" list="ds-cv" placeholder="Chức vụ (vd Trưởng phòng)" style="width:200px"><datalist id="ds-cv">' +
      Object.keys(tenCV).map(function (k) { return '<option value="' + h(tenCV[k]) + '">'; }).join('') + '</datalist>' +
      '<input id="tu-muc" class="so tien" placeholder="Mức (đ)" style="width:120px"><button class="nut" id="tu-them">' + App.icon('them') + 'Thêm</button>' +
      (conLai.length ? '<button class="nut" id="tu-tatca" title="' + h(conLai.map(function (k) { return tenCV[k]; }).join(', ')) + '">Thêm ' + conLai.length + ' chức vụ đang có</button>' : '') + '</div></div>' +
      '</div>' +

      // thang bảng lương
      (db.thangLuong.length ? db.thangLuong.map(theBang).join('') :
        '<div class="the mo">Chưa có thang, bảng lương. Khai báo bảng, chức danh, số bậc ở <a href="#danhmuc" id="ml-dm">Danh mục → Thang, bảng lương</a>.</div>');

    App.$$('input.tien', noi).forEach(App.ganOTien);
    var dm = App.$('#ml-dm', noi); if (dm) dm.onclick = function () { App.moDanhMuc && App.moDanhMuc('bl'); };

    noi.onchange = function (e) {
      var i = e.target;
      if (i.dataset.tt) { doiThongTin(d, i); return; }
      if (i.dataset.ml) {
        var f = i.dataset.ml, v = App.docSo(i.value);
        if (goc) { if (!v) { App.bao('Mức ban đầu không được để trống.', 'loi'); App.veLai(); return; } db.caiDat[f] = v; } else d[f] = v || '';
        daDoi(); App.bao('Đã lưu ' + (f === 'luongCoSo' ? 'lương cơ sở' : 'mức miễn thuế tiền ăn giữa ca') + ' – ' + ML.ten(d).toLowerCase()); App.veLai(); return;
      }
      if (i.dataset.pc) {
        var p = db.phuCap.filter(function (x) { return x.ma === i.dataset.pc; })[0], raw = i.value.trim(), v2 = App.docSo(raw);
        if (goc) p.mucChung = raw === '' ? '' : v2; else { d.phuCap = d.phuCap || {}; if (raw === '') delete d.phuCap[p.ma]; else d.phuCap[p.ma] = v2; }
        daDoi(); App.bao('Đã lưu ' + (p.ma === 'AN' ? 'tiền cơm' : p.ten.toLowerCase())); return;
      }
      if (i.dataset.tu) {
        var tr = i.closest('tr[data-i]');
        if (i.dataset.tu === 'macDinh') tu.macDinh = App.docSo(i.value);
        else if (tr) {
          var x = tu.theoChucVu[+tr.dataset.i];
          if (i.dataset.tu === 'chucVu') { if (!i.value.trim()) { App.veLai(); return; } x.chucVu = i.value.trim(); } else x.muc = App.docSo(i.value);
        }
        daDoi(); App.bao('Đã lưu mức tạm ứng'); if (i.dataset.tu === 'chucVu') App.veLai(); return;
      }
      var cell = i.closest('[data-bac]');
      if (cell || i.dataset.mcs != null) {
        var card = i.closest('[data-b]'), b = db.thangLuong[+card.dataset.b];
        if (i.dataset.mcs != null) { ML.ghiMucCoSo(b, App.docSo(i.value) || ''); daDoi(); App.veLai(); return; }
        var g = b.ngach[+i.closest('tr').dataset.g], k = +i.dataset.bac;
        var val = b.kieu === 'he_so' ? docHS(i.value) : App.docSo(i.value);
        ML.ghiBac(b, g, k, val || '');
        daDoi(); App.veLai();
      }
    };
    noi.onclick = function (e) {
      var c = e.target.closest('[data-muc]');
      if (c) { st.chon = c.dataset.muc; App.veLai(); return; }
      if (e.target.closest('#ml-moi')) { mucMoi(); return; }
      if (e.target.closest('#ml-xoa')) {
        App.xacNhan('Xoá <b>' + h(ML.ten(d)) + '</b>? Các kỳ từ ' + kyHien(d.tuKy) + ' sẽ dùng lại mức trước đó (trừ kỳ đã chốt).', { nut: 'Xoá', nguy: true }).then(function (ok) {
          if (!ok) return;
          db.dotLuong.splice(db.dotLuong.indexOf(d), 1); st.chon = null; daDoi(); App.veLai(); App.bao('Đã xoá mức áp dụng.', 'tot');
        });
        return;
      }
      if (e.target.closest('#ml-xuat')) { xuatExcel(d); return; }
      if (e.target.closest('#tu-them')) {
        var cv = App.$('#tu-cv').value.trim(), muc = App.docSo(App.$('#tu-muc').value);
        if (!cv) { App.bao('Nhập chức vụ.', 'loi'); return; }
        if ((tu.theoChucVu || []).some(function (x) { return TL.chuanCV(x.chucVu) === TL.chuanCV(cv); })) { App.bao('Chức vụ này đã có trong bảng.', 'loi'); return; }
        tu.theoChucVu.push({ chucVu: cv, muc: muc }); daDoi(); App.veLai(); return;
      }
      if (e.target.closest('#tu-tatca')) { conLai.forEach(function (k) { tu.theoChucVu.push({ chucVu: tenCV[k], muc: +tu.macDinh || 0 }); }); daDoi(); App.veLai(); return; }
      var a = e.target.closest('[data-a="xoatu"]');
      if (a) { tu.theoChucVu.splice(+a.closest('tr').dataset.i, 1); daDoi(); App.veLai(); }
    };
  }

  function doiThongTin(d, i) {
    var db = App.db, f = i.dataset.tt;
    if (f === 'tuKy') {
      var k = i.value;
      if (!/^\d{4}-\d{2}$/.test(k)) { App.bao('Chọn tháng áp dụng.', 'loi'); App.veLai(); return; }
      if (db.dotLuong.some(function (x) { return x !== d && x.tuKy === k; })) { App.bao('Đã có mức áp dụng từ kỳ ' + kyHien(k) + '.', 'loi'); App.veLai(); return; }
      d.tuKy = k;
    } else d[f] = i.value.trim();
    daDoi(); App.bao('Đã lưu'); if (f !== 'ghiChu') App.veLai();
  }

  function theBang(b, bi) {
    var db = App.db, hs = b.kieu === 'he_so', d = ML.dot(), kyD = ML.ky(), cot = '';
    for (var k = 1; k <= b.soBac; k++) cot += '<th class="so" style="min-width:' + (hs ? 70 : 110) + 'px">Bậc ' + k + '</th>';
    var mcs = ML.docMucCoSo(b);
    return '<div class="the" data-b="' + bi + '"><h3>' + h(b.ten) + '<span class="phai">' + h(TL.KIEU_BL[b.kieu]) + ' · dùng cho ' + h(TL.AP_DUNG_BL[b.apDung]).toLowerCase() + '</span></h3>' +
      (hs ? '<div class="hang" style="margin-bottom:8px"><label class="nho">Mức lương cơ sở của bảng <input class="o-nhap so tien" data-mcs value="' + (mcs ? App.tien(mcs) : '') + '" placeholder="' + App.tien(TL.luongCoSoKy(db, kyD)) + ' (lương cơ sở)" style="width:170px"></label></div>' : '') +
      '<div class="cuon"><table class="bang bang-bac"><thead><tr><th>Mã</th><th style="min-width:220px">Chức danh / nhóm công việc</th>' + cot + '</tr></thead><tbody>' +
      (b.ngach.length ? b.ngach.map(function (g, gi) {
        var cu = d ? TL.bacNgach(db, b, g, kySau(d.tuKy, -1)) : null;
        return '<tr data-g="' + gi + '"><td>' + h(g.ma) + '</td><td>' + h(g.ten) + '</td>' +
          Array.apply(null, Array(b.soBac)).map(function (_, k2) {
            if (k2 >= (+g.soBac || b.soBac)) return '<td class="bac-tat" title="' + h(g.ten) + ' có ' + g.soBac + ' bậc"></td>';
            var v = ML.docBac(b, g, k2), gt = +v > 0 ? (hs ? { tien: Math.round(v * TL.mucCoSoBL(db, b, kyD)) } : null) : null;
            var vc = cu ? +cu[k2] : 0, doi = d && +v > 0 && vc > 0 && +v !== vc;
            return '<td class="so"><input class="o-nhap so" data-bac="' + k2 + '" value="' + (+v > 0 ? (hs ? NF_HS.format(v) : App.tien(v)) : '') + '" style="width:100%' + (doi ? ';font-weight:700;color:var(--chinh-dam)' : '') + '"' +
              (doi ? ' title="Trước đó: ' + (hs ? NF_HS.format(vc) : App.tien(vc)) + '"' : '') + '>' +
              (gt ? '<div class="mo nho">' + App.tien(gt.tien) + '</div>' : '') +
              (doi ? '<div class="nho" style="color:var(--chinh)">' + (vc ? (+v > vc ? '+' : '') + (Math.round((+v / vc - 1) * 1000) / 10) + '%' : '') + '</div>' : '') + '</td>';
          }).join('') + '</tr>';
      }).join('') : '<tr><td colspan="' + (b.soBac + 2) + '" class="trong">Chưa có chức danh (thêm ở Danh mục → Thang, bảng lương).</td></tr>') +
      '</tbody></table></div></div>';
  }

  /** Hộp tạo mức mới: chép toàn bộ mức đang áp dụng tại kỳ đó, có thể tăng đồng loạt % các bậc */
  function mucMoi() {
    var db = App.db, ds = TL.dsDotLuong(db), hn = TL.kyHienHanh(db);
    var macDinh = kySau(ds.length && ds[ds.length - 1].tuKy >= hn ? ds[ds.length - 1].tuKy : hn, 1);
    var an = db.phuCap.filter(function (p) { return p.ma === 'AN'; })[0];
    App.hop({
      tieuDe: 'Mức lương mới áp dụng từ tháng…', co: 'hep',
      than: '<form class="form" style="grid-template-columns:1fr" onsubmit="return false">' +
        App.F.o('Áp dụng từ kỳ lương *', '<input type="month" name="tuKy" value="' + macDinh + '">', 'Vd kỳ lương tháng 01/2027. Các kỳ trước giữ nguyên mức cũ.') +
        App.F.o('Số quyết định / căn cứ', '<input name="soQD" placeholder="vd 15/QĐ-CT ngày 20/12/2026">') +
        App.F.o('Ghi chú', '<input name="ghiChu" placeholder="vd Điều chỉnh lương năm 2027">') +
        '<p class="mo nho" style="margin:0">Mức mới được chép từ mức đang áp dụng tại kỳ đó; sửa tiếp ở trang này. Có thể đổi nhanh:</p>' +
        App.F.o('Tăng đồng loạt các bậc lương (bảng mức tiền) thêm (%)', '<input name="phanTram" type="number" step="0.1" placeholder="vd 5 (để trống = giữ nguyên)">', 'Làm tròn tới 1.000 đ') +
        App.F.o('Lương cơ sở mới (đ/tháng)', '<input name="luongCoSo" class="so tien" placeholder="để trống = giữ nguyên">') +
        (an ? App.F.o('Tiền cơm mới (đ/ngày)', '<input name="com" class="so tien" placeholder="để trống = giữ nguyên">') : '') + '</form>',
      moRa: function (el) { App.$$('input.tien', el).forEach(App.ganOTien); },
      nut: [{ ten: 'Huỷ' }, {
        ten: 'Tạo mức mới', loai: 'chinh', bam: function (el) {
          var v = App.F.doc(el);
          if (!/^\d{4}-\d{2}$/.test(v.tuKy)) { App.bao('Chọn tháng áp dụng.', 'loi'); return false; }
          if (db.dotLuong.some(function (x) { return x.tuKy === v.tuKy; })) { App.bao('Đã có mức áp dụng từ kỳ ' + kyHien(v.tuKy) + ' – chọn mức đó để sửa.', 'loi'); return false; }
          var moi = Object.assign({ id: App.uid(), tuKy: v.tuKy, soQD: v.soQD.trim(), ghiChu: v.ghiChu.trim() }, TL.chupMucKy(db, v.tuKy));
          var pt = parseFloat(String(v.phanTram || '').replace(',', '.'));
          if (pt) db.thangLuong.forEach(function (b) {
            if (b.kieu !== 'tien' || !moi.bang[b.ma]) return;
            Object.keys(moi.bang[b.ma].ngach).forEach(function (m) { moi.bang[b.ma].ngach[m] = moi.bang[b.ma].ngach[m].map(function (x) { return +x > 0 ? Math.round(x * (1 + pt / 100) / 1000) * 1000 : x; }); });
          });
          if (App.docSo(v.luongCoSo)) moi.luongCoSo = App.docSo(v.luongCoSo);
          if (an && App.docSo(v.com)) moi.phuCap.AN = App.docSo(v.com);
          db.dotLuong.push(moi);
          st.chon = moi.id; daDoi(); App.veLai();
          App.bao('Đã tạo mức áp dụng từ kỳ ' + kyHien(v.tuKy) + (pt ? ', các bậc tăng ' + pt + '%' : '') + '. Sửa tiếp các số thay đổi nếu cần.', 'tot');
        }
      }]
    });
  }

  function xuatExcel(d) {
    var db = App.db, kyD = ML.ky(), ten = ML.ten(d), shs = [];
    var phu = (d ? ten : 'Mức ban đầu') + (d && d.soQD ? ' – ' + d.soQD : '');
    db.thangLuong.forEach(function (b) {
      var hs = b.kieu === 'he_so', cot = [{ t: 'STT', stt: true, w: 5, kieu: 'giua' }, { t: 'Mã', w: 7, f: function (g) { return g.ma; } }, { t: 'Chức danh / nhóm công việc', w: 34, f: function (g) { return g.ten; } }];
      for (var k = 0; k < b.soBac; k++) (function (k2) {
        cot.push({ t: 'Bậc ' + (k2 + 1), w: hs ? 9 : 13, kieu: hs ? null : 'so', nhom: hs ? 'Hệ số' : 'Mức lương (đ/tháng)', khongTong: true,
          f: function (g) { if (k2 >= (+g.soBac || b.soBac)) return ''; var v = ML.docBac(b, g, k2); return +v > 0 ? (hs ? NF_HS.format(v) : +v) : ''; } });
      })(k);
      shs.push(App.sheetBang({ ten: b.ten.slice(0, 28), tieuDe: b.ten.toUpperCase(), phuDe: phu, cot: cot, dong: b.ngach, chuKy: true }));
    });
    var tu = d ? d.tamUng || TL.cauHinhTamUng(db, kyD) : db.caiDat.tamUng;
    var dong = (tu.theoChucVu || []).map(function (x) { return { cv: x.chucVu, muc: +x.muc || 0 }; }).concat([{ cv: 'Chức vụ khác', muc: +tu.macDinh || 0 }]);
    shs.push(App.sheetBang({ ten: 'Tạm ứng kỳ I', tieuDe: 'MỨC TẠM ỨNG LƯƠNG KỲ I THEO CHỨC VỤ', phuDe: phu,
      cot: [{ t: 'STT', stt: true, w: 5, kieu: 'giua' }, { t: 'Chức vụ', w: 30, k: 'cv' }, { t: 'Tạm ứng kỳ I (đ)', w: 16, k: 'muc', kieu: 'so', khongTong: true }], dong: dong, chuKy: true }));
    var pcs = db.phuCap.filter(function (p) { return TL.mucChungPC(db, p, kyD); });
    shs.push(App.sheetBang({ ten: 'Lương cơ sở, phụ cấp', tieuDe: 'LƯƠNG CƠ SỞ VÀ PHỤ CẤP MỨC CHUNG', phuDe: phu,
      cot: [{ t: 'STT', stt: true, w: 5, kieu: 'giua' }, { t: 'Khoản', w: 34, k: 'ten' }, { t: 'Mức (đ)', w: 16, k: 'muc', kieu: 'so', khongTong: true }, { t: 'Đơn vị', w: 12, k: 'dv' }],
      dong: [{ ten: 'Lương cơ sở', muc: TL.luongCoSoKy(db, kyD), dv: 'đ/tháng' }, { ten: 'Tiền ăn giữa ca miễn thuế tối đa', muc: TL.mienThueAnCaKy(db, kyD), dv: 'đ/tháng' }].concat(pcs.map(function (p) { return { ten: p.ma === 'AN' ? 'Tiền cơm' : p.ten, muc: TL.mucChungPC(db, p, kyD), dv: p.cachTinh === 'theo_ngay' ? 'đ/ngày' : 'đ/tháng' }; })) }));
    App.xuatExcel(App.tenFile('Muc_luong_' + (d ? 'tu_ky_' + d.tuKy : 'ban_dau')), shs);
  }

  App.trang.mucluong = { ve: ve, khongKy: true };
})();
