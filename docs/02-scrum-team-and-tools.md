# 2. Scrum team and tools

From the team's Progress Report (October 5, 2026). Roles follow that report; the first meeting document uses slightly different labels, so confirm any change with the group.

## Scrum roles and responsibilities

| Member | Scrum role | Main responsibility |
| --- | --- | --- |
| **Villarosa, Cristina T.** | Team Leader / **Product Owner** | Requirement gathering, backlog prioritisation, ethical analysis, final review |
| **Oca, Kenneth Ryan C.** | **Scrum Master** | SDLC planning, monitoring-sheet management, task coordination, presentation lead |
| **Rinon, Rojanne Aizach** | Developer 1 — Front-end, UI/UX | UI/UX wireframes, Student and Admin module development |
| **Manalo, Ian Israel C.** | Developer — System designer | System modelling (diagrams), database design (3NF / ERD), code implementation |
| **Ramos, Shan Kelvin Louise A.** | Developer 3 — Database | Database and integration |
| **Alico, Cyreen G.** | Developer 4 — QA / Documentation | Software testing plan execution, security testing, documentation and referencing |

## Technical areas in the code

| Area | Where it lives |
| --- | --- |
| Front-end | `src/` — React pages per module (`src/pages/student`, `registrar`, `cashier`, `department`, `admin`) |
| Back-end | `server/routes/` — one file per module, plus `queue.js`, `auth.js`, `common.js` |
| Database | `server/schema.js` (tables), `server/seed.js` (demo data) |
| UI/UX | Figma prototype, `src/index.css`, `src/chat.css` |
| Testing / documentation | `tests/`, `scripts/perf.mjs`, `docs/` |

## Tools

| Purpose | Tool |
| --- | --- |
| Source code / version control | **GitHub** — `Ianisraelxd/NU-SSIS` (feature branches, pull requests, PR template with the Definition of Done) |
| Communication and meetings | **Discord** (Meeting 1 was held there on October 4, 2026, 9:00 PM) |
| UI design | **Figma** |
| Scrum board | _To be confirmed — Trello, Jira or GitHub Projects._ Import [`product-backlog.csv`](product-backlog.csv) to create the cards. |
| Documents | _Google Drive (or the team's shared drive)_ |
| Technology | React 19 + Vite, Express 5, SQLite (`node:sqlite`) — see the root `README.md` |

## Scrum schedule

| Event | Plan |
| --- | --- |
| Sprint length | _Proposed 2 weeks — confirm_ |
| Daily Scrum | Short check-in (10–15 min), as the team already does during documentation |
| Sprint Review | End of each sprint |
| Sprint Retrospective | After the review |
| Next Sprint Planning | Start of the next sprint |
