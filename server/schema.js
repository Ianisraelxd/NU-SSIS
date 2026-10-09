export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('student','registrar')),
  login_id TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
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

CREATE TABLE IF NOT EXISTS terms (
  id INTEGER PRIMARY KEY,
  school_year TEXT NOT NULL,
  semester TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS students (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  program TEXT NOT NULL,
  year_level INTEGER NOT NULL,
  section TEXT NOT NULL,
  enrollment_step INTEGER NOT NULL DEFAULT 0,
  standing TEXT NOT NULL DEFAULT 'Regular'
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
  units INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS meetings (
  id INTEGER PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  instructor TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  points INTEGER NOT NULL,
  due_at TEXT NOT NULL,
  instructor TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0
);

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

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
  term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  due_on TEXT NOT NULL,
  reference TEXT,
  amount REAL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Paid','Due'))
);

CREATE TABLE IF NOT EXISTS doc_types (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  fee REAL NOT NULL,
  requires_clearance INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

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
    CHECK (status IN ('Pending','Processing','Ready','Completed','Cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_requests_status ON doc_requests(status, created_at);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  link TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
`
