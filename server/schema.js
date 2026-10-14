// Bump SCHEMA_VERSION when tables change in a way that can't be migrated in place.
// An older database is then kept as a backup and a fresh one is created (see db.js).
export const SCHEMA_VERSION = 3

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS programs (
  id INTEGER PRIMARY KEY,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('student','registrar','cashier','department','admin','teacher')),
  login_id TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  active INTEGER NOT NULL DEFAULT 1,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  theme TEXT NOT NULL DEFAULT 'light',
  notify_inapp INTEGER NOT NULL DEFAULT 1,
  notify_email INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS terms (
  id INTEGER PRIMARY KEY,
  school_year TEXT NOT NULL,
  semester TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS students (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  program TEXT NOT NULL,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  year_level INTEGER NOT NULL,
  section TEXT NOT NULL,
  standing TEXT NOT NULL DEFAULT 'Regular',
  address TEXT,
  guardian_name TEXT,
  guardian_phone TEXT,
  verified_at TEXT,
  verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS year_progress (
  student_id INTEGER NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  units_total INTEGER NOT NULL,
  units_earned INTEGER NOT NULL,
  PRIMARY KEY (student_id, year)
);

CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  units INTEGER NOT NULL,
  year_level INTEGER NOT NULL DEFAULT 0,
  offered INTEGER NOT NULL DEFAULT 0,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS meetings (
  id INTEGER PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  instructor TEXT NOT NULL,
  teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  day INTEGER NOT NULL CHECK (day BETWEEN 1 AND 6),
  start_min INTEGER NOT NULL,
  end_min INTEGER NOT NULL,
  room TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS student_subjects (
  student_id INTEGER NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  prelim REAL,
  midterm REAL,
  finals REAL,
  PRIMARY KEY (student_id, subject_id, term_id)
);

-- Enrollment: student picks subjects → department reviews → registrar approves → cashier confirms payment
CREATE TABLE IF NOT EXISTS enrollment_requests (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
  term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'Draft'
    CHECK (status IN ('Draft','For Department Review','For Registrar Approval','Returned','Approved')),
  remarks TEXT,
  submitted_at TEXT,
  dept_reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  dept_reviewed_at TEXT,
  registrar_reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  registrar_reviewed_at TEXT,
  payment_confirmed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  payment_confirmed_at TEXT,
  UNIQUE (student_id, term_id)
);

CREATE TABLE IF NOT EXISTS enrollment_items (
  request_id INTEGER NOT NULL REFERENCES enrollment_requests(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  PRIMARY KEY (request_id, subject_id)
);

-- Academic requirements a department verifies for its students
CREATE TABLE IF NOT EXISTS academic_requirements (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Verified','Missing')),
  remarks TEXT,
  verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  verified_at TEXT,
  created_at TEXT NOT NULL
);

-- ---- optional LMS-style tables (only used when ENABLE_LMS=true) -------------------------------
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  points INTEGER NOT NULL,
  due_at TEXT NOT NULL,
  instructions TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  done INTEGER NOT NULL DEFAULT 0,
  done_at TEXT,
  UNIQUE (student_id, activity_id)
);

CREATE TABLE IF NOT EXISTS task_messages (
  id INTEGER PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  edited_at TEXT,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_messages_task ON task_messages(task_id, id);

CREATE TABLE IF NOT EXISTS thread_reads (
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_id INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (task_id, user_id)
);
-- ------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clearances (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
  office TEXT NOT NULL,
  requirement TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Cleared','Pending','Hold')),
  remarks TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fees (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
  term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount REAL NOT NULL
);

-- Tuition installments and payments. 'Due' rows are what is still owed; 'Paid' rows carry an official receipt.
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
  term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  due_on TEXT NOT NULL,
  reference TEXT,
  amount REAL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Paid','Due','Void')),
  method TEXT,
  paid_at TEXT,
  recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  void_reason TEXT
);

CREATE TABLE IF NOT EXISTS doc_types (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  fee REAL NOT NULL,
  requirements TEXT,
  requires_clearance INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

-- Pending → For Payment → Processing → Ready for Release → Released   (or Cancelled)
CREATE TABLE IF NOT EXISTS doc_requests (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
  doc_type_id INTEGER NOT NULL REFERENCES doc_types(id),
  purpose TEXT,
  copies INTEGER NOT NULL DEFAULT 1,
  pickup_date TEXT,
  remarks TEXT,
  total_fee REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pending'
    CHECK (status IN ('Pending','For Payment','Processing','Ready for Release','Released','Cancelled')),
  or_number TEXT,
  paid_amount REAL,
  paid_at TEXT,
  paid_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_requests_status ON doc_requests(status, created_at);

CREATE TABLE IF NOT EXISTS request_history (
  id INTEGER PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES doc_requests(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  by_user INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_history_request ON request_history(request_id, id);

-- Digital queue (Queue ID, student, service type, queue number, status, timestamp, estimated wait, counter)
CREATE TABLE IF NOT EXISTS queue_tickets (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
  office TEXT NOT NULL CHECK (office IN ('Registrar','Cashier','Department')),
  service TEXT NOT NULL,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  queue_date TEXT NOT NULL,
  seq INTEGER NOT NULL,
  number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Waiting' CHECK (status IN ('Waiting','Serving','Done','Skipped','Cancelled')),
  counter TEXT,
  served_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  est_wait_min INTEGER,
  created_at TEXT NOT NULL,
  called_at TEXT,
  done_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_queue_lookup ON queue_tickets(office, queue_date, status);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor TEXT,
  role TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  detail TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(created_at);

CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY,
  login_id TEXT,
  role TEXT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  success INTEGER NOT NULL,
  reason TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_time ON login_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_login ON login_attempts(login_id, created_at);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  link TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
`
