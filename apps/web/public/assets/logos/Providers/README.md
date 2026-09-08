# Streaming service marks

Third-party trademarks, used to identify the services Synqit interoperates with.
They are not Synqit brand assets: do not restyle, recolour, or place them on a
background their owner's guidelines forbid.

| File               | Service       | Source                                                          |
| ------------------ | ------------- | --------------------------------------------------------------- |
| `Spotify.png`      | Spotify       | Spotify brand assets                                            |
| `AppleMusic.png`   | Apple Music   | Apple Music identity guidelines                                 |
| `Deezer.png`       | Deezer        | Purple heart from the Deezer brand guidelines (deezerbrand.com) |
| `YouTubeMusic.png` | YouTube Music | Official YouTube Music logo (Wikimedia Commons)                 |
| `Tidal.png`        | TIDAL         | **Missing.** Needed before TIDAL can appear in the UI.          |

`Deezer.png` and `YouTubeMusic.png` were trimmed of their transparent margin and
resampled to a 256×256 square so all four sit at the same visual weight in a row.
The originals are unmodified in shape and colour.

TIDAL works end to end in the API, but it is deliberately left out of
`CONNECT_SERVICES` so no surface renders a missing image. Drop an official mark
here as `Tidal.png`, trimmed and resampled to match the others, then add
`MUSIC_SERVICES.tidal` to `CONNECT_SERVICES` in `packages/ui`.

The marketing site serves this same folder (`apps/site/vite.config.ts` points
`publicDir` at `apps/web/public`), so one copy covers both.

Rendered through `ServiceLogo` in `@synqit/ui`, which is the only place these
paths appear.
