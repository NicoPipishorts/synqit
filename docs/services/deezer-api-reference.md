# Deezer API Reference --- Synqit Integration

## Purpose

This document consolidates all relevant Deezer API documentation
required to implement:

- Host provider connection (OAuth 2.0)
- Event playlist creation
- Guest search against host catalog
- Adding tracks to host playlist
- Removing tracks (Host control)
- Cross-provider playlist sync
- Future track reordering

This serves as the authoritative reference for Deezer integration.

---

# 1. Authentication --- OAuth 2.0

Deezer supports: - Server-side OAuth flow (recommended) - Client-side
OAuth flow

Synqit must use **server-side flow**.

## Authorization Endpoint

https://connect.deezer.com/oauth/auth.php

Required parameters:

- app_id (required)
- redirect_uri (required)
- perms (optional, default: basic_access)

Recommended permissions for Synqit:

- basic_access
- manage_library
- offline_access

---

## Access Token Exchange

https://connect.deezer.com/oauth/access_token.php

Required parameters:

- app_id
- secret
- code

If `offline_access` is requested: - expires = 0 (non-expiring token)

---

# 2. Required Permissions for Synqit

- basic_access → Basic profile access
- manage_library → Create playlists, add/remove tracks
- offline_access → Prevent token expiration during events

---

# 3. Playlist Endpoints

## Create Playlist

POST user/{user_id}/playlists?request_method=POST

Permission required: manage_library\
Required parameter: title

---

## Add Track(s) to Playlist

POST playlist/{playlist_id}/tracks?request_method=POST

Permission required: manage_library\
Required parameter: songs (comma-separated track IDs)

Example: songs=12345,67890

---

## Remove Track(s) from Playlist

DELETE playlist/{playlist_id}/tracks?request_method=DELETE

Permissions required: - manage_library - delete_library

Required parameter: - songs (comma-separated track IDs)

---

## Retrieve Playlist

GET https://api.deezer.com/playlist/{playlist_id}

Returns: - title - description - creator - public - collaborative -
nb_tracks - tracks (list of track objects)

---

# 4. Search API

## Basic Search

GET https://api.deezer.com/search?q={query}

Optional parameters: - strict=on -
order=RANKING\|TRACK_ASC\|TRACK_DESC\|...

---

## Advanced Search

Supports:

- artist:"..."
- album:"..."
- track:"..."
- dur_min
- dur_max
- bpm_min
- bpm_max

Example: https://api.deezer.com/search?q=artist:"eminem" track:"lose
yourself"

---

# 5. Synqit Feature Mapping

## Event Creation Flow

1.  Host completes OAuth.
2.  Store access_token.
3.  Create playlist: POST user/{user_id}/playlists
4.  Store playlist_id internally.

---

## Guest Quick Contribute

1.  Guest opens magic link.
2.  Backend performs search: GET search?q={query}
3.  When guest selects track: POST playlist/{playlist_id}/tracks

Guest does not authenticate with Deezer.

---

## Host Remove Track

DELETE playlist/{playlist_id}/tracks\
songs={track_id}

---

## Cross-Provider Sync

As Source: - GET playlist/{playlist_id}/tracks - Extract title, artist,
isrc

As Destination: - POST user/{user_id}/playlists - POST
playlist/{playlist_id}/tracks

---

# Conclusion

Deezer supports:

- OAuth authentication
- Offline access tokens
- Playlist creation
- Track addition and removal
- Search and advanced search
- Metadata extraction for cross-provider sync

Deezer integration is technically viable for Synqit MVP.
