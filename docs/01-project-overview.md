# 1. Project overview

| | |
| --- | --- |
| **Project / system title** | **NU Laguna Student Information System (SIS) and Registrar and Records Information System (RIS)** |
| **Type of system** | A *services* system — students and registrar staff use it to get school services done online. It is **not** a learning management system (LMS). |

## Main problem

Students at National University Laguna currently have to go to different offices to find out simple things (grades, schedule, balance, clearance status) and to request school documents such as a Certificate of Enrollment or Transcript of Records. Requests are filed on paper, there is no way to see where a request is, long queues form at the Registrar, and the Registrar has no quick way to see what is waiting or to produce reports.

## Target users

| User | What they need |
| --- | --- |
| **Student** | See subjects, schedule, grades, enrollment progress, clearance and balance; request documents and track them; get notified. |
| **Registrar staff** | See the queue of document requests and process them in order; manage clearance per office; post announcements; produce reports. |
| *(Future)* **Administrator** | Manage accounts and system settings (see backlog). |

## Main objective

Give students one place to view their school information and request services, and give the Registrar a single queue and set of tools to process those services quickly and accurately — with every record stored in one database.

## Expected final output

- A web application with two portals: **SIS** (students) and **RIS** (registrar).
- A database (SQLite) holding users, subjects, schedules, grades, fees/payments, clearances, document requests and notifications.
- Documentation: user guide (`README.md`), Scrum documents (this folder).

## Scope

**In scope (services):** login and profile · subjects, schedule, grades · academic tracker · enrollment progress · e-clearance · account balance and payments · document requests and tracking · pending tasks (the student's to-dos for these services) · notifications and announcements · registrar queue, request management, clearance management and reports · settings.

**Out of scope:** anything that belongs to a learning management system — class activities and assignments, quizzes, posting or submitting coursework, teacher/faculty classroom tools, and class chat or comments. (A prototype of these exists in the code but is switched off; see `ENABLE_LMS` in `README.md`.)

## Project design reference

The screens follow the Figma prototype; the improvements made on top of it are listed in `README.md` under "Deliberate differences from the Figma".
