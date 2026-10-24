// API fuzz: calls every route of every portal as every role with malformed input and checks that the server
// never answers 5xx and never returns something that is not JSON/CSV/text.
//   FUZZ_BASE=http://localhost:3001/api node scripts/api-fuzz.mjs      (start the server first: npm start)
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BASE = process.env.FUZZ_BASE || 'http://localhost:3001/api'
const ROOT = fileURLToPath(new URL('../server/routes/', import.meta.url))
const MOUNT = { student: '/student', registrar: '/registrar', cashier: '/cashier', department: '/department', admin: '/admin', queue: '/queue' }
const ACCT = { student: ['26001001', 'password123'], registrar: ['REG-0001', 'registrar123'], cashier: ['CSH-0001', 'cashier123'], department: ['DEP-0001', 'department123'], admin: ['ADM-0001', 'admin123'] }

const tokens = {}
for (const [role, [loginId, password]] of Object.entries(ACCT)) {
  const r = await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role, loginId, password }) })
  tokens[role] = (await r.json()).token
}

// collect routes from source
const routes = []
for (const f of readdirSync(ROOT)) {
  const src = readFileSync(ROOT + f, 'utf8')
  const prefix = MOUNT[f.replace('.js', '')] ?? ''
  for (const m of src.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']+)'/g)) routes.push({ method: m[1].toUpperCase(), path: prefix + m[2], file: f })
}
console.log('routes found:', routes.length)

const BODIES = [
  {},
  { amount: -5, status: 'Nope', name: '', copies: 'abc', grade: 1e9, id: "' OR 1=1 --" },
  { name: 'x'.repeat(50000), note: null, items: 'str', subjectIds: 'x', amount: 'NaN' },
  { subjectIds: [999999, -1, 'a'], items: [{}], reason: '<script>alert(1)</script>' },
]
const IDS = ['1', '999999', 'abc', '-1', "1'--"]
const bad = new Map()
let calls = 0
const note = (k, v) => !bad.has(k) && bad.set(k, v)

for (const r of routes) {
  if (/logout|login|stream/.test(r.path)) continue
  for (const [role, token] of Object.entries(tokens)) {
    for (const id of r.path.includes(':') ? IDS : ['']) {
      const url = BASE + r.path.replace(/:\w+/g, id || '1') + (r.method === 'GET' ? '?q=%27&limit=-1&offset=abc&period=zzz&type=zzz&status=zzz&term=zzz' : '')
      for (const body of r.method === 'GET' || r.method === 'DELETE' ? [undefined] : BODIES) {
        calls++
        try {
          const res = await fetch(url, { method: r.method, headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
          const text = await res.text()
          if (res.status >= 500 && res.status !== 503) note(`${res.status} ${r.method} ${r.path} as ${role}`, `id=${id} body=${JSON.stringify(body)?.slice(0, 80)} -> ${text.slice(0, 120)}`)
          else if (!(res.headers.get('content-type') || '').includes('json') && res.status !== 204 && !/csv|text/.test(res.headers.get('content-type') || '')) note(`non-json ${res.status} ${r.method} ${r.path} as ${role}`, text.slice(0, 80))
        } catch (e) {
          note(`fetch-fail ${r.method} ${r.path}`, String(e))
        }
      }
    }
  }
}
console.log('calls:', calls)
for (const [k, v] of bad) console.log(k, '\n    ', v)
console.log('problems:', bad.size)
if (bad.size) process.exitCode = 1
