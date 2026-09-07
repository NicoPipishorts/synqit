import type { ReactNode } from 'react';

import { TapeStrip, type TapeTone } from './TapeStrip';
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
  /** Colour of the tape strip on the card's corner. */
  tone?: TapeTone;
};

export type StatCardProps = Omit<StatItem, 'id'> & { className?: string };

/** Single KPI tile: sticker frame, label, large value, optional hint. */
export const StatCard = ({
  label,
  value,
  hint,
  hintActive,
  icon,
  tone = 'lime',
  className,
}: StatCardProps) => (
  <div
    className={cn(
      'relative rounded-3xl border-2 border-app-text bg-app-elevated p-4 shadow-sticker dark:bg-app-card sm:p-5',
      className,
    )}
  >
    <TapeStrip tone={tone} />
    <div className="flex items-center gap-1.5 text-app-text-secondary">
      {icon}
      <span className="text-[11px] font-black uppercase tracking-[0.16em]">{label}</span>
    </div>
    <p className="mt-2 text-3xl font-black tabular-nums tracking-tight text-brand-dark dark:text-brand-white sm:text-4xl">
      {typeof value === 'number' ? value.toLocaleString() : value}
    </p>
    {hint ? (
      <p
        className={cn(
          'mt-1 truncate text-xs',
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

const TONES: TapeTone[] = ['lime', 'pink', 'sky', 'gradient'];

/** Responsive grid of StatCards: two columns on small screens, four from `lg`. */
export const StatGrid = ({ stats, className }: StatGridProps) => (
  <section className={cn('grid grid-cols-2 gap-4 pt-2 sm:gap-5 lg:grid-cols-4', className)}>
    {stats.map(({ id, tone, ...stat }, index) => (
      <StatCard key={id} tone={tone ?? TONES[index % TONES.length]} {...stat} />
    ))}
  </section>
);
