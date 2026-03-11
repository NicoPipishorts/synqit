import { eventListResponseSchema, eventTracksResponseSchema } from '@synqit/shared';
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
import { callApi, toApiError } from '../lib/api';
import { getAccessToken } from '../lib/auth';
import { HostEvent } from '../lib/events';

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
type DashboardSnapshotCache = {
  events: HostEvent[];
  recentTrackActivity: RecentTrackActivity[];
  cachedAt: number;
};

const ACTIVITY_PAGE_SIZE = 15;
const ACTIVITY_MAX_ITEMS = 50;
const DASHBOARD_CACHE_TTL_MS = 120_000;
let dashboardSnapshotCache: DashboardSnapshotCache | null = null;

const toTimestamp = (value: string): number => {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

export const DashboardPage = () => {
  const { t, locale } = useI18n();
  const { showToast } = useToast();

  const [events, setEvents] = useState<HostEvent[]>([]);
  const [recentTrackActivity, setRecentTrackActivity] = useState<RecentTrackActivity[]>([]);
  const [isLoadingRecentTracks, setIsLoadingRecentTracks] = useState(false);
  const [activityPageIndex, setActivityPageIndex] = useState(0);
  const [activityPageTransition, setActivityPageTransition] =
    useState<ActivityPageTransition | null>(null);
  const activityTouchStartRef = useRef<{ x: number; y: number } | null>(null);

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

  const loadSnapshot = useCallback(
    async (options?: { force?: boolean }) => {
      const shouldForce = options?.force ?? false;
      const accessToken = getAccessToken();
      if (!accessToken) {
        return;
      }

      if (!shouldForce && dashboardSnapshotCache) {
        setEvents(dashboardSnapshotCache.events);
        setRecentTrackActivity(dashboardSnapshotCache.recentTrackActivity);

        if (Date.now() - dashboardSnapshotCache.cachedAt < DASHBOARD_CACHE_TTL_MS) {
          return;
        }
      }

      setIsLoadingRecentTracks(true);
      try {
        const eventResult = await callApi(
          '/v1/playlists',
          {
            method: 'GET',
            headers: {
              authorization: `Bearer ${accessToken}`,
            },
          },
          (payload) => eventListResponseSchema.parse(payload),
        );

        const nextEvents = eventResult.events.map((event) => ({
          id: event.id,
          name: event.name,
          description: event.description,
          provider: event.provider,
          providerConnectionStatus: event.providerConnectionStatus,
          status: event.status,
          magicLinkToken: event.magicLinkToken,
          magicLinkRevokedAt: event.magicLinkRevokedAt,
          updatedAt: event.updatedAt,
        }));
        setEvents(nextEvents);

        const trackResponses = await Promise.allSettled(
          nextEvents.map((event) =>
            callApi(
              `/v1/playlists/${encodeURIComponent(event.id)}/tracks`,
              {
                method: 'GET',
                headers: {
                  authorization: `Bearer ${accessToken}`,
                },
              },
              (payload) => eventTracksResponseSchema.parse(payload),
            ).then((response) => ({
              eventId: event.id,
              eventName: event.name,
              tracks: response.tracks,
            })),
          ),
        );

        const nextRecentTrackActivity: RecentTrackActivity[] = [];
        for (const response of trackResponses) {
          if (response.status !== 'fulfilled') {
            continue;
          }

          for (const track of response.value.tracks) {
            nextRecentTrackActivity.push({
              eventId: response.value.eventId,
              eventName: response.value.eventName,
              trackName: track.name,
              artist: track.artist,
              addedBy: track.addedBy,
              addedAt: track.addedAt,
            });
          }
        }

        const sortedRecentTrackActivity = nextRecentTrackActivity
          .sort((left, right) => toTimestamp(right.addedAt) - toTimestamp(left.addedAt))
          .slice(0, ACTIVITY_MAX_ITEMS);
        setRecentTrackActivity(sortedRecentTrackActivity);
        dashboardSnapshotCache = {
          events: nextEvents,
          recentTrackActivity: sortedRecentTrackActivity,
          cachedAt: Date.now(),
        };
      } catch (error) {
        const apiError = toApiError(error);
        showToast(t('dashboard.error', { message: apiError.message }), { variant: 'error' });
      } finally {
        setIsLoadingRecentTracks(false);
      }
    },
    [showToast, t],
  );

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const currentEvents = useMemo(() => {
    return events
      .filter((event) => event.status === 'open')
      .sort((left, right) => toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt));
  }, [events]);
  const activityPageCount = useMemo(() => {
    return Math.max(1, Math.ceil(recentTrackActivity.length / ACTIVITY_PAGE_SIZE));
  }, [recentTrackActivity.length]);
  const getActivityRowsForPage = useCallback(
    (pageIndex: number) => {
      const start = pageIndex * ACTIVITY_PAGE_SIZE;
      return recentTrackActivity.slice(start, start + ACTIVITY_PAGE_SIZE);
    },
    [recentTrackActivity],
  );
  const currentActivityRows = useMemo(() => {
    return getActivityRowsForPage(activityPageIndex);
  }, [activityPageIndex, getActivityRowsForPage]);

  useEffect(() => {
    setActivityPageIndex((currentPageIndex) => {
      if (currentPageIndex < activityPageCount) {
        return currentPageIndex;
      }
      return Math.max(0, activityPageCount - 1);
    });
  }, [activityPageCount]);
  useEffect(() => {
    if (!activityPageTransition) {
      return;
    }
    if (
      activityPageTransition.from >= activityPageCount ||
      activityPageTransition.to >= activityPageCount
    ) {
      setActivityPageTransition(null);
    }
  }, [activityPageCount, activityPageTransition]);

  const slideToActivityPage = (direction: 1 | -1) => {
    if (activityPageTransition) {
      return;
    }
    const nextPage = activityPageIndex + direction;
    if (nextPage < 0 || nextPage >= activityPageCount) {
      return;
    }
    setActivityPageTransition({
      from: activityPageIndex,
      to: nextPage,
      direction,
    });
  };
  const onActivityTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) {
      activityTouchStartRef.current = null;
      return;
    }
    const touch = event.touches[0];
    activityTouchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
  };
  const onActivityTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = activityTouchStartRef.current;
    activityTouchStartRef.current = null;
    if (!start || activityPageTransition) {
      return;
    }
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const isHorizontalSwipe = Math.abs(deltaX) >= 48 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2;
    if (!isHorizontalSwipe) {
      return;
    }
    event.preventDefault();
    if (deltaX < 0) {
      slideToActivityPage(1);
      return;
    }
    slideToActivityPage(-1);
  };
  const renderActivityRows = (rows: RecentTrackActivity[]) => {
    return rows.map((activity) => {
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
  };

  return (
    <AppPageLayout>
      <div className="pointer-events-none absolute -left-10 top-20 h-44 w-44 rounded-full bg-brand-lime/15 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-16 h-52 w-52 rounded-full bg-brand-pink/15 blur-3xl" />

      <PwaInstallPrompt />

      <AppPageHeader
        title={t('dashboard.title')}
        description={t('dashboard.description')}
        descriptionClassName="max-w-3xl text-sm text-app-text-secondary sm:text-base"
      >
        <div className="flex pb-1">
          <CTALink
            to="/playlists/new"
            variant="primary"
            size="lg"
            className="w-full justify-center"
          >
            {t('dashboard.ctaCreateEvent')}
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
                          {renderActivityRows(getActivityRowsForPage(activityPageTransition.from))}
                        </ul>
                        <ul className="grid w-full shrink-0 grid-cols-1 gap-3 md:grid-cols-2">
                          {renderActivityRows(getActivityRowsForPage(activityPageTransition.to))}
                        </ul>
                      </>
                    ) : (
                      <>
                        <ul className="grid w-full shrink-0 grid-cols-1 gap-3 md:grid-cols-2">
                          {renderActivityRows(getActivityRowsForPage(activityPageTransition.to))}
                        </ul>
                        <ul className="grid w-full shrink-0 grid-cols-1 gap-3 md:grid-cols-2">
                          {renderActivityRows(getActivityRowsForPage(activityPageTransition.from))}
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
                    onClick={() => {
                      slideToActivityPage(-1);
                    }}
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
                      activityPageIndex >= activityPageCount - 1 || activityPageTransition !== null
                    }
                    onClick={() => {
                      slideToActivityPage(1);
                    }}
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
    </AppPageLayout>
  );
};
