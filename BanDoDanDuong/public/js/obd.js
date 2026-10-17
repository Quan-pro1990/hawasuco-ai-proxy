/*
 * Thông số xe qua cổng OBD-II với bộ chuyển ELM327 (Bluetooth).
 *  - Trình duyệt Chrome / Edge: ELM327 Bluetooth LE qua Web Bluetooth.
 *  - Ứng dụng Android: ELM327 Bluetooth thường (SPP) qua cầu nối gốc (cau-noi.js → cau/Obd.kt).
 * Phần đọc phản hồi ELM327 không phụ thuộc trình duyệt để kiểm thử được.
 */

/** Các thông số đọc định kỳ (chế độ 01). doc(b): b là mảng byte dữ liệu sau "41 <pid>". */
export const THONG_SO = {
  '010C': { ten: 'Vòng tua máy', donVi: 'vòng/phút', doc: b => Math.round((b[0] * 256 + b[1]) / 4) },
  '010D': { ten: 'Tốc độ (OBD)', donVi: 'km/h', doc: b => b[0] },
  '0105': { ten: 'Nhiệt độ nước làm mát', donVi: '°C', doc: b => b[0] - 40 },
  '015C': { ten: 'Nhiệt độ dầu máy', donVi: '°C', doc: b => b[0] - 40 },
  '010F': { ten: 'Nhiệt độ khí nạp', donVi: '°C', doc: b => b[0] - 40 },
  '010B': { ten: 'Áp suất khí nạp', donVi: 'kPa', doc: b => b[0] },
  '0111': { ten: 'Bướm ga', donVi: '%', doc: b => Math.round(b[0] * 100 / 255) },
  '0104': { ten: 'Tải động cơ', donVi: '%', doc: b => Math.round(b[0] * 100 / 255) },
  '012F': { ten: 'Mức nhiên liệu', donVi: '%', doc: b => Math.round(b[0] * 100 / 255) },
  '0142': { ten: 'Điện áp hệ thống', donVi: 'V', doc: b => Math.round((b[0] * 256 + b[1]) / 100) / 10 }
};

export const LENH_KHOI_TAO = ['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATSP0'];

/** Bỏ khoảng trắng, dấu nhắc ">" và các dòng thông báo của ELM327; trả về các dòng dữ liệu (chữ hoa). */
export function lamSach(chuoi) {
  return String(chuoi || '').toUpperCase().replace(/>/g, '').split(/[\r\n]+/)
    .map(d => d.trim()).filter(d => d && !/^(SEARCHING|BUS INIT|OK$|ELM327|\?)/.test(d))
    .map(d => d.replace(/^\d:/, '').replace(/\s+/g, ''));
}

/** Phản hồi báo lỗi của ELM327 (không có dữ liệu, không kết nối được ECU…), null nếu không lỗi. */
export function loiElm(chuoi) {
  const s = String(chuoi || '').toUpperCase();
  if (/NO ?DATA/.test(s)) return 'Xe không trả lời thông số này';
  if (/UNABLE TO CONNECT|BUS ?ERROR|CAN ERROR|BUS INIT:? ?\.*ERROR/.test(s)) return 'Không kết nối được với ECU (bật khoá điện / nổ máy)';
  if (/STOPPED/.test(s)) return 'Bị ngắt giữa chừng';
  if (/^\s*\?\s*>?\s*$/.test(s)) return 'Bộ chuyển không hiểu lệnh';
  return null;
}

/** Byte dữ liệu của phản hồi chế độ 01 cho pid ("010C" → tìm "410C…"), null nếu không có. */
export function byteDuLieu(lenh, chuoi) {
  const tim = '4' + lenh.slice(1);
  for (const d of lamSach(chuoi)) {
    const i = d.indexOf(tim);
    if (i < 0) continue;
    const hex = d.slice(i + tim.length);
    const b = [];
    for (let j = 0; j + 1 < hex.length; j += 2) b.push(parseInt(hex.slice(j, j + 2), 16));
    if (b.length && b.every(x => !isNaN(x))) return b;
  }
  return null;
}

/** Giá trị của một thông số từ phản hồi, null nếu không đọc được. */
export function docThongSo(lenh, chuoi) {
  if (lenh === 'ATRV') {
    const m = /(\d+(?:\.\d+)?)\s*V/i.exec(String(chuoi));
    return m ? +m[1] : null;
  }
  const ts = THONG_SO[lenh];
  const b = byteDuLieu(lenh, chuoi);
  if (!ts || !b || b.length < (lenh === '010C' || lenh === '0142' ? 2 : 1)) return null;
  return ts.doc(b);
}

/** Các PID được xe hỗ trợ từ phản hồi "0100" / "0120" / "0140" (mặt nạ 32 bit). */
export function pidHoTro(lenh, chuoi) {
  const b = byteDuLieu(lenh, chuoi);
  const ds = new Set();
  if (!b || b.length < 4) return ds;
  const goc = parseInt(lenh.slice(2), 16);
  for (let i = 0; i < 32; i++) {
    if (b[i >> 3] & (0x80 >> (i & 7))) ds.add('01' + (goc + i + 1).toString(16).toUpperCase().padStart(2, '0'));
  }
  return ds;
}

/** Hai byte → mã lỗi chuẩn (vd. 0x01 0x33 → "P0133"). */
export function maLoi(b1, b2) {
  return 'PCBU'[b1 >> 6] + ((b1 >> 4) & 3) + (b1 & 15).toString(16).toUpperCase() + b2.toString(16).toUpperCase().padStart(2, '0');
}

/** Danh sách mã lỗi từ phản hồi chế độ 03. CAN có thêm byte số lượng sau "43". */
export function docMaLoi(chuoi) {
  const kq = [];
  for (const d of lamSach(chuoi)) {
    const i = d.indexOf('43');
    if (i < 0) continue;
    let hex = d.slice(i + 2);
    if ((hex.length / 2) % 2 === 1) hex = hex.slice(2);        // CAN: bỏ byte số lượng mã lỗi
    for (let j = 0; j + 3 < hex.length; j += 4) {
      const b1 = parseInt(hex.slice(j, j + 2), 16), b2 = parseInt(hex.slice(j + 2, j + 4), 16);
      if (isNaN(b1) || isNaN(b2) || (b1 === 0 && b2 === 0)) continue;
      const ma = maLoi(b1, b2);
      if (!kq.includes(ma)) kq.push(ma);
    }
  }
  return kq;
}

/** Số khung (VIN) từ phản hồi "0902" (nhiều dòng). */
export function docVin(chuoi) {
  let hex = '';
  for (const d of lamSach(chuoi)) {
    const i = d.indexOf('4902');
    // dòng đầu "49 02 01 …" (bỏ số thứ tự), các dòng tiếp theo của CAN chỉ có dữ liệu
    hex += i >= 0 ? d.slice(i + 6) : /^[0-9A-F]+$/.test(d) && d.length > 3 ? d : '';
  }
  let s = '';
  for (let j = 0; j + 1 < hex.length; j += 2) {
    const c = parseInt(hex.slice(j, j + 2), 16);
    if (c >= 0x30 && c <= 0x5a) s += String.fromCharCode(c);
  }
  return s.length >= 17 ? s.slice(-17) : null;
}

/**
 * Phiên làm việc với ELM327: gửi từng lệnh, chờ dấu nhắc ">" rồi mới gửi lệnh sau.
 * cong: { ghi(chuoi) } — dữ liệu nhận được thì gọi phien.nhan(chuoi).
 */
export class PhienElm {
  constructor(cong) {
    this.cong = cong;
    this.dem = '';
    this.cho = null;
    this.hang = Promise.resolve();
  }

  nhan(chuoi) {
    this.dem += chuoi;
    if (!this.cho || !this.dem.includes('>')) return;
    const kq = this.dem.slice(0, this.dem.indexOf('>'));
    this.dem = this.dem.slice(this.dem.indexOf('>') + 1);
    const c = this.cho;
    this.cho = null;
    clearTimeout(c.hen);
    c.ok(kq);
  }

  /** Gửi lệnh, trả về phản hồi (không kèm dấu nhắc). */
  lenh(lenh, thoiGian = 4000) {
    const viec = this.hang.then(() => new Promise((ok, loi) => {
      this.dem = '';
      this.cho = { ok, hen: setTimeout(() => { this.cho = null; loi(new Error('Bộ chuyển OBD không trả lời lệnh ' + lenh)); }, thoiGian) };
      Promise.resolve(this.cong.ghi(lenh + '\r')).catch(e => { clearTimeout(this.cho && this.cho.hen); this.cho = null; loi(e); });
    }));
    this.hang = viec.catch(() => {});
    return viec;
  }

  huy(loi = new Error('Đã ngắt kết nối')) {
    if (this.cho) { clearTimeout(this.cho.hen); this.cho = null; }
    this.hang = Promise.reject(loi);
    this.hang.catch(() => {});
  }
}

/** Đọc thông số xe định kỳ. baoDoi(giaTri) gọi sau mỗi vòng đọc. */
export class DocXe {
  constructor(phien, { baoDoi, chuKy = 1000 } = {}) {
    this.phien = phien;
    this.baoDoi = baoDoi;
    this.chuKy = chuKy;
    this.giaTri = {};
    this.hoTro = null;
    this.chay = false;
  }

  async khoiTao() {
    for (const l of LENH_KHOI_TAO) await this.phien.lenh(l, l === 'ATZ' ? 5000 : 3000);
    const hoTro = new Set();
    for (const l of ['0100', '0120', '0140']) {
      let r;
      try { r = await this.phien.lenh(l, 8000); } catch (e) { break; }      // lần đầu ELM327 còn dò giao thức
      const loi = loiElm(r);
      if (loi) { if (l === '0100') throw new Error(loi); break; }
      const ds = pidHoTro(l, r);
      ds.forEach(x => hoTro.add(x));
      if (!ds.has('01' + (parseInt(l.slice(2), 16) + 0x20).toString(16).toUpperCase().padStart(2, '0'))) break;
    }
    this.hoTro = hoTro;
    return hoTro;
  }

  /** Các lệnh đọc trong một vòng: thông số xe hỗ trợ, điện áp ắc quy (ATRV) mỗi 5 vòng. */
  lenhVong(vong) {
    const ds = Object.keys(THONG_SO).filter(l => !this.hoTro || this.hoTro.has(l));
    if (vong % 5 === 0) ds.push('ATRV');
    return ds;
  }

  async docMotVong(vong = 0) {
    for (const l of this.lenhVong(vong)) {
      if (!this.chay && vong > 0) return;
      const r = await this.phien.lenh(l);
      const v = docThongSo(l, r);
      if (v != null) this.giaTri[l] = v;
    }
    this.giaTri.luc = Date.now();
    if (this.baoDoi) this.baoDoi(this.giaTri);
  }

  async batDau() {
    this.chay = true;
    for (let vong = 0; this.chay; vong++) {
      const t0 = Date.now();
      try { await this.docMotVong(vong); } catch (e) { if (!this.chay) return; throw e; }
      await new Promise(ok => setTimeout(ok, Math.max(0, this.chuKy - (Date.now() - t0))));
    }
  }

  dung() { this.chay = false; }

  async docLoi() {
    const r = await this.phien.lenh('03', 8000);
    if (/NO ?DATA/i.test(r)) return [];
    const loi = loiElm(r);
    if (loi) throw new Error(loi);
    return docMaLoi(r);
  }

  async xoaLoi() {
    const r = await this.phien.lenh('04', 8000);
    if (!/44/.test(r.replace(/\s/g, ''))) throw new Error(loiElm(r) || 'Xe không nhận lệnh xoá mã lỗi');
  }

  async docVin() {
    try { return docVin(await this.phien.lenh('0902', 8000)); } catch (e) { return null; }
  }
}

// ------------------------------------------------------------------ cổng kết nối
const DICH_VU_BLE = [0xfff0, 0xffe0, 0x18f0, 'e7810a71-73ae-499d-8c15-faa9aef0c3f2'];

/** ELM327 Bluetooth LE qua Web Bluetooth (Chrome, Edge trên Android / máy tính). */
export class CongBle {
  static hoTro() { return typeof navigator !== 'undefined' && !!navigator.bluetooth; }

  async ketNoi(nhan, khiNgat) {
    this.thietBi = await navigator.bluetooth.requestDevice({
      filters: [...DICH_VU_BLE.map(s => ({ services: [s] })), { namePrefix: 'OBD' }, { namePrefix: 'V-LINK' }, { namePrefix: 'IOS-Vlink' }, { namePrefix: 'VEEPEAK' }],
      optionalServices: DICH_VU_BLE
    });
    this.thietBi.addEventListener('gattserverdisconnected', () => khiNgat && khiNgat());
    const gatt = await this.thietBi.gatt.connect();
    let doc = null, ghi = null;
    for (const s of await gatt.getPrimaryServices()) {
      let ds;
      try { ds = await s.getCharacteristics(); } catch (e) { continue; }
      for (const c of ds) {
        if (!doc && (c.properties.notify || c.properties.indicate)) doc = c;
        if (!ghi && (c.properties.write || c.properties.writeWithoutResponse)) ghi = c;
      }
      if (doc && ghi) break;
    }
    if (!doc || !ghi) throw new Error('Thiết bị này không phải bộ chuyển ELM327');
    const giaiMa = new TextDecoder();
    doc.addEventListener('characteristicvaluechanged', e => nhan(giaiMa.decode(e.target.value)));
    await doc.startNotifications();
    this.ghiDacTinh = ghi;
    return this.thietBi.name || 'ELM327';
  }

  ghi(chuoi) {
    const du = new TextEncoder().encode(chuoi);
    return this.ghiDacTinh.properties.writeWithoutResponse ? this.ghiDacTinh.writeValueWithoutResponse(du) : this.ghiDacTinh.writeValue(du);
  }

  ngat() { try { if (this.thietBi && this.thietBi.gatt.connected) this.thietBi.gatt.disconnect(); } catch (e) { /* đã ngắt */ } }
}

/** ELM327 Bluetooth thường qua ứng dụng Android (người dùng chọn thiết bị đã ghép đôi trong hộp thoại của Android). */
export class CongGoc {
  constructor(guiGoc) { this.guiGoc = guiGoc; }

  ketNoi(nhan, khiNgat) {
    this.nhan = nhan;
    this.khiNgat = khiNgat;
    return new Promise((ok, loi) => {
      this.cho = { ok, loi };
      this.guiGoc('obdKetNoi', {});
    });
  }

  /** Ứng dụng gốc báo về: loai = 'ketNoi' (du = tên) | 'loi' (du = thông báo) | 'nhan' (du = chữ) | 'ngat'. */
  suKien(loai, du) {
    if (loai === 'nhan') { if (this.nhan) this.nhan(du); return; }
    if (loai === 'ketNoi' && this.cho) { this.cho.ok(du || 'ELM327'); this.cho = null; return; }
    if (loai === 'loi' && this.cho) { this.cho.loi(new Error(du || 'Không kết nối được')); this.cho = null; return; }
    if (loai === 'ngat' && this.khiNgat) this.khiNgat();
  }

  ghi(chuoi) { this.guiGoc('obdGui', { chuoi }); }

  ngat() { this.guiGoc('obdNgat', {}); }
}
