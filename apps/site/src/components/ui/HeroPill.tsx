import { ReactNode } from 'react';

export type PillVariant = 'lime' | 'pink';

const HERO_PILL_VARIANTS: Record<PillVariant, string> = {
  lime: 'border-brand-lime bg-brand-lime/20 text-[#7aa300] dark:text-[#7aa300] shadow-soft-lift dark:shadow-glow-lime',
  pink: 'border-brand-pink bg-brand-pink/15 text-[#b41563] dark:text-[#ff63ac] shadow-soft-lift dark:shadow-glow-pink',
};

type HeroPillProps = {
  variant: PillVariant;
  children: ReactNode;
};

export const HeroPill = ({ variant, children }: HeroPillProps) => (
  <span
    className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${HERO_PILL_VARIANTS[variant]}`}
  >
    {children}
  </span>
);
