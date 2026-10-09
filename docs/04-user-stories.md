# 4. Initial user stories

Format: *As a ⟨user⟩, I want ⟨goal⟩ so that ⟨benefit⟩.* Each story lists acceptance criteria used when checking it against the Definition of Done. Backlog IDs refer to `03-product-backlog.md`.

## High priority

**US-01 · Log in (PB-01, PB-02)**
As a student or registrar, I want to log in with my ID and password so that I can reach my own dashboard.
- Correct ID and password opens the right portal (student or registrar).
- A wrong password shows a clear error and does not reveal which part was wrong.
- Logging out ends the session; opening a protected page signed out redirects to the login page.

**US-02 · See my schedule and subjects (PB-07, PB-08)**
As a student, I want to see my subjects, instructors, rooms and weekly schedule so that I know where to be and when.
- Subjects list shows code, description, units, instructor, days, times and room.
- Schedule grid shows the same meetings Monday–Friday without overlap errors.

**US-03 · See my grades (PB-09)**
As a student, I want to view my grades for any semester so that I can track my performance.
- A semester can be chosen from a dropdown.
- Prelim, Midterm and Finals are shown; the final grade appears only when all three are posted.
- The grade range and grading policy are visible.

**US-04 · Check my clearance (PB-13)**
As a student, I want to see which offices have cleared me so that I know what is still blocking me.
- Each office shows *Cleared*, *Pending* or *Hold* with remarks.
- The Cashier line always agrees with my balance.

**US-05 · Check my balance (PB-14)**
As a student, I want to see my assessment, payments and remaining balance so that I know what I still owe and when.
- Total assessment, total paid, remaining balance and next due date are shown.
- Fee breakdown and payment history add up to the totals.

**US-06 · Request a document (PB-16)**
As a student, I want to request a document online and track it so that I don't have to queue just to ask.
- I choose document type, purpose, copies and pickup date; the total fee is shown.
- Documents that need a complete clearance are blocked with a clear message when I'm not cleared.
- I cannot file a duplicate open request or a pickup date in the past.
- My requests show their status (Pending → Processing → Ready → Completed); I can cancel only while Pending.

**US-07 · Process the queue (PB-19, PB-20)**
As a registrar, I want to see requests in first-come-first-served order and move them forward so that students are served fairly and quickly.
- "Call next" moves the oldest waiting request to Processing.
- A request can't skip a status; each step notifies the student.
- Requests can be searched and filtered by name, student number, status and document.

**US-08 · Manage clearance (PB-21)**
As a registrar, I want to update a student's clearance per office so that the student's status is accurate.
- I can set an office to Cleared, Pending or Hold with remarks; the student is notified.
- The Cashier line cannot be edited by hand because it follows the balance.

**US-09 · Manage accounts (PB-06)** *(planned)*
As an administrator, I want to create, disable and import student and staff accounts so that I can control who can access the system.
- Accounts can be added one by one and in bulk; disabled accounts cannot log in.

**US-10 · Self-service enrollment (PB-12)** *(planned)*
As a student, I want to complete registration and subject advising online so that I can enroll without visiting several offices.

## Medium priority

**US-11 · Pending tasks (PB-17)**
As a student, I want one list of everything I still need to do (clearance items, balance, documents to pick up, next enrollment step) so that I don't miss anything.
- Items are ordered by urgency and link to the right page.
- The list is empty when nothing is pending.

**US-12 · Notifications and announcements (PB-18, PB-22)**
As a student, I want to be notified when my request or clearance changes, and to read school announcements, so that I stay informed. As a registrar, I want to post announcements so that students are told about important news.

**US-13 · Reports (PB-23)**
As a registrar, I want to generate request, clearance and enrollment reports for a period, and export or print them, so that I can report to the school.

**US-14 · Settings (PB-03, PB-04, PB-24)**
As any user, I want to edit my profile and change my password so that my account stays accurate and secure. As a registrar, I want to set the current term and document fees so that the system matches the school's rules.
