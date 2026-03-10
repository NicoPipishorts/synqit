import {
  integrationDisconnectResponseSchema,
  integrationListResponseSchema,
  oauthCallbackQuerySchema,
  oauthCallbackResponseSchema,
  oauthStartResponseSchema,
  providerSchema,
} from '@synqit/shared';
import type { Provider } from '@synqit/shared';
import { FastifyInstance, FastifyRequest } from 'fastify';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';

import {
  getAppleDeveloperToken,
  getAppleMusicKitIdentifierForClient,
  isAppleLiveMode,
} from './apple';
import { encryptToken } from './crypto';
import {
  buildSpotifyAuthorizationUrl,
  exchangeSpotifyAuthorizationCode,
  isSpotifyOauthLiveMode,
} from './spotify';
import { integrationStore } from './store';
import { authStore } from '../auth/store';

const DEFAULT_OAUTH_STATE_TTL_SECONDS = 10 * 60;
const DEFAULT_SPOTIFY_SCOPES =
  'playlist-read-private playlist-modify-private playlist-modify-public';
const DEFAULT_APPLE_SCOPES = 'music-library-read music-library-modify';
const DEFAULT_API_BASE_URL = 'http://localhost:3001';
const DEFAULT_WEB_APP_URL = 'http://127.0.0.1:5173';
const appleConnectRequestSchema = z.object({
  musicUserToken: z.string().min(10),
});

const parsePositiveNumber = (raw: string | undefined, fallback: number): number => {
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
};

const oauthStateTtlMs =
  parsePositiveNumber(process.env.OAUTH_STATE_TTL_SECONDS, DEFAULT_OAUTH_STATE_TTL_SECONDS) * 1000;
const OAUTH_STATE_NEXT_PATH_SEPARATOR = '.';

const parseOauthNextPath = (raw: unknown): string | null => {
  if (typeof raw !== 'string') {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed.startsWith('/')) {
    return null;
  }

  try {
    const parsed = new URL(trimmed, 'http://localhost');
    if (parsed.origin !== 'http://localhost') {
      return null;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
};

const buildOauthState = (nextPath: string | null): string => {
  const nonce = randomBytes(24).toString('base64url');
  if (!nextPath) {
    return nonce;
  }

  const encodedPath = Buffer.from(nextPath, 'utf8').toString('base64url');
  return `${nonce}${OAUTH_STATE_NEXT_PATH_SEPARATOR}${encodedPath}`;
};

const extractOauthNextPathFromState = (state: string): string | null => {
  const separatorIndex = state.lastIndexOf(OAUTH_STATE_NEXT_PATH_SEPARATOR);
  if (separatorIndex <= 0 || separatorIndex === state.length - 1) {
    return null;
  }

  const encodedPath = state.slice(separatorIndex + 1);
  try {
    const decodedPath = Buffer.from(encodedPath, 'base64url').toString('utf8');
    return parseOauthNextPath(decodedPath);
  } catch {
    return null;
  }
};

const buildMockAuthorizationUrl = (params: { provider: Provider; state: string }): string => {
  const baseUrl = process.env.API_BASE_URL ?? DEFAULT_API_BASE_URL;
  return `${baseUrl}/v1/auth/${params.provider}/callback?${new URLSearchParams({
    state: params.state,
    code: 'mock-code',
  }).toString()}`;
};

const getProviderScopes = (provider: Provider): string[] => {
  if (provider === 'spotify') {
    return (process.env.SPOTIFY_SCOPES ?? DEFAULT_SPOTIFY_SCOPES).split(/\s+/).filter(Boolean);
  }

  return (process.env.APPLE_SCOPES ?? DEFAULT_APPLE_SCOPES).split(/\s+/).filter(Boolean);
};

const getProviderAuthorizationUrl = (params: { provider: Provider; state: string }): string => {
  if (params.provider === 'spotify' && isSpotifyOauthLiveMode()) {
    return buildSpotifyAuthorizationUrl({
      state: params.state,
      scopes: process.env.SPOTIFY_SCOPES ?? DEFAULT_SPOTIFY_SCOPES,
    });
  }

  // Apple live connect uses /auth/apple/developer-token + /auth/apple/connect.
  // Keep start/callback as a local fallback path.
  return buildMockAuthorizationUrl(params);
};

const exchangeProviderAuthorizationCode = async (params: {
  provider: Provider;
  code: string;
}): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date | null;
  scopes: string[];
}> => {
  if (params.provider === 'spotify' && isSpotifyOauthLiveMode()) {
    return exchangeSpotifyAuthorizationCode(params.code);
  }

  return {
    accessToken: `mock-${params.provider}-access-${params.code}`,
    refreshToken: `mock-${params.provider}-refresh-${params.code}`,
    scopes: getProviderScopes(params.provider),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  };
};

const verifyAndGetUserId = async (
  app: FastifyInstance,
  request: FastifyRequest,
): Promise<string | null> => {
  try {
    await request.jwtVerify();
  } catch {
    return null;
  }

  if (!request.user || typeof request.user !== 'object' || !('sub' in request.user)) {
    return null;
  }

  const userId = String(request.user.sub);
  if (!userId) {
    app.log.warn('missing user id in jwt payload');
    return null;
  }

  const user = await authStore.findUserById(userId);
  if (!user) {
    app.log.warn({ userId }, 'jwt user not found');
    return null;
  }

  if (user.isBlocked) {
    app.log.warn({ userId }, 'blocked user attempted integration access');
    return null;
  }

  return userId;
};

export const registerIntegrationRoutes = async (app: FastifyInstance): Promise<void> => {
  const shouldReturnJsonFromCallback = (request: FastifyRequest): boolean => {
    const responseMode = (request.query as { response_mode?: string }).response_mode;
    if (responseMode === 'json') {
      return true;
    }
    if (responseMode === 'redirect') {
      return false;
    }

    const acceptHeader = request.headers.accept ?? '';
    return !acceptHeader.includes('text/html');
  };

  const buildWebRedirectUrl = (params: {
    path: string;
    provider: string;
    status: 'connected' | 'error';
  }): string => {
    const baseUrl = process.env.WEB_APP_URL ?? DEFAULT_WEB_APP_URL;
    const redirectUrl = new URL(params.path, baseUrl);
    redirectUrl.searchParams.set('provider', params.provider);
    redirectUrl.searchParams.set('status', params.status);
    return redirectUrl.toString();
  };

  const buildProvidersRedirectUrl = (params: {
    provider: string;
    status: 'connected' | 'error';
  }): string =>
    buildWebRedirectUrl({
      path: '/profile/platforms',
      provider: params.provider,
      status: params.status,
    });

  app.get('/integrations', async (request, reply) => {
    const userId = await verifyAndGetUserId(app, request);
    if (!userId) {
      return reply.status(401).send({
        code: 'unauthorized',
        message: 'Authentication required.',
      });
    }

    const existingIntegrations = await integrationStore.listIntegrationsByUser(userId);

    const integrations = providerSchema.options.map((provider) => {
      const integration = existingIntegrations.find((item) => item.provider === provider);
      return {
        provider,
        status: integration ? 'connected' : 'not_connected',
        connectedAt: integration ? integration.createdAt.toISOString() : null,
        expiresAt: integration?.expiresAt?.toISOString() ?? null,
      } as const;
    });

    return integrationListResponseSchema.parse({
      integrations,
    });
  });

  app.get('/auth/apple/developer-token', async (request, reply) => {
    const userId = await verifyAndGetUserId(app, request);
    if (!userId) {
      return reply.status(401).send({
        code: 'unauthorized',
        message: 'Authentication required.',
      });
    }

    if (!isAppleLiveMode()) {
      return reply.status(400).send({
        code: 'provider_auth_not_configured',
        message:
          'Apple Music auth is not configured. Set APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_MUSICKIT_IDENTIFIER, and APPLE_PRIVATE_KEY_P8.',
      });
    }

    try {
      const developerToken = await getAppleDeveloperToken();
      return {
        provider: 'apple',
        developerToken,
        musicKitIdentifier: getAppleMusicKitIdentifierForClient(),
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Apple developer token generation failed.';
      return reply.status(500).send({
        code: 'provider_token_generation_failed',
        message,
      });
    }
  });

  app.post('/auth/apple/connect', async (request, reply) => {
    const userId = await verifyAndGetUserId(app, request);
    if (!userId) {
      return reply.status(401).send({
        code: 'unauthorized',
        message: 'Authentication required.',
      });
    }

    if (!isAppleLiveMode()) {
      return reply.status(400).send({
        code: 'provider_auth_not_configured',
        message:
          'Apple Music auth is not configured. Set APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_MUSICKIT_IDENTIFIER, and APPLE_PRIVATE_KEY_P8.',
      });
    }

    const parsedBody = appleConnectRequestSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send({
        code: 'validation_error',
        message: 'Apple connect payload is invalid.',
        details: parsedBody.error.flatten(),
      });
    }

    const integration = await integrationStore.upsertIntegration({
      userId,
      provider: 'apple',
      accessToken: encryptToken(parsedBody.data.musicUserToken),
      refreshToken: encryptToken(parsedBody.data.musicUserToken),
      scopes: getProviderScopes('apple'),
      expiresAt: null,
    });

    return oauthCallbackResponseSchema.parse({
      ok: true,
      provider: integration.provider,
      connectedAt: integration.createdAt.toISOString(),
      expiresAt: integration.expiresAt?.toISOString() ?? null,
    });
  });

  app.get('/auth/:provider/start', async (request, reply) => {
    const userId = await verifyAndGetUserId(app, request);
    if (!userId) {
      return reply.status(401).send({
        code: 'unauthorized',
        message: 'Authentication required.',
      });
    }

    const providerResult = providerSchema.safeParse(
      (request.params as { provider?: string }).provider,
    );
    if (!providerResult.success) {
      return reply.status(400).send({
        code: 'invalid_provider',
        message: 'Provider is not supported.',
      });
    }

    const nextPath = parseOauthNextPath((request.query as { next?: string }).next);
    const oauthState = await integrationStore.createPendingOauthState({
      userId,
      provider: providerResult.data,
      ttlMs: oauthStateTtlMs,
      state: buildOauthState(nextPath),
    });

    const authorizationUrl = getProviderAuthorizationUrl({
      provider: providerResult.data,
      state: oauthState.state,
    });

    return oauthStartResponseSchema.parse({
      provider: providerResult.data,
      state: oauthState.state,
      authorizationUrl,
    });
  });

  app.get('/auth/:provider/callback', async (request, reply) => {
    const providerResult = providerSchema.safeParse(
      (request.params as { provider?: string }).provider,
    );
    if (!providerResult.success) {
      return reply.status(400).send({
        code: 'invalid_provider',
        message: 'Provider is not supported.',
      });
    }

    const queryResult = oauthCallbackQuerySchema.safeParse(request.query);
    if (!queryResult.success) {
      return reply.status(400).send({
        code: 'invalid_callback_query',
        message: 'Missing or invalid callback parameters.',
        details: queryResult.error.flatten(),
      });
    }

    const oauthState = await integrationStore.consumePendingOauthState({
      state: queryResult.data.state,
      provider: providerResult.data,
    });
    const nextPath = extractOauthNextPathFromState(queryResult.data.state);

    if (!oauthState) {
      return reply.status(400).send({
        code: 'invalid_oauth_state',
        message: 'OAuth state is invalid or expired.',
      });
    }

    let tokenExchangeResult: {
      accessToken: string;
      refreshToken: string;
      expiresAt: Date | null;
      scopes: string[];
    };

    try {
      tokenExchangeResult = await exchangeProviderAuthorizationCode({
        provider: providerResult.data,
        code: queryResult.data.code,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Token exchange failed.';
      return reply.status(502).send({
        code: 'provider_token_exchange_failed',
        message,
      });
    }

    const integration = await integrationStore.upsertIntegration({
      userId: oauthState.userId,
      provider: providerResult.data,
      accessToken: encryptToken(tokenExchangeResult.accessToken),
      refreshToken: encryptToken(tokenExchangeResult.refreshToken),
      scopes: tokenExchangeResult.scopes,
      expiresAt: tokenExchangeResult.expiresAt,
    });

    const callbackResponse = oauthCallbackResponseSchema.parse({
      ok: true,
      provider: integration.provider,
      connectedAt: integration.createdAt.toISOString(),
      expiresAt: integration.expiresAt?.toISOString() ?? null,
    });

    if (shouldReturnJsonFromCallback(request)) {
      return callbackResponse;
    }

    if (nextPath) {
      return reply.redirect(
        buildWebRedirectUrl({
          path: nextPath,
          provider: integration.provider,
          status: 'connected',
        }),
        302,
      );
    }

    return reply.redirect(
      buildProvidersRedirectUrl({ provider: integration.provider, status: 'connected' }),
      302,
    );
  });

  app.post('/auth/:provider/disconnect', async (request, reply) => {
    const userId = await verifyAndGetUserId(app, request);
    if (!userId) {
      return reply.status(401).send({
        code: 'unauthorized',
        message: 'Authentication required.',
      });
    }

    const providerResult = providerSchema.safeParse(
      (request.params as { provider?: string }).provider,
    );
    if (!providerResult.success) {
      return reply.status(400).send({
        code: 'invalid_provider',
        message: 'Provider is not supported.',
      });
    }

    const disconnected = await integrationStore.disconnectIntegration({
      userId,
      provider: providerResult.data,
    });

    return integrationDisconnectResponseSchema.parse({
      ok: true,
      provider: providerResult.data,
      disconnected,
    });
  });
};
