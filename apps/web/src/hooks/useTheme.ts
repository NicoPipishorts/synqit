import { useEffect, useState } from 'react';

import { THEME_CHANGED_EVENT } from '../lib/constants';
import { applyTheme, loadTheme, persistTheme } from '../lib/theme';
import { Theme } from '../lib/types';

export const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>(() => loadTheme());

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  useEffect(() => {
    const syncTheme = () => {
      setThemeState(loadTheme());
    };

    window.addEventListener(THEME_CHANGED_EVENT, syncTheme);
    window.addEventListener('storage', syncTheme);
    return () => {
      window.removeEventListener(THEME_CHANGED_EVENT, syncTheme);
      window.removeEventListener('storage', syncTheme);
    };
  }, []);

  const toggleTheme = () => {
    setThemeState((previousTheme) => (previousTheme === 'dark' ? 'light' : 'dark'));
  };

  return {
    theme,
    isDark: theme === 'dark',
    setTheme: setThemeState,
    toggleTheme,
  };
};
