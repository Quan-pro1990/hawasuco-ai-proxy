/*
 * Máy chủ HawaMap: phục vụ trang web (thư mục public) và API báo cáo giao thông dùng chung cho mọi người dùng.
 * Không cần cài thư viện: chỉ cần Node.js 18 trở lên.  Chạy:  node server.js   (mặc định cổng 8080)
 *
 * Biến môi trường: PORT (cổng), HOST (địa chỉ lắng nghe, vd. 127.0.0.1 khi chạy sau IIS / reverse proxy),
 *                  BANDO_DULIEU (thư mục lưu dữ liệu, mặc định ./du-lieu)
 * Chạy trên IIS (Windows Server): xem trien-khai/HUONG_DAN_MAY_CHU.md (hướng dẫn từng bước) và trien-khai/iis.
 *
 * API
 *   GET    /api/trang-thai
 *   GET    /api/bao-cao?bbox=tây,nam,đông,bắc&thietBi=…
 *   POST   /api/bao-cao                       { loai, phu?, lng, lat, huong?, ghiChu?, thietBi }
 *   POST   /api/bao-cao/:id/xac-nhan          { conTon: true|false, thietBi }
 *   DELETE /api/bao-cao/:id?thietBi=…          (chỉ người gửi)
 *   GET    /api/mo-lien-ket?url=https://maps.app.goo.gl/…   (mở liên kết rút gọn Google Maps → địa điểm)
 *   GET    /api/giao-thong?o=2858_1110,2858_1109&lop=chinh|nho   (điểm cảnh báo theo ô 0,1°, tự cập nhật mỗi tuần)
 *   GET    /api/giao-thong/trang-thai
 *   GET    /api/phi-cao-toc                   (bảng phí trạm thu phí: du-lieu/phi-cao-toc.json hoặc bản mặc định)
 *   GET    /.well-known/acme-challenge/<mã>   (tệp xác minh tên miền khi xin chứng chỉ HTTPS Let's Encrypt)
 */
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { LOAI_BAO_CAO, soPhieuGo } from './public/js/loai-bao-cao.js';
import { docLienKet, laMienGoogle, boQuaTrangDongY, MIEN_RUT_GON } from './public/js/lien-ket.js';
import { laMaO } from './public/js/duong-xa.js';
import { taoKhoGiaoThong } from './kho-giao-thong.js';

const THU_MUC = path.dirname(fileURLToPath(import.meta.url));
const THU_MUC_WEB = path.join(THU_MUC, 'public');
const PHIEN_BAN = '1.2.11';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2', '.pbf': 'application/x-protobuf'
};

const bam = s => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 16);

/**
 * Địa chỉ IP của người dùng. Chỉ tin X-Forwarded-For khi yêu cầu đến từ proxy trên chính máy này
 * (IIS: HttpPlatformHandler / URL Rewrite + ARR, nginx…), và lấy địa chỉ cuối cùng — do proxy đó ghi, không giả được.
 */
export function ipKhach(req) {
  const goc = (req.socket && req.socket.remoteAddress) || '';
  if (!/^(127\.|::1$|::ffff:127\.)/.test(goc)) return goc;
  const ds = String(req.headers['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean);
  return ds.length ? ds[ds.length - 1] : goc;
}

const NEN_DUOC = /^(text\/|application\/(json|javascript|manifest\+json|xml)|image\/svg)/;

/** Trình duyệt nhận gzip và nội dung đáng nén (chữ, trên 1 KB). */
function nenGzip(req, kieu, kichThuoc) {
  return !!req && /\bgzip\b/.test(req.headers['accept-encoding'] || '') && NEN_DUOC.test(kieu) && kichThuoc > 1024;
}

/**
 * @param layMang     hàm fetch dùng để mở liên kết rút gọn (thay được khi kiểm thử)
 * @param thuMucAcme  nơi công cụ xin chứng chỉ (win-acme, certbot…) ghi tệp xác minh tên miền
 */
export function taoMayChu({
  thuMucDuLieu = process.env.BANDO_DULIEU || path.join(THU_MUC, 'du-lieu'), ghiLog = true, layMang = globalThis.fetch, henGio = true,
  thuMucAcme = path.join(THU_MUC, '.well-known', 'acme-challenge')
} = {}) {
  const fileBaoCao = path.join(thuMucDuLieu, 'bao-cao.json');
  const khoGT = taoKhoGiaoThong({ thuMuc: path.join(thuMucDuLieu, 'giao-thong'), layMang, ghiLog });
  if (henGio) khoGT.batDauHenGio();
  let baoCao = [];
  try { baoCao = JSON.parse(fs.readFileSync(fileBaoCao, 'utf8')); } catch (e) { baoCao = []; }
  if (!Array.isArray(baoCao)) baoCao = [];

  // ---- lưu xuống đĩa (gộp nhiều thay đổi, ghi file tạm rồi đổi tên để không hỏng file)
  let henLuu = null, dangLuu = Promise.resolve();
  function ghiFile() {
    dangLuu = dangLuu.then(async () => {
      await fsp.mkdir(thuMucDuLieu, { recursive: true });
      const tam = fileBaoCao + '.tmp';
      await fsp.writeFile(tam, JSON.stringify(baoCao));
      await fsp.rename(tam, fileBaoCao);
    }).catch(e => console.error('Không lưu được báo cáo:', e.message));
    return dangLuu;
  }
  function luu() {
    clearTimeout(henLuu);
    henLuu = setTimeout(() => { henLuu = null; ghiFile(); }, 500);
  }

  function donDep() {
    const bayGio = Date.now(), truoc = baoCao.length;
    baoCao = baoCao.filter(b => !b.hetHan || b.hetHan > bayGio);
    if (baoCao.length !== truoc) luu();
  }
  const henDon = setInterval(donDep, 60000);
  henDon.unref();

  // ---- giới hạn số lần gửi theo IP
  const luotGui = new Map();
  function quaGioiHan(ip, toiDa = 30, khoang = 10 * 60000) {
    const bayGio = Date.now();
    const ds = (luotGui.get(ip) || []).filter(t => bayGio - t < khoang);
    ds.push(bayGio);
    luotGui.set(ip, ds);
    return ds.length > toiDa;
  }

  /**
   * Mở liên kết rút gọn của Google Maps (maps.app.goo.gl…) ra liên kết đầy đủ rồi đọc địa điểm.
   * Chỉ đi theo chuyển hướng trong các tên miền Google (không cho dùng máy chủ để gọi địa chỉ tuỳ ý).
   */
  async function moLienKetRutGon(diaChi) {
    let u;
    try { u = new URL(diaChi); } catch (e) { return { loi: 'Liên kết không hợp lệ' }; }
    if (u.protocol !== 'https:' || !MIEN_RUT_GON.includes(u.hostname) || u.username || u.port) {
      return { loi: 'Chỉ mở được liên kết rút gọn của Google Maps' };
    }
    let hienTai = u.href;
    for (let i = 0; i < 6; i++) {
      let r;
      try {
        r = await layMang(hienTai, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0 (HawaMap)' }, signal: AbortSignal.timeout(8000) });
      } catch (e) {
        return { loi: 'Không kết nối được tới Google Maps', ma: 502 };
      }
      if (r.body && r.body.cancel) r.body.cancel().catch(() => {});
      const den = r.headers.get('location');
      if (r.status < 300 || r.status >= 400 || !den) break;
      let tiep;
      try { tiep = new URL(boQuaTrangDongY(new URL(den, hienTai).href)); } catch (e) { break; }
      if (tiep.protocol !== 'https:' || !laMienGoogle(tiep.hostname)) return { loi: 'Liên kết dẫn ra ngoài Google Maps' };
      hienTai = tiep.href;
      const dd = docLienKet(hienTai);
      if (dd && !dd.rutGon) return { url: hienTai, diaDiem: dd };
    }
    return { loi: 'Không đọc được địa điểm từ liên kết', ma: 422 };
  }

  function congKhai(b, thietBi) {
    const { thietBiBam, phieu, ...x } = b;
    return { ...x, cuaToi: !!thietBi && bam(thietBi) === thietBiBam };
  }

  function guiJson(res, ma, du) {
    let than = Buffer.from(JSON.stringify(du));
    const head = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', Vary: 'Accept-Encoding' };
    if (nenGzip(res.req, head['Content-Type'], than.length)) { than = zlib.gzipSync(than); head['Content-Encoding'] = 'gzip'; }
    head['Content-Length'] = than.length;
    res.writeHead(ma, head);
    res.end(than);
  }

  function docThan(req, toiDa = 8192) {
    return new Promise((ok, loi) => {
      let du = '';
      req.setEncoding('utf8');
      req.on('data', c => {
        du += c;
        if (du.length > toiDa) { loi(Object.assign(new Error('Dữ liệu gửi lên quá lớn'), { ma: 413 })); req.destroy(); }
      });
      req.on('end', () => {
        try { ok(du ? JSON.parse(du) : {}); } catch (e) { loi(Object.assign(new Error('JSON không hợp lệ'), { ma: 400 })); }
      });
      req.on('error', loi);
    });
  }

  async function api(req, res, url) {
    const ip = ipKhach(req);
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400'
      });
      return res.end();
    }
    const p = url.pathname.replace(/\/+$/, '');

    if (p === '/api/trang-thai' && req.method === 'GET') {
      donDep();
      return guiJson(res, 200, { ok: true, ten: 'HawaMap', phienBan: PHIEN_BAN, soBaoCao: baoCao.length });
    }

    if (p === '/api/mo-lien-ket' && req.method === 'GET') {
      if (quaGioiHan('lk:' + ip, 60)) return guiJson(res, 429, { loi: 'Bạn mở quá nhiều liên kết, vui lòng thử lại sau ít phút' });
      const kq = await moLienKetRutGon(url.searchParams.get('url') || '');
      return guiJson(res, kq.loi ? kq.ma || 400 : 200, kq);
    }

    if (p === '/api/giao-thong' && req.method === 'GET') {
      if (quaGioiHan('gt:' + ip, 300)) return guiJson(res, 429, { loi: 'Quá nhiều yêu cầu, vui lòng thử lại sau ít phút' });
      const ds = (url.searchParams.get('o') || '').split(',').filter(Boolean);
      const lop = url.searchParams.get('lop') || 'chinh';
      // moi=1: người dùng bấm "Cập nhật ngay" → ô cũ hơn 1 ngày tải lại từ OpenStreetMap (giới hạn riêng để không quá tải Overpass)
      const moi = url.searchParams.get('moi') === '1' && !quaGioiHan('gtm:' + ip, 60);
      if (!ds.length || ds.length > 9 || !ds.every(laMaO) || (lop !== 'chinh' && lop !== 'nho')) return guiJson(res, 400, { loi: 'Danh sách ô không hợp lệ' });
      const o = {}, loi = {};
      await Promise.all(ds.map(async ma => {
        try { const x = await khoGT.lay(ma, lop, Date.now(), { moi }); o[ma] = { capNhat: x.capNhat, pb: x.pb || 1, diem: x.diem }; } catch (e) { loi[ma] = e.message; }
      }));
      if (!Object.keys(o).length) return guiJson(res, 502, { loi: 'Không lấy được dữ liệu giao thông', chiTiet: loi });
      return guiJson(res, 200, { o, loi });
    }

    if (p === '/api/giao-thong/trang-thai' && req.method === 'GET') return guiJson(res, 200, await khoGT.trangThai());

    if (p === '/api/phi-cao-toc' && req.method === 'GET') {
      // bảng phí người vận hành tự cập nhật trong thư mục dữ liệu; chưa có thì dùng bản mặc định trong public/du-lieu
      for (const tep of [path.join(thuMucDuLieu, 'phi-cao-toc.json'), path.join(THU_MUC_WEB, 'du-lieu', 'phi-cao-toc.json')]) {
        try { return guiJson(res, 200, JSON.parse(await fsp.readFile(tep, 'utf8'))); } catch (e) { /* thử tệp sau */ }
      }
      return guiJson(res, 404, { loi: 'Chưa có bảng phí' });
    }

    if (p === '/api/bao-cao' && req.method === 'GET') {
      donDep();
      const thietBi = url.searchParams.get('thietBi') || '';
      let ds = baoCao;
      const bbox = (url.searchParams.get('bbox') || '').split(',').map(Number);
      if (bbox.length === 4 && bbox.every(isFinite)) {
        const [w, s, e, n] = bbox;
        ds = ds.filter(b => b.lng >= w && b.lng <= e && b.lat >= s && b.lat <= n);
      }
      return guiJson(res, 200, { baoCao: ds.slice(-500).map(b => congKhai(b, thietBi)) });
    }

    if (p === '/api/bao-cao' && req.method === 'POST') {
      if (quaGioiHan(ip)) return guiJson(res, 429, { loi: 'Bạn gửi quá nhiều báo cáo, vui lòng thử lại sau ít phút' });
      const d = await docThan(req);
      const kieu = LOAI_BAO_CAO[d.loai];
      const lng = Number(d.lng), lat = Number(d.lat);
      if (!kieu) return guiJson(res, 400, { loi: 'Loại báo cáo không hợp lệ' });
      if (kieu.batBuocPhu && !(kieu.phu && kieu.phu[d.phu])) return guiJson(res, 400, { loi: 'Chưa chọn loại ' + kieu.ten.toLowerCase() });
      if (!isFinite(lng) || !isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return guiJson(res, 400, { loi: 'Toạ độ không hợp lệ' });
      if (!d.thietBi || String(d.thietBi).length > 100) return guiJson(res, 400, { loi: 'Thiếu mã thiết bị' });
      const bayGio = Date.now();
      // báo cáo cùng loại rất gần (< 60 m) trong 10 phút: coi như xác nhận lại báo cáo cũ
      const trung = baoCao.find(b => b.loai === d.loai && (b.phu || '') === (d.phu || '') && bayGio - b.taoLuc < 10 * 60000 &&
        Math.abs(b.lat - lat) < 0.00055 && Math.abs(b.lng - lng) < 0.00055 * 1.1);
      if (trung) {
        const ai = bam(d.thietBi);
        if (ai !== trung.thietBiBam && trung.phieu[ai] !== true) {
          if (trung.phieu[ai] === false) trung.khongCon--;
          trung.phieu[ai] = true;
          trung.conTon++;
        }
        if (kieu.hetHan) trung.hetHan = Math.max(trung.hetHan, bayGio + kieu.hetHan * 60000);
        luu();
        return guiJson(res, 200, { baoCao: congKhai(trung, d.thietBi), trung: true });
      }
      const huong = d.huong == null || d.huong === '' ? null : Math.round(Number(d.huong)) % 360;
      const b = {
        id: crypto.randomBytes(6).toString('hex'), loai: d.loai, phu: kieu.phu && kieu.phu[d.phu] ? d.phu : undefined,
        lng: +lng.toFixed(6), lat: +lat.toFixed(6),
        huong: isFinite(huong) ? huong : null, ghiChu: String(d.ghiChu || '').slice(0, 200),
        taoLuc: bayGio, hetHan: kieu.hetHan ? bayGio + kieu.hetHan * 60000 : 0, conTon: 0, khongCon: 0,
        thietBiBam: bam(d.thietBi), phieu: {}
      };
      baoCao.push(b);
      if (baoCao.length > 20000) baoCao.splice(0, baoCao.length - 20000);
      luu();
      if (ghiLog) console.log(`[báo cáo] ${kieu.ten} tại ${b.lat}, ${b.lng}`);
      return guiJson(res, 201, { baoCao: congKhai(b, d.thietBi) });
    }

    let m = /^\/api\/bao-cao\/([\w-]+)\/xac-nhan$/.exec(p);
    if (m && req.method === 'POST') {
      if (quaGioiHan(ip, 120)) return guiJson(res, 429, { loi: 'Thao tác quá nhanh, vui lòng thử lại sau' });
      const d = await docThan(req);
      const b = baoCao.find(x => x.id === m[1]);
      if (!b) return guiJson(res, 404, { loi: 'Báo cáo không còn' });
      if (!d.thietBi) return guiJson(res, 400, { loi: 'Thiếu mã thiết bị' });
      const ai = bam(d.thietBi);
      if (ai === b.thietBiBam) return guiJson(res, 200, { baoCao: congKhai(b, d.thietBi) });
      const truoc = b.phieu[ai];
      if (truoc === true) b.conTon--;
      if (truoc === false) b.khongCon--;
      b.phieu[ai] = !!d.conTon;
      if (d.conTon) {
        b.conTon++;
        const han = LOAI_BAO_CAO[b.loai].hetHan;
        if (han) b.hetHan = Math.max(b.hetHan, Date.now() + han * 30000);
      } else b.khongCon++;
      if (!d.conTon && b.khongCon >= soPhieuGo(b.loai) && b.khongCon > b.conTon) {
        baoCao = baoCao.filter(x => x !== b);
        luu();
        return guiJson(res, 200, { baoCao: null, daGo: true });
      }
      luu();
      return guiJson(res, 200, { baoCao: congKhai(b, d.thietBi) });
    }

    m = /^\/api\/bao-cao\/([\w-]+)$/.exec(p);
    if (m && req.method === 'DELETE') {
      const b = baoCao.find(x => x.id === m[1]);
      if (!b) return guiJson(res, 404, { loi: 'Báo cáo không còn' });
      if (bam(url.searchParams.get('thietBi') || '') !== b.thietBiBam) return guiJson(res, 403, { loi: 'Chỉ người gửi mới xoá được báo cáo' });
      baoCao = baoCao.filter(x => x !== b);
      luu();
      return guiJson(res, 200, { ok: true });
    }

    return guiJson(res, 404, { loi: 'Không có API này' });
  }

  async function tinh(req, res, url) {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    let duong;
    try { duong = decodeURIComponent(url.pathname); } catch (e) { res.writeHead(400); return res.end(); }
    if (duong.endsWith('/')) duong += 'index.html';
    const file = path.normalize(path.join(THU_MUC_WEB, duong));
    if (!file.startsWith(THU_MUC_WEB + path.sep)) { res.writeHead(403); return res.end(); }
    let tt;
    try { tt = await fsp.stat(file); } catch (e) { tt = null; }
    if (!tt || !tt.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Không tìm thấy');
    }
    const etag = `W/"${tt.size.toString(36)}-${Math.floor(tt.mtimeMs).toString(36)}"`;
    const ext = path.extname(file).toLowerCase();
    const head = {
      'Content-Type': MIME[ext] || 'application/octet-stream', ETag: etag,
      // trang và mã nguồn: luôn hỏi lại để nhận bản mới; thư viện: lưu lâu
      'Cache-Control': duong.startsWith('/vendor/') || duong.startsWith('/icons/') ? 'public, max-age=604800' : 'no-cache',
      'X-Content-Type-Options': 'nosniff', Vary: 'Accept-Encoding'
    };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, head); return res.end(); }
    // nén gzip mã nguồn, trang, dữ liệu chữ (thư viện bản đồ ~800 KB còn ~220 KB)
    const nen = nenGzip(req, head['Content-Type'], tt.size);
    if (nen) head['Content-Encoding'] = 'gzip';
    else head['Content-Length'] = tt.size;
    res.writeHead(200, head);
    if (req.method === 'HEAD') return res.end();
    const doc = fs.createReadStream(file);
    if (nen) doc.pipe(zlib.createGzip()).pipe(res);
    else doc.pipe(res);
  }

  /** Xin chứng chỉ HTTPS (Let's Encrypt): công cụ ACME ghi tệp vào <thư mục ứng dụng>\.well-known\acme-challenge rồi gọi thử qua http. */
  async function xacMinhTenMien(req, res, url) {
    const ma = url.pathname.slice('/.well-known/acme-challenge/'.length);
    let noiDung = null;
    if (/^[A-Za-z0-9_-]{8,256}$/.test(ma)) {
      try { noiDung = await fsp.readFile(path.join(thuMucAcme, ma)); } catch (e) { /* không có tệp này */ }
    }
    if (!noiDung) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Không tìm thấy'); }
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    res.end(noiDung);
  }

  const mayChu = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) await api(req, res, url);
      else if (url.pathname.startsWith('/.well-known/acme-challenge/')) await xacMinhTenMien(req, res, url);
      else await tinh(req, res, url);
    } catch (e) {
      if (!res.headersSent) guiJson(res, e.ma || 500, { loi: e.ma ? e.message : 'Lỗi máy chủ' });
      if (!e.ma) console.error(e);
    }
  });
  mayChu.on('close', () => clearInterval(henDon));
  /** Ghi ngay các thay đổi đang chờ (dùng khi tắt máy chủ / kiểm thử). */
  mayChu.luuNgay = () => {
    if (!henLuu) return dangLuu;
    clearTimeout(henLuu);
    henLuu = null;
    return ghiFile();
  };
  return mayChu;
}

// ---------------------------------------------------------------- chạy trực tiếp
/** Tệp này là tệp được chạy (node server.js)? Windows không phân biệt hoa thường trong đường dẫn (IIS truyền đường dẫn đầy đủ). */
function laTepChinh() {
  if (!process.argv[1]) return false;
  try {
    const a = fs.realpathSync(fileURLToPath(import.meta.url)), b = fs.realpathSync(path.resolve(process.argv[1]));
    return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
  } catch (e) {
    return false;
  }
}

if (laTepChinh()) {
  const iCong = process.argv.indexOf('--port');
  const cong = Number(process.env.PORT || (iCong > 0 ? process.argv[iCong + 1] : 0) || 8080);
  const mc = taoMayChu();
  mc.listen(cong, process.env.HOST || undefined, () => {
    console.log(`HawaMap đang chạy:  http://${process.env.HOST || 'localhost'}:${cong}`);
    console.log('Điện thoại cùng mạng: http://<địa-chỉ-IP-máy-này>:' + cong + '  (GPS cần HTTPS khi không phải localhost)');
  });
  // SIGBREAK: Windows (IIS dừng tiến trình, Ctrl+Break)
  for (const tinHieu of ['SIGINT', 'SIGTERM', ...(process.platform === 'win32' ? ['SIGBREAK'] : [])]) {
    process.on(tinHieu, async () => { await mc.luuNgay(); process.exit(0); });
  }
}
