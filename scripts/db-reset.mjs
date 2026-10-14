// Wipes the database and loads the demo data.
//
//   npm run db:reset                       embedded database (no DATABASE_URL): deletes server/data/pglite
//   npm run db:reset -- --yes              with DATABASE_URL set (Neon / any PostgreSQL): drops EVERY table in the
//                                          public schema first. Real data is lost, so --yes is required.
import { rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const confirmed = process.argv.includes('--yes')

if (process.env.DATABASE_URL) {
  const host = new URL(process.env.DATABASE_URL).host
  if (!confirmed) {
    console.error(`DATABASE_URL points at ${host}.\nThis DROPS every table in that database and loads demo data.\nRun again with --yes if that is what you want:  npm run db:reset -- --yes`)
    process.exit(1)
  }
  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: /neon\.tech/.test(host) && !/sslmode=/.test(process.env.DATABASE_URL) ? true : undefined })
  await client.connect()
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
  await client.end()
  console.log(`Dropped all tables on ${host}.`)
} else {
  rmSync(process.env.DB_DIR || join(root, 'server', 'data', 'pglite'), { recursive: true, force: true })
  console.log('Deleted the embedded database.')
}

// importing the server modules creates the tables; seedIfEmpty() then loads the demo data
const { closeDb } = await import('../server/db.js')
const { seedIfEmpty } = await import('../server/seed.js')
console.log((await seedIfEmpty()) ? 'Demo data loaded.' : 'The database already had data.')
await closeDb()
