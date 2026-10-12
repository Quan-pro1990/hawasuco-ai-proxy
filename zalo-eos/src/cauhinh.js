'use strict';
// Đọc cấu hình từ file .env trong thư mục zalo-eos (không cần thư viện dotenv).
// Biến môi trường có sẵn (vd khai trong web.config của IIS) được ưu tiên hơn file .env.
const fs = require('fs');
const path = require('path');

const GOC = path.join(__dirname, '..');

/** Đọc file KEY=VALUE; dòng bắt đầu bằng # là ghi chú. Thiếu file thì trả về {}. */
function docEnv(tep) {
  const kq = {};
  let noiDung;
  try { noiDung = fs.readFileSync(tep, 'utf8'); } catch (e) { return kq; }
  for (const dong of noiDung.replace(/^﻿/, '').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(dong);
    if (!m) continue;
    let v = m[2];
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, '');   // ghi chú cuối dòng: "abc   # ghi chú"
    kq[m[1]] = v;
  }
  return kq;
}

function taiCauHinh(env = process.env, tepEnv = path.join(GOC, '.env')) {
  const f = docEnv(tepEnv);
  const g = (k, md = '') => {
    if (env[k] != null && env[k] !== '') return String(env[k]);
    if (f[k] != null && f[k] !== '') return f[k];
    return md;
  };
  // đường dẫn API EOS: ghi "khong" để bỏ hẳn bước đó (vd EOS không có API tải PDF)
  const duong = (k, md) => (/^(khong|-)$/i.test(g(k)) ? '' : g(k, md));
  const so = (k, md) => {
    const n = Number(g(k));
    return g(k) !== '' && Number.isFinite(n) ? n : md;
  };

  return {
    // IIS (ASP.NET Core Module) tự đặt ASPNETCORE_PORT khi chạy node qua web.config
    cong: so('ASPNETCORE_PORT', 0) || so('PORT', 3000),
    sauIis: g('ASPNETCORE_PORT') !== '',
    urlCongKhai: g('URL_CONG_KHAI').replace(/\/+$/, ''),
    khoaQuanTri: g('KHOA_QUAN_TRI'),
    thuMucDuLieu: path.resolve(GOC, g('THU_MUC_DU_LIEU', 'du-lieu')),
    tenCongTy: g('TEN_CONG_TY', 'Công ty Cấp nước'),
    sdtCskh: g('SDT_CSKH'),
    soKyLichSu: so('SO_KY_LICH_SU', 6),

    zalo: {
      appId: g('ZALO_APP_ID'),
      secretKey: g('ZALO_SECRET_KEY'),
      oaSecretKey: g('ZALO_OA_SECRET_KEY'),
      kiemChuKy: g('ZALO_KIEM_CHU_KY', '1') !== '0',
    },

    eos: {
      cheDo: g('EOS_CHE_DO', 'mau').toLowerCase(),
      url: g('EOS_URL').replace(/\/+$/, ''),
      xacThuc: g('EOS_XAC_THUC', 'khong').toLowerCase(),
      khoa: g('EOS_KHOA'),
      tenHeader: g('EOS_TEN_HEADER', 'X-API-Key'),
      taiKhoan: g('EOS_TAI_KHOAN'),
      matKhau: g('EOS_MAT_KHAU'),
      truongTaiKhoan: g('EOS_TRUONG_TAI_KHOAN', 'username'),
      truongMatKhau: g('EOS_TRUONG_MAT_KHAU', 'password'),
      phutToken: so('EOS_PHUT_TOKEN', 50),
      thoiGianCho: so('EOS_THOI_GIAN_CHO', 15000),
      duong: {
        dangNhap: duong('EOS_DUONG_DANG_NHAP', 'POST /api/auth/login'),
        khachHang: duong('EOS_DUONG_KHACH_HANG', '/api/khachhang/{maKH}'),
        lichSu: duong('EOS_DUONG_LICH_SU', '/api/khachhang/{maKH}/tieuthu?soKy={soKy}'),
        hoaDon: duong('EOS_DUONG_HOA_DON', '/api/khachhang/{maKH}/hoadon?soKy={soKy}'),
        taiHoaDon: duong('EOS_DUONG_TAI_HOA_DON', '/api/hoadon/{soHD}/pdf'),
      },
    },
  };
}

/** Những mục cấu hình còn thiếu, để báo khi khởi động. */
function kiemTraThieu(cfg) {
  const thieu = [];
  if (!cfg.urlCongKhai) thieu.push('URL_CONG_KHAI');
  if (!cfg.khoaQuanTri) thieu.push('KHOA_QUAN_TRI');
  if (!cfg.zalo.appId) thieu.push('ZALO_APP_ID');
  if (!cfg.zalo.secretKey) thieu.push('ZALO_SECRET_KEY');
  if (cfg.zalo.kiemChuKy && !cfg.zalo.oaSecretKey) thieu.push('ZALO_OA_SECRET_KEY');
  if (cfg.eos.cheDo === 'api' && !cfg.eos.url) thieu.push('EOS_URL');
  return thieu;
}

module.exports = { taiCauHinh, kiemTraThieu, docEnv, GOC };
