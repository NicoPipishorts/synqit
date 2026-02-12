MVP Scope — Version 1 (Final Revised)

Purpose

The MVP validates two core capabilities: 1. Event-based collaborative playlists (primary focus). 2. One-time cross-provider playlist sync (secondary validation).

The main goal is to prove that:
• Hosts can create event playlists.
• Guests can add songs frictionlessly without login.
• Songs appear in the host’s streaming app.
• Cross-provider sync works in a simple, one-time form.

The primary validation is the Event Playlist feature.

⸻

1. Supported Streaming Providers (MVP)

MVP supports:
• Spotify
• Apple Music

Provider connection rules:
• Hosts must connect one streaming provider.
• Users performing playlist sync must connect one streaming provider.
• Guests using Quick Contribute mode do NOT require an account or provider connection.

⸻

2. Core MVP Features

⸻

2.1 Account System (Hosts & Sync Users Only)

Included:
• Email + password registration
• Login / logout
• Basic session persistence

Not included:
• Social login
• Passwordless login
• Profile customization

Guests contributing to an event do NOT need accounts.

⸻

2.2 Streaming Provider Connection

Provider connection is required only for:
• Creating an event playlist (Host)
• Syncing playlists (Sender or Recipient)
• Importing playlists

Registered users can:
• Connect Spotify OR Apple Music
• Disconnect provider
• Reconnect provider

Guests contributing to an event do NOT connect any provider.

⸻

3. Event Playlist (Primary Feature)

3.1 Event Creation (Host)

Host can:
• Connect streaming provider
• Create event playlist
• Enter event name
• Automatically create playlist in their streaming account
• Generate magic link
• Revoke magic link
• Close event

Not included:
• Expiration rules
• Contribution limits
• Access tiers
• Templates
• Event analytics

⸻

3.2 Guest Contribution — Quick Contribute Mode (Default Event Experience)

This is the default and frictionless event experience.

Guest flow: 1. Guest opens magic link. 2. Guest sees:
• Event name
• Add song search field 3. Guest does NOT:
• Log in
• Create account
• Connect streaming provider

Search behavior:
• Searches against the HOST’S streaming provider catalog.
• If host uses Spotify → search Spotify catalog.
• If host uses Apple Music → search Apple Music catalog.

When guest selects a track:

System:
• Adds track directly to host’s playlist.
• Appends to end of playlist.
• Prevents exact duplicate track IDs.

Guest experience must be:
• Anonymous
• Instant
• Mobile-friendly
• Zero-friction

⸻

3.3 Guest Sync Mode (Optional Secondary Flow)

If a guest wants to:
• Import the event playlist into their own streaming provider
• Mirror the playlist

Then: 1. Guest creates account or logs in. 2. Guest connects streaming provider. 3. Guest selects “Import Playlist”. 4. System creates equivalent playlist in guest’s provider.

This flow is optional and separate from Quick Contribute mode.

⸻

4. Host Controls (MVP)

Host can:
• View all tracks added
• Remove tracks
• Close event (disable further additions)

Not included:
• Voting system
• Contributor analytics
• Advanced moderation
• Reordering inside app
• Approval workflows

⸻

5. Cross-Provider Playlist Sync (Secondary MVP Feature)

5.1 One-Time Playlist Transfer

Sender:
• Connects provider
• Selects playlist
• Generates sync link

Recipient:
• Connects their provider
• Confirms import

System:
• Matches tracks via basic metadata (title + artist)
• Creates equivalent playlist in recipient provider
• Skips unmatched tracks

Included:
• Basic metadata matching
• Matched/skipped count summary

Not included:
• Continuous sync
• Conflict resolution UI
• Advanced fuzzy matching
• Sync history dashboard

⸻

6. Magic Link System (MVP Simplified)

Magic links can represent:
• Event playlist
• Sync request

Magic links:
• Are unique per resource
• Can be revoked
• Do not expose credentials
• Do not require authentication for Quick Contribute mode

Not included:
• Expiration configuration
• Permission tiers
• Role assignment
• Public indexing

⸻

7. Explicitly Out of Scope

The following are NOT part of MVP:
• Multi-provider per user
• Continuous sync
• Playlist version history
• Voting system
• Track approval queue
• Contribution limits
• Event analytics
• Premium subscriptions
• Native apps
• Social features
• Scheduled sync
• AI matching enhancements

If not explicitly listed in “Included,” it is out of scope.

⸻

8. MVP Success Criteria

MVP is complete when:
• Host can register and connect Spotify or Apple Music.
• Host can create event playlist.
• Guest can add song without logging in.
• Song appears in host’s streaming app.
• Host can remove song.
• Host can close event.
• One-time Spotify ↔ Apple Music sync works.
• Flow feels fast, clear, and frictionless.

⸻

9. Core UX Principles

Event playlist must feel:
• Instant
• Frictionless
• Simple
• No forced login for guests

Sync feature must feel:
• Intentional
• Controlled
• Explicitly separate from event flow

⸻

10. Development Priority Order

Build in this order: 1. Host registration + provider connection 2. Event creation 3. Guest Quick Contribute mode 4. Host track management 5. Cross-provider sync

Do not build sync before event flow is fully functional.

⸻

Final MVP Definition

MVP is:

A Spotify and Apple Music–powered event playlist collaboration system with anonymous guest contribution and basic one-time cross-provider sync.

⸻

This version is:
• Clear for agents
• Architecturally aligned
• Scope-protected
• Friction-first
• Monetization-ready
