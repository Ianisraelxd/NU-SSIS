# 5. Sprint plan, Definition of Done and Scrum schedule

From the team's Progress Report (October 5, 2026).

## Definition of Done

A backlog item is **done** when it is:

- [ ] **Coded** — implemented as described in its user story
- [ ] **Working** — behaves correctly in the browser, in light and dark mode and at phone width
- [ ] **Tested** — its acceptance criteria were checked and the checks pass (`npm test`)
- [ ] **Free from major errors** — no crashes, wrong data or blocked flows; `npm run build` and `npm run lint` pass
- [ ] **Merged** — uploaded to GitHub through a reviewed pull request into `main`
- [ ] **Documented when necessary** — README / docs updated if how to use or run the system changed

(The same checklist is in `.github/pull_request_template.md`.)

## Sprint 1 — October 1–4, 2026 (summary)

| | |
| --- | --- |
| **Goal** | Plan the project: choose the topic, define the problem, scope and users, assign roles, and prepare the backlog |
| **Done** | Project title and problem statement; target users; objectives; system requirements per module; Scrum roles; first product backlog; first meeting held on Discord (October 4, 9:00 PM) |
| **Status** | Complete — see [`01-project-overview.md`](01-project-overview.md) to [`04-user-stories.md`](04-user-stories.md) |

## Sprint 2 — plan

**Goal:** *Finalise the UI/UX, build the back end and the database, so that the six modules and the queue work end to end.*

| Task | Backlog items | Owner (per Progress Report) | State |
| --- | --- | --- | --- |
| Finalise UI/UX (wireframes, Figma) | SP-*, SQ-07 | Rinon | Implemented in `src/` |
| Student and Admin modules (front end) | SP-*, AD-* | Rinon | Built |
| Back-end APIs for all modules | RG-*, CS-*, DP-*, DR-* | Manalo | Built (`server/routes/`) |
| Database design — ERD, 3NF, schema | all | Manalo, Ramos | Built (`server/schema.js`); diagrams in [`08-system-models.md`](08-system-models.md) |
| Digital queue | QU-* | Manalo, Ramos | Built |
| Integration and seed data | all | Ramos | Built |
| Test plan and security testing | SQ-* | Alico | Plan in [`09-test-plan.md`](09-test-plan.md); 82 automated tests pass |
| Documentation, ethics, referencing | — | Alico, Villarosa | Drafts in [`10-ethical-and-legal-notes.md`](10-ethical-and-legal-notes.md) |
| Live deployment | PL-01 | Oca | Guide in [`11-deployment.md`](11-deployment.md); not yet deployed |

**Team review needed:** "Built" means the code works and is tested by the automated suite. Items become *done* only after the team's review against the Definition of Done above.

## Scrum schedule

| Event | When | Length |
| --- | --- | --- |
| Sprint Planning | Start of each sprint | ~1 hour |
| **Daily Scrum** | Every school day (or by chat) | 10–15 min: what I did, what I'll do, what blocks me |
| **Sprint Review** | End of sprint | Show the working increment to the instructor / Product Owner |
| **Sprint Retrospective** | After the review | What went well, what to improve, one action |
| Next Sprint Planning | Start of the next sprint | — |
