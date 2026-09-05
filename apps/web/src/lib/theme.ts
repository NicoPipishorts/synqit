import { applyThemeClass, emitThemeChanged, resolveIsDark } from '@synqit/client';

import { isAuthenticated } from './auth';
import { loadAnonymousPreferences, saveAnonymousPreferences } from './preferences';
import { applyThemeAccent, loadProfileSettings } from './profile-settings';
import { updateUserPreferences } from './queries';
import { Theme } from './types';

export const loadTheme = (): Theme => loadAnonymousPreferences().theme ?? 'auto';

export const applyTheme = (theme: Theme): void => {
  applyThemeClass(resolveIsDark(theme));
  applyThemeAccent(loadProfileSettings().themeAccent);
};

export const persistTheme = (theme: Theme): void => {
  saveAnonymousPreferences({ theme });
  emitThemeChanged();

  if (isAuthenticated()) {
    void updateUserPreferences({ theme }).catch(() => undefined);
  }
};
