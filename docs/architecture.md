# Architecture

This document explains the recommended backend shape for Synqit today and what should change later as the product grows.

## Current Recommendation

Synqit should remain a `modular monolith + workers`, not a microservices system.

That means:

- one main API deployable for product logic
- one worker deployable for asynchronous/background work
- one shared PostgreSQL database
- Redis for queues, locks, and background orchestration

This is the right fit because:

- product behavior is still evolving quickly
- auth, integrations, events, and synced playlists share a lot of data and rules
- cross-provider sync logic is tightly coupled to user auth and provider tokens
- operational complexity from microservices would slow product work down more than it would help

## What Stays in the API

The API should remain a modular monolith with clear domain boundaries in code:

- `auth`
  - login, refresh, password reset, invite-only registration
- `integrations`
  - Spotify/Apple connect, disconnect, token storage
- `events`
  - event playlist CRUD, magic links, guest contribution flow
- `syncs`
  - synced playlist CRUD, imports, public/shared pages, sync state
- `admin`
  - invites, analytics, RBAC, email previews
- `analytics`
  - event ingestion and admin reporting APIs

The important architectural rule is:

- keep domains separate in files/modules
- do not split them into separate network services yet

## What Belongs in Workers

Workers should handle:

- transactional email sending
- email preview jobs
- future sync orchestration/execution
- future analytics aggregation or scheduled cleanup tasks

Current reality:

- notification email jobs already run in `apps/worker`
- synced playlist polling still runs inside the API process

Recommended next move:

- move the synced playlist scheduler/execution out of the API process and into worker-managed jobs with locking

## Why Microservices Are Not Needed Yet

A microservice is useful when a domain needs:

- independent scaling
- separate release cadence
- strict isolation for reliability/compliance
- clearly independent data ownership

Synqit is not there yet.

If you split too early, you would pay for:

- more deployment complexity
- more auth/permission plumbing between services
- more failure modes across service boundaries
- more difficult local development and debugging
- harder cross-domain changes while the product is still moving

## Recommended Runtime Shape

### Web apps

- `apps/web`
  - end-user product UI
- `apps/admin`
  - admin-only UI

### Backend services

- `apps/api`
  - main API and current sync polling entry point
- `apps/worker`
  - BullMQ worker for notifications today, more background work later

### Shared packages

- `packages/shared`
  - Zod schemas, shared contracts, queue names, constants

### Data and infra

- PostgreSQL
  - primary datastore
- Redis
  - queues, future sync locks, job orchestration

## Suggested Near-Term Architecture Moves

### 1. Keep the modular monolith

Do not split `auth`, `events`, `syncs`, `integrations`, or `admin` into separate services.

### 2. Move sync execution to workers

The next meaningful architecture step is:

- scheduler creates due sync jobs
- worker executes sync jobs
- Redis/DB locking prevents duplicate runs
- API only reads/writes sync state and triggers/manual actions

### 3. Add explicit operational boundaries

Even without microservices, add clear boundaries for:

- auth guards
- ownership/resource guards
- provider adapters
- sync orchestration
- notification jobs

### 4. Treat advanced sync as a product boundary

If bidirectional sync returns later, especially behind a paywall:

- keep the public/frontend experience one-way by default
- gate advanced sync capabilities at the API/product layer
- do not create a separate service just for that feature unless volume or billing complexity truly demands it

## What Could Become Separate Services Later

Only consider extraction later if scale or operational needs justify it.

Good future candidates:

- `sync-orchestrator`
  - if sync volume becomes high and needs separate scaling/reliability controls
- `analytics-pipeline`
  - if reporting/event ingestion grows significantly
- `billing/subscriptions`
  - if premium plans, entitlements, and invoicing become complex enough

Bad candidates right now:

- auth
- integrations
- events
- synced playlists

Those should stay in the modular monolith for now.

## Bottom Line

Recommended architecture for Synqit today:

- modular monolith for core product logic
- background workers for async work
- shared Postgres + Redis
- no microservices yet

Recommended next architecture milestone:

- production-safe sync orchestration in workers
- not a microservice split
