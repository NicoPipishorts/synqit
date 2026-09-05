import { ThemeToggle as UiThemeToggle } from '@synqit/ui';
import { useEffect, useState } from 'react';

import { SiteTheme, applyTheme, loadTheme, persistTheme } from '../../lib/theme';

/** Site-bound ThemeToggle: persists the marketing site's light/dark choice. */
export const ThemeToggle = () => {
  const [theme, setTheme] = useState<SiteTheme>(() => loadTheme());

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  const isDark = theme === 'dark';
  return (
    <UiThemeToggle
      isDark={isDark}
      onToggle={() => setTheme(isDark ? 'light' : 'dark')}
      variant="translucent"
    />
  );
};
