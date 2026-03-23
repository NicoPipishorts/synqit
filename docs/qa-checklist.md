# QA Checklist

Use this before shipping changes to auth, events, synced playlists, or admin flows.

## Environment

- API, web, admin, and worker boot with `yarn dev`.
- API health check passes: `GET /healthz`.
- Prisma migrations are applied.
- Spotify and Apple provider credentials are configured for the target environment.

## Auth and Invites

- Invite can be generated from admin.
- Invite email contains a register link with `email` and `inviteToken`.
- Register page auto-populates invite token from the URL.
- Registration fails without a valid invite token.
- Registration fails if invite token email does not match the submitted email.
- Existing users cannot be invited again from admin.
- Login, refresh, logout, forgot password, and reset password still work.

## Admin

- Admin bootstrap promotion works with the configured bootstrap key.
- Admin login requires admin role.
- Admin invites page loads without legacy token crashes.
- Invite resend creates a fresh valid invite link.
- Registration email preview works.
- Password reset preview works.
- Invite email preview works.

## Event Playlist Flow

- Host can create event and gets a magic link.
- Event appears in `/events` list with correct status.
- Host can edit event metadata.
- Host can close and delete the event.
- Host can revoke and regenerate the event magic link.
- Guest can open active magic link, search, and add a track.
- Duplicate add is blocked.
- Closed event blocks add/search.
- Spotify-hosted track removal works.
- Apple-hosted removal is disabled or clearly constrained.

## Synced Playlist Flow

- Host can create a synced playlist from a connected provider playlist.
- Synced playlist appears in `My synced playlists`.
- Subscriber can open the public shared page and subscribe.
- Subscriber copy is created in the recipient provider.
- Owner/source additions sync to subscriber copies.
- Public synced playlist page shows subscriber count and track list.
- Owned synced playlists open the manage/detail page.
- Shared/subscribed sections render correctly in synced playlists list.

## Sync Reliability

- Poll scheduler runs without crashing.
- Sync logs show poll activity when enabled.
- Duplicate track adds are blocked during sync.
- Quiet playlists back off polling over time.
- Spotify snapshot detection skips unnecessary full work when unchanged.
- Apple-backed syncs still detect changes correctly after backoff.
- Provider token refresh still works on expired Spotify access tokens.

## Reliability and Errors

- Provider failures return structured API errors, not generic 500s.
- Missing provider playlist reconciliation works for event actions.
- Sync/import errors surface a human-readable message in the UI.
- CORS works for local web/admin origins.

## Regression Notes

- Synced playlist UX is intentionally one-way in the frontend.
- Backend bidirectional sync capability may still exist, but is hidden from product UI.
- Deleting an event in Synqit does not currently delete the provider playlist.
- Apple Music playlist delete/remove behavior remains limited by provider API support.
