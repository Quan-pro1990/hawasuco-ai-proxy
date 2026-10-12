'use strict';
// Cổng thanh toán đã ký hợp đồng: Ví MoMo, ZaloPay, VNPAY.
// Mỗi cổng: taoDon() → link thanh toán của cổng; doc…() kiểm chữ ký kết quả cổng gửi về (IPN / callback / trang về)
// và trả về dạng chung { hopLe, thanhCong, maDon, soTien, maGD, thoiGian }.
const crypto = require('crypto');

function hmac(thuatToan, khoa, chuoi) {
  return crypto.createHmac(thuatToan, khoa).update(Buffer.from(String(chuoi), 'utf8')).digest('hex');
}

function bangNhau(a, b) {
  const x = Buffer.from(String(a || '').toLowerCase());
  const y = Buffer.from(String(b || '').toLowerCase());
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** "Tiền nước KH0001 kỳ 09/2026" → "Tien nuoc KH0001 ky 09 2026": cổng nào cũng nhận, không lệch chữ ký vì mã hoá. */
function chuSach(s, toiDa = 100) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, toiDa);
}

/** Giờ Việt Nam (GMT+7) dạng yyyyMMddHHmmss. */
function gioVnSo(ms) {
  return new Date(ms + 7 * 3600e3).toISOString().replace(/[-:T]/g, '').slice(0, 14);
}

function gioVnChu(ms) {
  return Number.isFinite(ms) ? new Date(ms + 7 * 3600e3).toISOString().replace('T', ' ').slice(0, 19) : '';
}

async function docJson(res, ten) {
  const chuoi = await res.text();
  try { return JSON.parse(chuoi); } catch (e) {
    throw new Error(`${ten} trả về không phải JSON (HTTP ${res.status}): ${chuoi.slice(0, 200)}`);
  }
}

// ------------------------------------------------------------------ Ví MoMo (API v2)

class MoMo {
  constructor(c, f) {
    this.c = c;
    this.f = f;
    this.ten = 'momo';
    this.nhan = 'Ví MoMo';
  }

  get host() { return this.c.moiTruong === 'that' ? 'https://payment.momo.vn' : 'https://test-payment.momo.vn'; }

  async taoDon({ maDon, soTien, moTa, urlVe, urlIpn }) {
    const c = this.c;
    const d = {
      partnerCode: c.partnerCode, requestId: maDon, amount: soTien, orderId: maDon, orderInfo: chuSach(moTa),
      redirectUrl: urlVe, ipnUrl: urlIpn, extraData: '', requestType: c.loai || 'captureWallet',
    };
    const raw = `accessKey=${c.accessKey}&amount=${d.amount}&extraData=${d.extraData}&ipnUrl=${d.ipnUrl}`
      + `&orderId=${d.orderId}&orderInfo=${d.orderInfo}&partnerCode=${d.partnerCode}&redirectUrl=${d.redirectUrl}`
      + `&requestId=${d.requestId}&requestType=${d.requestType}`;
    const res = await this.f(this.host + '/v2/gateway/api/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...d, autoCapture: true, lang: 'vi', signature: hmac('sha256', c.secretKey, raw) }),
      signal: AbortSignal.timeout(30000),
    });
    const kq = await docJson(res, 'MoMo');
    if (Number(kq.resultCode) !== 0 || !kq.payUrl) throw new Error(`MoMo không tạo được đơn (${kq.resultCode}): ${kq.message || ''}`);
    return { url: kq.payUrl, maDon };
  }

  /** IPN (thân JSON) và trang về (query) cùng 1 cách ký. */
  docKetQua(p) {
    const c = this.c;
    const raw = `accessKey=${c.accessKey}&amount=${p.amount}&extraData=${p.extraData ?? ''}&message=${p.message}`
      + `&orderId=${p.orderId}&orderInfo=${p.orderInfo}&orderType=${p.orderType}&partnerCode=${p.partnerCode}`
      + `&payType=${p.payType}&requestId=${p.requestId}&responseTime=${p.responseTime}&resultCode=${p.resultCode}`
      + `&transId=${p.transId}`;
    return {
      hopLe: String(p.partnerCode) === String(c.partnerCode) && bangNhau(hmac('sha256', c.secretKey, raw), p.signature),
      thanhCong: String(p.resultCode) === '0',
      maDon: String(p.orderId ?? ''),
      soTien: Number(p.amount),
      maGD: String(p.transId ?? ''),
      thoiGian: gioVnChu(Number(p.responseTime)),
      loi: String(p.message ?? ''),
    };
  }
}

// ------------------------------------------------------------------ ZaloPay (API v2)

class ZaloPay {
  constructor(c, f) {
    this.c = c;
    this.f = f;
    this.ten = 'zalopay';
    this.nhan = 'ZaloPay';
  }

  get host() { return this.c.moiTruong === 'that' ? 'https://openapi.zalopay.vn' : 'https://sb-openapi.zalopay.vn'; }

  async _goi(duong, thamSo) {
    const res = await this.f(this.host + duong, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(thamSo).toString(),
      signal: AbortSignal.timeout(30000),
    });
    return docJson(res, 'ZaloPay');
  }

  /** maDon được ghép thành app_trans_id "yymmdd_<maDon>" theo ngày giờ Việt Nam như ZaloPay yêu cầu. */
  async taoDon({ maDon, soTien, moTa, urlVe, urlIpn, nguoiDung, bayGio = Date.now() }) {
    const c = this.c;
    const appTransId = gioVnSo(bayGio).slice(2, 8) + '_' + maDon;
    const d = {
      app_id: c.appId, app_user: nguoiDung || 'khach', app_trans_id: appTransId, app_time: bayGio, amount: soTien,
      item: '[]', embed_data: JSON.stringify({ redirecturl: urlVe }), description: chuSach(moTa, 200),
      bank_code: '', callback_url: urlIpn,
    };
    d.mac = hmac('sha256', c.key1, [d.app_id, d.app_trans_id, d.app_user, d.amount, d.app_time, d.embed_data, d.item].join('|'));
    const kq = await this._goi('/v2/create', d);
    if (Number(kq.return_code) !== 1 || !kq.order_url) {
      throw new Error(`ZaloPay không tạo được đơn (${kq.return_code}/${kq.sub_return_code}): ${kq.sub_return_message || kq.return_message || ''}`);
    }
    return { url: kq.order_url, maDon: appTransId };
  }

  /** Callback: { data: "<chuỗi JSON>", mac, type }, mac = HMAC-SHA256(key2, data). Chỉ gửi khi đã thu tiền. */
  docCallback(body) {
    const hopLe = typeof body.data === 'string' && bangNhau(hmac('sha256', this.c.key2, body.data), body.mac);
    let d = {};
    try { d = hopLe ? JSON.parse(body.data) : {}; } catch (e) { d = {}; }
    return {
      hopLe: hopLe && String(d.app_id) === String(this.c.appId),
      thanhCong: true,
      maDon: String(d.app_trans_id ?? ''),
      soTien: Number(d.amount),
      maGD: String(d.zp_trans_id ?? ''),
      thoiGian: gioVnChu(Number(d.server_time)),
    };
  }

  /** Trang về: checksum = HMAC-SHA256(key2, appid|apptransid|pmcid|bankcode|amount|discountamount|status). */
  docVe(q) {
    const chuoi = [q.appid, q.apptransid, q.pmcid, q.bankcode, q.amount, q.discountamount, q.status].join('|');
    return {
      hopLe: bangNhau(hmac('sha256', this.c.key2, chuoi), q.checksum),
      thanhCong: String(q.status) === '1',
      maDon: String(q.apptransid ?? ''),
      soTien: Number(q.amount),
      maGD: '',
    };
  }

  /** Hỏi trạng thái đơn (dùng khi khách về trước khi callback tới). */
  async truyVan(maDon) {
    const c = this.c;
    const kq = await this._goi('/v2/query', {
      app_id: c.appId, app_trans_id: maDon, mac: hmac('sha256', c.key1, [c.appId, maDon, c.key1].join('|')),
    });
    return {
      hopLe: true,
      thanhCong: Number(kq.return_code) === 1,
      dangXuLy: Number(kq.return_code) === 3 || kq.is_processing === true,
      maDon,
      soTien: Number(kq.amount),
      maGD: String(kq.zp_trans_id ?? ''),
      thoiGian: gioVnChu(Number(kq.server_time)),
    };
  }
}

// ------------------------------------------------------------------ VNPAY (phiên bản 2.1.0)

/** Chuỗi ký của VNPAY: sắp xếp theo tên, mã hoá kiểu form (khoảng trắng → "+"), nối bằng "&". */
function chuoiKyVnpay(p, boRong = true) {
  return Object.keys(p).sort()
    .filter(k => !boRong || (p[k] !== undefined && p[k] !== null && p[k] !== ''))
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(p[k] ?? '').replace(/%20/g, '+'))
    .join('&');
}

class VnPay {
  constructor(c) {
    this.c = c;
    this.ten = 'vnpay';
    this.nhan = 'VNPAY';
  }

  get host() {
    return this.c.moiTruong === 'that' ? 'https://pay.vnpay.vn/vpcpay.html' : 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
  }

  async taoDon({ maDon, soTien, moTa, urlVe, ipKhach, bayGio = Date.now() }) {
    const c = this.c;
    const p = {
      vnp_Version: '2.1.0', vnp_Command: 'pay', vnp_TmnCode: c.tmnCode, vnp_Amount: Math.round(soTien) * 100,
      vnp_CurrCode: 'VND', vnp_TxnRef: maDon, vnp_OrderInfo: chuSach(moTa, 255), vnp_OrderType: 'billpayment',
      vnp_Locale: 'vn', vnp_ReturnUrl: urlVe, vnp_IpAddr: ipKhach || '127.0.0.1',
      vnp_CreateDate: gioVnSo(bayGio), vnp_ExpireDate: gioVnSo(bayGio + 15 * 60e3),
    };
    if (c.maNganHang) p.vnp_BankCode = c.maNganHang;
    const q = chuoiKyVnpay(p);
    return { url: `${this.host}?${q}&vnp_SecureHash=${hmac('sha512', c.hashSecret, q)}`, maDon };
  }

  /** IPN và trang về: cùng các tham số vnp_* trên query, ký HMAC-SHA512. */
  docKetQua(q) {
    const p = {};
    for (const k of Object.keys(q)) if (k.startsWith('vnp_') && k !== 'vnp_SecureHash' && k !== 'vnp_SecureHashType') p[k] = q[k];
    const ky = q.vnp_SecureHash;
    const hopLe = String(p.vnp_TmnCode) === String(this.c.tmnCode)
      && (bangNhau(hmac('sha512', this.c.hashSecret, chuoiKyVnpay(p)), ky)
        || bangNhau(hmac('sha512', this.c.hashSecret, chuoiKyVnpay(p, false)), ky));
    const ngay = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(p.vnp_PayDate || '');
    return {
      hopLe,
      thanhCong: p.vnp_ResponseCode === '00' && (p.vnp_TransactionStatus === undefined || p.vnp_TransactionStatus === '00'),
      maDon: String(p.vnp_TxnRef ?? ''),
      soTien: Number(p.vnp_Amount) / 100,
      maGD: String(p.vnp_TransactionNo ?? ''),
      thoiGian: ngay ? `${ngay[1]}-${ngay[2]}-${ngay[3]} ${ngay[4]}:${ngay[5]}:${ngay[6]}` : '',
      loi: String(p.vnp_ResponseCode ?? ''),
    };
  }
}

/** Các cổng đã khai đủ khoá trong .env, theo thứ tự hiện cho khách. */
function taoCacCong(cfgCong, f = globalThis.fetch) {
  const ds = {};
  const { momo, zalopay, vnpay } = cfgCong;
  if (momo.partnerCode && momo.accessKey && momo.secretKey) ds.momo = new MoMo(momo, f);
  if (zalopay.appId && zalopay.key1 && zalopay.key2) ds.zalopay = new ZaloPay(zalopay, f);
  if (vnpay.tmnCode && vnpay.hashSecret) ds.vnpay = new VnPay(vnpay);
  return ds;
}

module.exports = { taoCacCong, MoMo, ZaloPay, VnPay, chuoiKyVnpay, chuSach, gioVnSo, hmac };
