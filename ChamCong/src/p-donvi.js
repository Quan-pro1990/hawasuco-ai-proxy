/* Phòng, đội (đơn vị): danh mục thêm / sửa / xoá, chuyển nhân viên qua lại giữa các phòng, đội.
   - Mỗi đơn vị có loại (Phòng, Đội, Ban, Tổ, Xí nghiệp).
   - Xoá đơn vị còn nhân viên: bắt buộc chuyển hết nhân viên sang đơn vị khác rồi mới xoá.
   - Đơn vị còn trong lịch sử (quyết định cũ, người đã nghỉ việc, bảng lương đã chốt) thì chỉ "giải thể" (ẩn), không xoá hẳn.
   - Chuyển có lập quyết định điều chuyển: các kỳ trước ngày hiệu lực vẫn tính ở đơn vị cũ. */
(function () {
  'use strict';
  var App = window.App, TL = window.TL, h = App.h;

  App.LOAI_DV = TL.LOAI_DV;

  /** Danh sách đơn vị đang hoạt động (kèm đơn vị `chon` nếu đã giải thể, hoặc tất cả nếu o.ngung) */
  App.dsDonVi = function (o) {
    o = o || {};
    App.db.phongBan.forEach(function (p) { if (!TL.LOAI_DV[p.loai]) p.loai = TL.loaiDonVi(p); });
    var chi = o.chi === undefined ? App.dvChamCong() : o.chi;
    return App.db.phongBan.filter(function (p) { return (!p.ngung || o.ngung || p.ma === o.chon) && p.ma !== o.bo && (!chi || chi.indexOf(p.ma) >= 0); });
  };

  /** <option> các đơn vị, nhóm theo loại (Phòng, Đội…) khi có nhiều loại */
  App.optDonVi = function (chon, o) {
    o = o || {};
    var ds = App.dsDonVi({ ngung: o.ngung, chon: chon, bo: o.bo }), s = '';
    if (o.tatCa != null) s += '<option value="">' + h(o.tatCa) + '</option>';
    var opt = function (p) { return '<option value="' + h(p.ma) + '"' + (p.ma === chon ? ' selected' : '') + '>' + h(p.ten) + (p.ngung ? ' (đã giải thể)' : '') + '</option>'; };
    var loai = {}; ds.forEach(function (p) { loai[p.loai || 'phong'] = 1; });
    if (Object.keys(loai).length < 2) return s + ds.map(opt).join('');
    Object.keys(TL.LOAI_DV).forEach(function (l) {
      var nhom = ds.filter(function (p) { return (p.loai || 'phong') === l; });
      if (nhom.length) s += '<optgroup label="' + h(TL.LOAI_DV[l]) + '">' + nhom.map(opt).join('') + '</optgroup>';
    });
    return s;
  };

  function dangLam(ma) { return App.db.nhanVien.filter(function (nv) { return nv.phongBan === ma && nv.trangThai !== 'nghi_viec'; }); }

  /** Các chỗ còn nhắc tới đơn vị (để quyết định xoá hẳn hay chỉ giải thể) */
  function thamChieu(ma) {
    var db = App.db, kq = { nghiViec: 0, qd: 0, chot: 0 };
    db.nhanVien.forEach(function (nv) {
      if (nv.phongBan === ma && nv.trangThai === 'nghi_viec') kq.nghiViec++;
      (nv.quyetDinh || []).forEach(function (q) { if (q.phongBanCu === ma || q.phongBanMoi === ma) kq.qd++; });
    });
    Object.keys(db.thang).forEach(function (k) { var c = db.thang[k].chot; if (c && c.rows && c.rows.some(function (r) { return r.phongBan === ma; })) kq.chot++; });
    kq.co = kq.nghiViec + kq.qd + kq.chot > 0;
    return kq;
  }

  /** Chuyển danh sách nhân viên sang đơn vị khác. o: { phongBanMoi, lapQD, hieuLuc, so, ngay, chucVuMoi, noiDung }.
      Trả về { chuyen: [...], boQua: [{nv, lyDo}] } */
  App.chuyenDonVi = function (dsNV, o) {
    var kq = { chuyen: [], boQua: [] }, ten = TL.tenPhongBan(App.db, o.phongBanMoi);
    dsNV.forEach(function (nv) {
      if (nv.phongBan === o.phongBanMoi && !(o.chucVuMoi && o.chucVuMoi !== nv.chucVu)) { kq.boQua.push({ nv: nv, lyDo: 'đã ở ' + ten }); return; }
      if (o.lapQD) {
        nv.quyetDinh = nv.quyetDinh || [];
        var sau = nv.quyetDinh.filter(function (q) { return (q.loai === 'dieu_chuyen' || q.loai === 'bo_nhiem') && q.hieuLuc > o.hieuLuc; })[0];
        if (sau) { kq.boQua.push({ nv: nv, lyDo: 'đã có quyết định ' + TL.LOAI_QD[sau.loai].toLowerCase() + ' hiệu lực ' + TL.hienNgay(sau.hieuLuc) + ' (sau ngày ' + TL.hienNgay(o.hieuLuc) + ')' }); return; }
        nv.quyetDinh.push({
          id: App.uid(), loai: 'dieu_chuyen', so: o.so || '', ngay: o.ngay || o.hieuLuc, hieuLuc: o.hieuLuc,
          phongBanCu: nv.phongBan || '', phongBanMoi: o.phongBanMoi, chucVuCu: nv.chucVu || '', chucVuMoi: o.chucVuMoi || nv.chucVu || '',
          noiDung: o.noiDung || 'Điều chuyển đến ' + ten
        });
      }
      nv.phongBan = o.phongBanMoi;
      if (o.chucVuMoi) nv.chucVu = o.chucVuMoi;
      if (App.dongBoHoSo) App.dongBoHoSo(nv);
      kq.chuyen.push(nv);
    });
    return kq;
  };

  /** Hộp thoại chuyển nhân viên sang phòng / đội khác.
      o: { tieuDe, canhBao (html), bo (mã đơn vị không được chọn), nut, batBuoc (phải chuyển hết), sauKhiChuyen(kq) } */
  App.hopChuyenDonVi = function (dsNV, o) {
    o = o || {};
    var db = App.db, F = App.F, mot = dsNV.length === 1;
    var cungDV = dsNV.every(function (nv) { return nv.phongBan === dsNV[0].phongBan; });
    var bo = o.bo || (cungDV ? dsNV[0].phongBan : null);
    if (!App.dsDonVi({ bo: bo }).length) { App.bao('Chưa có phòng / đội nào khác để chuyển đến. Hãy thêm phòng / đội trước (Danh mục → Phòng, đội).', 'loi'); return; }
    var dsHtml = '<div class="cuon" style="max-height:200px;margin-bottom:10px"><table class="bang"><thead><tr><th>Mã NV</th><th>Họ và tên</th><th>Chức vụ</th><th>Đang ở</th></tr></thead><tbody>' +
      dsNV.map(function (nv) { return '<tr><td>' + h(nv.ma) + '</td><td class="ten">' + h(nv.hoTen) + '</td><td>' + h(nv.chucVu || '') + '</td><td>' + h(TL.tenPhongBan(db, nv.phongBan) || '—') + '</td></tr>'; }).join('') +
      '</tbody></table></div>';
    App.hop({
      tieuDe: o.tieuDe || (mot ? 'Điều chuyển ' + dsNV[0].hoTen : 'Chuyển ' + dsNV.length + ' nhân viên sang phòng / đội khác'), co: 'rong', giu: true,
      than: (o.canhBao ? '<div class="canh-bao" style="margin-bottom:10px">' + o.canhBao + '</div>' : '') + dsHtml +
        '<form class="form" onsubmit="return false">' +
        F.o('Chuyển đến phòng / đội *', '<select name="phongBanMoi"><option value="">— Chọn —</option>' + App.optDonVi('', { bo: bo }) + '</select>') +
        F.o('Hiệu lực từ ngày *', F.ngay('hieuLuc', App.homNay()), 'Kỳ công chứa ngày này trở đi tính ở đơn vị mới') +
        (mot ? F.o('Chức vụ mới', F.txt('chucVuMoi', dsNV[0].chucVu || ''), 'Để nguyên nếu không đổi') : '<span></span>') +
        '<div class="ca">' + F.chk('lapQD', true, 'Lập <b>quyết định điều chuyển</b> (ghi vào quá trình công tác; các kỳ trước ngày hiệu lực vẫn tính ở đơn vị cũ)') + '</div>' +
        '<div class="ca form" id="cdv-qd" style="padding:0">' + F.o('Số quyết định', F.txt('so', '', 'placeholder="vd 25/QĐ-CT"')) + F.o('Ngày ký', F.ngay('ngay', App.homNay())) +
        F.o('Trích yếu', F.txt('noiDung', '', 'placeholder="Để trống = Điều chuyển đến …"')) + '</div>' +
        '<p class="mo nho ca" style="margin:0">Bỏ chọn ô quyết định nếu chỉ <b>sửa sai</b> phòng / đội đã nhập: khi đó mọi kỳ chưa chốt đều tính theo đơn vị mới.</p>' +
        '</form>',
      moRa: function (el) {
        var fm = App.$('form', el);
        fm.lapQD.onchange = function () { App.$('#cdv-qd', el).style.display = this.checked ? '' : 'none'; };
      },
      nut: [{ ten: 'Huỷ' }, {
        ten: o.nut || 'Chuyển', loai: 'chinh', bam: function (el) {
          var v = F.doc(el);
          if (!v.phongBanMoi) { App.bao('Chọn phòng / đội chuyển đến.', 'loi'); return false; }
          if (v.lapQD && !v.hieuLuc) { App.bao('Nhập ngày hiệu lực.', 'loi'); return false; }
          var kq = App.chuyenDonVi(dsNV, {
            phongBanMoi: v.phongBanMoi, lapQD: v.lapQD, hieuLuc: v.hieuLuc || App.homNay(), so: (v.so || '').trim(), ngay: v.ngay,
            chucVuMoi: mot ? (v.chucVuMoi || '').trim() : '', noiDung: (v.noiDung || '').trim()
          });
          if (o.batBuoc && kq.boQua.length) {
            // hoàn tác những người đã chuyển để không xoá dở dang
            App.hop({
              tieuDe: 'Chưa chuyển được hết nhân viên', co: 'hep',
              than: '<p>Những nhân viên sau chưa chuyển được nên <b>chưa xoá</b> phòng / đội:</p><ul>' + kq.boQua.map(function (x) { return '<li>' + h(x.nv.hoTen) + ': ' + h(x.lyDo) + '</li>'; }).join('') + '</ul>' +
                '<p class="mo">Hãy xử lý các quyết định đó (tab Quá trình công tác) rồi xoá lại.</p>',
              nut: [{ ten: 'Đóng', loai: 'chinh' }]
            });
          }
          App.luu();
          var tb = kq.chuyen.length ? 'Đã chuyển ' + kq.chuyen.length + ' nhân viên sang ' + TL.tenPhongBan(App.db, v.phongBanMoi) + (v.lapQD ? ' (đã lập quyết định điều chuyển)' : '') : 'Không có nhân viên nào được chuyển';
          if (kq.boQua.length && !o.batBuoc) tb += '; bỏ qua ' + kq.boQua.length + ': ' + kq.boQua.map(function (x) { return x.nv.hoTen + ' – ' + x.lyDo; }).join('; ');
          App.bao(tb, kq.chuyen.length ? 'tot' : 'loi');
          if (o.sauKhiChuyen) o.sauKhiChuyen(kq); else App.veLai();
        }
      }]
    });
  };

  /* ================= Danh mục phòng, đội ================= */

  App.dmDonVi = function (el) {
    var db = App.db, dem = {};
    db.phongBan.forEach(function (p) { if (!TL.LOAI_DV[p.loai]) p.loai = TL.loaiDonVi(p); });
    db.nhanVien.forEach(function (nv) { if (nv.trangThai !== 'nghi_viec') dem[nv.phongBan] = (dem[nv.phongBan] || 0) + 1; });
    var hd = db.phongBan.filter(function (p) { return !p.ngung; }), gt = db.phongBan.filter(function (p) { return p.ngung; });
    var chuaPhan = db.nhanVien.filter(function (nv) { return nv.trangThai !== 'nghi_viec' && !db.phongBan.some(function (p) { return p.ma === nv.phongBan; }); });
    var selLoai = function (v, attr) { return '<select ' + attr + '>' + Object.keys(TL.LOAI_DV).map(function (l) { return '<option value="' + l + '"' + (v === l ? ' selected' : '') + '>' + TL.LOAI_DV[l] + '</option>'; }).join('') + '</select>'; };
    var demLoai = {}; hd.forEach(function (p) { demLoai[p.loai] = (demLoai[p.loai] || 0) + 1; });
    el.innerHTML = '<div class="the"><h3>Phòng, đội<span class="phai">' + Object.keys(demLoai).map(function (l) { return demLoai[l] + ' ' + TL.LOAI_DV[l].toLowerCase(); }).join(' · ') + '</span></h3>' +
      '<p class="mo" style="margin-top:0">Nhân viên trực thuộc một phòng hoặc đội. Thứ tự ở đây là thứ tự nhóm trên bảng chấm công, bảng lương. ' +
      'Chuyển nhân viên qua lại: bấm <b>Chuyển NV</b> ở dòng đơn vị, hoặc chọn nhiều người ở trang Nhân viên → <b>Chuyển phòng / đội</b>. ' +
      'Muốn <b>xoá</b> phòng / đội còn nhân viên thì phải chuyển hết nhân viên sang đơn vị khác trước.</p>' +
      '<div class="cuon"><table class="bang" id="dv-bang"><thead><tr><th>STT</th><th>Mã</th><th>Loại</th><th style="min-width:280px">Tên phòng / đội</th><th>Nhân viên</th><th></th></tr></thead><tbody>' +
      hd.map(function (p, i) {
        return '<tr data-ma="' + h(p.ma) + '"><td class="giua">' + (i + 1) + '</td><td>' + h(p.ma) + '</td><td>' + selLoai(p.loai, 'data-f="loai" style="width:130px"') + '</td>' +
          '<td><input class="o-nhap chu" data-f="ten" value="' + h(p.ten) + '" style="width:100%"></td>' +
          '<td class="giua">' + (dem[p.ma] ? '<span class="lk" data-a="ds" title="Xem danh sách">' + dem[p.ma] + '</span>' : '<span class="mo">0</span>') + '</td>' +
          '<td style="white-space:nowrap"><button class="nut nho" data-a="len" title="Lên">▲</button> <button class="nut nho" data-a="xuong" title="Xuống">▼</button> ' +
          '<button class="nut nho" data-a="chuyen"' + (dem[p.ma] ? '' : ' disabled') + ' title="Chuyển nhân viên của đơn vị này sang đơn vị khác">Chuyển NV…</button> ' +
          '<button class="nut nho nguy" data-a="xoa" title="Xoá phòng / đội">' + App.icon('xoa') + '</button></td></tr>';
      }).join('') + (hd.length ? '' : '<tr><td colspan="6" class="trong">Chưa có phòng / đội.</td></tr>') +
      '</tbody></table></div>' +
      '<div class="hang" style="margin-top:12px">' + selLoai('phong', 'id="dv-loai"') + '<input id="dv-ma" placeholder="Mã (vd D1)" style="width:110px"><input id="dv-ten" placeholder="Tên (vd Đội Cấp nước số 3)" style="width:300px">' +
      '<button class="nut chinh" id="dv-them">' + App.icon('them') + 'Thêm phòng / đội</button></div>' +
      (chuaPhan.length ? '<div class="canh-bao" style="margin-top:12px">' + chuaPhan.length + ' nhân viên chưa thuộc phòng / đội nào: ' + chuaPhan.map(function (nv) { return h(nv.hoTen); }).join(', ') +
        ' <button class="nut nho" id="dv-phan">Phân vào phòng / đội…</button></div>' : '') + '</div>' +
      (gt.length ? '<div class="the"><h3>Đã giải thể<span class="phai">Giữ tên để xem, in lại các kỳ cũ</span></h3><div class="cuon"><table class="bang"><thead><tr><th>Mã</th><th>Loại</th><th>Tên</th><th>Còn trong lịch sử</th><th></th></tr></thead><tbody>' +
        gt.map(function (p) {
          var t = thamChieu(p.ma), s = [];
          if (t.qd) s.push(t.qd + ' quyết định'); if (t.nghiViec) s.push(t.nghiViec + ' người đã nghỉ việc'); if (t.chot) s.push(t.chot + ' kỳ lương đã chốt');
          return '<tr data-ma="' + h(p.ma) + '" class="mo"><td>' + h(p.ma) + '</td><td>' + h(TL.LOAI_DV[p.loai]) + '</td><td>' + h(p.ten) + '</td><td>' + (s.join(', ') || '—') + '</td>' +
            '<td><button class="nut nho" data-a="khoiphuc">Khôi phục</button>' + (t.co ? '' : ' <button class="nut nho nguy" data-a="xoahan">Xoá hẳn</button>') + '</td></tr>';
        }).join('') + '</tbody></table></div></div>' : '');

    function tim(ma) { return db.phongBan.filter(function (p) { return p.ma === ma; })[0]; }
    function veLai() { App.dmDonVi(el); }

    el.onchange = function (e) {
      var i = e.target.closest('[data-f]'); if (!i) return;
      var p = tim(i.closest('tr').dataset.ma); if (!p) return;
      if (i.dataset.f === 'ten') { if (!i.value.trim()) { App.bao('Tên không được để trống.', 'loi'); i.value = p.ten; return; } p.ten = i.value.trim(); }
      else p.loai = i.value;
      App.luu(); App.bao('Đã lưu');
      if (i.dataset.f === 'loai') veLai();
    };
    el.onclick = function (e) {
      if (e.target.closest('#dv-them')) { them(); return; }
      if (e.target.closest('#dv-phan')) { App.hopChuyenDonVi(chuaPhan, { tieuDe: 'Phân nhân viên vào phòng / đội', sauKhiChuyen: veLai }); return; }
      var b = e.target.closest('[data-a]'); if (!b) return;
      var ma = b.closest('tr').dataset.ma, p = tim(ma), a = b.dataset.a;
      if (a === 'len' || a === 'xuong') {
        // đổi chỗ với đơn vị đang hoạt động liền trước / sau
        var ds = db.phongBan, i = ds.indexOf(p), j = i;
        do { j += a === 'len' ? -1 : 1; } while (j >= 0 && j < ds.length && ds[j].ngung);
        if (j < 0 || j >= ds.length) return;
        ds[i] = ds[j]; ds[j] = p; App.luu(); veLai(); return;
      }
      if (a === 'ds') { App.hopDsDonVi(p); return; }
      if (a === 'chuyen') { App.hopChuyenDonVi(dangLam(ma), { tieuDe: 'Chuyển nhân viên của ' + p.ten, sauKhiChuyen: veLai }); return; }
      if (a === 'xoa') { xoa(p); return; }
      if (a === 'khoiphuc') { delete p.ngung; App.luu(); App.bao('Đã khôi phục ' + p.ten, 'tot'); veLai(); return; }
      if (a === 'xoahan') { App.xacNhan('Xoá hẳn <b>' + h(p.ten) + '</b>?', { nut: 'Xoá', nguy: true }).then(function (ok) { if (ok) { db.phongBan.splice(db.phongBan.indexOf(p), 1); App.luu(); veLai(); } }); }
    };

    function them() {
      var loai = App.$('#dv-loai').value, ma = App.$('#dv-ma').value.trim(), ten = App.$('#dv-ten').value.trim();
      if (!ten) { App.bao('Nhập tên phòng / đội.', 'loi'); App.$('#dv-ten').focus(); return; }
      var tenL = App.boDau(ten).toLowerCase();
      var trungTen = db.phongBan.filter(function (p) { return App.boDau(p.ten).toLowerCase() === tenL; })[0];
      if (trungTen) { App.bao(trungTen.ngung ? '“' + trungTen.ten + '” đã có trong danh sách đã giải thể – bấm Khôi phục.' : 'Đã có “' + trungTen.ten + '”.', 'loi'); return; }
      if (ma && db.phongBan.some(function (p) { return p.ma.toLowerCase() === ma.toLowerCase(); })) { App.bao('Mã ' + ma + ' đã dùng.', 'loi'); return; }
      if (!ma) {
        var goc = App.boDau(ten).replace(/^(phong|doi|ban|to)\s+/i, '').split(/[\s\-–]+/).map(function (w) { return /^\d+$/.test(w) ? w : w[0] || ''; }).join('').toUpperCase().replace(/[^A-Z0-9]/g, '');
        goc = ({ doi: 'D', to: 'T', ban: 'B', xn: 'XN' }[loai] || '') + (goc || 'DV');
        ma = goc; var n = 2;
        while (db.phongBan.some(function (p) { return p.ma.toLowerCase() === ma.toLowerCase(); })) ma = goc + n++;
      }
      db.phongBan.push({ ma: ma, ten: ten, loai: loai });
      App.luu(); App.bao('Đã thêm ' + ten + ' (mã ' + ma + ')', 'tot'); veLai();
    }

    function xoa(p) {
      var ds = dangLam(p.ma);
      var xong = function () {
        var t = thamChieu(p.ma);
        if (t.co) { p.ngung = true; App.bao('Đã xoá ' + p.ten + ' khỏi danh mục (giữ trong mục “Đã giải thể” vì còn trong lịch sử).', 'tot'); }
        else { db.phongBan.splice(db.phongBan.indexOf(p), 1); App.bao('Đã xoá ' + p.ten, 'tot'); }
        App.luu(); veLai();
      };
      if (ds.length) {
        App.hopChuyenDonVi(ds, {
          tieuDe: 'Xoá ' + p.ten, bo: p.ma, batBuoc: true, nut: 'Chuyển ' + ds.length + ' nhân viên và xoá',
          canhBao: '<b>Không xoá được ngay:</b> “' + h(p.ten) + '” còn <b>' + ds.length + ' nhân viên</b> đang làm việc. ' +
            'Phải chuyển các nhân viên này sang phòng / đội khác thì mới xoá được.',
          sauKhiChuyen: function () { if (dangLam(p.ma).length) veLai(); else xong(); }
        });
        return;
      }
      var t = thamChieu(p.ma);
      App.xacNhan('Xoá <b>' + h(p.ten) + '</b>?' + (t.co ? '<br><br><span class="mo">Đơn vị còn trong lịch sử (quyết định, người đã nghỉ việc hoặc bảng lương đã chốt) nên sẽ được chuyển vào mục “Đã giải thể” để giữ tên khi xem lại các kỳ cũ.</span>' : ''), { nut: 'Xoá', nguy: true })
        .then(function (ok) { if (ok) xong(); });
    }
  };

  /** Hộp xem danh sách nhân viên đang thuộc đơn vị */
  App.hopDsDonVi = function (p) {
    var ds = dangLam(p.ma).sort(function (a, b) { return String(a.ma).localeCompare(String(b.ma), 'vi', { numeric: true }); });
    App.hop({
      tieuDe: p.ten + ' – ' + ds.length + ' nhân viên', co: 'rong',
      than: '<div class="cuon"><table class="bang"><thead><tr><th>STT</th><th>Mã NV</th><th>Họ và tên</th><th>Chức vụ</th><th>Ngày vào</th></tr></thead><tbody>' +
        ds.map(function (nv, i) { return '<tr><td class="giua">' + (i + 1) + '</td><td>' + h(nv.ma) + '</td><td class="ten"><span class="lk" data-hs="' + nv.id + '">' + h(nv.hoTen) + '</span></td><td>' + h(nv.chucVu || '') + '</td><td class="giua">' + TL.hienNgay(nv.ngayVao) + '</td></tr>'; }).join('') +
        '</tbody></table></div>',
      moRa: function (el, dong) { el.onclick = function (e) { var s = e.target.closest('[data-hs]'); if (s) { dong(); App.moHoSo(s.dataset.hs, 'congviec'); } }; },
      nut: [{ ten: 'Chuyển nhân viên…', bam: function () { setTimeout(function () { App.hopChuyenDonVi(ds, { tieuDe: 'Chuyển nhân viên của ' + p.ten }); }, 0); } }, { ten: 'Đóng', loai: 'chinh' }]
    });
  };
})();
