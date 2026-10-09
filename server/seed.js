import { db, transaction } from './db.js'
import { hashPassword } from './util.js'

// Demo accounts (development only — change them in Settings after signing in):
//   Students   26001001 … 26001008   password: password123
//   Registrar  REG-0001               password: registrar123
//   Teachers   T-0001 … T-0007        password: teacher123
export const DEMO_STUDENT_PASSWORD = 'password123'
export const DEMO_REGISTRAR_PASSWORD = 'registrar123'
export const DEMO_TEACHER_PASSWORD = 'teacher123'

const DAY = 86400000
const daysAgo = (n, hour = 10) => {
  const d = new Date(Date.now() - n * DAY)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}
const dueIn = (n) => {
  const d = new Date(Date.now() + n * DAY)
  d.setHours(23, 59, 0, 0)
  return d.toISOString()
}
const dateOnly = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10)
const hm = (h, m = 0) => h * 60 + m
const minsAgo = (n) => new Date(Date.now() - n * 60000).toISOString()

// small deterministic PRNG so every fresh database looks the same
let seedState = 20260101
const rand = () => {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296
  return seedState / 4294967296
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const between = (lo, hi) => Math.round((lo + rand() * (hi - lo)) * 100) / 100

const STUDENTS = [
  ['26001001', 'Juan Dela Cruz', 3, '3IT-C', 3],
  ['26001002', 'Maria Santos', 3, '3IT-C', 5],
  ['26001003', 'Paolo Reyes', 3, '3IT-A', 4],
  ['26001004', 'Angela Cruz', 2, '2IT-B', 5],
  ['26001005', 'Mark Villanueva', 4, '4IT-A', 2],
  ['26001006', 'Katrina Lim', 1, '1IT-D', 0],
  ['26001007', 'Jose Ramirez', 2, '2IT-A', 5],
  ['26001008', 'Bea Navarro', 3, '3IT-B', 1],
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
  ['Certificate of Enrollment', 30, 0],
  ['Transcript of Records', 100, 1],
  ['Good Moral Certificate', 50, 0],
  ['Diploma', 500, 1],
  ['Form 137', 80, 0],
  ['Others', 50, 0],
]

const ANNOUNCEMENTS = [
  [
    'NU LAGUNA’s Student Information System Deployed',
    'The new Student Information System is now live for all National University Laguna students. You can view your subjects, schedule, grades, clearance and account balance in one place, and request school documents without queuing at the Registrar. Please report any issue to the Registrar’s Office.',
    0,
  ],
  [
    'Final Examination Schedule Released',
    'The final examination schedule for the First Semester A.Y. 2026-2027 is now posted. Check the Schedule page and coordinate with your instructors for make-up exams. Clear your balance with the Cashier before exam permits are released.',
    2,
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
    'INSERT INTO users (role, login_id, password_hash, name, email) VALUES (?,?,?,?,?) RETURNING id',
  )
  const studentHash = hashPassword(DEMO_STUDENT_PASSWORD)
  const registrarId = insUser.get('registrar', 'REG-0001', hashPassword(DEMO_REGISTRAR_PASSWORD), 'Victor Magtanggol', 'victor.magtanggol@nu-laguna.edu.ph').id

  // terms
  const insTerm = db.prepare('INSERT INTO terms (school_year, semester, is_current) VALUES (?,?,?) RETURNING id')
  const pastTermIds = PAST_TERMS.map((t) => insTerm.get(t.sy, t.sem, 0).id)
  const currentTermId = insTerm.get('2026-2027', 'First Semester', 1).id

  // subjects + meetings (current term)
  const insSubject = db.prepare('INSERT INTO subjects (code, description, units) VALUES (?,?,?) RETURNING id')
  const insMeeting = db.prepare(
    'INSERT INTO meetings (subject_id, instructor, teacher_id, day, start_min, end_min, room) VALUES (?,?,?,?,?,?,?)',
  )
  const teacherHash = hashPassword(DEMO_TEACHER_PASSWORD)
  const teacherIds = {}
  for (const name of new Set(CURRENT_SUBJECTS.flatMap(([, , , meetings]) => meetings.map((m) => m[0])))) {
    const n = Object.keys(teacherIds).length + 1
    const slug = name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^.+|.+$/g, '')
    teacherIds[name] = insUser.get('teacher', `T-${String(n).padStart(4, '0')}`, teacherHash, name, `${slug}@nu-laguna.edu.ph`).id
  }
  const currentSubjectIds = CURRENT_SUBJECTS.map(([code, desc, units, meetings]) => {
    const id = insSubject.get(code, desc, units).id
    for (const [instructor, day, s, e, room] of meetings) insMeeting.run(id, instructor, teacherIds[instructor], day, s, e, room)
    return id
  })
  const pastSubjectIds = PAST_TERMS.map((t) => t.subjects.map(([code, desc, units]) => insSubject.get(code, desc, units).id))

  // activities (shared by the whole class)
  const insActivity = db.prepare(
    'INSERT INTO activities (subject_id, teacher_id, title, kind, points, due_at, instructions, created_at) VALUES (?,?,?,?,?,?,?,?) RETURNING id',
  )
  const activityIds = ACTIVITIES.map(([title, kind, points, due, subjIdx, instructions]) =>
    insActivity.get(currentSubjectIds[subjIdx], teacherIds[CURRENT_SUBJECTS[subjIdx][3][0][0]], title, kind, points, dueIn(due), instructions, minsAgo(60 * 24 * 6)).id,
  )

  // doc types
  const insDoc = db.prepare('INSERT INTO doc_types (name, fee, requires_clearance) VALUES (?,?,?)')
  for (const d of DOC_TYPES) insDoc.run(...d)

  // students
  const insStudentUser = db.prepare(
    'INSERT INTO users (role, login_id, password_hash, name, email) VALUES (?,?,?,?,?) RETURNING id',
  )
  const insStudent = db.prepare(
    'INSERT INTO students (user_id, program, year_level, section, enrollment_step, standing) VALUES (?,?,?,?,?,?)',
  )
  const insProgress = db.prepare('INSERT INTO year_progress (student_id, year, units_total, units_earned) VALUES (?,?,?,?)')
  const insEnrolled = db.prepare(
    'INSERT INTO student_subjects (student_id, subject_id, term_id, prelim, midterm, finals) VALUES (?,?,?,?,?,?)',
  )
  const insTask = db.prepare(
    'INSERT INTO tasks (student_id, activity_id) VALUES (?,?) RETURNING id',
  )
  const insClear = db.prepare('INSERT INTO clearances (student_id, office, requirement, status, remarks) VALUES (?,?,?,?,?)')
  const insFee = db.prepare('INSERT INTO fees (student_id, term_id, name, amount) VALUES (?,?,?,?)')
  const insPay = db.prepare(
    'INSERT INTO payments (student_id, term_id, due_on, reference, amount, status) VALUES (?,?,?,?,?,?)',
  )

  const studentIds = []
  let juanTasks = []
  STUDENTS.forEach(([loginId, name, year, section, step], index) => {
    const isJuan = index === 0
    const email = `${loginId}@students.nu-laguna.edu.ph`
    const id = insStudentUser.get('student', loginId, studentHash, name, email).id
    studentIds.push(id)
    insStudent.run(id, 'BS Information Technology', year, section, step, 'Regular')

    // academic tracker (Juan matches the design: 96 earned / 64 remaining)
    const earned = isJuan ? [40, 40, 16, 0] : [40, year > 1 ? 40 : 14, year > 2 ? 28 : 0, year > 3 ? 12 : 0]
    earned.forEach((units, i) => insProgress.run(id, i + 1, 40, units))

    // current subjects
    CURRENT_SUBJECTS.forEach(([, , , , marks], i) => {
      const [prelim, midterm] = isJuan ? marks : [between(76, 93), between(76, 93)]
      insEnrolled.run(id, currentSubjectIds[i], currentTermId, prelim, midterm, null)
    })

    // past terms for the grades dropdown
    if (year >= 3) {
      PAST_TERMS.forEach((_, t) => {
        pastSubjectIds[t].forEach((subjectId) => {
          const f = () => (isJuan ? between(82, 90) : between(80, 94))
          insEnrolled.run(id, subjectId, pastTermIds[t], f(), f(), f())
        })
      })
    }

    // every student gets their own copy of each class activity
    const taskIds = activityIds.map((activityId) => insTask.get(id, activityId).id)
    if (isJuan) juanTasks = taskIds

    // clearances (Juan: 4 cleared, cashier pending, registrar hold — as designed)
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
      insClear.run(id, office, requirement, status, remarks)
    })

    // fees & payments
    const fees = [['Tuition', 18000], ['Miscellaneous', 4500], ['Laboratory', 2500], ['Other fees', 1000]]
    for (const [feeName, amount] of fees) insFee.run(id, currentTermId, feeName, amount)
    if (isJuan) {
      insPay.run(id, currentTermId, dateOnly(-65), 'OR-1021', 10000, 'Paid')
      insPay.run(id, currentTermId, dateOnly(-37), 'OR-1188', 5000, 'Paid')
      insPay.run(id, currentTermId, dateOnly(-10), 'OR-1302', 5000, 'Paid')
      insPay.run(id, currentTermId, dateOnly(27), null, 6000, 'Due')
    } else if (index === 1) {
      insPay.run(id, currentTermId, dateOnly(-60), `OR-${2000 + index}`, 26000, 'Paid')
    } else {
      const paid = pick([10000, 15000, 20000, 26000])
      insPay.run(id, currentTermId, dateOnly(-50), `OR-${2000 + index}`, paid, 'Paid')
      if (paid < 26000) insPay.run(id, currentTermId, dateOnly(20), null, 26000 - paid, 'Due')
    }
  })

  // Juan's four requests exactly as designed, then a spread of other requests for reports
  const typeIds = db.prepare('SELECT id, name, fee FROM doc_types ORDER BY id').all()
  const byName = Object.fromEntries(typeIds.map((t) => [t.name, t]))
  const insReq = db.prepare(
    `INSERT INTO doc_requests (student_id, doc_type_id, purpose, copies, pickup_date, remarks, total_fee, status, created_at, updated_at, completed_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  )
  const juan = studentIds[0]
  const d = (offset, hour = 9) => daysAgo(offset, hour)
  const juanRequests = [
    ['Form 137', 'Transfer of records', 'Completed', d(13), d(10)],
    ['Good Moral Certificate', 'Internship application', 'Completed', d(8), d(5)],
    ['Transcript of Records', 'Scholarship requirement', 'Ready', d(4), d(1)],
    ['Certificate of Enrollment', 'Allowance claim', 'Pending', d(2), d(2)],
  ]
  for (const [name, purpose, status, created, updated] of juanRequests) {
    const t = byName[name]
    insReq.run(juan, t.id, purpose, 1, dateOnly(3), null, t.fee, status, created, updated, status === 'Completed' ? updated : null)
  }
  const others = [
    ['Transcript of Records', 42], ['Certificate of Enrollment', 35], ['Good Moral Certificate', 24], ['Diploma', 8], ['Form 137', 6], ['Others', 10],
  ]
  for (const [name, count] of others) {
    const t = byName[name]
    for (let i = 0; i < count; i++) {
      const student = pick(studentIds.slice(1))
      const age = Math.floor(rand() * 21)
      const roll = rand()
      const status = age > 6 ? (roll < 0.97 ? 'Completed' : 'Ready') : roll < 0.5 ? 'Completed' : roll < 0.62 ? 'Ready' : roll < 0.7 ? 'Processing' : 'Pending'
      const created = d(age, 8 + Math.floor(rand() * 8))
      const done = status === 'Completed'
      const updated = done ? daysAgo(Math.max(age - Math.ceil(rand() * 4), 0), 15) : created
      const copies = 1 + Math.floor(rand() * 2)
      insReq.run(student, t.id, 'Personal use', copies, dateOnly(4), null, t.fee * copies, status, created, updated, done ? updated : null)
    }
  }

  // announcements
  const insAnn = db.prepare('INSERT INTO announcements (title, body, author_id, created_at) VALUES (?,?,?,?)')
  for (const [title, body, age] of ANNOUNCEMENTS) insAnn.run(title, body, registrarId, daysAgo(age))

  // sample private-comment threads for Juan
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
  const t3 = juanTasks[1]
  const ask = insMsg.get(t3, juan, 'Good afternoon, ma’am. May I ask for a short extension for Lecture Activity 2? Our team has a defense on the same day.', minsAgo(35)).id
  markRead.run(t3, juan, ask)

  // a couple of starter notifications for Juan
  const insNote = db.prepare('INSERT INTO notifications (user_id, message, link, created_at) VALUES (?,?,?,?)')
  insNote.run(juan, 'Your Transcript of Records (REQ-0003) is ready for pickup.', '/documents', daysAgo(1, 15))
  insNote.run(juan, 'Registrar hold: Missing Form 137. Please visit the Registrar’s Office.', '/clearance', daysAgo(3, 11))
  insNote.run(juan, 'New task due soon: Finals Laboratory Activity 1.', '/tasks', daysAgo(0, 8))
}
