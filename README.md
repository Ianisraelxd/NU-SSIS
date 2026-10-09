# NU Laguna — Student Information System (SIS) & Registrar Information System (RIS)

A React + Express + SQLite app built from the Figma prototype. Two portals share one database:

| Portal | Sign in at | Pages |
| --- | --- | --- |
| **Student (SIS)** | `/login` | Home · Subjects · Pending Tasks · Schedule · Academic Tracker · Grades per Semester · Enrollment · E-Clearance · Documents and Forms · Account Summary · Settings |
| **Registrar (RIS)** | `/registrar/login` | Home (+ post announcements) · Queue Management · Document Requests · Clearance Status · Reports · Settings |

Light and dark mode (lightbulb icon in the top bar), notifications (bell), and a phone-friendly layout are included.

## Run it

```bash
npm install
npm run dev        # API on :3001 + Vite on :5173  →  open http://localhost:5173
```

The database is a single SQLite file at `server/data/nu-ssis.db`, created and filled with demo data on first start
(uses Node's built-in `node:sqlite`, so there is nothing to install or configure — XAMPP's MySQL is **not** needed).
To start over with fresh demo data: `npm run db:reset`.

Production: `npm run build && npm start` serves the built app and the API together from `http://localhost:3001`
(set `API_PORT` to change the port).

## Demo accounts (development only)

| Role | ID | Password |
| --- | --- | --- |
| Student (Juan Dela Cruz) | `26001001` (also `26001002` … `26001008`) | `password123` |
| Registrar (Victor Magtanggol) | `REG-0001` | `registrar123` |

Change them under **Settings → Security**. They are defined in `server/seed.js`.

## How it fits together

- `server/` — Express API. `schema.js` (tables), `seed.js` (demo data), `routes/` (auth, common, student, registrar).
  Passwords are scrypt-hashed; sessions are random tokens stored in the DB (7 days).
- `src/` — React app (Vite). `pages/student`, `pages/registrar`, shared `components/` and `lib/`.
- Document requests move **Pending → Processing → Ready → Completed** (or Cancelled); each step notifies the student.
- The Cashier clearance line and the balances are derived from fees/payments, so they can never disagree.
- Transcript of Records and Diploma need a fully cleared E-Clearance (configurable in the registrar’s Settings).

## Deliberate differences from the Figma

- Real data instead of lorem ipsum; the grade-range table now shows the correct point grade for each range.
- The second “Document Type” dropdown on Documents and Forms is now **Purpose**.
- Schedule columns read Mon–Fri instead of “Mon” five times; “Final grade” and “Remarks” columns were added to Grades.
- Settings pages (profile, appearance, notifications, password, and registrar term/fee management) were added.
- The campus photos are replaced with gradients (no image assets were available).
