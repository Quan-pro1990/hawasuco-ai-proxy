import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

export default function Login() {
  const nav = useNavigate()
  const [f, setF] = useState({ username: 'admin', password: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await api.login(f.username, f.password)
      nav('/map')
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <svg width="44" height="44" viewBox="0 0 24 24"><path fill="#0a6ebd" d="M12 2C8 7 5 10.5 5 14a7 7 0 0014 0c0-3.5-3-7-7-12z" /></svg>
        <h1>AquaNet GIS</h1>
        <p className="muted">Hệ thống quản lý mạng lưới cấp nước</p>
        <label>Tên đăng nhập<input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoFocus /></label>
        <label>Mật khẩu<input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        {err && <div className="alert error">{err}</div>}
        <button className="btn primary block" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
        <p className="muted small">Tài khoản mẫu: admin / admin123 · kythuat / kythuat123 · xem / xem123</p>
      </form>
    </div>
  )
}
