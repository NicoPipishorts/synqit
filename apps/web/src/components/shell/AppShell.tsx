import { Link, Outlet } from '@tanstack/react-router';
import { useEffect } from 'react';

import { applyTheme, loadTheme } from '../../lib/theme';
import { AccountMenu } from '../ui/AccountMenu';
import { BrandLogo } from '../ui/BrandLogo';

export const AppShell = () => {
  useEffect(() => {
    applyTheme(loadTheme());
  }, []);

  return (
    <div className="min-h-screen bg-app-bg text-app-text transition-colors">
      <header className="fixed inset-x-0 top-0 z-40 bg-app-bg/50 backdrop-blur-xl">
        <div className="flex w-full items-center justify-between px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
          <Link to="/" aria-label="Synqit home" className="inline-flex">
            <BrandLogo className="h-10 w-auto sm:h-20" />
          </Link>
          <div className="flex items-center gap-2">
            <AccountMenu />
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
};
