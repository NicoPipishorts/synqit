import { createElement, type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '../utils/cn';

type SurfaceCardProps = {
  children: ReactNode;
  className?: string;
  as?: 'article' | 'div' | 'section';
} & HTMLAttributes<HTMLElement>;

/** Elevated card surface used for dashboard panels, lists, and forms. */
export const SurfaceCard = ({ children, className, as = 'article', ...props }: SurfaceCardProps) =>
  createElement(
    as,
    {
      ...props,
      className: cn(
        'rounded-2xl border border-app-border bg-app-elevated p-2 sm:p-5 shadow-soft-lift dark:bg-app-card',
        className,
      ),
    },
    children,
  );
