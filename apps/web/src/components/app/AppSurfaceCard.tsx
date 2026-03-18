import { createElement, type HTMLAttributes, type ReactNode } from 'react';

type AppSurfaceCardProps = {
  children: ReactNode;
  className?: string;
  as?: 'article' | 'div' | 'section';
} & HTMLAttributes<HTMLElement>;

export const AppSurfaceCard = ({
  children,
  className,
  as = 'article',
  ...props
}: AppSurfaceCardProps) =>
  createElement(
    as,
    {
      ...props,
      className:
        `rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card ${
          className ?? ''
        }`.trim(),
    },
    children,
  );
