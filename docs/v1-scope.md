# Synqit v1 Scope

## Must-have v1

- User auth with email/password.
- Connect one provider first: `spotify`.
- Pull playlists and tracks from provider into Synqit DB.
- Display playlists and track lists in the web app.
- Trigger a `Start sync` job and show run status.

## Explicit non-goals for v1

- Multi-provider reconciliation logic.
- Real-time updates (WebSockets/SSE).
- Offline-first/local-first synchronization.
- Billing, teams, organization features, invites.

## Acceptance criteria

- A user can register, login, refresh, and logout.
- A user can connect Spotify and persist encrypted provider credentials.
- A user can trigger a sync run and view status/progress.
- API, worker, and web run locally via one command.
