import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { db } from '../db.js'
import { FEATURES } from '../config.js'
import { DUMMY_HASH, HttpError, audit, hashPassword, hashToken, verifyPassword } from '../util.js'

const SESSION_SECONDS = Number(process.env.SESSION_TTL_SECONDS) || 7 * 86400 // sign-ins last 7 days (tests shorten this)
const MAX_SESSIONS = 10 // oldest sessions are dropped beyond this many devices
const MAX_FAILED_LOGINS = 5 // then the account locks
const LOCK_MINUTES = 15

const publicUser = async (u) => ({
  id: u.id,
  role: u.role,
  loginId: u.login_id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  departmentId: u.department_id,
  department: u.department_id ? (await db.prepare('SELECT code, name FROM departments WHERE id = ?').get(u.department_id)) ?? null : null,
  theme: u.theme,
  notifyInapp: !!u.notify_inapp,
  notifyEmail: !!u.notify_email,
})
export { publicUser }

// requireAuth()                → any signed-in user
// requireAuth('registrar')     → that role only        requireAuth(['cashier','admin']) → any of these
export function requireAuth(role) {
  const roles = role == null ? null : [].concat(role)
  return async (req, _res, next) => {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (!token) throw new HttpError(401, 'Please sign in.')
    const row = await db
      .prepare(
        `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token = ? AND s.expires_at > ?`,
      )
      .get(hashToken(token), new Date().toISOString())
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
const FAIL_LIMIT = Number(process.env.LOGIN_FAIL_LIMIT) || 10 // failed sign-ins per IP per minute
const failures = new Map()
const recentFailures = (ip) => (failures.get(ip) || []).filter((t) => Date.now() - t < 60_000)
function throttle(ip) {
  if (recentFailures(ip).length >= FAIL_LIMIT) throw new HttpError(429, 'Too many failed attempts. Try again in a minute.')
}
function recordFailure(ip) {
  failures.set(ip, [...recentFailures(ip), Date.now()])
}

// Every sign-in attempt (good or bad) is kept for the administrator. Passwords are never stored.
async function logAttempt(req, { loginId, role, userId = null, success, reason }) {
  await db.prepare(
    'INSERT INTO login_attempts (login_id, role, user_id, success, reason, ip, user_agent, created_at) VALUES (?,?,?,?,?,?,?,?)',
  ).run(String(loginId ?? '').slice(0, 40), role ? String(role).slice(0, 20) : null, userId, success ? 1 : 0, reason, req.ip ?? null, String(req.headers['user-agent'] ?? '').slice(0, 200), new Date().toISOString())
}

// Unknown IDs get the same "attempts left" countdown as real ones (kept in memory), so the message
// cannot be used to find out which accounts exist.
const phantom = new Map()
function phantomLeft(key) {
  const now = Date.now()
  const entry = phantom.get(key)
  const count = entry && now - entry.at < LOCK_MINUTES * 60000 ? entry.count + 1 : 1
  phantom.set(key, { count, at: now })
  if (phantom.size > 5000) phantom.delete(phantom.keys().next().value)
  return Math.max(0, MAX_FAILED_LOGINS - count)
}

const router = Router()

router.post('/login', async (req, res) => {
  throttle(req.ip)
  const { role, loginId, password } = req.body ?? {}
  if (!loginId || !password) throw new HttpError(400, 'Enter your ID and password.')
  if (role === 'teacher' && !FEATURES.lms) throw new HttpError(401, 'Incorrect ID or password.')
  const id = String(loginId).trim().slice(0, 40)
  const user = await db.prepare('SELECT * FROM users WHERE login_id = ? AND role = ?').get(id, role)

  // brute-force protection: an account locks for a while after repeated failures
  if (user?.locked_until && user.locked_until > new Date().toISOString()) {
    const minutes = Math.max(1, Math.ceil((new Date(user.locked_until) - Date.now()) / 60000))
    await logAttempt(req, { loginId: id, role, userId: user.id, success: false, reason: 'account locked' })
    throw new HttpError(423, `Too many failed attempts. This account is locked for another ${minutes} minute${minutes === 1 ? '' : 's'}.`)
  }

  if (typeof password !== 'string' || typeof loginId !== 'string') throw new HttpError(400, 'Enter your ID and password.')
  const passwordOk = verifyPassword(password, user ? user.password_hash : DUMMY_HASH)
  if (!user || !passwordOk) {
    let attemptsLeft = null
    if (!user) attemptsLeft = phantomLeft(`${role}:${id}`)
    if (user) {
      const failed = user.failed_logins + 1
      if (failed >= MAX_FAILED_LOGINS) {
        await db.prepare('UPDATE users SET failed_logins = 0, locked_until = ? WHERE id = ?').run(
          new Date(Date.now() + LOCK_MINUTES * 60000).toISOString(),
          user.id,
        )
        await audit(null, 'login.locked', 'user', user.login_id, `Locked for ${LOCK_MINUTES} minutes after ${MAX_FAILED_LOGINS} failed attempts`)
      } else {
        await db.prepare('UPDATE users SET failed_logins = ? WHERE id = ?').run(failed, user.id)
        attemptsLeft = MAX_FAILED_LOGINS - failed
      }
    }
    recordFailure(req.ip)
    await logAttempt(req, { loginId: id, role, userId: user?.id, success: false, reason: !user ? 'unknown account' : attemptsLeft === null ? 'wrong password — account locked' : 'wrong password' })
    await audit(null, 'login.failed', 'user', id, `Failed sign-in as ${role}`)
    const hint = attemptsLeft === null || attemptsLeft === 0 ? ` This account is now locked for ${LOCK_MINUTES} minutes.` : ` ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left before the account locks.`
    throw new HttpError(401, `Incorrect ID or password.${hint}`)
  }
  if (!user.active) {
    await logAttempt(req, { loginId: id, role, userId: user.id, success: false, reason: 'account disabled' })
    throw new HttpError(403, 'This account has been disabled. Contact the administrator.')
  }

  await db.prepare('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?').run(user.id)
  const token = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString()
  await db.prepare('DELETE FROM sessions WHERE user_id = ? AND (expires_at <= ? OR token NOT IN (SELECT token FROM sessions WHERE user_id = ? ORDER BY expires_at DESC LIMIT ?))').run(user.id, new Date().toISOString(), user.id, MAX_SESSIONS - 1)
  await db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)').run(hashToken(token), user.id, expires)
  await logAttempt(req, { loginId: id, role, userId: user.id, success: true, reason: 'signed in' })
  await audit(user, 'login', 'user', user.login_id)
  res.json({ token, user: (await publicUser(user)) })
})

router.get('/me', requireAuth(), async (req, res) => res.json({ user: (await publicUser(req.user)) }))

router.post('/logout', requireAuth(), async (req, res) => {
  await db.prepare('DELETE FROM sessions WHERE token = ?').run(hashToken(req.token))
  res.json({ ok: true })
})

export { hashPassword }
export default router
