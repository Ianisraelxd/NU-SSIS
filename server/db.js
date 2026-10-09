import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SCHEMA } from './schema.js'

const here = dirname(fileURLToPath(import.meta.url))
const file = process.env.DB_FILE || join(here, 'data', 'nu-ssis.db')
mkdirSync(dirname(file), { recursive: true })

export let db = new DatabaseSync(file)

// An older database (before activities / chat) can't be upgraded in place: keep it as a backup and start fresh.
const hasTable = (name) => db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name)
if (hasTable('users') && !hasTable('activities')) {
  db.close()
  const backup = file.replace(/\.db$/, `.backup-${Date.now()}.db`)
  renameSync(file, backup)
  console.log(`Old database format found — saved a copy as ${backup} and created a fresh one.`)
  db = new DatabaseSync(file)
}
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
db.exec(SCHEMA)

export function transaction(fn) {
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
