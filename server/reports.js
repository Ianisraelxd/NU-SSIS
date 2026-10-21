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

export async function documentsReport(period) {
  const start = startOfPeriod(period)
  const rows = (await db
    .prepare(`${REQUEST_SQL} WHERE r.status <> 'Cancelled' ${start ? 'AND r.created_at >= ?' : ''} ORDER BY r.created_at DESC, r.id`)
    .all(...(start ? [start.toISOString()] : [])))
    .map(withNo)
  const released = rows.filter((r) => r.status === 'Released')
  const byType = (await db
    .prepare('SELECT name FROM doc_types ORDER BY id')
    .all())
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
      { label: 'Average Processing Time', value: fmt(avg(released.map((r) => days(new Date(r.completedAt) - new Date(r.createdAt)))), 'days') },
    ],
    chart: { title: 'Requests per Document Type', series: ['Released', 'Pending'], rows: byType },
    table: {
      columns: ['Request number', 'Student', 'Document requested', 'Date and time filed', 'Request status'],
      rows: rows.slice(0, 100).map((r) => [r.requestNo, `${r.studentName} (${r.studentNo})`, r.document, r.createdAt, r.status]),
    },
  }
}

export async function clearanceReport() {
  const students = await db.prepare('SELECT user_id AS id FROM students').all()
  const per = (await Promise.all(students.map(async (s) => clearanceSummary((await clearanceFor(s.id))))))
  const offices = {}
  for (const s of students)
    for (const row of (await clearanceFor(s.id))) {
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

export async function enrollmentReport() {
  const students = (await Promise.all((await db.prepare('SELECT user_id AS id, year_level AS year FROM students').all()).map(async (s) => ({ ...s, state: (await enrollmentState(s.id)) }))))
  const count = (status) => students.filter((s) => s.state.status === status).length
  return {
    type: 'enrollment',
    period: 'all',
    generatedAt: nowIso(),
    term: termLabel((await currentTerm())),
    stats: [
      { label: 'Students', value: students.length },
      { label: 'Enrolled', value: (await count('Enrolled')) },
      { label: 'In Progress', value: (await count('In Progress')) + (await count('Returned')) },
      { label: 'Not Started', value: (await count('Not Started')) },
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
      columns: ['Enrollment step', 'Number of students'],
      rows: [...ENROLLMENT_STEPS.slice(0, 4).map((label, i) => [label, students.filter((s) => s.state.step === i && s.state.status !== 'Enrolled').length]), ['Enrolled', (await count('Enrolled'))]],
    },
  }
}

export async function queueReport(period) {
  const start = startOfPeriod(period)
  const tickets = await db
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
      { label: 'Average Wait', value: fmt(avg(waits), 'min') },
      { label: 'Average Service Time', value: fmt(avg(services), 'min') },
    ],
    chart: { title: 'Tickets per Office', series: ['Served', 'Skipped / cancelled / waiting'], rows: byOffice },
    table: {
      columns: ['Office', 'Service requested', 'Tickets issued', 'Tickets served', 'Average wait (minutes)'],
      rows: [...perService.values()].sort((a, b) => b.total - a.total).map((r) => [r.office, r.service, r.total, r.done, r.waits.length ? avg(r.waits).toFixed(1) : '—']),
    },
  }
}

// Cashier: money collected (tuition payments + document fees)
export async function collectionsReport(period) {
  const start = startOfPeriod(period)
  const since = start ? start.toISOString() : '0000'
  const tuition = (await db
    .prepare(
      `SELECT p.id, p.reference AS orNumber, p.amount, p.paid_at AS paidAt, COALESCE(p.method, 'Cash') AS method, u.name AS student, u.login_id AS studentNo
       FROM payments p JOIN users u ON u.id = p.student_id WHERE p.status = 'Paid' AND p.paid_at >= ? ORDER BY p.paid_at DESC, p.id`,
    )
    .all(since))
    .map((r) => ({ ...r, type: 'Tuition' }))
  const docs = (await db
    .prepare(
      `SELECT r.id, r.or_number AS orNumber, r.paid_amount AS amount, r.paid_at AS paidAt, 'Cash' AS method, u.name AS student, u.login_id AS studentNo, d.name AS document
       FROM doc_requests r JOIN users u ON u.id = r.student_id JOIN doc_types d ON d.id = r.doc_type_id
       WHERE r.paid_at IS NOT NULL AND r.paid_at >= ? ORDER BY r.paid_at DESC, r.id`,
    )
    .all(since))
    .map((r) => ({ ...r, type: 'Document' }))
  const all = [...tuition, ...docs].sort((a, b) => b.paidAt.localeCompare(a.paidAt))
  const sum = (list) => list.reduce((n, r) => n + r.amount, 0)
  const methods = [...new Set(all.map((r) => r.method))]
  return {
    type: 'collections',
    period,
    generatedAt: nowIso(),
    stats: [
      { label: 'Total Collected', value: peso((await sum(all))) },
      { label: 'Tuition', value: peso((await sum(tuition))) },
      { label: 'Document Fees', value: peso((await sum(docs))) },
      { label: 'Transactions', value: all.length },
    ],
    chart: {
      title: 'Collections by Payment Method (₱)',
      series: ['Tuition', 'Documents'],
      rows: (await Promise.all(methods.map(async (m) => ({ label: m, a: (await sum(tuition.filter((r) => r.method === m))), b: (await sum(docs.filter((r) => r.method === m))) })))),
    },
    table: {
      columns: ['Official receipt number', 'Student', 'Payment type', 'Amount paid', 'Date and time paid'],
      rows: all.slice(0, 100).map((r) => [r.orNumber ?? '—', `${r.student} (${r.studentNo})`, r.type === 'Document' ? `Document · ${r.document}` : 'Tuition', peso(r.amount), r.paidAt]),
    },
  }
}

// Admin: system-wide summary
export async function systemReport() {
  const roles = ['student', 'registrar', 'cashier', 'department', 'admin']
  const count = async (sql, ...args) => (await db.prepare(sql).get(...args)).c
  const open = await count(`SELECT COUNT(*) AS c FROM doc_requests WHERE status IN (${DOC_OPEN.map(() => '?').join(',')})`, ...DOC_OPEN)
  const owing = (
    await Promise.all((await db.prepare('SELECT user_id AS id FROM students').all()).map(async (s) => (await balanceFor(s.id)).balance))
  ).filter((balance) => balance > 0).length
  return {
    type: 'system',
    period: 'all',
    generatedAt: nowIso(),
    stats: [
      { label: 'User Accounts', value: (await count('SELECT COUNT(*) AS c FROM users WHERE role <> ?', 'teacher')) },
      { label: 'Open Document Requests', value: open },
      { label: 'Students With Balance', value: owing },
      { label: 'Audit Entries', value: (await count('SELECT COUNT(*) AS c FROM audit_log')) },
    ],
    chart: {
      title: 'Accounts per Role',
      series: ['Active', 'Disabled'],
      rows: (await Promise.all(roles.map(async (r) => ({ label: r[0].toUpperCase() + r.slice(1), a: (await count('SELECT COUNT(*) AS c FROM users WHERE role = ? AND active = 1', r)), b: (await count('SELECT COUNT(*) AS c FROM users WHERE role = ? AND active = 0', r)) })))),
    },
    table: null,
  }
}
