/* Ghi lại hành trình đã đi (quãng đường, thời gian, tốc độ) và xuất file GPX. */
import { doc, ghi } from './kho.js';
import { khoangCach, donGian } from './hinh-hoc.js';

const KHOA = 'hanhtrinh';

export class GhiHanhTrinh {
  constructor() { this.dangGhi = false; }

  batDau(ten = '') {
    this.dangGhi = true;
    this.ten = ten;
    this.diem = [];
    this.thoiDiem = [];
    this.batDauLuc = Date.now();
    this.quangDuong = 0;
    this.tocDoMax = 0;
    this.tgDiChuyen = 0;
    this.lucTruoc = null;
  }

  them(vt) {
    if (!this.dangGhi || (vt.doChinhXac && vt.doChinhXac > 60)) return;
    const kmh = (vt.tocDo || 0) * 3.6;
    if (this.lucTruoc && kmh > 2) this.tgDiChuyen += Math.min(10, (vt.thoiGian - this.lucTruoc) / 1000);
    this.lucTruoc = vt.thoiGian;
    if (kmh > this.tocDoMax) this.tocDoMax = kmh;
    const p = vt.viTri, cuoi = this.diem[this.diem.length - 1];
    if (cuoi) {
      const d = khoangCach(cuoi, p);
      if (d < 8 || d > 3000) return;
      this.quangDuong += d;
    }
    this.diem.push([+p[0].toFixed(6), +p[1].toFixed(6)]);
    this.thoiDiem.push(vt.thoiGian);
  }

  /** Dừng ghi; lưu lại nếu đi được trên 300 m. Trả về hành trình đã lưu hoặc null. */
  ketThuc(tenDen) {
    if (!this.dangGhi) return null;
    this.dangGhi = false;
    if (this.quangDuong < 300 || this.diem.length < 2) return null;
    const ketThucLuc = Date.now();
    const ht = {
      id: 'ht' + this.batDauLuc.toString(36),
      ten: tenDen || this.ten || 'Hành trình',
      batDau: this.batDauLuc, ketThuc: ketThucLuc,
      quangDuong: Math.round(this.quangDuong),
      thoiGian: Math.round((ketThucLuc - this.batDauLuc) / 1000),
      tocDoMax: Math.round(this.tocDoMax),
      tocDoTB: this.tgDiChuyen > 0 ? Math.round(this.quangDuong / this.tgDiChuyen * 3.6) : 0,
      toaDo: donGian(this.diem, 6)
    };
    const ds = danhSachHanhTrinh();
    ds.unshift(ht);
    // giữ tối đa 100 hành trình; bộ nhớ đầy thì bỏ bớt hành trình cũ
    let giu = ds.slice(0, 100);
    while (!ghi(KHOA, giu) && giu.length > 1) giu = giu.slice(0, Math.ceil(giu.length / 2));
    return ht;
  }
}

export function danhSachHanhTrinh() { return doc(KHOA, []); }

export function xoaHanhTrinh(id) { ghi(KHOA, danhSachHanhTrinh().filter(h => h.id !== id)); }

export function tongKet() {
  const ds = danhSachHanhTrinh();
  return { so: ds.length, quangDuong: ds.reduce((a, h) => a + h.quangDuong, 0), thoiGian: ds.reduce((a, h) => a + h.thoiGian, 0) };
}

export function xuatGpx(ht) {
  const esc = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
  const diem = ht.toaDo.map(p => `      <trkpt lat="${p[1]}" lon="${p[0]}"/>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="HawaMap" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${esc(ht.ten)}</name><time>${new Date(ht.batDau).toISOString()}</time></metadata>
  <trk>
    <name>${esc(ht.ten)}</name>
    <trkseg>
${diem}
    </trkseg>
  </trk>
</gpx>
`;
}
