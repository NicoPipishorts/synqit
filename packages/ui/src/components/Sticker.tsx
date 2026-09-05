import { type ReactNode } from 'react';

import { cn } from '../utils/cn';

export type StickerTone = 'lime' | 'pink' | 'ink' | 'paper';

const TONE_CLASS_NAME: Record<StickerTone, string> = {
  lime: 'bg-brand-lime text-brand-dark',
  pink: 'bg-brand-pink text-brand-white',
  ink: 'bg-brand-dark text-brand-white dark:bg-brand-white dark:text-brand-dark',
  paper: 'bg-app-elevated text-app-text dark:bg-app-card',
};

export type StickerProps = {
  tone?: StickerTone;
  /** Tailwind rotate class, e.g. `-rotate-3`. */
  tilt?: string;
  className?: string;
  children: ReactNode;
};

/** Die-cut sticker label: thick ink border, hard offset shadow, optional tilt. */
export const Sticker = ({ tone = 'lime', tilt, className, children }: StickerProps) => (
  <span
    className={cn(
      'inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-app-text px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] shadow-sticker-sm',
      TONE_CLASS_NAME[tone],
      tilt,
      className,
    )}
  >
    {children}
  </span>
);
