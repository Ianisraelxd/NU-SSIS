import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'
import { db } from './db.js'

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
}

export function notifyRegistrars(message, link = null) {
  for (const { id } of db.prepare("SELECT id FROM users WHERE role='registrar'").all()) notify(id, message, link)
}

export const reqNo = (id) => `REQ-${String(id).padStart(4, '0')}`

export const ENROLLMENT_STEPS = ['Registration', 'Subject Advising', 'Fee Assessment', 'Payment', 'Enrolled']
