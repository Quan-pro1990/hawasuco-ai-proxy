/*
 * Dữ liệu giao thông (camera, biển báo, trạm thu phí…) theo ô lưới, lưu trong máy (IndexedDB) và tự làm mới mỗi tuần.
 *  - Có máy chủ HawaMap: lấy ô từ /api/giao-thong (máy chủ lưu đệm và tự cập nhật từ OpenStreetMap mỗi tuần).
 *  - Không có máy chủ: tải thẳng từ Overpass API.
 * Ô đã có trong máy được dùng ngay (kể cả khi mất mạng); ô quá 7 ngày được tải lại ở nền.
 * Ô không dùng tới trong 30 ngày thì xoá để không chiếm bộ nhớ.
 */
import { idb } from './kho.js';
import { cauTruyVanO, docDiemOverpass, khungO, truyVanOverpass, oCanLamMoi, PHIEN_BAN_DIEM } from './duong-xa.js';

export const CHU_KY_CAP_NHAT = 7 * 86400000;
const BO_SAU = 30 * 86400000;

/** Kho lưu trong IndexedDB (bảng "giaothong", khoá "khoa" = "<ô>:<lớp>"). */
export function khoIdb() {
  return {
    lay: k => idb.lay('giaothong', k),
    luu: o => idb.luu('giaothong', o),
    tatCa: () => idb.tatCa('giaothong'),
    xoa: k => idb.xoa('giaothong', k)
  };
}

/** Kho trong bộ nhớ (khi trình duyệt không có IndexedDB, và để kiểm thử). */
export function khoBoNho() {
  const m = new Map();
  return {
    lay: async k => m.get(k),
    luu: async o => { m.set(o.khoa, o); },
    tatCa: async () => [...m.values()],
    xoa: async k => { m.delete(k); }
  };
}

export class NguonDuLieuGiaoThong {
  /**
   * @param o.kho        kho lưu (khoIdb / khoBoNho)
   * @param o.layMayChu  () => địa chỉ API máy chủ HawaMap ("api", "https://…/api") hoặc null
   */
  constructor({ kho = typeof indexedDB !== 'undefined' ? khoIdb() : khoBoNho(), layMayChu = () => null } = {}) {
    this.kho = kho;
    this.layMayChu = layMayChu;
    this.bo = new Map();          // khoá → ô đã đọc trong phiên này
    this.choLamMoi = new Set();
    this.lanThu = new Map();      // khoá → lúc thử làm mới gần nhất (mỗi ô thử tối đa 1 lần / giờ)
    this.dangLamMoi = false;
    this.khiCoMoi = null;         // (ô) => void: báo có dữ liệu mới của một ô (vd. vừa làm mới ở nền)
  }

  /** Các ô (mỗi ô một bản ghi { khoa, ma, lop, capNhat, dungLuc, diem }) — dùng bản trong máy nếu có. */
  async layNhieu(dsMa, lops, bayGio = Date.now()) {
    const ds = [], can = [], loi = [];
    for (const ma of dsMa) {
      for (const lop of lops) {
        const khoa = ma + ':' + lop;
        let o = this.bo.get(khoa);
        if (!o) { try { o = await this.kho.lay(khoa); } catch (e) { o = null; } }
        if (!o) { can.push({ ma, lop }); continue; }
        this.bo.set(khoa, o);
        ds.push(o);
        if (oCanLamMoi(o, bayGio, CHU_KY_CAP_NHAT) && bayGio - (this.lanThu.get(khoa) || 0) > 3600000) this.choLamMoi.add(khoa);
        if (bayGio - (o.dungLuc || 0) > 86400000) { o.dungLuc = bayGio; this.kho.luu(o).catch(() => {}); }
      }
    }
    if (can.length) {
      const kq = await this.taiMoi(can);
      ds.push(...kq.ds);
      loi.push(...kq.loi);
    }
    if (this.choLamMoi.size) this.lamMoiNen();
    return { ds, loi };
  }

  /** Tải các ô từ máy chủ (nếu có) hoặc Overpass rồi lưu vào máy. */
  async taiMoi(can) {
    const ds = [], loi = [];
    let conLai = can;
    const mc = this.layMayChu();
    if (mc) {
      conLai = [];
      for (const lop of [...new Set(can.map(c => c.lop))]) {
        const ma = can.filter(c => c.lop === lop).map(c => c.ma);
        for (let i = 0; i < ma.length; i += 9) {
          const phan = ma.slice(i, i + 9);
          try {
            const r = await fetch(`${mc}/giao-thong?lop=${lop}&o=${phan.join(',')}`, { cache: 'no-store' });
            const d = await r.json();
            if (!r.ok) throw new Error(d.loi || 'Máy chủ lỗi ' + r.status);
            for (const m of phan) {
              if (d.o && d.o[m]) ds.push(await this.luu(m, lop, d.o[m].capNhat, d.o[m].diem, d.o[m].pb));
              else conLai.push({ ma: m, lop });
            }
          } catch (e) {
            phan.forEach(m => conLai.push({ ma: m, lop }));
          }
        }
      }
    }
    for (const { ma, lop } of conLai) {
      try {
        const d = await truyVanOverpass(cauTruyVanO(khungO(ma), lop));
        ds.push(await this.luu(ma, lop, Date.now(), [...docDiemOverpass(d.elements).values()], PHIEN_BAN_DIEM));
      } catch (e) {
        loi.push(e);
      }
    }
    return { ds, loi };
  }

  async luu(ma, lop, capNhat, diem, pb = 1) {
    const o = { khoa: ma + ':' + lop, ma, lop, capNhat, dungLuc: Date.now(), diem, pb };
    const cu = this.bo.get(o.khoa);
    this.bo.set(o.khoa, o);
    try { await this.kho.luu(o); } catch (e) { /* bộ nhớ đầy: vẫn dùng trong phiên */ }
    // chỉ báo khi thật sự có bản mới hơn (máy chủ có thể vẫn trả bản cũ trong lúc nó đang tải lại)
    if (this.khiCoMoi && (!cu || capNhat > cu.capNhat)) this.khiCoMoi(o);
    return o;
  }

  /** Tải lại ở nền các ô đã cũ đang dùng (từng ô một để không làm chậm máy). */
  async lamMoiNen() {
    if (this.dangLamMoi) return;
    this.dangLamMoi = true;
    try {
      while (this.choLamMoi.size) {
        const khoa = this.choLamMoi.values().next().value;
        this.choLamMoi.delete(khoa);
        this.lanThu.set(khoa, Date.now());
        const [ma, lop] = khoa.split(':');
        await this.taiMoi([{ ma, lop }]);
      }
    } finally {
      this.dangLamMoi = false;
    }
  }

  /**
   * Cập nhật hằng tuần: tải lại ô quá 7 ngày (hoặc mọi ô nếu `tatCa`), xoá ô không dùng trong 30 ngày.
   * @returns { soO, soLamMoi, soXoa, soLoi }
   */
  async capNhatDinhKy({ tatCa = false, bayGio = Date.now() } = {}) {
    const ds = await this.kho.tatCa();
    let soLamMoi = 0, soXoa = 0, soLoi = 0;
    for (const o of ds) {
      if (bayGio - (o.dungLuc || o.capNhat) > BO_SAU) {
        await this.kho.xoa(o.khoa);
        this.bo.delete(o.khoa);
        soXoa++;
        continue;
      }
      if (!tatCa && !oCanLamMoi(o, bayGio, CHU_KY_CAP_NHAT)) continue;
      const kq = await this.taiMoi([{ ma: o.ma, lop: o.lop }]);
      if (kq.loi.length) soLoi++; else soLamMoi++;
    }
    return { soO: ds.length - soXoa, soLamMoi, soXoa, soLoi };
  }

  /** Tình trạng dữ liệu trong máy: số ô, số điểm, lần cập nhật cũ nhất / mới nhất. */
  async trangThai() {
    const ds = await this.kho.tatCa();
    const luc = ds.map(o => o.capNhat);
    return {
      soO: new Set(ds.map(o => o.ma)).size,
      soDiem: ds.reduce((t, o) => t + o.diem.length, 0),
      cuNhat: luc.length ? Math.min(...luc) : null,
      moiNhat: luc.length ? Math.max(...luc) : null
    };
  }
}
