import { ReactNode } from 'react';

type HeroLinkVariant = 'lime' | 'outline' | 'pink';
type HeroLinkSize = 'md' | 'sm' | 'hero';

const VARIANT_CLASS_NAME: Record<HeroLinkVariant, string> = {
  lime: 'border-brand-lime bg-brand-lime text-brand-dark hover:brightness-[0.98] dark:hover:brightness-[1.04]',
  outline:
    'border-app-border bg-app-elevated text-app-text hover:border-brand-pink dark:bg-app-card',
  pink: 'border-brand-pink bg-brand-pink text-brand-white hover:brightness-[1.03]',
};

const SIZE_CLASS_NAME: Record<HeroLinkSize, string> = {
  md: 'min-h-11 px-5 py-3 text-sm sm:text-base',
  sm: 'min-h-10 px-4 py-2.5 text-sm',
  /**
   * `md`, but tight enough on a phone to share its row with the secondary link.
   * French runs about a quarter longer than English — "Commencer gratuitement"
   * against "Get started free" — and at `md` the pair needs 421px of a 335px row,
   * so it wrapped. Back to `md` from `sm:` up, where there is room.
   */
  hero: 'min-h-10 px-2.5 py-2.5 text-[13px] sm:min-h-11 sm:px-5 sm:py-3 sm:text-base',
};

type HeroLinkProps = {
  href: string;
  variant: HeroLinkVariant;
  size?: HeroLinkSize;
  className?: string;
  children: ReactNode;
};

export const HeroLink = ({ href, variant, size = 'md', className, children }: HeroLinkProps) => {
  return (
    <a
      href={href}
      className={`focus-ring-brand inline-flex items-center justify-center rounded-full border font-black tracking-[0.01em] transition ${VARIANT_CLASS_NAME[variant]} ${SIZE_CLASS_NAME[size]} ${className ?? ''}`.trim()}
    >
      {children}
    </a>
  );
};
