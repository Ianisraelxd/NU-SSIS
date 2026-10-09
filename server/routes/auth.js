import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { db } from '../db.js'
import { FEATURES } from '../config.js'
import { HttpError, hashPassword, verifyPassword } from '../util.js'

const SESSION_DAYS = 7
const publicUser = (u) => ({
  id: u.id,
  role: u.role,
  loginId: u.login_id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  theme: u.theme,
  notifyInapp: !!u.notify_inapp,
  notifyEmail: !!u.notify_email,
})
export { publicUser }

export function requireAuth(role) {
  return (req, _res, next) => {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (!token) throw new HttpError(401, 'Please sign in.')
    const row = db
      .prepare(
        `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token = ? AND s.expires_at > ?`,
      )
      .get(token, new Date().toISOString())
    if (!row) throw new HttpError(401, 'Your session has expired. Please sign in again.')
    if (role && row.role !== role) throw new HttpError(403, 'You do not have access to this page.')
    req.user = row
    req.token = token
    next()
  }
}

// naive per-IP throttle for login attempts
const attempts = new Map()
function throttle(ip) {
  const now = Date.now()
  const recent = (attempts.get(ip) || []).filter((t) => now - t < 60_000)
  if (recent.length >= 10) throw new HttpError(429, 'Too many attempts. Try again in a minute.')
  recent.push(now)
  attempts.set(ip, recent)
}

const router = Router()

router.post('/login', (req, res) => {
  throttle(req.ip)
  const { role, loginId, password } = req.body ?? {}
  if (!loginId || !password) throw new HttpError(400, 'Enter your ID and password.')
  if (role === 'teacher' && !FEATURES.lms) throw new HttpError(401, 'Incorrect ID or password.')
  const user = db.prepare('SELECT * FROM users WHERE login_id = ? AND role = ?').get(String(loginId).trim(), role)
  if (!user || !verifyPassword(String(password), user.password_hash)) throw new HttpError(401, 'Incorrect ID or password.')
  const token = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString()
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)').run(token, user.id, expires)
  res.json({ token, user: publicUser(user) })
})

router.get('/me', requireAuth(), (req, res) => res.json({ user: publicUser(req.user) }))

router.post('/logout', requireAuth(), (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token)
  res.json({ ok: true })
})

export { hashPassword }
export default router
