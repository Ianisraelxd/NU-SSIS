import { db, transaction } from './db.js'
import { hashPassword, localDate } from './util.js'

// Demo accounts (development only — change them in Settings after signing in, or via the Admin module):
//   Students      26001001 … 26001010   password: password123
//   Registrar     REG-0001              password: registrar123
//   Cashier       CSH-0001              password: cashier123
//   Department    DEP-0001 (CCIT), DEP-0002 (CBAA)   password: department123
//   Admin         ADM-0001              password: admin123
//   Teachers      T-0001 … T-0007       password: teacher123   (only used when ENABLE_LMS=true)
export const DEMO_PASSWORDS = {
  student: 'password123',
  registrar: 'registrar123',
  cashier: 'cashier123',
  department: 'department123',
  admin: 'admin123',
  teacher: 'teacher123',
}

const DAY = 86400000
const daysAgo = (n, hour = 10) => {
  const d = new Date(Date.now() - n * DAY)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}
const minsAgo = (n) => new Date(Date.now() - n * 60000).toISOString()
const dueIn = (n) => {
  const d = new Date(Date.now() + n * DAY)
  d.setHours(23, 59, 0, 0)
  return d.toISOString()
}
const dateOnly = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10)
const hm = (h, m = 0) => h * 60 + m

// small deterministic PRNG so every fresh database looks the same
let seedState = 20260101
const rand = () => {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296
  return seedState / 4294967296
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const between = (lo, hi) => Math.round((lo + rand() * (hi - lo)) * 100) / 100

const DEPARTMENTS = [
  ['CCIT', 'College of Computing and Information Technologies'],
  ['CBAA', 'College of Business, Accountancy and Administration'],
  ['CEAS', 'College of Education, Arts and Sciences'],
]
const PROGRAMS = [
  ['CCIT', 'BSIT', 'BS Information Technology'],
  ['CCIT', 'BSCS', 'BS Computer Science'],
  ['CBAA', 'BSA', 'BS Accountancy'],
  ['CBAA', 'BSBA', 'BS Business Administration'],
  ['CEAS', 'BSED', 'BS Secondary Education'],
]

// status: how far the student's enrollment for the current term has gone
const STUDENTS = [
  { id: '26001001', name: 'Juan Dela Cruz', year: 3, section: '3IT-C', dept: 'CCIT', program: 'BS Information Technology', enroll: 'approved', paid: [10000, 5000, 5000] },
  { id: '26001002', name: 'Maria Santos', year: 3, section: '3IT-C', dept: 'CCIT', program: 'BS Information Technology', enroll: 'enrolled', paid: [26000] },
  { id: '26001003', name: 'Paolo Reyes', year: 3, section: '3IT-A', dept: 'CCIT', program: 'BS Information Technology', enroll: 'dept', paid: [10000] },
  { id: '26001004', name: 'Angela Cruz', year: 2, section: '2IT-B', dept: 'CCIT', program: 'BS Information Technology', enroll: 'registrar', paid: [15000] },
  { id: '26001005', name: 'Mark Villanueva', year: 4, section: '4IT-A', dept: 'CCIT', program: 'BS Information Technology', enroll: 'approved', paid: [26000] },
  { id: '26001006', name: 'Katrina Lim', year: 1, section: '1IT-D', dept: 'CCIT', program: 'BS Information Technology', enroll: 'none', paid: [] },
  { id: '26001007', name: 'Jose Ramirez', year: 2, section: '2IT-A', dept: 'CCIT', program: 'BS Information Technology', enroll: 'returned', paid: [13000] },
  { id: '26001008', name: 'Bea Navarro', year: 3, section: '3IT-B', dept: 'CCIT', program: 'BS Information Technology', enroll: 'enrolled', paid: [26000] },
  { id: '26001009', name: 'Carlo Mendoza', year: 2, section: '2ACC-A', dept: 'CBAA', program: 'BS Accountancy', enroll: 'dept', paid: [8000] },
  { id: '26001010', name: 'Denise Flores', year: 1, section: '1BA-C', dept: 'CBAA', program: 'BS Business Administration', enroll: 'none', paid: [] },
]

const CURRENT_SUBJECTS = [
  ['CCS109', 'System Analysis and Design', 3, [['Jearemy Niko Nositera', 1, hm(14, 30), hm(16), '312'], ['Jearemy Niko Nositera', 4, hm(14, 30), hm(16), '312']], [79.76, 89.23]],
  ['CCS111', 'Networking and Communication 1', 3, [['Roselle R. Bengco', 5, hm(11), hm(13), 'Networking Room'], ['Dr. Gima B. Montecillo', 2, hm(13), hm(16), 'COMLAB 2']], [81.92, 84.45]],
  ['ITP103', 'System Integration and Architecture', 3, [['Mildred D. Rodriguez', 1, hm(17), hm(19), 'BCH 306'], ['Mildred D. Rodriguez', 3, hm(16), hm(19), 'COMLAB 1']], [79.54, 83.88]],
  ['ITP104', 'Information Management System 2', 3, [['Marvin H. Bicua', 2, hm(17), hm(19), '310'], ['Marvin H. Bicua', 5, hm(16), hm(19), 'COMLAB 2']], [87.92, 89.54]],
  ['ITP107', 'Mobile Application Development', 3, [['Albert Q. Alforja', 3, hm(13), hm(15), '310'], ['Sairine C. Pregonero', 3, hm(7), hm(10), 'COMLAB 3']], [89.34, 89.2]],
  ['ITEW3', 'Mobile Programming 1', 3, [['Jearemy Niko Nositera', 4, hm(8), hm(11), 'COMLAB 3']], [85.1, 86.4]],
  ['ITP106', 'Information Assurance and Security 1', 3, [['Marvin H. Bicua', 1, hm(8), hm(10), '311'], ['Marvin H. Bicua', 4, hm(11), hm(13), '311']], [82.25, 84.8]],
]

// more subjects open for enrollment this term (no schedule yet — the Registrar adds it)
const EXTRA_OFFERED = [
  ['ITP109', 'Capstone Project 1', 3, 'CCIT', 3],
  ['ITEW4', 'Web Development 2', 3, 'CCIT', 3],
  ['ITP110', 'Systems Administration and Maintenance', 3, 'CCIT', 3],
  ['GEC09', 'The Life and Works of Rizal', 3, null, 1],
  ['PATHFIT3', 'Physical Activity Towards Health and Fitness 3', 2, null, 1],
  ['ACC201', 'Intermediate Accounting 1', 3, 'CBAA', 2],
  ['ACC202', 'Cost Accounting', 3, 'CBAA', 2],
  ['BUS205', 'Business Law', 3, 'CBAA', 2],
]

const ACTIVITIES = [
  ['Finals Laboratory Activity 1', 'Finals Assignment', 100, 2, 0, 'Create the use-case and activity diagrams for the school enrollment system, then add the ERD on the last page. Submit one PDF. Cite any references you used.'],
  ['Finals Lecture Activity 2', 'Finals Assignment', 20, 5, 2, 'Answer the five guide questions on system integration patterns in your own words. Maximum of two pages.'],
  ['Finals Laboratory Quiz 1 & 2', 'Finals Assignment', 100, 7, 5, 'Open-book laboratory quiz on mobile UI components and navigation. Submit your project ZIP once finished.'],
  ['System Design Documentation', 'Project', 50, 10, 1, 'Document the network design for the assigned scenario: topology, addressing plan and device list.'],
  ['Network Topology Case Study', 'Finals Assignment', 40, 12, 1, 'Analyse the provided case and recommend an improved topology with a short justification.'],
]

const PAST_TERMS = [
  {
    sy: '2025-2026',
    sem: 'First Semester',
    subjects: [
      ['MAT201', 'Discrete Mathematics', 3],
      ['CCS102', 'Data Structures and Algorithms', 3],
      ['ITP101', 'Web Systems and Technologies', 3],
      ['ITP102', 'Information Management 1', 3],
      ['GEC04', 'Ethics', 3],
    ],
  },
  {
    sy: '2025-2026',
    sem: 'Second Semester',
    subjects: [
      ['CCS104', 'Object Oriented Programming', 3],
      ['CCS106', 'Human Computer Interaction', 3],
      ['ITP105', 'Platform Technologies', 3],
      ['ITP108', 'Quantitative Methods', 3],
      ['GEC07', 'Science, Technology and Society', 3],
    ],
  },
]

const OFFICES = [
  ['Library', 'Return borrowed books'],
  ['Laboratory', 'No unreturned equipment'],
  ['Department Head', 'Submit final requirements'],
  ['Guidance', 'Exit interview'],
  ['Cashier', 'Settle balance'],
  ['Registrar', 'Complete records'],
]

const DOC_TYPES = [
  ['Certificate of Enrollment', 30, 0, 'Valid school ID. Student must be officially enrolled this term.'],
  ['Certificate of Grades', 50, 0, 'Valid school ID. Grades for the term must be complete.'],
  ['Transcript of Records', 100, 1, 'Valid school ID and a fully cleared E-Clearance.'],
  ['Good Moral Certificate', 50, 0, 'Valid school ID. No pending disciplinary case.'],
  ['Diploma', 500, 1, 'Fully cleared E-Clearance. Graduating students only.'],
  ['Form 137', 80, 0, 'Valid school ID. Request letter if sent to another school.'],
  ['Others', 50, 0, 'State the document you need in the remarks.'],
]

const ANNOUNCEMENTS = [
  [
    'NU LAGUNA’s Student Services Information System Deployed',
    'The new Student Services Information System (SSIS) is now live for all National University Laguna students. View your subjects, schedule, grades, clearance and account balance in one place, take a queue number from your phone, and request school documents without lining up at the Registrar. Please report any issue to the Registrar’s Office.',
    0,
  ],
  [
    'Digital Queue Is Now Open',
    'Skip the line: open Digital Queue, choose the office and service you need, and you will get a queue number, your position, and an estimated wait. You will be notified when your number is called. Please be near the office when you are 3 numbers away.',
    1,
  ],
  [
    'E-Clearance Opens Next Week',
    'Students who are graduating or transferring should complete their clearance per office through the E-Clearance page. Offices with outstanding requirements will mark your clearance as Pending or Hold. Settle these early to avoid delays in document processing.',
    4,
  ],
]

export function seedIfEmpty() {
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM users').get()
  if (c > 0) return false
  transaction(seed)
  return true
}

function seed() {
  const insUser = db.prepare(
    'INSERT INTO users (role, login_id, password_hash, name, email, department_id) VALUES (?,?,?,?,?,?) RETURNING id',
  )
  const hashes = Object.fromEntries(Object.entries(DEMO_PASSWORDS).map(([role, pw]) => [role, hashPassword(pw)]))

  // ---- departments, programs ---------------------------------------------------------
  const insDept = db.prepare('INSERT INTO departments (code, name) VALUES (?,?) RETURNING id')
  const deptId = Object.fromEntries(DEPARTMENTS.map(([code, name]) => [code, insDept.get(code, name).id]))
  const insProgram = db.prepare('INSERT INTO programs (department_id, code, name) VALUES (?,?,?)')
  for (const [dept, code, name] of PROGRAMS) insProgram.run(deptId[dept], code, name)

  // ---- staff ----------------------------------------------------------------------------
  const registrarId = insUser.get('registrar', 'REG-0001', hashes.registrar, 'Victor Magtanggol', 'victor.magtanggol@nu-laguna.edu.ph', null).id
  const cashierId = insUser.get('cashier', 'CSH-0001', hashes.cashier, 'Maricel Dizon', 'maricel.dizon@nu-laguna.edu.ph', null).id
  const deptStaff = {
    CCIT: insUser.get('department', 'DEP-0001', hashes.department, 'Dr. Rowena Bautista', 'rowena.bautista@nu-laguna.edu.ph', deptId.CCIT).id,
    CBAA: insUser.get('department', 'DEP-0002', hashes.department, 'Prof. Armando Villegas', 'armando.villegas@nu-laguna.edu.ph', deptId.CBAA).id,
  }
  insUser.get('admin', 'ADM-0001', hashes.admin, 'System Administrator', 'admin@nu-laguna.edu.ph', null)

  // ---- terms ------------------------------------------------------------------------------
  const insTerm = db.prepare('INSERT INTO terms (school_year, semester, is_current) VALUES (?,?,?) RETURNING id')
  const pastTermIds = PAST_TERMS.map((t) => insTerm.get(t.sy, t.sem, 0).id)
  const currentTermId = insTerm.get('2026-2027', 'First Semester', 1).id

  // ---- subjects + schedules ------------------------------------------------------------------
  const insSubject = db.prepare(
    'INSERT INTO subjects (code, description, units, year_level, offered, department_id) VALUES (?,?,?,?,?,?) RETURNING id',
  )
  const insMeeting = db.prepare(
    'INSERT INTO meetings (subject_id, instructor, teacher_id, day, start_min, end_min, room) VALUES (?,?,?,?,?,?,?)',
  )
  const teacherHash = hashes.teacher
  const teacherIds = {}
  for (const name of new Set(CURRENT_SUBJECTS.flatMap(([, , , meetings]) => meetings.map((m) => m[0])))) {
    const n = Object.keys(teacherIds).length + 1
    const slug = name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.+|\.+$/g, '')
    teacherIds[name] = insUser.get('teacher', `T-${String(n).padStart(4, '0')}`, teacherHash, name, `${slug}@nu-laguna.edu.ph`, null).id
  }
  const currentSubjectIds = CURRENT_SUBJECTS.map(([code, desc, units, meetings]) => {
    const id = insSubject.get(code, desc, units, 3, 1, deptId.CCIT).id
    for (const [instructor, day, s, e, room] of meetings) insMeeting.run(id, instructor, teacherIds[instructor], day, s, e, room)
    return id
  })
  const extraIds = Object.fromEntries(
    EXTRA_OFFERED.map(([code, desc, units, dept, year]) => [code, insSubject.get(code, desc, units, year, 1, dept ? deptId[dept] : null).id]),
  )
  const pastSubjectIds = PAST_TERMS.map((t) => t.subjects.map(([code, desc, units]) => insSubject.get(code, desc, units, 2, 0, deptId.CCIT).id))

  // ---- activities (optional LMS extras) ----------------------------------------------------------
  const insActivity = db.prepare(
    'INSERT INTO activities (subject_id, teacher_id, title, kind, points, due_at, instructions, created_at) VALUES (?,?,?,?,?,?,?,?) RETURNING id',
  )
  const activityIds = ACTIVITIES.map(([title, kind, points, due, subjIdx, instructions]) =>
    insActivity.get(currentSubjectIds[subjIdx], teacherIds[CURRENT_SUBJECTS[subjIdx][3][0][0]], title, kind, points, dueIn(due), instructions, minsAgo(60 * 24 * 6)).id,
  )

  // ---- document types --------------------------------------------------------------------------------
  const insDoc = db.prepare('INSERT INTO doc_types (name, fee, requires_clearance, requirements) VALUES (?,?,?,?)')
  for (const [name, fee, needsClearance, reqs] of DOC_TYPES) insDoc.run(name, fee, needsClearance, reqs)

  // ---- students ------------------------------------------------------------------------------------------
  const insStudent = db.prepare(
    'INSERT INTO students (user_id, program, department_id, year_level, section, standing, address, guardian_name, guardian_phone, verified_at, verified_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
  )
  const insProgress = db.prepare('INSERT INTO year_progress (student_id, year, units_total, units_earned) VALUES (?,?,?,?)')
  const insEnrolled = db.prepare(
    'INSERT INTO student_subjects (student_id, subject_id, term_id, prelim, midterm, finals) VALUES (?,?,?,?,?,?)',
  )
  const insTask = db.prepare('INSERT INTO tasks (student_id, activity_id) VALUES (?,?) RETURNING id')
  const insClear = db.prepare('INSERT INTO clearances (student_id, office, requirement, status, remarks) VALUES (?,?,?,?,?)')
  const insFee = db.prepare('INSERT INTO fees (student_id, term_id, name, amount) VALUES (?,?,?,?)')
  const insPay = db.prepare(
    'INSERT INTO payments (student_id, term_id, due_on, reference, amount, status, method, paid_at, recorded_by) VALUES (?,?,?,?,?,?,?,?,?)',
  )
  const insEnrollReq = db.prepare(
    `INSERT INTO enrollment_requests (student_id, term_id, status, remarks, submitted_at, dept_reviewed_by, dept_reviewed_at,
       registrar_reviewed_by, registrar_reviewed_at, payment_confirmed_by, payment_confirmed_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?) RETURNING id`,
  )
  const insItem = db.prepare('INSERT INTO enrollment_items (request_id, subject_id) VALUES (?,?)')
  const insReqmt = db.prepare(
    'INSERT INTO academic_requirements (student_id, name, status, remarks, verified_by, verified_at, created_at) VALUES (?,?,?,?,?,?,?)',
  )

  const studentIds = []
  const orNumbers = { next: 1021 }
  let juanTasks = []
  STUDENTS.forEach((s, index) => {
    const isJuan = index === 0
    const isBsit = s.dept === 'CCIT'
    const id = insUser.get('student', s.id, hashes.student, s.name, `${s.id}@students.nu-laguna.edu.ph`, null).id
    studentIds.push(id)
    insStudent.run(
      id, s.program, deptId[s.dept], s.year, s.section, 'Regular',
      `${pick(['Brgy. Real', 'Brgy. Parian', 'Brgy. Banlic', 'Brgy. Mamatid'])}, ${pick(['Calamba', 'Cabuyao', 'Los Baños'])}, Laguna`,
      `${pick(['Elena', 'Ramon', 'Teresita', 'Dante'])} ${s.name.split(' ').at(-1)}`,
      `09${Math.floor(100000000 + rand() * 899999999)}`,
      index < 8 ? daysAgo(60) : null, index < 8 ? registrarId : null,
    )

    // academic tracker (Juan matches the design: 96 earned / 64 remaining)
    const earned = isJuan ? [40, 40, 16, 0] : [40, s.year > 1 ? 40 : 14, s.year > 2 ? 28 : 0, s.year > 3 ? 12 : 0]
    earned.forEach((units, i) => insProgress.run(id, i + 1, 40, units))

    // ---- enrollment request for the current term -----------------------------------------------------
    const bsitSubjects = currentSubjectIds
    const cbaaSubjects = [extraIds.ACC201, extraIds.ACC202, extraIds.BUS205]
    const chosen = isBsit ? bsitSubjects : cbaaSubjects
    const stamp = (n) => daysAgo(n, 11)
    const deptBy = deptStaff[s.dept]
    let reqId = null
    if (s.enroll === 'approved' || s.enroll === 'enrolled') {
      const confirmed = s.enroll === 'enrolled'
      reqId = insEnrollReq.get(id, currentTermId, 'Approved', null, stamp(40), deptBy, stamp(38), registrarId, stamp(36), confirmed ? cashierId : null, confirmed ? stamp(30) : null).id
      chosen.forEach((sid) => insItem.run(reqId, sid))
      chosen.forEach((sid, i) => {
        const [prelim, midterm] = isJuan ? CURRENT_SUBJECTS[i][4] : [between(76, 93), between(76, 93)]
        insEnrolled.run(id, sid, currentTermId, prelim, midterm, null)
      })
    } else if (s.enroll === 'registrar') {
      reqId = insEnrollReq.get(id, currentTermId, 'For Registrar Approval', null, stamp(3), deptBy, stamp(2), null, null, null, null).id
      chosen.slice(0, 6).forEach((sid) => insItem.run(reqId, sid))
    } else if (s.enroll === 'dept') {
      reqId = insEnrollReq.get(id, currentTermId, 'For Department Review', null, stamp(1), null, null, null, null, null, null).id
      chosen.slice(0, isBsit ? 5 : 3).forEach((sid) => insItem.run(reqId, sid))
    } else if (s.enroll === 'returned') {
      reqId = insEnrollReq.get(id, currentTermId, 'Returned', 'Please remove Capstone Project 1 — its prerequisite is not yet passed — and resubmit.', stamp(4), deptBy, stamp(3), null, null, null, null).id
      ;[...chosen.slice(0, 4), extraIds.ITP109].forEach((sid) => insItem.run(reqId, sid))
    }

    // past terms for the grades dropdown
    if (s.year >= 3 && isBsit) {
      PAST_TERMS.forEach((_, t) => {
        pastSubjectIds[t].forEach((subjectId) => {
          const f = () => (isJuan ? between(82, 90) : between(80, 94))
          insEnrolled.run(id, subjectId, pastTermIds[t], f(), f(), f())
        })
      })
    }

    // class activities (optional LMS extras) — BSIT students only
    if (isBsit) {
      const taskIds = activityIds.map((activityId) => insTask.get(id, activityId).id)
      if (isJuan) juanTasks = taskIds
    }

    // ---- clearances (Juan: 4 cleared, cashier pending, registrar hold — as designed) ------------------
    let deptHeadStatus = 'Cleared'
    OFFICES.forEach(([office, requirement]) => {
      let status = 'Cleared'
      let remarks = null
      if (isJuan) {
        if (office === 'Cashier') status = 'Pending'
        if (office === 'Registrar') [status, remarks] = ['Hold', 'Missing Form 137']
      } else if (index === 1) {
        // Maria: fully cleared
      } else if (rand() < 0.28) {
        status = pick(['Pending', 'Pending', 'Hold'])
        remarks = status === 'Hold' ? 'See office for details' : 'Requirement not yet submitted'
      }
      if (office === 'Department Head') deptHeadStatus = status
      insClear.run(id, office, requirement, status, remarks)
    })

    // ---- academic requirements the department verifies (consistent with the Department Head clearance) --
    const reqNames = isBsit ? ['Final project documentation', 'OJT completion report', 'Capstone defense schedule'] : ['Practicum report', 'Accounting laboratory set']
    reqNames.forEach((name, i) => {
      const verified = deptHeadStatus === 'Cleared' || i === reqNames.length - 1
      insReqmt.run(id, name, verified ? 'Verified' : i === 0 ? 'Missing' : 'Pending', verified ? null : i === 0 ? 'Not yet submitted to the department.' : null, verified ? deptBy : null, verified ? daysAgo(20) : null, daysAgo(45))
    })

    // ---- fees & payments (official receipts) --------------------------------------------------------------
    const fees = [['Tuition', 18000], ['Miscellaneous', 4500], ['Laboratory', 2500], ['Other fees', 1000]]
    for (const [feeName, amount] of fees) insFee.run(id, currentTermId, feeName, amount)
    const offsets = [-65, -37, -10]
    let paidTotal = 0
    s.paid.forEach((amount, i) => {
      const off = offsets[Math.min(i, 2)] - (i > 2 ? 3 : 0)
      const or = isJuan ? ['OR-1021', 'OR-1188', 'OR-1302'][i] : `OR-${(orNumbers.next += 7)}`
      insPay.run(id, currentTermId, dateOnly(off), or, amount, 'Paid', pick(['Cash', 'GCash', 'Bank Transfer']), daysAgo(-off, 10), cashierId)
      paidTotal += amount
    })
    if (paidTotal < 26000) insPay.run(id, currentTermId, dateOnly(isJuan ? 27 : 20), null, 26000 - paidTotal, 'Due', null, null, null)
  })

  // ---- document requests with history (Juan's four exactly as designed, then a spread for reports) ------------
  const byName = Object.fromEntries(db.prepare('SELECT id, name, fee FROM doc_types ORDER BY id').all().map((t) => [t.name, t]))
  const insReq = db.prepare(
    `INSERT INTO doc_requests (student_id, doc_type_id, purpose, copies, pickup_date, remarks, total_fee, status, or_number, paid_amount, paid_at, paid_by, created_at, updated_at, completed_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`,
  )
  const insHist = db.prepare('INSERT INTO request_history (request_id, status, note, by_user, created_at) VALUES (?,?,?,?,?)')
  const PATH = ['Pending', 'For Payment', 'Processing', 'Ready for Release', 'Released']
  const NOTES = { Pending: 'Request submitted', 'For Payment': 'Approved — pay the fee at the Cashier', Processing: 'Payment verified', 'Ready for Release': 'Document is ready', Released: 'Released to the student' }
  const BY = { Pending: null, 'For Payment': registrarId, Processing: cashierId, 'Ready for Release': registrarId, Released: registrarId }

  let orSeq = 5000
  const addRequest = (studentId, typeName, purpose, copies, status, createdIso, updatedIso, pickup) => {
    const t = byName[typeName]
    const total = t.fee * copies
    const reached = PATH.indexOf(status)
    const hasFee = total > 0
    const paid = hasFee && reached >= 2
    const paidAt = paid ? new Date(new Date(createdIso).getTime() + 3600000 * 5).toISOString() : null
    const id = insReq.get(studentId, t.id, purpose, copies, pickup, null, total, status, paid ? `OR-${++orSeq}` : null, paid ? total : null, paidAt, paid ? cashierId : null, createdIso, updatedIso, status === 'Released' ? updatedIso : null).id
    // history: every status up to the current one, spread between created and updated
    const start = new Date(createdIso).getTime()
    const end = new Date(updatedIso).getTime()
    PATH.slice(0, reached + 1).forEach((st, i) => {
      if (st === 'For Payment' && !hasFee) return
      insHist.run(id, st, NOTES[st], BY[st], new Date(start + ((end - start) * i) / Math.max(reached, 1)).toISOString())
    })
    return id
  }
  const juan = studentIds[0]
  const d = (offset, hour = 9) => daysAgo(offset, hour)
  addRequest(juan, 'Form 137', 'Transfer of records', 1, 'Released', d(13), d(10), dateOnly(-9))
  addRequest(juan, 'Good Moral Certificate', 'Internship application', 1, 'Released', d(8), d(5), dateOnly(-4))
  addRequest(juan, 'Transcript of Records', 'Scholarship requirement', 1, 'Ready for Release', d(4), d(1), dateOnly(3))
  addRequest(juan, 'Certificate of Enrollment', 'Allowance claim', 1, 'Pending', d(2), d(2), dateOnly(3))

  const others = [
    ['Transcript of Records', 36], ['Certificate of Enrollment', 30], ['Certificate of Grades', 22], ['Good Moral Certificate', 20], ['Diploma', 8], ['Form 137', 6], ['Others', 8],
  ]
  for (const [name, count] of others) {
    for (let i = 0; i < count; i++) {
      const student = pick(studentIds.slice(1))
      const age = Math.floor(rand() * 21)
      const roll = rand()
      const status =
        age > 6
          ? roll < 0.96 ? 'Released' : 'Ready for Release'
          : roll < 0.42 ? 'Released' : roll < 0.54 ? 'Ready for Release' : roll < 0.66 ? 'Processing' : roll < 0.8 ? 'For Payment' : 'Pending'
      const created = d(age, 8 + Math.floor(rand() * 8))
      const updated = status === 'Pending' ? created : daysAgo(Math.max(age - Math.ceil(rand() * 4), 0), 15)
      addRequest(student, name, 'Personal use', 1 + Math.floor(rand() * 2), status, created, updated, dateOnly(4))
    }
  }

  // ---- today's queue ----------------------------------------------------------------------------------------------
  const today = localDate()
  const insTicket = db.prepare(
    `INSERT INTO queue_tickets (student_id, office, service, department_id, queue_date, seq, number, status, counter, served_by, est_wait_min, created_at, called_at, done_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  )
  const queueSeed = [
    // [office, studentIndex, service, status, minutesAgoCreated, serviceMinutes]
    ['Registrar', 1, 'Document Request', 'Done', 95, 6],
    ['Registrar', 4, 'Enrollment', 'Done', 80, 9],
    ['Registrar', 7, 'Grade Viewing', 'Done', 66, 3],
    ['Registrar', 2, 'Clearance', 'Serving', 30, null],
    ['Registrar', 3, 'Enrollment', 'Waiting', 22, null],
    ['Registrar', 6, 'Document Request', 'Waiting', 15, null],
    ['Registrar', 5, 'Enrollment', 'Waiting', 8, null],
    ['Cashier', 4, 'Tuition Payment', 'Done', 70, 4],
    ['Cashier', 1 + 6, 'Document Payment', 'Done', 50, 3],
    ['Cashier', 2, 'Tuition Payment', 'Serving', 18, null],
    ['Cashier', 3, 'Tuition Payment', 'Waiting', 10, null],
    ['Cashier', 5, 'Document Payment', 'Waiting', 4, null],
    ['Department', 2, 'Enrollment Review', 'Done', 55, 7],
    ['Department', 3, 'Academic Advising', 'Waiting', 12, null],
    ['Department', 6, 'Clearance', 'Waiting', 5, null],
  ]
  const seqs = {}
  const staffOf = { Registrar: registrarId, Cashier: cashierId, Department: deptStaff.CCIT }
  for (const [office, idx, service, status, ago, svc] of queueSeed) {
    seqs[office] = (seqs[office] ?? 0) + 1
    const prefix = office[0]
    const created = minsAgo(ago)
    const called = status === 'Waiting' ? null : minsAgo(Math.max(ago - 8, 1))
    const done = status === 'Done' ? new Date(new Date(called).getTime() + svc * 60000).toISOString() : null
    insTicket.run(
      studentIds[idx], office, service, office === 'Department' ? deptId.CCIT : null, today, seqs[office], `${prefix}-${String(seqs[office]).padStart(3, '0')}`,
      status, status === 'Waiting' ? null : `Counter ${office === 'Registrar' ? 1 : office === 'Cashier' ? 2 : 1}`, status === 'Waiting' ? null : staffOf[office], 5, created, called, done,
    )
  }

  // ---- announcements -----------------------------------------------------------------------------------------------
  const insAnn = db.prepare('INSERT INTO announcements (title, body, author_id, created_at) VALUES (?,?,?,?)')
  for (const [title, body, age] of ANNOUNCEMENTS) insAnn.run(title, body, registrarId, daysAgo(age))

  // ---- sample private-comment threads for Juan (optional LMS extras) --------------------------------------------------
  const insMsg = db.prepare('INSERT INTO task_messages (task_id, sender_id, body, created_at) VALUES (?,?,?,?) RETURNING id')
  const markRead = db.prepare('INSERT INTO thread_reads (task_id, user_id, last_read_id) VALUES (?,?,?)')
  const nositera = teacherIds['Jearemy Niko Nositera']
  const t1 = juanTasks[0]
  insMsg.get(t1, juan, 'Good day, sir! For Lab Activity 1, do we need to include the ERD in the same PDF?', minsAgo(190))
  insMsg.get(t1, nositera, 'Good day, Juan! Yes — please put the ERD on the last page of the same PDF so I can check everything in one go.', minsAgo(172))
  const thanks = insMsg.get(t1, juan, 'Noted, thank you sir! 🙏', minsAgo(165)).id
  insMsg.get(t1, nositera, 'Reminder: the deadline is 11:59 PM on the due date. Late submissions lose 10 points per day.', minsAgo(6))
  markRead.run(t1, juan, thanks)
  markRead.run(t1, nositera, thanks + 1)

  // ---- notifications + a little audit history ------------------------------------------------------------------------------
  const insNote = db.prepare('INSERT INTO notifications (user_id, message, link, created_at) VALUES (?,?,?,?)')
  insNote.run(juan, 'Your Transcript of Records (REQ-0003) is ready for release.', '/documents', daysAgo(1, 15))
  insNote.run(juan, 'Registrar hold: Missing Form 137. Please visit the Registrar’s Office.', '/clearance', daysAgo(3, 11))

  const insAudit = db.prepare(
    'INSERT INTO audit_log (user_id, actor, role, action, entity, entity_id, detail, created_at) VALUES (?,?,?,?,?,?,?,?)',
  )
  const adminRow = db.prepare("SELECT id, name, login_id FROM users WHERE role='admin'").get()
  const trail = [
    [adminRow.id, `${adminRow.name} (${adminRow.login_id})`, 'admin', 'settings.update', 'settings', 'maxUnits', 'Maximum units per term set to 24', daysAgo(14)],
    [registrarId, 'Victor Magtanggol (REG-0001)', 'registrar', 'student.verify', 'student', '26001001', 'Verified academic information', daysAgo(10)],
    [cashierId, 'Maricel Dizon (CSH-0001)', 'cashier', 'payment.record', 'payment', 'OR-1302', 'Recorded ₱5,000 (Cash) for 26001001', daysAgo(9)],
    [registrarId, 'Victor Magtanggol (REG-0001)', 'registrar', 'enrollment.approve', 'enrollment', '26001001', 'Approved enrollment for A.Y. 2026-2027, First Semester', daysAgo(8)],
  ]
  for (const row of trail) insAudit.run(...row)
}
