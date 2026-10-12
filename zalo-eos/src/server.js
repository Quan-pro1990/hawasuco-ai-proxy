'use strict';
// Máy chủ trung gian Zalo OA ↔ EOS.
//   POST /zalo/webhook          Zalo gửi sự kiện (khách nhắn tin, quan tâm / bỏ quan tâm OA)
//   GET  /zalo/cap-quyen?khoa=  quản trị viên OA cấp quyền cho máy chủ (làm 1 lần)
//   GET  /zalo/callback         Zalo chuyển về sau khi cấp quyền
//   GET  /tai/<mã>              tải hoá đơn / ảnh QR qua liên kết tạm (khi không gửi thẳng được qua Zalo)
//   GET  /tt/<khoá>             trang thanh toán của khách (nút Ví MoMo / ZaloPay / VNPAY, mã QR chuyển khoản)
//   POST /tt/<khoá>/<cổng>      tạo đơn ở cổng rồi chuyển khách sang cổng; GET /tt/<khoá>/qr.png: ảnh VietQR
//   /cong/<momo|zalopay|vnpay>/ipn   cổng báo kết quả thanh toán (MoMo, ZaloPay: POST; VNPAY: GET)
//   GET  /cong/<cổng>/ve        khách thanh toán xong, cổng chuyển về
//   POST /thanh-toan/webhook    ngân hàng / dịch vụ báo số dư báo có tiền chuyển vào tài khoản thu tiền nước
//   GET  /thanh-toan/doi-soat?khoa=&tu=&den=   file Excel các khoản đã nhận để kế toán đối soát
//   GET  /trang-thai?khoa=      tình trạng token Zalo, số khách đã liên kết
//   GET  /<tệp>.html|.txt       tệp trong thư mục public (tệp xác thực tên miền của Zalo)
// Chạy: node src/server.js — hoặc để IIS chạy qua iis/web.config.
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { taiCauHinh, kiemTraThieu, GOC } = require('./cauhinh');
const { taoEos } = require('./eos');
const { HoiThoai } = require('./hoithoai');
const { TepTam } = require('./kho');
const { ThanhToan } = require('./thanhtoan');
const { taoQrPng } = require('./qrcode');
const { trangThanhToan, trangThongBao } = require('./trangthanhtoan');
const { log } = require('./tienich');
const { Zalo, kiemChuKy, TOI_DA_FILE } = require('./zalo');

const THU_MUC_PUBLIC = path.join(GOC, 'public');

/** Gửi tin / file / ảnh qua Zalo; file, ảnh không gửi thẳng được thì gửi liên kết tải tạm. */
function taoGui(cfg, zalo, tepTam) {
  const lienKetTam = (uid, tep, loai, moTa) => {
    if (!cfg.urlCongKhai) throw new Error('Chưa khai URL_CONG_KHAI nên không tạo được liên kết tải');
    const ma = tepTam.them({ duLieu: tep.duLieu, ten: tep.ten, loai });
    return zalo.guiChu(uid, `${moTa} (liên kết dùng được ${tepTam.phutGiu} phút):\n${cfg.urlCongKhai}/tai/${ma}`);
  };
  return {
    chu: (uid, text) => zalo.guiChu(uid, text),
    file: async (uid, tep) => {
      if (tep.duLieu) {
        if (tep.duLieu.length <= TOI_DA_FILE) {
          try {
            return await zalo.guiFile(uid, tep.duLieu, tep.ten);
          } catch (e) {
            log('Không gửi được file qua Zalo, chuyển sang gửi liên kết tải:', e.message);
          }
        }
        return lienKetTam(uid, tep, 'application/pdf', 'Tải file hoá đơn');
      }
      if (tep.url) return zalo.guiChu(uid, 'Xem / tải hoá đơn tại:\n' + tep.url);
    },
    anh: async (uid, tep) => {
      try {
        return await zalo.guiAnh(uid, tep.duLieu, tep.ten);
      } catch (e) {
        log('Không gửi được ảnh qua Zalo, chuyển sang gửi liên kết:', e.message);
      }
      return lienKetTam(uid, tep, 'image/png', 'Mở ảnh mã QR thanh toán');
    },
  };
}

function taoXuLy({ cfg, zalo, hoiThoai, tepTam, thanhToan }) {
  const guiChu = (uid, text) => zalo.guiChu(uid, text);

  /** Trang thanh toán, ảnh QR, và nút chuyển sang cổng. */
  async function trangTT(req, res, url, link, phan) {
    const tim = thanhToan.timTheoLink(link);
    if (!tim) {
      return traTrang(res, 404, trangThongBao('Không tìm thấy', 'Liên kết thanh toán không đúng hoặc đã quá hạn. '
        + 'Gửi THANH TOAN cho OA trên Zalo để nhận liên kết mới.'));
    }
    const [ma, yc] = tim;
    if (!phan && req.method === 'GET') {
      const c = cfg.thanhToan;
      return traTrang(res, 200, trangThanhToan({
        tenCongTy: cfg.tenCongTy, sdtCskh: cfg.sdtCskh, ma, yc, link, dsCong: thanhToan.dsCong, kq: url.searchParams.get('kq'),
        vietQr: thanhToan.vietQr
          ? { tenNganHang: c.tenNganHang, soTaiKhoan: c.soTaiKhoan, tenTaiKhoan: c.tenTaiKhoan, noiDung: thanhToan.noiDungCk(ma, yc) }
          : null,
      }));
    }
    if (phan === 'qr.png' && req.method === 'GET' && thanhToan.vietQr) {
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
      return res.end(taoQrPng(thanhToan.chuoiQr(ma, yc)));
    }
    if (thanhToan.cong[phan] && req.method === 'POST') {
      try {
        const r = await thanhToan.taoDonCong(link, phan, ipKhach(req));
        res.writeHead(303, { Location: r.daThanhToan ? `/tt/${link}` : r.url });
        return res.end();
      } catch (e) {
        log(`Không tạo được đơn ${phan}:`, e.message);
        return traTrang(res, 502, trangThongBao('Chưa mở được cổng thanh toán',
          'Cổng thanh toán đang bận. Vui lòng quay lại và thử lại sau ít phút, hoặc chọn cách thanh toán khác.'));
      }
    }
    return traChu(res, 404, 'Không có địa chỉ này.');
  }

  /** Cổng báo kết quả (ipn) hoặc chuyển khách về (ve). Ghi nhận chỉ khi đúng chữ ký; báo lặp lại không ghi 2 lần. */
  async function ketQuaCong(req, res, url, ten, loai) {
    const cong = thanhToan.cong[ten];
    if (!cong) return traChu(res, 404, 'Cổng thanh toán này chưa bật.');
    const q = Object.fromEntries(url.searchParams);

    if (loai === 'ipn' && ten === 'momo' && req.method === 'POST') {
      let body;
      try { body = JSON.parse(await docThan(req, 1 << 20)); } catch (e) { return traJson(res, 400, { message: 'Không phải JSON' }); }
      const r = await thanhToan.ketQuaCong('momo', cong.docKetQua(body), guiChu);
      log('IPN MoMo:', r.kq, body.orderId || '');
      if (r.kq === 'sai_chu_ky') return traJson(res, 400, { message: 'Sai chữ ký' });
      res.writeHead(204);
      return res.end();
    }
    if (loai === 'ipn' && ten === 'zalopay' && req.method === 'POST') {
      try {
        const r = await thanhToan.ketQuaCong('zalopay', cong.docCallback(JSON.parse(await docThan(req, 1 << 20))), guiChu);
        log('Callback ZaloPay:', r.kq);
        const [code, msg] = { sai_chu_ky: [-1, 'mac not equal'], khong_thay_don: [-1, 'order not found'],
          da_nhan: [2, 'Order already confirmed'] }[r.kq] || [1, 'success'];
        return traJson(res, 200, { return_code: code, return_message: msg });
      } catch (e) {
        log('Lỗi callback ZaloPay:', e.message);
        return traJson(res, 200, { return_code: 0, return_message: 'Lỗi tạm thời, gửi lại sau' });   // ZaloPay gửi lại
      }
    }
    if (loai === 'ipn' && ten === 'vnpay' && req.method === 'GET') {
      try {
        const r = await thanhToan.ketQuaCong('vnpay', cong.docKetQua(q), guiChu);
        log('IPN VNPAY:', r.kq, q.vnp_TxnRef || '');
        const [RspCode, Message] = { sai_chu_ky: ['97', 'Invalid signature'], khong_thay_don: ['01', 'Order not found'],
          da_nhan: ['02', 'Order already confirmed'], thieu: ['04', 'Invalid amount'], thua: ['04', 'Invalid amount'] }[r.kq]
          || ['00', 'Confirm Success'];
        return traJson(res, 200, { RspCode, Message });
      } catch (e) {
        log('Lỗi IPN VNPAY:', e.message);
        return traJson(res, 200, { RspCode: '99', Message: 'Unknown error' });
      }
    }
    if (loai !== 've' || req.method !== 'GET') return traChu(res, 405, 'Sai phương thức');

    let r;
    let maDon;
    if (ten === 'zalopay') {
      const v = cong.docVe(q);
      maDon = v.maDon;
      r = { kq: v.hopLe ? (v.thanhCong ? 'cho' : 'that_bai') : 'sai_chu_ky' };
      if (v.hopLe && v.thanhCong) {
        // trang về không có mã giao dịch ZaloPay: hỏi ZaloPay để ghi nhận ngay nếu callback chưa tới
        try {
          const tv = await cong.truyVan(v.maDon);
          if (tv.thanhCong) r = await thanhToan.ketQuaCong('zalopay', tv, guiChu);
        } catch (e) { log('Không hỏi được trạng thái đơn ZaloPay:', e.message); }
      }
    } else {
      const v = cong.docKetQua(q);
      maDon = v.maDon;
      r = await thanhToan.ketQuaCong(ten, v, guiChu);
    }
    const link = r.link || thanhToan.linkTuDon(maDon);
    if (!link) return traTrang(res, 400, trangThongBao('Không xác định được giao dịch', 'Vui lòng mở lại liên kết thanh toán trong Zalo.'));
    const kq = r.kq === 'that_bai' ? 'loi' : ['du', 'thua', 'thieu', 'trung', 'da_nhan'].includes(r.kq) ? 'ok' : 'cho';
    res.writeHead(303, { Location: `/tt/${link}?kq=${kq}` });
    return res.end();
  }

  return async function xuLy(req, res) {
    try {
      const url = new URL(req.url, 'http://may-chu');
      const p = url.pathname.replace(/\/+$/, '') || '/';
      const m = req.method;

      if (p === '/zalo/webhook' && m === 'POST') {
        const than = await docThan(req, 1 << 20);
        if (cfg.zalo.kiemChuKy && !kiemChuKy(cfg.zalo, than, req.headers['x-zevent-signature'])) {
          log('Từ chối sự kiện webhook: sai chữ ký (kiểm tra ZALO_OA_SECRET_KEY, ZALO_APP_ID).');
          return traChu(res, 401, 'Sai chữ ký');
        }
        let sk;
        try { sk = JSON.parse(than); } catch (e) { return traChu(res, 400, 'Không phải JSON'); }
        traChu(res, 200, 'ok');   // trả lời Zalo ngay, xử lý sau để Zalo không gửi lại vì chờ lâu
        hoiThoai.xuLySuKien(sk).catch(e => log(`Lỗi xử lý sự kiện ${sk.event_name}:`, e.message));
        return;
      }

      if (p === '/zalo/webhook' && m === 'GET') return traChu(res, 200, 'ok');

      if (p === '/zalo/cap-quyen' && m === 'GET') {
        if (!dungKhoa(cfg, url)) return traChu(res, 403, 'Sai hoặc thiếu ?khoa= (KHOA_QUAN_TRI trong .env)');
        if (!cfg.urlCongKhai || !cfg.zalo.appId || !cfg.zalo.secretKey) {
          return traChu(res, 500, 'Thiếu URL_CONG_KHAI / ZALO_APP_ID / ZALO_SECRET_KEY trong .env');
        }
        res.writeHead(302, { Location: zalo.taoLinkCapQuyen(cfg.urlCongKhai + '/zalo/callback') });
        return res.end();
      }

      if (p === '/zalo/callback' && m === 'GET') {
        const code = url.searchParams.get('code');
        if (!code) return traHtml(res, 400, 'Chưa cấp quyền', 'Zalo không trả mã cấp quyền (có thể quản trị viên đã bấm từ chối).');
        await zalo.nhanCode(code, url.searchParams.get('state'));
        log('Đã cấp quyền Zalo OA', url.searchParams.get('oa_id') || '');
        return traHtml(res, 200, 'Đã cấp quyền',
          'Máy chủ đã nhận quyền gửi tin của Official Account. Token sẽ tự làm mới, không cần làm lại bước này '
          + '(trừ khi máy chủ ngừng chạy quá 3 tháng hoặc OA gỡ quyền ứng dụng).');
      }

      if (p.startsWith('/tai/') && (m === 'GET' || m === 'HEAD')) {
        const tep = tepTam.lay(p.slice(5));
        if (!tep) return traChu(res, 404, 'Liên kết đã hết hạn — gửi lại lệnh trên Zalo để nhận liên kết mới.');
        res.writeHead(200, {
          'Content-Type': tep.loai || 'application/pdf',
          'Content-Length': tep.duLieu.length,
          'Content-Disposition': `inline; filename="${tep.ten.replace(/[^\w.-]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(tep.ten)}`,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        return res.end(m === 'HEAD' ? undefined : tep.duLieu);
      }

      if (p === '/thanh-toan/webhook' && m === 'POST') {
        if (!thanhToan.vietQr || !thanhToan.coWebhook) return traJson(res, 404, { success: false, message: 'Chưa bật nhận báo thanh toán' });
        const than = await docThan(req, 1 << 20);
        if (!thanhToan.kiemKhoa(req.headers[cfg.thanhToan.headerWebhook.toLowerCase()])) {
          log('Từ chối báo thanh toán: sai khoá (kiểm tra TT_KHOA_WEBHOOK, TT_HEADER_WEBHOOK).');
          return traJson(res, 401, { success: false, message: 'Sai khoá' });
        }
        let d;
        try { d = JSON.parse(than); } catch (e) { return traJson(res, 400, { success: false, message: 'Không phải JSON' }); }
        const kq = await thanhToan.nhanWebhook(d, (uid, text) => zalo.guiChu(uid, text));
        return traJson(res, 200, { success: true, ketQua: kq.map(k => k.kq) });
      }

      if (p === '/thanh-toan/doi-soat' && m === 'GET') {
        if (!dungKhoa(cfg, url)) return traChu(res, 403, 'Sai hoặc thiếu ?khoa= (KHOA_QUAN_TRI trong .env)');
        const ngay = k => (/^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get(k) || '') ? url.searchParams.get(k) : '');
        const tu = ngay('tu');
        const den = ngay('den');
        const xlsx = thanhToan.doiSoatXlsx(tu, den);
        res.writeHead(200, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="DoiSoat_${tu || 'dau'}_${den || 'nay'}.xlsx"`,
          'Cache-Control': 'no-store',
        });
        return res.end(xlsx);
      }

      const tt = /^\/tt\/([A-Za-z0-9_-]{16,64})(?:\/(qr\.png|momo|zalopay|vnpay))?$/.exec(p);
      if (tt) return await trangTT(req, res, url, tt[1], tt[2]);
      const cg = /^\/cong\/(momo|zalopay|vnpay)\/(ipn|ve)$/.exec(p);
      if (cg) return await ketQuaCong(req, res, url, cg[1], cg[2]);

      if (p === '/trang-thai' && m === 'GET') {
        if (!dungKhoa(cfg, url)) return traChu(res, 403, 'Sai hoặc thiếu ?khoa= (KHOA_QUAN_TRI trong .env)');
        return traJson(res, 200, {
          zalo: zalo.trangThai(),
          eos: cfg.eos.cheDo,
          soTaiKhoanZaloDaLienKet: hoiThoai.soNguoiLienKet(),
          thanhToan: {
            vietQr: thanhToan.vietQr,
            xacNhanChuyenKhoanTuDong: thanhToan.vietQr && thanhToan.coWebhook,
            cong: Object.fromEntries(thanhToan.dsCong.map(c => [c.ten, c.c.moiTruong === 'that' ? 'thật' : 'thử'])),
          },
          thieuCauHinh: kiemTraThieu(cfg),
        });
      }

      if (p === '/' && m === 'GET') return traChu(res, 200, 'Máy chủ Zalo OA - EOS đang chạy.');

      // tệp xác thực tên miền Zalo cấp (vd zalo_verifierXXXX.html) đặt trong thư mục public
      const tenTep = p.slice(1);
      if (m === 'GET' && /^[\w.-]+\.(html|txt)$/.test(tenTep)) {
        const tep = path.join(THU_MUC_PUBLIC, tenTep);
        if (fs.existsSync(tep)) {
          res.writeHead(200, { 'Content-Type': (tenTep.endsWith('.html') ? 'text/html' : 'text/plain') + '; charset=utf-8' });
          return res.end(fs.readFileSync(tep));
        }
      }

      return traChu(res, 404, 'Không có địa chỉ này.');
    } catch (e) {
      log('Lỗi', req.method, req.url.split('?')[0], e.message);
      if (!res.headersSent) traChu(res, e.maTrang || 500, e.maTrang ? e.message : 'Lỗi máy chủ: ' + e.message);
    }
  };
}

function dungKhoa(cfg, url) {
  const k = url.searchParams.get('khoa') || '';
  if (!cfg.khoaQuanTri || !k) return false;
  const a = crypto.createHash('sha256').update(k).digest();
  const b = crypto.createHash('sha256').update(cfg.khoaQuanTri).digest();
  return crypto.timingSafeEqual(a, b);
}

function docThan(req, toiDa) {
  return new Promise((ok, loi) => {
    const phan = [];
    let co = 0;
    req.on('data', c => {
      co += c.length;
      if (co > toiDa) {
        const e = new Error('Yêu cầu quá lớn');
        e.maTrang = 413;
        loi(e);
        req.destroy();
      } else phan.push(c);
    });
    req.on('end', () => ok(Buffer.concat(phan).toString('utf8')));
    req.on('error', loi);
  });
}

function traChu(res, ma, text) {
  res.writeHead(ma, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function traJson(res, ma, d) {
  res.writeHead(ma, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(d, null, 2));
}

function traTrang(res, ma, html) {
  res.writeHead(ma, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY' });
  res.end(html);
}

/** IP của khách (VNPAY yêu cầu): sau IIS lấy từ X-Forwarded-For. */
function ipKhach(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',').map(x => x.trim()).filter(Boolean);
  return (xff.pop() || req.socket.remoteAddress || '127.0.0.1').replace(/^::ffff:/, '').replace(/:\d+$/, '');
}

function traHtml(res, ma, tieuDe, noiDung) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  res.writeHead(ma, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<title>${esc(tieuDe)}</title><body style="font-family:system-ui,sans-serif;max-width:560px;margin:40px auto;padding:0 16px">`
    + `<h2>${esc(tieuDe)}</h2><p>${esc(noiDung)}</p></body>`);
}

/** Dựng toàn bộ máy chủ; phuThuoc cho phép test thay fetch / đồng hồ. */
function taoMayChu(cfg, phuThuoc = {}) {
  const zalo = new Zalo(cfg, phuThuoc);
  const eos = taoEos(cfg, phuThuoc.eos || {});
  const tepTam = new TepTam(30, phuThuoc.bayGio);
  const thanhToan = new ThanhToan({ cfg, eos, bayGio: phuThuoc.bayGio, fetch: phuThuoc.fetch });
  const hoiThoai = new HoiThoai({ cfg, eos, gui: taoGui(cfg, zalo, tepTam), thanhToan, bayGio: phuThuoc.bayGio });
  const server = http.createServer(taoXuLy({ cfg, zalo, hoiThoai, tepTam, thanhToan }));
  return { server, zalo, eos, hoiThoai, tepTam, thanhToan };
}

function chay() {
  const cfg = taiCauHinh();
  const thieu = kiemTraThieu(cfg);
  if (thieu.length) log('CẢNH BÁO: .env còn thiếu', thieu.join(', '));
  if (!cfg.zalo.kiemChuKy) log('CẢNH BÁO: đang TẮT kiểm chữ ký webhook (ZALO_KIEM_CHU_KY=0) — chỉ dùng khi thử nghiệm.');
  if (cfg.eos.cheDo === 'mau') log('EOS đang ở chế độ DỮ LIỆU MẪU (EOS_CHE_DO=mau).');
  const { server, zalo, thanhToan } = taoMayChu(cfg);
  for (const c of thanhToan.dsCong) {
    log(`Cổng ${c.nhan}: ` + (c.c.moiTruong === 'that' ? 'môi trường THẬT' : 'môi trường THỬ (sandbox) — đổi *_MOI_TRUONG=that khi thu tiền thật'));
  }
  // Mỗi giờ kiểm token 1 lần: token được làm mới đều đặn kể cả khi ít khách nhắn,
  // nên refresh token (hạn 3 tháng) không bao giờ hết hạn khi máy chủ còn chạy.
  setInterval(() => {
    if (!zalo.trangThai().daCapQuyen) return;
    zalo.layAccessToken().catch(e => log('Không làm mới được token Zalo:', e.message));
  }, 3600e3).unref();
  server.listen(cfg.cong, cfg.sauIis ? '127.0.0.1' : undefined, () => {
    log(`Máy chủ Zalo OA - EOS chạy ở cổng ${cfg.cong}` + (cfg.sauIis ? ' (sau IIS)' : '')
      + `. Dữ liệu: ${cfg.thuMucDuLieu}`);
  });
}

process.on('unhandledRejection', e => log('Lỗi chưa xử lý:', e && e.message ? e.message : e));

if (require.main === module) chay();

module.exports = { taoMayChu, taoXuLy, taoGui };
