import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { healthResponseSchema } from '@synqit/shared';
import Fastify from 'fastify';
import { resolve } from 'node:path';

import { registerAdminRoutes } from './admin/routes';
import { registerAnalyticsRoutes } from './analytics/routes';
import { registerAuthRoutes } from './auth/routes';
import { registerDashboardRoutes } from './dashboard/routes';
import { initializeDatabase } from './db';
import { registerEventRoutes } from './events/routes';
import { registerIntegrationRoutes } from './integrations/routes';
import { startAccountDeletionScheduler } from './jobs/account-deletion';
import { startWeeklyRecapScheduler } from './jobs/weekly-recap';
import { registerMetricsEndpoint } from './observability/metrics';
import { startAutoSyncScheduler } from './syncs/auto-sync';
import { registerSyncRoutes } from './syncs/routes';

const loadEnvFileIfPresent = (filePath: string): void => {
  try {
    process.loadEnvFile(filePath);
  } catch (error) {
    const normalizedError = error as { code?: string } | undefined;
    if (normalizedError?.code !== 'ENOENT') {
      throw error;
    }
  }
};

// .env.local takes precedence when both files exist.
loadEnvFileIfPresent(resolve(process.cwd(), '.env.local'));
loadEnvFileIfPresent(resolve(process.cwd(), '.env'));

const APP_VERSION = process.env.APP_VERSION ?? '0.1.0';
const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret';

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
  await initializeDatabase();

  const app = Fastify({
    logger: true,
  });
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
    secret: JWT_ACCESS_SECRET,
  });
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

  await registerMetricsEndpoint(app);

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
  const app = await buildServer();
  let stopAutoSyncScheduler: (() => void) | null = null;
  let stopAccountDeletionScheduler: (() => void) | null = null;
  let stopWeeklyRecapScheduler: (() => void) | null = null;

  try {
    await app.listen({ port: PORT, host: HOST });
    stopAutoSyncScheduler = startAutoSyncScheduler(app.log);
    stopAccountDeletionScheduler = startAccountDeletionScheduler(app.log);
    stopWeeklyRecapScheduler = startWeeklyRecapScheduler(app.log);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }

  const shutdown = async () => {
    stopAutoSyncScheduler?.();
    stopAccountDeletionScheduler?.();
    stopWeeklyRecapScheduler?.();
    await app.close();
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
