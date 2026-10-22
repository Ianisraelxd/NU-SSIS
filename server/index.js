import express from 'express'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { closeDb } from './db.js'
import { FEATURES } from './config.js'
import { db } from './db.js'
import { seedIfEmpty } from './seed.js'
import authRoutes from './routes/auth.js'
import commonRoutes from './routes/common.js'
import studentRoutes from './routes/student.js'
import registrarRoutes from './routes/registrar.js'
import cashierRoutes from './routes/cashier.js'
import departmentRoutes from './routes/department.js'
import adminRoutes from './routes/admin.js'
import queueRoutes from './routes/queue.js'
import teacherRoutes from './routes/teacher.js'
import { messagesRouter, streamRouter } from './routes/messages.js'

if ((await seedIfEmpty())) console.log('Database was empty — loaded demo data.')

const app = express()
app.disable('x-powered-by')
// Behind a host/proxy (Render, Railway, Nginx...) set TRUST_PROXY=1 so req.ip is the real visitor, not the proxy.
if (process.env.TRUST_PROXY) app.set('trust proxy', /^d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY)

// ---- security hardening --------------------------------------------------------------------------
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Permitted-Cross-Domain-Policies': 'none',
  })
  // tell browsers to use HTTPS only (sent only when the request really came over HTTPS)
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') res.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
  if (req.path.startsWith('/api')) res.set('Cache-Control', 'no-store') // never cache personal data
  next()
})

// general rate limit per IP (the login route has its own, stricter limits)
const hits = new Map()
const WINDOW_MS = 60_000
const MAX_REQUESTS = Number(process.env.RATE_LIMIT) || 600 // requests per minute per IP
setInterval(() => hits.clear(), WINDOW_MS).unref()
app.use('/api', (req, res, next) => {
  const n = (hits.get(req.ip) ?? 0) + 1
  hits.set(req.ip, n)
  if (n > MAX_REQUESTS) return res.status(429).json({ error: 'Too many requests. Please slow down.' })
  next()
})

const UPLOAD_TYPES = ['application/pdf', 'image/png', 'image/jpeg']
// state-changing API calls must be JSON (the file upload route also takes PDF/PNG/JPEG bytes) (blocks cross-site form posts)
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.headers['content-length'] > 0 && !req.is(['json', ...UPLOAD_TYPES])) return res.status(415).json({ error: 'Send JSON.' })
  next()
})

app.use('/api/student/documents/requests/:id/files', express.raw({ type: UPLOAD_TYPES, limit: '2mb' }))
app.use(express.json({ limit: '100kb' }))

app.use('/api/auth', authRoutes)
app.use('/api/student', studentRoutes)
app.use('/api/registrar', registrarRoutes)
app.use('/api/cashier', cashierRoutes)
app.use('/api/department', departmentRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/queue', queueRoutes)
if (FEATURES.lms) {
  app.use('/api/teacher', teacherRoutes)
  app.use('/api/stream', streamRouter)
  app.use('/api', messagesRouter)
}
app.use('/api', commonRoutes)

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }))

// Serve the built React app when it exists (npm run build && npm start)
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
if (existsSync(dist)) {
  app.use((_req, res, next) => {
    res.set(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
    )
    next()
  })
  app.use(express.static(dist))
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(join(dist, 'index.html')))
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.status) return res.status(err.status).json({ error: err.message })
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request body.' })
  // PostgreSQL error classes: bad input for a column type → 400, duplicate / referenced rows → 409
  if (['22P02', '22003', '22001', '22007', '22008', '23514', '23502'].includes(err.code)) return res.status(400).json({ error: 'That value is not valid.' })
  if (['23505', '23503'].includes(err.code)) return res.status(409).json({ error: 'That conflicts with an existing record.' })
  console.error(err)
  res.status(500).json({ error: 'Something went wrong on the server.' })
})

// forget expired sign-ins now and every hour
const purgeSessions = () => db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString()).catch(() => {})
await purgeSessions()
setInterval(purgeSessions, 3600_000).unref()

// the demo data ships with well-known passwords: say so loudly if this looks like a live server
if (process.env.NODE_ENV === 'production') {
  const demo = await db.prepare("SELECT COUNT(*) AS n FROM users WHERE login_id IN ('ADM-0001','CSH-0001','REG-0001','26001001')").get().catch(() => null)
  if (demo && Number(demo.n) > 0) console.warn('SECURITY WARNING: demo accounts (ADM-0001, CSH-0001, ...) exist with public passwords. Change or disable them before real use.')
}

const port = Number(process.env.API_PORT || process.env.PORT) || 3001
const server = app.listen(port, () => console.log(`NU-SSIS API listening on http://localhost:${port}`))

// close the database cleanly when the host stops the app (deploys, restarts)
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close()
    closeDb()
      .catch(() => {})
      .finally(() => process.exit(0))
  })
}
