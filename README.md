# NU Laguna — Student Services Information System (SSIS)

> **Development of a Web-Based Student Services Information System (SSIS) with Integrated Queuing, Clearance, and Document Request Modules Using Scrum Methodology**
> CCS109 / 3IT-C · National University — Laguna Campus

SSIS lets students do school transactions online instead of lining up at several offices: **enroll, pay, track clearance, request documents and take a queue number**, while the Registrar, Cashier, Department and Administrator get the tools to process them. It is a **services** system, not a learning-management system (LMS).

![Student Portal home](docs/screenshots/02-student-home.png)

**Contents:** [Screenshots](#screenshots) · [Quick start](#quick-start) · [Demo accounts](#demo-accounts) · [Five-minute tour](#five-minute-tour) · [Features](#features-by-portal) · [How the main flows work](#how-the-main-flows-work) · [Architecture](#architecture) · [Testing](#testing) · [Security](#security) · [Configuration](#configuration) · [Deployment](#deployment) · [Troubleshooting](#troubleshooting) · [Project documents](#project-documents)

---

## Screenshots

All screenshots use the seeded demo data (fictional people).

### Sign in and the Student Portal

| Sign in | Home |
| --- | --- |
| ![Login page](docs/screenshots/01-login.png) | ![Student home](docs/screenshots/02-student-home.png) |

| Enrollment tracker | Digital queue (live ticket) |
| --- | --- |
| ![Enrollment](docs/screenshots/03-student-enrollment.png) | ![Student queue](docs/screenshots/04-student-queue.png) |

| Document requests | E-Clearance |
| --- | --- |
| ![Documents](docs/screenshots/05-student-documents.png) | ![Clearance](docs/screenshots/06-student-clearance.png) |

### Staff portals

| Registrar — overview | Registrar — queue management |
| --- | --- |
| ![Registrar home](docs/screenshots/07-registrar-home.png) | ![Registrar queue](docs/screenshots/08-registrar-queue.png) |

| Registrar — document requests | Cashier — overview |
| --- | --- |
| ![Requests](docs/screenshots/09-registrar-requests.png) | ![Cashier home](docs/screenshots/10-cashier-home.png) |

| Cashier — document payments | Department — enrollment review |
| --- | --- |
| ![Cashier documents](docs/screenshots/11-cashier-documents.png) | ![Department enrollment](docs/screenshots/12-department-enrollment.png) |

### Administration

| Admin — overview | Admin — login attempts |
| --- | --- |
| ![Admin home](docs/screenshots/13-admin-home.png) | ![Login attempts](docs/screenshots/14-admin-login-attempts.png) |

| Admin — audit log |
| --- |
| ![Audit log](docs/screenshots/15-admin-audit.png) |

### Phone and dark mode

| Phone (390 px) | Dark mode |
| --- | --- |
| ![Mobile](docs/screenshots/16-student-home-mobile.png) | ![Dark mode](docs/screenshots/17-student-home-dark.png) |

---

## Quick start

**Requirements:** [Node.js](https://nodejs.org) **22.13 or newer** (tested on Node 26) and npm. No database server is needed — SQLite is built into Node.

```bash
git clone https://github.com/Ianisraelxd/NU-SSIS.git
cd NU-SSIS
npm install
npm run dev
```

Open **http://localhost:5173**. `npm run dev` starts two processes:

| Process | Address | What it is |
| --- | --- | --- |
| `api` | http://localhost:3001 | Express API + SQLite database |
| `web` | http://localhost:5173 | Vite dev server (proxies `/api` to the API) |

On first start the database is created at `server/data/nu-ssis.db` and filled with demo data. `npm run db:reset` wipes it and starts fresh.

> **Upgrading from an older version:** if the database format is older, the old file is kept as `server/data/nu-ssis.backup-<time>.db` and a fresh seeded database is created. Real migrations are on the roadmap (see [`docs/12`](docs/12-master-spec-gap-analysis.md)).

### Sign-in pages

| Portal | URL |
| --- | --- |
| Student | `/login` |
| Registrar | `/registrar/login` |
| Cashier | `/cashier/login` |
| Department | `/department/login` |
| Admin | `/admin/login` |

Each page links to the others.

## Demo accounts

Development-only accounts created by `server/seed.js`. **Change or remove them before any real use.**

| Role | ID | Password |
| --- | --- | --- |
| Students (`26001001` is Juan Dela Cruz; ten students in different enrollment states) | `26001001` … `26001010` | `password123` |
| Registrar — Victor Magtanggol | `REG-0001` | `registrar123` |
| Cashier | `CSH-0001` | `cashier123` |
| Department (CCIT, CBAA) | `DEP-0001`, `DEP-0002` | `department123` |
| Administrator | `ADM-0001` | `admin123` |

## Five-minute tour

Open two browser windows (one private) so you can be a student and a staff member at once.

1. **Take a queue number.** Sign in as `26001001` → *Digital Queue* → pick *Registrar · Document Request*. You get a ticket with your position and estimated wait.
2. **Serve it.** In the other window sign in as `REG-0001` → *Queue Management*. The seed data already has `R-004` being served, so press **Mark done** on it first, then **Call next** until the student's number comes up (a counter can serve only one ticket at a time). The student is notified when their number is called or three away.
3. **Request a document.** As the student → *Documents and Forms* → choose *Certificate of Grades* (₱50 per copy; Juan has no open request for it), copies and a pickup date, then submit.
4. **Process it.** As `REG-0001` → *Document Requests* → **Approve** (moves to *For Payment*).
5. **Pay for it.** As `CSH-0001` → *Document Payments* → verify the exact fee. An official receipt number is issued and the request moves to *Processing*.
6. **Release it.** Back as the registrar: **Mark ready**, then **Release**. The student sees every step in the request history and gets a notification each time.
7. **Look behind the scenes.** As `ADM-0001` → *Audit Log* and *Login Attempts* show who did what, and every sign-in attempt.

---

## Features by portal

### Student Portal
Home dashboard · Subjects · Pending Tasks (to-dos built from your real clearance, balance and requests) · Weekly schedule · Academic tracker · Grades per semester · **Online enrollment** with a five-step tracker · **E-Clearance** across six offices · **Documents and Forms** with live fees and request history · Account summary (assessment, payments with receipt numbers) · **Digital Queue** · notifications and announcements · profile and password settings.

### Registrar (RIS)
Dashboard and announcements · **Queue management** (call next, finish, skip) · **Document requests** (approve → ready → release) · **Enrollment approval** (requires verified records) · Student records (add/edit/verify, one-time temporary passwords) · Subjects and class schedules with room/instructor conflict detection · Grade entry · Library, laboratory, guidance and registrar clearance lines · **Reports** (documents, enrollment, clearance, queue) with CSV and print.

### Cashier
Dashboard · Student balances and fee lines · **Record payments and issue official receipts** (automatic, never-duplicated OR numbers; void with a reason) · **Confirm enrollment payment** (minimum percent paid) and **verify document fees** (exact amount) · Collection reports by period and method · Queue for the Cashier counter.

### Department
Students of your own department only · **Review enrollment**: approve (sends to the Registrar) or return with a reason · Verify academic requirements · **Department clearance** (cannot clear while requirements are unverified) · View grades (every view is written to the audit log) · Department queue.

### Admin
User accounts (create, edit, disable, unlock, reset password) · Roles and permissions matrix · Departments and programs · Academic terms · **System settings** (maximum units, minimum payment %, queue minutes, maximum copies) · Announcements · System-wide reports · **Audit log** · **Login attempts** log.

### Everywhere
Light/dark mode · responsive layout down to phone width · keyboard navigation, visible focus rings and reduced-motion support · a **top loading bar** (with a "slow connection" note) and spinners while the server works · in-app confirmation dialogs · notification bell.

---

## How the main flows work

### Enrollment

```
Select subjects ──► Department review ──► Registrar approval ──► Cashier confirms payment ──► Enrolled
                         │                      │
                         └── returned with a reason; the student edits and resubmits
```

The unit cap and minimum payment come from the Admin's system settings.

### Document request

```
Pending ──► For Payment ──► Processing ──► Ready for Release ──► Released
   └───────────┴─── Cancelled (only while Pending or For Payment)
```

Steps cannot be skipped (enforced on the server). Free documents go straight to *Processing*. Transcript and Diploma need a fully cleared E-Clearance. Duplicate open requests, past pickup dates and bad copy counts are rejected.

### Digital queue

A student takes **one active number at a time** for the Registrar (`R-001`), Cashier (`C-001`) or their Department (`D-001`); numbers restart every day. Wait estimates use the real average service time per office. Staff name their counter, **call next** (first come, first served) and then **finish** or **skip** the ticket; only the staff member serving a ticket can finish it.

### Sign-in protection

A failed sign-in shows how many tries are left (the message is the same for unknown IDs). After **5 wrong passwords the account locks for 15 minutes**, and a per-IP throttle slows repeated failures. Every attempt — successful or not — is recorded with time, address and reason (never the password) and shown to the Admin under **Login Attempts**.

---

## Architecture

```
Browser (React 19 + Vite) ──/api──► Express 5 ──► SQLite (node:sqlite, one file)
```

A modular monolith: one deployable app, clear modules, no extra infrastructure.

```
NU-SSIS/
├─ server/
│  ├─ index.js          app entry: security headers, rate limit, routes, serves dist/ in production
│  ├─ db.js · schema.js · seed.js     database, 25 tables, demo data
│  ├─ util.js · requests.js · reports.js   shared rules (balances, clearance, document flow, reports)
│  └─ routes/           auth · common · student · registrar · cashier · department · admin · queue · announcements
├─ src/
│  ├─ App.jsx           routes and role navigation (pages are lazy-loaded)
│  ├─ components/       Layout, ui kit, LoadingBar, StaffQueue, ReportViewer, ReceiptModal …
│  ├─ lib/              api client, auth, hooks, loading state, formatters
│  └─ pages/            student/ registrar/ cashier/ department/ admin/ + Login, Settings
├─ tests/               api.test.mjs (integration + security) · unit.test.mjs
├─ scripts/perf.mjs     load test
└─ docs/                Scrum documents, models, test plan, screenshots
```

### Roles and access

`requireAuth(role)` guards every route on the server; the interface only mirrors it. Department staff are further scoped to their own department. See *Admin → Roles & Permissions* for the matrix.

### Database

SQLite file with these groups of tables: **people** (`users`, `sessions`, `students`, `departments`, `programs`), **academics** (`terms`, `subjects`, `meetings`, `student_subjects`, `year_progress`, `enrollment_requests`, `enrollment_items`, `academic_requirements`), **money** (`fees`, `payments`), **services** (`doc_types`, `doc_requests`, `request_history`, `clearances`, `queue_tickets`), and **system** (`announcements`, `notifications`, `settings`, `audit_log`, `login_attempts`). Entity-relationship and 3NF notes are in [`docs/08-system-models.md`](docs/08-system-models.md). Open `server/data/nu-ssis.db` with any SQLite tool such as DB Browser for SQLite.

### API overview

All routes are under `/api`, JSON in and out, `Authorization: Bearer <token>` after sign-in. Errors look like `{ "error": "message" }`.

| Area | Prefix | Examples |
| --- | --- | --- |
| Auth | `/auth` | `POST /login`, `GET /me`, `POST /logout` |
| Shared | `/` | `/term`, `/announcements`, `/notifications`, `/settings/password` |
| Student | `/student` | `/home`, `/enrollment`, `/clearance`, `/documents`, `/documents/requests`, `/account` |
| Queue | `/queue` | `GET /offices`, `GET /mine`, `POST /tickets`, `DELETE /tickets/:id`, staff: `GET /staff`, `POST /staff/next`, `POST /staff/:id/done`, `POST /staff/:id/skip` |
| Registrar | `/registrar` | `/students`, `/requests`, `/enrollment`, `/subjects`, `/grades`, `/clearance`, `/reports` |
| Cashier | `/cashier` | `/overview`, `/students`, `/fees`, `/payments`, `/receipts`, `/requests`, `/reports` |
| Department | `/department` | `/overview`, `/students` (incl. clearance), `/enrollment`, `/requirements` |
| Admin | `/admin` | `/overview`, `/users`, `/departments`, `/settings`, `/terms`, `/audit`, `/login-attempts`, `/permissions`, `/reports` |

---

## Testing

```bash
npm test                  # 62 automated tests on a throw-away database
node scripts/perf.mjs     # load test against a running server
npm run lint
```

The suite covers password hashing, the document-status rules, the enrollment chain, payments and receipts, queue rules, role boundaries, department scoping, brute-force lockout, SQL-injection attempts, login-attempt logging and input validation. The test plan, security checks and the defect log are in [`docs/09-test-plan.md`](docs/09-test-plan.md).

## Security

- Passwords hashed with **scrypt** and per-user salts; sessions expire after 7 days and end on password change. Temporary passwords are shown once.
- **Account lockout** (5 failures, 15 minutes), per-IP failed-login throttle, global **rate limit**, and a **login-attempt log**.
- Every SQL statement is **parameterised**; React escapes displayed text; security headers and a strict Content-Security-Policy in production.
- **Role checks** on every route, department scoping, and an **audit log** of sensitive actions (payments, grades, settings, account changes, grade views).

This is a school-project build. Before real use: change all demo passwords, serve over HTTPS, and review [`docs/10-ethical-and-legal-notes.md`](docs/10-ethical-and-legal-notes.md) (Data Privacy Act of 2012).

## Configuration

| Script | What it does |
| --- | --- |
| `npm run dev` | API + web with auto-reload |
| `npm run build` | Production build into `dist/` |
| `npm start` | API that also serves `dist/` |
| `npm test` | Automated tests |
| `npm run db:reset` | Delete and re-seed the database |
| `npm run lint` | Lint |

| Variable | Default | Meaning |
| --- | --- | --- |
| `API_PORT` | `3001` | API / production port |
| `DB_FILE` | `server/data/nu-ssis.db` | SQLite file path |
| `RATE_LIMIT` | `600` | API requests per minute per IP |
| `ENABLE_LMS` / `VITE_ENABLE_LMS` | `false` | Optional LMS extras (Faculty portal, class activities, private comments). Outside the project scope; set **both** in `.env` to turn on. |

Copy `.env.example` to `.env` to change them. If you change `API_PORT` in development, also update the proxy target in `vite.config.js`.

## Deployment

```bash
npm install
npm run build
npm start        # http://localhost:3001 — API + the built website
```

For a public URL, persistent storage and HTTPS, follow [`docs/11-deployment.md`](docs/11-deployment.md). Keep the database file on persistent storage and back it up.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `node:sqlite` errors on start | Node is too old — install 22.13 or newer |
| "Request failed (502)" in dev | The API isn't running; use `npm run dev`, not only `npm run web` |
| "Port 5173 is in use" | Close the other dev server or stray `node` processes |
| Can't sign in with a demo account | `npm run db:reset` |
| "Locked for N minutes" while testing | Wait, or sign in as Admin → User Accounts → **Unlock** |
| HTTP 429 in a load test | Raise `RATE_LIMIT` for that server |
| Animations are too much | Turn on "Reduce motion" in your operating system; the app follows it |

---

## Project documents

The project follows Scrum. Everything is in [`docs/`](docs/README.md):

| Document | |
| --- | --- |
| [Project overview](docs/01-project-overview.md) | Problem, users, objectives, scope |
| [Scrum team and tools](docs/02-scrum-team-and-tools.md) | Roles and tools |
| [Product backlog](docs/03-product-backlog.md) · [CSV](docs/product-backlog.csv) | 73 items with priority and status |
| [User stories](docs/04-user-stories.md) | Stories with acceptance criteria |
| [Sprint plan and Definition of Done](docs/05-sprint-plan.md) | Sprints and the DoD checklist |
| [Meeting log](docs/06-meeting-1-agenda.md) | Meeting 1 and a template |
| [Requirements traceability](docs/07-requirements-traceability.md) | Requirement → code → test |
| [System models](docs/08-system-models.md) | DFD, use case, activity, class, ERD |
| [Test plan](docs/09-test-plan.md) | Test levels, security tests, defect log |
| [Ethical and legal notes](docs/10-ethical-and-legal-notes.md) | Draft for the team |
| [Deployment](docs/11-deployment.md) | Live URL guide |
| [Master spec gap analysis](docs/12-master-spec-gap-analysis.md) | Enterprise specification vs. code, roadmap |

### Scrum team

Villarosa, Cristina T. (Product Owner) · Oca, Kenneth Ryan C. (Scrum Master) · Rinon, Rojanne Aizach (Developer — front-end, UI/UX) · Manalo, Ian Israel C. (Developer — system design) · Ramos, Shan Kelvin Louise A. (Developer — database) · Alico, Cyreen G. (QA, documentation).
