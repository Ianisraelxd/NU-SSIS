// Copies the data of an old SQLite database (the file used before the PostgreSQL version) into PostgreSQL.
//
//   node --env-file-if-exists=.env scripts/migrate-sqlite-to-postgres.mjs [path/to/old.db]
//
//   • The target is DATABASE_URL (Neon / any PostgreSQL) — or, when it is not set, the embedded database.
//   • The target must be EMPTY (no users). The tables are created first if they do not exist yet.
//   • Everything is copied in one transaction: either all of it arrives or nothing does.
//   • Ids and password hashes are kept, so existing accounts, receipts and request numbers stay valid.
//   • The old file is only read, never changed.
import { DatabaseSync } from 'node:sqlite'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) ?? join(root, 'server', 'data', 'nu-ssis.db'))
if (!existsSync(source)) {
  console.error(`Old database not found: ${source}\nPass the path to the .db file as the first argument.`)
  process.exit(1)
}

const old = new DatabaseSync(source, { readOnly: true })
const version = old.prepare('PRAGMA user_version').get().user_version
if (version !== 3) {
  console.error(`The SQLite file has schema version ${version}; only version 3 (the last SQLite release) can be migrated.\nOpen it once with the previous version of the app to upgrade it, or start fresh with npm run db:reset.`)
  process.exit(1)
}

const { db, transaction, closeDb, engine } = await import('../server/db.js')

// parents before children, so foreign keys are satisfied while copying
const ORDER = [
  'departments', 'programs', 'users', 'sessions', 'settings', 'terms', 'students', 'year_progress', 'subjects', 'meetings',
  'student_subjects', 'enrollment_requests', 'enrollment_items', 'academic_requirements', 'activities', 'tasks', 'task_messages',
  'thread_reads', 'announcements', 'clearances', 'fees', 'payments', 'doc_types', 'doc_requests', 'request_history',
  'queue_tickets', 'audit_log', 'login_attempts', 'notifications',
]
const IDENTITY = new Set(ORDER.filter((t) => !['sessions', 'settings', 'year_progress', 'student_subjects', 'enrollment_items', 'thread_reads', 'students'].includes(t)))

const existing = (await db.prepare('SELECT COUNT(*) AS c FROM users').get()).c
if (existing > 0) {
  console.error(`The target database already has ${existing} users. Migrate into an empty database (npm run db:reset -- --yes wipes it).`)
  await closeDb()
  process.exit(1)
}

console.log(`Copying ${source}\n   → ${engine === 'postgres' ? new URL(process.env.DATABASE_URL).host : 'the embedded database'}`)
const summary = []
await transaction(async () => {
  for (const table of ORDER) {
    const present = old.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)
    if (!present) {
      summary.push([table, 0, 0, 'not in the old file'])
      continue
    }
    const columns = old.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name)
    const rows = old.prepare(`SELECT ${columns.join(', ')} FROM ${table}`).all()
    const chunk = Math.max(1, Math.floor(30000 / columns.length))
    for (let i = 0; i < rows.length; i += chunk) {
      const part = rows.slice(i, i + chunk)
      const placeholders = part.map(() => `(${columns.map(() => '?').join(',')})`).join(',')
      await db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`).run(...part.flatMap((r) => columns.map((c) => (typeof r[c] === 'bigint' ? Number(r[c]) : r[c]))))
    }
    // identity columns: continue numbering after the highest copied id
    if (IDENTITY.has(table) && rows.length) {
      await db.prepare(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), (SELECT MAX(id) FROM ${table}))`).get()
    }
    const copied = (await db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get()).c
    summary.push([table, rows.length, copied, rows.length === copied ? 'ok' : 'COUNT MISMATCH'])
  }
})

console.log('\ntable                    old    new')
for (const [t, a, b, note] of summary) console.log(`${t.padEnd(24)} ${String(a).padStart(4)}   ${String(b).padStart(4)}   ${note}`)
const bad = summary.filter((s) => s[3] === 'COUNT MISMATCH')
console.log(bad.length ? '\nSome counts differ — nothing should be trusted until this is understood.' : '\nDone. Sign in with your existing accounts.')
await closeDb()
old.close()
process.exit(bad.length ? 1 : 0)
