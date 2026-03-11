import { Link } from '@tanstack/react-router';
import { ButtonHTMLAttributes, ComponentPropsWithoutRef, ReactNode } from 'react';

export type CtaVariant = 'primary' | 'secondary' | 'danger' | 'dangerSoft' | 'ghost';

// CTA color rules:
// - primary: main positive action on a screen (one per section when possible).
// - secondary: navigation or non-destructive alternatives.
// - danger: destructive action that needs strong emphasis.
// - dangerSoft: low-risk destructive/cleanup action.
// - ghost: subtle inline utility action.
const CTA_BASE =
  'inline-flex cursor-pointer appearance-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border-solid font-extrabold leading-none no-underline shadow-soft-lift transition select-none focus-ring-brand disabled:cursor-not-allowed disabled:opacity-60';

const CTA_SIZES = {
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

const ctaClassName = (variant: CtaVariant = 'secondary', size: 'md' | 'lg' = 'md'): string => {
  return `${CTA_BASE} ${CTA_SIZES[size]} ${CTA_VARIANTS[variant]}`;
};

type CTAButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: CtaVariant;
  size?: 'md' | 'lg';
};

export const CTAButton = ({
  variant = 'secondary',
  size = 'md',
  className,
  ...props
}: CTAButtonProps) => {
  return (
    <button
      type={props.type ?? 'button'}
      className={`${ctaClassName(variant, size)} ${className ?? ''}`.trim()}
      {...props}
    />
  );
};

type CTALinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, 'className'> & {
  variant?: CtaVariant;
  size?: 'md' | 'lg';
  className?: string;
  disabled?: boolean;
};

export const CTALink = ({
  variant = 'secondary',
  size = 'md',
  className,
  disabled = false,
  ...props
}: CTALinkProps) => {
  const classNames =
    `${ctaClassName(variant, size)} ${disabled ? 'pointer-events-none opacity-60' : ''} ${className ?? ''}`.trim();

  return (
    <Link
      {...props}
      className={classNames}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : props.tabIndex}
      onClick={(event) => {
        if (disabled) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        props.onClick?.(event);
      }}
    />
  );
};

type CTAMobileIconLabelProps = {
  icon: ReactNode;
  label: string;
};

export const CTAMobileIconLabel = ({ icon, label }: CTAMobileIconLabelProps) => {
  return (
    <>
      <span className="sm:hidden" aria-hidden="true">
        {icon}
      </span>
      <span className="sr-only sm:not-sr-only sm:inline">{label}</span>
    </>
  );
};
