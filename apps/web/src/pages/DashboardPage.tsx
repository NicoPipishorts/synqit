import { eventTracksResponseSchema } from '@synqit/shared';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Music2, RefreshCcw, Rss, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AppPageHeader } from '../components/app/AppPageHeader';
import { AppPageLayout } from '../components/app/AppPageLayout';
import { AppSurfaceCard } from '../components/app/AppSurfaceCard';
import { PwaInstallPrompt } from '../components/dashboard/PwaInstallPrompt';
import { EventProviderIcon } from '../components/events/EventProviderIcon';
import { EventStatusIndicator } from '../components/events/EventStatusIndicator';
import { CTAButton, CTALink, CTAMobileIconLabel } from '../components/ui/cta';
import { useI18n } from '../hooks/useI18n';
import { useToast } from '../hooks/useToast';
import { callApi } from '../lib/api';
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

  const events = eventsQuery.data ?? [];
  const activeDraft = draftsQuery.data?.[0] ?? null;

  // Fan-out per-event track queries, keyed on the event id list so it
  // re-runs when events change. Each individual event's tracks are also
  // cached under queryKeys.events.tracks for cross-page sharing.
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

  const recentTrackActivity = trackQueries.data ?? [];
  const isLoadingRecentTracks = eventsQuery.isFetching || trackQueries.isFetching;

  // Surface fetch errors as toasts
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
      const SourceIcon = isGuest ? Users : Rss;
      const sourceLabel = isGuest
        ? t('dashboard.activityAddedByGuest')
        : t('dashboard.activityAddedByProviderSync');
      return (
        <li key={`${activity.eventId}-${activity.trackName}-${activity.addedAt}`}>
          <CTALink
            to={`/playlists/${activity.eventId}`}
            variant="secondary"
            className="flex min-w-0 w-full items-center gap-2 rounded-xl border border-app-border bg-white px-3 py-2 shadow-none transition-transform duration-150 hover:-translate-y-0.5 dark:bg-app-elevated"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-bg text-app-text-secondary dark:bg-app-elevated">
              <Music2 size={14} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-brand-dark dark:text-brand-white">
                {activity.trackName}
              </p>
              <p className="truncate text-xs text-app-text-secondary">{activity.artist}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  isGuest
                    ? 'bg-brand-lime/15 text-[#6d9600] dark:text-[#d5ff5c]'
                    : 'bg-sky-400/15 text-sky-700 dark:text-sky-300'
                }`}
              >
                <SourceIcon size={9} aria-hidden="true" />
                {sourceLabel}
              </span>
              <p className="text-[10px] text-app-text-secondary">
                {formatDateTime(activity.addedAt)}
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
    <AppPageLayout>
      <PwaInstallPrompt />

      {!hasPlaylists && !isInitialLoad ? (
        <div className="flex min-h-[60vh] flex-col items-center justify-center">
          <div className="relative p-6 sm:p-10">
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
          <AppPageHeader
            title={t('dashboard.title')}
            description={t('dashboard.description')}
            descriptionClassName="max-w-3xl text-sm text-app-text-secondary sm:text-base"
          >
            <div className="flex pb-1">
              <CTALink
                to={activeDraft ? `/playlists/new?draftId=${activeDraft.id}` : '/playlists/new'}
                variant="primary"
                size="lg"
                className="w-full justify-center"
              >
                {activeDraft ? t('dashboard.ctaResumeDraft') : t('dashboard.ctaCreateEvent')}
              </CTALink>
            </div>
          </AppPageHeader>

          <div>
            <AppSurfaceCard className="shadow-none">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-brand-dark dark:text-brand-white">
                  {t('dashboard.activePlaylistsTitle')}
                </h2>
                <span className="text-xs font-semibold text-app-text-secondary">
                  {t('dashboard.currentEventsCount', { count: currentEvents.length })}
                </span>
              </div>

              {currentEvents.length === 0 ? (
                <p className="rounded-xl border border-app-border bg-app-bg px-3 py-3 text-sm text-app-text-secondary dark:bg-app-elevated">
                  {t('dashboard.currentEventsEmpty')}
                </p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {currentEvents.map((event) => {
                    const hasIssue = event.providerConnectionStatus === 'not_connected';
                    return (
                      <li key={event.id}>
                        <CTALink
                          to={`/playlists/${event.id}`}
                          variant="secondary"
                          className={`flex min-w-0 w-full items-center gap-2 rounded-xl border px-3 py-2 shadow-none transition-transform duration-150 hover:-translate-y-0.5 ${
                            hasIssue
                              ? 'border-[#DC5C48]/50 bg-[#DC5C48]/10 dark:bg-[#DC5C48]/15'
                              : 'border-app-border bg-white dark:bg-app-elevated'
                          }`}
                        >
                          <EventProviderIcon provider={event.provider} sizeClassName="h-8 w-8" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-brand-dark dark:text-brand-white">
                              {event.name}
                            </p>
                            <p className="truncate text-xs text-app-text-secondary">
                              {formatDateTime(event.updatedAt)}
                            </p>
                          </div>
                          <EventStatusIndicator
                            status={event.status}
                            connectionStatus={event.providerConnectionStatus}
                            mode="pill"
                          />
                        </CTALink>
                      </li>
                    );
                  })}
                </ul>
              )}
            </AppSurfaceCard>
          </div>

          <div>
            <AppSurfaceCard className="shadow-none">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-brand-dark dark:text-brand-white">
                  {t('dashboard.latestActivityTitle')}
                </h2>
                <span className="text-xs font-semibold text-app-text-secondary">
                  {t('dashboard.latestActivityCount', { count: recentTrackActivity.length })}
                </span>
              </div>

              {isLoadingRecentTracks && recentTrackActivity.length === 0 ? (
                <div className="flex items-center gap-2 rounded-xl border border-app-border bg-app-bg px-3 py-3 text-sm font-semibold text-app-text-secondary dark:bg-app-elevated">
                  <RefreshCcw size={14} className="animate-spin" aria-hidden="true" />
                  <span>{t('dashboard.latestActivityLoading')}</span>
                </div>
              ) : recentTrackActivity.length === 0 ? (
                <p className="rounded-xl border border-app-border bg-app-bg px-3 py-3 text-sm text-app-text-secondary dark:bg-app-elevated">
                  {t('dashboard.latestActivityEmpty')}
                </p>
              ) : (
                <div className="grid gap-3">
                  {isLoadingRecentTracks ? (
                    <div className="flex items-center gap-2 text-xs font-semibold text-app-text-secondary">
                      <RefreshCcw size={12} className="animate-spin" aria-hidden="true" />
                      <span>{t('dashboard.latestActivityLoading')}</span>
                    </div>
                  ) : null}
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
                            <ul className="grid w-full shrink-0 grid-cols-1 gap-3 md:grid-cols-2">
                              {renderActivityRows(
                                getActivityRowsForPage(activityPageTransition.from),
                              )}
                            </ul>
                            <ul className="grid w-full shrink-0 grid-cols-1 gap-3 md:grid-cols-2">
                              {renderActivityRows(
                                getActivityRowsForPage(activityPageTransition.to),
                              )}
                            </ul>
                          </>
                        ) : (
                          <>
                            <ul className="grid w-full shrink-0 grid-cols-1 gap-3 md:grid-cols-2">
                              {renderActivityRows(
                                getActivityRowsForPage(activityPageTransition.to),
                              )}
                            </ul>
                            <ul className="grid w-full shrink-0 grid-cols-1 gap-3 md:grid-cols-2">
                              {renderActivityRows(
                                getActivityRowsForPage(activityPageTransition.from),
                              )}
                            </ul>
                          </>
                        )}
                      </motion.div>
                    ) : (
                      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {renderActivityRows(currentActivityRows)}
                      </ul>
                    )}
                  </div>

                  {activityPageCount > 1 ? (
                    <div className="flex items-center justify-between gap-2">
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
            </AppSurfaceCard>
          </div>
        </>
      )}
    </AppPageLayout>
  );
};
