import { type ReactNode } from 'react';

type SurfaceCardProps = {
  children: ReactNode;
  className?: string;
};

export const SurfaceCard = ({ children, className }: SurfaceCardProps) => (
  <article
    className={`group relative overflow-hidden rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift transition duration-300 ease-out motion-safe:hover:-translate-y-1 motion-safe:hover:border-brand-lime/30 motion-safe:hover:shadow-[0_18px_40px_-24px_rgba(34,34,34,0.35)] dark:bg-app-card ${
      className ?? ''
    }`.trim()}
  >
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,rgba(198,255,0,0),rgba(198,255,0,0.65),rgba(255,46,139,0.65),rgba(255,46,139,0))] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
    />
    {children}
  </article>
);
