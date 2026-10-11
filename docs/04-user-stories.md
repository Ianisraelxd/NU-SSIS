# 4. User stories

Format: *As a ⟨user⟩, I want ⟨goal⟩ so that ⟨benefit⟩.* Each story lists acceptance criteria used when checking it against the Definition of Done. IDs in brackets refer to [`03-product-backlog.md`](03-product-backlog.md).

## Student Portal

**US-01 · Sign in (SP-01)** — As a student, I want to sign in with my student number and password so that I can reach my own services.
- Correct credentials open the Student Portal; a wrong password shows a clear error without saying which part was wrong.
- After 5 wrong attempts the account locks for 15 minutes.
- Signing out ends the session; protected pages redirect to the login page.

**US-02 · Enroll online (SP-03, SP-04)** — As a student, I want to pick my subjects and submit them so that I don't have to line up to enroll.
- I only see subjects open for my program/department, and cannot pick more than the maximum units.
- After submitting, a 5-step tracker shows: Subject Selection → Department Review → Registrar Approval → Payment → Enrolled.
- If a reviewer returns my subjects I see their reason, can edit and resubmit.

**US-03 · Take a queue number (QU-01…QU-04)** — As a student, I want a queue number for the Registrar, Cashier or my Department so that I can wait wherever I like.
- I choose an office and service and get a number (e.g. R-007), my position, people ahead and an estimated wait.
- I am notified when I am called and when I am 3 numbers away; I can cancel while waiting.
- I can hold only one active number at a time.

**US-04 · Track clearance (SP-05)** — As a student, I want to see which offices cleared me so that I know what is blocking me.
- Six offices with Cleared / Pending / Hold and remarks; the Cashier line always agrees with my balance.

**US-05 · Request documents (SP-07, SP-08, DR-01…DR-08)** — As a student, I want to request a document online and follow it so that I don't have to keep asking.
- I see requirements and the fee before submitting; Transcript and Diploma are locked until my clearance is complete.
- Past dates, bad copy counts and duplicate open requests are rejected.
- The status moves Pending → For Payment → Processing → Ready for Release → Released; I get a notification at each step and can open the history.
- I can cancel only while Pending or For Payment.

**US-06 · See grades and payments (SP-06, SP-09)** — As a student, I want my grades and my balance in one place so that I can plan.
- Semester dropdown with Prelim, Midterm, Finals and a final grade only when all three are posted.
- Assessment, fees, payments with official receipt numbers and the next due date.

**US-07 · Update my details (SP-02)** — As a student, I want to update my contact details so that the school can reach me; academic details stay read-only.

## Registrar Module

**US-10 · Manage records (RG-01, RG-07)** — As the Registrar, I want to add, edit and verify student records so that the data is accurate.
- A new student gets a one-time temporary password; duplicate student numbers are rejected.

**US-11 · Approve enrollment (RG-02)** — As the Registrar, I want to approve enrollment after department review so that only valid enrollments count.
- I can approve only verified students; approval creates the student's subject list; I can return with a reason.

**US-12 · Subjects, schedules and grades (RG-03, RG-04)** — As the Registrar, I want to manage subjects, class schedules and grades.
- A schedule that double-books a room or instructor is rejected; grades must be 0–100; students are notified of changes.

**US-13 · Process documents (RG-05, RG-06)** — As the Registrar, I want to approve, prepare and release requests in order so that students are served fairly.
- Approve → For Payment; mark ready after the Cashier verifies payment; release when claimed; steps cannot be skipped.

**US-14 · Run the queue (QU-05)** — As staff, I want to call the next number and finish or skip it so that the line keeps moving.
- I name my counter; I must finish a ticket before calling another; only I can finish my ticket.

**US-15 · Reports (RG-08, QU-07)** — As the Registrar, I want document, enrollment, clearance and queue reports I can export or print.

## Cashier Module

**US-20 · Payments and receipts (CS-02, CS-05)** — As the Cashier, I want to record a payment and issue an official receipt so that the student's balance is correct.
- The amount cannot exceed the balance; the OR number is automatic and never duplicated; the receipt prints.

**US-21 · Fees and balances (CS-01, CS-03, CS-04)** — As the Cashier, I want to adjust fees and void a wrong receipt (with a reason) so that records can be corrected.

**US-22 · Confirm payments (CS-06)** — As the Cashier, I want to confirm enrollment payment and verify document fees so that processing can continue.
- Enrollment can be confirmed only after the minimum payment; a document fee must match exactly.

**US-23 · Collection reports (CS-07)** — As the Cashier, I want collection reports by period and method.

## Department Module

**US-30 · Review subjects (DP-01, DP-02)** — As department staff, I want to approve or return my students' subject selections.

**US-31 · Requirements and clearance (DP-03, DP-04, DP-06)** — As department staff, I want to verify academic requirements and approve the department clearance.
- A student cannot be cleared while any requirement is unverified.

**US-32 · Grades when authorised (DP-05)** — As department staff, I want to view my own students' grades; each view is recorded in the audit log.

## Admin Module

**US-40 · Accounts and roles (AD-01, AD-02)** — As the administrator, I want to create staff accounts, assign roles, disable access and reset passwords so that I control system access.
- Passwords are shown once; I cannot disable myself or the last administrator.

**US-41 · Structure and settings (AD-03…AD-05)** — As the administrator, I want to manage departments, programs, terms and system rules so that the system matches the school.

**US-42 · Monitor and audit (AD-06…AD-08)** — As the administrator, I want a dashboard, system reports and an audit log so that I can monitor activity and investigate problems.

**US-43 · Announcements (AD-09)** — As the administrator or Registrar, I want to post announcements so that students learn about important news.
