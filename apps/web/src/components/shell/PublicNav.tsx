import { motion } from 'framer-motion';
import { type ReactNode, useState } from 'react';

export type PublicNavItem = {
  id: string;
  href: string;
  label: ReactNode;
};

type PublicNavProps = {
  items: readonly PublicNavItem[];
  activeId: string | null;
  onActivate?: (id: string) => void;
  ariaLabel?: string;
  className?: string;
  /** Unique per rendered instance so the sliding indicators don't collide. */
  layoutGroupId?: string;
};

/**
 * Pill navbar with a sliding hover indicator and a sliding active indicator,
 * matching the logged-in app navigation. Driven entirely by `items` so the same
 * component renders the marketing nav and the auth nav with different CTAs.
 */
export const PublicNav = ({
  items,
  activeId,
  onActivate,
  ariaLabel,
  className,
  layoutGroupId = 'public-nav',
}: PublicNavProps) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <nav aria-label={ariaLabel} className={className}>
      <div
        onMouseLeave={() => setHoveredId(null)}
        className="flex items-center gap-1.5 rounded-full border border-app-border/70 bg-app-elevated/85 px-2 py-1.5 shadow-soft-lift backdrop-blur-md dark:bg-app-card/85"
      >
        {items.map((item) => {
          const isActive = activeId === item.id;
          const isHovered = hoveredId === item.id;
          return (
            <a
              key={item.id}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              onMouseEnter={() => setHoveredId(item.id)}
              onPointerDown={() => onActivate?.(item.id)}
              className="relative inline-flex h-10 items-center rounded-full px-3 text-sm font-black tracking-[0.01em] transition focus-ring-brand lg:px-4"
            >
              {isHovered ? (
                <motion.span
                  layoutId={`${layoutGroupId}-hover`}
                  transition={{ type: 'spring', stiffness: 430, damping: 35, mass: 0.85 }}
                  className="absolute inset-0 z-0 rounded-full bg-app-surface dark:bg-app-card"
                />
              ) : null}
              {isActive ? (
                <motion.span
                  layoutId={`${layoutGroupId}-active`}
                  transition={{ type: 'spring', stiffness: 430, damping: 35, mass: 0.85 }}
                  className="absolute inset-0 z-[1] rounded-full bg-brand-dark dark:bg-brand-white"
                />
              ) : null}
              <span
                className={`relative z-10 ${
                  isActive
                    ? 'text-brand-white dark:text-brand-dark'
                    : 'text-app-text-secondary hover:text-app-text'
                }`}
              >
                {item.label}
              </span>
            </a>
          );
        })}
      </div>
    </nav>
  );
};
