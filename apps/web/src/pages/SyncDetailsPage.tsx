import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { Link2, ListMusic, Pencil, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

import { AppPageLayout } from '../components/app/AppPageLayout';
import { AppSurfaceCard } from '../components/app/AppSurfaceCard';
import { BlurSpotLayer } from '../components/shell/BackgroundBlurSpots';
import { SyncMagicLinkCard } from '../components/syncs/SyncMagicLinkCard';
import { CircleChevronBackButton } from '../components/ui/CircleChevronBackButton';
import { useI18n } from '../hooks/useI18n';
import { useToast } from '../hooks/useToast';
import { toApiError } from '../lib/api';
import {
  fetchSyncDetail,
  regenerateSyncMagicLink,
  revokeSyncMagicLink,
  syncQueryKeys,
  updateSync,
} from '../lib/queries';

type ManageTab = 'edit' | 'tracks' | 'share';

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
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ManageTab>('edit');

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
  const tabIndicatorTransform =
    activeTab === 'tracks'
      ? 'translateX(100%)'
      : activeTab === 'share'
        ? 'translateX(200%)'
        : 'translateX(0%)';

  const updateSyncMutation = useMutation({
    mutationFn: updateSync,
    onSuccess: (result) => {
      showToast(t('syncedListsPage.permissionsUpdated'), { variant: 'success' });
      void queryClient.invalidateQueries({ queryKey: syncQueryKeys.detail(syncId) });
      void queryClient.invalidateQueries({ queryKey: syncQueryKeys.list() });
      void queryClient.invalidateQueries({
        queryKey: syncQueryKeys.public(result.sync.magicLinkToken),
      });
    },
    onError: (error) => {
      showToast(t('eventsPage.error', { message: toApiError(error).message }), {
        variant: 'error',
      });
    },
  });
  const revokeMagicLinkMutation = useMutation({
    mutationFn: () => revokeSyncMagicLink(syncId),
    onSuccess: (result) => {
      showToast(t('syncedListsPage.revoked', { name: result.sync.name }), { variant: 'success' });
      void queryClient.invalidateQueries({ queryKey: syncQueryKeys.detail(syncId) });
      void queryClient.invalidateQueries({ queryKey: syncQueryKeys.list() });
      void queryClient.invalidateQueries({
        queryKey: syncQueryKeys.public(result.sync.magicLinkToken),
      });
    },
    onError: (error) => {
      showToast(t('eventsPage.error', { message: toApiError(error).message }), {
        variant: 'error',
      });
    },
  });
  const regenerateMagicLinkMutation = useMutation({
    mutationFn: () => regenerateSyncMagicLink(syncId),
    onSuccess: (result) => {
      showToast(t('syncedListsPage.regenerated', { name: result.sync.name }), {
        variant: 'success',
      });
      void queryClient.invalidateQueries({ queryKey: syncQueryKeys.detail(syncId) });
      void queryClient.invalidateQueries({ queryKey: syncQueryKeys.list() });
      void queryClient.invalidateQueries({
        queryKey: syncQueryKeys.public(result.sync.magicLinkToken),
      });
    },
    onError: (error) => {
      showToast(t('eventsPage.error', { message: toApiError(error).message }), {
        variant: 'error',
      });
    },
  });

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
      <div className="relative grid gap-4">
        <CircleChevronBackButton to="/synced-lists" label={t('syncCreatePage.backToSyncedLists')} />

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
          <>
            <header className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-app-border bg-app-elevated shadow-lg sm:h-28 sm:w-28 dark:bg-app-card">
                <ListMusic
                  size={30}
                  className="text-app-text-secondary/40 sm:hidden"
                  aria-hidden="true"
                />
                <ListMusic
                  size={44}
                  className="hidden text-app-text-secondary/40 sm:block"
                  aria-hidden="true"
                />
              </div>

              <div className="grid gap-1 pt-1">
                <h1 className="text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl">
                  {sync.name}
                </h1>
                <p className="text-sm text-app-text-secondary sm:text-base">
                  {t('syncedListsPage.detailDescription', {
                    provider: sync.provider === 'spotify' ? 'Spotify' : 'Apple Music',
                  })}
                </p>
              </div>

              <div className="relative grid w-full max-w-md grid-cols-3 overflow-hidden rounded-3xl border border-app-border bg-app-elevated shadow-soft-lift dark:bg-app-card">
                <div
                  className="absolute inset-0 w-1/3 bg-brand-lime transition-transform duration-200 ease-in-out"
                  style={{ transform: tabIndicatorTransform }}
                />
                <button
                  type="button"
                  onClick={() => setActiveTab('edit')}
                  className={`group relative z-10 inline-flex cursor-pointer items-center justify-center gap-1.5 py-3 text-xs font-extrabold leading-none transition-colors duration-200 focus-ring-brand ${
                    activeTab === 'edit'
                      ? 'text-brand-dark'
                      : 'bg-brand-dark/5 text-app-text-secondary hover:bg-brand-lime/15 hover:text-app-text'
                  }`}
                >
                  <span
                    className={`inline-flex transition-transform duration-200 ease-out motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:-rotate-12 ${
                      activeTab === 'edit' ? '-rotate-6 -translate-y-0.5' : ''
                    }`}
                  >
                    <Pencil size={13} aria-hidden="true" />
                  </span>
                  {t('eventsPage.edit')}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('tracks')}
                  className={`group relative z-10 inline-flex cursor-pointer items-center justify-center gap-1.5 py-3 text-xs font-extrabold leading-none transition-colors duration-200 focus-ring-brand ${
                    activeTab === 'tracks'
                      ? 'text-brand-dark'
                      : 'bg-brand-dark/5 text-app-text-secondary hover:bg-brand-lime/15 hover:text-app-text'
                  }`}
                >
                  <span
                    className={`inline-flex transition-transform duration-200 ease-out motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:scale-110 ${
                      activeTab === 'tracks' ? '-translate-y-0.5 scale-105' : ''
                    }`}
                  >
                    <ListMusic size={13} aria-hidden="true" />
                  </span>
                  {t('eventsPage.track')}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('share')}
                  className={`group relative z-10 inline-flex cursor-pointer items-center justify-center gap-1.5 py-3 text-xs font-extrabold leading-none transition-colors duration-200 focus-ring-brand ${
                    activeTab === 'share'
                      ? 'text-brand-dark'
                      : 'bg-brand-dark/5 text-app-text-secondary hover:bg-brand-lime/15 hover:text-app-text'
                  }`}
                >
                  <span
                    className={`inline-flex transition-transform duration-200 ease-out motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:rotate-12 ${
                      activeTab === 'share' ? 'translate-x-0.5 -translate-y-0.5 rotate-6' : ''
                    }`}
                  >
                    <Link2 size={13} aria-hidden="true" />
                  </span>
                  {t('eventsPage.share')}
                </button>
              </div>
            </header>

            <div className="grid gap-4">
              <div className="flex flex-col gap-4">
                {activeTab === 'edit' ? (
                  <>
                    <AppSurfaceCard className="grid gap-4">
                      <div className="grid gap-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-app-text-secondary">
                          {t('syncedListsPage.permissionsTitle')}
                        </p>
                        <p className="text-sm text-app-text-secondary">
                          {t('syncedListsPage.permissionsBody')}
                        </p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {(['host_only', 'bidirectional'] as const).map((mode) => {
                          const isSelected = sync.syncMode === mode;

                          return (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => {
                                if (isSelected || updateSyncMutation.isPending) {
                                  return;
                                }
                                updateSyncMutation.mutate({ syncId, syncMode: mode });
                              }}
                              className={`relative inline-flex items-center justify-center rounded-xl border px-4 py-3 text-sm font-black transition ${
                                isSelected
                                  ? 'border-brand-lime/50 bg-brand-lime/12 text-brand-dark shadow-soft-lift dark:text-brand-white'
                                  : 'border-app-border bg-app-elevated text-app-text-secondary hover:border-brand-pink hover:text-brand-pink dark:bg-app-card'
                              } ${updateSyncMutation.isPending ? 'cursor-wait' : 'cursor-pointer'}`}
                              disabled={updateSyncMutation.isPending}
                            >
                              <AnimatePresence initial={false}>
                                {isSelected ? (
                                  <motion.span
                                    key={`${mode}-check`}
                                    initial={{ opacity: 0, scale: 0.2, y: 2 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.2, y: -2 }}
                                    transition={{
                                      duration: 0.2,
                                      delay: 0.14,
                                      ease: [0.22, 1, 0.36, 1],
                                    }}
                                    className="absolute right-3 top-1/2 inline-flex h-4.5 w-4.5 -translate-y-1/2 items-center justify-center rounded-full bg-brand-lime text-brand-white"
                                  >
                                    <motion.svg
                                      width="11"
                                      height="11"
                                      viewBox="0 0 12 12"
                                      fill="none"
                                      aria-hidden="true"
                                      className="overflow-visible"
                                      initial="hidden"
                                      animate="visible"
                                      exit="hidden"
                                      transition={{
                                        duration: 0.18,
                                        delay: 0.3,
                                        ease: [0.33, 1, 0.68, 1],
                                      }}
                                    >
                                      <motion.path
                                        d="M2 6.2L4.6 8.8L10 3.4"
                                        stroke="currentColor"
                                        strokeWidth="1.9"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        variants={{
                                          hidden: { pathLength: 0, opacity: 0 },
                                          visible: { pathLength: 1, opacity: 1 },
                                        }}
                                      />
                                    </motion.svg>
                                  </motion.span>
                                ) : null}
                              </AnimatePresence>
                              <span>
                                {mode === 'bidirectional'
                                  ? t('syncCreatePage.syncModeBidirectionalLabel')
                                  : t('syncCreatePage.syncModeHostOnlyLabel')}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-2 grid gap-1 px-1">
                        <p className="text-sm font-black tracking-tight text-brand-dark dark:text-brand-white">
                          {sync.syncMode === 'bidirectional'
                            ? t('syncCreatePage.syncModeBidirectionalTitle')
                            : t('syncCreatePage.syncModeHostOnlyTitle')}
                        </p>
                        <p className="text-sm text-app-text-secondary">
                          {sync.syncMode === 'bidirectional'
                            ? t('syncCreatePage.syncModeBidirectionalBody')
                            : t('syncCreatePage.syncModeHostOnlyBody')}
                        </p>
                        {updateSyncMutation.isPending ? (
                          <p className="pt-1 text-[11px] font-semibold text-brand-pink">
                            {t('syncedListsPage.permissionsSaving')}
                          </p>
                        ) : null}
                      </div>
                    </AppSurfaceCard>

                    <AppSurfaceCard className="grid gap-4">
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
                  </>
                ) : activeTab === 'share' ? (
                  <div className="mx-auto w-full">
                    <SyncMagicLinkCard
                      sync={sync}
                      isWorking={
                        revokeMagicLinkMutation.isPending || regenerateMagicLinkMutation.isPending
                      }
                      onRevoke={() => revokeMagicLinkMutation.mutate()}
                      onRegenerate={() => regenerateMagicLinkMutation.mutate()}
                    />
                  </div>
                ) : (
                  <div className="mx-auto w-full max-w-2xl">
                    <div className="grid gap-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="pl-4 text-xs font-semibold text-app-text-secondary">
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
                          <ListMusic
                            size={32}
                            className="text-app-text-secondary/40"
                            aria-hidden="true"
                          />
                          <p className="text-sm font-semibold text-app-text-secondary">
                            {t('syncedListsPage.noTracks')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AppPageLayout>
  );
};
