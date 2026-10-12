'use strict';
// Kiểm chữ ký từng cổng bằng cách tính lại độc lập theo tài liệu / mã mẫu của cổng.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { MoMo, ZaloPay, VnPay, chuSach } = require('../src/congthanhtoan');

const BAY_GIO = Date.UTC(2026, 9, 12, 20, 0, 0);   // 03:00 ngày 13/10/2026 giờ Việt Nam
const h256 = (k, s) => crypto.createHmac('sha256', k).update(s).digest('hex');
const h512 = (k, s) => crypto.createHmac('sha512', k).update(s).digest('hex');

function fetchGia(traLoi) {
  const goi = [];
  const f = async (url, opts) => {
    goi.push({ url, opts });
    return new Response(JSON.stringify(traLoi(url, opts)), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  f.goi = goi;
  return f;
}

const MOMO = { partnerCode: 'MOMOTEST', accessKey: 'F8BBA842ECF85', secretKey: 'K951B6PE1waDMi640xX08PD3vg6EkVlz', loai: 'captureWallet', moiTruong: 'thu' };

test('MoMo: tạo đơn đúng chữ ký theo mã mẫu của MoMo, trả payUrl', async () => {
  const f = fetchGia(() => ({ resultCode: 0, message: 'Thành công.', payUrl: 'https://test-payment.momo.vn/pay/abc' }));
  const momo = new MoMo(MOMO, f);
  const r = await momo.taoDon({ maDon: 'TNABCDEFGHXYZ12', soTien: 153000, moTa: 'Tiền nước KH0001 kỳ 09/2026',
    urlVe: 'https://zalo.vidu.vn/cong/momo/ve', urlIpn: 'https://zalo.vidu.vn/cong/momo/ipn' });
  assert.deepEqual(r, { url: 'https://test-payment.momo.vn/pay/abc', maDon: 'TNABCDEFGHXYZ12' });
  assert.equal(f.goi[0].url, 'https://test-payment.momo.vn/v2/gateway/api/create');
  const b = JSON.parse(f.goi[0].opts.body);
  assert.equal(b.orderInfo, 'Tien nuoc KH0001 ky 09 2026');
  const raw = 'accessKey=' + MOMO.accessKey + '&amount=' + b.amount + '&extraData=' + b.extraData + '&ipnUrl=' + b.ipnUrl
    + '&orderId=' + b.orderId + '&orderInfo=' + b.orderInfo + '&partnerCode=' + b.partnerCode + '&redirectUrl=' + b.redirectUrl
    + '&requestId=' + b.requestId + '&requestType=' + b.requestType;
  assert.equal(b.signature, h256(MOMO.secretKey, raw));
  assert.equal(b.amount, 153000);
  assert.equal(b.requestType, 'captureWallet');
  assert.equal(b.accessKey, undefined);   // không gửi accessKey trong thân

  const loi = new MoMo(MOMO, fetchGia(() => ({ resultCode: 22, message: 'Số tiền không hợp lệ' })));
  await assert.rejects(loi.taoDon({ maDon: 'X', soTien: 1, moTa: 'x', urlVe: 'u', urlIpn: 'u' }), /MoMo không tạo được đơn \(22\)/);
  assert.equal(new MoMo({ ...MOMO, moiTruong: 'that' }).host, 'https://payment.momo.vn');
});

test('MoMo: kiểm chữ ký IPN / trang về', () => {
  const momo = new MoMo(MOMO);
  const ipn = { partnerCode: 'MOMOTEST', orderId: 'TNABCDEFGHXYZ12', requestId: 'TNABCDEFGHXYZ12', amount: 153000,
    orderInfo: 'Tien nuoc KH0001 ky 09 2026', orderType: 'momo_wallet', transId: 4088878653, resultCode: 0,
    message: 'Thành công.', payType: 'qr', responseTime: 1791853213000, extraData: '' };
  const raw = `accessKey=${MOMO.accessKey}&amount=${ipn.amount}&extraData=${ipn.extraData}&message=${ipn.message}&orderId=${ipn.orderId}`
    + `&orderInfo=${ipn.orderInfo}&orderType=${ipn.orderType}&partnerCode=${ipn.partnerCode}&payType=${ipn.payType}`
    + `&requestId=${ipn.requestId}&responseTime=${ipn.responseTime}&resultCode=${ipn.resultCode}&transId=${ipn.transId}`;
  ipn.signature = h256(MOMO.secretKey, raw);
  const kq = momo.docKetQua(ipn);
  assert.equal(kq.hopLe, true);
  assert.equal(kq.thanhCong, true);
  assert.equal(kq.maDon, 'TNABCDEFGHXYZ12');
  assert.equal(kq.soTien, 153000);
  assert.equal(kq.maGD, '4088878653');
  // trang về: cùng các giá trị nhưng là chuỗi (query)
  const ve = Object.fromEntries(Object.entries(ipn).map(([k, v]) => [k, String(v)]));
  assert.equal(momo.docKetQua(ve).hopLe, true);
  assert.equal(momo.docKetQua({ ...ipn, amount: 1000 }).hopLe, false);
  assert.equal(momo.docKetQua({ ...ipn, resultCode: 1006 }).hopLe, false);
  assert.equal(momo.docKetQua({ ...ipn, partnerCode: 'KHAC' }).hopLe, false);
});

const ZP = { appId: '2553', key1: 'PcY4iZIKFCIdgZvA6ueMcMHHUbRLYjPL', key2: 'kLtgPl8HHhfvMuDHPwKfgfsY4Ydm9eIz', moiTruong: 'thu' };

test('ZaloPay: tạo đơn (app_trans_id theo ngày Việt Nam, mac bằng key1)', async () => {
  const f = fetchGia(() => ({ return_code: 1, return_message: 'Giao dịch thành công', order_url: 'https://qcgateway.zalopay.vn/openinapp?order=x' }));
  const zp = new ZaloPay(ZP, f);
  const r = await zp.taoDon({ maDon: 'TNABCDEFGHXYZ12', soTien: 153000, moTa: 'Tiền nước KH0001', nguoiDung: 'KH0001',
    urlVe: 'https://zalo.vidu.vn/cong/zalopay/ve', urlIpn: 'https://zalo.vidu.vn/cong/zalopay/ipn', bayGio: BAY_GIO });
  assert.equal(r.maDon, '261013_TNABCDEFGHXYZ12');
  assert.equal(f.goi[0].url, 'https://sb-openapi.zalopay.vn/v2/create');
  assert.equal(f.goi[0].opts.headers['Content-Type'], 'application/x-www-form-urlencoded');
  const b = Object.fromEntries(new URLSearchParams(f.goi[0].opts.body));
  assert.equal(b.app_trans_id, '261013_TNABCDEFGHXYZ12');
  assert.equal(b.app_time, String(BAY_GIO));
  assert.deepEqual(JSON.parse(b.embed_data), { redirecturl: 'https://zalo.vidu.vn/cong/zalopay/ve' });
  assert.equal(b.callback_url, 'https://zalo.vidu.vn/cong/zalopay/ipn');
  assert.equal(b.mac, h256(ZP.key1, [b.app_id, b.app_trans_id, b.app_user, b.amount, b.app_time, b.embed_data, b.item].join('|')));

  const loi = new ZaloPay(ZP, fetchGia(() => ({ return_code: 2, sub_return_code: -54, sub_return_message: 'app_trans_id trùng' })));
  await assert.rejects(loi.taoDon({ maDon: 'X', soTien: 1, moTa: 'x', bayGio: BAY_GIO }), /ZaloPay không tạo được đơn \(2\/-54\)/);
});

test('ZaloPay: callback (mac key2), trang về (checksum key2), hỏi trạng thái đơn', async () => {
  const zp = new ZaloPay(ZP, fetchGia((url, opts) => {
    const b = Object.fromEntries(new URLSearchParams(opts.body));
    assert.equal(b.mac, h256(ZP.key1, `${ZP.appId}|${b.app_trans_id}|${ZP.key1}`));
    return { return_code: 1, amount: 153000, zp_trans_id: 240000123, server_time: 1791853213000 };
  }));
  const data = JSON.stringify({ app_id: 2553, app_trans_id: '261013_TNABCDEFGHXYZ12', app_time: BAY_GIO, app_user: 'KH0001',
    amount: 153000, embed_data: '{}', item: '[]', zp_trans_id: 240000123, server_time: 1791853213000, channel: 38 });
  const cb = zp.docCallback({ data, mac: h256(ZP.key2, data), type: 1 });
  assert.deepEqual([cb.hopLe, cb.maDon, cb.soTien, cb.maGD], [true, '261013_TNABCDEFGHXYZ12', 153000, '240000123']);
  assert.equal(zp.docCallback({ data, mac: h256(ZP.key1, data) }).hopLe, false);
  assert.equal(zp.docCallback({ data: data.replace('153000', '1000'), mac: h256(ZP.key2, data) }).hopLe, false);

  const q = { appid: '2553', apptransid: '261013_TNABCDEFGHXYZ12', pmcid: '38', bankcode: '', amount: '153000', discountamount: '0', status: '1' };
  q.checksum = h256(ZP.key2, [q.appid, q.apptransid, q.pmcid, q.bankcode, q.amount, q.discountamount, q.status].join('|'));
  assert.deepEqual([zp.docVe(q).hopLe, zp.docVe(q).thanhCong], [true, true]);
  assert.equal(zp.docVe({ ...q, status: '-49' }).hopLe, false);

  const tv = await zp.truyVan('261013_TNABCDEFGHXYZ12');
  assert.deepEqual([tv.thanhCong, tv.soTien, tv.maGD], [true, 153000, '240000123']);
});

const VNP = { tmnCode: 'DEMOV210', hashSecret: 'RAOEXHYVSDDIIENYWSLDIIZTANXUXZFJ', maNganHang: '', moiTruong: 'thu' };

/** Cách ký của thư viện vnpay (URLSearchParams) — tính độc lập để đối chiếu cách mã hoá. */
function kyVnpay(p) {
  const sp = new URLSearchParams();
  for (const k of Object.keys(p).sort()) if (p[k] !== '' && p[k] != null) sp.append(k, String(p[k]));
  return h512(VNP.hashSecret, sp.toString());
}

test('VNPAY: link thanh toán 2.1.0 ký HMAC-SHA512, số tiền ×100, giờ Việt Nam', async () => {
  const vnp = new VnPay(VNP);
  const r = await vnp.taoDon({ maDon: 'TNABCDEFGHXYZ12', soTien: 153000, moTa: 'Tiền nước KH0001 kỳ 09/2026',
    urlVe: 'https://zalo.vidu.vn/cong/vnpay/ve', ipKhach: '113.161.1.2', bayGio: BAY_GIO });
  const u = new URL(r.url);
  assert.equal(u.origin + u.pathname, 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html');
  const p = Object.fromEntries(u.searchParams);
  const ky = p.vnp_SecureHash;
  delete p.vnp_SecureHash;
  assert.equal(ky, kyVnpay(p));
  assert.equal(p.vnp_Amount, '15300000');
  assert.equal(p.vnp_CreateDate, '20261013030000');
  assert.equal(p.vnp_ExpireDate, '20261013031500');
  assert.equal(p.vnp_OrderInfo, 'Tien nuoc KH0001 ky 09 2026');
  assert.equal(p.vnp_TxnRef, 'TNABCDEFGHXYZ12');
  assert.equal(p.vnp_IpAddr, '113.161.1.2');
  assert.equal(p.vnp_BankCode, undefined);
  assert.equal(new VnPay({ ...VNP, moiTruong: 'that' }).host, 'https://pay.vnpay.vn/vpcpay.html');
});

test('VNPAY: kiểm chữ ký IPN / trang về, điều kiện thành công', () => {
  const vnp = new VnPay(VNP);
  const p = { vnp_Amount: '15300000', vnp_BankCode: 'NCB', vnp_BankTranNo: 'VNP14226112', vnp_CardType: 'ATM',
    vnp_OrderInfo: 'Tien nuoc KH0001 ky 09 2026', vnp_PayDate: '20261013030512', vnp_ResponseCode: '00',
    vnp_TmnCode: 'DEMOV210', vnp_TransactionNo: '14226112', vnp_TransactionStatus: '00', vnp_TxnRef: 'TNABCDEFGHXYZ12' };
  const kq = vnp.docKetQua({ ...p, vnp_SecureHashType: 'HmacSHA512', vnp_SecureHash: kyVnpay(p) });
  assert.deepEqual([kq.hopLe, kq.thanhCong, kq.maDon, kq.soTien, kq.maGD, kq.thoiGian],
    [true, true, 'TNABCDEFGHXYZ12', 153000, '14226112', '2026-10-13 03:05:12']);
  assert.equal(vnp.docKetQua({ ...p, vnp_Amount: '100', vnp_SecureHash: kyVnpay(p) }).hopLe, false);
  const huy = { ...p, vnp_ResponseCode: '24', vnp_TransactionStatus: '02' };
  const kqHuy = vnp.docKetQua({ ...huy, vnp_SecureHash: kyVnpay(huy) });
  assert.deepEqual([kqHuy.hopLe, kqHuy.thanhCong], [true, false]);
  const khac = { ...p, vnp_TmnCode: 'KHAC' };
  assert.equal(vnp.docKetQua({ ...khac, vnp_SecureHash: kyVnpay(khac) }).hopLe, false);
});

test('chữ gửi cổng: bỏ dấu, bỏ ký tự đặc biệt', () => {
  assert.equal(chuSach('Tiền nước – Đội 1 (KH0001)'), 'Tien nuoc Doi 1 KH0001');
});
