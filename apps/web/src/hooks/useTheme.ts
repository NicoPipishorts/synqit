import { useEffect, useState } from 'react';

import { applyTheme, loadTheme, persistTheme } from '../lib/theme';
import { Theme } from '../lib/types';

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(() => loadTheme());

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((previousTheme) => (previousTheme === 'dark' ? 'light' : 'dark'));
  };

  return {
    theme,
    isDark: theme === 'dark',
    toggleTheme,
  };
};
