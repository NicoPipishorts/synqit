import { PROFILE_SETTINGS_CHANGED_EVENT, PROFILE_SETTINGS_STORAGE_KEY } from './constants';
import { Provider, ThemeAccent } from './types';

export type PersonalInfoSettings = {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  country?: string;
};

export type ProfileSettings = {
  avatarDataUrl?: string;
  preferredProvider?: Provider;
  themeAccent?: ThemeAccent;
  personalInfo?: PersonalInfoSettings;
};

const DEFAULT_THEME_ACCENT: ThemeAccent = 'lime';

const THEME_ACCENT_CSS: Record<
  ThemeAccent,
  { focusRingLight: string; focusRingDark: string; glow: string }
> = {
  lime: {
    focusRingLight: 'rgba(198, 255, 0, 0.45)',
    focusRingDark: 'rgba(198, 255, 0, 0.50)',
    glow: 'rgba(198, 255, 0, 0.35)',
  },
  pink: {
    focusRingLight: 'rgba(255, 46, 139, 0.45)',
    focusRingDark: 'rgba(255, 46, 139, 0.50)',
    glow: 'rgba(255, 46, 139, 0.35)',
  },
};

const isBrowser = (): boolean => {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
};

const isProvider = (value: unknown): value is Provider => {
  return value === 'spotify' || value === 'apple';
};

const isThemeAccent = (value: unknown): value is ThemeAccent => {
  return value === 'lime' || value === 'pink';
};

const sanitizeDataUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  if (!value.startsWith('data:image/')) {
    return undefined;
  }

  return value;
};

const sanitizeOptionalText = (value: unknown, maxLength: number): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.slice(0, maxLength);
};

const sanitizeBirthDate = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return undefined;
  }

  return trimmed;
};

const sanitizePersonalInfo = (value: unknown): PersonalInfoSettings | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const next: PersonalInfoSettings = {
    displayName: sanitizeOptionalText(candidate.displayName, 80),
    firstName: sanitizeOptionalText(candidate.firstName, 80),
    lastName: sanitizeOptionalText(candidate.lastName, 80),
    birthDate: sanitizeBirthDate(candidate.birthDate),
    country: sanitizeOptionalText(candidate.country, 60),
  };

  if (!next.displayName && !next.firstName && !next.lastName && !next.birthDate && !next.country) {
    return undefined;
  }

  return next;
};

const sanitizeProfileSettings = (value: unknown): ProfileSettings => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const candidate = value as Record<string, unknown>;
  return {
    avatarDataUrl: sanitizeDataUrl(candidate.avatarDataUrl),
    preferredProvider: isProvider(candidate.preferredProvider)
      ? candidate.preferredProvider
      : undefined,
    themeAccent: isThemeAccent(candidate.themeAccent) ? candidate.themeAccent : undefined,
    personalInfo: sanitizePersonalInfo(candidate.personalInfo),
  };
};

const readStorageValue = (): ProfileSettings => {
  if (!isBrowser()) {
    return {};
  }

  try {
    const raw = localStorage.getItem(PROFILE_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return sanitizeProfileSettings(JSON.parse(raw));
  } catch {
    return {};
  }
};

const emitProfileSettingsChanged = (): void => {
  if (!isBrowser()) {
    return;
  }
  window.dispatchEvent(new CustomEvent(PROFILE_SETTINGS_CHANGED_EVENT));
};

export const loadProfileSettings = (): ProfileSettings => {
  return readStorageValue();
};

export const saveProfileSettings = (patch: Partial<ProfileSettings>): ProfileSettings => {
  if (!isBrowser()) {
    return sanitizeProfileSettings(patch);
  }

  const next = sanitizeProfileSettings({
    ...readStorageValue(),
    ...patch,
  });

  try {
    localStorage.setItem(PROFILE_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Intentionally no-op when storage is unavailable.
  }

  emitProfileSettingsChanged();
  return next;
};

export const applyThemeAccent = (accent: ThemeAccent | undefined): void => {
  if (typeof document === 'undefined') {
    return;
  }

  const safeAccent = accent ?? DEFAULT_THEME_ACCENT;
  const palette = THEME_ACCENT_CSS[safeAccent];
  const isDark = document.documentElement.classList.contains('dark');

  document.documentElement.style.setProperty(
    '--syn-focus-ring',
    isDark ? palette.focusRingDark : palette.focusRingLight,
  );
  document.documentElement.style.setProperty('--syn-glow-lime', palette.glow);
  document.documentElement.style.setProperty('--syn-glow-pink', palette.glow);
};
