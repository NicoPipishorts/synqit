# Production Readiness Checklist

This checklist is split between:

- `App/Repo` responsibilities (implemented in code + CI/CD)
- `Server/VPS` responsibilities (infrastructure + ops)

For your target (`~1,000 visitors/day`), this stack is viable on a properly configured VPS. The key is operational discipline.

## 1) Minimum Before Launch (Must-Have)

### App/Repo

- [ ] Build is reproducible (`yarn install --frozen-lockfile`, deterministic Docker images).
- [ ] DB migrations are part of deploy (`prisma migrate deploy`).
- [ ] API has rate limiting enabled (already present).
- [ ] API has secure headers enabled (already present via helmet).
- [ ] Auth tokens and encryption secrets are strong and rotated from `.env.local` into production secrets.
- [ ] Error handling never leaks internal stack traces (already present).
- [ ] Worker is running separately from API (already present) and restarts automatically.
- [ ] Email provider is production-ready (verified domain + SPF/DKIM/DMARC).
- [ ] Regression tests run in CI for every PR to `main`.

### Server/VPS

- [ ] Firewall enabled (`ufw`) with only required ports open.
- [ ] SSH hardened (no password auth, key-based auth, non-root login).
- [ ] Fail2ban configured for SSH and reverse proxy logs.
- [ ] TLS/HTTPS fully enabled at edge (Caddy/Nginx with auto-renew).
- [ ] Docker services configured with restart policies.
- [ ] Persistent volumes configured for Postgres and app uploads.
- [ ] Automated Postgres backups (daily) + restore drill tested.
- [ ] Time sync enabled (`chrony`/`systemd-timesyncd`).
- [ ] Disk, CPU, RAM, and DB storage monitored with alerting.

## 2) Observability & Alerting (Where It Lives)

Both layers are needed.

### App/Repo side

- Structured logs with request IDs (already present in API logs).
- Frontend error capture (Sentry or equivalent).
- Backend exception capture (Sentry or equivalent).
- Business events tracking (already started via analytics events).
- Prometheus-compatible API metrics endpoint (`/metrics`) is available.

### Server side

- Uptime checks (Uptime Kuma/Better Stack/Pingdom).
- Alert routing (email/Slack/Discord) on:
  - API down
  - 5xx spike
  - DB unavailable
  - high CPU/RAM
  - low disk
- Centralized log retention (Loki/ELK/Cloud logging).

### Local/Server quick start (Prometheus + Grafana)

- Start stack: `docker compose -f infra/docker-compose.yml up -d api prometheus grafana`
- Prometheus UI: `http://localhost:9090`
- Grafana UI: `http://localhost:3000` (default `admin/admin`)
- API metrics endpoint: `http://localhost:3001/metrics`

### Optional CI load-test

- A manual GitHub Actions workflow exists: `.github/workflows/loadtest.yml`
- It only runs when triggered manually (`workflow_dispatch`)
- It does not send emails unless you explicitly point it to an email-related endpoint

## 3) Nice-to-Have (Next Phase)

- [ ] Blue/green or rolling deploy strategy.
- [ ] Separate staging environment with staging DB and Redis.
- [ ] Read replicas and/or managed Postgres.
- [ ] Redis persistence + HA strategy.
- [ ] Synthetic checks for login/create event/add track flows.
- [ ] SLOs (availability + latency) and error budgets.

## 4) Capacity Baseline for ~1,000 Visitors/Day

Suggested starting VPS:

- 2 vCPU / 4 GB RAM minimum
- 4 vCPU / 8 GB RAM preferred for burst tolerance

Expected bottlenecks before CPU:

- External provider APIs (Spotify/Apple) rate limits
- DB growth/slow queries without index tuning
- Missing alerting causing delayed incident response

## 5) Launch-Day Go/No-Go

- [ ] HTTPS valid and forced
- [ ] Backups running and restore tested
- [ ] CI green on `main`
- [ ] API + worker healthy after deploy
- [ ] Smoke tests pass (login, create event, add track, email)
- [ ] Uptime and error alerts active

## 6) Post-Launch (First 7 Days)

- [ ] Review error events daily
- [ ] Review provider failure rates daily
- [ ] Watch p95 latency and 5xx rates
- [ ] Tune rate limits and caching based on real traffic
