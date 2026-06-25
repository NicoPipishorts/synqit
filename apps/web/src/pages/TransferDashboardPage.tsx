import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, ListMusic, Plus, Search } from 'lucide-react';

import { AppOnboardingPanel } from '../components/app/AppOnboardingPanel';
import { AppPageHeader } from '../components/app/AppPageHeader';
import { AppPageLayout } from '../components/app/AppPageLayout';
import { AppSectionHeading } from '../components/app/AppSectionHeading';
import { TransferCard } from '../components/syncs/TransferCard';
import { CTALink } from '../components/ui/cta';
import { useI18n } from '../hooks/useI18n';
import { fetchSyncCollections, syncQueryKeys } from '../lib/queries';

export const TransferDashboardPage = () => {
  const { t } = useI18n();

  const syncsQuery = useQuery({
    queryKey: syncQueryKeys.list(),
    queryFn: fetchSyncCollections,
  });

  const transfers = (syncsQuery.data?.ownedSyncs ?? []).filter((sync) => sync.kind === 'transfer');
  const hasAny = transfers.length > 0;

  return (
    <AppPageLayout bodyClassName="gap-8">
      {hasAny ? (
        <AppPageHeader
          eyebrow={t('transferDashboardPage.title')}
          title={t('transferDashboardPage.myTitle')}
          description={t('transferDashboardPage.description')}
          actions={
            <CTALink
              to="/transfer/new"
              variant="primary"
              className="w-full justify-center gap-2 px-4 py-2.5 text-sm font-black sm:w-auto"
            >
              <Plus size={14} aria-hidden="true" />
              {t('transferDashboardPage.create')}
            </CTALink>
          }
        />
      ) : null}

      {!hasAny ? (
        <div className="grid min-h-[calc(100svh-24rem)] items-start pt-8 sm:pt-12">
          <AppOnboardingPanel
            eyebrow={t('transferDashboardPage.onboardingEyebrow')}
            title={t('transferDashboardPage.onboardingTitle')}
            body={t('transferDashboardPage.onboardingBody')}
            icon={<ArrowLeftRight size={24} aria-hidden="true" />}
            note={t('transferDashboardPage.onboardingNote')}
            actions={
              <CTALink to="/transfer/new" variant="primary" size="lg" className="justify-center">
                {t('transferDashboardPage.transferFirst')}
              </CTALink>
            }
            steps={[
              {
                icon: <ListMusic size={18} aria-hidden="true" />,
                title: t('transferDashboardPage.onboardingStepPickTitle'),
                body: t('transferDashboardPage.onboardingStepPickBody'),
              },
              {
                icon: <Search size={18} aria-hidden="true" />,
                title: t('transferDashboardPage.onboardingStepMatchTitle'),
                body: t('transferDashboardPage.onboardingStepMatchBody'),
              },
              {
                icon: <ArrowLeftRight size={18} aria-hidden="true" />,
                title: t('transferDashboardPage.onboardingStepMoveTitle'),
                body: t('transferDashboardPage.onboardingStepMoveBody'),
              },
            ]}
          />
        </div>
      ) : (
        <section className="grid gap-4">
          <AppSectionHeading
            title={t('transferDashboardPage.sectionTitle')}
            description={t('transferDashboardPage.sectionBody')}
            count={transfers.length}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {transfers.map((sync) => (
              <TransferCard key={`transfer-${sync.id}`} sync={sync} />
            ))}
          </div>
        </section>
      )}
    </AppPageLayout>
  );
};
