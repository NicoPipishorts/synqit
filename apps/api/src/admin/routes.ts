import {
  adminAnalyticsEventDetailResponseSchema,
  adminAnalyticsEventsListResponseSchema,
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
import { prisma } from '../db/prisma';
import { enqueuePasswordResetEmailPreview } from '../jobs/password-reset-email';
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

const adminEventAnalyticsParamsSchema = z.object({
  eventId: z.string().uuid(),
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

  app.get('/admin/analytics/events', async (request, reply) => {
    const access = await resolveAdminAccess(request, reply, {
      scope: 'analytics',
      level: 'read',
    });
    if (!access) {
      return;
    }

    const rows = await prisma.$queryRaw<
      Array<{
        event_id: string;
        name: string;
        provider: 'spotify' | 'apple';
        status: 'open' | 'closed';
        host_email: string;
        tracks_count: number;
        last_track_added_at: Date | null;
        created_at: Date;
        updated_at: Date;
      }>
    >`
      SELECT
        e.id AS event_id,
        e.name,
        e.provider,
        e.status,
        u.email AS host_email,
        COUNT(t.id)::int AS tracks_count,
        MAX(t.added_at) AS last_track_added_at,
        e.created_at,
        e.updated_at
      FROM "events" e
      JOIN "users" u ON u.id = e.host_user_id
      LEFT JOIN "event_tracks" t ON t.event_id = e.id
      GROUP BY e.id, e.name, e.provider, e.status, u.email, e.created_at, e.updated_at
      ORDER BY e.updated_at DESC
      LIMIT 250
    `;

    return adminAnalyticsEventsListResponseSchema.parse({
      events: rows.map((row) => ({
        eventId: row.event_id,
        name: row.name,
        provider: row.provider,
        status: row.status,
        hostEmail: row.host_email,
        tracksCount: Number(row.tracks_count) || 0,
        lastTrackAddedAt: row.last_track_added_at ? row.last_track_added_at.toISOString() : null,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      })),
    });
  });

  app.get('/admin/analytics/events/:eventId', async (request, reply) => {
    const access = await resolveAdminAccess(request, reply, {
      scope: 'analytics',
      level: 'read',
    });
    if (!access) {
      return;
    }

    const params = adminEventAnalyticsParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        code: 'validation_error',
        message: 'Request params are invalid.',
        details: params.error.flatten(),
      });
    }

    const eventRows = await prisma.$queryRaw<
      Array<{
        event_id: string;
        name: string;
        description: string;
        provider: 'spotify' | 'apple';
        status: 'open' | 'closed';
        host_email: string;
        magic_link_token: string;
        closed_at: Date | null;
        tracks_count: number;
        last_track_added_at: Date | null;
        created_at: Date;
        updated_at: Date;
      }>
    >`
      SELECT
        e.id AS event_id,
        e.name,
        e.description,
        e.provider,
        e.status,
        u.email AS host_email,
        e.magic_link_token,
        e.closed_at,
        COUNT(t.id)::int AS tracks_count,
        MAX(t.added_at) AS last_track_added_at,
        e.created_at,
        e.updated_at
      FROM "events" e
      JOIN "users" u ON u.id = e.host_user_id
      LEFT JOIN "event_tracks" t ON t.event_id = e.id
      WHERE e.id = ${params.data.eventId}
      GROUP BY e.id, e.name, e.description, e.provider, e.status, u.email, e.magic_link_token, e.closed_at, e.created_at, e.updated_at
      LIMIT 1
    `;

    const eventRow = eventRows[0];
    if (!eventRow) {
      return reply.status(404).send({
        code: 'event_not_found',
        message: 'Event not found.',
      });
    }

    const analyticsRows = await prisma.$queryRaw<
      Array<{
        public_page_views: number;
        host_page_views: number;
        tracked_event_actions: number;
      }>
    >`
      SELECT
        COUNT(*) FILTER (
          WHERE event_name = 'app_page_view'
            AND page_path LIKE ${`/event/${eventRow.magic_link_token}%`}
        )::int AS public_page_views,
        COUNT(*) FILTER (
          WHERE event_name = 'app_page_view'
            AND page_path LIKE ${`/events/${eventRow.event_id}%`}
        )::int AS host_page_views,
        COUNT(*) FILTER (
          WHERE properties ->> 'eventId' = ${eventRow.event_id}
        )::int AS tracked_event_actions
      FROM "analytics_events"
    `;

    const analytics = analyticsRows[0] ?? {
      public_page_views: 0,
      host_page_views: 0,
      tracked_event_actions: 0,
    };

    const recentTracks = await prisma.$queryRaw<
      Array<{
        provider_track_id: string;
        name: string;
        artist: string;
        album: string;
        added_at: Date;
        added_by: string;
      }>
    >`
      SELECT
        provider_track_id,
        name,
        artist,
        album,
        added_at,
        added_by
      FROM "event_tracks"
      WHERE event_id = ${eventRow.event_id}
      ORDER BY added_at DESC
      LIMIT 20
    `;

    return adminAnalyticsEventDetailResponseSchema.parse({
      event: {
        eventId: eventRow.event_id,
        name: eventRow.name,
        description: eventRow.description,
        provider: eventRow.provider,
        status: eventRow.status,
        hostEmail: eventRow.host_email,
        tracksCount: Number(eventRow.tracks_count) || 0,
        lastTrackAddedAt: eventRow.last_track_added_at
          ? eventRow.last_track_added_at.toISOString()
          : null,
        createdAt: eventRow.created_at.toISOString(),
        updatedAt: eventRow.updated_at.toISOString(),
        magicLinkToken: eventRow.magic_link_token,
        closedAt: eventRow.closed_at ? eventRow.closed_at.toISOString() : null,
        analytics: {
          publicPageViews: Number(analytics.public_page_views) || 0,
          hostPageViews: Number(analytics.host_page_views) || 0,
          trackedEventActions: Number(analytics.tracked_event_actions) || 0,
        },
        recentTracks: recentTracks.map((track) => ({
          providerTrackId: track.provider_track_id,
          name: track.name,
          artist: track.artist,
          album: track.album,
          addedAt: track.added_at.toISOString(),
          addedBy: track.added_by,
        })),
      },
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

  app.post('/admin/email/preview/password-reset', async (request, reply) => {
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
      const jobId = await enqueuePasswordResetEmailPreview({
        toEmail: parsed.data.toEmail,
        locale: parsed.data.locale,
      });

      return reply.status(202).send({
        ok: true,
        queued: true,
        jobId: String(jobId),
      });
    } catch (error) {
      request.log.error({ err: error }, 'failed to enqueue preview password reset email');
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
