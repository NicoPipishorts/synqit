import { AppPageHeader } from '../components/app/AppPageHeader';
import { AppPageLayout } from '../components/app/AppPageLayout';
import { useI18n } from '../hooks/useI18n';

export const FollowersPage = () => {
  const { t } = useI18n();

  return (
    <AppPageLayout bodyClassName="gap-8">
      <AppPageHeader
        eyebrow={t('followers.pill')}
        title={t('followers.title')}
        description={t('followers.subtitle')}
        backTo="/dashboard"
        backLabel={t('followers.back')}
      />
    </AppPageLayout>
  );
};
