import {
  accountStateSchema,
  accountRoleSchema,
  adminPermissionLevelSchema,
  adminPermissionScopeSchema,
  emailLocaleSchema,
  type EmailLocale,
  type AccountState,
  type AccountRole,
  type AdminPermission,
} from '@synqit/shared';
import { randomUUID } from 'node:crypto';

import { prisma } from '../db/prisma';

type UserRecord = {
  id: string;
  email: string;
  role: AccountRole;
  isBlocked: boolean;
  blockedAt: Date | null;
  accountState: AccountState;
  isTestAccount: boolean;
  deletionRequestedAt: Date | null;
  deletionScheduledFor: Date | null;
  deletedAt: Date | null;
  deletionReason: string | null;
  testResetAt: Date | null;
  adminPermissions: AdminPermission[];
  passwordHash: string | null;
  avatarPath: string | null;
  createdAt: Date;
};

type AdminAuditLogRecord = {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  targetUserId: string | null;
  targetEmail: string | null;
  action: string;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
};

type EmailRecipientRecord = {
  userId: string;
  email: string;
  locale: EmailLocale;
};

type PasswordIdentityRecord = {
  userId: string;
  providerUserId: string;
  passwordHash: string | null;
};

type RefreshTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByTokenId: string | null;
};

type PasswordResetTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
};

type UserPersonalInfoRecord = {
  userId: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  country: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type UserRow = {
  id: string;
  email: string;
  role?: string | null;
  is_blocked?: boolean | null;
  blocked_at?: Date | null;
  account_state?: string | null;
  is_test_account?: boolean | null;
  deletion_requested_at?: Date | null;
  deletion_scheduled_for?: Date | null;
  deleted_at?: Date | null;
  deletion_reason?: string | null;
  test_reset_at?: Date | null;
  password_hash: string | null;
  avatar_url?: string | null;
  created_at: Date;
};

type AdminAuditLogRow = {
  id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  target_user_id: string | null;
  target_email: string | null;
  action: string;
  reason: string | null;
  metadata_json: unknown;
  created_at: Date;
};

type UserAdminPermissionRow = {
  user_id: string;
  scope: string;
  access_level: string;
};

type PasswordIdentityRow = {
  user_id: string;
  provider_user_id: string;
  password_hash: string | null;
};

type UserProfileRow = {
  user_id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  country: string | null;
  created_at: Date;
  updated_at: Date;
};

type UserPreferencesRecord = {
  userId: string;
  theme: string | null;
  locale: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type UserPreferencesRow = {
  user_id: string;
  theme: string | null;
  locale: string | null;
  created_at: Date;
  updated_at: Date;
};

// Full email addresses only. Set ADMIN_SUPER_USERS in every environment; it is
// required in production (see config.ts). Matching on the local part was removed
// because anyone could register `<local-part>@other-domain` and inherit super
// admin permissions.
const DEFAULT_SUPER_ADMIN_IDENTITIES = 'shamanproto@gmail.com';

type RefreshTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  replaced_by_token_id: string | null;
};

type PasswordResetTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: Date;
  expires_at: Date;
  used_at: Date | null;
};

const toUserRecord = (row: UserRow): UserRecord => ({
  id: row.id,
  email: row.email,
  role: accountRoleSchema.safeParse(row.role).success ? (row.role as AccountRole) : 'user',
  isBlocked: row.is_blocked === true,
  blockedAt: row.blocked_at ? new Date(row.blocked_at) : null,
  accountState: accountStateSchema.safeParse(row.account_state).success
    ? (row.account_state as AccountState)
    : row.is_blocked
      ? 'blocked'
      : 'active',
  isTestAccount: row.is_test_account === true,
  deletionRequestedAt: row.deletion_requested_at ? new Date(row.deletion_requested_at) : null,
  deletionScheduledFor: row.deletion_scheduled_for ? new Date(row.deletion_scheduled_for) : null,
  deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
  deletionReason: row.deletion_reason ?? null,
  testResetAt: row.test_reset_at ? new Date(row.test_reset_at) : null,
  adminPermissions: [],
  passwordHash: row.password_hash,
  avatarPath: row.avatar_url ?? null,
  createdAt: new Date(row.created_at),
});

/** Parses a comma-separated ADMIN_SUPER_USERS value into lower-cased full email addresses. */
export const parseSuperAdminIdentities = (raw: string | undefined): Set<string> =>
  new Set(
    (raw ?? DEFAULT_SUPER_ADMIN_IDENTITIES)
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.includes('@')),
  );

const readSuperAdminIdentities = (): Set<string> =>
  parseSuperAdminIdentities(process.env.ADMIN_SUPER_USERS);

export const isSuperAdminIdentity = (email: string): boolean =>
  readSuperAdminIdentities().has(email.trim().toLowerCase());

const toAdminAuditLogRecord = (row: AdminAuditLogRow): AdminAuditLogRecord => ({
  id: row.id,
  actorUserId: row.actor_user_id,
  actorEmail: row.actor_email,
  targetUserId: row.target_user_id,
  targetEmail: row.target_email,
  action: row.action,
  reason: row.reason,
  metadata:
    row.metadata_json && typeof row.metadata_json === 'object'
      ? (row.metadata_json as Record<string, unknown>)
      : null,
  createdAt: new Date(row.created_at),
});

const withDerivedAdminPermissions = (
  user: UserRecord,
  permissions: AdminPermission[],
): AdminPermission[] => {
  if (user.role !== 'admin' || !isSuperAdminIdentity(user.email)) {
    return permissions;
  }

  const hasAdminUsers = permissions.some((permission) => permission.scope === 'admin_users');
  if (hasAdminUsers) {
    return permissions;
  }

  return [
    ...permissions,
    {
      scope: 'admin_users',
      level: 'write',
    },
  ];
};

const toRefreshTokenRecord = (row: RefreshTokenRow): RefreshTokenRecord => ({
  id: row.id,
  userId: row.user_id,
  tokenHash: row.token_hash,
  createdAt: new Date(row.created_at),
  expiresAt: new Date(row.expires_at),
  revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
  replacedByTokenId: row.replaced_by_token_id,
});

const toPasswordIdentityRecord = (row: PasswordIdentityRow): PasswordIdentityRecord => ({
  userId: row.user_id,
  providerUserId: row.provider_user_id,
  passwordHash: row.password_hash,
});

const toPasswordResetTokenRecord = (row: PasswordResetTokenRow): PasswordResetTokenRecord => ({
  id: row.id,
  userId: row.user_id,
  tokenHash: row.token_hash,
  createdAt: new Date(row.created_at),
  expiresAt: new Date(row.expires_at),
  usedAt: row.used_at ? new Date(row.used_at) : null,
});

const toDateOnlyString = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  return value.slice(0, 10);
};

const toUserPersonalInfoRecord = (row: UserProfileRow): UserPersonalInfoRecord => ({
  userId: row.user_id,
  displayName: row.display_name,
  firstName: row.first_name,
  lastName: row.last_name,
  birthDate: toDateOnlyString(row.birth_date),
  country: row.country,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
});

const toUserPreferencesRecord = (row: UserPreferencesRow): UserPreferencesRecord => ({
  userId: row.user_id,
  theme: row.theme,
  locale: row.locale,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
});

const isUniqueConstraintViolation = (error: unknown): boolean => {
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
  const sqlCode = normalized.meta?.driverAdapterError?.cause?.originalCode;

  return normalized.code === 'P2002' || normalized.code === '23505' || sqlCode === '23505';
};

const isMissingRelationError = (error: unknown): boolean => {
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

  if (normalized.code === '42P01') {
    return true;
  }

  const sqlCode = normalized.meta?.driverAdapterError?.cause?.originalCode;
  return sqlCode === '42P01';
};

const isMissingAvatarColumnError = (error: unknown): boolean => {
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

const loadUsersByEmailWithFallback = async (email: string): Promise<UserRow[]> => {
  try {
    return await prisma.$queryRaw<UserRow[]>`
      SELECT id, email, role, is_blocked, blocked_at, password_hash, avatar_url, created_at
      , account_state, is_test_account, deletion_requested_at, deletion_scheduled_for, deleted_at, deletion_reason, test_reset_at
      FROM "users"
      WHERE email = ${email}
      LIMIT 1
    `;
  } catch (error) {
    if (!isMissingAvatarColumnError(error)) {
      throw error;
    }
  }

  try {
    return await prisma.$queryRaw<UserRow[]>`
      SELECT id, email, role, is_blocked, blocked_at, password_hash, avatar_url, created_at
      FROM "users"
      WHERE email = ${email}
      LIMIT 1
    `;
  } catch (error) {
    if (!isMissingAvatarColumnError(error)) {
      throw error;
    }
  }

  return prisma.$queryRaw<UserRow[]>`
    SELECT id, email, role, is_blocked, blocked_at, password_hash, created_at
    FROM "users"
    WHERE email = ${email}
    LIMIT 1
  `;
};

const loadUsersByIdWithFallback = async (id: string): Promise<UserRow[]> => {
  try {
    return await prisma.$queryRaw<UserRow[]>`
      SELECT id, email, role, is_blocked, blocked_at, password_hash, avatar_url, created_at
      , account_state, is_test_account, deletion_requested_at, deletion_scheduled_for, deleted_at, deletion_reason, test_reset_at
      FROM "users"
      WHERE id = ${id}
      LIMIT 1
    `;
  } catch (error) {
    if (!isMissingAvatarColumnError(error)) {
      throw error;
    }
  }

  try {
    return await prisma.$queryRaw<UserRow[]>`
      SELECT id, email, role, is_blocked, blocked_at, password_hash, avatar_url, created_at
      FROM "users"
      WHERE id = ${id}
      LIMIT 1
    `;
  } catch (error) {
    if (!isMissingAvatarColumnError(error)) {
      throw error;
    }
  }

  return prisma.$queryRaw<UserRow[]>`
    SELECT id, email, role, is_blocked, blocked_at, password_hash, created_at
    FROM "users"
    WHERE id = ${id}
    LIMIT 1
  `;
};

const loadUsersListWithFallback = async (): Promise<UserRow[]> => {
  try {
    return await prisma.$queryRaw<UserRow[]>`
      SELECT id, email, role, is_blocked, blocked_at, password_hash, avatar_url, created_at
      , account_state, is_test_account, deletion_requested_at, deletion_scheduled_for, deleted_at, deletion_reason, test_reset_at
      FROM "users"
      ORDER BY created_at DESC
      LIMIT 200
    `;
  } catch (error) {
    if (!isMissingAvatarColumnError(error)) {
      throw error;
    }
  }

  try {
    return await prisma.$queryRaw<UserRow[]>`
      SELECT id, email, role, is_blocked, blocked_at, password_hash, avatar_url, created_at
      FROM "users"
      ORDER BY created_at DESC
      LIMIT 200
    `;
  } catch (error) {
    if (!isMissingAvatarColumnError(error)) {
      throw error;
    }
  }

  return prisma.$queryRaw<UserRow[]>`
    SELECT id, email, role, is_blocked, blocked_at, password_hash, created_at
    FROM "users"
    ORDER BY created_at DESC
    LIMIT 200
  `;
};

const toAdminPermission = (row: UserAdminPermissionRow): AdminPermission | null => {
  const scope = adminPermissionScopeSchema.safeParse(row.scope);
  const level = adminPermissionLevelSchema.safeParse(row.access_level);
  if (!scope.success || !level.success) {
    return null;
  }

  return {
    scope: scope.data,
    level: level.data,
  };
};

const PASSWORD_AUTH_PROVIDER = 'password';

const ACTIVE_SUPER_ADMIN_ROLE = 'admin';

export const authStore = {
  async createUser(params: { email: string; passwordHash: string }): Promise<UserRecord | null> {
    const normalizedEmail = params.email.trim().toLowerCase();
    const userId = randomUUID();
    const createdAt = new Date();
    try {
      const rows = await prisma.$queryRaw<UserRow[]>`
        INSERT INTO "users" (
          id,
          email,
          role,
          account_state,
          is_test_account,
          deletion_requested_at,
          deletion_scheduled_for,
          deleted_at,
          deletion_reason,
          test_reset_at,
          password_hash,
          is_blocked,
          blocked_at,
          avatar_url,
          created_at
        )
        VALUES (${userId}, ${normalizedEmail}, ${'user'}, ${'active'}, ${false}, ${null}, ${null}, ${null}, ${null}, ${null}, ${params.passwordHash}, ${false}, ${null}, ${null}, ${createdAt})
        RETURNING id, email, role, is_blocked, blocked_at, account_state, is_test_account, deletion_requested_at, deletion_scheduled_for, deleted_at, deletion_reason, test_reset_at, password_hash, avatar_url, created_at
      `;
      if (rows.length === 0) {
        return null;
      }
      const record = toUserRecord(rows[0]);
      record.adminPermissions = withDerivedAdminPermissions(
        record,
        await authStore.listUserAdminPermissionsByUserId(record.id),
      );
      return record;
    } catch (error) {
      if (isMissingAvatarColumnError(error)) {
        try {
          const rows = await prisma.$queryRaw<UserRow[]>`
            INSERT INTO "users" (id, email, password_hash, created_at)
            VALUES (${userId}, ${normalizedEmail}, ${params.passwordHash}, ${createdAt})
            RETURNING id, email, password_hash, created_at
          `;
          if (rows.length === 0) {
            return null;
          }
          const record = toUserRecord(rows[0]);
          record.adminPermissions = withDerivedAdminPermissions(
            record,
            await authStore.listUserAdminPermissionsByUserId(record.id),
          );
          return record;
        } catch (fallbackError) {
          if (isUniqueConstraintViolation(fallbackError)) {
            return null;
          }
          throw fallbackError;
        }
      }

      if (isUniqueConstraintViolation(error)) {
        return null;
      }
      throw error;
    }
  },

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const rows = await loadUsersByEmailWithFallback(normalizedEmail);
    if (rows.length === 0) {
      return null;
    }

    const record = toUserRecord(rows[0]);
    record.adminPermissions = withDerivedAdminPermissions(
      record,
      await authStore.listUserAdminPermissionsByUserId(record.id),
    );
    return record;
  },

  async findUserById(id: string): Promise<UserRecord | null> {
    const rows = await loadUsersByIdWithFallback(id);
    if (rows.length === 0) {
      return null;
    }

    const record = toUserRecord(rows[0]);
    record.adminPermissions = withDerivedAdminPermissions(
      record,
      await authStore.listUserAdminPermissionsByUserId(record.id),
    );
    return record;
  },

  async listEmailRecipientsByIds(userIds: string[]): Promise<EmailRecipientRecord[]> {
    if (userIds.length === 0) {
      return [];
    }

    const rows = await prisma.users.findMany({
      where: {
        id: { in: Array.from(new Set(userIds)) },
        is_blocked: false,
      },
      select: {
        id: true,
        email: true,
        user_preferences: {
          select: { locale: true },
        },
      },
    });

    return rows.map((row) => ({
      userId: row.id,
      email: row.email,
      locale: emailLocaleSchema.safeParse(row.user_preferences?.locale).success
        ? (row.user_preferences?.locale as EmailLocale)
        : 'en',
    }));
  },

  async listUserAdminPermissionsByUserId(userId: string): Promise<AdminPermission[]> {
    try {
      const rows = await prisma.$queryRaw<UserAdminPermissionRow[]>`
        SELECT user_id, scope, access_level
        FROM "user_admin_permissions"
        WHERE user_id = ${userId}
      `;

      return rows
        .map(toAdminPermission)
        .filter((value): value is AdminPermission => value !== null);
    } catch (error) {
      if (isMissingRelationError(error)) {
        return [];
      }
      throw error;
    }
  },

  async setUserRoleById(userId: string, role: AccountRole): Promise<boolean> {
    const updatedCount = await prisma.$executeRaw`
      UPDATE "users"
      SET role = ${role}
      WHERE id = ${userId}
    `;

    return Number(updatedCount) === 1;
  },

  async setUserBlockedStatusById(userId: string, blocked: boolean): Promise<boolean> {
    const blockedAt = blocked ? new Date() : null;
    const updatedCount = await prisma.$executeRaw`
      UPDATE "users"
      SET
        is_blocked = ${blocked},
        blocked_at = ${blockedAt},
        account_state = CASE
          WHEN account_state IN (${`pending_deletion`}, ${`deleted`}) THEN account_state
          WHEN ${blocked} = true THEN ${'blocked'}
          ELSE ${'active'}
        END
      WHERE id = ${userId}
    `;

    return Number(updatedCount) === 1;
  },

  async replaceUserAdminPermissionsByUserId(
    userId: string,
    permissions: AdminPermission[],
  ): Promise<void> {
    const storablePermissions = permissions.filter(
      (permission) => permission.scope !== 'admin_users',
    );

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        DELETE FROM "user_admin_permissions"
        WHERE user_id = ${userId}
      `;

      if (storablePermissions.length === 0) {
        return;
      }

      const now = new Date();
      for (const permission of storablePermissions) {
        await tx.$executeRaw`
          INSERT INTO "user_admin_permissions" (
            user_id,
            scope,
            access_level,
            created_at,
            updated_at
          )
          VALUES (
            ${userId},
            ${permission.scope},
            ${permission.level},
            ${now},
            ${now}
          )
          ON CONFLICT (user_id, scope)
          DO UPDATE SET
            access_level = EXCLUDED.access_level,
            updated_at = EXCLUDED.updated_at
        `;
      }
    });
  },

  async listUsers(): Promise<UserRecord[]> {
    const rows = await loadUsersListWithFallback();

    const users = rows.map((row) => toUserRecord(row));
    const permissionsByUser = new Map<string, AdminPermission[]>();
    try {
      const permissionRows = await prisma.$queryRaw<UserAdminPermissionRow[]>`
        SELECT user_id, scope, access_level
        FROM "user_admin_permissions"
      `;
      for (const row of permissionRows) {
        const permission = toAdminPermission(row);
        if (!permission) {
          continue;
        }
        const existing = permissionsByUser.get(row.user_id) ?? [];
        existing.push(permission);
        permissionsByUser.set(row.user_id, existing);
      }
    } catch (error) {
      if (!isMissingRelationError(error)) {
        throw error;
      }
    }

    return users.map((user) => ({
      ...user,
      adminPermissions: withDerivedAdminPermissions(user, permissionsByUser.get(user.id) ?? []),
    }));
  },

  async countActiveSuperAdmins(): Promise<number> {
    const rows = await prisma.$queryRaw<UserRow[]>`
      SELECT id, email, role, is_blocked, blocked_at, account_state, is_test_account, deletion_requested_at, deletion_scheduled_for, deleted_at, deletion_reason, test_reset_at, password_hash, avatar_url, created_at
      FROM "users"
      WHERE role = ${ACTIVE_SUPER_ADMIN_ROLE}
    `;

    return rows
      .map(toUserRecord)
      .filter(
        (user) =>
          isSuperAdminIdentity(user.email) &&
          !user.isBlocked &&
          user.accountState !== 'pending_deletion' &&
          user.accountState !== 'deleted',
      ).length;
  },

  async setUserTestAccountFlagById(userId: string, isTestAccount: boolean): Promise<boolean> {
    const updatedCount = await prisma.$executeRaw`
      UPDATE "users"
      SET is_test_account = ${isTestAccount}
      WHERE id = ${userId}
    `;

    return Number(updatedCount) === 1;
  },

  async scheduleUserDeletionById(params: {
    userId: string;
    reason: string | null;
    scheduledFor: Date;
  }): Promise<boolean> {
    const updatedCount = await prisma.$executeRaw`
      UPDATE "users"
      SET
        account_state = ${'pending_deletion'},
        is_blocked = ${true},
        blocked_at = COALESCE(blocked_at, NOW()),
        deletion_requested_at = NOW(),
        deletion_scheduled_for = ${params.scheduledFor},
        deletion_reason = ${params.reason}
      WHERE id = ${params.userId}
    `;

    return Number(updatedCount) === 1;
  },

  async cancelUserDeletionById(userId: string): Promise<boolean> {
    const updatedCount = await prisma.$executeRaw`
      UPDATE "users"
      SET
        account_state = CASE WHEN deleted_at IS NULL THEN ${'active'} ELSE ${'deleted'} END,
        deletion_requested_at = ${null},
        deletion_scheduled_for = ${null},
        deletion_reason = ${null}
      WHERE id = ${userId}
        AND account_state = ${'pending_deletion'}
    `;

    return Number(updatedCount) === 1;
  },

  async markUserTestResetById(userId: string): Promise<boolean> {
    const updatedCount = await prisma.$executeRaw`
      UPDATE "users"
      SET test_reset_at = NOW()
      WHERE id = ${userId}
    `;
    return Number(updatedCount) === 1;
  },

  async listUsersPendingDeletion(limit = 50): Promise<UserRecord[]> {
    const rows = await prisma.$queryRaw<UserRow[]>`
      SELECT id, email, role, is_blocked, blocked_at, account_state, is_test_account, deletion_requested_at, deletion_scheduled_for, deleted_at, deletion_reason, test_reset_at, password_hash, avatar_url, created_at
      FROM "users"
      WHERE account_state = ${'pending_deletion'}
        AND deletion_scheduled_for IS NOT NULL
        AND deletion_scheduled_for <= NOW()
      ORDER BY deletion_scheduled_for ASC
      LIMIT ${Math.max(1, Math.floor(limit))}
    `;

    const users = rows.map(toUserRecord);
    return Promise.all(
      users.map(async (user) => ({
        ...user,
        adminPermissions: withDerivedAdminPermissions(
          user,
          await authStore.listUserAdminPermissionsByUserId(user.id),
        ),
      })),
    );
  },

  async anonymizeUserForDeletionById(
    userId: string,
  ): Promise<{ ok: boolean; avatarPath: string | null }> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.$queryRaw<UserRow[]>`
        SELECT id, email, role, is_blocked, blocked_at, account_state, is_test_account, deletion_requested_at, deletion_scheduled_for, deleted_at, deletion_reason, test_reset_at, password_hash, avatar_url, created_at
        FROM "users"
        WHERE id = ${userId}
        LIMIT 1
      `;
      if (existing.length === 0) {
        return { ok: false, avatarPath: null };
      }

      const user = toUserRecord(existing[0]);
      const anonymizedEmail = `deleted+${user.id}@example.invalid`;

      await tx.$executeRaw`DELETE FROM "user_auth_identities" WHERE user_id = ${userId}`;
      await tx.$executeRaw`DELETE FROM "password_reset_tokens" WHERE user_id = ${userId}`;
      await tx.$executeRaw`DELETE FROM "refresh_tokens" WHERE user_id = ${userId}`;
      await tx.$executeRaw`DELETE FROM "oauth_states" WHERE user_id = ${userId}`;
      await tx.$executeRaw`DELETE FROM "integrations" WHERE user_id = ${userId}`;
      await tx.$executeRaw`DELETE FROM "user_profiles" WHERE user_id = ${userId}`;
      await tx.$executeRaw`DELETE FROM "user_preferences" WHERE user_id = ${userId}`;
      await tx.$executeRaw`DELETE FROM "user_admin_permissions" WHERE user_id = ${userId}`;

      const updatedCount = await tx.$executeRaw`
        UPDATE "users"
        SET
          email = ${anonymizedEmail},
          role = ${'user'},
          is_blocked = ${true},
          blocked_at = COALESCE(blocked_at, NOW()),
          account_state = ${'deleted'},
          is_test_account = ${false},
          deletion_scheduled_for = ${null},
          deleted_at = COALESCE(deleted_at, NOW()),
          password_hash = ${null},
          avatar_url = ${null}
        WHERE id = ${userId}
      `;

      return {
        ok: Number(updatedCount) === 1,
        avatarPath: user.avatarPath,
      };
    });
  },

  async createAdminAuditLog(params: {
    actorUserId?: string | null;
    actorEmail?: string | null;
    targetUserId?: string | null;
    targetEmail?: string | null;
    action: string;
    reason?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<AdminAuditLogRecord | null> {
    let rows: AdminAuditLogRow[];
    try {
      rows = await prisma.$queryRaw<AdminAuditLogRow[]>`
        INSERT INTO "admin_audit_logs" (
          id,
          actor_user_id,
          actor_email,
          target_user_id,
          target_email,
          action,
          reason,
          metadata_json,
          created_at
        )
        VALUES (
          ${randomUUID()},
          ${params.actorUserId ?? null},
          ${params.actorEmail ?? null},
          ${params.targetUserId ?? null},
          ${params.targetEmail ?? null},
          ${params.action},
          ${params.reason ?? null},
          ${params.metadata ?? null},
          ${new Date()}
        )
        RETURNING id, actor_user_id, actor_email, target_user_id, target_email, action, reason, metadata_json, created_at
      `;
    } catch (error) {
      if (isMissingRelationError(error)) {
        return null;
      }
      throw error;
    }

    return rows[0] ? toAdminAuditLogRecord(rows[0]) : null;
  },

  async updateUserPasswordById(userId: string, passwordHash: string): Promise<boolean> {
    const result = await prisma.users.updateMany({
      where: { id: userId },
      data: {
        password_hash: passwordHash,
      },
    });

    return result.count === 1;
  },

  async findPasswordIdentityByEmail(email: string): Promise<PasswordIdentityRecord | null> {
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const rows = await prisma.$queryRaw<PasswordIdentityRow[]>`
        SELECT user_id, provider_user_id, password_hash
        FROM "user_auth_identities"
        WHERE provider = ${PASSWORD_AUTH_PROVIDER}
          AND provider_user_id = ${normalizedEmail}
        LIMIT 1
      `;
      return rows.length > 0 ? toPasswordIdentityRecord(rows[0]) : null;
    } catch (error) {
      if (isMissingRelationError(error)) {
        return null;
      }
      throw error;
    }
  },

  async findPasswordIdentityByUserId(userId: string): Promise<PasswordIdentityRecord | null> {
    try {
      const rows = await prisma.$queryRaw<PasswordIdentityRow[]>`
        SELECT user_id, provider_user_id, password_hash
        FROM "user_auth_identities"
        WHERE provider = ${PASSWORD_AUTH_PROVIDER}
          AND user_id = ${userId}
        LIMIT 1
      `;
      return rows.length > 0 ? toPasswordIdentityRecord(rows[0]) : null;
    } catch (error) {
      if (isMissingRelationError(error)) {
        return null;
      }
      throw error;
    }
  },

  async upsertPasswordIdentity(params: {
    userId: string;
    email: string;
    passwordHash: string;
  }): Promise<boolean> {
    const normalizedEmail = params.email.trim().toLowerCase();
    const now = new Date();
    try {
      const result = await prisma.$executeRaw`
        INSERT INTO "user_auth_identities" (
          id,
          user_id,
          provider,
          provider_user_id,
          password_hash,
          created_at,
          updated_at
        )
        VALUES (
          ${`password:${params.userId}`},
          ${params.userId},
          ${PASSWORD_AUTH_PROVIDER},
          ${normalizedEmail},
          ${params.passwordHash},
          ${now},
          ${now}
        )
        ON CONFLICT (user_id, provider)
        DO UPDATE SET
          provider_user_id = EXCLUDED.provider_user_id,
          password_hash = EXCLUDED.password_hash,
          updated_at = EXCLUDED.updated_at
      `;
      return Number(result) > 0;
    } catch (error) {
      if (isMissingRelationError(error)) {
        return false;
      }
      throw error;
    }
  },

  async updateUserAvatarPathById(userId: string, avatarPath: string | null): Promise<boolean> {
    try {
      const updatedCount = await prisma.$executeRaw`
        UPDATE "users"
        SET avatar_url = ${avatarPath}
        WHERE id = ${userId}
      `;

      return Number(updatedCount) === 1;
    } catch (error) {
      if (isMissingAvatarColumnError(error)) {
        return false;
      }
      throw error;
    }
  },

  async findUserPersonalInfoByUserId(userId: string): Promise<UserPersonalInfoRecord | null> {
    const rows = await prisma.$queryRaw<UserProfileRow[]>`
      SELECT
        user_id,
        display_name,
        first_name,
        last_name,
        birth_date::text AS birth_date,
        country,
        created_at,
        updated_at
      FROM "user_profiles"
      WHERE user_id = ${userId}
      LIMIT 1
    `;

    return rows.length > 0 ? toUserPersonalInfoRecord(rows[0]) : null;
  },

  async upsertUserPersonalInfoByUserId(
    userId: string,
    values: {
      displayName: string | null;
      firstName: string | null;
      lastName: string | null;
      birthDate: string | null;
      country: string | null;
    },
  ): Promise<UserPersonalInfoRecord | null> {
    const now = new Date();
    const rows = await prisma.$queryRaw<UserProfileRow[]>`
      INSERT INTO "user_profiles" (
        user_id,
        display_name,
        first_name,
        last_name,
        birth_date,
        country,
        created_at,
        updated_at
      )
      VALUES (
        ${userId},
        ${values.displayName},
        ${values.firstName},
        ${values.lastName},
        ${values.birthDate}::date,
        ${values.country},
        ${now},
        ${now}
      )
      ON CONFLICT (user_id)
      DO UPDATE SET
        display_name = EXCLUDED.display_name,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        birth_date = EXCLUDED.birth_date,
        country = EXCLUDED.country,
        updated_at = EXCLUDED.updated_at
      RETURNING
        user_id,
        display_name,
        first_name,
        last_name,
        birth_date::text AS birth_date,
        country,
        created_at,
        updated_at
    `;

    return rows.length > 0 ? toUserPersonalInfoRecord(rows[0]) : null;
  },

  async clearUserPersonalInfoByUserId(userId: string): Promise<boolean> {
    const deletedCount = await prisma.$executeRaw`
      DELETE FROM "user_profiles"
      WHERE user_id = ${userId}
    `;

    return Number(deletedCount) > 0;
  },

  async findUserPreferencesByUserId(userId: string): Promise<UserPreferencesRecord | null> {
    const rows = await prisma.$queryRaw<UserPreferencesRow[]>`
      SELECT user_id, theme, locale, created_at, updated_at
      FROM "user_preferences"
      WHERE user_id = ${userId}
      LIMIT 1
    `;

    return rows.length > 0 ? toUserPreferencesRecord(rows[0]) : null;
  },

  async upsertUserPreferencesByUserId(
    userId: string,
    values: { theme: string | null; locale: string | null },
  ): Promise<UserPreferencesRecord | null> {
    const now = new Date();
    const rows = await prisma.$queryRaw<UserPreferencesRow[]>`
      INSERT INTO "user_preferences" (user_id, theme, locale, created_at, updated_at)
      VALUES (${userId}, ${values.theme}, ${values.locale}, ${now}, ${now})
      ON CONFLICT (user_id)
      DO UPDATE SET
        theme = EXCLUDED.theme,
        locale = EXCLUDED.locale,
        updated_at = EXCLUDED.updated_at
      RETURNING user_id, theme, locale, created_at, updated_at
    `;

    return rows.length > 0 ? toUserPreferencesRecord(rows[0]) : null;
  },

  async createRefreshToken(params: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord> {
    const nextId = randomUUID();
    const row = await prisma.refresh_tokens.create({
      data: {
        id: nextId,
        user_id: params.userId,
        token_hash: params.tokenHash,
        created_at: new Date(),
        expires_at: params.expiresAt,
        revoked_at: null,
        replaced_by_token_id: null,
      },
    });

    return toRefreshTokenRecord(row);
  },

  async createPasswordResetToken(params: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<PasswordResetTokenRecord | null> {
    const id = randomUUID();
    const createdAt = new Date();
    try {
      const rows = await prisma.$queryRaw<PasswordResetTokenRow[]>`
        INSERT INTO "password_reset_tokens" (
          id,
          user_id,
          token_hash,
          created_at,
          expires_at,
          used_at
        )
        VALUES (
          ${id},
          ${params.userId},
          ${params.tokenHash},
          ${createdAt},
          ${params.expiresAt},
          ${null}
        )
        RETURNING id, user_id, token_hash, created_at, expires_at, used_at
      `;

      return rows.length > 0 ? toPasswordResetTokenRecord(rows[0]) : null;
    } catch (error) {
      if (isMissingRelationError(error)) {
        return null;
      }
      throw error;
    }
  },

  async registerUser(params: {
    email: string;
    passwordHash: string;
  }): Promise<{ kind: 'created'; user: UserRecord } | { kind: 'email_taken' }> {
    const normalizedEmail = params.email.trim().toLowerCase();
    const userId = randomUUID();
    const createdAt = new Date();

    return prisma.$transaction(async (tx) => {
      let userRows: UserRow[];
      try {
        userRows = await tx.$queryRaw<UserRow[]>`
          INSERT INTO "users" (
            id,
            email,
            role,
            account_state,
            is_test_account,
            deletion_requested_at,
            deletion_scheduled_for,
            deleted_at,
            deletion_reason,
            test_reset_at,
            password_hash,
            is_blocked,
            blocked_at,
            avatar_url,
            created_at
          )
          VALUES (${userId}, ${normalizedEmail}, ${'user'}, ${'active'}, ${false}, ${null}, ${null}, ${null}, ${null}, ${null}, ${params.passwordHash}, ${false}, ${null}, ${null}, ${createdAt})
          RETURNING id, email, role, is_blocked, blocked_at, account_state, is_test_account, deletion_requested_at, deletion_scheduled_for, deleted_at, deletion_reason, test_reset_at, password_hash, avatar_url, created_at
        `;
      } catch (error) {
        if (isUniqueConstraintViolation(error)) {
          return { kind: 'email_taken' } as const;
        }
        throw error;
      }

      if (userRows.length === 0) {
        return { kind: 'email_taken' } as const;
      }

      const now = new Date();
      await tx.$executeRaw`
        INSERT INTO "user_auth_identities" (
          id,
          user_id,
          provider,
          provider_user_id,
          password_hash,
          created_at,
          updated_at
        )
        VALUES (
          ${`password:${userId}`},
          ${userId},
          ${PASSWORD_AUTH_PROVIDER},
          ${normalizedEmail},
          ${params.passwordHash},
          ${now},
          ${now}
        )
        ON CONFLICT (user_id, provider)
        DO UPDATE SET
          provider_user_id = EXCLUDED.provider_user_id,
          password_hash = EXCLUDED.password_hash,
          updated_at = EXCLUDED.updated_at
      `;

      const user = toUserRecord(userRows[0]);
      user.adminPermissions = withDerivedAdminPermissions(
        user,
        await authStore.listUserAdminPermissionsByUserId(user.id),
      );
      return { kind: 'created', user } as const;
    });
  },

  async findActivePasswordResetTokenByHash(
    tokenHash: string,
  ): Promise<PasswordResetTokenRecord | null> {
    try {
      const rows = await prisma.$queryRaw<PasswordResetTokenRow[]>`
        SELECT id, user_id, token_hash, created_at, expires_at, used_at
        FROM "password_reset_tokens"
        WHERE token_hash = ${tokenHash}
          AND used_at IS NULL
          AND expires_at > NOW()
        LIMIT 1
      `;

      return rows.length > 0 ? toPasswordResetTokenRecord(rows[0]) : null;
    } catch (error) {
      if (isMissingRelationError(error)) {
        return null;
      }
      throw error;
    }
  },

  async markPasswordResetTokenUsedById(id: string): Promise<boolean> {
    try {
      const updatedCount = await prisma.$executeRaw`
        UPDATE "password_reset_tokens"
        SET used_at = NOW()
        WHERE id = ${id}
          AND used_at IS NULL
      `;

      return Number(updatedCount) === 1;
    } catch (error) {
      if (isMissingRelationError(error)) {
        return false;
      }
      throw error;
    }
  },

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const row = await prisma.refresh_tokens.findUnique({
      where: { token_hash: tokenHash },
    });
    return row ? toRefreshTokenRecord(row) : null;
  },

  async rotateRefreshToken(params: {
    oldTokenHash: string;
    newTokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord | null> {
    return prisma.$transaction(async (tx) => {
      const oldRow = await tx.refresh_tokens.findUnique({
        where: { token_hash: params.oldTokenHash },
      });

      if (!oldRow || oldRow.revoked_at) {
        return null;
      }

      const nextId = randomUUID();
      const revokeResult = await tx.refresh_tokens.updateMany({
        where: {
          id: oldRow.id,
          revoked_at: null,
        },
        data: {
          revoked_at: new Date(),
          replaced_by_token_id: nextId,
        },
      });
      if (revokeResult.count !== 1) {
        return null;
      }

      const newRow = await tx.refresh_tokens.create({
        data: {
          id: nextId,
          user_id: oldRow.user_id,
          token_hash: params.newTokenHash,
          created_at: new Date(),
          expires_at: params.expiresAt,
          revoked_at: null,
          replaced_by_token_id: null,
        },
      });

      return toRefreshTokenRecord(newRow);
    });
  },

  async revokeRefreshTokenByHash(tokenHash: string): Promise<boolean> {
    const existing = await prisma.refresh_tokens.findUnique({
      where: { token_hash: tokenHash },
      select: {
        id: true,
        revoked_at: true,
      },
    });
    if (!existing) {
      return false;
    }

    if (!existing.revoked_at) {
      await prisma.refresh_tokens.update({
        where: { id: existing.id },
        data: {
          revoked_at: new Date(),
        },
      });
    }

    return true;
  },

  async revokeAllRefreshTokensByUserId(userId: string): Promise<number> {
    const now = new Date();
    const updatedCount = await prisma.$executeRaw`
      UPDATE "refresh_tokens"
      SET revoked_at = ${now}
      WHERE user_id = ${userId}
        AND revoked_at IS NULL
    `;

    return Number(updatedCount);
  },

  async deleteUserById(userId: string): Promise<boolean> {
    const deleted = await prisma.users.deleteMany({
      where: { id: userId },
    });

    return deleted.count === 1;
  },
};

export type {
  PasswordIdentityRecord,
  PasswordResetTokenRecord,
  RefreshTokenRecord,
  UserPersonalInfoRecord,
  UserPreferencesRecord,
  UserRecord,
};
