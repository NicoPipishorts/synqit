# Roadmap

This roadmap reflects the product as it exists now, not the original scaffold plan.

Backlog for deferred items: `docs/backlog.md`
Release QA checklist: `docs/qa-checklist.md`
Implementation progress checklist: `docs/progress-checklist.md`
Architecture notes: `docs/architecture.md`

## Current State

Synqit already has:

- email/password auth with refresh rotation
- invite-only registration managed from admin
- Spotify and Apple provider connections
- event playlist hosting and guest contribution via magic link
- synced playlists with public share/import flow
- one-way synced playlist UX in the frontend
- add-only background auto-sync with polling
- admin invites, analytics, and email preview tooling

## Next Phase 1: Harden Synced Playlists for Production

Goal: make synced playlists operationally safe before adding more product surface.

- Move sync orchestration out of the API process and into worker-managed jobs
- Add locking so one sync cannot run concurrently in multiple processes
- Add a `Sync now` action for debugging and support
- Add richer sync diagnostics:
  - last run
  - last error
  - tracks added
  - provider-specific failure reasons
- Keep the visible product model one-way, even if backend advanced modes remain hidden

## Next Phase 2: Improve Provider Reliability

Goal: reduce support/debug cost and improve trust.

- Harden Spotify and Apple token refresh and reconnect flows
- Add better per-provider error classification
- Add recovery paths for broken/missing destination playlists
- Keep reducing unnecessary polling, especially on Apple-backed syncs

## Next Phase 3: Admin and Invite Operations

Goal: make invite-only access easy to operate.

- Add invite revoke/deactivate controls
- Add invite search/filtering in admin
- Add clearer invite audit history
- Add friendlier admin error states for duplicate/used/expired invites

## Next Phase 4: Production Readiness and Observability

Goal: make incidents easy to detect and fix.

- Add metrics for API, worker, and sync health
- Add centralized error monitoring
- Add uptime checks and alert routing
- Add documented backup/restore validation
- Add smoke-test flows for deploys

## Next Phase 5: Premium/Gated Features

Goal: leave room for monetization without destabilizing core UX.

- Reintroduce advanced sync permissions only behind product gating if desired
- Consider exposing bidirectional sync only as an internal/beta/premium feature
- Add entitlement checks before advanced sync behavior is surfaced publicly

## Things Explicitly Not Needed Right Now

- microservices split for core product domains
- delete/reorder cross-provider sync
- real-time sync transport
- teams/organizations

Those can stay deferred until product usage and operational load justify them.

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
