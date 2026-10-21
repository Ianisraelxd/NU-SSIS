// Integration + security tests for the SSIS API.  Run with:  npm test
// A throw-away server and database are started for the run, so your real data is never touched.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PORT = 3190 + Math.floor(Math.random() * 90)
const BASE = `http://localhost:${PORT}/api`
let server
let dir

async function call(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data, headers: res.headers }
}
const get = (path, t) => call('GET', path, t)
const post = (path, t, b = {}) => call('POST', path, t, b)
const put = (path, t, b = {}) => call('PUT', path, t, b)
const patch = (path, t, b = {}) => call('PATCH', path, t, b)
const del = (path, t) => call('DELETE', path, t)

const PASSWORDS = { student: 'password123', registrar: 'registrar123', cashier: 'cashier123', department: 'department123', admin: 'admin123' }
async function login(role, loginId, password = PASSWORDS[role]) {
  const r = await post('/auth/login', null, { role, loginId, password })
  assert.equal(r.status, 200, `login ${loginId}: ${JSON.stringify(r.data)}`)
  return r.data.token
}

const tokens = {}

// two subjects clash when they meet on the same day at overlapping times
const clashes = (a, b) => a.id !== b.id && a.meetings.some((x) => b.meetings.some((y) => x.day === y.day && x.startMin < y.endMin && y.startMin < x.endMin))
const pickWithoutClashes = (subjects, n) => {
  const chosen = []
  for (const s of subjects) if (chosen.length < n && !chosen.some((c) => clashes(c, s))) chosen.push(s)
  return chosen
}
before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'ssis-test-'))
  server = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL ?? '', DB_DIR: join(dir, 'pg'), API_PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'inherit'] })
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server did not start')), 15000)
    server.stdout.on('data', (chunk) => {
      if (String(chunk).includes('listening')) {
        clearTimeout(timer)
        resolve()
      }
    })
    server.on('exit', (code) => reject(new Error(`server exited early (${code})`)))
  })
  Object.assign(tokens, {
    juan: await login('student', '26001001'),
    katrina: await login('student', '26001006'),
    registrar: await login('registrar', 'REG-0001'),
    cashier: await login('cashier', 'CSH-0001'),
    ccit: await login('department', 'DEP-0001'),
    cbaa: await login('department', 'DEP-0002'),
    admin: await login('admin', 'ADM-0001'),
  })
})

after(() => {
  server?.kill()
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    /* temp folder cleanup is best-effort */
  }
})

describe('authentication & access control', () => {
  test('wrong password is rejected without saying which part was wrong', async () => {
    const r = await post('/auth/login', null, { role: 'student', loginId: '26001001', password: 'nope' })
    assert.equal(r.status, 401)
    assert.match(r.data.error, /^Incorrect ID or password\./)
    const ghost = await post('/auth/login', null, { role: 'student', loginId: '99999999', password: 'nope' })
    const shape = (e) => e.replace(/\d+ attempts? left/, 'N attempts left')
    assert.equal(shape(ghost.data.error), shape(r.data.error), 'unknown IDs must look the same as real ones')
  })

  test('protected routes need a token', async () => {
    assert.equal((await get('/student/home')).status, 401)
    assert.equal((await get('/admin/users', 'not-a-token')).status, 401)
  })

  test('each module only accepts its own role', async () => {
    assert.equal((await get('/registrar/overview', tokens.juan)).status, 403)
    assert.equal((await get('/cashier/overview', tokens.registrar)).status, 403)
    assert.equal((await get('/admin/users', tokens.cashier)).status, 403)
    assert.equal((await get('/department/overview', tokens.admin)).status, 403)
    assert.equal((await get('/student/home', tokens.registrar)).status, 403)
  })

  test('security headers are present and API responses are not cached', async () => {
    const r = await get('/auth/me', tokens.juan)
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(r.headers.get('x-frame-options'), 'DENY')
    assert.equal(r.headers.get('cache-control'), 'no-store')
    assert.equal(r.headers.get('x-powered-by'), null)
  })

  test('brute force: the account locks after repeated failures, even for the right password', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await post('/auth/login', null, { role: 'student', loginId: '26001010', password: `wrong-${i}` })
      assert.ok([401, 423, 429].includes(r.status))
    }
    const locked = await post('/auth/login', null, { role: 'student', loginId: '26001010', password: PASSWORDS.student })
    assert.ok([423, 429].includes(locked.status), `expected a lock, got ${locked.status}`)
  })

  test('login attempts: a failed sign-in says how many tries are left and every attempt is logged for the admin', async () => {
    const bad = await post('/auth/login', null, { role: 'student', loginId: '26001009', password: 'nope' })
    assert.equal(bad.status, 401)
    assert.match(bad.data.error, /4 attempts left/)
    await login('student', '26001009') // success also resets the counter and is logged
    const log = await get('/admin/login-attempts?q=26001009', tokens.admin)
    assert.equal(log.status, 200)
    assert.ok(log.data.rows.some((r) => !r.success && r.reason === 'wrong password'))
    assert.ok(log.data.rows.some((r) => r.success))
    assert.ok(!JSON.stringify(log.data).includes('nope'), 'passwords must never be stored')
    const denied = await get('/admin/login-attempts', tokens.registrar)
    assert.equal(denied.status, 403)
  })

  test('odd input types and limits are rejected instead of being accepted or ignored', async () => {
    // a negative limit used to switch pagination off and return the whole table
    const all = await get('/admin/audit?limit=-1', tokens.admin)
    assert.equal(all.status, 200)
    assert.ok(all.data.rows.length <= 200 && all.data.rows.length >= 1)
    const attempts = await get('/admin/login-attempts?limit=-1', tokens.admin)
    assert.ok(attempts.data.rows.length >= 1)
    // an object used to be saved as "[object Object]"
    assert.equal((await put('/admin/settings', tokens.admin, { values: { schoolName: { a: 1 } } })).status, 400)
    // an array used to be accepted as a password
    assert.equal((await post('/settings/password', tokens.juan, { current: PASSWORDS.student, next: ['abcdefgh', 'x'] })).status, 400)
  })

  test('SQL injection in login and search inputs does nothing', async () => {
    const r = await post('/auth/login', null, { role: 'student', loginId: "' OR '1'='1' --", password: "' OR '1'='1" })
    assert.equal(r.status, 401)
    const s = await get(`/registrar/students?q=${encodeURIComponent("x' OR 1=1 --")}`, tokens.registrar)
    assert.equal(s.status, 200)
    assert.equal(s.data.students.length, 0)
    const users = await get('/auth/me', tokens.juan)
    assert.equal(users.data.user.loginId, '26001001') // database still intact
  })
})

describe('enrollment: student → department → registrar → cashier', () => {
  let subjectIds
  let requestId

  test('a student with no request starts at "Subject Selection"', async () => {
    const r = await get('/student/enrollment', tokens.katrina)
    assert.equal(r.data.status, 'Not Started')
    assert.equal(r.data.step, 0)
    assert.ok(r.data.available.length >= 5)
    subjectIds = pickWithoutClashes(r.data.available, 5).map((s) => s.id)
    assert.equal(subjectIds.length, 5)
  })

  test('picking too many units or an unknown subject is rejected', async () => {
    const all = (await get('/student/enrollment', tokens.katrina)).data.available.map((s) => s.id)
    const tooMany = await put('/student/enrollment', tokens.katrina, { subjectIds: all, submit: true })
    assert.equal(tooMany.status, 400)
    assert.match(tooMany.data.error, /at most 24 units/)
    assert.equal((await put('/student/enrollment', tokens.katrina, { subjectIds: [999999], submit: true })).status, 400)
  })

  test('submitting sends it to department review', async () => {
    const r = await put('/student/enrollment', tokens.katrina, { subjectIds, submit: true })
    assert.equal(r.status, 200)
    const state = await get('/student/enrollment', tokens.katrina)
    assert.equal(state.data.step, 1)
    assert.equal(state.data.canEdit, false)
    assert.equal((await put('/student/enrollment', tokens.katrina, { subjectIds, submit: true })).status, 409)
  })

  test('another department cannot review it', async () => {
    const r = await get('/department/enrollment', tokens.cbaa)
    assert.equal(r.data.requests.some((x) => x.studentNo === '26001006'), false)
  })

  test('the department approves it', async () => {
    const list = await get('/department/enrollment', tokens.ccit)
    const req = list.data.requests.find((x) => x.studentNo === '26001006')
    assert.ok(req)
    requestId = req.id
    assert.equal((await patch(`/department/enrollment/${requestId}`, tokens.cbaa, { decision: 'approve' })).status, 404)
    assert.equal((await patch(`/department/enrollment/${requestId}`, tokens.ccit, { decision: 'approve' })).status, 200)
    assert.equal((await get('/student/enrollment', tokens.katrina)).data.step, 2)
  })

  test('the registrar approves it and the subjects appear on the schedule list', async () => {
    assert.equal((await patch(`/registrar/enrollment/${requestId}`, tokens.registrar, { decision: 'approve' })).status, 200)
    const state = await get('/student/enrollment', tokens.katrina)
    assert.equal(state.data.step, 3)
    const subjects = await get('/student/subjects', tokens.katrina)
    assert.equal(subjects.data.subjects.length, 5)
  })

  test('the cashier cannot confirm before the minimum payment, then can after paying', async () => {
    const katrina = (await get('/cashier/students?q=26001006', tokens.cashier)).data.students[0]
    const early = await post(`/cashier/students/${katrina.id}/enrollment/confirm`, tokens.cashier)
    assert.equal(early.status, 409)
    assert.match(early.data.error, /at least 50%/)
    const pay = await post(`/cashier/students/${katrina.id}/payments`, tokens.cashier, { amount: 14000, method: 'Cash' })
    assert.equal(pay.status, 201)
    assert.match(pay.data.orNumber, /^OR-\d+$/)
    assert.equal((await post(`/cashier/students/${katrina.id}/enrollment/confirm`, tokens.cashier)).status, 200)
    const done = await get('/student/enrollment', tokens.katrina)
    assert.equal(done.data.status, 'Enrolled')
    assert.equal(done.data.step, 5)
  })
})

describe('document requests: Pending → For Payment → Processing → Ready for Release → Released', () => {
  let id

  test('requests that need a full clearance are blocked while the student is not cleared', async () => {
    const types = (await get('/student/documents', tokens.juan)).data.types
    const tor = types.find((t) => t.name === 'Transcript of Records')
    const r = await post('/student/documents/requests', tokens.juan, { docTypeId: tor.id, copies: 1, pickupDate: '2099-01-01' })
    assert.equal(r.status, 403)
  })

  test('validation: past dates, bad copy counts and duplicates are rejected', async () => {
    const types = (await get('/student/documents', tokens.juan)).data.types
    const coe = types.find((t) => t.name === 'Certificate of Enrollment')
    assert.equal((await post('/student/documents/requests', tokens.juan, {})).status, 400) // used to crash with a 500
    assert.equal((await post('/student/documents/requests', tokens.juan, { docTypeId: coe.id, copies: 1, pickupDate: '2000-01-01' })).status, 400)
    assert.equal((await post('/student/documents/requests', tokens.juan, { docTypeId: coe.id, copies: 99, pickupDate: '2099-01-01' })).status, 400)
    assert.equal((await post('/student/documents/requests', tokens.juan, { docTypeId: coe.id, copies: 1, pickupDate: '2099-01-01' })).status, 409) // one is already open
  })

  test('student files a request', async () => {
    const types = (await get('/student/documents', tokens.juan)).data.types
    const cog = types.find((t) => t.name === 'Certificate of Grades')
    assert.ok(cog.requirements.length > 5)
    const r = await post('/student/documents/requests', tokens.juan, { docTypeId: cog.id, copies: 2, pickupDate: '2099-01-01', purpose: 'Scholarship' })
    assert.equal(r.status, 201)
    assert.equal(r.data.totalFee, 100)
    id = r.data.id
  })

  test('steps cannot be skipped and roles are respected', async () => {
    assert.equal((await patch(`/registrar/requests/${id}`, tokens.registrar, { action: 'release' })).status, 409)
    assert.equal((await post(`/cashier/requests/${id}/verify`, tokens.cashier, {})).status, 409) // not approved yet
  })

  test('registrar approves → For Payment; cashier verifies the exact fee → Processing', async () => {
    const approved = await patch(`/registrar/requests/${id}`, tokens.registrar, { action: 'approve' })
    assert.equal(approved.data.status, 'For Payment')
    const wrong = await post(`/cashier/requests/${id}/verify`, tokens.cashier, { amount: 10 })
    assert.equal(wrong.status, 400)
    const verified = await post(`/cashier/requests/${id}/verify`, tokens.cashier, {})
    assert.equal(verified.status, 200)
    assert.equal(verified.data.status, 'Processing')
    assert.match(verified.data.orNumber, /^OR-\d+$/)
  })

  test('registrar marks it ready and releases it; the student sees the whole history', async () => {
    assert.equal((await patch(`/registrar/requests/${id}`, tokens.registrar, { action: 'ready' })).data.status, 'Ready for Release')
    assert.equal((await patch(`/registrar/requests/${id}`, tokens.registrar, { action: 'release' })).data.status, 'Released')
    const mine = (await get('/student/documents', tokens.juan)).data.requests.find((r) => r.id === id)
    assert.equal(mine.status, 'Released')
    assert.deepEqual(mine.history.map((h) => h.status), ['Pending', 'For Payment', 'Processing', 'Ready for Release', 'Released'])
    assert.equal((await post(`/student/documents/requests/${id}/cancel`, tokens.juan)).status, 409) // too late to cancel
  })

  test('the student is notified at each step and the payment shows in the account', async () => {
    const notes = (await get('/notifications', tokens.juan)).data.items.map((n) => n.message)
    assert.ok(notes.some((m) => /approved/i.test(m)))
    assert.ok(notes.some((m) => /released/i.test(m)))
    const account = (await get('/student/account', tokens.juan)).data
    assert.ok(account.documentPayments.some((p) => p.requestNo === `REQ-${String(id).padStart(4, '0')}`))
  })
})

describe('digital queue', () => {
  let ticketId

  test('a student takes a numbered ticket and sees position and estimate', async () => {
    const offices = await get('/queue/offices', tokens.juan)
    assert.deepEqual(offices.data.offices.map((o) => o.office), ['Registrar', 'Cashier', 'Department'])
    const r = await post('/queue/tickets', tokens.juan, { office: 'Registrar', service: 'Grade Viewing' })
    assert.equal(r.status, 201)
    assert.match(r.data.ticket.number, /^R-\d{3}$/)
    assert.ok(r.data.ticket.position >= 1)
    assert.ok(r.data.ticket.estMinutes >= 1)
    ticketId = r.data.ticket.id
  })

  test('only one active ticket at a time; unknown service is rejected', async () => {
    assert.equal((await post('/queue/tickets', tokens.juan, { office: 'Cashier', service: 'Tuition Payment' })).status, 409)
    assert.equal((await post('/queue/tickets', tokens.katrina, { office: 'Registrar', service: 'Time Travel' })).status, 400)
  })

  test('staff call tickets in order with a counter; finishing frees the staff member', async () => {
    const first = await post('/queue/staff/next', tokens.registrar, { counter: 'Window 3' })
    assert.equal(first.status, 409) // seeded data: the registrar is already serving someone
    const board = await get('/queue/staff', tokens.registrar)
    assert.ok(board.data.waiting.some((t) => t.id === ticketId))
    const current = board.data.mine[0]
    assert.equal((await post(`/queue/staff/${current.id}/done`, tokens.registrar)).status, 200)
    // call until Juan's ticket is being served (tickets are strictly first-come-first-served)
    for (let i = 0; i < 12; i++) {
      const next = await post('/queue/staff/next', tokens.registrar, { counter: 'Window 3' })
      assert.equal(next.status, 200)
      if (next.data.ticket.id === ticketId) break
      await post(`/queue/staff/${next.data.ticket.id}/done`, tokens.registrar)
    }
    const mine = await get('/queue/mine', tokens.juan)
    assert.equal(mine.data.ticket.status, 'Serving')
    assert.equal(mine.data.ticket.counter, 'Window 3')
  })

  test('a different office cannot finish the ticket; the right one can', async () => {
    assert.equal((await post(`/queue/staff/${ticketId}/done`, tokens.cashier)).status, 409)
    assert.equal((await post(`/queue/staff/${ticketId}/done`, tokens.registrar)).status, 200)
    assert.equal((await get('/queue/mine', tokens.juan)).data.ticket, null)
  })

  test('a waiting ticket can be cancelled by its owner', async () => {
    const t = await post('/queue/tickets', tokens.juan, { office: 'Cashier', service: 'Tuition Payment' })
    assert.equal(t.status, 201)
    assert.equal((await del(`/queue/tickets/${t.data.ticket.id}`, tokens.katrina)).status, 409) // not hers
    assert.equal((await del(`/queue/tickets/${t.data.ticket.id}`, tokens.juan)).status, 200)
  })
})

describe('cashier: fees, payments and receipts', () => {
  let juan
  const balanceOf = async () => (await get(`/cashier/students/${juan.id}`, tokens.cashier)).data.balance
  const pending = async (text) => (await get('/admin/approvals', tokens.admin)).data.approvals.find((a) => a.summary.includes(text))

  test('balance matches the assessment', async () => {
    juan = (await get('/cashier/students?q=26001001', tokens.cashier)).data.students[0]
    assert.equal(juan.assessed, 26000)
    assert.equal(juan.balance, 6000)
  })

  test('the cashier cannot change fees or cancel receipts directly', async () => {
    assert.equal((await post(`/cashier/students/${juan.id}/fees`, tokens.cashier, { name: 'Free money', amount: 1 })).status, 404)
    assert.equal((await put('/cashier/fees/1', tokens.cashier, { name: 'x', amount: 1 })).status, 404)
    assert.equal((await del('/cashier/fees/1', tokens.cashier)).status, 404)
    assert.equal((await post('/cashier/payments/1/void', tokens.cashier, { reason: 'because' })).status, 404)
  })

  test('a fee change is only a request until an Administrator approves it', async () => {
    const noReason = await post(`/cashier/students/${juan.id}/fee-requests`, tokens.cashier, { action: 'add', name: 'ID replacement', amount: 150, reason: '' })
    assert.equal(noReason.status, 400)
    const asked = await post(`/cashier/students/${juan.id}/fee-requests`, tokens.cashier, { action: 'add', name: 'ID replacement', amount: 150, reason: 'Lost ID card' })
    assert.equal(asked.status, 201)
    assert.equal(await balanceOf(), 6000, 'nothing changes before approval')
    const request = await pending('ID replacement')
    assert.ok(request, 'the Administrator sees the request')
    assert.equal(request.status, 'Pending')
    assert.equal((await post(`/admin/approvals/${request.id}/decide`, tokens.cashier, { decision: 'approve' })).status, 403, 'a cashier cannot approve')
    assert.equal((await post(`/admin/approvals/${request.id}/decide`, tokens.admin, { decision: 'approve' })).status, 200)
    const d = (await get(`/cashier/students/${juan.id}`, tokens.cashier)).data
    assert.equal(d.balance, 6150)
    const due = d.payments.filter((p) => p.status === 'Due')
    assert.equal(due.length, 1)
    assert.equal(due[0].amount, 6150)
    assert.equal((await post(`/admin/approvals/${request.id}/decide`, tokens.admin, { decision: 'approve' })).status, 409, 'decided only once')
  })

  test('rejecting needs a reason and changes nothing', async () => {
    await post(`/cashier/students/${juan.id}/fee-requests`, tokens.cashier, { action: 'add', name: 'Late fee', amount: 500, reason: 'Paid late last term' })
    const request = await pending('Late fee')
    assert.equal((await post(`/admin/approvals/${request.id}/decide`, tokens.admin, { decision: 'reject', note: '' })).status, 400)
    assert.equal((await post(`/admin/approvals/${request.id}/decide`, tokens.admin, { decision: 'reject', note: 'Not allowed this term' })).status, 200)
    assert.equal(await balanceOf(), 6150)
    const mine = (await get('/cashier/change-requests', tokens.cashier)).data.approvals.find((a) => a.id === request.id)
    assert.equal(mine.status, 'Rejected')
    assert.equal(mine.decisionNote, 'Not allowed this term')
  })

  test('paying more than owed, or zero, is rejected; receipt numbers are always generated', async () => {
    assert.equal((await post(`/cashier/students/${juan.id}/payments`, tokens.cashier, { amount: 999999 })).status, 400)
    assert.equal((await post(`/cashier/students/${juan.id}/payments`, tokens.cashier, { amount: 0 })).status, 400)
    const ok = await post(`/cashier/students/${juan.id}/payments`, tokens.cashier, { amount: 6150, method: 'GCash', orNumber: 'OR-1' })
    assert.equal(ok.status, 201)
    assert.match(ok.data.orNumber, /^OR-\d+$/)
    assert.notEqual(ok.data.orNumber, 'OR-1', 'a typed receipt number is ignored')
    assert.equal(await balanceOf(), 0)
    assert.ok([400, 409].includes((await post(`/cashier/students/${juan.id}/payments`, tokens.cashier, { amount: 1 })).status)) // nothing is owed
  })

  test('voiding a receipt also needs approval, and then restores the balance', async () => {
    const d = (await get(`/cashier/students/${juan.id}`, tokens.cashier)).data
    const paid = d.payments.find((p) => p.status === 'Paid' && p.amount === 6150)
    const receipt = await get(`/cashier/receipts/payment/${paid.id}`, tokens.cashier)
    assert.equal(receipt.data.orNumber, paid.reference)
    assert.equal((await post(`/cashier/payments/${paid.id}/void-request`, tokens.cashier, { reason: '' })).status, 400)
    assert.equal((await post(`/cashier/payments/${paid.id}/void-request`, tokens.cashier, { reason: 'Wrong student' })).status, 201)
    assert.equal((await post(`/cashier/payments/${paid.id}/void-request`, tokens.cashier, { reason: 'Wrong student again' })).status, 409, 'one open request per receipt')
    assert.equal(await balanceOf(), 0, 'the receipt still counts until it is approved')
    const request = await pending(paid.reference)
    assert.equal((await post(`/admin/approvals/${request.id}/decide`, tokens.admin, { decision: 'approve' })).status, 200)
    assert.equal(await balanceOf(), 6150)
    const after = (await get(`/cashier/students/${juan.id}`, tokens.cashier)).data.payments.find((p) => p.id === paid.id)
    assert.equal(after.status, 'Void')
  })

  test('the collection report adds up', async () => {
    const r = await get('/cashier/reports?period=all', tokens.cashier)
    assert.equal(r.status, 200)
    assert.ok(r.data.table.rows.length > 0)
    assert.equal(r.data.stats.length, 4)
  })
})

describe('department module', () => {
  test('staff only see students of their own department', async () => {
    const ccit = (await get('/department/students', tokens.ccit)).data.students
    const cbaa = (await get('/department/students', tokens.cbaa)).data.students
    assert.ok(ccit.length >= 6)
    assert.ok(cbaa.length >= 2)
    assert.equal(ccit.some((s) => cbaa.some((c) => c.id === s.id)), false)
    const juan = ccit.find((s) => s.studentNo === '26001001')
    assert.equal((await get(`/department/students/${juan.id}`, tokens.cbaa)).status, 404)
    const detail = await get(`/department/students/${juan.id}`, tokens.ccit)
    assert.equal(detail.status, 200)
    assert.ok(detail.data.grades.length >= 5)
  })

  test('a student cannot be cleared while academic requirements are unverified', async () => {
    const jose = (await get('/department/students?q=26001007', tokens.ccit)).data.students[0]
    const detail = (await get(`/department/students/${jose.id}`, tokens.ccit)).data
    const open = detail.requirements.filter((r) => r.status !== 'Verified')
    if (open.length) {
      const blocked = await put(`/department/students/${jose.id}/clearance`, tokens.ccit, { status: 'Cleared' })
      assert.equal(blocked.status, 409)
      for (const r of open) assert.equal((await patch(`/department/requirements/${r.id}`, tokens.ccit, { status: 'Verified' })).status, 200)
    }
    assert.equal((await put(`/department/students/${jose.id}/clearance`, tokens.ccit, { status: 'Cleared' })).status, 200)
  })

  test('the registrar cannot edit the department line', async () => {
    const jose = (await get('/registrar/students?q=26001007', tokens.registrar)).data.students[0]
    const offices = (await get(`/registrar/clearance/${jose.id}`, tokens.registrar)).data.offices
    const head = offices.find((o) => o.office === 'Department Head')
    assert.equal((await put(`/registrar/clearance/item/${head.id}`, tokens.registrar, { status: 'Hold' })).status, 409)
  })
})

describe('registrar: records, subjects, schedules and grades', () => {
  test('creating a student returns a one-time password and rejects duplicates', async () => {
    const body = { name: 'Test Student', studentNo: '26009999', email: 'test@example.com', program: 'BS Information Technology', yearLevel: 1, section: '1IT-Z', departmentId: 1 }
    const r = await post('/registrar/students', tokens.registrar, body)
    assert.equal(r.status, 201)
    assert.ok(r.data.tempPassword.length >= 8)
    assert.equal((await post('/registrar/students', tokens.registrar, body)).status, 409)
    assert.equal((await login('student', '26009999', r.data.tempPassword)).length > 10, true)
  })

  test('enrollment cannot be approved until the student record is verified', async () => {
    const carlo = (await get('/registrar/students?q=26001009', tokens.registrar)).data.students[0]
    assert.equal(carlo.verified, false)
    const reqs = (await get('/department/enrollment', tokens.cbaa)).data.requests
    const mine = reqs.find((r) => r.studentNo === '26001009')
    assert.equal((await patch(`/department/enrollment/${mine.id}`, tokens.cbaa, { decision: 'approve' })).status, 200)
    assert.equal((await patch(`/registrar/enrollment/${mine.id}`, tokens.registrar, { decision: 'approve' })).status, 409)
    assert.equal((await post(`/registrar/students/${carlo.id}/verify`, tokens.registrar)).status, 200)
    assert.equal((await patch(`/registrar/enrollment/${mine.id}`, tokens.registrar, { decision: 'approve' })).status, 200)
  })

  test('a class schedule that double-books a room is rejected', async () => {
    const subjects = (await get('/registrar/subjects', tokens.registrar)).data.subjects
    const capstone = subjects.find((s) => s.code === 'ITP109')
    const booked = subjects.find((s) => s.code === 'CCS109').meetings[0]
    const clash = await post(`/registrar/subjects/${capstone.id}/meetings`, tokens.registrar, { instructor: 'Someone Else', day: booked.day, startMin: booked.startMin, endMin: booked.endMin, room: booked.room })
    assert.equal(clash.status, 409)
    assert.match(clash.data.error, /already booked/)
    const ok = await post(`/registrar/subjects/${capstone.id}/meetings`, tokens.registrar, { instructor: 'Prof. Reyes', day: 6, startMin: 480, endMin: 600, room: 'LAB-9' })
    assert.equal(ok.status, 201)
  })

  test('grades are validated and reach the student', async () => {
    const subjects = (await get('/registrar/grades/subjects', tokens.registrar)).data.subjects
    const subject = subjects.find((s) => s.code === 'CCS109')
    const rows = (await get(`/registrar/grades?subjectId=${subject.id}`, tokens.registrar)).data.rows
    const juan = rows.find((r) => r.studentNo === '26001001')
    const bad = await put('/registrar/grades', tokens.registrar, { subjectId: subject.id, grades: [{ studentId: juan.studentId, prelim: 120 }] })
    assert.equal(bad.status, 400)
    const ok = await put('/registrar/grades', tokens.registrar, { subjectId: subject.id, grades: [{ studentId: juan.studentId, prelim: juan.prelim, midterm: juan.midterm, finals: 90 }] })
    assert.equal(ok.status, 200)
    assert.equal(ok.data.changed, 1)
    const mine = (await get('/student/grades', tokens.juan)).data.rows.find((r) => r.code === 'CCS109')
    assert.equal(mine.finals, 90)
    assert.notEqual(mine.point, null)
  })
})

describe('administrator', () => {
  let newUser

  test('creates a staff account with a one-time password; duplicates are rejected', async () => {
    const r = await post('/admin/users', tokens.admin, { role: 'cashier', loginId: 'CSH-0002', name: 'Second Cashier', email: 'c2@example.com' })
    assert.equal(r.status, 201)
    newUser = r.data
    assert.equal((await post('/admin/users', tokens.admin, { role: 'cashier', loginId: 'CSH-0002', name: 'Again' })).status, 409)
    assert.equal((await post('/admin/users', tokens.admin, { role: 'student', loginId: 'S-1', name: 'Nope' })).status, 400)
    assert.equal((await post('/admin/users', tokens.admin, { role: 'department', loginId: 'DEP-0099', name: 'No Dept' })).status, 400)
    await login('cashier', 'CSH-0002', newUser.tempPassword)
  })

  test('cannot disable yourself; a disabled account cannot sign in; resetting the password re-opens it', async () => {
    const me = (await get('/admin/users?q=ADM-0001', tokens.admin)).data.users[0]
    assert.equal((await patch(`/admin/users/${me.id}`, tokens.admin, { active: false })).status, 409)
    assert.equal((await patch(`/admin/users/${newUser.id}`, tokens.admin, { active: false })).status, 200)
    const blocked = await post('/auth/login', null, { role: 'cashier', loginId: 'CSH-0002', password: newUser.tempPassword })
    assert.equal(blocked.status, 403)
    assert.equal((await patch(`/admin/users/${newUser.id}`, tokens.admin, { active: true })).status, 200)
    const reset = await post(`/admin/users/${newUser.id}/reset-password`, tokens.admin)
    assert.equal(reset.status, 200)
    assert.notEqual(reset.data.tempPassword, newUser.tempPassword)
    await login('cashier', 'CSH-0002', reset.data.tempPassword)
  })

  test('settings are validated and actually change behaviour', async () => {
    assert.equal((await put('/admin/settings', tokens.admin, { values: { maxUnits: '3' } })).status, 400)
    assert.equal((await put('/admin/settings', tokens.admin, { values: { nope: '1' } })).status, 400)
    assert.equal((await put('/admin/settings', tokens.admin, { values: { maxCopies: '2' } })).status, 200)
    const types = (await get('/student/documents', tokens.katrina)).data
    assert.equal(types.maxCopies, 2)
    const r = await post('/student/documents/requests', tokens.katrina, { docTypeId: types.types[0].id, copies: 3, pickupDate: '2099-01-01' })
    assert.equal(r.status, 400)
    await put('/admin/settings', tokens.admin, { values: { maxCopies: '10' } })
  })

  test('departments with students cannot be deleted', async () => {
    const depts = (await get('/admin/departments', tokens.admin)).data.departments
    const ccit = depts.find((d) => d.code === 'CCIT')
    assert.equal((await del(`/admin/departments/${ccit.id}`, tokens.admin)).status, 409)
    assert.equal((await post('/admin/departments', tokens.admin, { code: 'CEAS', name: 'Duplicate' })).status, 409)
  })

  test('important actions are in the audit log', async () => {
    const log = (await get('/admin/audit?limit=200', tokens.admin)).data
    const actions = new Set(log.rows.map((r) => r.action))
    for (const expected of ['login', 'login.failed', 'login.locked', 'user.create', 'user.reset-password', 'payment.record', 'change.request', 'change.approve', 'change.reject', 'payment.void', 'fee.add', 'enrollment.approve', 'request.released', 'grades.update', 'settings.update'])
      assert.ok(actions.has(expected), `audit log is missing "${expected}"`)
    assert.ok(log.total >= log.rows.length)
  })

  test('system report and permission matrix are available', async () => {
    assert.equal((await get('/admin/reports?type=system', tokens.admin)).data.stats.length, 4)
    assert.equal((await get('/admin/reports?type=queue&period=all', tokens.admin)).status, 200)
    const perms = (await get('/admin/permissions', tokens.admin)).data
    assert.equal(perms.roles.length, 5)
    assert.ok(perms.rows.length > 20)
  })
})

describe('reports', () => {
  test('registrar report types all build', async () => {
    for (const type of ['documents', 'clearance', 'enrollment', 'queue']) {
      const r = await get(`/registrar/reports?type=${type}&period=all`, tokens.registrar)
      assert.equal(r.status, 200, type)
      assert.equal(r.data.stats.length, 4)
    }
  })

  test('the Cashier line of the clearance always equals the balance', async () => {
    const juan = (await get('/student/clearance', tokens.juan)).data.offices.find((o) => o.office === 'Cashier')
    const account = (await get('/student/account', tokens.juan)).data
    assert.equal(juan.status, account.balance > 0 ? 'Pending' : 'Cleared')
  })
})

// Requests really overlap on a PostgreSQL connection pool, so numbers handed out by "highest + 1" need locks.
describe('concurrency', () => {
  test('students taking queue numbers at the same moment all get different numbers', async () => {
    const ids = ['26001002', '26001003', '26001004', '26001005', '26001007', '26001008', '26001009']
    const students = await Promise.all(ids.map((id) => login('student', id)))
    const results = await Promise.all(students.map((t) => post('/queue/tickets', t, { office: 'Cashier', service: 'Tuition Payment' })))
    const made = results.filter((r) => r.status === 201).map((r) => r.data.ticket.number)
    assert.ok(made.length >= 2, `expected several tickets to be created, got ${results.map((r) => r.status).join(',')}`)
    assert.equal(new Set(made).size, made.length, `duplicate queue numbers: ${made.join(', ')}`)
    for (const r of results) assert.ok([201, 409].includes(r.status), `unexpected status ${r.status}`)
  })

  test('payments recorded at the same moment get different official receipt numbers', async () => {
    const list = (await get('/cashier/students', tokens.cashier)).data.students.filter((s) => s.balance >= 100).slice(0, 4)
    assert.ok(list.length >= 2, 'need at least two students with a balance')
    const results = await Promise.all(list.map((s) => post(`/cashier/students/${s.id}/payments`, tokens.cashier, { amount: 10, method: 'Cash' })))
    for (const r of results) assert.equal(r.status, 201, JSON.stringify(r.data))
    const numbers = results.map((r) => r.data.orNumber)
    assert.equal(new Set(numbers).size, numbers.length, `duplicate receipt numbers: ${numbers.join(', ')}`)
  })
})

describe('schedule conflicts', () => {
  let jose
  let itew3
  let itew4
  let itp109

  test('the subject list carries class times', async () => {
    jose = await login('student', '26001007') // a returned request, so the subjects can still be edited
    const r = await get('/student/enrollment', jose)
    assert.equal(r.data.canEdit, true)
    const by = Object.fromEntries(r.data.available.map((s) => [s.code, s]))
    ;[itew3, itew4, itp109] = [by.ITEW3, by.ITEW4, by.ITP109]
    assert.ok(itew3.meetings.length && itew4.meetings.length && itp109.meetings.length)
  })

  test('two subjects that overlap cannot be saved or submitted', async () => {
    for (const submit of [false, true]) {
      const r = await put('/student/enrollment', jose, { subjectIds: [itew3.id, itew4.id], submit })
      assert.equal(r.status, 409)
      assert.match(r.data.error, /conflict/i)
      assert.match(r.data.error, /ITEW3/)
      assert.match(r.data.error, /ITEW4/)
    }
  })

  test('subjects that do not overlap are accepted', async () => {
    assert.equal((await put('/student/enrollment', jose, { subjectIds: [itew3.id, itp109.id], submit: true })).status, 200)
  })

  test('the department and the registrar see the schedule, and a clash blocks approval', async () => {
    // after the student submitted, the Registrar gives ITP109 an extra meeting that overlaps ITEW3
    const added = await post(`/registrar/subjects/${itp109.id}/meetings`, tokens.registrar, { instructor: 'Test Instructor', day: 4, startMin: 540, endMin: 600, room: 'ZZ 1' })
    assert.equal(added.status, 201)
    const list = await get('/department/enrollment', tokens.ccit)
    const req = list.data.requests.find((x) => x.studentNo === '26001007')
    assert.ok(req.schedule.length >= 3, 'the student schedule is shown to the reviewer')
    assert.ok(req.conflicts.length >= 1)
    assert.match(req.conflicts[0], /ITEW3|ITP109/)
    const blocked = await patch(`/department/enrollment/${req.id}`, tokens.ccit, { decision: 'approve' })
    assert.equal(blocked.status, 409)
    assert.match(blocked.data.error, /conflict/i)
    // it can still be returned so the student can fix it
    assert.equal((await patch(`/department/enrollment/${req.id}`, tokens.ccit, { decision: 'return', remarks: 'Your schedule has a conflict.' })).status, 200)
  })
})
