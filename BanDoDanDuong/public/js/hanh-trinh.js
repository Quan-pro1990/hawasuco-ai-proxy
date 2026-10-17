/* Ghi lại hành trình đã đi (quãng đường, thời gian, tốc độ, biểu đồ tốc độ, số lần vượt tốc độ) và xuất file GPX. */
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
    this.mau = [];            // biểu đồ tốc độ: [giây từ lúc bắt đầu, km/h trung bình 10 giây]
    this.tongMau = 0;
    this.demMau = 0;
    this.mocMau = this.batDauLuc;
    this.soLanVuot = 0;
    this.tgVuot = 0;
    this.vuotTruoc = false;
  }

  /** @param o.vuotToc  lúc này đang vượt giới hạn tốc độ (từ CanhBao) */
  them(vt, { vuotToc = false } = {}) {
    if (!this.dangGhi || (vt.doChinhXac && vt.doChinhXac > 60)) return;
    const kmh = (vt.tocDo || 0) * 3.6;
    const dt = this.lucTruoc ? Math.min(10, (vt.thoiGian - this.lucTruoc) / 1000) : 0;
    if (kmh > 2) this.tgDiChuyen += dt;
    if (vuotToc) { this.tgVuot += dt; if (!this.vuotTruoc) this.soLanVuot++; }
    this.vuotTruoc = vuotToc;
    this.lucTruoc = vt.thoiGian;
    if (kmh > this.tocDoMax) this.tocDoMax = kmh;
    this.tongMau += kmh;
    this.demMau++;
    if (vt.thoiGian - this.mocMau >= 10000) {
      this.mau.push([Math.round((vt.thoiGian - this.batDauLuc) / 1000), Math.round(this.tongMau / this.demMau)]);
      this.tongMau = 0;
      this.demMau = 0;
      this.mocMau = vt.thoiGian;
    }
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
      tgDung: Math.max(0, Math.round((ketThucLuc - this.batDauLuc) / 1000 - this.tgDiChuyen)),
      soLanVuot: this.soLanVuot, tgVuot: Math.round(this.tgVuot),
      bieuDo: rutGonMau(this.mau, 240),
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

/** Giảm số mẫu còn tối đa `toiDa` điểm (gộp các mẫu liền nhau, lấy trung bình). */
export function rutGonMau(mau, toiDa) {
  if (mau.length <= toiDa) return mau.slice();
  const kq = [];
  const nhom = mau.length / toiDa;
  for (let i = 0; i < toiDa; i++) {
    const phan = mau.slice(Math.floor(i * nhom), Math.floor((i + 1) * nhom));
    if (!phan.length) continue;
    kq.push([phan[phan.length - 1][0], Math.round(phan.reduce((t, m) => t + m[1], 0) / phan.length)]);
  }
  return kq;
}

/** Biểu đồ tốc độ theo thời gian (SVG), '' nếu chưa đủ dữ liệu. */
export function svgBieuDoTocDo(bieuDo, { rong = 320, cao = 120 } = {}) {
  if (!bieuDo || bieuDo.length < 2) return '';
  const trai = 30, duoi = 18, tren = 8;
  const tMax = bieuDo[bieuDo.length - 1][0] || 1;
  const vMax = Math.max(20, Math.ceil(Math.max(...bieuDo.map(m => m[1])) / 20) * 20);
  const x = t => +(trai + t / tMax * (rong - trai - 4)).toFixed(1);
  const y = v => +(tren + (1 - v / vMax) * (cao - tren - duoi)).toFixed(1);
  const duong = bieuDo.map(m => `${x(m[0])},${y(m[1])}`).join(' ');
  const luoi = [0, vMax / 2, vMax].map(v => `<line x1="${trai}" x2="${rong - 4}" y1="${y(v)}" y2="${y(v)}" class="bd-luoi"/>` +
    `<text x="${trai - 4}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('');
  const phut = Math.round(tMax / 60);
  return `<svg class="bieu-do" viewBox="0 0 ${rong} ${cao}" role="img" aria-label="Biểu đồ tốc độ theo thời gian">${luoi}` +
    `<polygon points="${x(bieuDo[0][0])},${y(0)} ${duong} ${x(tMax)},${y(0)}" class="bd-nen"/><polyline points="${duong}" class="bd-duong"/>` +
    `<text x="${trai}" y="${cao - 3}">0</text><text x="${rong - 4}" y="${cao - 3}" text-anchor="end">${phut} phút</text>` +
    `<text x="${trai + 4}" y="${tren + 10}" class="bd-don-vi">km/h</text></svg>`;
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
