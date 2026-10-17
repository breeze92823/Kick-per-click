import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

const TRANSFORMS_FILE = fileURLToPath(new URL('./src/devTransforms.json', import.meta.url))
const FIELDS = ['x', 'y', 'z', 'rotY', 'scale']

// Dev server only (apply: 'serve') and only with VITE_DEV_MODE=true: lets the in-game layout editor
// (src/devEditor.js) write landmark transforms to src/devTransforms.json. Builds never include it.
function devTransformsPlugin(enabled) {
  return {
    name: 'dev-transforms',
    apply: 'serve',
    configureServer(server) {
      if (!enabled) return
      server.middlewares.use('/__dev/save-transforms', (req, res) => {
        const fail = (code, text) => {
          res.statusCode = code
          res.end(text)
        }
        const ip = req.socket.remoteAddress ?? ''
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) return fail(403, 'localhost only')
        if (req.method !== 'POST') return fail(405, 'POST only')
        let body = ''
        req.on('data', (chunk) => {
          body += chunk
          if (body.length > 1e5) req.destroy()
        })
        req.on('end', () => {
          try {
            const data = JSON.parse(body)
            const out = {}
            for (const [key, t] of Object.entries(data)) {
              if (!/^\w+$/.test(key) || !FIELDS.every((f) => Number.isFinite(t?.[f]))) throw new Error(`bad entry "${key}"`)
              out[key] = Object.fromEntries(FIELDS.map((f) => [f, t[f]]))
            }
            writeFileSync(TRANSFORMS_FILE, JSON.stringify(out, null, 2) + '\n')
            res.end('ok')
          } catch (err) {
            fail(400, err.message)
          }
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [devTransformsPlugin(loadEnv(mode, process.cwd(), 'VITE_').VITE_DEV_MODE?.toLowerCase() === 'true')],
}))
