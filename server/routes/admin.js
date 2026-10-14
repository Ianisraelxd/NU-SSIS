import { Router } from 'express'
import { db, transaction } from '../db.js'
import { FEATURES } from '../config.js'
import {
  HttpError,
  SETTING_DEFAULTS,
  STAFF_ROLES,
  audit,
  createUser,
  currentTerm,
  getSetting,
  hashPassword,
  localDate,
  startOfDayIso,
  tempPassword,
  termLabel,
} from '../util.js'
import { clearanceReport, collectionsReport, documentsReport, enrollmentReport, queueReport, systemReport } from '../reports.js'
import { mountAnnouncements } from './announcements.js'
import { requireAuth } from './auth.js'

const router = Router()
router.use(requireAuth('admin'))

const ROLES = ['student', 'registrar', 'cashier', 'department', 'admin', ...(FEATURES.lms ? ['teacher'] : [])]

mountAnnouncements(router)

// ---- overview -------------------------------------------------------------------------------------
router.get('/overview', async (_req, res) => {
  const count = async (sql, ...args) => (await db.prepare(sql).get(...args)).c
  const roles = Object.fromEntries((await Promise.all(ROLES.map(async (r) => [r, (await count('SELECT COUNT(*) AS c FROM users WHERE role = ? AND active = 1', r))]))))
  res.json({
    roles,
    disabled: (await count('SELECT COUNT(*) AS c FROM users WHERE active = 0')),
    locked: (await count('SELECT COUNT(*) AS c FROM users WHERE locked_until > ?', new Date().toISOString())),
    openRequests: (await count("SELECT COUNT(*) AS c FROM doc_requests WHERE status IN ('Pending','For Payment','Processing','Ready for Release')")),
    ticketsToday: (await count('SELECT COUNT(*) AS c FROM queue_tickets WHERE queue_date = ?', localDate())),
    failedLogins24h: (await count("SELECT COUNT(*) AS c FROM audit_log WHERE action = 'login.failed' AND created_at >= ?", new Date(Date.now() - 86400000).toISOString())),
    collectedToday:
      (await db.prepare("SELECT COALESCE(SUM(amount),0) AS v FROM payments WHERE status = 'Paid' AND paid_at >= ?").get(startOfDayIso())).v +
      (await db.prepare('SELECT COALESCE(SUM(paid_amount),0) AS v FROM doc_requests WHERE paid_at >= ?').get(startOfDayIso())).v,
    recent: (await db.prepare('SELECT actor, role, action, detail, created_at AS createdAt FROM audit_log ORDER BY id DESC LIMIT 8').all()),
    term: termLabel((await currentTerm())),
  })
})

// ---- user accounts ---------------------------------------------------------------------------------
const USER_SQL = `
  SELECT u.id, u.role, u.login_id AS loginId, u.name, u.email, u.phone, u.active, u.locked_until AS lockedUntil,
         u.department_id AS departmentId, d.code AS deptCode, u.created_at AS createdAt
  FROM users u LEFT JOIN departments d ON d.id = u.department_id`

router.get('/users', async (req, res) => {
  const { role, q, status } = req.query
  const where = [`u.role IN (${ROLES.map(() => '?').join(',')})`]
  const params = [...ROLES]
  if (role && role !== 'all') {
    where.push('u.role = ?')
    params.push(role)
  }
  if (q) {
    where.push('(u.name LIKE ? OR u.login_id LIKE ? OR u.email LIKE ?)')
    params.push(`%${String(q).trim()}%`, `%${String(q).trim()}%`, `%${String(q).trim()}%`)
  }
  if (status === 'active') where.push('u.active = 1')
  if (status === 'disabled') where.push('u.active = 0')
  const rows = await db.prepare(`${USER_SQL} WHERE ${where.join(' AND ')} ORDER BY u.role, u.login_id LIMIT 500`).all(...params)
  const now = new Date().toISOString()
  res.json({ roles: ROLES, users: rows.map((u) => ({ ...u, active: !!u.active, locked: !!u.lockedUntil && u.lockedUntil > now })) })
})

async function userFields(body, { creating }) {
  const clean = (v, max) => String(v ?? '').trim().slice(0, max)
  const name = clean(body.name, 80)
  if (name.length < 2) throw new HttpError(400, 'Enter the full name.')
  const email = clean(body.email, 120)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.')
  const role = body.role
  if (creating && !STAFF_ROLES.includes(role)) throw new HttpError(400, 'Choose a role. (Student accounts are created by the Registrar in Student Records.)')
  const departmentId = body.departmentId ? Number(body.departmentId) : null
  if (departmentId && !(await db.prepare('SELECT 1 FROM departments WHERE id = ?').get(departmentId))) throw new HttpError(400, 'Unknown department.')
  if (role === 'department' && !departmentId) throw new HttpError(400, 'Department staff must be assigned to a department.')
  return { name, email: email || null, phone: clean(body.phone, 20) || null, role, departmentId: role === 'department' ? departmentId : null }
}

router.post('/users', async (req, res) => {
  const f = await userFields(req.body ?? {}, { creating: true })
  const loginId = String(req.body?.loginId ?? '').trim()
  if (!/^[A-Za-z0-9-]{3,20}$/.test(loginId)) throw new HttpError(400, 'The ID must be 3–20 letters, digits or dashes (e.g. CSH-0002).')
  const password = tempPassword()
  const id = await createUser({ role: f.role, loginId, name: f.name, email: f.email, phone: f.phone, password, departmentId: f.departmentId })
  await audit(req.user, 'user.create', 'user', loginId, `${f.role}: ${f.name}`)
  res.status(201).json({ id, loginId, tempPassword: password })
})

router.patch('/users/:id', async (req, res) => {
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!user) throw new HttpError(404, 'User not found.')
  const body = req.body ?? {}
  const isSelf = user.id === req.user.id
  const changes = []

  if (typeof body.active === 'boolean' && body.active !== !!user.active) {
    if (isSelf) throw new HttpError(409, 'You cannot disable your own account.')
    if (!body.active && user.role === 'admin' && (await db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND active = 1").get()).c <= 1)
      throw new HttpError(409, 'At least one administrator must stay active.')
    await db.prepare('UPDATE users SET active = ? WHERE id = ?').run(body.active ? 1 : 0, user.id)
    if (!body.active) await db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id)
    changes.push(body.active ? 'enabled' : 'disabled')
  }
  if (body.unlock) {
    await db.prepare('UPDATE users SET locked_until = NULL, failed_logins = 0 WHERE id = ?').run(user.id)
    changes.push('unlocked')
  }
  if (body.name !== undefined || body.email !== undefined || body.role !== undefined || body.departmentId !== undefined) {
    const staff = STAFF_ROLES.includes(user.role)
    const role = staff && body.role ? body.role : user.role
    if (body.role && body.role !== user.role) {
      if (!staff) throw new HttpError(409, 'Student roles cannot be changed here.')
      if (!STAFF_ROLES.includes(body.role)) throw new HttpError(400, 'Choose a staff role.')
      if (isSelf) throw new HttpError(409, 'You cannot change your own role.')
      if (user.role === 'admin' && (await db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND active = 1").get()).c <= 1)
        throw new HttpError(409, 'At least one administrator must stay active.')
    }
    const f = await userFields({ name: body.name ?? user.name, email: body.email ?? user.email, phone: body.phone ?? user.phone, role, departmentId: body.departmentId ?? user.department_id }, { creating: false })
    await db.prepare('UPDATE users SET name = ?, email = ?, phone = ?, role = ?, department_id = ? WHERE id = ?').run(f.name, f.email, f.phone, role, role === 'department' ? f.departmentId : user.role === 'student' ? user.department_id : null, user.id)
    if (role !== user.role) changes.push(`role ${user.role} → ${role}`)
    else changes.push('details updated')
  }
  if (changes.length) await audit(req.user, 'user.update', 'user', user.login_id, changes.join(', '))
  res.json({ ok: true })
})

router.post('/users/:id/reset-password', async (req, res) => {
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!user) throw new HttpError(404, 'User not found.')
  const password = tempPassword()
  await transaction(async () => {
    await db.prepare('UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = NULL WHERE id = ?').run(hashPassword(password), user.id)
    await db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id)
  })
  await audit(req.user, 'user.reset-password', 'user', user.login_id)
  res.json({ loginId: user.login_id, tempPassword: password })
})

// ---- departments & programs -----------------------------------------------------------------------------
router.get('/departments', async (_req, res) => {
  const departments = await db
    .prepare(
      `SELECT d.id, d.code, d.name,
              (SELECT COUNT(*) FROM students s WHERE s.department_id = d.id) AS students,
              (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id AND u.role = 'department') AS staff
       FROM departments d ORDER BY d.code`,
    )
    .all()
  const programs = await db.prepare('SELECT p.id, p.code, p.name, p.department_id AS departmentId FROM programs p ORDER BY p.code').all()
  res.json({ departments: departments.map((d) => ({ ...d, programs: programs.filter((p) => p.departmentId === d.id) })) })
})

function codeName(body, label) {
  const code = String(body?.code ?? '').trim().toUpperCase().slice(0, 12)
  const name = String(body?.name ?? '').trim().slice(0, 100)
  if (!/^[A-Z0-9-]{2,12}$/.test(code)) throw new HttpError(400, `${label} code must be 2–12 letters or digits.`)
  if (name.length < 3) throw new HttpError(400, `Enter the ${label.toLowerCase()} name.`)
  return { code, name }
}

router.post('/departments', async (req, res) => {
  const { code, name } = codeName(req.body, 'Department')
  if ((await db.prepare('SELECT 1 FROM departments WHERE code = ?').get(code))) throw new HttpError(409, `${code} already exists.`)
  await db.prepare('INSERT INTO departments (code, name) VALUES (?,?)').run(code, name)
  await audit(req.user, 'department.create', 'department', code, name)
  res.status(201).json({ ok: true })
})

router.put('/departments/:id', async (req, res) => {
  const { code, name } = codeName(req.body, 'Department')
  if ((await db.prepare('SELECT 1 FROM departments WHERE code = ? AND id <> ?').get(code, req.params.id))) throw new HttpError(409, `${code} already exists.`)
  const info = await db.prepare('UPDATE departments SET code = ?, name = ? WHERE id = ?').run(code, name, req.params.id)
  if (!info.changes) throw new HttpError(404, 'Department not found.')
  await audit(req.user, 'department.update', 'department', code, name)
  res.json({ ok: true })
})

router.delete('/departments/:id', async (req, res) => {
  const d = await db.prepare('SELECT code FROM departments WHERE id = ?').get(req.params.id)
  if (!d) throw new HttpError(404, 'Department not found.')
  const used = (await db.prepare('SELECT (SELECT COUNT(*) FROM students WHERE department_id = ?) + (SELECT COUNT(*) FROM users WHERE department_id = ?) AS c').get(req.params.id, req.params.id)).c
  if (used) throw new HttpError(409, 'This department still has students or staff. Reassign them first.')
  await db.prepare('DELETE FROM departments WHERE id = ?').run(req.params.id)
  await audit(req.user, 'department.delete', 'department', d.code)
  res.json({ ok: true })
})

router.post('/programs', async (req, res) => {
  const { code, name } = codeName(req.body, 'Program')
  const departmentId = Number(req.body?.departmentId)
  if (!(await db.prepare('SELECT 1 FROM departments WHERE id = ?').get(departmentId))) throw new HttpError(400, 'Choose a department.')
  if ((await db.prepare('SELECT 1 FROM programs WHERE code = ?').get(code))) throw new HttpError(409, `${code} already exists.`)
  await db.prepare('INSERT INTO programs (department_id, code, name) VALUES (?,?,?)').run(departmentId, code, name)
  await audit(req.user, 'program.create', 'program', code, name)
  res.status(201).json({ ok: true })
})

router.put('/programs/:id', async (req, res) => {
  const { code, name } = codeName(req.body, 'Program')
  if ((await db.prepare('SELECT 1 FROM programs WHERE code = ? AND id <> ?').get(code, req.params.id))) throw new HttpError(409, `${code} already exists.`)
  const info = await db.prepare('UPDATE programs SET code = ?, name = ? WHERE id = ?').run(code, name, req.params.id)
  if (!info.changes) throw new HttpError(404, 'Program not found.')
  await audit(req.user, 'program.update', 'program', code, name)
  res.json({ ok: true })
})

router.delete('/programs/:id', async (req, res) => {
  const p = await db.prepare('SELECT code FROM programs WHERE id = ?').get(req.params.id)
  await db.prepare('DELETE FROM programs WHERE id = ?').run(req.params.id)
  if (p) await audit(req.user, 'program.delete', 'program', p.code)
  res.json({ ok: true })
})

// ---- system settings ---------------------------------------------------------------------------------------
const SETTING_RULES = {
  schoolName: { label: 'School name', type: 'text', check: (v) => v.length >= 3 && v.length <= 80, hint: '3–80 characters' },
  maxUnits: { label: 'Maximum units per term', type: 'number', check: (v) => Number.isInteger(+v) && +v >= 12 && +v <= 30, hint: 'Whole number, 12–30' },
  minPaymentPercent: { label: 'Minimum payment to confirm enrollment (%)', type: 'number', check: (v) => Number.isInteger(+v) && +v >= 0 && +v <= 100, hint: 'Whole number, 0–100' },
  serviceMinutes: { label: 'Default minutes per queue ticket', type: 'number', check: (v) => +v >= 1 && +v <= 60, hint: 'Used for wait estimates until there is real data, 1–60' },
  maxCopies: { label: 'Maximum copies per document request', type: 'number', check: (v) => Number.isInteger(+v) && +v >= 1 && +v <= 20, hint: 'Whole number, 1–20' },
}

router.get('/settings', async (_req, res) => {
  res.json({
    settings: (await Promise.all(Object.entries(SETTING_RULES).map(async ([key, r]) => ({ key, label: r.label, type: r.type, hint: r.hint, value: (await getSetting(key)), default: SETTING_DEFAULTS[key] })))),
  })
})

router.put('/settings', async (req, res) => {
  const values = req.body?.values ?? {}
  const changed = []
  for (const [key, raw] of Object.entries(values)) {
    const rule = SETTING_RULES[key]
    if (!rule) throw new HttpError(400, `Unknown setting “${key}”.`)
    if (typeof raw !== 'string' && typeof raw !== 'number') throw new HttpError(400, `${rule.label}: enter a single value.`)
    const value = String(raw).trim()
    if (!rule.check(value)) throw new HttpError(400, `${rule.label}: ${rule.hint}.`)
    if (value !== (await getSetting(key))) {
      await db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
      changed.push(`${key} = ${value}`)
    }
  }
  if (changed.length) await audit(req.user, 'settings.update', 'settings', null, changed.join('; '))
  res.json({ ok: true, changed: changed.length })
})

// ---- academic terms ----------------------------------------------------------------------------------------------
router.get('/terms', async (_req, res) => {
  res.json({
    terms: (await db
      .prepare('SELECT id, school_year AS schoolYear, semester, is_current AS isCurrent FROM terms ORDER BY school_year DESC, semester')
      .all())
      .map((t) => ({ ...t, isCurrent: !!t.isCurrent, label: termLabel({ school_year: t.schoolYear, semester: t.semester }) })),
  })
})

router.post('/terms', async (req, res) => {
  const schoolYear = String(req.body?.schoolYear ?? '').trim()
  const semester = String(req.body?.semester ?? '').trim()
  if (!/^\d{4}-\d{4}$/.test(schoolYear)) throw new HttpError(400, 'School year must look like 2026-2027.')
  if (!['First Semester', 'Second Semester', 'Summer'].includes(semester)) throw new HttpError(400, 'Choose a semester.')
  if ((await db.prepare('SELECT 1 FROM terms WHERE school_year = ? AND semester = ?').get(schoolYear, semester))) throw new HttpError(409, 'That term already exists.')
  await db.prepare('INSERT INTO terms (school_year, semester) VALUES (?,?)').run(schoolYear, semester)
  await audit(req.user, 'term.create', 'term', `${schoolYear} ${semester}`)
  res.status(201).json({ ok: true })
})

router.put('/terms/current', async (req, res) => {
  const id = Number(req.body?.termId)
  if (!(await db.prepare('SELECT 1 FROM terms WHERE id = ?').get(id))) throw new HttpError(404, 'Term not found.')
  await transaction(async () => {
    await db.exec('UPDATE terms SET is_current = 0')
    await db.prepare('UPDATE terms SET is_current = 1 WHERE id = ?').run(id)
  })
  await audit(req.user, 'term.current', 'term', id)
  res.json({ ok: true })
})

// ---- audit log ---------------------------------------------------------------------------------------------------
router.get('/login-attempts', async (req, res) => {
  const { q, result } = req.query
  const where = []
  const params = []
  if (q) {
    const like = `%${String(q).trim()}%`
    where.push('(login_id LIKE ? OR ip LIKE ? OR reason LIKE ?)')
    params.push(like, like, like)
  }
  if (result === 'success') where.push('success = 1')
  if (result === 'failed') where.push('success = 0')
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200)
  const offset = Math.max(Number(req.query.offset) || 0, 0)
  res.json({
    total: (await db.prepare(`SELECT COUNT(*) AS c FROM login_attempts ${clause}`).get(...params)).c,
    failed24h: (await db.prepare('SELECT COUNT(*) AS c FROM login_attempts WHERE success = 0 AND created_at >= ?').get(new Date(Date.now() - 86400000).toISOString())).c,
    rows: (await db
      .prepare(`SELECT id, login_id AS loginId, role, success, reason, ip, created_at AS createdAt FROM login_attempts ${clause} ORDER BY id DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset)),
  })
})

router.get('/audit', async (req, res) => {
  const { q, role } = req.query
  const where = []
  const params = []
  if (q) {
    where.push('(actor LIKE ? OR action LIKE ? OR detail LIKE ? OR entity_id LIKE ?)')
    const like = `%${String(q).trim()}%`
    params.push(like, like, like, like)
  }
  if (role && role !== 'all') {
    where.push('role = ?')
    params.push(role)
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200)
  const offset = Math.max(Number(req.query.offset) || 0, 0)
  res.json({
    total: (await db.prepare(`SELECT COUNT(*) AS c FROM audit_log ${clause}`).get(...params)).c,
    rows: (await db
      .prepare(`SELECT id, actor, role, action, entity, entity_id AS entityId, detail, created_at AS createdAt FROM audit_log ${clause} ORDER BY id DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset)),
  })
})

// ---- roles & permissions (what each module may do) ----------------------------------------------------------------------
const PERMISSIONS = [
  ['Account', 'Sign in, edit own profile, change password', 'full', 'full', 'full', 'full', 'full'],
  ['Account', 'Create and disable user accounts, reset passwords', '—', '—', '—', '—', 'full'],
  ['Account', 'Assign roles and departments', '—', '—', '—', '—', 'full'],
  ['Student records', 'View own information (subjects, schedule, grades)', 'full', '—', '—', '—', '—'],
  ['Student records', 'Add, edit and verify student records', '—', 'full', '—', '—', '—'],
  ['Student records', 'View students of the own department', '—', 'all students', '—', 'own dept', '—'],
  ['Enrollment', 'Select subjects and submit enrollment', 'full', '—', '—', '—', '—'],
  ['Enrollment', 'Review subject requests', '—', '—', '—', 'own dept', '—'],
  ['Enrollment', 'Approve or return enrollment', '—', 'full', '—', '—', '—'],
  ['Enrollment', 'Confirm enrollment payment', '—', '—', 'full', '—', '—'],
  ['Academics', 'Manage subjects and class schedules', '—', 'full', '—', '—', '—'],
  ['Academics', 'Enter and update grades', '—', 'full', '—', '—', '—'],
  ['Academics', 'View student grades', 'own', 'all students', '—', 'own dept (logged)', '—'],
  ['Academics', 'Verify academic requirements', '—', '—', '—', 'own dept', '—'],
  ['Clearance', 'View clearance status', 'own', 'all students', '—', 'own dept', '—'],
  ['Clearance', 'Update clearance lines', '—', 'library, lab, guidance, registrar', '(follows balance)', 'department line', '—'],
  ['Documents', 'Request documents and track status', 'full', '—', '—', '—', '—'],
  ['Documents', 'Approve, process and release requests', '—', 'full', '—', '—', '—'],
  ['Documents', 'Verify document payments', '—', '—', 'full', '—', '—'],
  ['Payments', 'View own balance and transactions', 'own', '—', '—', '—', '—'],
  ['Payments', 'Record payments, manage fees, issue receipts', '—', '—', 'full', '—', '—'],
  ['Queue', 'Take a queue number', 'full', '—', '—', '—', '—'],
  ['Queue', 'Call next, finish and skip tickets', '—', 'Registrar queue', 'Cashier queue', 'Department queue', '—'],
  ['Reports', 'Document, enrollment, clearance and queue reports', '—', 'full', '—', '—', 'full'],
  ['Reports', 'Collection reports', '—', '—', 'full', '—', 'full'],
  ['System', 'Announcements', 'read', 'full', '—', '—', 'full'],
  ['System', 'Settings, departments, programs and academic terms', '—', 'terms and document fees', '—', '—', 'full'],
  ['System', 'Audit log', '—', '—', '—', '—', 'full'],
]
router.get('/permissions', (_req, res) => {
  res.json({
    roles: ['Student', 'Registrar', 'Cashier', 'Department', 'Admin'],
    rows: PERMISSIONS.map(([area, capability, ...access]) => ({ area, capability, access })),
  })
})

// ---- reports ---------------------------------------------------------------------------------------------------------------
router.get('/reports', async (req, res) => {
  const period = ['today', 'week', 'month', 'all'].includes(req.query.period) ? req.query.period : 'week'
  const builders = {
    system: async () => await systemReport(),
    documents: async () => await documentsReport(period),
    enrollment: async () => await enrollmentReport(),
    clearance: async () => await clearanceReport(),
    queue: async () => await queueReport(period),
    collections: async () => await collectionsReport(period),
  }
  const build = builders[req.query.type ?? 'system']
  if (!build) throw new HttpError(400, 'Unknown report type.')
  res.json(await build())
})

export default router
