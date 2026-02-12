import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

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

type PersistedUserRecord = Omit<UserRecord, 'createdAt'> & {
  createdAt: string;
};

type PersistedRefreshTokenRecord = Omit<
  RefreshTokenRecord,
  'createdAt' | 'expiresAt' | 'revokedAt'
> & {
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
};

type PersistedAuthStore = {
  users: PersistedUserRecord[];
  refreshTokens: PersistedRefreshTokenRecord[];
};

type AuthStoreState = {
  users: UserRecord[];
  refreshTokens: RefreshTokenRecord[];
};

const DEFAULT_AUTH_STORE_FILE = 'apps/api/data/auth-store.json';
const AUTH_STORE_FILE = resolve(
  process.cwd(),
  process.env.AUTH_STORE_FILE ?? DEFAULT_AUTH_STORE_FILE,
);

const toUserRecord = (user: PersistedUserRecord): UserRecord => ({
  ...user,
  createdAt: new Date(user.createdAt),
});

const toRefreshTokenRecord = (token: PersistedRefreshTokenRecord): RefreshTokenRecord => ({
  ...token,
  createdAt: new Date(token.createdAt),
  expiresAt: new Date(token.expiresAt),
  revokedAt: token.revokedAt ? new Date(token.revokedAt) : null,
});

const toPersistedUserRecord = (user: UserRecord): PersistedUserRecord => ({
  ...user,
  createdAt: user.createdAt.toISOString(),
});

const toPersistedRefreshTokenRecord = (token: RefreshTokenRecord): PersistedRefreshTokenRecord => ({
  ...token,
  createdAt: token.createdAt.toISOString(),
  expiresAt: token.expiresAt.toISOString(),
  revokedAt: token.revokedAt ? token.revokedAt.toISOString() : null,
});

const cloneUser = (user: UserRecord): UserRecord => ({
  ...user,
  createdAt: new Date(user.createdAt),
});

const cloneRefreshToken = (token: RefreshTokenRecord): RefreshTokenRecord => ({
  ...token,
  createdAt: new Date(token.createdAt),
  expiresAt: new Date(token.expiresAt),
  revokedAt: token.revokedAt ? new Date(token.revokedAt) : null,
});

const readInitialState = (): AuthStoreState => {
  if (!existsSync(AUTH_STORE_FILE)) {
    return {
      users: [],
      refreshTokens: [],
    };
  }

  try {
    const fileContents = readFileSync(AUTH_STORE_FILE, 'utf8');
    const parsed = JSON.parse(fileContents) as Partial<PersistedAuthStore>;
    const users = Array.isArray(parsed.users) ? parsed.users.map(toUserRecord) : [];
    const refreshTokens = Array.isArray(parsed.refreshTokens)
      ? parsed.refreshTokens.map(toRefreshTokenRecord)
      : [];

    return {
      users,
      refreshTokens,
    };
  } catch {
    return {
      users: [],
      refreshTokens: [],
    };
  }
};

const persistState = (state: AuthStoreState): void => {
  mkdirSync(dirname(AUTH_STORE_FILE), { recursive: true });

  const persisted: PersistedAuthStore = {
    users: state.users.map(toPersistedUserRecord),
    refreshTokens: state.refreshTokens.map(toPersistedRefreshTokenRecord),
  };

  const nextData = JSON.stringify(persisted, null, 2);
  const tempFile = `${AUTH_STORE_FILE}.tmp`;

  writeFileSync(tempFile, nextData, 'utf8');
  renameSync(tempFile, AUTH_STORE_FILE);
};

const state = readInitialState();

export const authStore = {
  createUser(params: { email: string; passwordHash: string }): UserRecord | null {
    const normalizedEmail = params.email.trim().toLowerCase();
    const existing = state.users.find((user) => user.email === normalizedEmail);
    if (existing) {
      return null;
    }

    const user: UserRecord = {
      id: randomUUID(),
      email: normalizedEmail,
      passwordHash: params.passwordHash,
      createdAt: new Date(),
    };

    state.users.push(user);
    persistState(state);

    return cloneUser(user);
  },

  findUserByEmail(email: string): UserRecord | null {
    const normalizedEmail = email.trim().toLowerCase();
    const user = state.users.find((item) => item.email === normalizedEmail);
    return user ? cloneUser(user) : null;
  },

  findUserById(id: string): UserRecord | null {
    const user = state.users.find((item) => item.id === id);
    return user ? cloneUser(user) : null;
  },

  createRefreshToken(params: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): RefreshTokenRecord {
    const record: RefreshTokenRecord = {
      id: randomUUID(),
      userId: params.userId,
      tokenHash: params.tokenHash,
      createdAt: new Date(),
      expiresAt: new Date(params.expiresAt),
      revokedAt: null,
      replacedByTokenId: null,
    };

    state.refreshTokens.push(record);
    persistState(state);

    return cloneRefreshToken(record);
  },

  findRefreshTokenByHash(tokenHash: string): RefreshTokenRecord | null {
    const record = state.refreshTokens.find((item) => item.tokenHash === tokenHash);
    return record ? cloneRefreshToken(record) : null;
  },

  rotateRefreshToken(params: {
    oldTokenHash: string;
    newTokenHash: string;
    expiresAt: Date;
  }): RefreshTokenRecord | null {
    const oldRecord = state.refreshTokens.find((item) => item.tokenHash === params.oldTokenHash);
    if (!oldRecord || oldRecord.revokedAt) {
      return null;
    }

    oldRecord.revokedAt = new Date();

    const newRecord: RefreshTokenRecord = {
      id: randomUUID(),
      userId: oldRecord.userId,
      tokenHash: params.newTokenHash,
      createdAt: new Date(),
      expiresAt: new Date(params.expiresAt),
      revokedAt: null,
      replacedByTokenId: null,
    };

    oldRecord.replacedByTokenId = newRecord.id;
    state.refreshTokens.push(newRecord);
    persistState(state);

    return cloneRefreshToken(newRecord);
  },

  revokeRefreshTokenByHash(tokenHash: string): boolean {
    const record = state.refreshTokens.find((item) => item.tokenHash === tokenHash);
    if (!record) {
      return false;
    }

    if (!record.revokedAt) {
      record.revokedAt = new Date();
      persistState(state);
    }

    return true;
  },
};

export type { RefreshTokenRecord, UserRecord };
