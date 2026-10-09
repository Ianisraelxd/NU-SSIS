import { Router } from 'express'
import { db, transaction } from '../db.js'
import {
  ENROLLMENT_STEPS,
  HttpError,
  balanceFor,
  clearanceFor,
  clearanceSummary,
  currentTerm,
  nowIso,
  notify,
  reqNo,
  termLabel,
} from '../util.js'
import { requireAuth } from './auth.js'

const router = Router()
router.use(requireAuth('registrar'))

const STATUSES = ['Pending', 'Processing', 'Ready', 'Completed', 'Cancelled']
const OPEN = ['Pending', 'Processing', 'Ready']

const REQUEST_SQL = `
  SELECT r.id, r.status, r.copies, r.purpose, r.remarks, r.total_fee AS totalFee,
         r.pickup_date AS pickupDate, r.created_at AS createdAt, r.updated_at AS updatedAt,
         r.completed_at AS completedAt, d.name AS document,
         u.name AS studentName, u.login_id AS studentNo, st.program, st.year_level AS yearLevel
  FROM doc_requests r
  JOIN doc_types d ON d.id = r.doc_type_id
  JOIN users u ON u.id = r.student_id
  JOIN students st ON st.user_id = r.student_id`

const withNo = (r) => ({ ...r, requestNo: reqNo(r.id) })

function startOfPeriod(period) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (period === 'today') return start
  if (period === 'week') {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7)) // Monday
    return start
  }
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1)
  return null
}

// ---- overview ----------------------------------------------------------------------
router.get('/overview', (_req, res) => {
  const count = (status) => db.prepare('SELECT COUNT(*) AS c FROM doc_requests WHERE status=?').get(status).c
  const startOfDay = startOfPeriod('today').toISOString()
  res.json({
    pending: count('Pending'),
    processing: count('Processing'),
    ready: count('Ready'),
    completedToday: db.prepare("SELECT COUNT(*) AS c FROM doc_requests WHERE status='Completed' AND completed_at>=?").get(startOfDay).c,
    studentsOnHold: db.prepare("SELECT COUNT(DISTINCT student_id) AS c FROM clearances WHERE status='Hold'").get().c,
    students: db.prepare('SELECT COUNT(*) AS c FROM students').get().c,
  })
})

// ---- announcements -------------------------------------------------------------------
const annInput = (body) => {
  const title = String(body?.title ?? '').trim()
  const text = String(body?.body ?? '').trim()
  if (title.length < 3) throw new HttpError(400, 'Enter a title.')
  if (text.length < 5) throw new HttpError(400, 'Write the announcement text.')
  return [title.slice(0, 140), text.slice(0, 2000)]
}

router.post('/announcements', (req, res) => {
  const [title, body] = annInput(req.body)
  const row = db
    .prepare('INSERT INTO announcements (title, body, author_id, created_at) VALUES (?,?,?,?) RETURNING id')
    .get(title, body, req.user.id, nowIso())
  for (const s of db.prepare('SELECT user_id FROM students').all()) notify(s.user_id, `New announcement: ${title}`, '/')
  res.status(201).json({ id: row.id })
})

router.put('/announcements/:id', (req, res) => {
  const [title, body] = annInput(req.body)
  const info = db.prepare('UPDATE announcements SET title=?, body=? WHERE id=?').run(title, body, req.params.id)
  if (!info.changes) throw new HttpError(404, 'Announcement not found.')
  res.json({ ok: true })
})

router.delete('/announcements/:id', (req, res) => {
  db.prepare('DELETE FROM announcements WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

// ---- document requests ------------------------------------------------------------------
router.get('/requests', (req, res) => {
  const { status, type, q } = req.query
  const where = []
  const params = []
  if (status === 'open') {
    where.push(`r.status IN (${OPEN.map(() => '?').join(',')})`)
    params.push(...OPEN)
  } else if (STATUSES.includes(status)) {
    where.push('r.status = ?')
    params.push(status)
  }
  if (type && type !== 'all') {
    where.push('d.id = ?')
    params.push(Number(type))
  }
  if (q) {
    where.push('(u.name LIKE ? OR u.login_id LIKE ? OR r.id = ?)')
    const like = `%${String(q).trim()}%`
    params.push(like, like, Number(String(q).replace(/\D/g, '')) || -1)
  }
  const rows = db
    .prepare(`${REQUEST_SQL} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY r.created_at DESC, r.id DESC LIMIT 300`)
    .all(...params)
  res.json({
    requests: rows.map(withNo),
    types: db.prepare('SELECT id, name FROM doc_types ORDER BY id').all(),
  })
})

const TRANSITIONS = {
  Pending: ['Processing', 'Cancelled'],
  Processing: ['Ready', 'Cancelled'],
  Ready: ['Completed', 'Cancelled'],
  Completed: [],
  Cancelled: [],
}

const NOTE = {
  Processing: (r) => `Your ${r.document} request (${reqNo(r.id)}) is now being processed.`,
  Ready: (r) => `Your ${r.document} (${reqNo(r.id)}) is ready for pickup at the Registrar’s Office.`,
  Completed: (r) => `Your ${r.document} request (${reqNo(r.id)}) has been released.`,
  Cancelled: (r) => `Your ${r.document} request (${reqNo(r.id)}) was cancelled by the Registrar.`,
}

function advance(id, status) {
  const row = db.prepare(`${REQUEST_SQL} WHERE r.id = ?`).get(id)
  if (!row) throw new HttpError(404, 'Request not found.')
  if (!TRANSITIONS[row.status].includes(status))
    throw new HttpError(409, `A ${row.status.toLowerCase()} request cannot be changed to ${status.toLowerCase()}.`)
  const now = nowIso()
  db.prepare('UPDATE doc_requests SET status=?, updated_at=?, completed_at=? WHERE id=?').run(
    status,
    now,
    status === 'Completed' ? now : null,
    id,
  )
  const studentId = db.prepare('SELECT student_id FROM doc_requests WHERE id=?').get(id).student_id
  notify(studentId, NOTE[status](row), '/documents')
  return withNo({ ...row, status, updatedAt: now })
}

router.patch('/requests/:id', (req, res) => {
  const { status } = req.body ?? {}
  if (!STATUSES.includes(status)) throw new HttpError(400, 'Invalid status.')
  res.json(advance(Number(req.params.id), status))
})

// ---- queue ---------------------------------------------------------------------------------
router.get('/queue', (_req, res) => {
  const rows = db
    .prepare(`${REQUEST_SQL} WHERE r.status IN ('Pending','Processing','Ready') ORDER BY r.created_at, r.id`)
    .all()
    .map(withNo)
  res.json({
    processing: rows.filter((r) => r.status === 'Processing'),
    waiting: rows.filter((r) => r.status === 'Pending').map((r, i) => ({ ...r, position: i + 1 })),
    ready: rows.filter((r) => r.status === 'Ready'),
  })
})

router.post('/queue/next', (_req, res) => {
  const next = db.prepare("SELECT id FROM doc_requests WHERE status='Pending' ORDER BY created_at, id LIMIT 1").get()
  if (!next) throw new HttpError(404, 'The queue is empty.')
  res.json(advance(next.id, 'Processing'))
})

// ---- clearance ------------------------------------------------------------------------------
router.get('/clearance', (req, res) => {
  const { q, status } = req.query
  const students = db
    .prepare(
      `SELECT u.id, u.name, u.login_id AS studentNo, st.program, st.year_level AS yearLevel, st.section
       FROM students st JOIN users u ON u.id = st.user_id ORDER BY u.login_id`,
    )
    .all()
    .map((s) => {
      const rows = clearanceFor(s.id)
      const sum = clearanceSummary(rows)
      const overall = sum.hold ? 'Hold' : sum.pending ? 'Pending' : 'Cleared'
      return { ...s, ...sum, overall, balance: balanceFor(s.id).balance }
    })
    .filter((s) => (status && status !== 'all' ? s.overall === status : true))
    .filter((s) => (q ? `${s.name} ${s.studentNo}`.toLowerCase().includes(String(q).toLowerCase()) : true))
  res.json({ students })
})

router.get('/clearance/:studentId', (req, res) => {
  const student = db
    .prepare(
      `SELECT u.id, u.name, u.login_id AS studentNo, st.program, st.year_level AS yearLevel, st.section, st.enrollment_step AS step
       FROM students st JOIN users u ON u.id = st.user_id WHERE u.id = ?`,
    )
    .get(req.params.studentId)
  if (!student) throw new HttpError(404, 'Student not found.')
  const offices = clearanceFor(student.id)
  res.json({
    student: { ...student, steps: ENROLLMENT_STEPS, balance: balanceFor(student.id).balance },
    offices,
    summary: clearanceSummary(offices),
  })
})

router.put('/clearance/item/:id', (req, res) => {
  const { status, remarks } = req.body ?? {}
  if (!['Cleared', 'Pending', 'Hold'].includes(status)) throw new HttpError(400, 'Invalid status.')
  const row = db.prepare('SELECT * FROM clearances WHERE id=?').get(req.params.id)
  if (!row) throw new HttpError(404, 'Clearance item not found.')
  if (row.office === 'Cashier') throw new HttpError(409, 'The Cashier line follows the student’s balance and cannot be set manually.')
  db.prepare('UPDATE clearances SET status=?, remarks=?, updated_at=? WHERE id=?').run(
    status,
    status === 'Cleared' ? null : String(remarks ?? '').slice(0, 200) || null,
    nowIso(),
    row.id,
  )
  notify(row.student_id, `${row.office} clearance is now ${status === 'Hold' ? 'on hold' : status.toLowerCase()}.`, '/clearance')
  res.json({ ok: true })
})

router.put('/students/:id/enrollment', (req, res) => {
  const step = Number(req.body?.step)
  if (!Number.isInteger(step) || step < 0 || step > ENROLLMENT_STEPS.length) throw new HttpError(400, 'Invalid enrollment step.')
  const info = db.prepare('UPDATE students SET enrollment_step=? WHERE user_id=?').run(step, req.params.id)
  if (!info.changes) throw new HttpError(404, 'Student not found.')
  notify(Number(req.params.id), step >= ENROLLMENT_STEPS.length ? 'You are now officially enrolled.' : `Enrollment progress updated: ${ENROLLMENT_STEPS[step]} is next.`, '/enrollment')
  res.json({ ok: true })
})

// ---- reports -----------------------------------------------------------------------------------
router.get('/reports', (req, res) => {
  const type = req.query.type ?? 'documents'
  const period = req.query.period ?? 'week'
  const start = startOfPeriod(period)
  const generatedAt = nowIso()

  if (type === 'documents') {
    const params = start ? [start.toISOString()] : []
    const rows = db
      .prepare(`${REQUEST_SQL} WHERE r.status <> 'Cancelled' ${start ? 'AND r.created_at >= ?' : ''} ORDER BY r.created_at DESC`)
      .all(...params)
      .map(withNo)
    const released = rows.filter((r) => r.status === 'Completed')
    const days = released.map((r) => (new Date(r.completedAt) - new Date(r.createdAt)) / 86400000)
    const byType = db
      .prepare('SELECT name FROM doc_types ORDER BY id')
      .all()
      .map(({ name }) => {
        const own = rows.filter((r) => r.document === name)
        const done = own.filter((r) => r.status === 'Completed').length
        return { label: name, released: done, pending: own.length - done, total: own.length }
      })
      .sort((a, b) => b.total - a.total)
    return res.json({
      type,
      period,
      generatedAt,
      stats: [
        { label: 'Total Requests', value: rows.length },
        { label: 'Released', value: released.length },
        { label: 'Pending', value: rows.length - released.length },
        { label: 'Avg Processing Time', value: days.length ? `${(days.reduce((a, b) => a + b, 0) / days.length).toFixed(1)} days` : '—' },
      ],
      chart: { title: 'Requests per Document Type', series: ['Released', 'Pending'], rows: byType.map((t) => ({ label: t.label, a: t.released, b: t.pending })) },
      table: {
        columns: ['Request', 'Student', 'Document', 'Filed', 'Status'],
        rows: rows.slice(0, 100).map((r) => [r.requestNo, `${r.studentName} (${r.studentNo})`, r.document, r.createdAt, r.status]),
      },
    })
  }

  if (type === 'clearance') {
    const students = db.prepare('SELECT user_id AS id FROM students').all()
    const per = students.map((s) => clearanceSummary(clearanceFor(s.id)))
    const offices = {}
    for (const s of students)
      for (const row of clearanceFor(s.id)) {
        offices[row.office] ??= { cleared: 0, open: 0 }
        offices[row.office][row.status === 'Cleared' ? 'cleared' : 'open']++
      }
    return res.json({
      type,
      period: 'all',
      generatedAt,
      stats: [
        { label: 'Students', value: students.length },
        { label: 'Fully Cleared', value: per.filter((p) => p.complete).length },
        { label: 'With Pending', value: per.filter((p) => !p.complete && !p.hold).length },
        { label: 'On Hold', value: per.filter((p) => p.hold).length },
      ],
      chart: {
        title: 'Clearance per Office',
        series: ['Cleared', 'Pending / Hold'],
        rows: Object.entries(offices).map(([label, v]) => ({ label, a: v.cleared, b: v.open })),
      },
      table: null,
    })
  }

  if (type === 'enrollment') {
    const rows = db.prepare('SELECT year_level AS year, enrollment_step AS step FROM students').all()
    const enrolled = rows.filter((r) => r.step >= ENROLLMENT_STEPS.length).length
    const notStarted = rows.filter((r) => r.step === 0).length
    return res.json({
      type,
      period: 'all',
      generatedAt,
      term: termLabel(currentTerm()),
      stats: [
        { label: 'Students', value: rows.length },
        { label: 'Enrolled', value: enrolled },
        { label: 'In Progress', value: rows.length - enrolled - notStarted },
        { label: 'Not Started', value: notStarted },
      ],
      chart: {
        title: 'Enrollment per Year Level',
        series: ['Enrolled', 'Not yet enrolled'],
        rows: [1, 2, 3, 4].map((y) => {
          const own = rows.filter((r) => r.year === y)
          const done = own.filter((r) => r.step >= ENROLLMENT_STEPS.length).length
          return { label: `${y}${['st', 'nd', 'rd', 'th'][y - 1]} Year`, a: done, b: own.length - done }
        }),
      },
      table: null,
    })
  }

  throw new HttpError(400, 'Unknown report type.')
})

// ---- settings (registrar-only) -----------------------------------------------------------------
router.get('/config', (_req, res) => {
  res.json({
    terms: db
      .prepare('SELECT id, school_year AS schoolYear, semester, is_current AS isCurrent FROM terms ORDER BY school_year DESC, semester')
      .all()
      .map((t) => ({ ...t, isCurrent: !!t.isCurrent, label: termLabel({ school_year: t.schoolYear, semester: t.semester }) })),
    docTypes: db
      .prepare('SELECT id, name, fee, requires_clearance AS requiresClearance, active FROM doc_types ORDER BY id')
      .all()
      .map((d) => ({ ...d, requiresClearance: !!d.requiresClearance, active: !!d.active })),
  })
})

router.put('/config/term', (req, res) => {
  const id = Number(req.body?.termId)
  if (!db.prepare('SELECT 1 FROM terms WHERE id=?').get(id)) throw new HttpError(404, 'Term not found.')
  transaction(() => {
    db.exec('UPDATE terms SET is_current=0')
    db.prepare('UPDATE terms SET is_current=1 WHERE id=?').run(id)
  })
  res.json({ ok: true })
})

router.post('/config/terms', (req, res) => {
  const schoolYear = String(req.body?.schoolYear ?? '').trim()
  const semester = String(req.body?.semester ?? '').trim()
  if (!/^\d{4}-\d{4}$/.test(schoolYear)) throw new HttpError(400, 'School year must look like 2026-2027.')
  if (!['First Semester', 'Second Semester', 'Summer'].includes(semester)) throw new HttpError(400, 'Choose a semester.')
  if (db.prepare('SELECT 1 FROM terms WHERE school_year=? AND semester=?').get(schoolYear, semester))
    throw new HttpError(409, 'That term already exists.')
  db.prepare('INSERT INTO terms (school_year, semester) VALUES (?,?)').run(schoolYear, semester)
  res.status(201).json({ ok: true })
})

router.put('/config/doc-types/:id', (req, res) => {
  const fee = Number(req.body?.fee)
  if (!Number.isFinite(fee) || fee < 0 || fee > 100000) throw new HttpError(400, 'Enter a valid fee.')
  const info = db
    .prepare('UPDATE doc_types SET fee=?, requires_clearance=?, active=? WHERE id=?')
    .run(fee, req.body?.requiresClearance ? 1 : 0, req.body?.active === false ? 0 : 1, req.params.id)
  if (!info.changes) throw new HttpError(404, 'Document type not found.')
  res.json({ ok: true })
})

export default router
