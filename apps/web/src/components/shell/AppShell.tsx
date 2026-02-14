import { Link, Outlet } from '@tanstack/react-router';
import { useEffect } from 'react';

import { applyTheme, loadTheme } from '../../lib/theme';
import { AccountMenu } from '../ui/AccountMenu';
import { BrandLogo } from '../ui/BrandLogo';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { ThemeToggle } from '../ui/ThemeToggle';

export const AppShell = () => {
  useEffect(() => {
    applyTheme(loadTheme());
  }, []);

  return (
    <div className="min-h-screen bg-app-bg text-app-text transition-colors">
      <div className="fixed left-4 top-4 z-30 sm:left-6 sm:top-6">
        <Link to="/" aria-label="Synqit home" className="inline-flex">
          <BrandLogo className="h-10 w-auto sm:h-20" />
        </Link>
      </div>
      <div className="fixed right-4 top-4 z-30 flex items-center gap-2 sm:right-6 sm:top-6">
        <LanguageSwitcher />
        <ThemeToggle />
        <AccountMenu />
      </div>
      <main>
        <Outlet />
      </main>
    </div>
  );
};
