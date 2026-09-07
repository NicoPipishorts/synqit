import { OnboardingPanel, RouteLoadingScreen, Sticker, useToast } from '@synqit/ui';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  LayoutDashboard,
  Link2,
  ListMusic,
  Music,
  Plus,
  Radio,
  RefreshCcw,
  Sparkles,
  Users,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';

import { AppPageLayout } from '../components/app/AppPageLayout';
import {
  DashboardActivityFeed,
  type ActivityFeedItem,
} from '../components/dashboard/DashboardActivityFeed';
import { DashboardFollowersRow } from '../components/dashboard/DashboardFollowersRow';
import {
  DashboardPlaylistCard,
  type PlaylistCardRole,
  type PlaylistCardType,
} from '../components/dashboard/DashboardPlaylistCard';
import { DashboardStats, type DashboardStat } from '../components/dashboard/DashboardStats';
import { PwaInstallPrompt } from '../components/dashboard/PwaInstallPrompt';
import { CTALink } from '../components/ui/cta';
import { useI18n } from '../hooks/useI18n';
import {
  fetchDashboardSummary,
  fetchDashboardTopFollowers,
  fetchDrafts,
  fetchPersonalInfo,
  fetchSyncCollections,
  queryKeys,
  syncQueryKeys,
} from '../lib/queries';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PlaylistCardItem = {
  id: string;
  playlistName: string;
  href: string;
  role: PlaylistCardRole;
  roleLabel: string;
  type: PlaylistCardType;
  signal: string | null;
  signalActive: boolean;
  live: boolean;
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DashboardPage = () => {
  const { t, locale } = useI18n();
  const { showToast } = useToast();

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

  const personalInfoQuery = useQuery({
    queryKey: queryKeys.personalInfo.detail(),
    queryFn: fetchPersonalInfo,
    staleTime: 300_000,
  });

  const topFollowersQuery = useQuery({
    queryKey: queryKeys.dashboard.topFollowers(),
    queryFn: fetchDashboardTopFollowers,
    staleTime: 120_000,
  });

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const activeDraft = draftsQuery.data?.[0] ?? null;
  const summary = dashboardSummaryQuery.data;
  const topFollowers = topFollowersQuery.data?.followers ?? [];

  // Stable references so the downstream useMemo hooks don't recompute every render.
  const trackedEventActivity = useMemo(() => summary?.trackedEventActivity ?? [], [summary]);
  const visitedEventActivity = useMemo(() => summary?.visitedEventActivity ?? [], [summary]);
  const ownerEventActivity = useMemo(() => summary?.ownerEventActivity ?? [], [summary]);
  const ownerSyncActivity = useMemo(() => summary?.ownerSyncActivity ?? [], [summary]);
  const subscriberSyncActivity = useMemo(() => summary?.subscriberSyncActivity ?? [], [summary]);

  const subscribedSyncMap = useMemo(
    () => new Map((syncsQuery.data?.subscribedSyncs ?? []).map((s) => [s.id, s])),
    [syncsQuery.data?.subscribedSyncs],
  );

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
      type: 'event' as const,
      signal:
        item.addedTrackCount24h > 0
          ? t('dashboard.metricSongsAdded24h', { count: item.addedTrackCount24h })
          : null,
      signalActive: item.addedTrackCount24h > 0,
      live: item.addedTrackCount24h > 0,
      sortAt: toTimestamp(item.latestActivityAt),
    }));

    const syncCards = ownerSyncActivity.map((item) => ({
      id: `owned-sync-${item.syncId}`,
      playlistName: item.name,
      href: `/synced-lists/${item.syncId}`,
      role: 'owner' as const,
      roleLabel: t('dashboard.roleOwner'),
      type: 'sync' as const,
      signal: t('dashboard.metricTotalSubscribers', { count: item.totalSubscriberCount }),
      signalActive: item.newSubscriberCount24h > 0,
      live: item.newSubscriberCount24h > 0,
      sortAt: toTimestamp(item.latestActivityAt),
    }));

    return [...syncCards, ...eventCards].sort((a, b) => b.sortAt - a.sortAt);
  }, [ownerEventActivity, ownerSyncActivity, t]);

  const joinedCards = useMemo<PlaylistCardItem[]>(() => {
    const trackedCards = trackedEventActivity.map((item) => ({
      id: `tracked-event-${item.eventId}`,
      playlistName: item.name,
      href: `/playlist/${item.magicLinkToken}`,
      role: 'tracked' as const,
      roleLabel: t('dashboard.roleTracked'),
      type: 'event' as const,
      signal:
        item.addedTrackCount24h > 0
          ? t('dashboard.metricRecentSongs', { count: item.addedTrackCount24h })
          : null,
      signalActive: item.addedTrackCount24h > 0,
      live: item.addedTrackCount24h > 0,
      sortAt: toTimestamp(item.latestActivityAt),
    }));

    const visitedCards = visitedEventActivity.map((item) => ({
      id: `visited-event-${item.magicLinkToken}`,
      playlistName: item.name,
      href: `/playlist/${item.magicLinkToken}`,
      role: 'visited' as const,
      roleLabel: t('dashboard.roleVisited'),
      type: 'event' as const,
      signal:
        item.addedTrackCount24h > 0
          ? t('dashboard.metricRecentSongs', { count: item.addedTrackCount24h })
          : null,
      signalActive: item.addedTrackCount24h > 0,
      live: item.addedTrackCount24h > 0,
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
        type: 'sync' as const,
        signal:
          item.addedTrackCount7d > 0
            ? t('dashboard.metricSongsAdded7d', { count: item.addedTrackCount7d })
            : null,
        signalActive: item.ownerAddedTracks7d,
        live: item.ownerAddedTracks7d,
        sortAt: toTimestamp(item.latestActivityAt),
      };
    });

    return [...trackedCards, ...visitedCards, ...subscriberCards].sort(
      (a, b) => b.sortAt - a.sortAt,
    );
  }, [subscribedSyncMap, subscriberSyncActivity, t, trackedEventActivity, visitedEventActivity]);

  // ---------------------------------------------------------------------------
  // Activity feed
  // ---------------------------------------------------------------------------

  const activityItems = useMemo<ActivityFeedItem[]>(() => {
    const ownerEventRows = ownerEventActivity
      .filter((item) => item.addedTrackCount24h > 0)
      .map((item) => ({
        id: `activity-owner-event-${item.eventId}`,
        kind: 'songs' as const,
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
          kind: 'subscriber' as const,
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
            kind: 'subscriber' as const,
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

    const trackedRows = trackedEventActivity
      .filter((item) => item.addedTrackCount24h > 0)
      .map((item) => ({
        id: `activity-tracked-event-${item.eventId}`,
        kind: 'songs' as const,
        playlistName: item.name,
        href: `/playlist/${item.magicLinkToken}`,
        description: t('dashboard.activityTrackedSongs', { count: item.addedTrackCount24h }),
        timeLabel: formatTimeAgo(item.latestActivityAt, locale),
        sortAt: toTimestamp(item.latestActivityAt),
      }));

    const visitedRows = visitedEventActivity
      .filter((item) => item.addedTrackCount24h > 0)
      .map((item) => ({
        id: `activity-visited-event-${item.magicLinkToken}`,
        kind: 'songs' as const,
        playlistName: item.name,
        href: `/playlist/${item.magicLinkToken}`,
        description: t('dashboard.activityVisitedSongs', { count: item.addedTrackCount24h }),
        timeLabel: formatTimeAgo(item.latestActivityAt, locale),
        sortAt: toTimestamp(item.latestActivityAt),
      }));

    const subscriberRows = subscriberSyncActivity
      .filter((item) => item.addedTrackCount7d > 0)
      .map((item) => {
        const sync = subscribedSyncMap.get(item.syncId);
        return {
          id: `activity-subscriber-sync-${item.syncId}`,
          kind: 'songs' as const,
          playlistName: sync?.name ?? item.name,
          href: sync ? `/sync/${sync.magicLinkToken}` : '#',
          description: t('dashboard.activitySubscriberSongs', { count: item.addedTrackCount7d }),
          timeLabel: formatTimeAgo(item.latestActivityAt, locale),
          sortAt: toTimestamp(item.latestActivityAt),
        };
      });

    return [
      ...ownerSyncRows,
      ...ownerEventRows,
      ...trackedRows,
      ...visitedRows,
      ...subscriberRows,
    ].sort((a, b) => b.sortAt - a.sortAt);
  }, [
    locale,
    ownerEventActivity,
    ownerSyncActivity,
    subscribedSyncMap,
    subscriberSyncActivity,
    t,
    trackedEventActivity,
    visitedEventActivity,
  ]);

  // ---------------------------------------------------------------------------
  // Summary stats
  // ---------------------------------------------------------------------------

  const stats = useMemo<DashboardStat[]>(() => {
    const hostedEvents = ownerEventActivity.length;
    const hostedSyncs = ownerSyncActivity.length;
    const totalSubscribers = ownerSyncActivity.reduce((sum, s) => sum + s.totalSubscriberCount, 0);
    const newSubscribers24h = ownerSyncActivity.reduce(
      (sum, s) => sum + s.newSubscriberCount24h,
      0,
    );
    const songsAdded24h = ownerEventActivity.reduce((sum, e) => sum + e.addedTrackCount24h, 0);

    return [
      {
        id: 'hosting',
        label: t('dashboard.statHosting'),
        value: hostedEvents + hostedSyncs,
        hint: t('dashboard.statHostingDetail', { events: hostedEvents, syncs: hostedSyncs }),
        icon: Radio,
      },
      {
        id: 'subscribers',
        label: t('dashboard.statSubscribers'),
        value: totalSubscribers,
        hint:
          newSubscribers24h > 0
            ? t('dashboard.statSubscribersDelta', { count: newSubscribers24h })
            : t('dashboard.statSubscribersHint'),
        hintActive: newSubscribers24h > 0,
        icon: Users,
      },
      {
        id: 'added',
        label: t('dashboard.statAddedToday'),
        value: songsAdded24h,
        hint: t('dashboard.statAddedTodayHint'),
        hintActive: songsAdded24h > 0,
        icon: Music,
      },
      {
        id: 'joined',
        label: t('dashboard.statJoined'),
        value: joinedCards.length,
        hint: t('dashboard.statJoinedHint'),
        icon: Link2,
      },
    ];
  }, [ownerEventActivity, ownerSyncActivity, joinedCards.length, t]);

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

  const hasDashboardContent = ownedCards.length > 0 || joinedCards.length > 0;
  const isInitialLoad = syncsQuery.isLoading || dashboardSummaryQuery.isLoading;
  const isFetching = syncsQuery.isFetching || dashboardSummaryQuery.isFetching;
  const isResolvingEmptyState =
    (!syncsQuery.data || !dashboardSummaryQuery.data) && !hasDashboardContent && isInitialLoad;
  const newEventTo = activeDraft ? `/playlists/new?draftId=${activeDraft.id}` : '/playlists/new';
  const newEventLabel = activeDraft ? t('dashboard.ctaResumeDraft') : t('dashboard.ctaCreateEvent');

  const personalInfo = personalInfoQuery.data;
  const greetingName = personalInfo?.displayName?.trim() || personalInfo?.firstName?.trim() || null;
  const headingTitle = greetingName
    ? t('dashboard.greeting', { name: greetingName })
    : t('dashboard.title');

  return (
    <AppPageLayout bodyClassName="gap-8">
      <PwaInstallPrompt />

      {isResolvingEmptyState ? <RouteLoadingScreen /> : null}

      {!isResolvingEmptyState && !hasDashboardContent && !isInitialLoad ? (
        <div className="grid min-h-[60vh] items-center">
          <OnboardingPanel
            eyebrow={t('dashboard.onboardingEyebrow')}
            title={t('dashboard.onboardingTitle')}
            body={t('dashboard.onboardingBody')}
            icon={<Sparkles size={24} aria-hidden="true" />}
            note={t('dashboard.onboardingNote')}
            actions={
              <>
                <CTALink
                  to={activeDraft ? `/playlists/new?draftId=${activeDraft.id}` : '/playlists/new'}
                  variant="primary"
                  size="lg"
                  className="justify-center"
                >
                  {activeDraft
                    ? t('dashboard.ctaResumeDraft')
                    : t('dashboard.ctaCreateEventPlaylist')}
                </CTALink>
                <CTALink
                  to="/synced-lists/new"
                  variant="secondary"
                  size="lg"
                  className="justify-center"
                >
                  {t('dashboard.ctaCreateSyncedPlaylist')}
                </CTALink>
              </>
            }
            steps={[
              {
                icon: <CalendarDays size={18} aria-hidden="true" />,
                title: t('dashboard.onboardingStepEventsTitle'),
                body: t('dashboard.onboardingStepEventsBody'),
              },
              {
                icon: <ListMusic size={18} aria-hidden="true" />,
                title: t('dashboard.onboardingStepSyncTitle'),
                body: t('dashboard.onboardingStepSyncBody'),
              },
              {
                icon: <LayoutDashboard size={18} aria-hidden="true" />,
                title: t('dashboard.onboardingStepAudienceTitle'),
                body: t('dashboard.onboardingStepAudienceBody'),
              },
            ]}
          />
        </div>
      ) : !isResolvingEmptyState ? (
        <>
          {/* Page header */}
          <header className="flex items-end justify-between gap-4 sm:px-1 sm:pb-2">
            <div className="flex flex-col items-start gap-3">
              <Sticker tone="paper" tilt="-rotate-2">
                {t('dashboard.pill')}
              </Sticker>
              <h1 className="text-3xl font-black leading-[1.02] tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl">
                {greetingName && headingTitle.includes(greetingName) ? (
                  <>
                    {headingTitle.slice(0, headingTitle.indexOf(greetingName))}
                    <span className="relative inline-block px-1">
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-0 inset-y-[8%] -skew-x-6 -rotate-1 rounded-md bg-brand-lime"
                      />
                      <span className="relative text-brand-dark">{greetingName}</span>
                    </span>
                    {headingTitle.slice(headingTitle.indexOf(greetingName) + greetingName.length)}
                  </>
                ) : (
                  headingTitle
                )}
              </h1>
            </div>
            <div className="hidden shrink-0 items-center gap-3 sm:flex">
              <CTALink to="/synced-lists/new" variant="secondary" size="lg">
                {t('dashboard.ctaCreateSyncedPlaylist')}
              </CTALink>
              <CTALink to={newEventTo} variant="primary" size="lg">
                <Plus size={16} aria-hidden="true" />
                {newEventLabel}
              </CTALink>
            </div>
          </header>

          <div className="grid gap-3 sm:hidden">
            <CTALink to={newEventTo} variant="primary" className="w-full justify-center">
              <Plus size={16} aria-hidden="true" />
              {newEventLabel}
            </CTALink>
            <CTALink to="/synced-lists/new" variant="secondary" className="w-full justify-center">
              {t('dashboard.ctaCreateSyncedPlaylist')}
            </CTALink>
          </div>

          {/* Stat band */}
          <DashboardStats stats={stats} />

          {/* Top followers */}
          <DashboardFollowersRow
            followers={topFollowers}
            title={t('dashboard.followersTitle')}
            subtitle={t('dashboard.followersSubtitle')}
            viewAllLabel={t('dashboard.followersViewAll')}
            viewAllTo="/followers"
            emptyLabel={t('dashboard.followersEmpty')}
          />

          {/* Playlists + activity */}
          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
            <section className="grid gap-4">
              <div className="flex items-center justify-between px-1">
                <h2 className="flex items-center gap-3 text-lg font-black tracking-tight text-brand-dark dark:text-brand-white">
                  <Sticker tone="lime" tilt="-rotate-2">
                    01
                  </Sticker>
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

              <div className="overflow-hidden rounded-3xl border-2 border-app-text bg-app-elevated shadow-sticker dark:bg-app-card">
                {ownedCards.length > 0 ? (
                  <>
                    <div className="border-b-2 border-app-text bg-app-surface px-4 py-2.5 dark:bg-app-elevated">
                      <Sticker tone="lime">{t('dashboard.overviewOwnedTitle')}</Sticker>
                    </div>
                    {ownedCards.map((card) => (
                      <DashboardPlaylistCard key={card.id} {...card} />
                    ))}
                  </>
                ) : null}

                {joinedCards.length > 0 ? (
                  <>
                    <div className="border-b-2 border-app-text bg-app-surface px-4 py-2.5 dark:bg-app-elevated">
                      <Sticker tone="pink">{t('dashboard.overviewJoinedTitle')}</Sticker>
                    </div>
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

            <section className="grid gap-4 lg:sticky lg:top-28">
              <h2 className="flex items-center gap-3 px-1 text-lg font-black tracking-tight text-brand-dark dark:text-brand-white">
                <Sticker tone="pink" tilt="rotate-2">
                  02
                </Sticker>
                {t('dashboard.activityTitle')}
              </h2>
              <div className="overflow-hidden rounded-3xl border-2 border-app-text bg-app-elevated shadow-sticker dark:bg-app-card">
                <DashboardActivityFeed
                  items={activityItems}
                  emptyLabel={t('dashboard.activityEmpty')}
                  unknownTimeLabel={t('dashboard.activityTimeUnknown')}
                />
              </div>
            </section>
          </div>
        </>
      ) : null}
    </AppPageLayout>
  );
};
