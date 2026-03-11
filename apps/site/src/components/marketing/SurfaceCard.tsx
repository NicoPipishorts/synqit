import { type ReactNode } from 'react';

type SurfaceCardProps = {
  children: ReactNode;
  className?: string;
};

export const SurfaceCard = ({ children, className }: SurfaceCardProps) => (
  <article
    className={`rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card ${
      className ?? ''
    }`.trim()}
  >
    {children}
  </article>
);
