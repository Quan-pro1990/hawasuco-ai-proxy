'use strict';
// Dùng chung cho các file test: cấu hình tạm, fetch giả của Zalo.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { taiCauHinh } = require('../src/cauhinh');

function cauHinhThu(them = {}) {
  const thuMuc = fs.mkdtempSync(path.join(os.tmpdir(), 'zalo-eos-'));
  const cfg = taiCauHinh({
    THU_MUC_DU_LIEU: thuMuc,
    URL_CONG_KHAI: 'https://zalo.vidu.vn',
    KHOA_QUAN_TRI: 'khoa-bi-mat',
    ZALO_APP_ID: '1234567890',
    ZALO_SECRET_KEY: 'app-secret',
    ZALO_OA_SECRET_KEY: 'oa-secret',
    TEN_CONG_TY: 'Công ty Cấp nước Thử',
    SDT_CSKH: '1900 0000',
    ...them,
  }, path.join(thuMuc, 'khong-co.env'));
  return cfg;
}

/** Ghi sẵn token Zalo còn hạn để test không phải qua bước cấp quyền. */
function ghiToken(cfg, token = {}) {
  fs.writeFileSync(path.join(cfg.thuMucDuLieu, 'zalo-token.json'), JSON.stringify({
    access_token: 'AT-1', refresh_token: 'RT-1', het_han: Date.now() + 20 * 3600e3, ...token,
  }));
}

/** fetch giả của Zalo: ghi lại mọi yêu cầu; xuLy(url, opts) trả về JSON (mặc định thành công). */
function zaloGia(xuLy = () => null) {
  const goi = [];
  let soToken = 1;
  const f = async (url, opts = {}) => {
    const muc = { url: String(url), opts, json: null };
    if (opts.body && typeof opts.body === 'string' && opts.headers && /json/.test(opts.headers['Content-Type'] || '')) {
      muc.json = JSON.parse(opts.body);
    }
    goi.push(muc);
    let d = await xuLy(muc);
    if (d == null) {
      if (muc.url.includes('/v4/oa/access_token')) {
        soToken++;
        d = { access_token: 'AT-' + soToken, refresh_token: 'RT-' + soToken, expires_in: '90000' };
      } else if (muc.url.includes('/upload/file')) d = { error: 0, message: 'Success', data: { token: 'FILE-TOKEN' } };
      else d = { error: 0, message: 'Success', data: { message_id: 'm' + goi.length } };
    }
    return new Response(JSON.stringify(d), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  f.goi = goi;
  f.tinDaGui = () => goi.filter(g => g.url.endsWith('/v3.0/oa/message/cs')).map(g => g.json);
  return f;
}

/** Bên gửi giả cho HoiThoai: gom tin chữ và file. */
function guiGia() {
  const tin = [];
  return {
    tin,
    chu: async (uid, text) => { tin.push({ uid, text }); },
    file: async (uid, tep) => { tin.push({ uid, tep }); },
    cuoi: () => tin[tin.length - 1],
  };
}

module.exports = { cauHinhThu, ghiToken, zaloGia, guiGia };
