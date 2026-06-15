import {
  accountRoleSchema,
  adminPermissionLevelSchema,
  adminPermissionScopeSchema,
  emailLocaleSchema,
  type EmailLocale,
  type AccountRole,
  type AdminPermission,
} from '@synqit/shared';
import { randomUUID } from 'node:crypto';

import { createOpaqueToken, hashToken } from './crypto';
import { prisma } from '../db/prisma';

type UserRecord = {
  id: string;
  email: string;
  role: AccountRole;
  isBlocked: boolean;
  blockedAt: Date | null;
  adminPermissions: AdminPermission[];
  passwordHash: string | null;
  avatarPath: string | null;
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

type RegistrationInviteTokenRecord = {
  id: string;
  invitedEmail: string | null;
  locale: EmailLocale;
  tokenPreview: string;
  createdByUserId: string;
  usedByUserId: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  lastSentAt: Date | null;
  usedAt: Date | null;
  revokedAt: Date | null;
};

type CreatedRegistrationInviteTokenRecord = RegistrationInviteTokenRecord & {
  plainToken: string;
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
  password_hash: string | null;
  avatar_url?: string | null;
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

type RegistrationInviteTokenRow = {
  id: string;
  token_hash: string;
  token_preview: string;
  invited_email: string | null;
  locale: string | null;
  created_by_user_id: string;
  used_by_user_id: string | null;
  created_at: Date;
  expires_at: Date | null;
  last_sent_at: Date | null;
  used_at: Date | null;
  revoked_at: Date | null;
};

const toUserRecord = (row: UserRow): UserRecord => ({
  id: row.id,
  email: row.email,
  role: accountRoleSchema.safeParse(row.role).success ? (row.role as AccountRole) : 'user',
  isBlocked: row.is_blocked === true,
  blockedAt: row.blocked_at ? new Date(row.blocked_at) : null,
  adminPermissions: [],
  passwordHash: row.password_hash,
  avatarPath: row.avatar_url ?? null,
  createdAt: new Date(row.created_at),
});

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

const toRegistrationInviteTokenRecord = (
  row: RegistrationInviteTokenRow,
): RegistrationInviteTokenRecord => ({
  id: row.id,
  invitedEmail: row.invited_email,
  locale: emailLocaleSchema.safeParse(row.locale).success ? (row.locale as EmailLocale) : 'en',
  tokenPreview: row.token_preview,
  createdByUserId: row.created_by_user_id,
  usedByUserId: row.used_by_user_id,
  createdAt: new Date(row.created_at),
  expiresAt: row.expires_at ? new Date(row.expires_at) : null,
  lastSentAt: row.last_sent_at ? new Date(row.last_sent_at) : null,
  usedAt: row.used_at ? new Date(row.used_at) : null,
  revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
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
const DEFAULT_REGISTRATION_INVITE_TTL_HOURS = 24 * 7;
const buildRegistrationInviteTokenPreview = (token: string): string =>
  token.length <= 18 ? token : `${token.slice(0, 10)}…${token.slice(-6)}`;
const getRegistrationInviteTtlMs = (): number => {
  const parsed = Number(
    process.env.REGISTRATION_INVITE_TTL_HOURS ?? DEFAULT_REGISTRATION_INVITE_TTL_HOURS,
  );
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_REGISTRATION_INVITE_TTL_HOURS * 60 * 60 * 1000;
  }
  return Math.floor(parsed * 60 * 60 * 1000);
};

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
          password_hash,
          is_blocked,
          blocked_at,
          avatar_url,
          created_at
        )
        VALUES (${userId}, ${normalizedEmail}, ${params.passwordHash}, ${false}, ${null}, ${null}, ${createdAt})
        RETURNING id, email, role, is_blocked, blocked_at, password_hash, avatar_url, created_at
      `;
      if (rows.length === 0) {
        return null;
      }
      const record = toUserRecord(rows[0]);
      record.adminPermissions = await authStore.listUserAdminPermissionsByUserId(record.id);
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
          record.adminPermissions = await authStore.listUserAdminPermissionsByUserId(record.id);
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
    try {
      const rows = await prisma.$queryRaw<UserRow[]>`
        SELECT id, email, role, is_blocked, blocked_at, password_hash, avatar_url, created_at
        FROM "users"
        WHERE email = ${normalizedEmail}
        LIMIT 1
      `;
      if (rows.length === 0) {
        return null;
      }
      const record = toUserRecord(rows[0]);
      record.adminPermissions = await authStore.listUserAdminPermissionsByUserId(record.id);
      return record;
    } catch (error) {
      if (isMissingAvatarColumnError(error)) {
        const rows = await prisma.$queryRaw<UserRow[]>`
          SELECT id, email, password_hash, created_at
          FROM "users"
          WHERE email = ${normalizedEmail}
          LIMIT 1
        `;
        if (rows.length === 0) {
          return null;
        }
        const record = toUserRecord(rows[0]);
        record.adminPermissions = await authStore.listUserAdminPermissionsByUserId(record.id);
        return record;
      }
      throw error;
    }
  },

  async findUserById(id: string): Promise<UserRecord | null> {
    try {
      const rows = await prisma.$queryRaw<UserRow[]>`
        SELECT id, email, role, is_blocked, blocked_at, password_hash, avatar_url, created_at
        FROM "users"
        WHERE id = ${id}
        LIMIT 1
      `;
      if (rows.length === 0) {
        return null;
      }
      const record = toUserRecord(rows[0]);
      record.adminPermissions = await authStore.listUserAdminPermissionsByUserId(record.id);
      return record;
    } catch (error) {
      if (isMissingAvatarColumnError(error)) {
        const rows = await prisma.$queryRaw<UserRow[]>`
          SELECT id, email, password_hash, created_at
          FROM "users"
          WHERE id = ${id}
          LIMIT 1
        `;
        if (rows.length === 0) {
          return null;
        }
        const record = toUserRecord(rows[0]);
        record.adminPermissions = await authStore.listUserAdminPermissionsByUserId(record.id);
        return record;
      }
      throw error;
    }
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
        blocked_at = ${blockedAt}
      WHERE id = ${userId}
    `;

    return Number(updatedCount) === 1;
  },

  async replaceUserAdminPermissionsByUserId(
    userId: string,
    permissions: AdminPermission[],
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        DELETE FROM "user_admin_permissions"
        WHERE user_id = ${userId}
      `;

      if (permissions.length === 0) {
        return;
      }

      const now = new Date();
      for (const permission of permissions) {
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
    let rows: UserRow[];
    try {
      rows = await prisma.$queryRaw<UserRow[]>`
        SELECT id, email, role, is_blocked, blocked_at, password_hash, avatar_url, created_at
        FROM "users"
        ORDER BY created_at DESC
        LIMIT 200
      `;
    } catch (error) {
      if (!isMissingAvatarColumnError(error)) {
        throw error;
      }
      rows = await prisma.$queryRaw<UserRow[]>`
        SELECT id, email, password_hash, created_at
        FROM "users"
        ORDER BY created_at DESC
        LIMIT 200
      `;
    }

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
      adminPermissions: permissionsByUser.get(user.id) ?? [],
    }));
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

  async createRegistrationInviteToken(params: {
    createdByUserId: string;
    invitedEmail: string;
    locale: EmailLocale;
  }): Promise<CreatedRegistrationInviteTokenRecord | null> {
    const id = randomUUID();
    const plainToken = `synqit_inv_${createOpaqueToken()}`;
    const tokenHash = hashToken(plainToken);
    const tokenPreview = buildRegistrationInviteTokenPreview(plainToken);
    const invitedEmail = params.invitedEmail.trim().toLowerCase();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + getRegistrationInviteTtlMs());

    try {
      const rows = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          UPDATE "registration_invite_tokens"
          SET revoked_at = ${createdAt}
          WHERE invited_email = ${invitedEmail}
            AND used_at IS NULL
            AND revoked_at IS NULL
        `;

        return tx.$queryRaw<RegistrationInviteTokenRow[]>`
          INSERT INTO "registration_invite_tokens" (
            id,
            token_hash,
            token_preview,
            invited_email,
            locale,
            created_by_user_id,
            used_by_user_id,
            created_at,
            expires_at,
            last_sent_at,
            used_at,
            revoked_at
          )
          VALUES (
            ${id},
            ${tokenHash},
            ${tokenPreview},
            ${invitedEmail},
            ${params.locale},
            ${params.createdByUserId},
            ${null},
            ${createdAt},
            ${expiresAt},
            ${createdAt},
            ${null},
            ${null}
          )
          RETURNING
            id,
            token_hash,
            token_preview,
            invited_email,
            locale,
            created_by_user_id,
            used_by_user_id,
            created_at,
            expires_at,
            last_sent_at,
            used_at,
            revoked_at
        `;
      });

      if (rows.length === 0) {
        return null;
      }

      return {
        ...toRegistrationInviteTokenRecord(rows[0]),
        plainToken,
      };
    } catch (error) {
      if (isMissingRelationError(error)) {
        return null;
      }
      throw error;
    }
  },

  async listRegistrationInviteTokens(): Promise<RegistrationInviteTokenRecord[]> {
    try {
      const rows = await prisma.$queryRaw<RegistrationInviteTokenRow[]>`
        SELECT
          id,
          token_hash,
          token_preview,
          invited_email,
          locale,
          created_by_user_id,
          used_by_user_id,
          created_at,
          expires_at,
          last_sent_at,
          used_at,
          revoked_at
        FROM "registration_invite_tokens"
        WHERE invited_email IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 100
      `;

      return rows.map(toRegistrationInviteTokenRecord);
    } catch (error) {
      if (isMissingRelationError(error)) {
        return [];
      }
      throw error;
    }
  },

  async findRegistrationInviteTokenById(id: string): Promise<RegistrationInviteTokenRecord | null> {
    try {
      const rows = await prisma.$queryRaw<RegistrationInviteTokenRow[]>`
        SELECT
          id,
          token_hash,
          token_preview,
          invited_email,
          locale,
          created_by_user_id,
          used_by_user_id,
          created_at,
          expires_at,
          last_sent_at,
          used_at,
          revoked_at
        FROM "registration_invite_tokens"
        WHERE id = ${id}
        LIMIT 1
      `;
      return rows.length > 0 ? toRegistrationInviteTokenRecord(rows[0]) : null;
    } catch (error) {
      if (isMissingRelationError(error)) {
        return null;
      }
      throw error;
    }
  },

  async resendRegistrationInviteToken(params: {
    inviteId: string;
    createdByUserId: string;
  }): Promise<CreatedRegistrationInviteTokenRecord | null> {
    const existing = await authStore.findRegistrationInviteTokenById(params.inviteId);
    if (!existing?.invitedEmail || existing.usedAt) {
      return null;
    }

    return authStore.createRegistrationInviteToken({
      createdByUserId: params.createdByUserId,
      invitedEmail: existing.invitedEmail,
      locale: existing.locale,
    });
  },

  async registerUserWithInvite(params: {
    email: string;
    passwordHash: string;
    inviteToken: string;
  }): Promise<{ kind: 'created'; user: UserRecord } | { kind: 'email_taken' | 'invalid_invite' }> {
    const normalizedEmail = params.email.trim().toLowerCase();
    const inviteTokenHash = hashToken(params.inviteToken.trim());
    const userId = randomUUID();
    const createdAt = new Date();

    return prisma.$transaction(async (tx) => {
      let inviteRows: RegistrationInviteTokenRow[];
      try {
        inviteRows = await tx.$queryRaw<RegistrationInviteTokenRow[]>`
          SELECT
            id,
            token_hash,
            token_preview,
            invited_email,
            locale,
            created_by_user_id,
            used_by_user_id,
            created_at,
            expires_at,
            last_sent_at,
            used_at,
            revoked_at
          FROM "registration_invite_tokens"
          WHERE token_hash = ${inviteTokenHash}
            AND invited_email = ${normalizedEmail}
            AND used_at IS NULL
            AND revoked_at IS NULL
            AND (expires_at IS NULL OR expires_at > NOW())
          LIMIT 1
          FOR UPDATE
        `;
      } catch (error) {
        if (isMissingRelationError(error)) {
          return { kind: 'invalid_invite' } as const;
        }
        throw error;
      }

      if (inviteRows.length === 0) {
        return { kind: 'invalid_invite' } as const;
      }

      let userRows: UserRow[];
      try {
        userRows = await tx.$queryRaw<UserRow[]>`
          INSERT INTO "users" (
            id,
            email,
            password_hash,
            is_blocked,
            blocked_at,
            avatar_url,
            created_at
          )
          VALUES (${userId}, ${normalizedEmail}, ${params.passwordHash}, ${false}, ${null}, ${null}, ${createdAt})
          RETURNING id, email, role, is_blocked, blocked_at, password_hash, avatar_url, created_at
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

      const consumeCount = await tx.$executeRaw`
        UPDATE "registration_invite_tokens"
        SET
          used_at = ${now},
          used_by_user_id = ${userId}
        WHERE id = ${inviteRows[0].id}
          AND used_at IS NULL
          AND revoked_at IS NULL
      `;

      if (Number(consumeCount) !== 1) {
        throw new Error('Registration invite token could not be consumed.');
      }

      const user = toUserRecord(userRows[0]);
      user.adminPermissions = await authStore.listUserAdminPermissionsByUserId(user.id);
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
};

export type {
  CreatedRegistrationInviteTokenRecord,
  PasswordIdentityRecord,
  PasswordResetTokenRecord,
  RegistrationInviteTokenRecord,
  RefreshTokenRecord,
  UserPersonalInfoRecord,
  UserPreferencesRecord,
  UserRecord,
};
