# 12. Enterprise specification — assessment and roadmap

Response to the long "University School Services Information System" master prompt. It compares that specification with what the code does today and proposes an order of work. Nothing here is a claim of completion: items marked *Missing* are not built.

## 12.1 Current state

| Item | State |
| --- | --- |
| Stack | React 19 + Vite, Express 5, PostgreSQL (Neon; embedded PGlite for local use) — a modular monolith, which matches the spec's recommended starting point (Decision F) |
| Modules | Student, Registrar, Cashier, Department, Admin portals; document requests; digital queue; audit log |
| Security | scrypt hashing, 7-day sessions, account lockout, per-IP throttle, rate limit, parameterised SQL, role checks, CSP in production |
| Tests | 74 automated tests (unit, API, security), load-test script |
| Added in this step | Global loading bar with a "slow connection" note, spinner on the sign-in button, **login-attempt log** (every attempt recorded; admin page *Login Attempts*), and "N attempts left" on failed sign-in |

### Login attempts — details

- Table `login_attempts` records time, ID entered, portal, success, reason, IP and browser. Passwords are never stored.
- The failed-sign-in message shows attempts left. Unknown IDs get the same countdown (kept in memory) so the message cannot be used to discover which accounts exist.
- Admin → *Login Attempts* lists them with search and a success/failed filter. A test checks that non-admins get 403.

## 12.2 Gap analysis against the specification

| Spec module | Today | Gap |
| --- | --- | --- |
| A — Identity and access | 5 fixed roles, backend-enforced, lockout, audit | Configurable roles/permissions, super-administrator, privileged-action reasons, session revocation UI, CSRF review |
| B — Dynamic documents and forms | Seven fixed document types with fees and clearance rules | **Missing:** `document_fields`, form builder, dynamic form renderer, field validation rules, configuration versioning |
| B — Templates / PDF | Receipts print from the browser | **Missing:** versioned templates, safe PDF rendering, issuance reference numbers, verification codes |
| C — Campus presence | None | **Missing:** approved IP ranges with trusted-proxy handling, QR check-in tokens, per-service presence policy |
| D — Queue | Tickets per day, call next, skip, finish, estimates | Priorities, no-show window and timers, recall/requeue, concurrency tests on ticket numbers |
| E — Notifications | In-app only | Email/SMS channel, delivery log, retries, preferences by event |
| F — Service configuration | Admin settings, departments, terms, doc fees | Service definitions, operating schedules, versioned configuration |
| G — Reporting | Document, enrollment, clearance, queue, collection reports | Staff workload, feedback report, median wait, hourly volume, export auditing |
| H — Accessibility / fallback | Keyboard, focus, reduced motion | Kiosk mode and downtime procedure |
| I — Privacy / retention | Audit log, hashed passwords | Retention policies, cleanup jobs, file-storage rules, privacy notice |
| M — Feedback | None | Post-completion rating and comment |
| Database | 25 tables, version-checked reset on upgrade | Real migrations (today an older database is backed up and recreated) |

## 12.3 Roadmap

Each phase should end with working code, tests and updated docs.

1. **Foundation (partly done)** — migrations instead of reset-on-upgrade; configurable roles and permissions; session management. *Acceptance:* a schema change keeps existing data.
2. **Dynamic forms** — `document_types` extended with `document_fields`; form renderer; server-side validation; config version stored on each request. *Acceptance:* an admin adds a document type and field without code, and a student submits it.
3. **Presence verification** — IP ranges, QR tokens (single-use, short-lived, authenticated redemption), policy per service. *Acceptance:* replay and expired-token tests pass.
4. **Queue hardening** — no-show timers, recall, priorities (admin-approved), concurrent-ticket test.
5. **Documents** — versioned templates, PDF generation, issuance numbers.
6. **Notifications and feedback** — email channel, delivery records, feedback form.
7. **Reporting, retention, kiosk mode** — remaining reports, cleanup jobs, fallback procedure.
8. **Hardening and deployment** — see [`11-deployment.md`](11-deployment.md).

## 12.4 Decisions needed from the school or team

These change correctness or legal exposure, so they should not be guessed:

- Which documents can be issued automatically, and which need staff approval.
- Whether a document needs a QR or verification code, and who the issuing authority is.
- Campus network details (IP ranges, VPN, proxy) for presence checks.
- Retention periods for requests, issued documents and audit records (see [`10-ethical-and-legal-notes.md`](10-ethical-and-legal-notes.md)).
- Whether priority lanes are allowed.
- Whether SMS is wanted (it needs a provider and budget).

## 12.5 Recommended next step

Phase 2 (dynamic forms) gives the most value and unlocks phases 3 and 5. It needs a schema change, so do the migration framework from phase 1 first. This is a large piece of work and should be reviewed by the team before building.
