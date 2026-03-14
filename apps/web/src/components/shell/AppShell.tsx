import { Link, Outlet, useMatchRoute, useRouterState } from '@tanstack/react-router';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';

import { BackgroundBlurSpots } from './BackgroundBlurSpots';
import { useAuthSession } from '../../hooks/useAuthSession';
import { useI18n } from '../../hooks/useI18n';
import { trackPageView } from '../../lib/analytics';
import { THEME_CHANGED_EVENT } from '../../lib/constants';
import { saveAnonymousPreferences } from '../../lib/preferences';
import { fetchUserPreferences } from '../../lib/queries';
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

const FOREGROUND_REFETCH_COOLDOWN_MS = 60_000;

export const AppShell = () => {
  const [isNavBlurActive, setIsNavBlurActive] = useState(false);
  const { auth } = useAuthSession();
  const { t, setLocale } = useI18n();
  const matchRoute = useMatchRoute();
  const lastSyncedUserIdRef = useRef<string | null>(null);
  const lastHiddenAtRef = useRef<number | null>(null);
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
    return Boolean(matchRoute({ to, fuzzy: true }));
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

  const syncPreferencesRef = useRef<() => void>(() => undefined);
  syncPreferencesRef.current = () => {
    if (!auth) return;
    void fetchUserPreferences()
      .then((prefs) => {
        if (prefs.theme) {
          saveAnonymousPreferences({ theme: prefs.theme });
          applyTheme(prefs.theme);
        }
        if (prefs.locale) {
          setLocale(prefs.locale);
        }
      })
      .catch(() => undefined);
  };

  // Apply DB-stored preferences when auth session starts (login or page reload while logged in).
  // Only runs once per user session to avoid overriding manual changes mid-session.
  useEffect(() => {
    if (!auth || lastSyncedUserIdRef.current === auth.userId) {
      return;
    }
    lastSyncedUserIdRef.current = auth.userId;
    syncPreferencesRef.current();
  }, [auth]);

  // Re-sync when the PWA returns to the foreground (iOS has no pull-to-refresh in standalone mode).
  // Only refetches if the app was hidden for more than 60 seconds to avoid noise on quick switches.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenAtRef.current = Date.now();
        return;
      }
      const hiddenDurationMs = lastHiddenAtRef.current
        ? Date.now() - lastHiddenAtRef.current
        : Infinity;
      if (hiddenDurationMs >= FOREGROUND_REFETCH_COOLDOWN_MS) {
        syncPreferencesRef.current();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);

  return (
    <div className="relative min-h-screen overflow-x-clip text-app-text transition-colors">
      <header className="fixed inset-x-0 top-0 z-50">
        {isNavBlurActive && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-app-bg/30 shadow-[0_4px_12px_-10px_rgba(0,0,0,0.22)] backdrop-blur-md"
          />
        )}
        <div className="relative z-10 grid w-full grid-cols-[1fr_auto_1fr] items-center px-4 pb-2 pt-4 sm:px-6 sm:pb-3 sm:pt-5 lg:px-8">
          <div className="flex items-center">
            {isPrivateRoute ? (
              <Link to="/" aria-label="Synqit home" className="inline-flex">
                <BrandLogo className="h-12 w-auto sm:h-24" />
              </Link>
            ) : (
              <a
                href={import.meta.env.VITE_SITE_URL ?? '/'}
                aria-label="Synqit home"
                className="inline-flex"
              >
                <BrandLogo className="h-12 w-auto sm:h-24" />
              </a>
            )}
          </div>
          <div className="flex justify-center">
            {auth && isPrivateRoute ? (
              <Suspense fallback={null}>
                <PrivateDesktopNavigation
                  navItems={navItems}
                  isNavItemActive={isNavItemActive}
                  ariaLabel={t('accountMenu.privateNav')}
                />
              </Suspense>
            ) : null}
          </div>
          <div className="flex items-center justify-end gap-2">
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
      <main className={`relative min-h-screen }`}>
        <Outlet />
      </main>
    </div>
  );
};
