import { cn } from '../utils/cn';

export type MusicServiceId = 'spotify' | 'apple' | 'tidal' | 'deezer' | 'youtube';

/**
 * How a music service reaches Synqit:
 * - `connect` — the listener links their account (OAuth). Synqit can then read
 *   and write playlists in their library: host events, keep a shared playlist
 *   in sync, and transfer in either direction.
 * - `link` — a public playlist URL read anonymously. One-way import only; the
 *   listener never signs in to that service.
 * A service can offer both: YouTube Music connects, and a public YouTube
 * playlist link still imports without signing in.
 */
export type MusicServiceAccess = 'connect' | 'link';

export type MusicService = {
  id: MusicServiceId;
  name: string;
  access: readonly MusicServiceAccess[];
};

export const MUSIC_SERVICES: Record<MusicServiceId, MusicService> = {
  spotify: { id: 'spotify', name: 'Spotify', access: ['connect'] },
  apple: { id: 'apple', name: 'Apple Music', access: ['connect'] },
  tidal: { id: 'tidal', name: 'TIDAL', access: ['connect'] },
  deezer: { id: 'deezer', name: 'Deezer', access: ['link'] },
  youtube: { id: 'youtube', name: 'YouTube Music', access: ['connect', 'link'] },
};

/** Services a listener signs in to, in the order the UI offers them. */
export const CONNECT_SERVICES: readonly MusicService[] = [
  MUSIC_SERVICES.spotify,
  MUSIC_SERVICES.apple,
  MUSIC_SERVICES.tidal,
  MUSIC_SERVICES.youtube,
];

/** Services that arrive as a pasted public playlist link. */
export const LINK_SERVICES: readonly MusicService[] = [
  MUSIC_SERVICES.deezer,
  MUSIC_SERVICES.youtube,
];

/** Link services that cannot also be connected; what a "link" column adds beyond "connect". */
export const LINK_ONLY_SERVICES: readonly MusicService[] = LINK_SERVICES.filter(
  (service) => !service.access.includes('connect'),
);

/** Every service once, connectable ones first, for strips and footers that just show marks. */
export const ALL_SERVICES: readonly MusicService[] = [...CONNECT_SERVICES, ...LINK_ONLY_SERVICES];

// Official brand marks, served from the app's public assets. Spotify and Apple
// Music ship their icon; Deezer is the purple heart from its brand guidelines
// and YouTube Music is its official mark, both trimmed to the same square.
const MARK_SRC: Record<MusicServiceId, string> = {
  spotify: '/assets/logos/Providers/Spotify.png',
  apple: '/assets/logos/Providers/AppleMusic.png',
  tidal: '/assets/logos/Providers/Tidal.png',
  deezer: '/assets/logos/Providers/Deezer.png',
  youtube: '/assets/logos/Providers/YouTubeMusic.png',
};

/**
 * Marks that carry no colour of their own. TIDAL ships a black and a white version of the
 * same shape, so instead of picking one we paint it with the surrounding text colour. That
 * keeps it legible on the light page, in dark mode, and on the compatibility strip, which
 * inverts against the theme and would have hidden a fixed black or white mark on one of them.
 */
const MONOCHROME_MARKS: ReadonlySet<MusicServiceId> = new Set(['tidal']);

/**
 * Path to a service's brand mark, for the rare place that needs its own `<img>` styling
 * (the profile connection cards crop to a bordered circle). Prefer `ServiceLogo` otherwise.
 */
export const getServiceMarkSrc = (service: MusicServiceId): string => MARK_SRC[service];

/** True when the mark takes its colour from the surrounding text rather than its own file. */
export const isMonochromeServiceMark = (service: MusicServiceId): boolean =>
  MONOCHROME_MARKS.has(service);

export type ServiceLogoProps = {
  service: MusicServiceId;
  className?: string;
  /** Accessible name. Pass `""` when a neighbouring label already names the service. */
  alt?: string;
};

/** Square service mark at a consistent size across every service. */
export const ServiceLogo = ({ service, className, alt }: ServiceLogoProps) => {
  const label = alt ?? MUSIC_SERVICES[service].name;

  if (MONOCHROME_MARKS.has(service)) {
    // Masked rather than drawn, so `bg-current` gives it the surrounding text colour.
    return (
      <span
        role={label ? 'img' : undefined}
        aria-label={label || undefined}
        aria-hidden={label ? undefined : true}
        className={cn('inline-block h-8 w-8 shrink-0 bg-current', className)}
        style={{
          maskImage: `url("${MARK_SRC[service]}")`,
          WebkitMaskImage: `url("${MARK_SRC[service]}")`,
          maskSize: 'contain',
          WebkitMaskSize: 'contain',
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
          maskPosition: 'center',
          WebkitMaskPosition: 'center',
        }}
      />
    );
  }

  return (
    <img
      src={MARK_SRC[service]}
      alt={label}
      className={cn('inline-block h-8 w-8 shrink-0 object-contain', className)}
      loading="lazy"
      decoding="async"
    />
  );
};

export type ServiceChipProps = {
  service: MusicServiceId;
  /** Short qualifier under the name, e.g. "matches track for track". */
  note?: string;
  /** Dims the chip for a service that is not available yet. */
  muted?: boolean;
  className?: string;
};

/** Logo plus service name in a bordered pill; the unit repeated across service lists. */
export const ServiceChip = ({ service, note, muted = false, className }: ServiceChipProps) => (
  <span
    className={cn(
      'inline-flex items-center gap-2.5 rounded-2xl border border-app-border bg-app-elevated px-3 py-2 dark:bg-app-card',
      muted && 'opacity-55',
      className,
    )}
  >
    <ServiceLogo service={service} alt="" className="h-7 w-7" />
    <span className="grid">
      <span className="text-sm font-black leading-tight text-app-text">
        {MUSIC_SERVICES[service].name}
      </span>
      {note ? <span className="text-xs leading-tight text-app-text-secondary">{note}</span> : null}
    </span>
  </span>
);
