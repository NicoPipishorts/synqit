import {
  eventListResponseSchema,
  eventTracksResponseSchema,
  integrationListResponseSchema,
  providerSchema,
} from '@synqit/shared';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Eye, RefreshCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { PwaInstallPrompt } from '../components/dashboard/PwaInstallPrompt';
import { EventProviderIcon } from '../components/events/EventProviderIcon';
import { EventStatusIndicator } from '../components/events/EventStatusIndicator';
import { CTAButton, CTALink, CTAMobileIconLabel } from '../components/ui/cta';
import { useI18n } from '../hooks/useI18n';
import { useToast } from '../hooks/useToast';
import { callApi, toApiError } from '../lib/api';
import { getAccessToken } from '../lib/auth';
import { HostEvent } from '../lib/events';
import { Provider } from '../lib/types';

type ProviderIntegrationStatus = 'connected' | 'not_connected';

type RecentTrackActivity = {
  eventId: string;
  eventName: string;
  trackName: string;
  addedAt: string;
};
type ActivityPageTransition = {
  from: number;
  to: number;
  direction: 1 | -1;
};
type DashboardSnapshotCache = {
  integrationByProvider: Record<Provider, ProviderIntegrationStatus>;
  events: HostEvent[];
  recentTrackActivity: RecentTrackActivity[];
  cachedAt: number;
};

const createInitialIntegrationMap = (): Record<Provider, ProviderIntegrationStatus> => ({
  spotify: 'not_connected',
  apple: 'not_connected',
});
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
  const [isLoading, setIsLoading] = useState(false);
  const [integrationByProvider, setIntegrationByProvider] = useState<
    Record<Provider, ProviderIntegrationStatus>
  >(() => createInitialIntegrationMap());
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
        setIntegrationByProvider(dashboardSnapshotCache.integrationByProvider);
        setEvents(dashboardSnapshotCache.events);
        setRecentTrackActivity(dashboardSnapshotCache.recentTrackActivity);

        if (Date.now() - dashboardSnapshotCache.cachedAt < DASHBOARD_CACHE_TTL_MS) {
          return;
        }
      }

      setIsLoading(true);
      setIsLoadingRecentTracks(true);
      try {
        const [integrationResult, eventResult] = await Promise.all([
          callApi(
            '/v1/integrations',
            {
              method: 'GET',
              headers: {
                authorization: `Bearer ${accessToken}`,
              },
            },
            (payload) => integrationListResponseSchema.parse(payload),
          ),
          callApi(
            '/v1/playlists',
            {
              method: 'GET',
              headers: {
                authorization: `Bearer ${accessToken}`,
              },
            },
            (payload) => eventListResponseSchema.parse(payload),
          ),
        ]);

        const nextIntegrationByProvider = createInitialIntegrationMap();
        for (const provider of providerSchema.options) {
          nextIntegrationByProvider[provider] =
            integrationResult.integrations.find((item) => item.provider === provider)?.status ??
            'not_connected';
        }
        setIntegrationByProvider(nextIntegrationByProvider);

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
              addedAt: track.addedAt,
            });
          }
        }

        const sortedRecentTrackActivity = nextRecentTrackActivity
          .sort((left, right) => toTimestamp(right.addedAt) - toTimestamp(left.addedAt))
          .slice(0, ACTIVITY_MAX_ITEMS);
        setRecentTrackActivity(sortedRecentTrackActivity);
        dashboardSnapshotCache = {
          integrationByProvider: nextIntegrationByProvider,
          events: nextEvents,
          recentTrackActivity: sortedRecentTrackActivity,
          cachedAt: Date.now(),
        };
      } catch (error) {
        const apiError = toApiError(error);
        showToast(t('dashboard.error', { message: apiError.message }), { variant: 'error' });
      } finally {
        setIsLoading(false);
        setIsLoadingRecentTracks(false);
      }
    },
    [showToast, t],
  );

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const connectedProviderCount = useMemo(() => {
    return providerSchema.options.filter(
      (provider) => integrationByProvider[provider] === 'connected',
    ).length;
  }, [integrationByProvider]);

  const eventsByProvider = useMemo(() => {
    const counts: Record<Provider, number> = {
      spotify: 0,
      apple: 0,
    };

    for (const event of events) {
      counts[event.provider] += 1;
    }

    return counts;
  }, [events]);

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

  const getProviderLabel = (provider: Provider): string => {
    return provider === 'apple'
      ? t('eventsPage.createFlow.providerApple')
      : t('eventsPage.createFlow.providerSpotify');
  };
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
    return rows.map((activity) => (
      <li key={`${activity.eventId}-${activity.trackName}-${activity.addedAt}`} className="min-w-0">
        <CTALink
          to={`/playlists/${activity.eventId}`}
          variant="secondary"
          className="flex-col w-full min-w-0 items-start justify-start gap-0 overflow-hidden whitespace-normal rounded-xl bg-app-bg px-3 py-3 text-left dark:bg-app-elevated"
        >
          <p className="w-full min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-app-text-secondary">
            {activity.eventName}
          </p>
          <p className="mt-1 w-full min-w-0 truncate text-sm font-bold text-brand-dark dark:text-brand-white">
            {activity.trackName}
          </p>
        </CTALink>
      </li>
    ));
  };

  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8">
      <div className="pointer-events-none absolute -left-10 top-20 h-44 w-44 rounded-full bg-brand-lime/15 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-16 h-52 w-52 rounded-full bg-brand-pink/15 blur-3xl" />

      <div className="relative grid gap-6">
        <PwaInstallPrompt />

        <article>
          <div className="grid px-5 py-7 sm:px-8 sm:py-9">
            <div className="grid gap-1">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-2xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl">
                  {t('dashboard.title')}
                </h1>
                <div className="flex items-center gap-2">
                  <CTALink to="/playlists/new" variant="primary" className="hidden sm:inline-flex">
                    {t('dashboard.ctaCreateEvent')}
                  </CTALink>
                  <CTAButton
                    type="button"
                    variant="secondary"
                    onClick={() => void loadSnapshot({ force: true })}
                    disabled={isLoading}
                    className="h-10 w-10 px-0 sm:h-auto sm:w-auto sm:px-3"
                    aria-label={t('dashboard.refresh')}
                  >
                    <CTAMobileIconLabel
                      icon={
                        <RefreshCcw
                          size={14}
                          className={isLoading ? 'animate-spin' : ''}
                          aria-hidden="true"
                        />
                      }
                      label={isLoading ? t('dashboard.loading') : t('dashboard.refresh')}
                    />
                  </CTAButton>
                </div>
              </div>
              <p className="max-w-3xl text-sm text-app-text-secondary sm:text-base">
                {t('dashboard.description')}
              </p>
            </div>
          </div>
          <div className="flex justify-center px-5 pb-1 sm:hidden">
            <CTALink to="/playlists/new" variant="primary" className="w-full justify-center">
              {t('dashboard.ctaCreateEvent')}
            </CTALink>
          </div>
        </article>

        <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
          <article className="rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-brand-dark dark:text-brand-white">
                {t('dashboard.servicesTitle')}
              </h2>
              <span className="rounded-full border border-brand-lime/40 bg-brand-lime/15 px-2 py-1 text-xs font-semibold text-[#6d9600] dark:text-[#d5ff5c]">
                {t('dashboard.servicesSummary', {
                  connected: connectedProviderCount,
                  total: providerSchema.options.length,
                })}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {providerSchema.options.map((provider) => {
                const isConnected = integrationByProvider[provider] === 'connected';
                return (
                  <div
                    key={provider}
                    className="rounded-xl border border-app-border bg-app-bg px-3 py-3 dark:bg-app-elevated"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <EventProviderIcon provider={provider} />
                        <p className="text-sm font-bold text-brand-dark dark:text-brand-white">
                          {getProviderLabel(provider)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-black uppercase tracking-wide ${
                          isConnected
                            ? 'border border-brand-lime/40 bg-brand-lime/15 text-[#6d9600] dark:text-[#d5ff5c]'
                            : 'border border-amber-400/45 bg-amber-400/15 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {isConnected
                          ? t('dashboard.serviceConnected')
                          : t('dashboard.serviceNotConnected')}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-app-text-secondary">
                      {t('dashboard.serviceEventsLinked', {
                        count: eventsByProvider[provider],
                      })}
                    </p>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-brand-dark dark:text-brand-white">
                {t('dashboard.currentEventsTitle')}
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
              <ul className="grid gap-2">
                {currentEvents.slice(0, 5).map((event) => (
                  <li
                    key={event.id}
                    className="flex min-w-0 items-center gap-2 rounded-xl border border-app-border bg-app-bg px-3 py-2 dark:bg-app-elevated"
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
                    <CTALink
                      to={`/playlists/${event.id}`}
                      variant="secondary"
                      className="px-2.5 py-1.5 text-[11px]"
                      aria-label={t('dashboard.openEvent')}
                    >
                      <CTAMobileIconLabel
                        icon={<Eye size={14} />}
                        label={t('dashboard.openEvent')}
                      />
                    </CTALink>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>

        <article className="rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card">
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
            <div className="grid gap-3 overflow-hidden">
              {isLoadingRecentTracks ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-app-text-secondary">
                  <RefreshCcw size={12} className="animate-spin" aria-hidden="true" />
                  <span>{t('dashboard.latestActivityLoading')}</span>
                </div>
              ) : null}
              <div
                className="overflow-hidden"
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
                        <ul className="grid w-full shrink-0 grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                          {renderActivityRows(getActivityRowsForPage(activityPageTransition.from))}
                        </ul>
                        <ul className="grid w-full shrink-0 grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                          {renderActivityRows(getActivityRowsForPage(activityPageTransition.to))}
                        </ul>
                      </>
                    ) : (
                      <>
                        <ul className="grid w-full shrink-0 grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                          {renderActivityRows(getActivityRowsForPage(activityPageTransition.to))}
                        </ul>
                        <ul className="grid w-full shrink-0 grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                          {renderActivityRows(getActivityRowsForPage(activityPageTransition.from))}
                        </ul>
                      </>
                    )}
                  </motion.div>
                ) : (
                  <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
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
        </article>
      </div>
    </section>
  );
};
