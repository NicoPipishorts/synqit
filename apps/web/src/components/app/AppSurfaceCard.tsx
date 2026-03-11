import { createElement, type ReactNode } from 'react';

type AppSurfaceCardProps = {
  children: ReactNode;
  className?: string;
  as?: 'article' | 'div' | 'section';
};

export const AppSurfaceCard = ({ children, className, as = 'article' }: AppSurfaceCardProps) =>
  createElement(
    as,
    {
      className:
        `rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card ${
          className ?? ''
        }`.trim(),
    },
    children,
  );
