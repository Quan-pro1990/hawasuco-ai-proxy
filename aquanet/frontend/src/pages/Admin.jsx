import { useEffect, useState } from 'react'
import { api } from '../api'
import { ROLES, fmt } from '../labels'

const LAYERS = { pipes: 'Đường ống', nodes: 'Van / thiết bị', customers: 'Khách hàng', incidents: 'Sự cố', zones: 'Vùng DMA' }

function EpanetExport() {
  const [zones, setZones] = useState([])
  const [o, setO] = useState({ zone_id: '', source_pressure_m: 40, demand_months: 3, include_planned: false, srid: '' })
  const [sum, setSum] = useState(null)
  const [err, setErr] = useState(null)
  useEffect(() => { api.get('/api/zones').then((r) => setZones(r.features)) }, [])
  const qs = () => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== '' && v !== false).map(([k, v]) => [k, String(v)]))
  async function check() {
    setErr(null)
    try { setSum(await api.get('/api/network/epanet/summary?' + qs())) } catch (e) { setSum(null); setErr(e.message) }
  }
  useEffect(() => { setSum(null) }, [o])
  const zone = zones.find((z) => String(z.id) === String(o.zone_id))
  return (
    <div className="card">
      <h3>Mô phỏng thủy lực – xuất EPANET (.inp)</h3>
      <p className="muted small">Tệp EPANET 2.2 mở được bằng EPANET (miễn phí, US EPA), WaterGEMS, WNTR… Van thành VALVE (van đóng ghi Closed), nhu cầu nước lấy từ chỉ số khách hàng, mẫu dùng nước theo giờ, tọa độ UTM.</p>
      <div className="grid2">
        <label>Phạm vi<select value={o.zone_id} onChange={(e) => setO({ ...o, zone_id: e.target.value })}>
          <option value="">Toàn mạng lưới</option>{zones.map((z) => <option key={z.id} value={z.id}>{z.properties.name}</option>)}
        </select></label>
        <label>Áp lực đầu nguồn / biên DMA (m)<input type="number" value={o.source_pressure_m} onChange={(e) => setO({ ...o, source_pressure_m: e.target.value })} /></label>
        <label>Số kỳ tính nhu cầu TB<input type="number" min="1" max="24" value={o.demand_months} onChange={(e) => setO({ ...o, demand_months: e.target.value })} /></label>
        <label>Hệ tọa độ (EPSG, trống = UTM tự chọn)<input value={o.srid} placeholder="vd. 9210 (VN-2000 TM-3)" onChange={(e) => setO({ ...o, srid: e.target.value })} /></label>
      </div>
      <label className="row" style={{ color: 'var(--text)' }}><input type="checkbox" style={{ width: 'auto' }} checked={o.include_planned} onChange={(e) => setO({ ...o, include_planned: e.target.checked })} />Gồm cả ống quy hoạch (đánh giá phương án)</label>
      <div className="row">
        <button className="btn" onClick={check}>Kiểm tra trước</button>
        <button className="btn primary" onClick={() => api.download('/api/network/epanet.inp?' + qs(), `aquanet_${zone?.properties.code || 'toan-mang'}.inp`).catch((e) => setErr(e.message))}>⤓ Tải tệp .inp</button>
      </div>
      {err && <div className="alert error">{err}</div>}
      {sum && (
        <>
          <table className="tbl" style={{ marginTop: 10 }}><tbody>
            <tr><td>Nút (junction) · nguồn (reservoir) · bể (tank)</td><td className="num">{sum.junctions} · {sum.reservoirs} · {sum.tanks}</td></tr>
            <tr><td>Ống · van (đang đóng) · bơm</td><td className="num">{sum.pipes} · {sum.valves} ({sum.closed_valves}) · {sum.pumps}</td></tr>
            <tr><td>Tổng nhu cầu trung bình</td><td className="num">{fmt.num(sum.total_demand_lps, 2)} L/s ({fmt.num(sum.total_demand_lps * 86.4)} m³/ngày)</td></tr>
            <tr><td>Hệ tọa độ</td><td className="num">EPSG:{sum.srid}</td></tr>
          </tbody></table>
          {sum.warnings.map((w) => <div key={w} className="alert warn">{w}</div>)}
        </>
      )}
    </div>
  )
}

function TileInfo() {
  const [t, setT] = useState(null)
  useEffect(() => { api.get('/api/tiles/info').then(setT) }, [])
  if (!t) return null
  return (
    <div className="card">
      <h3>Bản đồ vector tiles</h3>
      <p className="small">Mạng lưới hiện có <b>{fmt.num(t.pipes)}</b> ống, <b>{fmt.num(t.nodes)}</b> nút, <b>{fmt.num(t.customers)}</b> khách hàng. Trên <b>{fmt.num(t.threshold)}</b> ống + nút, bản đồ tự chuyển sang vector tiles (hiện khuyến nghị: <b>{t.recommended === 'tiles' ? 'vector tiles' : 'GeoJSON'}</b>).</p>
      <p className="small">Nguồn tile: <code>{t.url_template}</code></p>
      <p className="muted small">Tile được sinh bởi hàm PostGIS <code>postgisftw.aquanet_network(z, x, y)</code> – dùng chung cho API tích hợp, <b>Martin</b> và <b>pg_tileserv</b> (biến <code>TILE_URL_TEMPLATE</code>). QGIS cũng mở được lớp này qua <i>Vector Tiles › New Generic Connection</i>.</p>
    </div>
  )
}

export default function Admin() {
  const [users, setUsers] = useState([])
  const [nu, setNu] = useState({ username: '', full_name: '', password: '', role: 'engineer' })
  const [msg, setMsg] = useState(null)
  const [imp, setImp] = useState({ layer: 'pipes', file: null, result: null })
  const [val, setVal] = useState(null)

  const loadUsers = () => api.get('/api/auth/users').then(setUsers)
  useEffect(() => { loadUsers() }, [])

  async function addUser() {
    try { await api.post('/api/auth/users', nu); setNu({ username: '', full_name: '', password: '', role: 'engineer' }); setMsg({ ok: true, text: 'Đã tạo người dùng' }); loadUsers() }
    catch (e) { setMsg({ ok: false, text: e.message }) }
  }
  async function doImport() {
    if (!imp.file) return
    const fd = new FormData()
    fd.append('file', imp.file)
    try { setImp({ ...imp, result: await api.post(`/api/import/${imp.layer}`, fd) }) }
    catch (e) { setImp({ ...imp, result: { created: 0, errors: [e.message] } }) }
  }

  return (
    <div className="page">
      <div className="page-head"><h2>Quản trị & dữ liệu</h2></div>
      <div className="charts">
        <div className="card">
          <h3>Người dùng</h3>
          <table className="tbl">
            <thead><tr><th>Tên đăng nhập</th><th>Họ tên</th><th>Vai trò</th><th></th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}><td>{u.username}</td><td>{u.full_name}</td><td>{ROLES[u.role]}</td>
                  <td><button className="btn danger sm" onClick={async () => { if (confirm('Xóa người dùng?')) { try { await api.del(`/api/auth/users/${u.id}`); loadUsers() } catch (e) { alert(e.message) } } }}>Xóa</button></td></tr>
              ))}
            </tbody>
          </table>
          <div className="grid2" style={{ marginTop: 10 }}>
            <label>Tên đăng nhập<input value={nu.username} onChange={(e) => setNu({ ...nu, username: e.target.value })} /></label>
            <label>Họ tên<input value={nu.full_name} onChange={(e) => setNu({ ...nu, full_name: e.target.value })} /></label>
            <label>Mật khẩu<input type="password" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} /></label>
            <label>Vai trò<select value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })}>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          </div>
          <button className="btn primary" onClick={addUser}>Thêm người dùng</button>
          {msg && <div className={`alert ${msg.ok ? 'ok' : 'error'}`}>{msg.text}</div>}
        </div>

        <div className="card">
          <h3>Trao đổi dữ liệu với QGIS</h3>
          <p className="muted small">Xuất GeoJSON (EPSG:4326) để mở trong QGIS, hoặc nhập lớp đã số hóa từ QGIS. Trường thuộc tính được nhận diện tự động: <code>material/vat_lieu</code>, <code>diameter_mm/dn/duong_kinh</code>, <code>install_year/nam_lap</code>, <code>code/ma</code>, <code>node_type/loai</code>…</p>
          <div className="row" style={{ marginBottom: 12 }}>
            {Object.entries(LAYERS).map(([k, v]) => <button key={k} className="btn sm" onClick={() => api.download(`/api/export/${k}`, `${k}.geojson`)}>⤓ {v}</button>)}
          </div>
          <div className="row">
            <select value={imp.layer} onChange={(e) => setImp({ ...imp, layer: e.target.value })} style={{ width: 160 }}>
              {['pipes', 'nodes', 'customers'].map((k) => <option key={k} value={k}>{LAYERS[k]}</option>)}
            </select>
            <input type="file" accept=".geojson,.json" onChange={(e) => setImp({ ...imp, file: e.target.files[0], result: null })} style={{ width: 240 }} />
            <button className="btn primary" onClick={doImport} disabled={!imp.file}>Nhập</button>
          </div>
          {imp.result && (
            <div className={`alert ${imp.result.errors.length ? 'warn' : 'ok'}`}>
              Đã nhập {imp.result.created} đối tượng. {imp.result.errors.slice(0, 5).map((e) => <div key={e}>{e}</div>)}
            </div>
          )}
          <h3 style={{ marginTop: 16 }}>Kết nối trực tiếp QGIS → PostGIS</h3>
          <p className="small">Trong QGIS: <i>Layer › Add Layer › Add PostGIS Layers › New</i>, nhập host/cổng/CSDL của máy chủ (mặc định cổng 5432, CSDL <code>capnuoc</code>). Các bảng <code>pipes, nodes, zones, customers, incidents</code> hiện ra như lớp bản đồ và chỉnh sửa trực tiếp được.</p>
        </div>

        <EpanetExport />
        <TileInfo />

        <div className="card">
          <h3>Kiểm tra topology mạng lưới</h3>
          <button className="btn" onClick={async () => setVal(await api.get('/api/network/validate'))}>Chạy kiểm tra</button>
          {val && (
            <ul>
              <li>Ống chưa nối nút: <b>{val.unconnected_pipes.length}</b> {val.unconnected_pipes.slice(0, 10).join(', ')}</li>
              <li>Ống quá ngắn (&lt; 0,5 m): <b>{val.short_pipes.length}</b> {val.short_pipes.slice(0, 10).join(', ')}</li>
              <li>Nút/thiết bị không nối ống: <b>{val.orphan_nodes.length}</b> {val.orphan_nodes.slice(0, 10).map((n) => n.code).join(', ')}</li>
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
