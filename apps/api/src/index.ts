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
import { initializeDatabase } from './db';
import { registerEventRoutes } from './events/routes';
import { registerIntegrationRoutes } from './integrations/routes';
import { registerMetricsEndpoint } from './observability/metrics';

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

  await app.register(helmet);
  await app.register(cors, {
    origin: parseCorsOrigins(process.env.CORS_ORIGINS),
    credentials: true,
  });
  await app.register(rateLimit, {
    max: 150,
    timeWindow: '1 minute',
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
      await registerIntegrationRoutes(v1);
      await registerEventRoutes(v1);
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

  try {
    await app.listen({ port: PORT, host: HOST });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

if (require.main === module) {
  void start();
}
