/*
 * Thông tin con đường đang đi (lấy từ OpenStreetMap qua Overpass API):
 *  - tên đường, loại đường, giới hạn tốc độ (biển báo trong dữ liệu, hoặc ước tính theo Thông tư 38/2024/TT-BGTVT)
 *  - điểm cần cảnh báo quanh vị trí: camera (tốc độ, đèn đỏ, đo tốc độ trung bình, giám sát), đường sắt giao cắt,
 *    trạm thu phí, đèn tín hiệu, gờ giảm tốc, vạch qua đường, trường học, hầm, trạm dừng nghỉ, đoạn nguy hiểm,
 *    biển cấm rẽ / chỉ được rẽ tại giao lộ
 */
import { CAU_HINH } from './cau-hinh.js';
import { khoangCach, chieuLenDoan, phuongVi, lechGoc } from './hinh-hoc.js';
import { docBienBao, BIEN_VN, chieuMotChieu } from './luat-duong.js';
import { docPhiOsm } from './phi-cao-toc.js';

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

// Dữ liệu điểm cảnh báo được tải theo ô lưới CO_O độ (≈ 11 km) để lưu đệm, dùng chung giữa máy chủ và trình duyệt
// và làm mới định kỳ (du-lieu-giao-thong.js, kho-giao-thong.js). Mỗi ô có hai lớp:
//  - chinh: mọi loại điểm trừ đèn tín hiệu / vạch qua đường;  - nho: đèn tín hiệu, vạch qua đường (rất nhiều, chỉ tải khi bật).
export const CO_O = 0.1;
export const LOP_NHO = ['dentinhieu', 'vachqua'];

/** Mã ô chứa điểm [lng, lat]. */
export function maO(lng, lat) {
  return `${Math.floor((lng + 180) / CO_O)}_${Math.floor((lat + 90) / CO_O)}`;
}

export function laMaO(ma) { return /^\d{1,4}_\d{1,4}$/.test(String(ma)); }

/** Khung [tây, nam, đông, bắc] của ô. */
export function khungO(ma) {
  const [x, y] = String(ma).split('_').map(Number);
  const r = v => +v.toFixed(6);
  return [r(x * CO_O - 180), r(y * CO_O - 90), r((x + 1) * CO_O - 180), r((y + 1) * CO_O - 90)];
}

/** Các ô phủ vùng bán kính `banKinh` mét quanh p. */
export function oQuanh(p, banKinh) {
  const dLat = banKinh / 110574, dLng = banKinh / (111320 * Math.cos(p[1] * Math.PI / 180));
  const [x0, y0] = maO(p[0] - dLng, p[1] - dLat).split('_').map(Number);
  const [x1, y1] = maO(p[0] + dLng, p[1] + dLat).split('_').map(Number);
  const ds = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) ds.push(`${x}_${y}`);
  return ds;
}

/**
 * Phần truy vấn Overpass cho từng nhóm điểm; `q` là bộ lọc vùng "(nam,tây,bắc,đông)".
 * nut: nút (out body), vung: nút / vùng lấy điểm giữa (out center), duong: đường lấy hình dạng (out geom).
 */
const TRUY_VAN_DIEM = {
  camera: ['nut', q => `node${q}[highway=speed_camera];node${q}[man_made=surveillance][surveillance=traffic];`],
  duongsat: ['nut', q => `node${q}[railway=level_crossing];`],
  thuphi: ['nut', q => `node${q}[barrier=toll_booth];`],
  gogiam: ['nut', q => `node${q}[traffic_calming~"^(yes|bump|hump|table|cushion|rumble_strip|dip)$"];`],
  nguyhiem: ['nut', q => `node${q}[hazard];`],
  bienbao: ['nut', q => `node${q}[traffic_sign~"^VN:"];`],
  truonghoc: ['vung', q => `nwr${q}[amenity~"^(school|kindergarten)$"];`],
  tramdung: ['vung', q => `nwr${q}[highway~"^(rest_area|services)$"];`],
  ham: ['duong', q => `way${q}[tunnel~"^(yes|building_passage)$"][highway~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|motorway_link|trunk_link|primary_link)$"];`],
  dentinhieu: ['nut', q => `node${q}[highway=traffic_signals];`],
  vachqua: ['nut', q => `node${q}[highway=crossing][crossing!=no];`]
};
const LENH_IN = { nut: 'out body;', vung: 'out body center;', duong: 'out tags geom;' };

/** Câu truy vấn Overpass cho một lớp ('chinh' | 'nho') của khung [tây, nam, đông, bắc]. */
export function cauTruyVanO(khung, lop = 'chinh') {
  const q = `(${khung[1]},${khung[0]},${khung[3]},${khung[2]})`;
  const phan = { nut: '', vung: '', duong: '' };
  for (const [k, [kieu, f]] of Object.entries(TRUY_VAN_DIEM)) if (LOP_NHO.includes(k) === (lop === 'nho')) phan[kieu] += f(q);
  let cau = '';
  for (const [kieu, noiDung] of Object.entries(phan)) if (noiDung) cau += `(${noiDung});${LENH_IN[kieu]}`;
  if (lop !== 'nho') {
    // camera gắn với quan hệ enforcement (đèn đỏ, đo tốc độ trung bình…): lấy quan hệ và nút thiết bị
    cau += `rel${q}[type=enforcement]->.e;.e out body;node(r.e:"device");out body;`;
    // biển cấm rẽ: quan hệ restriction và nút giao lộ (via)
    cau += `rel${q}[type=restriction]->.r;.r out body;node(r.r:"via");out skel;`;
  }
  return '[out:json][timeout:90];' + cau;
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
    if (e.type === 'node' && t.traffic_sign) {
      // biển báo Việt Nam (đường cấm, cấm vượt, cấm dừng / đỗ…): mỗi biển trên nút là một điểm
      for (const ma of docBienBao(t.traffic_sign)) them(`osm${e.id}-${ma}`, BIEN_VN[ma].loai, [e.lon, e.lat], t, { bien: ma });
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
    const khac = loai === 'nguyhiem' ? { nguyHiem: t.hazard } : loai === 'thuphi' ? { phiOsm: docPhiOsm(t['charge:motorcar'] || t.charge) } : {};
    them('osm' + (e.type === 'node' ? '' : e.type[0]) + e.id, loai, viTri, t, khac);
  }
  return kq;
}

function chonThe(t, mau) {
  const kq = {};
  for (const [k, v] of Object.entries(t)) if (mau.test(k)) kq[k] = v;
  return kq;
}

/** Nguồn điểm cảnh báo đơn giản (gọi thẳng Overpass, nhớ trong bộ nhớ) khi không truyền nguồn có lưu đệm. */
export class NguonTrucTiep {
  constructor() { this.bo = new Map(); }

  async layNhieu(dsMa, lops) {
    const kq = [], loi = [];
    for (const ma of dsMa) {
      for (const lop of lops) {
        const khoa = ma + ':' + lop;
        try {
          if (!this.bo.has(khoa)) {
            const d = await truyVanOverpass(cauTruyVanO(khungO(ma), lop));
            this.bo.set(khoa, { khoa, ma, lop, capNhat: Date.now(), diem: [...docDiemOverpass(d.elements).values()] });
          }
          kq.push(this.bo.get(khoa));
        } catch (e) { loi.push(e); }
      }
    }
    return { ds: kq, loi };
  }
}

export class ThongTinDuong {
  /** @param o.nguon  nguồn điểm cảnh báo theo ô (du-lieu-giao-thong.js); mặc định gọi thẳng Overpass */
  constructor({ nguon = null } = {}) {
    this.nguon = nguon || new NguonTrucTiep();
    // ô vừa được làm mới ở nền: lần cập nhật vị trí sau sẽ đọc lại điểm
    this.nguon.khiCoMoi = () => { if (!this.dangTaiDiem) this.khoaDiem = ''; };
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

  /** Gọi mỗi khi có vị trí mới: tải lại đường khi đã đi xa, tải điểm khi cần ô mới hoặc đổi loại cảnh báo. */
  capNhat(p) {
    if (Date.now() - this.loiLuc < 30000) return;
    if (!this.dangTaiDuong && (!this.tamDuong || khoangCach(p, this.tamDuong) > 300)) this.taiDuong(p);
    if (!this.dangTaiDiem && this.khoaVung(p) !== this.khoaDiem) this.taiDiem(p);
  }

  /** Loại điểm cần dùng (gán từ ngoài: () => Set các loại đang bật); null = mọi loại. */
  loaiCanTai() {
    return this.layLoaiCan ? this.layLoaiCan() : null;
  }

  lopCan(loai) {
    return !loai || LOP_NHO.some(l => loai.has(l)) ? ['chinh', 'nho'] : ['chinh'];
  }

  khoaVung(p) {
    const loai = this.loaiCanTai();
    return oQuanh(p, 4000).join() + '|' + this.lopCan(loai).join() + '|' + (loai ? [...loai].sort().join() : '*');
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

  /** Tải (từ bộ đệm hoặc mạng) các ô quanh p rồi giữ lại điểm thuộc loại đang bật. */
  async taiDiem(p) {
    this.dangTaiDiem = true;
    const khoa = this.khoaVung(p);
    const loai = this.loaiCanTai();
    try {
      const { ds, loi } = await this.nguon.layNhieu(oQuanh(p, 4000), this.lopCan(loai));
      if (!ds.length && loi.length) throw loi[0];
      const moi = new Map();
      for (const o of ds) for (const d of o.diem) if (!loai || loai.has(d.loai)) moi.set(d.id, d);
      this.diem = moi;
      this.tamDiem = p;
      this.khoaDiem = loi.length ? '' : khoa;        // có ô lỗi: thử lại sau
      if (loi.length) this.loiLuc = Date.now();
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
          const chieu = chieuMotChieu(w.tags);
          if ((chieu === 1 && !xuoi) || (chieu === -1 && xuoi)) diem += 30;
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
      toaDo: tot.w.toaDo, xuoi: tot.xuoi, tags
    };
  }

  /** Con đường tại một điểm trên tuyến, đi theo hướng `huong`: { id, tags, xuoi, gioiHan (có biển) }. */
  duongTai(p, huong, phuongTien) {
    const tot = this.khop(p, huong, 99);
    return tot ? { id: tot.w.id, tags: tot.w.tags, xuoi: tot.xuoi, gioiHan: gioiHanTuTag(tot.w.tags, tot.xuoi, phuongTien) } : null;
  }
}
