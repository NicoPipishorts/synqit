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
      'inline-flex cursor-pointer items-center justify-center rounded-full border border-app-border bg-app-surface text-app-text transition hover:border-brand-lime focus-ring-brand dark:bg-app-elevated',
      ICON_BUTTON_SIZES[size],
      withShadow &&
        'shadow-[0_10px_24px_-14px_rgba(34,34,34,0.34),0_4px_10px_-6px_rgba(34,34,34,0.22)]',
      className,
    )}
    {...props}
  >
    {icon}
  </button>
);
