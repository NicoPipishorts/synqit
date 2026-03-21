import { useQuery } from '@tanstack/react-query';
import { ListMusic, Plus } from 'lucide-react';

import { AppPageHeader } from '../components/app/AppPageHeader';
import { AppPageLayout } from '../components/app/AppPageLayout';
import { BlurSpotLayer } from '../components/shell/BackgroundBlurSpots';
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
    <AppPageLayout
      bodyClassName="gap-8"
      backdrop={
        <BlurSpotLayer
          filterId="synced-lists-blur"
          className="pointer-events-none absolute inset-0 z-0"
          spots={[
            {
              id: 'synced-lists-a',
              size: 180,
              top: 20,
              left: 15,
              color: 'rgba(198,241,53,0.07)',
            },
            {
              id: 'synced-lists-b',
              size: 200,
              top: 65,
              left: 80,
              color: 'rgba(232,87,154,0.06)',
            },
          ]}
        />
      }
    >
      {hasAny ? (
        <AppPageHeader
          eyebrow={t('syncedListsPage.title')}
          title={t('syncedListsPage.myTitle')}
          description={t('syncedListsPage.description')}
          actions={
            <CTALink
              to="/synced-lists/new"
              variant="primary"
              className="justify-center gap-2 px-4 py-2.5 text-sm font-black"
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
          <div className="relative w-85 p-6 sm:w-[35vw] sm:p-10">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 h-7 w-7 rounded-tl-lg border-l border-t border-brand-dark dark:border-brand-white"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-0 h-7 w-7 rounded-tr-lg border-r border-t border-brand-dark dark:border-brand-white"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 left-0 h-7 w-7 rounded-bl-lg border-b border-l border-brand-dark dark:border-brand-white"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 right-0 h-7 w-7 rounded-br-lg border-b border-r border-brand-dark dark:border-brand-white"
            />
            <div className="flex flex-col items-center gap-6 text-center">
              <ListMusic size={36} className="text-app-text-secondary/40" aria-hidden="true" />
              <div className="flex flex-col items-center gap-2">
                <p className="text-2xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-3xl">
                  {t('syncedListsPage.emptyTitle')}
                </p>
                <p className="text-sm text-app-text-secondary sm:text-base">
                  {t('syncedListsPage.emptyBody')}
                </p>
              </div>
              <CTALink to="/synced-lists/new" variant="primary" size="lg">
                {t('syncedListsPage.shareFirst')}
              </CTALink>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-8">
          {ownedSyncs.length > 0 ? (
            <section className="grid gap-4">
              <div className="grid gap-1">
                <h2 className="text-xl font-black tracking-tight text-brand-dark dark:text-brand-white">
                  {t('syncedListsPage.ownerSectionTitle')}
                </h2>
                <p className="text-sm text-app-text-secondary">
                  {t('syncedListsPage.ownerSectionBody')}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {ownedSyncs.map((sync) => (
                  <SyncCard
                    key={`owned-${sync.id}`}
                    sync={sync}
                    detailTo={`/synced-lists/${sync.id}`}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {subscribedSyncs.length > 0 ? (
            <section className="grid gap-4">
              <div className="grid gap-1">
                <h2 className="text-xl font-black tracking-tight text-brand-dark dark:text-brand-white">
                  {t('syncedListsPage.subscriberSectionTitle')}
                </h2>
                <p className="text-sm text-app-text-secondary">
                  {t('syncedListsPage.subscriberSectionBody')}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {subscribedSyncs.map((sync) => (
                  <SyncCard key={`subscribed-${sync.id}`} sync={sync} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </AppPageLayout>
  );
};
