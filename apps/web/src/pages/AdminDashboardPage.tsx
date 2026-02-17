import { AdminPageHeader } from '../components/admin/AdminPageHeader';
import { AdminSubNav } from '../components/admin/AdminSubNav';
import { useI18n } from '../hooks/useI18n';

export const AdminDashboardPage = () => {
  const { t } = useI18n();

  return (
    <section className="mx-auto grid content-start min-h-screen w-full max-w-6xl gap-5 px-4 pb-10 pt-28 sm:px-6 sm:pt-32 lg:px-8">
      <AdminPageHeader nav={<AdminSubNav />} />

      <article className="grid gap-2 rounded-3xl border border-app-border bg-app-elevated p-6 shadow-soft-lift dark:bg-app-card">
        <h2 className="text-lg font-black text-app-text">{t('admin.dashboardTitle')}</h2>
        <p className="text-sm font-semibold text-app-text-secondary">
          {t('admin.dashboardComingSoon')}
        </p>
      </article>
    </section>
  );
};
