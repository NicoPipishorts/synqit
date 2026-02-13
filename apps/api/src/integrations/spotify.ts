import { z } from 'zod';

type SpotifyOauthTokens = {
  accessToken: string;
  refreshToken: string;
  scopes: string[];
  expiresAt: Date | null;
};

const spotifyTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().min(1),
  scope: z.string().optional().default(''),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().min(1).optional(),
});

const spotifyErrorResponseSchema = z.object({
  error: z.string(),
  error_description: z.string().optional(),
});

const isUnset = (value: string | undefined): boolean =>
  !value || value.trim() === '' || value.trim() === 'replace-me';

const getSpotifyClientId = (): string => process.env.SPOTIFY_CLIENT_ID ?? '';
const getSpotifyClientSecret = (): string => process.env.SPOTIFY_CLIENT_SECRET ?? '';
const getSpotifyRedirectUri = (): string =>
  process.env.SPOTIFY_REDIRECT_URI ?? 'http://127.0.0.1:3001/v1/auth/spotify/callback';

export const isSpotifyOauthLiveMode = (): boolean =>
  !isUnset(getSpotifyClientId()) && !isUnset(getSpotifyClientSecret());

export const buildSpotifyAuthorizationUrl = (params: { state: string; scopes: string }): string => {
  const authorizationUrl = new URL(
    process.env.SPOTIFY_AUTH_BASE_URL ?? 'https://accounts.spotify.com/authorize',
  );
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('client_id', getSpotifyClientId());
  authorizationUrl.searchParams.set('redirect_uri', getSpotifyRedirectUri());
  authorizationUrl.searchParams.set('scope', params.scopes);
  authorizationUrl.searchParams.set('state', params.state);
  authorizationUrl.searchParams.set('show_dialog', 'true');

  return authorizationUrl.toString();
};

export const exchangeSpotifyAuthorizationCode = async (
  code: string,
): Promise<SpotifyOauthTokens> => {
  if (!isSpotifyOauthLiveMode()) {
    throw new Error(
      'Spotify OAuth is not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.',
    );
  }

  const tokenUrl = process.env.SPOTIFY_TOKEN_URL ?? 'https://accounts.spotify.com/api/token';
  const clientId = getSpotifyClientId();
  const clientSecret = getSpotifyClientSecret();
  const redirectUri = getSpotifyRedirectUri();

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      authorization: `Basic ${basicAuth}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const payload = (await response.json().catch(() => ({}))) as unknown;

  if (!response.ok) {
    const parsedError = spotifyErrorResponseSchema.safeParse(payload);
    if (parsedError.success) {
      throw new Error(
        parsedError.data.error_description ?? `Spotify token error: ${parsedError.data.error}`,
      );
    }

    throw new Error('Spotify token exchange failed.');
  }

  const parsed = spotifyTokenResponseSchema.parse(payload);

  return {
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token ?? parsed.access_token,
    scopes: parsed.scope.trim() ? parsed.scope.split(/\s+/) : [],
    expiresAt: new Date(Date.now() + parsed.expires_in * 1000),
  };
};

export type { SpotifyOauthTokens };
