import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { BarChart3, LayoutDashboard, LogOut, Mail, Shield, Users } from 'lucide-react';

import { useI18n } from '../../hooks/useI18n';
import { clearAuth, loadAuth } from '../../lib/auth';
import { BrandLogo } from '../ui/BrandLogo';
import { CTAButton } from '../ui/cta';

const NAV_ITEMS = [
  {
    to: '/dashboard',
    icon: LayoutDashboard,
    labelKey: 'admin.navDashboard',
    matches: (pathname: string) => pathname === '/dashboard',
  },
  {
    to: '/users',
    icon: Users,
    labelKey: 'admin.navUsers',
    matches: (pathname: string) => pathname === '/users',
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

  if (isLoginRoute) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(198,255,0,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(255,46,139,0.16),_transparent_28%),linear-gradient(180deg,_var(--syn-bg),_var(--syn-surface))]">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(198,255,0,0.12),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(255,46,139,0.12),_transparent_22%),linear-gradient(180deg,_var(--syn-bg),_var(--syn-surface))]">
      <div className="mx-auto grid min-h-screen max-w-[1680px] lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="border-b border-app-border bg-app-elevated/92 px-5 py-5 shadow-soft-lift backdrop-blur-md lg:border-b-0 lg:border-r lg:px-6 lg:py-7">
          <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-start">
            <div className="grid gap-2">
              <div className="inline-flex items-center gap-3">
                <div className="rounded-2xl border border-brand-lime/45 bg-brand-lime/16 p-2.5 text-brand-dark">
                  <Shield size={20} aria-hidden="true" />
                </div>
                <BrandLogo className="h-9 w-auto" />
              </div>
              <div className="hidden lg:grid">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-app-text-muted">
                  Synqit admin
                </p>
                <p className="text-sm text-app-text-secondary">{t('admin.portalSubtitle')}</p>
              </div>
            </div>
            <CTAButton
              type="button"
              variant="ghost"
              className="hidden lg:inline-flex"
              onClick={() => {
                clearAuth();
                window.location.assign('/login');
              }}
            >
              <LogOut size={14} aria-hidden="true" />
              Logout
            </CTAButton>
          </div>

          <nav className="mt-5 grid gap-1 lg:mt-8" aria-label="Admin navigation">
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

          <div className="mt-6 hidden rounded-3xl border border-app-border bg-app-surface/70 p-4 lg:grid">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-app-text-muted">
              Active session
            </p>
            <p className="mt-2 truncate text-sm font-semibold text-app-text">
              {auth?.userEmail ?? 'Unknown admin'}
            </p>
            <p className="mt-1 text-sm text-app-text-secondary">
              Admin access is scoped through the main API.
            </p>
            <CTAButton
              type="button"
              variant="secondary"
              className="mt-4 justify-center"
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

        <main className="min-w-0 px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
          <div className="mx-auto grid min-h-full w-full max-w-7xl gap-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
