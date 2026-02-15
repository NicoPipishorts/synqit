import { ReactNode } from 'react';

import { CtaVariant, CTALink } from './cta';

export type HeroCtaVariant = 'lime' | 'outline' | 'pink';
export type HeroCtaSize = 'md' | 'sm';

const HERO_TO_CTA_VARIANT: Record<HeroCtaVariant, CtaVariant> = {
  lime: 'primary',
  outline: 'secondary',
  pink: 'danger',
};

type HeroCtaLinkProps = {
  to: string;
  variant: HeroCtaVariant;
  size?: HeroCtaSize;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
};

export const HeroCtaLink = ({
  to,
  variant,
  size: _size = 'md',
  onClick,
  className,
  children,
}: HeroCtaLinkProps) => {
  return (
    <CTALink to={to} onClick={onClick} variant={HERO_TO_CTA_VARIANT[variant]} className={className}>
      {children}
    </CTALink>
  );
};
