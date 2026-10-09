# NU Laguna — Student & Registrar Information System

A web app with three portals that share one database:

- **SIS — Student Information System**: students view their subjects, schedule, grades, clearance and balance, and request school documents online.
- **RIS — Registrar and Records Information System**: registrar staff manage the document queue, clearances, announcements and reports.
- **FIS — Faculty Portal**: teachers post class activities and chat privately with students about them — a Google Classroom–style *private comments* feature with live, instant messaging.

It was built from the Figma prototype, then polished: clearer typography, light/dark mode, a phone-friendly layout, and a full set of animations.

**Stack:** React 19 + Vite · React Router · Express 5 · SQLite (Node's built-in `node:sqlite`) — no external database to install.

---

## Table of contents

1. [Quick start](#quick-start)
2. [Demo accounts](#demo-accounts)
3. [Features](#features)
4. [Private comments (chat)](#private-comments-chat)
5. [How a document request works](#how-a-document-request-works)
6. [Design & animations](#design--animations)
7. [Project structure](#project-structure)
8. [Database](#database)
9. [API reference](#api-reference)
10. [Configuration & scripts](#configuration--scripts)
11. [Running on XAMPP / production](#running-on-xampp--production)
12. [Troubleshooting](#troubleshooting)
13. [Security notes](#security-notes)

---

## Quick start

**Requirements:** [Node.js](https://nodejs.org) **22.13 or newer** (tested on Node 26) and npm. Nothing else — XAMPP's Apache/MySQL are *not* needed to run the app.

```bash
cd C:\xampp\htdocs\NU-SSIS
npm install
npm run dev
```

Then open **http://localhost:5173**.

`npm run dev` starts two things together:

| Process | Address | What it is |
| --- | --- | --- |
| `api` | http://localhost:3001 | Express API + SQLite database |
| `web` | http://localhost:5173 | Vite dev server (proxies `/api` to the API) |

On the very first start the database file is created at `server/data/nu-ssis.db` and filled with demo data. To wipe everything and start over:

```bash
npm run db:reset
```

### Where to sign in

| Portal | URL |
| --- | --- |
| Student (SIS) | http://localhost:5173/login |
| Registrar (RIS) | http://localhost:5173/registrar/login |
| Teacher (Faculty Portal) | http://localhost:5173/teacher/login |

Each login page links to the other portals.

---

## Demo accounts

Development-only accounts created by `server/seed.js`. Change the passwords under **Settings → Security** after signing in.

| Role | ID | Password |
| --- | --- | --- |
| Student — Juan Dela Cruz (the one in the Figma) | `26001001` | `password123` |
| Other students | `26001002` … `26001008` | `password123` |
| Registrar — Victor Magtanggol | `REG-0001` | `registrar123` |
| Teachers — e.g. `T-0001` is Jearemy Niko Nositera (CCS109, ITEW3) | `T-0001` … `T-0007` | `teacher123` |

The other students exist so the registrar side has realistic data (queue, clearance table, reports). Juan already has a few comment threads, so sign in as `26001001` in one window and `T-0001` in another browser (or a private window) to try the chat live.

---

## Features

### Student portal (SIS)

| Page | What you can do |
| --- | --- |
| **Home** | Welcome banner, four at-a-glance tiles (next class, pending tasks, balance, clearance) and the announcements feed. |
| **Subjects** | Every enrolled subject with units, instructor(s), days, times and rooms. |
| **Pending Tasks** | Assignments with points and due dates (turns red when due soon). Mark as done / undo; filter Pending · Done · All. Each card has a **comment** button with a live unread badge; click a task for its details, instructions and the private chat with your teacher. |
| **Messages** | Inbox of all your conversations with teachers, with unread counts, online dots and live updates. |
| **Schedule** | Weekly Mon–Fri timetable, colour-coded per subject, with today highlighted. |
| **Academic Tracker** | GWA, units earned/remaining, standing, progress per year level, current-subject averages. |
| **Grades per Semester** | Pick any semester; see Prelim / Midterm / Finals, final point grade and remarks, plus the grade-range table and grading policy. |
| **Enrollment** | Status, section, units and a five-step progress tracker (Registration → Subject Advising → Fee Assessment → Payment → Enrolled). |
| **E-Clearance** | Clearance per office (Library, Laboratory, Department Head, Guidance, Cashier, Registrar) with status and remarks. |
| **Documents and Forms** | Request a document (type, purpose, copies, pickup date, remarks), see the total fee, track all requests, cancel pending ones. |
| **Account Summary** | Total assessment, paid, remaining balance, next due date, fee breakdown and payment history. |
| **Settings** | Profile, light/dark theme, notification preferences, change password. |

### Faculty portal (teachers)

| Page | What you can do |
| --- | --- |
| **Home** | Counters (activities, subjects, students, unread comments) and your upcoming deadlines. |
| **Activities** | Everything you posted. **+ New activity** (subject, title, type, points, due date, instructions) is sent to every student enrolled in that subject, who are notified. |
| **Activity page** | Who has marked it done, and a two-pane view: students on the left (unread first), the live chat with the selected student on the right. Delete an activity (and its comments) if needed. |
| **Messages** | One inbox for all your student conversations. |
| **Settings** | Profile, theme, notifications, password. |

### Registrar portal (RIS)

| Page | What you can do |
| --- | --- |
| **Home** | Overview counters (waiting, processing, ready, released today, students on hold) and announcements — post, edit and delete them. Students are notified of new posts. |
| **Queue Management** | First-come-first-served queue. **Call next** moves the oldest waiting request into processing; handle *Now processing*, *Waiting* and *Ready for pickup* lists. |
| **Document Requests** | Every request with search (name, student number, request no.) and status / document filters. Advance or cancel from the row. |
| **Clearance Status** | All students with their clearance progress. **Manage** opens a dialog to set each office to Cleared / Pending / Hold with remarks, and to move the student's enrollment step. |
| **Reports** | Choose a period (Today, This Week, This Month, All time) and a report (Document Requests, Clearance, Enrollment), press **Generate**, then **Export CSV** or **Print**. |
| **Settings** | Everything students have, plus the **current academic term**, adding terms, and **document fees** (fee, "needs clearance", available). |

### Everywhere

- **Notifications** (bell): students are told when a request changes status or a clearance changes; registrars are told about new requests. Refreshes every 30 s.
- **Light / dark mode**: the lightbulb in the top bar (saved to your account).
- **Responsive**: the sidebar becomes a slide-in menu on phones and tablets.
- **Accessible**: keyboard navigation, visible focus rings, labelled controls, screen-reader labels on progress bars and charts, and reduced-motion support.

### Business rules worth knowing

- **Transcript of Records** and **Diploma** can only be requested when the student's E-Clearance is complete (configurable per document in the registrar's Settings).
- A student can't have two *open* requests (pending or processing) for the same document.
- Pickup dates can't be in the past; copies are limited to 1–10.
- The **Cashier** clearance line is computed from the student's real balance, so it always agrees with Account Summary and can't be edited by hand.
- A final grade is shown only once Prelim, Midterm and Finals are all posted. Grade → point grade scale: 96–100 = 1.00, 92–95 = 1.25, 88–91 = 1.50, 84–87 = 1.75, 80–83 = 2.00, 75–79 = 2.25, 70–74 = 2.50, 65–69 = 2.75, 60–64 = 3.00, below 60 = 5.00 (Failed).

---

## Private comments (chat)

Inspired by Google Classroom's *private comments*: every task has its own private conversation between **one student and the teacher who posted it**. Nobody else — not classmates, not the registrar — can read it.

**What it does**

- **Instant delivery** — messages appear on the other person's screen immediately, with no refresh (Server-Sent Events).
- **Typing indicator** — animated dots while the other person is typing.
- **Delivery and read receipts** — *Sending… → ✓ Delivered → ✓✓ Seen*.
- **Online / offline dot** next to the person's avatar.
- **Unread badges** on the Messages menu, task cards, activity lists and the notification bell.
- **Edit and delete your own comments** (deleted ones show "This comment was deleted"; edited ones are marked *edited*).
- **Details**: Enter to send / Shift+Enter for a new line, emoji picker, clickable links, day separators, grouped bubbles, retry when a send fails, 2000-character limit, light and dark mode, phone layout.
- **Everything is saved** in the database (`task_messages`), so history survives restarts.

**Where to find it**

| Who | Where |
| --- | --- |
| Student | Pending Tasks → click a task (or its comment button) → *Private comments*. All threads: **Messages**. |
| Teacher | Activities → open an activity → pick a student. All threads: **Messages**. |

**How it works under the hood:** the browser trades its login token for a one-time ticket (`POST /api/stream/ticket`), then opens `GET /api/stream?ticket=…`. The server pushes `message`, `typing`, `read`, `presence`, `notification` and `unread` events to the two people in a thread. Messages and read positions live in `task_messages` and `thread_reads`. Access is checked on every call: a student can only open their own task's thread and a teacher only threads on their own activities.

---

## How a document request works

```
Student submits ──► Pending ──► Processing ──► Ready ──► Completed
                       │            │            │
                       └────────────┴────────────┴──► Cancelled
```

1. The student files a request on **Documents and Forms**. The registrar gets a notification.
2. In **Queue Management** (or **Document Requests**) the registrar moves it forward: *Start processing → Mark ready → Release*.
3. Each step notifies the student. Steps can't be skipped. Students can cancel only while the request is still *Pending*.
4. **Reports** counts *Released* = Completed, *Pending* = everything still open, and averages the time from filing to release.

---

## Design & animations

The look follows the Figma (navy sidebar, rounded cards, Montserrat) with higher contrast, larger text, status pills and a gold accent.

Motion is used to give feedback, never to slow you down:

| Where | Animation |
| --- | --- |
| Page changes | Content fades and slides up in a staggered cascade |
| Numbers | Stat tiles count up from zero (₱6,000, 96, 2.4 days…) |
| Progress bars | Grow in with a soft shimmer; stacked report bars grow in sequence |
| Enrollment stepper | Dots pop in one by one, the line draws between them, the current step pulses |
| Schedule | Class blocks pop in; hovering enlarges the block |
| Hero & login | Slowly moving gradients and floating glow orbs; the logo gently bobs |
| Sidebar | Links slide in, nudge on hover, and a gold marker marks the active page |
| Buttons | Lift on hover with a light sweep, squish on press |
| Cards & tiles | Lift on hover; tiles get a gradient underline |
| Dialogs & menus | Springy pop-in with a blurred backdrop |
| Toasts | Slide in from the right with a countdown bar |
| Bell | Rings when you have unread notifications; badge pulses |
| Status pills | *Pending* and *Processing* have a pulsing dot |
| Loading | Shimmering skeleton screens instead of a spinner |
| Chat | New bubbles spring in, typing dots bounce, online dots pulse, unread badges pulse |
| Success moments | **Confetti** when you mark a task done, submit a document request, or the registrar releases a document |
| Theme switch | Smooth cross-fade between light and dark |

### Logos & branding

The official emblems were traced to **real vector paths**, so they stay sharp at any size and can be recoloured freely.

| Portal | Emblem | In the app |
| --- | --- | --- |
| Student (SIS) | SIS cap, lightbulb and wings | White on the navy sidebar and login |
| Faculty | SIS emblem | Gold, to tell the portals apart |
| Registrar (RIS) | RIS wings, books, key and charts | White on the navy sidebar and login |

- **Ready-made files** are in `public/brand/`: `logo.svg` / `logo-white.svg` (SIS with the "Student Information System" wordmark), `logo-mark.svg` / `logo-mark-white.svg` (emblem only) and `ris-logo.svg` / `ris-logo-white.svg`. The browser-tab icon is `public/favicon.svg`.
- **Changing the colour in the app:** the `<Logo>` component (`src/components/icons.jsx`) draws the emblem with `currentColor`, so any CSS `color` recolours it. The defaults live at the bottom of `src/chat.css` (`.logo`, `.logo-fis`).
- **Changing the colour of the standalone files:** open the SVG and edit the `fill` value on the first line (`#0a1545` navy or `#ffffff` white).
- **Using new artwork later:** the path data lives in `src/assets/logo-paths.js`.

Everything respects the operating system's **"reduce motion"** setting: with it on, animations are effectively disabled and nothing loops.

---

## Project structure

```
NU-SSIS/
├─ server/                    Express API + database
│  ├─ index.js                App entry (API_PORT, serves dist/ in production)
│  ├─ db.js                   Opens SQLite, runs the schema
│  ├─ schema.js               CREATE TABLE statements
│  ├─ seed.js                 Demo data (+ demo passwords)
│  ├─ realtime.js             Server-Sent Events hub (connections, tickets, presence)
│  ├─ util.js                 Password hashing, grading, balances, clearance, notifications
│  ├─ routes/
│  │  ├─ auth.js              Login / logout / session middleware
│  │  ├─ common.js            Term, announcements, notifications, settings
│  │  ├─ messages.js          Private comments: threads, send/edit/delete, typing, inbox, live stream
│  │  ├─ teacher.js           Everything under /api/teacher (activities)
│  │  ├─ student.js           Everything under /api/student
│  │  └─ registrar.js         Everything under /api/registrar
│  └─ data/nu-ssis.db         The database file (created on first run, git-ignored)
├─ src/                       React app
│  ├─ main.jsx · App.jsx      Entry and routes
│  ├─ index.css · chat.css    All styling, themes, animations and the chat UI
│  ├─ components/             Layout (sidebar/topbar), Chat, ui (cards, tables, modal, toast…), icons
│  ├─ lib/                    api client, auth, realtime (live events), formatters, hooks, fx (confetti)
│  └─ pages/
│     ├─ Login.jsx · Settings.jsx · MessagesPage.jsx
│     ├─ teacher/             Home, Activities, ActivityDetail
│     ├─ student/             Home, Subjects, Tasks, Schedule, Tracker, Grades, Enrollment, Clearance, Documents, Account
│     └─ registrar/           Home, Queue, Requests, Clearance, Reports, RequestActions
├─ index.html · vite.config.js
└─ package.json
```

---

## Database

SQLite, one file. Tables:

| Table | Purpose |
| --- | --- |
| `users` | Students, teachers and registrars: login ID, scrypt password hash, name, email, phone, theme, notification prefs |
| `sessions` | Login tokens (7-day expiry) |
| `terms` | Academic terms; exactly one is `is_current` |
| `students` | Program, year level, section, enrollment step, standing |
| `year_progress` | Units earned vs required per year level |
| `subjects`, `meetings` | Catalog and weekly class meetings (teacher, day, time, room) |
| `student_subjects` | A student's subjects per term with Prelim / Midterm / Finals |
| `activities` | Class activities posted by a teacher for a subject (title, points, due date, instructions) |
| `tasks` | A student's copy of an activity (done / not done) |
| `task_messages` | Private comments between a student and the teacher, per task (edit/delete timestamps) |
| `thread_reads` | How far each person has read each thread (drives unread counts and *Seen*) |
| `announcements` | Registrar posts |
| `clearances` | Per-office clearance status and remarks |
| `fees`, `payments` | Assessment lines and payment/installment history |
| `doc_types` | Documents, their fees and whether they need clearance |
| `doc_requests` | Document requests and their status history timestamps |
| `notifications` | In-app notifications |

You can inspect it with any SQLite tool (e.g. [DB Browser for SQLite](https://sqlitebrowser.org)) — open `server/data/nu-ssis.db`.

---

## API reference

All routes are under `/api`, JSON in / JSON out. After `POST /auth/login`, send `Authorization: Bearer <token>`. Errors look like `{ "error": "message" }`.

**Auth** — `POST /auth/login` · `GET /auth/me` · `POST /auth/logout`

**Shared (any signed-in user)** — `GET /term` · `GET /announcements` · `GET /notifications` · `POST /notifications/read-all` · `POST /notifications/:id/read` · `PUT /settings/profile` · `PUT /settings/preferences` · `POST /settings/password`

**Private comments** (students and teachers) — `POST /stream/ticket` · `GET /stream?ticket=` (live events) · `GET /messages/inbox` · `GET /messages/unread` · `GET|POST /tasks/:id/messages` · `POST /tasks/:id/typing` · `POST /tasks/:id/read` · `PATCH|DELETE /messages/:id`

**Teacher** (`/teacher/…`) — `GET home · subjects · activities · activities/:id` · `POST activities` · `DELETE activities/:id`

**Student** (`/student/…`) — `GET home · subjects · schedule · tasks · tasks/:id · tracker · grades?term= · enrollment · clearance · documents · account` · `POST tasks/:id/toggle` · `POST documents/requests` · `POST documents/requests/:id/cancel`

**Registrar** (`/registrar/…`) — `GET overview · requests?status&type&q · queue · clearance?q&status · clearance/:studentId · reports?type&period · config` · `PATCH requests/:id` · `POST queue/next` · `PUT clearance/item/:id` · `PUT students/:id/enrollment` · `POST|PUT|DELETE announcements` · `PUT config/term` · `POST config/terms` · `PUT config/doc-types/:id`

Student routes reject registrars and vice-versa (HTTP 403).

---

## Configuration & scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | API + web together, with auto-reload |
| `npm run server` | API only (`node --watch`) |
| `npm run web` | Vite only |
| `npm run build` | Production build into `dist/` |
| `npm start` | Runs the API, which also serves `dist/` if it exists |
| `npm run db:reset` | Deletes `server/data/` and starts the API, which re-creates and re-seeds it |
| `npm run lint` | Lints the code |

Environment variables (all optional):

| Variable | Default | Meaning |
| --- | --- | --- |
| `API_PORT` | `3001` | Port for the API (and for the built app in production) |
| `DB_FILE` | `server/data/nu-ssis.db` | Path to the SQLite file |

If you change `API_PORT` during development, also update the proxy target in `vite.config.js`.

---

## Running on XAMPP / production

The app doesn't use Apache or MySQL. The simplest way to "deploy" it on the same PC:

```bash
npm install
npm run build
npm start          # → http://localhost:3001  (API + the built website)
```

To keep it running in the background, use a process manager such as [PM2](https://pm2.keymetrics.io) (`npm i -g pm2 && pm2 start server/index.js --name nu-ssis`).

If you later need MySQL (for example because the school requires it), the SQL in `server/routes/*.js` is plain and portable; only `server/db.js`, the `RETURNING` clauses and a few SQLite functions would need adapting.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `Cannot find module 'node:sqlite'` / syntax errors on start | Your Node is too old. Install Node 22.13+ and re-run `npm install`. |
| Page loads but shows "Request failed (502)" | The API isn't running. Use `npm run dev` (not just `npm run web`), and check nothing else uses port 3001. |
| "Port 5173 is in use" | Another dev server is running. Close it, or stop stray `node` processes. |
| Can't sign in with a demo account | The database may have been changed. Run `npm run db:reset` to restore the demo data. |
| Want a clean slate | `npm run db:reset` |
| "Old database format found" on start | You upgraded from a version without teachers/chat. The old file was kept as `server/data/nu-ssis.backup-….db` and a fresh database was created. |
| Chat messages don't appear live | Check that nothing is blocking `/api/stream` (some proxies buffer event streams). Messages are still saved and show after a refresh. |
| Animations feel too much | Turn on "Reduce motion" in your OS accessibility settings; the app follows it. |

---

## Security notes

- Passwords are hashed with **scrypt** and per-user salts; sessions are random 256-bit tokens that expire after 7 days, and changing your password signs out your other devices.
- Login attempts are rate-limited per IP; every API route checks the signed-in user's role. Chat sends are limited to 30 per minute per user, and the live stream uses a one-time 30-second ticket instead of putting your token in a URL.
- All SQL uses parameterised statements, and React escapes all displayed text.
- This is a **development/demo build**: sign-in tokens live in the browser's local storage, there is no HTTPS or email service (the "Email me too" switch only stores the preference), and the demo passwords are public. Before real use: change every password, serve it over HTTPS, and review the points above.
