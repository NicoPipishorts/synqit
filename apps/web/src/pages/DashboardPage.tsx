import { eventTracksResponseSchema } from '@synqit/shared';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Music2, Plus, RefreshCcw, Rss, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AppPageLayout } from '../components/app/AppPageLayout';
import { PwaInstallPrompt } from '../components/dashboard/PwaInstallPrompt';
import { EventStatusIndicator } from '../components/events/EventStatusIndicator';
import { BlurSpotLayer } from '../components/shell/BackgroundBlurSpots';
import { CTAButton, CTALink, CTAMobileIconLabel } from '../components/ui/cta';
import { useI18n } from '../hooks/useI18n';
import { useToast } from '../hooks/useToast';
import { callApi } from '../lib/api';
import { toApiAssetUrl } from '../lib/apiAssetUrl';
import { getAccessToken } from '../lib/auth';
import { fetchDrafts, fetchEvents, queryKeys } from '../lib/queries';

type RecentTrackActivity = {
  eventId: string;
  eventName: string;
  trackName: string;
  artist: string;
  addedBy: string;
  addedAt: string;
};
type ActivityPageTransition = {
  from: number;
  to: number;
  direction: 1 | -1;
};

const ACTIVITY_PAGE_SIZE = 15;
const ACTIVITY_MAX_ITEMS = 50;

const toTimestamp = (value: string): number => {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

export const DashboardPage = () => {
  const { t, locale } = useI18n();
  const { showToast } = useToast();

  const [activityPageIndex, setActivityPageIndex] = useState(0);
  const [activityPageTransition, setActivityPageTransition] =
    useState<ActivityPageTransition | null>(null);
  const activityTouchStartRef = useRef<{ x: number; y: number } | null>(null);

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  const eventsQuery = useQuery({
    queryKey: queryKeys.events.list(),
    queryFn: fetchEvents,
    staleTime: 120_000,
  });

  const draftsQuery = useQuery({
    queryKey: queryKeys.drafts.list(),
    queryFn: fetchDrafts,
    staleTime: 120_000,
  });

  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);
  const activeDraft = draftsQuery.data?.[0] ?? null;

  const trackQueries = useQuery({
    queryKey: ['dashboard', 'activity-tracks', events.map((e) => e.id)],
    queryFn: async () => {
      const token = getAccessToken();
      if (!token || events.length === 0) return [];

      const responses = await Promise.allSettled(
        events.map((event) =>
          callApi(
            `/v1/playlists/${encodeURIComponent(event.id)}/tracks`,
            { method: 'GET', headers: { authorization: `Bearer ${token}` } },
            (payload) => eventTracksResponseSchema.parse(payload),
          ).then((response) => ({
            eventId: event.id,
            eventName: event.name,
            tracks: response.tracks,
          })),
        ),
      );

      const activity: RecentTrackActivity[] = [];
      for (const result of responses) {
        if (result.status !== 'fulfilled') continue;
        for (const track of result.value.tracks) {
          activity.push({
            eventId: result.value.eventId,
            eventName: result.value.eventName,
            trackName: track.name,
            artist: track.artist,
            addedBy: track.addedBy,
            addedAt: track.addedAt,
          });
        }
      }
      return activity
        .sort((a, b) => toTimestamp(b.addedAt) - toTimestamp(a.addedAt))
        .slice(0, ACTIVITY_MAX_ITEMS);
    },
    enabled: eventsQuery.isSuccess && events.length > 0,
    staleTime: 120_000,
  });

  const recentTrackActivity = useMemo(() => trackQueries.data ?? [], [trackQueries.data]);
  const isLoadingRecentTracks = eventsQuery.isFetching || trackQueries.isFetching;

  useEffect(() => {
    if (eventsQuery.isError) {
      showToast(t('dashboard.error', { message: (eventsQuery.error as Error).message }), {
        variant: 'error',
      });
    }
  }, [eventsQuery.isError, eventsQuery.error, showToast, t]);

  useEffect(() => {
    if (trackQueries.isError) {
      showToast(t('dashboard.error', { message: (trackQueries.error as Error).message }), {
        variant: 'error',
      });
    }
  }, [trackQueries.isError, trackQueries.error, showToast, t]);

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const formatDateTime = useCallback(
    (value: string) => {
      try {
        return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(value));
      } catch {
        return value;
      }
    },
    [locale],
  );

  const formatTimeAgo = useCallback(
    (value: string) => {
      try {
        const diff = Date.now() - Date.parse(value);
        const mins = Math.floor(diff / 60_000);
        const hours = Math.floor(diff / 3_600_000);
        const days = Math.floor(diff / 86_400_000);
        if (mins < 1) return locale === 'fr' ? "À l'instant" : 'Just now';
        if (mins < 60) return locale === 'fr' ? `Il y a ${mins} min` : `${mins}m ago`;
        if (hours < 24) return locale === 'fr' ? `Il y a ${hours} h` : `${hours}h ago`;
        return locale === 'fr' ? `Il y a ${days} j` : `${days}d ago`;
      } catch {
        return value;
      }
    },
    [locale],
  );

  const currentEvents = useMemo(
    () =>
      events
        .filter((event) => event.status === 'open')
        .sort((a, b) => toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt)),
    [events],
  );

  const activityPageCount = useMemo(
    () => Math.max(1, Math.ceil(recentTrackActivity.length / ACTIVITY_PAGE_SIZE)),
    [recentTrackActivity.length],
  );

  const getActivityRowsForPage = useCallback(
    (pageIndex: number) => {
      const start = pageIndex * ACTIVITY_PAGE_SIZE;
      return recentTrackActivity.slice(start, start + ACTIVITY_PAGE_SIZE);
    },
    [recentTrackActivity],
  );

  const currentActivityRows = useMemo(
    () => getActivityRowsForPage(activityPageIndex),
    [activityPageIndex, getActivityRowsForPage],
  );

  useEffect(() => {
    setActivityPageIndex((current) => {
      if (current < activityPageCount) return current;
      return Math.max(0, activityPageCount - 1);
    });
  }, [activityPageCount]);

  useEffect(() => {
    if (!activityPageTransition) return;
    if (
      activityPageTransition.from >= activityPageCount ||
      activityPageTransition.to >= activityPageCount
    ) {
      setActivityPageTransition(null);
    }
  }, [activityPageCount, activityPageTransition]);

  // ---------------------------------------------------------------------------
  // Pagination
  // ---------------------------------------------------------------------------

  const slideToActivityPage = (direction: 1 | -1) => {
    if (activityPageTransition) return;
    const nextPage = activityPageIndex + direction;
    if (nextPage < 0 || nextPage >= activityPageCount) return;
    setActivityPageTransition({ from: activityPageIndex, to: nextPage, direction });
  };

  const onActivityTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) {
      activityTouchStartRef.current = null;
      return;
    }
    const touch = event.touches[0];
    activityTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const onActivityTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = activityTouchStartRef.current;
    activityTouchStartRef.current = null;
    if (!start || activityPageTransition) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const isHorizontalSwipe = Math.abs(deltaX) >= 48 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2;
    if (!isHorizontalSwipe) return;
    event.preventDefault();
    slideToActivityPage(deltaX < 0 ? 1 : -1);
  };

  const renderActivityRows = (rows: RecentTrackActivity[]) =>
    rows.map((activity) => {
      const isGuest = activity.addedBy === 'guest';
      // Future: when synced playlists are added, derive playlistType from activity
      const SourceIcon = isGuest ? Users : Rss;
      const sourceLabel = isGuest
        ? t('dashboard.activityAddedByGuest')
        : t('dashboard.activityAddedByProviderSync');
      return (
        <li key={`${activity.eventId}-${activity.trackName}-${activity.addedAt}`}>
          <CTALink
            to={`/playlists/${activity.eventId}#tracks`}
            variant="secondary"
            className="flex min-w-0 w-full items-center gap-3 rounded-2xl border border-app-border bg-app-elevated px-4 py-3 shadow-none transition-all duration-150 hover:-translate-y-0.5 hover:border-brand-lime/50 dark:bg-app-card"
          >
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-app-bg text-app-text-secondary dark:bg-app-elevated">
              <Music2 size={14} aria-hidden="true" />
              <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand-lime text-brand-dark">
                <Plus size={8} strokeWidth={3} aria-hidden="true" />
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-brand-dark dark:text-brand-white">
                {activity.trackName}
              </p>
              <div className="flex min-w-0 items-center gap-1.5">
                <p className="truncate text-xs text-app-text-secondary">{activity.eventName}</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  isGuest
                    ? 'bg-brand-lime/15 text-[#6d9600] dark:text-[#d5ff5c]'
                    : 'bg-sky-400/15 text-sky-700 dark:text-sky-300'
                }`}
              >
                <SourceIcon size={9} aria-hidden="true" />
                {sourceLabel}
              </span>
              <p className="text-[10px] text-app-text-secondary">
                {formatTimeAgo(activity.addedAt)}
              </p>
            </div>
          </CTALink>
        </li>
      );
    });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const hasPlaylists = events.length > 0;
  const isInitialLoad = eventsQuery.isLoading;

  return (
    <AppPageLayout
      bodyClassName="gap-10"
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

      {!hasPlaylists && !isInitialLoad ? (
        /* ── Empty state ── */
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
                {activeDraft ? (
                  <CTALink
                    to={`/playlists/new?draftId=${activeDraft.id}`}
                    variant="primary"
                    size="lg"
                    className="w-full justify-center"
                  >
                    {t('dashboard.ctaResumeDraft')}
                  </CTALink>
                ) : (
                  <CTALink
                    to="/playlists/new"
                    variant="primary"
                    size="lg"
                    className="w-full justify-center"
                  >
                    {t('dashboard.ctaCreateEventPlaylist')}
                  </CTALink>
                )}
                <CTALink
                  to="/synced-lists"
                  variant="secondary"
                  size="lg"
                  disabled
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
          {/* ── Page header ── */}
          <header className="flex items-start justify-between gap-4">
            <div className="grid gap-1">
              <p className="text-xs font-bold uppercase tracking-widest text-app-text-secondary">
                {t('dashboard.pill')}
              </p>
              <h1 className="text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl">
                {t('dashboard.title')}
              </h1>
              <p className="mt-1 max-w-xl text-sm text-app-text-secondary sm:text-base">
                {t('dashboard.description')}
              </p>
            </div>
            <div className="hidden shrink-0 sm:block">
              <CTALink
                to={activeDraft ? `/playlists/new?draftId=${activeDraft.id}` : '/playlists/new'}
                variant="primary"
                size="lg"
              >
                <Plus size={16} aria-hidden="true" />
                {activeDraft ? t('dashboard.ctaResumeDraft') : t('dashboard.ctaCreateEvent')}
              </CTALink>
            </div>
          </header>

          {/* Mobile CTA */}
          <div className="sm:hidden">
            <CTALink
              to={activeDraft ? `/playlists/new?draftId=${activeDraft.id}` : '/playlists/new'}
              variant="primary"
              className="w-full justify-center"
            >
              <Plus size={16} aria-hidden="true" />
              {activeDraft ? t('dashboard.ctaResumeDraft') : t('dashboard.ctaCreateEvent')}
            </CTALink>
          </div>

          {/* ── Active playlists ── */}
          <section className="grid gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black tracking-tight text-brand-dark dark:text-brand-white">
                {t('dashboard.activePlaylistsTitle')}
              </h2>
              <span className="text-xs font-semibold text-app-text-secondary">
                {t('dashboard.currentEventsCount', { count: currentEvents.length })}
              </span>
            </div>

            {isInitialLoad ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <li key={i} className="h-20 animate-pulse rounded-2xl bg-app-border" />
                ))}
              </ul>
            ) : currentEvents.length === 0 ? (
              <p className="rounded-2xl border border-app-border bg-app-elevated/60 px-4 py-4 text-sm text-app-text-secondary dark:bg-app-card/60">
                {t('dashboard.currentEventsEmpty')}
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {currentEvents.map((event) => {
                  const hasIssue = event.providerConnectionStatus === 'not_connected';
                  const coverUrl = toApiAssetUrl(event.coverImageUrl);
                  return (
                    <li key={event.id}>
                      <CTALink
                        to={`/playlists/${event.id}`}
                        variant="secondary"
                        className={`flex min-w-0 w-full items-center gap-3 rounded-2xl border px-4 py-3.5 shadow-none transition-all duration-150 hover:-translate-y-0.5 hover:shadow-soft-lift ${
                          hasIssue
                            ? 'border-[#DC5C48]/40 bg-[#DC5C48]/8 hover:border-[#DC5C48]/60 dark:bg-[#DC5C48]/12'
                            : 'border-app-border bg-app-elevated hover:border-brand-lime/40 dark:bg-app-card'
                        }`}
                      >
                        {coverUrl ? (
                          <img
                            src={coverUrl}
                            alt=""
                            className="h-11 w-11 shrink-0 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="h-11 w-11 shrink-0 rounded-xl border border-dashed border-app-border bg-app-bg dark:bg-app-elevated" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-brand-dark dark:text-brand-white">
                            {event.name}
                          </p>
                          <p className="truncate text-xs text-app-text-secondary">
                            {formatDateTime(event.updatedAt)}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <EventStatusIndicator
                            status={event.status}
                            closeReason={event.closeReason}
                            connectionStatus={event.providerConnectionStatus}
                            mode="pill"
                          />
                        </div>
                      </CTALink>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ── Recent activity ── */}
          <section className="grid gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black tracking-tight text-brand-dark dark:text-brand-white">
                {t('dashboard.latestActivityTitle')}
              </h2>
              <div className="flex items-center gap-2">
                {isLoadingRecentTracks ? (
                  <RefreshCcw
                    size={12}
                    className="animate-spin text-app-text-secondary"
                    aria-hidden="true"
                  />
                ) : null}
                <span className="text-xs font-semibold text-app-text-secondary">
                  {t('dashboard.latestActivityCount', { count: recentTrackActivity.length })}
                </span>
              </div>
            </div>

            {isLoadingRecentTracks && recentTrackActivity.length === 0 ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <li key={i} className="h-16 animate-pulse rounded-2xl bg-app-border" />
                ))}
              </ul>
            ) : recentTrackActivity.length === 0 ? (
              <p className="rounded-2xl border border-app-border bg-app-elevated/60 px-4 py-4 text-sm text-app-text-secondary dark:bg-app-card/60">
                {t('dashboard.latestActivityEmpty')}
              </p>
            ) : (
              <div className="grid gap-3">
                <div
                  className="overflow-visible"
                  onTouchStart={onActivityTouchStart}
                  onTouchEnd={onActivityTouchEnd}
                >
                  {activityPageTransition ? (
                    <motion.div
                      key={`${activityPageTransition.from}-${activityPageTransition.to}`}
                      initial={{ x: activityPageTransition.direction === 1 ? '0%' : '-100%' }}
                      animate={{ x: activityPageTransition.direction === 1 ? '-100%' : '0%' }}
                      transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
                      onAnimationComplete={() => {
                        setActivityPageIndex(activityPageTransition.to);
                        setActivityPageTransition(null);
                      }}
                      className="flex w-full"
                    >
                      {activityPageTransition.direction === 1 ? (
                        <>
                          <ul className="grid w-full shrink-0 grid-cols-1 gap-2 sm:grid-cols-2">
                            {renderActivityRows(
                              getActivityRowsForPage(activityPageTransition.from),
                            )}
                          </ul>
                          <ul className="grid w-full shrink-0 grid-cols-1 gap-2 sm:grid-cols-2">
                            {renderActivityRows(getActivityRowsForPage(activityPageTransition.to))}
                          </ul>
                        </>
                      ) : (
                        <>
                          <ul className="grid w-full shrink-0 grid-cols-1 gap-2 sm:grid-cols-2">
                            {renderActivityRows(getActivityRowsForPage(activityPageTransition.to))}
                          </ul>
                          <ul className="grid w-full shrink-0 grid-cols-1 gap-2 sm:grid-cols-2">
                            {renderActivityRows(
                              getActivityRowsForPage(activityPageTransition.from),
                            )}
                          </ul>
                        </>
                      )}
                    </motion.div>
                  ) : (
                    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {renderActivityRows(currentActivityRows)}
                    </ul>
                  )}
                </div>

                {activityPageCount > 1 ? (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <CTAButton
                      type="button"
                      variant="secondary"
                      disabled={activityPageIndex === 0 || activityPageTransition !== null}
                      onClick={() => slideToActivityPage(-1)}
                    >
                      <CTAMobileIconLabel
                        icon={<ChevronLeft size={14} />}
                        label={t('dashboard.latestActivityPrev')}
                      />
                    </CTAButton>
                    <p className="text-xs font-semibold text-app-text-secondary">
                      {t('dashboard.latestActivityPageLabel', {
                        current: activityPageIndex + 1,
                        total: activityPageCount,
                      })}
                    </p>
                    <CTAButton
                      type="button"
                      variant="secondary"
                      disabled={
                        activityPageIndex >= activityPageCount - 1 ||
                        activityPageTransition !== null
                      }
                      onClick={() => slideToActivityPage(1)}
                    >
                      <CTAMobileIconLabel
                        icon={<ChevronRight size={14} />}
                        label={t('dashboard.latestActivityNext')}
                      />
                    </CTAButton>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </>
      )}
    </AppPageLayout>
  );
};
