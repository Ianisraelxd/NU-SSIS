# 3. Product Backlog

The complete list of what the system needs, built from the **System Requirements** in the team's meeting document, plus the digital-queue flow from its queue data-flow diagram. Priorities are **High / Medium / Low**. The backlog is not final — the team adds, removes and re-orders items during refinement.

**Status:** *Built* = working in the code and demonstrated · *Partly built* = some of it works · *Planned* = not started. "Built" does **not** mean "done": an item is **done** only when it meets the Definition of Done in `05-sprint-plan.md` (the team's review and sign-off). Automated tests (`npm test`) cover the flows listed in `07-requirements-traceability.md`.

**Summary:** 73 items — 64 built, 1 partly built, 8 planned. The same list is in [`product-backlog.csv`](product-backlog.csv) for Trello, Jira or GitHub Projects.

## Student Portal

| ID | Item | Priority | Status | Notes |
| --- | --- | --- | --- | --- |
| SP-01 | Student login / logout | **High** | Built | Student number + password; 5 wrong tries lock the account for 15 min |
| SP-02 | View and update basic student profile | Medium | Built | Name/email/phone; address and guardian contact. Academic details are read-only |
| SP-03 | View enrollment status and progress | **High** | Built | 5-step tracker: Subject Selection → Department Review → Registrar Approval → Payment → Enrolled |
| SP-04 | Submit / select subjects for enrollment | **High** | Built | Unit cap from system settings; draft, submit, return-and-resubmit. Subjects whose class times overlap are blocked (409 on the server too) |
| SP-05 | View clearance requirements and status | **High** | Built | Six offices; the Cashier line follows the real balance |
| SP-06 | View grades per semester / subject | **High** | Built | Prelim, Midterm, Finals, final point grade, grade range and policy |
| SP-07 | Request school documents online | **High** | Built | See Document Request System (DR-01…DR-08) |
| SP-08 | Track document request status | **High** | Built | Status badge, history timeline, cancel while Pending / For Payment |
| SP-09 | View payment status and transactions | **High** | Built | Assessment, fees, payments with OR numbers, document fee payments, next due date |
| SP-10 | Receive system notifications and announcements | Medium | Built | Bell notifications for every status change; announcements on Home |
| SP-11 | Subjects, schedule, academic tracker and pending tasks | Medium | Built | From the Figma prototype; Pending Tasks lists service to-dos |

## Registrar Module

| ID | Item | Priority | Status | Notes |
| --- | --- | --- | --- | --- |
| RG-01 | Manage student records | **High** | Built | Add / edit students (one-time password for new accounts) |
| RG-02 | Verify and approve enrollment | **High** | Built | Approval needs verified records; approving creates the student's subject list. Reviewer sees the student's schedule; a clash cannot be approved |
| RG-03 | Manage subjects and class schedules | **High** | Built | Offer / hide subjects; room and instructor conflict detection |
| RG-04 | Manage student grades / grade records | **High** | Built | Grade entry per subject with 0–100 validation; students are notified |
| RG-05 | Process document requests | **High** | Built | Approve, mark ready, release; approve-next-pending shortcut |
| RG-06 | Update document request status | **High** | Built | Steps cannot be skipped; every change is logged and notified |
| RG-07 | Verify student academic information | Medium | Built | Verify action on each record; enrollment approval requires it |
| RG-08 | View enrollment records and reports | Medium | Built | Enrollment list by status; document, clearance, enrollment and queue reports with CSV/print |
| RG-09 | Manage clearance lines (library, laboratory, guidance, registrar) | **High** | Built | Cashier and Department lines are owned by those modules |
| RG-10 | Post announcements | Medium | Built | Students are notified |

## Cashier Module

| ID | Item | Priority | Status | Notes |
| --- | --- | --- | --- | --- |
| CS-01 | View student payment information | **High** | Built | Assessed, paid, balance and % paid per student |
| CS-02 | Record and verify payments | **High** | Built | Amount cannot exceed the balance; method and OR number captured |
| CS-03 | Manage student balances / fees | **High** | Built | Cashier requests add / change / remove; the Administrator approves (separation of duties). The "Due" line always equals the balance |
| CS-04 | Update payment status | Medium | Built | Cashier requests a void with a reason; the Administrator approves and the balance goes back up. OR numbers are system-generated |
| CS-05 | Issue / record official receipt information | **High** | Built | Auto-numbered OR, no duplicates, printable receipt |
| CS-06 | Confirm payment for enrollment or document requests | **High** | Built | Enrollment needs the minimum % paid; documents need the exact fee |
| CS-07 | Generate payment / collection reports | Medium | Built | By period; tuition vs document fees; by payment method; CSV and print |

## Department Module

| ID | Item | Priority | Status | Notes |
| --- | --- | --- | --- | --- |
| DP-01 | View students under the department | **High** | Built | Scoped to the staff member's own department |
| DP-02 | Review enrollment / subject requests | **High** | Built | Shows the student's schedule; approve (sends to Registrar) or return with a reason; a clash cannot be approved |
| DP-03 | Approve or reject department-related clearance | **High** | Built | Approve / Pending / Hold; cannot clear while requirements are unverified |
| DP-04 | Manage / verify academic requirements | Medium | Built | Add, verify, mark missing, remove requirements per student |
| DP-05 | View student grades when authorized | Medium | Built | Own-department students only; every view is written to the audit log |
| DP-06 | Monitor students' clearance status | Medium | Built | All six offices shown read-only |

## Admin Module

| ID | Item | Priority | Status | Notes |
| --- | --- | --- | --- | --- |
| AD-01 | Manage user accounts | **High** | Built | Create staff accounts, edit, disable / enable, unlock, reset password (one-time temp password) |
| AD-02 | Assign user roles and permissions | **High** | Partly built | Roles can be assigned and changed; permissions are fixed per module and shown in a matrix. Custom per-user permissions are not built |
| AD-03 | Manage departments and programs | Medium | Built | Cannot delete a department that still has students or staff |
| AD-04 | Manage system settings | Medium | Built | School name, max units, minimum payment %, default queue minutes, max copies — validated |
| AD-05 | Manage academic year / semester | Medium | Built | Add terms and set the current one |
| AD-06 | Monitor system activities | Medium | Built | Dashboard: accounts, locked / disabled, failed sign-ins (24 h), open requests, queue, collections |
| AD-07 | View system-wide reports | Medium | Built | System summary plus every module's reports |
| AD-08 | Maintain audit / activity logs | **High** | Built | Who did what and when; searchable and filterable |
| AD-09 | Manage announcements | Medium | Built | Same editor as the Registrar |

## Document Request System

| ID | Item | Priority | Status | Notes |
| --- | --- | --- | --- | --- |
| DR-01 | Select a document (Transcript of Records, Certificate of Enrollment, Certificate of Grades, others) | **High** | Built | Seven document types; the Registrar can change the list and fees |
| DR-02 | Submit document requests online | **High** | Built | Purpose, copies, pickup date; rejects past dates, bad copy counts and duplicate open requests |
| DR-03 | Show document requirements and corresponding fees | **High** | Built | Requirements and fee are shown while choosing; Transcript and Diploma need a cleared E-Clearance |
| DR-04 | Registrar approves / processes requests | **High** | Built | Approve → For Payment (or straight to Processing when free) |
| DR-05 | Cashier verifies payment | **High** | Built | Exact fee required; official receipt issued; moves to Processing |
| DR-06 | Track status: Pending → For Payment → Processing → Ready for Release → Released | **High** | Built | Enforced on the server; cannot skip a step |
| DR-07 | Notify students when documents are ready | Medium | Built | A notification at every step, including "ready for release" |
| DR-08 | Maintain document request history | Medium | Built | request_history: status, note, who, when |

## Digital Queue

| ID | Item | Priority | Status | Notes |
| --- | --- | --- | --- | --- |
| QU-01 | Register queue entry (join a queue by office and service) | **High** | Built | Registrar, Cashier or the student's Department; one active ticket at a time |
| QU-02 | Generate queue number | **High** | Built | R-001, C-001, D-001 … restarting every day |
| QU-03 | Monitor queue status (position, estimated wait, now serving) | **High** | Built | Live: refreshes every few seconds; estimate uses the real average service time |
| QU-04 | Notify the student | **High** | Built | When called, when 3 numbers away, and when skipped |
| QU-05 | Manage queue — call next, with counter assignment | **High** | Built | First come first served; staff name their counter |
| QU-06 | Update queue status (serving, done, skipped, cancelled) | **High** | Built | A ticket can only be finished by the staff member serving it |
| QU-07 | Generate queue reports and analytics | Medium | Built | Tickets, served, average wait and service time, per office and service |

## Security & Quality

| ID | Item | Priority | Status | Notes |
| --- | --- | --- | --- | --- |
| SQ-01 | Password hashing and session expiry | **High** | Built | scrypt with per-user salt; sessions last 7 days; password change signs out other devices |
| SQ-02 | Brute-force protection | **High** | Built | Account lock after 5 failures (15 min) + per-IP throttle on failed sign-ins |
| SQ-03 | Rate limiting | **High** | Built | 600 requests / minute / IP on the API (configurable) |
| SQ-04 | SQL-injection protection | **High** | Built | Every query is parameterised |
| SQ-05 | Role-based access control | **High** | Built | Each module accepts only its role; department data scoped by department |
| SQ-06 | Automated tests (unit, integration, security) and a load-test script | **High** | Built | 82 tests: npm test. Load test: scripts/perf.mjs |
| SQ-07 | Light / dark mode, responsive layout, accessible UI | Low | Built | Keyboard navigation, focus rings, reduced-motion support |

## Planned

| ID | Item | Priority | Status | Notes |
| --- | --- | --- | --- | --- |
| PL-01 | Live deployment (public URL) | **High** | Planned | Required by the paper (Task 6). See docs/11-deployment.md |
| PL-02 | Email / SMS notifications | Medium | Planned | The preference switch exists; nothing is sent yet |
| PL-03 | Self-service password reset | Medium | Planned | Today the Administrator resets passwords |
| PL-04 | Online payment gateway | Low | Planned | Needs a payment provider |
| PL-05 | PDF generation of documents and receipts | Medium | Planned | Receipts print from the browser today |
| PL-06 | Custom per-user permissions | Low | Planned | See AD-02 |
| PL-07 | Bulk import of students and subjects (CSV) | Medium | Planned |  |
| PL-08 | Queue display screen / SMS number alerts | Low | Planned |  |

## Explicitly out of scope

Learning-management (LMS) features — class activities and assignments, quizzes, coursework submission, teacher classroom tools, class chat or comments. A prototype exists in the code but is switched off (`ENABLE_LMS`).
