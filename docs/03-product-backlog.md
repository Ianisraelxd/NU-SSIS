# 3. Initial Product Backlog

A rough list of everything the system needs, with priorities. It is **not final** — the team adds, removes and re-orders items during backlog refinement.

* **Status** — *Done (prototype)* means a working version exists in the code but has **not yet gone through the team's Definition of Done** (see `05-sprint-plan.md`): it still needs testing and sign-off. *Planned* means not started.
* The same list is in [`product-backlog.csv`](product-backlog.csv) — import it into Trello, Jira or GitHub Projects.

## Accounts

| ID | Item | Priority | Status |
| --- | --- | --- | --- |
| PB-01 | Student login/logout | **High** | Done (prototype) |
| PB-02 | Registrar login/logout | **High** | Done (prototype) |
| PB-06 | Admin user management (create / disable / import accounts) | **High** | Planned |
| PB-03 | User profile and settings | Medium | Done (prototype) |
| PB-04 | Change password | Medium | Done (prototype) |
| PB-05 | Password reset | Medium | Planned |

## Student services

| ID | Item | Priority | Status |
| --- | --- | --- | --- |
| PB-07 | View subjects and instructors | **High** | Done (prototype) |
| PB-08 | View weekly class schedule | **High** | Done (prototype) |
| PB-09 | View grades per semester, grade range and policy | **High** | Done (prototype) |
| PB-11 | Enrollment progress and status | **High** | Done (prototype) |
| PB-12 | Self-service enrollment (registration, subject advising) | **High** | Planned |
| PB-13 | E-clearance per office | **High** | Done (prototype) |
| PB-14 | Account summary (assessment, payments, balance) | **High** | Done (prototype) |
| PB-16 | Request documents and track status | **High** | Done (prototype) |
| PB-10 | Academic tracker | Medium | Done (prototype) |
| PB-17 | Pending tasks (to-dos for clearance, payment, documents, enrollment) | Medium | Done (prototype) |
| PB-18 | Notifications and announcements | Medium | Done (prototype) |
| PB-15 | Online payment | Low | Planned |

## Registrar services

| ID | Item | Priority | Status |
| --- | --- | --- | --- |
| PB-19 | Queue management (first-come-first-served) | **High** | Done (prototype) |
| PB-20 | Document request management (search, filter, update status) | **High** | Done (prototype) |
| PB-21 | Clearance management per office | **High** | Done (prototype) |
| PB-22 | Post announcements | Medium | Done (prototype) |
| PB-23 | Reports with CSV export and print | Medium | Done (prototype) |
| PB-24 | Settings: academic term and document fees | Medium | Done (prototype) |
| PB-25 | Generate document / receipt as PDF | Medium | Planned |
| PB-26 | Audit log | Medium | Planned |
| PB-33 | Queue number display / kiosk screen | Low | Planned |

## Platform

| ID | Item | Priority | Status |
| --- | --- | --- | --- |
| PB-27 | Database integration | **High** | Done (prototype) |
| PB-29 | Automated tests | **High** | Planned |
| PB-28 | Email / SMS notifications | Medium | Planned |
| PB-32 | Deployment guide / hosting | Medium | Planned |
| PB-30 | Light/dark mode and responsive layout | Low | Done (prototype) |
| PB-31 | Animations and polish | Low | Done (prototype) |

## Explicitly out of scope

Learning-management features: class activities and assignments, quizzes, coursework submission, teacher/faculty classroom tools, and class chat or comments. A prototype exists in the code but is switched off (`ENABLE_LMS`).
