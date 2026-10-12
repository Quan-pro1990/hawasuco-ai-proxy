'use strict';
// Chạy cả máy chủ (EOS mẫu, Zalo giả): Zalo gửi webhook → máy chủ trả lời khách.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { taoMayChu } = require('../src/server');
const { cauHinhThu, ghiToken, zaloGia } = require('./giup');

async function moMayChu(cfg, f) {
  const ms = taoMayChu(cfg, { fetch: f });
  await new Promise(ok => ms.server.listen(0, '127.0.0.1', ok));
  ms.goc = `http://127.0.0.1:${ms.server.address().port}`;
  return ms;
}

function suKien(cfg, text, msgId) {
  const than = JSON.stringify({
    app_id: cfg.zalo.appId, sender: { id: 'u-zalo-1' }, recipient: { id: 'oa-1' },
    event_name: 'user_send_text', message: { text, msg_id: msgId }, timestamp: String(Date.now()),
  });
  const ts = JSON.parse(than).timestamp;
  const mac = crypto.createHash('sha256').update(cfg.zalo.appId + than + ts + cfg.zalo.oaSecretKey).digest('hex');
  return { than, chuKy: 'mac=' + mac };
}

async function guiWebhook(goc, { than, chuKy }) {
  return fetch(goc + '/zalo/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-ZEvent-Signature': chuKy }, body: than });
}

async function cho(dieuKien, ms = 2000) {
  const het = Date.now() + ms;
  while (!dieuKien()) {
    if (Date.now() > het) throw new Error('Quá thời gian chờ');
    await new Promise(r => setTimeout(r, 10));
  }
}

test('webhook đúng chữ ký → trả 200 ngay, rồi gửi câu trả lời qua Zalo', async t => {
  const cfg = cauHinhThu();
  ghiToken(cfg);
  const f = zaloGia();
  const ms = await moMayChu(cfg, f);
  t.after(() => ms.server.close());

  const r = await guiWebhook(ms.goc, suKien(cfg, 'DK KH0001 4567', 'm1'));
  assert.equal(r.status, 200);
  await cho(() => f.tinDaGui().length === 1);
  assert.equal(f.tinDaGui()[0].recipient.user_id, 'u-zalo-1');
  assert.match(f.tinDaGui()[0].message.text, /Đã liên kết mã khách hàng KH0001/);

  await guiWebhook(ms.goc, suKien(cfg, 'HD 09/2026', 'm2'));
  await cho(() => f.tinDaGui().length === 3);
  assert.ok(f.goi.some(g => g.url.endsWith('/v2.0/oa/upload/file')));
  assert.deepEqual(f.tinDaGui()[2].message, { attachment: { type: 'file', payload: { token: 'FILE-TOKEN' } } });
});

test('webhook sai chữ ký → 401, không gửi gì', async t => {
  const cfg = cauHinhThu();
  ghiToken(cfg);
  const f = zaloGia();
  const ms = await moMayChu(cfg, f);
  t.after(() => ms.server.close());
  const sk = suKien(cfg, 'TT', 'm1');
  const r = await guiWebhook(ms.goc, { than: sk.than, chuKy: 'mac=' + '0'.repeat(64) });
  assert.equal(r.status, 401);
  const r2 = await guiWebhook(ms.goc, { than: sk.than.replace('TT', 'LS'), chuKy: sk.chuKy });
  assert.equal(r2.status, 401);
  await new Promise(ok => setTimeout(ok, 50));
  assert.equal(f.goi.length, 0);
});

test('Zalo không nhận file → gửi liên kết tải tạm /tai/<mã>, liên kết tải được PDF', async t => {
  const cfg = cauHinhThu();
  ghiToken(cfg);
  const f = zaloGia(m => (m.url.endsWith('/upload/file') ? { error: -201, message: 'File is invalid' } : null));
  const ms = await moMayChu(cfg, f);
  t.after(() => ms.server.close());

  await guiWebhook(ms.goc, suKien(cfg, 'DK KH0001 4567', 'm1'));
  await guiWebhook(ms.goc, suKien(cfg, 'HD 09/2026', 'm2'));
  await cho(() => f.tinDaGui().length === 3);
  const lienKet = /https:\/\/zalo\.vidu\.vn(\/tai\/[0-9a-f]{32})/.exec(f.tinDaGui()[2].message.text);
  assert.ok(lienKet, f.tinDaGui()[2].message.text);

  const r = await fetch(ms.goc + lienKet[1]);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'application/pdf');
  assert.equal(Buffer.from(await r.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
  assert.equal((await fetch(ms.goc + '/tai/' + 'a'.repeat(32))).status, 404);
});

test('cấp quyền và trang trạng thái cần khoá quản trị', async t => {
  const cfg = cauHinhThu();
  const f = zaloGia();
  const ms = await moMayChu(cfg, f);
  t.after(() => ms.server.close());

  assert.equal((await fetch(ms.goc + '/zalo/cap-quyen', { redirect: 'manual' })).status, 403);
  assert.equal((await fetch(ms.goc + '/zalo/cap-quyen?khoa=sai', { redirect: 'manual' })).status, 403);
  const r = await fetch(ms.goc + '/zalo/cap-quyen?khoa=khoa-bi-mat', { redirect: 'manual' });
  assert.equal(r.status, 302);
  const link = new URL(r.headers.get('location'));
  assert.equal(link.searchParams.get('redirect_uri'), 'https://zalo.vidu.vn/zalo/callback');

  const cb = await fetch(ms.goc + '/zalo/callback?oa_id=oa-1&code=CODE&state=' + link.searchParams.get('state'));
  assert.equal(cb.status, 200);
  assert.match(await cb.text(), /Đã cấp quyền/);

  assert.equal((await fetch(ms.goc + '/trang-thai')).status, 403);
  const tt = await (await fetch(ms.goc + '/trang-thai?khoa=khoa-bi-mat')).json();
  assert.equal(tt.zalo.daCapQuyen, true);
  assert.equal(tt.eos, 'mau');
  assert.deepEqual(tt.thieuCauHinh, []);
});

test('phục vụ tệp xác thực tên miền trong public, không cho đi ra ngoài thư mục', async t => {
  const fs = require('fs');
  const path = require('path');
  const { GOC } = require('../src/cauhinh');
  const tep = path.join(GOC, 'public', 'zalo_verifierTHU123.html');
  fs.writeFileSync(tep, '<meta name="zalo-platform-site-verification" content="THU123" />');
  const cfg = cauHinhThu();
  const ms = await moMayChu(cfg, zaloGia());
  t.after(() => { ms.server.close(); fs.unlinkSync(tep); });

  const r = await fetch(ms.goc + '/zalo_verifierTHU123.html');
  assert.equal(r.status, 200);
  assert.match(await r.text(), /THU123/);
  assert.equal((await fetch(ms.goc + '/..%2Fpackage.json')).status, 404);
  assert.equal((await fetch(ms.goc + '/khong-co.html')).status, 404);
});

test('thanh toán: QR gửi dạng ảnh, ngân hàng báo có tiền qua webhook → khách nhận xác nhận; đối soát cần khoá', async t => {
  const cfg = cauHinhThu({ TT_NGAN_HANG_BIN: '970405', TT_SO_TAI_KHOAN: '7700205123456', TT_KHOA_WEBHOOK: 'khoa-nh' });
  ghiToken(cfg);
  const f = zaloGia(m => (m.url.endsWith('/upload/image') ? { error: 0, message: 'Success', data: { attachment_id: 'IMG-1' } } : null));
  const ms = await moMayChu(cfg, f);
  t.after(() => ms.server.close());

  await guiWebhook(ms.goc, suKien(cfg, 'DK KH0001 4567', 'm1'));
  await guiWebhook(ms.goc, suKien(cfg, 'THANH TOAN', 'm2'));
  await cho(() => f.tinDaGui().length === 3);
  const ma = /Nội dung: (TN[A-Z0-9]{8})/.exec(f.tinDaGui()[1].message.text)[1];
  assert.deepEqual(f.tinDaGui()[2].message.attachment.payload, {
    template_type: 'media', elements: [{ media_type: 'image', attachment_id: 'IMG-1' }],
  });
  const tong = ms.thanhToan.maTT.doc()[ma].tong;

  const bao = JSON.stringify({ id: 77, transferType: 'in', transferAmount: tong, content: `${ma} KH0001`, accountNumber: '7700205123456' });
  const sai = await fetch(ms.goc + '/thanh-toan/webhook', { method: 'POST', headers: { Authorization: 'Apikey sai' }, body: bao });
  assert.equal(sai.status, 401);
  const r = await fetch(ms.goc + '/thanh-toan/webhook', { method: 'POST', headers: { Authorization: 'Apikey khoa-nh' }, body: bao });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { success: true, ketQua: ['du'] });
  await cho(() => f.tinDaGui().length === 4);
  assert.match(f.tinDaGui()[3].message.text, /Hoá đơn kỳ 09\/2026 đã được thanh toán/);

  assert.equal((await fetch(ms.goc + '/thanh-toan/doi-soat')).status, 403);
  const xl = await fetch(ms.goc + '/thanh-toan/doi-soat?khoa=khoa-bi-mat&tu=2020-01-01');
  assert.equal(xl.status, 200);
  assert.match(xl.headers.get('content-disposition'), /DoiSoat_2020-01-01_nay\.xlsx/);
  assert.equal(Buffer.from(await xl.arrayBuffer()).readUInt32LE(0), 0x04034b50);
});

test('Zalo không nhận ảnh QR → gửi liên kết /tai/<mã> trả ảnh PNG; chưa khai tài khoản thì webhook thanh toán tắt', async t => {
  const cfg = cauHinhThu({ TT_NGAN_HANG_BIN: '970405', TT_SO_TAI_KHOAN: '7700205123456' });
  ghiToken(cfg);
  const f = zaloGia(m => (m.url.endsWith('/upload/image') ? { error: -201, message: 'Image is invalid' } : null));
  const ms = await moMayChu(cfg, f);
  t.after(() => ms.server.close());

  await guiWebhook(ms.goc, suKien(cfg, 'DK KH0001 4567', 'm1'));
  await guiWebhook(ms.goc, suKien(cfg, 'QR', 'm2'));
  await cho(() => f.tinDaGui().length === 3);
  assert.match(f.tinDaGui()[1].message.text, /bộ phận kế toán đối soát/);   // chưa nối báo số dư
  const lk = /https:\/\/zalo\.vidu\.vn(\/tai\/[0-9a-f]{32})/.exec(f.tinDaGui()[2].message.text);
  assert.ok(lk, f.tinDaGui()[2].message.text);
  const anh = await fetch(ms.goc + lk[1]);
  assert.equal(anh.headers.get('content-type'), 'image/png');

  const r = await fetch(ms.goc + '/thanh-toan/webhook', { method: 'POST', body: '{}' });
  assert.equal(r.status, 404);
});
