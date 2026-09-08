import { cn } from '../utils/cn';

export type MusicServiceId = 'spotify' | 'apple' | 'deezer' | 'youtube';

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
  deezer: { id: 'deezer', name: 'Deezer', access: 'link' },
  youtube: { id: 'youtube', name: 'YouTube Music', access: 'link' },
};

/** Services a listener signs in to. */
export const CONNECT_SERVICES: readonly MusicService[] = [
  MUSIC_SERVICES.spotify,
  MUSIC_SERVICES.apple,
];

/** Services that arrive as a pasted public playlist link. */
export const LINK_SERVICES: readonly MusicService[] = [
  MUSIC_SERVICES.deezer,
  MUSIC_SERVICES.youtube,
];

// Spotify and Apple Music ship their official marks in the app's public assets.
const OFFICIAL_MARK_SRC: Partial<Record<MusicServiceId, string>> = {
  spotify: '/assets/logos/Providers/Spotify.png',
  apple: '/assets/logos/Providers/AppleMusic.png',
};

// Deezer and YouTube Music are drawn in-house: simplified marks that carry the
// brand colour and silhouette. Replace them with the official brand files once
// their guidelines have been reviewed.
const DeezerMark = () => (
  <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true" focusable="false">
    <rect width="24" height="24" rx="6" fill="#A238FF" />
    {(
      [
        { x: 3, bars: 1 },
        { x: 8, bars: 3 },
        { x: 13, bars: 2 },
        { x: 18, bars: 4 },
      ] as const
    ).flatMap(({ x, bars }) =>
      Array.from({ length: bars }, (_, index) => (
        <rect
          key={`${x}-${index}`}
          x={x}
          y={15.8 - index * 3.2}
          width="3"
          height="2"
          rx="0.5"
          fill="#ffffff"
        />
      )),
    )}
  </svg>
);

const YouTubeMusicMark = () => (
  <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="11" fill="#FF0033" />
    <path d="M9.6 7.9 16.4 12l-6.8 4.1z" fill="#ffffff" />
  </svg>
);

export type ServiceLogoProps = {
  service: MusicServiceId;
  className?: string;
  /** Accessible name. Pass `""` when a neighbouring label already names the service. */
  alt?: string;
};

/** Square service mark at a consistent size and corner radius across all four services. */
export const ServiceLogo = ({ service, className, alt }: ServiceLogoProps) => {
  const meta = MUSIC_SERVICES[service];
  const label = alt ?? meta.name;
  const officialSrc = OFFICIAL_MARK_SRC[service];
  const shape = cn('inline-block h-8 w-8 shrink-0 overflow-hidden rounded-xl', className);

  if (officialSrc) {
    return (
      <img
        src={officialSrc}
        alt={label}
        className={cn(shape, 'object-contain')}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <span
      className={shape}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {service === 'deezer' ? <DeezerMark /> : <YouTubeMusicMark />}
    </span>
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
