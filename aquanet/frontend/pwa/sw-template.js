/* Service worker AquaNet – sinh lúc build (vite.config.js), không sửa tệp trong dist.
 * - Lưu sẵn toàn bộ giao diện (kể cả các phần tải trễ) để mở được khi mất sóng.
 * - /assets/* có mã băm trong tên: lấy từ cache trước.
 * - Điều hướng trang: lấy mạng trước, mất mạng thì trả trang đã lưu.
 * - /api/*: không cache ở đây – ứng dụng hiện trường tự lưu dữ liệu trong IndexedDB.
 */
const VERSION = '__VERSION__'
const CACHE = `aquanet-${VERSION}`
const PRECACHE = ['/', '/index.html', '/manifest.webmanifest', '/logo.png', '/favicon.ico', '/icons/icon-192.png', '/icons/icon-512.png',
  ...__PRECACHE__]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([...new Set(PRECACHE)])).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('aquanet-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          if (res.ok) caches.open(CACHE).then((c) => c.put('/index.html', copy))
          return res
        })
        .catch(() => caches.match('/index.html')),
    )
    return
  }
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && url.pathname.startsWith('/assets/')) {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copy))
      }
      return res
    })),
  )
})
