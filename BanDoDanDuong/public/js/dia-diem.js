/* Tìm địa điểm quanh đây theo danh mục (cây xăng, bãi đỗ xe, ATM…) bằng dữ liệu OpenStreetMap. */
import { truyVanOverpass } from './duong-xa.js';
import { khoangCach, donGian } from './hinh-hoc.js';

export const DANH_MUC = [
  { id: 'xang', ten: 'Cây xăng', icon: 'xang', mau: '#e53935', loc: ['["amenity"="fuel"]'] },
  { id: 'doxe', ten: 'Bãi đỗ xe', icon: 'doxe', mau: '#1e88e5', loc: ['["amenity"="parking"]'] },
  { id: 'atm', ten: 'ATM', icon: 'atm', mau: '#2e7d32', loc: ['["amenity"="atm"]', '["amenity"="bank"]["atm"="yes"]'] },
  { id: 'cafe', ten: 'Cà phê', icon: 'cafe', mau: '#795548', loc: ['["amenity"="cafe"]'] },
  { id: 'nhahang', ten: 'Nhà hàng', icon: 'nhahang', mau: '#fb8c00', loc: ['["amenity"~"^(restaurant|fast_food)$"]'] },
  { id: 'benhvien', ten: 'Bệnh viện', icon: 'benhvien', mau: '#d32f2f', loc: ['["amenity"~"^(hospital|clinic)$"]'] },
  { id: 'thuoc', ten: 'Nhà thuốc', icon: 'thuoc', mau: '#00897b', loc: ['["amenity"="pharmacy"]'] },
  { id: 'khachsan', ten: 'Khách sạn', icon: 'khachsan', mau: '#8e24aa', loc: ['["tourism"~"^(hotel|motel|guest_house|hostel)$"]'] },
  { id: 'suaxe', ten: 'Sửa xe', icon: 'suaxe', mau: '#546e7a', loc: ['["shop"~"^(car_repair|motorcycle_repair|tyres)$"]'] },
  { id: 'ruaxe', ten: 'Rửa xe', icon: 'ruaxe', mau: '#039be5', loc: ['["amenity"="car_wash"]'] },
  { id: 'sacdien', ten: 'Trạm sạc', icon: 'sacdien', mau: '#43a047', loc: ['["amenity"="charging_station"]'] },
  { id: 'wc', ten: 'Nhà vệ sinh', icon: 'wc', mau: '#5c6bc0', loc: ['["amenity"="toilets"]'] }
];

export function layDanhMuc(id) { return DANH_MUC.find(d => d.id === id); }

function chuyenKetQua(e, dm, goc) {
  const t = e.tags || {};
  const viTri = e.type === 'node' ? [e.lon, e.lat] : [e.center.lon, e.center.lat];
  const soNha = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
  const diaChi = [soNha, t['addr:subdistrict'] || t['addr:ward'], t['addr:district'], t['addr:city'] || t['addr:province']]
    .filter(Boolean).join(', ');
  return {
    ten: t.name || t.brand || t.operator || dm.ten, diaChi: diaChi || (t.brand && t.name ? t.brand : ''),
    viTri, loai: dm.id, danhMuc: dm.id, gioMoCua: t.opening_hours || '', dienThoai: t.phone || t['contact:phone'] || '',
    kc: goc ? khoangCach(goc, viTri) : null
  };
}

/** Địa điểm thuộc danh mục trong bán kính quanh một điểm, gần nhất trước. */
export async function timQuanh(dm, tam, banKinh = 3000, tinHieu) {
  const quanh = `(around:${banKinh},${tam[1].toFixed(6)},${tam[0].toFixed(6)})`;
  const q = `[out:json][timeout:20];(${dm.loc.map(f => `nwr${f}${quanh};`).join('')});out center 80;`;
  const d = await truyVanOverpass(q, tinHieu);
  return d.elements.filter(e => e.lat != null || e.center)
    .map(e => chuyenKetQua(e, dm, tam))
    .sort((a, b) => a.kc - b.kc).slice(0, 40);
}

/** Địa điểm dọc theo một đoạn tuyến (vd. cây xăng trên đường đi), xếp theo thứ tự gặp trên tuyến. */
export async function timDocTuyen(dm, doanTuyen, viTri, tinHieu) {
  const gon = donGian(doanTuyen, 60).slice(0, 120);
  const duong = gon.map(p => p[1].toFixed(5) + ',' + p[0].toFixed(5)).join(',');
  const q = `[out:json][timeout:25];(${dm.loc.map(f => `nwr${f}(around:250,${duong});`).join('')});out center 60;`;
  const d = await truyVanOverpass(q, tinHieu);
  const kq = d.elements.filter(e => e.lat != null || e.center).map(e => chuyenKetQua(e, dm, viTri));
  // thứ tự dọc tuyến: theo chỉ số điểm tuyến gần nhất
  const viTriTrenTuyen = p => {
    let tot = 0, min = Infinity;
    gon.forEach((g, i) => { const k = khoangCach(g, p); if (k < min) { min = k; tot = i; } });
    return tot;
  };
  return kq.map(x => ({ ...x, thuTu: viTriTrenTuyen(x.viTri) })).sort((a, b) => a.thuTu - b.thuTu || a.kc - b.kc).slice(0, 30);
}
