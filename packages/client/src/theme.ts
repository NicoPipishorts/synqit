import { THEME_CHANGED_EVENT } from './constants';
import type { Theme } from './models';
import { safeStorageGet, safeStorageSet } from './storage';

export const prefersDarkMode = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

/** Resolves `auto` against the OS preference. */
export const resolveIsDark = (theme: Theme): boolean =>
  theme === 'dark' || (theme === 'auto' && prefersDarkMode());

/** Toggles the `.dark` class the design tokens key off. */
export const applyThemeClass = (isDark: boolean): void => {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', isDark);
  }
};

export const emitThemeChanged = (): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(THEME_CHANGED_EVENT));
  }
};

export type BinaryTheme = 'light' | 'dark';

/**
 * Minimal light/dark store for apps without user accounts (the marketing
 * site): one localStorage key, OS preference as the default.
 */
export const createLocalThemeStore = (storageKey: string) => ({
  load: (): BinaryTheme => {
    const stored = safeStorageGet(storageKey);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    return prefersDarkMode() ? 'dark' : 'light';
  },
  apply: (theme: BinaryTheme): void => applyThemeClass(theme === 'dark'),
  persist: (theme: BinaryTheme): void => safeStorageSet(storageKey, theme),
});
