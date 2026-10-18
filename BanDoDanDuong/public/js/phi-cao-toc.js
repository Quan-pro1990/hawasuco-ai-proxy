/*
 * Phí trạm thu phí đường bộ / cao tốc theo loại xe (5 loại như các trạm BOT, VETC, ePass).
 * Nguồn mức phí, theo thứ tự ưu tiên:
 *  1. Bảng phí do đơn vị vận hành HawaMap cập nhật: máy chủ /api/phi-cao-toc, hoặc tệp du-lieu/phi-cao-toc.json đi kèm trang.
 *     Tự tải lại mỗi tuần.
 *  2. Thẻ charge của trạm trên OpenStreetMap (nếu người đóng góp đã ghi), coi là phí xe loại 1.
 * Không có nguồn nào thì chỉ báo "có trạm thu phí", không đoán mức phí.
 */
import { doc, ghi } from './kho.js';
import { khoangCach, chieuLenDoan } from './hinh-hoc.js';

export const CHU_KY_BANG_PHI = 7 * 86400000;

export const LOAI_XE_THU_PHI = [
  [1, 'Loại 1: xe dưới 12 chỗ, xe tải dưới 2 tấn'],
  [2, 'Loại 2: xe 12–30 chỗ, xe tải 2 đến dưới 4 tấn'],
  [3, 'Loại 3: xe từ 31 chỗ, xe tải 4 đến dưới 10 tấn'],
  [4, 'Loại 4: xe tải 10 đến dưới 18 tấn, container 20 feet'],
  [5, 'Loại 5: xe tải từ 18 tấn, container 40 feet']
];

let bang = doc('bangphi', null);      // { luc, du: { capNhat, nguon, tram: [...] } }

/** Đọc mức phí ghi trong thẻ OSM ("35000 VND", "35.000 đ", "35,000 VND/car") ra số đồng, null nếu không đọc được. */
export function docPhiOsm(s) {
  const m = /(\d{1,3}(?:[.,\s]\d{3})+|\d{4,7})\s*(VND|vnđ|vnd|đ|dong|đồng)?/i.exec(String(s || ''));
  if (!m) return null;
  if (/[€$£]|EUR|USD/i.test(String(s))) return null;
  const n = Number(m[1].replace(/[.,\s]/g, ''));
  return n >= 1000 && n <= 5000000 ? n : null;
}

/** Bảng phí đang dùng (đặt từ ngoài khi kiểm thử). */
export function datBangPhi(du) { bang = du ? { luc: Date.now(), du } : null; }

function hopLe(du) { return du && Array.isArray(du.tram); }

/**
 * Tải lại bảng phí nếu đã quá 7 ngày (hoặc `ep`). Ưu tiên máy chủ, không được thì dùng tệp đi kèm trang.
 * @returns bảng phí đang dùng (có thể null)
 */
export async function capNhatBangPhi({ layMayChu = () => null, ep = false, bayGio = Date.now() } = {}) {
  if (!ep && bang && bayGio - bang.luc < CHU_KY_BANG_PHI) return bang.du;
  const mc = layMayChu();
  for (const url of [mc && `${mc}/phi-cao-toc`, 'du-lieu/phi-cao-toc.json'].filter(Boolean)) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) continue;
      const du = await r.json();
      if (!hopLe(du)) continue;
      bang = { luc: bayGio, du };
      ghi('bangphi', bang);
      return du;
    } catch (e) { /* thử nguồn sau */ }
  }
  return bang ? bang.du : null;
}

export function thongTinBangPhi() {
  const du = bang && bang.du;
  return { soTram: du ? du.tram.length : 0, capNhat: du ? du.capNhat || null : null, nguon: du ? du.nguon || '' : '', luc: bang ? bang.luc : null };
}

/** Trạm trong bảng khớp với điểm trạm thu phí (theo mã nút OSM hoặc vị trí trong bán kính). */
function tramTrongBang(diem) {
  const du = bang && bang.du;
  if (!du) return null;
  const maOsm = String(diem.id || '').replace(/^osm/, '');
  return du.tram.find(t => (Array.isArray(t.osm) && t.osm.map(String).includes(maOsm)) ||
    (t.viTri && khoangCach(t.viTri, diem.viTri) <= (t.banKinh || 300))) || null;
}

/** Mức phí cho loại xe tại một trạm: { phi, loaiXe, ten, nguon: 'bang' | 'osm' } hoặc null. */
export function phiCuaTram(diem, loaiXe = 1) {
  const t = tramTrongBang(diem);
  if (t && Array.isArray(t.phi) && t.phi[loaiXe - 1] > 0) return { phi: t.phi[loaiXe - 1], loaiXe, ten: t.ten || '', nguon: 'bang' };
  if (loaiXe === 1 && diem.phiOsm) return { phi: diem.phiOsm, loaiXe, ten: '', nguon: 'osm' };
  return null;
}

/** Tổng phí dự kiến của tuyến theo các trạm trong bảng nằm trên tuyến: { tong, soTram, ds: [{ ten, phi }] }. */
export function phiTuyen(tuyen, loaiXe = 1) {
  const du = bang && bang.du;
  const kq = { tong: 0, soTram: 0, ds: [] };
  if (!du || !tuyen || !tuyen.toaDo || tuyen.toaDo.length < 2) return kq;
  const c = tuyen.toaDo;
  let tay = 180, nam = 90, dong = -180, bac = -90;
  for (const p of c) { tay = Math.min(tay, p[0]); dong = Math.max(dong, p[0]); nam = Math.min(nam, p[1]); bac = Math.max(bac, p[1]); }
  for (const t of du.tram) {
    if (!t.viTri || !Array.isArray(t.phi) || !(t.phi[loaiXe - 1] > 0)) continue;
    const [x, y] = t.viTri;
    if (x < tay - 0.01 || x > dong + 0.01 || y < nam - 0.01 || y > bac + 0.01) continue;
    let gan = Infinity;
    for (let i = 0; i < c.length - 1 && gan > 60; i++) gan = Math.min(gan, chieuLenDoan(t.viTri, c[i], c[i + 1]).kc);
    if (gan > Math.min(t.banKinh || 300, 120)) continue;
    kq.tong += t.phi[loaiXe - 1];
    kq.soTram++;
    kq.ds.push({ ten: t.ten || 'Trạm thu phí', phi: t.phi[loaiXe - 1] });
  }
  return kq;
}

/** "35.000 đ" */
export function dinhDangTien(n) { return Math.round(n).toLocaleString('vi-VN') + ' đ'; }
