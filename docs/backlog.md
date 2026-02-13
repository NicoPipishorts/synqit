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

## Provider Lifecycle

- Token refresh workflow:
  Add automatic provider token refresh and retry-once logic for provider API calls.

- Provider disconnect hygiene:
  When disconnecting a provider, decide whether to archive, lock, or keep existing events read-only.

## Data Layer Migration

- Move file-backed stores to DB:
  Replace JSON stores for auth, integrations, and events with Prisma/Postgres models and migrations.
