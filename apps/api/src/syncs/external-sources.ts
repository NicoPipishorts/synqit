import type { ExternalSourceKind, ExternalSourceTrack } from '@synqit/shared';

/**
 * Read-only access to public playlists on services Synqit does not connect to.
 * Used by the transfer funnel: paste a link, get the tracks, match them on the
 * user's Spotify or Apple Music. No user credentials are involved on the source
 * side, so nothing here can be banned or revoked.
 */

export type ExternalSourceErrorCode =
  | 'unsupported_url'
  | 'not_found'
  | 'private_playlist'
  | 'source_unavailable'
  | 'source_not_configured';

export class ExternalSourceError extends Error {
  readonly code: ExternalSourceErrorCode;
  readonly statusCode: number;

  constructor(code: ExternalSourceErrorCode, message: string, statusCode = 400) {
    super(message);
    this.name = 'ExternalSourceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export type ExternalSourceRef = { source: ExternalSourceKind; playlistId: string };

export type ExternalPlaylist = {
  source: ExternalSourceKind;
  playlistId: string;
  name: string;
  trackCount: number;
  coverImageUrl: string | null;
  tracks: ExternalSourceTrack[];
  /** True when the playlist has more tracks than `maxTracks` allowed. */
  truncated: boolean;
};

/** Swappable so the regression suite can serve fixtures instead of hitting the network. */
export const externalSourceHttp: { fetch: typeof fetch } = { fetch: (...args) => fetch(...args) };

const DEFAULT_MAX_TRACKS = 500;
const REQUEST_TIMEOUT_MS = 10_000;

export const getExternalImportMaxTracks = (): number => {
  const raw = Number.parseInt(process.env.EXTERNAL_IMPORT_MAX_TRACKS ?? '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_TRACKS;
};

export const getYoutubeApiKey = (): string | null => process.env.YOUTUBE_API_KEY?.trim() || null;

export const getExternalSourceAvailability = (): Record<ExternalSourceKind, boolean> => ({
  deezer: true,
  youtube: getYoutubeApiKey() !== null,
});

/**
 * Accepts:
 *  - https://www.deezer.com/{lang/}playlist/{id}
 *  - https://deezer.com/playlist/{id}
 *  - https://www.youtube.com/playlist?list={id} · https://music.youtube.com/playlist?list={id}
 *  - any youtube.com URL carrying a `list` query param
 */
export const parseExternalSourceUrl = (rawUrl: string): ExternalSourceRef | null => {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');

  if (host === 'deezer.com' || host.endsWith('.deezer.com')) {
    const match = url.pathname.match(/\/playlist\/(\d+)/);
    return match ? { source: 'deezer', playlistId: match[1] } : null;
  }

  if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
    const list = url.searchParams.get('list');
    return list && /^[A-Za-z0-9_-]{10,64}$/.test(list)
      ? { source: 'youtube', playlistId: list }
      : null;
  }

  return null;
};

const fetchJson = async (url: string): Promise<unknown> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await externalSourceHttp.fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => null)) as unknown;
    if (response.status === 404) {
      throw new ExternalSourceError('not_found', 'Playlist not found.', 404);
    }
    if (!response.ok) {
      throw new ExternalSourceError(
        'source_unavailable',
        `Source responded with status ${response.status}.`,
        502,
      );
    }
    return payload;
  } catch (error) {
    if (error instanceof ExternalSourceError) {
      throw error;
    }
    throw new ExternalSourceError('source_unavailable', 'Could not reach the source service.', 502);
  } finally {
    clearTimeout(timeout);
  }
};

// ---------------------------------------------------------------------------
// Deezer (public API, no key). Track objects carry an ISRC.
// ---------------------------------------------------------------------------

type DeezerPlaylist = {
  id?: number;
  title?: string;
  nb_tracks?: number;
  public?: boolean;
  picture_medium?: string;
  picture_big?: string;
  error?: { type?: string; message?: string; code?: number };
};

type DeezerTrack = {
  id?: number;
  title?: string;
  title_short?: string;
  duration?: number;
  isrc?: string;
  readable?: boolean;
  artist?: { name?: string };
  album?: { title?: string; cover_medium?: string };
};

type DeezerTrackPage = { data?: DeezerTrack[]; total?: number; next?: string };

const DEEZER_PAGE_SIZE = 100;

const fetchDeezerPlaylist = async (
  playlistId: string,
  maxTracks: number,
): Promise<ExternalPlaylist> => {
  const meta = (await fetchJson(`https://api.deezer.com/playlist/${playlistId}`)) as DeezerPlaylist;
  if (meta.error) {
    if (meta.error.code === 800 || /not found/i.test(meta.error.message ?? '')) {
      throw new ExternalSourceError('not_found', 'Playlist not found.', 404);
    }
    throw new ExternalSourceError('source_unavailable', meta.error.message ?? 'Deezer error.', 502);
  }
  if (meta.public === false) {
    throw new ExternalSourceError('private_playlist', 'This Deezer playlist is private.', 400);
  }

  const tracks: ExternalSourceTrack[] = [];
  let index = 0;
  let total = meta.nb_tracks ?? 0;
  while (index < total && tracks.length < maxTracks) {
    const limit = Math.min(DEEZER_PAGE_SIZE, maxTracks - tracks.length);
    const page = (await fetchJson(
      `https://api.deezer.com/playlist/${playlistId}/tracks?index=${index}&limit=${limit}`,
    )) as DeezerTrackPage;
    const rows = page.data ?? [];
    if (typeof page.total === 'number') {
      total = page.total;
    }
    for (const row of rows) {
      if (!row.title || !row.artist?.name) {
        continue;
      }
      tracks.push({
        name: row.title,
        artist: row.artist.name,
        album: row.album?.title ?? 'Unknown album',
        durationMs: Math.max(0, Math.round((row.duration ?? 0) * 1000)),
        artworkUrl: row.album?.cover_medium ?? null,
        isrc: row.isrc?.trim() || null,
      });
    }
    if (rows.length === 0) {
      break;
    }
    index += rows.length;
  }

  return {
    source: 'deezer',
    playlistId,
    name: meta.title?.trim() || 'Deezer playlist',
    trackCount: total,
    coverImageUrl: meta.picture_big ?? meta.picture_medium ?? null,
    tracks,
    truncated: total > tracks.length,
  };
};

// ---------------------------------------------------------------------------
// YouTube / YouTube Music (Data API v3 with an API key; reads cost 1 unit/page).
// Titles are free text, so artist/name are parsed heuristically and matched by
// text search on the destination.
// ---------------------------------------------------------------------------

type YoutubePlaylistList = {
  items?: Array<{
    id?: string;
    snippet?: { title?: string; thumbnails?: Record<string, { url?: string }> };
    contentDetails?: { itemCount?: number };
    status?: { privacyStatus?: string };
  }>;
};

type YoutubePlaylistItems = {
  nextPageToken?: string;
  items?: Array<{
    snippet?: {
      title?: string;
      videoOwnerChannelTitle?: string;
      thumbnails?: Record<string, { url?: string }>;
      resourceId?: { videoId?: string };
    };
    status?: { privacyStatus?: string };
  }>;
};

const YOUTUBE_JUNK = [
  /\((official|lyric|lyrics|audio|video|visualizer|hd|hq|4k|remaster(ed)?( \d{4})?|clip officiel|official video|official audio|official music video)[^)]*\)/gi,
  /\[(official|lyric|lyrics|audio|video|visualizer|hd|hq|4k|remaster(ed)?( \d{4})?)[^\]]*\]/gi,
  /\b(official\s+(music\s+)?video|official\s+audio|lyric\s+video|lyrics|visuali[sz]er|clip officiel)\b/gi,
  /\bft\.?\s+[^-|(]+$/i,
  /\bfeat\.?\s+[^-|(]+$/i,
];

const cleanYoutubeText = (value: string): string =>
  YOUTUBE_JUNK.reduce((text, pattern) => text.replace(pattern, ' '), value)
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–|:]+|[\s\-–|:]+$/g, '')
    .trim();

const cleanChannelTitle = (value: string): string =>
  value
    .replace(/\s*-\s*topic$/i, '')
    .replace(/vevo$/i, '')
    .trim();

/** "Artist - Title (Official Video)" -> { artist, name }; falls back to the channel as artist. */
export const parseYoutubeTitle = (
  title: string,
  channelTitle: string | null,
): { name: string; artist: string } => {
  const cleaned = cleanYoutubeText(title);
  const separators = [' - ', ' – ', ' — ', ' | ', ': '];
  for (const separator of separators) {
    const index = cleaned.indexOf(separator);
    if (index > 0) {
      const artist = cleaned.slice(0, index).trim();
      const name = cleaned.slice(index + separator.length).trim();
      if (artist && name) {
        return { artist, name };
      }
    }
  }
  const fallbackArtist = channelTitle ? cleanChannelTitle(channelTitle) : '';
  return { name: cleaned || title, artist: fallbackArtist };
};

const fetchYoutubePlaylist = async (
  playlistId: string,
  maxTracks: number,
): Promise<ExternalPlaylist> => {
  const apiKey = getYoutubeApiKey();
  if (!apiKey) {
    throw new ExternalSourceError(
      'source_not_configured',
      'YouTube imports are not enabled on this server.',
      503,
    );
  }
  const base = 'https://www.googleapis.com/youtube/v3';
  const metaUrl = `${base}/playlists?part=snippet,contentDetails,status&id=${encodeURIComponent(playlistId)}&key=${apiKey}`;
  const meta = (await fetchJson(metaUrl)) as YoutubePlaylistList;
  const playlist = meta.items?.[0];
  if (!playlist) {
    throw new ExternalSourceError('not_found', 'Playlist not found.', 404);
  }
  if (playlist.status?.privacyStatus === 'private') {
    throw new ExternalSourceError('private_playlist', 'This YouTube playlist is private.', 400);
  }

  const tracks: ExternalSourceTrack[] = [];
  let pageToken: string | undefined;
  const total = playlist.contentDetails?.itemCount ?? 0;
  do {
    const pageSize = Math.min(50, maxTracks - tracks.length);
    if (pageSize <= 0) {
      break;
    }
    const itemsUrl = `${base}/playlistItems?part=snippet,status&maxResults=${pageSize}&playlistId=${encodeURIComponent(playlistId)}&key=${apiKey}${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const page = (await fetchJson(itemsUrl)) as YoutubePlaylistItems;
    for (const item of page.items ?? []) {
      const title = item.snippet?.title?.trim();
      if (!title || title === 'Private video' || title === 'Deleted video') {
        continue;
      }
      const parsed = parseYoutubeTitle(title, item.snippet?.videoOwnerChannelTitle ?? null);
      const thumbs = item.snippet?.thumbnails ?? {};
      tracks.push({
        name: parsed.name,
        artist: parsed.artist,
        album: '',
        durationMs: 0,
        artworkUrl: thumbs.medium?.url ?? thumbs.default?.url ?? null,
        isrc: null,
      });
    }
    pageToken = page.nextPageToken;
  } while (pageToken && tracks.length < maxTracks);

  return {
    source: 'youtube',
    playlistId,
    name: playlist.snippet?.title?.trim() || 'YouTube playlist',
    trackCount: total,
    coverImageUrl:
      playlist.snippet?.thumbnails?.high?.url ?? playlist.snippet?.thumbnails?.medium?.url ?? null,
    tracks,
    truncated: total > tracks.length,
  };
};

export const fetchExternalPlaylist = async (
  ref: ExternalSourceRef,
  options?: { maxTracks?: number },
): Promise<ExternalPlaylist> => {
  const maxTracks = options?.maxTracks ?? getExternalImportMaxTracks();
  return ref.source === 'deezer'
    ? fetchDeezerPlaylist(ref.playlistId, maxTracks)
    : fetchYoutubePlaylist(ref.playlistId, maxTracks);
};

export const resolveExternalSourceUrl = (rawUrl: string): ExternalSourceRef => {
  const ref = parseExternalSourceUrl(rawUrl);
  if (!ref) {
    throw new ExternalSourceError(
      'unsupported_url',
      'Paste a public Deezer or YouTube playlist link.',
      400,
    );
  }
  return ref;
};
