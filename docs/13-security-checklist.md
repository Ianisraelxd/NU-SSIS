# 13. Security checklist and recommended patches

What is already in place, what was added in this round, and what to do next, in priority order.

## Already in place

| Area | Control |
| --- | --- |
| Passwords | scrypt with a random salt per password; constant-time comparison |
| Sign-in | Per-account lockout (5 failures, 15 minutes); per-IP throttle on failures; "attempts left" shown for unknown IDs too; every attempt logged |
| Sessions | 256-bit random tokens, 7-day expiry, signing out and changing a password end other sessions; disabling an account ends its sessions |
| Access control | Role check on every route (`requireAuth(role)`); departments see only their own students; separation of duties (cashier requests, administrator approves) |
| Input | Parameterised SQL everywhere; JSON body limit 100 kb; type checks on passwords; pagination bounds |
| Output | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, strict CSP for the built app, `no-store` on API responses |
| Audit | Sensitive actions written to the audit log; passwords never recorded |
| Dependencies | `npm audit`: 0 known vulnerabilities |

## Added in this round

1. **Session tokens are stored hashed (SHA-256).** A leaked database or backup can no longer be used to sign in. Existing sessions are invalidated once, so everyone signs in again after this update.
2. **Equal sign-in timing for unknown IDs.** A dummy password check runs when the account does not exist, so response time does not reveal which IDs are registered.
3. **Password rules.** 8 to 128 characters; refuses very common passwords, one repeated character, and passwords containing your own ID.
4. **Session housekeeping.** Expired sessions are purged at start-up and hourly; at most 10 devices per account (oldest dropped).
5. **More security headers.** `Strict-Transport-Security` (only over HTTPS), `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `X-Permitted-Cross-Domain-Policies`.
6. **JSON-only writes.** Non-JSON `POST/PUT/PATCH/DELETE` bodies get 415, which blocks cross-site form posts.
7. **Typed sign-in input.** Non-text ID or password values return 400 instead of reaching the database.
8. **`TRUST_PROXY` setting.** On a host behind a proxy, set `TRUST_PROXY=1` so rate limits and the login log use the visitor's real IP instead of the proxy's.
9. **Production warning** when the public demo accounts still exist and `NODE_ENV=production`.

## Recommended next, best first

| # | Patch | Why | Effort |
| --- | --- | --- | --- |
| 1 | **Remove or re-password the demo accounts before real use** (`ADM-0001`, `CSH-0001`, ... and the students) and force a password change on first sign-in | Their passwords are public in the README. This is the largest real-world risk | Low |
| 2 | **Serve only over HTTPS** (Render, Railway, Fly, Nginx + Let's Encrypt) and set `NODE_ENV=production` and `TRUST_PROXY` | Tokens and passwords travel in clear text over HTTP | Low |
| 3 | **Keep `DATABASE_URL` in the host's secret store, never in git**; use a least-privilege database role and `sslmode=require` (Neon does this by default) | Credential leaks | Low |
| 4 | **Move the session token from `localStorage` to an `HttpOnly; Secure; SameSite=Strict` cookie** (add a CSRF token or origin check when you do) | A single XSS bug could otherwise steal the token | Medium |
| 5 | **Two-factor sign-in (TOTP) for Administrator and Cashier** | These roles move money and change records | Medium |
| 6 | **Shared rate limiter in the database or Redis** instead of in memory | The in-memory counters reset on restart and are per server instance | Medium |
| 7 | **Email-based password reset** with short-lived, single-use tokens (instead of administrator-issued temporary passwords) | Fewer passwords seen by staff | Medium |
| 8 | **Run `npm audit` and update dependencies monthly**; enable Dependabot or Renovate | Known CVEs in packages | Low |
| 9 | **Remove `'unsafe-inline'` from the CSP `style-src`** (needs nonces or moving inline styles to classes) and self-host the fonts | Tighter protection against injected styles | Medium |
| 10 | **Back up the database and test a restore**; keep audit logs for a fixed period (see the ethical and legal notes) | Ransomware and mistakes | Low |
| 11 | **Alerts**: notify the administrator on repeated lockouts, many 429s, or sign-ins from new IPs | Early warning | Medium |
| 12 | **Penetration test or `OWASP ZAP` baseline scan** before launch, and re-run the fuzz script (`npm test` plus the scripts in `scripts/`) after every route change | Finds what review misses | Medium |

## Checks that cover this

`npm test` includes a "security hardening" group: weak passwords refused, token hash is not a valid token, headers present, non-JSON writes refused, and typed sign-in input rejected (77 tests in total).
