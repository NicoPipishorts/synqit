import { LOCALE_STORAGE_KEY, PREFERENCES_STORAGE_KEY, THEME_STORAGE_KEY } from './constants';
import { SUPPORTED_LOCALES, type SupportedLocale, type Theme } from './models';
import { isBrowser, safeStorageGet, safeStorageSet } from './storage';

export type AnonymousPreferences = {
  theme?: Theme;
  locale?: SupportedLocale;
};

export const isTheme = (value: unknown): value is Theme =>
  value === 'light' || value === 'dark' || value === 'auto';

export const isSupportedLocale = (value: unknown): value is SupportedLocale =>
  typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);

const sanitize = (value: unknown): AnonymousPreferences => {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const candidate = value as Record<string, unknown>;
  return {
    theme: isTheme(candidate.theme) ? candidate.theme : undefined,
    locale: isSupportedLocale(candidate.locale) ? candidate.locale : undefined,
  };
};

const readStored = (): AnonymousPreferences => {
  const raw = safeStorageGet(PREFERENCES_STORAGE_KEY);
  if (!raw) {
    return {};
  }
  try {
    return sanitize(JSON.parse(raw));
  } catch {
    return {};
  }
};

// Pre-v1 the theme and locale lived in separate keys; migrate them silently.
const readLegacy = (): AnonymousPreferences => ({
  theme: isTheme(safeStorageGet(THEME_STORAGE_KEY))
    ? (safeStorageGet(THEME_STORAGE_KEY) as Theme)
    : undefined,
  locale: isSupportedLocale(safeStorageGet(LOCALE_STORAGE_KEY))
    ? (safeStorageGet(LOCALE_STORAGE_KEY) as SupportedLocale)
    : undefined,
});

/** Theme and locale for anonymous visitors (and as a cache for signed-in users). */
export const loadAnonymousPreferences = (): AnonymousPreferences => {
  if (!isBrowser()) {
    return {};
  }
  const stored = readStored();
  const legacy = readLegacy();
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
    return sanitize(patch);
  }
  const next = sanitize({ ...loadAnonymousPreferences(), ...patch });
  safeStorageSet(PREFERENCES_STORAGE_KEY, JSON.stringify(next));
  return next;
};
