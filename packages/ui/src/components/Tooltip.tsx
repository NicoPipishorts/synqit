import { type ReactNode, useEffect, useRef, useState } from 'react';

import { cn } from '../utils/cn';

type TooltipProps = {
  /** Tooltip text; also exposed to assistive tech as the trigger's label. */
  label: string;
  children: ReactNode;
  side?: 'top' | 'bottom';
  className?: string;
};

/**
 * Sticker-style tooltip. Opens on hover and keyboard focus (desktop) and toggles
 * on tap (touch); a tap elsewhere or Escape closes it.
 */
export const Tooltip = ({ label, children, side = 'top', className }: TooltipProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <span
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-expanded={open}
      onClick={(event) => {
        // Inside a <label> a click would also focus the field and blur us; keep the tap ours.
        event.preventDefault();
        event.stopPropagation();
        setOpen((current) => !current);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setOpen((current) => !current);
        }
      }}
      onBlur={() => setOpen(false)}
      className={cn(
        'group/tip relative inline-flex cursor-help items-center outline-none focus-visible:rounded-full focus-ring-brand',
        className,
      )}
    >
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute left-1/2 z-40 w-max max-w-[16rem] -translate-x-1/2 rounded-xl border-2 border-app-text bg-app-elevated px-3 py-2 text-left text-xs font-semibold normal-case leading-snug tracking-normal text-app-text shadow-sticker-sm transition duration-150 dark:bg-app-card',
          side === 'top' ? 'bottom-full mb-2.5' : 'top-full mt-2.5',
          open
            ? 'translate-y-0 opacity-100'
            : cn(
                'opacity-0 group-hover/tip:translate-y-0 group-hover/tip:opacity-100 group-focus-visible/tip:translate-y-0 group-focus-visible/tip:opacity-100',
                side === 'top' ? 'translate-y-1' : '-translate-y-1',
              ),
        )}
      >
        {label}
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
};
