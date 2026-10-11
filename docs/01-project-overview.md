# 1. Project overview

| | |
| --- | --- |
| **Project / system title** | **Development of a Web-Based Student Services Information System (SSIS) with Integrated Queuing, Clearance, and Document Request Modules Using Scrum Methodology** |
| **Course / section** | CCS109 / 3IT-C |
| **Institution** | National University — Laguna Campus |
| **Methodology** | Scrum (iterative, in sprints) |

## Main problem

Student services — queuing for transactions, completing clearance requirements and requesting academic documents — are mostly handled through manual or partly computerised procedures. Students visit several offices, wait in long lines, fill out forms by hand and keep following up on their requests. As the number of students grows this causes delays, inconvenience, lost or misplaced records and difficulty monitoring requests. Manual queuing is a common concern during enrollment, clearance periods, payment transactions and document processing; students cannot tell where they are in line, and staff handle large numbers of transactions within limited office hours.

Clearance is slow because students must visit many offices for approvals, and nobody can easily see which requirements are done or pending. Document requests (certificates, academic records) involve handwritten forms, manual verification and repeated follow-ups.

## Target users

| User | What they need |
| --- | --- |
| **Students** | See their information (subjects, schedule, grades, balance), enroll online, track clearance, take a queue number, request documents and see exactly where each request is. |
| **Registrar staff** | Manage student records, approve enrollment, manage subjects/schedules and grades, process document requests, run the queue, produce reports. |
| **Cashier** | Record and verify payments, manage fees and balances, issue official receipts, confirm enrollment and document payments, produce collection reports. |
| **Department staff** | Review subject requests, verify academic requirements, approve department clearance, view their students' grades when authorised. |
| **Administrators** | Manage accounts, roles, departments, programs, academic terms, settings and announcements; monitor system activity and audit logs. |

## Objectives

**General objective:** to develop a web-based system that reduces long physical queues and speeds up clearance and document request processing among students, the Registrar, the Cashier and the academic departments.

**Specific objectives**

1. Provide a **Student Portal** where students view their information and use services online.
2. Provide a **digital queuing system** that gives numbers, shows position and estimated wait, and notifies students.
3. Provide **clearance management** so completed and pending requirements are visible to students and staff.
4. Provide a **Document Request System** with online requests, requirements and fees, payment verification and status tracking.
5. Provide **Registrar, Cashier, Department and Admin modules** for the staff who run these services.
6. Build it with **Scrum**, and evaluate it for functionality, usability, reliability, performance efficiency and security.

## Expected final output

A functional web-based system that gives students a more convenient and efficient way to process and monitor their clearance, queue and document needs, reducing delays, unnecessary office visits and the difficulty of tracking status — plus the written paper and a live URL (see [`README.md`](README.md)).

## Scope

**In scope:** the six required modules — Student Portal, Registrar Module, Cashier Module, Department Module, Admin Module and the Document Request System — and the digital queue, as listed in the [product backlog](03-product-backlog.md).

**Out of scope:** learning-management (LMS) features such as class activities, assignments, quizzes and class chat. A prototype of these exists in the code but is switched off (`ENABLE_LMS`).

## Source documents

This overview follows the team's meeting document ("INITIAL DOCUMENTS"): the project overview, system requirements, progress report, rationale and statement of the problem, and the queue data-flow diagram.
