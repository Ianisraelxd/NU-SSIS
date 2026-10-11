import { Router } from 'express'
import { db, transaction } from '../db.js'
import { HttpError, OFFICE_OF_ROLE, QUEUE_SERVICES, getNumber, localDate, nowIso, notify } from '../util.js'
import { requireAuth } from './auth.js'

// Digital queue. Students take a numbered ticket for an office; staff call the next one.
// Fields mirror the queue data-flow diagram: queue id, student, service type, queue number, status,
// timestamp, estimated wait time and counter assignment.
const router = Router()
const student = requireAuth('student')
const staff = requireAuth(['registrar', 'cashier', 'department'])

const PREFIX = { Registrar: 'R', Cashier: 'C', Department: 'D' }

// Tickets of one office queue for today (department queues are separate per department).
function scope(office, departmentId) {
  return office === 'Department'
    ? { sql: 'office = ? AND queue_date = ? AND department_id = ?', args: [office, localDate(), departmentId] }
    : { sql: 'office = ? AND queue_date = ?', args: [office, localDate()] }
}

function avgMinutes(office, departmentId) {
  const rows = db
    .prepare(
      `SELECT called_at, done_at FROM queue_tickets
       WHERE office = ? AND status = 'Done' AND called_at IS NOT NULL AND done_at IS NOT NULL
         ${office === 'Department' ? 'AND department_id = ?' : ''}
       ORDER BY id DESC LIMIT 50`,
    )
    .all(...(office === 'Department' ? [office, departmentId] : [office]))
  if (!rows.length) return getNumber('serviceMinutes')
  const total = rows.reduce((n, r) => n + (new Date(r.done_at) - new Date(r.called_at)) / 60000, 0)
  return Math.max(1, Math.round((total / rows.length) * 10) / 10)
}

function shape(t) {
  const sc = scope(t.office, t.department_id)
  const ahead =
    t.status === 'Waiting'
      ? db.prepare(`SELECT COUNT(*) AS c FROM queue_tickets WHERE ${sc.sql} AND status = 'Waiting' AND seq < ?`).get(...sc.args, t.seq).c
      : 0
  const serving = db.prepare(`SELECT COUNT(*) AS c FROM queue_tickets WHERE ${sc.sql} AND status = 'Serving'`).get(...sc.args).c
  const avg = avgMinutes(t.office, t.department_id)
  return {
    id: t.id,
    number: t.number,
    office: t.office,
    service: t.service,
    status: t.status,
    counter: t.counter,
    createdAt: t.created_at,
    calledAt: t.called_at,
    doneAt: t.done_at,
    position: t.status === 'Waiting' ? ahead + 1 : null,
    ahead,
    estMinutes: t.status === 'Waiting' ? Math.max(1, Math.round(ahead * avg + (serving ? avg / 2 : 0))) : 0,
    nowServing: db
      .prepare(`SELECT number, counter FROM queue_tickets WHERE ${sc.sql} AND status = 'Serving' ORDER BY called_at`)
      .all(...sc.args),
  }
}

const studentDept = (id) => db.prepare('SELECT department_id AS d FROM students WHERE user_id = ?').get(id)?.d ?? null

// ---- student ----------------------------------------------------------------------------------------

router.get('/offices', student, (req, res) => {
  const dept = studentDept(req.user.id)
  const offices = Object.keys(QUEUE_SERVICES).map((office) => {
    const sc = scope(office, dept)
    const count = (status) => db.prepare(`SELECT COUNT(*) AS c FROM queue_tickets WHERE ${sc.sql} AND status = ?`).get(...sc.args, status).c
    return {
      office,
      label: office === 'Department' ? `Department${dept ? ` (${db.prepare('SELECT code FROM departments WHERE id = ?').get(dept)?.code})` : ''}` : office,
      services: QUEUE_SERVICES[office],
      unavailable: office === 'Department' && !dept ? 'Your record has no department yet.' : null,
      waiting: count('Waiting'),
      nowServing: db.prepare(`SELECT number, counter FROM queue_tickets WHERE ${sc.sql} AND status = 'Serving' ORDER BY called_at`).all(...sc.args),
      avgMinutes: avgMinutes(office, dept),
    }
  })
  res.json({ offices })
})

router.get('/mine', student, (req, res) => {
  const active = db
    .prepare(`SELECT * FROM queue_tickets WHERE student_id = ? AND queue_date = ? AND status IN ('Waiting','Serving') ORDER BY id DESC LIMIT 1`)
    .get(req.user.id, localDate())
  const history = db
    .prepare(`SELECT * FROM queue_tickets WHERE student_id = ? ORDER BY id DESC LIMIT 8`)
    .all(req.user.id)
    .map((t) => ({ id: t.id, number: t.number, office: t.office, service: t.service, status: t.status, createdAt: t.created_at, queueDate: t.queue_date }))
  res.json({ ticket: active ? shape(active) : null, history })
})

router.post('/tickets', student, (req, res) => {
  const { office, service } = req.body ?? {}
  if (!QUEUE_SERVICES[office]) throw new HttpError(400, 'Choose an office.')
  if (!QUEUE_SERVICES[office].includes(service)) throw new HttpError(400, 'Choose a service.')
  const dept = office === 'Department' ? studentDept(req.user.id) : null
  if (office === 'Department' && !dept) throw new HttpError(409, 'Your record has no department yet. Ask the Registrar to update it.')
  const open = db
    .prepare(`SELECT number, office FROM queue_tickets WHERE student_id = ? AND queue_date = ? AND status IN ('Waiting','Serving')`)
    .get(req.user.id, localDate())
  if (open) throw new HttpError(409, `You already have an active ticket (${open.number} at ${open.office}). Cancel it first to take another.`)

  const ticket = transaction(() => {
    const sc = scope(office, dept)
    const seq = db.prepare(`SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM queue_tickets WHERE ${sc.sql}`).get(...sc.args).n
    const waiting = db.prepare(`SELECT COUNT(*) AS c FROM queue_tickets WHERE ${sc.sql} AND status = 'Waiting'`).get(...sc.args).c
    const est = Math.round(waiting * avgMinutes(office, dept))
    return db
      .prepare(
        `INSERT INTO queue_tickets (student_id, office, service, department_id, queue_date, seq, number, est_wait_min, created_at)
         VALUES (?,?,?,?,?,?,?,?,?) RETURNING *`,
      )
      .get(req.user.id, office, service, dept, localDate(), seq, `${PREFIX[office]}-${String(seq).padStart(3, '0')}`, est, nowIso())
  })
  res.status(201).json({ ticket: shape(ticket) })
})

router.delete('/tickets/:id', student, (req, res) => {
  const info = db
    .prepare(`UPDATE queue_tickets SET status = 'Cancelled', done_at = ? WHERE id = ? AND student_id = ? AND status = 'Waiting'`)
    .run(nowIso(), req.params.id, req.user.id)
  if (!info.changes) throw new HttpError(409, 'Only a waiting ticket can be cancelled.')
  res.json({ ok: true })
})

// ---- staff (registrar, cashier, department) --------------------------------------------------------------

const staffScope = (user) => {
  const office = OFFICE_OF_ROLE[user.role]
  if (office === 'Department' && !user.department_id) throw new HttpError(409, 'Your account has no department. Ask the administrator to assign one.')
  return { office, dept: office === 'Department' ? user.department_id : null }
}

const row = (t) => ({
  id: t.id,
  number: t.number,
  service: t.service,
  status: t.status,
  counter: t.counter,
  createdAt: t.created_at,
  calledAt: t.called_at,
  studentName: t.student_name,
  studentNo: t.student_no,
  servedBy: t.served_by,
})

const TICKET_JOIN = `SELECT q.*, u.name AS student_name, u.login_id AS student_no FROM queue_tickets q JOIN users u ON u.id = q.student_id`

router.get('/staff', staff, (req, res) => {
  const { office, dept } = staffScope(req.user)
  const sc = scope(office, dept)
  const where = sc.sql.replaceAll(/\b(office|queue_date|department_id)\b/g, 'q.$1')
  const mine = db.prepare(`${TICKET_JOIN} WHERE ${where} AND q.status = 'Serving' AND q.served_by = ? ORDER BY q.called_at`).all(...sc.args, req.user.id)
  const others = db.prepare(`${TICKET_JOIN} WHERE ${where} AND q.status = 'Serving' AND (q.served_by IS NULL OR q.served_by <> ?) ORDER BY q.called_at`).all(...sc.args, req.user.id)
  const waiting = db.prepare(`${TICKET_JOIN} WHERE ${where} AND q.status = 'Waiting' ORDER BY q.seq`).all(...sc.args)
  const recent = db.prepare(`${TICKET_JOIN} WHERE ${where} AND q.status IN ('Done','Skipped','Cancelled') ORDER BY q.id DESC LIMIT 10`).all(...sc.args)
  const count = (status) => db.prepare(`SELECT COUNT(*) AS c FROM queue_tickets WHERE ${sc.sql} AND status = ?`).get(...sc.args, status).c
  res.json({
    office,
    department: dept ? db.prepare('SELECT code, name FROM departments WHERE id = ?').get(dept) : null,
    services: QUEUE_SERVICES[office],
    mine: mine.map(row),
    others: others.map(row),
    waiting: waiting.map((t, i) => ({ ...row(t), position: i + 1 })),
    recent: recent.map(row),
    stats: { served: count('Done'), skipped: count('Skipped'), waiting: waiting.length, avgMinutes: avgMinutes(office, dept) },
  })
})

router.post('/staff/next', staff, (req, res) => {
  const { office, dept } = staffScope(req.user)
  const sc = scope(office, dept)
  const counter = String(req.body?.counter ?? '').trim().slice(0, 30) || 'Counter 1'
  const current = db.prepare(`SELECT number FROM queue_tickets WHERE ${sc.sql} AND status = 'Serving' AND served_by = ?`).get(...sc.args, req.user.id)
  if (current) throw new HttpError(409, `Finish ${current.number} first — mark it done or skip it.`)

  const next = db.prepare(`SELECT * FROM queue_tickets WHERE ${sc.sql} AND status = 'Waiting' ORDER BY seq LIMIT 1`).get(...sc.args)
  if (!next) throw new HttpError(404, 'Nobody is waiting.')
  db.prepare(`UPDATE queue_tickets SET status = 'Serving', counter = ?, served_by = ?, called_at = ? WHERE id = ?`).run(counter, req.user.id, nowIso(), next.id)
  notify(next.student_id, `Your queue number ${next.number} is now being served at ${counter}.`, '/queue')

  // heads-up for whoever is now third in line
  const third = db.prepare(`SELECT * FROM queue_tickets WHERE ${sc.sql} AND status = 'Waiting' ORDER BY seq LIMIT 1 OFFSET 2`).get(...sc.args)
  if (third) notify(third.student_id, `Almost your turn: ${third.number} is 3 numbers away. Please be near ${office === 'Department' ? 'the department' : `the ${office}`} office.`, '/queue')

  res.json({ ticket: { id: next.id, number: next.number, counter } })
})

function finish(status, notice) {
  return (req, res) => {
    const { office, dept } = staffScope(req.user)
    const sc = scope(office, dept)
    const t = db.prepare(`SELECT * FROM queue_tickets WHERE id = ? AND ${sc.sql} AND status = 'Serving' AND served_by = ?`).get(req.params.id, ...sc.args, req.user.id)
    if (!t) throw new HttpError(409, 'That ticket is not being served by you.')
    db.prepare('UPDATE queue_tickets SET status = ?, done_at = ? WHERE id = ?').run(status, nowIso(), t.id)
    if (notice) notify(t.student_id, notice(t), '/queue')
    res.json({ ok: true })
  }
}

router.post('/staff/:id/done', staff, finish('Done'))
router.post('/staff/:id/skip', staff, finish('Skipped', (t) => `Your number ${t.number} was skipped because you were not at the counter. You can take a new number.`))

export default router
