import type { ReactNode } from 'react';

import { cn } from '../utils/cn';

type TooltipProps = {
  /** Tooltip text; also exposed to assistive tech via aria-describedby-free `aria-label`. */
  label: string;
  children: ReactNode;
  side?: 'top' | 'bottom';
  className?: string;
};

/**
 * Sticker-style tooltip shown on hover and keyboard focus. Pure CSS: the trigger
 * is focusable so the bubble also opens for keyboard users.
 */
export const Tooltip = ({ label, children, side = 'top', className }: TooltipProps) => (
  <span
    tabIndex={0}
    aria-label={label}
    className={cn(
      'group/tip relative inline-flex cursor-help items-center outline-none focus-visible:rounded-full focus-ring-brand',
      className,
    )}
  >
    {children}
    <span
      role="tooltip"
      className={cn(
        'pointer-events-none absolute left-1/2 z-40 w-max max-w-[16rem] -translate-x-1/2 rounded-xl border-2 border-app-text bg-app-elevated px-3 py-2 text-left text-xs font-semibold normal-case leading-snug tracking-normal text-app-text opacity-0 shadow-sticker-sm transition duration-150 group-hover/tip:opacity-100 group-focus-visible/tip:opacity-100 dark:bg-app-card',
        side === 'top'
          ? 'bottom-full mb-2.5 translate-y-1 group-hover/tip:translate-y-0 group-focus-visible/tip:translate-y-0'
          : 'top-full mt-2.5 -translate-y-1 group-hover/tip:translate-y-0 group-focus-visible/tip:translate-y-0',
      )}
    >
      {label}
      {/* little ink arrow */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-2 border-app-text bg-app-elevated dark:bg-app-card',
          side === 'top'
            ? '-bottom-[8px] border-l-0 border-t-0'
            : '-top-[8px] border-b-0 border-r-0',
        )}
      />
    </span>
  </span>
);
