/* Chế độ máy chủ: khi phần mềm được mở qua máy chủ IIS (ChamCongMayChu.exe), dữ liệu dùng chung nằm trên máy chủ.
   - Đăng nhập bằng tài khoản trên máy chủ.
   - Mọi thay đổi tự lưu lên máy chủ (nén gzip), có số phiên bản để không ghi đè lên thay đổi của người khác.
   - Cứ 15 giây hỏi máy chủ: có ai vừa lưu thì tự tải bản mới (khi mình không có thay đổi chưa lưu).
   Mở trực tiếp file .html (không có máy chủ) thì phần mềm chạy như cũ, lưu trong trình duyệt. */
(function () {
  'use strict';
  var App = window.App, TL = window.TL, h = App.h;
  var MC = App.mayChu = { bat: false, phienBan: 0, nguoi: '', capNhat: '', toi: null, canLuu: false, dangLuu: false, loi: '', luuLuc: null };
  var hen = null, henHoi = null;

  function api(duong, o) {
    o = o || {};
    var hd = { 'X-Yeu-Cau': 'ChamCong' };
    Object.keys(o.headers || {}).forEach(function (k) { hd[k] = o.headers[k]; });
    if (o.json !== undefined) { hd['Content-Type'] = 'application/json'; o.body = JSON.stringify(o.json); }
    return fetch('api/' + duong, { method: o.method || 'GET', headers: hd, body: o.body, credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) {
        var ct = r.headers.get('Content-Type') || '';
        var p = ct.indexOf('json') >= 0 ? r.json() : r.text();
        return p.then(function (d) { return { status: r.status, ok: r.ok, data: d }; });
      });
  }
  MC.api = api;

  function nen(text) {
    if (typeof CompressionStream === 'undefined') return Promise.resolve({ body: text, gzip: false });
    try {
      var s = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
      return new Response(s).arrayBuffer().then(function (b) { return { body: b, gzip: true }; });
    } catch (e) { return Promise.resolve({ body: text, gzip: false }); }
  }

  /* ---------------- khởi động ---------------- */
  var khoiDongCu = App.khoiDong;
  App.khoiDong = function () {
    if (location.protocol === 'file:') { khoiDongCu(); return; }
    api('ping').then(function (r) {
      if (!r.ok || !r.data || r.data.ungDung !== 'ChamCong') { khoiDongCu(); return; }
      MC.bat = true;
      return api('toi').then(function (t) {
        if (t.status === 200) { MC.toi = t.data; taiVaBatDau(); } else manHinhDangNhap();
      });
    }).catch(function () { if (!MC.bat) khoiDongCu(); else manHinhDangNhap('Không kết nối được máy chủ.'); });
  };

  function taiDuLieu() {
    return api('dulieu').then(function (r) {
      if (r.status === 401) throw { dangNhap: true };
      if (!r.ok) throw new Error((r.data && r.data.loi) || 'Lỗi ' + r.status);
      MC.phienBan = r.data.phienBan; MC.nguoi = r.data.nguoi; MC.capNhat = r.data.capNhat;
      return r.data.duLieu;
    });
  }

  function taiVaBatDau() {
    App.$('#app').innerHTML = '<div style="padding:40px;text-align:center;color:#5f6875">Đang tải dữ liệu từ máy chủ…</div>';
    taiDuLieu().then(function (dl) {
      if (dl) { App.db = TL.chuanHoa(dl); App.batDauGiaoDien(); hoiDinhKy(); return; }
      App.db = TL.duLieuMoi();
      App.batDauGiaoDien();
      hoiDinhKy();
      lanDau();
    }).catch(function (e) {
      if (e && e.dangNhap) manHinhDangNhap();
      else App.$('#app').innerHTML = '<div class="the canh-bao" style="margin:40px">Không tải được dữ liệu từ máy chủ: ' + h(e.message || e) + '. <a href="">Thử lại</a></div>';
    });
  }

  /** Máy chủ chưa có dữ liệu: chọn đưa dữ liệu lên */
  function lanDau() {
    var coCucBo = null;
    try { var s = localStorage.getItem('ChamCongTinhLuong_v1'); if (s) { var d = JSON.parse(s); if (d && d.nhanVien && !d.laMau) coCucBo = d; } } catch (e) { /* bỏ qua */ }
    App.hop({
      tieuDe: 'Máy chủ chưa có dữ liệu', co: 'hep', giu: true, khongFocus: true,
      than: '<p style="margin-top:0">Đây là lần đầu dùng phần mềm trên máy chủ. Chọn dữ liệu ban đầu (mọi người dùng chung):</p>' +
        '<div style="display:grid;gap:8px">' +
        (coCucBo ? '<button class="nut chinh" data-c="cucbo">Đưa dữ liệu đang có trên máy này lên (' + coCucBo.nhanVien.length + ' nhân viên)</button>' : '') +
        '<label class="nut">Nhập từ file sao lưu (.json)…<input type="file" accept=".json" class="an" id="ld-tep"></label>' +
        '<button class="nut" data-c="trong">Bắt đầu với dữ liệu trống</button>' +
        '<button class="nut" data-c="mau">Dùng dữ liệu mẫu để xem thử</button></div>',
      moRa: function (el, dong) {
        el.onclick = function (e) {
          var b = e.target.closest('[data-c]'); if (!b) return;
          var c = b.dataset.c;
          App.db = c === 'cucbo' ? TL.chuanHoa(coCucBo) : c === 'mau' ? App.taoMau() : TL.duLieuMoi();
          dong(); App.luuNgay(); App.ky = App.kyMacDinh(); App.veLai();
        };
        App.$('#ld-tep', el).onchange = function () {
          var f = this.files[0]; if (!f) return;
          f.text().then(function (s) {
            var d = JSON.parse(s);
            if (!d || !Array.isArray(d.nhanVien) || !d.caiDat) throw new Error('File không phải bản sao lưu của phần mềm này.');
            App.db = TL.chuanHoa(d); dong(); App.luuNgay(); App.ky = App.kyMacDinh(); App.veLai();
          }).catch(function (e) { App.bao(e.message, 'loi'); });
        };
      }
    });
  }

  /* ---------------- đăng nhập ---------------- */
  function manHinhDangNhap(loi) {
    var ct = App.db && App.db.congTy ? App.db.congTy : TL.duLieuMoi().congTy;
    App.$('#app').className = '';
    App.$('#app').innerHTML = '<div class="dn-nen"><form class="dn-hop" autocomplete="on" onsubmit="return false">' +
      App.khoiThuongHieu(ct, true) +
      '<label class="o">Tên đăng nhập<input name="ten" autocomplete="username" required></label>' +
      '<label class="o">Mật khẩu<input name="matKhau" type="password" autocomplete="current-password" required></label>' +
      '<div class="dn-loi">' + h(loi || '') + '</div><button class="nut chinh" style="width:100%">Đăng nhập</button>' +
      '<div class="mo nho" style="text-align:center;margin-top:10px">Dữ liệu lưu trên máy chủ, dùng chung cho các phòng.</div></form></div>';
    var f = App.$('.dn-hop');
    f.ten.focus();
    f.onsubmit = function () {
      var nut = App.$('button', f); nut.disabled = true;
      api('dangnhap', { method: 'POST', json: { ten: f.ten.value.trim(), matKhau: f.matKhau.value } }).then(function (r) {
        nut.disabled = false;
        if (r.status === 200) { MC.toi = r.data; taiVaBatDau(); return; }
        App.$('.dn-loi', f).textContent = (r.data && r.data.loi) || 'Đăng nhập không được.';
        f.matKhau.value = ''; f.matKhau.focus();
      }).catch(function () { nut.disabled = false; App.$('.dn-loi', f).textContent = 'Không kết nối được máy chủ.'; });
      return false;
    };
  }

  /** Phiên hết hạn giữa chừng: đăng nhập lại trong hộp thoại, không mất thay đổi đang chờ lưu */
  var dangHoiLai = false;
  function dangNhapLai() {
    if (dangHoiLai) return;
    dangHoiLai = true;
    App.hop({
      tieuDe: 'Phiên đăng nhập đã hết hạn', co: 'hep', giu: true,
      than: '<form class="form" style="grid-template-columns:1fr" onsubmit="return false"><p class="mo" style="margin:0">Đăng nhập lại để tiếp tục lưu dữ liệu (thay đổi chưa lưu vẫn được giữ).</p>' +
        '<label class="o">Tên đăng nhập<input name="ten" value="' + h(MC.toi ? MC.toi.ten : '') + '"></label><label class="o">Mật khẩu<input name="matKhau" type="password"></label></form>',
      khiDong: function () { dangHoiLai = false; },
      nut: [{
        ten: 'Đăng nhập', loai: 'chinh', bam: function (el) {
          var f = App.$('form', el);
          api('dangnhap', { method: 'POST', json: { ten: f.ten.value.trim(), matKhau: f.matKhau.value } }).then(function (r) {
            if (r.status === 200) { MC.toi = r.data; App.$('.mo-nen .dong').click(); App.luuNgay(); veTrangThai(); }
            else App.bao((r.data && r.data.loi) || 'Đăng nhập không được.', 'loi');
          });
          return false;
        }
      }]
    });
  }

  App.dangXuat = function () {
    var xong = function () { location.reload(); };
    if (MC.canLuu || MC.dangLuu) { App.luuNgay(); setTimeout(function () { api('dangxuat', { method: 'POST' }).then(xong, xong); }, 1500); }
    else api('dangxuat', { method: 'POST' }).then(xong, xong);
  };

  /* ---------------- lưu ---------------- */
  var luuCucBo = App.luuNgay, henCucBo = App.luu;
  App.luu = function () {
    if (!MC.bat) return henCucBo();
    MC.canLuu = true; veTrangThai();
    clearTimeout(hen); hen = setTimeout(guiLuu, 1200);
  };
  App.luuNgay = function () {
    if (!MC.bat) return luuCucBo();
    MC.canLuu = true;
    clearTimeout(hen); guiLuu();
  };

  function guiLuu(ghiDe) {
    if (MC.dangLuu) { MC.lai = true; return; }
    if (!MC.canLuu && !ghiDe) return;
    MC.canLuu = false; MC.dangLuu = true; MC.loi = ''; veTrangThai();
    var text = JSON.stringify(App.db);
    nen(text).then(function (n) {
      var hd = { 'X-Phien-Ban': String(ghiDe ? ghiDe : MC.phienBan), 'Content-Type': 'application/json' };
      if (n.gzip) hd['Content-Encoding'] = 'gzip';
      return api('dulieu', { method: 'PUT', headers: hd, body: n.body });
    }).then(function (r) {
      MC.dangLuu = false;
      if (r.status === 200) { MC.phienBan = r.data.phienBan; MC.nguoi = r.data.nguoi; MC.capNhat = r.data.capNhat; MC.luuLuc = new Date(); }
      else if (r.status === 409) { MC.canLuu = true; xungDot(r.data); }
      else if (r.status === 401) { MC.canLuu = true; MC.loi = 'Hết phiên đăng nhập'; dangNhapLai(); }
      else { MC.canLuu = true; MC.loi = (r.data && r.data.loi) || 'Lỗi ' + r.status; App.bao('Không lưu được lên máy chủ: ' + MC.loi, 'loi'); }
    }).catch(function () {
      MC.dangLuu = false; MC.canLuu = true; MC.loi = 'Mất kết nối máy chủ';
    }).then(function () {
      veTrangThai();
      if (MC.lai) { MC.lai = false; clearTimeout(hen); hen = setTimeout(guiLuu, 300); }
      else if (MC.canLuu && MC.loi && !dangHoiLai) { clearTimeout(hen); hen = setTimeout(guiLuu, 10000); }
    });
  }

  var dangHoiXungDot = false;
  function xungDot(tt) {
    if (dangHoiXungDot) return;
    dangHoiXungDot = true;
    var luc = tt && tt.capNhat ? new Date(tt.capNhat).toLocaleTimeString('vi-VN') : '';
    App.hop({
      tieuDe: 'Có người vừa lưu dữ liệu', co: 'hep', giu: true,
      than: '<p style="margin-top:0"><b>' + h(tt && tt.nguoi || 'Người khác') + '</b> vừa lưu dữ liệu lên máy chủ' + (luc ? ' lúc ' + luc : '') + ', trong khi máy này còn thay đổi chưa lưu.</p>' +
        '<p><b>Tải bản mới nhất</b>: lấy dữ liệu của người kia, bỏ thay đổi vừa làm trên máy này (làm lại thao tác nếu cần).<br>' +
        '<b>Ghi đè</b>: lưu dữ liệu trên máy này, thay đổi của người kia sẽ mất.</p>',
      khiDong: function () { dangHoiXungDot = false; },
      nut: [
        { ten: 'Ghi đè bằng dữ liệu của tôi', loai: 'nguy', bam: function () { MC.phienBan = tt.phienBan; guiLuu(String(tt.phienBan)); } },
        { ten: 'Tải bản mới nhất', loai: 'chinh', bam: function () { MC.canLuu = false; taiLai(true); } }
      ]
    });
  }

  function taiLai(bao) {
    return taiDuLieu().then(function (dl) {
      if (!dl) return;
      App.db = TL.chuanHoa(dl);
      MC.canLuu = false;
      App.veLai(); veTrangThai();
      if (bao) App.bao('Đã tải dữ liệu mới nhất' + (MC.nguoi ? ' (' + MC.nguoi + ' lưu lúc ' + new Date(MC.capNhat).toLocaleTimeString('vi-VN') + ')' : '') + '.', 'tot');
    }).catch(function (e) { if (e && e.dangNhap) dangNhapLai(); });
  }

  /** Hỏi máy chủ định kỳ: có người khác lưu thì tải bản mới (khi máy này đang rảnh, không có thay đổi chưa lưu) */
  function hoiDinhKy() {
    clearInterval(henHoi);
    henHoi = setInterval(function () {
      if (document.hidden || MC.dangLuu) return;
      api('trangthai').then(function (r) {
        if (r.status === 401) { dangNhapLai(); return; }
        if (!r.ok) return;
        if (MC.loi === 'Mất kết nối máy chủ') { MC.loi = ''; veTrangThai(); if (MC.canLuu) guiLuu(); }
        if (r.data.phienBan > MC.phienBan && !MC.canLuu) {
          var dangSua = App.$('.mo-nen') || (document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && App.$('#noi').contains(document.activeElement));
          if (dangSua) return; // đợi người dùng sửa xong
          taiLai(false).then(function () { App.bao('Đã cập nhật dữ liệu mới do ' + (r.data.nguoi || 'người khác') + ' vừa lưu.'); });
        }
      }).catch(function () { MC.loi = 'Mất kết nối máy chủ'; veTrangThai(); });
    }, 15000);
  }

  window.addEventListener('beforeunload', function (e) {
    if (MC.bat && (MC.canLuu || MC.dangLuu)) { guiLuu(); e.preventDefault(); e.returnValue = ''; }
  });

  /* ---------------- trạng thái ở thanh bên ---------------- */
  function veTrangThai() {
    var el = App.$('#tt-maychu'); if (!el || !MC.bat) return;
    var tt = MC.loi ? '<span class="tt-cham do"></span>' + h(MC.loi) + (MC.canLuu ? ' – chưa lưu' : '')
      : MC.dangLuu ? '<span class="tt-cham cam"></span>Đang lưu lên máy chủ…'
        : MC.canLuu ? '<span class="tt-cham cam"></span>Có thay đổi chưa lưu'
          : '<span class="tt-cham xanh"></span>Đã lưu trên máy chủ' + (MC.luuLuc ? ' ' + MC.luuLuc.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '');
    el.innerHTML = '<div>' + tt + '</div><div class="mo">' + h(MC.toi ? MC.toi.ten : '') + (MC.toi && MC.toi.vaiTro === 'quan_tri' ? ' (quản trị)' : '') +
      ' · <a href="#" id="dang-xuat">Đăng xuất</a></div>';
    App.$('#dang-xuat', el).onclick = function (e) { e.preventDefault(); App.dangXuat(); };
  }
  App.veTrangThaiMayChu = veTrangThai;

  /* ---------------- Cài đặt → máy chủ: sao lưu, tài khoản, nhật ký ---------------- */
  App.veMayChuCaiDat = function (el) {
    var qt = MC.toi && MC.toi.vaiTro === 'quan_tri';
    el.innerHTML = '<div class="the"><h3>Dữ liệu trên máy chủ</h3>' +
      '<p style="margin-top:0">Dữ liệu dùng chung nằm trên máy chủ, tự lưu sau mỗi thay đổi. Phiên bản hiện tại: <b>' + MC.phienBan + '</b>' +
      (MC.nguoi ? ', lưu gần nhất bởi <b>' + h(MC.nguoi) + '</b> lúc ' + new Date(MC.capNhat).toLocaleString('vi-VN') : '') + '.</p>' +
      '<p class="mo nho">Máy chủ tự sao lưu mỗi ngày (giữ 120 ngày gần nhất). Bạn cũng có thể tải 1 bản về máy để cất riêng.</p>' +
      '<div class="hang"><button class="nut" id="mc-tai">' + App.icon('tai') + 'Tải bản sao lưu về máy</button>' +
      '<label class="nut">' + App.icon('nhap') + 'Khôi phục từ file…<input type="file" id="dl-mo" accept=".json" class="an"></label>' +
      '<button class="nut" id="mc-doimk">Đổi mật khẩu của tôi</button><button class="nut" id="mc-dx">Đăng xuất</button></div></div>' +
      (qt ? '<div class="the"><h3>Bản sao lưu hằng ngày trên máy chủ<span class="phai" id="mc-thumuc"></span></h3><div class="cuon" style="max-height:300px"><table class="bang" id="mc-sl"><tbody><tr><td class="trong">Đang tải…</td></tr></tbody></table></div></div>' +
        '<div class="the"><h3>Tài khoản đăng nhập<span class="phai"><button class="nut nho chinh" id="mc-tk-them">' + App.icon('them') + 'Thêm tài khoản</button></span></h3><div class="cuon"><table class="bang" id="mc-tk"><tbody><tr><td class="trong">Đang tải…</td></tr></tbody></table></div>' +
        '<p class="mo nho">Quản trị: quản lý tài khoản, sao lưu. Nhập liệu: dùng mọi chức năng chấm công, lương, nhân sự.</p></div>' +
        '<div class="the"><h3>Nhật ký máy chủ (300 dòng gần nhất)</h3><pre id="mc-nk" style="max-height:260px;overflow:auto;font-size:12px;background:#f6f8fb;padding:10px;border-radius:8px;margin:0">Đang tải…</pre></div>'
        : '<div class="the mo">Tài khoản quản trị mới xem được bản sao lưu, tài khoản và nhật ký máy chủ.</div>');
    App.$('#mc-tai', el).onclick = function () {
      var d = new Date(), ten = 'SaoLuu_ChamCong_' + d.getFullYear() + TL.pad(d.getMonth() + 1) + TL.pad(d.getDate()) + '.json';
      App.XL.taiXuong(ten, new Blob([JSON.stringify(App.db)], { type: 'application/json' }));
    };
    App.$('#mc-dx', el).onclick = App.dangXuat;
    App.$('#mc-doimk', el).onclick = doiMatKhau;
    if (!qt) return;
    veSaoLuu(el); veTaiKhoan(el);
    api('nhatky').then(function (r) { App.$('#mc-nk', el).textContent = r.ok ? r.data : 'Không đọc được.'; });
    App.$('#mc-tk-them', el).onclick = function () { formTaiKhoan(null, el); };
  };

  function veSaoLuu(el) {
    api('saoluu').then(function (r) {
      if (!r.ok) return;
      App.$('#mc-thumuc', el).textContent = 'Thư mục trên máy chủ: ' + r.data.thuMuc;
      var ds = r.data.ds || [];
      App.$('#mc-sl', el).innerHTML = '<thead><tr><th>Bản sao lưu</th><th>Lúc</th><th class="so">Dung lượng</th><th></th></tr></thead><tbody>' +
        (ds.length ? ds.map(function (x) {
          return '<tr><td>' + h(x.ten) + '</td><td class="giua">' + new Date(x.luc).toLocaleString('vi-VN') + '</td><td class="so">' + App.so(Math.round(x.kichThuoc / 1024)) + ' KB</td>' +
            '<td><a class="nut nho" href="api/saoluu/tai?ten=' + encodeURIComponent(x.ten) + '">' + App.icon('tai') + 'Tải về</a> <button class="nut nho nguy" data-kp="' + h(x.ten) + '">Khôi phục</button></td></tr>';
        }).join('') : '<tr><td colspan="4" class="trong">Chưa có bản sao lưu (máy chủ tạo bản đầu tiên vào lần lưu đầu mỗi ngày).</td></tr>') + '</tbody>';
      App.$('#mc-sl', el).onclick = function (e) {
        var b = e.target.closest('[data-kp]'); if (!b) return;
        App.xacNhan('Khôi phục dữ liệu từ bản <b>' + h(b.dataset.kp) + '</b>? Dữ liệu hiện tại trên máy chủ sẽ được thay bằng bản này (bản hiện tại vẫn còn trong bản sao lưu của hôm nay).', { nut: 'Khôi phục', nguy: true }).then(function (ok) {
          if (!ok) return;
          api('saoluu/khoiphuc', { method: 'POST', json: { ten: b.dataset.kp } }).then(function (r2) {
            if (!r2.ok) { App.bao((r2.data && r2.data.loi) || 'Không khôi phục được.', 'loi'); return; }
            taiLai(false).then(function () { App.bao('Đã khôi phục từ ' + b.dataset.kp, 'tot'); });
          });
        });
      };
    });
  }

  function veTaiKhoan(el) {
    api('taikhoan').then(function (r) {
      if (!r.ok) return;
      App.$('#mc-tk', el).innerHTML = '<thead><tr><th>Tên đăng nhập</th><th>Vai trò</th><th>Tạo lúc</th><th></th></tr></thead><tbody>' +
        r.data.map(function (x) {
          return '<tr data-ten="' + h(x.ten) + '" data-vt="' + h(x.vaiTro) + '"><td class="ten">' + h(x.ten) + (MC.toi && x.ten === MC.toi.ten ? ' <span class="the-tt lam">bạn</span>' : '') + '</td>' +
            '<td>' + (x.vaiTro === 'quan_tri' ? 'Quản trị' : 'Nhập liệu') + '</td><td class="giua">' + (x.taoLuc ? new Date(x.taoLuc).toLocaleDateString('vi-VN') : '') + '</td>' +
            '<td><button class="nut nho" data-a="sua">Đặt lại mật khẩu / vai trò</button> ' + (MC.toi && x.ten === MC.toi.ten ? '' : '<button class="nut nho nguy" data-a="xoa">' + App.icon('xoa') + '</button>') + '</td></tr>';
        }).join('') + '</tbody>';
      App.$('#mc-tk', el).onclick = function (e) {
        var b = e.target.closest('[data-a]'); if (!b) return;
        var tr = b.closest('tr');
        if (b.dataset.a === 'sua') formTaiKhoan({ ten: tr.dataset.ten, vaiTro: tr.dataset.vt }, el);
        else App.xacNhan('Xoá tài khoản <b>' + h(tr.dataset.ten) + '</b>?', { nut: 'Xoá', nguy: true }).then(function (ok) {
          if (!ok) return;
          api('taikhoan?ten=' + encodeURIComponent(tr.dataset.ten), { method: 'DELETE' }).then(function (r2) {
            if (!r2.ok) App.bao((r2.data && r2.data.loi) || 'Không xoá được.', 'loi'); else veTaiKhoan(el);
          });
        });
      };
    });
  }

  function formTaiKhoan(tk, elCha) {
    var f = App.F;
    App.hop({
      tieuDe: tk ? 'Tài khoản ' + tk.ten : 'Thêm tài khoản', co: 'hep',
      than: '<form class="form" style="grid-template-columns:1fr" onsubmit="return false">' +
        f.o('Tên đăng nhập', tk ? '<input name="ten" value="' + h(tk.ten) + '" readonly>' : f.txt('ten', '', 'autocomplete="off"')) +
        f.o(tk ? 'Mật khẩu mới (để trống = giữ nguyên)' : 'Mật khẩu (ít nhất 6 ký tự)', '<input name="matKhau" type="password" autocomplete="new-password">') +
        f.o('Vai trò', f.sel('vaiTro', tk ? tk.vaiTro : 'nhap_lieu', [['nhap_lieu', 'Nhập liệu'], ['quan_tri', 'Quản trị']])) + '</form>',
      nut: [{ ten: 'Huỷ' }, {
        ten: 'Lưu', loai: 'chinh', bam: function (el) {
          var v = f.doc(el);
          api('taikhoan', { method: 'POST', json: { ten: v.ten, matKhau: v.matKhau, vaiTro: v.vaiTro } }).then(function (r) {
            if (!r.ok) { App.bao((r.data && r.data.loi) || 'Không lưu được.', 'loi'); return; }
            App.bao('Đã lưu tài khoản ' + v.ten, 'tot'); App.$('.mo-nen .dong').click(); veTaiKhoan(elCha);
          });
          return false;
        }
      }]
    });
  }

  function doiMatKhau() {
    App.hop({
      tieuDe: 'Đổi mật khẩu', co: 'hep',
      than: '<form class="form" style="grid-template-columns:1fr" onsubmit="return false">' +
        '<label class="o">Mật khẩu hiện tại<input name="cu" type="password" autocomplete="current-password"></label>' +
        '<label class="o">Mật khẩu mới (ít nhất 6 ký tự)<input name="moi" type="password" autocomplete="new-password"></label>' +
        '<label class="o">Nhập lại mật khẩu mới<input name="moi2" type="password" autocomplete="new-password"></label></form>',
      nut: [{ ten: 'Huỷ' }, {
        ten: 'Đổi mật khẩu', loai: 'chinh', bam: function (el) {
          var v = App.F.doc(el);
          if (v.moi !== v.moi2) { App.bao('Hai lần nhập mật khẩu mới không giống nhau.', 'loi'); return false; }
          api('doimatkhau', { method: 'POST', json: { cu: v.cu, moi: v.moi } }).then(function (r) {
            if (!r.ok) { App.bao((r.data && r.data.loi) || 'Không đổi được.', 'loi'); return; }
            App.bao('Đã đổi mật khẩu.', 'tot'); App.$('.mo-nen .dong').click();
          });
          return false;
        }
      }]
    });
  }
})();
