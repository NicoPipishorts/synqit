import { type ComponentType } from 'react';

import { type Icon3DProps } from './Icon3D';
import { SurfaceCard } from './SurfaceCard';

export type AccentTone = 'lime' | 'pink';

const CARD_ACCENTS = {
  lime: {
    badge: 'text-[#7aa300] dark:text-brand-lime',
    glow: 'bg-[radial-gradient(circle_at_top_right,rgba(198,255,0,0.18),transparent_58%)]',
    line: 'from-brand-lime/70 via-brand-lime/25 to-transparent',
    panel:
      'bg-[linear-gradient(165deg,rgba(198,255,0,0.12)_0%,rgba(255,255,255,0)_48%)] dark:bg-[linear-gradient(165deg,rgba(198,255,0,0.10)_0%,rgba(255,255,255,0)_48%)]',
  },
  pink: {
    badge: 'text-[#b41563] dark:text-brand-pink',
    glow: 'bg-[radial-gradient(circle_at_top_right,rgba(255,46,139,0.16),transparent_58%)]',
    line: 'from-brand-pink/70 via-brand-pink/25 to-transparent',
    panel:
      'bg-[linear-gradient(165deg,rgba(255,46,139,0.10)_0%,rgba(255,255,255,0)_48%)] dark:bg-[linear-gradient(165deg,rgba(255,46,139,0.08)_0%,rgba(255,255,255,0)_48%)]',
  },
} as const;

type AccentInfoCardProps = {
  accent: AccentTone;
  icon: ComponentType<Icon3DProps>;
  title: string;
  body: string;
  badge?: string;
  size?: 'md' | 'lg';
  className?: string;
};

export const AccentInfoCard = ({
  accent,
  icon: Icon,
  title,
  body,
  badge,
  size = 'md',
  className,
}: AccentInfoCardProps) => {
  const styles = CARD_ACCENTS[accent];
  const padding = size === 'lg' ? 'p-6' : 'p-5';
  const iconSize = size === 'lg' ? 'h-13 w-13' : 'h-12 w-12';
  const titleClass = size === 'lg' ? 'max-w-[18rem] text-lg' : 'text-lg';
  const lineOffset = size === 'lg' ? 'mt-6' : 'mt-[1.375rem]';

  return (
    <SurfaceCard
      className={`h-full border-app-border/80 ${padding} ${styles.panel} ${className ?? ''}`.trim()}
    >
      <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${styles.glow}`} />
      <div className="relative z-10 flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <Icon tone={accent} className={`${iconSize} shrink-0`} />
          <div
            aria-hidden="true"
            className={`${lineOffset} h-px min-w-8 flex-1 self-start bg-gradient-to-r ${styles.line}`}
          />
          {badge ? (
            <span
              className={`rounded-full border border-current/12 bg-app-bg/70 px-3 py-1 text-[11px] font-black tracking-[0.24em] uppercase backdrop-blur-sm ${styles.badge}`}
            >
              {badge}
            </span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-3">
          <p
            className={`${titleClass} font-black leading-tight text-brand-dark dark:text-brand-white`}
          >
            {title}
          </p>
          <p className="text-sm leading-relaxed text-app-text-secondary">{body}</p>
        </div>
      </div>
    </SurfaceCard>
  );
};
