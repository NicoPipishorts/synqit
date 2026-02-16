import { Moon, Sun } from 'lucide-react';

import { useTheme } from '../../hooks/useTheme';

export const ThemeToggle = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className="group inline-flex h-8 w-14 items-center rounded-full border border-app-border bg-app-surface/90 px-1 shadow-soft-lift transition hover:border-brand-lime focus-ring-brand dark:bg-app-elevated/90"
      aria-label="Toggle light and dark mode"
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full border border-app-border bg-app-bg text-app-text transition-transform dark:bg-app-card dark:text-app-text ${
          isDark ? 'translate-x-6' : 'translate-x-0'
        }`}
      >
        {isDark ? <Moon size={14} /> : <Sun size={14} />}
      </span>
    </button>
  );
};
