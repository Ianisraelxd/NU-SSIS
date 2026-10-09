import express from 'express'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import './db.js'
import { seedIfEmpty } from './seed.js'
import authRoutes from './routes/auth.js'
import commonRoutes from './routes/common.js'
import studentRoutes from './routes/student.js'
import registrarRoutes from './routes/registrar.js'

if (seedIfEmpty()) console.log('Database was empty — loaded demo data.')

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '100kb' }))

app.use('/api/auth', authRoutes)
app.use('/api/student', studentRoutes)
app.use('/api/registrar', registrarRoutes)
app.use('/api', commonRoutes)

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }))

// Serve the built React app when it exists (npm run build && npm start)
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
if (existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(join(dist, 'index.html')))
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.status) return res.status(err.status).json({ error: err.message })
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request body.' })
  console.error(err)
  res.status(500).json({ error: 'Something went wrong on the server.' })
})

const port = Number(process.env.API_PORT) || 3001
app.listen(port, () => console.log(`NU-SSIS API listening on http://localhost:${port}`))
