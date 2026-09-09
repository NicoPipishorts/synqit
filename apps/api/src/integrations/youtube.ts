import { z } from 'zod';

/**
 * YouTube Music OAuth. YouTube Music playlists are YouTube playlists, so the
 * connection is a plain Google OAuth 2.0 authorization code flow against the
 * YouTube Data API v3. Google only issues a refresh token when the consent
 * screen is shown with `access_type=offline`, hence `prompt=consent` on every
 * start: a reconnect would otherwise leave us with an hour-long token and no
 * way to renew it.
 */

type YoutubeOauthTokens = {
  accessToken: string;
  refreshToken: string;
  scopes: string[];
  expiresAt: Date | null;
};

type YoutubeRefreshTokens = {
  accessToken: string;
  refreshToken: string | null;
  scopes: string[];
  expiresAt: Date | null;
};

const DEFAULT_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const DEFAULT_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DEFAULT_REDIRECT_URI = 'http://127.0.0.1:3001/v1/auth/youtube/callback';

/**
 * Manage the user's YouTube account: read and write playlists. Google marks this
 * scope as sensitive, so the OAuth client has to pass brand verification before
 * more than the test-user allowlist can connect.
 */
export const DEFAULT_YOUTUBE_SCOPES = 'https://www.googleapis.com/auth/youtube';

const youtubeTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().min(1).optional(),
  scope: z.string().optional().default(''),
  expires_in: z.number().int().positive().optional(),
  refresh_token: z.string().min(1).optional(),
});

const youtubeErrorResponseSchema = z.object({
  error: z.string().optional(),
  error_description: z.string().optional(),
});

const isUnset = (value: string | undefined): boolean =>
  !value || value.trim() === '' || value.trim() === 'replace-me';

const getClientId = (): string => process.env.YOUTUBE_CLIENT_ID ?? '';
const getClientSecret = (): string => process.env.YOUTUBE_CLIENT_SECRET ?? '';
const getRedirectUri = (): string => process.env.YOUTUBE_REDIRECT_URI ?? DEFAULT_REDIRECT_URI;

/** Google web clients are confidential: both the id and the secret are required. */
export const isYoutubeOauthLiveMode = (): boolean =>
  !isUnset(getClientId()) && !isUnset(getClientSecret());

export const buildYoutubeAuthorizationUrl = (params: { state: string; scopes: string }): string => {
  const url = new URL(process.env.YOUTUBE_AUTH_BASE_URL ?? DEFAULT_AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', getClientId());
  url.searchParams.set('redirect_uri', getRedirectUri());
  url.searchParams.set('scope', params.scopes);
  url.searchParams.set('state', params.state);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  return url.toString();
};

const notConfigured = (): Error =>
  new Error(
    'YouTube Music OAuth is not configured. Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET.',
  );

const describeTokenError = (payload: unknown, fallback: string): string => {
  const parsed = youtubeErrorResponseSchema.safeParse(payload);
  if (!parsed.success) {
    return fallback;
  }
  return (
    parsed.data.error_description ??
    (parsed.data.error ? `Google token error: ${parsed.data.error}` : fallback)
  );
};

const postToken = async (body: URLSearchParams, fallbackMessage: string) => {
  const tokenUrl = process.env.YOUTUBE_TOKEN_URL ?? DEFAULT_TOKEN_URL;
  body.set('client_id', getClientId());
  body.set('client_secret', getClientSecret());

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    throw new Error(describeTokenError(payload, fallbackMessage));
  }
  return youtubeTokenResponseSchema.parse(payload);
};

const toScopes = (scope: string): string[] => (scope.trim() ? scope.split(/\s+/) : []);

const toExpiry = (expiresIn: number | undefined): Date | null =>
  typeof expiresIn === 'number' ? new Date(Date.now() + expiresIn * 1000) : null;

export const exchangeYoutubeAuthorizationCode = async (
  code: string,
): Promise<YoutubeOauthTokens> => {
  if (!isYoutubeOauthLiveMode()) {
    throw notConfigured();
  }

  const parsed = await postToken(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
    }),
    'Google token exchange failed.',
  );

  if (!parsed.refresh_token) {
    // Without a refresh token the connection would silently die in an hour.
    // Google withholds it when consent was not re-prompted; the start URL asks
    // for it every time, so reaching here means the client is misconfigured.
    throw new Error('Google did not return a refresh token. Reconnect YouTube Music.');
  }

  return {
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token,
    scopes: toScopes(parsed.scope),
    expiresAt: toExpiry(parsed.expires_in),
  };
};

export const refreshYoutubeAccessToken = async (
  refreshToken: string,
): Promise<YoutubeRefreshTokens> => {
  if (!isYoutubeOauthLiveMode()) {
    throw notConfigured();
  }

  const parsed = await postToken(
    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    'Google token refresh failed.',
  );

  return {
    accessToken: parsed.access_token,
    // Google does not rotate refresh tokens; the stored one stays valid.
    refreshToken: parsed.refresh_token ?? null,
    scopes: toScopes(parsed.scope),
    expiresAt: toExpiry(parsed.expires_in),
  };
};

export type { YoutubeOauthTokens, YoutubeRefreshTokens };
