const TOKEN_KEY = 'aquanet_token'
const USER_KEY = 'aquanet_user'

export const auth = {
  get token() { return localStorage.getItem(TOKEN_KEY) },
  get user() { try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null } },
  save(token, user) { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(user)) },
  clear() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY) },
  canEdit() { return ['admin', 'engineer'].includes(this.user?.role) },
}

async function request(method, url, body, opts = {}) {
  const headers = {}
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`
  let payload = body
  if (body && !(body instanceof FormData) && !(body instanceof URLSearchParams)) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const res = await fetch(url, { method, headers, body: payload })
  if (res.status === 401 && !url.endsWith('/login')) {
    auth.clear()
    window.location.href = '/login'
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
