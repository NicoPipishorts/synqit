import { randomUUID } from 'node:crypto';

import { prisma } from '../db/prisma';

type UserRecord = {
  id: string;
  email: string;
  passwordHash: string | null;
  avatarPath: string | null;
  createdAt: Date;
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
  password_hash: string | null;
  avatar_url?: string | null;
  created_at: Date;
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

type RefreshTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  replaced_by_token_id: string | null;
};

const toUserRecord = (row: UserRow): UserRecord => ({
  id: row.id,
  email: row.email,
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

const PASSWORD_AUTH_PROVIDER = 'password';

export const authStore = {
  async createUser(params: { email: string; passwordHash: string }): Promise<UserRecord | null> {
    const normalizedEmail = params.email.trim().toLowerCase();
    const userId = randomUUID();
    const createdAt = new Date();
    try {
      const rows = await prisma.$queryRaw<UserRow[]>`
        INSERT INTO "users" (id, email, password_hash, avatar_url, created_at)
        VALUES (${userId}, ${normalizedEmail}, ${params.passwordHash}, ${null}, ${createdAt})
        RETURNING id, email, password_hash, avatar_url, created_at
      `;
      return rows.length > 0 ? toUserRecord(rows[0]) : null;
    } catch (error) {
      if (isMissingAvatarColumnError(error)) {
        try {
          const rows = await prisma.$queryRaw<UserRow[]>`
            INSERT INTO "users" (id, email, password_hash, created_at)
            VALUES (${userId}, ${normalizedEmail}, ${params.passwordHash}, ${createdAt})
            RETURNING id, email, password_hash, created_at
          `;
          return rows.length > 0 ? toUserRecord(rows[0]) : null;
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
        SELECT id, email, password_hash, avatar_url, created_at
        FROM "users"
        WHERE email = ${normalizedEmail}
        LIMIT 1
      `;
      return rows.length > 0 ? toUserRecord(rows[0]) : null;
    } catch (error) {
      if (isMissingAvatarColumnError(error)) {
        const rows = await prisma.$queryRaw<UserRow[]>`
          SELECT id, email, password_hash, created_at
          FROM "users"
          WHERE email = ${normalizedEmail}
          LIMIT 1
        `;
        return rows.length > 0 ? toUserRecord(rows[0]) : null;
      }
      throw error;
    }
  },

  async findUserById(id: string): Promise<UserRecord | null> {
    try {
      const rows = await prisma.$queryRaw<UserRow[]>`
        SELECT id, email, password_hash, avatar_url, created_at
        FROM "users"
        WHERE id = ${id}
        LIMIT 1
      `;
      return rows.length > 0 ? toUserRecord(rows[0]) : null;
    } catch (error) {
      if (isMissingAvatarColumnError(error)) {
        const rows = await prisma.$queryRaw<UserRow[]>`
          SELECT id, email, password_hash, created_at
          FROM "users"
          WHERE id = ${id}
          LIMIT 1
        `;
        return rows.length > 0 ? toUserRecord(rows[0]) : null;
      }
      throw error;
    }
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
};

export type { PasswordIdentityRecord, RefreshTokenRecord, UserPersonalInfoRecord, UserRecord };
