import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GeoJSON, LayersControl, MapContainer, ScaleControl, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { useSearchParams } from 'react-router-dom'
import L from 'leaflet'
import '@geoman-io/leaflet-geoman-free'
import { api, auth, subscribeRealtime } from '../api'
import { AGE_COLORS, INCIDENT_STATUS, MATERIALS, NODE_TYPES, SENSOR_STATUS, SENSOR_TYPES, SEVERITY, pipeColor, pipeWeight } from '../labels'
import FeaturePanel from '../components/FeaturePanel'
import IsolationPanel from '../components/IsolationPanel'
import { VectorTileLayer } from '../components/VectorTileLayer'

const renderer = L.canvas({ tolerance: 6 })
const EMPTY = { type: 'FeatureCollection', features: [] }

function geomCenter(g) {
  if (!g) return null
  if (g.type === 'Point') return [g.coordinates[1], g.coordinates[0]]
  const b = L.geoJSON(g).getBounds()
  return b.isValid() ? b : null
}

const fmtVal = (p) => (p.last_value == null ? '—' : `${Number(p.last_value).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} ${p.unit}`)

/** Lấy đầy đủ một đối tượng theo id (chế độ vector tiles không giữ toàn bộ dữ liệu ở trình duyệt). */
async function fetchFeature(layer, id) {
  if (layer === 'customer') {
    const c = await api.get(`/api/customers/${id}`)
    const { geometry, meters, ...props } = c
    return { type: 'Feature', id, geometry, properties: props }
  }
  const url = { pipe: '/api/pipes/', node: '/api/nodes/', incident: '/api/incidents/', sensor: '/api/scada/sensors/' }[layer]
  return url ? api.get(url + id) : null
}

/* -------- lớp vector tiles: thêm/bỏ khỏi bản đồ, vẽ lại khi đổi kiểu, tải lại khi dữ liệu đổi -------- */
function TileNetwork({ url, draw, version }) {
  const map = useMap()
  const layer = useRef(null)
  useEffect(() => {
    const sameOrigin = url.startsWith('/')
    if (!map.getPane('aquanetTiles')) map.createPane('aquanetTiles').style.zIndex = 350 // dưới lớp vector (400): đối tượng chọn, sự cố
    layer.current = new VectorTileLayer({
      url, draw, pane: 'aquanetTiles',
      headers: () => (sameOrigin && auth.token ? { Authorization: `Bearer ${auth.token}` } : {}),
    }).addTo(map)
    return () => { map.removeLayer(layer.current); layer.current = null }
  }, [map, url]) // eslint-disable-line
  useEffect(() => { layer.current?.setDraw(draw) }, [draw])
  const first = useRef(true)
  useEffect(() => { if (first.current) { first.current = false; return } layer.current?.refresh() }, [version])
  return null
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
  const [data, setData] = useState({ zones: EMPTY, pipes: EMPTY, nodes: EMPTY, customers: EMPTY, incidents: EMPTY, sensors: EMPTY })
  const [ver, setVer] = useState(0)
  const [tileVer, setTileVer] = useState(0)
  const [tileInfo, setTileInfo] = useState(null)
  const [renderMode, setRenderMode] = useState(() => localStorage.getItem('aquanet_render') || 'auto')
  const [live, setLive] = useState(null)
  const [sensorTick, setSensorTick] = useState(0)
  const [show, setShow] = useState({ zones: true, pipes: true, junction: false, valve: true, hydrant: true, pump: true, tank: true, source: true, bulk_meter: true, customers: false, incidents: true, closedIncidents: false, sensors: true })
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

  // chế độ hiển thị: GeoJSON (sửa trực tiếp, mạng nhỏ) hoặc vector tiles (mạng hàng trăm nghìn đối tượng)
  useEffect(() => { api.get('/api/tiles/info').then(setTileInfo).catch(() => setTileInfo({ recommended: 'geojson' })) }, [])
  const useTiles = renderMode === 'tiles' || (renderMode === 'auto' && tileInfo?.recommended === 'tiles')
  const tilesRef = useRef(useTiles)
  tilesRef.current = useTiles

  const load = useCallback(async (which) => {
    const urls = { zones: '/api/zones', pipes: '/api/pipes', nodes: '/api/nodes', customers: '/api/customers/geojson', incidents: '/api/incidents', sensors: '/api/scada/sensors?include_smart=false' }
    // chế độ tiles: ống, nút, khách hàng, vùng đến từ vector tiles – chỉ tải sự cố và điểm đo
    which = (which || Object.keys(urls)).filter((k) => !tilesRef.current || ['incidents', 'sensors'].includes(k))
    const res = await Promise.all(which.map((k) => api.get(urls[k]).catch(() => EMPTY)))
    setData((d) => { const n = { ...d }; which.forEach((k, i) => { n[k] = res[i] }); return n })
    setVer((v) => v + 1)
  }, [])
  useEffect(() => {
    if (!tileInfo) return
    if (useTiles) setData((d) => ({ ...d, zones: EMPTY, pipes: EMPTY, nodes: EMPTY, customers: EMPTY }))
    load()
  }, [tileInfo, useTiles, load])
  const fitted = useRef(false)
  useEffect(() => { // lần đầu: phóng tới toàn mạng lưới
    if (fitted.current || !mapRef.current || params.toString()) return
    let b
    if (useTiles && tileInfo?.bounds) { const [x1, y1, x2, y2] = tileInfo.bounds; b = L.latLngBounds([y1, x1], [y2, x2]) }
    else if (data.pipes.features.length) b = L.geoJSON(data.pipes).getBounds()
    if (b?.isValid()) { mapRef.current.fitBounds(b, { padding: [40, 40] }); fitted.current = true }
  }, [data.pipes, useTiles, tileInfo]) // eslint-disable-line

  // số liệu SCADA trực tiếp trên bản đồ
  useEffect(() => {
    if (!show.sensors) return undefined
    return subscribeRealtime((ev) => {
      if (ev.type !== 'values') return
      const byId = Object.fromEntries(ev.items.map((it) => [it.id, it]))
      setData((d) => ({
        ...d,
        sensors: { ...d.sensors, features: d.sensors.features.map((f) => (byId[f.id] ? { ...f, properties: { ...f.properties, last_value: byId[f.id].value, last_ts: byId[f.id].ts, status: f.properties.status === 'offline' ? 'normal' : f.properties.status } } : f)) },
      }))
      setSensorTick((t) => t + 1)
    }, setLive)
  }, [show.sensors])
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') setMode('select') }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // focus từ URL: ?pipe=1 | ?node=1 | ?incident=1 | ?customer=1 | ?sensor=1
  useEffect(() => {
    const entry = ['pipe', 'node', 'incident', 'customer', 'sensor'].find((k) => params.get(k))
    if (!entry || !mapRef.current || !tileInfo) return
    const id = Number(params.get(entry))
    const local = data[entry + 's'].features.find((x) => x.id === id)
    if (!local && !useTiles && ver < 1) return // chờ tải xong lớp GeoJSON
    setParams({}, { replace: true })
    ;(local ? Promise.resolve(local) : fetchFeature(entry, id)).then((f) => {
      if (!f) return
      select(entry, f)
      flyTo(f.geometry)
      if (entry === 'incident') setShow((s) => ({ ...s, incidents: true, closedIncidents: true }))
    }).catch(() => {})
  }, [params, data, tileInfo]) // eslint-disable-line

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
    if (layer === 'sensor') l.bindTooltip(`${f.properties.name}: <b>${fmtVal(f.properties)}</b> · ${SENSOR_STATUS[f.properties.status]?.label}`)
  }

  // chế độ tiles: nhấp bản đồ -> hỏi máy chủ đối tượng tại điểm đó (dung sai ~8 px)
  async function identifyAt(latlng) {
    const nodeTypes = Object.keys(NODE_TYPES).filter((k) => show[k]).join(',')
    const layers = ['incident', nodeTypes && 'node', show.customers && 'customer', show.pipes && 'pipe', show.zones && 'zone'].filter(Boolean).join(',')
    const qs = new URLSearchParams({ lon: latlng.lng, lat: latlng.lat, tol_m: Math.max(0.5, snapM() * 0.7), layers, open_incidents_only: !show.closedIncidents })
    if (nodeTypes) qs.set('node_types', nodeTypes)
    try {
      const r = await api.get('/api/network/identify?' + qs)
      if (r) select(r.layer, r.feature)
      else setSel(null)
    } catch { /* bỏ qua */ }
  }

  function onMapClick(latlng) {
    const geometry = { type: 'Point', coordinates: [latlng.lng, latlng.lat] }
    if (mode === 'add-node') {
      setSel({ layer: 'node', isNew: true, snapM: snapM(), geometry, props: { node_type: newNodeType, status: newNodeType === 'valve' ? 'open' : 'active' } })
      setMode('select')
    } else if (mode === 'report') {
      setSel({ layer: 'incident', isNew: true, geometry, props: { incident_type: 'leak', severity: 'medium', title: 'Rò rỉ nước' } })
      setMode('select')
    } else if (mode === 'select' && useTiles && !editing) {
      identifyAt(latlng)
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
    const reload = { pipe: ['pipes', 'nodes'], node: ['nodes', 'pipes'], incident: ['incidents'], sensor: ['sensors'] }[layer]
    if (useTiles && ['pipe', 'node', 'incident'].includes(layer)) setTileVer((v) => v + 1)
    if (reload) load(reload)
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
  const tileDraw = useMemo(() => ({
    order: ['zones', 'pipes', 'customers', 'nodes'],
    style(layer, p, z) {
      if (layer === 'zones') return show.zones && { color: '#0ea5e9', weight: 2, dash: [6, 4], fill: 'rgba(14,165,233,0.04)' }
      if (layer === 'pipes') return show.pipes && { color: pipeColor(p, styleMode), weight: pipeWeight(p.diameter_mm) * (z < 13 ? 0.45 : z < 15 ? 0.7 : 1), dash: p.status === 'planned' ? [6, 6] : null }
      if (layer === 'customers') return show.customers && { radius: 3, color: '#475569', weight: 1, fill: '#fde68a' }
      if (layer === 'nodes') {
        if (!show[p.node_type]) return null
        const t = NODE_TYPES[p.node_type] || NODE_TYPES.junction
        const closed = p.node_type === 'valve' && p.status === 'closed'
        return { radius: t.r * (z < 16 ? 0.75 : 1), color: closed ? '#dc2626' : '#fff', weight: closed ? 3 : 1.5, fill: closed ? '#fff' : t.color }
      }
      return null
    },
  }), [show, styleMode])
  const incFiltered = useMemo(() => ({ ...data.incidents, features: data.incidents.features.filter((f) => show.closedIncidents || !['resolved', 'closed'].includes(f.properties.status)) }), [data.incidents, show])
  const showKey = JSON.stringify(show) + styleMode + ver

  const nFeatures = tileInfo ? (tileInfo.pipes || 0) + (tileInfo.nodes || 0) : null
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

        {useTiles && tileInfo && <TileNetwork url={tileInfo.url_template} draw={tileDraw} version={tileVer} />}
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
        {show.sensors && <GeoJSON key={'s' + showKey + sensorTick} data={data.sensors} onEachFeature={featureClick('sensor')}
          pointToLayer={(f, ll) => L.marker(ll, { icon: L.divIcon({ className: '', iconSize: [16, 16], html: `<div class="sensor-pin" style="background:${SENSOR_STATUS[f.properties.status]?.color}"><span>${{ pressure: 'P', flow: 'Q', level: 'H', totalizer: 'Σ', quality: 'C' }[f.properties.sensor_type] || 'S'}</span></div>` }) })} />}
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
                  const f = data[r.layer + 's'].features.find((x) => x.id === r.id)
                  if (f) select(r.layer, f)
                  else fetchFeature(r.layer, r.id).then((x) => x && select(r.layer, x)).catch(() => {})
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
        {[['zones', 'Vùng DMA'], ['pipes', 'Đường ống'], ['customers', 'Khách hàng'], ['incidents', 'Sự cố đang xử lý'], ['closedIncidents', 'Sự cố đã xử lý'], ['sensors', 'Điểm đo SCADA']].map(([k, l]) => (
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
          {show.sensors && Object.entries(SENSOR_STATUS).slice(0, 3).map(([k, v]) => <span key={k}><b style={{ background: v.color, borderRadius: 3 }} />Điểm đo: {v.label.toLowerCase()}</span>)}
          {show.sensors && live && <span className="small muted">Số liệu SCADA: {live === 'live' ? '● trực tiếp' : 'đang kết nối lại…'}</span>}
        </div>
        <h4>Hiển thị mạng lưới</h4>
        <select value={renderMode} onChange={(e) => { setRenderMode(e.target.value); try { localStorage.setItem('aquanet_render', e.target.value) } catch { /* */ } }}>
          <option value="auto">Tự động</option><option value="geojson">GeoJSON (sửa trực tiếp)</option><option value="tiles">Vector tiles (mạng lớn)</option>
        </select>
        {nFeatures != null && <div className="small muted" style={{ marginTop: 4 }}>{nFeatures.toLocaleString('vi-VN')} ống + nút · đang dùng {useTiles ? 'vector tiles' : 'GeoJSON'}</div>}
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
