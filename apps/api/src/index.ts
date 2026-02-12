import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { healthResponseSchema } from '@synqit/shared';
import Fastify from 'fastify';

const APP_VERSION = process.env.APP_VERSION ?? '0.1.0';
const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret';

const parseCorsOrigins = (raw: string | undefined): string[] => {
  if (!raw) {
    return ['http://localhost:5173'];
  }

  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const buildServer = async () => {
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
    reply.status(error.statusCode ?? 500).send({
      code: error.code ?? 'internal_error',
      message: error.message,
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

  app.register(
    async (v1) => {
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

const start = async () => {
  const app = await buildServer();

  try {
    await app.listen({ port: PORT, host: HOST });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void start();
