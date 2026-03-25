import { eventTracksResponseSchema, type EventTrack } from '@synqit/shared';
import { useQuery } from '@tanstack/react-query';
import { Plus, RefreshCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { AppPageLayout } from '../components/app/AppPageLayout';
import {
  DashboardActivityFeed,
  type ActivityFeedItem,
} from '../components/dashboard/DashboardActivityFeed';
import {
  DashboardPlaylistCard,
  type PlaylistCardRole,
} from '../components/dashboard/DashboardPlaylistCard';
import { PwaInstallPrompt } from '../components/dashboard/PwaInstallPrompt';
import { BlurSpotLayer } from '../components/shell/BackgroundBlurSpots';
import { CTALink } from '../components/ui/cta';
import { useI18n } from '../hooks/useI18n';
import { useToast } from '../hooks/useToast';
import { callApi } from '../lib/api';
import {
  readDashboardGuestEvents,
  type DashboardGuestEventHistoryItem,
} from '../lib/dashboard-guest-events';
import {
  fetchDashboardSummary,
  fetchDrafts,
  fetchSyncCollections,
  queryKeys,
  syncQueryKeys,
} from '../lib/queries';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GuestEventActivity = {
  magicLinkToken: string;
  name: string;
  recentAddedCount: number;
  latestActivityAt: string | null;
};

type PlaylistCardItem = {
  id: string;
  playlistName: string;
  href: string;
  role: PlaylistCardRole;
  roleLabel: string;
  signal: string | null;
  signalActive: boolean;
  sortAt: number;
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

const toTimestamp = (value: string | null | undefined): number => {
  if (!value) return 0;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? 0 : ts;
};

const formatTimeAgo = (value: string | null, locale: string): string | null => {
  if (!value) return null;
  try {
    const diff = Date.now() - Date.parse(value);
    const mins = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days = Math.floor(diff / DAY_MS);
    const fr = locale === 'fr';
    if (mins < 1) return fr ? "À l'instant" : 'Just now';
    if (mins < 60) return fr ? `Il y a ${mins} min` : `${mins}m ago`;
    if (hours < 24) return fr ? `Il y a ${hours} h` : `${hours}h ago`;
    return fr ? `Il y a ${days} j` : `${days}d ago`;
  } catch {
    return value;
  }
};

const fetchGuestActivities = async (
  history: DashboardGuestEventHistoryItem[],
): Promise<GuestEventActivity[]> => {
  const since = Date.now() - DAY_MS;
  const responses = await Promise.allSettled(
    history.map(async (item) => {
      const result = await callApi(
        `/v1/playlists/link/${encodeURIComponent(item.magicLinkToken)}/tracks`,
        { method: 'GET' },
        (payload) => eventTracksResponseSchema.parse(payload) as { tracks: EventTrack[] },
      );
      const recentTracks = result.tracks.filter((t) => toTimestamp(t.addedAt) >= since);
      return {
        magicLinkToken: item.magicLinkToken,
        name: item.name,
        recentAddedCount: recentTracks.length,
        latestActivityAt: recentTracks[0]?.addedAt ?? result.tracks[0]?.addedAt ?? null,
      };
    }),
  );

  const fulfilled: GuestEventActivity[] = [];
  for (const r of responses) {
    if (r.status === 'fulfilled') fulfilled.push(r.value);
  }
  return fulfilled.sort(
    (a, b) => toTimestamp(b.latestActivityAt) - toTimestamp(a.latestActivityAt),
  );
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DashboardPage = () => {
  const { t, locale } = useI18n();
  const { showToast } = useToast();
  const [guestHistory] = useState<DashboardGuestEventHistoryItem[]>(readDashboardGuestEvents);

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  const draftsQuery = useQuery({
    queryKey: queryKeys.drafts.list(),
    queryFn: fetchDrafts,
    staleTime: 120_000,
  });

  const syncsQuery = useQuery({
    queryKey: syncQueryKeys.list(),
    queryFn: fetchSyncCollections,
    staleTime: 120_000,
  });

  const dashboardSummaryQuery = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: fetchDashboardSummary,
    staleTime: 120_000,
  });

  const guestActivityQuery = useQuery({
    queryKey: ['dashboard', 'guest-events', guestHistory.map((i) => i.magicLinkToken)],
    enabled: guestHistory.length > 0,
    staleTime: 120_000,
    queryFn: () => fetchGuestActivities(guestHistory),
  });

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const activeDraft = draftsQuery.data?.[0] ?? null;
  const summary = dashboardSummaryQuery.data;
  const guestActivities = guestActivityQuery.data ?? [];

  const subscribedSyncMap = useMemo(
    () => new Map((syncsQuery.data?.subscribedSyncs ?? []).map((s) => [s.id, s])),
    [syncsQuery.data?.subscribedSyncs],
  );

  const ownerEventActivity = summary?.ownerEventActivity ?? [];
  const ownerSyncActivity = summary?.ownerSyncActivity ?? [];
  const subscriberSyncActivity = summary?.subscriberSyncActivity ?? [];

  // ---------------------------------------------------------------------------
  // Playlist cards
  // ---------------------------------------------------------------------------

  const ownedCards = useMemo<PlaylistCardItem[]>(() => {
    const eventCards = ownerEventActivity.map((item) => ({
      id: `owned-event-${item.eventId}`,
      playlistName: item.name,
      href: `/playlists/${item.eventId}`,
      role: 'owner' as const,
      roleLabel: t('dashboard.roleOwner'),
      signal:
        item.addedTrackCount24h > 0
          ? t('dashboard.metricSongsAdded24h', { count: item.addedTrackCount24h })
          : null,
      signalActive: item.addedTrackCount24h > 0,
      sortAt: toTimestamp(item.latestActivityAt),
    }));

    const syncCards = ownerSyncActivity.map((item) => ({
      id: `owned-sync-${item.syncId}`,
      playlistName: item.name,
      href: `/synced-lists/${item.syncId}`,
      role: 'owner' as const,
      roleLabel: t('dashboard.roleOwner'),
      signal: t('dashboard.metricTotalSubscribers', { count: item.totalSubscriberCount }),
      signalActive: item.newSubscriberCount24h > 0,
      sortAt: toTimestamp(item.latestActivityAt),
    }));

    return [...syncCards, ...eventCards].sort((a, b) => b.sortAt - a.sortAt);
  }, [ownerEventActivity, ownerSyncActivity, t]);

  const joinedCards = useMemo<PlaylistCardItem[]>(() => {
    const guestCards = guestActivities.map((item) => ({
      id: `guest-event-${item.magicLinkToken}`,
      playlistName: item.name,
      href: `/playlist/${item.magicLinkToken}`,
      role: 'guest' as const,
      roleLabel: t('dashboard.roleGuest'),
      signal:
        item.recentAddedCount > 0
          ? t('dashboard.metricRecentSongs', { count: item.recentAddedCount })
          : null,
      signalActive: item.recentAddedCount > 0,
      sortAt: toTimestamp(item.latestActivityAt),
    }));

    const subscriberCards = subscriberSyncActivity.map((item) => {
      const sync = subscribedSyncMap.get(item.syncId);
      return {
        id: `subscriber-sync-${item.syncId}`,
        playlistName: sync?.name ?? item.name,
        href: sync ? `/sync/${sync.magicLinkToken}` : '#',
        role: 'subscriber' as const,
        roleLabel: t('dashboard.roleSubscriber'),
        signal:
          item.addedTrackCount7d > 0
            ? t('dashboard.metricSongsAdded7d', { count: item.addedTrackCount7d })
            : null,
        signalActive: item.ownerAddedTracks7d,
        sortAt: toTimestamp(item.latestActivityAt),
      };
    });

    return [...guestCards, ...subscriberCards].sort((a, b) => b.sortAt - a.sortAt);
  }, [guestActivities, subscribedSyncMap, subscriberSyncActivity, t]);

  // ---------------------------------------------------------------------------
  // Activity feed
  // ---------------------------------------------------------------------------

  const activityItems = useMemo<ActivityFeedItem[]>(() => {
    const ownerEventRows = ownerEventActivity
      .filter((item) => item.addedTrackCount24h > 0)
      .map((item) => ({
        id: `activity-owner-event-${item.eventId}`,
        playlistName: item.name,
        href: `/playlists/${item.eventId}#tracks`,
        description: t('dashboard.activityOwnerEventSongs', { count: item.addedTrackCount24h }),
        timeLabel: formatTimeAgo(item.latestActivityAt, locale),
        sortAt: toTimestamp(item.latestActivityAt),
      }));

    const ownerSyncRows = ownerSyncActivity.flatMap((item) => {
      if (item.recentSubscribers.length > 0) {
        return item.recentSubscribers.map((sub) => ({
          id: `activity-owner-sync-${item.syncId}-${sub.userId}-${sub.subscribedAt}`,
          playlistName: item.name,
          href: `/synced-lists/${item.syncId}`,
          description: t('dashboard.activityOwnerSyncSubscriber', { name: sub.name }),
          timeLabel: formatTimeAgo(sub.subscribedAt, locale),
          sortAt: toTimestamp(sub.subscribedAt),
        }));
      }
      if (item.newSubscriberCount24h > 0) {
        return [
          {
            id: `activity-owner-sync-${item.syncId}`,
            playlistName: item.name,
            href: `/synced-lists/${item.syncId}`,
            description: t('dashboard.activityOwnerSyncSubscribers', {
              count: item.newSubscriberCount24h,
            }),
            timeLabel: formatTimeAgo(item.latestActivityAt, locale),
            sortAt: toTimestamp(item.latestActivityAt),
          },
        ];
      }
      return [];
    });

    const guestRows = guestActivities
      .filter((item) => item.recentAddedCount > 0)
      .map((item) => ({
        id: `activity-guest-event-${item.magicLinkToken}`,
        playlistName: item.name,
        href: `/playlist/${item.magicLinkToken}`,
        description: t('dashboard.activityGuestSongs', { count: item.recentAddedCount }),
        timeLabel: formatTimeAgo(item.latestActivityAt, locale),
        sortAt: toTimestamp(item.latestActivityAt),
      }));

    const subscriberRows = subscriberSyncActivity
      .filter((item) => item.addedTrackCount7d > 0)
      .map((item) => {
        const sync = subscribedSyncMap.get(item.syncId);
        return {
          id: `activity-subscriber-sync-${item.syncId}`,
          playlistName: sync?.name ?? item.name,
          href: sync ? `/sync/${sync.magicLinkToken}` : '#',
          description: t('dashboard.activitySubscriberSongs', { count: item.addedTrackCount7d }),
          timeLabel: formatTimeAgo(item.latestActivityAt, locale),
          sortAt: toTimestamp(item.latestActivityAt),
        };
      });

    return [...ownerSyncRows, ...ownerEventRows, ...guestRows, ...subscriberRows].sort(
      (a, b) => b.sortAt - a.sortAt,
    );
  }, [
    guestActivities,
    locale,
    ownerEventActivity,
    ownerSyncActivity,
    subscribedSyncMap,
    subscriberSyncActivity,
    t,
  ]);

  // ---------------------------------------------------------------------------
  // Error toasts — depend on the error object, not the boolean flag,
  // so the toast fires once on transition rather than on every render
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (syncsQuery.error) {
      showToast(t('dashboard.error', { message: (syncsQuery.error as Error).message }), {
        variant: 'error',
      });
    }
  }, [syncsQuery.error, showToast, t]);

  useEffect(() => {
    if (dashboardSummaryQuery.error) {
      showToast(t('dashboard.error', { message: (dashboardSummaryQuery.error as Error).message }), {
        variant: 'error',
      });
    }
  }, [dashboardSummaryQuery.error, showToast, t]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const hasDashboardContent =
    ownedCards.length > 0 || joinedCards.length > 0 || guestHistory.length > 0;
  const isInitialLoad = syncsQuery.isLoading || dashboardSummaryQuery.isLoading;
  const isFetching =
    syncsQuery.isFetching || dashboardSummaryQuery.isFetching || guestActivityQuery.isFetching;
  const showCreateCta = ownedCards.length === 0;
  const newEventTo = activeDraft ? `/playlists/new?draftId=${activeDraft.id}` : '/playlists/new';
  const newEventLabel = activeDraft ? t('dashboard.ctaResumeDraft') : t('dashboard.ctaCreateEvent');

  return (
    <AppPageLayout
      bodyClassName="gap-8"
      backdrop={
        <BlurSpotLayer
          filterId="dashboard-blur"
          className="pointer-events-none absolute inset-0 z-0"
          spots={[
            { id: 'a', size: 320, top: 0, left: 5, color: 'rgba(198,255,0,0.10)' },
            { id: 'b', size: 280, top: 8, left: 80, color: 'rgba(255,46,139,0.10)' },
            { id: 'c', size: 240, top: 60, left: 60, color: 'rgba(125,211,252,0.08)' },
          ]}
        />
      }
    >
      <PwaInstallPrompt />

      {!hasDashboardContent && !isInitialLoad ? (
        <div className="flex min-h-[60vh] flex-col items-center justify-center">
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
              <h2 className="text-2xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-3xl">
                {t('dashboard.ctaCreateFirst')}
              </h2>
              <div className="flex w-72 flex-col items-stretch gap-4">
                <CTALink
                  to={activeDraft ? `/playlists/new?draftId=${activeDraft.id}` : '/playlists/new'}
                  variant="primary"
                  size="lg"
                  className="w-full justify-center"
                >
                  {activeDraft
                    ? t('dashboard.ctaResumeDraft')
                    : t('dashboard.ctaCreateEventPlaylist')}
                </CTALink>
                <CTALink
                  to="/synced-lists/new"
                  variant="secondary"
                  size="lg"
                  className="w-full justify-center"
                >
                  {t('dashboard.ctaCreateSyncedPlaylist')}
                </CTALink>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Page header */}
          <header className="flex items-start justify-between gap-4 sm:px-2 sm:pb-2">
            <div className="grid gap-1">
              <p className="text-xs font-bold uppercase tracking-widest text-app-text-secondary">
                {t('dashboard.pill')}
              </p>
              <h1 className="text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl">
                {t('dashboard.title')}
              </h1>
            </div>
            {showCreateCta ? (
              <div className="hidden shrink-0 items-center gap-3 sm:flex">
                <CTALink to="/synced-lists/new" variant="secondary" size="lg">
                  {t('dashboard.ctaCreateSyncedPlaylist')}
                </CTALink>
                <CTALink to={newEventTo} variant="primary" size="lg">
                  <Plus size={16} aria-hidden="true" />
                  {newEventLabel}
                </CTALink>
              </div>
            ) : null}
          </header>

          {showCreateCta ? (
            <div className="grid gap-3 sm:hidden">
              <CTALink to="/synced-lists/new" variant="secondary" className="w-full justify-center">
                {t('dashboard.ctaCreateSyncedPlaylist')}
              </CTALink>
              <CTALink to={newEventTo} variant="primary" className="w-full justify-center">
                <Plus size={16} aria-hidden="true" />
                {newEventLabel}
              </CTALink>
            </div>
          ) : null}

          {/* Playlists */}
          <section className="grid gap-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-base font-black tracking-tight text-brand-dark dark:text-brand-white">
                {t('dashboard.overviewTitle')}
              </h2>
              {isFetching ? (
                <RefreshCcw
                  size={13}
                  className="animate-spin text-app-text-secondary"
                  aria-hidden="true"
                />
              ) : null}
            </div>

            <div className="overflow-hidden rounded-2xl border border-app-border bg-app-elevated dark:bg-app-card">
              {ownedCards.length > 0 ? (
                <>
                  <p className="border-b border-brand-lime bg-brand-lime/22 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] leading-none text-brand-dark dark:text-brand-white">
                    {t('dashboard.overviewOwnedTitle')}
                  </p>
                  {ownedCards.map((card) => (
                    <DashboardPlaylistCard key={card.id} {...card} />
                  ))}
                </>
              ) : null}

              {joinedCards.length > 0 ? (
                <>
                  <p className="border-b border-brand-lime bg-brand-lime/22 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] leading-none text-brand-dark dark:text-brand-white">
                    {t('dashboard.overviewJoinedTitle')}
                  </p>
                  {joinedCards.map((card) => (
                    <DashboardPlaylistCard key={card.id} {...card} />
                  ))}
                </>
              ) : null}

              {ownedCards.length === 0 && joinedCards.length === 0 ? (
                <p className="px-4 py-5 text-sm text-app-text-secondary">
                  {t('dashboard.overviewOwnedEmpty')}
                </p>
              ) : null}
            </div>
          </section>

          {/* Activity */}
          <section className="grid gap-4">
            <h2 className="px-1 text-base font-black tracking-tight text-brand-dark dark:text-brand-white">
              {t('dashboard.activityTitle')}
            </h2>
            <div className="overflow-hidden rounded-2xl border border-app-border bg-app-elevated dark:bg-app-card">
              <DashboardActivityFeed
                items={activityItems}
                emptyLabel={t('dashboard.activityEmpty')}
                unknownTimeLabel={t('dashboard.activityTimeUnknown')}
              />
            </div>
          </section>
        </>
      )}
    </AppPageLayout>
  );
};
