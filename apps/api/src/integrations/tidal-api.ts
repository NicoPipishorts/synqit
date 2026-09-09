import { z } from 'zod';

import { parseIsoDurationMs } from './iso-duration';
import { parseRetryAfterSeconds, ProviderApiError } from './provider-api-error';
import { getTidalCountryCode } from './tidal';

/**
 * TIDAL Open API v2. It speaks JSON:API, so resources arrive as
 * `{ data: [{ id, type, attributes, relationships }], included: [...] }` and
 * writes must use the `application/vnd.api+json` content type.
 */

const API_BASE_URL = 'https://openapi.tidal.com/v2';
const JSON_API_CONTENT_TYPE = 'application/vnd.api+json';

export type TidalTrack = {
  providerTrackId: string;
  name: string;
  artist: string;
  album: string;
  durationMs: number;
  artworkUrl: string | null;
  previewUrl: string | null;
  isrc: string | null;
};

export type TidalPlaylist = {
  providerPlaylistId: string;
  name: string;
  trackCount: number | null;
  coverImageUrl: string | null;
};

const resourceSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  attributes: z.record(z.string(), z.unknown()).optional().default({}),
  relationships: z.record(z.string(), z.unknown()).optional().default({}),
});

const documentSchema = z.object({
  data: z.union([resourceSchema, z.array(resourceSchema)]).optional(),
  included: z.array(resourceSchema).optional().default([]),
});

type Resource = z.infer<typeof resourceSchema>;

const asArray = (data: Resource | Resource[] | undefined): Resource[] =>
  data === undefined ? [] : Array.isArray(data) ? data : [data];

const readString = (attributes: Record<string, unknown>, key: string): string | null => {
  const value = attributes[key];
  return typeof value === 'string' && value.trim() ? value : null;
};

/** Picks the largest square-ish image TIDAL offers for a resource. */
const readImageUrl = (attributes: Record<string, unknown>): string | null => {
  const links = attributes.imageLinks ?? attributes.externalLinks;
  if (!Array.isArray(links)) {
    return null;
  }
  const candidates = links
    .map((entry) =>
      entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : null,
    )
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .map((entry) => ({
      href: typeof entry.href === 'string' ? entry.href : null,
      width:
        typeof (entry.meta as Record<string, unknown>)?.width === 'number'
          ? ((entry.meta as Record<string, unknown>).width as number)
          : 0,
    }))
    .filter((entry) => entry.href !== null);
  if (candidates.length === 0) {
    return null;
  }
  return candidates.sort((a, b) => b.width - a.width)[0]?.href ?? null;
};

/** Relationship ids let us join `included` artists/albums onto a track. */
const readRelationshipIds = (resource: Resource, name: string): string[] => {
  const relationship = resource.relationships[name];
  if (!relationship || typeof relationship !== 'object') {
    return [];
  }
  const data = (relationship as { data?: unknown }).data;
  const entries = Array.isArray(data) ? data : data ? [data] : [];
  return entries
    .map((entry) =>
      entry && typeof entry === 'object' && typeof (entry as { id?: unknown }).id === 'string'
        ? (entry as { id: string }).id
        : null,
    )
    .filter((id): id is string => id !== null);
};

const toTrack = (resource: Resource, included: Map<string, Resource>): TidalTrack => {
  const artistNames = readRelationshipIds(resource, 'artists')
    .map((id) => included.get(id))
    .map((artist) => (artist ? readString(artist.attributes, 'name') : null))
    .filter((name): name is string => name !== null);
  const album = readRelationshipIds(resource, 'albums')
    .map((id) => included.get(id))
    .find((entry) => entry !== undefined);

  return {
    providerTrackId: resource.id,
    name: readString(resource.attributes, 'title') ?? 'Unknown track',
    artist: artistNames.join(', ') || 'Unknown artist',
    album: (album ? readString(album.attributes, 'title') : null) ?? 'Unknown album',
    durationMs: parseIsoDurationMs(readString(resource.attributes, 'duration')),
    artworkUrl: album ? readImageUrl(album.attributes) : null,
    previewUrl: null,
    isrc: readString(resource.attributes, 'isrc'),
  };
};

const toPlaylist = (resource: Resource): TidalPlaylist => {
  const numberOfItems = resource.attributes.numberOfItems;
  return {
    providerPlaylistId: resource.id,
    name: readString(resource.attributes, 'name') ?? 'Untitled playlist',
    trackCount: typeof numberOfItems === 'number' ? numberOfItems : null,
    coverImageUrl: readImageUrl(resource.attributes),
  };
};

const request = async (params: {
  accessToken: string;
  path: string;
  method?: 'GET' | 'POST' | 'DELETE';
  query?: Record<string, string | undefined>;
  body?: unknown;
  action: string;
}): Promise<z.infer<typeof documentSchema>> => {
  const url = new URL(`${API_BASE_URL}${params.path}`);
  for (const [key, value] of Object.entries(params.query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {
    authorization: `Bearer ${params.accessToken}`,
    accept: JSON_API_CONTENT_TYPE,
  };
  if (params.body !== undefined) {
    headers['content-type'] = JSON_API_CONTENT_TYPE;
  }

  const response = await fetch(url.toString(), {
    method: params.method ?? 'GET',
    headers,
    body: params.body === undefined ? undefined : JSON.stringify(params.body),
  });

  if (response.status === 204) {
    return { included: [] };
  }

  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    throw new ProviderApiError({
      provider: 'tidal',
      statusCode: response.status,
      message: `TIDAL ${params.action} failed with status ${response.status}.`,
      details: payload,
      retryAfterSeconds: parseRetryAfterSeconds(response.headers.get('retry-after')),
    });
  }

  return documentSchema.parse(payload);
};

const indexIncluded = (document: z.infer<typeof documentSchema>): Map<string, Resource> =>
  new Map(document.included.map((entry) => [entry.id, entry]));

/** Exact catalogue match; the reason Deezer and Spotify sources land cleanly. */
export const findTidalTrackByIsrc = async (params: {
  accessToken: string;
  isrc: string;
}): Promise<TidalTrack | null> => {
  const document = await request({
    accessToken: params.accessToken,
    path: '/tracks',
    query: {
      'filter[isrc]': params.isrc,
      countryCode: getTidalCountryCode(),
      include: 'artists,albums',
    },
    action: 'isrc_lookup',
  });

  const [track] = asArray(document.data).filter((entry) => entry.type === 'tracks');
  return track ? toTrack(track, indexIncluded(document)) : null;
};

export const searchTidalTracks = async (params: {
  accessToken: string;
  query: string;
  limit?: number;
  /** TIDAL's search does not page; the window is cut locally so "load more" moves on. */
  offset?: number;
}): Promise<TidalTrack[]> => {
  const document = await request({
    accessToken: params.accessToken,
    path: '/searchResults',
    query: {
      'filter[query]': params.query,
      countryCode: getTidalCountryCode(),
      include: 'tracks,tracks.artists,tracks.albums',
    },
    action: 'search',
  });

  const included = indexIncluded(document);
  const offset = params.offset ?? 0;
  return document.included
    .filter((entry) => entry.type === 'tracks')
    .slice(offset, offset + (params.limit ?? 5))
    .map((entry) => toTrack(entry, included));
};

export const listTidalUserPlaylists = async (params: {
  accessToken: string;
  tidalUserId: string;
}): Promise<TidalPlaylist[]> => {
  const document = await request({
    accessToken: params.accessToken,
    path: '/playlists',
    query: {
      'filter[owners.id]': params.tidalUserId,
      countryCode: getTidalCountryCode(),
    },
    action: 'list_playlists',
  });

  return asArray(document.data)
    .filter((entry) => entry.type === 'playlists')
    .map(toPlaylist);
};

export const listTidalPlaylistTracks = async (params: {
  accessToken: string;
  providerPlaylistId: string;
}): Promise<TidalTrack[]> => {
  const document = await request({
    accessToken: params.accessToken,
    path: `/playlists/${encodeURIComponent(params.providerPlaylistId)}/relationships/items`,
    query: {
      countryCode: getTidalCountryCode(),
      include: 'items,items.artists,items.albums',
    },
    action: 'list_playlist_tracks',
  });

  const included = indexIncluded(document);
  return document.included
    .filter((entry) => entry.type === 'tracks')
    .map((entry) => toTrack(entry, included));
};

export const getTidalPlaylist = async (params: {
  accessToken: string;
  providerPlaylistId: string;
}): Promise<TidalPlaylist | null> => {
  const document = await request({
    accessToken: params.accessToken,
    path: `/playlists/${encodeURIComponent(params.providerPlaylistId)}`,
    query: { countryCode: getTidalCountryCode() },
    action: 'get_playlist',
  });

  const [playlist] = asArray(document.data);
  return playlist ? toPlaylist(playlist) : null;
};

export const createTidalPlaylist = async (params: {
  accessToken: string;
  name: string;
  description?: string;
}): Promise<{ providerPlaylistId: string }> => {
  const document = await request({
    accessToken: params.accessToken,
    path: '/playlists',
    method: 'POST',
    query: { countryCode: getTidalCountryCode() },
    body: {
      data: {
        type: 'playlists',
        attributes: {
          name: params.name,
          ...(params.description ? { description: params.description } : {}),
          accessType: 'UNLISTED',
        },
      },
    },
    action: 'create_playlist',
  });

  const [playlist] = asArray(document.data);
  if (!playlist) {
    throw new ProviderApiError({
      provider: 'tidal',
      statusCode: 502,
      message: 'TIDAL did not return the created playlist.',
    });
  }
  return { providerPlaylistId: playlist.id };
};

export const addTidalTracksToPlaylist = async (params: {
  accessToken: string;
  providerPlaylistId: string;
  providerTrackIds: readonly string[];
}): Promise<void> => {
  if (params.providerTrackIds.length === 0) {
    return;
  }

  await request({
    accessToken: params.accessToken,
    path: `/playlists/${encodeURIComponent(params.providerPlaylistId)}/relationships/items`,
    method: 'POST',
    query: { countryCode: getTidalCountryCode() },
    body: {
      data: params.providerTrackIds.map((id) => ({ id, type: 'tracks' })),
    },
    action: 'add_tracks',
  });
};

export const removeTidalTrackFromPlaylist = async (params: {
  accessToken: string;
  providerPlaylistId: string;
  providerTrackId: string;
}): Promise<void> => {
  await request({
    accessToken: params.accessToken,
    path: `/playlists/${encodeURIComponent(params.providerPlaylistId)}/relationships/items`,
    method: 'DELETE',
    query: { countryCode: getTidalCountryCode() },
    body: { data: [{ id: params.providerTrackId, type: 'tracks' }] },
    action: 'remove_track',
  });
};

/** The signed-in user's TIDAL id, needed to list the playlists they own. */
export const getTidalCurrentUserId = async (params: {
  accessToken: string;
}): Promise<string | null> => {
  const document = await request({
    accessToken: params.accessToken,
    path: '/users/me',
    action: 'current_user',
  });
  const [user] = asArray(document.data);
  return user?.id ?? null;
};
