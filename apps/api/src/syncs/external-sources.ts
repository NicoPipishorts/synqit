import type { ExternalSourceKind, ExternalSourceTrack } from '@synqit/shared';

import { isYoutubePlaceholderTitle, parseYoutubeTitle } from '../integrations/youtube-titles';

/**
 * Read-only access to public playlists on services Synqit does not connect to.
 * Used by the transfer funnel: paste a link, get the tracks, match them on the
 * service the user connected. No user credentials are involved on the source
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

/** A source that can be fetched by id; file imports carry their tracks instead. */
export type ExternalSourceRef = {
  source: Exclude<ExternalSourceKind, 'file'>;
  playlistId: string;
  /** The link as pasted, for sources whose page address carries more than the id. */
  url?: string;
};

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
  // Editorial playlists are published pages; nothing to configure.
  qobuz: true,
  // A file needs nothing from anyone.
  file: true,
});

/**
 * Accepts:
 *  - https://www.deezer.com/{lang/}playlist/{id}
 *  - https://deezer.com/playlist/{id}
 *  - https://www.youtube.com/playlist?list={id} · https://music.youtube.com/playlist?list={id}
 *  - any youtube.com URL carrying a `list` query param
 *  - https://www.qobuz.com/{locale}/playlists/{slug}/{id} (editorial playlists)
 *  - https://open.qobuz.com/playlist/{id} · https://play.qobuz.com/playlist/{id}
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

  if (host === 'qobuz.com' || host.endsWith('.qobuz.com')) {
    const match = url.pathname.match(/\/playlists?\/(?:[^/]+\/)?(\d+)\/?$/);
    return match ? { source: 'qobuz', playlistId: match[1]!, url: url.toString() } : null;
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
// Titles are free text, so artist/name are parsed heuristically (see
// integrations/youtube-titles.ts) and matched by text search on the destination.
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
      if (!title || isYoutubePlaceholderTitle(title)) {
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

// ---------------------------------------------------------------------------
// Qobuz (editorial playlists on qobuz.com). There is no public API, but the
// playlist pages ship a schema.org MusicPlaylist block, published for search
// engines, with every track's title, artist, album and duration. No ISRC, so
// matching is by title. Personal playlists live only in the apps and are not
// published on the site, so they cannot be read this way.
// ---------------------------------------------------------------------------

const QOBUZ_PAGE_HEADERS = {
  accept: 'text/html',
  'user-agent': 'Mozilla/5.0 (compatible; Synqit/1.0; +https://synqit.fr)',
};

type QobuzRecording = {
  '@type'?: string;
  name?: string;
  byArtist?: string | { name?: string };
  inAlbum?: string | { name?: string };
  duration?: string;
};

type QobuzPlaylistJsonLd = {
  '@type'?: string;
  name?: string;
  numTracks?: number;
  track?: QobuzRecording[];
};

const readName = (value: string | { name?: string } | undefined): string =>
  typeof value === 'string' ? value.trim() : (value?.name ?? '').trim();

/** "00:03:48" or "3:48" to milliseconds; 0 when unreadable. */
const parseClockDurationMs = (value: string | undefined): number => {
  const match = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec((value ?? '').trim());
  if (!match) {
    return 0;
  }
  const [, hours, minutes, seconds] = match;
  return (Number(hours ?? 0) * 3600 + Number(minutes) * 60 + Number(seconds)) * 1000;
};

const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

/** The MusicPlaylist block among the page's JSON-LD scripts, if any. */
export const extractQobuzPlaylistJsonLd = (html: string): QobuzPlaylistJsonLd | null => {
  const pattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]!.trim()) as unknown;
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const candidate of candidates) {
        if (
          candidate &&
          typeof candidate === 'object' &&
          (candidate as QobuzPlaylistJsonLd)['@type'] === 'MusicPlaylist' &&
          Array.isArray((candidate as QobuzPlaylistJsonLd).track)
        ) {
          return candidate as QobuzPlaylistJsonLd;
        }
      }
    } catch {
      // Not JSON we can read; try the next block.
    }
  }
  return null;
};

const fetchHtml = async (url: string): Promise<{ html: string; finalUrl: string }> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await externalSourceHttp.fetch(url, {
      method: 'GET',
      headers: QOBUZ_PAGE_HEADERS,
      redirect: 'follow',
      signal: controller.signal,
    });
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
    return { html: await response.text(), finalUrl: response.url || url };
  } catch (error) {
    if (error instanceof ExternalSourceError) {
      throw error;
    }
    throw new ExternalSourceError('source_unavailable', 'Could not reach the source service.', 502);
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Page addresses to try, most specific first: the pasted www link keeps its
 * locale and slug; app links (open/play.qobuz.com) only carry the id, and the
 * site redirects a wrong slug to the right page for the default locale.
 */
const qobuzPageCandidates = (playlistId: string, url: string | undefined): string[] => {
  const candidates: string[] = [];
  if (url) {
    try {
      const parsed = new URL(url);
      if (
        parsed.hostname.replace(/^www\./, '') === 'qobuz.com' &&
        /\/playlists\//.test(parsed.pathname)
      ) {
        candidates.push(`https://www.qobuz.com${parsed.pathname}`);
      }
    } catch {
      // Ignore an unreadable url; the canonical guess below still applies.
    }
  }
  const canonical = `https://www.qobuz.com/us-en/playlists/playlist/${playlistId}`;
  if (!candidates.includes(canonical)) {
    candidates.push(canonical);
  }
  return candidates;
};

const fetchQobuzPlaylist = async (
  playlistId: string,
  url: string | undefined,
  maxTracks: number,
): Promise<ExternalPlaylist> => {
  let page: { html: string; finalUrl: string } | null = null;
  let jsonLd: QobuzPlaylistJsonLd | null = null;
  for (const candidate of qobuzPageCandidates(playlistId, url)) {
    page = await fetchHtml(candidate);
    jsonLd = extractQobuzPlaylistJsonLd(page.html);
    if (jsonLd) {
      break;
    }
  }
  if (!page || !jsonLd) {
    // The site sends unknown ids to the playlists index, which has no
    // MusicPlaylist block: personal playlists are never published there.
    throw new ExternalSourceError(
      'not_found',
      'This Qobuz playlist is not published on qobuz.com. Only Qobuz editorial playlists can be imported from a link; export a personal playlist to a file instead.',
      404,
    );
  }

  const tracks: ExternalSourceTrack[] = [];
  for (const recording of jsonLd.track ?? []) {
    const name = decodeHtmlEntities(readName(recording.name));
    if (!name) {
      continue;
    }
    tracks.push({
      name,
      artist: decodeHtmlEntities(readName(recording.byArtist)),
      album: decodeHtmlEntities(readName(recording.inAlbum)),
      durationMs: parseClockDurationMs(recording.duration),
      artworkUrl: null,
      isrc: null,
    });
  }

  const total = Math.max(jsonLd.numTracks ?? 0, tracks.length);
  const coverMatch = new RegExp(
    `https://static\\.qobuz\\.com/images/playlists/${playlistId}_[A-Za-z0-9]+_[a-z]+\\.jpg`,
  ).exec(page.html);

  return {
    source: 'qobuz',
    playlistId,
    name: decodeHtmlEntities((jsonLd.name ?? '').trim()) || 'Qobuz playlist',
    trackCount: total,
    coverImageUrl: coverMatch?.[0] ?? null,
    tracks: tracks.slice(0, maxTracks),
    truncated: total > Math.min(tracks.length, maxTracks),
  };
};

export const fetchExternalPlaylist = async (
  ref: ExternalSourceRef,
  options?: { maxTracks?: number },
): Promise<ExternalPlaylist> => {
  const maxTracks = options?.maxTracks ?? getExternalImportMaxTracks();
  switch (ref.source) {
    case 'deezer':
      return fetchDeezerPlaylist(ref.playlistId, maxTracks);
    case 'youtube':
      return fetchYoutubePlaylist(ref.playlistId, maxTracks);
    case 'qobuz':
      return fetchQobuzPlaylist(ref.playlistId, ref.url, maxTracks);
  }
};

export const resolveExternalSourceUrl = (rawUrl: string): ExternalSourceRef => {
  const ref = parseExternalSourceUrl(rawUrl);
  if (!ref) {
    throw new ExternalSourceError(
      'unsupported_url',
      'Paste a public Deezer, YouTube or Qobuz playlist link.',
      400,
    );
  }
  return ref;
};
