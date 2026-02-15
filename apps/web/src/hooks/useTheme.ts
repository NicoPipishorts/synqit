import { useEffect, useState } from 'react';

import { THEME_CHANGED_EVENT } from '../lib/constants';
import { applyTheme, loadTheme, persistTheme } from '../lib/theme';
import { Theme } from '../lib/types';

export const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>(() => loadTheme());
  const [isSystemDark, setIsSystemDark] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => {
      setIsSystemDark(event.matches);
    };

    setIsSystemDark(mediaQuery.matches);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (theme === 'auto') {
      applyTheme('auto');
    }
  }, [theme, isSystemDark]);

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
    setThemeState((previousTheme) =>
      previousTheme === 'dark' ? 'light' : previousTheme === 'light' ? 'dark' : 'dark',
    );
  };

  return {
    theme,
    isDark: theme === 'dark' || (theme === 'auto' && isSystemDark),
    setTheme: setThemeState,
    toggleTheme,
  };
};
