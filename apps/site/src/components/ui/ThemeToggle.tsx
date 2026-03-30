import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

import { SiteTheme, applyTheme, loadTheme, persistTheme } from '../../lib/theme';

export const ThemeToggle = () => {
  const [theme, setTheme] = useState<SiteTheme>(() => loadTheme());

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label="Toggle light and dark mode"
      className="group inline-flex h-8 w-14 items-center rounded-full border border-brand-white/20 bg-brand-white/10 px-1 shadow-soft-lift transition hover:border-brand-lime dark:border-brand-dark/20 dark:bg-brand-dark/10"
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full border border-brand-white/20 bg-brand-dark text-brand-white transition-transform dark:border-brand-dark/20 dark:bg-brand-white dark:text-brand-dark ${
          isDark ? 'translate-x-6' : 'translate-x-0'
        }`}
      >
        {isDark ? <Moon size={14} /> : <Sun size={14} />}
      </span>
    </button>
  );
};
