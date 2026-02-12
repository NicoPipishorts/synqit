import { randomUUID } from 'node:crypto';

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

const usersByEmail = new Map<string, UserRecord>();
const usersById = new Map<string, UserRecord>();
const refreshTokensByHash = new Map<string, RefreshTokenRecord>();
const refreshTokensById = new Map<string, RefreshTokenRecord>();

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

export const authStore = {
  createUser(params: { email: string; passwordHash: string }): UserRecord | null {
    const normalizedEmail = params.email.trim().toLowerCase();
    if (usersByEmail.has(normalizedEmail)) {
      return null;
    }

    const user: UserRecord = {
      id: randomUUID(),
      email: normalizedEmail,
      passwordHash: params.passwordHash,
      createdAt: new Date(),
    };

    usersByEmail.set(normalizedEmail, user);
    usersById.set(user.id, user);

    return cloneUser(user);
  },

  findUserByEmail(email: string): UserRecord | null {
    const normalizedEmail = email.trim().toLowerCase();
    const user = usersByEmail.get(normalizedEmail);
    return user ? cloneUser(user) : null;
  },

  findUserById(id: string): UserRecord | null {
    const user = usersById.get(id);
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

    refreshTokensByHash.set(record.tokenHash, record);
    refreshTokensById.set(record.id, record);

    return cloneRefreshToken(record);
  },

  findRefreshTokenByHash(tokenHash: string): RefreshTokenRecord | null {
    const record = refreshTokensByHash.get(tokenHash);
    return record ? cloneRefreshToken(record) : null;
  },

  rotateRefreshToken(params: {
    oldTokenHash: string;
    newTokenHash: string;
    expiresAt: Date;
  }): RefreshTokenRecord | null {
    const oldRecord = refreshTokensByHash.get(params.oldTokenHash);
    if (!oldRecord || oldRecord.revokedAt) {
      return null;
    }

    oldRecord.revokedAt = new Date();

    const newRecord = this.createRefreshToken({
      userId: oldRecord.userId,
      tokenHash: params.newTokenHash,
      expiresAt: params.expiresAt,
    });

    oldRecord.replacedByTokenId = newRecord.id;

    return newRecord;
  },

  revokeRefreshTokenByHash(tokenHash: string): boolean {
    const record = refreshTokensByHash.get(tokenHash);
    if (!record) {
      return false;
    }

    if (!record.revokedAt) {
      record.revokedAt = new Date();
    }

    return true;
  },
};

export type { RefreshTokenRecord, UserRecord };
