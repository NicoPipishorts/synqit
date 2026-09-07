import './env';

import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { EnvValidationError, healthResponseSchema } from '@synqit/shared';
import Fastify from 'fastify';

import { registerAdminRoutes } from './admin/routes';
import { registerAnalyticsRoutes } from './analytics/routes';
import { registerAuthRoutes } from './auth/routes';
import { hasValidCsrfToken, shouldEnforceCsrfForRequest } from './auth/session-cookies';
import { loadApiConfig } from './config';
import { registerDashboardRoutes } from './dashboard/routes';
import { initializeDatabase } from './db';
import { registerEventRoutes } from './events/routes';
import { registerIntegrationRoutes } from './integrations/routes';
import { startAccountDeletionScheduler } from './jobs/account-deletion';
import { closeNotificationsQueue } from './jobs/notifications-queue';
import { closeTransfersQueue } from './jobs/transfers-queue';
import { startWeeklyRecapScheduler } from './jobs/weekly-recap';
import { registerMetricsEndpoint } from './observability/metrics';
import { startAutoSyncScheduler } from './syncs/auto-sync';
import { registerSyncRoutes } from './syncs/routes';
import { startTransferWorker } from './syncs/transfer-worker';

const APP_VERSION = process.env.APP_VERSION ?? '0.1.0';
const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';

const parseCorsOrigins = (raw: string | undefined): string[] => {
  if (!raw) {
    return ['http://localhost:5173', 'http://127.0.0.1:5173'];
  }

  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

export const buildServer = async () => {
  // Fail fast on missing or weak secrets before touching the database or a port.
  const config = loadApiConfig();
  await initializeDatabase();

  const app = Fastify({
    logger: true,
  });
  for (const warning of config.warnings) {
    app.log.warn(warning);
  }
  const rateLimitMax = Number(process.env.RATE_LIMIT_MAX ?? 150);
  const rateLimitTimeWindow = process.env.RATE_LIMIT_TIME_WINDOW ?? '1 minute';

  await app.register(helmet);
  await app.register(cors, {
    origin: parseCorsOrigins(process.env.CORS_ORIGINS),
    credentials: true,
  });
  // The marketing site sends analytics beacons as `text/plain` (CORS-safelisted,
  // so cross-origin `sendBeacon` skips preflight and survives unload). Parse the
  // string body as JSON so those events reach the normal analytics handler.
  app.addContentTypeParser('text/plain', { parseAs: 'string' }, (_req, body, done) => {
    try {
      done(null, body ? JSON.parse(body as string) : {});
    } catch (error) {
      done(error as Error, undefined);
    }
  });
  await app.register(rateLimit, {
    max: Number.isFinite(rateLimitMax) && rateLimitMax > 0 ? Math.floor(rateLimitMax) : 150,
    timeWindow: rateLimitTimeWindow,
  });
  await app.register(jwt, {
    secret: config.jwtAccessSecret,
  });
  app.addHook('onRequest', async (request, reply) => {
    const scope = request.url.startsWith('/v1/admin/') ? 'admin' : 'web';
    if (!shouldEnforceCsrfForRequest(request, scope)) {
      return;
    }

    if (hasValidCsrfToken(request, scope)) {
      return;
    }

    return reply.status(403).send({
      code: 'csrf_invalid',
      message: 'CSRF validation failed.',
    });
  });
  // Interactive API docs are a dev tool. Off in production unless API_DOCS_ENABLED=true.
  if (config.docsEnabled) {
    await app.register(swagger, {
      openapi: {
        info: {
          title: 'Synqit API',
          version: APP_VERSION,
        },
      },
    });
    await app.register(swaggerUi, {
      routePrefix: '/docs',
    });
  }

  app.setErrorHandler((error, _request, reply) => {
    const normalizedError =
      error && typeof error === 'object'
        ? (error as { statusCode?: number; code?: string; message?: string })
        : undefined;

    const statusCode =
      typeof normalizedError?.statusCode === 'number' &&
      normalizedError.statusCode >= 400 &&
      normalizedError.statusCode < 600
        ? normalizedError.statusCode
        : 500;

    // Never leak low-level backend errors (SQL/Prisma/internal stack) to clients.
    if (statusCode >= 500) {
      app.log.error({ err: error }, 'unhandled server error');
      return reply.status(500).send({
        code: 'internal_error',
        message: 'Something went wrong. Please try again.',
      });
    }

    return reply.status(statusCode).send({
      code: normalizedError?.code ?? 'request_failed',
      message: normalizedError?.message ?? 'Request could not be processed.',
    });
  });

  app.get(
    '/healthz',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', const: 'ok' },
              service: { type: 'string' },
              timestamp: { type: 'string' },
            },
            required: ['status', 'service', 'timestamp'],
          },
        },
      },
    },
    async () => {
      return healthResponseSchema.parse({
        status: 'ok',
        service: 'api',
        timestamp: new Date().toISOString(),
      });
    },
  );

  await registerMetricsEndpoint(app, {
    token: config.metricsToken,
    exposeWithoutToken: !config.strictSecrets,
  });

  app.register(
    async (v1) => {
      await registerAuthRoutes(v1);
      await registerAdminRoutes(v1);
      await registerAnalyticsRoutes(v1);
      await registerDashboardRoutes(v1);
      await registerIntegrationRoutes(v1);
      await registerEventRoutes(v1);
      await registerSyncRoutes(v1);
      v1.get('/version', async () => ({
        service: 'api',
        version: APP_VERSION,
        commitSha: process.env.COMMIT_SHA ?? 'dev',
      }));
    },
    { prefix: '/v1' },
  );

  return app;
};

export const start = async () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  try {
    app = await buildServer();
  } catch (error) {
    if (error instanceof EnvValidationError) {
      console.error(`[api] configuration error: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
  let stopAutoSyncScheduler: (() => void) | null = null;
  let stopAccountDeletionScheduler: (() => void) | null = null;
  let stopWeeklyRecapScheduler: (() => void) | null = null;
  let stopTransferWorker: (() => Promise<void>) | null = null;

  try {
    await app.listen({ port: PORT, host: HOST });
    stopAutoSyncScheduler = startAutoSyncScheduler(app.log);
    stopAccountDeletionScheduler = startAccountDeletionScheduler(app.log);
    stopWeeklyRecapScheduler = startWeeklyRecapScheduler(app.log);
    stopTransferWorker = startTransferWorker(app.log);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }

  const shutdown = async () => {
    stopAutoSyncScheduler?.();
    stopAccountDeletionScheduler?.();
    stopWeeklyRecapScheduler?.();
    await stopTransferWorker?.().catch(() => undefined);
    await app.close();
    await closeNotificationsQueue().catch(() => undefined);
    await closeTransfersQueue().catch(() => undefined);
  };

  process.on('SIGINT', () => {
    void shutdown().finally(() => process.exit(0));
  });

  process.on('SIGTERM', () => {
    void shutdown().finally(() => process.exit(0));
  });
};

if (require.main === module) {
  void start();
}
