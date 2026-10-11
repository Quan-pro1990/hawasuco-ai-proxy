import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, auth } from '../api'
import { CUSTOMER_TYPES, READING_SOURCE, fmt, thisPeriod } from '../labels'
import { Form } from '../components/Form'

const CUST_FIELDS = [
  { name: 'code', label: 'Mã KH (bỏ trống để tự sinh)' },
  { name: 'name', label: 'Họ tên / đơn vị' },
  { name: 'customer_type', label: 'Đối tượng', options: CUSTOMER_TYPES },
  { name: 'status', label: 'Trạng thái', options: { active: 'Đang cấp nước', suspended: 'Tạm ngưng', terminated: 'Hủy hợp đồng' } },
  { name: 'phone', label: 'Điện thoại' },
  { name: 'address', label: 'Địa chỉ' },
  { name: 'lat', label: 'Vĩ độ (lat)', type: 'number' },
  { name: 'lng', label: 'Kinh độ (lng)', type: 'number' },
]

function CustomerList() {
  const [params] = useSearchParams()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [res, setRes] = useState({ items: [], total: 0 })
  const [selId, setSelId] = useState(params.get('id') ? Number(params.get('id')) : null)
  const [detail, setDetail] = useState(null)
  const [form, setForm] = useState(null)
  const [meterForm, setMeterForm] = useState(null)
  const [msg, setMsg] = useState(null)
  const pipeId = params.get('pipe_id')
  const canEdit = auth.canEdit()

  async function load() {
    const qs = new URLSearchParams({ page, size: 50 })
    if (q) qs.set('q', q)
    if (pipeId) qs.set('pipe_id', pipeId)
    setRes(await api.get('/api/customers?' + qs))
  }
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [q, page]) // eslint-disable-line
  async function loadDetail(id) {
    const d = await api.get(`/api/customers/${id}`)
    setDetail(d)
    const r7 = (x) => (x == null ? x : Math.round(x * 1e7) / 1e7)
    setForm({ ...d, lat: r7(d.geometry?.coordinates[1]), lng: r7(d.geometry?.coordinates[0]) })
  }
  useEffect(() => { if (selId) loadDetail(selId); setMsg(null) }, [selId])

  async function saveCustomer() {
    try {
      const body = { name: form.name, customer_type: form.customer_type, status: form.status, phone: form.phone, address: form.address }
      if (form.lat != null && form.lng != null) body.geometry = { type: 'Point', coordinates: [form.lng, form.lat] }
      if (form.isNew) {
        if (form.code) body.code = form.code
        const r = await api.post('/api/customers', body)
        setSelId(r.id)
      } else {
        const oldG = detail.geometry?.coordinates
        if (oldG && body.geometry && oldG[0] === form.lng && oldG[1] === form.lat) delete body.geometry
        await api.put(`/api/customers/${selId}`, body)
        loadDetail(selId)
      }
      setMsg({ ok: true, text: 'Đã lưu khách hàng' })
      load()
    } catch (e) { setMsg({ ok: false, text: e.message }) }
  }

  async function addMeter() {
    try {
      await api.post(`/api/customers/${selId}/meters`, meterForm)
      setMeterForm(null)
      loadDetail(selId)
      setMsg({ ok: true, text: 'Đã lắp đồng hồ mới (đồng hồ cũ chuyển trạng thái "đã thay")' })
    } catch (e) { setMsg({ ok: false, text: e.message }) }
  }

  const meter = detail?.meters?.find((m) => m.status === 'active') || detail?.meters?.[0]
  const pages = Math.ceil(res.total / 50)

  return (
    <div className="split">
      <div>
        <div className="row" style={{ marginBottom: 10 }}>
          <input placeholder="Tìm theo mã, tên, địa chỉ, điện thoại…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} style={{ maxWidth: 360 }} />
          {pipeId && <span className="badge" style={{ background: '#0a6ebd' }}>Lọc theo ống #{pipeId} <Link to="/customers" style={{ color: '#fff' }}>×</Link></span>}
          <span className="muted">{fmt.num(res.total)} khách hàng</span>
          {canEdit && <button className="btn primary" onClick={() => { setSelId(null); setDetail(null); setForm({ isNew: true, customer_type: 'household', status: 'active' }) }}>+ Thêm khách hàng</button>}
        </div>
        <div className="scroll" style={{ maxHeight: 'calc(100vh - 260px)' }}>
          <table className="tbl">
            <thead><tr><th>Mã KH</th><th>Tên</th><th>Địa chỉ</th><th>Điện thoại</th><th>Đối tượng</th></tr></thead>
            <tbody>
              {res.items.map((c) => (
                <tr key={c.id} className={c.id === selId ? 'sel' : ''} onClick={() => setSelId(c.id)}>
                  <td>{c.code}</td><td>{c.name}</td><td>{c.address}</td><td>{c.phone}</td><td>{CUSTOMER_TYPES[c.customer_type]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Trước</button>
            <span>Trang {page}/{pages}</span>
            <button className="btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Sau ›</button>
          </div>
        )}
      </div>

      <div className="card" style={{ maxHeight: 'calc(100vh - 170px)', overflow: 'auto' }}>
        {!form && <p className="muted">Chọn khách hàng để xem hồ sơ.</p>}
        {form && (
          <>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>{form.isNew ? 'Khách hàng mới' : `${detail?.code} – ${detail?.name}`}</h3>
              {!form.isNew && detail?.geometry && <Link to={`/map?customer=${selId}`}>Bản đồ →</Link>}
            </div>
            <div style={{ marginTop: 10 }}>
              <Form fields={CUST_FIELDS.filter((f) => form.isNew || f.name !== 'code')} values={form} onChange={(k, v) => setForm({ ...form, [k]: v })} disabled={!canEdit} />
            </div>
            {!form.isNew && <p className="small muted">Đấu nối ống: {detail?.pipe_id ? <Link to={`/map?pipe=${detail.pipe_id}`}>#{detail.pipe_id}</Link> : 'chưa xác định'} – tự gán ống gần nhất khi có tọa độ.</p>}
            {canEdit && <button className="btn primary" onClick={saveCustomer}>Lưu</button>}
            {msg && <div className={`alert ${msg.ok ? 'ok' : 'error'}`}>{msg.text}</div>}

            {!form.isNew && detail && (
              <>
                <h3 style={{ marginTop: 16 }}>Đồng hồ nước</h3>
                <table className="tbl">
                  <thead><tr><th>Seri</th><th>Cỡ</th><th>Hãng</th><th>Ngày lắp</th><th>TT</th></tr></thead>
                  <tbody>
                    {detail.meters.map((m) => (
                      <tr key={m.id}><td>{m.serial}</td><td>DN{m.size_mm}</td><td>{m.brand}</td><td>{m.install_date}</td>
                        <td>{{ active: 'Đang dùng', broken: 'Hỏng', replaced: 'Đã thay' }[m.status]}</td></tr>
                    ))}
                  </tbody>
                </table>
                {canEdit && !meterForm && <button className="btn sm" style={{ marginTop: 6 }} onClick={() => setMeterForm({ serial: '', size_mm: 15, brand: '', install_date: new Date().toISOString().slice(0, 10) })}>+ Lắp / thay đồng hồ</button>}
                {meterForm && (
                  <div className="card" style={{ marginTop: 8 }}>
                    <Form fields={[{ name: 'serial', label: 'Số seri' }, { name: 'size_mm', label: 'Cỡ (mm)', type: 'number' }, { name: 'brand', label: 'Hãng' }, { name: 'install_date', label: 'Ngày lắp', type: 'date' }]}
                      values={meterForm} onChange={(k, v) => setMeterForm({ ...meterForm, [k]: v })} />
                    <div className="row"><button className="btn primary sm" onClick={addMeter}>Lưu</button><button className="btn sm" onClick={() => setMeterForm(null)}>Hủy</button></div>
                  </div>
                )}
                {meter?.readings?.length > 0 && (
                  <>
                    <h3 style={{ marginTop: 16 }}>Tiêu thụ theo kỳ – {meter.serial}</h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={meter.readings.filter((r, i) => i > 0)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="period" fontSize={11} /><YAxis fontSize={11} unit=" m³" width={55} />
                        <Tooltip formatter={(v) => [`${v} m³`, 'Tiêu thụ']} />
                        <Bar dataKey="consumption" fill="#0a6ebd" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <table className="tbl">
                      <thead><tr><th>Kỳ</th><th className="num">Chỉ số</th><th className="num">Tiêu thụ (m³)</th><th>Nguồn</th></tr></thead>
                      <tbody>{[...meter.readings].reverse().map((r) => <tr key={r.id}><td>{r.period}</td><td className="num">{fmt.num(r.reading, 2)}</td><td className="num">{fmt.num(r.consumption, 2)}</td>
                        <td className="small">{READING_SOURCE[r.source] || ''}{r.read_by ? ` – ${r.read_by}` : ''}</td></tr>)}</tbody>
                    </table>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ReadingSheet() {
  const [period, setPeriod] = useState(thisPeriod())
  const [zones, setZones] = useState([])
  const [zone, setZone] = useState('')
  const [rows, setRows] = useState([])
  const [edits, setEdits] = useState({})
  const [msg, setMsg] = useState(null)
  useEffect(() => { api.get('/api/zones').then((r) => setZones(r.features)) }, [])
  async function load() {
    setRows(await api.get(`/api/readings/sheet?period=${period}${zone ? `&zone_id=${zone}` : ''}`))
    setEdits({})
  }
  useEffect(() => { load() }, [period, zone]) // eslint-disable-line
  async function save() {
    const items = Object.entries(edits).filter(([, v]) => v !== '' && v != null).map(([id, v]) => ({ meter_id: Number(id), period, reading: Number(v) }))
    if (!items.length) return
    try {
      await api.post('/api/readings', items)
      setMsg({ ok: true, text: `Đã lưu ${items.length} chỉ số` })
      load()
    } catch (e) { setMsg({ ok: false, text: e.message }) }
  }
  const done = rows.filter((r) => r.reading != null).length
  return (
    <>
      <div className="row" style={{ marginBottom: 10 }}>
        <label className="row" style={{ margin: 0 }}>Kỳ ghi <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: 160 }} /></label>
        <select value={zone} onChange={(e) => setZone(e.target.value)} style={{ width: 180 }}>
          <option value="">Tất cả DMA</option>
          {zones.map((z) => <option key={z.id} value={z.id}>{z.properties.name}</option>)}
        </select>
        <span className="muted">Đã ghi {done}/{rows.length}</span>
        {auth.canEdit() && <button className="btn primary" onClick={save} disabled={!Object.keys(edits).length}>Lưu chỉ số ({Object.keys(edits).length})</button>}
      </div>
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'error'}`}>{msg.text}</div>}
      <div className="scroll">
        <table className="tbl">
          <thead><tr><th>Mã KH</th><th>Khách hàng</th><th>Địa chỉ</th><th>Seri ĐH</th><th className="num">CS kỳ trước</th><th className="num" style={{ width: 130 }}>CS kỳ này</th><th className="num">Tiêu thụ</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const val = edits[r.meter_id] ?? r.reading ?? ''
              const cons = val !== '' && r.prev_reading != null ? Number(val) - r.prev_reading : null
              return (
                <tr key={r.meter_id}>
                  <td>{r.customer_code}</td><td>{r.customer_name}</td><td>{r.address}</td><td>{r.serial}</td>
                  <td className="num">{fmt.num(r.prev_reading)} <small className="muted">{r.prev_period}</small></td>
                  <td><input type="number" value={val} onChange={(e) => setEdits({ ...edits, [r.meter_id]: e.target.value })} style={{ padding: '3px 6px', textAlign: 'right' }} disabled={!auth.canEdit()} /></td>
                  <td className="num" style={{ color: cons < 0 ? '#dc2626' : cons > 100 ? '#ea580c' : null }}>{cons == null ? '—' : fmt.num(cons)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Inflows() {
  const [zones, setZones] = useState([])
  const [rows, setRows] = useState([])
  const [f, setF] = useState({ zone_id: '', period: thisPeriod(), volume_m3: '' })
  const load = () => api.get('/api/inflows').then(setRows)
  useEffect(() => { api.get('/api/zones').then((r) => { setZones(r.features); setF((x) => ({ ...x, zone_id: r.features[0]?.id || '' })) }); load() }, [])
  const zn = Object.fromEntries(zones.map((z) => [z.id, z.properties.name]))
  return (
    <div style={{ maxWidth: 760 }}>
      <p className="muted">Sản lượng nước cấp vào từng DMA (theo đồng hồ tổng) – dùng để tính tỷ lệ thất thoát ở trang Báo cáo.</p>
      {auth.canEdit() && (
        <div className="row" style={{ marginBottom: 10 }}>
          <select value={f.zone_id} onChange={(e) => setF({ ...f, zone_id: Number(e.target.value) })} style={{ width: 180 }}>{zones.map((z) => <option key={z.id} value={z.id}>{z.properties.name}</option>)}</select>
          <input type="month" value={f.period} onChange={(e) => setF({ ...f, period: e.target.value })} style={{ width: 160 }} />
          <input type="number" placeholder="Sản lượng (m³)" value={f.volume_m3} onChange={(e) => setF({ ...f, volume_m3: e.target.value })} style={{ width: 160 }} />
          <button className="btn primary" onClick={async () => { await api.post('/api/inflows', { ...f, volume_m3: Number(f.volume_m3) }); load() }}>Lưu</button>
        </div>
      )}
      <table className="tbl">
        <thead><tr><th>Kỳ</th><th>DMA</th><th className="num">Sản lượng cấp vào (m³)</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}><td>{r.period}</td><td>{zn[r.zone_id]}</td><td className="num">{fmt.num(r.volume_m3)}</td></tr>)}</tbody>
      </table>
    </div>
  )
}

export default function Customers() {
  const [tab, setTab] = useState('list')
  return (
    <div className="page">
      <div className="page-head"><h2>Khách hàng & đồng hồ</h2></div>
      <div className="tabs">
        {[['list', 'Danh bạ khách hàng'], ['sheet', 'Ghi chỉ số đồng hồ'], ['inflow', 'Sản lượng cấp vào DMA']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'list' && <CustomerList />}
      {tab === 'sheet' && <ReadingSheet />}
      {tab === 'inflow' && <Inflows />}
    </div>
  )
}
