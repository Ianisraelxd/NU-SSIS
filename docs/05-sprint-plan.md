# 5. Sprint plan, Definition of Done and Scrum schedule

> Dates, names and the final sprint length are for the team to confirm at the first meeting.

## Priorities

Backlog items are labelled **High / Medium / Low** in `03-product-backlog.md`. Sprint 1 takes the most important *and realistic* items.

## Sprint duration

**Proposed: 2 weeks per sprint** (1–2 weeks is manageable for a school project). _Agreed length: ______ · Sprint 1 starts: ______ · ends: _______

## Definition of Done

A backlog item is **done** when it is:

- [ ] **Coded** — the feature is implemented as described in its user story
- [ ] **Working** — it behaves correctly in the browser, in light and dark mode and on a phone-width screen
- [ ] **Tested** — its acceptance criteria were checked (test cases written down) and the checks pass
- [ ] **Free from major errors** — no crashes, wrong data or blocked flows; `npm run build` and `npm run lint` pass
- [ ] **Merged** — uploaded to GitHub through a reviewed pull request into `main`
- [ ] **Documented when necessary** — README / docs updated if how to use or run the system changed

(The same checklist is in `.github/pull_request_template.md`.)

## Sprint 1

**Where we are:** a working prototype of most High-priority items already exists (backlog status *Done (prototype)*). What it lacks is verification, so Sprint 1 turns the prototype into something that meets the Definition of Done and fills the biggest gaps.

**Sprint 1 Goal:** *Students can sign in, view their information and request documents, and the registrar can process those requests — all verified against the Definition of Done — with account management started.*

### Sprint 1 backlog (proposed)

| Item | Backlog ID | Task examples | Owner |
| --- | --- | --- | --- |
| Verify login and sessions | PB-01, PB-02 | Write test cases; test wrong/blank/expired cases; fix defects | _TBD_ |
| Verify student views | PB-07, PB-08, PB-09, PB-13, PB-14 | Check every page against its acceptance criteria and the Figma | _TBD_ |
| Verify document requests end to end | PB-16, PB-19, PB-20 | Test clearance gating, duplicates, status flow, notifications | _TBD_ |
| Automated tests (start) | PB-29 | Set up a test runner; cover login, document request rules, grading and balance logic | _TBD_ |
| Admin user management (start) | PB-06 | Add an administrator role; design create/disable account screens | _TBD_ |
| Project set-up housekeeping | — | Scrum board created from `product-backlog.csv`; branch and PR rules agreed | _TBD_ |

Choose only what the team realistically expects to finish in the sprint; move the rest back to the backlog.

## Scrum schedule

| Event | When | Length |
| --- | --- | --- |
| Sprint Planning | Start of each sprint | ~1 hour |
| **Daily Scrum** | Every day (or every school day) | 10–15 minute check-in: what I did, what I'll do, what blocks me |
| **Sprint Review** | End of sprint | Show the working increment to the instructor / Product Owner |
| **Sprint Retrospective** | After the review | What went well, what to improve, one action for next sprint |
| Next Sprint Planning | Beginning of Sprint 2 | — |
