export type Provider = 'spotify' | 'apple';
export type AccountRole = 'user' | 'admin';
export type AdminPermissionScope =
  | 'dashboard'
  | 'users'
  | 'events'
  | 'integrations'
  | 'emails'
  | 'analytics';
export type AdminPermissionLevel = 'read' | 'write';
export type AdminPermission = {
  scope: AdminPermissionScope;
  level: AdminPermissionLevel;
};

export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
};

export const PASSWORD_MIN_LENGTH = 8;

const passwordLowercasePattern = /[a-z]/;
const passwordUppercasePattern = /[A-Z]/;
const passwordNumberPattern = /\d/;
const passwordSpecialPattern = /[^A-Za-z0-9]/;

export type PasswordCriteria = {
  length: boolean;
  case: boolean;
  number: boolean;
  special: boolean;
};

export const getPasswordCriteria = (password: string): PasswordCriteria => ({
  length: password.length >= PASSWORD_MIN_LENGTH,
  case: passwordLowercasePattern.test(password) && passwordUppercasePattern.test(password),
  number: passwordNumberPattern.test(password),
  special: passwordSpecialPattern.test(password),
});

export const getPasswordStrengthScore = (password: string): number => {
  return Object.values(getPasswordCriteria(password)).filter(Boolean).length;
};

const isAdminPermission = (value: unknown): value is AdminPermission => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return (
    'scope' in value &&
    typeof value.scope === 'string' &&
    ['dashboard', 'users', 'events', 'integrations', 'emails', 'analytics'].includes(value.scope) &&
    'level' in value &&
    (value.level === 'read' || value.level === 'write')
  );
};

const isAccountRole = (value: unknown): value is AccountRole => {
  return value === 'user' || value === 'admin';
};

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
};

export type ParsedAuthResponse = {
  user: {
    id: string;
    email: string;
    createdAt: string;
    avatarUrl: string | null;
    role: AccountRole;
    adminPermissions: AdminPermission[];
  };
  tokens: AuthTokens;
};

const isAuthTokens = (value: unknown): value is AuthTokens => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return (
    'accessToken' in value &&
    typeof value.accessToken === 'string' &&
    'refreshToken' in value &&
    typeof value.refreshToken === 'string' &&
    'tokenType' in value &&
    value.tokenType === 'Bearer' &&
    'expiresInSeconds' in value &&
    typeof value.expiresInSeconds === 'number'
  );
};

export const parseAuthResponse = (value: unknown): ParsedAuthResponse => {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid auth response.');
  }

  const user = 'user' in value ? value.user : undefined;
  const tokens = 'tokens' in value ? value.tokens : undefined;
  if (!user || typeof user !== 'object' || !isAuthTokens(tokens)) {
    throw new Error('Invalid auth response.');
  }

  const adminPermissions =
    'adminPermissions' in user && Array.isArray(user.adminPermissions)
      ? user.adminPermissions.filter(isAdminPermission)
      : [];
  const role = 'role' in user && isAccountRole(user.role) ? user.role : 'user';
  const avatarUrl =
    'avatarUrl' in user && (typeof user.avatarUrl === 'string' || user.avatarUrl === null)
      ? user.avatarUrl
      : null;

  if (
    !('id' in user) ||
    typeof user.id !== 'string' ||
    !('email' in user) ||
    typeof user.email !== 'string' ||
    !('createdAt' in user) ||
    typeof user.createdAt !== 'string'
  ) {
    throw new Error('Invalid auth response.');
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      avatarUrl,
      role,
      adminPermissions,
    },
    tokens,
  };
};

export const parseRefreshResponse = (
  value: unknown,
): {
  tokens: AuthTokens;
} => {
  if (!value || typeof value !== 'object' || !('tokens' in value) || !isAuthTokens(value.tokens)) {
    throw new Error('Invalid refresh response.');
  }

  return {
    tokens: value.tokens,
  };
};
