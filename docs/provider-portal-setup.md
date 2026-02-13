# Provider Portal Setup

This guide maps Spotify and Apple Developer portal setup to the current Synqit codebase.

## Current code status

- Spotify provider connect is implemented in API routes.
- Apple provider connect is not implemented yet (prep steps only for now).

---

## Spotify Developer Portal Setup (works with current code)

Portal: <https://developer.spotify.com/dashboard>

1. Create app

- Open the Spotify Dashboard and create a new app.
- Keep app type as Web API usage.

2. Configure redirect URI

- In app settings, add this redirect URI exactly:
- `http://127.0.0.1:3001/v1/auth/spotify/callback`
- Save settings.

3. Collect credentials

- Copy `Client ID`.
- Copy `Client secret`.

4. Development access users

- If app is in development mode, add your Spotify account(s) as allowed test users in the dashboard so login/consent works during local testing.

5. Configure local env

- In `apps/api/.env`, set:
- `SPOTIFY_CLIENT_ID=...`
- `SPOTIFY_CLIENT_SECRET=...`
- `SPOTIFY_REDIRECT_URI=http://127.0.0.1:3001/v1/auth/spotify/callback`
- `SPOTIFY_SCOPES=playlist-read-private playlist-modify-private playlist-modify-public`
- `SPOTIFY_AUTH_BASE_URL=https://accounts.spotify.com/authorize`
- `SPOTIFY_TOKEN_URL=https://accounts.spotify.com/api/token`
- `WEB_APP_URL=http://127.0.0.1:5173`
- `TOKEN_ENC_KEY=<strong-random-secret>`

6. Verify in app

- Start app (`yarn dev`).
- Login in web app.
- Go to `/providers`.
- Click `Start Spotify OAuth`.
- Open authorize URL, approve access.
- You should be redirected automatically to `/providers`.
- Confirm status shows `connected` (or click `Load status`).

---

## Apple Developer Portal Setup (prep for upcoming implementation)

Portals:

- Apple Developer account: <https://developer.apple.com/account/>
- Apple Music API docs: <https://developer.apple.com/documentation/applemusicapi>
- MusicKit JS docs: <https://developer.apple.com/documentation/musickitjs>

1. Ensure account readiness

- You need an active Apple Developer Program membership.

2. Create MusicKit identifier

- In Certificates, Identifiers & Profiles, create a new identifier for MusicKit usage.

3. Create MusicKit key

- In Keys, create a new key with MusicKit enabled.
- Associate it with your MusicKit identifier.
- Download the `.p8` file when generated (Apple only lets you download it once).

4. Record required values

- Team ID.
- Key ID.
- MusicKit Identifier.
- Downloaded `.p8` private key file.

5. Plan for Synqit env (next implementation step)

- We will add env variables like:
- `APPLE_TEAM_ID`
- `APPLE_KEY_ID`
- `APPLE_MUSICKIT_IDENTIFIER`
- `APPLE_PRIVATE_KEY_P8`

When we implement Apple auth, these will be used to generate Apple developer tokens server-side and complete Apple Music connection flows.
