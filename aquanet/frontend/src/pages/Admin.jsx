import { useEffect, useState } from 'react'
import { api } from '../api'
import { ROLES } from '../labels'

const LAYERS = { pipes: 'Đường ống', nodes: 'Van / thiết bị', customers: 'Khách hàng', incidents: 'Sự cố', zones: 'Vùng DMA' }

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
