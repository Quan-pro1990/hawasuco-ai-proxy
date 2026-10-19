/*
 * Tìm địa điểm / địa chỉ.
 *  - Gợi ý khi đang gõ: VietMap (nếu có khoá) → Photon (OpenStreetMap)
 *  - Tìm đầy đủ khi bấm Enter: Nominatim
 *  - Địa chỉ của một toạ độ (nhấn giữ trên bản đồ): VietMap → Nominatim
 * Kết quả: { ten, diaChi, viTri: [lng, lat] | null, refId?, loai, nguon }
 */
import { CAU_HINH } from './cau-hinh.js';
import { caiDat } from './kho.js';

const KHUNG = CAU_HINH.khungVietNam;

/** "21.0285, 105.8542" hoặc "21.0285 105.8542" → toạ độ. */
export function docToaDo(s) {
  const m = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(s || '');
  if (!m) return null;
  let a = +m[1], b = +m[2];
  if (Math.abs(a) > 90 && Math.abs(b) <= 90) [a, b] = [b, a];     // người dùng gõ kinh độ trước
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  return [b, a];
}

function boTrung(ds) {
  const thay = new Set();
  return ds.filter(x => {
    const k = x.ten + '|' + (x.viTri ? x.viTri.map(v => v.toFixed(4)).join(',') : x.refId);
    if (thay.has(k)) return false;
    thay.add(k);
    return true;
  });
}

export async function goiY(chuoi, gan, tinHieu) {
  chuoi = chuoi.trim();
  if (!chuoi) return [];
  const td = docToaDo(chuoi);
  if (td) return [{ ten: 'Toạ độ ' + td[1].toFixed(5) + ', ' + td[0].toFixed(5), diaChi: 'Vị trí theo toạ độ', viTri: td, loai: 'toado', nguon: 'toado' }];
  if (caiDat.khoaVietmap) {
    try {
      const kq = await goiYVietmap(chuoi, gan, tinHieu);
      if (kq.length) return kq;
    } catch (e) { if (e.name === 'AbortError') throw e; }
  }
  return goiYPhoton(chuoi, gan, tinHieu);
}

async function goiYPhoton(chuoi, gan, tinHieu) {
  const q = new URLSearchParams({ q: chuoi, limit: '10', bbox: KHUNG.join(',') });
  if (gan) { q.set('lat', gan[1].toFixed(5)); q.set('lon', gan[0].toFixed(5)); }
  const r = await fetch(CAU_HINH.dichVu.photon + '?' + q, { signal: tinHieu });
  if (!r.ok) throw new Error('Photon ' + r.status);
  const d = await r.json();
  return boTrung((d.features || []).map(f => {
    const p = f.properties || {};
    const soNha = p.housenumber && p.street ? p.housenumber + ' ' + p.street : '';
    const ten = p.name || soNha || p.street || p.city || '';
    const phan = [soNha && soNha !== ten ? soNha : (p.name ? p.street : ''), p.district, p.locality, p.city, p.county, p.state]
      .filter(x => x && x !== ten);
    return { ten, diaChi: [...new Set(phan)].join(', '), viTri: f.geometry.coordinates, loai: p.osm_value || '', nguon: 'photon' };
  }).filter(x => x.ten));
}

async function goiYVietmap(chuoi, gan, tinHieu) {
  const q = new URLSearchParams({ apikey: caiDat.khoaVietmap, text: chuoi });
  if (gan) q.set('focus', gan[1] + ',' + gan[0]);
  const r = await fetch(CAU_HINH.dichVu.vietmap.goiY + '?' + q, { signal: tinHieu });
  if (!r.ok) throw new Error('VietMap ' + r.status);
  const d = await r.json();
  return (Array.isArray(d) ? d : []).map(x => ({
    ten: x.name || x.display, diaChi: x.address || x.display || '', viTri: null, refId: x.ref_id, loai: (x.categories || [])[0] || '', nguon: 'vietmap'
  }));
}

/** Kết quả gợi ý VietMap chưa có toạ độ: lấy chi tiết. */
export async function layToaDo(kq) {
  if (kq.viTri) return kq;
  const q = new URLSearchParams({ apikey: caiDat.khoaVietmap, refid: kq.refId });
  const r = await fetch(CAU_HINH.dichVu.vietmap.chiTiet + '?' + q);
  if (!r.ok) throw new Error('Không lấy được vị trí địa điểm');
  const d = await r.json();
  return { ...kq, viTri: [+d.lng, +d.lat], diaChi: d.display || kq.diaChi };
}

/** Tìm đầy đủ bằng Nominatim (khi bấm Enter / gợi ý không có kết quả). */
export async function timDayDu(chuoi, gan, tinHieu) {
  const q = new URLSearchParams({ q: chuoi, format: 'jsonv2', countrycodes: 'vn', 'accept-language': 'vi', limit: '10', addressdetails: '1' });
  if (gan) q.set('viewbox', [gan[0] - 0.3, gan[1] + 0.3, gan[0] + 0.3, gan[1] - 0.3].map(v => v.toFixed(4)).join(','));
  const r = await fetch(CAU_HINH.dichVu.nominatim + '/search?' + q, { signal: tinHieu });
  if (!r.ok) throw new Error('Nominatim ' + r.status);
  const d = await r.json();
  return boTrung(d.map(x => ({
    ten: x.name || (x.display_name || '').split(',')[0], diaChi: gonDiaChi(x.display_name, x.name), viTri: [+x.lon, +x.lat],
    loai: x.type || '', nguon: 'nominatim'
  })));
}

/** Rút gọn địa chỉ Nominatim: bỏ mã bưu chính, "Việt Nam" và phần trùng tên. */
export function gonDiaChi(hienThi, ten) {
  return (hienThi || '').split(',').map(s => s.trim())
    .filter((s, i) => s && !/^\d{5,6}$/.test(s) && s !== 'Việt Nam' && !(i === 0 && s === ten))
    .join(', ');
}

/** Tên và địa chỉ của một điểm trên bản đồ. */
export async function diaChiTuToaDo(p) {
  if (caiDat.khoaVietmap) {
    try {
      const q = new URLSearchParams({ apikey: caiDat.khoaVietmap, lng: p[0], lat: p[1] });
      const r = await fetch(CAU_HINH.dichVu.vietmap.nguoc + '?' + q);
      const d = await r.json();
      if (Array.isArray(d) && d[0]) return { ten: d[0].name || d[0].address, diaChi: d[0].display || d[0].address };
    } catch (e) { /* dùng Nominatim */ }
  }
  const q = new URLSearchParams({ lat: p[1].toFixed(6), lon: p[0].toFixed(6), format: 'jsonv2', 'accept-language': 'vi', zoom: '18', addressdetails: '1' });
  const r = await fetch(CAU_HINH.dichVu.nominatim + '/reverse?' + q);
  if (!r.ok) throw new Error('Nominatim ' + r.status);
  const d = await r.json();
  if (d.error) throw new Error(d.error);
  const a = d.address || {};
  const soNha = [a.house_number, a.road].filter(Boolean).join(' ');
  const ten = d.name || soNha || a.road || a.suburb || (d.display_name || '').split(',')[0];
  return { ten, diaChi: gonDiaChi(d.display_name, ten) };
}

const VIET_TAT = [[/^Phường /, 'P. '], [/^Quận /, 'Q. '], [/^Huyện /, 'H. '], [/^Thị xã /, 'TX. '], [/^Thị trấn /, 'TT. '],
  [/^Thành phố /, 'TP. '], [/^Tỉnh /, '']];

/** "P. Láng Thượng, Q. Đống Đa, TP. Hà Nội" từ phần address của Nominatim (dòng khu vực dưới tên đường khi dẫn đường). */
export function rutGonKhuVuc(a = {}) {
  const tp = a.city || a.state || a.province || '';
  const ds = [a.suburb || a.quarter || a.village || a.town || a.hamlet, a.city_district || a.district || a.county, tp]
    .filter(Boolean).map(s => VIET_TAT.reduce((x, [m, t]) => x.replace(m, t), s.trim()));
  // thành phố trực thuộc trung ương ghi thiếu chữ "Thành phố" (vd. "Hà Nội"): thêm "TP."
  if (a.city && ds.length && ds[ds.length - 1] === a.city.trim() && !/^(TP\.|Tỉnh)/.test(a.city)) ds[ds.length - 1] = 'TP. ' + a.city.trim();
  return [...new Set(ds)].join(', ');
}

/** Khu vực (phường, quận, thành phố) của một điểm; '' nếu không tra được. */
export async function khuVucTuToaDo(p, tinHieu) {
  const q = new URLSearchParams({ lat: p[1].toFixed(5), lon: p[0].toFixed(5), format: 'jsonv2', 'accept-language': 'vi', zoom: '16', addressdetails: '1' });
  const r = await fetch(CAU_HINH.dichVu.nominatim + '/reverse?' + q, { signal: tinHieu });
  if (!r.ok) throw new Error('Nominatim ' + r.status);
  const d = await r.json();
  return d.error ? '' : rutGonKhuVuc(d.address);
}
