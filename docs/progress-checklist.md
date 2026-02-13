# Progress Checklist (MVP)

Use this as the implementation tracker (what is done vs pending).

## Completed

- [x] Monorepo scaffolded (`apps/web`, `apps/api`, `apps/worker`, `packages/shared`).
- [x] Local infra scripts added (`infra:up`, `infra:up:core`, `infra:down`, `infra:ps`, `infra:logs`).
- [x] Auth implemented (register, login, refresh, logout, `GET /me`).
- [x] Spotify OAuth connect implemented (start + callback + local redirect flow).
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

## Pending (Next)

- [ ] Add API regression tests for auth/integrations/events routes.
- [ ] Wire real BullMQ sync jobs from API actions.
- [ ] Implement sync run/status model and endpoints.
- [ ] Add job retry/idempotency tests for worker behavior.
- [ ] Implement provider reconciliation when host playlists are deleted externally.
- [ ] Add Apple Music provider support (post-MVP if scope stays Spotify-first).
