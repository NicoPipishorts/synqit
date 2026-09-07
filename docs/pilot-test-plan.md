# Pilot test plan — validating the event wedge

_Goal: learn whether real guests, on both platforms, actually add songs through a magic link
without an account, and whether hosts feel in control. Five hosted gatherings, two weeks._

## What can and cannot be simulated

| Question                                                                                                    | Automated simulation                                                                            | Real pilot                  |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------- |
| Do the mechanics hold under a burst of guests (30 adds in a minute, duplicates, closed event, rate limits)? | Yes — API script with mocked providers, see `scripts/loadtest-api.mjs` and the regression suite | Not needed                  |
| Do Spotify and Apple hosts both get a correct native playlist?                                              | Partly — provider calls are real only with live tokens                                          | Yes                         |
| Do guests bother to open the link and add a song from their phone?                                          | No                                                                                              | **Yes — this is the wedge** |
| Do guests on the "other" platform contribute as much?                                                       | No                                                                                              | Yes                         |
| Does the host understand moderation, close, reopen?                                                         | No                                                                                              | Yes                         |
| Would a host pay for keepsake / no guest cap?                                                               | No                                                                                              | Yes, by asking              |

An automated "party simulation" is worth adding to the regression suite for confidence, but it
cannot answer the go-to-market question. Five real events can.

## Pilot design

- **Hosts:** 5, recruited personally. Mix: at least 2 Apple Music hosts, at least 2 Spotify hosts.
- **Events:** real gatherings of 8–40 people within the next two weeks (birthday, house party,
  office drinks, dinner). Not weddings.
- **What hosts get:** free use, a 10-minute onboarding call, and a promise of a 15-minute debrief.
- **What we measure per event** (from `analytics_events` + admin analytics; no extra tooling):

| Metric                                         | Source                                                                  | Green             | Yellow  | Red                |
| ---------------------------------------------- | ----------------------------------------------------------------------- | ----------------- | ------- | ------------------ |
| Guests who opened the link / invited guests    | `app_page_view` on `/playlist/:token` (unique sessions) vs host's count | ≥ 50%             | 25–50%  | < 25%              |
| Guests who added ≥ 1 track / guests who opened | `event_track_added` (or event tracks table) unique `addedBy` sessions   | ≥ 40%             | 20–40%  | < 20%              |
| Cross-platform share                           | tracks added by guests whose platform ≠ host's (ask in the guest sheet) | ≥ 25%             | 10–25%  | < 10%              |
| Time from link open to first add               | timestamps                                                              | < 60 s median     | 1–3 min | > 3 min            |
| Host moderation actions used                   | remove / close / reopen events                                          | ≥ 1 host used one | —       | none understood it |
| Failed adds / total adds                       | API error logs (`provider add track failed`)                            | < 2%              | 2–5%    | > 5%               |
| Host would pay for keepsake or no cap          | debrief question                                                        | ≥ 3 of 5          | 2       | ≤ 1                |

Decision rule: 5 green or yellow on the first three rows → keep building on the event wedge and
start the keepsake payment work. Two reds on the first three rows → the problem is discovery or
motivation, not features; fix the guest page before adding anything.

## Timeline

1. **Day 0–2** — recruit hosts, create their accounts (invite-only), 10-minute call using the
   host guide below. Confirm the event date.
2. **Event day** — host shares the link 24 h before and again at the door. We do nothing.
3. **Day after** — pull the metrics above per event; send the guest sheet link to the host to
   forward.
4. **Within 3 days** — 15-minute host debrief using the questions below.
5. **Day 14** — write up the five events in one page and decide.

## Host guide (give to each host)

**Before the party**

1. Log in at the app, connect Spotify or Apple Music (whichever you actually play music from).
2. Create a playlist for the event. Name it after the party.
3. Copy the magic link. Send it to your guests the day before with one line:
   "Add the songs you want to hear on Saturday, no app needed: <link>". Put the same link or its
   QR code somewhere visible at the party.
4. Add 3–5 songs yourself so the playlist is not empty when guests arrive.

**During the party**

5. Play the playlist from your own Spotify or Apple Music app as usual. New songs appear there.
6. If something inappropriate lands, remove it from the event page. If you want to freeze the
   list, close the event; you can reopen it.

**After the party**

7. Keep the playlist; it stays in your Spotify or Apple Music.
8. Forward the guest sheet link to your guests (2 minutes for them).
9. Book the 15-minute debrief with us.

**If something breaks:** screenshot it and message us; do not fight it during the party. Play
music from your app directly.

## Guest sheet (2 minutes, sent by the host after the party)

Ask these as a short form (Google Form or Tally is fine); keep it anonymous.

1. Did you open the link the host sent? (yes / no / did not see it)
2. Did you add at least one song? (yes / no)
3. If no, why? (did not feel like it / did not find my song / it did not work / other)
4. Which service do you personally use? (Spotify / Apple Music / YouTube Music / Deezer / other / none)
5. Was adding a song easy? (1 = confusing, 5 = obvious)
6. Would you use this at your own party? (yes / maybe / no)
7. One thing you would change (free text).

## Host debrief (15 minutes, by call)

1. Walk me through the party: when did guests add songs, and did you notice?
2. Did you remove or close anything? Why or why not?
3. Which guests did not add anything, and what do you think stopped them?
4. Would you pay €15 for unlimited guests plus a recap page of who added what? What about €39
   with co-hosts and a printable keepsake? (Watch the hesitation, not the yes.)
5. What would make you host with this again next time without being asked?

## Recording results

Create one row per event in `docs/pilot-results.md` (create it after the first event):
host platform, guest count, link opens, guests who added, cross-platform adds, failed adds,
moderation used, willingness to pay, top quote. Decide on day 14 from those five rows.
