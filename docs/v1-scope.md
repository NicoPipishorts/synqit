# Synqit v1 Scope

## Must-have v1

- User auth with email/password.
- Invite-only registration managed from admin.
- Spotify and Apple provider connections.
- Event playlist hosting with magic-link guest contribution.
- Synced playlist creation, public share/import, and owner/subscriber views.
- One-way synced playlist UX in the frontend.
- Add-only auto-sync polling between providers.
- Transactional email delivery via worker jobs.

## Explicit non-goals for v1

- Public bidirectional sync controls in the frontend.
- Cross-provider delete/reorder sync.
- Real-time updates (WebSockets/SSE).
- Offline-first/local-first synchronization.
- Billing, teams, organization features.
- Microservices split for core product domains.

## Acceptance criteria

- A user can register, login, refresh, and logout.
- A user can only register with a valid invite token.
- A user can connect Spotify or Apple and persist encrypted provider credentials.
- A host can create an event and share it via magic link.
- A guest can add tracks to the host event playlist.
- A user can create a synced playlist and another user can subscribe/import it on another provider.
- Auto-sync runs in the background without blocking the request/response path.
- API, worker, web, and admin run locally via the monorepo workflow.
