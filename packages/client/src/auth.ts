import { AUTH_CHANGED_EVENT, AUTH_STORAGE_KEY } from './constants';
import {
  type AuthUser,
  parseAuthResponse,
  parseAuthUser,
  parseRefreshResponse,
  type StoredAuth,
} from './models';
import { readCookieValue, safeStorageGet, safeStorageRemove, safeStorageSet } from './storage';

export type AuthScope = 'web' | 'admin';

type ScopeDefaults = {
  csrfCookieName: string;
  mePath: string;
  refreshPath: string;
  /** `/v1/me` returns the bare user; `/v1/admin/me` wraps it in `{ user }`. */
  unwrapMe: (payload: unknown) => unknown;
};

const SCOPE_DEFAULTS: Record<AuthScope, ScopeDefaults> = {
  web: {
    csrfCookieName: 'synqit_web_csrf',
    mePath: '/v1/me',
    refreshPath: '/v1/auth/refresh',
    unwrapMe: (payload) => payload,
  },
  admin: {
    csrfCookieName: 'synqit_admin_csrf',
    mePath: '/v1/admin/me',
    refreshPath: '/v1/admin/auth/refresh',
    unwrapMe: (payload) => (payload as { user?: unknown } | null)?.user,
  },
};

export type AuthStoreOptions = {
  /** API origin or same-origin prefix, e.g. `/api`. */
  baseUrl: string;
  scope: AuthScope;
  storageKey?: string;
};

/** Marker returned by `getAccessToken` when the session lives in cookies only. */
export const COOKIE_SESSION_SENTINEL = '__cookie_session__';

export type AuthStore = ReturnType<typeof createAuthStore>;

/**
 * Cookie-backed session store. The access token is kept in memory only; a
 * snapshot of the signed-in user lives in localStorage so the UI can render
 * before `bootstrapSession` confirms the session with the API.
 */
export const createAuthStore = ({
  baseUrl,
  scope,
  storageKey = AUTH_STORAGE_KEY,
}: AuthStoreOptions) => {
  const defaults = SCOPE_DEFAULTS[scope];
  let accessTokenMemory: string | null = null;

  const emitAuthChanged = (): void => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
    }
  };

  const loadAuth = (): StoredAuth | null => {
    const raw = safeStorageGet(storageKey);
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

  const storeAuthUser = (user: AuthUser): StoredAuth => {
    const next: StoredAuth = {
      userId: user.id,
      userEmail: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
      adminPermissions: user.adminPermissions,
    };
    safeStorageSet(storageKey, JSON.stringify(next));
    emitAuthChanged();
    return next;
  };

  const storeAuth = (authResponse: unknown): StoredAuth => {
    const parsed = parseAuthResponse(authResponse);
    accessTokenMemory = parsed.tokens.accessToken;
    return storeAuthUser(parsed.user);
  };

  const updateStoredAuthUser = (patch: Partial<Omit<StoredAuth, 'userId'>>): StoredAuth | null => {
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
    safeStorageSet(storageKey, JSON.stringify(next));
    emitAuthChanged();
    return next;
  };

  const clearAuth = (): void => {
    accessTokenMemory = null;
    safeStorageRemove(storageKey);
    emitAuthChanged();
  };

  const setAccessToken = (accessToken: string | null): void => {
    accessTokenMemory = accessToken;
  };

  const getAccessToken = (): string | null =>
    accessTokenMemory ?? (loadAuth() ? COOKIE_SESSION_SENTINEL : null);

  const getCsrfToken = (): string | null => readCookieValue(defaults.csrfCookieName);

  const isAuthenticated = (): boolean => Boolean(loadAuth());

  const isAdminAuthenticated = (): boolean => loadAuth()?.role === 'admin';

  const hasAdminPermission = (scopeName: string, level: 'read' | 'write'): boolean => {
    const auth = loadAuth();
    if (!auth || auth.role !== 'admin') {
      return false;
    }
    const match = auth.adminPermissions.find((permission) => permission.scope === scopeName);
    if (!match) {
      return false;
    }
    return level === 'read'
      ? match.level === 'read' || match.level === 'write'
      : match.level === 'write';
  };

  /** Confirms the cookie session on boot: `me`, then `refresh` + `me`, else clears the snapshot. */
  const bootstrapSession = async (): Promise<void> => {
    const syncFromMe = async (): Promise<boolean> => {
      const response = await fetch(`${baseUrl}${defaults.mePath}`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) {
        return false;
      }
      const payload = (await response.json().catch(() => ({}))) as unknown;
      storeAuthUser(parseAuthUser(defaults.unwrapMe(payload)));
      return true;
    };

    try {
      if (await syncFromMe()) {
        return;
      }
      const csrfToken = getCsrfToken();
      const refreshResponse = await fetch(`${baseUrl}${defaults.refreshPath}`, {
        method: 'POST',
        credentials: 'include',
        headers: csrfToken ? { 'x-synqit-csrf-token': csrfToken } : undefined,
      });
      if (!refreshResponse.ok) {
        clearAuth();
        return;
      }
      const refreshPayload = (await refreshResponse.json().catch(() => ({}))) as unknown;
      accessTokenMemory = parseRefreshResponse(refreshPayload).tokens.accessToken;
      if (!(await syncFromMe())) {
        clearAuth();
      }
    } catch {
      clearAuth();
    }
  };

  return {
    scope,
    baseUrl,
    refreshPath: defaults.refreshPath,
    emitAuthChanged,
    loadAuth,
    storeAuth,
    updateStoredAuthUser,
    clearAuth,
    setAccessToken,
    getAccessToken,
    getCsrfToken,
    isAuthenticated,
    isAdminAuthenticated,
    hasAdminPermission,
    bootstrapSession,
  };
};

/** Two-letter initials from an email's local part, e.g. `jane.doe@x` -> `JD`. */
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
