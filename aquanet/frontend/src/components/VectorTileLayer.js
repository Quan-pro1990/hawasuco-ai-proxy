import L from 'leaflet'
import Pbf from 'pbf'
import { VectorTile } from '@mapbox/vector-tile'

/**
 * Lớp vector tiles (Mapbox Vector Tile) vẽ bằng canvas – hiển thị mạng lưới hàng trăm nghìn đối tượng.
 *
 * - Tile tải bằng fetch (gửi kèm token khi cùng máy chủ), giải mã bằng @mapbox/vector-tile.
 * - Tile đã giải mã được giữ trong bộ nhớ: đổi kiểu tô màu, bật/tắt lớp chỉ cần vẽ lại.
 * - options.draw = { order: [tên lớp…], style(lớp, thuộc tính, zoom) -> kiểu | null }
 *   kiểu: { color, weight, dash, radius, fill }
 */
export const VectorTileLayer = L.GridLayer.extend({
  options: { url: '', headers: null, draw: null, maxCache: 600, updateWhenZooming: false, keepBuffer: 2, maxZoom: 22 },

  initialize(options) {
    L.setOptions(this, options)
    this._cache = new Map()
  },

  setDraw(draw) { this.options.draw = draw; this.redraw(); return this },

  /** Dữ liệu đã thay đổi (vừa sửa ống, thêm van…): bỏ tile cũ và tải lại. */
  refresh() { this._cache.clear(); this.redraw(); return this },

  createTile(coords, done) {
    const size = this.getTileSize()
    const r = window.devicePixelRatio || 1
    const canvas = L.DomUtil.create('canvas', 'leaflet-tile')
    canvas.width = size.x * r
    canvas.height = size.y * r
    canvas.style.width = `${size.x}px`
    canvas.style.height = `${size.y}px`
    this._get(coords).then(
      (tile) => { if (tile) this._paint(canvas, tile, coords.z, r); done(null, canvas) },
      (e) => done(e, canvas),
    )
    return canvas
  },

  _get(c) {
    const key = `${c.z}/${c.x}/${c.y}`
    if (this._cache.has(key)) {
      const hit = this._cache.get(key)
      this._cache.delete(key) // làm mới thứ tự LRU
      this._cache.set(key, hit)
      return hit
    }
    const url = L.Util.template(this.options.url, { z: c.z, x: c.x, y: c.y })
    const p = fetch(url, { headers: this.options.headers ? this.options.headers(url) : {} }).then(async (res) => {
      if (res.status === 204 || res.status === 404) return null
      if (!res.ok) throw new Error(`Tile ${key}: HTTP ${res.status}`)
      const buf = await res.arrayBuffer()
      return buf.byteLength ? new VectorTile(new Pbf(buf)) : null
    })
    this._cache.set(key, p)
    p.catch(() => this._cache.delete(key))
    while (this._cache.size > this.options.maxCache) this._cache.delete(this._cache.keys().next().value)
    return p
  },

  _paint(canvas, tile, z, r) {
    const draw = this.options.draw
    if (!draw) return
    const ctx = canvas.getContext('2d')
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const name of draw.order) {
      const layer = tile.layers[name]
      if (!layer) continue
      const k = canvas.width / layer.extent
      for (let i = 0; i < layer.length; i++) {
        const f = layer.feature(i)
        const st = draw.style(name, f.properties, z)
        if (!st) continue
        const rings = f.loadGeometry()
        ctx.setLineDash(st.dash ? st.dash.map((d) => d * r) : [])
        ctx.lineWidth = (st.weight ?? 1) * r
        ctx.strokeStyle = st.color || '#2563eb'
        if (f.type === 1) {
          ctx.fillStyle = st.fill || st.color
          for (const ring of rings) {
            for (const p of ring) {
              ctx.beginPath()
              ctx.arc(p.x * k, p.y * k, (st.radius ?? 4) * r, 0, Math.PI * 2)
              ctx.fill()
              if (st.weight) ctx.stroke()
            }
          }
        } else {
          ctx.beginPath()
          for (const ring of rings) {
            ring.forEach((p, j) => (j ? ctx.lineTo(p.x * k, p.y * k) : ctx.moveTo(p.x * k, p.y * k)))
            if (f.type === 3) ctx.closePath()
          }
          if (f.type === 3 && st.fill) { ctx.fillStyle = st.fill; ctx.fill('evenodd') }
          ctx.stroke()
        }
      }
    }
  },
})
