// Runs the whole test-suite through the real `pg` driver — the same code path used with Neon — without needing a
// PostgreSQL server: an embedded PostgreSQL (PGlite) is exposed on a local TCP port using the PostgreSQL wire protocol.
//
//   npm run test:postgres
//
// This checks the driver path (connection string, pool, transactions, number parsing). The embedded server handles one
// connection at a time, so overlapping-request behaviour (queue and receipt numbers) is only really exercised when the
// suite runs against a real PostgreSQL: point TEST_DATABASE_URL at an EMPTY database (the tests load demo data into it) and run
//   npm test
import { spawn } from 'node:child_process'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'

const db = await PGlite.create()
const server = new PGLiteSocketServer({ db, port: 0, host: '127.0.0.1', maxConnections: 1 })
await server.start()
const [host, port] = server.getServerConn().split(':')
const url = `postgres://postgres:postgres@${host}:${port}/postgres?sslmode=disable`
console.log(`Embedded PostgreSQL listening on ${host}:${port} — running tests through the pg driver`)

const child = spawn(process.execPath, ['--test', 'tests/'], {
  stdio: 'inherit',
  env: { ...process.env, TEST_DATABASE_URL: url, DB_POOL_MAX: '1' },
})
child.on('exit', async (code) => {
  await server.stop()
  await db.close()
  process.exit(code ?? 1)
})
