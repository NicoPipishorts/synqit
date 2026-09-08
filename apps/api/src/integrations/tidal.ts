import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';

/**
 * TIDAL OAuth. Unlike Spotify, user-scoped access is authorization code with
 * PKCE, so the code verifier generated at `start` has to survive until the
 * callback (stored alongside the OAuth state).
 */

type TidalOauthTokens = {
  accessToken: string;
  refreshToken: string;
  scopes: string[];
  expiresAt: Date | null;
};

type TidalRefreshTokens = {
  accessToken: string;
  refreshToken: string | null;
  scopes: string[];
  expiresAt: Date | null;
};

const DEFAULT_AUTHORIZE_URL = 'https://login.tidal.com/authorize';
const DEFAULT_TOKEN_URL = 'https://auth.tidal.com/v1/oauth2/token';
const DEFAULT_REDIRECT_URI = 'http://127.0.0.1:3001/v1/auth/tidal/callback';

/** Read and write playlists, plus catalogue search for track matching. */
export const DEFAULT_TIDAL_SCOPES = 'playlists.read playlists.write collection.read user.read';

const tidalTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().min(1).optional(),
  scope: z.string().optional().default(''),
  expires_in: z.number().int().positive().optional(),
  refresh_token: z.string().min(1).optional(),
});

const tidalErrorResponseSchema = z.object({
  error: z.string().optional(),
  error_description: z.string().optional(),
  errors: z.array(z.object({ detail: z.string().optional() })).optional(),
});

const isUnset = (value: string | undefined): boolean =>
  !value || value.trim() === '' || value.trim() === 'replace-me';

const getClientId = (): string => process.env.TIDAL_CLIENT_ID ?? '';
const getClientSecret = (): string => process.env.TIDAL_CLIENT_SECRET ?? '';
const getRedirectUri = (): string => process.env.TIDAL_REDIRECT_URI ?? DEFAULT_REDIRECT_URI;

/** Catalogue lookups are country-scoped; TIDAL rejects the call without one. */
export const getTidalCountryCode = (): string =>
  (process.env.TIDAL_COUNTRY_CODE ?? 'FR').trim().toUpperCase().slice(0, 2);

/** A client id is enough: PKCE makes the secret optional for public clients. */
export const isTidalOauthLiveMode = (): boolean => !isUnset(getClientId());

export type TidalPkcePair = { codeVerifier: string; codeChallenge: string };

/** RFC 7636 S256 pair. The verifier is stored; only the challenge is sent. */
export const createTidalPkcePair = (): TidalPkcePair => {
  const codeVerifier = randomBytes(48).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
};

export const buildTidalAuthorizationUrl = (params: {
  state: string;
  scopes: string;
  codeChallenge: string;
}): string => {
  const url = new URL(process.env.TIDAL_AUTH_BASE_URL ?? DEFAULT_AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', getClientId());
  url.searchParams.set('redirect_uri', getRedirectUri());
  url.searchParams.set('scope', params.scopes);
  url.searchParams.set('state', params.state);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('code_challenge', params.codeChallenge);
  return url.toString();
};

const notConfigured = (): Error =>
  new Error('TIDAL OAuth is not configured. Set TIDAL_CLIENT_ID (and TIDAL_CLIENT_SECRET).');

const describeTokenError = (payload: unknown, fallback: string): string => {
  const parsed = tidalErrorResponseSchema.safeParse(payload);
  if (!parsed.success) {
    return fallback;
  }
  return (
    parsed.data.error_description ??
    parsed.data.errors?.[0]?.detail ??
    (parsed.data.error ? `TIDAL token error: ${parsed.data.error}` : fallback)
  );
};

const postToken = async (body: URLSearchParams, fallbackMessage: string) => {
  const tokenUrl = process.env.TIDAL_TOKEN_URL ?? DEFAULT_TOKEN_URL;
  const headers: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded',
  };

  // Confidential clients authenticate with Basic; public PKCE clients send the
  // client id in the body instead.
  const clientSecret = getClientSecret();
  if (!isUnset(clientSecret)) {
    headers.authorization = `Basic ${Buffer.from(`${getClientId()}:${clientSecret}`).toString('base64')}`;
  } else {
    body.set('client_id', getClientId());
  }

  const response = await fetch(tokenUrl, { method: 'POST', headers, body });
  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    throw new Error(describeTokenError(payload, fallbackMessage));
  }
  return tidalTokenResponseSchema.parse(payload);
};

const toScopes = (scope: string): string[] => (scope.trim() ? scope.split(/\s+/) : []);

const toExpiry = (expiresIn: number | undefined): Date | null =>
  typeof expiresIn === 'number' ? new Date(Date.now() + expiresIn * 1000) : null;

export const exchangeTidalAuthorizationCode = async (params: {
  code: string;
  codeVerifier: string;
}): Promise<TidalOauthTokens> => {
  if (!isTidalOauthLiveMode()) {
    throw notConfigured();
  }

  const parsed = await postToken(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: getRedirectUri(),
      code_verifier: params.codeVerifier,
    }),
    'TIDAL token exchange failed.',
  );

  return {
    accessToken: parsed.access_token,
    // TIDAL always returns a refresh token for this flow; fall back so the
    // stored record is never empty.
    refreshToken: parsed.refresh_token ?? parsed.access_token,
    scopes: toScopes(parsed.scope),
    expiresAt: toExpiry(parsed.expires_in),
  };
};

export const refreshTidalAccessToken = async (
  refreshToken: string,
): Promise<TidalRefreshTokens> => {
  if (!isTidalOauthLiveMode()) {
    throw notConfigured();
  }

  const parsed = await postToken(
    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    'TIDAL token refresh failed.',
  );

  return {
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token ?? null,
    scopes: toScopes(parsed.scope),
    expiresAt: toExpiry(parsed.expires_in),
  };
};

export type { TidalOauthTokens, TidalRefreshTokens };
