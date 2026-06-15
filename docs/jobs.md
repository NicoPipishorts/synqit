# Job Conventions

## Current Reality

- `notifications` queue is active and used for transactional email delivery.
- `sync` queue exists, but synced playlist execution is still primarily driven by the API polling scheduler today.
- Worker-based sync orchestration is a planned next step, not the fully active production path yet.

## Active Notification Jobs

- `notifications:sendRegistrationConfirmationEmail`
- `notifications:sendRegistrationConfirmationEmailPreview`
- `notifications:sendRegistrationInviteEmail`
- `notifications:sendRegistrationInviteEmailPreview`
- `notifications:sendPasswordResetEmail`
- `notifications:sendPasswordResetEmailPreview`
- `notifications:sendWeeklyRecapEmail`
- `notifications:sendWeeklyRecapEmailPreview`

## Weekly Recap Email

- An in-API scheduler (`startWeeklyRecapScheduler`) wakes on a short check
  interval and, once per ISO week (at/after the configured day + hour), claims
  the period via a unique `notification_runs` row and aggregates per-user new-song
  counts across owned/subscribed synced playlists and hosted/followed event
  playlists over a trailing window (default 7 days).
- One `notifications:sendWeeklyRecapEmail` job is enqueued per user with at least
  one new song; users with no new activity are skipped.
- Gated by `WEEKLY_RECAP_ENABLED=true`. Tunable via `WEEKLY_RECAP_CHECK_INTERVAL_MS`,
  `WEEKLY_RECAP_SEND_DAY`, `WEEKLY_RECAP_SEND_HOUR_UTC`, and `WEEKLY_RECAP_WINDOW_DAYS`.
- The `notification_runs` claim row makes the run idempotent across API restarts
  and multiple instances (the unique `(kind, period_key)` insert is the lock).

## Planned Sync Jobs

These are still a good target shape once sync execution is moved into workers:

- `sync:pullPlaylists`
- `sync:pullPlaylistItems`
- `sync:reconcile`
- `sync:pushChanges`

## Retry Policy

- Jobs should be idempotent and retry-safe.
- Use exponential backoff for network-bound jobs.
- Notification jobs should fail loudly with structured logs.

## Concurrency and Locking

- Notification jobs can run concurrently.
- Future sync jobs should use locking to prevent duplicate sync execution.
- The target lock boundary should be per sync/import, not only per user/provider.

## Tracking

- Notification jobs should log structured payload-validation failures clearly.
- Future sync jobs should emit run metadata and diagnostics visible to the app/admin surface.
