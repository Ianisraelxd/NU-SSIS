import { Router } from 'express'
import { db } from '../db.js'
import { HttpError, currentTerm, hashPassword, termLabel, verifyPassword } from '../util.js'
import { publicUser, requireAuth } from './auth.js'

const router = Router()
router.use(requireAuth())

router.get('/term', (_req, res) => {
  const term = currentTerm()
  res.json({ ...term, label: termLabel(term) })
})

// ---- announcements ---------------------------------------------------------
router.get('/announcements', (_req, res) => {
  res.json(
    db
      .prepare(
        `SELECT a.id, a.title, a.body, a.created_at AS createdAt, u.name AS author
         FROM announcements a LEFT JOIN users u ON u.id = a.author_id
         ORDER BY a.created_at DESC`,
      )
      .all(),
  )
})

// ---- notifications ---------------------------------------------------------
router.get('/notifications', (req, res) => {
  const items = db
    .prepare(
      `SELECT id, message, link, is_read AS isRead, created_at AS createdAt
       FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 30`,
    )
    .all(req.user.id)
  const unread = db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id=? AND is_read=0').get(req.user.id).c
  res.json({ items: items.map((i) => ({ ...i, isRead: !!i.isRead })), unread })
})

router.post('/notifications/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(req.user.id)
  res.json({ ok: true })
})

router.post('/notifications/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?').run(req.params.id, req.user.id)
  res.json({ ok: true })
})

// ---- settings ----------------------------------------------------------------
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

router.put('/settings/profile', (req, res) => {
  const name = String(req.body?.name ?? '').trim()
  const email = String(req.body?.email ?? '').trim()
  const phone = String(req.body?.phone ?? '').trim()
  if (name.length < 2) throw new HttpError(400, 'Enter your full name.')
  if (email && !EMAIL.test(email)) throw new HttpError(400, 'Enter a valid email address.')
  if (phone && !/^[0-9+()\-\s]{7,20}$/.test(phone)) throw new HttpError(400, 'Enter a valid phone number.')
  db.prepare('UPDATE users SET name=?, email=?, phone=? WHERE id=?').run(name, email || null, phone || null, req.user.id)
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)) })
})

router.put('/settings/preferences', (req, res) => {
  const { theme, notifyInapp, notifyEmail } = req.body ?? {}
  if (!['light', 'dark'].includes(theme)) throw new HttpError(400, 'Invalid theme.')
  db.prepare('UPDATE users SET theme=?, notify_inapp=?, notify_email=? WHERE id=?').run(
    theme,
    notifyInapp ? 1 : 0,
    notifyEmail ? 1 : 0,
    req.user.id,
  )
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)) })
})

router.post('/settings/password', (req, res) => {
  const { current, next } = req.body ?? {}
  if (!current || !next) throw new HttpError(400, 'Fill in all password fields.')
  if (!verifyPassword(String(current), req.user.password_hash)) throw new HttpError(400, 'Current password is incorrect.')
  if (String(next).length < 8) throw new HttpError(400, 'New password must be at least 8 characters.')
  if (next === current) throw new HttpError(400, 'New password must be different from the current one.')
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPassword(String(next)), req.user.id)
  // sign out every other device
  db.prepare('DELETE FROM sessions WHERE user_id=? AND token<>?').run(req.user.id, req.token)
  res.json({ ok: true })
})

export default router
