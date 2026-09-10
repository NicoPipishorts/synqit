import type { AccountRole, AdminPermission, ApiError } from '@synqit/shared';

export type { AccountRole, AdminPermission, ApiError };

export type Theme = 'light' | 'dark' | 'auto';
export type SupportedLocale = 'en' | 'fr' | 'es';
export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['en', 'fr', 'es'];

export type StoredAuth = {
  userId: string;
  userEmail: string;
  avatarUrl: string | null;
  role: AccountRole;
  adminPermissions: AdminPermission[];
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
};

export type AuthUser = {
  id: string;
  email: string;
  createdAt: string;
  avatarUrl: string | null;
  role: AccountRole;
  adminPermissions: AdminPermission[];
};

export type ParsedAuthResponse = { user: AuthUser; tokens: AuthTokens };

export type RefreshSnapshot = {
  avatarUrl: string | null;
  theme: Theme | null;
  locale: SupportedLocale | null;
};

export type ParsedRefreshResponse = { tokens: AuthTokens; snapshot?: RefreshSnapshot };

const ADMIN_SCOPES = [
  'dashboard',
  'users',
  'events',
  'integrations',
  'emails',
  'analytics',
  'admin_users',
];

const isAdminPermission = (value: unknown): value is AdminPermission =>
  Boolean(value) &&
  typeof value === 'object' &&
  'scope' in (value as object) &&
  typeof (value as { scope: unknown }).scope === 'string' &&
  ADMIN_SCOPES.includes((value as { scope: string }).scope) &&
  'level' in (value as object) &&
  ((value as { level: unknown }).level === 'read' ||
    (value as { level: unknown }).level === 'write');

const isAccountRole = (value: unknown): value is AccountRole =>
  value === 'user' || value === 'admin';

const isAuthTokens = (value: unknown): value is AuthTokens => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.accessToken === 'string' &&
    typeof candidate.refreshToken === 'string' &&
    candidate.tokenType === 'Bearer' &&
    typeof candidate.expiresInSeconds === 'number'
  );
};

/** Hand-rolled (zod-free) parser so the frontends don't ship schema bundles for auth. */
export const parseAuthUser = (value: unknown): AuthUser => {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid auth user.');
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.email !== 'string' ||
    typeof candidate.createdAt !== 'string'
  ) {
    throw new Error('Invalid auth user.');
  }

  return {
    id: candidate.id,
    email: candidate.email,
    createdAt: candidate.createdAt,
    avatarUrl: typeof candidate.avatarUrl === 'string' ? candidate.avatarUrl : null,
    role: isAccountRole(candidate.role) ? candidate.role : 'user',
    adminPermissions: Array.isArray(candidate.adminPermissions)
      ? candidate.adminPermissions.filter(isAdminPermission)
      : [],
  };
};

export const parseAuthResponse = (value: unknown): ParsedAuthResponse => {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid auth response.');
  }
  const candidate = value as Record<string, unknown>;
  if (!isAuthTokens(candidate.tokens)) {
    throw new Error('Invalid auth response.');
  }
  return { user: parseAuthUser(candidate.user), tokens: candidate.tokens };
};

const parseRefreshSnapshot = (value: unknown): RefreshSnapshot | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  return {
    avatarUrl: typeof candidate.avatarUrl === 'string' ? candidate.avatarUrl : null,
    theme:
      candidate.theme === 'light' || candidate.theme === 'dark' || candidate.theme === 'auto'
        ? candidate.theme
        : null,
    locale: candidate.locale === 'en' || candidate.locale === 'fr' ? candidate.locale : null,
  };
};

export const parseRefreshResponse = (value: unknown): ParsedRefreshResponse => {
  if (
    !value ||
    typeof value !== 'object' ||
    !isAuthTokens((value as { tokens?: unknown }).tokens)
  ) {
    throw new Error('Invalid refresh response.');
  }
  const candidate = value as { tokens: AuthTokens; snapshot?: unknown };
  return { tokens: candidate.tokens, snapshot: parseRefreshSnapshot(candidate.snapshot) };
};

export const parseOkResponse = (value: unknown): { ok: true } => {
  if (!value || typeof value !== 'object' || (value as { ok?: unknown }).ok !== true) {
    throw new Error('Invalid response.');
  }
  return { ok: true };
};

/** Normalises anything thrown by the API client into `{ code, message }`. */
export const toApiError = (value: unknown): ApiError => {
  if (value instanceof Error) {
    return { code: 'client_error', message: value.message };
  }
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { code?: unknown }).code === 'string' &&
    typeof (value as { message?: unknown }).message === 'string'
  ) {
    return value as ApiError;
  }
  return { code: 'unknown_error', message: 'Unexpected error.' };
};
