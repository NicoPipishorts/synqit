import { useEffect, useState } from 'react';

import { SiteTheme, applyTheme, loadTheme, persistTheme } from '../../lib/theme';

export const ThemeToggle = () => {
  const [theme, setTheme] = useState<SiteTheme>(() => loadTheme());

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
      className="focus-ring-brand inline-flex min-h-9 items-center rounded-full border border-brand-white/20 bg-brand-white/10 px-3 text-xs font-black uppercase tracking-wide text-brand-white transition hover:bg-brand-white/18 dark:border-brand-dark/20 dark:bg-brand-dark/10 dark:text-brand-dark dark:hover:bg-brand-dark/18"
    >
      {theme === 'dark' ? 'Light' : 'Dark'}
    </button>
  );
};
