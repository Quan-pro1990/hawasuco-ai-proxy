/* Định dạng số, quãng đường, thời gian theo kiểu Việt Nam. Không dùng DOM (chạy được cả trong Node để kiểm thử). */

const so1 = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
const so0 = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

/** Quãng đường hiển thị: "40 m", "350 m", "1,2 km", "15 km". */
export function quangDuong(m) {
  if (m == null || !isFinite(m)) return '';
  m = Math.max(0, m);
  if (m < 995) {
    const r = m < 100 ? Math.round(m / 10) * 10 : Math.round(m / 50) * 50;
    return r >= 1000 ? '1 km' : r + ' m';
  }
  return (m < 9950 ? so1.format(m / 1000) : so0.format(m / 1000)) + ' km';
}

/** Quãng đường để đọc bằng giọng nói: "300 mét", "1,5 ki lô mét". */
export function quangDuongNoi(m) {
  if (m < 950) {
    const r = m < 200 ? Math.max(10, Math.round(m / 10) * 10) : Math.round(m / 50) * 50;
    return r + ' mét';
  }
  const km = m / 1000;
  return (km < 9.95 ? so1.format(km) : so0.format(km)) + ' ki lô mét';
}

/** Thời gian: "1 phút", "23 phút", "1 giờ 5 phút", "2 ngày 3 giờ". */
export function thoiGian(giay) {
  if (giay == null || !isFinite(giay)) return '';
  const phut = Math.max(1, Math.round(giay / 60));
  if (phut < 60) return phut + ' phút';
  const gio = Math.floor(phut / 60), p = phut % 60;
  if (gio < 24) return gio + ' giờ' + (p ? ' ' + p + ' phút' : '');
  const ngay = Math.floor(gio / 24), g = gio % 24;
  return ngay + ' ngày' + (g ? ' ' + g + ' giờ' : '');
}

/** Giờ đến nơi nếu đi thêm `giay` giây kể từ bây giờ: "10:45". */
export function gioDen(giay, tuLuc = Date.now()) {
  return gioPhut(tuLuc + giay * 1000);
}

export function gioPhut(ms) {
  const d = new Date(ms);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

/** "17/10/2026 08:30" */
export function ngayGio(ms) {
  const d = new Date(ms);
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' +
    d.getFullYear() + ' ' + gioPhut(ms);
}

/** "vừa xong", "5 phút trước", "2 giờ trước", "3 ngày trước". */
export function thoiGianTruoc(ms, bayGio = Date.now()) {
  const s = Math.max(0, (bayGio - ms) / 1000);
  if (s < 60) return 'vừa xong';
  if (s < 3600) return Math.floor(s / 60) + ' phút trước';
  if (s < 86400) return Math.floor(s / 3600) + ' giờ trước';
  return Math.floor(s / 86400) + ' ngày trước';
}

const HUONG_LA = ['Bắc', 'Đông Bắc', 'Đông', 'Đông Nam', 'Nam', 'Tây Nam', 'Tây', 'Tây Bắc'];
/** Tên hướng la bàn từ phương vị (độ). */
export function huongLaBan(phuongVi) {
  return HUONG_LA[Math.round((((phuongVi % 360) + 360) % 360) / 45) % 8];
}

export function kichThuoc(byte) {
  if (byte < 1024 * 1024) return so0.format(byte / 1024) + ' KB';
  if (byte < 1024 * 1024 * 1024) return so1.format(byte / 1024 / 1024) + ' MB';
  return so1.format(byte / 1024 / 1024 / 1024) + ' GB';
}

export function tocDoKmh(mPerS) {
  return mPerS == null || !isFinite(mPerS) ? 0 : Math.round(mPerS * 3.6);
}

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Viết thường chữ cái đầu (để ghép "Sau 300 mét, rẽ phải…"). */
export function thuongDau(s) {
  return s ? s[0].toLocaleLowerCase('vi') + s.slice(1) : s;
}
