# 9. Test plan

Covers the testing section of the paper: test types, test cases and security testing with at least three vulnerabilities. Run everything with:

```bash
npm test                  # 60 automated tests (node:test)
node scripts/perf.mjs     # load test against a running server
```

Tests use a throw-away database (`DB_FILE`), so they never touch demo data.

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
| Automated tests | 60 passed, 0 failed |
| Load test | _Paste the output of `node scripts/perf.mjs` here (requests/sec, p50, p95, errors)_ |

## 9.5 Defect log (template)

| ID | Found by | Description | Severity | Status |
| --- | --- | --- | --- | --- |
| | | | | |
