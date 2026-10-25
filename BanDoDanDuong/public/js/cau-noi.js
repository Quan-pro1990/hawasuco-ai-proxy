/*
 * Cầu nối với ứng dụng gốc HawaMap trên Android (WebView) và iOS (WKWebView).
 * Trên trình duyệt thường mọi hàm ở đây không làm gì.
 *
 * Trang → ứng dụng:  guiGoc(loai, du)
 *   sanSang · noi {chu, chen, amLuong, toc} · danDuong {trạng thái} · batDau {tuyen, diemDen, tenDen, phuongTien, moPhong}
 *   ketThuc · traLoi {id, ketQua | loi} · giuManHinh {bat} · luuTep {ten, kieu, base64} · ngheTim (tìm bằng giọng nói, Android)
 * Ứng dụng → trang:  window.hawamap.goc.viTri(...), .lenh(id, ten, thamSo), .dongBoBatDau(du), .dongBoKetThuc(),
 *   .ketQuaNghe({chu} | {loi})
 */
const w = typeof window !== 'undefined' ? window : {};
const android = w.HawaMapAndroid || null;
const ios = (w.webkit && w.webkit.messageHandlers && w.webkit.messageHandlers.hawamap) || null;

export const laAppGoc = !!(android || ios);
export const nenTang = android ? 'android' : ios ? 'ios' : 'web';

function docCauHinh() {
  try {
    if (android && android.cauHinh) return JSON.parse(android.cauHinh()) || {};
    if (w.HAWAMAP_GOC) return w.HAWAMAP_GOC;
  } catch (e) { /* bỏ qua */ }
  return {};
}

/** { vaiTro: 'dienthoai' | 'xe', mayChuBaoCao?, hud?: 'trai' | 'phai' } */
export const cauHinhGoc = laAppGoc ? docCauHinh() : {};

/** Trang đang chạy trên màn hình xe (Android Auto / CarPlay): chỉ hiện bản đồ, ứng dụng gốc vẽ phần còn lại. */
export const cheDoXe = laAppGoc && (cauHinhGoc.vaiTro === 'xe' || new URLSearchParams(w.location ? w.location.search : '').get('xe') === '1');

export function guiGoc(loai, du = {}) {
  if (!laAppGoc) return;
  try {
    if (android) android.guiTin(loai, JSON.stringify(du));
    else ios.postMessage({ loai, du: JSON.parse(JSON.stringify(du)) });
  } catch (e) {
    console.warn('Không gửi được tin tới ứng dụng:', loai, e);
  }
}
