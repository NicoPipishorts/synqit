import { cn } from '../utils/cn';

export type CtaVariant = 'primary' | 'secondary' | 'danger' | 'dangerSoft' | 'ghost';
export type CtaSize = 'md' | 'lg';

// CTA colour rules:
// - primary: main positive action on a screen (one per section when possible).
// - secondary: navigation or non-destructive alternatives.
// - danger: destructive action that needs strong emphasis.
// - dangerSoft: low-risk destructive/cleanup action.
// - ghost: subtle inline utility action.
const CTA_BASE =
  'inline-flex cursor-pointer appearance-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border-solid font-extrabold leading-none no-underline transition select-none focus-ring-brand disabled:cursor-not-allowed disabled:opacity-60';

const CTA_SIZES: Record<CtaSize, string> = {
  md: 'px-3 py-2 text-xs',
  lg: 'px-5 py-3.5 text-sm',
};

const CTA_VARIANTS: Record<CtaVariant, string> = {
  primary:
    'border border-[#9fce00] bg-brand-lime text-brand-dark hover:bg-[#b2e600] dark:border-[#8bb900] dark:bg-[#aee000] dark:text-brand-dark dark:hover:bg-[#9fd100]',
  secondary:
    'border border-app-border bg-app-surface text-app-text hover:border-brand-lime dark:border-app-border dark:bg-app-elevated dark:text-app-text',
  danger: 'border border-brand-pink bg-brand-pink text-brand-white hover:bg-[#d12074]',
  dangerSoft:
    'border border-brand-pink/60 bg-brand-pink/10 text-[#b41563] hover:border-brand-pink dark:text-[#ff8ac0]',
  ghost:
    'border border-app-border bg-transparent text-app-text hover:border-brand-pink dark:border-app-border dark:text-app-text',
};

/**
 * Class list for a CTA. Exported so apps can style their router's `Link`
 * component identically (see the apps' local `CTALink`).
 */
export const ctaClassName = (
  variant: CtaVariant = 'secondary',
  size: CtaSize = 'md',
  withShadow = true,
): string => cn(CTA_BASE, withShadow && 'shadow-soft-lift', CTA_SIZES[size], CTA_VARIANTS[variant]);
