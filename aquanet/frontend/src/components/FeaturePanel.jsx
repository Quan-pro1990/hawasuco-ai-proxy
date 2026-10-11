import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, auth } from '../api'
import { CUSTOMER_TYPES, INCIDENT_STATUS, INCIDENT_TYPES, MAINT_RESULTS, MAINT_STATUS, MAINT_TASK_TYPES, MATERIALS, NODE_TYPES, PIPE_CLASS, PIPE_STATUS, SENSOR_STATUS, SENSOR_TYPES, SEVERITY, fmt } from '../labels'
import { Form } from './Form'

const OPEN = ['planned', 'assigned', 'in_progress']

/** Tình trạng bảo trì của thiết bị: lần gần nhất, lệnh đang mở, tạo lệnh mới. */
function NodeMaintenance({ node }) {
  const [tasks, setTasks] = useState(null)
  const [msg, setMsg] = useState(null)
  const load = () => api.get(`/api/maintenance/tasks?node_id=${node.id}&limit=20`).then(setTasks).catch(() => setTasks([]))
  useEffect(() => { setTasks(null); load() }, [node.id]) // eslint-disable-line
  if (!tasks) return null
  const open = tasks.find((t) => OPEN.includes(t.status))
  const last = tasks.find((t) => t.status === 'done')
  async function create() {
    const task_type = { valve: 'exercise', hydrant: 'flush' }[node.node_type] || 'inspect'
    try {
      await api.post('/api/maintenance/tasks', { node_id: node.id, task_type, due_date: new Date().toISOString().slice(0, 10) })
      setMsg(null)
      load()
    } catch (e) { setMsg(e.message) }
  }
  return (
    <div className="card" style={{ padding: '8px 12px', margin: '6px 0 10px' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}><b>Bảo trì</b><Link className="small" to={`/maintenance?node=${node.id}`}>Lịch sử →</Link></div>
      <dl className="kv" style={{ margin: '6px 0' }}>
        <dt>Lần gần nhất</dt>
        <dd>{last ? <>{fmt.day(last.completed_at)} · {MAINT_TASK_TYPES[last.task_type]} · <span style={{ color: MAINT_RESULTS[last.result]?.color }}>{MAINT_RESULTS[last.result]?.label}</span></> : <span className="muted">chưa có</span>}</dd>
        <dt>Lệnh đang mở</dt>
        <dd>{open ? <>{open.code} · hạn <b style={{ color: open.overdue ? '#dc2626' : null }}>{fmt.day(open.due_date)}</b> · {MAINT_STATUS[open.status]?.label}</> : <span className="muted">không</span>}</dd>
      </dl>
      {auth.canEdit() && !open && <button className="btn sm" onClick={create}>+ Tạo lệnh bảo trì</button>}
      {msg && <div className="alert error">{msg}</div>}
    </div>
  )
}

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
    : `${{ pipe: 'Đường ống', node: NODE_TYPES[v.node_type]?.label, customer: 'Khách hàng', incident: 'Sự cố', zone: 'Vùng DMA', sensor: 'Điểm đo' }[sel.layer] || ''} ${v.code || ''}`

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
        {sel.layer === 'sensor' && (
          <dl className="kv">
            <dt>Tên</dt><dd>{v.name}</dd>
            <dt>Loại</dt><dd>{SENSOR_TYPES[v.sensor_type]}</dd>
            <dt>Giá trị</dt><dd><b style={{ fontSize: 18 }}>{v.last_value == null ? '—' : fmt.num(v.last_value, 2)}</b> {v.unit}</dd>
            <dt>Cập nhật</dt><dd>{fmt.ago(v.last_ts)}</dd>
            <dt>Trạng thái</dt><dd><span className="badge" style={{ background: SENSOR_STATUS[v.status]?.color }}>{SENSOR_STATUS[v.status]?.label}</span></dd>
            <dt>Ngưỡng</dt><dd>{v.min_alarm ?? '—'} … {v.max_alarm ?? '—'} {v.unit}</dd>
            <dt>Tag SCADA</dt><dd><code>{v.external_id || '—'}</code></dd>
            <dt></dt><dd><Link to={`/scada?sensor=${sel.id}`}>Xem biểu đồ, cảnh báo →</Link></dd>
          </dl>
        )}
        {sel.layer === 'node' && (
          <>
            {!sel.isNew && sel.id && v.node_type && v.node_type !== 'junction' && <NodeMaintenance node={{ id: sel.id, node_type: v.node_type }} />}
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
