import {
  integrationDisconnectResponseSchema,
  integrationListResponseSchema,
  oauthCallbackQuerySchema,
  oauthCallbackResponseSchema,
  oauthStartResponseSchema,
  providerSchema,
} from '@synqit/shared';
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

    const authorizationUrl = isSpotifyOauthLiveMode()
      ? buildSpotifyAuthorizationUrl({
          state: oauthState.state,
          scopes: process.env.SPOTIFY_SCOPES ?? DEFAULT_SPOTIFY_SCOPES,
        })
      : `${process.env.API_BASE_URL ?? DEFAULT_API_BASE_URL}/v1/auth/${
          providerResult.data
        }/callback?${new URLSearchParams({
          state: oauthState.state,
          code: 'mock-code',
        }).toString()}`;

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

    if (isSpotifyOauthLiveMode()) {
      try {
        tokenExchangeResult = await exchangeSpotifyAuthorizationCode(queryResult.data.code);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Token exchange failed.';
        return reply.status(502).send({
          code: 'provider_token_exchange_failed',
          message,
        });
      }
    } else {
      tokenExchangeResult = {
        accessToken: `mock-${providerResult.data}-access-${queryResult.data.code}`,
        refreshToken: `mock-${providerResult.data}-refresh-${queryResult.data.code}`,
        scopes: (process.env.SPOTIFY_SCOPES ?? DEFAULT_SPOTIFY_SCOPES).split(' '),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      };
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
