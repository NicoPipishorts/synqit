import { THEME_CHANGED_EVENT } from './constants';
import { loadAnonymousPreferences, saveAnonymousPreferences } from './preferences';
import { applyThemeAccent, loadProfileSettings } from './profile-settings';
import { Theme } from './types';

export const loadTheme = (): Theme => {
  const storedTheme = loadAnonymousPreferences().theme;
  if (storedTheme) {
    return storedTheme;
  }

  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return 'light';
};

export const applyTheme = (theme: Theme): void => {
  if (theme === 'dark') {
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
};
