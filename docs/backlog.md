# Backlog

Use this file for deferred work that is intentionally out of the current implementation step.

## Reliability and Reconciliation

- Detect missing provider playlist references:
  When an event exists in Synqit but the host playlist was deleted directly in Spotify/Apple, detect the mismatch on read/actions.

- Event health state:
  Add a non-open operational state (example: `provider_missing` or `broken`) so hosts can see that the linked provider playlist no longer exists.

- Host recovery flow:
  Add a `Recreate playlist` action to create a new provider playlist and relink the existing event.

- Background validation:
  Add scheduled or job-based checks to verify that stored provider playlist IDs still exist.

- Move sync orchestration to workers:
  Replace the in-process API poller with worker-managed sync jobs and locking.

- Sync now / diagnostics:
  Add manual sync triggering and richer per-sync operational status.

## Provider Lifecycle

- Token refresh workflow:
  Add automatic provider token refresh and retry-once logic for provider API calls.

- Provider disconnect hygiene:
  When disconnecting a provider, decide whether to archive, lock, or keep existing events read-only.

- Apple Music remove-track capability follow-up:
  Re-evaluate Apple Music API support for playlist track deletion in live mode and replace temporary UI/API constraint when Apple behavior is stable.

## Product Gating

- Hidden advanced sync modes:
  Keep bidirectional behavior backend-capable but hidden until there is a clear product or monetization reason to expose it.

- Premium entitlements:
  If advanced sync returns, gate it behind product entitlement checks rather than branching ad hoc in the UI.

## Data Layer

- Keep Prisma schema and migrations as the single source of truth for DB changes.
