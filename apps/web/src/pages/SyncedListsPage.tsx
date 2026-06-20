import { useQuery } from '@tanstack/react-query';
import { ListMusic, Plus } from 'lucide-react';

import { AppEmptyState } from '../components/app/AppEmptyState';
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

  const ownedSyncs = syncsQuery.data?.ownedSyncs ?? [];
  const subscribedSyncs = syncsQuery.data?.subscribedSyncs ?? [];
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
        <div className="flex min-h-[calc(100svh-24rem)] items-start justify-center pt-8 sm:pt-16">
          <AppEmptyState
            icon={<ListMusic size={36} aria-hidden="true" />}
            title={t('syncedListsPage.emptyTitle')}
            body={t('syncedListsPage.emptyBody')}
            action={
              <CTALink to="/synced-lists/new" variant="primary" size="lg">
                {t('syncedListsPage.shareFirst')}
              </CTALink>
            }
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
