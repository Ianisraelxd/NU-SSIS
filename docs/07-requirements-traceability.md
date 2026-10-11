# 7. Requirements traceability

Every requirement from the team's **System Requirements** (meeting document) mapped to where it lives in the system and which automated tests exercise it. "Test suites" refer to the suites in `tests/api.test.mjs` and `tests/unit.test.mjs` (run with `npm test`).

## Student Portal

| ID | Requirement | Status | Where | Test suites |
| --- | --- | --- | --- | --- |
| SP-01 | Student login / logout | Built | Login page · POST /api/auth/login, /logout | authentication & access control |
| SP-02 | View and update basic student profile | Built | Settings → Student information · GET/PUT /api/student/profile | registrar: records |
| SP-03 | View enrollment status and progress | Built | Enrollment page · GET /api/student/enrollment | enrollment chain |
| SP-04 | Submit / select subjects for enrollment | Built | Enrollment page · PUT /api/student/enrollment | enrollment chain |
| SP-05 | View clearance requirements and status | Built | E-Clearance page · GET /api/student/clearance | reports (cashier line = balance) |
| SP-06 | View grades per semester / subject | Built | Grades per Semester page · GET /api/student/grades | registrar: grades · unit: grading |
| SP-07 | Request school documents online | Built | Documents and Forms page | document requests |
| SP-08 | Track document request status | Built | Documents and Forms page | document requests |
| SP-09 | View payment status and transactions | Built | Account Summary page · GET /api/student/account | cashier · document requests |
| SP-10 | Receive system notifications and announcements | Built | Top bar bell · /api/notifications, /api/announcements | document requests (notifications) |
| SP-11 | Subjects, schedule, academic tracker and pending tasks | Built | Subjects, Schedule, Academic Tracker, Pending Tasks pages | enrollment chain (subjects) |

## Registrar Module

| ID | Requirement | Status | Where | Test suites |
| --- | --- | --- | --- | --- |
| RG-01 | Manage student records | Built | Student Records page · /api/registrar/students | registrar: records |
| RG-02 | Verify and approve enrollment | Built | Enrollment page · PATCH /api/registrar/enrollment/:id | enrollment chain · registrar: records |
| RG-03 | Manage subjects and class schedules | Built | Subjects & Schedules page · /api/registrar/subjects | registrar: schedules |
| RG-04 | Manage student grades / grade records | Built | Grades page · PUT /api/registrar/grades | registrar: grades |
| RG-05 | Process document requests | Built | Document Requests page · PATCH /api/registrar/requests/:id | document requests |
| RG-06 | Update document request status | Built | Document Requests page · lib moveRequest() | document requests · unit: flow |
| RG-07 | Verify student academic information | Built | Student Records page · POST /api/registrar/students/:id/verify | registrar: records |
| RG-08 | View enrollment records and reports | Built | Enrollment and Reports pages · /api/registrar/reports | reports |
| RG-09 | Manage clearance lines (library, laboratory, guidance, registrar) | Built | Clearance Status page · PUT /api/registrar/clearance/item/:id | department module |
| RG-10 | Post announcements | Built | Registrar Home · /api/registrar/announcements | audit log |

## Cashier Module

| ID | Requirement | Status | Where | Test suites |
| --- | --- | --- | --- | --- |
| CS-01 | View student payment information | Built | Students & Balances page · GET /api/cashier/students | cashier |
| CS-02 | Record and verify payments | Built | Students & Balances → Record a payment · POST /api/cashier/students/:id/payments | cashier |
| CS-03 | Manage student balances / fees | Built | Students & Balances → Fees · /api/cashier/fees | cashier |
| CS-04 | Update payment status | Built | Payment history → Void · POST /api/cashier/payments/:id/void | cashier |
| CS-05 | Issue / record official receipt information | Built | Receipt dialog · GET /api/cashier/receipts/:kind/:id | cashier |
| CS-06 | Confirm payment for enrollment or document requests | Built | Students & Balances, Document Payments pages | enrollment chain · document requests |
| CS-07 | Generate payment / collection reports | Built | Reports page · GET /api/cashier/reports | cashier |

## Department Module

| ID | Requirement | Status | Where | Test suites |
| --- | --- | --- | --- | --- |
| DP-01 | View students under the department | Built | Students page · GET /api/department/students | department module |
| DP-02 | Review enrollment / subject requests | Built | Enrollment Review page · PATCH /api/department/enrollment/:id | enrollment chain |
| DP-03 | Approve or reject department-related clearance | Built | Clearance page · PUT /api/department/students/:id/clearance | department module |
| DP-04 | Manage / verify academic requirements | Built | Students → Open · /api/department/requirements | department module |
| DP-05 | View student grades when authorized | Built | Students → Open → Grades | department module · audit log |
| DP-06 | Monitor students' clearance status | Built | Clearance page | department module |

## Admin Module

| ID | Requirement | Status | Where | Test suites |
| --- | --- | --- | --- | --- |
| AD-01 | Manage user accounts | Built | User Accounts page · /api/admin/users | administrator |
| AD-02 | Assign user roles and permissions | Partly built | User Accounts, Roles & Permissions pages | administrator · authentication & access control |
| AD-03 | Manage departments and programs | Built | Departments & Programs page · /api/admin/departments | administrator |
| AD-04 | Manage system settings | Built | System Settings page · /api/admin/settings | administrator |
| AD-05 | Manage academic year / semester | Built | System Settings page · /api/admin/terms | reports |
| AD-06 | Monitor system activities | Built | Admin Home · GET /api/admin/overview | administrator |
| AD-07 | View system-wide reports | Built | Reports page · /api/admin/reports | administrator · reports |
| AD-08 | Maintain audit / activity logs | Built | Audit Log page · GET /api/admin/audit | administrator (audit log) |
| AD-09 | Manage announcements | Built | Announcements page | audit log |

## Document Request System

| ID | Requirement | Status | Where | Test suites |
| --- | --- | --- | --- | --- |
| DR-01 | Select a document (Transcript of Records, Certificate of Enrollment, Certificate of Grades, others) | Built | Documents and Forms page · doc_types | document requests |
| DR-02 | Submit document requests online | Built | POST /api/student/documents/requests | document requests |
| DR-03 | Show document requirements and corresponding fees | Built | Documents and Forms page | document requests |
| DR-04 | Registrar approves / processes requests | Built | Document Requests page (Registrar) | document requests |
| DR-05 | Cashier verifies payment | Built | Document Payments page (Cashier) | document requests |
| DR-06 | Track status: Pending → For Payment → Processing → Ready for Release → Released | Built | FLOW in server/requests.js | document requests · unit: flow |
| DR-07 | Notify students when documents are ready | Built | Bell notifications | document requests |
| DR-08 | Maintain document request history | Built | Details dialog (student and registrar) | document requests |

## Digital Queue

| ID | Requirement | Status | Where | Test suites |
| --- | --- | --- | --- | --- |
| QU-01 | Register queue entry (join a queue by office and service) | Built | Digital Queue page · POST /api/queue/tickets | digital queue |
| QU-02 | Generate queue number | Built | queue_tickets.number | digital queue |
| QU-03 | Monitor queue status (position, estimated wait, now serving) | Built | Digital Queue page · GET /api/queue/mine | digital queue |
| QU-04 | Notify the student | Built | Bell notifications | digital queue |
| QU-05 | Manage queue — call next, with counter assignment | Built | Queue Management page (Registrar, Cashier, Department) | digital queue |
| QU-06 | Update queue status (serving, done, skipped, cancelled) | Built | POST /api/queue/staff/:id/done, /skip | digital queue |
| QU-07 | Generate queue reports and analytics | Built | Queue Report (Registrar, Admin) | reports |

## Security & Quality

| ID | Requirement | Status | Where | Test suites |
| --- | --- | --- | --- | --- |
| SQ-01 | Password hashing and session expiry | Built | server/util.js, routes/auth.js | unit: passwords |
| SQ-02 | Brute-force protection | Built | routes/auth.js | authentication & access control |
| SQ-03 | Rate limiting | Built | server/index.js | performance script (limit proven) |
| SQ-04 | SQL-injection protection | Built | all server routes | authentication & access control |
| SQ-05 | Role-based access control | Built | requireAuth() in routes/auth.js | authentication & access control · department module |
| SQ-06 | Automated tests (unit, integration, security) and a load-test script | Built | tests/, scripts/ | — |
| SQ-07 | Light / dark mode, responsive layout, accessible UI | Built | src/index.css | — |

## Not built yet

| ID | Item | Why it matters |
| --- | --- | --- |
| PL-01 | Live deployment (public URL) | Required by the paper (Task 6). See docs/11-deployment.md |
| PL-02 | Email / SMS notifications | The preference switch exists; nothing is sent yet |
| PL-03 | Self-service password reset | Today the Administrator resets passwords |
| PL-04 | Online payment gateway | Needs a payment provider |
| PL-05 | PDF generation of documents and receipts | Receipts print from the browser today |
| PL-06 | Custom per-user permissions | See AD-02 |
| PL-07 | Bulk import of students and subjects (CSV) | — |
| PL-08 | Queue display screen / SMS number alerts | — |
