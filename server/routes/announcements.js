import { db } from '../db.js'
import { HttpError, audit, nowIso, notifyRoles } from '../util.js'

const input = (body) => {
  const title = String(body?.title ?? '').trim()
  const text = String(body?.body ?? '').trim()
  if (title.length < 3) throw new HttpError(400, 'Enter a title.')
  if (text.length < 5) throw new HttpError(400, 'Write the announcement text.')
  return [title.slice(0, 140), text.slice(0, 2000)]
}

// Post / edit / delete announcements. Mounted by both the Registrar and the Admin modules.
export function mountAnnouncements(router) {
  router.post('/announcements', (req, res) => {
    const [title, body] = input(req.body)
    const row = db
      .prepare('INSERT INTO announcements (title, body, author_id, created_at) VALUES (?,?,?,?) RETURNING id')
      .get(title, body, req.user.id, nowIso())
    notifyRoles('student', `New announcement: ${title}`, '/')
    audit(req.user, 'announcement.create', 'announcement', row.id, title)
    res.status(201).json({ id: row.id })
  })

  router.put('/announcements/:id', (req, res) => {
    const [title, body] = input(req.body)
    const info = db.prepare('UPDATE announcements SET title=?, body=? WHERE id=?').run(title, body, req.params.id)
    if (!info.changes) throw new HttpError(404, 'Announcement not found.')
    audit(req.user, 'announcement.update', 'announcement', req.params.id, title)
    res.json({ ok: true })
  })

  router.delete('/announcements/:id', (req, res) => {
    db.prepare('DELETE FROM announcements WHERE id=?').run(req.params.id)
    audit(req.user, 'announcement.delete', 'announcement', req.params.id)
    res.json({ ok: true })
  })
}
