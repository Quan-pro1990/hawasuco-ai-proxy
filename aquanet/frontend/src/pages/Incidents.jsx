import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, auth } from '../api'
import { INCIDENT_STATUS, INCIDENT_TYPES, SEVERITY, fmt } from '../labels'
import MaterialRows, { materialPayload } from '../components/MaterialRows'
import Photos from '../components/Photos'

/** Vật tư đã xuất cho phiếu sự cố + xuất thêm. */
function IncidentMaterials({ id }) {
  const [usage, setUsage] = useState(null)
  const [materials, setMaterials] = useState([])
  const [rows, setRows] = useState([])
  const [err, setErr] = useState(null)
  const load = () => api.get(`/api/materials/usage?ref_type=incident&ref_id=${id}`).then(setUsage)
  useEffect(() => { setRows([]); setErr(null); load(); if (auth.canField()) api.get('/api/materials').then(setMaterials) }, [id]) // eslint-disable-line
  async function issue() {
    try {
      setUsage(await api.post('/api/materials/issue', { ref_type: 'incident', ref_id: id, items: materialPayload(rows) }))
      setRows([]); setErr(null)
    } catch (e) { setErr(e.message) }
  }
  if (!usage) return null
  return (
    <>
      {usage.items.length > 0 ? (
        <table className="tbl">
          <tbody>{usage.items.map((m) => <tr key={m.id}><td>{m.code} – {m.name}</td><td className="num">{fmt.num(m.qty, 2)} {m.unit}</td><td className="num">{fmt.money(m.amount)}</td></tr>)}</tbody>
          <tfoot><tr><td colSpan={2}><b>Chi phí vật tư</b></td><td className="num"><b>{fmt.money(usage.total_cost)}</b></td></tr></tfoot>
        </table>
      ) : <p className="muted small">Chưa xuất vật tư cho phiếu này.</p>}
      {auth.canField() && (
        <div style={{ marginTop: 6 }}>
          <MaterialRows materials={materials} rows={rows} setRows={setRows} />
          {rows.length > 0 && <button className="btn sm primary" style={{ marginTop: 6 }} onClick={issue}>Xuất kho cho sự cố</button>}
          {err && <div className="alert error">{err}</div>}
        </div>
      )}
    </>
  )
}

const FLOW = ['new', 'assigned', 'in_progress', 'resolved', 'closed']

export default function Incidents() {
  const [params] = useSearchParams()
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState({ status: '', incident_type: '', open_only: true })
  const [selId, setSelId] = useState(params.get('id') ? Number(params.get('id')) : null)
  const [detail, setDetail] = useState(null)
  const [upd, setUpd] = useState({})
  const [msg, setMsg] = useState(null)
  const canEdit = auth.canEdit()

  async function load() {
    const qs = new URLSearchParams()
    if (filter.status) qs.set('status', filter.status)
    if (filter.incident_type) qs.set('incident_type', filter.incident_type)
    if (filter.open_only && !filter.status) qs.set('open_only', 'true')
    const r = await api.get('/api/incidents?' + qs)
    setItems(r.features)
  }
  useEffect(() => { load() }, [filter]) // eslint-disable-line

  useEffect(() => {
    if (!selId) return setDetail(null)
    api.get(`/api/incidents/${selId}`).then((f) => {
      setDetail(f.properties)
      setUpd({ status: f.properties.status, assignee: f.properties.assignee || '', repair_cost: f.properties.repair_cost, est_loss_m3: f.properties.est_loss_m3, resolution: f.properties.resolution || '', note: '' })
      setMsg(null)
    })
  }, [selId])

  async function save() {
    try {
      const body = { ...upd }
      if (!body.note) delete body.note
      const r = await api.put(`/api/incidents/${selId}`, body)
      setDetail(r.properties)
      setUpd((u) => ({ ...u, note: '' }))
      setMsg({ ok: true, text: 'Đã cập nhật phiếu sự cố' })
      load()
    } catch (e) { setMsg({ ok: false, text: e.message }) }
  }

  const iso = detail?.isolation
  const nextStatus = detail ? FLOW[FLOW.indexOf(detail.status) + 1] : null

  return (
    <div className="page">
      <div className="page-head">
        <h2>Quản lý sự cố & sửa chữa</h2>
        <div className="row">
          <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} style={{ width: 170 }}>
            <option value="">Mọi trạng thái</option>
            {Object.entries(INCIDENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filter.incident_type} onChange={(e) => setFilter({ ...filter, incident_type: e.target.value })} style={{ width: 170 }}>
            <option value="">Mọi loại sự cố</option>
            {Object.entries(INCIDENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <label className="row" style={{ margin: 0 }}><input type="checkbox" style={{ width: 'auto' }} checked={filter.open_only} onChange={(e) => setFilter({ ...filter, open_only: e.target.checked })} />Chỉ sự cố chưa xử lý xong</label>
          <Link className="btn primary" to="/map">+ Báo sự cố trên bản đồ</Link>
        </div>
      </div>
      <div className="split">
        <div className="scroll">
          <table className="tbl">
            <thead><tr><th>Mã</th><th>Sự cố</th><th>Loại</th><th>Mức độ</th><th>Trạng thái</th><th>Giao cho</th><th>Tiếp nhận</th></tr></thead>
            <tbody>
              {items.map((f) => {
                const p = f.properties
                return (
                  <tr key={f.id} className={f.id === selId ? 'sel' : ''} onClick={() => setSelId(f.id)}>
                    <td>{p.code}</td><td>{p.title}</td><td>{INCIDENT_TYPES[p.incident_type]}</td>
                    <td><span className="badge" style={{ background: SEVERITY[p.severity]?.color }}>{SEVERITY[p.severity]?.label}</span></td>
                    <td><span className="badge" style={{ background: INCIDENT_STATUS[p.status]?.color }}>{INCIDENT_STATUS[p.status]?.label}</span></td>
                    <td>{p.assignee || '—'}</td><td>{fmt.date(p.reported_at)}</td>
                  </tr>
                )
              })}
              {!items.length && <tr><td colSpan={7} className="muted">Không có sự cố phù hợp</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ maxHeight: 'calc(100vh - 170px)', overflow: 'auto' }}>
          {!detail && <p className="muted">Chọn một sự cố để xem phiếu xử lý.</p>}
          {detail && (
            <>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0 }}>{detail.code}</h3>
                <Link to={`/map?incident=${selId}`}>Xem trên bản đồ →</Link>
              </div>
              <p><b>{detail.title}</b><br /><span className="muted">{detail.description}</span></p>
              <dl className="kv">
                <dt>Loại / mức độ</dt><dd>{INCIDENT_TYPES[detail.incident_type]} · {SEVERITY[detail.severity]?.label}</dd>
                <dt>Người báo</dt><dd>{detail.reporter} {detail.reporter_phone}</dd>
                <dt>Tiếp nhận</dt><dd>{fmt.date(detail.reported_at)}</dd>
                <dt>Hoàn thành</dt><dd>{fmt.date(detail.resolved_at)}</dd>
                <dt>Đường ống</dt><dd>{detail.pipe_id ? <Link to={`/map?pipe=${detail.pipe_id}`}>#{detail.pipe_id}</Link> : '—'}</dd>
              </dl>
              {iso && (
                <div className="alert warn">
                  <b>Phương án cô lập:</b> đóng {iso.valves.length} van ({iso.valve_list.map((v) => v.code).join(', ')}) ·
                  {' '}{iso.affected_customers} khách hàng bị ngưng cấp nước · {fmt.num(iso.segment_length_m + iso.downstream_length_m)} m ống
                </div>
              )}

              {canEdit && (
                <>
                  <h3 style={{ marginTop: 12 }}>Cập nhật xử lý</h3>
                  {nextStatus && (
                    <button className="btn primary sm" style={{ marginBottom: 8 }} onClick={() => setUpd({ ...upd, status: nextStatus })}>
                      Chuyển sang: {INCIDENT_STATUS[nextStatus].label}
                    </button>
                  )}
                  <div className="grid2">
                    <label>Trạng thái
                      <select value={upd.status} onChange={(e) => setUpd({ ...upd, status: e.target.value })}>
                        {Object.entries(INCIDENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </label>
                    <label>Giao cho<input value={upd.assignee} onChange={(e) => setUpd({ ...upd, assignee: e.target.value })} placeholder="Tổ sửa chữa…" /></label>
                    <label>Chi phí sửa chữa (đ)<input type="number" value={upd.repair_cost ?? ''} onChange={(e) => setUpd({ ...upd, repair_cost: e.target.value === '' ? null : Number(e.target.value) })} /></label>
                    <label>Nước thất thoát ước tính (m³)<input type="number" value={upd.est_loss_m3 ?? ''} onChange={(e) => setUpd({ ...upd, est_loss_m3: e.target.value === '' ? null : Number(e.target.value) })} /></label>
                    <label style={{ gridColumn: '1/-1' }}>Kết quả khắc phục<textarea rows={2} value={upd.resolution} onChange={(e) => setUpd({ ...upd, resolution: e.target.value })} /></label>
                    <label style={{ gridColumn: '1/-1' }}>Ghi chú nhật ký<input value={upd.note} onChange={(e) => setUpd({ ...upd, note: e.target.value })} placeholder="VD: Đã đóng van V00012, đang đào thay ống" /></label>
                  </div>
                  <button className="btn primary" onClick={save}>Lưu cập nhật</button>
                  {msg && <div className={`alert ${msg.ok ? 'ok' : 'error'}`}>{msg.text}</div>}
                </>
              )}

              <h3 style={{ marginTop: 16 }}>Ảnh hiện trường</h3>
              <Photos ownerType="incident" ownerId={selId} canUpload />
              <h3 style={{ marginTop: 16 }}>Vật tư sử dụng</h3>
              <IncidentMaterials id={selId} />

              <h3 style={{ marginTop: 16 }}>Nhật ký xử lý</h3>
              <ul className="timeline">
                {detail.logs.map((l, i) => (
                  <li key={i}><b>{INCIDENT_STATUS[l.status]?.label}</b> · <span className="muted">{fmt.date(l.created_at)} – {l.user}</span>{l.note && <div>{l.note}</div>}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
