import { type LucideIcon } from 'lucide-react';

export type DashboardStat = {
  id: string;
  label: string;
  value: number;
  hint: string;
  hintActive?: boolean;
  icon: LucideIcon;
};

type DashboardStatsProps = {
  stats: DashboardStat[];
};

export const DashboardStats = ({ stats }: DashboardStatsProps) => (
  <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
    {stats.map(({ id, label, value, hint, hintActive, icon: Icon }) => (
      <div
        key={id}
        className="rounded-2xl border border-app-border bg-app-elevated p-4 dark:bg-app-card"
      >
        <div className="flex items-center gap-1.5 text-app-text-secondary">
          <Icon size={14} aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
        </div>
        <p className="mt-2 text-3xl font-black tabular-nums text-brand-dark dark:text-brand-white">
          {value.toLocaleString()}
        </p>
        <p
          className={`mt-0.5 truncate text-xs ${
            hintActive
              ? 'font-semibold text-[#6d9600] dark:text-[#d5ff5c]'
              : 'text-app-text-secondary'
          }`}
        >
          {hint}
        </p>
      </div>
    ))}
  </section>
);
