import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { ArrowUpRight, ListMusic, Users } from 'lucide-react';
import { useEffect } from 'react';

import { AppPageHeader } from '../components/app/AppPageHeader';
import { AppPageLayout } from '../components/app/AppPageLayout';
import { AppSurfaceCard } from '../components/app/AppSurfaceCard';
import { BlurSpotLayer } from '../components/shell/BackgroundBlurSpots';
import { useI18n } from '../hooks/useI18n';
import { useToast } from '../hooks/useToast';
import { toApiError } from '../lib/api';
import { fetchSyncDetail, syncQueryKeys } from '../lib/queries';

const formatSyncTimestamp = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

export const SyncDetailsPage = () => {
  const { t } = useI18n();
  const { showToast } = useToast();
  const { syncId } = useParams({ from: '/synced-lists/$syncId' });

  const syncQuery = useQuery({
    queryKey: syncQueryKeys.detail(syncId),
    queryFn: () => fetchSyncDetail(syncId),
  });

  useEffect(() => {
    if (!syncQuery.isError) {
      return;
    }

    showToast(t('eventsPage.error', { message: toApiError(syncQuery.error).message }), {
      variant: 'error',
    });
  }, [showToast, syncQuery.error, syncQuery.isError, t]);

  const sync = syncQuery.data ?? null;
  const formattedLastSyncedAt = formatSyncTimestamp(sync?.lastSyncedAt ?? null);
  const spotifyCount =
    sync?.subscriberPlatformStats.find((stat) => stat.provider === 'spotify')?.count ?? 0;
  const appleCount =
    sync?.subscriberPlatformStats.find((stat) => stat.provider === 'apple')?.count ?? 0;

  return (
    <AppPageLayout
      bodyClassName="gap-6"
      backdrop={
        <BlurSpotLayer
          filterId="sync-detail-blur"
          className="pointer-events-none absolute inset-0 z-0"
          spots={[
            {
              id: 'sync-detail-a',
              size: 210,
              top: 12,
              left: 12,
              color: 'rgba(198,241,53,0.07)',
            },
            {
              id: 'sync-detail-b',
              size: 220,
              top: 60,
              left: 78,
              color: 'rgba(232,87,154,0.06)',
            },
          ]}
        />
      }
    >
      <AppPageHeader
        title={sync?.name ?? t('syncedListsPage.detailTitleFallback')}
        description={
          sync
            ? t('syncedListsPage.detailDescription', {
                provider: sync.provider === 'spotify' ? 'Spotify' : 'Apple Music',
              })
            : undefined
        }
        backTo="/synced-lists"
        backLabel={t('syncCreatePage.backToSyncedLists')}
        actions={
          sync ? (
            <a
              href={`/sync/${sync.magicLinkToken}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm font-semibold text-app-text shadow-soft-lift transition hover:border-brand-pink hover:text-brand-pink dark:bg-app-elevated"
            >
              {t('syncedListsPage.openSharedPage')}
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          ) : null
        }
      />

      {syncQuery.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <AppSurfaceCard className="grid gap-4">
            <div className="h-6 w-2/3 animate-pulse rounded bg-app-border" />
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="h-24 animate-pulse rounded-2xl bg-app-border" />
              <div className="h-24 animate-pulse rounded-2xl bg-app-border" />
              <div className="h-24 animate-pulse rounded-2xl bg-app-border" />
            </div>
          </AppSurfaceCard>
          <AppSurfaceCard className="grid gap-3">
            <div className="h-5 w-40 animate-pulse rounded bg-app-border" />
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-17 animate-pulse rounded-xl bg-app-border" />
            ))}
          </AppSurfaceCard>
        </div>
      ) : sync ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="grid gap-4">
            <AppSurfaceCard className="grid gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="grid gap-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-app-text-secondary">
                    {t('syncedListsPage.syncOverview')}
                  </p>
                  <p className="text-sm text-app-text-secondary">
                    {formattedLastSyncedAt
                      ? t('syncedListsPage.lastSyncedAt', { date: formattedLastSyncedAt })
                      : t('syncedListsPage.autoSyncActive')}
                  </p>
                </div>
                <Link
                  to="/sync/$token"
                  params={{ token: sync.magicLinkToken }}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-app-border bg-app-surface transition hover:border-brand-pink hover:text-brand-pink dark:bg-app-elevated"
                >
                  <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-app-border bg-app-surface p-4 dark:bg-app-elevated">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-app-text-secondary">
                    {t('syncedListsPage.totalSubscribers')}
                  </p>
                  <p className="pt-2 text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white">
                    {sync.subscriberCount}
                  </p>
                </div>
                <div className="rounded-2xl border border-app-border bg-app-surface p-4 dark:bg-app-elevated">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-app-text-secondary">
                    Spotify
                  </p>
                  <p className="pt-2 text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white">
                    {spotifyCount}
                  </p>
                </div>
                <div className="rounded-2xl border border-app-border bg-app-surface p-4 dark:bg-app-elevated">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-app-text-secondary">
                    Apple Music
                  </p>
                  <p className="pt-2 text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white">
                    {appleCount}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-app-border bg-app-surface p-4 dark:bg-app-elevated">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-app-text-secondary" aria-hidden="true" />
                  <p className="text-sm font-semibold text-brand-dark dark:text-brand-white">
                    {t('syncedListsPage.subscriberBreakdown')}
                  </p>
                </div>
                <div className="mt-3 grid gap-2">
                  {sync.subscriberPlatformStats.map((stat) => (
                    <div
                      key={stat.provider}
                      className="flex items-center justify-between rounded-xl border border-app-border px-3 py-2 text-sm dark:bg-app-card"
                    >
                      <span className="font-semibold text-brand-dark dark:text-brand-white">
                        {stat.provider === 'spotify' ? 'Spotify' : 'Apple Music'}
                      </span>
                      <span className="text-app-text-secondary">{stat.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </AppSurfaceCard>
          </div>

          <AppSurfaceCard className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-brand-dark dark:text-brand-white">
                {t('syncedListsPage.sourceTracks', { count: sync.tracks.length })}
              </p>
              <span className="text-xs text-app-text-secondary">
                {sync.trackCount !== null
                  ? t('syncCreatePage.trackCount', { count: sync.trackCount })
                  : t('syncCreatePage.trackCountUnavailable')}
              </span>
            </div>

            {sync.tracks.length > 0 ? (
              <ul className="grid gap-3">
                {sync.tracks.map((track) => (
                  <li
                    key={track.providerTrackId}
                    className="flex min-w-0 items-center gap-3 rounded-xl border border-app-border bg-app-bg px-3 py-3 shadow-soft-lift dark:bg-app-elevated"
                  >
                    {track.artworkUrl ? (
                      <img
                        src={track.artworkUrl}
                        alt=""
                        width={44}
                        height={44}
                        className="h-11 w-11 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-app-border text-xs text-app-text-secondary">
                        <ListMusic size={14} aria-hidden="true" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-brand-dark dark:text-brand-white">
                        {track.name}
                      </p>
                      <p className="truncate text-xs text-app-text-secondary">
                        {track.artist} · {track.album}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <ListMusic size={32} className="text-app-text-secondary/40" aria-hidden="true" />
                <p className="text-sm font-semibold text-app-text-secondary">
                  {t('syncedListsPage.noTracks')}
                </p>
              </div>
            )}
          </AppSurfaceCard>
        </div>
      ) : null}
    </AppPageLayout>
  );
};
