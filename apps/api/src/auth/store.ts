import { randomUUID } from 'node:crypto';

import { prisma } from '../db/prisma';

type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
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

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
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

const isUniqueConstraintViolation = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return 'code' in error && (error as { code?: string }).code === 'P2002';
};

export const authStore = {
  async createUser(params: { email: string; passwordHash: string }): Promise<UserRecord | null> {
    const normalizedEmail = params.email.trim().toLowerCase();
    try {
      const row = await prisma.users.create({
        data: {
          id: randomUUID(),
          email: normalizedEmail,
          password_hash: params.passwordHash,
          created_at: new Date(),
        },
      });

      return toUserRecord(row);
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        return null;
      }
      throw error;
    }
  },

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const row = await prisma.users.findUnique({
      where: { email: normalizedEmail },
    });
    return row ? toUserRecord(row) : null;
  },

  async findUserById(id: string): Promise<UserRecord | null> {
    const row = await prisma.users.findUnique({
      where: { id },
    });
    return row ? toUserRecord(row) : null;
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

export type { RefreshTokenRecord, UserRecord };
