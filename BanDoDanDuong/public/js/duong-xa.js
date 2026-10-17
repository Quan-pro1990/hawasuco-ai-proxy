/*
 * Thông tin con đường đang đi (lấy từ OpenStreetMap qua Overpass API):
 *  - tên đường, loại đường, giới hạn tốc độ (biển báo trong dữ liệu, hoặc ước tính theo Thông tư 38/2024/TT-BGTVT)
 *  - điểm cần cảnh báo quanh vị trí: camera (tốc độ, đèn đỏ, đo tốc độ trung bình, giám sát), đường sắt giao cắt,
 *    trạm thu phí, đèn tín hiệu, gờ giảm tốc, vạch qua đường, trường học, hầm, trạm dừng nghỉ, đoạn nguy hiểm,
 *    biển cấm rẽ / chỉ được rẽ tại giao lộ
 */
import { CAU_HINH } from './cau-hinh.js';
import { khoangCach, chieuLenDoan, phuongVi, lechGoc } from './hinh-hoc.js';

const LOAI_DUONG = 'motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|road|' +
  'motorway_link|trunk_link|primary_link|secondary_link|tertiary_link';
const UU_TIEN = { motorway: 6, trunk: 5, primary: 4, secondary: 3, tertiary: 2, motorway_link: 2, trunk_link: 2, service: -6 };
const DUONG_NHO = new Set(['residential', 'living_street', 'service', 'unclassified']);

/** Gửi truy vấn Overpass, lỗi thì thử máy chủ dự phòng. */
export async function truyVanOverpass(q, tinHieu) {
  let loi = null;
  for (const url of CAU_HINH.dichVu.overpass) {
    try {
      const r = await fetch(url, {
        method: 'POST', signal: tinHieu,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: 'data=' + encodeURIComponent(q)
      });
      if (r.ok) return await r.json();
      loi = new Error('Overpass trả lỗi ' + r.status);
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      loi = e;
    }
  }
  throw loi || new Error('Không gọi được Overpass');
}

/** Đọc giá trị maxspeed của OSM ("50", "60 mph", "VN:urban"…) ra km/h. */
export function docTocDo(s, phuongTien) {
  if (!s) return null;
  const m = /^\s*(\d+)\s*(mph)?/.exec(s);
  if (m) return m[2] ? Math.round(+m[1] * 1.609) : +m[1];
  if (s === 'VN:urban') return 50;
  if (s === 'VN:rural') return phuongTien === 'xemay' ? 60 : 80;
  if (s === 'VN:motorway') return 120;
  return null;
}

/** Giới hạn tốc độ ghi trong dữ liệu đường, xét chiều đi và loại xe. */
export function gioiHanTuTag(tags, xuoiChieu, phuongTien) {
  const chieu = xuoiChieu ? 'forward' : 'backward';
  const khoa = [];
  if (phuongTien === 'xemay') khoa.push('maxspeed:motorcycle:' + chieu, 'maxspeed:motorcycle');
  khoa.push('maxspeed:' + chieu, 'maxspeed');
  for (const k of khoa) {
    const v = docTocDo(tags[k], phuongTien);
    if (v) return phuongTien === 'xemay' && !k.includes('motorcycle') ? Math.min(v, 70) : v;
  }
  return null;
}

/**
 * Ước tính giới hạn khi đường chưa có biển trong dữ liệu (Thông tư 38/2024/TT-BGTVT):
 * trong khu đông dân cư: đường đôi / một chiều ≥ 2 làn 60, đường hai chiều 50;
 * ngoài khu dân cư: ô tô 90 / 80, xe máy 70 / 60; cao tốc theo biển (ước 100).
 */
export function uocTinhGioiHan(tags, dongDanCu, phuongTien) {
  const hw = tags.highway || '';
  if (hw === 'motorway') return phuongTien === 'xemay' ? null : 100;
  if (hw.endsWith('_link')) return 50;
  if (hw === 'service' || hw === 'road' || hw === 'track') return null;
  if (DUONG_NHO.has(hw)) return 50;
  const soLan = parseInt(tags.lanes, 10) || 0;
  const duongDoi = tags.dual_carriageway === 'yes' || (tags.oneway === 'yes' && (soLan >= 2 || hw === 'trunk' || hw === 'primary'));
  if (dongDanCu) return duongDoi ? 60 : 50;
  if (phuongTien === 'xemay') return duongDoi ? 70 : 60;
  return duongDoi ? 90 : 80;
}

// ------------------------------------------------------------------ điểm cảnh báo
const LOAI_CAMERA = ['camera', 'cameraden', 'cameratb', 'cameragiamsat', 'kiemtra'];

/**
 * Phần truy vấn Overpass cho từng loại điểm; `q` là bộ lọc vùng "(around:…)".
 * nut: nút (out body), vung: nút / vùng lấy điểm giữa (out center), duong: đường lấy hình dạng (out geom).
 */
const TRUY_VAN_DIEM = {
  camera: ['nut', q => `node${q}[highway=speed_camera];node${q}[man_made=surveillance][surveillance=traffic];`],
  duongsat: ['nut', q => `node${q}[railway=level_crossing];`],
  thuphi: ['nut', q => `node${q}[barrier=toll_booth];`],
  dentinhieu: ['nut', q => `node${q}[highway=traffic_signals];`],
  gogiam: ['nut', q => `node${q}[traffic_calming~"^(yes|bump|hump|table|cushion|rumble_strip|dip)$"];`],
  vachqua: ['nut', q => `node${q}[highway=crossing][crossing!=no];`],
  nguyhiem: ['nut', q => `node${q}[hazard];`],
  truonghoc: ['vung', q => `nwr${q}[amenity~"^(school|kindergarten)$"];`],
  tramdung: ['vung', q => `nwr${q}[highway~"^(rest_area|services)$"];`],
  ham: ['duong', q => `way${q}[tunnel~"^(yes|building_passage)$"][highway~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|motorway_link|trunk_link|primary_link)$"];`]
};
const LENH_IN = { nut: 'out body;', vung: 'out body center;', duong: 'out tags geom;' };

/** Câu truy vấn Overpass cho các loại điểm cần tải quanh p, null nếu không cần loại nào. */
export function cauTruyVanDiem(p, loai) {
  const q = `(around:4000,${p[1].toFixed(6)},${p[0].toFixed(6)})`;
  const coCamera = LOAI_CAMERA.some(l => loai.has(l));
  const phan = { nut: '', vung: '', duong: '' };
  for (const [k, [kieu, f]] of Object.entries(TRUY_VAN_DIEM)) if (k === 'camera' ? coCamera : loai.has(k)) phan[kieu] += f(q);
  let cau = '';
  for (const [kieu, noiDung] of Object.entries(phan)) if (noiDung) cau += `(${noiDung});${LENH_IN[kieu]}`;
  // camera gắn với quan hệ enforcement (đèn đỏ, đo tốc độ trung bình…): lấy quan hệ và nút thiết bị
  if (coCamera) cau += `rel${q}[type=enforcement]->.e;.e out body;node(r.e:"device");out body;`;
  // biển cấm rẽ: quan hệ restriction và nút giao lộ (via)
  if (loai.has('camre')) cau += `rel${q}[type=restriction]->.r;.r out body;node(r.r:"via");out skel;`;
  return cau ? '[out:json][timeout:25];' + cau : null;
}

const LOAI_ENFORCEMENT = { maxspeed: 'camera', traffic_signals: 'cameraden', average_speed: 'cameratb', check: 'kiemtra' };

/** Loại cảnh báo của một nút / vùng OSM theo thẻ, null nếu không thuộc loại nào. */
export function phanLoaiDiem(t) {
  if (t.highway === 'speed_camera') return 'camera';
  if (t.man_made === 'surveillance') return 'cameragiamsat';
  if (t.railway === 'level_crossing') return 'duongsat';
  if (t.barrier === 'toll_booth') return 'thuphi';
  if (t.highway === 'traffic_signals') return 'dentinhieu';
  if (t.traffic_calming) return 'gogiam';
  if (t.highway === 'crossing') return 'vachqua';
  if (t.hazard) return 'nguyhiem';
  if (t.amenity === 'school' || t.amenity === 'kindergarten') return 'truonghoc';
  if (t.highway === 'rest_area' || t.highway === 'services') return 'tramdung';
  if (t.tunnel) return 'ham';
  return null;
}

/** Đọc phản hồi Overpass thành Map id → điểm { id, loai, viTri, gioiHan, ten, … }. */
export function docDiemOverpass(ds) {
  const kq = new Map();
  const nut = new Map();
  for (const e of ds) if (e.type === 'node') nut.set(e.id, e);
  const them = (id, loai, viTri, t = {}, khac = {}) =>
    kq.set(id, { id, loai, viTri, gioiHan: docTocDo(t.maxspeed), ten: t.name || '', ...khac });
  for (const e of ds) {
    const t = e.tags || {};
    if (e.type === 'relation') {
      const tv = (vaiTro, kieu) => (e.members || []).filter(m => m.role === vaiTro && m.type === kieu).map(m => m.ref);
      if (t.type === 'enforcement') {
        const loai = LOAI_ENFORCEMENT[t.enforcement];
        if (!loai) continue;
        for (const ref of tv('device', 'node')) {
          const n = nut.get(ref);
          if (n) them('osm' + ref, loai, [n.lon, n.lat], { ...(n.tags || {}), ...t });
        }
      } else if (t.type === 'restriction') {
        const via = tv('via', 'node').map(r => nut.get(r)).filter(Boolean);
        const tu = tv('from', 'way');
        if (via.length !== 1 || !tu.length) continue;
        them('re' + e.id, 'camre', [via[0].lon, via[0].lat], {}, { tuDuong: tu, the: chonThe(t, /^(restriction|except)/) });
      }
      continue;
    }
    if (e.type === 'node' && kq.has('osm' + e.id)) continue;      // đã có loại chi tiết hơn từ quan hệ enforcement
    const loai = phanLoaiDiem(t);
    if (!loai) continue;
    if (loai === 'ham') {
      // hầm: cảnh báo ở hai cửa hầm (đi chiều nào cũng gặp một cửa trước)
      const g = e.geometry;
      if (!g || g.length < 2) continue;
      them('ham' + e.id, loai, [g[0].lon, g[0].lat], t, { cung: 'ham' + e.id });
      them('ham' + e.id + 'b', loai, [g[g.length - 1].lon, g[g.length - 1].lat], t, { cung: 'ham' + e.id });
      continue;
    }
    const viTri = e.type === 'node' ? [e.lon, e.lat] : e.center ? [e.center.lon, e.center.lat] : null;
    if (!viTri) continue;
    them('osm' + (e.type === 'node' ? '' : e.type[0]) + e.id, loai, viTri, t, loai === 'nguyhiem' ? { nguyHiem: t.hazard } : {});
  }
  return kq;
}

function chonThe(t, mau) {
  const kq = {};
  for (const [k, v] of Object.entries(t)) if (mau.test(k)) kq[k] = v;
  return kq;
}

export class ThongTinDuong {
  constructor() {
    this.duong = [];          // [{ id, tags, toaDo }]
    this.tamDuong = null;
    this.dangTaiDuong = false;
    this.dongDanCu = true;
    this.diem = new Map();    // id → { id, loai, viTri, gioiHan, ten }
    this.tamDiem = null;
    this.dangTaiDiem = false;
    this.loiLuc = 0;
    this.duongTruoc = null;
    this.phienDuong = 0;      // tăng mỗi lần tải xong dữ liệu đường / điểm (để bên ngoài biết có dữ liệu mới)
    this.phienDiem = 0;
    this.khoaDiem = '';
    this.layLoaiCan = null;
  }

  /** Gọi mỗi khi có vị trí mới: tải lại dữ liệu khi đã đi xa khỏi vùng đã tải. */
  capNhat(p) {
    if (Date.now() - this.loiLuc < 30000) return;
    if (!this.dangTaiDuong && (!this.tamDuong || khoangCach(p, this.tamDuong) > 300)) this.taiDuong(p);
    const doiLoai = this.tamDiem && this.khoaDiem !== [...this.loaiCanTai()].sort().join();
    if (!this.dangTaiDiem && (!this.tamDiem || doiLoai || khoangCach(p, this.tamDiem) > 2000)) this.taiDiem(p);
  }

  async taiDuong(p) {
    this.dangTaiDuong = true;
    const q = `[out:json][timeout:15];way(around:500,${p[1].toFixed(6)},${p[0].toFixed(6)})[highway~"^(${LOAI_DUONG})$"];out tags geom;`;
    try {
      const d = await truyVanOverpass(q);
      this.duong = d.elements.filter(e => e.type === 'way' && e.geometry)
        .map(e => ({ id: e.id, tags: e.tags || {}, toaDo: e.geometry.map(g => [g.lon, g.lat]) }));
      this.dongDanCu = this.duong.filter(w => DUONG_NHO.has(w.tags.highway)).length >= 25;
      this.tamDuong = p;
      this.phienDuong++;
    } catch (e) {
      this.loiLuc = Date.now();
    } finally {
      this.dangTaiDuong = false;
    }
  }

  /** Chỉ tải những loại điểm đang bật cảnh báo (gán từ ngoài: () => Set các loại). */
  loaiCanTai() {
    return this.layLoaiCan ? this.layLoaiCan() : new Set(Object.keys(TRUY_VAN_DIEM));
  }

  async taiDiem(p) {
    this.dangTaiDiem = true;
    const loai = this.loaiCanTai();
    const khoa = [...loai].sort().join();
    const q = cauTruyVanDiem(p, loai);
    try {
      if (q) {
        const d = await truyVanOverpass(q);
        const moi = docDiemOverpass(d.elements);
        for (const [id, x] of this.diem) if (!moi.has(id) && khoangCach(x.viTri, p) < 3500) this.diem.delete(id);
        for (const [id, x] of moi) this.diem.set(id, x);
      }
      for (const [id, x] of this.diem) if (khoangCach(x.viTri, p) > 15000 || !loai.has(x.loai)) this.diem.delete(id);
      this.tamDiem = p;
      this.khoaDiem = khoa;
      this.phienDiem++;
    } catch (e) {
      this.loiLuc = Date.now();
    } finally {
      this.dangTaiDiem = false;
    }
  }

  danhSachDiem() { return [...this.diem.values()]; }

  /** Con đường khớp nhất với vị trí và hướng đi: { w, diem, xuoi } hoặc null. `giu`: id đường đang đi (ưu tiên giữ). */
  khop(p, huong, tocDo, giu = null) {
    let tot = null;
    const coHuong = huong != null && isFinite(huong) && tocDo > 1.5;
    for (const w of this.duong) {
      for (let i = 0; i < w.toaDo.length - 1; i++) {
        const r = chieuLenDoan(p, w.toaDo[i], w.toaDo[i + 1]);
        if (r.kc > 40) continue;
        let diem = r.kc - (UU_TIEN[w.tags.highway] || 0);
        let xuoi = true;
        if (coHuong) {
          const lg = Math.abs(lechGoc(phuongVi(w.toaDo[i], w.toaDo[i + 1]), huong));
          diem += Math.min(lg, 180 - lg) * 0.5;      // đường đi được cả hai chiều
          xuoi = lg <= 90;
          if (w.tags.oneway === 'yes' && !xuoi) diem += 30;
        }
        if (giu === w.id) diem -= 8;                 // giữ đường cũ, tránh nhảy qua lại ở ngã tư
        if (!tot || diem < tot.diem) tot = { w, diem, xuoi };
      }
    }
    return tot;
  }

  /** Con đường đang đi, kèm giới hạn tốc độ và hình dạng (để tìm khúc cua phía trước). */
  duongHienTai(p, huong, tocDo, phuongTien) {
    const tot = this.khop(p, huong, tocDo, this.duongTruoc);
    if (!tot) { this.duongTruoc = null; return null; }
    this.duongTruoc = tot.w.id;
    const tags = tot.w.tags;
    const coBien = gioiHanTuTag(tags, tot.xuoi, phuongTien);
    return {
      id: tot.w.id, ten: tags.name || '', ref: tags.ref || '', loai: tags.highway,
      gioiHan: coBien, gioiHanUocTinh: coBien ? null : uocTinhGioiHan(tags, this.dongDanCu, phuongTien),
      toaDo: tot.w.toaDo, xuoi: tot.xuoi
    };
  }

  /** Giới hạn tốc độ có biển (trong dữ liệu) tại một điểm trên đường, đi theo hướng `huong`. */
  gioiHanTai(p, huong, phuongTien) {
    const tot = this.khop(p, huong, 99);
    return tot ? { id: tot.w.id, gioiHan: gioiHanTuTag(tot.w.tags, tot.xuoi, phuongTien) } : null;
  }
}
