import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'
import { db } from './db.js'
import { publish } from './realtime.js'

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':')
  const given = scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export const nowIso = () => new Date().toISOString()

// ---- grading ---------------------------------------------------------------

export const GRADE_SCALE = [
  { min: 96, max: 100, point: 1.0, remark: 'Passed' },
  { min: 92, max: 95, point: 1.25, remark: 'Passed' },
  { min: 88, max: 91, point: 1.5, remark: 'Passed' },
  { min: 84, max: 87, point: 1.75, remark: 'Passed' },
  { min: 80, max: 83, point: 2.0, remark: 'Passed' },
  { min: 75, max: 79, point: 2.25, remark: 'Passed' },
  { min: 70, max: 74, point: 2.5, remark: 'Passed' },
  { min: 65, max: 69, point: 2.75, remark: 'Passed' },
  { min: 60, max: 64, point: 3.0, remark: 'Passed' },
  { min: 0, max: 59, point: 5.0, remark: 'Failed' },
]

export function scaleFor(average) {
  if (average == null) return null
  const rounded = Math.round(average)
  return GRADE_SCALE.find((s) => rounded >= s.min) ?? null
}

export function finalAverage(row) {
  if (row.prelim == null || row.midterm == null || row.finals == null) return null
  return (row.prelim + row.midterm + row.finals) / 3
}

export function gradeRow(row) {
  const average = finalAverage(row)
  const scale = scaleFor(average)
  return {
    ...row,
    final: average == null ? null : Math.round(average * 100) / 100,
    point: scale?.point ?? null,
    remark: scale ? scale.remark : 'In Progress',
  }
}

export function currentTerm() {
  return db.prepare('SELECT * FROM terms WHERE is_current = 1').get()
}

export const termLabel = (t) => `A.Y. ${t.school_year}, ${t.semester}`

// ---- money & clearance ------------------------------------------------------

export function balanceFor(studentId) {
  const term = currentTerm()
  if (!term) return { assessed: 0, paid: 0, balance: 0 }
  const assessed =
    db.prepare('SELECT COALESCE(SUM(amount),0) AS v FROM fees WHERE student_id=? AND term_id=?').get(studentId, term.id).v
  const paid =
    db
      .prepare("SELECT COALESCE(SUM(amount),0) AS v FROM payments WHERE student_id=? AND term_id=? AND status='Paid'")
      .get(studentId, term.id).v
  return { assessed, paid, balance: Math.max(assessed - paid, 0) }
}

export const peso = (n) => `₱${Number(n).toLocaleString('en-PH')}`

// The cashier line is derived from the real balance so it can never disagree with Account Summary.
export function clearanceFor(studentId) {
  const rows = db.prepare('SELECT * FROM clearances WHERE student_id=? ORDER BY id').all(studentId)
  const { balance } = balanceFor(studentId)
  return rows.map((row) => {
    if (row.office !== 'Cashier') return row
    return balance > 0
      ? { ...row, status: row.status === 'Hold' ? 'Hold' : 'Pending', remarks: `${peso(balance)} remaining` }
      : { ...row, status: 'Cleared', remarks: null }
  })
}

export function clearanceSummary(rows) {
  const cleared = rows.filter((r) => r.status === 'Cleared').length
  const pending = rows.filter((r) => r.status === 'Pending').length
  const hold = rows.filter((r) => r.status === 'Hold').length
  return { cleared, pending, hold, total: rows.length, complete: rows.length > 0 && cleared === rows.length }
}

// ---- notifications ----------------------------------------------------------

export function notify(userId, message, link = null) {
  const user = db.prepare('SELECT notify_inapp FROM users WHERE id=?').get(userId)
  if (!user || !user.notify_inapp) return
  db.prepare('INSERT INTO notifications (user_id, message, link, created_at) VALUES (?,?,?,?)').run(
    userId,
    message,
    link,
    nowIso(),
  )
  publish(userId, { type: 'notification' })
}

export function notifyRoles(role, message, link = null, departmentId = null) {
  const rows = departmentId
    ? db.prepare('SELECT id FROM users WHERE role = ? AND active = 1 AND department_id = ?').all(role, departmentId)
    : db.prepare('SELECT id FROM users WHERE role = ? AND active = 1').all(role)
  for (const { id } of rows) notify(id, message, link)
}

export const notifyRegistrars = (message, link = null) => notifyRoles('registrar', message, link)

export const reqNo = (id) => `REQ-${String(id).padStart(4, '0')}`

// ---- settings ---------------------------------------------------------------------------------
// Administrator-editable values (Admin → Settings). Defaults apply until a value is saved.
export const SETTING_DEFAULTS = {
  schoolName: 'National University Laguna',
  maxUnits: '24', // most units a student can enroll in per term
  minPaymentPercent: '50', // share of the assessment that must be paid before enrollment payment is confirmed
  serviceMinutes: '5', // fallback average minutes per queue ticket until real data exists
  maxCopies: '10', // most copies of a document per request
}

export function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
  return row ? row.value : SETTING_DEFAULTS[key]
}
export const getNumber = (key) => Number(getSetting(key))

// ---- audit log + request history ----------------------------------------------------------------

export function audit(user, action, entity = null, entityId = null, detail = null) {
  db.prepare(
    'INSERT INTO audit_log (user_id, actor, role, action, entity, entity_id, detail, created_at) VALUES (?,?,?,?,?,?,?,?)',
  ).run(
    user?.id ?? null,
    user ? `${user.name} (${user.login_id})` : null,
    user?.role ?? null,
    action,
    entity,
    entityId == null ? null : String(entityId),
    detail,
    nowIso(),
  )
}

export function logRequest(requestId, status, note, userId) {
  db.prepare('INSERT INTO request_history (request_id, status, note, by_user, created_at) VALUES (?,?,?,?,?)').run(
    requestId,
    status,
    note ?? null,
    userId ?? null,
    nowIso(),
  )
}

// ---- accounts ------------------------------------------------------------------------------------

export const STAFF_ROLES = ['registrar', 'cashier', 'department', 'admin']
export const tempPassword = () => randomBytes(6).toString('base64url')

export function createUser({ role, loginId, name, email = null, phone = null, password, departmentId = null }) {
  if (db.prepare('SELECT 1 FROM users WHERE login_id = ?').get(loginId)) throw new HttpError(409, `The ID ${loginId} is already in use.`)
  return db
    .prepare(
      'INSERT INTO users (role, login_id, password_hash, name, email, phone, department_id) VALUES (?,?,?,?,?,?,?) RETURNING id',
    )
    .get(role, loginId, hashPassword(password), name, email, phone, departmentId).id
}

// ---- enrollment ------------------------------------------------------------------------------------

export const ENROLLMENT_STEPS = ['Subject Selection', 'Department Review', 'Registrar Approval', 'Payment', 'Enrolled']

// Where is a student in enrolling for the current term? Derived from the request and the cashier's confirmation.
export function enrollmentState(studentId) {
  const term = currentTerm()
  const request = term
    ? db.prepare('SELECT * FROM enrollment_requests WHERE student_id = ? AND term_id = ?').get(studentId, term.id) ?? null
    : null
  let step = 0
  let status = 'Not Started'
  if (request) {
    if (request.status === 'Returned') status = 'Returned'
    else if (request.status === 'For Department Review') [step, status] = [1, 'In Progress']
    else if (request.status === 'For Registrar Approval') [step, status] = [2, 'In Progress']
    else if (request.status === 'Approved') [step, status] = request.payment_confirmed_at ? [5, 'Enrolled'] : [3, 'In Progress']
    else if (db.prepare('SELECT 1 FROM enrollment_items WHERE request_id = ?').get(request.id)) status = 'In Progress'
  }
  return { request, step, status, enrolled: step === ENROLLMENT_STEPS.length }
}

export function paidPercent(studentId) {
  const { assessed, paid } = balanceFor(studentId)
  return assessed > 0 ? Math.round((paid / assessed) * 100) : 100
}

// ---- documents --------------------------------------------------------------------------------------

export const DOC_STATUSES = ['Pending', 'For Payment', 'Processing', 'Ready for Release', 'Released', 'Cancelled']
export const DOC_OPEN = ['Pending', 'For Payment', 'Processing', 'Ready for Release']

// ---- offices (queue) -----------------------------------------------------------------------------------

export const OFFICE_OF_ROLE = { registrar: 'Registrar', cashier: 'Cashier', department: 'Department' }
export const QUEUE_SERVICES = {
  Registrar: ['Enrollment', 'Clearance', 'Grade Viewing', 'Document Request'],
  Cashier: ['Tuition Payment', 'Document Payment', 'Other Payment'],
  Department: ['Enrollment Review', 'Clearance', 'Academic Advising'],
}

// ---- chat helpers -----------------------------------------------------------

// Number of unread messages in task `t` for a user. Bind parameters: (userId, userId).
export const UNREAD_IN_TASK = `(
  SELECT COUNT(*) FROM task_messages m
  LEFT JOIN thread_reads r ON r.task_id = m.task_id AND r.user_id = ?
  WHERE m.task_id = t.id AND m.sender_id <> ? AND m.deleted_at IS NULL AND m.id > COALESCE(r.last_read_id, 0)
)`

export const MESSAGE_COLUMNS = `m.id, m.task_id AS taskId, m.sender_id AS senderId,
  CASE WHEN m.deleted_at IS NULL THEN m.body ELSE '' END AS body,
  m.created_at AS createdAt, m.edited_at AS editedAt, (m.deleted_at IS NOT NULL) AS deleted`

export const shapeMessage = (m) => ({ ...m, deleted: !!m.deleted })

// Today's date in the server's local time (YYYY-MM-DD) — queue numbers restart every day.
export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const startOfDayIso = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}
