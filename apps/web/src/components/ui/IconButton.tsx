import { type ButtonHTMLAttributes, type ReactNode } from 'react';

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  withShadow?: boolean;
};

const ICON_BUTTON_SIZES = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
} as const;

export const IconButton = ({
  icon,
  size = 'sm',
  withShadow = true,
  className,
  ...props
}: IconButtonProps) => {
  return (
    <button
      type={props.type ?? 'button'}
      className={`inline-flex ${ICON_BUTTON_SIZES[size]} cursor-pointer items-center justify-center rounded-full border border-app-border bg-app-surface text-app-text ${
        withShadow
          ? 'shadow-[0_10px_24px_-14px_rgba(34,34,34,0.34),0_4px_10px_-6px_rgba(34,34,34,0.22)]'
          : ''
      } transition hover:border-brand-lime focus-ring-brand dark:bg-app-elevated ${className ?? ''}`.trim()}
      {...props}
    >
      {icon}
    </button>
  );
};
