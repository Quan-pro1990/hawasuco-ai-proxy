import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { spawn, spawnSync } from 'node:child_process';
import { dongGoi, taoZip, dsTep } from '../tools/dong-goi.mjs';
import { mdSangHtml, neo } from '../tools/md-html.mjs';

const IIS = new URL('../trien-khai/iis/', import.meta.url);
const doc = ten => fs.readFileSync(new URL(ten, IIS), 'utf8');
const GOC = new URL('../', import.meta.url);

test('cấu hình IIS: HttpPlatformHandler, reverse proxy, script cài đặt', () => {
  const hp = doc('web.config');
  assert.match(hp, /modules="httpPlatformHandler"/);
  assert.match(hp, /name="PORT" value="%HTTP_PLATFORM_PORT%"/);
  assert.match(hp, /processPath="__NODE__"/);
  assert.match(hp, /__THU_MUC__\\server\.js/);
  assert.match(hp, /name="BANDO_DULIEU" value="__DU_LIEU__"/);
  assert.match(hp, /HTTP_X_FORWARDED_FOR" value="\{REMOTE_ADDR\}"/);
  assert.match(hp, /rule name="HawaMap-HTTPS" enabled="false"/);
  const px = doc('web.config.proxy');
  assert.match(px, /url="http:\/\/127\.0\.0\.1:__CONG_NODE__\/\{R:1\}"/);
  // chuyển https không được chặn Let's Encrypt xác minh tên miền qua http
  for (const wc of [hp, px]) assert.match(wc, /input="\{REQUEST_URI\}" pattern="\^\/\\\.well-known\/acme-challenge\/" negate="true"/);
  for (const ten of ['cai-dat-iis.ps1', 'go-cai-dat-iis.ps1', 'cai-dat-nhanh.ps1']) {
    const ps = fs.readFileSync(new URL(ten, IIS));
    assert.ok(ps.every(b => b < 128), `${ten} chỉ có ký tự ASCII (PowerShell 5.1 đọc tệp không BOM theo mã ANSI)`);
  }
  for (const ten of ['CAI-DAT-MAY-CHU.bat', 'ChayBanDo.bat']) {
    const bat = fs.readFileSync(new URL(ten, GOC));
    assert.ok(bat.every(b => b < 128), ten + ' chỉ có ký tự ASCII');
    assert.ok(!/[^\r]\n/.test(bat.toString('latin1')), ten + ' xuống dòng kiểu Windows (CRLF)');
  }
  const ps = doc('cai-dat-iis.ps1');
  for (const k of ['__NODE__', '__THU_MUC__', '__DU_LIEU__', '__CONG_NODE__']) assert.ok(ps.includes(`'${k}'`), 'script thay ' + k);
  assert.match(ps, /allowedServerVariables/);
  assert.match(ps, /managedRuntimeVersion -Value ''/);
  assert.match(ps, /Get-WebBinding -Name \$TenSite -Protocol https/, 'nhận binding https do win-acme gắn');

  // trình cài nhấp đúp → cai-dat-nhanh.ps1 → cai-dat-iis.ps1; module kiểm tra đúng tên module web.config dùng
  const bat = fs.readFileSync(new URL('CAI-DAT-MAY-CHU.bat', GOC), 'utf8');
  assert.match(bat, /fltmc/);
  assert.match(bat, /-Verb RunAs/);
  assert.match(bat, /-File "%~dp0trien-khai\\iis\\cai-dat-nhanh\.ps1"/);
  const nhanh = doc('cai-dat-nhanh.ps1');
  assert.match(nhanh, /'cai-dat-iis\.ps1'/);
  assert.match(nhanh, /Module = 'httpPlatformHandler'/);
  assert.match(nhanh, /Module = 'RewriteModule'/);
  assert.match(nhanh, /https:\/\/nodejs\.org\/dist\/index\.json/);
});

test('hướng dẫn máy chủ: chuyển sang HTML, mục lục trỏ đúng tiêu đề', () => {
  const md = fs.readFileSync(new URL('../trien-khai/HUONG_DAN_MAY_CHU.md', import.meta.url), 'utf8');
  const html = mdSangHtml(md);
  assert.match(html, /<title>Hướng dẫn dựng máy chủ HawaMap cho người mới<\/title>/);
  assert.match(html, /<meta name="viewport"/);
  const id = new Set([...html.matchAll(/ id="([^"]+)"/g)].map(m => m[1]));
  const neoTrong = [...html.matchAll(/href="#([^"]+)"/g)].map(m => m[1]);
  assert.ok(neoTrong.length >= 12, 'có mục lục');
  for (const n of neoTrong) assert.ok(id.has(n), 'mục lục trỏ tới tiêu đề có thật: #' + n);
  const chu = html.replace(/<pre>[\s\S]*?<\/pre>/g, '').replace(/<code>[^<]*<\/code>/g, '');
  assert.doesNotMatch(chu, /\*\*|\]\(|^#+ |^\|/m, 'không sót cú pháp Markdown');
  assert.match(html, /<table>/);
  assert.match(html, /<ol>/);
  assert.equal(neo('1. Chuẩn bị'), '1-chuẩn-bị');
  assert.equal(neo('Phụ lục B: Tuỳ chọn `nâng cao`'), 'phụ-lục-b-tuỳ-chọn-nâng-cao');
  assert.equal(mdSangHtml('Gõ `<b>` & [x](javascript:alert(1))').includes('<b>'), false, 'thoát HTML, bỏ liên kết javascript:');
});

/** Đọc tệp zip (mục lục cuối tệp + inflate) để kiểm tra tệp do taoZip tạo. */
function docZip(buf) {
  const e = buf.length - 22;
  assert.equal(buf.readUInt32LE(e), 0x06054b50);
  const so = buf.readUInt16LE(e + 10);
  let p = buf.readUInt32LE(e + 16);
  const ra = new Map();
  for (let k = 0; k < so; k++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50);
    const cach = buf.readUInt16LE(p + 10), crc = buf.readUInt32LE(p + 16), nen = buf.readUInt32LE(p + 20);
    const dai = buf.readUInt16LE(p + 28), viTri = buf.readUInt32LE(p + 42);
    const ten = buf.toString('utf8', p + 46, p + 46 + dai);
    assert.equal(buf.readUInt32LE(viTri), 0x04034b50);
    const batDau = viTri + 30 + buf.readUInt16LE(viTri + 26) + buf.readUInt16LE(viTri + 28);
    const than = buf.subarray(batDau, batDau + nen);
    ra.set(ten, { du: cach === 8 ? zlib.inflateRawSync(than) : than, crc });
    p += 46 + dai;
  }
  return ra;
}

test('đóng gói bản IIS và chạy được máy chủ từ bản đóng gói', async () => {
  const dich = dongGoi(fs.mkdtempSync(path.join(os.tmpdir(), 'hawamap-iis-')) + '/goi');
  for (const t of ['server.js', 'kho-giao-thong.js', 'package.json', 'public/index.html', 'public/js/main.js', 'public/du-lieu/phi-cao-toc.json',
    'trien-khai/iis/web.config', 'trien-khai/iis/cai-dat-iis.ps1', 'trien-khai/iis/cai-dat-nhanh.ps1', 'trien-khai/HUONG_DAN_MAY_CHU.md',
    'CAI-DAT-MAY-CHU.bat', 'HUONG-DAN-CAI-DAT.html']) assert.ok(fs.existsSync(path.join(dich, t)), t);
  for (const t of ['test', 'android', 'ios', 'tools']) assert.ok(!fs.existsSync(path.join(dich, t)), 'không chép ' + t);
  const dl = fs.mkdtempSync(path.join(os.tmpdir(), 'hawamap-iis-dl-'));
  const cong = 20000 + Math.floor(Math.random() * 20000);
  const node = spawn(process.execPath, [path.join(dich, 'server.js')], { env: { ...process.env, PORT: String(cong), HOST: '127.0.0.1', BANDO_DULIEU: dl }, stdio: 'pipe' });
  try {
    let tl = null;
    for (let i = 0; i < 50 && !tl; i++) {
      await new Promise(ok => setTimeout(ok, 100));
      try { tl = await (await fetch(`http://127.0.0.1:${cong}/api/trang-thai`)).json(); } catch (e) { /* chưa chạy xong */ }
    }
    assert.equal(tl && tl.ok, true);
    assert.match(await (await fetch(`http://127.0.0.1:${cong}/`)).text(), /HawaMap/);
  } finally {
    node.kill();
  }

  // tệp zip: đủ tệp, nội dung và CRC đúng, tệp nằm ngay gốc (Extract All của Windows ra đúng một thư mục)
  const tepZip = path.join(path.dirname(dich), 'goi.zip');
  const { so } = taoZip(dich, tepZip);
  const ds = dsTep(dich);
  assert.equal(so, ds.length);
  const zip = docZip(fs.readFileSync(tepZip));
  assert.deepEqual([...zip.keys()].sort(), [...ds].sort());
  for (const t of ['CAI-DAT-MAY-CHU.bat', 'server.js', 'public/vendor/maplibre-gl/maplibre-gl.js', 'public/icons/icon-192.png']) {
    assert.ok(zip.get(t).du.equals(fs.readFileSync(path.join(dich, t))), 'nội dung ' + t);
  }
  assert.ok(fs.statSync(tepZip).size < fs.statSync(path.join(dich, 'public/vendor/maplibre-gl/maplibre-gl.js')).size, 'đã nén');
  const unzip = spawnSync('unzip', ['-tq', tepZip], { encoding: 'utf8' });
  if (!unzip.error) assert.equal(unzip.status, 0, unzip.stdout + unzip.stderr);
});
