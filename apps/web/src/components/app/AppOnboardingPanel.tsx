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
  note,
  steps,
  className,
}: AppOnboardingPanelProps) => (
  <AppSurfaceCard
    className={`relative overflow-hidden border-brand-lime/20 bg-app-bg p-0 dark:bg-app-card ${className ?? ''}`.trim()}
  >
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(198,255,0,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,46,139,0.16),transparent_38%)]"
    />

    <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] lg:gap-8">
      <div className="grid gap-5">
        <span className="inline-flex h-13 w-13 items-center justify-center rounded-2xl border border-brand-lime/30 bg-app-elevated text-brand-dark shadow-glow-lime dark:bg-app-elevated dark:text-brand-white">
          {icon}
        </span>

        <div className="grid gap-2">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-app-text-secondary">
            {eyebrow}
          </p>
          <h1 className="max-w-xl text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl">
            {title}
          </h1>
          <p className="max-w-xl text-sm text-app-text-secondary sm:text-base">{body}</p>
        </div>

        {actions ? (
          <div className="flex flex-col items-stretch gap-3 sm:flex-row">{actions}</div>
        ) : null}
        {note ? (
          <p className="text-xs font-medium text-app-text-secondary sm:text-sm">{note}</p>
        ) : null}
      </div>

      <div className="grid gap-3">
        {steps.map((step, index) => (
          <article
            key={`${step.title}-${index}`}
            className="grid gap-3 rounded-2xl border border-app-border bg-app-elevated/90 p-4 shadow-soft-lift dark:bg-app-elevated/80"
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-app-border bg-app-bg text-app-text dark:bg-app-card">
                {step.icon}
              </span>
              <div className="grid gap-1">
                <p className="text-sm font-black text-brand-dark dark:text-brand-white">
                  {step.title}
                </p>
                <p className="text-sm text-app-text-secondary">{step.body}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  </AppSurfaceCard>
);
