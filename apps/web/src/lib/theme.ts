import { getAccessToken } from './auth';
import { THEME_CHANGED_EVENT } from './constants';
import { loadAnonymousPreferences, saveAnonymousPreferences } from './preferences';
import { applyThemeAccent, loadProfileSettings } from './profile-settings';
import { updateUserPreferences } from './queries';
import { Theme } from './types';

const prefersDarkMode = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

export const loadTheme = (): Theme => {
  const storedTheme = loadAnonymousPreferences().theme;
  if (storedTheme) {
    return storedTheme;
  }
  return 'auto';
};

export const applyTheme = (theme: Theme): void => {
  const useDarkTheme = theme === 'dark' || (theme === 'auto' && prefersDarkMode());
  if (useDarkTheme) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  applyThemeAccent(loadProfileSettings().themeAccent);
};

export const persistTheme = (theme: Theme): void => {
  saveAnonymousPreferences({ theme });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(THEME_CHANGED_EVENT));
  }

  if (getAccessToken()) {
    void updateUserPreferences({ theme }).catch(() => undefined);
  }
};
