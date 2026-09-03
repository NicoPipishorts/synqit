import {
  adminMeResponseSchema,
  authResponseSchema,
  type AdminPermissionLevel,
  type AdminPermissionScope,
} from '@synqit/shared';

import { API_URL, AUTH_CHANGED_EVENT, AUTH_STORAGE_KEY } from './constants';
import { StoredAuth } from './types';

const COOKIE_SESSION_SENTINEL = '__cookie_session__';
const ADMIN_CSRF_COOKIE_NAME = 'synqit_admin_csrf';
let accessTokenMemory: string | null = null;

const readCookieValue = (name: string): string | null => {
  if (typeof document === 'undefined') {
    return null;
  }

  const prefix = `${name}=`;
  for (const segment of document.cookie.split(';')) {
    const trimmed = segment.trim();
    if (!trimmed.startsWith(prefix)) {
      continue;
    }

    const rawValue = trimmed.slice(prefix.length);
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return null;
};

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
      typeof parsed.userId !== 'string' ||
      typeof parsed.userEmail !== 'string' ||
      !(typeof parsed.avatarUrl === 'string' || parsed.avatarUrl === null)
    ) {
      return null;
    }

    return {
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

const storeAuthUser = (userPayload: unknown): StoredAuth => {
  const parsedUser = adminMeResponseSchema.parse({ user: userPayload }).user;
  const nextAuth: StoredAuth = {
    userId: parsedUser.id,
    userEmail: parsedUser.email,
    avatarUrl: parsedUser.avatarUrl,
    role: parsedUser.role,
    adminPermissions: parsedUser.adminPermissions,
  };

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth));
  emitAuthChanged();
  return nextAuth;
};

export const storeAuth = (authResponse: unknown): StoredAuth => {
  const parsed = authResponseSchema.parse(authResponse);
  accessTokenMemory = parsed.tokens.accessToken;
  return storeAuthUser(parsed.user);
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

export const clearAuth = (): void => {
  accessTokenMemory = null;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  emitAuthChanged();
};

export const setAccessToken = (accessToken: string | null): void => {
  accessTokenMemory = accessToken;
};

export const getAccessToken = (): string | null =>
  accessTokenMemory ?? (loadAuth() ? COOKIE_SESSION_SENTINEL : null);

export const getCsrfToken = (): string | null => readCookieValue(ADMIN_CSRF_COOKIE_NAME);

export const isAuthenticated = (): boolean => Boolean(loadAuth());

export const isAdminAuthenticated = (): boolean => loadAuth()?.role === 'admin';

export const bootstrapAdminAuthSession = async (): Promise<void> => {
  const syncFromMe = async (): Promise<boolean> => {
    const meResponse = await fetch(`${API_URL}/v1/admin/me`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!meResponse.ok) {
      return false;
    }

    const mePayload = (await meResponse.json().catch(() => ({}))) as unknown;
    storeAuthUser(adminMeResponseSchema.parse(mePayload).user);
    return true;
  };

  try {
    if (await syncFromMe()) {
      return;
    }

    const refreshResponse = await fetch(`${API_URL}/v1/admin/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: getCsrfToken() ? { 'x-synqit-csrf-token': getCsrfToken() as string } : undefined,
    });
    if (!refreshResponse.ok) {
      clearAuth();
      return;
    }

    const refreshPayload = (await refreshResponse.json().catch(() => ({}))) as unknown;
    const parsedRefresh = authResponseSchema.shape.tokens.parse(
      (refreshPayload as { tokens?: unknown }).tokens,
    );
    accessTokenMemory = parsedRefresh.accessToken;

    if (!(await syncFromMe())) {
      clearAuth();
    }
  } catch {
    clearAuth();
  }
};

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
