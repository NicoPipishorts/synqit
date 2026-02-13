import { Provider, providerSchema } from '@synqit/shared';
import { randomBytes, randomUUID } from 'node:crypto';

import { EncryptedToken } from './crypto';
import { prisma } from '../db/prisma';

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
  provider: string;
  access_token_json: unknown;
  refresh_token_json: unknown;
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
  provider: string;
  created_at: Date;
  expires_at: Date;
};

const toIntegrationRecord = (row: IntegrationRow): IntegrationRecord => ({
  id: row.id,
  userId: row.user_id,
  provider: providerSchema.parse(row.provider),
  accessToken: parseEncryptedToken(row.access_token_json),
  refreshToken: parseEncryptedToken(row.refresh_token_json),
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
  provider: providerSchema.parse(row.provider),
  createdAt: new Date(row.created_at),
  expiresAt: new Date(row.expires_at),
});

const isEncryptedToken = (value: unknown): value is EncryptedToken => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<EncryptedToken>;
  return (
    typeof candidate.iv === 'string' &&
    typeof candidate.ciphertext === 'string' &&
    typeof candidate.authTag === 'string'
  );
};

const parseEncryptedToken = (value: unknown): EncryptedToken => {
  if (!isEncryptedToken(value)) {
    throw new Error('Integration token payload is invalid');
  }

  return value;
};

const purgeExpiredOauthStates = async (): Promise<void> => {
  await prisma.oauth_states.deleteMany({
    where: {
      expires_at: {
        lte: new Date(),
      },
    },
  });
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
    const now = new Date();
    const row = await prisma.integrations.upsert({
      where: {
        user_id_provider: {
          user_id: params.userId,
          provider: params.provider,
        },
      },
      create: {
        id: nextId,
        user_id: params.userId,
        provider: params.provider,
        access_token_json: params.accessToken,
        refresh_token_json: params.refreshToken,
        scopes: params.scopes,
        expires_at: params.expiresAt,
        last_refresh_at: now,
        last_error: null,
        created_at: now,
        updated_at: now,
      },
      update: {
        access_token_json: params.accessToken,
        refresh_token_json: params.refreshToken,
        scopes: params.scopes,
        expires_at: params.expiresAt,
        last_refresh_at: now,
        last_error: null,
        updated_at: now,
      },
    });

    return toIntegrationRecord(row);
  },

  async findIntegration(params: {
    userId: string;
    provider: Provider;
  }): Promise<IntegrationRecord | null> {
    const row = await prisma.integrations.findUnique({
      where: {
        user_id_provider: {
          user_id: params.userId,
          provider: params.provider,
        },
      },
    });
    return row ? toIntegrationRecord(row) : null;
  },

  async listIntegrationsByUser(userId: string): Promise<IntegrationRecord[]> {
    const rows = await prisma.integrations.findMany({
      where: { user_id: userId },
    });

    return rows.map(toIntegrationRecord);
  },

  async disconnectIntegration(params: { userId: string; provider: Provider }): Promise<boolean> {
    const result = await prisma.integrations.deleteMany({
      where: {
        user_id: params.userId,
        provider: params.provider,
      },
    });

    return result.count > 0;
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

    const row = await prisma.oauth_states.create({
      data: {
        id: oauthState.id,
        state: oauthState.state,
        user_id: oauthState.userId,
        provider: oauthState.provider,
        created_at: oauthState.createdAt,
        expires_at: oauthState.expiresAt,
      },
    });

    return toPendingOauthStateRecord(row);
  },

  async consumePendingOauthState(params: {
    state: string;
    provider: Provider;
  }): Promise<PendingOauthStateRecord | null> {
    await purgeExpiredOauthStates();

    return prisma.$transaction(async (tx) => {
      const row = await tx.oauth_states.findFirst({
        where: {
          state: params.state,
          provider: params.provider,
        },
      });

      if (!row) {
        return null;
      }

      const deleted = await tx.oauth_states.deleteMany({
        where: {
          id: row.id,
          provider: params.provider,
        },
      });

      if (deleted.count !== 1) {
        return null;
      }

      return toPendingOauthStateRecord(row);
    });
  },
};

export type { IntegrationRecord, PendingOauthStateRecord };
