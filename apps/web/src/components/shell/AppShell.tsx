import { Link, Outlet, useMatchRoute, useRouterState } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
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

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const getSiteOrigin = (): string => {
  const configured = import.meta.env.VITE_SITE_URL?.trim();
  if (configured) {
    return trimTrailingSlash(configured);
  }

  if (typeof window === 'undefined') {
    return 'http://127.0.0.1:4173';
  }

  const { protocol, hostname } = window.location;
  if (hostname === '127.0.0.1' || hostname === 'localhost') {
    return `${protocol}//${hostname === 'localhost' ? 'localhost' : '127.0.0.1'}:4173`;
  }

  return `${protocol}//${hostname.replace(/^app\./, '')}`;
};

type PublicNavItemId = 'product' | 'pricing' | 'share';

const PublicAuthNavigation = ({
  activeItem,
  labels,
}: {
  activeItem: PublicNavItemId | null;
  labels: { product: string; pricing: string; share: string };
}) => {
  const [selectedItem, setSelectedItem] = useState<PublicNavItemId | null>(activeItem);
  const siteOrigin = getSiteOrigin();
  const navItems = [
    { id: 'product', href: `${siteOrigin}/`, label: labels.product },
    { id: 'pricing', href: `${siteOrigin}/pricing`, label: labels.pricing },
    { id: 'share', href: '/auth/register', label: labels.share },
  ] as const;

  useEffect(() => {
    setSelectedItem(activeItem);
  }, [activeItem]);

  return (
    <nav className="relative flex min-w-0 items-center gap-1.5 overflow-hidden rounded-full border border-app-border bg-app-elevated/85 p-1.5 shadow-soft-lift backdrop-blur dark:bg-app-card/85">
      {navItems.map((item) => {
        const active = selectedItem === item.id;
        return (
          <span key={item.id} className="relative inline-flex">
            {active ? (
              <motion.span
                layoutId="public-auth-nav-pill"
                className="absolute inset-0 rounded-full bg-brand-lime"
                transition={{ type: 'spring', stiffness: 520, damping: 42 }}
              />
            ) : null}
            <a
              href={item.href}
              aria-current={active ? 'page' : undefined}
              onPointerDown={() => setSelectedItem(item.id)}
              className={`relative z-10 inline-flex min-h-[45px] items-center justify-center rounded-full px-5 py-2.5 text-[15px] font-black transition-colors ${
                active ? 'text-brand-dark' : 'text-app-text-muted hover:text-app-text'
              }`}
            >
              {item.label}
            </a>
          </span>
        );
      })}
    </nav>
  );
};

const PublicAuthMobileMenu = ({
  activeItem,
  labels,
}: {
  activeItem: PublicNavItemId | null;
  labels: { product: string; pricing: string; share: string; login: string };
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PublicNavItemId | null>(activeItem);
  const siteOrigin = getSiteOrigin();
  const navItems = [
    { id: 'product', href: `${siteOrigin}/`, label: labels.product },
    { id: 'pricing', href: `${siteOrigin}/pricing`, label: labels.pricing },
    { id: 'share', href: '/auth/register', label: labels.share },
  ] as const;

  useEffect(() => {
    setSelectedItem(activeItem);
    setIsOpen(false);
  }, [activeItem]);

  return (
    <div className="relative md:hidden">
      <button
        type="button"
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-app-border bg-app-elevated text-app-text shadow-soft-lift dark:bg-app-card"
      >
        {isOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
      </button>
      {isOpen ? (
        <div className="absolute right-0 z-30 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-app-border bg-app-elevated/95 p-2 shadow-xl backdrop-blur-md dark:bg-app-card/95">
          <nav className="grid gap-1" aria-label="Mobile navigation">
            {navItems.map((item) => {
              const active = selectedItem === item.id;
              return (
                <a
                  key={item.id}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  onPointerDown={() => setSelectedItem(item.id)}
                  className={`rounded-xl px-3 py-3 text-sm font-black transition-colors ${
                    active
                      ? 'bg-brand-lime text-brand-dark'
                      : 'text-app-text-muted hover:bg-app-bg hover:text-app-text'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
            <div className="mt-1 border-t border-app-border pt-1">
              <Link
                to="/auth/login"
                onPointerDown={() => setSelectedItem(null)}
                className="block rounded-xl px-3 py-3 text-sm font-black text-app-text-muted transition-colors hover:bg-app-bg hover:text-app-text"
              >
                {labels.login}
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </div>
  );
};

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
    !pathname.startsWith('/event/') &&
    !pathname.startsWith('/sync/');
  const isPublicAuthRoute = pathname === '/auth/login' || pathname === '/auth/register';
  const publicAuthActiveItem: PublicNavItemId | null =
    pathname === '/auth/register' ? 'share' : null;
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
                <BrandLogo className="h-12 w-auto sm:h-14 lg:h-20" />
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
            ) : isPublicAuthRoute ? (
              <div className="hidden md:block">
                <PublicAuthNavigation
                  activeItem={publicAuthActiveItem}
                  labels={{
                    product: t('home.nav.product'),
                    pricing: t('home.pricing.navLink'),
                    share: t('home.nav.share'),
                  }}
                />
              </div>
            ) : null}
          </div>
          <div className="flex items-center justify-end gap-2">
            {isPublicAuthRoute ? (
              <>
                <Link
                  to="/auth/login"
                  className="hidden rounded-full border border-app-border bg-app-elevated px-5 py-2.5 text-[15px] font-bold text-app-text shadow-soft-lift transition hover:border-brand-lime hover:text-brand-lime md:inline-flex dark:bg-app-card"
                >
                  {t('accountMenu.login')}
                </Link>
                <PublicAuthMobileMenu
                  activeItem={publicAuthActiveItem}
                  labels={{
                    product: t('home.nav.product'),
                    pricing: t('home.pricing.navLink'),
                    share: t('home.nav.share'),
                    login: t('accountMenu.login'),
                  }}
                />
              </>
            ) : (
              <AccountMenu />
            )}
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
      <main className="relative min-h-screen">
        <Outlet />
      </main>
    </div>
  );
};
