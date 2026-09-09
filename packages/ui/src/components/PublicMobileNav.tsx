import { motion } from 'framer-motion';
import { useRef, type ReactNode } from 'react';

import { useFloatingBar } from '../hooks/useFloatingBar';

export type PublicMobileNavItem = {
  id: string;
  href: string;
  label: string;
  /** Rendered icon, e.g. `<Home size={18} aria-hidden="true" />`. */
  icon: ReactNode;
};

type PublicMobileNavProps = {
  items: readonly PublicMobileNavItem[];
  activeId: string | null;
  onActivate?: (id: string) => void;
  ariaLabel?: string;
  layoutGroupId?: string;
};

/** Floating bottom icon bar for small screens: sticker-style frame with a sliding lime active pill. */
export const PublicMobileNav = ({
  items,
  activeId,
  onActivate,
  ariaLabel,
  layoutGroupId = 'public-mobile-nav',
}: PublicMobileNavProps) => {
  const navRef = useRef<HTMLElement | null>(null);
  useFloatingBar(navRef);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center md:hidden">
      <nav
        ref={navRef}
        className="pointer-events-auto relative flex items-center gap-1 rounded-full border-2 border-app-text bg-app-elevated px-2 py-1.5 shadow-sticker dark:bg-app-card"
        aria-label={ariaLabel}
      >
        {items.map((item) => {
          const isActive = activeId === item.id;
          return (
            <a
              key={item.id}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              onPointerDown={() => onActivate?.(item.id)}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-full transition focus-ring-brand"
            >
              {isActive ? (
                <motion.span
                  layoutId={`${layoutGroupId}-pill`}
                  transition={{ type: 'spring', stiffness: 430, damping: 35, mass: 0.85 }}
                  className="absolute inset-0 rounded-full border-2 border-app-text bg-brand-lime shadow-sticker-sm"
                />
              ) : null}
              <span className={`relative z-10 ${isActive ? 'text-brand-dark' : 'text-app-text'}`}>
                {item.icon}
              </span>
              <span className="sr-only">{item.label}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
};
