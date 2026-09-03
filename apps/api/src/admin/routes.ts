import {
  adminAnalyticsEventDetailResponseSchema,
  adminAnalyticsEventsListResponseSchema,
  adminAnalyticsOverviewRangeSchema,
  analyticsTargetSchema,
  adminAnalyticsOverviewResponseSchema,
  adminAnalyticsUserDetailResponseSchema,
  adminAnalyticsUsersListResponseSchema,
  adminLoginRequestSchema,
  adminMeResponseSchema,
  adminPermissionScopeSchema,
  adminUserBlockUpdateSchema,
  adminUserAccessUpdateSchema,
  adminUserDeletionRequestSchema,
  adminUserDeletionResponseSchema,
  adminUserListResponseSchema,
  adminUserResetFlowResponseSchema,
  adminUserTestAccountUpdateSchema,
  authResponseSchema,
  authUserSchema,
  personalInfoSchema,
  QUEUES,
  type AccountRole,
  type AdminPermission,
  type AdminPermissionLevel,
  type AdminPermissionScope,
} from '@synqit/shared';
import { Queue } from 'bullmq';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { buildAvatarUrl, deleteAvatarImage } from '../auth/avatar-storage';
import { createRefreshToken, hashToken, verifyPassword } from '../auth/crypto';
import {
  applyAccessTokenFromSessionCookie,
  clearSessionCookies,
  getSessionRefreshTokenFromRequest,
  setSessionCookies,
} from '../auth/session-cookies';
import { authStore, type UserRecord } from '../auth/store';
import { prisma } from '../db/prisma';
import { enqueuePasswordResetEmailPreview } from '../jobs/password-reset-email';
import { enqueueRegistrationConfirmationEmailPreview } from '../jobs/registration-email';
import { enqueueWeeklyRecapEmailPreview } from '../jobs/weekly-recap-email';

const DEFAULT_REDIS_URL = 'redis://localhost:6380';
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 60 * 15;
const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 30;
const DEFAULT_SUPER_ADMIN_IDENTITIES = 'shamanproto';
const DEFAULT_ACCOUNT_DELETION_GRACE_DAYS = 30;

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

const adminUserAnalyticsParamsSchema = z.object({
  userId: z.string().uuid(),
});

const adminAnalyticsOverviewQuerySchema = z.object({
  range: adminAnalyticsOverviewRangeSchema.optional().default('24h'),
  source: z.enum(['web', 'site']).optional(),
  target: analyticsTargetSchema.optional(),
  page: z.string().min(1).max(512).optional(),
  locale: z.enum(['en', 'fr']).optional(),
  visitor: z.enum(['anonymous', 'authenticated']).optional(),
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

const isMissingColumnError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const normalized = error as {
    code?: string;
    meta?: {
      driverAdapterError?: {
        cause?: {
          originalCode?: string;
        };
      };
    };
  };

  if (normalized.code === '42703') {
    return true;
  }

  const sqlCode = normalized.meta?.driverAdapterError?.cause?.originalCode;
  return sqlCode === '42703';
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
const refreshTokenTtlSeconds = refreshTokenTtlDays * 24 * 60 * 60;

const fullAdminPermissions = (): AdminPermission[] =>
  adminPermissionScopeSchema.options.map((scope) => ({
    scope,
    level: 'write',
  }));

const standardAdminPermissions = (): AdminPermission[] =>
  adminPermissionScopeSchema.options
    .filter((scope) => scope !== 'admin_users')
    .map((scope) => ({
      scope,
      level: 'write',
    }));

const readSuperAdminIdentities = (): Set<string> =>
  new Set(
    (process.env.ADMIN_SUPER_USERS ?? DEFAULT_SUPER_ADMIN_IDENTITIES)
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );

const isSuperAdminIdentity = (email: string): boolean => {
  const normalizedEmail = email.trim().toLowerCase();
  const localPart = normalizedEmail.split('@')[0] ?? normalizedEmail;
  const identifiers = readSuperAdminIdentities();
  return identifiers.has(normalizedEmail) || identifiers.has(localPart);
};

const defaultAdminPermissionsForEmail = (email: string): AdminPermission[] =>
  isSuperAdminIdentity(email) ? fullAdminPermissions() : standardAdminPermissions();

const normalizeAdminPermissionsForTarget = (
  email: string,
  role: AccountRole,
  requestedPermissions: AdminPermission[],
): AdminPermission[] => {
  if (role !== 'admin') {
    return [];
  }

  if (isSuperAdminIdentity(email)) {
    return fullAdminPermissions();
  }

  return requestedPermissions.filter((permission) => permission.scope !== 'admin_users');
};

const formatPublicUser = (user: UserRecord) =>
  authUserSchema.parse({
    id: user.id,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    avatarUrl: buildAvatarUrl(user.avatarPath),
    role: user.role,
    adminPermissions: user.adminPermissions,
    accountState: user.accountState,
    isTestAccount: user.isTestAccount,
  });

const accountDeletionGraceDays = parsePositiveNumber(
  process.env.ACCOUNT_DELETION_GRACE_DAYS,
  DEFAULT_ACCOUNT_DELETION_GRACE_DAYS,
);

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
    applyAccessTokenFromSessionCookie(request, 'admin');
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

  if (user.isBlocked) {
    await reply.status(403).send({
      code: 'account_blocked',
      message: 'This account has been blocked.',
    });
    return null;
  }

  return user;
};

const readRefreshTokenFromRequest = (request: FastifyRequest): string | null => {
  const body =
    request.body && typeof request.body === 'object'
      ? (request.body as { refreshToken?: unknown })
      : null;

  if (body && typeof body.refreshToken === 'string' && body.refreshToken.trim().length > 0) {
    return body.refreshToken.trim();
  }

  return getSessionRefreshTokenFromRequest(request, 'admin');
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

const auditAdminAction = async (params: {
  actor: UserRecord | null;
  target: UserRecord | null;
  action: string;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> => {
  await authStore.createAdminAuditLog({
    actorUserId: params.actor?.id ?? null,
    actorEmail: params.actor?.email ?? null,
    targetUserId: params.target?.id ?? null,
    targetEmail: params.target?.email ?? null,
    action: params.action,
    reason: params.reason ?? null,
    metadata: params.metadata ?? null,
  });
};

const denyLastSuperAdminMutationIfNeeded = async (
  reply: FastifyReply,
  targetUser: UserRecord,
  nextState: { role?: AccountRole; blocked?: boolean; accountState?: string },
): Promise<boolean> => {
  if (!isSuperAdminIdentity(targetUser.email)) {
    return false;
  }

  const remainsSuperAdmin =
    (nextState.role ?? targetUser.role) === 'admin' &&
    (nextState.blocked ?? targetUser.isBlocked) !== true &&
    (nextState.accountState ?? targetUser.accountState) !== 'pending_deletion' &&
    (nextState.accountState ?? targetUser.accountState) !== 'deleted';

  if (remainsSuperAdmin) {
    return false;
  }

  const activeSuperAdminCount = await authStore.countActiveSuperAdmins();
  if (activeSuperAdminCount > 1) {
    return false;
  }

  await reply.status(409).send({
    code: 'last_super_admin_protected',
    message: 'This action would remove the last remaining super admin.',
  });
  return true;
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

    if (user.isBlocked) {
      return reply.status(403).send({
        code: 'account_blocked',
        message: 'This account has been blocked.',
      });
    }

    if (user.role !== 'admin') {
      return reply.status(403).send({
        code: 'forbidden',
        message: 'Admin access required.',
      });
    }

    const tokens = await issueTokens(app, user);
    setSessionCookies(reply, 'admin', {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenMaxAgeSeconds: accessTokenTtlSeconds,
      refreshTokenMaxAgeSeconds: refreshTokenTtlSeconds,
    });
    return authResponseSchema.parse({
      user: formatPublicUser(user),
      tokens,
    });
  });

  app.post('/admin/auth/refresh', async (request, reply) => {
    const refreshToken = readRefreshTokenFromRequest(request);
    if (!refreshToken) {
      clearSessionCookies(reply, 'admin');
      return reply.status(401).send({
        code: 'invalid_refresh_token',
        message: 'Refresh token is invalid.',
      });
    }

    const oldTokenHash = hashToken(refreshToken);
    const tokenRecord = await authStore.findRefreshTokenByHash(oldTokenHash);
    if (!tokenRecord) {
      clearSessionCookies(reply, 'admin');
      return reply.status(401).send({
        code: 'invalid_refresh_token',
        message: 'Refresh token is invalid.',
      });
    }

    if (tokenRecord.revokedAt || tokenRecord.expiresAt.getTime() <= Date.now()) {
      await authStore.revokeRefreshTokenByHash(oldTokenHash);
      clearSessionCookies(reply, 'admin');
      return reply.status(401).send({
        code: 'invalid_refresh_token',
        message: 'Refresh token is invalid.',
      });
    }

    const user = await authStore.findUserById(tokenRecord.userId);
    if (!user) {
      await authStore.revokeRefreshTokenByHash(oldTokenHash);
      clearSessionCookies(reply, 'admin');
      return reply.status(401).send({
        code: 'invalid_refresh_token',
        message: 'Refresh token is invalid.',
      });
    }

    if (user.isBlocked) {
      await authStore.revokeRefreshTokenByHash(oldTokenHash);
      clearSessionCookies(reply, 'admin');
      return reply.status(403).send({
        code: 'account_blocked',
        message: 'This account has been blocked.',
      });
    }

    if (user.role !== 'admin') {
      await authStore.revokeRefreshTokenByHash(oldTokenHash);
      clearSessionCookies(reply, 'admin');
      return reply.status(403).send({
        code: 'forbidden',
        message: 'Admin access required.',
      });
    }

    const nextRefreshToken = createRefreshToken();
    const rotatedTokenRecord = await authStore.rotateRefreshToken({
      oldTokenHash,
      newTokenHash: hashToken(nextRefreshToken),
      expiresAt: new Date(Date.now() + refreshTokenTtlMs),
    });

    if (!rotatedTokenRecord) {
      clearSessionCookies(reply, 'admin');
      return reply.status(401).send({
        code: 'invalid_refresh_token',
        message: 'Refresh token is invalid.',
      });
    }

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

    setSessionCookies(reply, 'admin', {
      accessToken,
      refreshToken: nextRefreshToken,
      accessTokenMaxAgeSeconds: accessTokenTtlSeconds,
      refreshTokenMaxAgeSeconds: refreshTokenTtlSeconds,
    });

    return reply.status(200).send({
      tokens: {
        accessToken,
        refreshToken: nextRefreshToken,
        tokenType: 'Bearer',
        expiresInSeconds: accessTokenTtlSeconds,
      },
    });
  });

  app.post('/admin/auth/logout', async (request, reply) => {
    const refreshToken = readRefreshTokenFromRequest(request);
    if (refreshToken) {
      await authStore.revokeRefreshTokenByHash(hashToken(refreshToken));
    }
    clearSessionCookies(reply, 'admin');

    return reply.status(200).send({
      ok: true,
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
        isBlocked: user.isBlocked,
        blockedAt: user.blockedAt ? user.blockedAt.toISOString() : null,
        accountState: user.accountState,
        isTestAccount: user.isTestAccount,
        deletionRequestedAt: user.deletionRequestedAt
          ? user.deletionRequestedAt.toISOString()
          : null,
        deletionScheduledFor: user.deletionScheduledFor
          ? user.deletionScheduledFor.toISOString()
          : null,
        deletedAt: user.deletedAt ? user.deletedAt.toISOString() : null,
        createdAt: user.createdAt.toISOString(),
        adminPermissions: user.adminPermissions,
      })),
    });
  });

  app.get('/admin/analytics/playlists', async (request, reply) => {
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
      FROM "playlists" e
      JOIN "users" u ON u.id = e.host_user_id
      LEFT JOIN "playlist_tracks" t ON t.event_id = e.id
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

  app.get('/admin/analytics/overview', async (request, reply) => {
    const access = await resolveAdminAccess(request, reply, {
      scope: 'analytics',
      level: 'read',
    });
    if (!access) {
      return;
    }

    const parsedQuery = adminAnalyticsOverviewQuerySchema.safeParse(request.query ?? {});
    if (!parsedQuery.success) {
      reply.status(400);
      return {
        code: 'invalid_request',
        message: 'Invalid analytics range.',
      };
    }

    const range = parsedQuery.data.range;
    const now = Date.now();
    const rangeToMilliseconds = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '14d': 14 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '45d': 45 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000,
      all: null,
    } as const;
    const rangeMs = rangeToMilliseconds[range];
    const since = rangeMs === null ? null : new Date(now - rangeMs);
    const hasSince = Boolean(since);
    const usersSinceClause = hasSince ? 'WHERE created_at >= $1' : '';
    const eventsSinceClause = hasSince ? 'WHERE created_at >= $1' : '';
    const syncsSinceClause = hasSince ? 'WHERE created_at >= $1' : '';
    const analyticsSinceClause = hasSince ? 'AND created_at >= $1' : '';
    const analyticsWhereSinceClause = hasSince ? 'WHERE created_at >= $1' : '';
    const pageViewsByDayLimit = (() => {
      switch (range) {
        case '24h':
          return 'LIMIT 2';
        case '7d':
          return 'LIMIT 7';
        case '14d':
          return 'LIMIT 14';
        case '30d':
          return 'LIMIT 30';
        case '45d':
          return 'LIMIT 45';
        case '90d':
          return 'LIMIT 90';
        default:
          return '';
      }
    })();

    // Event-level filters (app/source, feature/target, page, language, visitor).
    // These narrow the event-based blocks only; entity totals, the funnel, and
    // the dedicated Public-site block stay global (date-range only). Predicates
    // share one positional-param array with `since` as $1 when present.
    const eventParams: unknown[] = [];
    const eventPredicates: string[] = [];
    if (since) {
      eventParams.push(since);
      eventPredicates.push(`created_at >= $${eventParams.length}`);
    }
    if (parsedQuery.data.source) {
      eventParams.push(parsedQuery.data.source);
      eventPredicates.push(`source = $${eventParams.length}`);
    }
    if (parsedQuery.data.target) {
      eventParams.push(parsedQuery.data.target);
      eventPredicates.push(`target = $${eventParams.length}`);
    }
    if (parsedQuery.data.page) {
      eventParams.push(parsedQuery.data.page);
      eventPredicates.push(`page_path = $${eventParams.length}`);
    }
    if (parsedQuery.data.locale) {
      eventParams.push(parsedQuery.data.locale);
      eventPredicates.push(`locale = $${eventParams.length}`);
    }
    if (parsedQuery.data.visitor === 'anonymous') {
      eventPredicates.push('user_id IS NULL');
    } else if (parsedQuery.data.visitor === 'authenticated') {
      eventPredicates.push('user_id IS NOT NULL');
    }
    const eventAndClause = eventPredicates.length ? `AND ${eventPredicates.join(' AND ')}` : '';
    const eventWhereClause = eventPredicates.length ? `WHERE ${eventPredicates.join(' AND ')}` : '';
    const runEvent = <T>(query: string): Promise<T> =>
      (eventParams.length
        ? prisma.$queryRawUnsafe(query, ...eventParams)
        : prisma.$queryRawUnsafe(query)) as Promise<T>;
    // Page-view metrics span both apps so the source filter can split them.
    const pageViewEventNames = `event_name IN ('app_page_view', 'site_page_view')`;

    const totalsQuery = `
      SELECT
        (SELECT COUNT(*)::int FROM "users" ${usersSinceClause}) AS users_count,
        (SELECT COUNT(*)::int FROM "playlists" ${eventsSinceClause}) AS event_playlists_count,
        (SELECT COUNT(*)::int FROM "playlist_syncs" ${syncsSinceClause}) AS shared_playlists_count,
        (
          SELECT COUNT(*)::int
          FROM "analytics_events"
          WHERE ${pageViewEventNames}
            ${eventAndClause}
        ) AS page_views_count,
        (
          SELECT COUNT(DISTINCT session_id)::int
          FROM "analytics_events"
          ${eventWhereClause}
        ) AS unique_sessions_count,
        (
          SELECT COUNT(*)::int
          FROM "analytics_events"
          ${eventWhereClause}
        ) AS tracked_events_count
    `;
    const totalsRows = await runEvent<
      Array<{
        users_count: number;
        event_playlists_count: number;
        shared_playlists_count: number;
        page_views_count: number;
        unique_sessions_count: number;
        tracked_events_count: number;
      }>
    >(totalsQuery);

    const pageViewsByPathQuery = `
      SELECT
        page_path,
        COUNT(*)::int AS views
      FROM "analytics_events"
      WHERE ${pageViewEventNames}
        ${eventAndClause}
      GROUP BY page_path
      ORDER BY views DESC
      LIMIT 12
    `;
    const pageViewsByPathRows = await runEvent<
      Array<{
        page_path: string;
        views: number;
      }>
    >(pageViewsByPathQuery);

    const pageViewsByDayQuery = `
      SELECT
        TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
        COUNT(*)::int AS views
      FROM "analytics_events"
      WHERE ${pageViewEventNames}
        ${eventAndClause}
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY DATE_TRUNC('day', created_at) DESC
      ${pageViewsByDayLimit}
    `;
    const pageViewsByDayRows = await runEvent<
      Array<{
        day: string;
        views: number;
      }>
    >(pageViewsByDayQuery);

    const funnelQuery = `
      SELECT
        (
          SELECT COUNT(DISTINCT session_id)::int
          FROM "analytics_events"
          ${analyticsWhereSinceClause}
        ) AS sessions,
        (
          SELECT COUNT(*)::int
          FROM "analytics_events"
          WHERE event_name = 'auth_register_success'
            ${analyticsSinceClause}
        ) AS registered,
        (
          SELECT COUNT(*)::int
          FROM "analytics_events"
          WHERE event_name = 'provider_connect_succeeded'
            ${analyticsSinceClause}
        ) AS provider_connected,
        (
          SELECT COUNT(*)::int
          FROM "analytics_events"
          WHERE event_name = 'event_create_succeeded'
            ${analyticsSinceClause}
        ) AS event_created,
        (SELECT COUNT(*)::int FROM "playlist_syncs" ${syncsSinceClause}) AS shared
    `;
    const funnelRows = (
      hasSince
        ? await prisma.$queryRawUnsafe(funnelQuery, since)
        : await prisma.$queryRawUnsafe(funnelQuery)
    ) as Array<{
      sessions: number;
      registered: number;
      provider_connected: number;
      event_created: number;
      shared: number;
    }>;

    const eventBreakdownQuery = `
      SELECT
        event_name,
        target,
        COUNT(*)::int AS count,
        COUNT(DISTINCT session_id)::int AS sessions
      FROM "analytics_events"
      ${eventWhereClause}
      GROUP BY event_name, target
      ORDER BY count DESC
      LIMIT 100
    `;
    const eventBreakdownRows = await runEvent<
      Array<{
        event_name: string;
        target: string;
        count: number;
        sessions: number;
      }>
    >(eventBreakdownQuery);

    const activeSessionsByDayQuery = `
      SELECT
        TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
        COUNT(DISTINCT session_id)::int AS sessions
      FROM "analytics_events"
      ${eventWhereClause}
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY DATE_TRUNC('day', created_at) DESC
      ${pageViewsByDayLimit}
    `;
    const activeSessionsByDayRows = await runEvent<
      Array<{
        day: string;
        sessions: number;
      }>
    >(activeSessionsByDayQuery);

    const returningSessionsQuery = `
      SELECT COUNT(*)::int AS returning_sessions
      FROM (
        SELECT session_id
        FROM "analytics_events"
        ${eventWhereClause}
        GROUP BY session_id
        HAVING COUNT(DISTINCT DATE_TRUNC('day', created_at)) >= 2
      ) AS multi_day_sessions
    `;
    const returningSessionsRows =
      await runEvent<Array<{ returning_sessions: number }>>(returningSessionsQuery);

    // Public marketing site (source = 'site') aggregations.
    const siteTotalsQuery = `
      SELECT
        (
          SELECT COUNT(*)::int
          FROM "analytics_events"
          WHERE source = 'site' AND event_name = 'site_page_view'
            ${analyticsSinceClause}
        ) AS page_views,
        (
          SELECT COUNT(DISTINCT session_id)::int
          FROM "analytics_events"
          WHERE source = 'site'
            ${analyticsSinceClause}
        ) AS unique_visitors,
        (
          SELECT COALESCE(AVG((properties->>'engagedMs')::numeric), 0)
          FROM "analytics_events"
          WHERE source = 'site' AND event_name = 'site_time_on_page'
            AND (properties->>'engagedMs') IS NOT NULL
            ${analyticsSinceClause}
        ) AS avg_engaged_ms
    `;
    const siteTotalsRows = (
      hasSince
        ? await prisma.$queryRawUnsafe(siteTotalsQuery, since)
        : await prisma.$queryRawUnsafe(siteTotalsQuery)
    ) as Array<{ page_views: number; unique_visitors: number; avg_engaged_ms: number }>;

    const siteTrafficByDayQuery = `
      SELECT
        TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
        COUNT(*)::int AS views
      FROM "analytics_events"
      WHERE source = 'site' AND event_name = 'site_page_view'
        ${analyticsSinceClause}
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY DATE_TRUNC('day', created_at) DESC
      ${pageViewsByDayLimit}
    `;
    const siteTrafficByDayRows = (
      hasSince
        ? await prisma.$queryRawUnsafe(siteTrafficByDayQuery, since)
        : await prisma.$queryRawUnsafe(siteTrafficByDayQuery)
    ) as Array<{ day: string; views: number }>;

    const siteTopPagesQuery = `
      SELECT page_path, COUNT(*)::int AS views
      FROM "analytics_events"
      WHERE source = 'site' AND event_name = 'site_page_view'
        ${analyticsSinceClause}
      GROUP BY page_path
      ORDER BY views DESC
      LIMIT 12
    `;
    const siteTopPagesRows = (
      hasSince
        ? await prisma.$queryRawUnsafe(siteTopPagesQuery, since)
        : await prisma.$queryRawUnsafe(siteTopPagesQuery)
    ) as Array<{ page_path: string; views: number }>;

    const siteTopSectionsQuery = `
      SELECT properties->>'section' AS section, COUNT(*)::int AS views
      FROM "analytics_events"
      WHERE source = 'site' AND event_name = 'site_section_viewed'
        AND (properties->>'section') IS NOT NULL
        ${analyticsSinceClause}
      GROUP BY properties->>'section'
      ORDER BY views DESC
      LIMIT 20
    `;
    const siteTopSectionsRows = (
      hasSince
        ? await prisma.$queryRawUnsafe(siteTopSectionsQuery, since)
        : await prisma.$queryRawUnsafe(siteTopSectionsQuery)
    ) as Array<{ section: string; views: number }>;

    const siteTopClicksQuery = `
      SELECT
        COALESCE(NULLIF(properties->>'label', ''), '(unlabeled)') AS label,
        COUNT(*)::int AS clicks
      FROM "analytics_events"
      WHERE source = 'site' AND event_name = 'site_cta_click'
        ${analyticsSinceClause}
      GROUP BY COALESCE(NULLIF(properties->>'label', ''), '(unlabeled)')
      ORDER BY clicks DESC
      LIMIT 20
    `;
    const siteTopClicksRows = (
      hasSince
        ? await prisma.$queryRawUnsafe(siteTopClicksQuery, since)
        : await prisma.$queryRawUnsafe(siteTopClicksQuery)
    ) as Array<{ label: string; clicks: number }>;

    const totals = totalsRows[0] ?? {
      users_count: 0,
      event_playlists_count: 0,
      shared_playlists_count: 0,
      page_views_count: 0,
      unique_sessions_count: 0,
      tracked_events_count: 0,
    };

    const funnelTotals = funnelRows[0] ?? {
      sessions: 0,
      registered: 0,
      provider_connected: 0,
      event_created: 0,
      shared: 0,
    };
    const uniqueSessions = Number(totals.unique_sessions_count) || 0;
    const trackedEvents = Number(totals.tracked_events_count) || 0;
    const avgEventsPerSession =
      uniqueSessions > 0 ? Number((trackedEvents / uniqueSessions).toFixed(2)) : 0;

    const siteTotals = siteTotalsRows[0] ?? {
      page_views: 0,
      unique_visitors: 0,
      avg_engaged_ms: 0,
    };
    const avgEngagedSeconds = Number((Number(siteTotals.avg_engaged_ms) / 1000).toFixed(1)) || 0;

    return adminAnalyticsOverviewResponseSchema.parse({
      totals: {
        usersCount: Number(totals.users_count) || 0,
        eventPlaylistsCount: Number(totals.event_playlists_count) || 0,
        sharedPlaylistsCount: Number(totals.shared_playlists_count) || 0,
        pageViewsCount: Number(totals.page_views_count) || 0,
        uniqueSessionsCount: Number(totals.unique_sessions_count) || 0,
        trackedEventsCount: Number(totals.tracked_events_count) || 0,
      },
      pageViewsByPath: pageViewsByPathRows.map((row) => ({
        path: row.page_path,
        views: Number(row.views) || 0,
      })),
      pageViewsByDay: pageViewsByDayRows
        .map((row) => ({
          day: row.day,
          views: Number(row.views) || 0,
        }))
        .reverse(),
      funnel: [
        { step: 'sessions' as const, count: Number(funnelTotals.sessions) || 0 },
        { step: 'registered' as const, count: Number(funnelTotals.registered) || 0 },
        {
          step: 'providerConnected' as const,
          count: Number(funnelTotals.provider_connected) || 0,
        },
        { step: 'eventCreated' as const, count: Number(funnelTotals.event_created) || 0 },
        { step: 'shared' as const, count: Number(funnelTotals.shared) || 0 },
      ],
      eventBreakdown: eventBreakdownRows.map((row) => ({
        eventName: row.event_name,
        target: row.target,
        count: Number(row.count) || 0,
        sessions: Number(row.sessions) || 0,
      })),
      engagement: {
        returningSessionsCount: Number(returningSessionsRows[0]?.returning_sessions) || 0,
        avgEventsPerSession,
        activeSessionsByDay: activeSessionsByDayRows
          .map((row) => ({
            day: row.day,
            sessions: Number(row.sessions) || 0,
          }))
          .reverse(),
      },
      site: {
        uniqueVisitors: Number(siteTotals.unique_visitors) || 0,
        pageViewsCount: Number(siteTotals.page_views) || 0,
        avgEngagedSeconds,
        trafficByDay: siteTrafficByDayRows
          .map((row) => ({
            day: row.day,
            views: Number(row.views) || 0,
          }))
          .reverse(),
        topPages: siteTopPagesRows.map((row) => ({
          path: row.page_path,
          views: Number(row.views) || 0,
        })),
        topSections: siteTopSectionsRows.map((row) => ({
          section: row.section,
          views: Number(row.views) || 0,
        })),
        topClicks: siteTopClicksRows.map((row) => ({
          label: row.label,
          clicks: Number(row.clicks) || 0,
        })),
      },
    });
  });

  app.get('/admin/analytics/users', async (request, reply) => {
    const access = await resolveAdminAccess(request, reply, {
      scope: 'analytics',
      level: 'read',
    });
    if (!access) {
      return;
    }

    let rows: Array<{
      user_id: string;
      email: string;
      role: string;
      is_blocked: boolean;
      blocked_at: Date | null;
      account_state?: string | null;
      is_test_account?: boolean | null;
      deletion_requested_at?: Date | null;
      deletion_scheduled_for?: Date | null;
      deleted_at?: Date | null;
      created_at: Date;
      event_playlists_count: number;
      shared_playlists_count: number;
    }>;

    try {
      rows = await prisma.$queryRaw<
        Array<{
          user_id: string;
          email: string;
          role: string;
          is_blocked: boolean;
          blocked_at: Date | null;
          account_state: string;
          is_test_account: boolean;
          deletion_requested_at: Date | null;
          deletion_scheduled_for: Date | null;
          deleted_at: Date | null;
          created_at: Date;
          event_playlists_count: number;
          shared_playlists_count: number;
        }>
      >`
        SELECT
          u.id AS user_id,
          u.email,
          u.role,
          u.is_blocked,
          u.blocked_at,
          u.account_state,
          u.is_test_account,
          u.deletion_requested_at,
          u.deletion_scheduled_for,
          u.deleted_at,
          u.created_at,
          COALESCE(event_stats.event_playlists_count, 0)::int AS event_playlists_count,
          COALESCE(sync_stats.shared_playlists_count, 0)::int AS shared_playlists_count
        FROM "users" u
        LEFT JOIN (
          SELECT host_user_id, COUNT(*)::int AS event_playlists_count
          FROM "playlists"
          GROUP BY host_user_id
        ) AS event_stats ON event_stats.host_user_id = u.id
        LEFT JOIN (
          SELECT sender_user_id, COUNT(*)::int AS shared_playlists_count
          FROM "playlist_syncs"
          GROUP BY sender_user_id
        ) AS sync_stats ON sync_stats.sender_user_id = u.id
        ORDER BY u.created_at DESC
        LIMIT 300
      `;
    } catch (error) {
      if (!isMissingColumnError(error)) {
        throw error;
      }

      rows = await prisma.$queryRaw<
        Array<{
          user_id: string;
          email: string;
          role: string;
          is_blocked: boolean;
          blocked_at: Date | null;
          created_at: Date;
          event_playlists_count: number;
          shared_playlists_count: number;
        }>
      >`
        SELECT
          u.id AS user_id,
          u.email,
          u.role,
          u.is_blocked,
          u.blocked_at,
          u.created_at,
          COALESCE(event_stats.event_playlists_count, 0)::int AS event_playlists_count,
          COALESCE(sync_stats.shared_playlists_count, 0)::int AS shared_playlists_count
        FROM "users" u
        LEFT JOIN (
          SELECT host_user_id, COUNT(*)::int AS event_playlists_count
          FROM "playlists"
          GROUP BY host_user_id
        ) AS event_stats ON event_stats.host_user_id = u.id
        LEFT JOIN (
          SELECT sender_user_id, COUNT(*)::int AS shared_playlists_count
          FROM "playlist_syncs"
          GROUP BY sender_user_id
        ) AS sync_stats ON sync_stats.sender_user_id = u.id
        ORDER BY u.created_at DESC
        LIMIT 300
      `;
    }

    return adminAnalyticsUsersListResponseSchema.parse({
      users: rows.map((row) => ({
        userId: row.user_id,
        email: row.email,
        role: row.role === 'admin' ? 'admin' : 'user',
        isBlocked: Boolean(row.is_blocked),
        blockedAt: row.blocked_at ? row.blocked_at.toISOString() : null,
        accountState:
          row.account_state === 'pending_deletion' || row.account_state === 'deleted'
            ? row.account_state
            : row.is_blocked
              ? 'blocked'
              : 'active',
        isTestAccount: Boolean(row.is_test_account),
        deletionRequestedAt: row.deletion_requested_at
          ? row.deletion_requested_at.toISOString()
          : null,
        deletionScheduledFor: row.deletion_scheduled_for
          ? row.deletion_scheduled_for.toISOString()
          : null,
        deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
        createdAt: row.created_at.toISOString(),
        eventPlaylistsCount: Number(row.event_playlists_count) || 0,
        sharedPlaylistsCount: Number(row.shared_playlists_count) || 0,
      })),
    });
  });

  app.get('/admin/analytics/users/:userId', async (request, reply) => {
    const access = await resolveAdminAccess(request, reply, {
      scope: 'analytics',
      level: 'read',
    });
    if (!access) {
      return;
    }

    const params = adminUserAnalyticsParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        code: 'validation_error',
        message: 'Request params are invalid.',
        details: params.error.flatten(),
      });
    }

    const targetUser = await authStore.findUserById(params.data.userId);
    if (!targetUser) {
      return reply.status(404).send({
        code: 'user_not_found',
        message: 'User not found.',
      });
    }

    const personalInfo = await authStore.findUserPersonalInfoByUserId(params.data.userId);

    const summaryRows = await prisma.$queryRaw<
      Array<{
        event_playlists_count: number;
        shared_playlists_count: number;
      }>
    >`
      SELECT
        (
          SELECT COUNT(*)::int
          FROM "playlists" e
          WHERE e.host_user_id = u.id
        ) AS event_playlists_count,
        (
          SELECT COUNT(*)::int
          FROM "playlist_syncs" s
          WHERE s.sender_user_id = u.id
        ) AS shared_playlists_count
      FROM "users" u
      WHERE u.id = ${params.data.userId}
      LIMIT 1
    `;

    const eventRows = await prisma.$queryRaw<
      Array<{
        event_id: string;
        name: string;
        provider: 'spotify' | 'apple';
        status: 'open' | 'closed';
        tracks_count: number;
        shared: boolean;
        updated_at: Date;
      }>
    >`
      SELECT
        e.id AS event_id,
        e.name,
        e.provider,
        e.status,
        COUNT(t.id)::int AS tracks_count,
        BOOL_OR(t.added_by = 'guest') AS shared,
        e.updated_at
      FROM "playlists" e
      LEFT JOIN "playlist_tracks" t ON t.event_id = e.id
      WHERE e.host_user_id = ${params.data.userId}
      GROUP BY e.id, e.name, e.provider, e.status, e.updated_at
      ORDER BY e.updated_at DESC
      LIMIT 300
    `;

    const pageViewsByPathRows = await prisma.$queryRaw<
      Array<{
        page_path: string;
        views: number;
      }>
    >`
      SELECT
        page_path,
        COUNT(*)::int AS views
      FROM "analytics_events"
      WHERE user_id = ${params.data.userId}
        AND event_name = 'app_page_view'
      GROUP BY page_path
      ORDER BY views DESC
      LIMIT 15
    `;

    const summary = summaryRows[0] ?? {
      event_playlists_count: 0,
      shared_playlists_count: 0,
    };

    return adminAnalyticsUserDetailResponseSchema.parse({
      user: {
        userId: targetUser.id,
        email: targetUser.email,
        role: targetUser.role,
        isBlocked: targetUser.isBlocked,
        blockedAt: targetUser.blockedAt ? targetUser.blockedAt.toISOString() : null,
        accountState: targetUser.accountState,
        isTestAccount: targetUser.isTestAccount,
        deletionRequestedAt: targetUser.deletionRequestedAt
          ? targetUser.deletionRequestedAt.toISOString()
          : null,
        deletionScheduledFor: targetUser.deletionScheduledFor
          ? targetUser.deletionScheduledFor.toISOString()
          : null,
        deletedAt: targetUser.deletedAt ? targetUser.deletedAt.toISOString() : null,
        createdAt: targetUser.createdAt.toISOString(),
        personalInfo: personalInfoSchema
          .pick({
            displayName: true,
            firstName: true,
            lastName: true,
          })
          .parse({
            displayName: personalInfo?.displayName ?? null,
            firstName: personalInfo?.firstName ?? null,
            lastName: personalInfo?.lastName ?? null,
          }),
        eventPlaylistsCount: Number(summary.event_playlists_count) || 0,
        sharedPlaylistsCount: Number(summary.shared_playlists_count) || 0,
        adminPermissions: targetUser.adminPermissions,
        events: eventRows.map((row) => ({
          eventId: row.event_id,
          name: row.name,
          provider: row.provider,
          status: row.status,
          tracksCount: Number(row.tracks_count) || 0,
          shared: Boolean(row.shared),
          updatedAt: row.updated_at.toISOString(),
        })),
        pageViewsByPath: pageViewsByPathRows.map((row) => ({
          path: row.page_path,
          views: Number(row.views) || 0,
        })),
      },
    });
  });

  app.get('/admin/analytics/playlists/:eventId', async (request, reply) => {
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
      FROM "playlists" e
      JOIN "users" u ON u.id = e.host_user_id
      LEFT JOIN "playlist_tracks" t ON t.event_id = e.id
      WHERE e.id = ${params.data.eventId}
      GROUP BY e.id, e.name, e.description, e.provider, e.status, u.email, e.magic_link_token, e.closed_at, e.created_at, e.updated_at
      LIMIT 1
    `;

    const eventRow = eventRows[0];
    if (!eventRow) {
      return reply.status(404).send({
        code: 'event_not_found',
        message: 'Playlist not found.',
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
            AND page_path LIKE ${`/playlist/${eventRow.magic_link_token}%`}
        )::int AS public_page_views,
        COUNT(*) FILTER (
          WHERE event_name = 'app_page_view'
            AND page_path LIKE ${`/playlists/${eventRow.event_id}%`}
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
      FROM "playlist_tracks"
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
      scope: 'admin_users',
      level: 'write',
    });
    if (!access || !access.user) {
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

    if (access.user.id === existing.id && body.data.role !== 'admin') {
      return reply.status(409).send({
        code: 'self_admin_demotion_not_allowed',
        message: 'You cannot demote your own admin account.',
      });
    }

    const nextRole: AccountRole = body.data.role;
    if (
      await denyLastSuperAdminMutationIfNeeded(reply, existing, {
        role: nextRole,
      })
    ) {
      return;
    }

    const normalizedPermissions = normalizeAdminPermissionsForTarget(
      existing.email,
      nextRole,
      normalizePermissionMap(body.data.adminPermissions),
    );

    await authStore.setUserRoleById(existing.id, nextRole);
    await authStore.replaceUserAdminPermissionsByUserId(existing.id, normalizedPermissions);

    const refreshed = await authStore.findUserById(existing.id);
    if (!refreshed) {
      return reply.status(500).send({
        code: 'admin_user_update_failed',
        message: 'Unable to load updated admin user.',
      });
    }

    await auditAdminAction({
      actor: access.user,
      target: refreshed,
      action: 'admin_access_updated',
      metadata: {
        previousRole: existing.role,
        nextRole: refreshed.role,
        previousPermissions: existing.adminPermissions,
        nextPermissions: refreshed.adminPermissions,
      },
    });

    return reply.status(200).send({
      ok: true,
      user: {
        id: refreshed.id,
        email: refreshed.email,
        role: refreshed.role,
        isBlocked: refreshed.isBlocked,
        blockedAt: refreshed.blockedAt ? refreshed.blockedAt.toISOString() : null,
        accountState: refreshed.accountState,
        isTestAccount: refreshed.isTestAccount,
        deletionRequestedAt: refreshed.deletionRequestedAt
          ? refreshed.deletionRequestedAt.toISOString()
          : null,
        deletionScheduledFor: refreshed.deletionScheduledFor
          ? refreshed.deletionScheduledFor.toISOString()
          : null,
        deletedAt: refreshed.deletedAt ? refreshed.deletedAt.toISOString() : null,
        createdAt: refreshed.createdAt.toISOString(),
        adminPermissions: refreshed.adminPermissions,
      },
    });
  });

  app.post('/admin/users/:userId/reset-user-flow', async (request, reply) => {
    const access = await resolveAdminAccess(request, reply, {
      scope: 'admin_users',
      level: 'write',
    });
    if (!access || !access.user) {
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

    if (access.user.id === params.data.userId) {
      return reply.status(409).send({
        code: 'self_reset_not_allowed',
        message: 'You cannot reset your own account flow.',
      });
    }

    const existing = await authStore.findUserById(params.data.userId);
    if (!existing) {
      return reply.status(404).send({
        code: 'user_not_found',
        message: 'User not found.',
      });
    }

    if (existing.role === 'admin') {
      return reply.status(409).send({
        code: 'admin_reset_not_allowed',
        message: 'Admin accounts cannot be reset through this flow.',
      });
    }

    if (!existing.isTestAccount) {
      return reply.status(409).send({
        code: 'test_account_required',
        message: 'Only accounts marked as test accounts can use this reset flow.',
      });
    }

    await authStore.revokeAllRefreshTokensByUserId(existing.id);
    if (existing.avatarPath) {
      await deleteAvatarImage(existing.avatarPath);
    }

    const deleted = await authStore.deleteUserById(existing.id);
    if (!deleted) {
      return reply.status(500).send({
        code: 'admin_user_reset_failed',
        message: 'Unable to reset this user account.',
      });
    }

    await auditAdminAction({
      actor: access.user,
      target: existing,
      action: 'user_flow_reset',
      metadata: {
        targetRole: existing.role,
        releasedEmail: existing.email,
        testAccount: existing.isTestAccount,
      },
    });

    return reply.status(200).send(
      adminUserResetFlowResponseSchema.parse({
        ok: true,
        reset: true,
        releasedEmail: existing.email,
      }),
    );
  });

  app.put('/admin/users/:userId/test-account', async (request, reply) => {
    const access = await resolveAdminAccess(request, reply, {
      scope: 'admin_users',
      level: 'write',
    });
    if (!access || !access.user) {
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

    const body = adminUserTestAccountUpdateSchema.safeParse(request.body);
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

    if (existing.role === 'admin') {
      return reply.status(409).send({
        code: 'admin_test_account_not_allowed',
        message: 'Admin accounts cannot be marked as test accounts.',
      });
    }

    await authStore.setUserTestAccountFlagById(existing.id, body.data.isTestAccount);
    const refreshed = await authStore.findUserById(existing.id);
    if (!refreshed) {
      return reply.status(500).send({
        code: 'admin_user_update_failed',
        message: 'Unable to load updated user.',
      });
    }

    await auditAdminAction({
      actor: access.user,
      target: refreshed,
      action: body.data.isTestAccount ? 'test_account_enabled' : 'test_account_disabled',
      metadata: {
        previousValue: existing.isTestAccount,
        nextValue: refreshed.isTestAccount,
      },
    });

    return reply.status(200).send({
      ok: true,
      user: {
        id: refreshed.id,
        email: refreshed.email,
        role: refreshed.role,
        isBlocked: refreshed.isBlocked,
        blockedAt: refreshed.blockedAt ? refreshed.blockedAt.toISOString() : null,
        accountState: refreshed.accountState,
        isTestAccount: refreshed.isTestAccount,
        deletionRequestedAt: refreshed.deletionRequestedAt
          ? refreshed.deletionRequestedAt.toISOString()
          : null,
        deletionScheduledFor: refreshed.deletionScheduledFor
          ? refreshed.deletionScheduledFor.toISOString()
          : null,
        deletedAt: refreshed.deletedAt ? refreshed.deletedAt.toISOString() : null,
        createdAt: refreshed.createdAt.toISOString(),
        adminPermissions: refreshed.adminPermissions,
      },
    });
  });

  app.post('/admin/users/:userId/request-deletion', async (request, reply) => {
    const access = await resolveAdminAccess(request, reply, {
      scope: 'admin_users',
      level: 'write',
    });
    if (!access || !access.user) {
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

    const body = adminUserDeletionRequestSchema.safeParse(request.body ?? {});
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

    if (access.user.id === existing.id) {
      return reply.status(409).send({
        code: 'self_deletion_request_not_allowed',
        message: 'You cannot schedule deletion of your own admin account.',
      });
    }

    if (existing.role === 'admin') {
      return reply.status(409).send({
        code: 'admin_deletion_not_allowed',
        message: 'Admin accounts cannot be scheduled for deletion through this flow.',
      });
    }

    const scheduledFor = new Date(Date.now() + accountDeletionGraceDays * 24 * 60 * 60 * 1000);

    if (
      await denyLastSuperAdminMutationIfNeeded(reply, existing, {
        accountState: 'pending_deletion',
      })
    ) {
      return;
    }

    await authStore.scheduleUserDeletionById({
      userId: existing.id,
      reason: body.data.reason ?? null,
      scheduledFor,
    });
    await authStore.revokeAllRefreshTokensByUserId(existing.id);
    await authStore.setUserBlockedStatusById(existing.id, true);

    const refreshed = await authStore.findUserById(existing.id);
    if (!refreshed) {
      return reply.status(500).send({
        code: 'admin_user_update_failed',
        message: 'Unable to load updated user.',
      });
    }

    await auditAdminAction({
      actor: access.user,
      target: refreshed,
      action: 'user_deletion_requested',
      reason: body.data.reason ?? null,
      metadata: {
        scheduledFor: scheduledFor.toISOString(),
      },
    });

    return reply.status(200).send(
      adminUserDeletionResponseSchema.parse({
        ok: true,
        scheduled: true,
        deletionScheduledFor: scheduledFor.toISOString(),
      }),
    );
  });

  app.put('/admin/users/:userId/block', async (request, reply) => {
    const access = await resolveAdminAccess(request, reply, {
      scope: 'users',
      level: 'write',
    });
    if (!access || !access.user) {
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

    const body = adminUserBlockUpdateSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        code: 'validation_error',
        message: 'Request payload is invalid.',
        details: body.error.flatten(),
      });
    }

    if (body.data.blocked && access.user.id === params.data.userId) {
      return reply.status(409).send({
        code: 'self_block_not_allowed',
        message: 'You cannot block your own account.',
      });
    }

    const existing = await authStore.findUserById(params.data.userId);
    if (!existing) {
      return reply.status(404).send({
        code: 'user_not_found',
        message: 'User not found.',
      });
    }

    if (
      await denyLastSuperAdminMutationIfNeeded(reply, existing, {
        blocked: body.data.blocked,
      })
    ) {
      return;
    }

    await authStore.setUserBlockedStatusById(existing.id, body.data.blocked);
    if (body.data.blocked) {
      await authStore.revokeAllRefreshTokensByUserId(existing.id);
    }

    const refreshed = await authStore.findUserById(existing.id);
    if (!refreshed) {
      return reply.status(500).send({
        code: 'admin_user_update_failed',
        message: 'Unable to load updated admin user.',
      });
    }

    await auditAdminAction({
      actor: access.user,
      target: refreshed,
      action: body.data.blocked ? 'user_blocked' : 'user_reactivated',
      metadata: {
        previousBlocked: existing.isBlocked,
        nextBlocked: refreshed.isBlocked,
        accountState: refreshed.accountState,
      },
    });

    return reply.status(200).send({
      ok: true,
      user: {
        id: refreshed.id,
        email: refreshed.email,
        role: refreshed.role,
        isBlocked: refreshed.isBlocked,
        blockedAt: refreshed.blockedAt ? refreshed.blockedAt.toISOString() : null,
        accountState: refreshed.accountState,
        isTestAccount: refreshed.isTestAccount,
        deletionRequestedAt: refreshed.deletionRequestedAt
          ? refreshed.deletionRequestedAt.toISOString()
          : null,
        deletionScheduledFor: refreshed.deletionScheduledFor
          ? refreshed.deletionScheduledFor.toISOString()
          : null,
        deletedAt: refreshed.deletedAt ? refreshed.deletedAt.toISOString() : null,
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
    await authStore.replaceUserAdminPermissionsByUserId(
      user.id,
      defaultAdminPermissionsForEmail(user.email),
    );

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

  app.post('/admin/email/preview/weekly-recap', async (request, reply) => {
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
      const jobId = await enqueueWeeklyRecapEmailPreview({
        toEmail: parsed.data.toEmail,
        locale: parsed.data.locale,
      });

      return reply.status(202).send({
        ok: true,
        queued: true,
        jobId: String(jobId),
      });
    } catch (error) {
      request.log.error({ err: error }, 'failed to enqueue preview weekly recap email');
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
