# 9. Test plan

Covers the testing section of the paper: test types, test cases and security testing with at least three vulnerabilities. Run everything with:

```bash
npm test                  # 64 automated tests (node:test)
npm run test:postgres     # the same tests through the real pg driver (the path Neon uses)
node scripts/perf.mjs     # load test against a running server
```

Tests use a throw-away embedded PostgreSQL (`DB_DIR`), so they never touch your data. `npm run test:postgres` runs the same tests through the real `pg` driver, and `TEST_DATABASE_URL` points them at any empty PostgreSQL (including a Neon branch).

## 9.1 Test levels

| Level | What is checked | Where |
| --- | --- | --- |
| **Unit** | Pure logic: password hashing, grade-to-point conversion, status flow rules (`FLOW`), balance and clearance helpers, input validation | `tests/unit.test.mjs` |
| **Integration** | API routes with a real database: login, roles, enrollment chain, payments, document flow, queue, admin | `tests/api.test.mjs` |
| **System** | Whole journeys across roles, e.g. student files request → registrar approves → cashier verifies → registrar releases | `tests/api.test.mjs` |
| **Acceptance (UAT)** | Team and instructor try the user stories in the browser against [`04-user-stories.md`](04-user-stories.md) | Manual — to be done and signed |
| **Performance** | Response time under concurrent load | `scripts/perf.mjs` |
| **Security** | See 9.3 | `tests/api.test.mjs` plus manual checks |
| **Usability / compatibility** | Keyboard use, light/dark mode, phone width, Edge/Chrome | Manual |

## 9.2 Sample functional test cases

| ID | Case | Expected |
| --- | --- | --- |
| TC-01 | Student signs in with correct credentials | Student Portal opens |
| TC-02 | Sign in with a wrong password | Error shown; attempt counted |
| TC-03 | Student calls a registrar API | 403 |
| TC-04 | Request Transcript with incomplete clearance | Rejected |
| TC-05 | Request a document with a past pickup date | Rejected |
| TC-06 | Cashier pays more than the balance | Rejected |
| TC-07 | Cashier verifies a document with a wrong fee | Rejected; exact fee required |
| TC-08 | Registrar tries to skip from Pending to Released | Rejected; steps cannot be skipped |
| TC-09 | Take a second queue number while one is active | Rejected |
| TC-10 | Call next twice without finishing | Rejected; finish current first |
| TC-11 | Department staff opens another department's student | Not found / forbidden |
| TC-12 | Admin disables the last administrator | Rejected |
| TC-13 | Schedule two classes in the same room and time | Conflict reported |

## 9.3 Security testing

| # | Vulnerability | How it is tested | Mitigation in the code | Result |
| --- | --- | --- | --- | --- |
| 1 | **SQL injection** — attacker types SQL in a field (e.g. `' OR 1=1 --` as the login ID or a search box) | Send injection strings to login and search endpoints | Every query is parameterised (`?` placeholders); no string-built SQL | Injection strings are treated as plain text; no bypass |
| 2 | **Brute-force password guessing** | Repeated wrong logins on one account and from one IP | Account locks 15 min after 5 failures; per-IP failed-login throttle | Locked after 5 tries; correct password also refused while locked |
| 3 | **Denial of service / request flooding** | Burst of requests from one client | Global rate limit (600 / min / IP, `RATE_LIMIT`) returns 429 | 429 after the limit |
| 4 | **Broken access control** — a user reaching another role's data | Call each module's API with the wrong role and without a token | `requireAuth(role)` on every route; department data scoped to its own department | 401 / 403 as expected |
| 5 | **Cross-site scripting (XSS)** | Save `<script>` text in names/remarks and view it | React escapes output; production Content-Security-Policy; security headers | Rendered as text |
| 6 | **Weak password storage** | Inspect the database | scrypt with per-user salt; temporary passwords shown once | No plain text stored |
| 7 | **Session abuse** | Reuse a token after logout / password change | 7-day expiry; logout and password change delete sessions | Old tokens rejected |

Items 1–3 are the three required by the course; 4–7 are extra.

## 9.4 Performance results

Measured on the development PC with `scripts/perf.mjs` against a throw-away server. Re-run on the deployed server and replace the numbers before submitting.

| Measure | Result |
| --- | --- |
| Automated tests | 64 passed, 0 failed — on the embedded PostgreSQL, through the `pg` driver, and against a real PostgreSQL 18 server with a connection pool |
| Load test | _Paste the output of `node scripts/perf.mjs` here (requests/sec, p50, p95, errors)_ |

## 9.5 Defect log (template)

| ID | Found by | Description | Severity | Status |
| --- | --- | --- | --- | --- |
| BUG-01 | API fuzz (3,925 calls, every route × every role) | `POST /student/documents/requests` with no document type returned 500 instead of 400 (`node:sqlite` rejects `undefined`) | Medium | Fixed, test added |
| BUG-02 | Edge-case probe | `limit=-1` on `/admin/audit` and `/admin/login-attempts` bypassed pagination and returned every row | Low | Fixed, test added |
| BUG-03 | Edge-case probe | A setting could be saved as an object (stored as "[object Object]") | Low | Fixed, test added |
| BUG-04 | Edge-case probe | An array was accepted as a new password | Low | Fixed, test added |
| BUG-05 | Phone-width sweep of all 44 pages | Pending Tasks category filter overflowed the screen by 160 px at 375 px wide | Low | Fixed |
| SEC-01 | Review of the new sign-in message | "N attempts left" appeared only for real accounts, revealing which IDs exist | Medium | Fixed (unknown IDs get the same countdown), test added |

## 9.6 Move from SQLite to PostgreSQL (Neon) — how it was checked

The database layer was changed from SQLite to PostgreSQL. These checks were run before the change was accepted:

| Check | Result |
| --- | --- |
| Existing automated tests | All pass on the embedded PostgreSQL, through the real `pg` driver, and against a real PostgreSQL 18 server with a connection pool |
| New concurrency tests | Students taking queue numbers at the same moment, and cashiers recording payments at the same moment, always get different numbers. With the lock deliberately removed, the queue test **fails** (duplicate numbers such as C-007 twice) — so the test does guard the race |
| API fuzz (about 3,900 calls, every route × every role) | 0 server errors; bad ids now return 4xx |
| Side-by-side comparison with the old SQLite build, same demo data | 91 responses compared; no differences in values or data types. Rows that tie on a sort key now come back in a fixed order; one request that used to crash now returns 404 |
| All 44 pages of the five portals, at desktop and phone width | No errors, no "undefined" or "NaN", no overflow |
| Optional LMS routes (switched on) | Teacher and chat endpoints work |
| Data migration script | Every table copied with matching row counts; old accounts still sign in; new rows continue the numbering (the next request after 134 migrated ones was REQ-0135) |
| Speed (local PostgreSQL, 20 users at once) | p95 between 18 ms and 118 ms. With a simulated 40 ms network delay per query the busiest page (Home) answers in about 0.26 s |

PostgreSQL differences found and fixed during the move: `INSERT OR IGNORE`, `SELECT DISTINCT` with an `ORDER BY` expression, a column alias used inside an expression, summing a true/false value, and case-sensitive `LIKE` (now `ILIKE`, which keeps the old search behaviour).

Not yet tested: a real Neon project. The connection settings (TLS, pooled host) follow Neon's documentation, but the first run against a real Neon database should be checked by the team.
