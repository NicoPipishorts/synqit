import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { ProviderApiError } from './spotify-tracks';

type AppleTrackSearchResult = {
  providerTrackId: string;
  name: string;
  artist: string;
  album: string;
  durationMs: number;
  artworkUrl: string | null;
};

type AppleLibraryPlaylist = {
  providerPlaylistId: string;
};

const appleSearchResponseSchema = z.object({
  results: z
    .object({
      songs: z
        .object({
          data: z.array(
            z.object({
              id: z.string().min(1),
              attributes: z.object({
                name: z.string().min(1),
                artistName: z.string().min(1),
                albumName: z.string().min(1),
                durationInMillis: z.number().int().nonnegative().optional().default(0),
                artwork: z
                  .object({
                    url: z.string().min(1),
                  })
                  .optional(),
              }),
            }),
          ),
        })
        .optional(),
    })
    .optional(),
});

const appleCreatePlaylistResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().min(1),
    }),
  ),
});

const applePlaylistTracksResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().min(1),
      attributes: z
        .object({
          playParams: z
            .object({
              catalogId: z.string().min(1).optional(),
            })
            .optional(),
        })
        .optional(),
    }),
  ),
});

const toAppleApiError = (params: {
  action: 'search' | 'create_playlist' | 'add_track' | 'remove_track' | 'list_playlist_tracks';
  statusCode: number;
  payload: unknown;
  wwwAuthenticate: string | null;
}): ProviderApiError => {
  const actionMessageByType = {
    search: 'Apple Music search failed',
    create_playlist: 'Apple Music playlist creation failed',
    add_track: 'Apple Music add-track failed',
    remove_track: 'Apple Music remove-track failed',
    list_playlist_tracks: 'Apple Music playlist-track lookup failed',
  } as const;

  let message = `${actionMessageByType[params.action]} with status ${params.statusCode}.`;
  if (
    params.payload &&
    typeof params.payload === 'object' &&
    'errors' in params.payload &&
    Array.isArray((params.payload as { errors?: unknown[] }).errors) &&
    (params.payload as { errors: unknown[] }).errors[0] &&
    typeof (params.payload as { errors: unknown[] }).errors[0] === 'object'
  ) {
    const firstError = (params.payload as { errors: Array<Record<string, unknown>> }).errors[0];
    if (typeof firstError.detail === 'string') {
      message = firstError.detail;
    } else if (typeof firstError.title === 'string') {
      message = firstError.title;
    }
  }

  return new ProviderApiError({
    provider: 'apple',
    statusCode: params.statusCode,
    message,
    details: {
      action: params.action,
      payload: params.payload,
      wwwAuthenticate: params.wwwAuthenticate,
    },
  });
};

const formatAppleArtworkUrl = (rawUrl: string | undefined): string | null => {
  if (!rawUrl) {
    return null;
  }

  return rawUrl.replace('{w}', '300').replace('{h}', '300');
};

const appleHeaders = (params: {
  developerToken: string;
  musicUserToken?: string;
  contentTypeJson?: boolean;
}): Record<string, string> => {
  const headers: Record<string, string> = {
    authorization: `Bearer ${params.developerToken}`,
  };
  if (params.musicUserToken) {
    headers['music-user-token'] = params.musicUserToken;
  }
  if (params.contentTypeJson) {
    headers['content-type'] = 'application/json';
  }

  return headers;
};

export const searchAppleCatalogTracks = async (params: {
  developerToken: string;
  storefront: string;
  query: string;
  limit?: number;
}): Promise<AppleTrackSearchResult[]> => {
  const url = new URL(
    `https://api.music.apple.com/v1/catalog/${encodeURIComponent(params.storefront)}/search`,
  );
  url.searchParams.set('types', 'songs');
  url.searchParams.set('term', params.query);
  url.searchParams.set('limit', String(params.limit ?? 10));

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: appleHeaders({
      developerToken: params.developerToken,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    throw toAppleApiError({
      action: 'search',
      statusCode: response.status,
      payload,
      wwwAuthenticate: response.headers.get('www-authenticate'),
    });
  }

  const parsed = appleSearchResponseSchema.parse(payload);
  const songs = parsed.results?.songs?.data ?? [];
  return songs.map((song) => ({
    providerTrackId: song.id,
    name: song.attributes.name,
    artist: song.attributes.artistName,
    album: song.attributes.albumName,
    durationMs: song.attributes.durationInMillis,
    artworkUrl: formatAppleArtworkUrl(song.attributes.artwork?.url),
  }));
};

export const createAppleLibraryPlaylist = async (params: {
  developerToken: string;
  musicUserToken: string;
  name: string;
  description: string;
}): Promise<AppleLibraryPlaylist> => {
  const response = await fetch('https://api.music.apple.com/v1/me/library/playlists', {
    method: 'POST',
    headers: appleHeaders({
      developerToken: params.developerToken,
      musicUserToken: params.musicUserToken,
      contentTypeJson: true,
    }),
    body: JSON.stringify({
      attributes: {
        name: params.name,
        description: params.description,
      },
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    throw toAppleApiError({
      action: 'create_playlist',
      statusCode: response.status,
      payload,
      wwwAuthenticate: response.headers.get('www-authenticate'),
    });
  }

  const parsed = appleCreatePlaylistResponseSchema.safeParse(payload);
  const playlistId = parsed.success ? parsed.data.data[0]?.id : null;
  if (!playlistId) {
    throw new ProviderApiError({
      provider: 'apple',
      statusCode: response.status,
      message: 'Apple Music did not return a library playlist id.',
      details: payload,
    });
  }

  return {
    providerPlaylistId: playlistId,
  };
};

export const addAppleTrackToPlaylist = async (params: {
  developerToken: string;
  musicUserToken: string;
  providerPlaylistId: string;
  providerTrackId: string;
}): Promise<void> => {
  const response = await fetch(
    `https://api.music.apple.com/v1/me/library/playlists/${encodeURIComponent(params.providerPlaylistId)}/tracks`,
    {
      method: 'POST',
      headers: appleHeaders({
        developerToken: params.developerToken,
        musicUserToken: params.musicUserToken,
        contentTypeJson: true,
      }),
      body: JSON.stringify({
        data: [
          {
            id: params.providerTrackId,
            type: 'songs',
          },
        ],
      }),
    },
  );

  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    throw toAppleApiError({
      action: 'add_track',
      statusCode: response.status,
      payload,
      wwwAuthenticate: response.headers.get('www-authenticate'),
    });
  }
};

const findLibraryTrackForCatalogTrack = async (params: {
  developerToken: string;
  musicUserToken: string;
  providerPlaylistId: string;
  providerTrackId: string;
}): Promise<{ libraryTrackId: string; position: number } | null> => {
  const response = await fetch(
    `https://api.music.apple.com/v1/me/library/playlists/${encodeURIComponent(
      params.providerPlaylistId,
    )}/tracks?limit=100`,
    {
      method: 'GET',
      headers: appleHeaders({
        developerToken: params.developerToken,
        musicUserToken: params.musicUserToken,
      }),
    },
  );

  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    throw toAppleApiError({
      action: 'list_playlist_tracks',
      statusCode: response.status,
      payload,
      wwwAuthenticate: response.headers.get('www-authenticate'),
    });
  }

  const parsed = applePlaylistTracksResponseSchema.parse(payload);
  const matchedIndex = parsed.data.findIndex(
    (track) =>
      track.id === params.providerTrackId ||
      track.attributes?.playParams?.catalogId === params.providerTrackId,
  );
  const matched = matchedIndex >= 0 ? parsed.data[matchedIndex] : null;

  if (!matched || matchedIndex < 0) {
    return null;
  }

  return {
    libraryTrackId: matched.id,
    position: matchedIndex,
  };
};

export const removeAppleTrackFromPlaylist = async (params: {
  developerToken: string;
  musicUserToken: string;
  providerPlaylistId: string;
  providerTrackId: string;
}): Promise<void> => {
  const libraryTrack = await findLibraryTrackForCatalogTrack(params);
  if (!libraryTrack) {
    throw new ProviderApiError({
      provider: 'apple',
      statusCode: 404,
      message: 'Track not found in Apple Music library playlist.',
      details: {
        providerPlaylistId: params.providerPlaylistId,
        providerTrackId: params.providerTrackId,
        correlationId: randomUUID(),
      },
    });
  }

  const playlistTracksBaseUrl = `https://api.music.apple.com/v1/me/library/playlists/${encodeURIComponent(
    params.providerPlaylistId,
  )}/tracks`;
  const playlistTrackRelationshipsBaseUrl = `https://api.music.apple.com/v1/me/library/playlists/${encodeURIComponent(
    params.providerPlaylistId,
  )}/relationships/tracks`;

  const readPayload = async (response: Response): Promise<unknown> => {
    const text = await response.text();
    if (!text) {
      return {};
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return {
        raw: text,
      };
    }
  };

  const attempts: Array<{
    mode: string;
    status: number;
    payload: unknown;
    wwwAuthenticate: string | null;
  }> = [];

  const deleteAttempt = async (attemptParams: {
    mode: string;
    url: string;
    body?: unknown;
  }): Promise<boolean> => {
    const response = await fetch(attemptParams.url, {
      method: 'DELETE',
      headers: appleHeaders({
        developerToken: params.developerToken,
        musicUserToken: params.musicUserToken,
        contentTypeJson: attemptParams.body !== undefined,
      }),
      body: attemptParams.body === undefined ? undefined : JSON.stringify(attemptParams.body),
    });
    if (response.ok) {
      return true;
    }

    attempts.push({
      mode: attemptParams.mode,
      status: response.status,
      payload: await readPayload(response),
      wwwAuthenticate: response.headers.get('www-authenticate'),
    });
    return false;
  };

  if (
    await deleteAttempt({
      mode: 'resource_delete',
      url: `${playlistTracksBaseUrl}/${encodeURIComponent(libraryTrack.libraryTrackId)}`,
    })
  ) {
    return;
  }

  if (
    await deleteAttempt({
      mode: 'relationship_resource_delete',
      url: `${playlistTrackRelationshipsBaseUrl}/${encodeURIComponent(libraryTrack.libraryTrackId)}`,
    })
  ) {
    return;
  }

  const relationshipDeleteAttempts: Array<{
    mode: string;
    body: unknown;
  }> = [
    {
      mode: 'relationship_delete_library_song_id',
      body: {
        data: [{ id: libraryTrack.libraryTrackId, type: 'library-songs' }],
      },
    },
    {
      mode: 'relationship_delete_catalog_song_id',
      body: {
        data: [{ id: params.providerTrackId, type: 'songs' }],
      },
    },
    {
      mode: 'relationship_delete_catalog_song_library_type',
      body: {
        data: [{ id: params.providerTrackId, type: 'library-songs' }],
      },
    },
    {
      mode: 'relationship_delete_library_song_id_no_type',
      body: {
        data: [{ id: libraryTrack.libraryTrackId }],
      },
    },
    {
      mode: 'relationship_delete_position_zero_based',
      body: {
        data: [{ position: libraryTrack.position, type: 'library-songs' }],
      },
    },
    {
      mode: 'relationship_delete_position_one_based',
      body: {
        data: [{ position: libraryTrack.position + 1, type: 'library-songs' }],
      },
    },
  ];

  for (const relationshipAttempt of relationshipDeleteAttempts) {
    if (
      await deleteAttempt({
        mode: relationshipAttempt.mode,
        url: playlistTracksBaseUrl,
        body: relationshipAttempt.body,
      })
    ) {
      return;
    }
  }

  const relationshipPathBodyAttempts: Array<{
    mode: string;
    body: unknown;
  }> = [
    {
      mode: 'relationship_path_delete_library_song_id',
      body: {
        data: [{ id: libraryTrack.libraryTrackId, type: 'library-songs' }],
      },
    },
    {
      mode: 'relationship_path_delete_catalog_song_id',
      body: {
        data: [{ id: params.providerTrackId, type: 'songs' }],
      },
    },
    {
      mode: 'relationship_path_delete_position_zero_based',
      body: {
        data: [{ position: libraryTrack.position, type: 'library-songs' }],
      },
    },
    {
      mode: 'relationship_path_delete_position_one_based',
      body: {
        data: [{ position: libraryTrack.position + 1, type: 'library-songs' }],
      },
    },
  ];

  for (const relationshipAttempt of relationshipPathBodyAttempts) {
    if (
      await deleteAttempt({
        mode: relationshipAttempt.mode,
        url: playlistTrackRelationshipsBaseUrl,
        body: relationshipAttempt.body,
      })
    ) {
      return;
    }
  }

  const finalAttempt = attempts[attempts.length - 1] ?? null;
  throw new ProviderApiError({
    provider: 'apple',
    statusCode: finalAttempt?.status ?? 502,
    message: 'Apple Music remove-track failed.',
    details: {
      action: 'remove_track',
      providerPlaylistId: params.providerPlaylistId,
      providerTrackId: params.providerTrackId,
      libraryTrackId: libraryTrack.libraryTrackId,
      libraryTrackPosition: libraryTrack.position,
      attempts,
    },
  });
};

export type { AppleTrackSearchResult };
