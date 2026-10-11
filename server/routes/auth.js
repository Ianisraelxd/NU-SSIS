import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { db } from '../db.js'
import { FEATURES } from '../config.js'
import { HttpError, audit, hashPassword, verifyPassword } from '../util.js'

const SESSION_DAYS = 7
const MAX_FAILED_LOGINS = 5 // then the account locks
const LOCK_MINUTES = 15

const publicUser = (u) => ({
  id: u.id,
  role: u.role,
  loginId: u.login_id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  departmentId: u.department_id,
  department: u.department_id ? db.prepare('SELECT code, name FROM departments WHERE id = ?').get(u.department_id) ?? null : null,
  theme: u.theme,
  notifyInapp: !!u.notify_inapp,
  notifyEmail: !!u.notify_email,
})
export { publicUser }

// requireAuth()                → any signed-in user
// requireAuth('registrar')     → that role only        requireAuth(['cashier','admin']) → any of these
export function requireAuth(role) {
  const roles = role == null ? null : [].concat(role)
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
    if (!row.active) throw new HttpError(401, 'This account has been disabled. Contact the administrator.')
    if (roles && !roles.includes(row.role)) throw new HttpError(403, 'You do not have access to this page.')
    req.user = row
    req.token = token
    next()
  }
}

// Per-IP throttle for FAILED sign-ins (a second layer on top of the per-account lockout below).
// Successful sign-ins are not counted, so a computer lab sharing one IP is not locked out.
const failures = new Map()
const recentFailures = (ip) => (failures.get(ip) || []).filter((t) => Date.now() - t < 60_000)
function throttle(ip) {
  if (recentFailures(ip).length >= 10) throw new HttpError(429, 'Too many failed attempts. Try again in a minute.')
}
function recordFailure(ip) {
  failures.set(ip, [...recentFailures(ip), Date.now()])
}

const router = Router()

router.post('/login', (req, res) => {
  throttle(req.ip)
  const { role, loginId, password } = req.body ?? {}
  if (!loginId || !password) throw new HttpError(400, 'Enter your ID and password.')
  if (role === 'teacher' && !FEATURES.lms) throw new HttpError(401, 'Incorrect ID or password.')
  const id = String(loginId).trim().slice(0, 40)
  const user = db.prepare('SELECT * FROM users WHERE login_id = ? AND role = ?').get(id, role)

  // brute-force protection: an account locks for a while after repeated failures
  if (user?.locked_until && user.locked_until > new Date().toISOString()) {
    const minutes = Math.max(1, Math.ceil((new Date(user.locked_until) - Date.now()) / 60000))
    throw new HttpError(423, `Too many failed attempts. This account is locked for another ${minutes} minute${minutes === 1 ? '' : 's'}.`)
  }

  if (!user || !verifyPassword(String(password), user.password_hash)) {
    if (user) {
      const failed = user.failed_logins + 1
      if (failed >= MAX_FAILED_LOGINS) {
        db.prepare('UPDATE users SET failed_logins = 0, locked_until = ? WHERE id = ?').run(
          new Date(Date.now() + LOCK_MINUTES * 60000).toISOString(),
          user.id,
        )
        audit(null, 'login.locked', 'user', user.login_id, `Locked for ${LOCK_MINUTES} minutes after ${MAX_FAILED_LOGINS} failed attempts`)
      } else {
        db.prepare('UPDATE users SET failed_logins = ? WHERE id = ?').run(failed, user.id)
      }
    }
    recordFailure(req.ip)
    audit(null, 'login.failed', 'user', id, `Failed sign-in as ${role}`)
    throw new HttpError(401, 'Incorrect ID or password.')
  }
  if (!user.active) throw new HttpError(403, 'This account has been disabled. Contact the administrator.')

  db.prepare('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?').run(user.id)
  const token = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString()
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)').run(token, user.id, expires)
  audit(user, 'login', 'user', user.login_id)
  res.json({ token, user: publicUser(user) })
})

router.get('/me', requireAuth(), (req, res) => res.json({ user: publicUser(req.user) }))

router.post('/logout', requireAuth(), (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token)
  res.json({ ok: true })
})

export { hashPassword }
export default router
