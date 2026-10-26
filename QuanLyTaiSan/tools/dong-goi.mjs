/*
 * Đóng gói máy chủ Quản lý tài sản thành một tệp .zip để đưa lên máy chủ Windows (IIS) — cùng kiểu gói máy chủ HawaMap:
 * chương trình QuanLyTaiSan.exe, trình cài đặt nhấp đúp CAI-DAT-MAY-CHU.bat, thư mục trien-khai (script IIS, tiện ích)
 * và hướng dẫn từng bước HUONG-DAN-CAI-DAT.html (chuyển từ trien-khai/HUONG_DAN_MAY_CHU.md).
 *   node tools/dong-goi.mjs              → tạo lại HUONG-DAN-CAI-DAT.html, dist/quanlytaisan-may-chu/ và dist/quanlytaisan-may-chu-<phiên bản>.zip
 *   node tools/dong-goi.mjs --chi-html   → chỉ tạo lại HUONG-DAN-CAI-DAT.html
 * (build.sh gọi sau khi biên dịch; trên Windows build.ps1 tự đóng gói, dùng HUONG-DAN-CAI-DAT.html có sẵn.)
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { mdSangHtml } from './md-html.mjs';

const GOC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEP = ['CAI-DAT-MAY-CHU.bat', 'HUONG-DAN-CAI-DAT.html', 'QuanLyTaiSan.exe'];
const THU_MUC = ['trien-khai'];

/** Phiên bản phần mềm (UngDung.PhienBan trong src/MoHinh.cs). */
export function phienBan() {
  const m = /PhienBan\s*=\s*"([^"]+)"/.exec(fs.readFileSync(path.join(GOC, 'src', 'MoHinh.cs'), 'utf8'));
  if (!m) throw new Error('Không đọc được phiên bản trong src/MoHinh.cs');
  return m[1];
}

export function taoHuongDan() {
  const md = fs.readFileSync(path.join(GOC, 'trien-khai', 'HUONG_DAN_MAY_CHU.md'), 'utf8');
  fs.writeFileSync(path.join(GOC, 'HUONG-DAN-CAI-DAT.html'), mdSangHtml(md));
}

export function dongGoi(dich = path.join(GOC, 'dist', 'quanlytaisan-may-chu')) {
  taoHuongDan();
  fs.rmSync(dich, { recursive: true, force: true });
  fs.mkdirSync(dich, { recursive: true });
  for (const t of TEP) fs.copyFileSync(path.join(GOC, t), path.join(dich, t));
  for (const d of THU_MUC) fs.cpSync(path.join(GOC, d), path.join(dich, d), { recursive: true });
  return dich;
}

/** Các tệp trong thư mục (đường dẫn tương đối, dấu "/"), xếp theo tên. */
export function dsTep(thuMuc, con = '') {
  const ds = [];
  for (const e of fs.readdirSync(path.join(thuMuc, con), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = con ? `${con}/${e.name}` : e.name;
    if (e.isDirectory()) ds.push(...dsTep(thuMuc, p));
    else if (e.isFile()) ds.push(p);
  }
  return ds;
}

const BANG_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const x of buf) c = BANG_CRC[(c ^ x) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Nén thư mục thành tệp .zip (định dạng ZIP chuẩn, nén deflate) — tệp nằm ngay gốc tệp zip, nên "Extract All" của
 * Windows tạo đúng một thư mục mang tên tệp zip.
 */
export function taoZip(thuMuc, tepZip) {
  const phan = [], muc = [];
  let viTri = 0;
  const ds = dsTep(thuMuc);
  for (const ten of ds) {
    const du = fs.readFileSync(path.join(thuMuc, ten));
    const nen = zlib.deflateRawSync(du, { level: 9 });
    const cach = nen.length < du.length ? 8 : 0;                 // 8 = deflate, 0 = để nguyên
    const than = cach ? nen : du;
    const t = fs.statSync(path.join(thuMuc, ten)).mtime;
    const gio = (t.getHours() << 11) | (t.getMinutes() << 5) | (t.getSeconds() >> 1);
    const ngay = ((Math.max(t.getFullYear(), 1980) - 1980) << 9) | ((t.getMonth() + 1) << 5) | t.getDate();
    const tenB = Buffer.from(ten, 'utf8');
    const crc = crc32(du);
    const dau = Buffer.alloc(30);
    dau.writeUInt32LE(0x04034b50, 0); dau.writeUInt16LE(20, 4); dau.writeUInt16LE(0x0800, 6); dau.writeUInt16LE(cach, 8);
    dau.writeUInt16LE(gio, 10); dau.writeUInt16LE(ngay, 12); dau.writeUInt32LE(crc, 14);
    dau.writeUInt32LE(than.length, 18); dau.writeUInt32LE(du.length, 22); dau.writeUInt16LE(tenB.length, 26);
    phan.push(dau, tenB, than);
    const tt = Buffer.alloc(46);
    tt.writeUInt32LE(0x02014b50, 0); tt.writeUInt16LE(20, 4); tt.writeUInt16LE(20, 6); tt.writeUInt16LE(0x0800, 8);
    tt.writeUInt16LE(cach, 10); tt.writeUInt16LE(gio, 12); tt.writeUInt16LE(ngay, 14); tt.writeUInt32LE(crc, 16);
    tt.writeUInt32LE(than.length, 20); tt.writeUInt32LE(du.length, 24); tt.writeUInt16LE(tenB.length, 28);
    tt.writeUInt32LE(viTri, 42);
    muc.push(tt, tenB);
    viTri += 30 + tenB.length + than.length;
  }
  const mucLuc = Buffer.concat(muc);
  const cuoi = Buffer.alloc(22);
  cuoi.writeUInt32LE(0x06054b50, 0); cuoi.writeUInt16LE(ds.length, 8); cuoi.writeUInt16LE(ds.length, 10);
  cuoi.writeUInt32LE(mucLuc.length, 12); cuoi.writeUInt32LE(viTri, 16);
  fs.mkdirSync(path.dirname(tepZip), { recursive: true });
  fs.writeFileSync(tepZip, Buffer.concat([...phan, mucLuc, cuoi]));
  return { so: ds.length, kichThuoc: viTri + mucLuc.length + 22 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--chi-html')) {
    taoHuongDan();
    console.log('Đã tạo HUONG-DAN-CAI-DAT.html');
  } else {
    const dich = dongGoi();
    const thuMucDist = path.dirname(dich);
    // giữ đúng 1 tệp zip (phiên bản hiện tại) trong dist/
    for (const f of fs.readdirSync(thuMucDist)) if (/^quanlytaisan-may-chu-.*\.zip$/.test(f)) fs.rmSync(path.join(thuMucDist, f));
    const tepZip = path.join(thuMucDist, `${path.basename(dich)}-${phienBan()}.zip`);
    const { so, kichThuoc } = taoZip(dich, tepZip);
    console.log(`Đã đóng gói ${so} tệp vào ${path.relative(GOC, dich)}`);
    console.log(`Tệp zip: ${path.relative(GOC, tepZip)} (${(kichThuoc / 1048576).toFixed(1)} MB)`);
  }
}
