const TOKEN_KEY = 'aquanet_token'
const USER_KEY = 'aquanet_user'

export const auth = {
  get token() { return localStorage.getItem(TOKEN_KEY) },
  get user() { try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null } },
  save(token, user) { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(user)) },
  clear() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY) },
  canEdit() { return ['admin', 'engineer'].includes(this.user?.role) },
  canField() { return ['admin', 'engineer', 'field'].includes(this.user?.role) },
}

export class OfflineError extends Error {}

async function request(method, url, body, opts = {}) {
  const headers = {}
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`
  let payload = body
  if (body && !(body instanceof FormData) && !(body instanceof URLSearchParams)) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  let res
  try {
    res = await fetch(url, { method, headers, body: payload })
  } catch {
    throw new OfflineError('Không kết nối được máy chủ – kiểm tra mạng')
  }
  if (res.status === 401 && !url.endsWith('/login') && !opts.no401Redirect) {
    auth.clear()
    window.location.href = '/login' + (location.pathname.startsWith('/field') ? '?next=/field' : '')
    throw new Error('Hết phiên đăng nhập')
  }
  if (opts.raw) return res
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text()
  if (!res.ok) {
    const d = data?.detail
    throw new Error(Array.isArray(d) ? d.map((x) => `${x.loc?.slice(-1)}: ${x.msg}`).join('; ') : d || res.statusText)
  }
  return data
}

export const api = {
  get: (u) => request('GET', u),
  post: (u, b) => request('POST', u, b),
  put: (u, b) => request('PUT', u, b),
  del: (u) => request('DELETE', u),
  async login(username, password) {
    const form = new URLSearchParams({ username, password })
    const r = await request('POST', '/api/auth/login', form)
    auth.save(r.access_token, r.user)
    return r.user
  },
  /** Tải tệp cần đăng nhập (ảnh hiện trường…) thành URL dùng được cho <img>. Nhớ URL.revokeObjectURL. */
  async blobUrl(url) {
    const res = await request('GET', url, null, { raw: true })
    if (!res.ok) throw new Error('Không tải được tệp')
    return URL.createObjectURL(await res.blob())
  },
  async download(url, filename) {
    const res = await request('GET', url, null, { raw: true })
    if (!res.ok) throw new Error('Không tải được tệp')
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
  },
}

/**
 * Nhận sự kiện SCADA thời gian thực (Server-Sent Events) qua fetch để gửi kèm token.
 * Tự kết nối lại khi rớt mạng hoặc máy chủ đóng luồng định kỳ. Trả về hàm hủy đăng ký.
 */
export function subscribeRealtime(onEvent, onState) {
  let stopped = false
  let ctrl
  let delay = 1000
  async function run() {
    while (!stopped) {
      ctrl = new AbortController()
      try {
        const res = await fetch('/api/scada/stream?max_seconds=300', {
          headers: { Authorization: `Bearer ${auth.token}` }, signal: ctrl.signal,
        })
        if (res.status === 401) { onState?.('unauthorized'); return }
        if (!res.ok || !res.body) throw new Error(res.statusText)
        onState?.('live')
        delay = 1000
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
        let buf = ''
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buf += value
          let i
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const chunk = buf.slice(0, i)
            buf = buf.slice(i + 2)
            const data = chunk.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('\n')
            if (data && data !== '{}') {
              try { onEvent(JSON.parse(data)) } catch { /* bỏ qua gói hỏng */ }
            }
          }
        }
      } catch {
        if (stopped) return
        onState?.('reconnecting')
      }
      if (stopped) return
      await new Promise((r) => setTimeout(r, delay))
      delay = Math.min(delay * 2, 30000)
    }
  }
  run()
  return () => { stopped = true; ctrl?.abort() }
}
