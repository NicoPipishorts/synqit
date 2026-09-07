import { cn } from '../utils/cn';

export type TapeTone = 'lime' | 'pink' | 'sky' | 'gradient';

const TONE_CLASS_NAME: Record<TapeTone, string> = {
  lime: 'bg-brand-lime/80',
  pink: 'bg-brand-pink/70',
  sky: 'bg-[#7dd3fc]/80',
  gradient: 'bg-brand-gradient opacity-80',
};

type TapeStripProps = {
  tone?: TapeTone;
  /** Extra positioning classes; defaults to the card's top-left corner. */
  className?: string;
};

/** Decorative bit of washi tape for the corner of a sticker card. Parent must be `relative`. */
export const TapeStrip = ({ tone = 'lime', className }: TapeStripProps) => (
  <span
    aria-hidden="true"
    className={cn(
      'pointer-events-none absolute -top-3 left-6 h-5 w-14 -rotate-6 rounded-sm',
      TONE_CLASS_NAME[tone],
      className,
    )}
  />
);
