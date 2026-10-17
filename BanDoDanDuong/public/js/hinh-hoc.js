/* Hình học trên mặt cầu cho bản đồ. Điểm luôn ở dạng [kinh độ, vĩ độ] như GeoJSON. Không dùng DOM. */

const R = 6371008.8;
const rad = d => d * Math.PI / 180;
const deg = r => r * 180 / Math.PI;

/** Khoảng cách (mét) giữa 2 điểm theo công thức haversine. */
export function khoangCach(a, b) {
  const dLat = rad(b[1] - a[1]), dLng = rad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Phương vị (độ, 0 = Bắc, 90 = Đông) đi từ a tới b. */
export function phuongVi(a, b) {
  const p1 = rad(a[1]), p2 = rad(b[1]), dl = rad(b[0] - a[0]);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Độ lệch góc từ a sang b, trong khoảng [-180, 180). */
export function lechGoc(a, b) {
  return ((((b - a) % 360) + 540) % 360) - 180;
}

/** Điểm cách p một đoạn `kc` mét theo phương vị `huong`. */
export function diemDich(p, huong, kc) {
  const d = kc / R, t = rad(huong), p1 = rad(p[1]), l1 = rad(p[0]);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(t));
  const l2 = l1 + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [((deg(l2) + 540) % 360) - 180, deg(p2)];
}

/**
 * Chiếu điểm p lên đoạn ab (xấp xỉ mặt phẳng cục bộ, đủ chính xác với đoạn dưới vài km).
 * Trả về { t: vị trí trên đoạn 0..1, kc: khoảng cách vuông góc (m), diem: điểm chiếu }.
 */
export function chieuLenDoan(p, a, b) {
  const kx = Math.cos(rad(p[1])) * 111320, ky = 110574;
  const ax = (a[0] - p[0]) * kx, ay = (a[1] - p[1]) * ky;
  const dx = (b[0] - a[0]) * kx, dy = (b[1] - a[1]) * ky;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? -(ax * dx + ay * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const x = ax + t * dx, y = ay + t * dy;
  return { t, kc: Math.hypot(x, y), diem: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])] };
}

/** Mảng quãng đường cộng dồn (m) từ điểm đầu tới từng điểm của đường. */
export function tichLuy(toaDo) {
  const c = new Array(toaDo.length);
  c[0] = 0;
  for (let i = 1; i < toaDo.length; i++) c[i] = c[i - 1] + khoangCach(toaDo[i - 1], toaDo[i]);
  return c;
}

/** Chỉ số i lớn nhất mà cum[i] <= s (tìm nhị phân). */
export function timChiSo(cum, s) {
  let lo = 0, hi = cum.length - 1;
  if (s <= 0) return 0;
  if (s >= cum[hi]) return Math.max(0, hi - 1);
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= s) lo = mid; else hi = mid;
  }
  return lo;
}

/** Bắt điểm p lên đường (chỉ xét các đoạn từ chỉ số `tu` tới `den`). */
export function bamTuyen(toaDo, cum, p, tu = 0, den = toaDo.length - 1) {
  let tot = null;
  const het = Math.min(den, toaDo.length - 1);
  for (let i = Math.max(0, tu); i < het; i++) {
    const r = chieuLenDoan(p, toaDo[i], toaDo[i + 1]);
    if (!tot || r.kc < tot.kc) tot = { chiSo: i, t: r.t, diem: r.diem, kc: r.kc, s: cum[i] + r.t * (cum[i + 1] - cum[i]) };
  }
  return tot;
}

/** Điểm nằm cách đầu đường `s` mét, kèm hướng của đoạn chứa nó. */
export function diemTaiS(toaDo, cum, s) {
  const i = timChiSo(cum, s);
  const a = toaDo[i], b = toaDo[Math.min(i + 1, toaDo.length - 1)];
  const dai = cum[Math.min(i + 1, cum.length - 1)] - cum[i];
  const t = dai > 0 ? Math.min(1, Math.max(0, (s - cum[i]) / dai)) : 0;
  return { diem: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])], chiSo: i, huong: phuongVi(a, b) };
}

/** Cắt phần đường từ s0 tới s1 (mét). */
export function catTuyen(toaDo, cum, s0, s1) {
  if (toaDo.length < 2) return toaDo.slice();
  s0 = Math.max(0, s0); s1 = Math.min(cum[cum.length - 1], s1);
  if (s1 <= s0) return [];
  const dau = diemTaiS(toaDo, cum, s0), cuoi = diemTaiS(toaDo, cum, s1);
  const kq = [dau.diem];
  for (let i = dau.chiSo + 1; i <= cuoi.chiSo; i++) kq.push(toaDo[i]);
  kq.push(cuoi.diem);
  return kq;
}

/** Giải mã chuỗi "encoded polyline" (Google / GraphHopper / VietMap). */
export function giaiMaPolyline(chuoi, chinhXac = 5) {
  const he = Math.pow(10, chinhXac);
  const kq = [];
  let i = 0, lat = 0, lng = 0;
  while (i < chuoi.length) {
    for (let k = 0; k < 2; k++) {
      let b, dich = 0, gt = 0;
      do { b = chuoi.charCodeAt(i++) - 63; gt |= (b & 0x1f) << dich; dich += 5; } while (b >= 0x20);
      const d = gt & 1 ? ~(gt >> 1) : gt >> 1;
      if (k === 0) lat += d; else lng += d;
    }
    kq.push([lng / he, lat / he]);
  }
  return kq;
}

/** Đơn giản hoá đường (Douglas–Peucker), dung sai tính bằng mét. */
export function donGian(toaDo, dungSai = 5) {
  if (toaDo.length < 3) return toaDo.slice();
  const giu = new Uint8Array(toaDo.length);
  giu[0] = giu[toaDo.length - 1] = 1;
  const ngan = [[0, toaDo.length - 1]];
  while (ngan.length) {
    const [a, b] = ngan.pop();
    let max = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = chieuLenDoan(toaDo[i], toaDo[a], toaDo[b]).kc;
      if (d > max) { max = d; idx = i; }
    }
    if (max > dungSai) { giu[idx] = 1; ngan.push([a, idx], [idx, b]); }
  }
  return toaDo.filter((_, i) => giu[i]);
}

/** Khung bao [[minLng, minLat], [maxLng, maxLat]] của danh sách điểm. */
export function khungBao(toaDo) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const p of toaDo) {
    if (p[0] < a) a = p[0]; if (p[1] < b) b = p[1];
    if (p[0] > c) c = p[0]; if (p[1] > d) d = p[1];
  }
  return [[a, b], [c, d]];
}

export function trongKhung(p, khung) {
  return p[0] >= khung[0][0] && p[0] <= khung[1][0] && p[1] >= khung[0][1] && p[1] <= khung[1][1];
}
