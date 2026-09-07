import {
  BrandLogo,
  PublicMobileNav,
  type PublicMobileNavItem,
  PublicNav,
  type PublicNavItem as PublicNavComponentItem,
} from '@synqit/ui';
import { Home, LogIn, Share2, Tag } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { BlurSpotLayer } from './components/ui/BlurSpotLayer';
import { LEGAL_ROUTES, legalSlugForPath, type LegalSlug } from './content/legal';
import { HomePage } from './HomePage';
import { LegalPage } from './LegalPage';
import { trackSiteEvent } from './lib/analytics';
import { buildAppUrl, getAppOrigin, shouldRedirectToApp } from './lib/app-url';
import { I18nProvider, useI18n } from './lib/i18n';
import { applyTheme, loadTheme } from './lib/theme';
import { useSiteAnalytics } from './lib/useSiteAnalytics';
import { PricingPage } from './PricingPage';

const SITE_BG_SPOTS = [
  { id: 'site-spot-0', size: 260, top: 8, left: 5, color: 'rgba(198,255,0,0.18)' },
  { id: 'site-spot-1', size: 280, top: 12, left: 80, color: 'rgba(255,46,139,0.18)' },
  { id: 'site-spot-2', size: 220, top: 55, left: 50, color: 'rgba(125,211,252,0.15)' },
  { id: 'site-spot-3', size: 240, top: 80, left: 10, color: 'rgba(198,255,0,0.15)' },
  { id: 'site-spot-4', size: 200, top: 75, left: 90, color: 'rgba(255,46,139,0.15)' },
];

const normalizePath = (pathname: string): string => {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
};

// Routes the site renders itself. Anything else (the app subdomain, auth,
// external links) is left to the browser as a normal navigation.
const INTERNAL_ROUTES = new Set(['/', '/pricing', ...Object.values(LEGAL_ROUTES)]);

const isPricingRoutePath = (pathname: string): boolean => normalizePath(pathname) === '/pricing';

// Identical to the web app's RouteLoadingScreen, so navigating across to the app
// (login / create) shows one continuous animated loader instead of a frozen page.
const AppHandoffScreen = () => (
  <div className="flex min-h-screen items-center justify-center bg-app-bg px-4 pt-24">
    <div aria-hidden="true" className="route-loader-logo h-24 w-24 sm:h-28 sm:w-28" />
  </div>
);

type PublicNavItem = {
  id: 'product' | 'pricing' | 'share';
  href: string;
  label: ReactNode;
};

const AppShell = () => {
  const [isNavBlurActive, setIsNavBlurActive] = useState(false);
  const { t } = useI18n();
  const [pathname, setPathname] = useState<string>(() =>
    typeof window === 'undefined' ? '/' : normalizePath(window.location.pathname),
  );
  const [isLeavingToApp, setIsLeavingToApp] = useState(false);
  const appOrigin = useMemo(() => getAppOrigin(), []);
  const isPricing = isPricingRoutePath(pathname);
  const legalSlug: LegalSlug | null = legalSlugForPath(pathname);
  useSiteAnalytics(pathname);
  // Legal pages sit outside the primary nav, so nothing is highlighted there.
  const routeActiveNavItem: PublicNavItem['id'] | null = legalSlug
    ? null
    : isPricing
      ? 'pricing'
      : 'product';
  const [activeNavItem, setActiveNavItem] = useState<PublicNavItem['id'] | null>(
    routeActiveNavItem,
  );
  const navItems: PublicNavComponentItem[] = [
    { id: 'product', href: '/', label: t('home.nav.product') },
    { id: 'pricing', href: '/pricing', label: t('home.pricing.navLink') },
    { id: 'share', href: buildAppUrl('/auth/register'), label: t('home.nav.share') },
  ];

  const mobileNavItems: PublicMobileNavItem[] = [
    {
      id: 'product',
      href: '/',
      label: t('home.nav.product'),
      icon: <Home size={18} aria-hidden="true" />,
    },
    {
      id: 'pricing',
      href: '/pricing',
      label: t('home.pricing.navLink'),
      icon: <Tag size={18} aria-hidden="true" />,
    },
    {
      id: 'share',
      href: buildAppUrl('/auth/register'),
      label: t('home.nav.share'),
      icon: <Share2 size={18} aria-hidden="true" />,
    },
    {
      id: 'login',
      href: buildAppUrl('/auth/login'),
      label: t('accountMenu.login'),
      icon: <LogIn size={18} aria-hidden="true" />,
    },
  ];

  const handleNavActivate = (id: string) => {
    if (id === 'product' || id === 'pricing' || id === 'share') {
      setActiveNavItem(id);
    }
  };

  useEffect(() => {
    applyTheme(loadTheme());

    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const onThemeChange = () => {
      applyTheme(loadTheme());
    };

    mediaQuery.addEventListener('change', onThemeChange);
    return () => mediaQuery.removeEventListener('change', onThemeChange);
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
    setActiveNavItem(routeActiveNavItem);
  }, [routeActiveNavItem]);

  const navigate = useCallback(
    (nextPath: string) => {
      const normalized = normalizePath(nextPath);
      if (normalized === pathname) {
        return;
      }
      window.history.pushState({}, '', normalized);
      setPathname(normalized);
      window.scrollTo({ top: 0 });
    },
    [pathname],
  );

  // Keep state in sync with browser back/forward.
  useEffect(() => {
    const onPopState = () => setPathname(normalizePath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Warm the connection to the app subdomain so the DNS/TLS handshake is already
  // done by the time the visitor clicks login / create — cuts real boot latency.
  useEffect(() => {
    if (!appOrigin || appOrigin === window.location.origin) {
      return;
    }
    const links = (['preconnect', 'dns-prefetch'] as const).map((rel) => {
      const link = document.createElement('link');
      link.rel = rel;
      link.href = appOrigin;
      if (rel === 'preconnect') {
        link.crossOrigin = '';
      }
      document.head.appendChild(link);
      return link;
    });
    return () => links.forEach((link) => link.remove());
  }, [appOrigin]);

  // Intercept clicks on internal-route links and swap the page client-side,
  // instead of letting the browser do a full document reload. A document-level
  // listener catches every anchor (nav, logo, hero CTAs) without per-link wiring.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const anchor = (event.target as HTMLElement | null)?.closest('a');
      if (
        !anchor ||
        (anchor.target && anchor.target !== '_self') ||
        anchor.hasAttribute('download')
      ) {
        return;
      }

      const href = anchor.getAttribute('href');
      if (!href) {
        return;
      }

      const label =
        anchor.dataset.analyticsLabel ??
        anchor.getAttribute('aria-label') ??
        anchor.textContent?.trim().slice(0, 80) ??
        '';
      trackSiteEvent({
        eventName: 'site_cta_click',
        properties: { label, href },
      });

      const url = new URL(href, window.location.href);

      // Same-origin internal route → instant client-side swap.
      if (url.origin === window.location.origin) {
        const target = normalizePath(url.pathname);
        if (!INTERNAL_ROUTES.has(target)) {
          return;
        }
        // In-page anchor (e.g. "#how") on the current route: let the browser scroll.
        if (url.hash && target === pathname) {
          return;
        }
        event.preventDefault();
        navigate(target);
        return;
      }

      // The app subdomain (login / create). We can't SPA across origins, but we
      // can paint the app's loader immediately so there's no frozen-page lag,
      // then hand off — the app boots into the same loader for a seamless feel.
      if (url.origin === appOrigin) {
        event.preventDefault();
        setIsLeavingToApp(true);
        requestAnimationFrame(() => window.location.assign(url.href));
      }
    };

    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [navigate, appOrigin, pathname]);

  if (isLeavingToApp) {
    return <AppHandoffScreen />;
  }

  return (
    <div className="relative min-h-screen overflow-x-clip bg-app-bg text-app-text transition-colors">
      {isPricing && (
        <BlurSpotLayer
          filterId="site-bg-blur-filter"
          spots={SITE_BG_SPOTS}
          className="pointer-events-none absolute inset-0 z-0"
        />
      )}
      <header className="fixed inset-x-0 top-0 z-50">
        {isNavBlurActive && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0" />
        )}
        <div className="relative z-10 flex w-full items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-6 sm:pb-3 sm:pt-5 lg:px-8">
          <a
            href="/"
            aria-label="Synqit home"
            data-analytics-label="logo"
            className="inline-flex shrink-0 mt-3 sm:mt-0"
          >
            <BrandLogo className="h-12 w-auto sm:h-24" />
          </a>

          <PublicNav
            items={navItems}
            activeId={activeNavItem}
            onActivate={handleNavActivate}
            ariaLabel="Primary navigation"
            layoutGroupId="public-site-nav"
            className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block"
          />

          <div className="absolute right-4 top-1/2 hidden -translate-y-1/2 items-center gap-2 md:flex sm:right-6 lg:right-8">
            <a
              href={buildAppUrl('/auth/login')}
              data-analytics-label="header_login"
              className="rounded-full border-2 border-app-text bg-app-elevated px-5 py-2.5 text-[15px] font-black text-app-text shadow-sticker-sm transition hover:bg-brand-lime hover:text-brand-dark motion-safe:hover:-translate-y-0.5 dark:bg-app-card"
            >
              {t('accountMenu.login')}
            </a>
          </div>
        </div>
      </header>

      <PublicMobileNav
        items={mobileNavItems}
        activeId={activeNavItem}
        onActivate={handleNavActivate}
        ariaLabel="Mobile navigation"
      />
      <main className="relative z-10 min-h-screen">
        {legalSlug ? <LegalPage slug={legalSlug} /> : isPricing ? <PricingPage /> : <HomePage />}
      </main>
    </div>
  );
};

export default function App() {
  const redirectTarget = useMemo(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    const { pathname, search, hash } = window.location;
    if (!shouldRedirectToApp(pathname)) {
      return null;
    }

    return buildAppUrl(`${pathname}${search}${hash}`);
  }, []);

  useEffect(() => {
    if (!redirectTarget || typeof window === 'undefined') {
      return;
    }

    window.location.replace(redirectTarget);
  }, [redirectTarget]);

  if (redirectTarget) {
    return <AppHandoffScreen />;
  }

  return (
    <I18nProvider>
      <AppShell />
    </I18nProvider>
  );
}
