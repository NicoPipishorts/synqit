import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

import { ctaClassName, type CtaSize, type CtaVariant } from './cta-classes';
import { cn } from '../utils/cn';

export { ctaClassName, type CtaSize, type CtaVariant } from './cta-classes';
export type { CtaSize as CTASize } from './cta-classes';

export type CTAButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: CtaVariant;
  size?: CtaSize;
  withShadow?: boolean;
};

export const CTAButton = ({
  variant = 'secondary',
  size = 'md',
  withShadow = true,
  className,
  ...props
}: CTAButtonProps) => (
  <button
    type={props.type ?? 'button'}
    className={cn(ctaClassName(variant, size, withShadow), className)}
    {...props}
  />
);

export type CTAAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: CtaVariant;
  size?: CtaSize;
  withShadow?: boolean;
  disabled?: boolean;
};

/** Plain-anchor CTA for cross-origin links and apps without a router. */
export const CTAAnchor = ({
  variant = 'secondary',
  size = 'md',
  withShadow = true,
  disabled = false,
  className,
  onClick,
  tabIndex,
  ...props
}: CTAAnchorProps) => (
  <a
    {...props}
    className={cn(
      ctaClassName(variant, size, withShadow),
      disabled && 'pointer-events-none opacity-60',
      className,
    )}
    aria-disabled={disabled || undefined}
    tabIndex={disabled ? -1 : tabIndex}
    onClick={(event) => {
      if (disabled) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      onClick?.(event);
    }}
  />
);

type CTAMobileIconLabelProps = {
  icon: ReactNode;
  label: string;
};

/** Icon on small screens, text label from `sm` up; the label stays readable to screen readers. */
export const CTAMobileIconLabel = ({ icon, label }: CTAMobileIconLabelProps) => (
  <>
    <span className="sm:hidden" aria-hidden="true">
      {icon}
    </span>
    <span className="sr-only sm:not-sr-only sm:inline">{label}</span>
  </>
);
