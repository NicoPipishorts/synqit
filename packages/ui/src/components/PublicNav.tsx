import { motion } from 'framer-motion';
import { type ReactNode, useState } from 'react';

import { NAV_BAR_CLASS, NAV_ITEM_CLASS } from './nav-classes';

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
 * Pill navbar with a sliding hover indicator and a sliding active indicator.
 * Driven entirely by `items`, so it renders marketing, auth, and app navs alike.
 * Uses plain anchors: pass full URLs for cross-app links.
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
      <div onMouseLeave={() => setHoveredId(null)} className={NAV_BAR_CLASS}>
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
              className={NAV_ITEM_CLASS}
            >
              {isHovered ? (
                <motion.span
                  layoutId={`${layoutGroupId}-hover`}
                  transition={{ type: 'spring', stiffness: 430, damping: 35, mass: 0.85 }}
                  className="absolute inset-0 z-0 rounded-full bg-app-surface dark:bg-app-elevated"
                />
              ) : null}
              {isActive ? (
                <motion.span
                  layoutId={`${layoutGroupId}-active`}
                  transition={{ type: 'spring', stiffness: 430, damping: 35, mass: 0.85 }}
                  className="absolute inset-0 z-[1] rounded-full border-2 border-app-text bg-brand-lime shadow-sticker-sm"
                />
              ) : null}
              <span
                className={`relative z-10 ${
                  isActive ? 'text-brand-dark' : 'text-app-text-secondary hover:text-app-text'
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
