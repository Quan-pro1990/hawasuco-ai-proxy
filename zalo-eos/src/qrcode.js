'use strict';
// Tạo mã QR (chế độ byte, mức sửa lỗi M) và xuất ảnh PNG — không cần thư viện ngoài.
// Thuật toán theo chuẩn ISO/IEC 18004, cách tổ chức theo thư viện QR Code generator của Project Nayuki (MIT).
const zlib = require('zlib');

// Mức sửa lỗi M, chỉ số = phiên bản (1..40)
const ECC_MOI_KHOI = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26,
  26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
const SO_KHOI = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16,
  17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];
const BIT_DINH_DANG_M = 0;

function soModuleDuLieu(pb) {
  let kq = (16 * pb + 128) * pb + 64;
  if (pb >= 2) {
    const n = Math.floor(pb / 7) + 2;
    kq -= (25 * n - 10) * n - 55;
    if (pb >= 7) kq -= 36;
  }
  return kq;
}

function soCodewordDuLieu(pb) {
  return Math.floor(soModuleDuLieu(pb) / 8) - ECC_MOI_KHOI[pb] * SO_KHOI[pb];
}

// ------------------------------------------------------------------ Reed-Solomon trên GF(2^8)

function nhanGF(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function daThucSinh(bac) {
  const kq = new Array(bac).fill(0);
  kq[bac - 1] = 1;
  let goc = 1;
  for (let i = 0; i < bac; i++) {
    for (let j = 0; j < kq.length; j++) {
      kq[j] = nhanGF(kq[j], goc);
      if (j + 1 < kq.length) kq[j] ^= kq[j + 1];
    }
    goc = nhanGF(goc, 0x02);
  }
  return kq;
}

function phanDu(duLieu, sinh) {
  const kq = sinh.map(() => 0);
  for (const b of duLieu) {
    const heSo = b ^ kq.shift();
    kq.push(0);
    sinh.forEach((c, i) => { kq[i] ^= nhanGF(c, heSo); });
  }
  return kq;
}

function themEccVaXenKe(duLieu, pb) {
  const soKhoi = SO_KHOI[pb];
  const eccLen = ECC_MOI_KHOI[pb];
  const tongCodeword = Math.floor(soModuleDuLieu(pb) / 8);
  const soKhoiNgan = soKhoi - (tongCodeword % soKhoi);
  const doDaiNgan = Math.floor(tongCodeword / soKhoi);
  const sinh = daThucSinh(eccLen);
  const khoi = [];
  for (let i = 0, k = 0; i < soKhoi; i++) {
    const d = duLieu.slice(k, k + doDaiNgan - eccLen + (i < soKhoiNgan ? 0 : 1));
    k += d.length;
    const ecc = phanDu(d, sinh);
    if (i < soKhoiNgan) d.push(0);
    khoi.push(d.concat(ecc));
  }
  const kq = [];
  for (let i = 0; i < khoi[0].length; i++) {
    khoi.forEach((b, j) => {
      if (i !== doDaiNgan - eccLen || j >= soKhoiNgan) kq.push(b[i]);
    });
  }
  return kq;
}

// ------------------------------------------------------------------ ma trận

class MaTran {
  constructor(pb) {
    this.pb = pb;
    this.n = pb * 4 + 17;
    this.o = Array.from({ length: this.n }, () => new Array(this.n).fill(false));
    this.coDinh = Array.from({ length: this.n }, () => new Array(this.n).fill(false));
  }

  dat(x, y, den) { this.o[y][x] = den; this.coDinh[y][x] = true; }

  veMauCoDinh() {
    const n = this.n;
    for (let i = 0; i < n; i++) { this.dat(6, i, i % 2 === 0); this.dat(i, 6, i % 2 === 0); }
    this.veTimVi(3, 3);
    this.veTimVi(n - 4, 3);
    this.veTimVi(3, n - 4);
    const vt = this.viTriCanLe();
    const m = vt.length;
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < m; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === m - 1) || (i === m - 1 && j === 0)) continue;
        this.veCanLe(vt[i], vt[j]);
      }
    }
    this.veDinhDang(0);
    this.vePhienBan();
  }

  veTimVi(x, y) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && xx < this.n && yy >= 0 && yy < this.n) this.dat(xx, yy, d !== 2 && d !== 4);
      }
    }
  }

  veCanLe(x, y) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) this.dat(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }

  viTriCanLe() {
    if (this.pb === 1) return [];
    const m = Math.floor(this.pb / 7) + 2;
    const buoc = Math.floor((this.pb * 8 + m * 3 + 5) / (m * 4 - 4)) * 2;
    const kq = [6];
    for (let p = this.n - 7; kq.length < m; p -= buoc) kq.splice(1, 0, p);
    return kq;
  }

  veDinhDang(mat) {
    const d = (BIT_DINH_DANG_M << 3) | mat;
    let r = d;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412;
    const bit = i => ((b >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) this.dat(8, i, bit(i));
    this.dat(8, 7, bit(6));
    this.dat(8, 8, bit(7));
    this.dat(7, 8, bit(8));
    for (let i = 9; i < 15; i++) this.dat(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) this.dat(this.n - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) this.dat(8, this.n - 15 + i, bit(i));
    this.dat(8, this.n - 8, true);
  }

  vePhienBan() {
    if (this.pb < 7) return;
    let r = this.pb;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const b = (this.pb << 12) | r;
    for (let i = 0; i < 18; i++) {
      const den = ((b >>> i) & 1) !== 0;
      const a = this.n - 11 + (i % 3);
      const c = Math.floor(i / 3);
      this.dat(a, c, den);
      this.dat(c, a, den);
    }
  }

  datDuLieu(cw) {
    let i = 0;
    for (let phai = this.n - 1; phai >= 1; phai -= 2) {
      if (phai === 6) phai = 5;
      for (let doc = 0; doc < this.n; doc++) {
        for (let j = 0; j < 2; j++) {
          const x = phai - j;
          const len = ((phai + 1) & 2) === 0;
          const y = len ? this.n - 1 - doc : doc;
          if (!this.coDinh[y][x] && i < cw.length * 8) {
            this.o[y][x] = ((cw[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
            i++;
          }
        }
      }
    }
  }

  apMat(mat) {
    for (let y = 0; y < this.n; y++) {
      for (let x = 0; x < this.n; x++) {
        let dao;
        switch (mat) {
          case 0: dao = (x + y) % 2 === 0; break;
          case 1: dao = y % 2 === 0; break;
          case 2: dao = x % 3 === 0; break;
          case 3: dao = (x + y) % 3 === 0; break;
          case 4: dao = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: dao = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: dao = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          default: dao = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
        }
        if (dao && !this.coDinh[y][x]) this.o[y][x] = !this.o[y][x];
      }
    }
  }

  /** Điểm phạt theo chuẩn: mặt nạ có điểm thấp nhất dễ quét nhất. */
  diemPhat() {
    const n = this.n;
    const o = this.o;
    let p = 0;
    const dong = [];
    for (let y = 0; y < n; y++) dong.push(o[y].map(v => (v ? '1' : '0')).join(''));
    for (let x = 0; x < n; x++) dong.push(o.map(r => (r[x] ? '1' : '0')).join(''));
    for (const s of dong) {
      for (const m of s.match(/0{5,}|1{5,}/g) || []) p += m.length - 2;
      for (const mau of ['10111010000', '00001011101']) {
        for (let i = s.indexOf(mau); i >= 0; i = s.indexOf(mau, i + 1)) p += 40;
      }
    }
    let den = 0;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (o[y][x]) den++;
        if (x < n - 1 && y < n - 1 && o[y][x] === o[y][x + 1] && o[y][x] === o[y + 1][x] && o[y][x] === o[y + 1][x + 1]) p += 3;
      }
    }
    const tong = n * n;
    p += (Math.ceil(Math.abs(den * 20 - tong * 10) / tong) - 1) * 10;
    return p;
  }
}

/** Chuỗi → ma trận QR (mảng 2 chiều true = ô đen). */
function taoQr(chuoi) {
  const bytes = Buffer.from(String(chuoi), 'utf8');
  let pb = 1;
  for (; pb <= 40; pb++) {
    const bitDem = pb <= 9 ? 8 : 16;
    if (4 + bitDem + bytes.length * 8 <= soCodewordDuLieu(pb) * 8) break;
  }
  if (pb > 40) throw new Error('Dữ liệu quá dài để tạo mã QR');

  const bit = [];
  const them = (v, n) => { for (let i = n - 1; i >= 0; i--) bit.push((v >>> i) & 1); };
  them(0b0100, 4);
  them(bytes.length, pb <= 9 ? 8 : 16);
  for (const b of bytes) them(b, 8);
  const sucChua = soCodewordDuLieu(pb) * 8;
  them(0, Math.min(4, sucChua - bit.length));
  them(0, (8 - (bit.length % 8)) % 8);
  for (let dem = 0xec; bit.length < sucChua; dem ^= 0xec ^ 0x11) them(dem, 8);
  const cw = [];
  for (let i = 0; i < bit.length; i += 8) cw.push(parseInt(bit.slice(i, i + 8).join(''), 2));

  const mt = new MaTran(pb);
  mt.veMauCoDinh();
  mt.datDuLieu(themEccVaXenKe(cw, pb));
  let tot = 0;
  let diemTot = Infinity;
  for (let mat = 0; mat < 8; mat++) {
    mt.apMat(mat);
    mt.veDinhDang(mat);
    const d = mt.diemPhat();
    if (d < diemTot) { diemTot = d; tot = mat; }
    mt.apMat(mat);   // áp lại = gỡ mặt nạ
  }
  mt.apMat(tot);
  mt.veDinhDang(tot);
  return mt.o;
}

// ------------------------------------------------------------------ PNG đen trắng

const BANG_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = BANG_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function khoiPng(loai, duLieu) {
  const dai = Buffer.alloc(4);
  dai.writeUInt32BE(duLieu.length);
  const td = Buffer.concat([Buffer.from(loai, 'latin1'), duLieu]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([dai, td, crc]);
}

/** Ma trận QR → PNG xám 8 bit; tiLe = số điểm ảnh mỗi ô, vien = số ô trắng quanh mã (chuẩn ≥ 4). */
function maTranPng(o, { tiLe = 8, vien = 4 } = {}) {
  const n = o.length;
  const canh = (n + vien * 2) * tiLe;
  const dong = Buffer.alloc(canh + 1);
  const anh = [];
  for (let py = 0; py < canh; py++) {
    const y = Math.floor(py / tiLe) - vien;
    dong.fill(255);
    dong[0] = 0;   // bộ lọc dòng: None
    if (y >= 0 && y < n) {
      for (let x = 0; x < n; x++) {
        if (o[y][x]) dong.fill(0, 1 + (x + vien) * tiLe, 1 + (x + vien + 1) * tiLe);
      }
    }
    anh.push(Buffer.from(dong));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(canh, 0);
  ihdr.writeUInt32BE(canh, 4);
  ihdr[8] = 8;    // 8 bit
  ihdr[9] = 0;    // ảnh xám
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    khoiPng('IHDR', ihdr),
    khoiPng('IDAT', zlib.deflateSync(Buffer.concat(anh), { level: 9 })),
    khoiPng('IEND', Buffer.alloc(0)),
  ]);
}

function taoQrPng(chuoi, tuyChon) { return maTranPng(taoQr(chuoi), tuyChon); }

module.exports = { taoQr, taoQrPng, maTranPng, crc32 };
