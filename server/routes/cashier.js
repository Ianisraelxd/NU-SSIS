import { Router } from 'express'
import { db, lock, transaction } from '../db.js'
import {
  ENROLLMENT_STEPS,
  HttpError,
  audit,
  balanceFor,
  currentTerm,
  enrollmentState,
  getNumber,
  localDate,
  notify,
  nowIso,
  paidPercent,
  peso,
  reqNo,
  startOfDayIso,
  termLabel,
} from '../util.js'
import { REQUEST_SQL, moveRequest, withNo } from '../requests.js'
import { collectionsReport } from '../reports.js'
import { requireAuth } from './auth.js'

const router = Router()
router.use(requireAuth('cashier'))

const METHODS = ['Cash', 'GCash', 'Bank Transfer', 'Check']

// Next official receipt number: one higher than the highest OR-#### used so far.
async function nextOrNumber() {
  await lock('official-receipt') // released when the surrounding transaction ends
  const used = [
    ...(await db.prepare("SELECT reference AS v FROM payments WHERE reference LIKE 'OR-%'").all()),
    ...(await db.prepare("SELECT or_number AS v FROM doc_requests WHERE or_number LIKE 'OR-%'").all()),
  ]
    .map((r) => Number(String(r.v).replace(/\D/g, '')))
    .filter(Number.isFinite)
  return `OR-${Math.max(5999, ...used) + 1}`
}

const orInUse = async (or) =>
  await db.prepare('SELECT 1 FROM payments WHERE reference = ? UNION SELECT 1 FROM doc_requests WHERE or_number = ?').get(or, or)

const login = async (id) => (await db.prepare('SELECT login_id FROM users WHERE id = ?').get(id))?.login_id

// Keep one "Due" row equal to what is still owed.
async function syncDue(studentId) {
  const term = await currentTerm()
  const { balance } = await balanceFor(studentId)
  const previous = (await db.prepare("SELECT MIN(due_on) AS d FROM payments WHERE student_id = ? AND term_id = ? AND status = 'Due'").get(studentId, term.id))?.d
  await db.prepare("DELETE FROM payments WHERE student_id = ? AND term_id = ? AND status = 'Due'").run(studentId, term.id)
  if (balance > 0) {
    const fallback = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
    await db.prepare("INSERT INTO payments (student_id, term_id, due_on, amount, status) VALUES (?,?,?,?, 'Due')").run(studentId, term.id, previous ?? fallback, balance)
  }
}

// ---- overview ------------------------------------------------------------------------------
router.get('/overview', async (_req, res) => {
  const since = startOfDayIso()
  const count = async (sql, ...args) => (await db.prepare(sql).get(...args)).c
  const sum = async (sql, ...args) => (await db.prepare(sql).get(...args)).v
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
  weekStart.setHours(0, 0, 0, 0)
  const collected = async (iso) =>
    (await sum("SELECT COALESCE(SUM(amount),0) AS v FROM payments WHERE status = 'Paid' AND paid_at >= ?", iso)) +
    (await sum('SELECT COALESCE(SUM(paid_amount),0) AS v FROM doc_requests WHERE paid_at >= ?', iso))
  const students = await db.prepare('SELECT user_id AS id FROM students').all()
  const states = await Promise.all(students.map(async (s) => ({ step: (await enrollmentState(s.id)).step, balance: (await balanceFor(s.id)).balance })))
  res.json({
    collectedToday: (await collected(since)),
    collectedWeek: (await collected(weekStart.toISOString())),
    awaitingDocPayment: (await count("SELECT COUNT(*) AS c FROM doc_requests WHERE status = 'For Payment'")),
    awaitingEnrollment: states.filter((s) => s.step === 3).length,
    withBalance: states.filter((s) => s.balance > 0).length,
    queueWaiting: (await count("SELECT COUNT(*) AS c FROM queue_tickets WHERE office = 'Cashier' AND queue_date = ? AND status = 'Waiting'", localDate())),
  })
})

// ---- students & balances ---------------------------------------------------------------------
router.get('/students', async (req, res) => {
  const { q, filter } = req.query
  const rows = (await Promise.all((await db
    .prepare(
      `SELECT u.id, u.name, u.login_id AS studentNo, st.program, st.year_level AS yearLevel, st.section FROM students st
       JOIN users u ON u.id = st.user_id
       ${q ? 'WHERE u.name LIKE ? OR u.login_id LIKE ?' : ''} ORDER BY u.login_id`,
    )
    .all(...(q ? [`%${String(q).trim()}%`, `%${String(q).trim()}%`] : [])))
    .map(async (s) => ({ ...s, ...(await balanceFor(s.id)), percent: (await paidPercent(s.id)), enrollment: (await enrollmentState(s.id)) }))))
    .map(({ enrollment, ...s }) => ({ ...s, enrollmentStatus: enrollment.status, enrollmentStep: enrollment.step }))
    .filter((s) => (filter === 'balance' ? s.balance > 0 : filter === 'confirm' ? s.enrollmentStep === 3 : true))
  res.json({ term: termLabel((await currentTerm())), students: rows })
})

router.get('/students/:id', async (req, res) => {
  const student = await db
    .prepare('SELECT u.id, u.name, u.login_id AS studentNo, st.program, st.year_level AS yearLevel, st.section FROM students st JOIN users u ON u.id = st.user_id WHERE u.id = ?')
    .get(req.params.id)
  if (!student) throw new HttpError(404, 'Student not found.')
  const term = await currentTerm()
  const state = await enrollmentState(student.id)
  const money = await balanceFor(student.id)
  res.json({
    term: termLabel(term),
    student,
    ...money,
    percent: (await paidPercent(student.id)),
    fees: (await db.prepare('SELECT id, name, amount FROM fees WHERE student_id = ? AND term_id = ? ORDER BY id').all(student.id, term.id)),
    payments: (await db
      .prepare(
        `SELECT p.id, p.due_on AS dueOn, p.reference, p.amount, p.status, p.method, p.paid_at AS paidAt, p.void_reason AS voidReason, u.name AS recordedBy
         FROM payments p LEFT JOIN users u ON u.id = p.recorded_by WHERE p.student_id = ? AND p.term_id = ? ORDER BY COALESCE(p.paid_at, p.due_on) DESC, p.id DESC`,
      )
      .all(student.id, term.id)),
    documentPayments: (await db
      .prepare(
        `SELECT r.id, d.name AS document, r.or_number AS orNumber, r.paid_amount AS amount, r.paid_at AS paidAt FROM doc_requests r
         JOIN doc_types d ON d.id = r.doc_type_id WHERE r.student_id = ? AND r.paid_at IS NOT NULL ORDER BY r.paid_at DESC, r.id`,
      )
      .all(student.id))
      .map((r) => ({ ...r, requestNo: reqNo(r.id) })),
    enrollment: {
      status: state.status,
      step: state.step,
      stepName: ENROLLMENT_STEPS[state.step] ?? 'Enrolled',
      awaitingPayment: state.step === 3,
      confirmed: state.enrolled,
      minPercent: (await getNumber('minPaymentPercent')),
    },
  })
})

// ---- fees (manage student balances) --------------------------------------------------------------
function feeFields(body) {
  const name = String(body?.name ?? '').trim().slice(0, 60)
  const amount = Number(body?.amount)
  if (name.length < 2) throw new HttpError(400, 'Enter the fee name.')
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) throw new HttpError(400, 'Enter an amount greater than zero.')
  return { name, amount: Math.round(amount * 100) / 100 }
}

router.post('/students/:id/fees', async (req, res) => {
  const f = feeFields(req.body)
  if (!(await db.prepare('SELECT 1 FROM students WHERE user_id = ?').get(req.params.id))) throw new HttpError(404, 'Student not found.')
  await transaction(async () => {
    await db.prepare('INSERT INTO fees (student_id, term_id, name, amount) VALUES (?,?,?,?)').run(req.params.id, (await currentTerm()).id, f.name, f.amount)
    await syncDue(Number(req.params.id))
  })
  await audit(req.user, 'fee.add', 'student', (await login(req.params.id)), `${f.name} ${peso(f.amount)}`)
  res.status(201).json({ ok: true })
})

router.put('/fees/:id', async (req, res) => {
  const f = feeFields(req.body)
  const fee = await db.prepare('SELECT * FROM fees WHERE id = ?').get(req.params.id)
  if (!fee) throw new HttpError(404, 'Fee not found.')
  await transaction(async () => {
    await db.prepare('UPDATE fees SET name = ?, amount = ? WHERE id = ?').run(f.name, f.amount, fee.id)
    await syncDue(fee.student_id)
  })
  await audit(req.user, 'fee.update', 'student', (await login(fee.student_id)), `${fee.name} ${peso(fee.amount)} → ${f.name} ${peso(f.amount)}`)
  res.json({ ok: true })
})

router.delete('/fees/:id', async (req, res) => {
  const fee = await db.prepare('SELECT * FROM fees WHERE id = ?').get(req.params.id)
  if (!fee) throw new HttpError(404, 'Fee not found.')
  await transaction(async () => {
    await db.prepare('DELETE FROM fees WHERE id = ?').run(fee.id)
    await syncDue(fee.student_id)
  })
  await audit(req.user, 'fee.delete', 'student', (await login(fee.student_id)), `${fee.name} ${peso(fee.amount)}`)
  res.json({ ok: true })
})

// ---- tuition payments -------------------------------------------------------------------------------
router.post('/students/:id/payments', async (req, res) => {
  const studentId = Number(req.params.id)
  if (!(await db.prepare('SELECT 1 FROM students WHERE user_id = ?').get(studentId))) throw new HttpError(404, 'Student not found.')
  const amount = Math.round(Number(req.body?.amount) * 100) / 100
  const method = METHODS.includes(req.body?.method) ? req.body.method : 'Cash'
  const { balance } = await balanceFor(studentId)
  if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, 'Enter the amount received.')
  if (amount > balance) throw new HttpError(400, `The student only owes ${peso(balance)}.`)
  const typedOr = String(req.body?.orNumber ?? '').trim().toUpperCase().slice(0, 20)

  const payment = await transaction(async () => {
    // the receipt number is chosen and used inside one transaction, so two cashiers can never get the same one
    const or = typedOr || (await nextOrNumber())
    if (await orInUse(or)) throw new HttpError(409, `Official receipt ${or} was already used.`)
    const row = await db
      .prepare(
        `INSERT INTO payments (student_id, term_id, due_on, reference, amount, status, method, paid_at, recorded_by)
         VALUES (?,?,?,?,?,'Paid',?,?,?) RETURNING id`,
      )
      .get(studentId, (await currentTerm()).id, localDate(), or, amount, method, nowIso(), req.user.id)
    await syncDue(studentId)
    return { ...row, or }
  })
  const or = payment.or
  await notify(studentId, `Payment of ${peso(amount)} received (${or}). Remaining balance: ${peso((await balanceFor(studentId)).balance)}.`, '/account')
  await audit(req.user, 'payment.record', 'payment', or, `${peso(amount)} (${method}) for ${(await login(studentId))}`)
  res.status(201).json({ id: payment.id, orNumber: or })
})

router.post('/payments/:id/void', async (req, res) => {
  const payment = await db.prepare("SELECT * FROM payments WHERE id = ? AND status = 'Paid'").get(req.params.id)
  if (!payment) throw new HttpError(404, 'Paid payment not found.')
  const reason = String(req.body?.reason ?? '').trim().slice(0, 200)
  if (reason.length < 3) throw new HttpError(400, 'Give a reason for voiding this receipt.')
  await transaction(async () => {
    await db.prepare("UPDATE payments SET status = 'Void', void_reason = ? WHERE id = ?").run(reason, payment.id)
    await syncDue(payment.student_id)
  })
  await notify(payment.student_id, `Receipt ${payment.reference} (${peso(payment.amount)}) was voided: ${reason}`, '/account')
  await audit(req.user, 'payment.void', 'payment', payment.reference, `${peso(payment.amount)} for ${(await login(payment.student_id))} — ${reason}`)
  res.json({ ok: true })
})

// Official receipt data (tuition payment or document fee)
router.get('/receipts/:kind/:id', async (req, res) => {
  const base = { school: (await db.prepare("SELECT value FROM settings WHERE key = 'schoolName'").get())?.value ?? 'National University Laguna', cashier: req.user.name }
  if (req.params.kind === 'payment') {
    const p = await db
      .prepare(
        `SELECT p.*, u.name AS student, u.login_id AS studentNo, c.name AS cashierName FROM payments p
         JOIN users u ON u.id = p.student_id LEFT JOIN users c ON c.id = p.recorded_by WHERE p.id = ? AND p.status = 'Paid'`,
      )
      .get(req.params.id)
    if (!p) throw new HttpError(404, 'Receipt not found.')
    return res.json({ ...base, orNumber: p.reference, student: p.student, studentNo: p.studentNo, description: `Tuition and fees — ${termLabel((await currentTerm()))}`, amount: p.amount, method: p.method ?? 'Cash', paidAt: p.paid_at, cashier: p.cashierName ?? base.cashier, balanceAfter: (await balanceFor(p.student_id)).balance })
  }
  if (req.params.kind === 'request') {
    const r = await db.prepare(`${REQUEST_SQL} WHERE r.id = ? AND r.paid_at IS NOT NULL`).get(req.params.id)
    if (!r) throw new HttpError(404, 'Receipt not found.')
    return res.json({ ...base, orNumber: r.orNumber, student: r.studentName, studentNo: r.studentNo, description: `${r.document}${r.copies > 1 ? ` × ${r.copies}` : ''} (${reqNo(r.id)})`, amount: r.paidAmount, method: 'Cash', paidAt: r.paidAt, balanceAfter: null })
  }
  throw new HttpError(404, 'Receipt not found.')
})

// ---- document payments ---------------------------------------------------------------------------------
router.get('/requests', async (req, res) => {
  const paid = req.query.status === 'paid'
  const rows = await db
    .prepare(`${REQUEST_SQL} WHERE ${paid ? 'r.paid_at IS NOT NULL' : "r.status = 'For Payment'"} ORDER BY ${paid ? 'r.paid_at DESC, r.id' : 'r.updated_at, r.id'} LIMIT 200`)
    .all()
  res.json({ requests: rows.map(withNo) })
})

router.post('/requests/:id/verify', async (req, res) => {
  const row = await db.prepare(`${REQUEST_SQL} WHERE r.id = ?`).get(req.params.id)
  if (!row) throw new HttpError(404, 'Request not found.')
  if (row.status !== 'For Payment') throw new HttpError(409, 'This request is not waiting for payment.')
  const amount = req.body?.amount == null || req.body.amount === '' ? row.totalFee : Math.round(Number(req.body.amount) * 100) / 100
  if (amount !== row.totalFee) throw new HttpError(400, `The fee for this request is exactly ${peso(row.totalFee)}.`)
  const typedOr = String(req.body?.orNumber ?? '').trim().toUpperCase().slice(0, 20)
  const { result, or } = await transaction(async () => {
    const or = typedOr || (await nextOrNumber())
    if (await orInUse(or)) throw new HttpError(409, `Official receipt ${or} was already used.`)
    const result = await moveRequest(row.id, 'Processing', req.user, {
      note: `Payment of ${peso(amount)} verified (${or})`,
      patch: { or_number: or, paid_amount: amount, paid_at: nowIso(), paid_by: req.user.id },
    })
    return { result, or }
  })
  res.json({ ...result, orNumber: or })
})

// ---- enrollment payment ----------------------------------------------------------------------------------
router.post('/students/:id/enrollment/confirm', async (req, res) => {
  const studentId = Number(req.params.id)
  const state = await enrollmentState(studentId)
  if (state.step !== 3) throw new HttpError(409, state.enrolled ? 'This student is already enrolled.' : 'The Registrar has not approved this student’s enrollment yet.')
  const percent = await paidPercent(studentId)
  const min = await getNumber('minPaymentPercent')
  if (percent < min) throw new HttpError(409, `The student has paid ${percent}% — at least ${min}% is needed to confirm enrollment.`)
  await db.prepare('UPDATE enrollment_requests SET payment_confirmed_by = ?, payment_confirmed_at = ? WHERE id = ?').run(req.user.id, nowIso(), state.request.id)
  await notify(studentId, 'Your payment is confirmed — you are now officially enrolled. Welcome!', '/enrollment')
  await audit(req.user, 'enrollment.payment-confirm', 'enrollment', (await login(studentId)), `Paid ${percent}% (minimum ${min}%)`)
  res.json({ ok: true })
})

// ---- reports ----------------------------------------------------------------------------------------------
router.get('/reports', async (req, res) => {
  const period = ['today', 'week', 'month', 'all'].includes(req.query.period) ? req.query.period : 'week'
  res.json((await collectionsReport(period)))
})

export default router
