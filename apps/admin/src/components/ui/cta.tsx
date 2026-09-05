import { ctaClassName, type CtaVariant } from '@synqit/ui';
import { Link } from '@tanstack/react-router';
import type { ComponentPropsWithoutRef } from 'react';

// Framework-agnostic CTA primitives live in @synqit/ui. This module adds the
// router-bound `CTALink` so pages keep importing everything from './cta'.
export { CTAButton, CTAMobileIconLabel, ctaClassName, type CtaVariant } from '@synqit/ui';

type CTALinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, 'className'> & {
  variant?: CtaVariant;
  className?: string;
  disabled?: boolean;
  withShadow?: boolean;
};

export const CTALink = ({
  variant = 'secondary',
  className,
  disabled = false,
  withShadow = true,
  ...props
}: CTALinkProps) => {
  const classNames =
    `${ctaClassName(variant, 'md', withShadow)} ${disabled ? 'pointer-events-none opacity-60' : ''} ${className ?? ''}`.trim();

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
