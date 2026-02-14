import { Moon, Sun } from 'lucide-react';

import { useTheme } from '../../hooks/useTheme';

export const ThemeToggle = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className="group inline-flex h-8 w-14 items-center rounded-full border border-app-border bg-app-elevated px-1 shadow-soft-lift transition dark:border-app-border dark:bg-app-elevated dark:shadow-glow-lime"
      aria-label="Toggle light and dark mode"
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full bg-brand-dark text-brand-white transition-transform dark:bg-brand-white dark:text-brand-dark ${
          isDark ? 'translate-x-6' : 'translate-x-0'
        }`}
      >
        {isDark ? <Moon size={14} /> : <Sun size={14} />}
      </span>
    </button>
  );
};
