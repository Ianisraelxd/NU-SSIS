import { db } from './db.js'
import { DOC_OPEN, ENROLLMENT_STEPS, balanceFor, clearanceFor, clearanceSummary, currentTerm, enrollmentState, localDate, nowIso, peso, termLabel } from './util.js'
import { REQUEST_SQL, withNo } from './requests.js'

// Every report has the same shape so one page can render them all:
//   { type, period, generatedAt, stats: [{label, value}], chart: {title, series:[a,b], rows:[{label,a,b}]}, table: {columns, rows} | null }

export function startOfPeriod(period) {
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

const days = (ms) => ms / 86400000
const minutes = (ms) => ms / 60000
const avg = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null)
const fmt = (n, unit) => (n == null ? '—' : `${n.toFixed(1)} ${unit}`)

export function documentsReport(period) {
  const start = startOfPeriod(period)
  const rows = db
    .prepare(`${REQUEST_SQL} WHERE r.status <> 'Cancelled' ${start ? 'AND r.created_at >= ?' : ''} ORDER BY r.created_at DESC`)
    .all(...(start ? [start.toISOString()] : []))
    .map(withNo)
  const released = rows.filter((r) => r.status === 'Released')
  const byType = db
    .prepare('SELECT name FROM doc_types ORDER BY id')
    .all()
    .map(({ name }) => {
      const own = rows.filter((r) => r.document === name)
      const done = own.filter((r) => r.status === 'Released').length
      return { label: name, a: done, b: own.length - done }
    })
    .sort((x, y) => y.a + y.b - (x.a + x.b))
  return {
    type: 'documents',
    period,
    generatedAt: nowIso(),
    stats: [
      { label: 'Total Requests', value: rows.length },
      { label: 'Released', value: released.length },
      { label: 'Pending', value: rows.length - released.length },
      { label: 'Avg Processing Time', value: fmt(avg(released.map((r) => days(new Date(r.completedAt) - new Date(r.createdAt)))), 'days') },
    ],
    chart: { title: 'Requests per Document Type', series: ['Released', 'Pending'], rows: byType },
    table: {
      columns: ['Request', 'Student', 'Document', 'Filed', 'Status'],
      rows: rows.slice(0, 100).map((r) => [r.requestNo, `${r.studentName} (${r.studentNo})`, r.document, r.createdAt, r.status]),
    },
  }
}

export function clearanceReport() {
  const students = db.prepare('SELECT user_id AS id FROM students').all()
  const per = students.map((s) => clearanceSummary(clearanceFor(s.id)))
  const offices = {}
  for (const s of students)
    for (const row of clearanceFor(s.id)) {
      offices[row.office] ??= { cleared: 0, open: 0 }
      offices[row.office][row.status === 'Cleared' ? 'cleared' : 'open']++
    }
  return {
    type: 'clearance',
    period: 'all',
    generatedAt: nowIso(),
    stats: [
      { label: 'Students', value: students.length },
      { label: 'Fully Cleared', value: per.filter((p) => p.complete).length },
      { label: 'With Pending', value: per.filter((p) => !p.complete && !p.hold).length },
      { label: 'On Hold', value: per.filter((p) => p.hold).length },
    ],
    chart: { title: 'Clearance per Office', series: ['Cleared', 'Pending / Hold'], rows: Object.entries(offices).map(([label, v]) => ({ label, a: v.cleared, b: v.open })) },
    table: null,
  }
}

export function enrollmentReport() {
  const students = db.prepare('SELECT user_id AS id, year_level AS year FROM students').all().map((s) => ({ ...s, state: enrollmentState(s.id) }))
  const count = (status) => students.filter((s) => s.state.status === status).length
  return {
    type: 'enrollment',
    period: 'all',
    generatedAt: nowIso(),
    term: termLabel(currentTerm()),
    stats: [
      { label: 'Students', value: students.length },
      { label: 'Enrolled', value: count('Enrolled') },
      { label: 'In Progress', value: count('In Progress') + count('Returned') },
      { label: 'Not Started', value: count('Not Started') },
    ],
    chart: {
      title: 'Enrollment per Year Level',
      series: ['Enrolled', 'Not yet enrolled'],
      rows: [1, 2, 3, 4].map((y) => {
        const own = students.filter((s) => s.year === y)
        const done = own.filter((s) => s.state.enrolled).length
        return { label: `${y}${['st', 'nd', 'rd', 'th'][y - 1]} Year`, a: done, b: own.length - done }
      }),
    },
    table: {
      columns: ['Enrollment step', 'Students'],
      rows: [...ENROLLMENT_STEPS.slice(0, 4).map((label, i) => [label, students.filter((s) => s.state.step === i && s.state.status !== 'Enrolled').length]), ['Enrolled', count('Enrolled')]],
    },
  }
}

export function queueReport(period) {
  const start = startOfPeriod(period)
  const tickets = db
    .prepare(`SELECT * FROM queue_tickets ${start ? 'WHERE queue_date >= ?' : ''} ORDER BY id DESC`)
    .all(...(start ? [localDate(start)] : []))
  const served = tickets.filter((t) => t.status === 'Done')
  const waits = served.filter((t) => t.called_at).map((t) => minutes(new Date(t.called_at) - new Date(t.created_at)))
  const services = served.filter((t) => t.called_at && t.done_at).map((t) => minutes(new Date(t.done_at) - new Date(t.called_at)))
  const byOffice = ['Registrar', 'Cashier', 'Department'].map((office) => {
    const own = tickets.filter((t) => t.office === office)
    const done = own.filter((t) => t.status === 'Done').length
    return { label: office, a: done, b: own.length - done }
  })
  const perService = new Map()
  for (const t of tickets) {
    const key = `${t.office}|${t.service}`
    const row = perService.get(key) ?? { office: t.office, service: t.service, total: 0, done: 0, waits: [] }
    row.total++
    if (t.status === 'Done') {
      row.done++
      if (t.called_at) row.waits.push(minutes(new Date(t.called_at) - new Date(t.created_at)))
    }
    perService.set(key, row)
  }
  return {
    type: 'queue',
    period,
    generatedAt: nowIso(),
    stats: [
      { label: 'Queue Tickets', value: tickets.length },
      { label: 'Served', value: served.length },
      { label: 'Avg Wait', value: fmt(avg(waits), 'min') },
      { label: 'Avg Service Time', value: fmt(avg(services), 'min') },
    ],
    chart: { title: 'Tickets per Office', series: ['Served', 'Skipped / cancelled / waiting'], rows: byOffice },
    table: {
      columns: ['Office', 'Service', 'Tickets', 'Served', 'Avg wait (min)'],
      rows: [...perService.values()].sort((a, b) => b.total - a.total).map((r) => [r.office, r.service, r.total, r.done, r.waits.length ? avg(r.waits).toFixed(1) : '—']),
    },
  }
}

// Cashier: money collected (tuition payments + document fees)
export function collectionsReport(period) {
  const start = startOfPeriod(period)
  const since = start ? start.toISOString() : '0000'
  const tuition = db
    .prepare(
      `SELECT p.id, p.reference AS orNumber, p.amount, p.paid_at AS paidAt, COALESCE(p.method, 'Cash') AS method, u.name AS student, u.login_id AS studentNo
       FROM payments p JOIN users u ON u.id = p.student_id WHERE p.status = 'Paid' AND p.paid_at >= ? ORDER BY p.paid_at DESC`,
    )
    .all(since)
    .map((r) => ({ ...r, type: 'Tuition' }))
  const docs = db
    .prepare(
      `SELECT r.id, r.or_number AS orNumber, r.paid_amount AS amount, r.paid_at AS paidAt, 'Cash' AS method, u.name AS student, u.login_id AS studentNo, d.name AS document
       FROM doc_requests r JOIN users u ON u.id = r.student_id JOIN doc_types d ON d.id = r.doc_type_id
       WHERE r.paid_at IS NOT NULL AND r.paid_at >= ? ORDER BY r.paid_at DESC`,
    )
    .all(since)
    .map((r) => ({ ...r, type: 'Document' }))
  const all = [...tuition, ...docs].sort((a, b) => b.paidAt.localeCompare(a.paidAt))
  const sum = (list) => list.reduce((n, r) => n + r.amount, 0)
  const methods = [...new Set(all.map((r) => r.method))]
  return {
    type: 'collections',
    period,
    generatedAt: nowIso(),
    stats: [
      { label: 'Total Collected', value: peso(sum(all)) },
      { label: 'Tuition', value: peso(sum(tuition)) },
      { label: 'Document Fees', value: peso(sum(docs)) },
      { label: 'Transactions', value: all.length },
    ],
    chart: {
      title: 'Collections by Payment Method (₱)',
      series: ['Tuition', 'Documents'],
      rows: methods.map((m) => ({ label: m, a: sum(tuition.filter((r) => r.method === m)), b: sum(docs.filter((r) => r.method === m)) })),
    },
    table: {
      columns: ['OR number', 'Student', 'Type', 'Amount', 'Date'],
      rows: all.slice(0, 100).map((r) => [r.orNumber ?? '—', `${r.student} (${r.studentNo})`, r.type === 'Document' ? `Document · ${r.document}` : 'Tuition', peso(r.amount), r.paidAt]),
    },
  }
}

// Admin: system-wide summary
export function systemReport() {
  const roles = ['student', 'registrar', 'cashier', 'department', 'admin']
  const count = (sql, ...args) => db.prepare(sql).get(...args).c
  const open = count(`SELECT COUNT(*) AS c FROM doc_requests WHERE status IN (${DOC_OPEN.map(() => '?').join(',')})`, ...DOC_OPEN)
  const owing = db
    .prepare('SELECT user_id AS id FROM students')
    .all()
    .filter((s) => balanceFor(s.id).balance > 0).length
  return {
    type: 'system',
    period: 'all',
    generatedAt: nowIso(),
    stats: [
      { label: 'User Accounts', value: count('SELECT COUNT(*) AS c FROM users WHERE role <> ?', 'teacher') },
      { label: 'Open Document Requests', value: open },
      { label: 'Students With Balance', value: owing },
      { label: 'Audit Entries', value: count('SELECT COUNT(*) AS c FROM audit_log') },
    ],
    chart: {
      title: 'Accounts per Role',
      series: ['Active', 'Disabled'],
      rows: roles.map((r) => ({ label: r[0].toUpperCase() + r.slice(1), a: count('SELECT COUNT(*) AS c FROM users WHERE role = ? AND active = 1', r), b: count('SELECT COUNT(*) AS c FROM users WHERE role = ? AND active = 0', r) })),
    },
    table: null,
  }
}
