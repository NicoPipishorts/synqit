import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { CalendarDays, LayoutDashboard, ListMusic, Shield, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';

import { BackgroundBlurSpots } from './BackgroundBlurSpots';
import { useAuthSession } from '../../hooks/useAuthSession';
import { useI18n } from '../../hooks/useI18n';
import { trackPageView } from '../../lib/analytics';
import { THEME_CHANGED_EVENT } from '../../lib/constants';
import { applyTheme, loadTheme } from '../../lib/theme';
import { AccountMenu } from '../ui/AccountMenu';
import { BrandLogo } from '../ui/BrandLogo';

export const AppShell = () => {
  const [isNavBlurActive, setIsNavBlurActive] = useState(false);
  const [hoveredNavPath, setHoveredNavPath] = useState<string | null>(null);
  const { auth } = useAuthSession();
  const { t } = useI18n();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isPrivateRoute =
    !pathname.startsWith('/auth/') &&
    pathname !== '/' &&
    !pathname.startsWith('/playlist/') &&
    !pathname.startsWith('/event/');
  const navItems = [
    { to: '/dashboard', label: t('accountMenu.dashboard'), icon: LayoutDashboard },
    { to: '/playlists', label: t('accountMenu.myEvents'), icon: CalendarDays },
    { to: '/synced-lists', label: t('accountMenu.syncedLists'), icon: ListMusic },
    { to: '/profile', label: t('accountMenu.profile'), icon: UserRound },
    ...(auth?.role === 'admin'
      ? [{ to: '/admin', label: t('accountMenu.admin'), icon: Shield }]
      : []),
  ] as const;
  const isNavItemActive = (to: string): boolean => {
    if (to === '/playlists') {
      return pathname.startsWith('/playlists');
    }
    if (to === '/synced-lists') {
      return pathname.startsWith('/synced-lists');
    }
    if (to === '/profile') {
      return pathname.startsWith('/profile');
    }
    return pathname === to || pathname.startsWith(`${to}/`);
  };
  useEffect(() => {
    const syncTheme = () => {
      applyTheme(loadTheme());
    };

    syncTheme();
    window.addEventListener(THEME_CHANGED_EVENT, syncTheme);
    window.addEventListener('storage', syncTheme);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemThemeChanged = () => {
      if (loadTheme() === 'auto') {
        syncTheme();
      }
    };

    mediaQuery.addEventListener('change', onSystemThemeChanged);
    return () => {
      window.removeEventListener(THEME_CHANGED_EVENT, syncTheme);
      window.removeEventListener('storage', syncTheme);
      mediaQuery.removeEventListener('change', onSystemThemeChanged);
    };
  }, []);

  useEffect(() => {
    const updateScrollState = () => {
      setIsNavBlurActive(window.scrollY > 8);
    };

    updateScrollState();
    window.addEventListener('scroll', updateScrollState, { passive: true });
    return () => window.removeEventListener('scroll', updateScrollState);
  }, []);

  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-app-bg text-app-text transition-colors">
      <header className="fixed inset-x-0 top-0 z-50">
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 bg-app-bg/30 backdrop-blur-md transition-opacity duration-300 ease-out ${
            isNavBlurActive
              ? 'opacity-100 shadow-[0_4px_12px_-10px_rgba(0,0,0,0.22)]'
              : 'opacity-0 shadow-none'
          }`}
        />
        <div className="relative z-10 flex w-full items-center justify-between px-4 pb-2 pt-4 sm:px-6 sm:pb-3 sm:pt-5 lg:px-8">
          <Link to="/" aria-label="Synqit home" className="inline-flex">
            <BrandLogo className="h-12 w-auto sm:h-24" />
          </Link>
          {auth && isPrivateRoute ? (
            <nav
              className="hidden items-center gap-2 sm:flex"
              aria-label={t('accountMenu.privateNav')}
            >
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
                      className="relative inline-flex h-10 items-center rounded-full px-4 text-sm font-black tracking-[0.01em] transition focus-ring-brand"
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
          ) : null}
          <div className="flex items-center gap-2">
            <AccountMenu />
          </div>
        </div>
      </header>
      <BackgroundBlurSpots />
      {auth && isPrivateRoute ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center sm:hidden">
          <nav
            className="pointer-events-auto relative flex items-center gap-1 rounded-full border border-app-border/70 bg-app-elevated/90 px-2 py-1.5 shadow-soft-lift backdrop-blur-md"
            aria-label={t('accountMenu.privateNav')}
          >
            {navItems.map((item) => {
              const isActive = isNavItemActive(item.to);
              const Icon = item.icon;
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
      ) : null}
      <main
        className={`relative z-10 min-h-screen ${auth && isPrivateRoute ? 'pb-24 sm:pb-0' : ''}`}
      >
        <Outlet />
      </main>
    </div>
  );
};
