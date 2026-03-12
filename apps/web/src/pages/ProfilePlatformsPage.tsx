import { AppPageHeader } from '../components/app/AppPageHeader';
import { AppPageLayout } from '../components/app/AppPageLayout';
import { ProviderConnections } from '../components/profile/ProviderConnections';
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
      <ProviderConnections />
    </AppPageLayout>
  );
};
