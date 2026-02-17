import { Link, useRouterState } from '@tanstack/react-router';

import { useI18n } from '../../hooks/useI18n';

const ITEMS = [
  {
    to: '/admin/dashboard',
    labelKey: 'admin.navDashboard',
    isActive: (path: string) => path === '/admin/dashboard',
  },
  {
    to: '/admin/users',
    labelKey: 'admin.navUsers',
    isActive: (path: string) => path === '/admin/users',
  },
  {
    to: '/admin/analytics',
    labelKey: 'admin.navAnalytics',
    isActive: (path: string) => path === '/admin/analytics',
  },
  {
    to: '/admin/emails',
    labelKey: 'admin.navEmails',
    isActive: (path: string) => path === '/admin/emails',
  },
] as const;

export const AdminSubNav = () => {
  const { t } = useI18n();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <nav className="inline-flex w-fit self-start items-center gap-1 rounded-xl border border-app-border bg-app-elevated p-1 dark:bg-app-card">
      {ITEMS.map((item) => {
        const active = item.isActive(pathname);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`inline-flex cursor-pointer items-center rounded-lg px-3 py-1.5 text-xs font-black transition ${
              active
                ? 'bg-brand-dark text-brand-white dark:bg-brand-white dark:text-brand-dark'
                : 'text-app-text-secondary hover:text-app-text'
            }`}
          >
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
};
