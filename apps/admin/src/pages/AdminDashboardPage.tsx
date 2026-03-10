import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import { CTAButton } from '../components/ui/cta';
import { useI18n } from '../hooks/useI18n';

export const AdminDashboardPage = () => {
  const { t } = useI18n();

  return (
    <section className="grid gap-5">
      <AdminSectionHeader
        eyebrow={t('admin.portalTitle')}
        title={t('admin.dashboardTitle')}
        description={t('admin.dashboardComingSoon')}
      />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="grid gap-4 rounded-[2rem] border border-app-border bg-app-elevated p-6 shadow-soft-lift dark:bg-app-card">
          <div className="grid gap-2">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-app-text-muted">
              Operations
            </p>
            <h2 className="text-xl font-black text-app-text">Portal status</h2>
            <p className="max-w-2xl text-sm text-app-text-secondary">
              This admin frontend is now detached from the main app shell and ready for its own
              domain, navigation, and operations tooling.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-app-border bg-app-surface/70 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-app-text-muted">
                Access
              </p>
              <p className="mt-2 text-sm font-semibold text-app-text">Dedicated admin session</p>
            </div>
            <div className="rounded-2xl border border-app-border bg-app-surface/70 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-app-text-muted">
                Layout
              </p>
              <p className="mt-2 text-sm font-semibold text-app-text">Sidebar dashboard shell</p>
            </div>
            <div className="rounded-2xl border border-app-border bg-app-surface/70 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-app-text-muted">
                Backend
              </p>
              <p className="mt-2 text-sm font-semibold text-app-text">Shared API and RBAC model</p>
            </div>
          </div>
        </article>

        <article className="grid gap-4 rounded-[2rem] border border-app-border bg-brand-dark p-6 text-brand-white shadow-soft-lift dark:bg-brand-white dark:text-brand-dark">
          <div className="grid gap-2">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-white/55 dark:text-brand-dark/55">
              Next
            </p>
            <h2 className="text-xl font-black">{t('admin.analyticsOverviewTitle')}</h2>
            <p className="text-sm text-brand-white/80 dark:text-brand-dark/72">
              Use the analytics and users sections for live admin actions while this landing view
              stays focused on operational status and future KPIs.
            </p>
          </div>
          <CTAButton type="button" variant="secondary" className="w-fit">
            {t('admin.navAnalytics')}
          </CTAButton>
        </article>
      </div>
    </section>
  );
};
