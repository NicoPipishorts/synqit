import type { ReactNode } from 'react';

import { Sticker } from './Sticker';
import { SurfaceCard } from './SurfaceCard';
import { TapeStrip } from './TapeStrip';
import { cn } from '../utils/cn';

export type OnboardingStep = {
  icon: ReactNode;
  title: string;
  body: string;
};

type OnboardingPanelProps = {
  eyebrow: string;
  /** Optional: a page whose own heading already says it can leave it out. */
  title?: string;
  body: string;
  icon: ReactNode;
  actions?: ReactNode;
  /** Reserved for a future footnote; accepted so callers can wire copy ahead of the design. */
  note?: string;
  /** Reserved for a future step list; accepted but not rendered yet. */
  steps?: readonly OnboardingStep[];
  className?: string;
};

/** Hero-style onboarding card shown on empty first-run pages. */
export const OnboardingPanel = ({
  eyebrow,
  title,
  body,
  icon,
  actions,
  note: _note,
  steps: _steps,
  className,
}: OnboardingPanelProps) => (
  <SurfaceCard className={cn('relative overflow-visible p-0', className)}>
    <TapeStrip tone="lime" className="left-8 w-16" />
    <TapeStrip tone="pink" className="-bottom-3 right-10 top-auto left-auto rotate-3" />
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[calc(1.5rem-2px)] bg-[radial-gradient(circle_at_top_left,rgba(198,255,0,0.22),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(255,46,139,0.18),transparent_42%)]"
    />

    <div className="relative grid gap-5 p-5 sm:p-8">
      <span className="inline-flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border-2 border-app-text bg-brand-lime text-brand-dark shadow-sticker-sm">
        {icon}
      </span>

      <div className="grid gap-2">
        <Sticker tone="paper" tilt="-rotate-2">
          {eyebrow}
        </Sticker>
        {title ? (
          <p className="max-w-xl text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl">
            {title}
          </p>
        ) : null}
        <p className="max-w-xl text-sm text-app-text-secondary sm:text-base">{body}</p>
      </div>

      {actions ? (
        <div className="flex flex-col items-stretch gap-3 sm:flex-row">{actions}</div>
      ) : null}
    </div>
  </SurfaceCard>
);
