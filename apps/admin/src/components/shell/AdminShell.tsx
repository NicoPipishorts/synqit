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

  if (isLoginRoute) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(198,255,0,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(255,46,139,0.16),_transparent_28%),linear-gradient(180deg,_var(--syn-bg),_var(--syn-surface))]">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(198,255,0,0.12),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(255,46,139,0.12),_transparent_22%),linear-gradient(180deg,_var(--syn-bg),_var(--syn-surface))]">
      <div className="grid min-h-screen grid-cols-[18rem_minmax(0,1fr)] items-start">
        <aside className="sticky top-0 flex min-h-screen flex-col border-r border-app-border bg-app-elevated/92 px-6 py-7 shadow-soft-lift backdrop-blur-md">
          <div className="inline-flex items-center gap-3">
            <div className="rounded-2xl border border-brand-lime/45 bg-brand-lime/16 p-2.5 text-brand-dark">
              <Shield size={20} aria-hidden="true" />
            </div>
            <BrandLogo className="h-9 w-auto" />
          </div>

          <nav className="mt-8 grid gap-1" aria-label="Admin navigation">
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

        <main className="min-w-0 px-10 py-8">
          <div className="grid w-full content-start gap-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
