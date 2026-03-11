import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { lazy, Suspense, useEffect, useState } from 'react';

import { BackgroundBlurSpots } from './BackgroundBlurSpots';
import { useAuthSession } from '../../hooks/useAuthSession';
import { useI18n } from '../../hooks/useI18n';
import { trackPageView } from '../../lib/analytics';
import { THEME_CHANGED_EVENT } from '../../lib/constants';
import { applyTheme, loadTheme } from '../../lib/theme';
import { AccountMenu } from '../ui/AccountMenu';
import { BrandLogo } from '../ui/BrandLogo';

const PrivateDesktopNavigation = lazy(() =>
  import('./PrivateNavigation').then((module) => ({
    default: module.PrivateDesktopNavigation,
  })),
);
const PrivateMobileNavigation = lazy(() =>
  import('./PrivateNavigation').then((module) => ({
    default: module.PrivateMobileNavigation,
  })),
);

export const AppShell = () => {
  const [isNavBlurActive, setIsNavBlurActive] = useState(false);
  const { auth } = useAuthSession();
  const { t } = useI18n();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isPrivateRoute =
    !pathname.startsWith('/auth/') &&
    !pathname.startsWith('/playlist/') &&
    !pathname.startsWith('/event/');
  const navItems = [
    { to: '/dashboard', label: t('accountMenu.dashboard') },
    { to: '/playlists', label: t('accountMenu.myEvents') },
    { to: '/synced-lists', label: t('accountMenu.syncedLists') },
    { to: '/profile', label: t('accountMenu.profile') },
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
        {isNavBlurActive && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-app-bg/30 shadow-[0_4px_12px_-10px_rgba(0,0,0,0.22)] backdrop-blur-md"
          />
        )}
        <div className="relative z-10 flex w-full items-center justify-between px-4 pb-2 pt-4 sm:px-6 sm:pb-3 sm:pt-5 lg:px-8">
          <Link to="/" aria-label="Synqit home" className="inline-flex">
            <BrandLogo className="h-12 w-auto sm:h-24" />
          </Link>
          {auth && isPrivateRoute ? (
            <Suspense fallback={null}>
              <PrivateDesktopNavigation
                navItems={navItems}
                isNavItemActive={isNavItemActive}
                ariaLabel={t('accountMenu.privateNav')}
              />
            </Suspense>
          ) : null}
          <div className="flex items-center gap-2">
            <AccountMenu />
          </div>
        </div>
      </header>
      <BackgroundBlurSpots />
      {auth && isPrivateRoute ? (
        <Suspense fallback={null}>
          <PrivateMobileNavigation
            navItems={navItems}
            isNavItemActive={isNavItemActive}
            ariaLabel={t('accountMenu.privateNav')}
          />
        </Suspense>
      ) : null}
      <main
        className={`relative z-10 min-h-screen ${auth && isPrivateRoute ? 'pb-24 sm:pb-0' : ''}`}
      >
        <Outlet />
      </main>
    </div>
  );
};
