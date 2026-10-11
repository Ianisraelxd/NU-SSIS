// Unit tests for pure logic (no server). Run with:  npm test
import { before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let util
let requests

before(async () => {
  // util.js opens the database when imported, so point it at a throw-away file first
  process.env.DB_FILE = join(mkdtempSync(join(tmpdir(), 'ssis-unit-')), 'unit.db')
  util = await import('../server/util.js')
  requests = await import('../server/requests.js')
})

describe('grading', () => {
  test('averages are converted to point grades using the grade range', () => {
    const point = (avg) => util.scaleFor(avg)?.point
    assert.equal(point(100), 1.0)
    assert.equal(point(96), 1.0)
    assert.equal(point(95.4), 1.25) // rounds to 95
    assert.equal(point(84), 1.75)
    assert.equal(point(75), 2.25)
    assert.equal(point(60), 3.0)
    assert.equal(point(59.4), 5.0)
    assert.equal(point(0), 5.0)
  })

  test('no average means no grade', () => {
    assert.equal(util.scaleFor(null), null)
  })

  test('a final grade needs prelim, midterm and finals', () => {
    assert.equal(util.finalAverage({ prelim: 90, midterm: 90, finals: null }), null)
    assert.equal(util.finalAverage({ prelim: 90, midterm: 80, finals: 100 }), 90)
  })

  test('grade rows report Passed, Failed or In Progress', () => {
    assert.equal(util.gradeRow({ prelim: 90, midterm: 90, finals: 90 }).remark, 'Passed')
    assert.equal(util.gradeRow({ prelim: 50, midterm: 50, finals: 50 }).remark, 'Failed')
    assert.equal(util.gradeRow({ prelim: 90, midterm: 90, finals: null }).remark, 'In Progress')
  })
})

describe('clearance summary', () => {
  test('complete only when every office is cleared', () => {
    const rows = (...s) => s.map((status) => ({ status }))
    assert.equal(util.clearanceSummary(rows('Cleared', 'Cleared')).complete, true)
    assert.equal(util.clearanceSummary(rows('Cleared', 'Pending')).complete, false)
    assert.equal(util.clearanceSummary(rows('Cleared', 'Hold')).hold, 1)
    assert.equal(util.clearanceSummary([]).complete, false)
  })
})

describe('passwords', () => {
  test('hashes are salted and verify only the right password', () => {
    const a = util.hashPassword('correct horse')
    const b = util.hashPassword('correct horse')
    assert.notEqual(a, b) // different salt every time
    assert.ok(!a.includes('correct horse'))
    assert.equal(util.verifyPassword('correct horse', a), true)
    assert.equal(util.verifyPassword('Correct horse', a), false)
    assert.equal(util.verifyPassword('', a), false)
  })

  test('temporary passwords are long enough and different each time', () => {
    const one = util.tempPassword()
    assert.ok(one.length >= 8)
    assert.notEqual(one, util.tempPassword())
  })
})

describe('document request flow', () => {
  const flow = () => requests.FLOW
  test('follows Pending → For Payment → Processing → Ready for Release → Released', () => {
    assert.ok(flow().Pending.includes('For Payment'))
    assert.ok(flow()['For Payment'].includes('Processing'))
    assert.ok(flow().Processing.includes('Ready for Release'))
    assert.ok(flow()['Ready for Release'].includes('Released'))
  })

  test('steps cannot be skipped backwards or after the end', () => {
    assert.equal(flow().Released.length, 0)
    assert.equal(flow().Cancelled.length, 0)
    assert.ok(!flow().Processing.includes('Pending'))
    assert.ok(!flow()['For Payment'].includes('Released'))
    assert.ok(!flow().Pending.includes('Released'))
  })

  test('only open requests can be cancelled', () => {
    for (const open of ['Pending', 'For Payment', 'Processing', 'Ready for Release']) assert.ok(flow()[open].includes('Cancelled'), open)
  })

  test('request numbers are zero-padded', () => {
    assert.equal(util.reqNo(7), 'REQ-0007')
    assert.equal(util.reqNo(1234), 'REQ-1234')
  })
})

describe('dates and money', () => {
  test('local dates are YYYY-MM-DD', () => {
    assert.match(util.localDate(), /^\d{4}-\d{2}-\d{2}$/)
    assert.equal(util.localDate(new Date(2026, 0, 5)), '2026-01-05')
  })

  test('amounts are formatted in pesos', () => {
    assert.equal(util.peso(6000), '₱6,000')
  })
})

describe('enrollment steps', () => {
  test('five steps ending in Enrolled', () => {
    assert.deepEqual(util.ENROLLMENT_STEPS, ['Subject Selection', 'Department Review', 'Registrar Approval', 'Payment', 'Enrolled'])
  })

  test('every office has queue services', () => {
    for (const office of ['Registrar', 'Cashier', 'Department']) assert.ok(util.QUEUE_SERVICES[office].length >= 3, office)
  })
})
