Here’s a practical roadmap for Option A: Fastify + Postgres + Redis + BullMQ, built for a VPS and future growth. It’s ordered so you can ship something usable early, without painting yourself into a corner.

Backlog for deferred items: `docs/backlog.md`
Release QA checklist: `docs/qa-checklist.md`

⸻

Phase 0 — Decisions you lock in (30–60 min)

Goal: avoid rework later.
• Monorepo (recommended): apps/web, apps/api, apps/worker, packages/shared
• Tooling: pnpm or yarn workspaces (you prefer Yarn → use Yarn workspaces)
• DB: PostgreSQL
• ORM: Prisma (speed) or Drizzle (control). For fastest shipping: Prisma.
• Auth: JWT access + refresh token rotation
• Queue: BullMQ (Redis)
• Reverse proxy: Caddy (simple TLS)

Deliverable: repo skeleton created.

⸻

Phase 1 — VPS foundation (Day 1)

Goal: secure VPS, predictable deploys, no public DB. 1. Provision VPS

    •	Ubuntu LTS
    •	Create a non-root user
    •	SSH keys only

    2.	Hardening

    •	UFW: allow 80/443, restrict 22 (or allow only your IP if possible)
    •	Disable password SSH auth
    •	Install fail2ban
    •	Enable unattended-upgrades

    3.	Install runtime

    •	Docker + Docker Compose plugin
    •	(Optional) Node locally only; on VPS you’ll run containers

Deliverable: VPS reachable via SSH, firewall locked down, Docker running.

⸻

Phase 2 — Infrastructure via Docker Compose (Day 1–2)

Goal: bring up core services: Postgres, Redis, API, Worker, Reverse proxy.

Compose services:
• postgres (no public port; internal network only)
• redis (no public port)
• api (Fastify)
• worker (BullMQ processor)
• caddy (public 80/443 → forwards to api/web)

Add:
• .env for secrets on the VPS (never commit)
• named volumes for Postgres
• health checks

Deliverable: docker compose up brings up a running empty API + worker + DB.

⸻

Phase 3 — API scaffold (Day 2–3)

Goal: production-grade “hello world” API with guardrails.

Fastify base
• TypeScript
• @fastify/helmet
• @fastify/cors (restricted origins)
• @fastify/rate-limit
• @fastify/jwt
• @fastify/swagger + @fastify/swagger-ui
• Logging: pino (Fastify already uses it)

Standard endpoints
• GET /healthz (readiness)
• GET /version (commit SHA/version)
• GET /docs (Swagger)

Validation
• Zod schemas for request/response
• Optional: generate OpenAPI from Zod (or define both)

Deliverable: API has docs, validation, rate limit, and health checks.

⸻

Phase 4 — Database + Auth (Week 1)

Goal: secure auth + clean data model.

DB schema (v1)

Core tables:
• users (id, email, passwordHash, createdAt)
• refresh_tokens (id, userId, tokenHash, revokedAt, expiresAt, createdAt, deviceInfo)
• integrations (id, userId, provider, accessTokenEncrypted, refreshTokenEncrypted, scopes, expiresAt)
• playlists (id, userId, provider, providerPlaylistId, name, snapshot/version, updatedAt)
• tracks (id, provider, providerTrackId, name, artist, album, durationMs, isrc, updatedAt)
• playlist_items (playlistId, trackId, position, addedAt, providerItemId)
• sync_runs (id, userId, provider, status, startedAt, finishedAt, error)
• sync_logs (syncRunId, level, message, metaJson)

Auth implementation
• Register/login
• Access token: short TTL (e.g., 15 min)
• Refresh token: longer TTL (e.g., 30 days), rotating refresh tokens
• Store refresh tokens hashed (never store raw)
• Logout revokes current refresh token chain

Security add-ons:
• argon2 for password hashing
• brute-force protection on auth endpoints (rate limit + IP-based)

Deliverable: you can create an account, login, refresh, logout, and hit protected routes.

⸻

Phase 5 — Integrations + Token Security (Week 2)

Goal: connect Spotify/Apple/etc safely.

Token storage
• Encrypt provider tokens at rest:
• AES-GCM with a master key in env (TOKEN_ENC_KEY)
• Store iv + ciphertext + authTag
• Store provider metadata:
• scopes, expiresAt, lastRefreshAt, lastError

OAuth flow endpoints
• GET /auth/:provider/start
• GET /auth/:provider/callback
• POST /auth/:provider/disconnect

Deliverable: user can connect a provider and tokens are safely stored.

⸻

Phase 6 — Sync as jobs (Week 2–3)

Goal: playlist sync runs reliably (idempotent, retryable).

Queue design (BullMQ)

Jobs:
• sync:pullPlaylists (fetch playlists list)
• sync:pullPlaylistItems (fetch tracks for playlist)
• sync:reconcile (diff and apply)
• sync:pushChanges (apply changes to target provider)

Core rules:
• Jobs are idempotent (safe to retry)
• Exponential backoff retries
• One active sync per user+provider (lock with Redis key)

API endpoints:
• POST /sync/start → returns syncRunId
• GET /sync/:syncRunId → status + progress + last logs

Deliverable: user triggers sync; API returns quickly; worker does the heavy lifting.

⸻

Phase 7 — Caching strategy (Week 3)

Goal: fast reads without correctness issues.

Client caching
• TanStack Query caches most list/detail queries
• Persist selected caches to IndexedDB (optional)

Server caching (Redis)

Use caching selectively:
• “dashboard stats”
• “playlist list” per user/provider with short TTL
• expensive computed diffs (short-lived)

Add:
• Cache keys versioned by userId + provider + resource + version
• Invalidate on writes (or bump version field)

HTTP caching
• ETag for playlist GETs if feasible
• Static assets cached aggressively via Caddy/Cloudflare

Deliverable: app feels instant; API load reduced.

⸻

Phase 8 — Security hardening (Week 3–4)

Goal: close common holes before you scale.
• Strict CORS allowlist
• Helmet locked down
• Rate limit on:
• login/register
• sync start
• any public endpoints
• Request body size limits
• Centralized permission checks (user owns resources)
• Audit log for sensitive actions (connect/disconnect provider, sync start)
• Secrets rotation plan (documented)

Deliverable: “production safe enough” baseline.

⸻

Phase 9 — Observability + reliability (Week 4)

Goal: you can debug real-world failures fast.
• Sentry (API + worker)
• Structured logs (JSON)
• Metrics:
• queue depth, job duration, failure counts
• Uptime checks on /healthz
• DB backups nightly + weekly retention
• Restore test (even a simple one) documented

Deliverable: issues are visible; you won’t lose data.

⸻

Phase 10 — Frontend app integration (parallel, starting Week 1)

Goal: ship a usable UI early.
• Auth screens
• Provider connection UI
• Playlist list/detail
• Sync status page (poll syncRunId)
• Admin-lite pages for you (logs, recent sync runs) — can be behind an “internal” flag

Deliverable: end-to-end usable v1.

⸻

Suggested repo structure (clean + scalable)
• apps/api (Fastify)
• apps/worker (BullMQ processor)
• apps/web (React)
• packages/shared (Zod schemas, types, API client)

⸻

Milestones (what “done” looks like) 1. MVP Infra: VPS + compose + API healthz + DB + Redis 2. Auth MVP: register/login/refresh + protected routes 3. Provider Connect: OAuth + encrypted token storage 4. Sync MVP: queue-based sync + status endpoint 5. Usable UI: connect provider → view playlists → run sync 6. Production baseline: rate limit, backups, monitoring, Sentry

⸻

If you want, I can turn this into:
• a concrete checklist you can paste into Notion/Trello, and/or
• a starter docker-compose + folder scaffold (API + worker + shared) aligned with this roadmap.
