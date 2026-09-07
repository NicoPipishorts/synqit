import { createElement, type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '../utils/cn';

type SurfaceCardProps = {
  children: ReactNode;
  className?: string;
  as?: 'article' | 'div' | 'section';
} & HTMLAttributes<HTMLElement>;

/** Sticker-style card surface used for dashboard panels, lists, and forms. */
export const SurfaceCard = ({ children, className, as = 'article', ...props }: SurfaceCardProps) =>
  createElement(
    as,
    {
      ...props,
      className: cn(
        'relative rounded-3xl border-2 border-app-text bg-app-elevated p-2 shadow-sticker sm:p-5 dark:bg-app-card',
        className,
      ),
    },
    children,
  );
