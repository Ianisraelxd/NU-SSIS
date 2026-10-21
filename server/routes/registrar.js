import { Router } from 'express'
import { db, transaction } from '../db.js'
import {
  DOC_OPEN,
  DOC_STATUSES,
  HttpError,
  audit,
  balanceFor,
  clearanceFor,
  clearanceSummary,
  createUser,
  currentTerm,
  enrollmentState,
  gradeRow,
  localDate,
  notify,
  nowIso,
  startOfDayIso,
  tempPassword,
  termLabel,
  findConflicts,
  scheduleFor,
} from '../util.js'
import { REQUEST_SQL, moveRequest, withNo } from '../requests.js'
import { clearanceReport, documentsReport, enrollmentReport, queueReport } from '../reports.js'
import { mountAnnouncements } from './announcements.js'
import { requireAuth } from './auth.js'

const router = Router()
router.use(requireAuth('registrar'))

// ---- overview ----------------------------------------------------------------------
router.get('/overview', async (_req, res) => {
  const count = async (sql, ...args) => (await db.prepare(sql).get(...args)).c
  const status = async (s) => await count('SELECT COUNT(*) AS c FROM doc_requests WHERE status = ?', s)
  res.json({
    pending: (await status('Pending')),
    forPayment: (await status('For Payment')),
    processing: (await status('Processing')),
    ready: (await status('Ready for Release')),
    releasedToday: (await count("SELECT COUNT(*) AS c FROM doc_requests WHERE status = 'Released' AND completed_at >= ?", startOfDayIso())),
    enrollmentForApproval: (await count("SELECT COUNT(*) AS c FROM enrollment_requests WHERE status = 'For Registrar Approval'")),
    queueWaiting: (await count("SELECT COUNT(*) AS c FROM queue_tickets WHERE office = 'Registrar' AND queue_date = ? AND status = 'Waiting'", localDate())),
    studentsOnHold: (await count("SELECT COUNT(DISTINCT student_id) AS c FROM clearances WHERE status = 'Hold'")),
    students: (await count('SELECT COUNT(*) AS c FROM students')),
  })
})

mountAnnouncements(router)

// ---- document requests -------------------------------------------------------------------
router.get('/requests', async (req, res) => {
  const { status, type, q } = req.query
  const where = []
  const params = []
  if (status === 'open') {
    where.push(`r.status IN (${DOC_OPEN.map(() => '?').join(',')})`)
    params.push(...DOC_OPEN)
  } else if (DOC_STATUSES.includes(status)) {
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
  const rows = await db
    .prepare(`${REQUEST_SQL} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY r.created_at DESC, r.id DESC LIMIT 300`)
    .all(...params)
  res.json({
    requests: rows.map(withNo),
    types: (await db.prepare('SELECT id, name FROM doc_types ORDER BY id').all()),
    counts: Object.fromEntries((await Promise.all(DOC_STATUSES.map(async (s) => [s, (await db.prepare('SELECT COUNT(*) AS c FROM doc_requests WHERE status = ?').get(s)).c])))),
  })
})

router.get('/requests/:id', async (req, res) => {
  const row = await db.prepare(`${REQUEST_SQL} WHERE r.id = ?`).get(req.params.id)
  if (!row) throw new HttpError(404, 'Request not found.')
  const history = await db
    .prepare(
      `SELECT h.status, h.note, h.created_at AS createdAt, u.name AS byName FROM request_history h
       LEFT JOIN users u ON u.id = h.by_user WHERE h.request_id = ? ORDER BY h.id`,
    )
    .all(row.id)
  res.json({ ...withNo(row), history })
})

const ACTIONS = {
  approve: (row) => (row.totalFee > 0 ? 'For Payment' : 'Processing'),
  ready: () => 'Ready for Release',
  release: () => 'Released',
  cancel: () => 'Cancelled',
}

router.patch('/requests/:id', async (req, res) => {
  const { action, note } = req.body ?? {}
  if (!ACTIONS[action]) throw new HttpError(400, 'Unknown action.')
  const row = await db.prepare(`${REQUEST_SQL} WHERE r.id = ?`).get(req.params.id)
  if (!row) throw new HttpError(404, 'Request not found.')
  if (action === 'approve' && row.status !== 'Pending') throw new HttpError(409, 'Only a pending request can be approved.')
  res.json((await moveRequest(row.id, ACTIONS[action](row), req.user, { note: String(note ?? '').trim().slice(0, 200) || null })))
})

// first-come-first-served: approve the oldest pending request
router.post('/requests/next', async (req, res) => {
  const next = await db.prepare("SELECT id FROM doc_requests WHERE status = 'Pending' ORDER BY created_at, id LIMIT 1").get()
  if (!next) throw new HttpError(404, 'No pending requests.')
  const row = await db.prepare(`${REQUEST_SQL} WHERE r.id = ?`).get(next.id)
  res.json((await moveRequest(next.id, ACTIONS.approve(row), req.user)))
})

// ---- enrollment approval ------------------------------------------------------------------
router.get('/enrollment', async (req, res) => {
  const status = req.query.status ?? 'For Registrar Approval'
  const rows = await db
    .prepare(
      `SELECT e.id, e.status, e.remarks, e.submitted_at AS submittedAt, e.dept_reviewed_at AS deptReviewedAt,
              e.registrar_reviewed_at AS registrarReviewedAt, e.payment_confirmed_at AS paymentConfirmedAt,
              u.id AS studentId, u.name AS studentName, u.login_id AS studentNo, st.program, st.year_level AS yearLevel,
              st.section, st.verified_at AS verifiedAt, d.code AS deptCode, du.name AS deptReviewer
       FROM enrollment_requests e
       JOIN users u ON u.id = e.student_id JOIN students st ON st.user_id = e.student_id
       LEFT JOIN departments d ON d.id = st.department_id LEFT JOIN users du ON du.id = e.dept_reviewed_by
       WHERE e.term_id = ? ${status === 'all' ? '' : 'AND e.status = ?'} AND e.status <> 'Draft'
       ORDER BY e.submitted_at, e.id`,
    )
    .all(...[(await currentTerm()).id, ...(status === 'all' ? [] : [status])])
  const items = db.prepare(
    `SELECT s.id, s.code, s.description, s.units FROM enrollment_items i JOIN subjects s ON s.id = i.subject_id WHERE i.request_id = ? ORDER BY s.code`,
  )
  res.json({
    term: termLabel((await currentTerm())),
    requests: (await Promise.all(rows.map(async (r) => {
      const subjects = await items.all(r.id)
      const schedule = await scheduleFor(subjects.map((s) => s.id))
      return { ...r, verified: !!r.verifiedAt, subjects, units: subjects.reduce((n, s) => n + s.units, 0), schedule, conflicts: findConflicts(schedule).map((c) => c.text) }
    }))),
  })
})

router.patch('/enrollment/:id', async (req, res) => {
  const { decision, remarks } = req.body ?? {}
  const request = await db.prepare('SELECT * FROM enrollment_requests WHERE id = ?').get(req.params.id)
  if (!request) throw new HttpError(404, 'Enrollment request not found.')
  if (request.status !== 'For Registrar Approval') throw new HttpError(409, 'This request is not waiting for the Registrar.')
  const student = await db.prepare('SELECT u.name, u.login_id, st.verified_at FROM users u JOIN students st ON st.user_id = u.id WHERE u.id = ?').get(request.student_id)
  const now = nowIso()

  if (decision === 'approve') {
    if (!student.verified_at) throw new HttpError(409, 'Verify the student’s academic information in Student Records before approving.')
    const clashes = findConflicts(await scheduleFor((await db.prepare('SELECT subject_id FROM enrollment_items WHERE request_id = ?').all(request.id)).map((r) => r.subject_id)))
    if (clashes.length) throw new HttpError(409, `This schedule has a conflict, so it cannot be approved: ${clashes.map((c) => c.text).join('; ')}. Return it to the student to fix.`)
    await transaction(async () => {
      await db.prepare("UPDATE enrollment_requests SET status = 'Approved', remarks = NULL, registrar_reviewed_by = ?, registrar_reviewed_at = ? WHERE id = ?").run(req.user.id, now, request.id)
      const add = db.prepare('INSERT INTO student_subjects (student_id, subject_id, term_id) VALUES (?,?,?) ON CONFLICT DO NOTHING')
      for (const { subject_id } of (await db.prepare('SELECT subject_id FROM enrollment_items WHERE request_id = ?').all(request.id))) await add.run(request.student_id, subject_id, request.term_id)
    })
    await notify(request.student_id, 'Your enrollment was approved by the Registrar. Next: payment at the Cashier.', '/enrollment')
    await notifyCashiers(`${student.name} is approved — confirm their enrollment payment.`)
    await audit(req.user, 'enrollment.approve', 'enrollment', student.login_id, `Approved enrollment for ${termLabel((await currentTerm()))}`)
  } else if (decision === 'return') {
    const reason = String(remarks ?? '').trim().slice(0, 300)
    if (reason.length < 3) throw new HttpError(400, 'Tell the student what to fix.')
    await db.prepare("UPDATE enrollment_requests SET status = 'Returned', remarks = ?, registrar_reviewed_by = ?, registrar_reviewed_at = ? WHERE id = ?").run(reason, req.user.id, now, request.id)
    await notify(request.student_id, `Your enrollment was returned by the Registrar: ${reason}`, '/enrollment')
    await audit(req.user, 'enrollment.return', 'enrollment', student.login_id, reason)
  } else throw new HttpError(400, 'Choose approve or return.')
  res.json({ ok: true })
})

async function notifyCashiers(message) {
  for (const { id } of (await db.prepare("SELECT id FROM users WHERE role = 'cashier' AND active = 1").all())) await notify(id, message, '/cashier/students')
}

// ---- student records ------------------------------------------------------------------------
const STUDENT_SQL = `
  SELECT u.id, u.name, u.login_id AS studentNo, u.email, u.phone, st.program, st.year_level AS yearLevel, st.section, st.standing,
         st.address, st.guardian_name AS guardianName, st.guardian_phone AS guardianPhone,
         st.verified_at AS verifiedAt, st.department_id AS departmentId, d.code AS deptCode, u.active
  FROM students st JOIN users u ON u.id = st.user_id LEFT JOIN departments d ON d.id = st.department_id`

router.get('/students', async (req, res) => {
  const { q, dept, verified } = req.query
  const where = []
  const params = []
  if (q) {
    where.push('(u.name LIKE ? OR u.login_id LIKE ?)')
    params.push(`%${String(q).trim()}%`, `%${String(q).trim()}%`)
  }
  if (dept && dept !== 'all') {
    where.push('st.department_id = ?')
    params.push(Number(dept))
  }
  if (verified === 'yes') where.push('st.verified_at IS NOT NULL')
  if (verified === 'no') where.push('st.verified_at IS NULL')
  const rows = await db.prepare(`${STUDENT_SQL} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY u.login_id`).all(...params)
  res.json({ students: (await Promise.all(rows.map(async (s) => ({ ...s, verified: !!s.verifiedAt, active: !!s.active, enrollment: (await enrollmentState(s.id)).status })))) })
})

router.get('/students/:id', async (req, res) => {
  const s = await db.prepare(`${STUDENT_SQL} WHERE u.id = ?`).get(req.params.id)
  if (!s) throw new HttpError(404, 'Student not found.')
  res.json({ ...s, verified: !!s.verifiedAt, active: !!s.active, enrollment: (await enrollmentState(s.id)).status, balance: (await balanceFor(s.id)).balance, clearance: clearanceSummary((await clearanceFor(s.id))) })
})

const OFFICES = [
  ['Library', 'Return borrowed books'],
  ['Laboratory', 'No unreturned equipment'],
  ['Department Head', 'Submit final requirements'],
  ['Guidance', 'Exit interview'],
  ['Cashier', 'Settle balance'],
  ['Registrar', 'Complete records'],
]

async function studentFields(body) {
  const clean = (v, max) => String(v ?? '').trim().slice(0, max)
  const name = clean(body.name, 80)
  if (name.length < 2) throw new HttpError(400, 'Enter the student’s full name.')
  const email = clean(body.email, 120)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.')
  const phone = clean(body.phone, 20)
  if (phone && !/^[0-9+()\-\s]{7,20}$/.test(phone)) throw new HttpError(400, 'Enter a valid phone number.')
  const year = Number(body.yearLevel)
  if (!Number.isInteger(year) || year < 1 || year > 5) throw new HttpError(400, 'Year level must be 1 to 5.')
  const program = clean(body.program, 80)
  if (!program) throw new HttpError(400, 'Choose a program.')
  const section = clean(body.section, 20)
  if (!section) throw new HttpError(400, 'Enter the section.')
  const departmentId = body.departmentId ? Number(body.departmentId) : null
  if (departmentId && !(await db.prepare('SELECT 1 FROM departments WHERE id = ?').get(departmentId))) throw new HttpError(400, 'Unknown department.')
  return { name, email: email || null, phone: phone || null, year, program, section, departmentId, standing: ['Regular', 'Irregular', 'Probation', 'On leave', 'Graduated'].includes(body.standing) ? body.standing : 'Regular', address: clean(body.address, 200) || null, guardianName: clean(body.guardianName, 80) || null, guardianPhone: clean(body.guardianPhone, 20) || null }
}

router.post('/students', async (req, res) => {
  const f = await studentFields(req.body ?? {})
  const studentNo = String(req.body?.studentNo ?? '').trim()
  if (!/^[A-Za-z0-9-]{4,20}$/.test(studentNo)) throw new HttpError(400, 'Student number must be 4–20 letters, digits or dashes.')
  const password = tempPassword()
  const id = await transaction(async () => {
    const userId = await createUser({ role: 'student', loginId: studentNo, name: f.name, email: f.email, phone: f.phone, password })
    await db.prepare('INSERT INTO students (user_id, program, department_id, year_level, section, standing, address, guardian_name, guardian_phone) VALUES (?,?,?,?,?,?,?,?,?)').run(userId, f.program, f.departmentId, f.year, f.section, f.standing, f.address, f.guardianName, f.guardianPhone)
    for (const [office, requirement] of OFFICES) await db.prepare("INSERT INTO clearances (student_id, office, requirement, status) VALUES (?,?,?,'Pending')").run(userId, office, requirement)
    for (let y = 1; y <= 4; y++) await db.prepare('INSERT INTO year_progress (student_id, year, units_total, units_earned) VALUES (?,?,40,0)').run(userId, y)
    return userId
  })
  await audit(req.user, 'student.create', 'student', studentNo, f.name)
  res.status(201).json({ id, studentNo, tempPassword: password })
})

router.put('/students/:id', async (req, res) => {
  const student = await db.prepare('SELECT user_id FROM students WHERE user_id = ?').get(req.params.id)
  if (!student) throw new HttpError(404, 'Student not found.')
  const f = await studentFields(req.body ?? {})
  await transaction(async () => {
    await db.prepare('UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?').run(f.name, f.email, f.phone, req.params.id)
    await db.prepare('UPDATE students SET program = ?, department_id = ?, year_level = ?, section = ?, standing = ?, address = ?, guardian_name = ?, guardian_phone = ? WHERE user_id = ?').run(f.program, f.departmentId, f.year, f.section, f.standing, f.address, f.guardianName, f.guardianPhone, req.params.id)
  })
  await audit(req.user, 'student.update', 'student', req.params.id, f.name)
  res.json({ ok: true })
})

router.post('/students/:id/verify', async (req, res) => {
  const info = await db.prepare('UPDATE students SET verified_at = ?, verified_by = ? WHERE user_id = ?').run(nowIso(), req.user.id, req.params.id)
  if (!info.changes) throw new HttpError(404, 'Student not found.')
  await audit(req.user, 'student.verify', 'student', req.params.id, 'Verified academic information')
  await notify(Number(req.params.id), 'The Registrar verified your academic information.', '/')
  res.json({ ok: true })
})

// ---- subjects & class schedules ------------------------------------------------------------------
router.get('/subjects', async (_req, res) => {
  const subjects = await db
    .prepare(
      `SELECT s.id, s.code, s.description, s.units, s.year_level AS yearLevel, s.offered, s.department_id AS departmentId, d.code AS deptCode,
              (SELECT COUNT(*) FROM student_subjects ss WHERE ss.subject_id = s.id) AS enrolled
       FROM subjects s LEFT JOIN departments d ON d.id = s.department_id ORDER BY s.offered DESC, s.code`,
    )
    .all()
  const meetings = await db.prepare('SELECT id, subject_id AS subjectId, instructor, day, start_min AS startMin, end_min AS endMin, room FROM meetings ORDER BY day, start_min').all()
  res.json({ subjects: subjects.map((s) => ({ ...s, offered: !!s.offered, meetings: meetings.filter((m) => m.subjectId === s.id) })) })
})

function subjectFields(body) {
  const code = String(body.code ?? '').trim().toUpperCase().slice(0, 20)
  const description = String(body.description ?? '').trim().slice(0, 120)
  const units = Number(body.units)
  const year = Number(body.yearLevel || 0)
  if (!/^[A-Z0-9 -]{3,20}$/.test(code)) throw new HttpError(400, 'Subject code must be 3–20 letters or digits.')
  if (description.length < 3) throw new HttpError(400, 'Enter the subject description.')
  if (!Number.isInteger(units) || units < 1 || units > 12) throw new HttpError(400, 'Units must be between 1 and 12.')
  const departmentId = body.departmentId ? Number(body.departmentId) : null
  return { code, description, units, year: Number.isInteger(year) ? year : 0, offered: body.offered ? 1 : 0, departmentId }
}

router.post('/subjects', async (req, res) => {
  const f = subjectFields(req.body ?? {})
  if ((await db.prepare('SELECT 1 FROM subjects WHERE code = ?').get(f.code))) throw new HttpError(409, `${f.code} already exists.`)
  const row = await db.prepare('INSERT INTO subjects (code, description, units, year_level, offered, department_id) VALUES (?,?,?,?,?,?) RETURNING id').get(f.code, f.description, f.units, f.year, f.offered, f.departmentId)
  await audit(req.user, 'subject.create', 'subject', f.code, f.description)
  res.status(201).json({ id: row.id })
})

router.put('/subjects/:id', async (req, res) => {
  const f = subjectFields(req.body ?? {})
  const clash = await db.prepare('SELECT 1 FROM subjects WHERE code = ? AND id <> ?').get(f.code, req.params.id)
  if (clash) throw new HttpError(409, `${f.code} already exists.`)
  const info = await db.prepare('UPDATE subjects SET code = ?, description = ?, units = ?, year_level = ?, offered = ?, department_id = ? WHERE id = ?').run(f.code, f.description, f.units, f.year, f.offered, f.departmentId, req.params.id)
  if (!info.changes) throw new HttpError(404, 'Subject not found.')
  await audit(req.user, 'subject.update', 'subject', f.code, `${f.description} · ${f.offered ? 'offered' : 'not offered'}`)
  res.json({ ok: true })
})

router.delete('/subjects/:id', async (req, res) => {
  const used = await db.prepare('SELECT 1 FROM student_subjects WHERE subject_id = ? UNION SELECT 1 FROM enrollment_items WHERE subject_id = ? LIMIT 1').get(req.params.id, req.params.id)
  if (used) throw new HttpError(409, 'This subject has enrollment records. Mark it as not offered instead of deleting it.')
  const row = await db.prepare('SELECT code FROM subjects WHERE id = ?').get(req.params.id)
  await db.prepare('DELETE FROM subjects WHERE id = ?').run(req.params.id)
  if (row) await audit(req.user, 'subject.delete', 'subject', row.code)
  res.json({ ok: true })
})

function meetingFields(body) {
  const day = Number(body.day)
  const startMin = Number(body.startMin)
  const endMin = Number(body.endMin)
  const room = String(body.room ?? '').trim().slice(0, 30)
  const instructor = String(body.instructor ?? '').trim().slice(0, 80)
  if (!Number.isInteger(day) || day < 1 || day > 6) throw new HttpError(400, 'Choose a day (Monday to Saturday).')
  if (!Number.isInteger(startMin) || !Number.isInteger(endMin) || startMin < 360 || endMin > 1260 || startMin >= endMin) throw new HttpError(400, 'Class time must be between 6:00 AM and 9:00 PM, and end after it starts.')
  if (!room) throw new HttpError(400, 'Enter the room.')
  if (!instructor) throw new HttpError(400, 'Enter the instructor.')
  return { day, startMin, endMin, room, instructor }
}

router.post('/subjects/:id/meetings', async (req, res) => {
  const subject = await db.prepare('SELECT code FROM subjects WHERE id = ?').get(req.params.id)
  if (!subject) throw new HttpError(404, 'Subject not found.')
  const m = meetingFields(req.body ?? {})
  const clash = await db
    .prepare(
      `SELECT s.code, mt.room, mt.instructor FROM meetings mt JOIN subjects s ON s.id = mt.subject_id
       WHERE mt.day = ? AND mt.start_min < ? AND mt.end_min > ? AND (mt.room = ? OR mt.instructor = ?) LIMIT 1`,
    )
    .get(m.day, m.endMin, m.startMin, m.room, m.instructor)
  if (clash) throw new HttpError(409, `Conflict with ${clash.code}: ${clash.room === m.room ? `room ${m.room} is` : `${m.instructor} is`} already booked at that time.`)
  const row = await db.prepare('INSERT INTO meetings (subject_id, instructor, day, start_min, end_min, room) VALUES (?,?,?,?,?,?) RETURNING id').get(req.params.id, m.instructor, m.day, m.startMin, m.endMin, m.room)
  await audit(req.user, 'schedule.add', 'subject', subject.code, `${m.instructor}, day ${m.day}, ${m.startMin}-${m.endMin}, ${m.room}`)
  res.status(201).json({ id: row.id })
})

router.delete('/meetings/:id', async (req, res) => {
  const row = await db.prepare('SELECT s.code FROM meetings m JOIN subjects s ON s.id = m.subject_id WHERE m.id = ?').get(req.params.id)
  await db.prepare('DELETE FROM meetings WHERE id = ?').run(req.params.id)
  if (row) await audit(req.user, 'schedule.remove', 'subject', row.code)
  res.json({ ok: true })
})

// ---- grades ---------------------------------------------------------------------------------------------
router.get('/grades/subjects', async (_req, res) => {
  res.json({
    term: termLabel((await currentTerm())),
    subjects: (await db
      .prepare(
        `SELECT s.id, s.code, s.description, COUNT(ss.student_id) AS enrolled FROM subjects s
         JOIN student_subjects ss ON ss.subject_id = s.id AND ss.term_id = ? GROUP BY s.id ORDER BY s.code`,
      )
      .all((await currentTerm()).id)),
  })
})

router.get('/grades', async (req, res) => {
  const subject = await db.prepare('SELECT id, code, description, units FROM subjects WHERE id = ?').get(req.query.subjectId)
  if (!subject) throw new HttpError(404, 'Subject not found.')
  const rows = (await db
    .prepare(
      `SELECT u.id AS studentId, u.name, u.login_id AS studentNo, ss.prelim, ss.midterm, ss.finals
       FROM student_subjects ss JOIN users u ON u.id = ss.student_id WHERE ss.subject_id = ? AND ss.term_id = ? ORDER BY u.name`,
    )
    .all(subject.id, (await currentTerm()).id))
    .map(gradeRow)
  res.json({ term: termLabel((await currentTerm())), subject, rows })
})

router.put('/grades', async (req, res) => {
  const subject = await db.prepare('SELECT id, code FROM subjects WHERE id = ?').get(req.body?.subjectId)
  if (!subject) throw new HttpError(404, 'Subject not found.')
  const term = await currentTerm()
  const grade = (v) => {
    if (v === null || v === '' || v === undefined) return null
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0 || n > 100) throw new HttpError(400, 'Grades must be numbers from 0 to 100.')
    return Math.round(n * 100) / 100
  }
  let changed = 0
  await transaction(async () => {
    const current = db.prepare('SELECT prelim, midterm, finals FROM student_subjects WHERE student_id = ? AND subject_id = ? AND term_id = ?')
    const update = db.prepare('UPDATE student_subjects SET prelim = ?, midterm = ?, finals = ? WHERE student_id = ? AND subject_id = ? AND term_id = ?')
    for (const g of Array.isArray(req.body?.grades) ? req.body.grades : []) {
      const before = await current.get(g.studentId, subject.id, term.id)
      if (!before) continue
      const next = [grade(g.prelim), grade(g.midterm), grade(g.finals)]
      if (next[0] === before.prelim && next[1] === before.midterm && next[2] === before.finals) continue
      await update.run(...next, g.studentId, subject.id, term.id)
      changed++
      await notify(g.studentId, `Your grades for ${subject.code} were updated.`, '/grades')
    }
  })
  if (changed) await audit(req.user, 'grades.update', 'subject', subject.code, `${changed} student record${changed === 1 ? '' : 's'} updated`)
  res.json({ ok: true, changed })
})

// ---- clearance ------------------------------------------------------------------------------------------
router.get('/clearance', async (req, res) => {
  const { q, status } = req.query
  const students = (await Promise.all((await db
    .prepare(`SELECT u.id, u.name, u.login_id AS studentNo, st.program, st.year_level AS yearLevel, st.section FROM students st JOIN users u ON u.id = st.user_id ORDER BY u.login_id`)
    .all())
    .map(async (s) => {
      const rows = await clearanceFor(s.id)
      const sum = clearanceSummary(rows)
      return { ...s, ...sum, overall: sum.hold ? 'Hold' : sum.pending ? 'Pending' : 'Cleared', balance: (await balanceFor(s.id)).balance }
    })))
    .filter((s) => (status && status !== 'all' ? s.overall === status : true))
    .filter((s) => (q ? `${s.name} ${s.studentNo}`.toLowerCase().includes(String(q).toLowerCase()) : true))
  res.json({ students })
})

router.get('/clearance/:studentId', async (req, res) => {
  const student = await db
    .prepare(`SELECT u.id, u.name, u.login_id AS studentNo, st.program, st.year_level AS yearLevel, st.section FROM students st JOIN users u ON u.id = st.user_id WHERE u.id = ?`)
    .get(req.params.studentId)
  if (!student) throw new HttpError(404, 'Student not found.')
  const offices = await clearanceFor(student.id)
  res.json({ student: { ...student, balance: (await balanceFor(student.id)).balance, enrollment: (await enrollmentState(student.id)).status }, offices, summary: clearanceSummary(offices) })
})

router.put('/clearance/item/:id', async (req, res) => {
  const { status, remarks } = req.body ?? {}
  if (!['Cleared', 'Pending', 'Hold'].includes(status)) throw new HttpError(400, 'Invalid status.')
  const row = await db.prepare('SELECT * FROM clearances WHERE id=?').get(req.params.id)
  if (!row) throw new HttpError(404, 'Clearance item not found.')
  if (row.office === 'Cashier') throw new HttpError(409, 'The Cashier line follows the student’s balance and cannot be set manually.')
  if (row.office === 'Department Head') throw new HttpError(409, 'The Department Head line is approved by the student’s department (Department module).')
  await db.prepare('UPDATE clearances SET status=?, remarks=?, updated_at=? WHERE id=?').run(status, status === 'Cleared' ? null : String(remarks ?? '').slice(0, 200) || null, nowIso(), row.id)
  await notify(row.student_id, `${row.office} clearance is now ${status === 'Hold' ? 'on hold' : status.toLowerCase()}.`, '/clearance')
  await audit(req.user, 'clearance.update', 'clearance', (await db.prepare('SELECT login_id FROM users WHERE id = ?').get(row.student_id))?.login_id, `${row.office}: ${status}${remarks ? ` — ${remarks}` : ''}`)
  res.json({ ok: true })
})

// ---- reports ----------------------------------------------------------------------------------------------
router.get('/reports', async (req, res) => {
  const period = ['today', 'week', 'month', 'all'].includes(req.query.period) ? req.query.period : 'week'
  const type = req.query.type ?? 'documents'
  if (type === 'documents') return res.json((await documentsReport(period)))
  if (type === 'clearance') return res.json((await clearanceReport()))
  if (type === 'enrollment') return res.json((await enrollmentReport()))
  if (type === 'queue') return res.json((await queueReport(period)))
  throw new HttpError(400, 'Unknown report type.')
})

// ---- settings (registrar-only) --------------------------------------------------------------------------------
router.get('/config', async (_req, res) => {
  res.json({
    terms: (await db
      .prepare('SELECT id, school_year AS schoolYear, semester, is_current AS isCurrent FROM terms ORDER BY school_year DESC, semester')
      .all())
      .map((t) => ({ ...t, isCurrent: !!t.isCurrent, label: termLabel({ school_year: t.schoolYear, semester: t.semester }) })),
    docTypes: (await db
      .prepare('SELECT id, name, fee, requirements, requires_clearance AS requiresClearance, active FROM doc_types ORDER BY id')
      .all())
      .map((d) => ({ ...d, requiresClearance: !!d.requiresClearance, active: !!d.active })),
  })
})

router.put('/config/term', async (req, res) => {
  const id = Number(req.body?.termId)
  if (!(await db.prepare('SELECT 1 FROM terms WHERE id=?').get(id))) throw new HttpError(404, 'Term not found.')
  await transaction(async () => {
    await db.exec('UPDATE terms SET is_current=0')
    await db.prepare('UPDATE terms SET is_current=1 WHERE id=?').run(id)
  })
  await audit(req.user, 'term.current', 'term', id)
  res.json({ ok: true })
})

router.post('/config/terms', async (req, res) => {
  const schoolYear = String(req.body?.schoolYear ?? '').trim()
  const semester = String(req.body?.semester ?? '').trim()
  if (!/^\d{4}-\d{4}$/.test(schoolYear)) throw new HttpError(400, 'School year must look like 2026-2027.')
  if (!['First Semester', 'Second Semester', 'Summer'].includes(semester)) throw new HttpError(400, 'Choose a semester.')
  if ((await db.prepare('SELECT 1 FROM terms WHERE school_year=? AND semester=?').get(schoolYear, semester))) throw new HttpError(409, 'That term already exists.')
  await db.prepare('INSERT INTO terms (school_year, semester) VALUES (?,?)').run(schoolYear, semester)
  await audit(req.user, 'term.create', 'term', `${schoolYear} ${semester}`)
  res.status(201).json({ ok: true })
})

router.put('/config/doc-types/:id', async (req, res) => {
  const fee = Number(req.body?.fee)
  if (!Number.isFinite(fee) || fee < 0 || fee > 100000) throw new HttpError(400, 'Enter a valid fee.')
  const info = await db
    .prepare('UPDATE doc_types SET fee=?, requires_clearance=?, active=?, requirements=? WHERE id=?')
    .run(fee, req.body?.requiresClearance ? 1 : 0, req.body?.active === false ? 0 : 1, String(req.body?.requirements ?? '').trim().slice(0, 300) || null, req.params.id)
  if (!info.changes) throw new HttpError(404, 'Document type not found.')
  await audit(req.user, 'doc-type.update', 'doc-type', req.params.id, `Fee ${fee}`)
  res.json({ ok: true })
})

export default router
