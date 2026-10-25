/*
 * Đọc liên kết / văn bản chia sẻ từ ứng dụng bản đồ khác (Google Maps, Apple Maps, VietMap, geo:, google.navigation:,
 * hoặc toạ độ gõ tay) ra địa điểm. Dùng chung cho trang web và máy chủ (server.js mở liên kết rút gọn).
 */

/** Tên miền liên kết rút gọn của Google Maps (cần máy chủ mở ra liên kết đầy đủ). */
export const MIEN_RUT_GON = ['maps.app.goo.gl', 'goo.gl', 'g.co'];

/** Tên miền Google được phép đi qua khi mở liên kết rút gọn. */
export function laMienGoogle(host) {
  host = String(host || '').toLowerCase();
  return MIEN_RUT_GON.includes(host) || /^([a-z0-9-]+\.)*google\.(com|[a-z]{2}|com?\.[a-z]{2})$/.test(host);
}

const SO = '(-?\\d{1,3}(?:\\.\\d+)?)';
const CAP_TOA_DO = new RegExp(`^\\s*${SO}\\s*[,;\\s]\\s*${SO}\\s*$`);

function toaDoHopLe(lat, lng) {
  return isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

/** "21.0287,105.8522" → [lng, lat] hoặc null. */
export function docCapToaDo(s) {
  const m = CAP_TOA_DO.exec(String(s || '').replace(/\+/g, ' '));
  if (!m) return null;
  const lat = +m[1], lng = +m[2];
  return toaDoHopLe(lat, lng) ? [lng, lat] : null;
}

function giaiMa(s) {
  try { return decodeURIComponent(String(s).replace(/\+/g, ' ')); } catch (e) { return String(s); }
}

/** Tách tên trong ngoặc ở cuối ("21.02,105.85(Nhà hát)") → { phan, ten }. */
function tachTen(s) {
  const m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(s);
  return m ? { phan: m[1], ten: m[2].trim() } : { phan: s, ten: '' };
}

/** Kết quả từ một giá trị q / query / daddr / destination: toạ độ hoặc chữ để tìm. */
function tuGiaTri(v, kq) {
  if (!v) return false;
  const { phan, ten } = tachTen(giaiMa(v).trim());
  const p = docCapToaDo(phan);
  if (p) { kq.viTri = p; if (ten) kq.ten = ten; return true; }
  if (CAP_TOA_DO.test(phan)) return false;            // toạ độ 0,0 hoặc ngoài phạm vi: không phải địa chỉ để tìm
  if (phan && !kq.truyVan) kq.truyVan = phan;
  if (ten && !kq.ten) kq.ten = ten;
  return !!phan;
}

/**
 * Đọc địa điểm từ chuỗi chia sẻ.
 * @returns null nếu không nhận ra, hoặc { viTri?: [lng, lat], ten?, truyVan? (chữ cần tìm), chiDuong?, rutGon? (liên kết cần mở trên máy chủ) }
 */
export function docLienKet(chuoi) {
  const s = String(chuoi || '').trim();
  if (!s) return null;
  const p = docCapToaDo(s);
  if (p) return { viTri: p, ten: '' };
  const kq = {};

  // geo:lat,lng?q=… và google.navigation:q=…
  const geo = /\b(geo:|google\.navigation:)([^\s(]*(?:\([^)]*\))?[^\s]*)/i.exec(s);     // tên trong ngoặc có thể có dấu cách
  if (geo) {
    const [dau, sau = ''] = geo[2].split('?');
    const q = new URLSearchParams(geo[1].toLowerCase() === 'google.navigation:' ? geo[2] : sau);
    if (geo[1].toLowerCase() === 'google.navigation:') kq.chiDuong = true;
    if (!tuGiaTri(q.get('q') || q.get('ll'), kq)) tuGiaTri(dau, kq);
    return kq.viTri || kq.truyVan ? kq : null;
  }

  const m = /https?:\/\/[^\s<>"]+/i.exec(s);
  if (!m) return null;
  let url;
  try { url = new URL(m[0]); } catch (e) { return null; }
  const host = url.hostname.toLowerCase();
  if (MIEN_RUT_GON.includes(host)) return { rutGon: url.href };

  const laGoogle = laMienGoogle(host) && (host.startsWith('maps.') || url.pathname.startsWith('/maps'));
  const laApple = host === 'maps.apple.com';
  const laVietmap = /(^|\.)vietmap\.vn$/.test(host);
  if (!laGoogle && !laApple && !laVietmap) return null;
  const q = url.searchParams;
  if (laVietmap) {
    // VietMap Live / VietMap Maps trên web: ?cp=<vĩ độ>,<kinh độ>&z=<mức phóng> (tâm khung nhìn); chỉ đọc toạ độ trong liên kết
    for (const k of ['cp', 'center', 'll', 'q']) if (tuGiaTri(q.get(k), kq) && kq.viTri) break;
    return kq.viTri || kq.truyVan ? kq : null;
  }
  const duong = giaiMa(url.pathname);

  // điểm của địa điểm (!3d<lat>!4d<lng>) chính xác hơn tâm khung nhìn (@lat,lng)
  const dl = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(url.href);
  if (dl && toaDoHopLe(+dl[1], +dl[2])) kq.viTri = [+dl[2], +dl[1]];

  if (/\/maps\/dir\//.test(duong) || q.has('daddr') || q.has('destination') || q.get('dirflg')) kq.chiDuong = true;
  if (!kq.viTri) {
    for (const k of ['destination', 'daddr', 'query', 'q', 'll', 'sll', 'center']) if (tuGiaTri(q.get(k), kq) && kq.viTri) break;
  }
  // /maps/place/<tên>/@lat,lng… và /maps/dir/<đi>/<đến>/@…
  const phan = duong.split('/').filter(Boolean);
  const iPlace = phan.indexOf('place');
  if (iPlace >= 0 && phan[iPlace + 1] && !phan[iPlace + 1].startsWith('@')) {
    const ten = phan[iPlace + 1].trim();
    const pt = docCapToaDo(ten);
    if (pt) { if (!kq.viTri) kq.viTri = pt; } else kq.ten = kq.ten || ten;
  }
  const iDir = phan.indexOf('dir');
  if (iDir >= 0) {
    const cacDiem = phan.slice(iDir + 1).filter(x => !x.startsWith('@') && !x.startsWith('data='));
    const den = cacDiem[cacDiem.length - 1];
    if (den && !kq.viTri) { const pt = docCapToaDo(den); if (pt) kq.viTri = pt; else kq.truyVan = kq.truyVan || den; }
  }
  const iSearch = phan.indexOf('search');
  if (iSearch >= 0 && phan[iSearch + 1] && !phan[iSearch + 1].startsWith('@') && !kq.viTri) tuGiaTri(phan[iSearch + 1], kq);
  if (!kq.viTri) {
    const at = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(duong);
    if (at && toaDoHopLe(+at[1], +at[2]) && (kq.ten || !kq.truyVan)) kq.viTri = [+at[2], +at[1]];
  }
  if (kq.viTri && kq.truyVan && !kq.ten) { kq.ten = kq.truyVan; delete kq.truyVan; }
  return kq.viTri || kq.truyVan ? kq : null;
}

/** Trong trang có liên kết consent.google.com?continue=… (châu Âu) thì lấy liên kết bên trong. */
export function boQuaTrangDongY(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'consent.google.com' && u.searchParams.get('continue')) return u.searchParams.get('continue');
  } catch (e) { /* không phải URL */ }
  return url;
}
