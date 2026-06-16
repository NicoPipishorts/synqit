# Synqit — Pricing & Positioning

_Spec for landing copy, the pricing page, and what's free vs paid. Prices below
are proposed defaults — tune before launch. Pairs with
[billing-entitlements.md](./billing-entitlements.md) (the technical design)._

_Last updated: 2026-06-16_

---

## Positioning

Synqit is **two products with one engine**. They are monetized differently and
should be marketed without giving them co-equal billing.

1. **Event playlists** — the wedge. Crowd-sourced playlists via a magic link;
   **guests need no account**. Monetized **transactionally** (pay per event).
2. **Synced / shared playlists** — share a playlist that subscribers follow
   across Spotify/Apple. Free for casual use (it's the signup growth loop), with
   a one-time per-playlist unlock, and a recurring tier for curators/radios.

### Hero focus: the party where everyone's the DJ

Lead with the **event** use case, not weddings specifically. Weddings usually
have a DJ who already owns the music — they're the *hardest* sell. The sweet
spot is **the big gathering with no DJ, where the crowd builds the vibe**:

- Milestone birthdays (30th/40th/50th), anniversaries, engagement parties
- Reunions, big house parties, office parties, NYE, leaving dos, baby showers
- Weddings as *one* listed use case (cocktail hour, guest requests, after-party)

Proposed hero direction (replaces the abstract "One link. Every playlist."):

> **For the party where everyone's the DJ.**
> Create a playlist, share one link, and let guests add songs from their phone —
> no app, no account. Works with Spotify and Apple Music.

Secondary line introduces sync as "and you can also share playlists that follow
you across platforms" — not a co-equal CTA.

### Copy problems to fix on the live site

- Hero is clever but unclear ("Every playlist" overclaims).
- Two products given equal weight → split CTA halves conversion focus.
- Features and Why sections overlap (cross-platform, native sync appear twice).
- "Everything you need, nothing you don't" is filler.
- No pricing, no social proof, no FAQ, no "who is this for."
- `docs/marketing-copy.md` is stale (says "Free MVP / sync coming soon") and is
  actually sharper/more event-first than the live site — reconcile them.

---

## Plans

### Events — one-time (pay when you host)

| | **Free** | **Party** (~€15) | **Celebration** (~€39) |
|---|---|---|---|
| Guest contributions via magic link | ✓ | ✓ | ✓ |
| Host moderation | ✓ | ✓ | ✓ |
| Guest cap | ~25 | unlimited | unlimited |
| "Made with Synqit" on guest page | shown | removed | removed |
| Co-hosts | — | — | ✓ |
| **Keepsake**: export final tracklist to a permanent playlist | — | ✓ | ✓ |
| **Keepsake**: shareable recap page (who added what, top contributors, date) | — | ✓ | ✓ |
| **Keepsake**: printable / PDF | — | — | ✓ |
| Retention of the Synqit recap/history | purged ~30d after event | forever | forever |

Rationale: keep a **real free tier** — the magic link is the acquisition engine
(every guest sees Synqit). Gate **scale and polish**, never access.

### Shared playlists — free + one-time unlock

| | **Free** | **Unlock** (~€5 one-time, per playlist) |
|---|---|---|
| Subscribers | capped (~25) | unlimited |
| Sync lifetime | pauses after ~30–60 days | no time limit |
| Public share page | basic | **branded page** |
| Subscriber stats | — | **basic stats** |

The unlock bundles a visible upgrade (page + stats), not just "raise a limit
nobody hits." Casual sharing stays generous on purpose — subscribers must create
a Synqit account to follow, so this is the growth loop; don't choke it.

### Curators / Radios — recurring (~€9–19/mo)

For radio stations, labels, podcasters, DJs, venues/brands (cafés, gyms, hotels,
gyms, churches) — anyone curating continuously for an audience.

> **Curate once. Synced everywhere. Your audience always has the latest.**

- **Multi-platform mirroring**: one source playlist maintained natively on both
  Spotify and Apple (a real, followable playlist on each), kept in sync.
- **Branded public channel page** (`synqit.fr/c/yourstation`) with per-platform
  follow buttons.
- **Subscriber & growth analytics** (over time, by platform, top tracks).
- Unlimited unlocked playlists, faster + bidirectional sync, multiple seats.
- Scheduled / "fresh weekly" auto updates (reuses the recap scheduler engine).

This is the only place a **subscription** belongs: continuous need, real budget.
It's B2B — validate with 3–5 design-partner stations before building mirroring.

---

## Pricing page layout

Two payment models must not share one table. Use a segmented toggle / two
clearly-labelled groups on `/pricing`, with a condensed teaser on the landing
that links to it.

- **"For your event"** (one-time): Free · Party · Celebration
- **"For sharing playlists"**: Free · Unlock (one-time) · Curators (monthly,
  annual discount)

Rules: ≤3 tiers per group, anchor the recommended one (2px accent border), one
CTA each, value metric visible.

---

## Retention policy (user-facing promise)

When a free event's Synqit recap expires, **only Synqit-side data is removed**
(event page, contributor history, recap). **The playlist itself stays in the
host's Spotify/Apple — it is never deleted.** Hosts get a "your keepsake expires
in 7 days — keep it forever" email with a one-click upgrade before anything is
removed. State this plainly in copy to avoid a trust problem.

---

## Sequencing

1. Lock this doc + prices.
2. Build the Stripe + entitlements foundation once (see billing doc).
3. Ship **event keepsake** first (clearest willingness-to-pay, self-serve).
4. Ship **sync unlock** (small, rides the same rails).
5. Ship **Curator** tier last, after design-partner validation.

## Out of scope (for now)

- Teams/orgs beyond curator seats.
- Marketplace / paid promotion of playlists.
- Per-event subscriptions (wrong mental model — events are one-time).
