/* Hồ sơ scan của nhân viên (hợp đồng, quyết định, CCCD, bằng cấp…): lưu trữ để khi cần thì xem, tải xuống.
   - Chạy trên máy chủ: tệp lưu trên máy chủ (thư mục dữ liệu, ổ D), máy chủ chép thêm 1 bản vào thư mục sao lưu.
   - Chạy 1 file trên máy: tệp lưu trong trình duyệt của máy đó (IndexedDB).
   Thông tin tệp (tên, loại, ngày, gắn với hợp đồng…) nằm trong hồ sơ nhân viên: nv.hoSoTep. */
(function () {
  'use strict';
  var App = window.App, h = App.h;

  var LOAI = {
    hop_dong: 'Hợp đồng lao động', quyet_dinh: 'Quyết định', cccd: 'CCCD, giấy tờ tuỳ thân', so_yeu: 'Sơ yếu lý lịch, đơn xin việc',
    bang_cap: 'Bằng cấp, chứng chỉ', suc_khoe: 'Giấy khám sức khoẻ', bhxh: 'Sổ, tờ khai BHXH', thue: 'Thuế, người phụ thuộc', khac: 'Khác'
  };
  var DUOI = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'tif', 'tiff', 'doc', 'docx', 'xls', 'xlsx'];
  var XEM_DUOC = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif'];
  var MIME = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', tif: 'image/tiff', tiff: 'image/tiff' };
  var TOI_DA = 25 * 1024 * 1024;

  function mayChu() { return !!(App.mayChu && App.mayChu.bat); }
  function duoi(ten) { var m = /\.([a-z0-9]{2,5})$/i.exec(ten || ''); return m ? m[1].toLowerCase() : ''; }
  function maNgauNhien() { var a = new Uint8Array(16); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }

  /* ---------- lưu trong trình duyệt (IndexedDB) ---------- */
  var moDB = null;
  function db() {
    if (!moDB) moDB = new Promise(function (ok, loi) {
      if (!window.indexedDB) { loi(new Error('Trình duyệt không hỗ trợ lưu tệp (IndexedDB).')); return; }
      var r = indexedDB.open('ChamCongHoSoScan', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('tep'); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { loi(r.error || new Error('Không mở được kho tệp của trình duyệt.')); };
    });
    return moDB;
  }
  function idb(cach, fn) {
    return db().then(function (d) {
      return new Promise(function (ok, loi) {
        var tx = d.transaction('tep', cach), r = fn(tx.objectStore('tep'));
        tx.oncomplete = function () { ok(r && r.result); };
        tx.onerror = tx.onabort = function () { loi(tx.error || new Error('Lỗi kho tệp của trình duyệt (có thể đã đầy).')); };
      });
    });
  }

  function kiemTra(file) {
    var d = duoi(file.name);
    if (DUOI.indexOf(d) < 0) return 'Tệp “' + file.name + '”: chỉ nhận PDF, ảnh (JPG, PNG, WEBP, GIF, TIFF), Word, Excel.';
    if (!file.size) return 'Tệp “' + file.name + '” rỗng.';
    if (file.size > TOI_DA) return 'Tệp “' + file.name + '” lớn hơn 25 MB – hãy scan độ phân giải thấp hơn hoặc tách nhỏ.';
    return '';
  }

  App.TEP = {
    LOAI: LOAI, DUOI: DUOI, TOI_DA: TOI_DA, duoi: duoi, kiemTra: kiemTra, mayChu: mayChu,
    xemDuoc: function (t) { return XEM_DUOC.indexOf(t.duoi || duoi(t.ten)) >= 0; },
    /** Tải 1 tệp lên; trả về bản ghi thông tin tệp để đưa vào nv.hoSoTep */
    taiLen: function (nv, file, them) {
      var d = duoi(file.name), ghi = Object.assign({ ten: file.name, duoi: d, kichThuoc: file.size, ngay: new Date().toISOString(),
        nguoi: App.mayChu && App.mayChu.toi ? App.mayChu.toi.ten : '', loai: 'khac', ghiChu: '', hopDongId: '' }, them || {});
      if (mayChu()) {
        return fetch('api/tep?nv=' + encodeURIComponent(nv.id) + '&ten=' + encodeURIComponent(file.name), {
          method: 'POST', body: file, credentials: 'same-origin',
          headers: { 'X-Yeu-Cau': 'ChamCong', 'Content-Type': file.type || 'application/octet-stream' }
        }).then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (j) {
            if (r.status === 401) throw new Error('Phiên đăng nhập đã hết hạn – đăng nhập lại rồi tải lên lại.');
            if (!r.ok) throw new Error(j.loi || 'Máy chủ không nhận tệp (lỗi ' + r.status + ').');
            return Object.assign(ghi, { id: j.id, noiLuu: 'may_chu' });
          });
        });
      }
      var id = maNgauNhien() + '.' + d;
      return idb('readwrite', function (s) { return s.put(file, id); }).then(function () { return Object.assign(ghi, { id: id, noiLuu: 'trinh_duyet' }); });
    },
    /** Nội dung tệp (Blob) */
    layBlob: function (nv, t) {
      if (t.noiLuu === 'may_chu') {
        if (!mayChu()) return Promise.reject(new Error('Tệp lưu trên máy chủ – hãy mở phần mềm qua máy chủ để xem.'));
        return fetch('api/tep?nv=' + encodeURIComponent(nv.id) + '&id=' + encodeURIComponent(t.id) + '&tai=1', { credentials: 'same-origin' }).then(function (r) {
          if (!r.ok) throw new Error(r.status === 404 ? 'Không còn tệp này trên máy chủ.' : 'Không tải được tệp (lỗi ' + r.status + ').');
          return r.blob();
        });
      }
      return idb('readonly', function (s) { return s.get(t.id); }).then(function (b) {
        if (!b) throw new Error('Tệp không có trong trình duyệt của máy này (tệp được tải lên từ máy khác khi chưa dùng máy chủ).');
        return b;
      });
    },
    /** Mở xem (PDF, ảnh) trong tab mới */
    xem: function (nv, t) {
      if (t.noiLuu === 'may_chu' && mayChu()) {
        window.open('api/tep?nv=' + encodeURIComponent(nv.id) + '&id=' + encodeURIComponent(t.id) + '&ten=' + encodeURIComponent(t.ten), '_blank', 'noopener');
        return Promise.resolve();
      }
      var w = window.open('', '_blank');
      return App.TEP.layBlob(nv, t).then(function (b) {
        var url = URL.createObjectURL(new Blob([b], { type: MIME[t.duoi] || b.type || 'application/octet-stream' }));
        if (w) w.location = url; else window.open(url, '_blank');
        setTimeout(function () { URL.revokeObjectURL(url); }, 120000);
      }, function (e) { if (w) w.close(); throw e; });
    },
    taiVe: function (nv, t) {
      return App.TEP.layBlob(nv, t).then(function (b) { App.XL.taiXuong(t.ten, b); });
    },
    xoa: function (nv, t) {
      if (t.noiLuu === 'may_chu') {
        if (!mayChu()) return Promise.resolve();
        return fetch('api/tep?nv=' + encodeURIComponent(nv.id) + '&id=' + encodeURIComponent(t.id), { method: 'DELETE', credentials: 'same-origin', headers: { 'X-Yeu-Cau': 'ChamCong' } })
          .then(function (r) { if (!r.ok && r.status !== 404) throw new Error('Máy chủ không xoá được tệp (lỗi ' + r.status + ').'); });
      }
      return idb('readwrite', function (s) { return s.delete(t.id); });
    },
    /** Tải tất cả hồ sơ scan của 1 người thành 1 tệp .zip (thư mục theo loại) */
    taiTatCa: function (nv, ds) {
      var tep = [], loi = [], dem = {};
      return ds.reduce(function (p, t) {
        return p.then(function () {
          return App.TEP.layBlob(nv, t).then(function (b) { return b.arrayBuffer(); }).then(function (buf) {
            var thuMuc = (LOAI[t.loai] || 'Khác').replace(/\s*,\s*/g, ' - ').replace(/[\\/:*?"<>|]/g, ' ').trim(), ten = t.ten.replace(/[\\/:*?"<>|]/g, '_'), k = thuMuc + '/' + ten;
            dem[k] = (dem[k] || 0) + 1; if (dem[k] > 1) k = k.replace(/(\.[^.]+)$/, ' (' + dem[k] + ')$1');
            tep.push({ ten: k, data: new Uint8Array(buf) });
          }, function (e) { loi.push(t.ten + ': ' + e.message); });
        });
      }, Promise.resolve()).then(function () {
        if (!tep.length) throw new Error(loi.join('; ') || 'Không có tệp.');
        App.XL.taiXuong(App.tenFile('HoSo_' + nv.ma + '_' + nv.hoTen) + '.zip', App.XL.zip(tep), 'application/zip');
        return loi;
      });
    },
    dungLuong: function (n) { return n >= 1048576 ? App.so(Math.round(n / 104857.6) / 10) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  };

  /** Chọn tệp (có thể nhiều) rồi tải lên; o: { loai, hopDongId, sauKhi } */
  App.chonTepHoSo = function (nv, o) {
    o = o || {};
    var i = document.createElement('input');
    i.type = 'file'; i.multiple = true; i.accept = DUOI.map(function (d) { return '.' + d; }).join(',');
    i.onchange = function () { App.taiTepHoSo(nv, Array.prototype.slice.call(i.files), o); };
    i.click();
  };
  App.taiTepHoSo = function (nv, files, o) {
    o = o || {};
    var hong = files.map(kiemTra).filter(Boolean), dung = files.filter(function (f) { return !kiemTra(f); });
    if (hong.length) App.bao(hong.join(' '), 'loi');
    if (!dung.length) return;
    App.bao('Đang tải lên ' + dung.length + ' tệp…');
    var xong = 0, loi = [];
    dung.reduce(function (p, f) {
      return p.then(function () {
        return App.TEP.taiLen(nv, f, { loai: o.loai || 'khac', hopDongId: o.hopDongId || '' }).then(function (ghi) {
          nv.hoSoTep = nv.hoSoTep || []; nv.hoSoTep.push(ghi); xong++;
        }, function (e) { loi.push(e.message); });
      });
    }, Promise.resolve()).then(function () {
      if (xong) { if (App.dongBoHoSo) App.dongBoHoSo(nv); App.luuNgay ? App.luuNgay() : App.luu(); }
      if (xong) App.bao('Đã lưu ' + xong + ' tệp vào hồ sơ ' + nv.hoTen + (App.TEP.mayChu() ? ' (trên máy chủ)' : ' (trong trình duyệt của máy này)') + '.', 'tot');
      if (loi.length) App.bao(loi.join(' '), 'loi');
      if (o.sauKhi) o.sauKhi(); else App.veLai();
    });
  };
  App.HO_SO_DUOI = DUOI;
  void h;
})();
