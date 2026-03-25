import type { ProviderPlaylistItem } from '@synqit/shared';
import { z } from 'zod';

import { ProviderApiError } from './spotify-tracks';

const spotifyPlaylistCreateResponseSchema = z.object({
  id: z.string().min(1),
});

const spotifyCurrentUserResponseSchema = z.object({
  id: z.string().min(1),
});

const spotifyPlaylistSummaryResponseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  snapshot_id: z.string().min(1),
  public: z.boolean().nullable(),
  collaborative: z.boolean(),
  owner: z.object({
    id: z.string().min(1),
  }),
});

type CreateSpotifyPlaylistParams = {
  accessToken: string;
  name: string;
  description: string;
};

type CreatedSpotifyPlaylist = {
  providerPlaylistId: string;
};

type SpotifyCurrentUser = {
  id: string;
};

type SpotifyPlaylistSummary = {
  id: string;
  name: string;
  snapshotId: string;
  ownerId: string;
  isPublic: boolean;
  collaborative: boolean;
};

const toSpotifyPlaylistApiError = (params: {
  action: 'current_user' | 'list_user_playlists' | 'playlist_summary' | 'create_playlist';
  statusCode: number;
  payload: unknown;
  wwwAuthenticate: string | null;
}): ProviderApiError => {
  const fallbackMessage =
    params.action === 'current_user'
      ? `Spotify current-user lookup failed with status ${params.statusCode}.`
      : params.action === 'list_user_playlists'
        ? `Spotify user playlists fetch failed with status ${params.statusCode}.`
        : params.action === 'playlist_summary'
          ? `Spotify playlist lookup failed with status ${params.statusCode}.`
          : `Spotify playlist creation failed with status ${params.statusCode}.`;

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

export const createSpotifyPlaylist = async (
  params: CreateSpotifyPlaylistParams,
): Promise<CreatedSpotifyPlaylist> => {
  const response = await fetch('https://api.spotify.com/v1/me/playlists', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${params.accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      name: params.name,
      description: params.description,
      public: false,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    throw toSpotifyPlaylistApiError({
      action: 'create_playlist',
      statusCode: response.status,
      payload,
      wwwAuthenticate: response.headers.get('www-authenticate'),
    });
  }

  const parsed = spotifyPlaylistCreateResponseSchema.parse(payload);
  return {
    providerPlaylistId: parsed.id,
  };
};

export const getSpotifyCurrentUser = async (params: {
  accessToken: string;
}): Promise<SpotifyCurrentUser> => {
  const response = await fetch('https://api.spotify.com/v1/me', {
    method: 'GET',
    headers: {
      authorization: `Bearer ${params.accessToken}`,
    },
  });

  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    throw toSpotifyPlaylistApiError({
      action: 'current_user',
      statusCode: response.status,
      payload,
      wwwAuthenticate: response.headers.get('www-authenticate'),
    });
  }

  const parsed = spotifyCurrentUserResponseSchema.parse(payload);
  return {
    id: parsed.id,
  };
};

const spotifyUserPlaylistsResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string(),
      tracks: z.object({ total: z.number().int().nonnegative() }).nullable().optional(),
      images: z
        .array(z.object({ url: z.string() }))
        .nullable()
        .optional()
        .transform((value) => value ?? []),
    }),
  ),
  next: z.string().nullable().optional(),
});

export const listSpotifyUserPlaylists = async (params: {
  accessToken: string;
  limit: number;
  offset: number;
}): Promise<{ playlists: ProviderPlaylistItem[]; hasMore: boolean }> => {
  const url = new URL('https://api.spotify.com/v1/me/playlists');
  url.searchParams.set('limit', String(Math.min(params.limit, 50)));
  url.searchParams.set('offset', String(params.offset));

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { authorization: `Bearer ${params.accessToken}` },
  });

  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    throw toSpotifyPlaylistApiError({
      action: 'list_user_playlists',
      statusCode: response.status,
      payload,
      wwwAuthenticate: response.headers.get('www-authenticate'),
    });
  }

  const parsed = spotifyUserPlaylistsResponseSchema.parse(payload);
  return {
    playlists: parsed.items.map((item) => ({
      providerPlaylistId: item.id,
      name: item.name,
      trackCount: item.tracks?.total ?? null,
      coverImageUrl: item.images[0]?.url ?? null,
    })),
    hasMore: !!parsed.next,
  };
};

export const getSpotifyPlaylistSummary = async (params: {
  accessToken: string;
  providerPlaylistId: string;
}): Promise<SpotifyPlaylistSummary> => {
  const response = await fetch(
    `https://api.spotify.com/v1/playlists/${encodeURIComponent(params.providerPlaylistId)}`,
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${params.accessToken}`,
      },
    },
  );

  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    throw toSpotifyPlaylistApiError({
      action: 'playlist_summary',
      statusCode: response.status,
      payload,
      wwwAuthenticate: response.headers.get('www-authenticate'),
    });
  }

  const parsed = spotifyPlaylistSummaryResponseSchema.parse(payload);
  return {
    id: parsed.id,
    name: parsed.name,
    snapshotId: parsed.snapshot_id,
    ownerId: parsed.owner.id,
    isPublic: parsed.public === true,
    collaborative: parsed.collaborative,
  };
};
