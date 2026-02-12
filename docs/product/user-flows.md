Below is an agent-ready user-flows.md you can add at:

/docs/product/user-flows.md

⸻

User Flows — MVP (Host Events, Guest Contribution, Sync)

Purpose

This document describes the end-to-end user flows for the MVP.

It focuses on what users see and do, and what the system must accomplish at each step.

It is written to remove ambiguity for implementation.

⸻

Definitions

Roles
• Host: registered user who creates an event playlist tied to their streaming provider.
• Guest: user who accesses an event via magic link.

Guest Modes
• Quick Contribute Mode (default): guest does not log in or connect a provider; they only search/add songs to the host playlist.
• Sync Mode (optional): guest logs in and connects a provider to import/mirror the event playlist to their own account.

Resources
• Event Playlist: playlist owned by the host in their provider.
• Magic Link: shareable link that opens a specific Event or Sync request.

⸻

Flow A — Host Onboarding (Account + Provider Connection)

Goal

Host can create events and playlists in their streaming provider.

Steps 1. Host opens app 2. Host selects “Create account”
• Inputs email + password 3. Host completes signup 4. Host is prompted to connect a provider
• Chooses: Spotify or Apple Music 5. Host completes provider login/authorization 6. Host lands on dashboard
• Sees provider status: “Connected”
• CTA: “Create Event Playlist”

Expected System Outcomes
• User account created
• Provider connection stored for host
• Host can proceed to create event playlists

Edge Cases
• Provider login fails → show retry + clear error
• Provider not connected → block event creation and prompt connect

⸻

Flow B — Host Creates an Event Playlist (Primary)

Goal

Host creates an event playlist tied to their provider and gets a shareable magic link.

Steps 1. Host clicks “Create Event Playlist” 2. Host enters:
• Event name (required)
• Optional description (optional, can be MVP optional) 3. Host clicks “Create” 4. App shows loading state: “Creating your playlist…” 5. Success state:
• Event created
• Playlist created in host provider 6. Host sees Event page with:
• Event title
• Magic link (copy button + share button)
• Event status: “Open”
• Track list (initially empty)
• Controls: “Close Event”, “Revoke Link” (or “Regenerate Link”)

Expected System Outcomes
• New event created in the system
• New playlist created in host provider
• Magic link generated and associated to this event

Edge Cases
• Provider API returns failure creating playlist → show error and allow retry
• Host provider disconnected mid-flow → prompt reconnect

⸻

Flow C — Guest Quick Contribute Mode (No Login)

Goal

Guest adds songs to host playlist with zero friction.

Entry Point

Guest opens the magic link received from host.

Steps 1. Guest opens magic link (mobile-first experience) 2. Guest sees Event page:
• Event name
• Optional description
• Search input with prompt: “Search songs to add”
• Track results list (empty initially) 3. Guest types a query in search field 4. System shows results from host provider catalog 5. Guest selects a track 6. Guest confirms add (either immediate add or “Add” button) 7. UI shows:
• Success toast: “Added to playlist”
• Track now appears in event track list 8. Guest can repeat to add more tracks

Expected System Outcomes
• Guest remains anonymous
• Search happens against host provider catalog
• Track is added to host provider playlist
• Track is appended to end of playlist order
• System stores the addition in event history

Guest UX Requirements
• Guest never sees a login wall
• Guest never needs a streaming provider
• Flow must be fast (search → add in seconds)

Edge Cases
• Event closed → guest sees “This event is closed” and can no longer add
• Track add fails (provider API) → show error + allow retry
• Duplicate track (same provider track ID already added) → show “Already in playlist”
• Rate limiting (if required) → show “Too many requests, try again”

⸻

Flow D — Host Manages Event Playlist

Goal

Host can see contributions, remove tracks, and close the event.

Steps 1. Host opens Event page 2. Host sees:
• Track list (with newest additions visible)
• Controls: Remove track, Close Event 3. Host removes a track
• UI updates immediately 4. Host closes event
• Event status becomes “Closed”
• Magic link still opens but contribution is disabled

Expected System Outcomes
• Track removed from host provider playlist
• Track removed from event list
• Closing event disables new contributions

Edge Cases
• Remove fails (provider API) → show error + retry
• Host provider disconnected → prompt reconnect

⸻

Flow E — Guest Sync Mode (Optional, Post-Contribution)

Goal

Guest imports/mirrors the event playlist into their own streaming provider.

Entry Point

Guest opens magic link, sees optional CTA: “Import this playlist to my provider”

Steps 1. Guest clicks “Import playlist to my provider” 2. Guest is prompted to:
• Create account / login 3. Guest connects a streaming provider (Spotify or Apple Music) 4. Guest confirms import 5. System creates a new playlist in guest’s provider containing event tracks 6. Guest sees success screen:
• “Playlist created in your [Provider]”
• Optional: “Open in [Provider]”

Expected System Outcomes
• Guest now has their own copy of the event playlist
• Copy remains separate from host playlist (MVP: one-time import only)

Edge Cases
• Some tracks not available in guest provider → show “X added, Y skipped”
• Provider connect fails → retry
• Import fails → retry and show error

⸻

Flow F — Cross-Provider Playlist Sync (One-Time Transfer)

Goal

Allow a user to transfer an existing playlist to a different provider via magic link.

Steps (Sender) 1. User (Sender) logs in 2. Sender connects provider (Spotify or Apple Music) 3. Sender views their playlists 4. Sender selects a playlist → clicks “Share to Sync” 5. App generates a sync magic link

Steps (Recipient) 1. Recipient opens sync link 2. Recipient is prompted to login/signup 3. Recipient connects their provider (Spotify or Apple Music) 4. Recipient clicks “Import playlist” 5. System attempts match and creates playlist in recipient provider 6. Recipient sees summary:
• Matched count
• Skipped count

Expected System Outcomes
• New playlist created in recipient provider
• Matching happens via metadata (title + artist)
• Sync is one-time only in MVP

Edge Cases
• Sender playlist changed after link created → MVP can snapshot at link creation or import latest (choose one later)
• Matching quality issues → show skipped list (optional)

⸻

Global UI Requirements (MVP)

Mobile-first

Most guests will arrive via messaging apps:
• Layout must be responsive
• Buttons must be thumb-friendly
• Share link must be easy to copy

Clear separation of guest modes

Event page should clearly show:
• Search/Add is immediate (no login)
• Import/Sync requires login (optional)

⸻

MVP Navigation Pages (Suggested)

Host-facing:
• Landing
• Signup/Login
• Provider Connect
• Dashboard
• Event Create
• Event Detail (host view)

Guest-facing:
• Event Detail (guest view)
• Optional: Login (only if guest wants import)
• Optional: Import confirmation / results

Sync:
• Playlist selector (sender)
• Sync link landing (recipient)
• Import results

⸻

Tracking / Analytics (Optional, MVP-light)

Track basic counters (for product validation):
• Events created
• Magic links opened
• Searches performed
• Tracks added
• Imports triggered
• Imports completed

No advanced analytics dashboard required in MVP.

⸻

Definition of Done for Flows

MVP is functionally complete when:
• Flow B + Flow C work reliably end-to-end for both Spotify-hosted and Apple-hosted events.
• Flow D works (remove + close event).
• Flow F works at least for Spotify ↔ Apple in a basic one-time transfer.
• Guests can always add songs without authentication.

⸻
