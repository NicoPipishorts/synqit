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
- [x] `@synqit/client` (API client, auth store, analytics tracker, preferences/theme) and `@synqit/i18n` (provider, hook, interpolation, parity + usage checker) packages; web/admin/site migrated; admin data loading on TanStack Query.
- [x] Link imports for the transfer funnel: public Deezer (ISRC exact match) and YouTube (title parsing, needs `YOUTUBE_API_KEY`) playlists imported into Spotify/Apple Music in the background with live progress; ISRC-first matching now also improves Spotify/Apple transfers.
- [x] Marketing site redesigned around the three services (hero with rotating app screens, interactive service showcase with scroll/hover motion, marker seam, pricing + auth pages restyled); sticker utilities and `Sticker` primitive added to `@synqit/ui`; EN/FR home copy rewritten.
- [x] Legal pages on the marketing site (`/privacy`, `/terms`, `/cookies`, `/legal-notice`) in EN/FR, linked from the footer; prose lives in typed modules under `apps/site/src/content/legal/` rather than the shared locale JSON. Publisher identity, host details and the consumer mediator are still placeholders in `content/legal/entity.ts` — fill them before production.
- [x] Public FAQ page (`/faq`) in EN/FR with a per-service capability matrix, reachable from the navbar, both footers and deep-linked from the hero and the transfer flow; mobile layout switches the matrix from a table to per-service cards.
- [x] TIDAL added as a third provider: OAuth with PKCE, JSON:API playlist reads and writes, ISRC exact matching. Covers connect, sync and transfer; event hosting is refused with `provider_not_supported_for_events`. Needs `TIDAL_CLIENT_ID` / `TIDAL_CLIENT_SECRET` / `TIDAL_REDIRECT_URI`. Live in the UI on both the marketing site and the app: the compatibility strip, FAQ matrix, footers, auth pages and the sync/transfer provider pickers. Its mark is monochrome, so `ServiceLogo` paints it with `currentColor` through a CSS mask.
- [x] Qobuz link import (import-only): editorial playlists on qobuz.com publish a schema.org MusicPlaylist block with title, artist, album and duration per track, read by `fetchQobuzPlaylist` without any API key. Accepts www.qobuz.com playlist pages and open/play.qobuz.com links; personal playlists are not published on the site and get a clear error pointing at file import. No ISRC, so matching is by title.
- [x] File and paste import for the transfer funnel: CSV exports (Exportify, Soundiiz, TuneMyMusic, spreadsheets with `;` or tab), M3U/M3U8 playlists and pasted "Artist - Title" lists are parsed server-side (`apps/api/src/syncs/tracklist-parser.ts`), previewed, and imported in the background through the same pipeline as Deezer/YouTube links. Rows with an ISRC match exactly; the rest match by title. Tracks are stored on the import record (`external_imports.source_tracks_json`) since there is no source to re-read. Web: a "Paste a link / Upload a file" toggle on the link import page, with a file picker and a paste box.
- [x] Event hosting is provider-agnostic: guest search, adds, host removal, playlist creation and track sync in `events/routes.ts` go through the provider registry with one shared error path (Spotify keeps its 403 owner/scope diagnostics, Apple its name/description mirror via `getPlaylistDetails`). Which services hosts may pick is an operator setting (`app_settings` table, key `events.enabled_providers`, default Spotify + Apple Music or `EVENT_PROVIDERS`), read by `GET /v1/playlists/providers` and toggled from the admin panel's new Services page (`/admin/settings/providers`). TIDAL and YouTube Music can now host as soon as the switch is flipped; YouTube stays off until Google grants the quota extension.
- [x] YouTube Music added as a fourth provider: Google OAuth (offline access, consent re-prompted so a refresh token always arrives), YouTube Data API v3 playlist reads and writes, text-search matching (YouTube exposes no ISRC), one insert per track with per-track checkpointing so a quota refusal mid-transfer resumes instead of restarting. Covers connect, sync and transfer; event hosting is refused. Needs `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` / `YOUTUBE_REDIRECT_URI`. Gated in production by Google OAuth verification of the sensitive `youtube` scope and by the 10,000-unit daily quota (search 100, insert 50): reading a YouTube Music library is cheap, writing to it is not until the quota extension lands.
- [x] Provider adapter registry (`apps/api/src/integrations/provider-registry.ts`) replaces the per-provider branching across sync, transfer and integrations; frontends read provider names, brand marks and the connectable list from `@synqit/ui` and the shared schema.
- [x] Transfer funnel reworked into one tunnel: step 1 is a single source card offering two lines — direct transfer (the connectable services, all of which the provider registry can write to) and public link (Deezer, Qobuz, filtered by what `GET /v1/syncs/external/sources` reports) — with the destination card blank until a source is picked, then filtered to what Synqit can write to minus the source. Picking a link source reveals the URL field and hands over to `/transfer/link` with the URL and destination prefilled (`validateSearch` on the route). Marks are bare logos with no names or pills, the picked one flies into the card header on a measured FLIP, and the lane between the cards is a drawn arrow (`DrawnArrow` in `@synqit/ui`) in the source service's colour. The swap button, the dashboard's separate "Import from a link" entry and the profile panel's duplicate YouTube Music row are gone.
- [x] Transfer details page (`/transfer/$syncId`): per-track outcomes are recorded as a transfer lands (`transfer_item_tracks`, written by the worker from a new per-track result on `importSyncForRecipient`) and served by `GET /v1/transfers/playlist/:syncId`. The page leads with the outcome — matched of total, found/not-found counts, the lane and the date — then lists every song with a transferred/not-found badge. Transfers made before this show their counts and say why there is no song list.

## Pending (Next)

- [ ] Move synced playlist orchestration from API polling to worker-managed jobs.
- [ ] Add worker-safe locking for sync execution across multiple API/worker processes.
- [ ] Add `Sync now` action for support and QA.
- [ ] Add richer synced-playlist diagnostics/status UI.
- [ ] Add automated regression coverage for cross-user authorization cases.
