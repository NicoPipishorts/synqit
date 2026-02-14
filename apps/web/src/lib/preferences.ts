import { LOCALE_STORAGE_KEY, PREFERENCES_STORAGE_KEY, THEME_STORAGE_KEY } from './constants';
import { Locale } from './i18n/messages';
import { Theme } from './types';

export type AnonymousPreferences = {
  theme?: Theme;
  locale?: Locale;
};

const isBrowser = (): boolean => {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
};

const safeStorageGet = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeStorageSet = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Intentionally no-op when storage is unavailable.
  }
};

const isTheme = (value: unknown): value is Theme => {
  return value === 'light' || value === 'dark';
};

const isLocale = (value: unknown): value is Locale => {
  return value === 'en' || value === 'fr';
};

const sanitizePreferences = (value: unknown): AnonymousPreferences => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const candidate = value as Record<string, unknown>;
  return {
    theme: isTheme(candidate.theme) ? candidate.theme : undefined,
    locale: isLocale(candidate.locale) ? candidate.locale : undefined,
  };
};

const readStoredPreferences = (): AnonymousPreferences => {
  if (!isBrowser()) {
    return {};
  }

  const raw = safeStorageGet(PREFERENCES_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    return sanitizePreferences(JSON.parse(raw));
  } catch {
    return {};
  }
};

const readLegacyPreferences = (): AnonymousPreferences => {
  if (!isBrowser()) {
    return {};
  }

  const legacyTheme = safeStorageGet(THEME_STORAGE_KEY);
  const legacyLocale = safeStorageGet(LOCALE_STORAGE_KEY);

  return {
    theme: isTheme(legacyTheme) ? legacyTheme : undefined,
    locale: isLocale(legacyLocale) ? legacyLocale : undefined,
  };
};

export const loadAnonymousPreferences = (): AnonymousPreferences => {
  if (!isBrowser()) {
    return {};
  }

  const stored = readStoredPreferences();
  const legacy = readLegacyPreferences();
  const merged: AnonymousPreferences = {
    theme: stored.theme ?? legacy.theme,
    locale: stored.locale ?? legacy.locale,
  };

  if (merged.theme !== stored.theme || merged.locale !== stored.locale) {
    safeStorageSet(PREFERENCES_STORAGE_KEY, JSON.stringify(merged));
  }

  return merged;
};

export const saveAnonymousPreferences = (
  patch: Partial<AnonymousPreferences>,
): AnonymousPreferences => {
  if (!isBrowser()) {
    return sanitizePreferences(patch);
  }

  const current = loadAnonymousPreferences();
  const next = sanitizePreferences({
    ...current,
    ...patch,
  });

  safeStorageSet(PREFERENCES_STORAGE_KEY, JSON.stringify(next));
  return next;
};
