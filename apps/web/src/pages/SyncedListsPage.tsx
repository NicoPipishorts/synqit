import { useQuery } from '@tanstack/react-query';
import { Link2, Plus, Users } from 'lucide-react';

import { AppOnboardingPanel } from '../components/app/AppOnboardingPanel';
import { AppPageHeader } from '../components/app/AppPageHeader';
import { AppPageLayout } from '../components/app/AppPageLayout';
import { AppSectionHeading } from '../components/app/AppSectionHeading';
import { SyncCard } from '../components/syncs/SyncCard';
import { CTALink } from '../components/ui/cta';
import { useI18n } from '../hooks/useI18n';
import { fetchSyncCollections, syncQueryKeys } from '../lib/queries';

export const SyncedListsPage = () => {
  const { t } = useI18n();

  const syncsQuery = useQuery({
    queryKey: syncQueryKeys.list(),
    queryFn: fetchSyncCollections,
  });

  // Transfers are one-time self-moves and live on their own dashboard
  // (/transfer); only genuine shared lists belong here.
  const ownedSyncs = (syncsQuery.data?.ownedSyncs ?? []).filter((sync) => sync.kind === 'shared');
  const subscribedSyncs = (syncsQuery.data?.subscribedSyncs ?? []).filter(
    (sync) => sync.kind === 'shared',
  );
  const hasAny = ownedSyncs.length > 0 || subscribedSyncs.length > 0;

  return (
    <AppPageLayout bodyClassName="gap-8">
      {hasAny ? (
        <AppPageHeader
          eyebrow={t('syncedListsPage.title')}
          title={t('syncedListsPage.myTitle')}
          description={t('syncedListsPage.description')}
          actions={
            <CTALink
              to="/synced-lists/new"
              variant="primary"
              className="w-full justify-center gap-2 px-4 py-2.5 text-sm font-black sm:w-auto"
            >
              <Plus size={14} aria-hidden="true" />
              {t('syncedListsPage.create')}
            </CTALink>
          }
        />
      ) : null}

      {/* ── List / Empty ── */}
      {!hasAny ? (
        <div className="grid min-h-[calc(100svh-24rem)] items-start pt-8 sm:pt-12">
          <AppOnboardingPanel
            eyebrow={t('syncedListsPage.onboardingEyebrow')}
            title={t('syncedListsPage.onboardingTitle')}
            body={t('syncedListsPage.onboardingBody')}
            icon={<Link2 size={24} aria-hidden="true" />}
            note={t('syncedListsPage.onboardingNote')}
            actions={
              <CTALink
                to="/synced-lists/new"
                variant="primary"
                size="lg"
                className="justify-center"
              >
                {t('syncedListsPage.shareFirst')}
              </CTALink>
            }
            steps={[
              {
                icon: <Plus size={18} aria-hidden="true" />,
                title: t('syncedListsPage.onboardingStepPickTitle'),
                body: t('syncedListsPage.onboardingStepPickBody'),
              },
              {
                icon: <Link2 size={18} aria-hidden="true" />,
                title: t('syncedListsPage.onboardingStepShareTitle'),
                body: t('syncedListsPage.onboardingStepShareBody'),
              },
              {
                icon: <Users size={18} aria-hidden="true" />,
                title: t('syncedListsPage.onboardingStepGrowTitle'),
                body: t('syncedListsPage.onboardingStepGrowBody'),
              },
            ]}
          />
        </div>
      ) : (
        <div className="grid gap-8">
          {ownedSyncs.length > 0 ? (
            <section className="grid gap-4">
              <AppSectionHeading
                title={t('syncedListsPage.ownerSectionTitle')}
                description={t('syncedListsPage.ownerSectionBody')}
                count={ownedSyncs.length}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                {ownedSyncs.map((sync) => (
                  <SyncCard
                    key={`owned-${sync.id}`}
                    sync={sync}
                    role="owner"
                    detailTo={`/synced-lists/${sync.id}`}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {subscribedSyncs.length > 0 ? (
            <section className="grid gap-4">
              <AppSectionHeading
                title={t('syncedListsPage.subscriberSectionTitle')}
                description={t('syncedListsPage.subscriberSectionBody')}
                count={subscribedSyncs.length}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                {subscribedSyncs.map((sync) => (
                  <SyncCard key={`subscribed-${sync.id}`} sync={sync} role="subscriber" />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </AppPageLayout>
  );
};
