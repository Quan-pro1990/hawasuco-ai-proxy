/**
 * Lưu trữ offline của ứng dụng hiện trường (IndexedDB):
 *  - kv:     gói dữ liệu đã tải về máy (sổ ghi chỉ số, công việc…), thời điểm đồng bộ.
 *  - outbox: hàng đợi thao tác ghi khi mất sóng (kèm ảnh dạng Blob), gửi lại khi có mạng.
 * Mỗi thao tác có uuid riêng – máy chủ dùng để chống ghi trùng khi gửi lại.
 */
import { OfflineError, api } from '../api'

const DB_NAME = 'aquanet-field'
let dbp

function openDb() {
  dbp ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const d = req.result
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv')
      if (!d.objectStoreNames.contains('outbox')) d.createObjectStore('outbox', { keyPath: 'uuid' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbp
}

async function run(store, mode, fn) {
  const d = await openDb()
  return new Promise((resolve, reject) => {
    const tx = d.transaction(store, mode)
    const req = fn(tx.objectStore(store))
    tx.oncomplete = () => resolve(req?.result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export const kv = {
  get: (k) => run('kv', 'readonly', (s) => s.get(k)),
  set: (k, v) => run('kv', 'readwrite', (s) => s.put(v, k)),
  del: (k) => run('kv', 'readwrite', (s) => s.delete(k)),
}

export const outbox = {
  all: async (username) => ((await run('outbox', 'readonly', (s) => s.getAll())) || [])
    .filter((i) => !username || i.username === username)
    .sort((a, b) => a.created_at.localeCompare(b.created_at)),
  put: (item) => run('outbox', 'readwrite', (s) => s.put(item)),
  del: (uuid) => run('outbox', 'readwrite', (s) => s.delete(uuid)),
}

export function newId() {
  if (crypto.randomUUID) return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16)) // trình duyệt cũ / trang không HTTPS
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
}

/** Thêm thao tác vào hàng đợi. photos: [{blob, name}] */
export async function enqueue(username, kind, payload, photos = [], summary = '') {
  const item = { uuid: newId(), username, kind, payload, photos, summary, created_at: new Date().toISOString(), attempts: 0 }
  await outbox.put(item)
  return item
}

const OWNER = { incident: 'incident', reading: 'reading', task_complete: 'task', incident_update: 'incident' }

/**
 * Gửi hàng đợi lên máy chủ: thao tác trước, ảnh sau (cần id do máy chủ cấp).
 * Mục lỗi nghiệp vụ (vd. chỉ số nhỏ hơn kỳ trước) được giữ lại kèm thông báo để người dùng sửa/xóa.
 * Mất mạng giữa chừng: ném OfflineError, các mục chưa gửi giữ nguyên.
 */
export async function syncOutbox(username) {
  const items = await outbox.all(username)
  let sent = 0
  let failed = 0
  for (let i = 0; i < items.length; i += 100) {
    const chunk = items.slice(i, i + 100)
    const res = await api.post('/api/field/sync', {
      ops: chunk.map(({ uuid, kind, payload, created_at }) => ({ uuid, kind, payload, created_at })),
    })
    for (const r of res.results) {
      const item = chunk.find((x) => x.uuid === r.uuid)
      if (!r.ok) {
        await outbox.put({ ...item, error: r.error, attempts: (item.attempts || 0) + 1 })
        failed++
        continue
      }
      const ownerId = item.kind === 'incident_update' ? item.payload.incident_id
        : item.kind === 'task_complete' ? item.payload.task_id : r.id
      let photoErr = null
      for (const [j, ph] of (item.photos || []).entries()) {
        const fd = new FormData()
        fd.append('owner_type', OWNER[item.kind])
        fd.append('owner_id', ownerId)
        fd.append('client_uuid', `${item.uuid}:${j}`)
        if (item.payload.lon != null) { fd.append('lon', item.payload.lon); fd.append('lat', item.payload.lat) }
        fd.append('file', ph.blob, ph.name || `anh-${j + 1}.jpg`)
        try { await api.post('/api/attachments', fd) } catch (e) { photoErr = e; break }
      }
      if (photoErr) {
        // thao tác đã ghi; gửi lại sau sẽ trùng uuid nên máy chủ trả kết quả cũ rồi tiếp tục gửi ảnh
        await outbox.put({ ...item, error: `Chưa gửi được ảnh: ${photoErr.message}`, attempts: (item.attempts || 0) + 1 })
        if (photoErr instanceof OfflineError) throw photoErr
        failed++
      } else {
        await outbox.del(item.uuid)
        sent++
      }
    }
  }
  if (items.length) await kv.set(`lastSync:${username}`, new Date().toISOString())
  return { sent, failed }
}

/** Ước lượng dung lượng ảnh đang chờ gửi (byte). */
export const pendingBytes = (items) => items.reduce((a, i) => a + (i.photos || []).reduce((b, p) => b + (p.blob?.size || 0), 0), 0)
