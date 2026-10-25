/*
 * Service worker: cho cài ứng dụng lên màn hình chính và dùng được khi mất mạng tạm thời.
 *  - Trang & mã nguồn: lấy bản mới từ mạng trước, mất mạng thì dùng bản đã lưu.
 *  - Mô tả bản đồ (style, TileJSON — chứa phiên bản dữ liệu mới nhất của máy chủ bản đồ): lấy mạng trước,
 *    mất mạng mới dùng bản đã lưu, nên bản đồ luôn theo phiên bản dữ liệu mới nhất.
 *  - Ô bản đồ, phông chữ, biểu tượng bản đồ: dùng bản đã lưu trước (bản đồ khu vực đã xem vẫn hiện khi mất mạng);
 *    ô đã lưu quá 7 ngày được tải lại ở nền. Vùng tải về để dùng offline (ban-do-offline.js) nằm trong bộ đệm riêng KHO_TAI,
 *    không bị cắt bớt.
 *  - Tìm kiếm, chỉ đường, báo cáo: luôn lấy từ mạng.
 */
const PHIEN_BAN = 'hawamap-v9';
const KHO_TRANG = PHIEN_BAN + '-trang';
const KHO_BAN_DO = 'hawamap-ban-do';
const KHO_TAI = 'hawamap-ban-do-tai';
const TOI_DA_O_BAN_DO = 4000;
const TUOI_O = 7 * 86400000;

const VO_UNG_DUNG = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'vendor/maplibre-gl/maplibre-gl.js', 'vendor/maplibre-gl/maplibre-gl.css', 'icons/icon.svg', 'icons/icon-192.png',
  'js/main.js', 'js/cau-hinh.js', 'js/kho.js', 'js/hinh-hoc.js', 'js/dinh-dang.js', 'js/bieu-tuong.js', 'js/ban-do.js',
  'js/giao-dien.js', 'js/tim-kiem.js', 'js/chi-duong.js', 'js/dan-duong.js', 'js/vi-tri.js', 'js/mo-phong.js',
  'js/giong-noi.js', 'js/cau-noi.js', 'js/duong-xa.js', 'js/canh-bao.js', 'js/bao-cao.js', 'js/loai-bao-cao.js', 'js/dia-diem.js',
  'js/hanh-trinh.js', 'js/camera-hanh-trinh.js', 'js/loai-canh-bao.js', 'js/nhac-nho.js', 'js/ban-do-offline.js',
  'js/lien-ket.js', 'js/obd.js', 'js/luat-duong.js', 'js/du-lieu-giao-thong.js', 'js/phi-cao-toc.js',
  'js/dan-duong-thong-minh.js', 'js/ve-tinh.js', 'du-lieu/phi-cao-toc.json'
];

const NGUON_BAN_DO = [
  'tiles.openfreemap.org', 'basemaps.cartocdn.com', 'tiles.basemaps.cartocdn.com', 'tiles-a.basemaps.cartocdn.com',
  'tiles-b.basemaps.cartocdn.com', 'tiles-c.basemaps.cartocdn.com', 'tiles-d.basemaps.cartocdn.com', 'server.arcgisonline.com', 'maps.vietmap.vn'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(KHO_TRANG).then(c => c.addAll(VO_UNG_DUNG)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ds => Promise.all(ds.filter(k => k.startsWith('hawamap-v') && !k.startsWith(PHIEN_BAN)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

let demGhi = 0;
async function catBotBanDo() {
  const c = await caches.open(KHO_BAN_DO);
  const ds = await c.keys();
  for (let i = 0; i < ds.length - TOI_DA_O_BAN_DO; i++) await c.delete(ds[i]);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    if (url.pathname.includes('/api/')) return;
    e.respondWith(fetch(req).then(r => {
      if (r.ok) { const sao = r.clone(); caches.open(KHO_TRANG).then(c => c.put(req, sao)); }
      return r;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
    return;
  }

  if (NGUON_BAN_DO.includes(url.hostname) && !url.pathname.includes('/api/')) {
    // trang đang tự tải vùng offline (cache: 'no-store'): để trang tự lưu vào KHO_TAI, không lưu thêm bản nữa ở đây
    if (req.cache === 'no-store') return;
    e.respondWith(laMoTa(url) ? mangTruoc(req) : daLuuTruoc(req, e));
  }
});

/** Style, TileJSON, chỉ mục biểu tượng: tệp .json hoặc đường dẫn không có đuôi tệp và không phải ô …/z/x/y. */
function laMoTa(url) {
  const d = url.pathname;
  return /\.json$/i.test(d) || (!/\.[a-z0-9]{2,5}$/i.test(d) && !/\/\d+\/\d+\/\d+$/.test(d));
}

/** Lấy mạng trước (chờ tối đa 5 giây), cập nhật mọi bộ đệm đang giữ bản cũ; lỗi mạng thì dùng bản đã lưu. */
async function mangTruoc(req) {
  const tai = await caches.open(KHO_TAI), thuong = await caches.open(KHO_BAN_DO);
  try {
    const r = await Promise.race([fetch(req), new Promise((_, loi) => setTimeout(() => loi(new Error('chậm')), 5000))]);
    if (r.ok) {
      thuong.put(req, r.clone());
      if (await tai.match(req)) tai.put(req, r.clone());
    }
    return r;
  } catch (e) {
    const da = await tai.match(req) || await thuong.match(req);
    if (da) return da;
    throw e;
  }
}

/** Ô bản đồ: dùng bản đã lưu ngay; bản lưu quá 7 ngày thì tải lại ở nền để lần sau có dữ liệu mới. */
async function daLuuTruoc(req, e) {
  const tai = await caches.open(KHO_TAI), thuong = await caches.open(KHO_BAN_DO);
  const trongTai = await tai.match(req);
  const da = trongTai || await thuong.match(req);
  if (da) {
    const luc = Date.parse(da.headers.get('date') || '');
    if (!(Date.now() - luc < TUOI_O)) {
      e.waitUntil(fetch(req).then(r => { if (r.ok) return (trongTai ? tai : thuong).put(req, r); }).catch(() => {}));
    }
    return da;
  }
  const r = await fetch(req);
  if (r.ok) {
    thuong.put(req, r.clone());
    if (++demGhi % 200 === 0) catBotBanDo();
  }
  return r;
}
