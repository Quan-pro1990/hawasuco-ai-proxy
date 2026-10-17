/*
 * Tìm đường và chuẩn hoá kết quả về một dạng chung, kèm câu chỉ dẫn tiếng Việt.
 * Nguồn: OSRM (mặc định, miễn phí) hoặc VietMap Route API (khi có khoá trong cài đặt; lỗi thì tự quay về OSRM).
 *
 * Tuyến đường (dạng chung):
 * {
 *   toaDo: [[lng, lat], …], tichLuy: [m, …], quangDuong (m), thoiGian (giây),
 *   buoc: [{ loai, huong, loiRa, ten, ref, dichDen, quangDuong, thoiGian, chiSo, batDau, viTri, lanes, diemDung, chang, chiDan }],
 *   duongChinh: 'Giải Phóng, Nguyễn Trãi', coThuPhi, coCaoToc, coPha, nguon
 * }
 * Bước i bắt đầu bằng thao tác (rẽ, vào vòng xuyến…) tại toaDo[chiSo] và kéo dài tới thao tác của bước i + 1.
 */
import { CAU_HINH } from './cau-hinh.js';
import { caiDat } from './kho.js';
import { tichLuy, giaiMaPolyline } from './hinh-hoc.js';
import { huongLaBan } from './dinh-dang.js';

export const PHUONG_TIEN = {
  oto: { ten: 'Ô tô', icon: 'oto' },
  xemay: { ten: 'Xe máy', icon: 'xemay' },
  dibo: { ten: 'Đi bộ', icon: 'dibo' },
  xedap: { ten: 'Xe đạp', icon: 'xedap' }
};

/**
 * @param {object} p
 * @param {Array<[number, number]>} p.diem   điểm đi, các điểm dừng, điểm đến
 * @param {string} p.phuongTien             oto | xemay | dibo | xedap
 * @param {number} [p.huongDau]             hướng đang đi tại điểm đầu (độ) — dùng khi tính lại đường
 * @param {boolean} [p.phuongAn=true]       lấy thêm tuyến thay thế
 * @param {AbortSignal} [p.tinHieu]
 */
export async function timDuong(p) {
  if (caiDat.khoaVietmap) {
    try { return await timDuongVietmap(p); } catch (e) {
      if (e.name === 'AbortError') throw e;
      console.warn('VietMap route lỗi, dùng OSRM:', e);
    }
  }
  return timDuongOsrm(p);
}

// ------------------------------------------------------------------ OSRM
async function timDuongOsrm({ diem, phuongTien = 'oto', tranhCaoToc, tranhThuPhi, huongDau, phuongAn = true, tinHieu }) {
  const dv = CAU_HINH.dichVu;
  const laXe = phuongTien === 'oto' || phuongTien === 'xemay';
  const goc = phuongTien === 'dibo' ? dv.osrmDiBo : phuongTien === 'xedap' ? dv.osrmXeDap : dv.osrmOto;
  const toaDo = diem.map(d => d[0].toFixed(6) + ',' + d[1].toFixed(6)).join(';');
  const q = new URLSearchParams({
    overview: 'false', steps: 'true', geometries: 'geojson',
    alternatives: phuongAn && diem.length === 2 ? 'true' : 'false'
  });
  // Xe máy không được đi cao tốc. Máy chủ OSRM chỉ cho loại trừ một nhóm mỗi lần.
  let loaiTru = '';
  if (laXe && (phuongTien === 'xemay' || tranhCaoToc)) loaiTru = 'motorway';
  else if (laXe && tranhThuPhi) loaiTru = 'toll';
  if (laXe && huongDau != null && isFinite(huongDau)) q.set('bearings', Math.round(huongDau) + ',60' + ';'.repeat(diem.length - 1));

  const goi = async ({ loaiTru: ex, huong }) => {
    const q2 = new URLSearchParams(q);
    if (ex) q2.set('exclude', ex);
    if (!huong) q2.delete('bearings');
    const r = await fetch(`${goc}/${toaDo}?${q2}`, { signal: tinHieu });
    let d = null;
    try { d = await r.json(); } catch (e) { /* không phải JSON */ }
    return { r, d };
  };

  // Thử đủ tuỳ chọn trước; máy chủ không nhận "exclude"/"bearings" thì bỏ dần.
  const cacLanThu = [{ loaiTru, huong: true }];
  if (q.has('bearings')) cacLanThu.push({ loaiTru, huong: false });
  if (loaiTru) cacLanThu.push({ loaiTru: '', huong: false });
  let r, d;
  for (const lan of cacLanThu) {
    ({ r, d } = await goi(lan));
    if (d && d.code === 'Ok' && d.routes && d.routes.length) break;
  }
  if (!d || d.code !== 'Ok' || !d.routes || !d.routes.length) {
    if (d && d.code === 'NoRoute') throw new Error('Không tìm thấy đường đi giữa các điểm đã chọn');
    throw new Error('Máy chủ chỉ đường không phản hồi (' + (d && (d.message || d.code) || r.status) + ')');
  }
  return d.routes.map(rt => chuanHoaOsrm(rt));
}

export function chuanHoaOsrm(rt) {
  const toaDo = [], buoc = [];
  let coThuPhi = false, coCaoToc = false, coPha = false;
  const soChang = rt.legs.length;
  rt.legs.forEach((leg, li) => {
    leg.steps.forEach((st) => {
      const g = st.geometry.coordinates;
      const truoc = toaDo.length;
      let boDau = false;
      g.forEach((c, k) => {
        const cuoi = toaDo[toaDo.length - 1];
        if (cuoi && cuoi[0] === c[0] && cuoi[1] === c[1]) { if (k === 0) boDau = true; return; }   // bỏ điểm trùng liền kề
        toaDo.push(c);
      });
      const chiSo = boDau ? truoc - 1 : truoc;
      for (const gn of st.intersections || []) {
        const cl = gn.classes || [];
        if (cl.includes('toll')) coThuPhi = true;
        if (cl.includes('motorway')) coCaoToc = true;
        if (cl.includes('ferry')) coPha = true;
      }
      if (st.mode === 'ferry') coPha = true;
      const m = st.maneuver;
      // điểm xuất phát của các chặng sau trùng điểm dừng: bỏ đi
      if (m.type === 'depart' && li > 0) return;
      buoc.push({
        loai: m.type, huong: m.modifier || '', loiRa: m.exit || 0,
        ten: st.name || '', ref: st.ref || '', dichDen: st.destinations || '', vongXuyen: st.rotary_name || '',
        quangDuong: st.distance, thoiGian: st.duration, chiSo, viTri: m.location,
        huongSau: m.bearing_after, huongTruoc: m.bearing_before,
        lanes: (st.intersections && st.intersections[0] && st.intersections[0].lanes) || null,
        diemDung: m.type === 'arrive' && li < soChang - 1, chang: li
      });
    });
  });
  const duongChinh = rt.legs.map(l => l.summary).filter(Boolean).join(', ');
  return hoanTat({ toaDo, buoc, quangDuong: rt.distance, thoiGian: rt.duration, duongChinh, coThuPhi, coCaoToc, coPha, nguon: 'osrm' });
}

/** Tính quãng đường cộng dồn, vị trí bắt đầu của từng bước và câu chỉ dẫn. */
export function hoanTat(t) {
  t.tichLuy = tichLuy(t.toaDo);
  for (const b of t.buoc) {
    b.chiSo = Math.min(Math.max(0, b.chiSo), t.toaDo.length - 1);
    b.batDau = t.tichLuy[b.chiSo];
    if (!b.viTri) b.viTri = t.toaDo[b.chiSo];
  }
  t.buoc.forEach((b, i) => { b.chiDan = taoChiDan(b, i === t.buoc.length - 1); });
  if (!t.duongChinh) {
    t.duongChinh = t.buoc.filter(b => b.ten).sort((a, b) => b.quangDuong - a.quangDuong)
      .slice(0, 2).map(b => b.ten).join(', ');
  }
  return t;
}

// ------------------------------------------------------------------ câu chỉ dẫn tiếng Việt
const RE = {
  uturn: 'Quay đầu', 'sharp right': 'Rẽ gắt sang phải', right: 'Rẽ phải', 'slight right': 'Chếch sang phải',
  straight: 'Đi thẳng', 'slight left': 'Chếch sang trái', left: 'Rẽ trái', 'sharp left': 'Rẽ gắt sang trái'
};
const THU_TU = ['', 'thứ nhất', 'thứ hai', 'thứ ba', 'thứ tư', 'thứ năm', 'thứ sáu', 'thứ bảy', 'thứ tám'];

export function tenDuong(b) {
  if (b.ten && b.ref && !b.ten.includes(b.ref)) return `${b.ten} (${b.ref})`;
  return b.ten || b.ref || '';
}

function benTraiPhai(huong) {
  return /left/.test(huong) ? 'trái' : /right/.test(huong) ? 'phải' : '';
}

export function taoChiDan(b, laCuoi = false) {
  const ten = tenDuong(b);
  const vao = ten ? ` vào ${ten}` : '';
  const ben = benTraiPhai(b.huong);
  const re = RE[b.huong];
  switch (b.loai) {
    case 'depart':
      return (b.huongSau != null ? `Đi về hướng ${huongLaBan(b.huongSau)}` : 'Xuất phát') + (ten ? ` theo ${ten}` : '');
    case 'arrive':
      if (b.diemDung) return 'Đến điểm dừng';
      return laCuoi && ben ? `Đến nơi, điểm đến ở bên ${ben}` : 'Đến nơi';
    case 'roundabout': case 'rotary': {
      const vx = b.vongXuyen ? `vòng xuyến ${b.vongXuyen}` : 'vòng xuyến';
      return b.loiRa ? `Vào ${vx}, đi theo lối ra ${THU_TU[b.loiRa] || 'số ' + b.loiRa}${vao}` : `Đi qua ${vx}${vao}`;
    }
    case 'exit roundabout': case 'exit rotary':
      return `Ra khỏi vòng xuyến${vao}`;
    case 'roundabout turn':
      return `Tại vòng xuyến, ${re ? re.toLocaleLowerCase('vi') : 'đi tiếp'}${vao}`;
    case 'merge':
      return `Nhập làn${ben ? ' bên ' + ben : ''}${vao}`;
    case 'on ramp':
      return `Đi vào đường dẫn${ben ? ' bên ' + ben : ''}${ten ? ' lên ' + ten : ''}`;
    case 'off ramp':
      return `Đi vào lối ra${ben ? ' bên ' + ben : ''}${b.dichDen ? ' hướng ' + b.dichDen : vao}`;
    case 'fork':
      return `Đi theo nhánh ${ben || 'giữa'}${vao}`;
    case 'end of road':
      return `Đến cuối đường, ${re ? re.toLocaleLowerCase('vi') : 'rẽ'}${vao}`;
    case 'new name':
      return ten ? `Tiếp tục đi vào ${ten}` : 'Tiếp tục đi thẳng';
    case 'continue':
      if (!b.huong || b.huong === 'straight') return `Tiếp tục đi thẳng${ten ? ' trên ' + ten : ''}`;
      return `${re || 'Đi tiếp'}${vao}`;
    default: // turn, use lane, notification…
      if (b.huong === 'straight') return `Đi thẳng${vao}`;
      return `${re || 'Đi tiếp'}${vao}`;
  }
}

/** Bước có cần đọc nhắc trước hay không (bỏ qua "tiếp tục đi thẳng" khi chỉ đổi tên đường). */
export function canNhac(b) {
  if (b.loai === 'new name' || b.loai === 'notification' || b.loai === 'use lane') return false;
  if (b.loai === 'continue' && (!b.huong || b.huong === 'straight')) return false;
  return true;
}

// ------------------------------------------------------------------ VietMap (định dạng giống GraphHopper)
const XE_VIETMAP = { oto: 'car', xemay: 'motorcycle', dibo: 'foot', xedap: 'bike' };

async function timDuongVietmap({ diem, phuongTien = 'oto', tinHieu }) {
  const q = new URLSearchParams({ 'api-version': '1.1', apikey: caiDat.khoaVietmap, vehicle: XE_VIETMAP[phuongTien] || 'car', points_encoded: 'true' });
  diem.forEach(d => q.append('point', d[1] + ',' + d[0]));
  const r = await fetch(CAU_HINH.dichVu.vietmap.chiDuong + '?' + q, { signal: tinHieu });
  if (!r.ok) throw new Error('VietMap ' + r.status);
  const d = await r.json();
  if (!d.paths || !d.paths.length) throw new Error(d.messages || d.message || 'VietMap không trả về tuyến đường');
  return d.paths.map(chuanHoaGraphhopper);
}

export function chuanHoaGraphhopper(p) {
  const toaDo = p.points_encoded === false ? p.points.coordinates : giaiMaPolyline(p.points, 5);
  let chang = 0;
  const buoc = (p.instructions || []).map((ins, i) => {
    const s = ins.sign;
    let loai = 'turn', huong = '';
    if (i === 0) loai = 'depart';
    else if (s === 4) loai = 'arrive';
    else if (s === 5) loai = 'arrive';
    else if (s === 6) loai = 'roundabout';
    else if (s === -6) loai = 'exit roundabout';
    else if (s === 0) loai = 'new name';
    else if (s === -7 || s === 7) { loai = 'fork'; huong = s < 0 ? 'slight left' : 'slight right'; }
    else if (s === -98 || s === -8 || s === 8) huong = 'uturn';
    else huong = { '-3': 'sharp left', '-2': 'left', '-1': 'slight left', 1: 'slight right', 2: 'right', 3: 'sharp right' }[s] || 'straight';
    const b = {
      loai, huong, loiRa: ins.exit_number || 0, ten: ins.street_name || '', ref: '', dichDen: '',
      quangDuong: ins.distance || 0, thoiGian: (ins.time || 0) / 1000, chiSo: (ins.interval || [0])[0],
      lanes: null, diemDung: s === 5, chang
    };
    if (s === 5) chang++;
    return b;
  });
  if (!buoc.length || buoc[buoc.length - 1].loai !== 'arrive') {
    buoc.push({ loai: 'arrive', huong: '', ten: '', ref: '', quangDuong: 0, thoiGian: 0, chiSo: toaDo.length - 1, chang });
  }
  return hoanTat({
    toaDo, buoc, quangDuong: p.distance, thoiGian: p.time / 1000, duongChinh: '',
    coThuPhi: false, coCaoToc: false, coPha: false, nguon: 'vietmap'
  });
}
