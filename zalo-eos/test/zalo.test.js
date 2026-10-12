'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Zalo, kiemChuKy, chiaDoan } = require('../src/zalo');
const { cauHinhThu, ghiToken, zaloGia } = require('./giup');

function kyThu(appId, than, timestamp, secret) {
  return 'mac=' + crypto.createHash('sha256').update(appId + than + timestamp + secret).digest('hex');
}

test('kiểm chữ ký webhook', () => {
  const c = { appId: '1234567890', oaSecretKey: 'oa-secret' };
  const than = JSON.stringify({ app_id: '1234567890', event_name: 'user_send_text', timestamp: '1760000000000', sender: { id: 'u' } });
  const dung = kyThu('1234567890', than, '1760000000000', 'oa-secret');
  assert.ok(kiemChuKy(c, than, dung));
  assert.ok(kiemChuKy(c, than, dung.slice(4).toUpperCase()));         // không có "mac=", chữ hoa
  assert.ok(!kiemChuKy(c, than, kyThu('1234567890', than, '1760000000000', 'sai')));
  assert.ok(!kiemChuKy(c, than.replace('user_send_text', 'follow'), dung));
  assert.ok(!kiemChuKy(c, than, undefined));
  assert.ok(!kiemChuKy({ ...c, oaSecretKey: '' }, than, dung));
  const appKhac = than.replace('"1234567890"', '"999"');
  assert.ok(!kiemChuKy(c, appKhac, kyThu('1234567890', appKhac, '1760000000000', 'oa-secret')));
});

test('cấp quyền OAuth v4: link có PKCE, đổi code lấy token, lưu ra file', async () => {
  const cfg = cauHinhThu();
  const f = zaloGia();
  const z = new Zalo(cfg, { fetch: f });
  const link = new URL(z.taoLinkCapQuyen('https://zalo.vidu.vn/zalo/callback'));
  assert.equal(link.origin + link.pathname, 'https://oauth.zaloapp.com/v4/oa/permission');
  assert.equal(link.searchParams.get('app_id'), '1234567890');
  assert.equal(link.searchParams.get('redirect_uri'), 'https://zalo.vidu.vn/zalo/callback');
  const state = link.searchParams.get('state');

  await assert.rejects(z.nhanCode('CODE', 'state-la'), /không hợp lệ/);
  await z.nhanCode('CODE', state);
  const yc = f.goi[0];
  assert.equal(yc.url, 'https://oauth.zaloapp.com/v4/oa/access_token');
  assert.equal(yc.opts.headers.secret_key, 'app-secret');
  const b = new URLSearchParams(yc.opts.body);
  assert.equal(b.get('grant_type'), 'authorization_code');
  assert.equal(b.get('code'), 'CODE');
  const challenge = crypto.createHash('sha256').update(b.get('code_verifier')).digest('base64url');
  assert.equal(challenge, link.searchParams.get('code_challenge'));

  const luu = JSON.parse(fs.readFileSync(path.join(cfg.thuMucDuLieu, 'zalo-token.json'), 'utf8'));
  assert.equal(luu.access_token, 'AT-2');
  assert.equal(luu.refresh_token, 'RT-2');
  await assert.rejects(z.nhanCode('CODE', state), /không hợp lệ/);   // state chỉ dùng 1 lần
});

test('chưa cấp quyền thì báo rõ cách làm', async () => {
  const z = new Zalo(cauHinhThu(), { fetch: zaloGia() });
  await assert.rejects(z.guiChu('u1', 'x'), /Chưa cấp quyền Zalo OA.*\/zalo\/cap-quyen/);
});

test('token sắp hết hạn: nhiều yêu cầu cùng lúc chỉ làm mới 1 lần, refresh token mới được lưu', async () => {
  const cfg = cauHinhThu();
  ghiToken(cfg, { het_han: Date.now() + 60e3 });   // còn 1 phút → phải làm mới
  const f = zaloGia();
  const z = new Zalo(cfg, { fetch: f });
  await Promise.all([z.guiChu('u1', 'a'), z.guiChu('u2', 'b'), z.guiChu('u3', 'c')]);
  const lamMoi = f.goi.filter(g => g.url.endsWith('/v4/oa/access_token'));
  assert.equal(lamMoi.length, 1);
  assert.equal(new URLSearchParams(lamMoi[0].opts.body).get('refresh_token'), 'RT-1');
  assert.ok(f.goi.filter(g => g.url.endsWith('/message/cs')).every(g => g.opts.headers.access_token === 'AT-2'));
  const luu = JSON.parse(fs.readFileSync(path.join(cfg.thuMucDuLieu, 'zalo-token.json'), 'utf8'));
  assert.equal(luu.refresh_token, 'RT-2');
});

test('Zalo báo token sai (-216) → làm mới rồi gửi lại 1 lần; lỗi khác thì báo lỗi', async () => {
  const cfg = cauHinhThu();
  ghiToken(cfg);
  let lan = 0;
  const f = zaloGia(m => (m.url.endsWith('/message/cs') && lan++ === 0 ? { error: -216, message: 'Access token is invalid' } : null));
  const z = new Zalo(cfg, { fetch: f });
  await z.guiChu('u1', 'xin chào');
  assert.deepEqual(f.goi.map(g => g.url.split('.me')[1] || 'oauth'), ['/v3.0/oa/message/cs', 'oauth', '/v3.0/oa/message/cs']);
  assert.deepEqual(f.tinDaGui()[1], { recipient: { user_id: 'u1' }, message: { text: 'xin chào' } });

  const f2 = zaloGia(() => ({ error: -230, message: 'User has not interacted with the OA in the past 7 days' }));
  const z2 = new Zalo(cfg, { fetch: f2 });
  await assert.rejects(z2.guiChu('u1', 'x'), /Zalo báo lỗi -230/);
});

test('gửi file: tải lên /v2.0/oa/upload/file rồi gửi tin đính kèm token file', async () => {
  const cfg = cauHinhThu();
  ghiToken(cfg);
  const f = zaloGia();
  const z = new Zalo(cfg, { fetch: f });
  await z.guiFile('u1', Buffer.from('%PDF-1.4 thu'), 'HoaDon_KH0001_09-2026.pdf');
  assert.equal(f.goi[0].url, 'https://openapi.zalo.me/v2.0/oa/upload/file');
  const fd = f.goi[0].opts.body;
  assert.ok(fd instanceof FormData);
  const tep = fd.get('file');
  assert.equal(tep.name, 'HoaDon_KH0001_09-2026.pdf');
  assert.equal(tep.type, 'application/pdf');
  assert.deepEqual(f.tinDaGui()[0], {
    recipient: { user_id: 'u1' },
    message: { attachment: { type: 'file', payload: { token: 'FILE-TOKEN' } } },
  });
  await assert.rejects(z.guiFile('u1', Buffer.alloc(5 * 1024 * 1024 + 1), 'to.pdf'), /lớn hơn 5 MB/);
});

test('tin dài được cắt theo dòng, mỗi đoạn ≤ 2000 ký tự', () => {
  const dong = Array.from({ length: 100 }, (_, i) => `Dòng ${i} ` + 'x'.repeat(40));
  const doan = chiaDoan(dong.join('\n'), 2000);
  assert.ok(doan.length > 1);
  assert.ok(doan.every(d => d.length <= 2000));
  assert.equal(doan.join('\n'), dong.join('\n'));
});

test('gửi ảnh: tải lên /v2.0/oa/upload/image rồi gửi tin media kèm attachment_id', async () => {
  const cfg = cauHinhThu();
  ghiToken(cfg);
  const f = zaloGia(m => (m.url.endsWith('/upload/image') ? { error: 0, data: { attachment_id: 'IMG-9' } } : null));
  const z = new Zalo(cfg, { fetch: f });
  await z.guiAnh('u1', Buffer.from('png'), 'QR_TNABC.png');
  assert.equal(f.goi[0].url, 'https://openapi.zalo.me/v2.0/oa/upload/image');
  assert.equal(f.goi[0].opts.body.get('file').type, 'image/png');
  assert.deepEqual(f.tinDaGui()[0].message.attachment, {
    type: 'template', payload: { template_type: 'media', elements: [{ media_type: 'image', attachment_id: 'IMG-9' }] },
  });
  await assert.rejects(z.guiAnh('u1', Buffer.alloc(1024 * 1024 + 1), 'to.png'), /lớn hơn 1 MB/);
});
