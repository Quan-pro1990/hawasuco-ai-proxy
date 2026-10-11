import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Sinh dist/sw.js với danh sách tệp cần lưu sẵn – tên tệp đổi theo mỗi bản build nên PWA tự cập nhật. */
function serviceWorker() {
  return {
    name: 'aquanet-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map') && f !== 'index.html').sort()
      const version = createHash('sha1').update(files.join('|')).digest('hex').slice(0, 12)
      const tpl = readFileSync(new URL('./pwa/sw-template.js', import.meta.url), 'utf8')
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: tpl.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(files.map((f) => '/' + f))),
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  server: {
    port: 5173,
    proxy: { '/api': process.env.API_URL || 'http://localhost:8000' },
  },
})
