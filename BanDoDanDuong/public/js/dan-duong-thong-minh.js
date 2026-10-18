/*
 * Dẫn đường thông minh theo báo cáo giao thông của cộng đồng (kẹt xe, tai nạn, ngập, công trình, vật cản, cấm đường):
 *  - xếp hạng các tuyến theo thời gian dự kiến đã cộng chậm trễ ước tính do báo cáo nằm trên tuyến;
 *  - khi đang dẫn đường mà có báo cáo mới trên đoạn phía trước: so với tuyến tính lại từ vị trí hiện tại để gợi ý đổi tuyến.
 */
import { chieuLenDoan, timChiSo, diemTaiS, bamTuyen } from './hinh-hoc.js';

/** Số phút chậm trễ ước tính cho mỗi loại báo cáo nằm trên tuyến (cấm đường: coi như không đi được). */
export const PHAT_BAO_CAO = { ketxe: 6, tainan: 8, ngap: 10, congtrinh: 4, vatcan: 2, camduong: 60 };

/** Phút chậm trễ của một báo cáo: càng nhiều người xác nhận "vẫn còn" càng nặng (tối đa gấp đôi). */
export function phutCham(b) {
  return PHAT_BAO_CAO[b.loai] * (1 + Math.min(b.conTon || 0, 4) * 0.25);
}

/**
 * Báo cáo nằm trên tuyến (cách đường ≤ 40 m) từ quãng đường sTu tới sTu + xa, kèm vị trí dọc tuyến s (m).
 * @returns [{ baoCao, s, phut }] theo thứ tự trên tuyến
 */
export function baoCaoTrenTuyen(tuyen, baoCao, { sTu = 0, xa = Infinity, bayGio = Date.now() } = {}) {
  const c = tuyen.toaDo, cum = tuyen.tichLuy;
  const i0 = timChiSo(cum, sTu);
  const i1 = Math.min(c.length - 1, xa === Infinity ? c.length - 1 : timChiSo(cum, sTu + xa) + 1);
  let tay = 180, nam = 90, dong = -180, bac = -90;
  for (let i = i0; i <= i1; i++) { tay = Math.min(tay, c[i][0]); dong = Math.max(dong, c[i][0]); nam = Math.min(nam, c[i][1]); bac = Math.max(bac, c[i][1]); }
  const kq = [];
  for (const b of baoCao) {
    if (!(b.loai in PHAT_BAO_CAO) || (b.hetHan && b.hetHan < bayGio)) continue;
    const p = [b.lng, b.lat];
    if (p[0] < tay - 0.0006 || p[0] > dong + 0.0006 || p[1] < nam - 0.0006 || p[1] > bac + 0.0006) continue;
    let tot = null;
    for (let i = i0; i < i1; i++) {
      const r = chieuLenDoan(p, c[i], c[i + 1]);
      if (r.kc < 40 && (!tot || r.kc < tot.kc)) tot = { kc: r.kc, s: cum[i] + r.t * (cum[i + 1] - cum[i]) };
    }
    if (tot && tot.s >= sTu - 5) kq.push({ baoCao: b, s: tot.s, phut: phutCham(b) });
  }
  return kq.sort((a, b) => a.s - b.s);
}

/**
 * Gắn chậm trễ do báo cáo vào từng tuyến (phatBaoCao: giây, baoCaoTren) và xếp tuyến nhanh nhất lên đầu.
 * Tuyến được chọn thay cho tuyến đầu của máy chủ tìm đường vì tránh được báo cáo thì có tranhBaoCao = true.
 */
export function xepHangTuyen(dsTuyen, baoCao) {
  if (!dsTuyen.length) return dsTuyen;
  for (const t of dsTuyen) {
    t.baoCaoTren = baoCaoTrenTuyen(t, baoCao);
    t.phatBaoCao = Math.round(t.baoCaoTren.reduce((a, x) => a + x.phut, 0) * 60);
    t.tranhBaoCao = false;
  }
  const dau = dsTuyen[0];
  const kq = dsTuyen.slice().sort((a, b) => (a.thoiGian + a.phatBaoCao) - (b.thoiGian + b.phatBaoCao));
  if (kq[0] !== dau && dau.baoCaoTren.length) kq[0].tranhBaoCao = true;
  return kq;
}

/** Tuyến b gần như trùng tuyến a (ít nhất 90% điểm lấy mẫu của b nằm trên a). */
export function trungTuyen(a, b, buoc = 100) {
  const tong = b.tichLuy[b.tichLuy.length - 1];
  let tren = 0, so = 0;
  for (let s = 0; s <= tong; s += buoc) {
    so++;
    const r = bamTuyen(a.toaDo, a.tichLuy, diemTaiS(b.toaDo, b.tichLuy, s).diem);
    if (r && r.kc < 30) tren++;
  }
  return so > 0 && tren / so >= 0.9;
}

/**
 * Gợi ý đổi tuyến khi tuyến khác (tính lại từ vị trí hiện tại) nhanh hơn ít nhất `toiThieu` giây.
 * @param hienTai  { tuyen, s, thoiGianConLai } của tuyến đang dẫn
 * @param ds       các tuyến mới đã xepHangTuyen
 * @returns null hoặc { tuyen, tietKiem (giây), baoCao: báo cáo phía trước trên tuyến đang đi }
 */
export function goiYDoiTuyen(hienTai, ds, baoCao, toiThieu = 180) {
  const truoc = baoCaoTrenTuyen(hienTai.tuyen, baoCao, { sTu: hienTai.s });
  if (!truoc.length) return null;
  const conLai = hienTai.thoiGianConLai + truoc.reduce((a, x) => a + x.phut, 0) * 60;
  for (const t of ds) {
    const tg = t.thoiGian + (t.phatBaoCao || 0);
    if (conLai - tg >= toiThieu && !trungTuyen(hienTai.tuyen, t)) return { tuyen: t, tietKiem: Math.round(conLai - tg), baoCao: truoc };
  }
  return null;
}
