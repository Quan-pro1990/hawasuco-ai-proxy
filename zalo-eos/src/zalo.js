'use strict';
// Gọi Zalo Official Account API:
//  - cấp quyền lần đầu bằng OAuth v4 + PKCE (quản trị viên OA bấm đồng ý 1 lần),
//  - tự làm mới access token (hạn ~25 giờ) bằng refresh token (hạn 3 tháng, mỗi refresh token chỉ dùng 1 lần),
//  - gửi tin tư vấn dạng chữ, gửi file PDF / ảnh (tải lên Zalo lấy token / attachment_id rồi gửi),
//  - kiểm chữ ký sự kiện webhook (header X-ZEvent-Signature).
const crypto = require('crypto');
const path = require('path');
const { TepJson } = require('./kho');

const OAUTH = 'https://oauth.zaloapp.com/v4/oa';
const OPENAPI = 'https://openapi.zalo.me';
const MA_LOI_TOKEN = new Set([-216, -124]);   // access token sai / hết hạn → làm mới rồi gọi lại 1 lần
const TOI_DA_KY_TU = 2000;                      // giới hạn 1 tin tư vấn dạng chữ
const TOI_DA_FILE = 5 * 1024 * 1024;            // giới hạn file tải lên Zalo
const TOI_DA_ANH = 1024 * 1024;                 // giới hạn ảnh tải lên Zalo

class LoiZalo extends Error {
  constructor(thongBao, ma, chiTiet) {
    super(thongBao);
    this.ma = ma;
    this.chiTiet = chiTiet;
  }
}

function base64url(buf) { return Buffer.from(buf).toString('base64url'); }

class Zalo {
  constructor(cfg, { fetch: f = globalThis.fetch, bayGio = Date.now } = {}) {
    this.c = cfg.zalo;
    this.f = f;
    this.bayGio = bayGio;
    this.tepToken = new TepJson(path.join(cfg.thuMucDuLieu, 'zalo-token.json'), {});
    this.choCapQuyen = new Map();   // state → { verifier, het }
    this._dangLamMoi = null;
  }

  // ---------------------------------------------------------------- cấp quyền lần đầu

  taoLinkCapQuyen(redirectUri) {
    const verifier = base64url(crypto.randomBytes(32));
    const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
    const state = base64url(crypto.randomBytes(12));
    const t = this.bayGio();
    for (const [k, v] of this.choCapQuyen) if (v.het < t) this.choCapQuyen.delete(k);
    this.choCapQuyen.set(state, { verifier, het: t + 15 * 60e3 });
    const q = new URLSearchParams({ app_id: this.c.appId, redirect_uri: redirectUri, code_challenge: challenge, state });
    return OAUTH + '/permission?' + q;
  }

  async nhanCode(code, state) {
    const cho = this.choCapQuyen.get(state);
    this.choCapQuyen.delete(state);
    if (!cho || cho.het < this.bayGio()) {
      throw new LoiZalo('Phiên cấp quyền không hợp lệ hoặc đã quá 15 phút — mở lại trang cấp quyền.');
    }
    return this._layToken({ code, app_id: this.c.appId, grant_type: 'authorization_code', code_verifier: cho.verifier });
  }

  async _layToken(thamSo) {
    let res;
    try {
      res = await this.f(OAUTH + '/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', secret_key: this.c.secretKey },
        body: new URLSearchParams(thamSo).toString(),
      });
    } catch (e) {
      throw new LoiZalo('Không kết nối được oauth.zaloapp.com: ' + e.message);
    }
    const d = await docJson(res);
    if (!d.access_token) {
      const lyDo = d.error_description || d.error_name || d.message || JSON.stringify(d);
      const goiY = thamSo.grant_type === 'refresh_token'
        ? ' — nếu refresh token đã hết hạn (máy chủ ngừng quá 3 tháng) hoặc OA đã gỡ quyền, mở lại /zalo/cap-quyen.'
        : '';
      throw new LoiZalo('Zalo không cấp token: ' + lyDo + goiY, d.error, d);
    }
    // Ghi ngay ra đĩa: refresh token cũ đã mất hiệu lực, mất token mới là phải cấp quyền lại.
    const token = {
      access_token: d.access_token,
      refresh_token: d.refresh_token || thamSo.refresh_token,
      het_han: this.bayGio() + Number(d.expires_in || 90000) * 1000,
      cap_luc: new Date(this.bayGio()).toISOString(),
    };
    this.tepToken.ghi(token);
    return token;
  }

  /** Access token còn hạn; tokenHong = token vừa bị Zalo từ chối (khi đó bắt buộc làm mới). */
  async layAccessToken(tokenHong) {
    const t = this.tepToken.doc();
    if (!t.refresh_token) {
      throw new LoiZalo('Chưa cấp quyền Zalo OA cho máy chủ — mở <URL_CONG_KHAI>/zalo/cap-quyen?khoa=<KHOA_QUAN_TRI>.');
    }
    const conHan = t.access_token && t.het_han - 10 * 60e3 > this.bayGio();
    if (conHan && t.access_token !== tokenHong) return t.access_token;
    // Chỉ 1 lần làm mới tại 1 thời điểm: 2 yêu cầu cùng dùng 1 refresh token thì yêu cầu sau bị từ chối.
    if (!this._dangLamMoi) {
      this._dangLamMoi = this._layToken({ refresh_token: t.refresh_token, app_id: this.c.appId, grant_type: 'refresh_token' })
        .finally(() => { this._dangLamMoi = null; });
    }
    return (await this._dangLamMoi).access_token;
  }

  // ---------------------------------------------------------------- gọi API

  async goi(duong, { method = 'GET', json, formData, query } = {}) {
    let token = await this.layAccessToken();
    for (let lan = 0; ; lan++) {
      const headers = { access_token: token };
      let body;
      if (json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
      else if (formData) body = formData;
      const url = OPENAPI + duong + (query ? '?' + new URLSearchParams(query) : '');
      let res;
      try {
        res = await this.f(url, { method, headers, body });
      } catch (e) {
        throw new LoiZalo('Không kết nối được openapi.zalo.me: ' + e.message);
      }
      const d = await docJson(res);
      const ma = Number(d.error || 0);
      if (MA_LOI_TOKEN.has(ma) && lan === 0) { token = await this.layAccessToken(token); continue; }
      if (ma !== 0) throw new LoiZalo(`Zalo báo lỗi ${ma}: ${d.message || ''}`, ma, d);
      return d.data;
    }
  }

  /** Tin tư vấn dạng chữ; tin dài được cắt thành nhiều tin theo dòng. */
  async guiChu(userId, text) {
    for (const doan of chiaDoan(String(text), TOI_DA_KY_TU)) {
      await this.goi('/v3.0/oa/message/cs', {
        method: 'POST',
        json: { recipient: { user_id: userId }, message: { text: doan } },
      });
    }
  }

  /** Tải PDF lên Zalo rồi gửi cho khách dưới dạng file đính kèm. */
  async guiFile(userId, duLieu, tenFile) {
    if (duLieu.length > TOI_DA_FILE) throw new LoiZalo('File lớn hơn 5 MB, Zalo không nhận');
    const fd = new FormData();
    fd.append('file', new Blob([duLieu], { type: 'application/pdf' }), tenFile);
    const tl = await this.goi('/v2.0/oa/upload/file', { method: 'POST', formData: fd });
    if (!tl || !tl.token) throw new LoiZalo('Zalo không trả token của file vừa tải lên');
    await this.goi('/v3.0/oa/message/cs', {
      method: 'POST',
      json: { recipient: { user_id: userId }, message: { attachment: { type: 'file', payload: { token: tl.token } } } },
    });
  }

  /** Tải ảnh PNG lên Zalo rồi gửi cho khách (ảnh mã QR thanh toán). */
  async guiAnh(userId, duLieu, tenFile) {
    if (duLieu.length > TOI_DA_ANH) throw new LoiZalo('Ảnh lớn hơn 1 MB, Zalo không nhận');
    const fd = new FormData();
    fd.append('file', new Blob([duLieu], { type: 'image/png' }), tenFile);
    const tl = await this.goi('/v2.0/oa/upload/image', { method: 'POST', formData: fd });
    if (!tl || !tl.attachment_id) throw new LoiZalo('Zalo không trả attachment_id của ảnh vừa tải lên');
    await this.goi('/v3.0/oa/message/cs', {
      method: 'POST',
      json: {
        recipient: { user_id: userId },
        message: {
          attachment: {
            type: 'template',
            payload: { template_type: 'media', elements: [{ media_type: 'image', attachment_id: tl.attachment_id }] },
          },
        },
      },
    });
  }

  trangThai() {
    const t = this.tepToken.doc();
    return {
      daCapQuyen: !!t.refresh_token,
      capLuc: t.cap_luc || null,
      accessTokenHetHan: t.het_han ? new Date(t.het_han).toISOString() : null,
    };
  }
}

/**
 * Kiểm chữ ký sự kiện webhook: X-ZEvent-Signature = "mac=" + sha256(appId + thân yêu cầu + timestamp + OA Secret Key).
 * thân là chuỗi JSON đúng như Zalo gửi (không đọc rồi ghi lại), timestamp lấy trong thân.
 */
function kiemChuKy(c, than, chuKy) {
  if (!c.oaSecretKey || !chuKy) return false;
  let sk;
  try { sk = JSON.parse(than); } catch (e) { return false; }
  if (c.appId && sk.app_id != null && String(sk.app_id) !== String(c.appId)) return false;
  const appId = c.appId || String(sk.app_id ?? '');
  const mac = crypto.createHash('sha256')
    .update(appId + than + String(sk.timestamp ?? '') + c.oaSecretKey, 'utf8').digest('hex');
  const nhan = String(chuKy).trim().replace(/^mac\s*=\s*/i, '').toLowerCase();
  return nhan.length === mac.length && crypto.timingSafeEqual(Buffer.from(nhan), Buffer.from(mac));
}

async function docJson(res) {
  const chuoi = await res.text();
  try {
    return JSON.parse(chuoi);
  } catch (e) {
    throw new LoiZalo(`Zalo trả về không phải JSON (HTTP ${res.status}): ${chuoi.slice(0, 200)}`);
  }
}

/** Cắt chuỗi thành các đoạn ≤ toiDa ký tự, ưu tiên cắt ở chỗ xuống dòng. */
function chiaDoan(s, toiDa) {
  const kq = [];
  while (s.length > toiDa) {
    let cat = s.lastIndexOf('\n', toiDa);
    if (cat < toiDa / 2) cat = toiDa;
    kq.push(s.slice(0, cat));
    s = s.slice(cat).replace(/^\n/, '');
  }
  if (s) kq.push(s);
  return kq;
}

module.exports = { Zalo, LoiZalo, kiemChuKy, chiaDoan, TOI_DA_FILE };
