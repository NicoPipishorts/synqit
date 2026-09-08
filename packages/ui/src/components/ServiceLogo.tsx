import { cn } from '../utils/cn';

export type MusicServiceId = 'spotify' | 'apple' | 'tidal' | 'deezer' | 'youtube';

/**
 * How a music service reaches Synqit:
 * - `connect` — the listener links their account (OAuth). Synqit can then read
 *   and write playlists in their library: host events, keep a shared playlist
 *   in sync, and transfer in either direction.
 * - `link` — a public playlist URL read anonymously. One-way import only; the
 *   listener never signs in to that service.
 */
export type MusicServiceAccess = 'connect' | 'link';

export type MusicService = {
  id: MusicServiceId;
  name: string;
  access: MusicServiceAccess;
};

export const MUSIC_SERVICES: Record<MusicServiceId, MusicService> = {
  spotify: { id: 'spotify', name: 'Spotify', access: 'connect' },
  apple: { id: 'apple', name: 'Apple Music', access: 'connect' },
  tidal: { id: 'tidal', name: 'TIDAL', access: 'connect' },
  deezer: { id: 'deezer', name: 'Deezer', access: 'link' },
  youtube: { id: 'youtube', name: 'YouTube Music', access: 'link' },
};

/**
 * Services a listener signs in to, in the order the UI offers them. TIDAL is deliberately
 * absent: the API supports it, but we have no official TIDAL brand mark yet, so showing it
 * would render a missing image. Add it here once `Tidal.png` lands in the apps' public assets.
 */
export const CONNECT_SERVICES: readonly MusicService[] = [
  MUSIC_SERVICES.spotify,
  MUSIC_SERVICES.apple,
];

/** Services that arrive as a pasted public playlist link. */
export const LINK_SERVICES: readonly MusicService[] = [
  MUSIC_SERVICES.deezer,
  MUSIC_SERVICES.youtube,
];

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
 * Path to a service's brand mark, for the rare place that needs its own `<img>` styling
 * (the profile connection cards crop to a bordered circle). Prefer `ServiceLogo` otherwise.
 */
export const getServiceMarkSrc = (service: MusicServiceId): string => MARK_SRC[service];

export type ServiceLogoProps = {
  service: MusicServiceId;
  className?: string;
  /** Accessible name. Pass `""` when a neighbouring label already names the service. */
  alt?: string;
};

/** Square service mark at a consistent size and corner radius across all four services. */
export const ServiceLogo = ({ service, className, alt }: ServiceLogoProps) => (
  <img
    src={MARK_SRC[service]}
    alt={alt ?? MUSIC_SERVICES[service].name}
    className={cn('inline-block h-8 w-8 shrink-0 object-contain', className)}
    loading="lazy"
    decoding="async"
  />
);

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
