import type { ReactNode } from 'react';

import { cn } from '../utils/cn';

export type StatItem = {
  id: string;
  label: string;
  value: number | string;
  hint?: string;
  /** Highlights the hint (e.g. "+3 today"). */
  hintActive?: boolean;
  /** Small icon rendered before the label, e.g. `<Users size={14} aria-hidden="true" />`. */
  icon?: ReactNode;
};

export type StatCardProps = Omit<StatItem, 'id'> & { className?: string };

/** Single KPI tile: label, large value, optional hint. */
export const StatCard = ({ label, value, hint, hintActive, icon, className }: StatCardProps) => (
  <div
    className={cn(
      'rounded-2xl border border-app-border bg-app-elevated p-4 shadow-soft-lift dark:bg-app-card',
      className,
    )}
  >
    <div className="flex items-center gap-1.5 text-app-text-secondary">
      {icon}
      <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
    </div>
    <p className="mt-2 text-3xl font-black tabular-nums text-brand-dark dark:text-brand-white">
      {typeof value === 'number' ? value.toLocaleString() : value}
    </p>
    {hint ? (
      <p
        className={cn(
          'mt-0.5 truncate text-xs',
          hintActive
            ? 'font-semibold text-[#6d9600] dark:text-[#d5ff5c]'
            : 'text-app-text-secondary',
        )}
      >
        {hint}
      </p>
    ) : null}
  </div>
);

type StatGridProps = {
  stats: readonly StatItem[];
  className?: string;
};

/** Responsive grid of StatCards: two columns on small screens, four from `lg`. */
export const StatGrid = ({ stats, className }: StatGridProps) => (
  <section className={cn('grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4', className)}>
    {stats.map(({ id, ...stat }) => (
      <StatCard key={id} {...stat} />
    ))}
  </section>
);
