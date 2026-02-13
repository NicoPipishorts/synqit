import { Provider } from '@synqit/shared';
import { randomBytes, randomUUID } from 'node:crypto';

import { query } from '../db';
import { EncryptedToken } from './crypto';

type IntegrationRecord = {
  id: string;
  userId: string;
  provider: Provider;
  accessToken: EncryptedToken;
  refreshToken: EncryptedToken;
  scopes: string[];
  expiresAt: Date | null;
  lastRefreshAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PendingOauthStateRecord = {
  id: string;
  state: string;
  userId: string;
  provider: Provider;
  createdAt: Date;
  expiresAt: Date;
};

type IntegrationRow = {
  id: string;
  user_id: string;
  provider: Provider;
  access_token_json: EncryptedToken;
  refresh_token_json: EncryptedToken;
  scopes: string[];
  expires_at: Date | null;
  last_refresh_at: Date | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
};

type PendingOauthStateRow = {
  id: string;
  state: string;
  user_id: string;
  provider: Provider;
  created_at: Date;
  expires_at: Date;
};

const toIntegrationRecord = (row: IntegrationRow): IntegrationRecord => ({
  id: row.id,
  userId: row.user_id,
  provider: row.provider,
  accessToken: row.access_token_json,
  refreshToken: row.refresh_token_json,
  scopes: Array.isArray(row.scopes) ? row.scopes : [],
  expiresAt: row.expires_at ? new Date(row.expires_at) : null,
  lastRefreshAt: row.last_refresh_at ? new Date(row.last_refresh_at) : null,
  lastError: row.last_error,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
});

const toPendingOauthStateRecord = (row: PendingOauthStateRow): PendingOauthStateRecord => ({
  id: row.id,
  state: row.state,
  userId: row.user_id,
  provider: row.provider,
  createdAt: new Date(row.created_at),
  expiresAt: new Date(row.expires_at),
});

const purgeExpiredOauthStates = async (): Promise<void> => {
  await query(
    `
      DELETE FROM oauth_states
      WHERE expires_at <= NOW()
    `,
  );
};

export const integrationStore = {
  async upsertIntegration(params: {
    userId: string;
    provider: Provider;
    accessToken: EncryptedToken;
    refreshToken: EncryptedToken;
    scopes: string[];
    expiresAt: Date | null;
  }): Promise<IntegrationRecord> {
    const nextId = randomUUID();
    const result = await query<IntegrationRow>(
      `
        INSERT INTO integrations (
          id,
          user_id,
          provider,
          access_token_json,
          refresh_token_json,
          scopes,
          expires_at,
          last_refresh_at,
          last_error,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, NOW(), NULL, NOW(), NOW())
        ON CONFLICT (user_id, provider)
        DO UPDATE SET
          access_token_json = EXCLUDED.access_token_json,
          refresh_token_json = EXCLUDED.refresh_token_json,
          scopes = EXCLUDED.scopes,
          expires_at = EXCLUDED.expires_at,
          last_refresh_at = NOW(),
          last_error = NULL,
          updated_at = NOW()
        RETURNING
          id,
          user_id,
          provider,
          access_token_json,
          refresh_token_json,
          scopes,
          expires_at,
          last_refresh_at,
          last_error,
          created_at,
          updated_at
      `,
      [
        nextId,
        params.userId,
        params.provider,
        JSON.stringify(params.accessToken),
        JSON.stringify(params.refreshToken),
        params.scopes,
        params.expiresAt,
      ],
    );

    return toIntegrationRecord(result.rows[0]);
  },

  async findIntegration(params: {
    userId: string;
    provider: Provider;
  }): Promise<IntegrationRecord | null> {
    const result = await query<IntegrationRow>(
      `
        SELECT
          id,
          user_id,
          provider,
          access_token_json,
          refresh_token_json,
          scopes,
          expires_at,
          last_refresh_at,
          last_error,
          created_at,
          updated_at
        FROM integrations
        WHERE user_id = $1 AND provider = $2
        LIMIT 1
      `,
      [params.userId, params.provider],
    );

    const row = result.rows[0];
    return row ? toIntegrationRecord(row) : null;
  },

  async listIntegrationsByUser(userId: string): Promise<IntegrationRecord[]> {
    const result = await query<IntegrationRow>(
      `
        SELECT
          id,
          user_id,
          provider,
          access_token_json,
          refresh_token_json,
          scopes,
          expires_at,
          last_refresh_at,
          last_error,
          created_at,
          updated_at
        FROM integrations
        WHERE user_id = $1
      `,
      [userId],
    );

    return result.rows.map(toIntegrationRecord);
  },

  async disconnectIntegration(params: { userId: string; provider: Provider }): Promise<boolean> {
    const result = await query<{ id: string }>(
      `
        DELETE FROM integrations
        WHERE user_id = $1 AND provider = $2
        RETURNING id
      `,
      [params.userId, params.provider],
    );

    return result.rows.length > 0;
  },

  async createPendingOauthState(params: {
    userId: string;
    provider: Provider;
    ttlMs: number;
  }): Promise<PendingOauthStateRecord> {
    await purgeExpiredOauthStates();

    const now = Date.now();
    const oauthState: PendingOauthStateRecord = {
      id: randomUUID(),
      state: randomBytes(24).toString('base64url'),
      userId: params.userId,
      provider: params.provider,
      createdAt: new Date(now),
      expiresAt: new Date(now + params.ttlMs),
    };

    const result = await query<PendingOauthStateRow>(
      `
        INSERT INTO oauth_states (
          id,
          state,
          user_id,
          provider,
          created_at,
          expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
          id,
          state,
          user_id,
          provider,
          created_at,
          expires_at
      `,
      [
        oauthState.id,
        oauthState.state,
        oauthState.userId,
        oauthState.provider,
        oauthState.createdAt,
        oauthState.expiresAt,
      ],
    );

    return toPendingOauthStateRecord(result.rows[0]);
  },

  async consumePendingOauthState(params: {
    state: string;
    provider: Provider;
  }): Promise<PendingOauthStateRecord | null> {
    await purgeExpiredOauthStates();

    const result = await query<PendingOauthStateRow>(
      `
        DELETE FROM oauth_states
        WHERE id = (
          SELECT id
          FROM oauth_states
          WHERE state = $1 AND provider = $2
          LIMIT 1
        )
        RETURNING
          id,
          state,
          user_id,
          provider,
          created_at,
          expires_at
      `,
      [params.state, params.provider],
    );

    const row = result.rows[0];
    return row ? toPendingOauthStateRecord(row) : null;
  },
};

export type { IntegrationRecord, PendingOauthStateRecord };
