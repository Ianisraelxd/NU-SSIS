# 8. System models

Diagrams are written in [Mermaid](https://mermaid.js.org), which GitHub renders directly. The team can redraw them in draw.io or Lucidchart for the paper. These are drafts based on the implemented system; the team should review them.

## 8.1 Context-level data flow diagram

```mermaid
flowchart LR
  S([Student]) -- "login, enrollment, queue request,<br/>document request, payment inquiry" --> SSIS((SSIS))
  SSIS -- "queue number, status, receipts,<br/>grades, clearance, notifications" --> S
  R([Registrar]) -- "record updates, request processing,<br/>queue calls, grades" --> SSIS
  SSIS -- "requests, enrollment, reports" --> R
  C([Cashier]) -- "payments, fee changes" --> SSIS
  SSIS -- "balances, official receipts, collection reports" --> C
  D([Department]) -- "subject review, clearance, requirements" --> SSIS
  SSIS -- "students, enrollment requests, grades" --> D
  A([Administrator]) -- "accounts, roles, settings" --> SSIS
  SSIS -- "audit logs, system reports" --> A
```

## 8.2 Level-1 DFD — digital queue

```mermaid
flowchart TD
  S([Student]) -->|"service request"| P1["1. Register queue entry"]
  P1 -->|"ticket data"| DS[("Queue tickets")]
  P1 --> P2["2. Generate queue number<br/>R-001 / C-001 / D-001"]
  P2 -->|"queue number"| S
  DS --> P3["3. Monitor queue status<br/>position, wait, now serving"]
  P3 -->|"status"| S
  ST([Staff]) -->|"call next"| P4["4. Manage queue<br/>assign counter"]
  DS --> P4
  P4 -->|"called / serving"| P5["5. Update queue status<br/>done, skipped, cancelled"]
  P5 --> DS
  P4 --> P6["6. Notify student"]
  P6 -->|"notification"| S
  DS --> P7["7. Queue reports"]
  P7 -->|"analytics"| ST
```

## 8.3 Use case diagram

```mermaid
flowchart LR
  Student([Student]) --- U1(Sign in) & U2(Enroll online) & U3(Take queue number) & U4(Track clearance) & U5(Request document) & U6(View grades & balance)
  Registrar([Registrar]) --- R1(Manage records) & R2(Approve enrollment) & R3(Manage subjects & grades) & R4(Process document requests) & R5(Run queue) & R6(Reports)
  Cashier([Cashier]) --- C1(Record payment & issue OR) & C2(Manage fees) & C3(Confirm enrollment/document payment) & C4(Collection reports)
  Dept([Department]) --- D1(Review subjects) & D2(Verify requirements) & D3(Approve clearance) & D4(View grades)
  Admin([Administrator]) --- A1(Manage accounts & roles) & A2(Settings, departments, terms) & A3(Audit log) & A4(Announcements)
```

## 8.4 Activity diagram — document request

```mermaid
flowchart TD
  A([Start]) --> B[Student chooses document and submits]
  B --> C{Needs cleared<br/>E-Clearance?}
  C -- "yes, not cleared" --> X[Rejected: finish clearance first]
  C -- "no / cleared" --> D[Status: Pending]
  D --> E[Registrar approves]
  E --> F{Fee > 0?}
  F -- yes --> G[For Payment]
  G --> H[Cashier verifies exact fee, issues OR]
  F -- no --> I
  H --> I[Processing]
  I --> J[Registrar marks Ready for Release]
  J --> K[Student notified]
  K --> L[Student claims; Registrar releases]
  L --> M([Released])
```

## 8.5 Class diagram (main entities)

```mermaid
classDiagram
  class User { id; role; login_id; name; email; department_id }
  class Student { user_id; program_id; year_level; section; enrollment_step; verified }
  class Department { id; name }
  class Program { id; name; department_id }
  class Subject { id; code; title; units }
  class EnrollmentRequest { id; student_id; status; reviewer_note }
  class Fee { id; student_id; label; amount }
  class Payment { id; student_id; amount; method; or_number; voided }
  class DocType { id; name; fee; needs_clearance }
  class DocRequest { id; student_id; doc_type_id; copies; status }
  class QueueTicket { id; number; office; service; status; counter }
  class Clearance { id; student_id; office; status; remarks }
  class AuditLog { id; user_id; action; at }
  User "1" -- "0..1" Student
  Department "1" -- "*" Program
  Department "1" -- "*" User
  Student "1" -- "*" EnrollmentRequest
  Student "1" -- "*" Fee
  Student "1" -- "*" Payment
  Student "1" -- "*" DocRequest
  Student "1" -- "*" QueueTicket
  Student "1" -- "*" Clearance
  DocType "1" -- "*" DocRequest
  Subject "*" -- "*" Student : student_subjects
  User "1" -- "*" AuditLog
```

## 8.6 Entity-relationship diagram

```mermaid
erDiagram
  DEPARTMENTS ||--o{ PROGRAMS : offers
  DEPARTMENTS ||--o{ USERS : employs
  USERS ||--o| STUDENTS : "is a"
  PROGRAMS ||--o{ STUDENTS : enrols
  STUDENTS ||--o{ STUDENT_SUBJECTS : takes
  SUBJECTS ||--o{ STUDENT_SUBJECTS : "taken in"
  SUBJECTS ||--o{ MEETINGS : "meets at"
  STUDENTS ||--o{ ENROLLMENT_REQUESTS : submits
  ENROLLMENT_REQUESTS ||--o{ ENROLLMENT_ITEMS : contains
  STUDENTS ||--o{ ACADEMIC_REQUIREMENTS : has
  STUDENTS ||--o{ CLEARANCES : has
  STUDENTS ||--o{ FEES : assessed
  STUDENTS ||--o{ PAYMENTS : makes
  DOC_TYPES ||--o{ DOC_REQUESTS : "requested as"
  STUDENTS ||--o{ DOC_REQUESTS : files
  DOC_REQUESTS ||--o{ REQUEST_HISTORY : logs
  STUDENTS ||--o{ QUEUE_TICKETS : takes
  USERS ||--o{ SESSIONS : opens
  USERS ||--o{ NOTIFICATIONS : receives
  USERS ||--o{ AUDIT_LOG : generates
```

## 8.7 Normalisation to 3NF (notes for the paper)

Actual tables: `departments, programs, users, sessions, settings, terms, students, year_progress, subjects, meetings, student_subjects, enrollment_requests, enrollment_items, academic_requirements, announcements, clearances, fees, payments, doc_types, doc_requests, request_history, queue_tickets, audit_log, notifications` (plus LMS-only `activities, tasks, task_messages, thread_reads`).

- **1NF:** every column holds one value; repeating groups (a student's subjects, a request's status changes) live in their own rows (`student_subjects`, `request_history`).
- **2NF:** in link tables such as `student_subjects (student_id, subject_id, term_id)` every other column (the three grades) depends on the whole key.
- **3NF:** no non-key column depends on another non-key column. Department names live only in `departments`; a program points to its department by id; document fee lives in `doc_types`, not repeated on each request; balances are not stored but computed from `fees` and `payments`, so they cannot drift.

Example of removing a transitive dependency: storing `department_name` on `students` would depend on `program_id` → `department_id`. It was instead kept only in `departments`.
