import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';

import { useAuthSession } from '../../hooks/useAuthSession';
import { applyTheme, loadTheme } from '../../lib/theme';
import { AccountMenu } from '../ui/AccountMenu';
import { BrandLogo } from '../ui/BrandLogo';
import { ThemeToggle } from '../ui/ThemeToggle';

export const AppShell = () => {
  const { auth } = useAuthSession();
  const hasSession = Boolean(auth);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isPublicRoute =
    pathname === '/' || pathname.startsWith('/auth/') || pathname.startsWith('/event/');

  useEffect(() => {
    applyTheme(loadTheme());
  }, []);

  return (
    <div className="min-h-screen bg-app-bg text-app-text transition-colors">
      {isPublicRoute ? (
        <>
          <div className="fixed left-4 top-4 z-30 sm:left-6 sm:top-6">
            <Link to="/" aria-label="Synqit home" className="inline-flex">
              <BrandLogo className="h-10 w-auto sm:h-20" />
            </Link>
          </div>
          <div className="fixed right-4 top-4 z-30 flex items-center gap-2 sm:right-6 sm:top-6">
            <ThemeToggle />
            <AccountMenu />
          </div>
          <main>
            <Outlet />
          </main>
        </>
      ) : (
        <>
          <header className="sticky top-0 z-20 border-b border-app-border bg-app-elevated/90 backdrop-blur">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <Link to="/" className="inline-flex items-center">
                  <BrandLogo className="h-9 w-auto sm:h-10" />
                </Link>
                <nav className="hidden items-center gap-2 text-sm sm:flex">
                  <Link
                    to="/"
                    className="rounded-md px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Product
                  </Link>
                  {hasSession ? (
                    <>
                      <Link
                        to="/events"
                        className="rounded-md px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      >
                        Events
                      </Link>
                      <Link
                        to="/providers"
                        className="rounded-md px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      >
                        Providers
                      </Link>
                    </>
                  ) : null}
                </nav>
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <AccountMenu />
              </div>
            </div>
          </header>
          <main>
            <Outlet />
          </main>
        </>
      )}
    </div>
  );
};
