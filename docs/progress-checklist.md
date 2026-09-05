# Progress Checklist (MVP)

Use this as the implementation tracker (what is done vs pending).

## Completed

- [x] Monorepo scaffolded (`apps/web`, `apps/api`, `apps/worker`, `packages/shared`).
- [x] Admin app added (`apps/admin`).
- [x] Local infra scripts added (`infra:up`, `infra:up:core`, `infra:down`, `infra:ps`, `infra:logs`).
- [x] Auth implemented (register, login, refresh, logout, `GET /me`).
- [x] Shared auth guards and ownership guards refactored into reusable modules.
- [x] Invite-only registration implemented.
- [x] Admin-generated invite tokens implemented.
- [x] Invite resend flow implemented with renewed validity.
- [x] Invite email preview added to admin email test panel.
- [x] Spotify OAuth connect implemented (start + callback + local redirect flow).
- [x] Apple Music connect implemented (developer token + user connection flow).
- [x] Integration status/list/disconnect routes implemented.
- [x] Event CRUD implemented (create, list, update, close, delete).
- [x] Magic link flow implemented (public event read, revoke, regenerate).
- [x] Guest track flow implemented (search, add, duplicate protection, remove).
- [x] Provider error mapping and diagnostics implemented.
- [x] Provider token retry-once flow implemented for Spotify calls.
- [x] Storage migrated to PostgreSQL (auth, integrations, events).
- [x] Prisma installed and schema introspected.
- [x] Prisma client singleton added and stores migrated to Prisma.
- [x] Baseline Prisma migration created (`0001_baseline`) and marked applied.
- [x] API DB startup switched to connection check (schema managed by Prisma migrations).
- [x] Legacy JSON bootstrap/store references removed from runtime/docs/env examples.
- [x] API regression tests added for auth/integrations/events routes.
- [x] GitHub Actions workflow added to run API regression tests on push/PR.
- [x] Provider playlist-missing reconciliation added (close event + explicit API error).
- [x] Apple provider added to provider schema + integrations API.
- [x] Event creation supports explicit provider selection (Spotify or Apple).
- [x] Apple-hosted event create/search/add flow wired to Apple Music APIs.
- [x] Apple track remove flow guarded with provider-specific fallback + explicit API limitation error mapping.
- [x] Synced playlists create/share/import flow implemented.
- [x] Synced playlists owner/subscriber split implemented in the web app.
- [x] Synced playlist detail/manage/share pages implemented.
- [x] Auto-sync scheduler implemented with add-only sync behavior.
- [x] Bidirectional add-only sync implemented in backend only.
- [x] Frontend synced playlist UX simplified to one-way/host-only presentation.
- [x] Adaptive sync polling backoff implemented.
- [x] Spotify snapshot-based change detection implemented.
- [x] Apple manifest-based no-op detection implemented.
- [x] Poll log tagging added for sync diagnostics.
- [x] Web/admin auth session persistence moved from `localStorage` to cookie-backed sessions with CSRF protection.
- [x] Required secrets enforced at startup (no code fallbacks; weak values fatal in production, warned in dev).
- [x] `/metrics` behind a bearer token and `/docs` disabled in production; Caddy blocks both at the edge.
- [x] Admin bootstrap locked down (opt-in flag, strong key, constant-time compare, lock after first super admin, rate limit, audit log).
- [x] Runtime schema mutation removed from API startup; CI fails on migration/schema drift.
- [x] `@synqit/ui` package: single `tokens.css`, 22 shared primitives (CTA, Modal, Toast, nav, forms, StatGrid, DataTable, EmptyState, OnboardingPanel), Ladle stories, Vitest suite; site/web/admin migrated.

## Pending (Next)

- [ ] Move synced playlist orchestration from API polling to worker-managed jobs.
- [ ] Add worker-safe locking for sync execution across multiple API/worker processes.
- [ ] Add `Sync now` action for support and QA.
- [ ] Add richer synced-playlist diagnostics/status UI.
- [ ] Add automated regression coverage for cross-user authorization cases.
