import { z } from 'zod';

const spotifyPlaylistCreateResponseSchema = z.object({
  id: z.string().min(1),
});

const spotifyCurrentUserResponseSchema = z.object({
  id: z.string().min(1),
});

const spotifyPlaylistSummaryResponseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
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
  ownerId: string;
  isPublic: boolean;
  collaborative: boolean;
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
    const fallbackMessage = `Spotify playlist creation failed with status ${response.status}.`;
    if (
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      payload.error &&
      typeof payload.error === 'object' &&
      'message' in payload.error &&
      typeof payload.error.message === 'string'
    ) {
      throw new Error(payload.error.message);
    }

    throw new Error(fallbackMessage);
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
    throw new Error(`Spotify current-user lookup failed with status ${response.status}.`);
  }

  const parsed = spotifyCurrentUserResponseSchema.parse(payload);
  return {
    id: parsed.id,
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
    throw new Error(`Spotify playlist lookup failed with status ${response.status}.`);
  }

  const parsed = spotifyPlaylistSummaryResponseSchema.parse(payload);
  return {
    id: parsed.id,
    name: parsed.name,
    ownerId: parsed.owner.id,
    isPublic: parsed.public === true,
    collaborative: parsed.collaborative,
  };
};
