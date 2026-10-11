import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, auth, subscribeRealtime } from '../api'
import { ALARM_KIND, SENSOR_STATUS, SENSOR_TYPES, fmt, thisPeriod } from '../labels'
import { Form } from '../components/Form'

const AXIS = { fontSize: 11, stroke: '#94a3b8', tickLine: false }
const RANGES = [[24, '24 giờ'], [24 * 7, '7 ngày'], [24 * 30, '30 ngày']]
const val = (v, d = 2) => (v == null ? '—' : fmt.num(v, d))
const hhmm = (t, long) => new Date(t).toLocaleString('vi-VN', long ? { day: '2-digit', month: '2-digit', hour: '2-digit' } : { hour: '2-digit', minute: '2-digit' })

const SENSOR_FIELDS = [
  { name: 'code', label: 'Mã điểm đo' },
  { name: 'name', label: 'Tên' },
  { name: 'sensor_type', label: 'Loại', options: SENSOR_TYPES },
  { name: 'external_id', label: 'Tag SCADA / mã thiết bị AMI' },
  { name: 'node_id', label: 'Gắn với nút (id)', type: 'number' },
  { name: 'meter_id', label: 'Đồng hồ khách hàng (id)', type: 'number' },
  { name: 'min_alarm', label: 'Ngưỡng dưới', type: 'number' },
  { name: 'max_alarm', label: 'Ngưỡng trên', type: 'number' },
  { name: 'stale_minutes', label: 'Mất kết nối sau (phút)', type: 'number' },
]

function SeriesChart({ sensor, liveVal }) {
  const [hours, setHours] = useState(24)
  const [s, setS] = useState(null)
  useEffect(() => {
    setS(null)
    api.get(`/api/scada/sensors/${sensor.id}/series?hours=${hours}`).then(setS).catch(() => setS({ points: [] }))
  }, [sensor.id, hours])
  // điểm mới nhận qua luồng thời gian thực được nối vào cuối biểu đồ 24 giờ
  const points = useMemo(() => {
    const pts = (s?.points || []).map((p) => ({ ...p, band: [p.min, p.max] }))
    if (liveVal && hours === 24 && (!pts.length || liveVal.ts > pts.at(-1).ts)) pts.push({ ts: liveVal.ts, avg: liveVal.value, band: [liveVal.value, liveVal.value] })
    return pts
  }, [s, liveVal, hours])
  const p = sensor.properties
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>{p.name} <span className="muted small">({p.code})</span></h3>
        <div className="row">
          {RANGES.map(([h, l]) => <button key={h} className={`btn sm ${hours === h ? 'on' : ''}`} onClick={() => setHours(h)}>{l}</button>)}
          {sensor.geometry && <Link className="btn sm" to={`/map?sensor=${sensor.id}`}>Bản đồ</Link>}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={points} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="ts" {...AXIS} tickFormatter={(t) => hhmm(t, hours > 24)} minTickGap={40} />
          <YAxis {...AXIS} width={48} domain={['auto', 'auto']} />
          <Tooltip labelFormatter={(t) => fmt.date(t)} formatter={(v, n) => (Array.isArray(v) ? [`${v[0]} – ${v[1]} ${p.unit}`, 'Khoảng'] : [`${v} ${p.unit}`, n])} />
          <Area dataKey="band" stroke="none" fill="#2a78d6" fillOpacity={0.12} isAnimationActive={false} name="Khoảng min–max" />
          <Line dataKey="avg" stroke="#2a78d6" strokeWidth={2} dot={false} isAnimationActive={false} name="Trung bình" />
          {p.max_alarm != null && <ReferenceLine y={p.max_alarm} stroke="#dc2626" strokeDasharray="5 4" label={{ value: `Ngưỡng trên ${p.max_alarm}`, fontSize: 11, fill: '#dc2626', position: 'insideTopRight' }} />}
          {p.min_alarm != null && <ReferenceLine y={p.min_alarm} stroke="#ea580c" strokeDasharray="5 4" label={{ value: `Ngưỡng dưới ${p.min_alarm}`, fontSize: 11, fill: '#ea580c', position: 'insideBottomRight' }} />}
        </ComposedChart>
      </ResponsiveContainer>
      {s && !s.points.length && <p className="muted small">Chưa có số liệu trong khoảng thời gian này.</p>}
    </div>
  )
}

export default function Scada() {
  const [params] = useSearchParams()
  const [ov, setOv] = useState(null)
  const [sensors, setSensors] = useState([])
  const [alarms, setAlarms] = useState([])
  const [mnf, setMnf] = useState([])
  const [type, setType] = useState('')
  const [selId, setSelId] = useState(params.get('sensor') ? Number(params.get('sensor')) : null)
  const [live, setLive] = useState(null)
  const [flash, setFlash] = useState({})
  const [period, setPeriod] = useState(thisPeriod())
  const [msg, setMsg] = useState(null)
  const [form, setForm] = useState(null)
  const canEdit = auth.canEdit()
  const timer = useRef()

  const loadAll = () => {
    api.get('/api/scada/overview').then(setOv)
    api.get('/api/scada/sensors').then((r) => setSensors(r.features))
    api.get('/api/scada/alarms').then(setAlarms)
    api.get('/api/scada/mnf?days=7').then(setMnf)
  }
  useEffect(() => { loadAll() }, [])
  useEffect(() => subscribeRealtime((ev) => {
    if (ev.type === 'values') {
      const byId = Object.fromEntries(ev.items.map((it) => [it.id, it]))
      setSensors((list) => list.map((f) => (byId[f.id] ? { ...f, properties: { ...f.properties, last_value: byId[f.id].value, last_ts: byId[f.id].ts, status: f.properties.status === 'offline' ? 'normal' : f.properties.status } } : f)))
      setFlash(Object.fromEntries(ev.items.map((it) => [it.id, Date.now()])))
    }
    if (ev.type === 'alarms') {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        api.get('/api/scada/alarms').then(setAlarms)
        api.get('/api/scada/overview').then(setOv)
        api.get('/api/scada/sensors').then((r) => setSensors(r.features))
      }, 300)
    }
  }, setLive), [])

  const lastLive = useMemo(() => {
    const f = sensors.find((x) => x.id === selId)
    return f?.properties.last_ts ? { ts: f.properties.last_ts, value: f.properties.last_value } : null
  }, [sensors, selId])
  const sel = sensors.find((f) => f.id === selId)
  const shown = sensors.filter((f) => !type || f.properties.sensor_type === type)

  async function ack(a) {
    try { await api.post(`/api/scada/alarms/${a.id}/ack`); setAlarms(await api.get('/api/scada/alarms')) } catch (e) { alert(e.message) }
  }
  async function action(url, done) {
    setMsg(null)
    try { const r = await api.post(url); setMsg({ ok: true, text: done(r) }) } catch (e) { setMsg({ ok: false, text: e.message }) }
  }
  async function saveSensor() {
    try {
      const body = { ...form }
      delete body.isNew
      for (const k of ['node_id', 'meter_id', 'min_alarm', 'max_alarm', 'external_id']) if (body[k] === '' || body[k] === undefined) body[k] = null
      const r = form.isNew ? await api.post('/api/scada/sensors', body) : await api.put(`/api/scada/sensors/${selId}`, body)
      setForm(null); setSelId(r.id); loadAll()
      setMsg({ ok: true, text: `Đã lưu điểm đo ${r.properties.code}` })
    } catch (e) { setMsg({ ok: false, text: e.message }) }
  }

  const mnfData = mnf.map((r) => ({ name: r.zone || r.code, ratio: r.mnf_ratio_pct, mnf: r.mnf, avg: r.avg_flow }))

  return (
    <div className="page">
      <div className="page-head">
        <h2>Giám sát SCADA & đồng hồ thông minh</h2>
        <div className="row">
          <span className={`live ${live === 'live' ? 'on' : ''}`}>{live === 'live' ? 'Trực tuyến' : 'Đang kết nối…'}</span>
          {canEdit && <button className="btn primary" onClick={() => { setSelId(null); setForm({ isNew: true, sensor_type: 'pressure', stale_minutes: 60 }) }}>+ Điểm đo</button>}
        </div>
      </div>

      {ov && (
        <div className="cards">
          <div className="card kpi"><div className="v">{ov.sensor_count}</div><div className="l">Điểm đo ({ov.by_type.smart_meter || 0} đồng hồ thông minh)</div></div>
          <div className="card kpi"><div className="v" style={{ color: '#16a34a' }}>{ov.by_status.normal || 0}</div><div className="l">Bình thường</div></div>
          <div className="card kpi"><div className="v" style={{ color: ov.active_alarms ? '#dc2626' : undefined }}>{ov.active_alarms}</div><div className="l">Cảnh báo đang mở</div></div>
          <div className="card kpi"><div className="v" style={{ color: '#64748b' }}>{ov.by_status.offline || 0}</div><div className="l">Mất kết nối</div></div>
          {ov.zones.map((z) => (
            <div key={z.zone_id} className="card kpi"><div className="v">{val(z.flow_m3h, 1)} <small style={{ fontSize: 13 }}>m³/h</small></div>
              <div className="l">{z.zone} · áp lực thấp nhất <b style={{ color: z.pressure_min != null && z.pressure_min < 1.5 ? '#dc2626' : undefined }}>{val(z.pressure_min)} bar</b></div></div>
          ))}
        </div>
      )}

      <div className="charts">
        <div className="card">
          <h3>Cảnh báo đang mở</h3>
          <table className="tbl">
            <thead><tr><th>Điểm đo</th><th>Loại</th><th className="num">Giá trị / ngưỡng</th><th>Từ lúc</th><th></th></tr></thead>
            <tbody>
              {alarms.map((a) => (
                <tr key={a.id} onClick={() => setSelId(a.sensor_id)}>
                  <td><b>{a.sensor_code}</b><div className="small muted">{a.sensor_name}</div></td>
                  <td><span className="badge" style={{ background: a.kind === 'high' ? '#dc2626' : '#ea580c' }}>{ALARM_KIND[a.kind]}</span></td>
                  <td className="num">{val(a.value)} / {val(a.threshold)} {a.unit}</td>
                  <td>{fmt.ago(a.started_at)}</td>
                  <td>{a.ack_at ? <span className="small muted">Đã xác nhận – {a.ack_by}</span>
                    : auth.canField() && <button className="btn sm" onClick={(e) => { e.stopPropagation(); ack(a) }}>Xác nhận</button>}</td>
                </tr>
              ))}
              {!alarms.length && <tr><td colSpan={5} className="muted">Không có cảnh báo</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>Lưu lượng đêm nhỏ nhất (MNF, 2h–4h, 7 đêm gần nhất)</h3>
          <p className="small muted" style={{ marginTop: 0 }}>Tỷ lệ MNF / lưu lượng trung bình ngày càng cao, DMA càng có khả năng rò rỉ lớn – ưu tiên dò tìm rò rỉ.</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={mnfData} layout="vertical" margin={{ left: 10, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" {...AXIS} unit="%" domain={[0, 'auto']} />
              <YAxis type="category" dataKey="name" {...AXIS} width={110} />
              <Tooltip formatter={(v, n, it) => [`${v}% (MNF ${it.payload.mnf} / TB ${it.payload.avg} m³/h)`, 'Tỷ lệ MNF']} cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="ratio" fill="#eb6834" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, fill: '#475569', formatter: (v) => `${v}%` }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="split">
        <div>
          <div className="row" style={{ marginBottom: 8 }}>
            <select value={type} onChange={(e) => setType(e.target.value)} style={{ width: 200 }}>
              <option value="">Mọi loại điểm đo</option>
              {Object.entries(SENSOR_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <span className="muted">{shown.length} điểm đo</span>
          </div>
          <div className="scroll" style={{ maxHeight: 460 }}>
            <table className="tbl">
              <thead><tr><th>Mã</th><th>Tên</th><th>Loại</th><th className="num">Giá trị</th><th>Cập nhật</th><th>Trạng thái</th></tr></thead>
              <tbody>
                {shown.map((f) => {
                  const p = f.properties
                  const hot = flash[f.id] && Date.now() - flash[f.id] < 1500
                  return (
                    <tr key={f.id} className={f.id === selId ? 'sel' : ''} onClick={() => { setForm(null); setSelId(f.id) }}>
                      <td>{p.code}</td><td>{p.name}</td><td>{SENSOR_TYPES[p.sensor_type]}</td>
                      <td className={`num ${hot ? 'flash' : ''}`}><b>{val(p.last_value)}</b> <span className="muted small">{p.unit}</span></td>
                      <td className="small">{fmt.ago(p.last_ts)}</td>
                      <td><span className="badge" style={{ background: SENSOR_STATUS[p.status]?.color }}>{SENSOR_STATUS[p.status]?.label}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          {form && (
            <div className="card" style={{ marginBottom: 12 }}>
              <h3>{form.isNew ? 'Thêm điểm đo' : `Sửa điểm đo ${form.code}`}</h3>
              <Form fields={SENSOR_FIELDS.filter((f) => form.isNew || !['code', 'sensor_type'].includes(f.name))} values={form} onChange={(k, v) => setForm({ ...form, [k]: v })} />
              <div className="row"><button className="btn primary" onClick={saveSensor}>Lưu</button><button className="btn" onClick={() => setForm(null)}>Hủy</button></div>
            </div>
          )}
          {sel && !form && <SeriesChart sensor={sel} liveVal={lastLive} />}
          {sel && !form && canEdit && (
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn sm" onClick={() => setForm({ ...sel.properties })}>Sửa ngưỡng / thông tin</button>
              <button className="btn sm danger" onClick={async () => { if (confirm('Xóa điểm đo và toàn bộ số liệu?')) { await api.del(`/api/scada/sensors/${selId}`); setSelId(null); loadAll() } }}>Xóa</button>
            </div>
          )}
          {!sel && !form && <div className="card muted">Chọn một điểm đo để xem biểu đồ theo thời gian.</div>}

          {canEdit && (
            <div className="card" style={{ marginTop: 12 }}>
              <h3>Đồng bộ với ghi thu & cân bằng nước</h3>
              <div className="row">
                <label className="row" style={{ margin: 0 }}>Kỳ <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: 160 }} /></label>
                <button className="btn sm" onClick={() => action(`/api/scada/smart-meters/close-period?period=${period}`, (r) => `Đã chốt ${r.saved} chỉ số đồng hồ thông minh (bỏ qua ${r.skipped}${r.errors.length ? `, lỗi ${r.errors.length}: ${r.errors[0]}` : ''})`)}>Chốt chỉ số ĐH thông minh</button>
                <button className="btn sm" onClick={() => action(`/api/scada/inflows/compute?period=${period}`, (r) => `Đã tính sản lượng cấp vào ${r.zones.length} DMA: ` + r.zones.map((z) => `${fmt.num(z.volume_m3)} m³ (${z.method === 'totalizer' ? 'chỉ số tổng' : `lưu lượng TB, phủ ${z.coverage_pct}%`})`).join('; '))}>Tính sản lượng DMA từ đồng hồ tổng</button>
              </div>
              {msg && <div className={`alert ${msg.ok ? 'ok' : 'error'}`}>{msg.text}</div>}
              <details style={{ marginTop: 8 }}>
                <summary className="small">Kết nối cổng SCADA / AMI</summary>
                <p className="small">Cổng thu thập (Node-RED, Telegraf, historian…) gửi số liệu bằng <code>POST /api/scada/ingest</code>, header <code>X-API-Key</code> (biến môi trường <code>INGEST_API_KEYS</code>). <code>sensor</code> là mã điểm đo hoặc tag SCADA.</p>
                <pre className="code">{`curl -X POST https://may-chu/api/scada/ingest \\
  -H "X-API-Key: <khoa>" -H "Content-Type: application/json" \\
  -d '[{"sensor":"SCADA.DMA01.PT01","ts":"2026-10-11T08:00:00+07:00","value":2.85}]'`}</pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
