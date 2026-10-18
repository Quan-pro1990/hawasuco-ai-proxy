import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { dongGoi } from '../tools/dong-goi-iis.mjs';

const IIS = new URL('../trien-khai/iis/', import.meta.url);
const doc = ten => fs.readFileSync(new URL(ten, IIS), 'utf8');

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
  for (const ten of ['cai-dat-iis.ps1', 'go-cai-dat-iis.ps1']) {
    const ps = fs.readFileSync(new URL(ten, IIS));
    assert.ok(ps.every(b => b < 128), `${ten} chỉ có ký tự ASCII (PowerShell 5.1 đọc tệp không BOM theo mã ANSI)`);
  }
  const ps = doc('cai-dat-iis.ps1');
  for (const k of ['__NODE__', '__THU_MUC__', '__DU_LIEU__', '__CONG_NODE__']) assert.ok(ps.includes(`'${k}'`), 'script thay ' + k);
  assert.match(ps, /allowedServerVariables/);
  assert.match(ps, /managedRuntimeVersion -Value ''/);
});

test('đóng gói bản IIS và chạy được máy chủ từ bản đóng gói', async () => {
  const dich = dongGoi(fs.mkdtempSync(path.join(os.tmpdir(), 'hawamap-iis-')) + '/goi');
  for (const t of ['server.js', 'kho-giao-thong.js', 'package.json', 'public/index.html', 'public/js/main.js', 'public/du-lieu/phi-cao-toc.json',
    'trien-khai/iis/web.config', 'trien-khai/iis/cai-dat-iis.ps1']) assert.ok(fs.existsSync(path.join(dich, t)), t);
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
});
