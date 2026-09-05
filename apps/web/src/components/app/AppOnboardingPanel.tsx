import { type ReactNode } from 'react';

import { AppSurfaceCard } from './AppSurfaceCard';

type AppOnboardingStep = {
  icon: ReactNode;
  title: string;
  body: string;
};

type AppOnboardingPanelProps = {
  eyebrow: string;
  title: string;
  body: string;
  icon: ReactNode;
  actions?: ReactNode;
  note?: string;
  steps: AppOnboardingStep[];
  className?: string;
};

export const AppOnboardingPanel = ({
  eyebrow,
  title,
  body,
  icon,
  actions,
  note: _note,
  steps: _steps,
  className,
}: AppOnboardingPanelProps) => (
  <AppSurfaceCard
    className={`relative overflow-hidden border-brand-lime/20 bg-app-bg p-0 dark:bg-app-card ${className ?? ''}`.trim()}
  >
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(198,255,0,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,46,139,0.16),transparent_38%)]"
    />

    <div className="relative grid gap-5 p-5 sm:p-8">
      <span className="inline-flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border border-brand-lime/30 bg-app-elevated text-brand-dark shadow-glow-lime dark:bg-app-elevated dark:text-brand-white">
        {icon}
      </span>

      <div className="grid gap-2">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-app-text-secondary">
          {eyebrow}
        </p>
        <p className="max-w-xl text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl">
          {title}
        </p>
        <p className="max-w-xl text-sm text-app-text-secondary sm:text-base">{body}</p>
      </div>

      {actions ? (
        <div className="flex flex-col items-stretch gap-3 sm:flex-row">{actions}</div>
      ) : null}
    </div>
  </AppSurfaceCard>
);
