import { Router } from 'express'
import { db, transaction } from '../db.js'
import { HttpError, UNREAD_IN_TASK, currentTerm, nowIso, notify, termLabel } from '../util.js'
import { requireAuth } from './auth.js'
import { unreadTotal } from './messages.js'

const router = Router()
router.use(requireAuth('teacher'))

const ACTIVITY_SQL = `
  SELECT a.id, a.title, a.kind, a.points, a.due_at AS dueAt, a.instructions, a.created_at AS createdAt,
         s.id AS subjectId, s.code, s.description,
         (SELECT COUNT(*) FROM tasks t WHERE t.activity_id = a.id) AS students,
         (SELECT COUNT(*) FROM tasks t WHERE t.activity_id = a.id AND t.done = 1) AS done
  FROM activities a JOIN subjects s ON s.id = a.subject_id`

const unreadForActivity = async (activityId, userId) =>
  (await db
    .prepare(
      `SELECT COALESCE(SUM(${UNREAD_IN_TASK}), 0) AS c FROM tasks t WHERE t.activity_id = ?`,
    )
    .get(userId, userId, activityId)).c

router.get('/home', async (req, res) => {
  const term = await currentTerm()
  const activities = await db.prepare(`${ACTIVITY_SQL} WHERE a.teacher_id = ? ORDER BY a.due_at`).all(req.user.id)
  const subjects = (await db.prepare('SELECT COUNT(DISTINCT subject_id) AS c FROM meetings WHERE teacher_id = ?').get(req.user.id)).c
  const students = (await db
    .prepare(
      `SELECT COUNT(DISTINCT t.student_id) AS c FROM tasks t JOIN activities a ON a.id = t.activity_id WHERE a.teacher_id = ?`,
    )
    .get(req.user.id)).c
  const soon = activities.filter((a) => new Date(a.dueAt) > new Date()).slice(0, 4)
  res.json({
    term: termLabel(term),
    activities: activities.length,
    subjects,
    students,
    unread: (await unreadTotal(req.user.id)),
    upcoming: (await Promise.all(soon.map(async (a) => ({ ...a, unread: (await unreadForActivity(a.id, req.user.id)) })))),
  })
})

router.get('/subjects', async (req, res) => {
  res.json(
    (await db
      .prepare(
        `SELECT DISTINCT s.id, s.code, s.description FROM meetings m JOIN subjects s ON s.id = m.subject_id
         WHERE m.teacher_id = ? ORDER BY s.code`,
      )
      .all(req.user.id)),
  )
})

router.get('/activities', async (req, res) => {
  const rows = await db.prepare(`${ACTIVITY_SQL} WHERE a.teacher_id = ? ORDER BY a.due_at DESC`).all(req.user.id)
  res.json({
    term: termLabel((await currentTerm())),
    activities: (await Promise.all(rows.map(async (a) => ({ ...a, unread: (await unreadForActivity(a.id, req.user.id)) })))),
  })
})

router.get('/activities/:id', async (req, res) => {
  const activity = await db.prepare(`${ACTIVITY_SQL} WHERE a.id = ? AND a.teacher_id = ?`).get(req.params.id, req.user.id)
  if (!activity) throw new HttpError(404, 'Activity not found.')
  const students = await db
    .prepare(
      `SELECT t.id AS taskId, t.done, t.done_at AS doneAt, u.id AS studentId, u.name, u.login_id AS studentNo,
              (SELECT COUNT(*) FROM task_messages m WHERE m.task_id = t.id AND m.deleted_at IS NULL) AS messages,
              (SELECT MAX(created_at) FROM task_messages m WHERE m.task_id = t.id) AS lastAt,
              ${UNREAD_IN_TASK} AS unread
       FROM tasks t JOIN users u ON u.id = t.student_id
       WHERE t.activity_id = ? ORDER BY unread DESC, lastAt DESC NULLS LAST, u.name`,
    )
    .all(req.user.id, req.user.id, activity.id)
  res.json({
    term: termLabel((await currentTerm())),
    activity: { ...activity, unread: students.reduce((n, s) => n + s.unread, 0) },
    students: students.map((s) => ({ ...s, done: !!s.done })),
  })
})

router.post('/activities', async (req, res) => {
  const { subjectId, title, kind, points, dueAt, instructions } = req.body ?? {}
  const taught = await db.prepare('SELECT 1 FROM meetings WHERE teacher_id = ? AND subject_id = ?').get(req.user.id, subjectId)
  if (!taught) throw new HttpError(403, 'You can only post activities for subjects you teach.')
  const cleanTitle = String(title ?? '').trim()
  if (cleanTitle.length < 3) throw new HttpError(400, 'Give the activity a title.')
  const pts = Number(points)
  if (!Number.isInteger(pts) || pts < 1 || pts > 1000) throw new HttpError(400, 'Points must be between 1 and 1000.')
  const due = new Date(dueAt)
  if (Number.isNaN(due.getTime())) throw new HttpError(400, 'Choose a due date and time.')
  if (due.getTime() < Date.now()) throw new HttpError(400, 'The due date must be in the future.')
  const type = ['Assignment', 'Finals Assignment', 'Quiz', 'Project', 'Laboratory'].includes(kind) ? kind : 'Assignment'

  const term = await currentTerm()
  const id = await transaction(async () => {
    const row = await db
      .prepare(
        `INSERT INTO activities (subject_id, teacher_id, title, kind, points, due_at, instructions, created_at)
         VALUES (?,?,?,?,?,?,?,?) RETURNING id`,
      )
      .get(subjectId, req.user.id, cleanTitle.slice(0, 120), type, pts, due.toISOString(), String(instructions ?? '').slice(0, 2000) || null, nowIso())
    const students = await db
      .prepare('SELECT student_id FROM student_subjects WHERE subject_id = ? AND term_id = ?')
      .all(subjectId, term.id)
    const insert = db.prepare('INSERT INTO tasks (student_id, activity_id) VALUES (?,?)')
    for (const s of students) await insert.run(s.student_id, row.id)
    return { id: row.id, students: students.map((s) => s.student_id) }
  })
  for (const sid of id.students) await notify(sid, `${req.user.name} posted a new activity: ${cleanTitle}.`, '/tasks')
  res.status(201).json({ id: id.id, students: id.students.length })
})

router.delete('/activities/:id', async (req, res) => {
  const info = await db.prepare('DELETE FROM activities WHERE id = ? AND teacher_id = ?').run(req.params.id, req.user.id)
  if (!info.changes) throw new HttpError(404, 'Activity not found.')
  res.json({ ok: true })
})

export default router
