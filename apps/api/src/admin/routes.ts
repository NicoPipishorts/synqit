import {
  adminLoginRequestSchema,
  adminMeResponseSchema,
  adminPermissionScopeSchema,
  adminUserAccessUpdateSchema,
  adminUserListResponseSchema,
  authResponseSchema,
  authUserSchema,
  QUEUES,
  type AccountRole,
  type AdminPermission,
  type AdminPermissionLevel,
  type AdminPermissionScope,
} from '@synqit/shared';
import { Queue } from 'bullmq';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { buildAvatarUrl } from '../auth/avatar-storage';
import { createRefreshToken, hashToken, verifyPassword } from '../auth/crypto';
import { authStore, type UserRecord } from '../auth/store';
import { enqueueRegistrationConfirmationEmailPreview } from '../jobs/registration-email';

const DEFAULT_REDIS_URL = 'redis://localhost:6380';
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 60 * 15;
const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 30;

const previewEmailRequestSchema = z.object({
  toEmail: z.string().email(),
  locale: z.enum(['en', 'fr']).optional().default('en'),
});

const previewJobParamsSchema = z.object({
  jobId: z.string().min(1),
});

const userAccessParamsSchema = z.object({
  userId: z.string().uuid(),
});

const bootstrapAdminRequestSchema = z.object({
  email: z.string().email(),
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

const accessTokenTtlSeconds = parsePositiveNumber(
  process.env.ACCESS_TOKEN_TTL_SECONDS,
  DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
);
const refreshTokenTtlDays = parsePositiveNumber(
  process.env.REFRESH_TOKEN_TTL_DAYS,
  DEFAULT_REFRESH_TOKEN_TTL_DAYS,
);
const refreshTokenTtlMs = refreshTokenTtlDays * 24 * 60 * 60 * 1000;

const fullAdminPermissions = (): AdminPermission[] =>
  adminPermissionScopeSchema.options.map((scope) => ({
    scope,
    level: 'write',
  }));

const formatPublicUser = (user: UserRecord) =>
  authUserSchema.parse({
    id: user.id,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    avatarUrl: buildAvatarUrl(user.avatarPath),
    role: user.role,
    adminPermissions: user.adminPermissions,
  });

const readRedisConnectionConfig = () => {
  const redisUrl = new URL(process.env.REDIS_URL ?? DEFAULT_REDIS_URL);
  const db = Number.parseInt(redisUrl.pathname.replace('/', ''), 10);
  const useTls = redisUrl.protocol === 'rediss:';

  return {
    host: redisUrl.hostname,
    port: redisUrl.port ? Number.parseInt(redisUrl.port, 10) : useTls ? 6380 : 6379,
    username: redisUrl.username ? decodeURIComponent(redisUrl.username) : undefined,
    password: redisUrl.password ? decodeURIComponent(redisUrl.password) : undefined,
    db: Number.isFinite(db) ? db : 0,
    tls: useTls ? {} : undefined,
    enableOfflineQueue: false,
    connectTimeout: 1_200,
    maxRetriesPerRequest: 1,
  } as const;
};

const normalizePermissionMap = (permissions: AdminPermission[]): AdminPermission[] => {
  const map = new Map<AdminPermissionScope, AdminPermissionLevel>();
  for (const permission of permissions) {
    const previous = map.get(permission.scope);
    if (previous === 'write') {
      continue;
    }
    map.set(permission.scope, permission.level);
  }
  return Array.from(map.entries()).map(([scope, level]) => ({ scope, level }));
};

const canAccess = (
  user: UserRecord,
  scope: AdminPermissionScope,
  level: AdminPermissionLevel,
): boolean => {
  if (user.role !== 'admin') {
    return false;
  }
  const match = user.adminPermissions.find((permission) => permission.scope === scope);
  if (!match) {
    return false;
  }
  if (level === 'read') {
    return match.level === 'read' || match.level === 'write';
  }
  return match.level === 'write';
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

const loadJwtAdminUser = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<UserRecord | null> => {
  try {
    await request.jwtVerify();
  } catch {
    await reply.status(401).send({
      code: 'unauthorized',
      message: 'Authentication required.',
    });
    return null;
  }

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

  if (user.role !== 'admin') {
    await reply.status(403).send({
      code: 'forbidden',
      message: 'Admin access required.',
    });
    return null;
  }

  return user;
};

const isAdminKeyValid = (request: FastifyRequest): boolean => {
  const expectedKey = process.env.ADMIN_EMAIL_PREVIEW_KEY?.trim();
  if (!expectedKey) {
    return false;
  }
  const providedKey = request.headers['x-admin-key'];
  return typeof providedKey === 'string' && providedKey.trim() === expectedKey;
};

const resolveAdminAccess = async (
  request: FastifyRequest,
  reply: FastifyReply,
  requiredPermission?: { scope: AdminPermissionScope; level: AdminPermissionLevel },
): Promise<{ viaKey: boolean; user: UserRecord | null } | null> => {
  if (isAdminKeyValid(request)) {
    return {
      viaKey: true,
      user: null,
    };
  }

  const user = await loadJwtAdminUser(request, reply);
  if (!user) {
    return null;
  }

  if (requiredPermission && !canAccess(user, requiredPermission.scope, requiredPermission.level)) {
    await reply.status(403).send({
      code: 'forbidden',
      message: 'You do not have permission for this admin action.',
    });
    return null;
  }

  return {
    viaKey: false,
    user,
  };
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
      role: user.role,
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

export const registerAdminRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post('/admin/auth/login', async (request, reply) => {
    const parsed = adminLoginRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        code: 'validation_error',
        message: 'Request payload is invalid.',
        details: parsed.error.flatten(),
      });
    }

    const passwordIdentity = await authStore.findPasswordIdentityByEmail(parsed.data.email);
    const user = passwordIdentity
      ? await authStore.findUserById(passwordIdentity.userId)
      : await authStore.findUserByEmail(parsed.data.email);
    if (!user) {
      return reply.status(401).send({
        code: 'invalid_credentials',
        message: 'Invalid email or password.',
      });
    }

    const passwordHash = passwordIdentity?.passwordHash ?? user.passwordHash;
    if (!passwordHash) {
      return reply.status(401).send({
        code: 'invalid_credentials',
        message: 'Invalid email or password.',
      });
    }

    const isPasswordValid = await verifyPassword(parsed.data.password, passwordHash);
    if (!isPasswordValid) {
      return reply.status(401).send({
        code: 'invalid_credentials',
        message: 'Invalid email or password.',
      });
    }

    if (user.role !== 'admin') {
      return reply.status(403).send({
        code: 'forbidden',
        message: 'Admin access required.',
      });
    }

    const tokens = await issueTokens(app, user);
    return authResponseSchema.parse({
      user: formatPublicUser(user),
      tokens,
    });
  });

  app.get('/admin/me', async (request, reply) => {
    const access = await resolveAdminAccess(request, reply);
    if (!access || !access.user) {
      return;
    }

    return adminMeResponseSchema.parse({
      user: formatPublicUser(access.user),
    });
  });

  app.get('/admin/users', async (request, reply) => {
    const access = await resolveAdminAccess(request, reply, {
      scope: 'users',
      level: 'read',
    });
    if (!access) {
      return;
    }

    const users = await authStore.listUsers();
    return adminUserListResponseSchema.parse({
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        adminPermissions: user.adminPermissions,
      })),
    });
  });

  app.put('/admin/users/:userId/access', async (request, reply) => {
    const access = await resolveAdminAccess(request, reply, {
      scope: 'users',
      level: 'write',
    });
    if (!access) {
      return;
    }

    const params = userAccessParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        code: 'validation_error',
        message: 'Request params are invalid.',
        details: params.error.flatten(),
      });
    }

    const body = adminUserAccessUpdateSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        code: 'validation_error',
        message: 'Request payload is invalid.',
        details: body.error.flatten(),
      });
    }

    const existing = await authStore.findUserById(params.data.userId);
    if (!existing) {
      return reply.status(404).send({
        code: 'user_not_found',
        message: 'User not found.',
      });
    }

    const nextRole: AccountRole = body.data.role;
    const normalizedPermissions =
      nextRole === 'admin' ? normalizePermissionMap(body.data.adminPermissions) : [];

    await authStore.setUserRoleById(existing.id, nextRole);
    await authStore.replaceUserAdminPermissionsByUserId(existing.id, normalizedPermissions);

    const refreshed = await authStore.findUserById(existing.id);
    if (!refreshed) {
      return reply.status(500).send({
        code: 'admin_user_update_failed',
        message: 'Unable to load updated admin user.',
      });
    }

    return reply.status(200).send({
      ok: true,
      user: {
        id: refreshed.id,
        email: refreshed.email,
        role: refreshed.role,
        createdAt: refreshed.createdAt.toISOString(),
        adminPermissions: refreshed.adminPermissions,
      },
    });
  });

  app.post('/admin/bootstrap/promote', async (request, reply) => {
    const expectedKey = process.env.ADMIN_BOOTSTRAP_KEY?.trim();
    if (!expectedKey) {
      return reply.status(503).send({
        code: 'admin_bootstrap_not_configured',
        message: 'Admin bootstrap key is not configured.',
      });
    }

    const providedKey = request.headers['x-admin-bootstrap-key'];
    if (typeof providedKey !== 'string' || providedKey.trim() !== expectedKey) {
      return reply.status(403).send({
        code: 'forbidden',
        message: 'Bootstrap key is invalid.',
      });
    }

    const body = bootstrapAdminRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        code: 'validation_error',
        message: 'Request payload is invalid.',
        details: body.error.flatten(),
      });
    }

    const user = await authStore.findUserByEmail(body.data.email);
    if (!user) {
      return reply.status(404).send({
        code: 'user_not_found',
        message: 'User not found for this email.',
      });
    }

    await authStore.setUserRoleById(user.id, 'admin');
    await authStore.replaceUserAdminPermissionsByUserId(user.id, fullAdminPermissions());

    const refreshed = await authStore.findUserById(user.id);
    if (!refreshed) {
      return reply.status(500).send({
        code: 'admin_bootstrap_failed',
        message: 'Unable to load updated admin user.',
      });
    }

    return reply.status(200).send({
      ok: true,
      user: {
        id: refreshed.id,
        email: refreshed.email,
        role: refreshed.role,
        createdAt: refreshed.createdAt.toISOString(),
        adminPermissions: refreshed.adminPermissions,
      },
    });
  });

  app.post('/admin/email/preview', async (request, reply) => {
    const access = await resolveAdminAccess(request, reply, {
      scope: 'emails',
      level: 'write',
    });
    if (!access) {
      return;
    }

    const parsed = previewEmailRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        code: 'validation_error',
        message: 'Request payload is invalid.',
        details: parsed.error.flatten(),
      });
    }

    try {
      const jobId = await enqueueRegistrationConfirmationEmailPreview({
        toEmail: parsed.data.toEmail,
        locale: parsed.data.locale,
      });

      return reply.status(202).send({
        ok: true,
        queued: true,
        jobId: String(jobId),
      });
    } catch (error) {
      request.log.error({ err: error }, 'failed to enqueue preview registration email');
      return reply.status(500).send({
        code: 'email_preview_enqueue_failed',
        message: 'Unable to enqueue preview email at this time.',
      });
    }
  });

  app.get('/admin/email/jobs/:jobId', async (request, reply) => {
    const access = await resolveAdminAccess(request, reply, {
      scope: 'emails',
      level: 'read',
    });
    if (!access) {
      return;
    }

    const params = previewJobParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        code: 'validation_error',
        message: 'Request params are invalid.',
        details: params.error.flatten(),
      });
    }

    const queue = new Queue(QUEUES.notifications, { connection: readRedisConnectionConfig() });
    try {
      const job = await queue.getJob(params.data.jobId);
      if (!job) {
        return reply.status(404).send({
          code: 'job_not_found',
          message: 'Job not found.',
        });
      }

      const state = await job.getState();
      return reply.status(200).send({
        ok: true,
        jobId: String(job.id),
        name: job.name,
        state,
        failedReason: job.failedReason ?? null,
        finishedOn: job.finishedOn ?? null,
        processedOn: job.processedOn ?? null,
      });
    } catch (error) {
      request.log.error({ err: error }, 'failed to query preview email job');
      return reply.status(500).send({
        code: 'email_job_status_failed',
        message: 'Unable to query email job status at this time.',
      });
    } finally {
      await queue.close();
    }
  });
};
