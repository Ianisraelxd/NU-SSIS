import { Router } from 'express'
import { db, transaction } from '../db.js'
import {
  DOC_OPEN,
  ENROLLMENT_STEPS,
  GRADE_SCALE,
  HttpError,
  UNREAD_IN_TASK,
  audit,
  balanceFor,
  clearanceFor,
  clearanceSummary,
  currentTerm,
  enrollmentState,
  getNumber,
  gradeRow,
  localDate,
  logRequest,
  notify,
  notifyRoles,
  nowIso,
  paidPercent,
  peso,
  reqNo,
  scaleFor,
  termLabel,
} from '../util.js'
import { FEATURES } from '../config.js'
import { requireAuth } from './auth.js'

const router = Router()
router.use(requireAuth('student'))

const profile = async (id) => await db.prepare('SELECT * FROM students WHERE user_id=?').get(id)

async function currentSubjects(studentId, termId) {
  return await db
    .prepare(
      `SELECT s.id, s.code, s.description, s.units, ss.prelim, ss.midterm, ss.finals
       FROM student_subjects ss JOIN subjects s ON s.id = ss.subject_id
       WHERE ss.student_id = ? AND ss.term_id = ? ORDER BY s.code`,
    )
    .all(studentId, termId)
}

async function meetingsFor(studentId, termId) {
  return await db
    .prepare(
      `SELECT m.id, m.subject_id AS subjectId, s.code, s.description, COALESCE(u.name, m.instructor) AS instructor, m.day,
              m.start_min AS startMin, m.end_min AS endMin, m.room
       FROM meetings m JOIN subjects s ON s.id = m.subject_id LEFT JOIN users u ON u.id = m.teacher_id
       JOIN student_subjects ss ON ss.subject_id = s.id AND ss.student_id = ? AND ss.term_id = ?
       ORDER BY m.day, m.start_min`,
    )
    .all(studentId, termId)
}

async function gwaFor(studentId, excludeTermId) {
  const rows = (await db
    .prepare(
      `SELECT s.units, ss.prelim, ss.midterm, ss.finals FROM student_subjects ss
       JOIN subjects s ON s.id = ss.subject_id WHERE ss.student_id=? AND ss.term_id<>?`,
    )
    .all(studentId, excludeTermId))
    .map(gradeRow)
    .filter((r) => r.point != null)
  const units = rows.reduce((n, r) => n + r.units, 0)
  if (!units) return null
  return Math.round((rows.reduce((n, r) => n + r.point * r.units, 0) / units) * 100) / 100
}

// ---- profile -----------------------------------------------------------------------
router.get('/profile', async (req, res) => {
  const me = await db
    .prepare(
      `SELECT s.program, s.year_level AS yearLevel, s.section, s.standing, s.address, s.guardian_name AS guardianName,
              s.guardian_phone AS guardianPhone, s.verified_at AS verifiedAt, d.code AS departmentCode, d.name AS departmentName
       FROM students s LEFT JOIN departments d ON d.id = s.department_id WHERE s.user_id = ?`,
    )
    .get(req.user.id)
  res.json({ ...me, verified: !!me.verifiedAt })
})

router.put('/profile', async (req, res) => {
  const clean = (v, max) => String(v ?? '').trim().slice(0, max) || null
  const phone = clean(req.body?.guardianPhone, 20)
  if (phone && !/^[0-9+()\-\s]{7,20}$/.test(phone)) throw new HttpError(400, 'Enter a valid contact number.')
  await db.prepare('UPDATE students SET address = ?, guardian_name = ?, guardian_phone = ? WHERE user_id = ?').run(
    clean(req.body?.address, 200),
    clean(req.body?.guardianName, 80),
    phone,
    req.user.id,
  )
  res.json({ ok: true })
})

// ---- pending tasks (service to-dos) ---------------------------------------------
// Things the student still has to do with the school's services.
async function serviceTodos(studentId) {
  const items = []
  const [{ balance }, enroll, clearanceRows, docs] = await Promise.all([
    balanceFor(studentId),
    enrollmentState(studentId),
    clearanceFor(studentId),
    db
      .prepare(
        `SELECT r.id, r.status, r.total_fee AS fee, d.name FROM doc_requests r JOIN doc_types d ON d.id = r.doc_type_id
       WHERE r.student_id = ? AND r.status IN ('For Payment','Ready for Release') ORDER BY r.updated_at, r.id`,
      )
      .all(studentId),
  ])

  if (enroll.status === 'Returned')
    items.push({
      id: 'enrollment-returned',
      category: 'Enrollment',
      title: 'Fix and resubmit your enrollment',
      detail: enroll.request?.remarks || 'Your subjects were returned for changes.',
      severity: 'high',
      dueDate: null,
      link: '/enrollment',
      action: 'Edit subjects',
    })
  else if (enroll.step === 0)
    items.push({
      id: 'enrollment',
      category: 'Enrollment',
      title: 'Select your subjects for enrollment',
      detail: 'Choose your subjects and submit them for department review.',
      severity: 'medium',
      dueDate: null,
      link: '/enrollment',
      action: 'Select subjects',
    })
  else if (enroll.step === 3)
    items.push({
      id: 'enrollment-payment',
      category: 'Enrollment',
      title: 'Enrollment: payment',
      detail: 'Your subjects are approved. The Cashier confirms your enrollment once the minimum payment is made.',
      severity: 'medium',
      dueDate: null,
      link: '/enrollment',
      action: 'View enrollment',
    })

  for (const c of clearanceRows) {
    if (c.status === 'Cleared' || (c.office === 'Cashier' && balance > 0)) continue // balance has its own item
    items.push({
      id: `clearance-${c.id}`,
      category: 'Clearance',
      title: `${c.office}: ${c.requirement}`,
      detail: c.remarks || (c.status === 'Hold' ? 'On hold — please visit the office.' : 'Requirement not yet completed.'),
      severity: c.status === 'Hold' ? 'high' : 'medium',
      dueDate: null,
      link: '/clearance',
      action: 'View clearance',
    })
  }

  if (balance > 0) {
    const next = await db.prepare("SELECT due_on FROM payments WHERE student_id=? AND status='Due' ORDER BY due_on LIMIT 1").get(studentId)
    const daysLeft = next ? (new Date(`${next.due_on}T00:00:00`) - Date.now()) / 86400000 : null
    items.push({
      id: 'balance',
      category: 'Payment',
      title: `Settle your remaining balance of ${peso(balance)}`,
      detail: 'Pay at the Cashier. Your clearance and some documents depend on it.',
      severity: daysLeft != null && daysLeft <= 7 ? 'high' : 'medium',
      dueDate: next?.due_on ?? null,
      link: '/account',
      action: 'View account',
    })
  }

  for (const r of docs)
    items.push(
      r.status === 'For Payment'
        ? {
            id: `document-pay-${r.id}`,
            category: 'Payment',
            title: `Pay ${peso(r.fee)} for your ${r.name}`,
            detail: `${reqNo(r.id)} was approved. Pay at the Cashier so the Registrar can start processing it.`,
            severity: 'medium',
            dueDate: null,
            link: '/documents',
            action: 'View request',
          }
        : {
            id: `document-${r.id}`,
            category: 'Document',
            title: `Pick up your ${r.name}`,
            detail: `${reqNo(r.id)} is ready for release at the Registrar’s Office. Bring a valid school ID.`,
            severity: 'medium',
            dueDate: null,
            link: '/documents',
            action: 'View request',
          },
    )

  const rank = { high: 0, medium: 1 }
  return items.sort((a, b) => rank[a.severity] - rank[b.severity] || String(a.dueDate ?? '9').localeCompare(String(b.dueDate ?? '9')))
}

router.get('/todo', async (req, res) => {
  res.json({
    term: termLabel((await currentTerm())),
    yearLevel: (await profile(req.user.id)).year_level,
    items: (await serviceTodos(req.user.id)),
  })
})

// ---- home -------------------------------------------------------------------
router.get('/home', async (req, res) => {
  const term = await currentTerm()
  const [me, pendingTasks, { balance }, clearanceRows, enroll, ticket, meetings] = await Promise.all([
    profile(req.user.id),
    FEATURES.lms
      ? db.prepare('SELECT COUNT(*) AS c FROM tasks WHERE student_id=? AND done=0').get(req.user.id).then((r) => r.c)
      : serviceTodos(req.user.id).then((items) => items.length),
    balanceFor(req.user.id),
    clearanceFor(req.user.id),
    enrollmentState(req.user.id),
    db
      .prepare(`SELECT number, office, status FROM queue_tickets WHERE student_id = ? AND queue_date = ? AND status IN ('Waiting','Serving') ORDER BY id DESC LIMIT 1`)
      .get(req.user.id, localDate()),
    meetingsFor(req.user.id, term.id),
  ])
  const clearance = clearanceSummary(clearanceRows)

  // next class (today first, otherwise the next day with a class)
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
    enrollment: { status: enroll.status, step: enroll.step },
    ticket: ticket ?? null,
    nextClass: next,
  })
})

// ---- subjects / schedule ----------------------------------------------------
router.get('/subjects', async (req, res) => {
  const term = await currentTerm()
  const subjects = await currentSubjects(req.user.id, term.id)
  const meetings = await meetingsFor(req.user.id, term.id)
  res.json({
    term: termLabel(term),
    yearLevel: (await profile(req.user.id)).year_level,
    subjects: subjects.map((s) => ({
      id: s.id,
      code: s.code,
      description: s.description,
      units: s.units,
      meetings: meetings.filter((m) => m.subjectId === s.id),
    })),
  })
})

router.get('/schedule', async (req, res) => {
  const term = await currentTerm()
  res.json({
    term: termLabel(term),
    yearLevel: (await profile(req.user.id)).year_level,
    meetings: (await meetingsFor(req.user.id, term.id)),
  })
})

// ---- optional LMS extras: class activities (only reachable when ENABLE_LMS=true) ---------------------
const TASK_SELECT = `
  SELECT t.id, a.title, a.kind, a.points, a.due_at AS dueAt, a.instructions, t.done, t.done_at AS doneAt,
         s.code, s.description, a.teacher_id AS teacherId, COALESCE(u.name, 'Teacher') AS instructor,
         (SELECT COUNT(*) FROM task_messages m WHERE m.task_id = t.id AND m.deleted_at IS NULL) AS comments,
         ${UNREAD_IN_TASK} AS unread
  FROM tasks t
  JOIN activities a ON a.id = t.activity_id
  JOIN subjects s ON s.id = a.subject_id
  LEFT JOIN users u ON u.id = a.teacher_id`

router.get('/tasks', async (req, res) => {
  const term = await currentTerm()
  const tasks = await db
    .prepare(`${TASK_SELECT} WHERE t.student_id = ? ORDER BY t.done, a.due_at`)
    .all(req.user.id, req.user.id, req.user.id)
  res.json({
    term: termLabel(term),
    yearLevel: (await profile(req.user.id)).year_level,
    tasks: tasks.map((t) => ({ ...t, done: !!t.done })),
  })
})

router.get('/tasks/:id', async (req, res) => {
  const task = await db.prepare(`${TASK_SELECT} WHERE t.id = ? AND t.student_id = ?`).get(req.user.id, req.user.id, req.params.id, req.user.id)
  if (!task) throw new HttpError(404, 'Task not found.')
  res.json({
    term: termLabel((await currentTerm())),
    yearLevel: (await profile(req.user.id)).year_level,
    task: { ...task, done: !!task.done },
  })
})

router.post('/tasks/:id/toggle', async (req, res) => {
  const now = nowIso()
  const info = await db
    .prepare('UPDATE tasks SET done = 1 - done, done_at = CASE WHEN done = 0 THEN ? ELSE NULL END WHERE id=? AND student_id=?')
    .run(now, req.params.id, req.user.id)
  if (!info.changes) throw new HttpError(404, 'Task not found.')
  const t = await db
    .prepare('SELECT t.done, a.title, a.teacher_id AS teacherId FROM tasks t JOIN activities a ON a.id = t.activity_id WHERE t.id = ?')
    .get(req.params.id)
  if (t.done && t.teacherId) await notify(t.teacherId, `${req.user.name} marked “${t.title}” as done.`, '/teacher/activities')
  res.json({ ok: true, done: !!t.done })
})

// ---- academic tracker ---------------------------------------------------------
router.get('/tracker', async (req, res) => {
  const term = await currentTerm()
  const me = await profile(req.user.id)
  const progress = await db
    .prepare('SELECT year, units_total AS total, units_earned AS earned FROM year_progress WHERE student_id=? ORDER BY year')
    .all(req.user.id)
  const earned = progress.reduce((n, p) => n + p.earned, 0)
  const total = progress.reduce((n, p) => n + p.total, 0)
  const subjects = (await currentSubjects(req.user.id, term.id)).map((s) => {
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
    gwa: (await gwaFor(req.user.id, term.id)),
    unitsEarned: earned,
    unitsRemaining: total - earned,
    standing: me.standing,
    progress: progress.map((p) => ({ ...p, percent: Math.round((p.earned / p.total) * 100) })),
    subjects,
  })
})

// ---- grades ---------------------------------------------------------------------
router.get('/grades', async (req, res) => {
  const current = await currentTerm()
  const terms = (await db
    .prepare(
      `SELECT t.id, t.school_year, t.semester, t.is_current FROM terms t
       JOIN student_subjects ss ON ss.term_id = t.id WHERE ss.student_id = ? GROUP BY t.id
       ORDER BY t.school_year DESC, CASE t.semester WHEN 'Second Semester' THEN 0 ELSE 1 END`,
    )
    .all(req.user.id))
    .map((t) => ({ id: t.id, label: termLabel(t), isCurrent: !!t.is_current }))
  const termId = Number(req.query.term) || current.id
  const selected = terms.find((t) => t.id === termId) ?? terms[0] ?? { id: current.id, label: termLabel(current), isCurrent: true }
  const rows = (await db
    .prepare(
      `SELECT s.code, s.description, s.units, ss.prelim, ss.midterm, ss.finals
       FROM student_subjects ss JOIN subjects s ON s.id = ss.subject_id
       WHERE ss.student_id=? AND ss.term_id=? ORDER BY s.code`,
    )
    .all(req.user.id, selected.id))
    .map(gradeRow)
  const graded = rows.filter((r) => r.point != null)
  const units = graded.reduce((n, r) => n + r.units, 0)
  res.json({
    yearLevel: (await profile(req.user.id)).year_level,
    terms: terms.length ? terms : [selected],
    term: selected,
    rows,
    semesterGwa: units && graded.length === rows.length ? Math.round((graded.reduce((n, r) => n + r.point * r.units, 0) / units) * 100) / 100 : null,
    scale: GRADE_SCALE,
  })
})

// ---- enrollment -------------------------------------------------------------------
// Student selects subjects → Department reviews → Registrar approves → Cashier confirms payment.
async function availableSubjects(studentId) {
  const dept = (await profile(studentId)).department_id
  return await db
    .prepare(
      `SELECT id, code, description, units, year_level AS yearLevel FROM subjects
       WHERE offered = 1 AND (department_id IS NULL OR department_id = ?) ORDER BY code`,
    )
    .all(dept)
}

router.get('/enrollment', async (req, res) => {
  const term = await currentTerm()
  const [me, st, available, approved, maxUnits, minPercent, percent, money] = await Promise.all([
    profile(req.user.id),
    enrollmentState(req.user.id),
    availableSubjects(req.user.id),
    currentSubjects(req.user.id, term.id),
    getNumber('maxUnits'),
    getNumber('minPaymentPercent'),
    paidPercent(req.user.id),
    balanceFor(req.user.id),
  ])
  const selected = st.request ? (await db.prepare('SELECT subject_id AS id FROM enrollment_items WHERE request_id = ?').all(st.request.id)).map((r) => r.id) : []
  const approvedUnits = approved.reduce((n, s) => n + s.units, 0)
  const pickedUnits = available.filter((s) => selected.includes(s.id)).reduce((n, s) => n + s.units, 0)
  res.json({
    term: termLabel(term),
    yearLevel: me.year_level,
    status: st.status,
    section: me.section,
    units: st.request?.status === 'Approved' ? approvedUnits : pickedUnits,
    step: st.step,
    steps: ENROLLMENT_STEPS,
    nextStep: ENROLLMENT_STEPS[st.step] ?? 'None',
    request: st.request && { status: st.request.status, remarks: st.request.remarks, submittedAt: st.request.submitted_at },
    selected,
    available,
    canEdit: !st.request || ['Draft', 'Returned'].includes(st.request.status),
    maxUnits,
    payment: { percent, minPercent, balance: money.balance },
  })
})

router.put('/enrollment', async (req, res) => {
  const term = await currentTerm()
  const st = await enrollmentState(req.user.id)
  if (st.request && !['Draft', 'Returned'].includes(st.request.status))
    throw new HttpError(409, 'Your subjects were already submitted. They can only be changed if they are returned to you.')

  const ids = [...new Set((Array.isArray(req.body?.subjectIds) ? req.body.subjectIds : []).map(Number))]
  const available = await availableSubjects(req.user.id)
  const chosen = ids.map((id) => available.find((s) => s.id === id))
  if (chosen.some((s) => !s)) throw new HttpError(400, 'One of the selected subjects is not open for your program.')
  const units = chosen.reduce((n, s) => n + s.units, 0)
  const max = await getNumber('maxUnits')
  if (units > max) throw new HttpError(400, `You can enroll in at most ${max} units (you picked ${units}).`)
  const submit = !!req.body?.submit
  if (submit && !ids.length) throw new HttpError(400, 'Pick at least one subject before submitting.')

  await transaction(async () => {
    let request = st.request
    if (!request)
      request = await db.prepare("INSERT INTO enrollment_requests (student_id, term_id, status) VALUES (?,?,'Draft') RETURNING *").get(req.user.id, term.id)
    await db.prepare('DELETE FROM enrollment_items WHERE request_id = ?').run(request.id)
    const insert = db.prepare('INSERT INTO enrollment_items (request_id, subject_id) VALUES (?,?)')
    for (const id of ids) await insert.run(request.id, id)
    if (submit) {
      await db.prepare("UPDATE enrollment_requests SET status = 'For Department Review', remarks = NULL, submitted_at = ? WHERE id = ?").run(nowIso(), request.id)
    }
  })
  if (submit) {
    await notifyRoles('department', `${req.user.name} submitted ${ids.length} subject${ids.length === 1 ? '' : 's'} for enrollment review.`, '/department/enrollment', (await profile(req.user.id)).department_id)
    await audit(req.user, 'enrollment.submit', 'enrollment', req.user.login_id, `${ids.length} subjects, ${units} units`)
  }
  res.json({ ok: true, submitted: submit, units })
})

// ---- e-clearance --------------------------------------------------------------------
router.get('/clearance', async (req, res) => {
  const rows = await clearanceFor(req.user.id)
  res.json({
    term: termLabel((await currentTerm())),
    yearLevel: (await profile(req.user.id)).year_level,
    summary: clearanceSummary(rows),
    offices: rows.map((r) => ({ id: r.id, office: r.office, requirement: r.requirement, status: r.status, remarks: r.remarks })),
  })
})

// ---- documents & forms -----------------------------------------------------------------
const requestSelect = `
  SELECT r.id, r.status, r.copies, r.purpose, r.remarks, r.total_fee AS totalFee,
         r.pickup_date AS pickupDate, r.created_at AS createdAt, r.or_number AS orNumber, r.paid_at AS paidAt,
         d.name AS document
  FROM doc_requests r JOIN doc_types d ON d.id = r.doc_type_id`

router.get('/documents', async (req, res) => {
  const clearance = clearanceSummary((await clearanceFor(req.user.id)))
  const types = (await db
    .prepare('SELECT id, name, fee, requirements, requires_clearance AS requiresClearance FROM doc_types WHERE active=1 ORDER BY id')
    .all())
    .map((t) => ({ ...t, requiresClearance: !!t.requiresClearance }))
  const requests = (await db
    .prepare(`${requestSelect} WHERE r.student_id=? ORDER BY r.created_at DESC, r.id DESC`)
    .all(req.user.id))
    .map((r) => ({ ...r, requestNo: reqNo(r.id) }))
  const history = await db
    .prepare(
      `SELECT request_id AS requestId, status, note, created_at AS createdAt FROM request_history
       WHERE request_id IN (SELECT id FROM doc_requests WHERE student_id = ?) ORDER BY id`,
    )
    .all(req.user.id)
  res.json({
    term: termLabel((await currentTerm())),
    yearLevel: (await profile(req.user.id)).year_level,
    clearance,
    maxCopies: (await getNumber('maxCopies')),
    types,
    requests: requests.map((r) => ({ ...r, history: history.filter((h) => h.requestId === r.id) })),
  })
})

router.post('/documents/requests', async (req, res) => {
  const { docTypeId, purpose, copies, pickupDate, remarks } = req.body ?? {}
  const type = await db.prepare('SELECT * FROM doc_types WHERE id=? AND active=1').get(Number.isInteger(Number(docTypeId)) ? Number(docTypeId) : 0)
  if (!type) throw new HttpError(400, 'Choose a document type.')
  const count = Number(copies)
  const maxCopies = await getNumber('maxCopies')
  if (!Number.isInteger(count) || count < 1 || count > maxCopies) throw new HttpError(400, `Copies must be between 1 and ${maxCopies}.`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(pickupDate ?? ''))) throw new HttpError(400, 'Choose a pickup date.')
  if (pickupDate < localDate()) throw new HttpError(400, 'Pickup date cannot be in the past.')
  if (type.requires_clearance && !clearanceSummary((await clearanceFor(req.user.id))).complete)
    throw new HttpError(403, `${type.name} can only be requested once your E-Clearance is complete.`)
  const duplicate = await db
    .prepare(`SELECT 1 FROM doc_requests WHERE student_id=? AND doc_type_id=? AND status IN (${DOC_OPEN.map(() => '?').join(',')})`)
    .get(req.user.id, type.id, ...DOC_OPEN)
  if (duplicate) throw new HttpError(409, `You already have an open request for ${type.name}.`)

  const now = nowIso()
  const row = await db
    .prepare(
      `INSERT INTO doc_requests (student_id, doc_type_id, purpose, copies, pickup_date, remarks, total_fee, status, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,'Pending',?,?) RETURNING id`,
    )
    .get(req.user.id, type.id, String(purpose ?? '').slice(0, 120) || null, count, pickupDate, String(remarks ?? '').slice(0, 500) || null, type.fee * count, now, now)
  await logRequest(row.id, 'Pending', 'Request submitted', req.user.id)
  await notifyRoles('registrar', `${req.user.name} requested ${type.name} (${reqNo(row.id)}).`, '/registrar/requests')
  res.status(201).json({ id: row.id, requestNo: reqNo(row.id), totalFee: type.fee * count })
})

router.post('/documents/requests/:id/cancel', async (req, res) => {
  const info = await db
    .prepare("UPDATE doc_requests SET status='Cancelled', updated_at=? WHERE id=? AND student_id=? AND status IN ('Pending','For Payment')")
    .run(nowIso(), req.params.id, req.user.id)
  if (!info.changes) throw new HttpError(409, 'Only requests that are pending or waiting for payment can be cancelled.')
  await logRequest(Number(req.params.id), 'Cancelled', 'Cancelled by the student', req.user.id)
  res.json({ ok: true })
})

// ---- account summary -----------------------------------------------------------------------
router.get('/account', async (req, res) => {
  const term = await currentTerm()
  const fees = await db.prepare('SELECT id, name, amount FROM fees WHERE student_id=? AND term_id=? ORDER BY id').all(req.user.id, term.id)
  const payments = await db
    .prepare(
      `SELECT id, due_on AS dueOn, reference, amount, status, method FROM payments
       WHERE student_id=? AND term_id=? AND status <> 'Void' ORDER BY due_on, id`,
    )
    .all(req.user.id, term.id)
  const documentPayments = (await db
    .prepare(
      `SELECT r.id, d.name AS document, r.or_number AS orNumber, r.paid_amount AS amount, r.paid_at AS paidAt
       FROM doc_requests r JOIN doc_types d ON d.id = r.doc_type_id
       WHERE r.student_id = ? AND r.paid_at IS NOT NULL ORDER BY r.paid_at DESC, r.id`,
    )
    .all(req.user.id))
    .map((r) => ({ ...r, requestNo: reqNo(r.id) }))
  const money = await balanceFor(req.user.id)
  const nextDue = payments.find((p) => p.status === 'Due' && money.balance > 0) ?? null
  res.json({
    term: termLabel(term),
    yearLevel: (await profile(req.user.id)).year_level,
    ...money,
    nextDue: nextDue ? nextDue.dueOn : null,
    fees,
    payments,
    documentPayments,
    note: money.balance > 0 ? `Please settle ${peso(money.balance)} at the Cashier before the due date.` : 'Your account is fully paid.',
  })
})

export default router
