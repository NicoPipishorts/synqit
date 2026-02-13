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

import { encryptToken } from './crypto';
import {
  buildSpotifyAuthorizationUrl,
  exchangeSpotifyAuthorizationCode,
  isSpotifyOauthLiveMode,
} from './spotify';
import { integrationStore } from './store';

const DEFAULT_OAUTH_STATE_TTL_SECONDS = 10 * 60;
const DEFAULT_SPOTIFY_SCOPES =
  'playlist-read-private playlist-modify-private playlist-modify-public';
const DEFAULT_APPLE_SCOPES = 'music-library-read music-library-modify';
const DEFAULT_API_BASE_URL = 'http://localhost:3001';
const DEFAULT_WEB_APP_URL = 'http://127.0.0.1:5173';

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

  // Apple connect currently uses local mock callback flow until MusicKit auth is implemented.
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

  const buildProvidersRedirectUrl = (params: {
    provider: string;
    status: 'connected' | 'error';
  }): string => {
    const baseUrl = process.env.WEB_APP_URL ?? DEFAULT_WEB_APP_URL;
    const redirectUrl = new URL('/providers', baseUrl);
    redirectUrl.searchParams.set('provider', params.provider);
    redirectUrl.searchParams.set('status', params.status);
    return redirectUrl.toString();
  };

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

    const oauthState = await integrationStore.createPendingOauthState({
      userId,
      provider: providerResult.data,
      ttlMs: oauthStateTtlMs,
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
