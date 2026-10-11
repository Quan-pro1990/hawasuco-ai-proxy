import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { compressImage } from '../photo'
import { fmt } from '../labels'

/** Bộ ảnh hiện trường gắn với sự cố / lệnh bảo trì: xem, phóng to, thêm ảnh. */
export default function Photos({ ownerType, ownerId, canUpload }) {
  const [items, setItems] = useState([])
  const [urls, setUrls] = useState({})
  const [big, setBig] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const made = useRef([])

  async function load() {
    const list = await api.get(`/api/attachments?owner_type=${ownerType}&owner_id=${ownerId}`)
    setItems(list)
    for (const a of list) {
      api.blobUrl(a.url).then((u) => { made.current.push(u); setUrls((o) => ({ ...o, [a.id]: u })) }).catch(() => {})
    }
  }
  useEffect(() => {
    setItems([]); setUrls({}); setErr(null)
    load().catch(() => {})
    return () => { made.current.forEach((u) => URL.revokeObjectURL(u)); made.current = [] }
  }, [ownerType, ownerId]) // eslint-disable-line

  async function upload(files) {
    setBusy(true); setErr(null)
    try {
      for (const f of files) {
        const fd = new FormData()
        fd.append('owner_type', ownerType)
        fd.append('owner_id', ownerId)
        fd.append('file', await compressImage(f), f.name.replace(/\.\w+$/, '') + '.jpg')
        await api.post('/api/attachments', fd)
      }
      await load()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="photos">
        {items.map((a) => (
          <button key={a.id} className="ph" onClick={() => setBig(a)} title={`${a.uploaded_by} · ${fmt.date(a.created_at)}`}>
            {urls[a.id] ? <img src={urls[a.id]} alt={a.caption || a.filename} /> : <span className="muted small">…</span>}
          </button>
        ))}
        {canUpload && (
          <label className="ph add">
            <input type="file" accept="image/*" multiple hidden disabled={busy} onChange={(e) => upload([...e.target.files])} />
            {busy ? '…' : '+ Ảnh'}
          </label>
        )}
        {!items.length && !canUpload && <span className="muted small">Chưa có ảnh</span>}
      </div>
      {err && <div className="alert error">{err}</div>}
      {big && (
        <div className="lightbox" onClick={() => setBig(null)}>
          <img src={urls[big.id]} alt="" />
          <div className="cap">{big.caption || big.filename} · {big.uploaded_by} · {fmt.date(big.created_at)}</div>
        </div>
      )}
    </div>
  )
}
