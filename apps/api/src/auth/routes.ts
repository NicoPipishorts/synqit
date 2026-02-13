import {
  authCredentialsSchema,
  authResponseSchema,
  authUserSchema,
  refreshResponseSchema,
  refreshTokenRequestSchema,
} from '@synqit/shared';
import { FastifyInstance, FastifyReply } from 'fastify';

import { createRefreshToken, hashPassword, hashToken, verifyPassword } from './crypto';
import { authStore, UserRecord } from './store';

const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 60 * 15;
const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 30;

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

const accessTokenTtlSeconds = parsePositiveNumber(
  process.env.ACCESS_TOKEN_TTL_SECONDS,
  DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
);
const refreshTokenTtlDays = parsePositiveNumber(
  process.env.REFRESH_TOKEN_TTL_DAYS,
  DEFAULT_REFRESH_TOKEN_TTL_DAYS,
);
const refreshTokenTtlMs = refreshTokenTtlDays * 24 * 60 * 60 * 1000;

const sendValidationError = (reply: FastifyReply, details: unknown) =>
  reply.status(400).send({
    code: 'validation_error',
    message: 'Request payload is invalid.',
    details,
  });

const formatPublicUser = (user: UserRecord) =>
  authUserSchema.parse({
    id: user.id,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  });

const issueTokens = async (app: FastifyInstance, user: UserRecord) => {
  const refreshToken = createRefreshToken();
  const refreshTokenHash = hashToken(refreshToken);

  await authStore.createRefreshToken({
    userId: user.id,
    tokenHash: refreshTokenHash,
    expiresAt: new Date(Date.now() + refreshTokenTtlMs),
  });

  const accessToken = app.jwt.sign(
    {
      sub: user.id,
      email: user.email,
    },
    {
      expiresIn: accessTokenTtlSeconds,
    },
  );

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer' as const,
    expiresInSeconds: accessTokenTtlSeconds,
  };
};

export const registerAuthRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post('/auth/register', async (request, reply) => {
    const parsed = authCredentialsSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendValidationError(reply, parsed.error.flatten());
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await authStore.createUser({
      email: parsed.data.email,
      passwordHash,
    });

    if (!user) {
      return reply.status(409).send({
        code: 'email_taken',
        message: 'An account already exists for that email.',
      });
    }

    const tokens = await issueTokens(app, user);

    return authResponseSchema.parse({
      user: formatPublicUser(user),
      tokens,
    });
  });

  app.post('/auth/login', async (request, reply) => {
    const parsed = authCredentialsSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendValidationError(reply, parsed.error.flatten());
    }

    const user = await authStore.findUserByEmail(parsed.data.email);
    if (!user) {
      return reply.status(401).send({
        code: 'invalid_credentials',
        message: 'Invalid email or password.',
      });
    }

    const isPasswordValid = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!isPasswordValid) {
      return reply.status(401).send({
        code: 'invalid_credentials',
        message: 'Invalid email or password.',
      });
    }

    const tokens = await issueTokens(app, user);

    return authResponseSchema.parse({
      user: formatPublicUser(user),
      tokens,
    });
  });

  app.post('/auth/refresh', async (request, reply) => {
    const parsed = refreshTokenRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendValidationError(reply, parsed.error.flatten());
    }

    const oldTokenHash = hashToken(parsed.data.refreshToken);
    const tokenRecord = await authStore.findRefreshTokenByHash(oldTokenHash);
    if (!tokenRecord) {
      return reply.status(401).send({
        code: 'invalid_refresh_token',
        message: 'Refresh token is invalid.',
      });
    }

    if (tokenRecord.revokedAt || tokenRecord.expiresAt.getTime() <= Date.now()) {
      await authStore.revokeRefreshTokenByHash(oldTokenHash);
      return reply.status(401).send({
        code: 'invalid_refresh_token',
        message: 'Refresh token is invalid.',
      });
    }

    const user = await authStore.findUserById(tokenRecord.userId);
    if (!user) {
      await authStore.revokeRefreshTokenByHash(oldTokenHash);
      return reply.status(401).send({
        code: 'invalid_refresh_token',
        message: 'Refresh token is invalid.',
      });
    }

    const nextRefreshToken = createRefreshToken();
    const nextRefreshTokenHash = hashToken(nextRefreshToken);
    const rotatedTokenRecord = await authStore.rotateRefreshToken({
      oldTokenHash,
      newTokenHash: nextRefreshTokenHash,
      expiresAt: new Date(Date.now() + refreshTokenTtlMs),
    });

    if (!rotatedTokenRecord) {
      return reply.status(401).send({
        code: 'invalid_refresh_token',
        message: 'Refresh token is invalid.',
      });
    }

    const accessToken = app.jwt.sign(
      {
        sub: user.id,
        email: user.email,
      },
      {
        expiresIn: accessTokenTtlSeconds,
      },
    );

    return refreshResponseSchema.parse({
      tokens: {
        accessToken,
        refreshToken: nextRefreshToken,
        tokenType: 'Bearer',
        expiresInSeconds: accessTokenTtlSeconds,
      },
    });
  });

  app.post('/auth/logout', async (request, reply) => {
    const parsed = refreshTokenRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendValidationError(reply, parsed.error.flatten());
    }

    await authStore.revokeRefreshTokenByHash(hashToken(parsed.data.refreshToken));

    return reply.status(200).send({
      ok: true,
    });
  });

  app.get(
    '/me',
    {
      preHandler: async (request, reply) => {
        try {
          await request.jwtVerify();
        } catch {
          return reply.status(401).send({
            code: 'unauthorized',
            message: 'Authentication required.',
          });
        }
      },
    },
    async (request, reply) => {
      if (!request.user || typeof request.user !== 'object' || !('sub' in request.user)) {
        return reply.status(401).send({
          code: 'unauthorized',
          message: 'Authentication required.',
        });
      }

      const userId = String(request.user.sub);
      const user = await authStore.findUserById(userId);
      if (!user) {
        return reply.status(401).send({
          code: 'unauthorized',
          message: 'Authentication required.',
        });
      }

      return formatPublicUser(user);
    },
  );
};
