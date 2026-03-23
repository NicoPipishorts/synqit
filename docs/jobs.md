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
