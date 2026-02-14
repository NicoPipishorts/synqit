import {
  authCredentialsSchema,
  authResponseSchema,
  authUserSchema,
  refreshResponseSchema,
  refreshTokenRequestSchema,
} from '@synqit/shared';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import {
  buildAvatarUrl,
  createAvatarReadStream,
  deleteAvatarImage,
  resolveAvatarFile,
  saveAvatarImage,
} from './avatar-storage';
import { createRefreshToken, hashPassword, hashToken, verifyPassword } from './crypto';
import { authStore, UserRecord } from './store';

const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 60 * 15;
const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 30;
const AVATAR_UPLOAD_ROUTE_BODY_LIMIT_BYTES = 3_000_000;

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
const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8),
});
const avatarUploadRequestSchema = z.object({
  imageDataUrl: z.string().min(1),
});
const avatarPublicParamsSchema = z.object({
  fileName: z.string().min(1),
});

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
    avatarUrl: buildAvatarUrl(user.avatarPath),
  });

const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({
      code: 'unauthorized',
      message: 'Authentication required.',
    });
  }
};

const getAuthenticatedUserId = (request: FastifyRequest): string | null => {
  if (
    !request.user ||
    typeof request.user !== 'object' ||
    !('sub' in request.user) ||
    typeof request.user.sub !== 'string'
  ) {
    return null;
  }

  return request.user.sub;
};

const loadAuthenticatedUser = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<UserRecord | null> => {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    await reply.status(401).send({
      code: 'unauthorized',
      message: 'Authentication required.',
    });
    return null;
  }

  const user = await authStore.findUserById(userId);
  if (!user) {
    await reply.status(401).send({
      code: 'unauthorized',
      message: 'Authentication required.',
    });
    return null;
  }

  return user;
};

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
  app.get('/public/avatars/:fileName', async (request, reply) => {
    const params = avatarPublicParamsSchema.safeParse(request.params);
    if (!params.success) {
      return sendValidationError(reply, params.error.flatten());
    }

    const resolved = await resolveAvatarFile(params.data.fileName);
    if (!resolved) {
      return reply.status(404).send({
        code: 'avatar_not_found',
        message: 'Avatar image not found.',
      });
    }

    // Allow avatar images to be embedded by the web app when API and web origins differ.
    reply.header('cross-origin-resource-policy', 'cross-origin');
    reply.header('cache-control', 'public, max-age=604800, immutable');
    return reply.type(resolved.contentType).send(createAvatarReadStream(resolved.filePath));
  });

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

  app.post(
    '/auth/change-password',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const parsed = changePasswordRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error.flatten());
      }

      const user = await loadAuthenticatedUser(request, reply);
      if (!user) {
        return;
      }

      const isCurrentPasswordValid = await verifyPassword(
        parsed.data.currentPassword,
        user.passwordHash,
      );
      if (!isCurrentPasswordValid) {
        return reply.status(401).send({
          code: 'invalid_credentials',
          message: 'Current password is invalid.',
        });
      }

      const nextPasswordHash = await hashPassword(parsed.data.newPassword);
      const updated = await authStore.updateUserPasswordById(user.id, nextPasswordHash);
      if (!updated) {
        return reply.status(500).send({
          code: 'password_update_failed',
          message: 'Unable to update password at this time.',
        });
      }

      return reply.status(200).send({
        ok: true,
      });
    },
  );

  app.post(
    '/auth/avatar',
    {
      preHandler: requireAuth,
      bodyLimit: AVATAR_UPLOAD_ROUTE_BODY_LIMIT_BYTES,
    },
    async (request, reply) => {
      const parsed = avatarUploadRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error.flatten());
      }

      const user = await loadAuthenticatedUser(request, reply);
      if (!user) {
        return;
      }

      let nextAvatarPath: string;
      try {
        const stored = await saveAvatarImage({
          userId: user.id,
          imageDataUrl: parsed.data.imageDataUrl,
        });
        nextAvatarPath = stored.avatarPath;
      } catch (error) {
        const normalizedError = error as { message?: string };
        if (normalizedError.message === 'invalid_avatar_image') {
          return reply.status(400).send({
            code: 'invalid_avatar_image',
            message: 'Avatar must be a valid image under size limits.',
          });
        }

        request.log.error({ error }, 'avatar upload failed');
        return reply.status(500).send({
          code: 'avatar_upload_failed',
          message: 'Unable to store avatar at this time.',
        });
      }

      const updated = await authStore.updateUserAvatarPathById(user.id, nextAvatarPath);
      if (!updated) {
        await deleteAvatarImage(nextAvatarPath).catch(() => undefined);
        return reply.status(500).send({
          code: 'avatar_update_failed',
          message: 'Unable to update avatar at this time.',
        });
      }

      if (user.avatarPath && user.avatarPath !== nextAvatarPath) {
        await deleteAvatarImage(user.avatarPath).catch(() => undefined);
      }

      const refreshedUser = await authStore.findUserById(user.id);
      if (!refreshedUser) {
        return reply.status(500).send({
          code: 'avatar_update_failed',
          message: 'Unable to load updated avatar at this time.',
        });
      }

      return {
        user: formatPublicUser(refreshedUser),
      };
    },
  );

  app.delete(
    '/auth/avatar',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const user = await loadAuthenticatedUser(request, reply);
      if (!user) {
        return;
      }

      const updated = await authStore.updateUserAvatarPathById(user.id, null);
      if (!updated) {
        return reply.status(500).send({
          code: 'avatar_update_failed',
          message: 'Unable to remove avatar at this time.',
        });
      }

      if (user.avatarPath) {
        await deleteAvatarImage(user.avatarPath).catch(() => undefined);
      }

      const refreshedUser = await authStore.findUserById(user.id);
      if (!refreshedUser) {
        return reply.status(500).send({
          code: 'avatar_update_failed',
          message: 'Unable to load updated avatar at this time.',
        });
      }

      return {
        user: formatPublicUser(refreshedUser),
      };
    },
  );

  app.get(
    '/me',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const user = await loadAuthenticatedUser(request, reply);
      if (!user) {
        return;
      }

      return formatPublicUser(user);
    },
  );
};
