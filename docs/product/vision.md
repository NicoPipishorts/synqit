Perfect. Let’s start clean and strategic.

Below is a Vision document designed specifically for:
• Giving an agent product direction
• Preventing architectural drift
• Anchoring long-term decisions
• Avoiding tech-specific bias

You can drop this into:

/docs/product/vision.md

⸻

Vision — Cross-Platform Playlist Sync & Event Collaboration

1. Product Purpose

This product exists to remove friction between music streaming platforms and make collaborative music curation effortless.

It allows users to:
• Sync playlists across different streaming providers.
• Create collaborative event playlists that feed directly into their own streaming account.
• Share playlists across ecosystems without manual rebuilding.
• Collect song contributions from guests in a seamless and provider-agnostic way.

The system acts as a coordination and synchronization layer — not a streaming service.

⸻

2. Core Philosophy

The product does not replace streaming platforms.

It enhances them.

Music playback always happens inside:
• Spotify
• Apple Music
• Deezer
• Other supported providers

The product orchestrates:
• Playlist creation
• Track matching
• Cross-provider synchronization
• Guest collaboration
• Controlled access via magic links

It never streams or stores music files.

⸻

3. Problem Statement

Modern music streaming ecosystems are fragmented.

Users face the following problems:
• Friends use different streaming providers.
• Playlists cannot easily be shared across platforms.
• Event hosts must manually collect song suggestions.
• Collaborative playlists are limited to users on the same provider.
• Migrating playlists between services is tedious.

There is no neutral bridge between streaming ecosystems.

This product becomes that bridge.

⸻

4. Core Value Propositions

4.1 Cross-Platform Freedom

Users are no longer restricted by streaming platform boundaries.

A Spotify user can:
• Share with an Apple Music user.
• Collaborate with a Deezer user.
• Host an event without forcing guests to switch services.

⸻

4.2 Frictionless Event Collaboration

Hosts can:
• Create an event playlist.
• Share a simple magic link.
• Allow guests to search within their own provider.
• Collect songs directly into their own streaming account.

Guests:
• Do not need the same provider.
• Do not need direct access to the host’s account.
• Can contribute easily and securely.

⸻

4.3 Seamless Playlist Migration

Users can:
• Move playlists between providers.
• Mirror playlists.
• Potentially keep them in sync.

⸻

5. Primary Use Cases

5.1 Playlist Transfer

A user wants to:
• Move a playlist from Apple Music to Spotify.
• Share a playlist across ecosystems.
• Migrate their music library.

⸻

5.2 Party / Event Playlist (Primary Feature)

A host wants to:
• Create a collaborative playlist for an event.
• Let guests contribute songs.
• Play music from their own streaming app.
• Maintain full control over the playlist.

This is expected to become the primary monetization driver.

⸻

6. Product Boundaries

The product:
• Does not stream audio.
• Does not store copyrighted music.
• Does not bypass streaming provider rules.
• Does not attempt to replace native streaming apps.

It operates strictly within provider APIs and permissions.

⸻

7. User Roles

Host
• Connects streaming provider.
• Creates playlists or events.
• Generates magic links.
• Controls access and moderation.
• Plays music in their streaming app.

Guest
• Connects their own streaming provider.
• Searches within their provider.
• Contributes songs to host playlist.
• Does not gain direct account access.

⸻

8. Magic Link Model

Magic links are central to the experience.

They enable:
• Playlist sharing
• Event collaboration
• Controlled access
• Limited permissions
• Expiration and revocation

Magic links represent:
• A playlist
• An event
• A sync request

They do not expose sensitive information.

⸻

9. Long-Term Vision

Over time, the product may evolve into:
• A cross-platform music social layer.
• An event-based music collaboration platform.
• A universal playlist migration system.
• A version-controlled playlist management tool.
• A provider-agnostic music coordination ecosystem.

Native mobile applications may follow once the web product is validated.

⸻

10. Success Definition

The product is successful when:
• A host can create a party playlist in under 2 minutes.
• Guests can add songs in under 30 seconds.
• Cross-provider syncing feels seamless.
• Users trust the system.
• The product feels invisible — it just works.

⸻

11. Strategic Principle for Development

When building new features, always ask:
• Does this reduce friction?
• Does this preserve provider neutrality?
• Does this keep playback inside streaming apps?
• Does this respect ecosystem boundaries?
• Does this increase collaboration simplicity?

If not, reconsider the feature.

⸻

Summary

This product is:

A neutral playlist orchestration layer connecting fragmented music streaming ecosystems, enabling cross-platform sharing and event-based collaboration without ever streaming music itself.
