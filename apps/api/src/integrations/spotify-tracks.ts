import { z } from 'zod';

import { ProviderApiError, parseRetryAfterSeconds } from './provider-api-error';
import { chunk, withProviderRetry } from './provider-throttle';

const SPOTIFY_ADD_TRACKS_CHUNK_SIZE = 100;

type SpotifyTrackSearchResult = {
  providerTrackId: string;
  name: string;
  artist: string;
  album: string;
  durationMs: number;
  artworkUrl: string | null;
  previewUrl: string | null;
};

const spotifySearchResponseSchema = z.object({
  tracks: z.object({
    items: z.array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        artists: z.array(z.object({ name: z.string().min(1) })),
        album: z.object({
          name: z.string().min(1),
          images: z
            .array(
              z.object({
                url: z.string().url(),
              }),
            )
            .optional()
            .default([]),
        }),
        duration_ms: z.number().int().nonnegative(),
        preview_url: z.string().url().nullable().optional(),
      }),
    ),
  }),
});

const spotifyPlaylistTracksResponseSchema = z.object({
  items: z.array(
    z.object({
      track: z
        .object({
          id: z.string().nullable(),
          name: z.string().optional().default('Unknown track'),
          artists: z
            .array(z.object({ name: z.string().min(1) }))
            .optional()
            .default([]),
          album: z
            .object({
              name: z.string().optional().default('Unknown album'),
              images: z
                .array(
                  z.object({
                    url: z.string().url(),
                  }),
                )
                .optional()
                .default([]),
            })
            .optional(),
          duration_ms: z.number().int().nonnegative().optional().default(0),
        })
        .nullable()
        .optional(),
      item: z
        .object({
          id: z.string().nullable(),
          name: z.string().optional().default('Unknown track'),
          artists: z
            .array(z.object({ name: z.string().min(1) }))
            .optional()
            .default([]),
          album: z
            .object({
              name: z.string().optional().default('Unknown album'),
              images: z
                .array(
                  z.object({
                    url: z.string().url(),
                  }),
                )
                .optional()
                .default([]),
            })
            .optional(),
          duration_ms: z.number().int().nonnegative().optional().default(0),
        })
        .nullable()
        .optional(),
    }),
  ),
  next: z.string().url().nullable().optional(),
});

const toSpotifyApiError = (params: {
  action: 'search' | 'list_playlist_tracks' | 'add_track' | 'remove_track';
  statusCode: number;
  payload: unknown;
  wwwAuthenticate: string | null;
  retryAfter?: string | null;
}): ProviderApiError => {
  const fallbackMessage =
    params.action === 'search'
      ? `Spotify track search failed with status ${params.statusCode}.`
      : params.action === 'list_playlist_tracks'
        ? `Spotify playlist-track lookup failed with status ${params.statusCode}.`
        : params.action === 'add_track'
          ? `Spotify add-track failed with status ${params.statusCode}.`
          : `Spotify remove-track failed with status ${params.statusCode}.`;

  let message = fallbackMessage;
  if (
    params.payload &&
    typeof params.payload === 'object' &&
    'error' in params.payload &&
    params.payload.error &&
    typeof params.payload.error === 'object' &&
    'message' in params.payload.error &&
    typeof params.payload.error.message === 'string'
  ) {
    message = params.payload.error.message;
  }

  return new ProviderApiError({
    provider: 'spotify',
    statusCode: params.statusCode,
    message,
    retryAfterSeconds: parseRetryAfterSeconds(params.retryAfter ?? null),
    details: {
      payload: params.payload,
      wwwAuthenticate: params.wwwAuthenticate,
    },
  });
};

export const searchSpotifyTracks = async (params: {
  accessToken: string;
  query: string;
  limit?: number;
  offset?: number;
}): Promise<SpotifyTrackSearchResult[]> => {
  const url = new URL('https://api.spotify.com/v1/search');
  url.searchParams.set('type', 'track');
  url.searchParams.set('q', params.query);
  url.searchParams.set('limit', String(params.limit ?? 10));
  url.searchParams.set('offset', String(params.offset ?? 0));

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      authorization: `Bearer ${params.accessToken}`,
    },
  });

  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    throw toSpotifyApiError({
      action: 'search',
      statusCode: response.status,
      payload,
      wwwAuthenticate: response.headers.get('www-authenticate'),
      retryAfter: response.headers.get('retry-after'),
    });
  }

  const parsed = spotifySearchResponseSchema.parse(payload);
  return parsed.tracks.items.map((track) => ({
    providerTrackId: track.id,
    name: track.name,
    artist: track.artists.map((artist) => artist.name).join(', '),
    album: track.album.name,
    durationMs: track.duration_ms,
    artworkUrl: track.album.images[0]?.url ?? null,
    previewUrl: track.preview_url ?? null,
  }));
};

const postSpotifyTrackUris = async (params: {
  accessToken: string;
  providerPlaylistId: string;
  providerTrackIds: readonly string[];
}): Promise<void> => {
  const url = `https://api.spotify.com/v1/playlists/${encodeURIComponent(
    params.providerPlaylistId,
  )}/items`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${params.accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      uris: params.providerTrackIds.map((id) => `spotify:track:${id}`),
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    throw toSpotifyApiError({
      action: 'add_track',
      statusCode: response.status,
      payload,
      wwwAuthenticate: response.headers.get('www-authenticate'),
      retryAfter: response.headers.get('retry-after'),
    });
  }
};

export const addSpotifyTrackToPlaylist = async (params: {
  accessToken: string;
  providerPlaylistId: string;
  providerTrackId: string;
}): Promise<void> =>
  postSpotifyTrackUris({
    accessToken: params.accessToken,
    providerPlaylistId: params.providerPlaylistId,
    providerTrackIds: [params.providerTrackId],
  });

/**
 * Adds many tracks with one request per 100, which is Spotify's per-call cap.
 *
 * A rejected chunk is retried one track at a time: a batch can fail because a
 * single id is unavailable in the user's market, and that should cost one
 * track rather than the whole chunk. Returns the ids actually added, in the
 * order they were requested, so callers can account for what was dropped.
 */
export const addSpotifyTracksToPlaylist = async (params: {
  accessToken: string;
  providerPlaylistId: string;
  providerTrackIds: readonly string[];
}): Promise<{ addedTrackIds: string[] }> => {
  const addedTrackIds: string[] = [];

  for (const batch of chunk(params.providerTrackIds, SPOTIFY_ADD_TRACKS_CHUNK_SIZE)) {
    try {
      await withProviderRetry(() =>
        postSpotifyTrackUris({
          accessToken: params.accessToken,
          providerPlaylistId: params.providerPlaylistId,
          providerTrackIds: batch,
        }),
      );
      addedTrackIds.push(...batch);
    } catch {
      for (const providerTrackId of batch) {
        try {
          await withProviderRetry(() =>
            postSpotifyTrackUris({
              accessToken: params.accessToken,
              providerPlaylistId: params.providerPlaylistId,
              providerTrackIds: [providerTrackId],
            }),
          );
          addedTrackIds.push(providerTrackId);
        } catch {
          // Leave it out of the result; the caller reports it as skipped.
        }
      }
    }
  }

  return { addedTrackIds };
};

export const listSpotifyPlaylistTracks = async (params: {
  accessToken: string;
  providerPlaylistId: string;
  limit?: number;
}): Promise<SpotifyTrackSearchResult[]> => {
  const limit = Math.min(Math.max(params.limit ?? 100, 1), 100);
  let nextUrl: string | null = `https://api.spotify.com/v1/playlists/${encodeURIComponent(
    params.providerPlaylistId,
  )}/items?limit=${limit}`;
  const byProviderTrackId = new Map<string, SpotifyTrackSearchResult>();

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${params.accessToken}`,
      },
    });

    const payload = (await response.json().catch(() => ({}))) as unknown;
    if (!response.ok) {
      throw toSpotifyApiError({
        action: 'list_playlist_tracks',
        statusCode: response.status,
        payload,
        wwwAuthenticate: response.headers.get('www-authenticate'),
        retryAfter: response.headers.get('retry-after'),
      });
    }

    const parsed = spotifyPlaylistTracksResponseSchema.parse(payload);
    for (const item of parsed.items) {
      const track = item.track ?? item.item;
      if (!track?.id) {
        continue;
      }

      if (byProviderTrackId.has(track.id)) {
        continue;
      }

      byProviderTrackId.set(track.id, {
        providerTrackId: track.id,
        name: track.name,
        artist: track.artists.map((artist) => artist.name).join(', '),
        album: track.album?.name ?? 'Unknown album',
        durationMs: track.duration_ms,
        artworkUrl: track.album?.images[0]?.url ?? null,
        previewUrl: null,
      });
    }

    nextUrl = parsed.next ?? null;
  }

  return Array.from(byProviderTrackId.values());
};

export const removeSpotifyTrackFromPlaylist = async (params: {
  accessToken: string;
  providerPlaylistId: string;
  providerTrackId: string;
}): Promise<void> => {
  const url = `https://api.spotify.com/v1/playlists/${encodeURIComponent(
    params.providerPlaylistId,
  )}/items`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      authorization: `Bearer ${params.accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      tracks: [{ uri: `spotify:track:${params.providerTrackId}` }],
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    throw toSpotifyApiError({
      action: 'remove_track',
      statusCode: response.status,
      payload,
      wwwAuthenticate: response.headers.get('www-authenticate'),
      retryAfter: response.headers.get('retry-after'),
    });
  }
};

export { ProviderApiError };
export type { SpotifyTrackSearchResult };
