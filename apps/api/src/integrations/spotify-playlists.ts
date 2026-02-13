import { z } from 'zod';

const spotifyPlaylistCreateResponseSchema = z.object({
  id: z.string().min(1),
});

type CreateSpotifyPlaylistParams = {
  accessToken: string;
  name: string;
  description: string;
};

type CreatedSpotifyPlaylist = {
  providerPlaylistId: string;
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
