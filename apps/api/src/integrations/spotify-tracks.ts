import type { Provider } from '@synqit/shared';
import { z } from 'zod';

type SpotifyTrackSearchResult = {
  providerTrackId: string;
  name: string;
  artist: string;
  album: string;
  durationMs: number;
  artworkUrl: string | null;
};

class ProviderApiError extends Error {
  provider: Provider;
  statusCode: number;
  details: unknown;

  constructor(params: {
    provider: Provider;
    statusCode: number;
    message: string;
    details?: unknown;
  }) {
    super(params.message);
    this.name = 'ProviderApiError';
    this.provider = params.provider;
    this.statusCode = params.statusCode;
    this.details = params.details ?? null;
  }
}

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
        .nullable(),
    }),
  ),
  next: z.string().url().nullable().optional(),
});

const toSpotifyApiError = (params: {
  action: 'search' | 'list_playlist_tracks' | 'add_track' | 'remove_track';
  statusCode: number;
  payload: unknown;
  wwwAuthenticate: string | null;
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
  }));
};

export const addSpotifyTrackToPlaylist = async (params: {
  accessToken: string;
  providerPlaylistId: string;
  providerTrackId: string;
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
      uris: [`spotify:track:${params.providerTrackId}`],
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    throw toSpotifyApiError({
      action: 'add_track',
      statusCode: response.status,
      payload,
      wwwAuthenticate: response.headers.get('www-authenticate'),
    });
  }
};

export const listSpotifyPlaylistTracks = async (params: {
  accessToken: string;
  providerPlaylistId: string;
  limit?: number;
}): Promise<SpotifyTrackSearchResult[]> => {
  const limit = Math.min(Math.max(params.limit ?? 100, 1), 100);
  let nextUrl: string | null = `https://api.spotify.com/v1/playlists/${encodeURIComponent(
    params.providerPlaylistId,
  )}/tracks?limit=${limit}`;
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
      });
    }

    const parsed = spotifyPlaylistTracksResponseSchema.parse(payload);
    for (const item of parsed.items) {
      if (!item.track?.id) {
        continue;
      }

      if (byProviderTrackId.has(item.track.id)) {
        continue;
      }

      byProviderTrackId.set(item.track.id, {
        providerTrackId: item.track.id,
        name: item.track.name,
        artist: item.track.artists.map((artist) => artist.name).join(', '),
        album: item.track.album?.name ?? 'Unknown album',
        durationMs: item.track.duration_ms,
        artworkUrl: item.track.album?.images[0]?.url ?? null,
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
    });
  }
};

export { ProviderApiError };
export type { SpotifyTrackSearchResult };
