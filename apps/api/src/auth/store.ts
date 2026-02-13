import { randomUUID } from 'node:crypto';

import { query, withTransaction } from '../db';

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

export const authStore = {
  async createUser(params: { email: string; passwordHash: string }): Promise<UserRecord | null> {
    const normalizedEmail = params.email.trim().toLowerCase();
    const result = await query<UserRow>(
      `
        INSERT INTO users (id, email, password_hash, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (email) DO NOTHING
        RETURNING id, email, password_hash, created_at
      `,
      [randomUUID(), normalizedEmail, params.passwordHash],
    );

    const row = result.rows[0];
    return row ? toUserRecord(row) : null;
  },

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const result = await query<UserRow>(
      `
        SELECT id, email, password_hash, created_at
        FROM users
        WHERE email = $1
        LIMIT 1
      `,
      [normalizedEmail],
    );

    const row = result.rows[0];
    return row ? toUserRecord(row) : null;
  },

  async findUserById(id: string): Promise<UserRecord | null> {
    const result = await query<UserRow>(
      `
        SELECT id, email, password_hash, created_at
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );

    const row = result.rows[0];
    return row ? toUserRecord(row) : null;
  },

  async createRefreshToken(params: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord> {
    const nextId = randomUUID();
    const result = await query<RefreshTokenRow>(
      `
        INSERT INTO refresh_tokens (
          id,
          user_id,
          token_hash,
          created_at,
          expires_at,
          revoked_at,
          replaced_by_token_id
        )
        VALUES ($1, $2, $3, NOW(), $4, NULL, NULL)
        RETURNING
          id,
          user_id,
          token_hash,
          created_at,
          expires_at,
          revoked_at,
          replaced_by_token_id
      `,
      [nextId, params.userId, params.tokenHash, params.expiresAt],
    );

    return toRefreshTokenRecord(result.rows[0]);
  },

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const result = await query<RefreshTokenRow>(
      `
        SELECT
          id,
          user_id,
          token_hash,
          created_at,
          expires_at,
          revoked_at,
          replaced_by_token_id
        FROM refresh_tokens
        WHERE token_hash = $1
        LIMIT 1
      `,
      [tokenHash],
    );

    const row = result.rows[0];
    return row ? toRefreshTokenRecord(row) : null;
  },

  async rotateRefreshToken(params: {
    oldTokenHash: string;
    newTokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord | null> {
    return withTransaction(async (client) => {
      const oldResult = await client.query<RefreshTokenRow>(
        `
          SELECT
            id,
            user_id,
            token_hash,
            created_at,
            expires_at,
            revoked_at,
            replaced_by_token_id
          FROM refresh_tokens
          WHERE token_hash = $1
          LIMIT 1
          FOR UPDATE
        `,
        [params.oldTokenHash],
      );

      const oldRow = oldResult.rows[0];
      if (!oldRow || oldRow.revoked_at) {
        return null;
      }

      const nextId = randomUUID();
      await client.query(
        `
          UPDATE refresh_tokens
          SET revoked_at = NOW(), replaced_by_token_id = $2
          WHERE token_hash = $1
        `,
        [params.oldTokenHash, nextId],
      );

      const newResult = await client.query<RefreshTokenRow>(
        `
          INSERT INTO refresh_tokens (
            id,
            user_id,
            token_hash,
            created_at,
            expires_at,
            revoked_at,
            replaced_by_token_id
          )
          VALUES ($1, $2, $3, NOW(), $4, NULL, NULL)
          RETURNING
            id,
            user_id,
            token_hash,
            created_at,
            expires_at,
            revoked_at,
            replaced_by_token_id
        `,
        [nextId, oldRow.user_id, params.newTokenHash, params.expiresAt],
      );

      return toRefreshTokenRecord(newResult.rows[0]);
    });
  },

  async revokeRefreshTokenByHash(tokenHash: string): Promise<boolean> {
    const result = await query<{ id: string }>(
      `
        UPDATE refresh_tokens
        SET revoked_at = COALESCE(revoked_at, NOW())
        WHERE token_hash = $1
        RETURNING id
      `,
      [tokenHash],
    );

    return result.rows.length > 0;
  },
};

export type { RefreshTokenRecord, UserRecord };
