import { Router } from 'express'
import { db } from '../db.js'
import { HttpError, audit, currentTerm, getSetting, hashPassword, termLabel, verifyPassword } from '../util.js'
import { publicUser, requireAuth } from './auth.js'

const router = Router()
router.use(requireAuth())

router.get('/term', async (_req, res) => {
  const term = await currentTerm()
  res.json({ ...term, label: termLabel(term) })
})

// departments and programs (used by forms in several modules)
router.get('/meta', async (_req, res) => {
  res.json({
    schoolName: (await getSetting('schoolName')),
    departments: (await db.prepare('SELECT id, code, name FROM departments ORDER BY code').all()),
    programs: (await db.prepare('SELECT id, code, name, department_id AS departmentId FROM programs ORDER BY code').all()),
  })
})

// ---- announcements ---------------------------------------------------------
router.get('/announcements', async (_req, res) => {
  res.json(
    (await db
      .prepare(
        `SELECT a.id, a.title, a.body, a.created_at AS createdAt, u.name AS author
         FROM announcements a LEFT JOIN users u ON u.id = a.author_id
         ORDER BY a.created_at DESC, a.id`,
      )
      .all()),
  )
})

// ---- notifications ---------------------------------------------------------
router.get('/notifications', async (req, res) => {
  const items = await db
    .prepare(
      `SELECT id, message, link, is_read AS isRead, created_at AS createdAt
       FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 30`,
    )
    .all(req.user.id)
  const unread = (await db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id=? AND is_read=0').get(req.user.id)).c
  res.json({ items: items.map((i) => ({ ...i, isRead: !!i.isRead })), unread })
})

router.post('/notifications/read-all', async (req, res) => {
  await db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(req.user.id)
  res.json({ ok: true })
})

router.post('/notifications/:id/read', async (req, res) => {
  await db.prepare('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?').run(req.params.id, req.user.id)
  res.json({ ok: true })
})

// ---- settings ----------------------------------------------------------------
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

router.put('/settings/profile', async (req, res) => {
  const name = String(req.body?.name ?? '').trim()
  const email = String(req.body?.email ?? '').trim()
  const phone = String(req.body?.phone ?? '').trim()
  if (name.length < 2) throw new HttpError(400, 'Enter your full name.')
  if (email && !EMAIL.test(email)) throw new HttpError(400, 'Enter a valid email address.')
  if (phone && !/^[0-9+()\-\s]{7,20}$/.test(phone)) throw new HttpError(400, 'Enter a valid phone number.')
  await db.prepare('UPDATE users SET name=?, email=?, phone=? WHERE id=?').run(name, email || null, phone || null, req.user.id)
  res.json({ user: (await publicUser((await db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)))) })
})

router.put('/settings/preferences', async (req, res) => {
  const { theme, notifyInapp, notifyEmail } = req.body ?? {}
  if (!['light', 'dark'].includes(theme)) throw new HttpError(400, 'Invalid theme.')
  await db.prepare('UPDATE users SET theme=?, notify_inapp=?, notify_email=? WHERE id=?').run(
    theme,
    notifyInapp ? 1 : 0,
    notifyEmail ? 1 : 0,
    req.user.id,
  )
  res.json({ user: (await publicUser((await db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)))) })
})

router.post('/settings/password', async (req, res) => {
  const { current, next } = req.body ?? {}
  if (!current || !next) throw new HttpError(400, 'Fill in all password fields.')
  if (typeof current !== 'string' || typeof next !== 'string') throw new HttpError(400, 'Passwords must be text.')
  if (!verifyPassword(String(current), req.user.password_hash)) throw new HttpError(400, 'Current password is incorrect.')
  if (String(next).length < 8) throw new HttpError(400, 'New password must be at least 8 characters.')
  if (next === current) throw new HttpError(400, 'New password must be different from the current one.')
  await db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPassword(String(next)), req.user.id)
  await audit(req.user, 'password.change', 'user', req.user.login_id)
  // sign out every other device
  await db.prepare('DELETE FROM sessions WHERE user_id=? AND token<>?').run(req.user.id, req.token)
  res.json({ ok: true })
})

export default router
