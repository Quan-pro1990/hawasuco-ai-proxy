/*
 * Thông tin con đường đang đi (lấy từ OpenStreetMap qua Overpass API):
 *  - tên đường, loại đường, giới hạn tốc độ (biển báo trong dữ liệu, hoặc ước tính theo Thông tư 38/2024/TT-BGTVT)
 *  - điểm cần cảnh báo quanh vị trí: camera tốc độ, đường sắt giao cắt, trạm thu phí
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
  }

  /** Gọi mỗi khi có vị trí mới: tải lại dữ liệu khi đã đi xa khỏi vùng đã tải. */
  capNhat(p) {
    if (Date.now() - this.loiLuc < 30000) return;
    if (!this.dangTaiDuong && (!this.tamDuong || khoangCach(p, this.tamDuong) > 300)) this.taiDuong(p);
    if (!this.dangTaiDiem && (!this.tamDiem || khoangCach(p, this.tamDiem) > 2000)) this.taiDiem(p);
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
    } catch (e) {
      this.loiLuc = Date.now();
    } finally {
      this.dangTaiDuong = false;
    }
  }

  async taiDiem(p) {
    this.dangTaiDiem = true;
    const quanh = `(around:4000,${p[1].toFixed(6)},${p[0].toFixed(6)})`;
    const q = `[out:json][timeout:20];(node${quanh}[highway=speed_camera];node${quanh}[railway=level_crossing];` +
      `node${quanh}[barrier=toll_booth];);out body;`;
    try {
      const d = await truyVanOverpass(q);
      for (const e of d.elements) {
        const t = e.tags || {};
        const loai = t.highway === 'speed_camera' ? 'camera' : t.railway === 'level_crossing' ? 'duongsat' : 'thuphi';
        this.diem.set('osm' + e.id, { id: 'osm' + e.id, loai, viTri: [e.lon, e.lat], gioiHan: docTocDo(t.maxspeed), ten: t.name || '' });
      }
      for (const [id, x] of this.diem) if (khoangCach(x.viTri, p) > 15000) this.diem.delete(id);
      this.tamDiem = p;
    } catch (e) {
      this.loiLuc = Date.now();
    } finally {
      this.dangTaiDiem = false;
    }
  }

  danhSachDiem() { return [...this.diem.values()]; }

  /** Con đường khớp nhất với vị trí và hướng đi hiện tại. */
  duongHienTai(p, huong, tocDo, phuongTien) {
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
        if (this.duongTruoc === w.id) diem -= 8;     // giữ đường cũ, tránh nhảy qua lại ở ngã tư
        if (!tot || diem < tot.diem) tot = { w, diem, xuoi };
      }
    }
    if (!tot) { this.duongTruoc = null; return null; }
    this.duongTruoc = tot.w.id;
    const tags = tot.w.tags;
    const coBien = gioiHanTuTag(tags, tot.xuoi, phuongTien);
    return {
      id: tot.w.id, ten: tags.name || '', ref: tags.ref || '', loai: tags.highway,
      gioiHan: coBien, gioiHanUocTinh: coBien ? null : uocTinhGioiHan(tags, this.dongDanCu, phuongTien)
    };
  }
}
