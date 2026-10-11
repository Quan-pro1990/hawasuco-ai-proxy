import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, auth } from '../api'
import { INCIDENT_STATUS, INCIDENT_TYPES, MAINT_RESULTS, NODE_TYPES, SEVERITY, fmt, thisPeriod } from '../labels'
import { compressImage } from '../photo'
import { enqueue, kv, outbox, pendingBytes, syncOutbox } from './store'
import './field.css'

const DEFAULT_TITLE = { leak: 'Rò rỉ nước', burst: 'Vỡ ống', low_pressure: 'Nước yếu', water_quality: 'Nước đục / có mùi', valve_fault: 'Van hỏng', other: 'Sự cố khác' }
const KIND_LABEL = { reading: 'Chỉ số', incident: 'Báo sự cố', incident_update: 'Cập nhật sự cố', task_complete: 'Hoàn thành bảo trì' }
const NEXT_STATUS = { new: ['in_progress'], assigned: ['in_progress'], in_progress: ['resolved'], resolved: [], closed: [] }
const mapsUrl = (lat, lon) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`

/* ------------------------------------------------------------ chụp ảnh */
function PhotoPicker({ photos, setPhotos, label = 'Chụp ảnh' }) {
  const [busy, setBusy] = useState(false)
  async function add(files) {
    setBusy(true)
    const out = []
    for (const f of files) {
      const blob = await compressImage(f)
      out.push({ blob, name: `anh-${Date.now()}-${out.length}.jpg`, url: URL.createObjectURL(blob) })
    }
    setPhotos([...photos, ...out])
    setBusy(false)
  }
  useEffect(() => () => photos.forEach((p) => p.url && URL.revokeObjectURL(p.url)), []) // eslint-disable-line
  return (
    <div className="f-photos">
      {photos.map((p, i) => (
        <div key={i} className="f-thumb">
          <img src={p.url} alt="" />
          <button type="button" onClick={() => setPhotos(photos.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <label className="f-thumb add">
        <input type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => { add([...e.target.files]); e.target.value = '' }} />
        {busy ? '…' : <>📷<small>{label}</small></>}
      </label>
    </div>
  )
}

function Sheet({ title, onClose, children, footer }) {
  return (
    <div className="f-sheet-bg" onClick={onClose}>
      <div className="f-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="f-sheet-hd"><b>{title}</b><button className="x" onClick={onClose}>×</button></div>
        <div className="f-sheet-bd">{children}</div>
        {footer && <div className="f-sheet-ft">{footer}</div>}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ tải dữ liệu về máy */
function DownloadBox({ pkg, online, onDownload }) {
  const [period, setPeriod] = useState(pkg?.period || thisPeriod())
  const [zone, setZone] = useState(pkg?.zone_id || '')
  const [zones, setZones] = useState(pkg?.zones || [])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  useEffect(() => {
    if (online && !zones.length) api.get('/api/zones').then((r) => setZones(r.features.map((z) => ({ id: z.id, name: z.properties.name })))).catch(() => {})
  }, [online]) // eslint-disable-line
  async function go() {
    setBusy(true); setErr(null)
    try { await onDownload(period, zone) } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="f-card">
      <b>Tải dữ liệu về máy</b>
      <p className="muted small">Tải sổ ghi chỉ số, sự cố và lệnh bảo trì trước khi ra hiện trường – sau đó dùng được cả khi mất sóng.</p>
      <label>Kỳ ghi chỉ số<input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} /></label>
      <label>Khu vực (DMA)
        <select value={zone} onChange={(e) => setZone(e.target.value)}>
          <option value="">Tất cả</option>
          {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
      </label>
      <button className="f-btn primary" disabled={!online || busy} onClick={go}>{busy ? 'Đang tải…' : online ? 'Tải về máy' : 'Cần có mạng để tải'}</button>
      {err && <div className="alert error">{err}</div>}
    </div>
  )
}

/* ------------------------------------------------------------ ghi chỉ số */
function ReadingSheet({ row, period, onClose, onSave }) {
  const [val, setVal] = useState(row.local ?? row.reading ?? '')
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState([])
  const [confirm, setConfirm] = useState(false)
  const v = val === '' ? null : Number(val)
  const cons = v != null && row.prev_reading != null ? Math.round((v - row.prev_reading) * 100) / 100 : null
  const avg = row.avg_consumption
  let check = null
  if (cons != null && cons < 0) check = { kind: 'error', text: 'Chỉ số nhỏ hơn kỳ trước. Nếu đồng hồ đã thay hoặc quay vòng, ghi chú và báo văn phòng.' }
  else if (cons != null && avg && cons > Math.max(avg * 3, avg + 30)) check = { kind: 'warn', text: `Tiêu thụ ${cons} m³ cao bất thường (TB ${avg} m³). Kiểm tra lại số, rò rỉ sau đồng hồ?` }
  else if (cons === 0) check = { kind: 'warn', text: 'Tiêu thụ 0 m³ – đồng hồ đứng hay nhà vắng chủ?' }
  const blocked = v == null || Number.isNaN(v) || check?.kind === 'error'
  function save() {
    if (check?.kind === 'warn' && !confirm) { setConfirm(true); return }
    onSave(v, note, photos)
  }
  return (
    <Sheet title={`${row.customer_code} – ${row.customer_name}`} onClose={onClose}
      footer={<>
        <button className="f-btn" onClick={onClose}>Hủy</button>
        <button className="f-btn primary" disabled={blocked} onClick={save}>{confirm ? 'Vẫn lưu' : 'Lưu & tiếp'}</button>
      </>}>
      <div className="muted small">{row.address} · ĐH {row.serial}{row.phone ? ` · ${row.phone}` : ''}</div>
      {row.lat && <a className="small" href={mapsUrl(row.lat, row.lon)} target="_blank" rel="noreferrer">Chỉ đường →</a>}
      <div className="f-prev">
        <div><small>Kỳ trước {row.prev_period || ''}</small><b>{fmt.num(row.prev_reading, 2)}</b></div>
        <div><small>TB 3 kỳ</small><b>{avg ?? '—'} m³</b></div>
        <div><small>Tiêu thụ {period}</small><b className={check?.kind || ''}>{cons ?? '—'} m³</b></div>
      </div>
      <input className="f-big" type="number" inputMode="decimal" step="any" autoFocus placeholder="Chỉ số mới (m³)" value={val}
        onChange={(e) => { setVal(e.target.value); setConfirm(false) }} onKeyDown={(e) => e.key === 'Enter' && !blocked && save()} />
      {check && <div className={`alert ${check.kind === 'error' ? 'error' : 'warn'}`}>{check.text}</div>}
      <input placeholder="Ghi chú (không bắt buộc)" value={note} onChange={(e) => setNote(e.target.value)} />
      <PhotoPicker photos={photos} setPhotos={setPhotos} label="Ảnh mặt ĐH" />
    </Sheet>
  )
}

function Readings({ pkg, online, onDownload, onQueue, savePkg }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('todo')
  const [cur, setCur] = useState(null)
  const [limit, setLimit] = useState(100)
  if (!pkg) return <DownloadBox online={online} onDownload={onDownload} />
  const rows = pkg.readings
  const isDone = (r) => r.local != null || r.reading != null
  const done = rows.filter(isDone).length
  const ql = q.trim().toLowerCase()
  const list = rows.filter((r) => (filter === 'all' || (filter === 'todo' ? !isDone(r) : isDone(r)))
    && (!ql || `${r.customer_code} ${r.customer_name} ${r.address} ${r.serial}`.toLowerCase().includes(ql)))

  async function save(row, value, note, photos) {
    await onQueue('reading', { meter_id: row.meter_id, period: pkg.period, reading: value, note: note || null }, photos,
      `${row.customer_code} ${row.customer_name}: ${value} m³`)
    const readings = rows.map((r) => (r.meter_id === row.meter_id ? { ...r, local: value } : r))
    await savePkg({ ...pkg, readings })
    // tự chuyển sang khách hàng kế tiếp chưa ghi theo lộ trình
    const i = list.findIndex((r) => r.meter_id === row.meter_id)
    setCur(list.slice(i + 1).find((r) => !isDone(r)) || null)
  }

  return (
    <>
      <div className="f-progress">
        <div><b>Kỳ {pkg.period}</b> · đã ghi {done}/{rows.length}</div>
        <div className="bar"><i style={{ width: `${rows.length ? (done / rows.length) * 100 : 0}%` }} /></div>
      </div>
      <input className="f-search" placeholder="Tìm tên, địa chỉ, mã KH, số seri…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="f-seg">
        {[['todo', 'Chưa ghi'], ['done', 'Đã ghi'], ['all', 'Tất cả']].map(([k, l]) => <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>)}
      </div>
      <ul className="f-list">
        {list.slice(0, limit).map((r) => (
          <li key={r.meter_id} onClick={() => setCur(r)}>
            <div className="t"><b>{r.customer_name}</b><span className={`chip ${r.local != null ? 'pending' : r.reading != null ? 'ok' : ''}`}>
              {r.local != null ? `${r.local} · chờ gửi` : r.reading != null ? `${r.reading}` : 'Chưa ghi'}</span></div>
            <div className="s">{r.address} · {r.customer_code} · ĐH {r.serial}</div>
            <div className="s">Kỳ trước: {fmt.num(r.prev_reading, 2)}{r.avg_consumption ? ` · TB ${r.avg_consumption} m³` : ''}</div>
          </li>
        ))}
        {list.length > limit && <li className="more" onClick={() => setLimit(limit + 200)}>Hiện thêm ({list.length - limit})</li>}
        {!list.length && <li className="muted">Không có khách hàng phù hợp</li>}
      </ul>
      {cur && <ReadingSheet key={cur.meter_id} row={cur} period={pkg.period} onClose={() => setCur(null)} onSave={(v, n, p) => save(cur, v, n, p)} />}
    </>
  )
}

/* ------------------------------------------------------------ báo sự cố */
function useGps() {
  const [pos, setPos] = useState(null)
  const [state, setState] = useState('idle')
  const watch = useRef(null)
  const stop = () => { if (watch.current != null) navigator.geolocation.clearWatch(watch.current); watch.current = null }
  function locate() {
    if (!navigator.geolocation) { setState('Thiết bị không hỗ trợ GPS'); return }
    stop(); setState('locating')
    let best = null
    watch.current = navigator.geolocation.watchPosition((p) => {
      if (!best || p.coords.accuracy < best.acc) {
        best = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }
        setPos(best)
      }
      if (best.acc <= 10) { stop(); setState('ok') }
    }, (e) => { stop(); setState(e.code === 1 ? 'Chưa cho phép truy cập vị trí' : 'Không lấy được vị trí') },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 })
    setTimeout(() => { if (watch.current != null) { stop(); setState(best ? 'ok' : 'Hết thời gian chờ GPS') } }, 20000)
  }
  useEffect(() => stop, [])
  return { pos, setPos, state, locate }
}

function ReportIncident({ onQueue }) {
  const blank = { incident_type: 'leak', severity: 'medium', title: DEFAULT_TITLE.leak, description: '', reporter_phone: '' }
  const [f, setF] = useState(blank)
  const [edited, setEdited] = useState(false)
  const [photos, setPhotos] = useState([])
  const gps = useGps()
  const [manual, setManual] = useState(false)
  useEffect(() => { gps.locate() }, []) // eslint-disable-line
  const setType = (t) => { setF({ ...f, incident_type: t, title: edited ? f.title : DEFAULT_TITLE[t] }) }
  async function submit() {
    await onQueue('incident', { ...f, reporter_phone: f.reporter_phone || null, lon: gps.pos.lon, lat: gps.pos.lat, accuracy_m: gps.pos.acc ?? null },
      photos.map(({ blob, name }) => ({ blob, name })), `${f.title} (${photos.length} ảnh)`)
    setF(blank); setEdited(false); setPhotos([])
  }
  return (
    <div className="f-card">
      <b>Báo sự cố tại hiện trường</b>
      <div className="f-chips">
        {Object.entries(INCIDENT_TYPES).map(([k, v]) => <button key={k} className={f.incident_type === k ? 'on' : ''} onClick={() => setType(k)}>{v}</button>)}
      </div>
      <div className="f-chips">
        {Object.entries(SEVERITY).map(([k, v]) => <button key={k} className={f.severity === k ? 'on' : ''} style={f.severity === k ? { background: v.color, borderColor: v.color } : null} onClick={() => setF({ ...f, severity: k })}>{v.label}</button>)}
      </div>
      <label>Tiêu đề<input value={f.title} onChange={(e) => { setF({ ...f, title: e.target.value }); setEdited(true) }} /></label>
      <label>Mô tả, địa chỉ<textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="VD: trước số 25 Lê Lợi, nước tràn mặt đường" /></label>
      <label>SĐT người dân báo (nếu có)<input type="tel" value={f.reporter_phone} onChange={(e) => setF({ ...f, reporter_phone: e.target.value })} /></label>
      <div className="f-gps">
        {gps.pos ? <span>📍 {gps.pos.lat.toFixed(6)}, {gps.pos.lon.toFixed(6)} {gps.pos.acc != null && <small>(±{Math.round(gps.pos.acc)} m)</small>}</span> : <span className="muted">Chưa có vị trí</span>}
        <button className="f-btn sm" onClick={gps.locate}>{gps.state === 'locating' ? 'Đang dò GPS…' : 'Lấy lại vị trí'}</button>
        {!['idle', 'locating', 'ok'].includes(gps.state) && <div className="alert warn">{gps.state}. <a href="#" onClick={(e) => { e.preventDefault(); setManual(true) }}>Nhập tọa độ tay</a></div>}
        {manual && (
          <div className="row">
            <input type="number" inputMode="decimal" step="any" placeholder="Vĩ độ" onChange={(e) => gps.setPos((p) => ({ ...p, lat: Number(e.target.value), acc: null }))} />
            <input type="number" inputMode="decimal" step="any" placeholder="Kinh độ" onChange={(e) => gps.setPos((p) => ({ ...p, lon: Number(e.target.value), acc: null }))} />
          </div>
        )}
      </div>
      <PhotoPicker photos={photos} setPhotos={setPhotos} />
      <button className="f-btn primary" disabled={!gps.pos?.lat || !gps.pos?.lon || !f.title.trim()} onClick={submit}>Gửi báo cáo</button>
      <p className="muted small">Mất sóng: báo cáo và ảnh được lưu trên máy, tự gửi khi có mạng.</p>
    </div>
  )
}

/* ------------------------------------------------------------ công việc */
function TaskSheet({ t, materials, onClose, onDone }) {
  const [res, setRes] = useState('ok')
  const [checks, setChecks] = useState(Object.fromEntries((t.checklist || []).map((c) => [c, false])))
  const [turns, setTurns] = useState('')
  const [dur, setDur] = useState('')
  const [note, setNote] = useState('')
  const [mats, setMats] = useState([])
  const [photos, setPhotos] = useState([])
  const allChecked = Object.values(checks).every(Boolean)
  return (
    <Sheet title={`${t.code} · ${t.task_label}`} onClose={onClose}
      footer={<>
        <button className="f-btn" onClick={onClose}>Đóng</button>
        <button className="f-btn primary" disabled={res === 'ok' && !allChecked} onClick={() => onDone({
          task_id: t.id, result: res, checklist_result: checks, note: note || null,
          turns: turns === '' ? null : Number(turns), duration_min: dur === '' ? null : Number(dur),
          materials: mats.filter((m) => Number(m.qty) > 0).map((m) => ({ material_id: Number(m.material_id), qty: Number(m.qty) })),
          completed_at: new Date().toISOString(),
        }, photos)}>Hoàn thành</button>
      </>}>
      <div><b>{NODE_TYPES[t.node_type]?.label} {t.node_code}</b>{t.node_diameter ? ` D${t.node_diameter}` : ''} · hạn <b className={t.overdue ? 'error' : ''}>{fmt.day(t.due_date)}</b></div>
      {t.address && <div className="muted small">{t.address}</div>}
      {t.lat && <a className="small" href={mapsUrl(t.lat, t.lon)} target="_blank" rel="noreferrer">Chỉ đường →</a>}
      {t.checklist?.length > 0 && (
        <ul className="f-check">
          {t.checklist.map((c) => (
            <li key={c} className={checks[c] ? 'on' : ''} onClick={() => setChecks({ ...checks, [c]: !checks[c] })}><span>{checks[c] ? '☑' : '☐'}</span>{c}</li>
          ))}
        </ul>
      )}
      <div className="f-chips">
        {Object.entries(MAINT_RESULTS).map(([k, v]) => <button key={k} className={res === k ? 'on' : ''} style={res === k ? { background: v.color, borderColor: v.color } : null} onClick={() => setRes(k)}>{v.label}</button>)}
      </div>
      {res !== 'ok' && <div className="alert warn">Hệ thống sẽ tự lập phiếu sự cố cho thiết bị này.</div>}
      <div className="row">
        {t.task_type === 'exercise' && <input type="number" inputMode="decimal" placeholder="Số vòng van" value={turns} onChange={(e) => setTurns(e.target.value)} />}
        <input type="number" inputMode="numeric" placeholder="Thời gian (phút)" value={dur} onChange={(e) => setDur(e.target.value)} />
      </div>
      <textarea rows={2} placeholder="Ghi chú tình trạng" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="small muted">Vật tư sử dụng</div>
      {mats.map((m, i) => (
        <div key={i} className="row" style={{ flexWrap: 'nowrap' }}>
          <select value={m.material_id} onChange={(e) => setMats(mats.map((x, j) => (j === i ? { ...x, material_id: e.target.value } : x)))}>
            {materials.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.stock} {x.unit})</option>)}
          </select>
          <input type="number" inputMode="decimal" style={{ width: 80 }} value={m.qty} onChange={(e) => setMats(mats.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
          <button className="f-btn sm" onClick={() => setMats(mats.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      {materials.length > 0 && <button className="f-btn sm" onClick={() => setMats([...mats, { material_id: materials[0].id, qty: 1 }])}>+ Vật tư</button>}
      <PhotoPicker photos={photos} setPhotos={setPhotos} />
      {res === 'ok' && !allChecked && <div className="small muted">Đánh dấu đủ các bước kiểm tra để hoàn thành.</div>}
    </Sheet>
  )
}

function IncidentSheet({ inc, onClose, onUpdate }) {
  const [status, setStatus] = useState(null)
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState([])
  return (
    <Sheet title={`${inc.code} · ${inc.title}`} onClose={onClose}
      footer={<>
        <button className="f-btn" onClick={onClose}>Đóng</button>
        <button className="f-btn primary" disabled={!status && !note && !photos.length} onClick={() => onUpdate({ incident_id: inc.id, status, note: note || null }, photos)}>Gửi cập nhật</button>
      </>}>
      <div><span className="badge" style={{ background: SEVERITY[inc.severity]?.color }}>{SEVERITY[inc.severity]?.label}</span> <span className="badge" style={{ background: INCIDENT_STATUS[inc.status]?.color }}>{INCIDENT_STATUS[inc.status]?.label}</span> · {fmt.ago(inc.reported_at)}</div>
      {inc.description && <p className="small">{inc.description}</p>}
      {inc.lat && <a className="small" href={mapsUrl(inc.lat, inc.lon)} target="_blank" rel="noreferrer">Chỉ đường →</a>}
      <div className="f-chips">
        {(NEXT_STATUS[inc.status] || []).map((s) => <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(status === s ? null : s)}>→ {INCIDENT_STATUS[s].label}</button>)}
      </div>
      <textarea rows={3} placeholder="Ghi chú xử lý (VD: đã đóng van V00012, đang đào)" value={note} onChange={(e) => setNote(e.target.value)} />
      <PhotoPicker photos={photos} setPhotos={setPhotos} />
    </Sheet>
  )
}

function Work({ pkg, online, onDownload, onQueue, savePkg }) {
  const [seg, setSeg] = useState('tasks')
  const [mine, setMine] = useState(false)
  const [cur, setCur] = useState(null)
  if (!pkg) return <DownloadBox online={online} onDownload={onDownload} />
  const tasks = pkg.tasks.filter((t) => !t.local_done && (!mine || t.mine))
  const incs = pkg.incidents.filter((i) => !mine || i.mine)

  async function done(t, payload, photos) {
    await onQueue('task_complete', payload, photos, `${t.code} ${t.node_code}: ${MAINT_RESULTS[payload.result].label}`)
    await savePkg({ ...pkg, tasks: pkg.tasks.map((x) => (x.id === t.id ? { ...x, local_done: true } : x)) })
    setCur(null)
  }
  async function update(inc, payload, photos) {
    await onQueue('incident_update', payload, photos, `${inc.code}: ${payload.status ? INCIDENT_STATUS[payload.status].label : 'ghi chú'}`)
    await savePkg({ ...pkg, incidents: pkg.incidents.map((x) => (x.id === inc.id ? { ...x, status: payload.status || x.status } : x)) })
    setCur(null)
  }
  return (
    <>
      <div className="f-seg">
        <button className={seg === 'tasks' ? 'on' : ''} onClick={() => setSeg('tasks')}>Bảo trì ({tasks.length})</button>
        <button className={seg === 'inc' ? 'on' : ''} onClick={() => setSeg('inc')}>Sự cố ({incs.length})</button>
        <button className={mine ? 'on' : ''} onClick={() => setMine(!mine)}>Việc của tôi</button>
      </div>
      <ul className="f-list">
        {seg === 'tasks' && tasks.map((t) => (
          <li key={t.id} onClick={() => setCur({ t })}>
            <div className="t"><b>{t.task_label} {NODE_TYPES[t.node_type]?.label.toLowerCase()} {t.node_code}</b><span className={`chip ${t.overdue ? 'late' : ''}`}>{t.overdue ? 'Quá hạn ' : 'Hạn '}{fmt.day(t.due_date)}</span></div>
            <div className="s">{t.code}{t.node_diameter ? ` · D${t.node_diameter}` : ''}{t.address ? ` · ${t.address}` : ''} · {t.assignee || 'chưa giao'}</div>
          </li>
        ))}
        {seg === 'inc' && incs.map((i) => (
          <li key={i.id} onClick={() => setCur({ i })}>
            <div className="t"><b>{i.title}</b><span className="chip" style={{ background: INCIDENT_STATUS[i.status]?.color, color: '#fff' }}>{INCIDENT_STATUS[i.status]?.label}</span></div>
            <div className="s">{i.code} · {SEVERITY[i.severity]?.label} · {fmt.ago(i.reported_at)}{i.assignee ? ` · ${i.assignee}` : ''}</div>
          </li>
        ))}
        {((seg === 'tasks' && !tasks.length) || (seg === 'inc' && !incs.length)) && <li className="muted">Không có việc</li>}
      </ul>
      {cur?.t && <TaskSheet t={cur.t} materials={pkg.materials} onClose={() => setCur(null)} onDone={(p, ph) => done(cur.t, p, ph)} />}
      {cur?.i && <IncidentSheet inc={cur.i} onClose={() => setCur(null)} onUpdate={(p, ph) => update(cur.i, p, ph)} />}
    </>
  )
}

/* ------------------------------------------------------------ đồng bộ */
function SyncTab({ pkg, queue, online, syncing, lastSync, onSync, onDownload, onRemove, installEvt }) {
  const nav = useNavigate()
  const bytes = pendingBytes(queue)
  return (
    <>
      <div className="f-card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <b>{online ? '🟢 Đang có mạng' : '🔴 Mất mạng – làm việc offline'}</b>
          <button className="f-btn primary sm" disabled={!online || syncing || !queue.length} onClick={() => onSync(false)}>{syncing ? 'Đang gửi…' : 'Đồng bộ ngay'}</button>
        </div>
        <div className="small muted">Chờ gửi: {queue.length} mục{bytes ? `, ${bytes < 1048576 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(1)} MB`} ảnh` : ''} · Lần đồng bộ cuối: {lastSync ? fmt.date(lastSync) : 'chưa'}</div>
        {pkg && <div className="small muted">Dữ liệu trên máy: kỳ {pkg.period}, tải lúc {fmt.date(pkg.generated_at)} ({pkg.readings.length} đồng hồ, {pkg.tasks.length} lệnh bảo trì)</div>}
      </div>
      <ul className="f-list">
        {queue.map((q) => (
          <li key={q.uuid} className={q.error ? 'err' : ''}>
            <div className="t"><b>{KIND_LABEL[q.kind]}</b><span className="chip">{fmt.date(q.created_at)}</span></div>
            <div className="s">{q.summary}{q.photos?.length ? ` · ${q.photos.length} ảnh` : ''}</div>
            {q.error && <div className="s error">{q.error} <button className="f-btn sm" onClick={() => onRemove(q)}>Bỏ mục này</button></div>}
          </li>
        ))}
        {!queue.length && <li className="muted">Không còn gì chờ gửi.</li>}
      </ul>
      {pkg && <DownloadBox pkg={pkg} online={online} onDownload={onDownload} />}
      <div className="f-card">
        {installEvt && <button className="f-btn" onClick={() => installEvt.prompt()}>Cài ứng dụng ra màn hình chính</button>}
        <button className="f-btn" onClick={() => nav('/map')}>Mở giao diện đầy đủ</button>
        <button className="f-btn danger" onClick={() => {
          if (queue.length && !window.confirm(`Còn ${queue.length} mục chưa gửi (vẫn giữ trên máy, gửi khi đăng nhập lại). Đăng xuất?`)) return
          auth.clear(); nav('/login?next=/field')
        }}>Đăng xuất</button>
      </div>
    </>
  )
}

/* ------------------------------------------------------------ khung ứng dụng */
const TABS = [['readings', 'Chỉ số', '🔢'], ['incident', 'Báo sự cố', '⚠️'], ['tasks', 'Công việc', '🔧'], ['sync', 'Đồng bộ', '🔄']]

export default function FieldApp() {
  const user = auth.user
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'readings'
  const setTab = (t) => setParams({ tab: t }, { replace: true })
  const [online, setOnline] = useState(navigator.onLine)
  const [pkg, setPkg] = useState(null)
  const [queue, setQueue] = useState([])
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState(null)
  const [toast, setToast] = useState(null)
  const [installEvt, setInstallEvt] = useState(null)
  const syncLock = useRef(false)
  const pkgKey = `pkg:${user.username}`

  const notify = (text, kind = 'ok') => { setToast({ text, kind }); setTimeout(() => setToast(null), 3500) }
  const refreshQueue = async () => setQueue(await outbox.all(user.username))

  useEffect(() => {
    kv.get(pkgKey).then((p) => setPkg(p || null))
    kv.get(`lastSync:${user.username}`).then(setLastSync)
    refreshQueue()
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    const inst = (e) => { e.preventDefault(); setInstallEvt(e) }
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    window.addEventListener('beforeinstallprompt', inst)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); window.removeEventListener('beforeinstallprompt', inst) }
  }, []) // eslint-disable-line

  async function savePkg(p) { setPkg(p); await kv.set(pkgKey, p) }

  async function download(period, zoneId) {
    const qs = new URLSearchParams({ period })
    if (zoneId) qs.set('zone_id', zoneId)
    const p = await api.get('/api/field/package?' + qs)
    // giữ dấu các chỉ số / công việc đã ghi trên máy nhưng chưa gửi
    const q = await outbox.all(user.username)
    const localReadings = Object.fromEntries(q.filter((x) => x.kind === 'reading' && x.payload.period === p.period).map((x) => [x.payload.meter_id, x.payload.reading]))
    const localDone = new Set(q.filter((x) => x.kind === 'task_complete').map((x) => x.payload.task_id))
    p.readings = p.readings.map((r) => (r.meter_id in localReadings ? { ...r, local: localReadings[r.meter_id] } : r))
    p.tasks = p.tasks.map((t) => (localDone.has(t.id) ? { ...t, local_done: true } : t))
    await savePkg(p)
    notify(`Đã tải ${p.readings.length} đồng hồ, ${p.tasks.length} lệnh bảo trì, ${p.incidents.length} sự cố`)
  }

  async function sync(silent) {
    if (syncLock.current || !navigator.onLine) return
    syncLock.current = true
    setSyncing(true)
    try {
      const r = await syncOutbox(user.username)
      setLastSync(new Date().toISOString())
      if (r.sent || r.failed || !silent) notify(r.failed ? `Đã gửi ${r.sent}, ${r.failed} mục lỗi – xem tab Đồng bộ` : `Đã gửi ${r.sent} mục lên máy chủ`, r.failed ? 'error' : 'ok')
    } catch (e) {
      if (!silent) notify(e.message, 'error')
    } finally {
      await refreshQueue()
      syncLock.current = false
      setSyncing(false)
    }
  }
  // tự gửi khi có mạng trở lại và định kỳ mỗi phút nếu còn hàng đợi
  useEffect(() => { if (online) sync(true) }, [online]) // eslint-disable-line
  useEffect(() => {
    const t = setInterval(() => { if (navigator.onLine && queue.length) sync(true) }, 60000)
    return () => clearInterval(t)
  }, [queue.length]) // eslint-disable-line

  async function queueOp(kind, payload, photos, summary) {
    await enqueue(user.username, kind, payload, photos, summary)
    await refreshQueue()
    notify(navigator.onLine ? 'Đã lưu – đang gửi…' : 'Đã lưu trên máy – sẽ gửi khi có mạng')
    if (navigator.onLine) sync(true)
  }

  // bỏ mục lỗi: hiện lại công việc / khách hàng trên máy để làm lại
  async function removeItem(q) {
    if (!window.confirm('Bỏ mục này? Dữ liệu sẽ không được gửi.')) return
    await outbox.del(q.uuid)
    if (pkg && q.kind === 'task_complete') await savePkg({ ...pkg, tasks: pkg.tasks.map((t) => (t.id === q.payload.task_id ? { ...t, local_done: false } : t)) })
    if (pkg && q.kind === 'reading') await savePkg({ ...pkg, readings: pkg.readings.map((r) => (r.meter_id === q.payload.meter_id ? { ...r, local: undefined } : r)) })
    refreshQueue()
  }

  const errors = queue.filter((q) => q.error).length

  return (
    <div className="field">
      <header className="f-hd">
        <img className="f-logo" src="/logo.png" alt="Logo HAWASUCO" width="36" height="36" />
        <div className="f-title"><b>AquaNet Hiện trường</b><small>{user.full_name || user.username}</small></div>
        <button className={`f-net ${online ? 'on' : ''}`} onClick={() => setTab('sync')}>
          {online ? 'Online' : 'Offline'}{queue.length ? ` · ${queue.length} chờ gửi` : ''}{errors ? ` · ${errors} lỗi` : ''}
        </button>
      </header>
      <main className="f-main">
        {tab === 'readings' && <Readings pkg={pkg} online={online} onDownload={download} onQueue={queueOp} savePkg={savePkg} />}
        {tab === 'incident' && <ReportIncident onQueue={queueOp} />}
        {tab === 'tasks' && <Work pkg={pkg} online={online} onDownload={download} onQueue={queueOp} savePkg={savePkg} />}
        {tab === 'sync' && (
          <SyncTab pkg={pkg} queue={queue} online={online} syncing={syncing} lastSync={lastSync} onSync={sync} onDownload={download} installEvt={installEvt}
            onRemove={removeItem} />
        )}
      </main>
      <nav className="f-tabs">
        {TABS.map(([k, l, ic]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            <span>{ic}</span>{l}{k === 'sync' && queue.length > 0 && <i>{queue.length}</i>}
          </button>
        ))}
      </nav>
      {toast && <div className={`f-toast ${toast.kind}`}>{toast.text}</div>}
    </div>
  )
}
