import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, auth } from '../api'
import { CUSTOMER_TYPES, INCIDENT_STATUS, INCIDENT_TYPES, MATERIALS, NODE_TYPES, PIPE_CLASS, PIPE_STATUS, SEVERITY, fmt } from '../labels'
import { Form } from './Form'

const PIPE_FIELDS = [
  { name: 'code', label: 'Mã ống' },
  { name: 'material', label: 'Vật liệu', options: MATERIALS },
  { name: 'diameter_mm', label: 'Đường kính (mm)', type: 'number' },
  { name: 'install_year', label: 'Năm lắp đặt', type: 'number' },
  { name: 'pipe_class', label: 'Cấp ống', options: PIPE_CLASS },
  { name: 'status', label: 'Trạng thái', options: PIPE_STATUS },
  { name: 'street', label: 'Tuyến đường', full: true },
  { name: 'note', label: 'Ghi chú', type: 'textarea', full: true },
]

const nodeFields = (type) => [
  { name: 'code', label: 'Mã' },
  { name: 'node_type', label: 'Loại', options: NODE_TYPES },
  type === 'valve'
    ? { name: 'status', label: 'Trạng thái van', options: { open: 'Mở', closed: 'Đóng' } }
    : { name: 'status', label: 'Trạng thái', options: { active: 'Hoạt động', inactive: 'Ngưng' } },
  { name: 'diameter_mm', label: 'Cỡ (mm)', type: 'number' },
  { name: 'elevation_m', label: 'Cao độ (m)', type: 'number' },
  { name: 'install_year', label: 'Năm lắp đặt', type: 'number' },
  { name: 'address', label: 'Vị trí / địa chỉ', full: true },
  { name: 'note', label: 'Ghi chú', type: 'textarea', full: true },
]

const INCIDENT_FIELDS = [
  { name: 'title', label: 'Tiêu đề', full: true },
  { name: 'incident_type', label: 'Loại sự cố', options: INCIDENT_TYPES },
  { name: 'severity', label: 'Mức độ', options: SEVERITY },
  { name: 'reporter', label: 'Người báo' },
  { name: 'reporter_phone', label: 'Điện thoại' },
  { name: 'assignee', label: 'Giao cho', full: true },
  { name: 'description', label: 'Mô tả', type: 'textarea', full: true },
]

export default function FeaturePanel({ sel, onClose, onSaved, onIsolate, onReportHere, onMove, onEditGeom }) {
  const [v, setV] = useState({})
  const [extra, setExtra] = useState(null)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const canEdit = auth.canEdit()
  const keepMsg = useRef(false)

  useEffect(() => {
    if (!keepMsg.current) setMsg(null)
    keepMsg.current = false
    setExtra(null)
    setV(sel.props || {})
    if (!sel.isNew && sel.id && ['pipe', 'node'].includes(sel.layer)) {
      api.get(`/api/${sel.layer}s/${sel.id}`).then((f) => { setExtra(f.properties); setV(f.properties) }).catch(() => {})
    }
    if (!sel.isNew && sel.layer === 'incident') api.get(`/api/incidents/${sel.id}`).then((f) => { setExtra(f.properties); setV(f.properties) })
  }, [sel])

  const change = (k, val) => setV((o) => ({ ...o, [k]: val }))
  const endpoint = { pipe: '/api/pipes', node: '/api/nodes', incident: '/api/incidents' }[sel.layer]

  async function save() {
    setBusy(true)
    setMsg(null)
    try {
      const body = { ...v }
      for (const k of ['id', 'length_m', 'start_node_id', 'end_node_id', 'connected_pipes', 'customer_count', 'incident_count',
        'logs', 'isolation', 'reported_at', 'resolved_at', 'code_auto', 'split_pipes', 'has_isolation', 'zone_id']) delete body[k]
      if (sel.layer === 'incident' && !sel.isNew) for (const k of ['reporter', 'reporter_phone', 'node_id', 'code']) delete body[k]
      if (sel.isNew) body.geometry = sel.geometry
      const r = sel.isNew ? await api.post(endpoint + (sel.snapM ? `?snap_m=${sel.snapM}` : ''), body) : await api.put(`${endpoint}/${sel.id}`, body)
      const split = r.properties?.split_pipes?.length ? ` – đã tách ống ${r.properties.split_pipes.join(' / ')}` : ''
      setMsg({ ok: true, text: `Đã lưu ${r.properties.code}${split}` })
      keepMsg.current = true
      onSaved(sel.layer, r)
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!window.confirm('Xóa đối tượng này?')) return
    try {
      await api.del(`${endpoint}/${sel.id}`)
      onSaved(sel.layer, null)
      onClose()
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    }
  }

  const title = sel.isNew
    ? { pipe: 'Thêm đường ống', node: `Thêm ${NODE_TYPES[v.node_type]?.label?.toLowerCase() || 'nút'}`, incident: 'Báo sự cố mới' }[sel.layer]
    : `${{ pipe: 'Đường ống', node: NODE_TYPES[v.node_type]?.label, customer: 'Khách hàng', incident: 'Sự cố', zone: 'Vùng DMA' }[sel.layer] || ''} ${v.code || ''}`

  return (
    <div className="side-panel floating">
      <div className="hd"><h3 style={{ margin: 0 }}>{title}</h3><button className="x" onClick={onClose}>×</button></div>
      <div className="bd">
        {sel.layer === 'pipe' && (
          <>
            {!sel.isNew && (
              <dl className="kv">
                <dt>Chiều dài</dt><dd><b>{fmt.num(v.length_m, 1)} m</b></dd>
                <dt>Khách hàng đấu nối</dt><dd>{extra ? <Link to={`/customers?pipe_id=${sel.id}`}>{extra.customer_count}</Link> : '…'}</dd>
                <dt>Số sự cố đã ghi</dt><dd>{extra?.incident_count ?? '…'}</dd>
              </dl>
            )}
            <Form fields={PIPE_FIELDS} values={v} onChange={change} disabled={!canEdit} />
          </>
        )}
        {sel.layer === 'node' && (
          <>
            <Form fields={nodeFields(v.node_type)} values={v} onChange={change} disabled={!canEdit} />
            {extra?.connected_pipes && (
              <p className="small muted">Ống nối: {extra.connected_pipes.map((p) => `${p.code} (D${p.diameter_mm})`).join(', ') || 'không có'}</p>
            )}
            {sel.isNew && <p className="small muted">Nếu điểm nằm trên ống, ống sẽ tự động được tách tại vị trí này.</p>}
          </>
        )}
        {sel.layer === 'customer' && (
          <dl className="kv">
            <dt>Mã KH</dt><dd>{v.code}</dd><dt>Tên</dt><dd>{v.name}</dd><dt>Địa chỉ</dt><dd>{v.address}</dd>
            <dt>Điện thoại</dt><dd>{v.phone}</dd><dt>Loại</dt><dd>{CUSTOMER_TYPES[v.customer_type]}</dd>
            <dt></dt><dd><Link to={`/customers?id=${sel.id}`}>Xem hồ sơ, đồng hồ, chỉ số →</Link></dd>
          </dl>
        )}
        {sel.layer === 'zone' && <dl className="kv"><dt>Mã</dt><dd>{v.code}</dd><dt>Tên</dt><dd>{v.name}</dd></dl>}
        {sel.layer === 'incident' && (
          <>
            {!sel.isNew && (
              <dl className="kv">
                <dt>Trạng thái</dt><dd><span className="badge" style={{ background: INCIDENT_STATUS[v.status]?.color }}>{INCIDENT_STATUS[v.status]?.label}</span></dd>
                <dt>Tiếp nhận</dt><dd>{fmt.date(v.reported_at)}</dd>
                <dt>Người báo</dt><dd>{v.reporter} {v.reporter_phone}</dd>
                <dt></dt><dd><Link to={`/incidents?id=${sel.id}`}>Mở phiếu xử lý →</Link></dd>
              </dl>
            )}
            <Form fields={INCIDENT_FIELDS.filter((f) => sel.isNew || !['reporter', 'reporter_phone'].includes(f.name))} values={v} onChange={change} disabled={!canEdit && !sel.isNew} />
            {sel.isNew && <p className="small muted">Hệ thống tự gắn ống gần nhất (≤ 30 m) và phân tích van cần đóng với sự cố rò rỉ/vỡ ống.</p>}
          </>
        )}
        {msg && <div className={`alert ${msg.ok ? 'ok' : 'error'}`}>{msg.text}</div>}
      </div>
      <div className="ft">
        {(canEdit || (sel.isNew && sel.layer === 'incident')) && ['pipe', 'node', 'incident'].includes(sel.layer) && (
          <button className="btn primary" onClick={save} disabled={busy}>{sel.isNew ? 'Thêm mới' : 'Lưu'}</button>
        )}
        {!sel.isNew && sel.layer === 'pipe' && <button className="btn" onClick={() => onIsolate(sel.id)}>Phân tích cô lập</button>}
        {!sel.isNew && sel.layer === 'pipe' && <button className="btn" onClick={() => onReportHere(sel)}>Báo sự cố</button>}
        {!sel.isNew && canEdit && sel.layer === 'pipe' && <button className="btn" onClick={() => onEditGeom(sel)}>Sửa hình học</button>}
        {!sel.isNew && canEdit && sel.layer === 'node' && <button className="btn" onClick={() => onMove(sel)}>Di chuyển</button>}
        {!sel.isNew && canEdit && ['pipe', 'node'].includes(sel.layer) && <button className="btn danger" onClick={remove}>Xóa</button>}
      </div>
    </div>
  )
}
