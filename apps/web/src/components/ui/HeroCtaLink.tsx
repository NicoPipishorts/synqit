import { Link } from '@tanstack/react-router';
import { ReactNode } from 'react';

export type CtaVariant = 'lime' | 'outline' | 'pink';
export type HeroCtaSize = 'md' | 'sm';

const HERO_CTA_VARIANTS: Record<CtaVariant, string> = {
  lime: 'bg-brand-lime text-brand-dark shadow-soft-lift hover:bg-[#b2e600] dark:bg-[#aee000] dark:text-brand-dark dark:hover:bg-[#9fd100] dark:shadow-glow-lime',
  outline:
    'border border-app-border bg-app-elevated text-app-text shadow-soft-lift hover:border-brand-pink dark:border-app-border dark:text-brand-white dark:shadow-glow-pink',
  pink: 'bg-brand-pink text-brand-white shadow-soft-lift hover:bg-[#e0267c] dark:bg-brand-pink dark:text-brand-white dark:hover:bg-[#d12074] dark:shadow-glow-pink',
};

const HERO_CTA_SIZE_VARIANTS: Record<HeroCtaSize, string> = {
  md: 'rounded-xl px-5 py-3 text-sm',
  sm: 'rounded-lg px-3 py-2 text-sm',
};

type HeroCtaLinkProps = {
  to: string;
  variant: CtaVariant;
  size?: HeroCtaSize;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
};

export const HeroCtaLink = ({
  to,
  variant,
  size = 'md',
  onClick,
  className,
  children,
}: HeroCtaLinkProps) => (
  <Link
    to={to}
    onClick={onClick}
    className={`${HERO_CTA_SIZE_VARIANTS[size]} font-semibold transition ${HERO_CTA_VARIANTS[variant]} ${
      className ?? ''
    }`}
  >
    {children}
  </Link>
);
