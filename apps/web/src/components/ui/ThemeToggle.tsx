import { Moon, Sun } from 'lucide-react';

import { useTheme } from '../../hooks/useTheme';

export const ThemeToggle = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className="group inline-flex h-8 w-14 items-center rounded-full border border-brand-white/20 bg-brand-white/10 px-1 transition dark:border-brand-dark/20 dark:bg-brand-dark/10"
      aria-label="Toggle light and dark mode"
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full bg-brand-white text-brand-dark transition-transform dark:bg-brand-dark dark:text-brand-white ${
          isDark ? 'translate-x-6' : 'translate-x-0'
        }`}
      >
        {isDark ? <Moon size={14} /> : <Sun size={14} />}
      </span>
    </button>
  );
};
