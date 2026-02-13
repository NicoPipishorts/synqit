# QA Checklist (MVP)

Use this before shipping changes to the event collaboration flow.

## Environment

- API, web, and worker boot with `yarn dev`.
- API health check passes: `GET /healthz`.
- Host user can login and has Spotify connected.

## Host Flow

- Host can create event and gets a magic link.
- Event appears in `/events` list with correct status.
- Host can edit event name/description.
- Host can close event.
- Host can delete event.

## Magic Link Lifecycle

- Host can revoke magic link.
- Revoked magic link returns a failure in guest page (`magic_link_revoked`).
- Host can regenerate magic link.
- Old revoked link no longer allows contribution.
- New regenerated link works.

## Guest Quick Contribute

- Guest opens active magic link and sees event details.
- Guest search returns results.
- Guest can add a track.
- Added track appears in Spotify playlist.
- Duplicate add is blocked.
- Closed event blocks add/search.

## Host Track Management

- Host can open track list for an event.
- Host can remove a track.
- Removed track disappears from host event list.
- Removed track disappears from Spotify playlist.

## Reliability and Errors

- Expired provider token auto-refreshes and the request retries once.
- Provider failures return structured API errors (not generic 500).
- If linked provider playlist is missing (deleted externally), add/remove returns `provider_playlist_missing` and event is closed.
- CORS works for local web origin.

## Regression Notes

- Deleting an event in Synqit currently does not delete the provider playlist.
- DB persistence is PostgreSQL + Prisma migrations.
