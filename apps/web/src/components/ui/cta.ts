export type CtaVariant = 'primary' | 'secondary' | 'danger' | 'dangerSoft' | 'ghost';

// CTA color rules:
// - primary: main positive action on a screen (one per section when possible).
// - secondary: navigation or non-destructive alternatives.
// - danger: destructive action that needs strong emphasis.
// - dangerSoft: low-risk destructive/cleanup action.
// - ghost: subtle inline utility action.
const CTA_BASE =
  'inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-bold shadow-soft-lift transition focus-ring-brand disabled:cursor-not-allowed disabled:opacity-60';

const CTA_VARIANTS: Record<CtaVariant, string> = {
  primary:
    'border border-[#9fce00] bg-brand-lime text-brand-dark shadow-soft-lift hover:bg-[#b2e600] dark:border-[#8bb900] dark:bg-[#aee000] dark:text-brand-dark dark:hover:bg-[#9fd100] dark:shadow-glow-lime',
  secondary:
    'border border-app-border bg-app-surface text-app-text hover:border-brand-lime dark:border-app-border dark:bg-app-elevated dark:text-app-text',
  danger:
    'border border-brand-pink bg-brand-pink text-brand-white shadow-soft-lift hover:bg-[#d12074] dark:shadow-glow-pink',
  dangerSoft:
    'border border-brand-pink/50 bg-brand-pink/10 text-[#b41563] hover:border-brand-pink dark:text-[#ff8ac0] dark:shadow-glow-pink',
  ghost:
    'border border-app-border bg-transparent text-app-text hover:border-brand-pink dark:border-app-border dark:text-app-text',
};

export const ctaClassName = (variant: CtaVariant = 'secondary'): string => {
  return `${CTA_BASE} ${CTA_VARIANTS[variant]}`;
};
