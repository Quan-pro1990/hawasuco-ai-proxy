/* App Android "Quản lý tài sản" — chạy với máy chủ bản cũ (trước 1.2.0): trang web bản cũ không biết dùng camera của
   app, mà máy chủ chạy http thì WebView không cho trang mở camera → không quét được tem.
   App chèn đoạn này sau mỗi lần tải trang (MainActivity.taoWeb, onPageFinished). Ở trang "Quét mã QR" thêm nút
   "Quét bằng camera của app" (trang http: mở luôn camera của app); mã quét được điền vào ô "gõ mã tài sản" của trang
   rồi gửi như bấm Tìm — trang bản cũ nào cũng có ô này. Trang bản mới (có window.ungDungQuayLai) tự dùng camera của
   app nên đoạn này không làm gì. */
(function () {
  var APP = window.QuanLyTaiSanApp;
  if (!APP || window.ungDungQuayLai || window.__qltsTuongThich) return;
  window.__qltsTuongThich = 1;
  var daMo = '', dungLienTuc = false;

  function lienTuc() { return /[?&](lientuc=1|dc=1|dot=)/.test(location.hash); }

  // trang https bản cũ có thể đang mở camera trong trang: tắt để camera của app dùng được
  function tatCameraTrang() {
    Array.prototype.forEach.call(document.querySelectorAll('video'), function (v) {
      var s = v.srcObject;
      if (s && s.getTracks) s.getTracks().forEach(function (t) { t.stop(); });
    });
  }

  function moQuet() {
    dungLienTuc = false;
    tatCameraTrang();
    APP.moQuet('mot', lienTuc() ? 'Quét tem tiếp theo' : 'Quét mã QR', 'Đưa tem QR vào giữa khung');
  }

  // app đọc được mã: điền vào ô gõ mã của trang Quét rồi gửi (trang tự tìm tài sản, ghi kiểm kê…)
  window.ungDungQuet = function (ma) {
    var f = document.querySelector('[data-nhap]'), o = f && f.querySelector('input');
    if (!o) return;
    o.value = ma;
    f.dispatchEvent(new Event('submit', { cancelable: true }));
    // quét liên tục (kiểm kê, điều chuyển): mở lại camera cho tem tiếp theo
    if (lienTuc()) setTimeout(function () { if (!dungLienTuc && /^#\/quet/.test(location.hash)) moQuet(); }, 1800);
  };
  // người dùng bấm Đóng / Back trên màn hình camera
  window.ungDungDongQuet = function () { dungLienTuc = true; };

  function gan() {
    if (!/^#\/quet/.test(location.hash)) { daMo = ''; return; }
    var k = document.querySelector('.quet-khung');
    if (!k || document.querySelector('[data-appquet]')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'nut chinh';
    b.setAttribute('data-appquet', '');
    b.textContent = 'Quét bằng camera của app';
    b.style.cssText = 'display:block;width:100%;max-width:640px;margin:0 auto 12px;font-size:17px;padding:12px';
    b.onclick = moQuet;
    k.parentNode.insertBefore(b, k);
    // trang http: trang không mở được camera (ô camera chỉ báo "chỉ cho mở camera trong trang https" — ẩn đi)
    // → mở luôn camera của app (mỗi lần vào trang Quét)
    if (window.isSecureContext === false) {
      k.style.display = 'none';
      if (daMo !== location.hash) {
        daMo = location.hash;
        setTimeout(moQuet, 0);
      }
    }
  }

  new MutationObserver(gan).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('hashchange', gan);
  gan();
})();
