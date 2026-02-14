import { loadAnonymousPreferences, saveAnonymousPreferences } from './preferences';
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
};

export const persistTheme = (theme: Theme): void => {
  saveAnonymousPreferences({ theme });
};
