# 11. Deployment (live URL)

The paper requires a live URL. The app is one Node process (Express) that serves the built website and talks to **PostgreSQL**. Use **[Neon](https://neon.tech)** for the database and any host that can run Node 22.13+ for the app. Nothing is deployed yet (backlog item PL-01).

Because the data lives in Neon, the web host needs **no persistent disk** — it can be redeployed or restarted freely.

## 1. Create the database (Neon)

1. Create a project at [neon.tech](https://neon.tech); pick a region near your users (for the Philippines, Singapore is the closest).
2. Open **Connect** and copy the **pooled** connection string (the host contains `-pooler`). It ends with `?sslmode=require`.
3. Optional but recommended: create a second Neon *branch* for testing, so tests never touch live data.

## 2. First start

Set `DATABASE_URL` on the host (see below) and start the app. On the first start it creates the tables and loads the **demo data**. For a real deployment, load your own data instead:

- **From the old SQLite file** — run `node scripts/migrate-sqlite-to-postgres.mjs server/data/nu-ssis.db` with `DATABASE_URL` set, *before* the first app start (the target must be empty).
- **Start empty** — there is no empty-start option yet; load the demo data once and remove or change the demo accounts under Admin → User Accounts.

## 3. Build and run

```bash
npm install
npm run build
npm start        # http://localhost:3001 — API + website
```

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | The Neon connection string. **Treat it as a password** — set it in the host's secret settings, never in Git |
| `API_PORT` | Port to listen on (falls back to the host's `PORT`, then 3001) |
| `DB_POOL_MAX` | Most simultaneous database connections (default 10; keep it within your Neon plan's limit) |
| `RATE_LIMIT` | Requests per minute per IP (default 600) |
| `NODE_ENV=production` | Enables the strict Content-Security-Policy |

## Hosting options for the app

| Option | Notes |
| --- | --- |
| A Node host such as Render, Railway or Fly.io | Set the variables above; the build command is `npm install && npm run build`, the start command `npm start` |
| A small VPS with PM2 and a reverse proxy (Nginx/Caddy) for free HTTPS | Most control; `pm2 start server/index.js --name nu-ssis` |
| The school PC running `npm start`, exposed with a tunnel | Fine for a demo only |

## Good to know about Neon

- A free database may **pause when idle**; the first request after a pause is slower while it wakes up.
- Every page makes several database calls, and each one now travels over the network. The app already runs independent queries in parallel and caches the current term and settings for a few seconds. Choose a Neon region close to the host that runs the app. `DB_LATENCY_MS=40` simulates this locally.
- Check Neon's current plan limits (storage, compute hours, connections) before relying on it for a live defence.
- Backups and point-in-time restore are Neon features — enable and test them before using real student data.

## Checklist before sharing the URL

- [ ] HTTPS enabled (most hosts do this automatically)
- [ ] `DATABASE_URL` stored as a secret, not in the repository
- [ ] Demo passwords changed or the site clearly labelled as a demo with fictional data
- [ ] Put the final URL in the paper and in the root `README.md`
- [ ] Re-run `node scripts/perf.mjs` against the live server and record the result in [`09-test-plan.md`](09-test-plan.md)
