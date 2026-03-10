import { AdminComingSoonPanel } from '../components/admin/AdminComingSoonPanel';
import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import { useI18n } from '../hooks/useI18n';

export const AdminDashboardPage = () => {
  const { t } = useI18n();

  return (
    <section className="grid min-h-[calc(100vh-4rem)] grid-rows-[auto_1fr] content-start gap-6">
      <AdminSectionHeader title={t('admin.dashboardTitle')} />

      <div className="grid place-items-center">
        <AdminComingSoonPanel title="Comming soon" message="working on the tools" />
      </div>
    </section>
  );
};
