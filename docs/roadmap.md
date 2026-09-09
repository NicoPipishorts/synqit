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

## Next Phase 6: Provider Expansion (before launch, after Phase 1)

Goal: make "multi-platform" credible beyond Spotify and Apple Music, using official APIs only.
Transfer stays an acquisition funnel, not the product; every new provider must also work for
event hosts and synced-playlist subscribers, not just as a transfer source.

Verified status as of September 2026 (re-check each portal before starting):

| Provider                    | Access                                                                                                                                                                                                                                  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TIDAL                       | Official API, OAuth authorization code + PKCE, open registration                                                                                                                                                                        | Scopes for playlists read/write and user collection; catalog search and ISRC lookup. Cleanest fit for the existing provider abstraction. Small user base.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| YouTube Music               | YouTube Data API v3 (YouTube Music playlists are YouTube playlists), OAuth                                                                                                                                                              | Default quota 10,000 units/day; `playlistItems.insert` costs 50 units, so ~200 track adds per day across all users until a quota extension is granted. The `youtube` scope is sensitive: Google OAuth verification (brand + scope review, demo video) is required before more than a handful of users can connect. Start the verification and quota extension early; both take weeks.                                                                                                                                                                                                                                                                               |
| Deezer                      | Public endpoints without a key (public playlists, search, track by ISRC). OAuth requires an existing app id; new developer registrations are reported closed                                                                            | If an app id is already held, Deezer can be a full provider (`manage_library`); otherwise import-only from public playlists.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Amazon Music                | Official Web API (`https://api.music.amazon.dev/v1`, LWA OAuth 2.0), closed beta. Not self-serve: the LWA security profile id must be allowlisted by Amazon Music. Partnership, requested through a developer support case / BD contact | Reachable, contrary to the earlier "partner APIs only, out of scope" note. Soundiiz is a listed Amazon Music partner (`soundiiz.com/partner/amazon-music`, "Recommended by Amazon Music") doing import, export **and** ongoing sync; TuneMyMusic claims the same partnership. Precedent is direct, and a paid, token-storing sync product in this category clearly clears the Program Requirements, so the fees and end-user-data clauses are negotiable rather than disqualifying. Endpoints fit the adapter almost exactly (`POST /playlists`, `PUT /playlists/{id}/tracks`, `GET /me/playlists`, catalog `isrc`). Blocker is BD access, not law or architecture. |
| Qobuz                       | Partner API only; editorial playlist pages on qobuz.com carry schema.org MusicPlaylist data                                                                                                                                             | Import-only from editorial playlist links (shipped). Personal playlists are app-only and unreachable. Full provider needs a partnership.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Napster                     | Partner APIs only                                                                                                                                                                                                                       | Not reachable without a partnership. Out of scope.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| SoundCloud, Pandora, Yandex | No usable official API for third-party playlist writes                                                                                                                                                                                  | Competitors use unofficial clients. Explicitly not doing this: bans and breakage land on users' accounts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

Order of work:

1. Spotify extended quota approval (development mode caps connected users at 25); this gates
   every transfer-funnel user and must precede any launch traffic.
2. TIDAL as a full provider (connect, playlists, search/ISRC match, event hosting, sync
   destination). Validates that the provider abstraction generalises: today provider branching
   exists in `syncs/routes.ts`, `syncs/auto-sync.ts`, `events/routes.ts`, `integrations/routes.ts`
   and four web components; introduce a provider registry so a third provider is additive.
3. Import-only sources for the transfer funnel: public Deezer playlists, YouTube playlists, and
   file/paste import (CSV, M3U, tracklist text). No user auth on the source side.
4. YouTube Music as a full provider. Code landed (connect, sync, transfer; no event hosting).
   What remains is external: Google OAuth verification of the `youtube` scope, and the quota
   extension without which one 100-track transfer into YouTube Music exceeds a day's allowance.
5. Deezer as a full provider if an app id is available.

Not planned: unofficial or cookie-based access to any service.

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
