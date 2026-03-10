import { useEffect, useMemo, useState } from 'react';

import { BrandLogo } from './components/ui/BrandLogo';
import { HeroLink } from './components/ui/HeroLink';
import { HomePage } from './HomePage';
import { buildAppUrl, shouldRedirectToApp } from './lib/app-url';
import { I18nProvider, useI18n } from './lib/i18n';
import { applyTheme, loadTheme } from './lib/theme';

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
      <header className="fixed inset-x-0 top-0 z-50">
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 bg-app-bg/30 backdrop-blur-md transition-opacity duration-300 ease-out ${
            isNavBlurActive
              ? 'opacity-100 shadow-[0_4px_12px_-10px_rgba(0,0,0,0.22)]'
              : 'opacity-0 shadow-none'
          }`}
        />
        <div className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 pb-2 pt-4 sm:px-6 sm:pb-3 sm:pt-5 lg:px-8">
          <a href="/" aria-label="Synqit home" className="inline-flex">
            <BrandLogo className="h-12 w-auto sm:h-24" />
          </a>
          <div className="flex items-center gap-2">
            <HeroLink href={buildAppUrl('/auth/login')} variant="outline" size="sm">
              {t('accountMenu.login')}
            </HeroLink>
            <HeroLink href={buildAppUrl('/auth/register')} variant="lime" size="sm">
              {t('footer.getStarted')}
            </HeroLink>
          </div>
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
