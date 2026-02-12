Perfect. Below is a clean, structured features-overview.md designed specifically for an agent to reason about features modularly.

This file describes what the system can do, grouped by feature domains, without implementation details.

You can place this in:

/docs/product/features-overview.md

⸻

Features Overview — Cross-Platform Playlist Sync & Event Collaboration

Overview

This document defines the major functional feature groups of the product.

Features are organized into domains so development can proceed modularly.

This is not an MVP limitation document.
This is a complete functional overview of the product capabilities.

⸻

1. Account & Identity Features

1.1 User Accounts
• Email-based account registration
• Login and logout
• Persistent session handling
• Account settings management

1.2 Streaming Provider Connections

Users can:
• Connect one or more streaming providers
• Disconnect providers
• View connected provider status
• Refresh provider authorization

Supported providers (initially):
• Spotify
• Apple Music
• Deezer (future expansion)

Each provider connection is isolated and permission-scoped.

⸻

2. Playlist Management Features

2.1 Playlist Import

Users can:
• Import playlists from connected streaming providers
• View playlists inside the app
• Select playlists for sync or sharing

2.2 Playlist Creation

Users can:
• Create new playlists inside the app
• Choose which provider owns the playlist
• Automatically create the playlist in that provider
• Edit playlist metadata (name, description)

2.3 Playlist Visibility

Users can:
• Keep playlists private
• Share via magic link
• Revoke access

⸻

3. Cross-Provider Playlist Sync

3.1 One-Time Sync

User can:
• Select a playlist
• Generate a magic link
• Allow another user to mirror the playlist
• Create equivalent playlist in recipient’s provider

3.2 Track Matching

System:
• Matches tracks across providers
• Uses metadata matching (title, artist, album, duration)
• Handles unmatched tracks gracefully

3.3 Sync Result Handling

User can:
• See which tracks matched
• See which failed
• Retry sync if needed

3.4 (Future) Continuous Sync
• Keep two playlists aligned over time
• Detect changes
• Reconcile differences

⸻

4. Party / Event Playlist Feature (Primary Feature)

4.1 Event Creation

Host can:
• Create a new event playlist
• Assign name and description
• Choose streaming provider
• Set optional expiration
• Configure contribution rules

4.2 Magic Link Generation

Host can:
• Generate shareable link
• Define access scope
• Revoke link
• Regenerate link

4.3 Guest Contribution Flow

Guest can:
• Open event link
• Connect streaming provider
• Search within their provider
• Add songs to event playlist

4.4 Cross-Provider Track Resolution

System:
• Converts guest track selection into host provider equivalent
• Adds track to host playlist
• Maintains correct ordering

4.5 Host Controls

Host can:
• See contributor list
• See which guest added which track
• Remove tracks
• Lock playlist
• Pause contributions
• End event

⸻

5. Magic Link System

Magic links support multiple contexts:
• Playlist sync
• Event collaboration
• Future: read-only playlist sharing

Magic links:
• Represent specific resource
• Have limited scope
• Can expire
• Can be revoked
• Do not expose credentials

⸻

6. Search & Discovery

6.1 Provider-Based Search

Guest searches:
• Inside their own streaming provider
• Using real track catalog
• With live search results

6.2 Track Metadata Display

Each search result shows:
• Track title
• Artist
• Album
• Duration
• Artwork

⸻

7. Event Moderation & Controls

Host moderation features:
• Remove inappropriate tracks
• Prevent duplicate tracks
• Limit number of tracks per guest
• Close event early
• See contribution analytics (future premium)

⸻

8. Contribution Tracking

System tracks:
• Who added which track
• When track was added
• Event contribution history
• Total contributions per user

This enables:
• Transparency
• Moderation
• Analytics

⸻

9. Playlist State & Sync Tracking

Users can:
• View sync status
• View event status
• See processing states
• See failed matches

System supports:
• Async operations
• Status updates
• Retry handling

⸻

10. User Experience Features

10.1 Frictionless Onboarding
• Minimal account friction
• Provider login immediately available
• Clear call-to-action for events

10.2 Fast Contribution Flow

Goal:
• Guest adds song in under 30 seconds

10.3 Mobile-Friendly Web Experience
• Fully responsive
• Optimized for sharing via messaging apps

⸻

11. Monetization-Oriented Features

Free Tier:
• Limited events
• Limited sync actions
• Basic functionality

Premium Tier:
• Unlimited events
• Continuous sync
• Advanced moderation
• Analytics dashboard
• Playlist version history

⸻

12. Future Feature Domains

Potential expansions:
• Scheduled sync
• Event templates
• Playlist version control
• Voting system for tracks
• Event live mode
• Native mobile apps
• Cross-event analytics

⸻

System Summary

The product consists of four primary functional pillars: 1. Account & Provider Connection 2. Cross-Provider Playlist Sync 3. Event-Based Collaborative Playlist Creation 4. Magic Link Sharing System

All features operate without streaming music directly and always defer playback to native streaming apps.
