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
  'inline-flex cursor-pointer appearance-none items-center justify-center gap-1.5 whitespace-nowrap rounded-full border-2 border-solid font-black leading-none no-underline transition select-none focus-ring-brand disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 aria-disabled:pointer-events-none aria-disabled:opacity-60';

const CTA_SIZES: Record<CtaSize, string> = {
  md: 'px-3 py-2 text-xs',
  lg: 'px-5 py-3.5 text-sm',
};

const CTA_VARIANTS: Record<CtaVariant, string> = {
  primary:
    'border-app-text bg-brand-lime text-brand-dark hover:bg-[#d4ff3d] motion-safe:hover:-translate-y-0.5',
  secondary:
    'border-app-text bg-app-elevated text-app-text hover:bg-app-surface motion-safe:hover:-translate-y-0.5 dark:bg-app-card dark:hover:bg-app-elevated',
  danger:
    'border-app-text bg-brand-pink text-brand-white hover:bg-[#ff4a9b] motion-safe:hover:-translate-y-0.5',
  dangerSoft:
    'border-brand-pink/60 bg-brand-pink/10 text-[#b41563] hover:border-brand-pink dark:text-[#ff8ac0]',
  ghost:
    'border-app-border-strong bg-transparent text-app-text hover:border-app-text dark:text-app-text',
};

/**
 * Class list for a CTA. Exported so apps can style their router's `Link`
 * component identically (see the apps' local `CTALink`).
 */
export const ctaClassName = (
  variant: CtaVariant = 'secondary',
  size: CtaSize = 'md',
  withShadow = true,
): string =>
  cn(CTA_BASE, withShadow && 'shadow-sticker-sm', CTA_SIZES[size], CTA_VARIANTS[variant]);
