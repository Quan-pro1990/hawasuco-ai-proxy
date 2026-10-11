import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GeoJSON, LayersControl, MapContainer, ScaleControl, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { useSearchParams } from 'react-router-dom'
import L from 'leaflet'
import '@geoman-io/leaflet-geoman-free'
import { api, auth } from '../api'
import { AGE_COLORS, INCIDENT_STATUS, MATERIALS, NODE_TYPES, SEVERITY, pipeColor, pipeWeight } from '../labels'
import FeaturePanel from '../components/FeaturePanel'
import IsolationPanel from '../components/IsolationPanel'

const renderer = L.canvas({ tolerance: 6 })
const EMPTY = { type: 'FeatureCollection', features: [] }

function geomCenter(g) {
  if (!g) return null
  if (g.type === 'Point') return [g.coordinates[1], g.coordinates[0]]
  const b = L.geoJSON(g).getBounds()
  return b.isValid() ? b : null
}

/* -------- điều khiển bản đồ (sự kiện, vẽ, sửa) -------- */
function MapController({ mode, setMode, onMapClick, onDrawn, mapRef, setCoord }) {
  const map = useMap()
  useEffect(() => { mapRef.current = map }, [map, mapRef])
  useMapEvents({
    click: (e) => onMapClick(e.latlng),
    mousemove: (e) => setCoord(e.latlng),
  })
  useEffect(() => {
    if (mode === 'draw-pipe') {
      map.pm.enableDraw('Line', { snappable: true, snapDistance: 18, finishOn: 'dblclick',
        templineStyle: { color: '#0a6ebd' }, hintlineStyle: { color: '#0a6ebd', dashArray: '5,5' } })
      const h = (e) => {
        const coords = e.layer.getLatLngs().map((ll) => [ll.lng, ll.lat])
        map.removeLayer(e.layer)
        setMode('select')
        if (coords.length >= 2) onDrawn({ type: 'LineString', coordinates: coords })
      }
      map.on('pm:create', h)
      return () => { map.off('pm:create', h); map.pm.disableDraw() }
    }
  }, [mode]) // eslint-disable-line
  useEffect(() => {
    map.getContainer().style.cursor = mode === 'select' ? '' : 'crosshair'
  }, [mode, map])
  return null
}

export default function MapPage() {
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState({ zones: EMPTY, pipes: EMPTY, nodes: EMPTY, customers: EMPTY, incidents: EMPTY })
  const [ver, setVer] = useState(0)
  const [show, setShow] = useState({ zones: true, pipes: true, junction: false, valve: true, hydrant: true, pump: true, tank: true, source: true, bulk_meter: true, customers: false, incidents: true, closedIncidents: false })
  const [styleMode, setStyleMode] = useState('material')
  const [sel, setSel] = useState(null)
  const [iso, setIso] = useState(null)
  const [mode, setMode] = useState('select')
  const [newNodeType, setNewNodeType] = useState('valve')
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [coord, setCoord] = useState(null)
  const [editing, setEditing] = useState(null)
  const mapRef = useRef()
  const modeRef = useRef(mode)
  modeRef.current = mode
  const canEdit = auth.canEdit()

  const load = useCallback(async (which = ['zones', 'pipes', 'nodes', 'customers', 'incidents']) => {
    const urls = { zones: '/api/zones', pipes: '/api/pipes', nodes: '/api/nodes', customers: '/api/customers/geojson', incidents: '/api/incidents' }
    const res = await Promise.all(which.map((k) => api.get(urls[k])))
    setData((d) => { const n = { ...d }; which.forEach((k, i) => { n[k] = res[i] }); return n })
    setVer((v) => v + 1)
  }, [])
  useEffect(() => { load() }, [load])
  const fitted = useRef(false)
  useEffect(() => { // lần đầu: phóng tới toàn mạng lưới
    if (fitted.current || !mapRef.current || !data.pipes.features.length || params.toString()) return
    const b = L.geoJSON(data.pipes).getBounds()
    if (b.isValid()) { mapRef.current.fitBounds(b, { padding: [40, 40] }); fitted.current = true }
  }, [data.pipes]) // eslint-disable-line
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') setMode('select') }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // focus từ URL: ?pipe=1 | ?node=1 | ?incident=1 | ?customer=1
  useEffect(() => {
    const entry = ['pipe', 'node', 'incident', 'customer'].find((k) => params.get(k))
    if (!entry || !mapRef.current) return
    const id = Number(params.get(entry))
    const fc = data[entry + 's']
    const f = fc.features.find((x) => x.id === id)
    if (!f) return
    select(entry, f)
    flyTo(f.geometry)
    if (entry === 'incident') setShow((s) => ({ ...s, incidents: true, closedIncidents: true }))
    setParams({}, { replace: true })
  }, [params, data]) // eslint-disable-line

  // dung sai bắt điểm ~12 pixel màn hình, quy ra mét theo mức zoom hiện tại
  function snapM() {
    const m = mapRef.current
    if (!m) return 3
    const mpp = (40075016.686 * Math.cos((m.getCenter().lat * Math.PI) / 180)) / 2 ** (m.getZoom() + 8)
    return Math.min(25, Math.max(1, +(mpp * 12).toFixed(2)))
  }

  function flyTo(g) {
    const c = geomCenter(g)
    if (!c || !mapRef.current) return
    if (c instanceof L.LatLngBounds) mapRef.current.flyToBounds(c, { maxZoom: 18, padding: [80, 80] })
    else mapRef.current.flyTo(c, 18)
  }

  function select(layer, f) {
    setIso(null)
    setSel({ layer, id: f.id, props: f.properties, geometry: f.geometry })
  }

  const featureClick = (layer) => (f, l) => {
    l.on('click', (e) => {
      if (modeRef.current !== 'select') return
      L.DomEvent.stopPropagation(e)
      select(layer, f)
    })
    if (layer === 'pipe') l.bindTooltip(`${f.properties.code} · D${f.properties.diameter_mm} ${f.properties.material}`, { sticky: true })
    if (layer === 'node') l.bindTooltip(`${NODE_TYPES[f.properties.node_type]?.label} ${f.properties.code}${f.properties.node_type === 'valve' ? (f.properties.status === 'closed' ? ' (ĐÓNG)' : ' (mở)') : ''}`)
    if (layer === 'customer') l.bindTooltip(`${f.properties.code} – ${f.properties.name}`)
    if (layer === 'incident') l.bindTooltip(`${f.properties.code}: ${f.properties.title}`)
  }

  function onMapClick(latlng) {
    const geometry = { type: 'Point', coordinates: [latlng.lng, latlng.lat] }
    if (mode === 'add-node') {
      setSel({ layer: 'node', isNew: true, snapM: snapM(), geometry, props: { node_type: newNodeType, status: newNodeType === 'valve' ? 'open' : 'active' } })
      setMode('select')
    } else if (mode === 'report') {
      setSel({ layer: 'incident', isNew: true, geometry, props: { incident_type: 'leak', severity: 'medium', title: 'Rò rỉ nước' } })
      setMode('select')
    }
  }

  async function runIsolation(pipeId) {
    try {
      const r = await api.get(`/api/network/isolate?pipe_id=${pipeId}`)
      setSel(null)
      setIso(r)
      if (r.segment_geometry) flyTo({ type: 'GeometryCollection', geometries: [r.segment_geometry, ...(r.downstream_geometry ? [r.downstream_geometry] : []), ...r.valve_list.map((v) => v.geometry)] })
    } catch (e) { alert(e.message) }
  }

  function onSaved(layer, r) {
    const reload = { pipe: ['pipes', 'nodes'], node: ['nodes', 'pipes'], incident: ['incidents'] }[layer]
    load(reload)
    if (r) setSel({ layer, id: r.id, props: r.properties, geometry: r.geometry })
  }

  // di chuyển nút bằng kéo thả
  function startMove(s) {
    const map = mapRef.current
    const [lng, lat] = s.geometry.coordinates
    const m = L.marker([lat, lng], { draggable: true, autoPan: true }).addTo(map)
    setEditing({ kind: 'move', layer: m, sel: s })
  }
  // sửa đỉnh đường ống
  function startEditGeom(s) {
    const map = mapRef.current
    const pl = L.polyline(s.geometry.coordinates.map(([x, y]) => [y, x]), { color: '#f59e0b', weight: 5 }).addTo(map)
    pl.pm.enable({ snappable: true, snapDistance: 15 })
    setEditing({ kind: 'geom', layer: pl, sel: s })
  }
  async function finishEdit(saveIt) {
    const { kind, layer, sel: s } = editing
    try {
      if (saveIt) {
        let geometry
        if (kind === 'move') { const ll = layer.getLatLng(); geometry = { type: 'Point', coordinates: [ll.lng, ll.lat] } }
        else geometry = { type: 'LineString', coordinates: layer.getLatLngs().map((ll) => [ll.lng, ll.lat]) }
        const r = await api.put(`/api/${s.layer}s/${s.id}`, { geometry })
        onSaved(s.layer, r)
      }
    } catch (e) { alert(e.message) } finally {
      if (layer.pm) layer.pm.disable()
      mapRef.current.removeLayer(layer)
      setEditing(null)
    }
  }

  async function doSearch(v) {
    setQ(v)
    if (v.trim().length < 2) return setResults([])
    try { setResults(await api.get(`/api/search?q=${encodeURIComponent(v)}`)) } catch { setResults([]) }
  }

  const nodesFiltered = useMemo(() => ({ ...data.nodes, features: data.nodes.features.filter((f) => show[f.properties.node_type]) }), [data.nodes, show])
  const incFiltered = useMemo(() => ({ ...data.incidents, features: data.incidents.features.filter((f) => show.closedIncidents || !['resolved', 'closed'].includes(f.properties.status)) }), [data.incidents, show])
  const showKey = JSON.stringify(show) + styleMode + ver

  const hint = { 'draw-pipe': 'Nhấp để thêm đỉnh ống, nhấp đúp để kết thúc. Đầu ống tự bắt dính vào nút/van gần nhất.', 'add-node': `Nhấp lên bản đồ để đặt ${NODE_TYPES[newNodeType].label.toLowerCase()} (đặt trên ống sẽ tự tách ống).`, report: 'Nhấp vào vị trí xảy ra sự cố.' }[mode]

  return (
    <div className="map-page">
      <MapContainer center={[10.9847, 106.6548]} zoom={16} maxZoom={21} renderer={renderer} zoomControl>
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Bản đồ nền OSM">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxNativeZoom={19} maxZoom={21} attribution="© OpenStreetMap" />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Ảnh vệ tinh">
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxNativeZoom={19} maxZoom={21} attribution="Esri World Imagery" />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Nền trắng">
            <TileLayer url="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />
          </LayersControl.BaseLayer>
        </LayersControl>
        <ScaleControl imperial={false} />
        <MapController mode={mode} setMode={setMode} onMapClick={onMapClick} mapRef={mapRef} setCoord={setCoord}
          onDrawn={(geometry) => setSel({ layer: 'pipe', isNew: true, snapM: snapM(), geometry, props: { material: 'HDPE', diameter_mm: 110, pipe_class: 'distribution', status: 'active', install_year: new Date().getFullYear() } })} />

        {show.zones && <GeoJSON key={'z' + showKey} data={data.zones} onEachFeature={featureClick('zone')}
          style={() => ({ color: '#0ea5e9', weight: 2, dashArray: '6,4', fillOpacity: 0.04 })} />}
        {show.pipes && <GeoJSON key={'p' + showKey} data={data.pipes} onEachFeature={featureClick('pipe')}
          style={(f) => ({ color: pipeColor(f.properties, styleMode), weight: pipeWeight(f.properties.diameter_mm), opacity: 0.95, dashArray: f.properties.status === 'planned' ? '6,6' : null })} />}
        {show.customers && <GeoJSON key={'c' + showKey} data={data.customers} onEachFeature={featureClick('customer')}
          pointToLayer={(f, ll) => L.circleMarker(ll, { radius: 3, color: '#475569', weight: 1, fillColor: '#fde68a', fillOpacity: 1 })} />}
        <GeoJSON key={'n' + showKey} data={nodesFiltered} onEachFeature={featureClick('node')}
          pointToLayer={(f, ll) => {
            const t = NODE_TYPES[f.properties.node_type] || NODE_TYPES.junction
            const closed = f.properties.node_type === 'valve' && f.properties.status === 'closed'
            return L.circleMarker(ll, { radius: t.r, color: closed ? '#dc2626' : '#fff', weight: closed ? 3 : 1.5, fillColor: closed ? '#fff' : t.color, fillOpacity: 1 })
          }} />
        {show.incidents && <GeoJSON key={'i' + showKey} data={incFiltered} onEachFeature={featureClick('incident')}
          pointToLayer={(f, ll) => {
            const c = SEVERITY[f.properties.severity]?.color || '#dc2626'
            const open = !['resolved', 'closed'].includes(f.properties.status)
            return L.marker(ll, { icon: L.divIcon({ className: '', iconSize: [18, 18], html: `<div class="${open ? 'pulse' : ''}" style="width:18px;height:18px;border-radius:50%;background:${open ? c : '#94a3b8'};border:2px solid #fff;display:grid;place-items:center;color:#fff;font:700 11px sans-serif">!</div>` }) })
          }} />}

        {sel && !sel.isNew && sel.geometry && (
          <GeoJSON key={'sel' + sel.layer + sel.id + ver} data={sel.geometry} interactive={false}
            style={() => ({ color: '#facc15', weight: 10, opacity: 0.7 })}
            pointToLayer={(f, ll) => L.circleMarker(ll, { radius: 14, color: '#facc15', weight: 4, fill: false })} />
        )}
        {sel?.isNew && sel.geometry && (
          <GeoJSON key={'new' + JSON.stringify(sel.geometry)} data={sel.geometry} interactive={false}
            style={() => ({ color: '#f59e0b', weight: 5, dashArray: '8,6' })}
            pointToLayer={(f, ll) => L.circleMarker(ll, { radius: 9, color: '#f59e0b', weight: 3, fillOpacity: 0.3 })} />
        )}
        {iso && (
          <>
            {iso.downstream_geometry && <GeoJSON key={'iso-d' + iso.pipe_id} data={iso.downstream_geometry} interactive={false} style={() => ({ color: '#f97316', weight: 6, opacity: 0.85 })} />}
            {iso.segment_geometry && <GeoJSON key={'iso-s' + iso.pipe_id} data={iso.segment_geometry} interactive={false} style={() => ({ color: '#dc2626', weight: 8, opacity: 0.9 })} />}
            <GeoJSON key={'iso-v' + iso.pipe_id} data={{ type: 'FeatureCollection', features: iso.valve_list.map((v) => ({ type: 'Feature', geometry: v.geometry, properties: v })) }}
              pointToLayer={(f, ll) => L.marker(ll, { icon: L.divIcon({ className: 'valve-icon', iconSize: [14, 14] }) }).bindTooltip(`Đóng van ${f.properties.code}`, { permanent: true, direction: 'top', offset: [0, -8] })} />
          </>
        )}
      </MapContainer>

      {/* thanh công cụ */}
      <div className="map-toolbar">
        <div className="searchbox">
          <input placeholder="Tìm mã ống, van, khách hàng, tên đường…" value={q} onChange={(e) => doSearch(e.target.value)} />
          {results.length > 0 && (
            <ul>
              {results.map((r) => (
                <li key={r.layer + r.id} onClick={() => {
                  setResults([]); setQ(r.label); flyTo(r.geometry)
                  const fc = data[r.layer + 's']; const f = fc.features.find((x) => x.id === r.id)
                  if (f) select(r.layer, f)
                }}>{r.label}<small>{{ node: 'thiết bị', pipe: 'đường ống', customer: 'khách hàng' }[r.layer]}</small></li>
              ))}
            </ul>
          )}
        </div>
        <div className="floating tool-group">
          <button className={`btn sm ${mode === 'select' ? 'on' : ''}`} onClick={() => setMode('select')}>Chọn</button>
          <button className={`btn sm ${mode === 'report' ? 'on' : ''}`} onClick={() => { setSel(null); setIso(null); setMode('report') }}>⚠ Báo sự cố</button>
          {canEdit && <button className={`btn sm ${mode === 'draw-pipe' ? 'on' : ''}`} onClick={() => { setSel(null); setIso(null); setMode('draw-pipe') }}>Vẽ ống</button>}
          {canEdit && (
            <>
              <select value={newNodeType} onChange={(e) => setNewNodeType(e.target.value)} style={{ width: 130, padding: '3px 6px' }}>
                {Object.entries(NODE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <button className={`btn sm ${mode === 'add-node' ? 'on' : ''}`} onClick={() => { setSel(null); setIso(null); setMode('add-node') }}>Đặt điểm</button>
            </>
          )}
        </div>
      </div>

      {/* bảng lớp + chú giải */}
      <div className="layer-panel floating">
        <h4 style={{ marginTop: 0 }}>Lớp dữ liệu</h4>
        {[['zones', 'Vùng DMA'], ['pipes', 'Đường ống'], ['customers', 'Khách hàng'], ['incidents', 'Sự cố đang xử lý'], ['closedIncidents', 'Sự cố đã xử lý']].map(([k, l]) => (
          <label key={k}><input type="checkbox" checked={show[k]} onChange={(e) => setShow({ ...show, [k]: e.target.checked })} />{l}</label>
        ))}
        <h4>Thiết bị</h4>
        {Object.entries(NODE_TYPES).map(([k, v]) => (
          <label key={k}><input type="checkbox" checked={show[k]} onChange={(e) => setShow({ ...show, [k]: e.target.checked })} />
            <b style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: v.color }} />{v.label}</label>
        ))}
        <h4>Tô màu ống theo</h4>
        <select value={styleMode} onChange={(e) => setStyleMode(e.target.value)}>
          <option value="material">Vật liệu</option><option value="age">Tuổi ống</option><option value="diameter">Đường kính</option>
        </select>
        <div className="legend">
          {styleMode === 'material' && Object.entries(MATERIALS).map(([k, v]) => <span key={k}><i style={{ background: v.color }} />{v.label}</span>)}
          {styleMode === 'age' && AGE_COLORS.map(([, c, l]) => <span key={l}><i style={{ background: c }} />{l}</span>)}
          {styleMode === 'diameter' && [['≥ 300', '#1e3a8a'], ['200–299', '#1d4ed8'], ['150–199', '#3b82f6'], ['100–149', '#60a5fa'], ['< 100', '#93c5fd']].map(([l, c]) => <span key={l}><i style={{ background: c }} />D {l} mm</span>)}
          <span><b style={{ background: '#fff', border: '3px solid #dc2626' }} />Van đang đóng</span>
          <span><b style={{ background: INCIDENT_STATUS.new.color }} />Sự cố</span>
        </div>
      </div>

      {hint && <div className="hint">{hint} <button className="btn sm" style={{ marginLeft: 8 }} onClick={() => setMode('select')}>Hủy (Esc)</button></div>}
      {editing && (
        <div className="hint">{editing.kind === 'move' ? 'Kéo biểu tượng tới vị trí mới. Các ống nối sẽ được kéo theo.' : 'Kéo các đỉnh để sửa tuyến ống.'}
          <button className="btn sm primary" style={{ marginLeft: 8 }} onClick={() => finishEdit(true)}>Lưu</button>
          <button className="btn sm" style={{ marginLeft: 4 }} onClick={() => finishEdit(false)}>Hủy</button>
        </div>
      )}
      {coord && <div className="coord">{coord.lat.toFixed(6)}, {coord.lng.toFixed(6)}</div>}

      {sel && !iso && (
        <FeaturePanel sel={sel} onClose={() => setSel(null)} onSaved={onSaved} onIsolate={runIsolation} onMove={startMove} onEditGeom={startEditGeom}
          onReportHere={(s) => {
            const c = s.geometry.coordinates[Math.floor(s.geometry.coordinates.length / 2)]
            setSel({ layer: 'incident', isNew: true, geometry: { type: 'Point', coordinates: c }, props: { incident_type: 'leak', severity: 'medium', title: `Rò rỉ trên ống ${s.props.code}`, pipe_id: s.id } })
          }} />
      )}
      {iso && <IsolationPanel iso={iso} onClose={() => setIso(null)} onFlyTo={flyTo} />}
    </div>
  )
}
