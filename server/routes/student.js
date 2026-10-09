import { Router } from 'express'
import { db } from '../db.js'
import {
  ENROLLMENT_STEPS,
  GRADE_SCALE,
  HttpError,
  balanceFor,
  clearanceFor,
  clearanceSummary,
  currentTerm,
  gradeRow,
  nowIso,
  notifyRegistrars,
  peso,
  reqNo,
  scaleFor,
  termLabel,
} from '../util.js'
import { requireAuth } from './auth.js'

const router = Router()
router.use(requireAuth('student'))

const profile = (id) => db.prepare('SELECT * FROM students WHERE user_id=?').get(id)

function currentSubjects(studentId, termId) {
  return db
    .prepare(
      `SELECT s.id, s.code, s.description, s.units, ss.prelim, ss.midterm, ss.finals
       FROM student_subjects ss JOIN subjects s ON s.id = ss.subject_id
       WHERE ss.student_id = ? AND ss.term_id = ? ORDER BY s.code`,
    )
    .all(studentId, termId)
}

function meetingsFor(studentId, termId) {
  return db
    .prepare(
      `SELECT m.id, m.subject_id AS subjectId, s.code, s.description, m.instructor, m.day,
              m.start_min AS startMin, m.end_min AS endMin, m.room
       FROM meetings m JOIN subjects s ON s.id = m.subject_id
       JOIN student_subjects ss ON ss.subject_id = s.id AND ss.student_id = ? AND ss.term_id = ?
       ORDER BY m.day, m.start_min`,
    )
    .all(studentId, termId)
}

function gwaFor(studentId, excludeTermId) {
  const rows = db
    .prepare(
      `SELECT s.units, ss.prelim, ss.midterm, ss.finals FROM student_subjects ss
       JOIN subjects s ON s.id = ss.subject_id WHERE ss.student_id=? AND ss.term_id<>?`,
    )
    .all(studentId, excludeTermId)
    .map(gradeRow)
    .filter((r) => r.point != null)
  const units = rows.reduce((n, r) => n + r.units, 0)
  if (!units) return null
  return Math.round((rows.reduce((n, r) => n + r.point * r.units, 0) / units) * 100) / 100
}

// ---- home -------------------------------------------------------------------
router.get('/home', (req, res) => {
  const term = currentTerm()
  const me = profile(req.user.id)
  const pendingTasks = db.prepare('SELECT COUNT(*) AS c FROM tasks WHERE student_id=? AND done=0').get(req.user.id).c
  const { balance } = balanceFor(req.user.id)
  const clearance = clearanceSummary(clearanceFor(req.user.id))

  // next class (today first, otherwise the next day with a class)
  const meetings = meetingsFor(req.user.id, term.id)
  const now = new Date()
  const today = now.getDay()
  const minutes = now.getHours() * 60 + now.getMinutes()
  let next = null
  for (let offset = 0; offset < 7 && !next; offset++) {
    const day = ((today + offset + 6) % 7) + 1 // 1..7 (Mon..Sun)
    next = meetings.find((m) => m.day === day && (offset > 0 || m.startMin > minutes)) ?? null
    if (next) next = { ...next, today: offset === 0 }
  }
  res.json({
    term: termLabel(term),
    yearLevel: me.year_level,
    pendingTasks,
    balance,
    clearance,
    nextClass: next,
  })
})

// ---- subjects / schedule ----------------------------------------------------
router.get('/subjects', (req, res) => {
  const term = currentTerm()
  const subjects = currentSubjects(req.user.id, term.id)
  const meetings = meetingsFor(req.user.id, term.id)
  res.json({
    term: termLabel(term),
    yearLevel: profile(req.user.id).year_level,
    subjects: subjects.map((s) => ({
      id: s.id,
      code: s.code,
      description: s.description,
      units: s.units,
      meetings: meetings.filter((m) => m.subjectId === s.id),
    })),
  })
})

router.get('/schedule', (req, res) => {
  const term = currentTerm()
  res.json({
    term: termLabel(term),
    yearLevel: profile(req.user.id).year_level,
    meetings: meetingsFor(req.user.id, term.id),
  })
})

// ---- pending tasks ------------------------------------------------------------
router.get('/tasks', (req, res) => {
  const term = currentTerm()
  const tasks = db
    .prepare(
      `SELECT t.id, t.title, t.kind, t.points, t.due_at AS dueAt, t.instructor, t.done,
              s.code, s.description
       FROM tasks t JOIN subjects s ON s.id = t.subject_id
       WHERE t.student_id = ? ORDER BY t.done, t.due_at`,
    )
    .all(req.user.id)
  res.json({
    term: termLabel(term),
    yearLevel: profile(req.user.id).year_level,
    tasks: tasks.map((t) => ({ ...t, done: !!t.done })),
  })
})

router.post('/tasks/:id/toggle', (req, res) => {
  const info = db.prepare('UPDATE tasks SET done = 1 - done WHERE id=? AND student_id=?').run(req.params.id, req.user.id)
  if (!info.changes) throw new HttpError(404, 'Task not found.')
  res.json({ ok: true })
})

// ---- academic tracker ---------------------------------------------------------
router.get('/tracker', (req, res) => {
  const term = currentTerm()
  const me = profile(req.user.id)
  const progress = db
    .prepare('SELECT year, units_total AS total, units_earned AS earned FROM year_progress WHERE student_id=? ORDER BY year')
    .all(req.user.id)
  const earned = progress.reduce((n, p) => n + p.earned, 0)
  const total = progress.reduce((n, p) => n + p.total, 0)
  const subjects = currentSubjects(req.user.id, term.id).map((s) => {
    const parts = [s.prelim, s.midterm, s.finals].filter((v) => v != null)
    const average = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null
    return {
      code: s.code,
      description: s.description,
      units: s.units,
      average: average == null ? null : Math.round(average * 100) / 100,
      point: scaleFor(average)?.point ?? null,
      status: s.finals != null ? 'Completed' : 'In Progress',
    }
  })
  res.json({
    term: termLabel(term),
    yearLevel: me.year_level,
    gwa: gwaFor(req.user.id, term.id),
    unitsEarned: earned,
    unitsRemaining: total - earned,
    standing: me.standing,
    progress: progress.map((p) => ({ ...p, percent: Math.round((p.earned / p.total) * 100) })),
    subjects,
  })
})

// ---- grades ---------------------------------------------------------------------
router.get('/grades', (req, res) => {
  const current = currentTerm()
  const terms = db
    .prepare(
      `SELECT DISTINCT t.id, t.school_year, t.semester, t.is_current FROM terms t
       JOIN student_subjects ss ON ss.term_id = t.id WHERE ss.student_id = ?
       ORDER BY t.school_year DESC, CASE t.semester WHEN 'Second Semester' THEN 0 ELSE 1 END`,
    )
    .all(req.user.id)
    .map((t) => ({ id: t.id, label: termLabel(t), isCurrent: !!t.is_current }))
  const termId = Number(req.query.term) || current.id
  const selected = terms.find((t) => t.id === termId) ?? terms[0]
  const rows = db
    .prepare(
      `SELECT s.code, s.description, s.units, ss.prelim, ss.midterm, ss.finals
       FROM student_subjects ss JOIN subjects s ON s.id = ss.subject_id
       WHERE ss.student_id=? AND ss.term_id=? ORDER BY s.code`,
    )
    .all(req.user.id, selected.id)
    .map(gradeRow)
  const graded = rows.filter((r) => r.point != null)
  const units = graded.reduce((n, r) => n + r.units, 0)
  res.json({
    yearLevel: profile(req.user.id).year_level,
    terms,
    term: selected,
    rows,
    semesterGwa: units && graded.length === rows.length ? Math.round((graded.reduce((n, r) => n + r.point * r.units, 0) / units) * 100) / 100 : null,
    scale: GRADE_SCALE,
  })
})

// ---- enrollment -------------------------------------------------------------------
router.get('/enrollment', (req, res) => {
  const term = currentTerm()
  const me = profile(req.user.id)
  const units = currentSubjects(req.user.id, term.id).reduce((n, s) => n + s.units, 0)
  const step = me.enrollment_step
  res.json({
    term: termLabel(term),
    yearLevel: me.year_level,
    status: step >= ENROLLMENT_STEPS.length ? 'Enrolled' : step === 0 ? 'Not Started' : 'In Progress',
    section: me.section,
    units,
    step,
    steps: ENROLLMENT_STEPS,
    nextStep: ENROLLMENT_STEPS[step] ?? 'None',
  })
})

// ---- e-clearance --------------------------------------------------------------------
router.get('/clearance', (req, res) => {
  const rows = clearanceFor(req.user.id)
  res.json({
    term: termLabel(currentTerm()),
    yearLevel: profile(req.user.id).year_level,
    summary: clearanceSummary(rows),
    offices: rows.map((r) => ({ id: r.id, office: r.office, requirement: r.requirement, status: r.status, remarks: r.remarks })),
  })
})

// ---- documents & forms -----------------------------------------------------------------
const requestSelect = `
  SELECT r.id, r.status, r.copies, r.purpose, r.remarks, r.total_fee AS totalFee,
         r.pickup_date AS pickupDate, r.created_at AS createdAt, d.name AS document
  FROM doc_requests r JOIN doc_types d ON d.id = r.doc_type_id`

router.get('/documents', (req, res) => {
  const clearance = clearanceSummary(clearanceFor(req.user.id))
  const types = db
    .prepare('SELECT id, name, fee, requires_clearance AS requiresClearance FROM doc_types WHERE active=1 ORDER BY id')
    .all()
    .map((t) => ({ ...t, requiresClearance: !!t.requiresClearance }))
  const requests = db
    .prepare(`${requestSelect} WHERE r.student_id=? ORDER BY r.created_at DESC, r.id DESC`)
    .all(req.user.id)
    .map((r) => ({ ...r, requestNo: reqNo(r.id) }))
  res.json({
    term: termLabel(currentTerm()),
    yearLevel: profile(req.user.id).year_level,
    clearance,
    types,
    requests,
  })
})

router.post('/documents/requests', (req, res) => {
  const { docTypeId, purpose, copies, pickupDate, remarks } = req.body ?? {}
  const type = db.prepare('SELECT * FROM doc_types WHERE id=? AND active=1').get(docTypeId)
  if (!type) throw new HttpError(400, 'Choose a document type.')
  const count = Number(copies)
  if (!Number.isInteger(count) || count < 1 || count > 10) throw new HttpError(400, 'Copies must be between 1 and 10.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(pickupDate ?? ''))) throw new HttpError(400, 'Choose a pickup date.')
  const today = new Date().toISOString().slice(0, 10)
  if (pickupDate < today) throw new HttpError(400, 'Pickup date cannot be in the past.')
  if (type.requires_clearance && !clearanceSummary(clearanceFor(req.user.id)).complete)
    throw new HttpError(403, `${type.name} can only be requested once your E-Clearance is complete.`)
  const duplicate = db
    .prepare("SELECT 1 FROM doc_requests WHERE student_id=? AND doc_type_id=? AND status IN ('Pending','Processing')")
    .get(req.user.id, type.id)
  if (duplicate) throw new HttpError(409, `You already have an open request for ${type.name}.`)

  const now = nowIso()
  const row = db
    .prepare(
      `INSERT INTO doc_requests (student_id, doc_type_id, purpose, copies, pickup_date, remarks, total_fee, status, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,'Pending',?,?) RETURNING id`,
    )
    .get(req.user.id, type.id, String(purpose ?? '').slice(0, 120) || null, count, pickupDate, String(remarks ?? '').slice(0, 500) || null, type.fee * count, now, now)
  notifyRegistrars(`${req.user.name} requested ${type.name} (${reqNo(row.id)}).`, '/registrar/requests')
  res.status(201).json({ id: row.id, requestNo: reqNo(row.id), totalFee: type.fee * count })
})

router.post('/documents/requests/:id/cancel', (req, res) => {
  const info = db
    .prepare("UPDATE doc_requests SET status='Cancelled', updated_at=? WHERE id=? AND student_id=? AND status='Pending'")
    .run(nowIso(), req.params.id, req.user.id)
  if (!info.changes) throw new HttpError(409, 'Only pending requests can be cancelled.')
  res.json({ ok: true })
})

// ---- account summary -----------------------------------------------------------------------
router.get('/account', (req, res) => {
  const term = currentTerm()
  const fees = db.prepare('SELECT id, name, amount FROM fees WHERE student_id=? AND term_id=? ORDER BY id').all(req.user.id, term.id)
  const payments = db
    .prepare(
      `SELECT id, due_on AS dueOn, reference, amount, status FROM payments
       WHERE student_id=? AND term_id=? ORDER BY due_on`,
    )
    .all(req.user.id, term.id)
  const money = balanceFor(req.user.id)
  const nextDue = payments.find((p) => p.status === 'Due' && money.balance > 0) ?? null
  res.json({
    term: termLabel(term),
    yearLevel: profile(req.user.id).year_level,
    ...money,
    nextDue: nextDue ? nextDue.dueOn : null,
    fees,
    payments,
    note: money.balance > 0 ? `Please settle ${peso(money.balance)} at the Cashier before the due date.` : 'Your account is fully paid.',
  })
})

export default router
