import { type LucideIcon } from 'lucide-react';

type CardWatermarkProps = {
  icon: LucideIcon;
  tone: 'lime' | 'pink';
};

/**
 * Oversized, faded copy of a card's icon, sitting behind the content: 115% of
 * the card height, anchored right and bleeding ~10% off the right edge (clipped
 * by the card's `overflow-hidden`). Purely decorative — host card must be
 * `relative overflow-hidden`, with content layered above via `relative z-10`.
 */
export const CardWatermark = ({ icon: Icon, tone }: CardWatermarkProps) => (
  <Icon
    aria-hidden="true"
    strokeWidth={1.25}
    className={`pointer-events-none absolute right-0 top-1/2 h-[115%] w-auto translate-x-[10%] -translate-y-1/2 ${
      tone === 'lime' ? 'text-brand-lime/5' : 'text-brand-pink/[0.03]'
    }`}
  />
);
