/*
 * Báo cáo giao thông của cộng đồng (kẹt xe, tai nạn, CSGT, camera, ngập…).
 * Có máy chủ (server.js) thì báo cáo dùng chung cho mọi người; không có thì lưu trên máy này.
 */
import { caiDat, doc, ghi, maThietBi } from './kho.js';
import { LOAI_BAO_CAO, soPhieuGo } from './loai-bao-cao.js';
import { cauHinhGoc } from './cau-noi.js';

export { LOAI_BAO_CAO };

let coMayChu = null;
let duLieu = [];

function goc() {
  return (caiDat.mayChuBaoCao || cauHinhGoc.mayChuBaoCao || '').trim().replace(/\/+$/, '') || 'api';
}

export function dungMayChu() { return coMayChu === true; }

/** Địa chỉ gốc của API máy chủ (vd. "api" hoặc "https://may-chu/api"). */
export function diaChiApi() { return goc(); }

export async function kiemTraMayChu() {
  try {
    const r = await fetch(goc() + '/trang-thai', { cache: 'no-store' });
    coMayChu = r.ok && !!(await r.json()).ok;
  } catch (e) {
    coMayChu = false;
  }
  return coMayChu;
}

export function baoCaoHienTai() { return duLieu; }

/** Tải báo cáo trong khung [tây, nam, đông, bắc]. */
export async function taiBaoCao(khung) {
  if (coMayChu) {
    try {
      const r = await fetch(`${goc()}/bao-cao?bbox=${khung.map(x => x.toFixed(5)).join(',')}&thietBi=${encodeURIComponent(maThietBi)}`, { cache: 'no-store' });
      if (r.ok) { duLieu = (await r.json()).baoCao || []; return duLieu; }
    } catch (e) { /* mất mạng: dùng dữ liệu cũ */ }
    return duLieu;
  }
  const bayGio = Date.now();
  duLieu = cucBo().filter(b => (!b.hetHan || b.hetHan > bayGio) &&
    b.lng >= khung[0] && b.lng <= khung[2] && b.lat >= khung[1] && b.lat <= khung[3]);
  return duLieu;
}

export async function guiBaoCao({ loai, phu, viTri, huong, ghiChu }) {
  if (!LOAI_BAO_CAO[loai]) throw new Error('Loại báo cáo không hợp lệ');
  const than = { loai, lng: viTri[0], lat: viTri[1], huong: huong == null ? null : Math.round(huong), ghiChu: ghiChu || '', thietBi: maThietBi };
  if (phu && LOAI_BAO_CAO[loai].phu && LOAI_BAO_CAO[loai].phu[phu]) than.phu = phu;
  let bc;
  if (coMayChu) {
    const r = await fetch(goc() + '/bao-cao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(than) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.loi || 'Máy chủ không nhận báo cáo');
    bc = d.baoCao;
  } else {
    const bayGio = Date.now(), han = LOAI_BAO_CAO[loai].hetHan;
    bc = { id: 'cb' + bayGio.toString(36) + Math.random().toString(36).slice(2, 6), loai, phu: than.phu, lng: than.lng, lat: than.lat, huong: than.huong,
      ghiChu: than.ghiChu, taoLuc: bayGio, hetHan: han ? bayGio + han * 60000 : 0, conTon: 0, khongCon: 0, cuaToi: true };
    ghi('baocao', [...cucBo(), bc]);
  }
  duLieu.push(bc);
  const cuaToi = doc('baocaocuatoi', []);
  cuaToi.unshift({ id: bc.id, loai, lng: bc.lng, lat: bc.lat, taoLuc: bc.taoLuc, mayChu: !!coMayChu });
  ghi('baocaocuatoi', cuaToi.slice(0, 100));
  return bc;
}

/** Người khác xác nhận "vẫn còn" / "không còn". Trả về báo cáo sau khi cập nhật, hoặc null nếu đã bị gỡ. */
export async function xacNhan(id, conTon) {
  if (coMayChu) {
    const r = await fetch(`${goc()}/bao-cao/${encodeURIComponent(id)}/xac-nhan`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conTon, thietBi: maThietBi })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.loi || 'Không gửi được xác nhận');
    capNhatBoNho(id, d.baoCao);
    return d.baoCao;
  }
  const ds = cucBo();
  const b = ds.find(x => x.id === id);
  if (!b) return null;
  if (conTon) {
    b.conTon++;
    const han = LOAI_BAO_CAO[b.loai].hetHan;
    if (han) b.hetHan = Math.max(b.hetHan, Date.now() + han * 30000);
  } else b.khongCon++;
  const go = !conTon && b.khongCon >= soPhieuGo(b.loai) && b.khongCon > b.conTon;
  ghi('baocao', go ? ds.filter(x => x.id !== id) : ds);
  capNhatBoNho(id, go ? null : b);
  return go ? null : b;
}

export async function xoaBaoCao(id) {
  const bc = doc('baocaocuatoi', []).find(x => x.id === id);
  if (bc && bc.mayChu) {
    const r = await fetch(`${goc()}/bao-cao/${encodeURIComponent(id)}?thietBi=${encodeURIComponent(maThietBi)}`, { method: 'DELETE' });
    if (!r.ok && r.status !== 404) throw new Error('Không xoá được báo cáo');
  } else {
    ghi('baocao', cucBo().filter(x => x.id !== id));
  }
  ghi('baocaocuatoi', doc('baocaocuatoi', []).filter(x => x.id !== id));
  capNhatBoNho(id, null);
}

export function baoCaoCuaToi() { return doc('baocaocuatoi', []); }

function cucBo() {
  const bayGio = Date.now();
  return doc('baocao', []).filter(b => !b.hetHan || b.hetHan > bayGio);
}

function capNhatBoNho(id, moi) {
  const i = duLieu.findIndex(x => x.id === id);
  if (i < 0) return;
  if (moi) duLieu[i] = moi; else duLieu.splice(i, 1);
}
