import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';

import { BlurSpotLayer } from './components/ui/BlurSpotLayer';
import { BrandLogo } from './components/ui/BrandLogo';
import { HomePage } from './HomePage';
import { buildAppUrl, shouldRedirectToApp } from './lib/app-url';
import { I18nProvider, useI18n } from './lib/i18n';
import { applyTheme, loadTheme } from './lib/theme';
import { PricingPage } from './PricingPage';

const SITE_BG_SPOTS = [
  { id: 'site-spot-0', size: 260, top: 8, left: 5, color: 'rgba(198,255,0,0.18)' },
  { id: 'site-spot-1', size: 280, top: 12, left: 80, color: 'rgba(255,46,139,0.18)' },
  { id: 'site-spot-2', size: 220, top: 55, left: 50, color: 'rgba(125,211,252,0.15)' },
  { id: 'site-spot-3', size: 240, top: 80, left: 10, color: 'rgba(198,255,0,0.15)' },
  { id: 'site-spot-4', size: 200, top: 75, left: 90, color: 'rgba(255,46,139,0.15)' },
];

const isPricingRoutePath = (pathname: string): boolean =>
  pathname.replace(/\/+$/, '') === '/pricing';

type PublicNavItem = {
  id: 'product' | 'pricing' | 'share';
  href: string;
  label: ReactNode;
};

const NavLink = ({
  item,
  href,
  active,
  onActivate,
  children,
}: {
  item: PublicNavItem['id'];
  href: string;
  active: boolean;
  onActivate: (item: PublicNavItem['id']) => void;
  children: ReactNode;
}) => (
  <a
    href={href}
    aria-current={active ? 'page' : undefined}
    onPointerDown={() => onActivate(item)}
    className={`relative z-10 inline-flex min-h-[45px] items-center justify-center rounded-full px-5 py-2.5 text-[15px] font-black transition-colors ${
      active ? 'text-brand-dark' : 'text-app-text-muted hover:text-app-text'
    }`}
  >
    {children}
  </a>
);

const AppShell = () => {
  const [isNavBlurActive, setIsNavBlurActive] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t } = useI18n();
  const isPricing = typeof window !== 'undefined' && isPricingRoutePath(window.location.pathname);
  const routeActiveNavItem: PublicNavItem['id'] = isPricing ? 'pricing' : 'product';
  const [activeNavItem, setActiveNavItem] = useState<PublicNavItem['id']>(routeActiveNavItem);
  const navItems: PublicNavItem[] = [
    { id: 'product', href: '/', label: t('home.nav.product') },
    { id: 'pricing', href: '/pricing', label: t('home.pricing.navLink') },
    { id: 'share', href: buildAppUrl('/auth/register'), label: t('home.nav.share') },
  ];

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
    setIsMobileMenuOpen(false);
  }, [routeActiveNavItem]);

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
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-app-bg/30 shadow-[0_4px_12px_-10px_rgba(0,0,0,0.22)] backdrop-blur-md"
          />
        )}
        <div className="relative z-10 flex w-full items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-6 sm:pb-3 sm:pt-5 lg:px-8">
          <a href="/" aria-label="Synqit home" className="inline-flex shrink-0 mt-3 sm:mt-0">
            <BrandLogo className="h-12 w-auto sm:h-24" />
          </a>

          <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 overflow-hidden rounded-full border border-app-border bg-app-elevated/85 p-1.5 shadow-soft-lift backdrop-blur md:flex dark:bg-app-card/85">
            {navItems.map((item) => {
              const active = activeNavItem === item.id;
              return (
                <span key={item.id} className="relative inline-flex">
                  {active ? (
                    <motion.span
                      layoutId="public-site-nav-pill"
                      className="absolute inset-0 rounded-full bg-brand-lime"
                      transition={{ type: 'spring', stiffness: 520, damping: 42 }}
                    />
                  ) : null}
                  <NavLink
                    item={item.id}
                    href={item.href}
                    active={active}
                    onActivate={setActiveNavItem}
                  >
                    {item.label}
                  </NavLink>
                </span>
              );
            })}
          </nav>

          <div className="absolute right-4 top-1/2 hidden -translate-y-1/2 items-center gap-2 md:flex sm:right-6 lg:right-8">
            <a
              href={buildAppUrl('/auth/login')}
              className="rounded-full border border-app-border bg-app-elevated px-5 py-2.5 text-[15px] font-bold text-app-text shadow-soft-lift transition hover:border-brand-lime hover:text-brand-lime dark:bg-app-card"
            >
              {t('accountMenu.login')}
            </a>
          </div>
          <button
            type="button"
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen((value) => !value)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-app-border bg-app-elevated text-app-text shadow-soft-lift md:hidden dark:bg-app-card"
          >
            {isMobileMenuOpen ? (
              <X size={20} aria-hidden="true" />
            ) : (
              <Menu size={20} aria-hidden="true" />
            )}
          </button>
        </div>
        {isMobileMenuOpen ? (
          <div className="absolute right-4 top-[calc(100%-0.25rem)] z-20 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-app-border bg-app-elevated/95 p-2 shadow-xl backdrop-blur-md md:hidden dark:bg-app-card/95">
            <nav className="grid gap-1" aria-label="Mobile navigation">
              {navItems.map((item) => {
                const active = activeNavItem === item.id;
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    onPointerDown={() => setActiveNavItem(item.id)}
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
                <a
                  href={buildAppUrl('/auth/login')}
                  className="block rounded-xl px-3 py-3 text-sm font-black text-app-text-muted transition-colors hover:bg-app-bg hover:text-app-text"
                >
                  {t('accountMenu.login')}
                </a>
              </div>
            </nav>
          </div>
        ) : null}
      </header>
      <main className="relative z-10 min-h-screen">
        {isPricing ? <PricingPage /> : <HomePage />}
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg px-6 text-center text-app-text">
        <div className="grid gap-4">
          <BrandLogo className="mx-auto h-12 w-auto" />
          <p className="text-sm text-app-text-secondary">Redirecting to the Synqit app...</p>
        </div>
      </div>
    );
  }

  return (
    <I18nProvider>
      <AppShell />
    </I18nProvider>
  );
}
