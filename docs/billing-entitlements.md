# Billing & Entitlements — Technical Design

_How Synqit charges for the plans in [pricing-and-positioning.md](./pricing-and-positioning.md)
and enforces them. There is currently **no billing infrastructure** — this is a
greenfield foundation. No code has been written yet; this is the build spec._

_Last updated: 2026-06-16_

---

## Goals

- Charge **one-time** for event tiers and per-playlist sync unlocks.
- Charge **recurring** for the Curator tier.
- Resolve and enforce **entitlements** at three scopes: per-event, per-sync,
  per-account.
- Reuse existing patterns: the BullMQ `notifications` queue + the
  `notification_runs` claim/scheduler pattern (see `apps/api/src/jobs/`).

## Non-goals (v1)

- Invoicing/tax beyond what Stripe handles automatically.
- Proration edge cases beyond Stripe defaults.
- The Curator **mirroring engine** itself — that is a separate design spike
  (see end), gated behind the Curator entitlement but built last.

---

## Payment provider: Stripe

- **Stripe Checkout** for both one-time (`mode: payment`) and subscription
  (`mode: subscription`) flows. Hosted, PCI-light, fastest path.
- **Webhooks** are the source of truth for granting entitlements — never grant
  from the client redirect. Handle: `checkout.session.completed`,
  `customer.subscription.created|updated|deleted`,
  `invoice.payment_failed`.
- Webhook handler verifies the Stripe signature, then writes `payments` +
  `entitlements` rows idempotently (dedupe on Stripe event id).
- Store a `stripe_customer_id` per user.

Products/prices to define in Stripe (ids resolved via env, like the existing
provider keys):

| Product | Stripe mode | Notes |
|---|---|---|
| Event — Party | payment | one-time |
| Event — Celebration | payment | one-time |
| Sync — Playlist unlock | payment | one-time, per playlist |
| Curator | subscription | monthly + annual price |

---

## Data model

New/changed Prisma models (`apps/api/prisma/schema.prisma`). Follow existing
snake_case + `@db.Timestamptz(6)` conventions.

### `events` (changes)

- `tier String @default("free")` — `free` | `party` | `celebration`
- `event_date DateTime? @db.Timestamptz(6)` — optional, host-set (UX + anchor)
- `expires_at DateTime? @db.Timestamptz(6)` — when the free recap is purged
- `purged_at DateTime? @db.Timestamptz(6)` — set when Synqit-side data removed

### `playlist_syncs` (changes)

- `tier String @default("free")` — `free` | `unlocked`
- `expires_at DateTime? @db.Timestamptz(6)` — when a free sync pauses
- Free subscriber cap is a constant (e.g. `FREE_SYNC_SUBSCRIBER_CAP = 25`), not
  a column.

### `account_subscriptions` (new — Curator)

- `id`, `user_id` (unique), `plan` (`curator`), `status`
  (`active`|`past_due`|`canceled`), `stripe_subscription_id`,
  `current_period_end`, `seats`, timestamps.

### `payments` (new — audit/ledger)

- `id`, `user_id`, `stripe_event_id` (unique, idempotency),
  `kind` (`event_party`|`event_celebration`|`sync_unlock`|`curator_sub`),
  `amount`, `currency`, `target_type` (`event`|`sync`|`account`),
  `target_id` (nullable), `created_at`.

### `users`

- `stripe_customer_id String?`

Keep per-resource flags (`events.tier`, `playlist_syncs.tier`) as the **fast
read path** for gates; `payments`/`account_subscriptions` are the ledger/source.

---

## Entitlement resolution

A small `entitlements` helper module answers:

- `eventTier(eventId)` → reads `events.tier`.
- `isSyncUnlocked(syncId)` → `playlist_syncs.tier === 'unlocked'`.
- `accountPlan(userId)` → active `account_subscriptions` row, else `free`.
- A Curator account implicitly unlocks its own syncs/events (resolve account
  plan first, then fall back to per-resource flags).

---

## Enforcement points (the gates)

| Gate | Where | Rule |
|---|---|---|
| Event guest cap | event track-add route (`apps/api/src/events/routes.ts`) | block adds past cap unless `tier !== 'free'` |
| Event "Made with Synqit" badge | guest page render | shown when `tier === 'free'` |
| Event keepsake (export/recap/PDF) | new keepsake routes | require paid tier |
| Sync subscriber cap | import/subscribe route (`apps/api/src/syncs/routes.ts`) | block new import past `FREE_SYNC_SUBSCRIBER_CAP` unless unlocked/curator |
| Sync expiry/pause | `syncsStore.listSyncsForAutoSync` (`apps/api/src/syncs/store.ts`) | exclude syncs past `expires_at` unless unlocked/curator |
| Curator features | mirroring/analytics/channel routes | require active Curator sub |

---

## Schedulers (reuse the recap pattern)

All three reuse `notificationRunsStore.claimPeriod` + the
`startWeeklyRecapScheduler` shape, wired in `apps/api/src/index.ts`:

1. **Event retention purge.** Daily. Soft-expire free events past `expires_at`
   (lock the page), then hard-delete after a grace window; set `purged_at`.
   `expires_at` anchor = `event_date` if set, else `closed_at`, else
   `updated_at` + inactivity window; + ~30d.
2. **Sync expiry/pause.** Daily. Set/refresh `expires_at` for free syncs; the
   auto-sync gate skips paused ones.
3. **Expiry-warning emails.** Daily. "Your keepsake expires in 7 days — keep it
   forever" via the `notifications` queue + a new template. Conversion driver.

---

## Retention / purge semantics (critical)

- **Purge deletes only Synqit-side data**: the event record, `event_tracks`
  history, follows/visits, recap page, magic link.
- **Never touch the host's provider playlist** — it lives in their Spotify/Apple
  and is theirs.
- Flow: **soft-expire → warning email → hard-delete after grace**. One-click
  "keep it forever" upgrade in the email and on the locked page.
- This is a trust/data surface — copy must say plainly that the playlist stays.

---

## Migration & grandfathering

- Synced playlists are **free and unlimited today**. Introducing a cap + expiry
  is a takeaway. Grandfather existing syncs (`tier = 'unlocked'` on migration)
  or communicate clearly. Keep the cap generous to protect the signup loop.
- Default all existing events to `tier = 'free'` with `expires_at = null`
  (no retroactive purge of historical events without explicit comms).

---

## Curator mirroring — design spike (build last)

Different shape from today's "subscribers pull into their own account." Mirroring
= the **curator connects their own Spotify + Apple**, and Synqit maintains a
public, followable playlist on **each**, kept in lockstep with the source.

Open questions for the spike:
- Source of truth: one source playlist → write-through to both providers.
- Reuse `auto-sync` add-only engine, extended to N targets owned by the curator.
- Channel page (`/c/:slug`) + per-platform follow links + analytics aggregation
  (reuse `playlist_sync_track_activity` + import data).
- Provider limits/rate limits at curator scale.

Do not start this until 3–5 design-partner stations validate the need.

---

## Build phases

1. Stripe account + products/prices; `stripe_customer_id`; webhook endpoint +
   signature verification; `payments` + entitlement tables/flags; entitlements
   helper.
2. **Event keepsake**: tiers, Checkout, keepsake routes (export/recap/PDF),
   retention purge + warning email, guest-cap + badge gates.
3. **Sync unlock**: Checkout, cap + expiry gates, branded page + basic stats.
4. **Curator**: subscription Checkout, account entitlement, then the mirroring
   spike → engine, channel page, analytics, seats.

## Open decisions

- Final prices (placeholders in the pricing doc).
- Exact free caps (event guest cap, sync subscriber cap) and free-sync lifetime.
- Hard-delete grace window length after soft-expire.
