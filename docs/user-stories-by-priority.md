# User Stories By Priority

This document turns the current security and scalability assessment into a prioritized implementation backlog.

Priority meanings:

- `P0`: must fix before calling the platform production-secure
- `P1`: next wave required for reliable production operation
- `P2`: important scale and operations improvements after the baseline is solid
- `P3`: longer-term maturity work

---

## P0 Security Hardening

### US-001 Enforce Required Runtime Secrets

**Status as of September 3, 2026**

- Implemented
- `JWT_ACCESS_SECRET`, `TOKEN_ENC_KEY`, and `DATABASE_URL` are required; placeholder or short (<32 chars) secrets fail startup when `NODE_ENV=production` or `SECRETS_STRICT=true` and warn otherwise
- Worker requires `REDIS_URL` in strict mode and `RESEND_API_KEY` when `EMAIL_PROVIDER=resend`
- No fallback credentials remain in source (`dev-access-secret`, `replace-me`, default `DATABASE_URL` removed)
  **As an** operator  
  **I want** the API and worker to fail fast when required secrets are missing  
  **So that** the system never runs with predictable fallback credentials

**Why this matters**

- JWT signing currently has a code fallback.
- Provider token encryption currently has a code fallback.

**Acceptance criteria**

- API startup fails if `JWT_ACCESS_SECRET` is missing or weak.
- API startup fails if `TOKEN_ENC_KEY` is missing or weak.
- Worker startup fails if required queue/email/provider secrets are missing.
- No production secret fallback values remain in source code.
- Env validation produces actionable startup errors.

### US-002 Move Auth Tokens Out Of `localStorage`

**Status as of July 22, 2026**

- Implemented
- Web and admin auth now use cookie-backed sessions with CSRF protection on unsafe cookie-authenticated routes

**As a** signed-in user  
**I want** session credentials stored in safer transport mechanisms  
**So that** XSS is less likely to expose long-lived tokens

**Acceptance criteria**

- Access and refresh tokens are no longer stored in `localStorage`.
- Session auth uses `HttpOnly`, `Secure`, `SameSite` cookies or an equivalent safer mechanism.
- Refresh flow continues to work for both web and admin apps.
- Logout clears server-side refresh state and client session state.
- CSRF protection is added for cookie-backed authenticated routes.

### US-003 Restrict Operational Endpoints

**Status as of September 3, 2026**

- Implemented
- `/metrics` requires `Authorization: Bearer $METRICS_TOKEN`; disabled in production until the token is set
- `/docs` is not mounted in production unless `API_DOCS_ENABLED=true`
- Caddy returns 404 for `/api/metrics*` and `/api/docs*` at the public edge
- Production verification after deploy is still pending
  **As an** operator  
  **I want** internal operational surfaces protected  
  **So that** public users cannot access metrics or internal API documentation

**Acceptance criteria**

- `/metrics` is restricted to internal access or protected auth.
- `/docs` is disabled in production or protected auth.
- Reverse-proxy rules explicitly enforce this behavior.
- Production verification confirms these endpoints are not public.

### US-004 Lock Down Admin Bootstrap

**Status as of September 3, 2026**

- Implemented
- Route is off unless `ADMIN_BOOTSTRAP_ENABLED=true`; key must be >=32 chars and non-placeholder, compared in constant time
- Refuses once a super admin exists unless `ADMIN_BOOTSTRAP_ALLOW_WHEN_SUPER_ADMIN_EXISTS=true`
- Route-level rate limit (20 per 15 minutes per IP); successes and rejections are written to `admin_audit_logs`
- Key rotation procedure is documented in `apps/api/.env.example`
  **As an** operator  
  **I want** emergency admin bootstrap to be tightly controlled  
  **So that** privilege escalation paths are minimized

**Acceptance criteria**

- Admin bootstrap can be disabled after initial setup.
- Bootstrap access is rate-limited and logged with audit events.
- Bootstrap requires a strong secret with documented rotation.
- Bootstrap is blocked entirely in standard runtime after first super-admin provisioning, unless explicitly re-enabled.

### US-005 Remove Runtime Schema Mutation

**Status as of September 3, 2026**

- Implemented
- Startup no longer runs `ALTER TABLE` / `CREATE TABLE` / `CREATE INDEX`; the API only checks connectivity
- Indexes that existed only in migrations were added to `schema.prisma`
- CI fails on drift via `yarn workspace @synqit/api prisma:drift`
  **As a** backend maintainer  
  **I want** schema changes to happen only through migrations  
  **So that** deploys are deterministic and auditable

**Acceptance criteria**

- App startup no longer performs `ALTER TABLE`, `CREATE TABLE`, or `CREATE INDEX`.
- All current startup schema changes are represented in Prisma migrations.
- Deploys remain successful with only `prisma migrate deploy`.
- CI fails if generated schema and migrations drift.

---

## P1 Production Reliability

### US-006 Move Sync Scheduling Out Of API Processes

**As an** operator  
**I want** sync orchestration decoupled from API instances  
**So that** scaling the API does not duplicate scheduled work

**Acceptance criteria**

- API no longer runs sync polling loops on startup.
- Due syncs are scheduled through worker-managed jobs.
- Manual sync triggers enqueue jobs instead of running orchestration in-process.
- Sync lifecycle state remains visible through API endpoints.

### US-007 Add Cross-Process Locking For Sync Execution

**As an** operator  
**I want** distributed locking around sync execution  
**So that** multiple API or worker replicas cannot process the same sync concurrently

**Acceptance criteria**

- Each sync execution path acquires a distributed lock before work starts.
- Locks expire safely if a worker crashes.
- Duplicate execution attempts are logged and skipped.
- Regression coverage exists for double-run prevention behavior.

### US-008 Add Error Monitoring

**As an** operator  
**I want** centralized frontend and backend error capture  
**So that** failures are visible before users report them

**Acceptance criteria**

- Backend exceptions are reported to an error monitoring platform.
- Web and admin frontend exceptions are reported to the same platform.
- Releases/commits are attached to reported errors.
- Sensitive request data is redacted before emission.

### US-009 Add Backup And Restore Automation

**As an** operator  
**I want** automated database backups with restore verification  
**So that** a server failure does not become a data-loss event

**Acceptance criteria**

- Daily Postgres backups run automatically.
- Backup retention is defined and documented.
- Restore instructions are documented and tested.
- At least one non-production restore drill is verified.

### US-010 Add Alerting And Uptime Monitoring

**As an** operator  
**I want** uptime and resource alerts  
**So that** production issues are detected quickly

**Acceptance criteria**

- API health is checked externally.
- Alerts exist for downtime, 5xx spikes, low disk, and DB unavailability.
- Alert routing is configured to at least one operator channel.
- Runbooks identify the first response steps for common incidents.

---

## P2 Scalability And Operational Maturity

### US-011 Add Staging Environment

**As a** maintainer  
**I want** a separate staging stack  
**So that** production changes can be verified safely before release

**Acceptance criteria**

- Staging has separate app URLs, DB, Redis, and secrets.
- CI can deploy to staging independently of production.
- Smoke tests run against staging after deploy.

### US-012 Strengthen Deployment Strategy

**As an** operator  
**I want** safer deploy and rollback behavior  
**So that** releases do not rely on best-effort in-place replacement

**Acceptance criteria**

- Deploys support rollback to the previous image tag.
- Health checks gate rollout completion.
- Deployment documentation includes rollback steps.
- Production image tags are immutable and traceable to commits.

### US-013 Add Redis Persistence And Recovery Policy

**As an** operator  
**I want** queue durability expectations defined  
**So that** Redis restarts do not create unknown delivery behavior

**Acceptance criteria**

- Redis persistence mode is explicitly configured.
- Queue durability expectations are documented.
- Recovery behavior after Redis restart is tested.
- Job retry/idempotency behavior is verified for email and sync jobs.

### US-014 Add Synthetic End-To-End Checks

**As an** operator  
**I want** automated critical-path smoke checks  
**So that** regressions in login and core product flows are detected quickly

**Acceptance criteria**

- Synthetic checks cover login, create playlist/event, and at least one sync-related path.
- Checks run on a schedule and after deploy.
- Failures notify operators.

### US-015 Add Performance Baselines

**As a** backend maintainer  
**I want** baseline latency and throughput targets  
**So that** scaling work is driven by measurable bottlenecks

**Acceptance criteria**

- p50/p95 latency targets are defined for key API routes.
- Basic load-test scenarios are documented and runnable.
- Slow queries and high-volume endpoints are identified from measurements.

---

## P3 Longer-Term Scale Work

### US-016 Evaluate Managed Postgres Or Read Replicas

**As an** operator  
**I want** a path beyond single-node Postgres  
**So that** database availability and growth have a clear next step

**Acceptance criteria**

- Decision record compares VPS Postgres vs managed Postgres.
- Read replica or managed migration triggers are defined.
- Backup, failover, and maintenance tradeoffs are documented.

### US-017 Add Centralized Log Retention

**As an** operator  
**I want** searchable log aggregation  
**So that** investigations do not depend on a single host’s local logs

**Acceptance criteria**

- API, worker, and proxy logs are collected centrally.
- Retention period is defined.
- Logs are searchable by request ID, service, and severity.

### US-018 Define SLOs And Error Budgets

**As a** product and engineering team  
**I want** explicit reliability goals  
**So that** scaling and operational tradeoffs have measurable targets

**Acceptance criteria**

- Availability target is defined.
- Latency targets are defined for key user flows.
- Error budget policy is documented.
- Monitoring dashboards map to those targets.

---

## Recommended Implementation Order

1. `US-001` Enforce required runtime secrets
2. `US-002` Move auth tokens out of `localStorage`
3. `US-003` Restrict operational endpoints
4. `US-005` Remove runtime schema mutation
5. `US-006` Move sync scheduling out of API processes
6. `US-007` Add cross-process locking for sync execution
7. `US-008` Add error monitoring
8. `US-009` Add backup and restore automation
9. `US-010` Add alerting and uptime monitoring
10. `US-011` Add staging environment

## Summary Assessment

Current state:

- Good early-stage modular monolith with worker support
- Reasonable local/dev and single-VPS deployment shape
- P0 security hardening (US-001 to US-005) is implemented; production verification of the operational endpoints is pending the next deploy
- Not yet ready for confident horizontal scaling of backend job/sync workloads

What is missing before calling it secure and scalable:

- worker-safe sync orchestration
- backup, alerting, and error monitoring discipline
