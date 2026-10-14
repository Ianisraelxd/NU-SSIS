// Simple load test: 400 requests per endpoint, 20 at a time.
// Start a throw-away server first so the per-IP rate limit does not interfere:
//   RATE_LIMIT=1000000 API_PORT=3098 DB_DIR=perf-db node server/index.js
//   node scripts/perf.mjs
const BASE = process.env.BASE ?? 'http://localhost:3098/api'
const login = async (role, loginId, password) => (await (await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role, loginId, password }) })).json()).token

const student = await login('student', '26001001', 'password123')
const registrar = await login('registrar', 'REG-0001', 'registrar123')
const admin = await login('admin', 'ADM-0001', 'admin123')

const targets = [
  ['GET /student/home', '/student/home', student],
  ['GET /student/documents', '/student/documents', student],
  ['GET /queue/offices', '/queue/offices', student],
  ['GET /registrar/requests', '/registrar/requests?status=open', registrar],
  ['GET /registrar/students', '/registrar/students', registrar],
  ['GET /admin/reports?type=system', '/admin/reports?type=system', admin],
  ['GET /admin/reports?type=enrollment', '/admin/reports?type=enrollment', admin],
]

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
const rows = []
for (const [label, path, token] of targets) {
  const times = []
  const total = 400
  const concurrency = 20
  let issued = 0
  let failed = 0
  const t0 = performance.now()
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (issued < total) {
        issued++
        const s = performance.now()
        const res = await fetch(BASE + path, { headers: { authorization: `Bearer ${token}` } })
        await res.arrayBuffer()
        if (!res.ok) failed++
        times.push(performance.now() - s)
      }
    }),
  )
  const wall = (performance.now() - t0) / 1000
  times.sort((a, b) => a - b)
  rows.push({ endpoint: label, requests: total, failed, 'req/s': Math.round(total / wall), 'p50 ms': +pct(times, 0.5).toFixed(1), 'p95 ms': +pct(times, 0.95).toFixed(1), 'max ms': +times.at(-1).toFixed(1) })
}
console.table(rows)
console.log(JSON.stringify(rows))
