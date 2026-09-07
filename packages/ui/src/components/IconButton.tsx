import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '../utils/cn';

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  withShadow?: boolean;
};

const ICON_BUTTON_SIZES = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
} as const;

/** Round icon-only button. Always pass `aria-label`. */
export const IconButton = ({
  icon,
  size = 'sm',
  withShadow = true,
  className,
  ...props
}: IconButtonProps) => (
  <button
    type={props.type ?? 'button'}
    className={cn(
      'inline-flex cursor-pointer items-center justify-center rounded-full border-2 border-app-text bg-app-surface text-app-text transition hover:bg-brand-lime hover:text-brand-dark motion-safe:hover:-translate-y-0.5 focus-ring-brand dark:bg-app-elevated',
      ICON_BUTTON_SIZES[size],
      withShadow && 'shadow-sticker-sm',
      className,
    )}
    {...props}
  >
    {icon}
  </button>
);
