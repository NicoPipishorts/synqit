import { type AdminPermissionLevel, type AdminPermissionScope } from '@synqit/shared';
import { authResponseSchema } from '@synqit/shared';

import { AUTH_CHANGED_EVENT, AUTH_STORAGE_KEY } from './constants';
import { StoredAuth } from './types';

export const emitAuthChanged = (): void => {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
};

export const loadAuth = (): StoredAuth | null => {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredAuth>;
    if (
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.refreshToken !== 'string' ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.userEmail !== 'string' ||
      !(typeof parsed.avatarUrl === 'string' || parsed.avatarUrl === null)
    ) {
      return null;
    }

    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      userId: parsed.userId,
      userEmail: parsed.userEmail,
      avatarUrl: parsed.avatarUrl,
      role: parsed.role === 'admin' ? 'admin' : 'user',
      adminPermissions: Array.isArray(parsed.adminPermissions) ? parsed.adminPermissions : [],
    };
  } catch {
    return null;
  }
};

export const storeAuth = (authResponse: unknown): StoredAuth => {
  const parsed = authResponseSchema.parse(authResponse);
  const nextAuth: StoredAuth = {
    accessToken: parsed.tokens.accessToken,
    refreshToken: parsed.tokens.refreshToken,
    userId: parsed.user.id,
    userEmail: parsed.user.email,
    avatarUrl: parsed.user.avatarUrl,
    role: parsed.user.role,
    adminPermissions: parsed.user.adminPermissions,
  };

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth));
  emitAuthChanged();
  return nextAuth;
};

export const updateStoredAuthUser = (patch: {
  userEmail?: string;
  avatarUrl?: string | null;
  role?: 'user' | 'admin';
  adminPermissions?: StoredAuth['adminPermissions'];
}): StoredAuth | null => {
  const current = loadAuth();
  if (!current) {
    return null;
  }

  const next: StoredAuth = {
    ...current,
    ...(patch.userEmail !== undefined ? { userEmail: patch.userEmail } : {}),
    ...(patch.avatarUrl !== undefined ? { avatarUrl: patch.avatarUrl } : {}),
    ...(patch.role !== undefined ? { role: patch.role } : {}),
    ...(patch.adminPermissions !== undefined ? { adminPermissions: patch.adminPermissions } : {}),
  };

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
  emitAuthChanged();
  return next;
};

export const updateStoredAuthTokens = (patch: {
  accessToken: string;
  refreshToken: string;
}): StoredAuth | null => {
  const current = loadAuth();
  if (!current) {
    return null;
  }

  const next: StoredAuth = {
    ...current,
    accessToken: patch.accessToken,
    refreshToken: patch.refreshToken,
  };

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
  emitAuthChanged();
  return next;
};

export const clearAuth = (): void => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  emitAuthChanged();
};

export const getAccessToken = (): string | null => loadAuth()?.accessToken ?? null;

export const isAuthenticated = (): boolean => Boolean(loadAuth()?.accessToken);

export const isAdminAuthenticated = (): boolean => loadAuth()?.role === 'admin';

export const hasAdminPermission = (
  scope: AdminPermissionScope,
  level: AdminPermissionLevel,
): boolean => {
  const auth = loadAuth();
  if (!auth || auth.role !== 'admin') {
    return false;
  }

  const match = auth.adminPermissions.find((permission) => permission.scope === scope);
  if (!match) {
    return false;
  }

  if (level === 'read') {
    return match.level === 'read' || match.level === 'write';
  }

  return match.level === 'write';
};

export const getInitials = (email: string): string => {
  const trimmed = email.trim();
  if (!trimmed) {
    return 'U';
  }

  const segments =
    trimmed
      .split('@')[0]
      ?.split(/[._-]+/)
      .filter(Boolean) ?? [];
  if (segments.length === 0) {
    return trimmed.slice(0, 1).toUpperCase();
  }
  if (segments.length === 1) {
    return segments[0].slice(0, 2).toUpperCase();
  }

  return `${segments[0][0] ?? ''}${segments[1][0] ?? ''}`.toUpperCase();
};
