import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { BarChart3, LogOut, Mail, Menu, Send, Shield, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useI18n } from '../../hooks/useI18n';
import { clearAuth, loadAuth } from '../../lib/auth';
import { BrandLogo } from '../ui/BrandLogo';
import { CTAButton } from '../ui/cta';

const NAV_ITEMS = [
  {
    to: '/invites',
    icon: Send,
    labelKey: 'admin.navInvites',
    matches: (pathname: string) => pathname === '/invites' || pathname === '/dashboard',
  },
  {
    to: '/users',
    icon: Users,
    labelKey: 'admin.navUsers',
    matches: (pathname: string) => pathname === '/users' || pathname.startsWith('/users/'),
  },
  {
    to: '/analytics',
    icon: BarChart3,
    labelKey: 'admin.navAnalytics',
    matches: (pathname: string) => pathname === '/analytics',
  },
  {
    to: '/emails',
    icon: Mail,
    labelKey: 'admin.navEmails',
    matches: (pathname: string) => pathname === '/emails',
  },
] as const;

export const AdminShell = () => {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { t } = useI18n();
  const auth = loadAuth();
  const isLoginRoute = pathname === '/login';
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    if (isMobileNavOpen) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileNavOpen]);

  if (isLoginRoute) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(198,255,0,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(255,46,139,0.16),_transparent_28%),linear-gradient(180deg,_var(--syn-bg),_var(--syn-surface))]">
        <Outlet />
      </div>
    );
  }

  const renderNav = (className?: string) => (
    <nav className={className} aria-label="Admin navigation">
      {NAV_ITEMS.map((item) => {
        const isActive = item.matches(pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`focus-ring-brand flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-sm font-bold transition ${
              isActive
                ? 'border-brand-lime/45 bg-brand-lime/16 text-brand-dark'
                : 'border-transparent text-app-text-secondary hover:border-app-border hover:bg-app-surface hover:text-app-text'
            }`}
          >
            <Icon size={16} aria-hidden="true" />
            <span>{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(198,255,0,0.12),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(255,46,139,0.12),_transparent_22%),linear-gradient(180deg,_var(--syn-bg),_var(--syn-surface))]">
      <div className="sticky top-0 z-40 border-b border-app-border bg-app-elevated/92 px-4 py-4 backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex min-w-0 items-center gap-3">
            <div className="rounded-2xl border border-brand-lime/45 bg-brand-lime/16 p-2 text-brand-dark">
              <Shield size={18} aria-hidden="true" />
            </div>
            <BrandLogo className="h-8 w-auto" />
          </div>
          <CTAButton
            type="button"
            variant="secondary"
            className="h-10 w-10 px-0"
            onClick={() => setIsMobileNavOpen((current) => !current)}
            aria-label={isMobileNavOpen ? 'Close navigation' : 'Open navigation'}
          >
            {isMobileNavOpen ? (
              <X size={16} aria-hidden="true" />
            ) : (
              <Menu size={16} aria-hidden="true" />
            )}
          </CTAButton>
        </div>
      </div>

      {isMobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setIsMobileNavOpen(false)}
            className="absolute inset-0 bg-brand-dark/45 backdrop-blur-[1px]"
          />
          <aside className="absolute left-0 top-0 flex h-full w-[min(20rem,86vw)] flex-col border-r border-app-border bg-app-elevated/96 px-5 py-6 shadow-soft-lift backdrop-blur-md">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-3">
                <div className="rounded-2xl border border-brand-lime/45 bg-brand-lime/16 p-2.5 text-brand-dark">
                  <Shield size={20} aria-hidden="true" />
                </div>
                <BrandLogo className="h-9 w-auto" />
              </div>
              <CTAButton
                type="button"
                variant="secondary"
                className="h-10 w-10 px-0"
                onClick={() => setIsMobileNavOpen(false)}
                aria-label="Close navigation"
              >
                <X size={16} aria-hidden="true" />
              </CTAButton>
            </div>

            {renderNav('mt-8 grid gap-1')}

            <div className="mt-auto grid gap-4 pt-6">
              <div className="border-t border-app-border" />
              <p className="truncate text-sm font-semibold text-app-text">
                {auth?.userEmail ?? 'Unknown admin'}
              </p>
              <CTAButton
                type="button"
                variant="secondary"
                className="justify-center"
                onClick={() => {
                  clearAuth();
                  window.location.assign('/login');
                }}
              >
                <LogOut size={14} aria-hidden="true" />
                Sign out
              </CTAButton>
            </div>
          </aside>
        </div>
      ) : null}

      <div className="min-h-screen lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
        <aside className="sticky top-0 hidden min-h-screen flex-col border-r border-app-border bg-app-elevated/92 px-6 py-7 shadow-soft-lift backdrop-blur-md lg:flex">
          <div className="inline-flex items-center gap-3">
            <div className="rounded-2xl border border-brand-lime/45 bg-brand-lime/16 p-2.5 text-brand-dark">
              <Shield size={20} aria-hidden="true" />
            </div>
            <BrandLogo className="h-9 w-auto" />
          </div>

          {renderNav('mt-8 grid gap-1')}

          <div className="mt-auto grid gap-4 pt-6">
            <div className="border-t border-app-border" />
            <p className="truncate text-sm font-semibold text-app-text">
              {auth?.userEmail ?? 'Unknown admin'}
            </p>
            <CTAButton
              type="button"
              variant="secondary"
              className="justify-center"
              onClick={() => {
                clearAuth();
                window.location.assign('/login');
              }}
            >
              <LogOut size={14} aria-hidden="true" />
              Sign out
            </CTAButton>
          </div>
        </aside>

        <main className="min-w-0 px-4 pb-6 pt-5 sm:px-6 sm:pb-8 sm:pt-6 lg:px-10 lg:py-8">
          <div className="grid w-full content-start gap-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
