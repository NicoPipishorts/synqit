import { Provider } from '@synqit/shared';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

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

type PersistedIntegrationRecord = Omit<
  IntegrationRecord,
  'expiresAt' | 'lastRefreshAt' | 'createdAt' | 'updatedAt'
> & {
  expiresAt: string | null;
  lastRefreshAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type PersistedPendingOauthStateRecord = Omit<PendingOauthStateRecord, 'createdAt' | 'expiresAt'> & {
  createdAt: string;
  expiresAt: string;
};

type PersistedIntegrationStore = {
  integrations: PersistedIntegrationRecord[];
  oauthStates: PersistedPendingOauthStateRecord[];
};

type IntegrationStoreState = {
  integrations: IntegrationRecord[];
  oauthStates: PendingOauthStateRecord[];
};

const DEFAULT_INTEGRATION_STORE_FILE = 'apps/api/data/integrations-store.json';
const INTEGRATION_STORE_FILE = resolve(
  process.cwd(),
  process.env.INTEGRATION_STORE_FILE ?? DEFAULT_INTEGRATION_STORE_FILE,
);

const toIntegrationRecord = (integration: PersistedIntegrationRecord): IntegrationRecord => ({
  ...integration,
  expiresAt: integration.expiresAt ? new Date(integration.expiresAt) : null,
  lastRefreshAt: integration.lastRefreshAt ? new Date(integration.lastRefreshAt) : null,
  createdAt: new Date(integration.createdAt),
  updatedAt: new Date(integration.updatedAt),
});

const toPendingOauthStateRecord = (
  oauthState: PersistedPendingOauthStateRecord,
): PendingOauthStateRecord => ({
  ...oauthState,
  createdAt: new Date(oauthState.createdAt),
  expiresAt: new Date(oauthState.expiresAt),
});

const toPersistedIntegrationRecord = (
  integration: IntegrationRecord,
): PersistedIntegrationRecord => ({
  ...integration,
  expiresAt: integration.expiresAt?.toISOString() ?? null,
  lastRefreshAt: integration.lastRefreshAt?.toISOString() ?? null,
  createdAt: integration.createdAt.toISOString(),
  updatedAt: integration.updatedAt.toISOString(),
});

const toPersistedPendingOauthStateRecord = (
  oauthState: PendingOauthStateRecord,
): PersistedPendingOauthStateRecord => ({
  ...oauthState,
  createdAt: oauthState.createdAt.toISOString(),
  expiresAt: oauthState.expiresAt.toISOString(),
});

const cloneEncryptedToken = (token: EncryptedToken): EncryptedToken => ({
  ...token,
});

const cloneIntegration = (integration: IntegrationRecord): IntegrationRecord => ({
  ...integration,
  accessToken: cloneEncryptedToken(integration.accessToken),
  refreshToken: cloneEncryptedToken(integration.refreshToken),
  scopes: [...integration.scopes],
  expiresAt: integration.expiresAt ? new Date(integration.expiresAt) : null,
  lastRefreshAt: integration.lastRefreshAt ? new Date(integration.lastRefreshAt) : null,
  createdAt: new Date(integration.createdAt),
  updatedAt: new Date(integration.updatedAt),
});

const clonePendingOauthState = (oauthState: PendingOauthStateRecord): PendingOauthStateRecord => ({
  ...oauthState,
  createdAt: new Date(oauthState.createdAt),
  expiresAt: new Date(oauthState.expiresAt),
});

const readInitialState = (): IntegrationStoreState => {
  if (!existsSync(INTEGRATION_STORE_FILE)) {
    return {
      integrations: [],
      oauthStates: [],
    };
  }

  try {
    const fileContents = readFileSync(INTEGRATION_STORE_FILE, 'utf8');
    const parsed = JSON.parse(fileContents) as Partial<PersistedIntegrationStore>;
    const integrations = Array.isArray(parsed.integrations)
      ? parsed.integrations.map(toIntegrationRecord)
      : [];
    const oauthStates = Array.isArray(parsed.oauthStates)
      ? parsed.oauthStates.map(toPendingOauthStateRecord)
      : [];

    return {
      integrations,
      oauthStates,
    };
  } catch {
    return {
      integrations: [],
      oauthStates: [],
    };
  }
};

const persistState = (state: IntegrationStoreState): void => {
  mkdirSync(dirname(INTEGRATION_STORE_FILE), { recursive: true });

  const persisted: PersistedIntegrationStore = {
    integrations: state.integrations.map(toPersistedIntegrationRecord),
    oauthStates: state.oauthStates.map(toPersistedPendingOauthStateRecord),
  };

  const nextData = JSON.stringify(persisted, null, 2);
  const tempFile = `${INTEGRATION_STORE_FILE}.tmp`;

  writeFileSync(tempFile, nextData, 'utf8');
  renameSync(tempFile, INTEGRATION_STORE_FILE);
};

const state = readInitialState();

const purgeExpiredOauthStates = (): void => {
  const now = Date.now();
  const nextOauthStates = state.oauthStates.filter((item) => item.expiresAt.getTime() > now);

  if (nextOauthStates.length !== state.oauthStates.length) {
    state.oauthStates = nextOauthStates;
    persistState(state);
  }
};

export const integrationStore = {
  upsertIntegration(params: {
    userId: string;
    provider: Provider;
    accessToken: EncryptedToken;
    refreshToken: EncryptedToken;
    scopes: string[];
    expiresAt: Date | null;
  }): IntegrationRecord {
    const existing = state.integrations.find(
      (integration) =>
        integration.userId === params.userId && integration.provider === params.provider,
    );

    if (existing) {
      existing.accessToken = cloneEncryptedToken(params.accessToken);
      existing.refreshToken = cloneEncryptedToken(params.refreshToken);
      existing.scopes = [...params.scopes];
      existing.expiresAt = params.expiresAt ? new Date(params.expiresAt) : null;
      existing.lastRefreshAt = new Date();
      existing.lastError = null;
      existing.updatedAt = new Date();
      persistState(state);
      return cloneIntegration(existing);
    }

    const nextIntegration: IntegrationRecord = {
      id: randomUUID(),
      userId: params.userId,
      provider: params.provider,
      accessToken: cloneEncryptedToken(params.accessToken),
      refreshToken: cloneEncryptedToken(params.refreshToken),
      scopes: [...params.scopes],
      expiresAt: params.expiresAt ? new Date(params.expiresAt) : null,
      lastRefreshAt: new Date(),
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    state.integrations.push(nextIntegration);
    persistState(state);

    return cloneIntegration(nextIntegration);
  },

  findIntegration(params: { userId: string; provider: Provider }): IntegrationRecord | null {
    const integration = state.integrations.find(
      (item) => item.userId === params.userId && item.provider === params.provider,
    );
    return integration ? cloneIntegration(integration) : null;
  },

  listIntegrationsByUser(userId: string): IntegrationRecord[] {
    return state.integrations.filter((item) => item.userId === userId).map(cloneIntegration);
  },

  disconnectIntegration(params: { userId: string; provider: Provider }): boolean {
    const before = state.integrations.length;
    state.integrations = state.integrations.filter(
      (item) => item.userId !== params.userId || item.provider !== params.provider,
    );

    if (before !== state.integrations.length) {
      persistState(state);
      return true;
    }

    return false;
  },

  createPendingOauthState(params: {
    userId: string;
    provider: Provider;
    ttlMs: number;
  }): PendingOauthStateRecord {
    purgeExpiredOauthStates();

    const now = Date.now();
    const oauthState: PendingOauthStateRecord = {
      id: randomUUID(),
      state: randomBytes(24).toString('base64url'),
      userId: params.userId,
      provider: params.provider,
      createdAt: new Date(now),
      expiresAt: new Date(now + params.ttlMs),
    };

    state.oauthStates.push(oauthState);
    persistState(state);

    return clonePendingOauthState(oauthState);
  },

  consumePendingOauthState(params: {
    state: string;
    provider: Provider;
  }): PendingOauthStateRecord | null {
    purgeExpiredOauthStates();

    const index = state.oauthStates.findIndex(
      (item) => item.state === params.state && item.provider === params.provider,
    );
    if (index === -1) {
      return null;
    }

    const [oauthState] = state.oauthStates.splice(index, 1);
    persistState(state);
    return clonePendingOauthState(oauthState);
  },
};

export type { IntegrationRecord, PendingOauthStateRecord };
