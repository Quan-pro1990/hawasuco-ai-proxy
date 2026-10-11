import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { auth } from './api'
import { ROLES } from './labels'
import Login from './pages/Login'
import MapPage from './pages/MapPage'
import Incidents from './pages/Incidents'
import Customers from './pages/Customers'
import Reports from './pages/Reports'
import Admin from './pages/Admin'

const NAV = [
  ['/map', 'Bản đồ mạng lưới', 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z M9 3v15 M15 6v15'],
  ['/incidents', 'Sự cố & sửa chữa', 'M12 9v4 M12 17h.01 M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z'],
  ['/customers', 'Khách hàng & đồng hồ', 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75'],
  ['/reports', 'Thống kê & báo cáo', 'M18 20V10 M12 20V4 M6 20v-6'],
  ['/admin', 'Quản trị & dữ liệu', 'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z'],
]

export function Icon({ d, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      {d.split(' M').map((p, i) => <path key={i} d={(i ? 'M' : '') + p} />)}
    </svg>
  )
}

function Layout({ children }) {
  const nav = useNavigate()
  const user = auth.user
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <svg width="26" height="26" viewBox="0 0 24 24"><path fill="#38bdf8" d="M12 2C8 7 5 10.5 5 14a7 7 0 0014 0c0-3.5-3-7-7-12z" /></svg>
          <div><b>AquaNet GIS</b><small>Mạng lưới cấp nước</small></div>
        </div>
        <nav>
          {NAV.filter(([p]) => p !== '/admin' || user?.role === 'admin').map(([path, label, icon]) => (
            <NavLink key={path} to={path} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon d={icon} /> <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="userbox">
          <div><b>{user?.full_name || user?.username}</b><small>{ROLES[user?.role]}</small></div>
          <button className="btn ghost sm" onClick={() => { auth.clear(); nav('/login') }}>Đăng xuất</button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  )
}

function Private({ children }) {
  return auth.token ? <Layout>{children}</Layout> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/map" element={<Private><MapPage /></Private>} />
      <Route path="/incidents" element={<Private><Incidents /></Private>} />
      <Route path="/customers" element={<Private><Customers /></Private>} />
      <Route path="/reports" element={<Private><Reports /></Private>} />
      <Route path="/admin" element={<Private><Admin /></Private>} />
      <Route path="*" element={<Navigate to="/map" replace />} />
    </Routes>
  )
}
