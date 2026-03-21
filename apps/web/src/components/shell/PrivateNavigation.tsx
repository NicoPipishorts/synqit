import { Link } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { CalendarDays, LayoutDashboard, ListMusic, UserRound } from 'lucide-react';
import { useState } from 'react';

type PrivateNavItem = {
  to: '/dashboard' | '/playlists' | '/synced-lists' | '/profile';
  label: string;
};

type PrivateNavigationProps = {
  navItems: readonly PrivateNavItem[];
  isNavItemActive: (to: string) => boolean;
  ariaLabel: string;
};

const navIconByPath = {
  '/dashboard': LayoutDashboard,
  '/playlists': CalendarDays,
  '/synced-lists': ListMusic,
  '/profile': UserRound,
} as const;

export const PrivateDesktopNavigation = ({
  navItems,
  isNavItemActive,
  ariaLabel,
}: PrivateNavigationProps) => {
  const [hoveredNavPath, setHoveredNavPath] = useState<string | null>(null);

  return (
    <nav className="hidden items-center gap-2 sm:flex" aria-label={ariaLabel}>
      <div
        onMouseLeave={() => setHoveredNavPath(null)}
        className="flex items-center gap-1.5 rounded-full border border-app-border/70 bg-app-elevated/85 px-2 py-1.5 shadow-soft-lift backdrop-blur-md"
      >
        {navItems.map((item) => {
          const isActive = isNavItemActive(item.to);
          const isHovered = hoveredNavPath === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              onMouseEnter={() => setHoveredNavPath(item.to)}
              className="relative inline-flex h-10 items-center rounded-full px-2.5 text-sm font-black tracking-[0.01em] transition focus-ring-brand sm:px-3 lg:px-4"
            >
              {isHovered ? (
                <motion.span
                  layoutId="desktop-nav-hover-indicator"
                  transition={{ type: 'spring', stiffness: 430, damping: 35, mass: 0.85 }}
                  className="absolute inset-0 z-0 rounded-full bg-app-surface dark:bg-app-card"
                />
              ) : null}
              {isActive ? (
                <motion.span
                  layoutId="desktop-nav-active-indicator"
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
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export const PrivateMobileNavigation = ({
  navItems,
  isNavItemActive,
  ariaLabel,
}: PrivateNavigationProps) => {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center sm:hidden">
      <nav
        className="pointer-events-auto relative flex items-center gap-1 rounded-full border border-app-border/70 bg-app-elevated/90 px-2 py-1.5 shadow-soft-lift backdrop-blur-md"
        aria-label={ariaLabel}
      >
        {navItems.map((item) => {
          const isActive = isNavItemActive(item.to);
          const Icon = navIconByPath[item.to];
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-label={item.label}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-full px-0 transition focus-ring-brand"
            >
              {isActive ? (
                <motion.span
                  layoutId="mobile-nav-pill-indicator"
                  transition={{ type: 'spring', stiffness: 430, damping: 35, mass: 0.85 }}
                  className="absolute inset-0 rounded-full bg-brand-dark dark:bg-brand-white"
                />
              ) : null}
              <span
                className={`relative z-10 ${
                  isActive ? 'text-brand-white dark:text-brand-dark' : 'text-app-text-secondary'
                }`}
              >
                <Icon size={16} aria-hidden="true" />
              </span>
              <span className="sr-only">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
