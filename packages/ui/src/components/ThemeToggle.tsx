import { Moon, Sun } from 'lucide-react';

import { cn } from '../utils/cn';

export type ThemeToggleVariant = 'surface' | 'translucent';

type ThemeToggleProps = {
  isDark: boolean;
  onToggle: () => void;
  label?: string;
  /** `surface` sits on app surfaces; `translucent` sits on hero/marketing backgrounds. */
  variant?: ThemeToggleVariant;
  className?: string;
};

const TRACK_CLASSES: Record<ThemeToggleVariant, string> = {
  surface: 'border-app-border bg-app-surface/90 hover:border-brand-lime dark:bg-app-elevated/90',
  translucent:
    'border-brand-white/20 bg-brand-white/10 hover:border-brand-lime dark:border-brand-dark/20 dark:bg-brand-dark/10',
};

const KNOB_CLASSES: Record<ThemeToggleVariant, string> = {
  surface: 'border-app-border bg-app-bg text-app-text dark:bg-app-card dark:text-app-text',
  translucent:
    'border-brand-white/20 bg-brand-dark text-brand-white dark:border-brand-dark/20 dark:bg-brand-white dark:text-brand-dark',
};

/** Controlled light/dark switch. Apps own theme persistence and pass state in. */
export const ThemeToggle = ({
  isDark,
  onToggle,
  label = 'Toggle light and dark mode',
  variant = 'surface',
  className,
}: ThemeToggleProps) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={label}
    aria-pressed={isDark}
    className={cn(
      'group inline-flex h-8 w-14 items-center rounded-full border px-1 shadow-soft-lift transition focus-ring-brand',
      TRACK_CLASSES[variant],
      className,
    )}
  >
    <span
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded-full border transition-transform',
        KNOB_CLASSES[variant],
        isDark ? 'translate-x-6' : 'translate-x-0',
      )}
    >
      {isDark ? <Moon size={14} /> : <Sun size={14} />}
    </span>
  </button>
);
