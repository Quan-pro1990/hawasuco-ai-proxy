import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'

export default function Login() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')
  const [f, setF] = useState({ username: next === '/field' ? '' : 'admin', password: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [demo, setDemo] = useState(false)
  useEffect(() => { api.get('/api/meta').then((m) => setDemo(!!m.demo)).catch(() => {}) }, [])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const user = await api.login(f.username, f.password)
      // tổ hiện trường vào thẳng ứng dụng di động; chỉ cho phép quay về đường dẫn nội bộ
      nav(next?.startsWith('/') && !next.startsWith('//') ? next : user.role === 'field' ? '/field' : '/map')
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <img src="/logo.png" alt="Logo HAWASUCO" width="104" height="104" />
        <h1>AquaNet GIS</h1>
        <p className="muted">Hệ thống quản lý mạng lưới cấp nước</p>
        <label>Tên đăng nhập<input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoFocus /></label>
        <label>Mật khẩu<input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        {err && <div className="alert error">{err}</div>}
        <button className="btn primary block" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
        {demo && <p className="muted small">Tài khoản mẫu: admin / admin123 · kythuat / kythuat123 · hientruong / hientruong123 · xem / xem123</p>}
      </form>
    </div>
  )
}
