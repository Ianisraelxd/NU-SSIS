// PostgreSQL access for the whole app.
//
//   DATABASE_URL set  → a real PostgreSQL server, e.g. Neon (pooled connections through the `pg` driver)
//   DATABASE_URL unset → an embedded PostgreSQL (PGlite) stored in server/data/pglite, so `npm run dev`
//                        and the test-suite need nothing installed. It runs the same SQL dialect.
//
// The rest of the code uses one small API, always asynchronous:
//   await db.prepare('SELECT … WHERE id = ?').get(id)     → first row or undefined
//   await db.prepare('SELECT …').all(a, b)                 → array of rows
//   await db.prepare('UPDATE …').run(a)                    → { changes }
//   await transaction(async () => { … })                   → BEGIN / COMMIT (ROLLBACK when it throws)
// `?` placeholders are rewritten to $1, $2 …, LIKE becomes ILIKE (SQLite's LIKE was case-insensitive) and
// camelCase column aliases (… AS createdAt) keep their case, which PostgreSQL would otherwise fold to lower case.
import { AsyncLocalStorage } from 'node:async_hooks'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { PGlite, types as pgliteTypes } from '@electric-sql/pglite'
import { SCHEMA, SCHEMA_VERSION } from './schema.js'

const here = dirname(fileURLToPath(import.meta.url))
// pg already treats sslmode=require/prefer/verify-ca as verify-full; say so, which also silences its warning
const url = process.env.DATABASE_URL?.replace(/sslmode=(require|prefer|verify-ca)/, 'sslmode=verify-full')
export const engine = url ? 'postgres' : 'pglite'

// bigint (COUNT, SUM of integers) and numeric (AVG) arrive as strings by default; the app expects numbers
// LOG_QUERIES=1 prints every statement — handy for spotting pages that make too many round trips
const LOG_QUERIES = !!process.env.LOG_QUERIES
// DB_LATENCY_MS=40 adds a delay to every statement, to see how pages feel against a remote database such as Neon
const LATENCY_MS = Number(process.env.DB_LATENCY_MS) || 0
const asInt = (v) => parseInt(v, 10)
const asFloat = (v) => parseFloat(v)

let backend
if (url) {
  pg.types.setTypeParser(20, asInt)
  pg.types.setTypeParser(1700, asFloat)
  const pool = new pg.Pool({
    connectionString: url,
    max: Number(process.env.DB_POOL_MAX) || 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    // Neon requires TLS; a URL with sslmode=… is honoured as written
    ssl: /neon\.tech/.test(url) && !/sslmode=/.test(url) ? true : undefined,
  })
  pool.on('error', (err) => console.error('Idle database connection dropped:', err.message))
  backend = {
    query: (text, params) => pool.query(text, params),
    exec: (text) => pool.query(text),
    async transaction(fn) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const result = await fn({ query: (t, p) => client.query(t, p), exec: (t) => client.query(t) })
        await client.query('COMMIT')
        return result
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        throw err
      } finally {
        client.release()
      }
    },
    close: () => pool.end(),
  }
} else {
  const dir = process.env.DB_DIR || join(here, 'data', 'pglite')
  if (!dir.startsWith('memory://')) mkdirSync(dirname(dir), { recursive: true })
  const lite = new PGlite(dir, { parsers: { [pgliteTypes.INT8]: asInt, [pgliteTypes.NUMERIC]: asFloat } })
  await lite.waitReady
  const wrap = (c) => ({ query: (t, p) => c.query(t, p), exec: (t) => c.exec(t) })
  backend = {
    query: (text, params) => lite.query(text, params),
    exec: (text) => lite.exec(text),
    transaction: (fn) => lite.transaction((tx) => fn(wrap(tx))),
    close: () => lite.close(),
  }
}

// ---- SQL rewriting ----------------------------------------------------------------------------------
const cache = new Map()
function rewrite(sql) {
  let entry = cache.get(sql)
  if (entry) return entry
  let n = 0
  let out = ''
  let inString = false
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]
    if (ch === "'") {
      if (inString && sql[i + 1] === "'") {
        out += "''"
        i++
        continue
      }
      inString = !inString
    }
    out += !inString && ch === '?' ? `$${++n}` : ch
  }
  out = out.replace(/\bLIKE\b/g, 'ILIKE')
  const aliases = {}
  for (const m of sql.matchAll(/\bAS\s+([A-Za-z_][A-Za-z0-9_]*)/gi)) if (/[A-Z]/.test(m[1])) aliases[m[1].toLowerCase()] = m[1]
  entry = { text: out, aliases: Object.keys(aliases).length ? Object.entries(aliases) : null }
  cache.set(sql, entry)
  return entry
}

const als = new AsyncLocalStorage() // inside transaction(), every query goes through that transaction's connection

async function query(sql, params = []) {
  const { text, aliases } = rewrite(sql)
  if (LATENCY_MS) await new Promise((resolve) => setTimeout(resolve, LATENCY_MS))
  if (LOG_QUERIES) console.log('[sql]', text.replace(/\s+/g, ' ').slice(0, 110))
  const target = als.getStore() ?? backend
  const values = params.map((v) => (v === undefined ? null : v))
  let res
  try {
    res = await target.query(text, values)
  } catch (err) {
    err.sql = text
    throw err
  }
  let rows = res.rows
  if (aliases) {
    rows = rows.map((row) => {
      for (const [lower, original] of aliases) {
        if (lower !== original && lower in row) {
          row[original] = row[lower]
          delete row[lower]
        }
      }
      return row
    })
  }
  return { rows, changes: res.rowCount ?? res.affectedRows ?? 0 }
}

export const db = {
  prepare: (sql) => ({
    get: async (...params) => (await query(sql, params)).rows[0],
    all: async (...params) => (await query(sql, params)).rows,
    run: async (...params) => ({ changes: (await query(sql, params)).changes }),
  }),
  exec: (sql) => (als.getStore() ?? backend).exec(sql),
}

export async function transaction(fn) {
  if (als.getStore()) return fn() // already inside one: join it
  return backend.transaction((client) => als.run(client, fn))
}

// Serialises "read the highest number, add one" style counters (queue numbers, receipt numbers) across
// concurrent connections. Call inside transaction(); the lock is released when the transaction ends.
export const lock = (name) => query('SELECT pg_advisory_xact_lock(hashtext(?))', [name])

export const inTransaction = () => !!als.getStore()
export const closeDb = () => backend.close()

// ---- schema -----------------------------------------------------------------------------------------
// The first start creates the tables. A database from a different schema version is NEVER dropped
// automatically (it may be a hosted database holding real data): the app stops with instructions instead.
async function ensureSchema(t) {
  await t.exec('CREATE TABLE IF NOT EXISTS schema_meta (id INTEGER PRIMARY KEY CHECK (id = 1), version INTEGER NOT NULL)')
  const hasUsers = (await t.query("SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'")).rows.length > 0
  const row = (await t.query('SELECT version FROM schema_meta WHERE id = 1')).rows[0]
  if (hasUsers && row?.version !== SCHEMA_VERSION) {
    throw new Error(
      `The database has schema version ${row?.version ?? 'unknown'} but this app needs version ${SCHEMA_VERSION}.\n` +
        'Nothing was changed. To start over with demo data run:  npm run db:reset -- --yes   (this ERASES all data).\n' +
        'To move data from the old SQLite file instead, see scripts/migrate-sqlite-to-postgres.mjs.',
    )
  }
  await t.exec(SCHEMA)
  await t.query('INSERT INTO schema_meta (id, version) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version', [SCHEMA_VERSION])
}

if (engine === 'postgres') {
  // several app instances may start together: only one creates the tables at a time
  await backend.transaction(async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock(727274)')
    await ensureSchema(tx)
  })
} else {
  await ensureSchema(backend)
}
