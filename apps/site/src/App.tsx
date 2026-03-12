import { useEffect, useMemo, useState } from 'react';

import { AppAuthActions } from './components/marketing/AppAuthActions';
import { BlurSpotLayer } from './components/ui/BlurSpotLayer';
import { BrandLogo } from './components/ui/BrandLogo';
import { HomePage } from './HomePage';
import { buildAppUrl, shouldRedirectToApp } from './lib/app-url';
import { I18nProvider, useI18n } from './lib/i18n';
import { applyTheme, loadTheme } from './lib/theme';

const SITE_BG_SPOTS = [
  { id: 'site-spot-0', size: 260, top: 8, left: 5, color: 'rgba(198,255,0,0.18)' },
  { id: 'site-spot-1', size: 280, top: 12, left: 80, color: 'rgba(255,46,139,0.18)' },
  { id: 'site-spot-2', size: 220, top: 55, left: 50, color: 'rgba(125,211,252,0.15)' },
  { id: 'site-spot-3', size: 240, top: 80, left: 10, color: 'rgba(198,255,0,0.15)' },
  { id: 'site-spot-4', size: 200, top: 75, left: 90, color: 'rgba(255,46,139,0.15)' },
];

const AppShell = () => {
  const [isNavBlurActive, setIsNavBlurActive] = useState(false);
  const { t } = useI18n();

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

  return (
    <div className="relative min-h-screen overflow-x-clip bg-app-bg text-app-text transition-colors">
      <BlurSpotLayer
        filterId="site-bg-blur-filter"
        spots={SITE_BG_SPOTS}
        className="pointer-events-none absolute inset-0 z-0"
      />
      <header className="fixed inset-x-0 top-0 z-50">
        {isNavBlurActive && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-app-bg/30 shadow-[0_4px_12px_-10px_rgba(0,0,0,0.22)] backdrop-blur-md"
          />
        )}
        <div className="relative z-10 flex w-full items-center justify-between px-4 pb-2 pt-4 sm:px-6 sm:pb-3 sm:pt-5 lg:px-8">
          <a href="/" aria-label="Synqit home" className="inline-flex">
            <BrandLogo className="h-12 w-auto sm:h-24" />
          </a>
          <AppAuthActions
            primaryLabel={t('footer.getStarted')}
            secondaryLabel={t('accountMenu.login')}
            size="sm"
            className="gap-2"
          />
        </div>
      </header>
      <main className="relative z-10 min-h-screen">
        <HomePage />
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
