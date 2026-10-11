import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, auth } from '../api'
import { MAINT_RESULTS, MAINT_STATUS, MAINT_TASK_TYPES, MATERIAL_CATEGORIES, NODE_TYPES, STOCK_KIND, fmt } from '../labels'
import { Form } from '../components/Form'
import MaterialRows, { materialPayload } from '../components/MaterialRows'
import Photos from '../components/Photos'

const VIEWS = { open: 'Đang mở', overdue: 'Quá hạn', week: 'Đến hạn 7 ngày', done: 'Đã hoàn thành', all: 'Tất cả' }
const MAINTAINABLE = Object.fromEntries(Object.entries(NODE_TYPES).filter(([k]) => k !== 'junction'))

function Badge({ map, k }) {
  return map[k] ? <span className="badge" style={{ background: map[k].color }}>{map[k].label}</span> : null
}

/* ------------------------------------------------------------ Lệnh công việc */
function TaskDetail({ id, onChanged }) {
  const [t, setT] = useState(null)
  const [materials, setMaterials] = useState([])
  const [done, setDone] = useState(null)
  const [edit, setEdit] = useState(null)
  const [msg, setMsg] = useState(null)
  const load = () => api.get(`/api/maintenance/tasks/${id}`).then((x) => {
    setT(x)
    setEdit({ assignee: x.assignee || '', due_date: x.due_date, status: x.status })
    setDone({ result: 'ok', checklist_result: Object.fromEntries((x.checklist || []).map((c) => [c, false])), note: '', turns: '', duration_min: '', create_incident: true, rows: [] })
  })
  useEffect(() => { setMsg(null); load(); api.get('/api/materials').then(setMaterials) }, [id]) // eslint-disable-line
  if (!t) return <div className="card muted">Đang tải…</div>
  const open = ['planned', 'assigned', 'in_progress'].includes(t.status)

  async function complete() {
    try {
      await api.post(`/api/maintenance/tasks/${id}/complete`, {
        result: done.result, checklist_result: done.checklist_result, note: done.note || null,
        turns: done.turns === '' ? null : Number(done.turns), duration_min: done.duration_min === '' ? null : Number(done.duration_min),
        materials: materialPayload(done.rows), create_incident: done.create_incident,
      })
      setMsg({ ok: true, text: 'Đã ghi nhận hoàn thành' }); load(); onChanged()
    } catch (e) { setMsg({ ok: false, text: e.message }) }
  }
  async function saveEdit() {
    try { await api.put(`/api/maintenance/tasks/${id}`, { ...edit, assignee: edit.assignee || null }); setMsg({ ok: true, text: 'Đã cập nhật lệnh' }); load(); onChanged() }
    catch (e) { setMsg({ ok: false, text: e.message }) }
  }

  return (
    <div className="card" style={{ maxHeight: 'calc(100vh - 250px)', overflow: 'auto' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>{t.code} · {t.task_label}</h3>
        <Link to={`/map?node=${t.node_id}`}>Xem trên bản đồ →</Link>
      </div>
      <dl className="kv" style={{ marginTop: 10 }}>
        <dt>Thiết bị</dt><dd><b>{t.node_code}</b> · {NODE_TYPES[t.node_type]?.label}{t.node_diameter ? ` D${t.node_diameter}` : ''}{t.node_type === 'valve' ? ` · đang ${t.node_status === 'closed' ? 'ĐÓNG' : 'mở'}` : ''}</dd>
        <dt>Hạn</dt><dd style={{ color: t.overdue ? '#dc2626' : null }}>{fmt.day(t.due_date)}{t.overdue && ' (quá hạn)'}</dd>
        <dt>Trạng thái</dt><dd><Badge map={MAINT_STATUS} k={t.status} /></dd>
        <dt>Giao cho</dt><dd>{t.assignee || '—'}</dd>
        {t.status === 'done' && <>
          <dt>Hoàn thành</dt><dd>{fmt.date(t.completed_at)} – {t.completed_by}</dd>
          <dt>Kết quả</dt><dd><Badge map={MAINT_RESULTS} k={t.result} />{t.incident_id && <> · <Link to={`/incidents?id=${t.incident_id}`}>phiếu sự cố</Link></>}</dd>
          {t.turns != null && <><dt>Số vòng van</dt><dd>{t.turns}</dd></>}
          {t.duration_min != null && <><dt>Thời gian</dt><dd>{t.duration_min} phút</dd></>}
          {t.note && <><dt>Ghi chú</dt><dd>{t.note}</dd></>}
        </>}
      </dl>
      {t.checklist?.length > 0 && t.status === 'done' && (
        <ul className="checklist">{t.checklist.map((c) => <li key={c} className={t.checklist_result?.[c] ? 'ok' : ''}>{c}</li>)}</ul>
      )}
      {t.materials?.items.length > 0 && (
        <>
          <h3 style={{ marginTop: 12 }}>Vật tư đã dùng</h3>
          <table className="tbl"><tbody>{t.materials.items.map((m) => <tr key={m.id}><td>{m.code} – {m.name}</td><td className="num">{fmt.num(m.qty, 2)} {m.unit}</td><td className="num">{fmt.money(m.amount)}</td></tr>)}</tbody></table>
          <p className="small muted">Tổng chi phí vật tư: <b>{fmt.money(t.materials.total_cost)}</b></p>
        </>
      )}

      {open && auth.canField() && done && (
        <>
          <h3 style={{ marginTop: 14 }}>Ghi kết quả bảo trì</h3>
          {t.checklist?.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {t.checklist.map((c) => (
                <label key={c} className="row" style={{ margin: '2px 0', color: 'var(--text)' }}>
                  <input type="checkbox" style={{ width: 'auto' }} checked={!!done.checklist_result[c]} onChange={(e) => setDone({ ...done, checklist_result: { ...done.checklist_result, [c]: e.target.checked } })} />{c}
                </label>
              ))}
            </div>
          )}
          <div className="grid2">
            <label>Kết quả<select value={done.result} onChange={(e) => setDone({ ...done, result: e.target.value })}>{Object.entries(MAINT_RESULTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
            {t.task_type === 'exercise'
              ? <label>Số vòng vận hành<input type="number" value={done.turns} onChange={(e) => setDone({ ...done, turns: e.target.value })} /></label>
              : <label>Thời gian (phút)<input type="number" value={done.duration_min} onChange={(e) => setDone({ ...done, duration_min: e.target.value })} /></label>}
            <label style={{ gridColumn: '1/-1' }}>Ghi chú<textarea rows={2} value={done.note} onChange={(e) => setDone({ ...done, note: e.target.value })} /></label>
          </div>
          {done.result !== 'ok' && (
            <label className="row" style={{ color: 'var(--text)' }}><input type="checkbox" style={{ width: 'auto' }} checked={done.create_incident} onChange={(e) => setDone({ ...done, create_incident: e.target.checked })} />Tự lập phiếu sự cố "{t.node_type === 'valve' ? 'hỏng van' : 'thiết bị hỏng'}"</label>
          )}
          <div className="small muted" style={{ margin: '6px 0 4px' }}>Vật tư sử dụng (tự trừ kho)</div>
          <MaterialRows materials={materials} rows={done.rows} setRows={(rows) => setDone({ ...done, rows })} />
          <button className="btn primary" style={{ marginTop: 10 }} onClick={complete}>Hoàn thành lệnh</button>
        </>
      )}
      {open && auth.canEdit() && edit && (
        <details style={{ marginTop: 12 }}>
          <summary>Điều phối lệnh (giao việc, đổi hạn, hủy)</summary>
          <div className="grid2" style={{ marginTop: 8 }}>
            <label>Giao cho<input value={edit.assignee} onChange={(e) => setEdit({ ...edit, assignee: e.target.value })} placeholder="Tổ hiện trường…" /></label>
            <label>Hạn<input type="date" value={edit.due_date} onChange={(e) => setEdit({ ...edit, due_date: e.target.value })} /></label>
            <label>Trạng thái<select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>{Object.entries(MAINT_STATUS).filter(([k]) => k !== 'done').map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
          </div>
          <button className="btn sm" onClick={saveEdit}>Lưu điều phối</button>
        </details>
      )}
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'error'}`}>{msg.text}</div>}
      <h3 style={{ marginTop: 14 }}>Ảnh hiện trường</h3>
      <Photos ownerType="task" ownerId={t.id} canUpload={auth.canField()} />
    </div>
  )
}

function Tasks({ onChanged }) {
  const [params, setParams] = useSearchParams()
  const nodeId = params.get('node')
  const [view, setView] = useState(nodeId ? 'all' : 'open')
  const [nodeType, setNodeType] = useState('')
  const [assignee, setAssignee] = useState('')
  const [items, setItems] = useState([])
  const [selId, setSelId] = useState(params.get('task') ? Number(params.get('task')) : null)

  async function load() {
    const qs = new URLSearchParams({ limit: 1000 })
    if (view === 'open') qs.set('open_only', 'true')
    if (view === 'overdue') qs.set('overdue', 'true')
    if (view === 'week') qs.set('due_within_days', '7')
    if (view === 'done') qs.set('status', 'done')
    if (nodeType) qs.set('node_type', nodeType)
    if (assignee) qs.set('assignee', assignee)
    if (nodeId) qs.set('node_id', nodeId)
    setItems(await api.get('/api/maintenance/tasks?' + qs))
  }
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t) }, [view, nodeType, assignee, nodeId]) // eslint-disable-line

  return (
    <div className="split">
      <div>
        <div className="row" style={{ marginBottom: 10 }}>
          {Object.entries(VIEWS).map(([k, v]) => <button key={k} className={`btn sm ${view === k ? 'on' : ''}`} onClick={() => setView(k)}>{v}</button>)}
          <select value={nodeType} onChange={(e) => setNodeType(e.target.value)} style={{ width: 150 }}>
            <option value="">Mọi thiết bị</option>
            {Object.entries(MAINTAINABLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <input placeholder="Người thực hiện…" value={assignee} onChange={(e) => setAssignee(e.target.value)} style={{ width: 170 }} />
          {nodeId && <span className="badge" style={{ background: '#0a6ebd' }}>Thiết bị #{nodeId} <a href="#" style={{ color: '#fff' }} onClick={(e) => { e.preventDefault(); setParams({}) }}>×</a></span>}
          <span className="muted">{items.length} lệnh</span>
        </div>
        <div className="scroll" style={{ maxHeight: 'calc(100vh - 310px)' }}>
          <table className="tbl">
            <thead><tr><th>Mã</th><th>Thiết bị</th><th>Công việc</th><th>Hạn</th><th>Trạng thái</th><th>Giao cho</th><th>Kết quả</th></tr></thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className={t.id === selId ? 'sel' : ''} onClick={() => setSelId(t.id)}>
                  <td>{t.code}</td>
                  <td><b>{t.node_code}</b> <span className="muted small">{NODE_TYPES[t.node_type]?.label}{t.node_diameter ? ` D${t.node_diameter}` : ''}</span></td>
                  <td>{MAINT_TASK_TYPES[t.task_type]}</td>
                  <td style={{ color: t.overdue ? '#dc2626' : null, fontWeight: t.overdue ? 600 : null }}>{fmt.day(t.due_date)}</td>
                  <td><Badge map={MAINT_STATUS} k={t.status} /></td>
                  <td>{t.assignee || '—'}</td>
                  <td>{t.result ? <Badge map={MAINT_RESULTS} k={t.result} /> : ''}</td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan={7} className="muted">Không có lệnh phù hợp</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {selId ? <TaskDetail id={selId} onChanged={() => { load(); onChanged() }} /> : <div className="card muted">Chọn một lệnh để xem chi tiết, ghi kết quả.</div>}
    </div>
  )
}

/* ------------------------------------------------------------ Kế hoạch định kỳ */
const PLAN_FIELDS = (zones) => [
  { name: 'name', label: 'Tên kế hoạch', full: true },
  { name: 'node_type', label: 'Loại thiết bị', options: MAINTAINABLE },
  { name: 'task_type', label: 'Công việc', options: MAINT_TASK_TYPES },
  { name: 'interval_days', label: 'Chu kỳ (ngày)', type: 'number' },
  { name: 'min_diameter', label: 'Chỉ thiết bị từ D (mm)', type: 'number' },
  { name: 'zone_id', label: 'Phạm vi DMA', options: Object.fromEntries(zones.map((z) => [z.id, z.properties.name])), optional: true },
  { name: 'default_assignee', label: 'Giao mặc định cho' },
  { name: 'checklist_text', label: 'Danh mục kiểm tra (mỗi dòng một bước)', type: 'textarea', full: true },
]

function Plans({ onChanged }) {
  const [plans, setPlans] = useState([])
  const [zones, setZones] = useState([])
  const [form, setForm] = useState(null)
  const [horizon, setHorizon] = useState(30)
  const [msg, setMsg] = useState(null)
  const canEdit = auth.canEdit()
  const load = () => api.get('/api/maintenance/plans').then(setPlans)
  useEffect(() => { load(); api.get('/api/zones').then((r) => setZones(r.features)) }, [])

  async function save() {
    const { checklist_text, id, open_tasks, ...body } = form
    body.checklist = (checklist_text || '').split('\n').map((x) => x.trim()).filter(Boolean)
    body.zone_id = body.zone_id ? Number(body.zone_id) : null
    try {
      if (id) await api.put(`/api/maintenance/plans/${id}`, body)
      else await api.post('/api/maintenance/plans', body)
      setForm(null); setMsg({ ok: true, text: 'Đã lưu kế hoạch' }); load()
    } catch (e) { setMsg({ ok: false, text: e.message }) }
  }
  async function generate(p) {
    try {
      const r = await api.post(`/api/maintenance/plans/${p.id}/generate?horizon_days=${horizon}`)
      setMsg({ ok: true, text: `${p.name}: đã sinh ${r.created} lệnh (${r.overdue} lệnh đã quá hạn)` }); load(); onChanged()
    } catch (e) { setMsg({ ok: false, text: e.message }) }
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 10 }}>
        {canEdit && <button className="btn primary" onClick={() => setForm({ node_type: 'valve', task_type: 'exercise', interval_days: 365, active: true, checklist_text: '' })}>+ Kế hoạch</button>}
        <label className="row" style={{ margin: 0 }}>Sinh lệnh đến hạn trong <input type="number" value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} style={{ width: 70 }} /> ngày tới</label>
      </div>
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'error'}`}>{msg.text}</div>}
      {form && (
        <div className="card" style={{ maxWidth: 720, marginBottom: 12 }}>
          <Form fields={PLAN_FIELDS(zones)} values={form} onChange={(k, v) => setForm({ ...form, [k]: v })} />
          <label className="row" style={{ color: 'var(--text)' }}><input type="checkbox" style={{ width: 'auto' }} checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />Đang áp dụng</label>
          <div className="row"><button className="btn primary" onClick={save}>Lưu</button><button className="btn" onClick={() => setForm(null)}>Hủy</button></div>
        </div>
      )}
      <table className="tbl">
        <thead><tr><th>Kế hoạch</th><th>Thiết bị</th><th>Công việc</th><th className="num">Chu kỳ</th><th>Phạm vi</th><th className="num">Lệnh đang mở</th><th></th></tr></thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.id}>
              <td><b>{p.name}</b>{!p.active && <span className="muted small"> (tạm dừng)</span>}<div className="small muted">{p.checklist.length} bước kiểm tra · {p.default_assignee || 'chưa giao'}</div></td>
              <td>{NODE_TYPES[p.node_type]?.label}{p.min_diameter ? ` ≥ D${p.min_diameter}` : ''}</td>
              <td>{MAINT_TASK_TYPES[p.task_type]}</td>
              <td className="num">{p.interval_days} ngày</td>
              <td>{zones.find((z) => z.id === p.zone_id)?.properties.name || 'Toàn mạng'}</td>
              <td className="num">{p.open_tasks}</td>
              <td>{canEdit && <div className="row">
                <button className="btn sm primary" disabled={!p.active} onClick={() => generate(p)}>Sinh lệnh</button>
                <button className="btn sm" onClick={() => setForm({ ...p, checklist_text: p.checklist.join('\n') })}>Sửa</button>
                <button className="btn sm danger" onClick={async () => { if (confirm('Xóa kế hoạch? Các lệnh đã sinh vẫn giữ lại.')) { await api.del(`/api/maintenance/plans/${p.id}`); load() } }}>Xóa</button>
              </div>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

/* ------------------------------------------------------------ Kho vật tư */
const MAT_FIELDS = [
  { name: 'code', label: 'Mã (bỏ trống để tự sinh)' }, { name: 'name', label: 'Tên vật tư' },
  { name: 'category', label: 'Nhóm', options: MATERIAL_CATEGORIES }, { name: 'spec', label: 'Quy cách' },
  { name: 'unit', label: 'Đơn vị tính' }, { name: 'min_stock', label: 'Tồn tối thiểu', type: 'number' },
  { name: 'location', label: 'Kho / vị trí' }, { name: 'unit_price', label: 'Đơn giá tham khảo (đ)', type: 'number' },
]

function Stock({ onChanged }) {
  const [items, setItems] = useState([])
  const [q, setQ] = useState('')
  const [low, setLow] = useState(false)
  const [op, setOp] = useState(null) // {kind: receive|adjust|new, m, ...}
  const [msg, setMsg] = useState(null)
  const canEdit = auth.canEdit()
  const load = () => api.get(`/api/materials?${new URLSearchParams({ ...(q && { q }), ...(low && { low: 'true' }) })}`).then(setItems)
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t) }, [q, low]) // eslint-disable-line

  async function submit() {
    try {
      if (op.kind === 'new') { const { kind, ...b } = op; await api.post('/api/materials', { ...b, code: b.code || null }) }
      if (op.kind === 'receive') await api.post(`/api/materials/${op.m.id}/receive`, { qty: Number(op.qty), unit_price: op.unit_price === '' || op.unit_price == null ? null : Number(op.unit_price), note: op.note })
      if (op.kind === 'adjust') await api.post(`/api/materials/${op.m.id}/adjust`, { counted_qty: Number(op.qty), note: op.note })
      setMsg({ ok: true, text: { new: 'Đã thêm vật tư', receive: `Đã nhập kho ${op.m?.code}`, adjust: `Đã kiểm kê ${op.m?.code}` }[op.kind] })
      setOp(null); load(); onChanged()
    } catch (e) { setMsg({ ok: false, text: e.message }) }
  }
  const total = items.reduce((a, m) => a + m.value, 0)

  return (
    <>
      <div className="row" style={{ marginBottom: 10 }}>
        <input placeholder="Tìm mã, tên, quy cách…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 280 }} />
        <label className="row" style={{ margin: 0 }}><input type="checkbox" style={{ width: 'auto' }} checked={low} onChange={(e) => setLow(e.target.checked)} />Chỉ vật tư dưới mức tối thiểu</label>
        <span className="muted">Giá trị tồn kho: <b>{fmt.money(total)}</b></span>
        {canEdit && <button className="btn primary" onClick={() => setOp({ kind: 'new', category: 'fitting', unit: 'cái', min_stock: 0, unit_price: 0 })}>+ Vật tư</button>}
      </div>
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'error'}`}>{msg.text}</div>}
      {op && (
        <div className="card" style={{ maxWidth: 720, marginBottom: 12 }}>
          <h3>{{ new: 'Thêm vật tư', receive: `Nhập kho – ${op.m?.code} ${op.m?.name}`, adjust: `Kiểm kê – ${op.m?.code} ${op.m?.name} (sổ sách: ${op.m?.stock} ${op.m?.unit})` }[op.kind]}</h3>
          {op.kind === 'new' ? <Form fields={MAT_FIELDS} values={op} onChange={(k, v) => setOp({ ...op, [k]: v })} /> : (
            <div className="grid2">
              <label>{op.kind === 'receive' ? 'Số lượng nhập' : 'Số lượng đếm thực tế'}<input type="number" value={op.qty ?? ''} onChange={(e) => setOp({ ...op, qty: e.target.value })} autoFocus /></label>
              {op.kind === 'receive' && <label>Đơn giá nhập (đ)<input type="number" value={op.unit_price ?? ''} onChange={(e) => setOp({ ...op, unit_price: e.target.value })} /></label>}
              <label style={{ gridColumn: '1/-1' }}>Ghi chú / số chứng từ<input value={op.note || ''} onChange={(e) => setOp({ ...op, note: e.target.value })} /></label>
            </div>
          )}
          <div className="row"><button className="btn primary" onClick={submit}>Lưu</button><button className="btn" onClick={() => setOp(null)}>Hủy</button></div>
        </div>
      )}
      <div className="scroll" style={{ maxHeight: 'calc(100vh - 330px)' }}>
        <table className="tbl">
          <thead><tr><th>Mã</th><th>Vật tư</th><th>Nhóm</th><th className="num">Tồn kho</th><th className="num">Tối thiểu</th><th className="num">Đơn giá BQ</th><th className="num">Giá trị</th><th></th></tr></thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id}>
                <td>{m.code}</td><td><b>{m.name}</b><div className="small muted">{[m.spec, m.location].filter(Boolean).join(' · ')}</div></td><td>{MATERIAL_CATEGORIES[m.category]}</td>
                <td className="num" style={{ color: m.low ? '#dc2626' : null, fontWeight: 600 }}>{fmt.num(m.stock, 2)} {m.unit}</td>
                <td className="num">{fmt.num(m.min_stock, 2)}</td><td className="num">{fmt.money(m.unit_price)}</td><td className="num">{fmt.money(m.value)}</td>
                <td>{canEdit && <div className="row">
                  <button className="btn sm" onClick={() => setOp({ kind: 'receive', m, unit_price: m.unit_price })}>Nhập</button>
                  <button className="btn sm" onClick={() => setOp({ kind: 'adjust', m, qty: m.stock })}>Kiểm kê</button>
                </div>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Ledger() {
  const [rows, setRows] = useState([])
  const [kind, setKind] = useState('')
  useEffect(() => { api.get(`/api/materials/movements?limit=500${kind ? `&kind=${kind}` : ''}`).then(setRows) }, [kind])
  return (
    <>
      <div className="row" style={{ marginBottom: 10 }}>
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ width: 160 }}>
          <option value="">Mọi giao dịch</option>{Object.entries(STOCK_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="scroll" style={{ maxHeight: 'calc(100vh - 320px)' }}>
        <table className="tbl">
          <thead><tr><th>Thời gian</th><th>Vật tư</th><th>Loại</th><th className="num">Số lượng</th><th className="num">Đơn giá</th><th className="num">Tồn sau</th><th>Chứng từ</th><th>Người</th><th>Ghi chú</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{fmt.date(r.created_at)}</td><td>{r.material_code} – {r.material_name}</td>
                <td><span className="badge" style={{ background: { in: '#16a34a', out: '#ea580c', adjust: '#64748b' }[r.kind] }}>{STOCK_KIND[r.kind]}</span></td>
                <td className="num">{r.qty > 0 ? '+' : ''}{fmt.num(r.qty, 2)} {r.unit}</td><td className="num">{fmt.money(r.unit_price)}</td><td className="num">{fmt.num(r.balance, 2)}</td>
                <td>{r.ref_type === 'incident' ? <Link to={`/incidents?id=${r.ref_id}`}>Sự cố #{r.ref_id}</Link> : r.ref_type === 'task' ? <Link to={`/maintenance?task=${r.ref_id}`}>Lệnh #{r.ref_id}</Link> : '—'}</td>
                <td>{r.user}</td><td>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default function Maintenance() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState('tasks')
  const [s, setS] = useState(null)
  const loadSummary = () => api.get('/api/maintenance/summary').then(setS)
  useEffect(() => { loadSummary() }, [])
  useEffect(() => { if (params.get('node') || params.get('task')) setTab('tasks') }, [params])
  const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0)

  return (
    <div className="page">
      <div className="page-head"><h2>Bảo trì van, trụ cứu hỏa & vật tư</h2></div>
      {s && (
        <div className="cards">
          <div className="card kpi"><div className="v" style={{ color: sum(s.overdue) ? '#dc2626' : undefined }}>{sum(s.overdue)}</div><div className="l">Lệnh quá hạn ({s.overdue.valve || 0} van · {s.overdue.hydrant || 0} trụ)</div></div>
          <div className="card kpi"><div className="v">{sum(s.due_7_days)}</div><div className="l">Đến hạn trong 7 ngày</div></div>
          <div className="card kpi"><div className="v">{sum(s.due_30_days)}</div><div className="l">Đến hạn trong 30 ngày</div></div>
          <div className="card kpi"><div className="v">{sum(s.done_this_year)}</div><div className="l">Hoàn thành năm nay · {(s.results_this_year.needs_repair || 0) + (s.results_this_year.inoperable || 0)} thiết bị hỏng</div></div>
          {s.compliance.map((c) => (
            <div key={c.plan_id} className="card kpi"><div className="v" style={{ color: c.pct >= 90 ? '#16a34a' : c.pct >= 60 ? '#ca8a04' : '#dc2626' }}>{c.pct ?? '—'}%</div>
              <div className="l">{c.plan}: {c.within_interval}/{c.total} đúng chu kỳ</div></div>
          ))}
          <div className="card kpi"><div className="v" style={{ color: s.low_stock_materials ? '#dc2626' : undefined }}>{s.low_stock_materials}</div><div className="l">Vật tư dưới mức tối thiểu</div></div>
        </div>
      )}
      <div className="tabs">
        {[['tasks', 'Lệnh công việc'], ['plans', 'Kế hoạch định kỳ'], ['stock', 'Kho vật tư'], ['ledger', 'Sổ nhập – xuất']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'tasks' && <Tasks onChanged={loadSummary} />}
      {tab === 'plans' && <Plans onChanged={loadSummary} />}
      {tab === 'stock' && <Stock onChanged={loadSummary} />}
      {tab === 'ledger' && <Ledger />}
    </div>
  )
}
