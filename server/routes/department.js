import { Router } from 'express'
import { db } from '../db.js'
import {
  HttpError,
  audit,
  balanceFor,
  clearanceFor,
  clearanceSummary,
  currentTerm,
  enrollmentState,
  getNumber,
  gradeRow,
  localDate,
  notify,
  notifyRoles,
  nowIso,
  termLabel,
  findConflicts,
  scheduleFor,
} from '../util.js'
import { requireAuth } from './auth.js'

const router = Router()
router.use(requireAuth('department'))

// Every route is limited to students of the staff member's own department.
const deptOf = (req) => {
  if (!req.user.department_id) throw new HttpError(409, 'Your account has no department yet. Ask the administrator to assign one.')
  return req.user.department_id
}

async function ownStudent(req, studentId) {
  const s = await db
    .prepare(
      `SELECT u.id, u.name, u.login_id AS studentNo, st.program, st.year_level AS yearLevel, st.section, st.standing
       FROM students st JOIN users u ON u.id = st.user_id WHERE u.id = ? AND st.department_id = ?`,
    )
    .get(studentId, deptOf(req))
  if (!s) throw new HttpError(404, 'That student is not in your department.')
  return s
}

const login = async (id) => (await db.prepare('SELECT login_id FROM users WHERE id = ?').get(id))?.login_id

// ---- overview ---------------------------------------------------------------------------
router.get('/overview', async (req, res) => {
  const dept = deptOf(req)
  const count = async (sql, ...args) => (await db.prepare(sql).get(dept, ...args)).c
  res.json({
    department: (await db.prepare('SELECT code, name FROM departments WHERE id = ?').get(dept)),
    students: (await count('SELECT COUNT(*) AS c FROM students WHERE department_id = ?')),
    enrollmentForReview: (await count("SELECT COUNT(*) AS c FROM enrollment_requests e JOIN students st ON st.user_id = e.student_id WHERE st.department_id = ? AND e.status = 'For Department Review'")),
    requirementsOpen: (await count("SELECT COUNT(*) AS c FROM academic_requirements r JOIN students st ON st.user_id = r.student_id WHERE st.department_id = ? AND r.status <> 'Verified'")),
    clearanceOpen: (await count("SELECT COUNT(*) AS c FROM clearances c JOIN students st ON st.user_id = c.student_id WHERE st.department_id = ? AND c.office = 'Department Head' AND c.status <> 'Cleared'")),
    queueWaiting: (await count("SELECT COUNT(*) AS c FROM queue_tickets WHERE department_id = ? AND office = 'Department' AND queue_date = ? AND status = 'Waiting'", localDate())),
  })
})

// ---- students (and their clearance status) -------------------------------------------------------
router.get('/students', async (req, res) => {
  const dept = deptOf(req)
  const q = String(req.query.q ?? '').trim()
  const rows = await db
    .prepare(
      `SELECT u.id, u.name, u.login_id AS studentNo, st.program, st.year_level AS yearLevel, st.section, st.standing FROM students st
       JOIN users u ON u.id = st.user_id WHERE st.department_id = ? ${q ? 'AND (u.name LIKE ? OR u.login_id LIKE ?)' : ''} ORDER BY u.login_id`,
    )
    .all(dept, ...(q ? [`%${q}%`, `%${q}%`] : []))
  const reqs = db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'Verified' THEN 1 ELSE 0 END) AS verified FROM academic_requirements WHERE student_id = ?")
  res.json({
    students: (await Promise.all(rows.map(async (s) => {
      const offices = await clearanceFor(s.id)
      const head = offices.find((o) => o.office === 'Department Head')
      const r = await reqs.get(s.id)
      return { ...s, enrollment: (await enrollmentState(s.id)).status, clearance: clearanceSummary(offices), deptClearance: head?.status ?? 'Pending', deptRemarks: head?.remarks ?? null, requirements: { total: r.total, verified: r.verified ?? 0 } }
    }))),
  })
})

router.get('/students/:id', async (req, res) => {
  const student = await ownStudent(req, req.params.id)
  const offices = await clearanceFor(student.id)
  const term = await currentTerm()
  // department staff may view grades of their own students; the access is logged
  const grades = (await db
    .prepare(
      `SELECT s.code, s.description, s.units, ss.prelim, ss.midterm, ss.finals FROM student_subjects ss
       JOIN subjects s ON s.id = ss.subject_id WHERE ss.student_id = ? AND ss.term_id = ? ORDER BY s.code`,
    )
    .all(student.id, term.id))
    .map(gradeRow)
  await audit(req.user, 'grades.view', 'student', student.studentNo, 'Viewed current-term grades')
  res.json({
    term: termLabel(term),
    student: { ...student, balance: (await balanceFor(student.id)).balance, enrollment: (await enrollmentState(student.id)).status },
    offices,
    summary: clearanceSummary(offices),
    requirements: (await db.prepare('SELECT id, name, status, remarks, verified_at AS verifiedAt FROM academic_requirements WHERE student_id = ? ORDER BY id').all(student.id)),
    grades,
  })
})

// ---- enrollment / subject requests ------------------------------------------------------------------
router.get('/enrollment', async (req, res) => {
  const dept = deptOf(req)
  const status = req.query.status ?? 'For Department Review'
  const rows = await db
    .prepare(
      `SELECT e.id, e.status, e.remarks, e.submitted_at AS submittedAt, e.dept_reviewed_at AS deptReviewedAt,
              u.id AS studentId, u.name AS studentName, u.login_id AS studentNo, st.program, st.year_level AS yearLevel, st.section
       FROM enrollment_requests e JOIN users u ON u.id = e.student_id JOIN students st ON st.user_id = e.student_id
       WHERE e.term_id = ? AND st.department_id = ? AND e.status <> 'Draft' ${status === 'all' ? '' : 'AND e.status = ?'}
       ORDER BY e.submitted_at, e.id`,
    )
    .all(...[(await currentTerm()).id, dept, ...(status === 'all' ? [] : [status])])
  const items = db.prepare('SELECT s.id, s.code, s.description, s.units FROM enrollment_items i JOIN subjects s ON s.id = i.subject_id WHERE i.request_id = ? ORDER BY s.code')
  res.json({
    term: termLabel((await currentTerm())),
    maxUnits: (await getNumber('maxUnits')),
    requests: (await Promise.all(rows.map(async (r) => {
      const subjects = await items.all(r.id)
      const schedule = await scheduleFor(subjects.map((s) => s.id))
      return { ...r, subjects, units: subjects.reduce((n, s) => n + s.units, 0), schedule, conflicts: findConflicts(schedule).map((c) => c.text) }
    }))),
  })
})

router.patch('/enrollment/:id', async (req, res) => {
  const dept = deptOf(req)
  const request = await db
    .prepare(
      `SELECT e.* FROM enrollment_requests e JOIN students st ON st.user_id = e.student_id WHERE e.id = ? AND st.department_id = ?`,
    )
    .get(req.params.id, dept)
  if (!request) throw new HttpError(404, 'Enrollment request not found in your department.')
  if (request.status !== 'For Department Review') throw new HttpError(409, 'This request is not waiting for department review.')
  const studentNo = await login(request.student_id)
  const { decision, remarks } = req.body ?? {}
  const now = nowIso()

  if (decision === 'approve') {
    const clashes = findConflicts(await scheduleFor((await db.prepare('SELECT subject_id FROM enrollment_items WHERE request_id = ?').all(request.id)).map((r) => r.subject_id)))
    if (clashes.length) throw new HttpError(409, `This schedule has a conflict, so it cannot be approved: ${clashes.map((c) => c.text).join('; ')}. Return it to the student to fix.`)
    await db.prepare("UPDATE enrollment_requests SET status = 'For Registrar Approval', remarks = NULL, dept_reviewed_by = ?, dept_reviewed_at = ? WHERE id = ?").run(req.user.id, now, request.id)
    await notify(request.student_id, 'Your department approved your subjects. Next: Registrar approval.', '/enrollment')
    await notifyRoles('registrar', `Enrollment of ${studentNo} passed department review.`, '/registrar/enrollment')
    await audit(req.user, 'enrollment.dept-approve', 'enrollment', studentNo)
  } else if (decision === 'return') {
    const reason = String(remarks ?? '').trim().slice(0, 300)
    if (reason.length < 3) throw new HttpError(400, 'Tell the student what to change.')
    await db.prepare("UPDATE enrollment_requests SET status = 'Returned', remarks = ?, dept_reviewed_by = ?, dept_reviewed_at = ? WHERE id = ?").run(reason, req.user.id, now, request.id)
    await notify(request.student_id, `Your department returned your subjects: ${reason}`, '/enrollment')
    await audit(req.user, 'enrollment.dept-return', 'enrollment', studentNo, reason)
  } else throw new HttpError(400, 'Choose approve or return.')
  res.json({ ok: true })
})

// ---- academic requirements ---------------------------------------------------------------------------------
router.post('/students/:id/requirements', async (req, res) => {
  const student = await ownStudent(req, req.params.id)
  const name = String(req.body?.name ?? '').trim().slice(0, 80)
  if (name.length < 3) throw new HttpError(400, 'Enter the requirement.')
  await db.prepare("INSERT INTO academic_requirements (student_id, name, status, created_at) VALUES (?,?,'Pending',?)").run(student.id, name, nowIso())
  await audit(req.user, 'requirement.add', 'student', student.studentNo, name)
  res.status(201).json({ ok: true })
})

async function ownRequirement(req) {
  const r = await db.prepare('SELECT * FROM academic_requirements WHERE id = ?').get(req.params.id)
  if (!r) throw new HttpError(404, 'Requirement not found.')
  await ownStudent(req, r.student_id)
  return r
}

router.patch('/requirements/:id', async (req, res) => {
  const r = await ownRequirement(req)
  const status = req.body?.status
  if (!['Pending', 'Verified', 'Missing'].includes(status)) throw new HttpError(400, 'Invalid status.')
  const remarks = status === 'Verified' ? null : String(req.body?.remarks ?? '').trim().slice(0, 200) || null
  await db.prepare('UPDATE academic_requirements SET status = ?, remarks = ?, verified_by = ?, verified_at = ? WHERE id = ?').run(
    status, remarks, status === 'Verified' ? req.user.id : null, status === 'Verified' ? nowIso() : null, r.id,
  )
  if (status !== 'Pending') await notify(r.student_id, `Your requirement “${r.name}” is ${status === 'Verified' ? 'verified' : 'marked missing'} by your department.`, '/clearance')
  await audit(req.user, 'requirement.update', 'student', (await login(r.student_id)), `${r.name}: ${status}`)
  res.json({ ok: true })
})

router.delete('/requirements/:id', async (req, res) => {
  const r = await ownRequirement(req)
  await db.prepare('DELETE FROM academic_requirements WHERE id = ?').run(r.id)
  await audit(req.user, 'requirement.delete', 'student', (await login(r.student_id)), r.name)
  res.json({ ok: true })
})

// ---- department clearance (the "Department Head" line) -----------------------------------------------------
router.put('/students/:id/clearance', async (req, res) => {
  const student = await ownStudent(req, req.params.id)
  const { status, remarks } = req.body ?? {}
  if (!['Cleared', 'Pending', 'Hold'].includes(status)) throw new HttpError(400, 'Invalid status.')
  if (status === 'Cleared') {
    const open = (await db.prepare("SELECT COUNT(*) AS c FROM academic_requirements WHERE student_id = ? AND status <> 'Verified'").get(student.id)).c
    if (open) throw new HttpError(409, `${open} academic requirement${open === 1 ? ' is' : 's are'} not verified yet. Verify them before clearing the student.`)
  }
  const info = await db
    .prepare("UPDATE clearances SET status = ?, remarks = ?, updated_at = ? WHERE student_id = ? AND office = 'Department Head'")
    .run(status, status === 'Cleared' ? null : String(remarks ?? '').trim().slice(0, 200) || null, nowIso(), student.id)
  if (!info.changes) throw new HttpError(404, 'This student has no Department Head clearance line.')
  await notify(student.id, `Your department clearance is now ${status === 'Hold' ? 'on hold' : status.toLowerCase()}.`, '/clearance')
  await audit(req.user, 'clearance.dept', 'student', student.studentNo, `${status}${remarks ? ` — ${remarks}` : ''}`)
  res.json({ ok: true })
})

export default router
