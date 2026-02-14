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
      typeof parsed.userEmail !== 'string'
    ) {
      return null;
    }

    return parsed as StoredAuth;
  } catch {
    return null;
  }
};

export const storeAuth = (authResponse: unknown): StoredAuth => {
  const parsed = authResponseSchema.parse(authResponse);
  const nextAuth: StoredAuth = {
    accessToken: parsed.tokens.accessToken,
    refreshToken: parsed.tokens.refreshToken,
    userEmail: parsed.user.email,
  };

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth));
  emitAuthChanged();
  return nextAuth;
};

export const clearAuth = (): void => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  emitAuthChanged();
};

export const getAccessToken = (): string | null => loadAuth()?.accessToken ?? null;

export const isAuthenticated = (): boolean => Boolean(loadAuth()?.accessToken);

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
