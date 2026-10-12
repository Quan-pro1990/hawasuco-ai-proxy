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

// ------------------------------------------------------------------ cổng thanh toán MoMo / ZaloPay / VNPAY

const CONG = {
  TT_NGAN_HANG_BIN: '970405', TT_SO_TAI_KHOAN: '7700205123456',
  MOMO_PARTNER_CODE: 'MOMOTEST', MOMO_ACCESS_KEY: 'ak', MOMO_SECRET_KEY: 'sk-momo',
  ZALOPAY_APP_ID: '2553', ZALOPAY_KEY1: 'k1', ZALOPAY_KEY2: 'k2',
  VNPAY_TMN_CODE: 'DEMOV210', VNPAY_HASH_SECRET: 'sk-vnpay',
};
const h256 = (k, s) => crypto.createHmac('sha256', k).update(s).digest('hex');
const h512 = (k, s) => crypto.createHmac('sha512', k).update(s).digest('hex');

function fetchCong(them = () => null) {
  return zaloGia(m => {
    const r = them(m);
    if (r) return r;
    if (m.url.endsWith('/upload/image')) return { error: 0, data: { attachment_id: 'IMG' } };
    if (m.url.endsWith('/v2/gateway/api/create')) return { resultCode: 0, message: 'ok', payUrl: 'https://test-payment.momo.vn/pay/x' };
    if (m.url.endsWith('/v2/create')) return { return_code: 1, order_url: 'https://sbgateway.zalopay.vn/openinapp?order=x' };
    if (m.url.endsWith('/v2/query')) return { return_code: 1, amount: Number(new URLSearchParams(m.opts.body).get('amount') || 0), zp_trans_id: 777, server_time: Date.now() };
    return null;
  });
}

async function batDau(t, f) {
  const cfg = cauHinhThu(CONG);
  ghiToken(cfg);
  const ms = await moMayChu(cfg, f);
  t.after(() => ms.server.close());
  return { cfg, ms };
}

/** Khách nhắn lệnh thanh toán, trả về khoá trang thanh toán trong tin trả lời. */
async function layLink(ms, cfg, f, lenh, msgId) {
  const truoc = f.tinDaGui().length;
  await guiWebhook(ms.goc, suKien(cfg, lenh, msgId));
  await cho(() => f.tinDaGui().length > truoc && /\/tt\//.test(f.tinDaGui().at(-1).message.text || '')
    || f.tinDaGui().slice(truoc).some(x => /\/tt\//.test(x.message.text || '')));
  const tin = f.tinDaGui().slice(truoc).find(x => /\/tt\//.test(x.message.text || '')).message.text;
  return { tin, link: /https:\/\/zalo\.vidu\.vn\/tt\/([A-Za-z0-9_-]+)/.exec(tin)[1] };
}

const sau = (goc, duong, opts = {}) => fetch(goc + duong, { redirect: 'manual', ...opts });

test('MoMo: trang thanh toán → tạo đơn → IPN ký đúng → gạch nợ, nhắn Zalo; IPN lặp / sai chữ ký', async t => {
  const f = fetchCong();
  const { cfg, ms } = await batDau(t, f);
  await guiWebhook(ms.goc, suKien(cfg, 'DK KH0002 5678', 'm1'));
  await cho(() => f.tinDaGui().length === 1);
  const { tin, link } = await layLink(ms, cfg, f, 'THANH TOAN 09/2026', 'm2');
  assert.match(tin, /Cách 1 – Thanh toán online qua Ví MoMo, ZaloPay, VNPAY \(VNPAY: app ngân hàng, thẻ ATM\)/);
  assert.match(tin, /Cách 2 – Quét mã QR/);

  const trang = await (await sau(ms.goc, `/tt/${link}`)).text();
  for (const c of ['momo', 'zalopay', 'vnpay']) assert.ok(trang.includes(`action="/tt/${link}/${c}"`), c);
  assert.ok(trang.includes(`/tt/${link}/qr.png`));
  assert.equal((await sau(ms.goc, `/tt/${link}/qr.png`)).headers.get('content-type'), 'image/png');
  assert.equal((await sau(ms.goc, '/tt/khongcokhoanaydauhet')).status, 404);

  const r = await sau(ms.goc, `/tt/${link}/momo`, { method: 'POST' });
  assert.equal(r.status, 303);
  assert.equal(r.headers.get('location'), 'https://test-payment.momo.vn/pay/x');
  const tao = JSON.parse(f.goi.find(g => g.url.endsWith('/v2/gateway/api/create')).opts.body);
  assert.equal(tao.ipnUrl, 'https://zalo.vidu.vn/cong/momo/ipn');
  assert.equal(tao.redirectUrl, 'https://zalo.vidu.vn/cong/momo/ve');

  const ipn = { partnerCode: 'MOMOTEST', orderId: tao.orderId, requestId: tao.requestId, amount: tao.amount, orderInfo: tao.orderInfo,
    orderType: 'momo_wallet', transId: 4088878653, resultCode: 0, message: 'Thành công.', payType: 'qr', responseTime: Date.now(), extraData: '' };
  ipn.signature = h256('sk-momo', `accessKey=ak&amount=${ipn.amount}&extraData=&message=${ipn.message}&orderId=${ipn.orderId}`
    + `&orderInfo=${ipn.orderInfo}&orderType=${ipn.orderType}&partnerCode=${ipn.partnerCode}&payType=${ipn.payType}`
    + `&requestId=${ipn.requestId}&responseTime=${ipn.responseTime}&resultCode=0&transId=${ipn.transId}`);
  const gui = b => fetch(ms.goc + '/cong/momo/ipn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

  assert.equal((await gui({ ...ipn, amount: 1 })).status, 400);
  const truoc = f.tinDaGui().length;
  assert.equal((await gui(ipn)).status, 204);
  await cho(() => f.tinDaGui().length === truoc + 1);
  assert.match(f.tinDaGui().at(-1).message.text, /Đã nhận [\d.]+ đ qua Ví MoMo – mã KH KH0002 \(mã giao dịch MOMO-4088878653\)/);
  assert.equal((await gui(ipn)).status, 204);   // MoMo gửi lại: không ghi, không nhắn lần 2
  await new Promise(ok => setTimeout(ok, 30));
  assert.equal(f.tinDaGui().length, truoc + 1);
  const gd = ms.thanhToan.giaoDich.doc()['MOMO-4088878653'];
  assert.deepEqual([gd.kenh, gd.trangThai, gd.eos], ['Ví MoMo', 'du', 'Đã gạch nợ trên EOS']);

  // khách quay về từ MoMo → trang báo đã thanh toán; bấm lại nút không tạo đơn mới
  const ve = new URLSearchParams(Object.entries(ipn).map(([k, v]) => [k, String(v)]));
  const r2 = await sau(ms.goc, '/cong/momo/ve?' + ve);
  assert.equal(r2.headers.get('location'), `/tt/${link}?kq=ok`);
  assert.match(await (await sau(ms.goc, `/tt/${link}?kq=ok`)).text(), /Đã thanh toán lúc/);
  assert.equal((await sau(ms.goc, `/tt/${link}/momo`, { method: 'POST' })).headers.get('location'), `/tt/${link}`);
});

test('VNPAY: link ký đúng; IPN trả 00 / 02 / 97 / 01 theo quy định VNPAY; trang về', async t => {
  const f = fetchCong();
  const { cfg, ms } = await batDau(t, f);
  await guiWebhook(ms.goc, suKien(cfg, 'DK KH0002 5678', 'm1'));
  const { link } = await layLink(ms, cfg, f, 'THANH TOAN 08/2026', 'm2');

  const r = await sau(ms.goc, `/tt/${link}/vnpay`, { method: 'POST', headers: { 'X-Forwarded-For': '113.161.1.2' } });
  const u = new URL(r.headers.get('location'));
  assert.equal(u.origin + u.pathname, 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html');
  assert.equal(u.searchParams.get('vnp_IpAddr'), '113.161.1.2');
  assert.equal(u.searchParams.get('vnp_ReturnUrl'), 'https://zalo.vidu.vn/cong/vnpay/ve');
  const txn = u.searchParams.get('vnp_TxnRef');
  const ky = p => {
    const sp = new URLSearchParams();
    for (const k of Object.keys(p).sort()) sp.append(k, p[k]);
    return h512('sk-vnpay', sp.toString());
  };
  const p = { vnp_Amount: u.searchParams.get('vnp_Amount'), vnp_BankCode: 'NCB', vnp_OrderInfo: u.searchParams.get('vnp_OrderInfo'),
    vnp_PayDate: '20261012093000', vnp_ResponseCode: '00', vnp_TmnCode: 'DEMOV210', vnp_TransactionNo: '14226112',
    vnp_TransactionStatus: '00', vnp_TxnRef: txn };
  const ipn = async q => (await fetch(ms.goc + '/cong/vnpay/ipn?' + new URLSearchParams(q))).json();

  assert.deepEqual(await ipn({ ...p, vnp_SecureHash: '0'.repeat(128) }), { RspCode: '97', Message: 'Invalid signature' });
  const la = { ...p, vnp_TxnRef: 'TNZZZZZZZZABCDE' };
  assert.deepEqual(await ipn({ ...la, vnp_SecureHash: ky(la) }), { RspCode: '01', Message: 'Order not found' });
  assert.deepEqual(await ipn({ ...p, vnp_SecureHash: ky(p) }), { RspCode: '00', Message: 'Confirm Success' });
  assert.deepEqual(await ipn({ ...p, vnp_SecureHash: ky(p) }), { RspCode: '02', Message: 'Order already confirmed' });
  await cho(() => /qua VNPAY/.test(f.tinDaGui().at(-1).message.text || ''));

  const ve = await sau(ms.goc, '/cong/vnpay/ve?' + new URLSearchParams({ ...p, vnp_SecureHash: ky(p) }));
  assert.equal(ve.headers.get('location'), `/tt/${link}?kq=ok`);
  const huy = { ...p, vnp_ResponseCode: '24', vnp_TransactionStatus: '02', vnp_TransactionNo: '0' };
  const ve2 = await sau(ms.goc, '/cong/vnpay/ve?' + new URLSearchParams({ ...huy, vnp_SecureHash: ky(huy) }));
  assert.equal(ve2.headers.get('location'), `/tt/${link}?kq=loi`);
});

test('ZaloPay: khách về trước callback → hỏi ZaloPay rồi ghi nhận; callback sau báo đã xử lý; sai mac bị từ chối', async t => {
  let soTien = 0;
  const f = fetchCong(m => {
    if (m.url.endsWith('/v2/create')) soTien = Number(new URLSearchParams(m.opts.body).get('amount'));
    if (m.url.endsWith('/v2/query')) return { return_code: 1, amount: soTien, zp_trans_id: 240000123, server_time: Date.now() };
    return null;
  });
  const { cfg, ms } = await batDau(t, f);
  await guiWebhook(ms.goc, suKien(cfg, 'DK KH0001 4567', 'm1'));
  const { link } = await layLink(ms, cfg, f, 'THANH TOAN', 'm2');

  const r = await sau(ms.goc, `/tt/${link}/zalopay`, { method: 'POST' });
  assert.equal(r.headers.get('location'), 'https://sbgateway.zalopay.vn/openinapp?order=x');
  const tao = Object.fromEntries(new URLSearchParams(f.goi.find(g => g.url.endsWith('/v2/create')).opts.body));
  assert.equal(tao.callback_url, 'https://zalo.vidu.vn/cong/zalopay/ipn');

  const q = { appid: '2553', apptransid: tao.app_trans_id, pmcid: '38', bankcode: '', amount: tao.amount, discountamount: '0', status: '1' };
  q.checksum = h256('k2', [q.appid, q.apptransid, q.pmcid, q.bankcode, q.amount, q.discountamount, q.status].join('|'));
  const ve = await sau(ms.goc, '/cong/zalopay/ve?' + new URLSearchParams(q));
  assert.equal(ve.headers.get('location'), `/tt/${link}?kq=ok`);
  await cho(() => /qua ZaloPay/.test(f.tinDaGui().at(-1).message.text || ''));
  assert.ok(ms.thanhToan.giaoDich.doc()['ZALOPAY-240000123']);

  const data = JSON.stringify({ app_id: 2553, app_trans_id: tao.app_trans_id, amount: Number(tao.amount), zp_trans_id: 240000123, server_time: Date.now() });
  const cb = async b => (await fetch(ms.goc + '/cong/zalopay/ipn', { method: 'POST', body: JSON.stringify(b) })).json();
  assert.deepEqual(await cb({ data, mac: h256('k1', data), type: 1 }), { return_code: -1, return_message: 'mac not equal' });
  assert.deepEqual(await cb({ data, mac: h256('k2', data), type: 1 }), { return_code: 2, return_message: 'Order already confirmed' });
});

test('cổng lỗi khi tạo đơn → trang báo bận; chưa bật cổng thì không có nút', async t => {
  const f = fetchCong(m => (m.url.endsWith('/v2/gateway/api/create') ? { resultCode: 98, message: 'QR Code tạo không thành công' } : null));
  const { cfg, ms } = await batDau(t, f);
  await guiWebhook(ms.goc, suKien(cfg, 'DK KH0001 4567', 'm1'));
  const { link } = await layLink(ms, cfg, f, 'THANH TOAN', 'm2');
  const r = await sau(ms.goc, `/tt/${link}/momo`, { method: 'POST' });
  assert.equal(r.status, 502);
  assert.match(await r.text(), /Chưa mở được cổng thanh toán/);

  const cfg2 = cauHinhThu({ TT_NGAN_HANG_BIN: '970405', TT_SO_TAI_KHOAN: '7700205123456' });
  ghiToken(cfg2);
  const f2 = fetchCong();
  const ms2 = await moMayChu(cfg2, f2);
  t.after(() => ms2.server.close());
  await guiWebhook(ms2.goc, suKien(cfg2, 'DK KH0001 4567', 'm1'));
  await guiWebhook(ms2.goc, suKien(cfg2, 'THANH TOAN', 'm2'));
  await cho(() => f2.tinDaGui().length === 3);
  assert.doesNotMatch(f2.tinDaGui()[1].message.text, /online/);
  assert.equal((await sau(ms2.goc, '/cong/momo/ipn', { method: 'POST', body: '{}' })).status, 404);
});
