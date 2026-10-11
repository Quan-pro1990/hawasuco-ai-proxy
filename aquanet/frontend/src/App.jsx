import { Suspense, lazy } from 'react'
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { auth } from './api'
import { ROLES } from './labels'
import Login from './pages/Login'

// tải trễ từng trang: ứng dụng hiện trường trên điện thoại không phải tải bản đồ, biểu đồ…
const MapPage = lazy(() => import('./pages/MapPage'))
const Incidents = lazy(() => import('./pages/Incidents'))
const Customers = lazy(() => import('./pages/Customers'))
const Reports = lazy(() => import('./pages/Reports'))
const Admin = lazy(() => import('./pages/Admin'))
const Scada = lazy(() => import('./pages/Scada'))
const Maintenance = lazy(() => import('./pages/Maintenance'))
const FieldApp = lazy(() => import('./field/FieldApp'))

const NAV = [
  ['/map', 'Bản đồ mạng lưới', 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z M9 3v15 M15 6v15'],
  ['/incidents', 'Sự cố & sửa chữa', 'M12 9v4 M12 17h.01 M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z'],
  ['/customers', 'Khách hàng & đồng hồ', 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75'],
  ['/scada', 'Giám sát SCADA', 'M22 12h-4l-3 9L9 3l-3 9H2'],
  ['/maintenance', 'Bảo trì & vật tư', 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z'],
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
          <img className="brand-logo" src="/logo.png" alt="Logo HAWASUCO" width="40" height="40" />
          <div><b>AquaNet GIS</b><small>Mạng lưới cấp nước</small></div>
        </div>
        <nav>
          {NAV.filter(([p]) => p !== '/admin' || user?.role === 'admin').map(([path, label, icon]) => (
            <NavLink key={path} to={path} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon d={icon} /> <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <NavLink to="/field" className="field-link">
          <Icon d="M7 2h10a2 2 0 012 2v16a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2z M12 18h.01" /> <span>Ứng dụng hiện trường</span>
        </NavLink>
        <div className="userbox">
          <div><b>{user?.full_name || user?.username}</b><small>{ROLES[user?.role]}</small></div>
          <button className="btn ghost sm" onClick={() => { auth.clear(); nav('/login') }}>Đăng xuất</button>
        </div>
      </aside>
      <main className="content"><Suspense fallback={<div className="page muted">Đang tải…</div>}>{children}</Suspense></main>
    </div>
  )
}

function Private({ children }) {
  return auth.token ? <Layout>{children}</Layout> : <Navigate to="/login" replace />
}

function FieldRoute() {
  return auth.token
    ? <Suspense fallback={<div className="page muted">Đang tải…</div>}><FieldApp /></Suspense>
    : <Navigate to="/login?next=/field" replace />
}

function Home() {
  return <Navigate to={auth.user?.role === 'field' ? '/field' : '/map'} replace />
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
      <Route path="/scada" element={<Private><Scada /></Private>} />
      <Route path="/maintenance" element={<Private><Maintenance /></Private>} />
      <Route path="/field" element={<FieldRoute />} />
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
