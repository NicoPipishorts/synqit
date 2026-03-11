import { ProviderConnectionsPage } from './ProviderConnectionsPage';
import { AppPageHeader } from '../components/app/AppPageHeader';
import { AppPageLayout } from '../components/app/AppPageLayout';
import { useI18n } from '../hooks/useI18n';

export const ProfilePlatformsPage = () => {
  const { t } = useI18n();

  return (
    <AppPageLayout>
      <AppPageHeader
        backTo="/profile"
        backLabel={t('profile.backToProfile')}
        title={t('profile.platformsTitle')}
        description={t('profile.platformsDescription')}
      />
      <ProviderConnectionsPage />
    </AppPageLayout>
  );
};
