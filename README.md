# NU Laguna — Student Services Information System (SSIS)

**Development of a Web-Based Student Services Information System (SSIS) with Integrated Queuing, Clearance, and Document Request Modules Using Scrum Methodology** — CCS109 / 3IT-C, National University Laguna.

A **services** web app (not an LMS). One database, five portals:

| Portal | For | Main jobs |
| --- | --- | --- |
| **Student (SIS)** | Students | Subjects, schedule, grades, online enrollment, clearance, balance, document requests, digital queue number |
| **Registrar (RIS)** | Registrar staff | Student records, enrollment approval, subjects/schedules/grades, document requests, queue, reports, announcements |
| **Cashier** | Cashier | Payments, official receipts, fees, enrollment/document payment confirmation, collection reports |
| **Department** | Department staff | Subject review, academic requirements, department clearance, grades (audited) |
| **Admin** | Administrators | Accounts and roles, departments/programs/terms, settings, audit log, system reports |

**Stack:** React 19 + Vite · React Router · Express 5 · SQLite (Node's built-in `node:sqlite`) — no external database to install.

Project documents (backlog, user stories, models, test plan, traceability) are in [`docs/`](docs/README.md).

---

## Quick start

**Requirements:** [Node.js](https://nodejs.org) **22.13+** (tested on Node 26) and npm.

```bash
npm install
npm run dev
```

Open **http://localhost:5173**. This starts the API (http://localhost:3001) and the Vite dev server together. On first start the database is created at `server/data/nu-ssis.db` with demo data. `npm run db:reset` wipes and re-seeds it.

> Upgrading from an older version: if the database format is older, it is copied to `server/data/nu-ssis.backup-<time>.db` and a fresh one is created.

### Sign-in pages

| Portal | URL |
| --- | --- |
| Student | `/login` |
| Registrar | `/registrar/login` |
| Cashier | `/cashier/login` |
| Department | `/department/login` |
| Admin | `/admin/login` |

## Demo accounts

Development-only accounts from `server/seed.js`. Change passwords under **Settings → Security**.

| Role | ID | Password |
| --- | --- | --- |
| Students (`26001001` is Juan Dela Cruz; ten with varied enrollment states) | `26001001` … `26001010` | `password123` |
| Registrar | `REG-0001` | `registrar123` |
| Cashier | `CSH-0001` | `cashier123` |
| Department (CCIT, CBAA) | `DEP-0001`, `DEP-0002` | `department123` |
| Admin | `ADM-0001` | `admin123` |

---

## How things work

**Enrollment:** student picks subjects → Department Review → Registrar Approval (needs verified records) → Cashier confirms the minimum payment (default 50%) → Enrolled.

**Document request:** `Pending → For Payment → Processing → Ready for Release → Released` (or Cancelled while Pending / For Payment). Steps cannot be skipped; the Cashier must verify the exact fee and issues an official receipt number; every change is logged and the student is notified. Transcript and Diploma need a cleared E-Clearance.

**Digital queue:** a student takes a number for the Registrar, Cashier or their Department (R-001, C-001, D-001, restarting daily), sees position and estimated wait, and is notified when called. Staff name their counter, call the next number, and finish or skip it. Queue reports show tickets, served, average wait and service time.

**Other rules:** one active queue ticket per student; no duplicate open document requests; grades 0–100; the Cashier clearance line follows the real balance; department staff only see their own department; admin settings (max units, minimum payment %, queue minutes, max copies) are validated.

---

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | API + web with auto-reload |
| `npm run build` | Production build into `dist/` |
| `npm start` | API that also serves `dist/` |
| `npm test` | 60 automated tests (unit, API, security) on a throw-away database |
| `node scripts/perf.mjs` | Load test against a running server |
| `npm run db:reset` | Delete and re-seed the database |
| `npm run lint` | Lint |

## Environment variables (all optional)

| Variable | Default | Meaning |
| --- | --- | --- |
| `API_PORT` | `3001` | API / production port |
| `DB_FILE` | `server/data/nu-ssis.db` | SQLite file path |
| `RATE_LIMIT` | `600` | API requests per minute per IP |
| `ENABLE_LMS` / `VITE_ENABLE_LMS` | `false` | Optional LMS extras (Faculty portal, class activities, private comments). Out of project scope; set both in `.env` to turn on. |

## Project structure

```
server/   index.js · db.js · schema.js · seed.js · util.js · requests.js · reports.js
          routes/ auth · common · student · registrar · cashier · department · admin · queue · announcements
src/      App.jsx · components/ · lib/ · pages/{student,registrar,cashier,department,admin}
tests/    api.test.mjs · unit.test.mjs
scripts/  perf.mjs
docs/     Scrum, requirements, models, test plan, deployment
```

## Security

Every sign-in attempt is logged (Admin → Login Attempts) and failed sign-ins show the attempts left. Passwords hashed with scrypt; 7-day sessions that end on password change; account lock after 5 failed sign-ins (15 min) plus a per-IP throttle; global rate limit; parameterised SQL everywhere; role checks on every route; security headers and a strict CSP in production; audit log of sensitive actions. This is still a demo build: demo passwords are public and HTTPS depends on how you host it — see [`docs/11-deployment.md`](docs/11-deployment.md).

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `node:sqlite` errors on start | Node is too old; install 22.13+ |
| "Request failed (502)" | API not running; use `npm run dev` |
| Can't sign in with a demo account | `npm run db:reset` |
| Account locked in testing | Wait 15 minutes, or sign in as Admin and unlock it |
| 429 errors in a load test | Raise `RATE_LIMIT` for that server |
