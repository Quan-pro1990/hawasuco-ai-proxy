// Trợ lý ảo giao tiếp bằng giọng nói — máy chủ trung gian (AI proxy).
// Giữ khoá API Anthropic ở phía máy chủ (file .env), phục vụ trang web nói/nghe, và nối với máy chủ thất thoát nước.
//
// Chạy:  node server.js        (cần Node.js 20.12 trở lên)

import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { MayChuThatThoat } from './lib/thatthoat.js';
import { TroLy, loiChoNguoiDung } from './lib/tro-ly.js';
import { XacThuc, LoiXacThuc } from './lib/xac-thuc.js';

const THU_MUC = path.dirname(fileURLToPath(import.meta.url));
const THU_MUC_WEB = path.join(THU_MUC, 'public');

// ------------------------------------------------------------------ cấu hình (.env)

const tepEnv = process.env.TRO_LY_ENV || path.join(THU_MUC, '.env');
if (fs.existsSync(tepEnv)) process.loadEnvFile(tepEnv);
const env = process.env;

function batBuoc(ten) {
  if (!env[ten]) {
    console.error('[LỖI] Chưa cài ' + ten + ' trong file .env (xem .env.example).');
    process.exit(1);
  }
  return env[ten];
}

const CAU_HINH = {
  model: env.TRO_LY_MODEL || 'claude-opus-5-5',
  effort: env.TRO_LY_EFFORT || 'low',
  cong: Number(env.CONG || 8090),
  diaChiNghe: env.DIA_CHI_NGHE || '0.0.0.0',
  timKiemWeb: env.TIM_KIEM_WEB === '1',
  gioiHanMoiGio: Number(env.GIOI_HAN_MOI_GIO || 120),
  doDaiCauHoi: 2000,
};
if (!['low', 'medium', 'high', 'xhigh', 'max'].includes(CAU_HINH.effort)) {
  console.error('[LỖI] TRO_LY_EFFORT phải là low, medium, high, xhigh hoặc max.');
  process.exit(1);
}
batBuoc('ANTHROPIC_API_KEY');

const mayChu = env.MAYCHU_DIACHI
  ? new MayChuThatThoat({ diaChi: env.MAYCHU_DIACHI, maNhanDang: env.MAYCHU_MANHANDANG })
  : null;
const xacThuc = new XacThuc({ mayChu, matKhau: env.TRO_LY_MAT_KHAU });

async function layTenCongTy() {
  if (env.TEN_CONG_TY) return env.TEN_CONG_TY.trim();
  if (mayChu) {
    try {
      const p = await mayChu.ping();
      if (p && p.congTy) return String(p.congTy).trim();
    } catch (e) {
      console.warn('[!] Chưa gọi được máy chủ thất thoát nước lúc khởi động: ' + e.message);
    }
  }
  return 'công ty cấp nước';
}

const tenCongTy = await layTenCongTy();
const troLy = new TroLy({
  client: new Anthropic(),   // đọc ANTHROPIC_API_KEY từ .env
  model: CAU_HINH.model,
  effort: CAU_HINH.effort,
  tenCongTy,
  coSoLieu: !!mayChu,
  timKiemWeb: CAU_HINH.timKiemWeb,
  mayChu,
  loiDanGoc: TroLy.docLoiDan(path.join(THU_MUC, 'loi-dan.txt')),
  duPhong: env.TRO_LY_DU_PHONG !== '0',
});

// ------------------------------------------------------------------ hội thoại (trong bộ nhớ)

const HOI_THOAI_HET_HAN = 2 * 3600 * 1000;
const hoiThoai = new Map();   // id → { chuSo, messages, dung, dangTraLoi }
const luotHoi = new Map();    // chuSo → [mốc thời gian các câu hỏi trong 1 giờ]

setInterval(() => {
  const now = Date.now();
  for (const [id, h] of hoiThoai) if (!h.dangTraLoi && now - h.dung > HOI_THOAI_HET_HAN) hoiThoai.delete(id);
  for (const [k, ds] of luotHoi) { const con = ds.filter((t) => now - t < 3600e3); if (con.length) luotHoi.set(k, con); else luotHoi.delete(k); }
}, 60e3).unref();

function layHoiThoai(id, chuSo) {
  const h = id && hoiThoai.get(id);
  if (h && h.chuSo === chuSo) { h.dung = Date.now(); return { id, h }; }
  const moi = crypto.randomBytes(16).toString('base64url');
  const hm = { chuSo, messages: [], dung: Date.now(), dangTraLoi: false };
  hoiThoai.set(moi, hm);
  return { id: moi, h: hm };
}

function kiemTraLuot(chuSo) {
  const now = Date.now();
  const ds = (luotHoi.get(chuSo) || []).filter((t) => now - t < 3600e3);
  if (ds.length >= CAU_HINH.gioiHanMoiGio) throw new LoiXacThuc(429, 'Anh chị đã hỏi rất nhiều trong 1 giờ qua. Nghỉ một chút rồi hỏi tiếp nhé.');
  ds.push(now);
  luotHoi.set(chuSo, ds);
}

// ------------------------------------------------------------------ HTTP

const LOAI_TEP = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json; charset=utf-8', '.ico': 'image/x-icon',
};

function datHeaderAnToan(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'microphone=(self), camera=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
}

function json(res, status, o) {
  const b = Buffer.from(JSON.stringify(o), 'utf8');
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': b.length, 'Cache-Control': 'no-store' });
  res.end(b);
}

function docThan(req, toiDa = 16 * 1024) {
  return new Promise((ok, hong) => {
    const phan = [];
    let dai = 0;
    req.on('data', (c) => {
      dai += c.length;
      if (dai > toiDa) { hong(new LoiXacThuc(413, 'Nội dung gửi lên quá dài.')); req.destroy(); return; }
      phan.push(c);
    });
    req.on('end', () => {
      try { ok(dai ? JSON.parse(Buffer.concat(phan).toString('utf8')) : {}); } catch { hong(new LoiXacThuc(400, 'Dữ liệu gửi lên không hợp lệ.')); }
    });
    req.on('error', hong);
  });
}

const laCucBo = (req) => {
  const a = req.socket.remoteAddress || '';
  return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
};

const layToken = (req) => {
  const a = req.headers.authorization || '';
  return a.startsWith('Bearer ') ? a.slice(7).trim() : null;
};

function phucVuTep(req, res, duong) {
  if (duong === '/' || duong === '') duong = '/index.html';
  let tep;
  try { tep = path.join(THU_MUC_WEB, path.normalize(decodeURIComponent(duong)).replace(/^([/\\])+/, '')); } catch { tep = null; }
  if (!tep || !tep.startsWith(THU_MUC_WEB + path.sep) || !fs.existsSync(tep) || !fs.statSync(tep).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Không có trang này.');
  }
  const loai = LOAI_TEP[path.extname(tep).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': loai, 'Cache-Control': loai.startsWith('text/html') ? 'no-cache' : 'public, max-age=300' });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(tep).pipe(res);
}

/** POST /api/hoi → luồng sự kiện (text/event-stream): doan, chu, congcu, thongbao, hetphien, loi, xong. */
async function hoi(req, res) {
  const token = layToken(req);
  const ai = await xacThuc.kiemTra(token, laCucBo(req));
  const b = await docThan(req);
  const cauHoi = String(b.cauHoi || '').replace(/\s+/g, ' ').trim();
  if (!cauHoi) throw new LoiXacThuc(400, 'Chưa có câu hỏi.');
  if (cauHoi.length > CAU_HINH.doDaiCauHoi) throw new LoiXacThuc(400, 'Câu hỏi quá dài.');
  const { id, h } = layHoiThoai(typeof b.hoiThoai === 'string' ? b.hoiThoai : null, ai.chuSo);
  if (h.dangTraLoi) throw new LoiXacThuc(409, 'Trợ lý đang trả lời câu trước, chờ chút nhé.');
  kiemTraLuot(ai.chuSo);

  h.dangTraLoi = true;
  const huy = new AbortController();
  res.on('close', () => { if (!res.writableFinished) huy.abort(new Error('Người dùng đã dừng')); });
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive', 'X-Accel-Buffering': 'no',
  });
  const phat = (suKien, duLieu) => { if (!res.writableEnded && !res.destroyed) res.write('event: ' + suKien + '\ndata: ' + JSON.stringify(duLieu) + '\n\n'); };
  phat('batdau', { hoiThoai: id });
  const giuKetNoi = setInterval(() => { if (!res.writableEnded && !res.destroyed) res.write(': .\n\n'); }, 15000);

  const batDau = Date.now();
  try {
    const kq = await troLy.traLoi(h, cauHoi, {
      token: ai.tokenMayChu,
      signal: huy.signal,
      phat: (s, d) => { if (s === 'hetphien') xacThuc.quen(ai.tokenMayChu); phat(s, d); },
    });
    const u = kq.usage;
    console.log(`[${new Date().toISOString()}] ${ai.nguoi.ten}: ${kq.soVong} vòng, ${Date.now() - batDau} ms, ` +
      `token vào ${u.input_tokens} (+đệm đọc ${u.cache_read_input_tokens}, ghi ${u.cache_creation_input_tokens}), ra ${u.output_tokens}` +
      (kq.tuChoi ? ', bị từ chối' : ''));
    phat('xong', {});
  } catch (e) {
    if (huy.signal.aborted) {
      console.log(`[${new Date().toISOString()}] ${ai.nguoi.ten}: đã dừng giữa chừng`);
    } else {
      console.error(`[${new Date().toISOString()}] ${ai.nguoi.ten}: LỖI`, e.status || '', e.message);
      phat('loi', { loi: loiChoNguoiDung(e) });
    }
  } finally {
    clearInterval(giuKetNoi);
    h.dangTraLoi = false;
    h.dung = Date.now();
    res.end();
  }
}

async function xuLy(req, res) {
  datHeaderAnToan(res);
  const url = new URL(req.url, 'http://x');
  const d = url.pathname;
  const m = req.method;

  if (!d.startsWith('/api/')) {
    if (m !== 'GET' && m !== 'HEAD') { res.writeHead(405); return res.end(); }
    return phucVuTep(req, res, d);
  }

  // Chặn trang web lạ gọi API thay người dùng (CSRF): yêu cầu POST phải cùng nguồn.
  if (m === 'POST' && req.headers.origin) {
    let cungNguon = false;
    try { cungNguon = new URL(req.headers.origin).host === req.headers.host; } catch { cungNguon = false; }
    if (!cungNguon) return json(res, 403, { loi: 'Không cho phép.' });
  }

  try {
    switch (m + ' ' + d) {
      case 'GET /api/thongtin':
        return json(res, 200, { tenCongTy, cheDo: xacThuc.cheDo, coSoLieu: !!mayChu, cucBo: laCucBo(req) });
      case 'POST /api/dangnhap': {
        const b = await docThan(req);
        const kq = await xacThuc.dangNhap(b, req.socket.remoteAddress || '');
        return json(res, 200, kq);
      }
      case 'GET /api/toi': {
        const ai = await xacThuc.kiemTra(layToken(req), laCucBo(req));
        return json(res, 200, { nguoi: ai.nguoi });
      }
      case 'POST /api/dangxuat':
        await xacThuc.dangXuat(layToken(req));
        return json(res, 200, { ok: true });
      case 'POST /api/hoithoaimoi': {
        const ai = await xacThuc.kiemTra(layToken(req), laCucBo(req));
        const b = await docThan(req);
        const h = typeof b.hoiThoai === 'string' && hoiThoai.get(b.hoiThoai);
        if (h && h.chuSo === ai.chuSo && !h.dangTraLoi) hoiThoai.delete(b.hoiThoai);
        return json(res, 200, { ok: true });
      }
      case 'POST /api/hoi':
        return await hoi(req, res);
    }
    return json(res, 404, { loi: 'Không có địa chỉ này.' });
  } catch (e) {
    if (res.headersSent) { res.end(); return; }
    if (e instanceof LoiXacThuc) return json(res, e.status, { loi: e.message });
    console.error('[LỖI]', e);
    return json(res, 500, { loi: 'Lỗi máy chủ trợ lý.' });
  }
}

// ------------------------------------------------------------------ khởi động

function taoMayChuWeb() {
  const xl = (req, res) => { xuLy(req, res).catch((e) => { console.error(e); try { res.end(); } catch { } }); };
  if (env.HTTPS_PFX) {
    return { coHttps: true, sv: https.createServer({ pfx: fs.readFileSync(path.resolve(THU_MUC, env.HTTPS_PFX)), passphrase: env.HTTPS_PFX_MATKHAU || '' }, xl) };
  }
  if (env.HTTPS_CERT && env.HTTPS_KEY) {
    return { coHttps: true, sv: https.createServer({ cert: fs.readFileSync(path.resolve(THU_MUC, env.HTTPS_CERT)), key: fs.readFileSync(path.resolve(THU_MUC, env.HTTPS_KEY)) }, xl) };
  }
  return { coHttps: false, sv: http.createServer(xl) };
}

let coHttps, sv;
try {
  ({ coHttps, sv } = taoMayChuWeb());
} catch (e) {
  console.error('[LỖI] Không đọc được chứng chỉ HTTPS: ' + e.message);
  if (/unsupported|mac verify|bad decrypt/i.test(e.message))
    console.error('      Sai mật khẩu PFX, hoặc PFX dùng thuật toán cũ. Chạy lại TaoChungChi.bat, hoặc dùng HTTPS_CERT / HTTPS_KEY (PEM).');
  process.exit(1);
}
sv.on('error', (e) => {
  console.error('[LỖI] Không mở được cổng ' + CAU_HINH.cong + ': ' + (e.code === 'EADDRINUSE' ? 'cổng đang bị chương trình khác dùng (đổi CONG trong .env).' : e.message));
  process.exit(1);
});
sv.requestTimeout = 0;          // luồng trả lời có thể dài
sv.headersTimeout = 30000;
sv.listen(CAU_HINH.cong, CAU_HINH.diaChiNghe, () => {
  const giaoThuc = coHttps ? 'https' : 'http';
  console.log('==================================================');
  console.log(' TRỢ LÝ ẢO GIỌNG NÓI — ' + tenCongTy);
  console.log(' Mở trên máy này:  ' + giaoThuc + '://localhost:' + CAU_HINH.cong + '/');
  console.log(' Mô hình: ' + CAU_HINH.model + ' (effort ' + CAU_HINH.effort + ')' + (CAU_HINH.timKiemWeb ? ', có tìm kiếm web' : ''));
  console.log(' Số liệu thất thoát: ' + (mayChu ? mayChu.goc.origin + mayChu.goc.pathname : 'CHƯA nối (cài MAYCHU_DIACHI)'));
  console.log(' Đăng nhập: ' + { thatthoat: 'tài khoản phần mềm thất thoát nước', matkhau: 'mật khẩu chung', cucbo: 'không — chỉ dùng trên máy này' }[xacThuc.cheDo]);
  if (!coHttps) console.log(' [!] Đang chạy http: micro trên điện thoại / máy khác chỉ hoạt động qua https (xem HUONG_DAN.md).');
  console.log('==================================================');
});

for (const tin of ['SIGINT', 'SIGTERM']) process.on(tin, () => { sv.close(); process.exit(0); });
