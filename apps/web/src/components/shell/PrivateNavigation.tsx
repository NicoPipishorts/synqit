import { Link } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { ArrowLeftRight, CalendarDays, LayoutDashboard, ListMusic, UserRound } from 'lucide-react';
import { useState } from 'react';

type PrivateNavItem = {
  to: '/dashboard' | '/playlists' | '/synced-lists' | '/transfer' | '/profile';
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
  '/transfer': ArrowLeftRight,
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
        className="flex items-center gap-1 rounded-full border-2 border-app-text bg-app-elevated px-2 py-1.5 shadow-sticker dark:bg-app-card"
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
                  className="absolute inset-0 z-0 rounded-full bg-app-surface dark:bg-app-elevated"
                />
              ) : null}
              {isActive ? (
                <motion.span
                  layoutId="desktop-nav-active-indicator"
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
        className="pointer-events-auto relative flex items-center gap-1 rounded-full border-2 border-app-text bg-app-elevated px-2 py-1.5 shadow-sticker dark:bg-app-card"
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
                  className="absolute inset-0 rounded-full border-2 border-app-text bg-brand-lime shadow-sticker-sm"
                />
              ) : null}
              <span className={`relative z-10 ${isActive ? 'text-brand-dark' : 'text-app-text'}`}>
                <Icon size={18} aria-hidden="true" />
              </span>
              <span className="sr-only">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
