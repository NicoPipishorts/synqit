# Job Conventions

## Queue

- Queue name: `sync`.
- Jobs are idempotent and retry-safe.

## Naming

- `sync:pullPlaylists`
- `sync:pullPlaylistItems`
- `sync:reconcile`
- `sync:pushChanges`

## Retry policy

- Exponential backoff.
- Minimum `attempts=3` for network-bound jobs.

## Concurrency and locking

- Allow only one active sync per `userId + provider`.
- Use Redis lock keys to guard parallel execution.

## Tracking

- Every API-triggered sync creates a `sync_run` record.
- Job processors append structured logs with timestamps.
