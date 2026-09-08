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
| `Tidal.png`        | TIDAL         | Official TIDAL icon (brand kit `icon-black-cmyk`)               |

`Deezer.png` and `YouTubeMusic.png` were trimmed of their transparent margin and
resampled to a 256×256 square, as was `Tidal.png`, so they all sit at the same
visual weight in a row.
The originals are unmodified in shape and colour.

`Tidal.png` is the only monochrome mark here. TIDAL ships the same shape in black
and in white, and picking either one would hide it on half our surfaces: the
compatibility strip inverts against the page theme, so a black mark disappears on
it in light mode and a white one disappears in dark mode. `ServiceLogo` renders
this mark as a CSS mask filled with `currentColor` instead, so it always takes the
colour of the text beside it. Only the alpha channel is used, which is why one
file covers both. Any future single-colour mark should join `MONOCHROME_MARKS`.

The marketing site serves this same folder (`apps/site/vite.config.ts` points
`publicDir` at `apps/web/public`), so one copy covers both.

Rendered through `ServiceLogo` in `@synqit/ui`, which is the only place these
paths appear.
