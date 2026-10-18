/*
 * Đóng gói HawaMap để đưa lên máy chủ IIS: chỉ gồm những tệp máy chủ cần (không có kiểm thử, ứng dụng Android / iOS).
 *   npm run dong-goi-iis              → dist/hawamap-iis/
 *   node tools/dong-goi-iis.mjs <thư mục đích>
 * Chép thư mục kết quả lên máy chủ rồi chạy (PowerShell quyền Administrator):
 *   powershell -ExecutionPolicy Bypass -File .\trien-khai\iis\cai-dat-iis.ps1 -TenMien bando.congty.vn
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GOC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEP = ['server.js', 'kho-giao-thong.js', 'package.json', 'ChayBanDo.bat', 'README.md'];
const THU_MUC = ['public', 'trien-khai/iis'];

export function dongGoi(dich = path.join(GOC, 'dist', 'hawamap-iis')) {
  fs.rmSync(dich, { recursive: true, force: true });
  fs.mkdirSync(dich, { recursive: true });
  for (const t of TEP) fs.copyFileSync(path.join(GOC, t), path.join(dich, t));
  for (const d of THU_MUC) fs.cpSync(path.join(GOC, d), path.join(dich, d), { recursive: true });
  return dich;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dich = dongGoi(process.argv[2] ? path.resolve(process.argv[2]) : undefined);
  let kichThuoc = 0, so = 0;
  const dem = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) dem(p); else { so++; kichThuoc += fs.statSync(p).size; } } };
  dem(dich);
  console.log(`Đã đóng gói ${so} tệp (${(kichThuoc / 1048576).toFixed(1)} MB) vào ${dich}`);
  console.log('Chép thư mục này lên máy chủ Windows rồi chạy trong PowerShell (Run as administrator):');
  console.log('  powershell -ExecutionPolicy Bypass -File .\\trien-khai\\iis\\cai-dat-iis.ps1 -TenMien <tên miền>');
}
