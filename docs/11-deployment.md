# 11. Deployment (live URL)

The paper requires a live URL. The app is a single Node process (Express + SQLite) that serves the built website, so any host that can run Node 22.13+ works. Nothing is deployed yet (backlog item PL-01).

## Build and run

```bash
npm install
npm run build
npm start        # http://localhost:3001 — API + website
```

## Environment variables

| Variable | Purpose |
| --- | --- |
| `API_PORT` | Port to listen on (many hosts supply `PORT`; set `API_PORT` to match) |
| `DB_FILE` | Path to the SQLite file — **must be on persistent storage** |
| `RATE_LIMIT` | Requests per minute per IP (default 600) |
| `NODE_ENV=production` | Enables the strict Content-Security-Policy |

## Options

| Option | Notes |
| --- | --- |
| A VPS (e.g. a small Linux server) with PM2 and a reverse proxy (Nginx/Caddy) giving free HTTPS | Most control; `pm2 start server/index.js --name nu-ssis` |
| A Node host with a persistent disk (Render, Railway, Fly.io) | Mount a disk and point `DB_FILE` at it, otherwise the database resets on each deploy |
| The school PC with XAMPP running `npm start`, exposed with a tunnel | Fine for a demo only |

## Checklist before sharing the URL

- [ ] HTTPS enabled
- [ ] Demo passwords changed or the site clearly labelled as a demo with fictional data
- [ ] `DB_FILE` on persistent storage and backed up
- [ ] Put the final URL in the paper and in the root `README.md`
- [ ] Re-run `node scripts/perf.mjs` against the live server and record the result in [`09-test-plan.md`](09-test-plan.md)
