type SyncTrackLike = {
  name: string;
  artist: string;
  album?: string | null;
  durationMs?: number;
};

const normalizeTrackPart = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const buildTrackFingerprint = (track: SyncTrackLike): string => {
  const name = normalizeTrackPart(track.name);
  const artist = normalizeTrackPart(track.artist.split(',')[0] ?? track.artist);
  const durationBucket = Math.round((track.durationMs ?? 0) / 2000);
  return `${name}|${artist}|${durationBucket}`;
};

export const buildTrackIdentityKey = (track: Pick<SyncTrackLike, 'name' | 'artist' | 'album'>) => {
  const name = normalizeTrackPart(track.name);
  const artist = normalizeTrackPart(track.artist.split(',')[0] ?? track.artist);
  const album = normalizeTrackPart(track.album ?? '');
  return `${name}|${artist}|${album}`;
};
