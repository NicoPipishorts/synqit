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
import { integrationStore } from './store';

const DEFAULT_OAUTH_STATE_TTL_SECONDS = 10 * 60;
const DEFAULT_SPOTIFY_AUTH_BASE_URL = 'https://accounts.spotify.com/authorize';
const DEFAULT_SPOTIFY_SCOPES =
  'playlist-read-private playlist-modify-private playlist-modify-public';

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

const buildAuthorizationUrl = (params: { provider: 'spotify'; state: string }): string => {
  const spotifyClientId = process.env.SPOTIFY_CLIENT_ID ?? 'mock-spotify-client-id';
  const spotifyRedirectUri =
    process.env.SPOTIFY_REDIRECT_URI ?? 'http://localhost:3001/v1/auth/spotify/callback';
  const spotifyScopes = process.env.SPOTIFY_SCOPES ?? DEFAULT_SPOTIFY_SCOPES;
  const baseUrl = process.env.SPOTIFY_AUTH_BASE_URL ?? DEFAULT_SPOTIFY_AUTH_BASE_URL;

  const authorizationUrl = new URL(baseUrl);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('client_id', spotifyClientId);
  authorizationUrl.searchParams.set('redirect_uri', spotifyRedirectUri);
  authorizationUrl.searchParams.set('scope', spotifyScopes);
  authorizationUrl.searchParams.set('state', params.state);
  authorizationUrl.searchParams.set('show_dialog', 'true');

  return authorizationUrl.toString();
};

export const registerIntegrationRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get('/integrations', async (request, reply) => {
    const userId = await verifyAndGetUserId(app, request);
    if (!userId) {
      return reply.status(401).send({
        code: 'unauthorized',
        message: 'Authentication required.',
      });
    }

    const existingIntegrations = integrationStore.listIntegrationsByUser(userId);

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

    const oauthState = integrationStore.createPendingOauthState({
      userId,
      provider: providerResult.data,
      ttlMs: oauthStateTtlMs,
    });

    const authorizationUrl = buildAuthorizationUrl({
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

    const oauthState = integrationStore.consumePendingOauthState({
      state: queryResult.data.state,
      provider: providerResult.data,
    });

    if (!oauthState) {
      return reply.status(400).send({
        code: 'invalid_oauth_state',
        message: 'OAuth state is invalid or expired.',
      });
    }

    const accessToken = `mock-${providerResult.data}-access-${queryResult.data.code}`;
    const refreshToken = `mock-${providerResult.data}-refresh-${queryResult.data.code}`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const integration = integrationStore.upsertIntegration({
      userId: oauthState.userId,
      provider: providerResult.data,
      accessToken: encryptToken(accessToken),
      refreshToken: encryptToken(refreshToken),
      scopes: (process.env.SPOTIFY_SCOPES ?? DEFAULT_SPOTIFY_SCOPES).split(' '),
      expiresAt,
    });

    return oauthCallbackResponseSchema.parse({
      ok: true,
      provider: integration.provider,
      connectedAt: integration.createdAt.toISOString(),
      expiresAt: integration.expiresAt?.toISOString() ?? null,
    });
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

    const disconnected = integrationStore.disconnectIntegration({
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
