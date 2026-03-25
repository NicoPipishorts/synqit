import { eventTracksResponseSchema, type EventTrack } from '@synqit/shared';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ArrowUpRight, Plus, RefreshCcw } from 'lucide-react';
import { KeyboardEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { AppPageLayout } from '../components/app/AppPageLayout';
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
  syncQueryKeys,
  queryKeys,
} from '../lib/queries';

type GuestEventActivity = {
  magicLinkToken: string;
  name: string;
  tracks: EventTrack[];
  recentAddedCount: number;
  latestActivityAt: string | null;
};

type OverviewRow = {
  id: string;
  playlistName: string;
  href: string;
  roleLabel: string;
  metrics: {
    primary: string;
    secondary?: string | null;
    badge?: string | null;
    status?: string | null;
    pills?: string[];
  };
  sortAt: number;
};

type ActivityRow = {
  id: string;
  playlistName: string;
  href: string;
  roleTypeLabel: string;
  description: string;
  timeLabel: string | null;
  sortAt: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const toTimestamp = (value: string | null | undefined): number => {
  if (!value) {
    return 0;
  }
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const RECENT_GUEST_WINDOW_MS = DAY_MS;

export const DashboardPage = () => {
  const { t, locale } = useI18n();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [guestHistory] = useState<DashboardGuestEventHistoryItem[]>(() =>
    readDashboardGuestEvents(),
  );

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
    queryKey: ['dashboard', 'guest-events', guestHistory.map((item) => item.magicLinkToken)],
    enabled: guestHistory.length > 0,
    staleTime: 120_000,
    queryFn: async (): Promise<GuestEventActivity[]> => {
      const since = Date.now() - RECENT_GUEST_WINDOW_MS;
      const responses = await Promise.allSettled(
        guestHistory.map(async (item) => {
          const result = await callApi(
            `/v1/playlists/link/${encodeURIComponent(item.magicLinkToken)}/tracks`,
            { method: 'GET' },
            (payload) => eventTracksResponseSchema.parse(payload),
          );

          const recentTracks = result.tracks.filter((track) => toTimestamp(track.addedAt) >= since);

          return {
            magicLinkToken: item.magicLinkToken,
            name: item.name,
            tracks: result.tracks,
            recentAddedCount: recentTracks.length,
            latestActivityAt: recentTracks[0]?.addedAt ?? result.tracks[0]?.addedAt ?? null,
          };
        }),
      );

      const items: GuestEventActivity[] = [];
      for (const response of responses) {
        if (response.status === 'fulfilled') {
          items.push(response.value);
        }
      }

      return items.sort(
        (a, b) => toTimestamp(b.latestActivityAt) - toTimestamp(a.latestActivityAt),
      );
    },
  });

  const activeDraft = draftsQuery.data?.[0] ?? null;
  const subscribedSyncs = syncsQuery.data?.subscribedSyncs ?? [];
  const dashboardSummary = dashboardSummaryQuery.data;
  const guestActivities = guestActivityQuery.data ?? [];

  const subscribedSyncMap = useMemo(
    () => new Map(subscribedSyncs.map((sync) => [sync.id, sync])),
    [subscribedSyncs],
  );

  const formatTimeAgo = useCallback(
    (value: string | null) => {
      if (!value) {
        return null;
      }

      try {
        const diff = Date.now() - Date.parse(value);
        const mins = Math.floor(diff / 60_000);
        const hours = Math.floor(diff / 3_600_000);
        const days = Math.floor(diff / DAY_MS);
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

  useEffect(() => {
    const error =
      (syncsQuery.isError && syncsQuery.error) ||
      (dashboardSummaryQuery.isError && dashboardSummaryQuery.error);
    if (!error) {
      return;
    }

    showToast(t('dashboard.error', { message: (error as Error).message }), {
      variant: 'error',
    });
  }, [
    dashboardSummaryQuery.error,
    dashboardSummaryQuery.isError,
    showToast,
    syncsQuery.error,
    syncsQuery.isError,
    t,
  ]);

  const ownerEventActivity = useMemo(
    () => dashboardSummary?.ownerEventActivity ?? [],
    [dashboardSummary?.ownerEventActivity],
  );
  const ownerSyncActivity = useMemo(
    () => dashboardSummary?.ownerSyncActivity ?? [],
    [dashboardSummary?.ownerSyncActivity],
  );
  const subscriberSyncActivity = useMemo(
    () => dashboardSummary?.subscriberSyncActivity ?? [],
    [dashboardSummary?.subscriberSyncActivity],
  );

  const ownedOverviewRows = useMemo<OverviewRow[]>(() => {
    const eventRows = ownerEventActivity.map((item) => ({
      id: `owned-event-${item.eventId}`,
      playlistName: item.name,
      href: `/playlists/${item.eventId}`,
      roleLabel: t('dashboard.roleOwner'),
      metrics: {
        primary: t('dashboard.metricSongsAdded24h', { count: item.addedTrackCount24h }),
        badge:
          item.addedTrackCount24h > 0
            ? t('dashboard.badgeSongs24h', { count: item.addedTrackCount24h })
            : null,
      },
      sortAt: toTimestamp(item.latestActivityAt),
    }));

    const syncRows = ownerSyncActivity.map((item) => ({
      id: `owned-sync-${item.syncId}`,
      playlistName: item.name,
      href: `/synced-lists/${item.syncId}`,
      roleLabel: t('dashboard.roleOwner'),
      metrics: {
        primary: t('dashboard.metricTotalSubscribers', { count: item.totalSubscriberCount }),
        pills: [
          t('dashboard.badgeGrowth24hAbbrev', { count: item.newSubscriberCount24h }),
          t('dashboard.metricTotalCount', { count: item.totalSubscriberCount }),
        ],
      },
      sortAt: toTimestamp(item.latestActivityAt),
    }));

    return [...syncRows, ...eventRows].sort((a, b) => b.sortAt - a.sortAt);
  }, [ownerEventActivity, ownerSyncActivity, t]);

  const partOfOverviewRows = useMemo<OverviewRow[]>(() => {
    const guestRows = guestActivities.map((item) => ({
      id: `guest-event-${item.magicLinkToken}`,
      playlistName: item.name,
      href: `/playlist/${item.magicLinkToken}`,
      roleLabel: t('dashboard.roleGuest'),
      metrics: {
        primary: t('dashboard.metricRecentSongs', { count: item.recentAddedCount }),
      },
      sortAt: toTimestamp(item.latestActivityAt),
    }));

    const subscriberRows = subscriberSyncActivity.map((item) => {
      const sync = subscribedSyncMap.get(item.syncId);
      return {
        id: `subscriber-sync-${item.syncId}`,
        playlistName: sync?.name ?? item.name,
        href: sync ? `/sync/${sync.magicLinkToken}` : '#',
        roleLabel: t('dashboard.roleSubscriber'),
        metrics: {
          primary: t('dashboard.metricSongsAdded7d', { count: item.addedTrackCount7d }),
          status: item.ownerAddedTracks7d
            ? t('dashboard.subscriberOwnerActive')
            : t('dashboard.subscriberOwnerInactive'),
        },
        sortAt: toTimestamp(item.latestActivityAt),
      };
    });

    return [...guestRows, ...subscriberRows].sort((a, b) => b.sortAt - a.sortAt);
  }, [guestActivities, subscribedSyncMap, subscriberSyncActivity, t]);

  const activityRows = useMemo<ActivityRow[]>(() => {
    const ownerEventRows = ownerEventActivity
      .filter((item) => item.addedTrackCount24h > 0)
      .map((item) => ({
        id: `activity-owner-event-${item.eventId}`,
        playlistName: item.name,
        href: `/playlists/${item.eventId}#tracks`,
        roleTypeLabel: t('dashboard.roleTypeOwnerEvent'),
        description: t('dashboard.activityOwnerEventSongs', { count: item.addedTrackCount24h }),
        timeLabel: formatTimeAgo(item.latestActivityAt),
        sortAt: toTimestamp(item.latestActivityAt),
      }));

    const ownerSyncRows = ownerSyncActivity.flatMap((item) => {
      if (item.recentSubscribers.length > 0) {
        return item.recentSubscribers.map((subscriber) => ({
          id: `activity-owner-sync-${item.syncId}-${subscriber.userId}-${subscriber.subscribedAt}`,
          playlistName: item.name,
          href: `/synced-lists/${item.syncId}`,
          roleTypeLabel: t('dashboard.roleTypeOwnerSync'),
          description: t('dashboard.activityOwnerSyncSubscriber', {
            name: subscriber.name,
          }),
          timeLabel: formatTimeAgo(subscriber.subscribedAt),
          sortAt: toTimestamp(subscriber.subscribedAt),
        }));
      }

      if (item.newSubscriberCount24h > 0) {
        return [
          {
            id: `activity-owner-sync-${item.syncId}`,
            playlistName: item.name,
            href: `/synced-lists/${item.syncId}`,
            roleTypeLabel: t('dashboard.roleTypeOwnerSync'),
            description: t('dashboard.activityOwnerSyncSubscribers', {
              count: item.newSubscriberCount24h,
            }),
            timeLabel: formatTimeAgo(item.latestActivityAt),
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
        roleTypeLabel: t('dashboard.roleTypeGuestEvent'),
        description: t('dashboard.activityGuestSongs', { count: item.recentAddedCount }),
        timeLabel: formatTimeAgo(item.latestActivityAt),
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
          roleTypeLabel: t('dashboard.roleTypeSubscriberSync'),
          description: t('dashboard.activitySubscriberSongs', {
            count: item.addedTrackCount7d,
          }),
          timeLabel: formatTimeAgo(item.latestActivityAt),
          sortAt: toTimestamp(item.latestActivityAt),
        };
      });

    return [...ownerSyncRows, ...ownerEventRows, ...guestRows, ...subscriberRows].sort(
      (a, b) => b.sortAt - a.sortAt,
    );
  }, [
    formatTimeAgo,
    guestActivities,
    ownerEventActivity,
    ownerSyncActivity,
    subscribedSyncMap,
    subscriberSyncActivity,
    t,
  ]);

  const hasDashboardContent =
    ownedOverviewRows.length > 0 || partOfOverviewRows.length > 0 || guestHistory.length > 0;
  const isInitialLoad = syncsQuery.isLoading || dashboardSummaryQuery.isLoading;
  const showCreatePlaylistCta = ownedOverviewRows.length === 0;

  const activateRow = useCallback(
    (href: string) => {
      void navigate({ to: href as never });
    },
    [navigate],
  );

  const onRowKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTableRowElement>, href: string) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      event.preventDefault();
      activateRow(href);
    },
    [activateRow],
  );

  const renderOverviewTable = (
    rows: OverviewRow[],
    emptyKey: string,
    metricsHeaderKey = 'dashboard.tableMetrics',
  ) =>
    rows.length === 0 ? (
      <p className="px-4 py-5 text-sm text-app-text-secondary">{t(emptyKey)}</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed">
          <thead>
            <tr className="border-b border-app-border">
              <th className="w-[35%] px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide text-app-text-secondary">
                {t('dashboard.tablePlaylist')}
              </th>
              <th className="w-[20%] px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide text-app-text-secondary">
                {t('dashboard.tableRole')}
              </th>
              <th className="w-[37%] px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide text-app-text-secondary">
                {t(metricsHeaderKey)}
              </th>
              <th className="w-[8%] px-4 py-3 text-right text-[11px] font-black uppercase tracking-wide text-app-text-secondary">
                <span className="sr-only">{t('dashboard.tableOpen')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                role="link"
                tabIndex={0}
                onClick={() => activateRow(row.href)}
                onKeyDown={(event) => onRowKeyDown(event, row.href)}
                className="group cursor-pointer border-b border-app-border transition-colors hover:bg-brand-pink/5 focus:bg-brand-pink/5 focus:outline-none last:border-b-0"
              >
                <td className="px-4 py-4 align-middle">
                  <span className="block truncate text-sm font-black text-brand-dark transition-colors group-hover:text-brand-pink group-focus:text-brand-pink dark:text-brand-white dark:group-hover:text-brand-pink dark:group-focus:text-brand-pink">
                    {row.playlistName}
                  </span>
                </td>
                <td className="px-4 py-4 align-middle">
                  <span className="inline-flex rounded-full bg-brand-lime/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#6d9600] dark:text-[#d5ff5c]">
                    {row.roleLabel}
                  </span>
                </td>
                <td className="px-4 py-4 align-middle">
                  <div className="grid gap-2">
                    {row.metrics.pills && row.metrics.pills.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {row.metrics.pills.map((pill) => (
                          <span
                            key={pill}
                            className="inline-flex w-fit rounded-full bg-sky-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300"
                          >
                            {pill}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm font-semibold text-brand-dark dark:text-brand-white">
                        {row.metrics.primary}
                      </p>
                    )}
                    {row.metrics.secondary ? (
                      <p className="text-xs text-app-text-secondary">{row.metrics.secondary}</p>
                    ) : null}
                    {row.metrics.badge && (!row.metrics.pills || row.metrics.pills.length === 0) ? (
                      <span className="inline-flex w-fit rounded-full bg-sky-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                        {row.metrics.badge}
                      </span>
                    ) : null}
                    {row.metrics.status ? (
                      <span
                        className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                          row.metrics.status === t('dashboard.subscriberOwnerActive')
                            ? 'bg-brand-lime/15 text-[#6d9600] dark:text-[#d5ff5c]'
                            : 'bg-app-border text-app-text-secondary'
                        }`}
                      >
                        {row.metrics.status}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-4 align-middle text-right">
                  <ArrowUpRight
                    size={14}
                    aria-hidden="true"
                    className="ml-auto shrink-0 text-app-text-secondary transition duration-150 ease-out group-hover:text-brand-pink group-focus:text-brand-pink motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5 motion-safe:group-focus:translate-x-0.5 motion-safe:group-focus:-translate-y-0.5"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  const renderActivityTable = (rows: ActivityRow[]) =>
    rows.length === 0 ? (
      <p className="px-4 py-5 text-sm text-app-text-secondary">{t('dashboard.activityEmpty')}</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed">
          <thead>
            <tr className="border-b border-app-border">
              <th className="w-[27%] px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide text-app-text-secondary">
                {t('dashboard.tablePlaylist')}
              </th>
              <th className="w-[26%] px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide text-app-text-secondary">
                {t('dashboard.activityTableRoleType')}
              </th>
              <th className="w-[24%] px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide text-app-text-secondary">
                {t('dashboard.activityTableDescription')}
              </th>
              <th className="w-[15%] px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide text-app-text-secondary">
                {t('dashboard.activityTableTime')}
              </th>
              <th className="w-[8%] px-4 py-3 text-right text-[11px] font-black uppercase tracking-wide text-app-text-secondary">
                <span className="sr-only">{t('dashboard.tableOpen')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                role="link"
                tabIndex={0}
                onClick={() => activateRow(row.href)}
                onKeyDown={(event) => onRowKeyDown(event, row.href)}
                className="group cursor-pointer border-b border-app-border transition-colors hover:bg-brand-pink/5 focus:bg-brand-pink/5 focus:outline-none last:border-b-0"
              >
                <td className="px-4 py-4 align-middle">
                  <span className="block truncate text-sm font-black text-brand-dark transition-colors group-hover:text-brand-pink group-focus:text-brand-pink dark:text-brand-white dark:group-hover:text-brand-pink dark:group-focus:text-brand-pink">
                    {row.playlistName}
                  </span>
                </td>
                <td className="px-4 py-4 align-middle">
                  <span className="inline-flex rounded-full bg-sky-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                    {row.roleTypeLabel}
                  </span>
                </td>
                <td className="px-4 py-4 align-middle text-sm text-brand-dark dark:text-brand-white">
                  {row.description}
                </td>
                <td className="px-4 py-4 align-middle text-xs text-app-text-secondary">
                  {row.timeLabel ?? t('dashboard.activityTimeUnknown')}
                </td>
                <td className="px-4 py-4 align-middle text-right">
                  <ArrowUpRight
                    size={14}
                    aria-hidden="true"
                    className="ml-auto shrink-0 text-app-text-secondary transition duration-150 ease-out group-hover:text-brand-pink group-focus:text-brand-pink motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5 motion-safe:group-focus:translate-x-0.5 motion-safe:group-focus:-translate-y-0.5"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

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
          <header className="flex items-start justify-between gap-4 sm:px-2 sm:pb-2">
            <div className="grid gap-1">
              <p className="text-xs font-bold uppercase tracking-widest text-app-text-secondary">
                {t('dashboard.pill')}
              </p>
              <h1 className="text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl">
                {t('dashboard.title')}
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-app-text-secondary sm:text-base">
                {t('dashboard.description')}
              </p>
            </div>
            {showCreatePlaylistCta ? (
              <div className="hidden shrink-0 items-center gap-3 sm:flex">
                <CTALink to="/synced-lists/new" variant="secondary" size="lg">
                  {t('dashboard.ctaCreateSyncedPlaylist')}
                </CTALink>
                <CTALink
                  to={activeDraft ? `/playlists/new?draftId=${activeDraft.id}` : '/playlists/new'}
                  variant="primary"
                  size="lg"
                >
                  <Plus size={16} aria-hidden="true" />
                  {activeDraft ? t('dashboard.ctaResumeDraft') : t('dashboard.ctaCreateEvent')}
                </CTALink>
              </div>
            ) : null}
          </header>

          {showCreatePlaylistCta ? (
            <div className="grid gap-3 sm:hidden">
              <CTALink to="/synced-lists/new" variant="secondary" className="w-full justify-center">
                {t('dashboard.ctaCreateSyncedPlaylist')}
              </CTALink>
              <CTALink
                to={activeDraft ? `/playlists/new?draftId=${activeDraft.id}` : '/playlists/new'}
                variant="primary"
                className="w-full justify-center"
              >
                <Plus size={16} aria-hidden="true" />
                {activeDraft ? t('dashboard.ctaResumeDraft') : t('dashboard.ctaCreateEvent')}
              </CTALink>
            </div>
          ) : null}

          <section className="grid gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black tracking-tight text-brand-dark dark:text-brand-white">
                  {t('dashboard.overviewTitle')}
                </h2>
                <p className="mt-1 text-sm text-app-text-secondary">
                  {t('dashboard.overviewDescription')}
                </p>
              </div>
              {isInitialLoad || dashboardSummaryQuery.isFetching ? (
                <RefreshCcw
                  size={14}
                  className="animate-spin text-app-text-secondary"
                  aria-hidden="true"
                />
              ) : null}
            </div>

            <article className="overflow-hidden rounded-3xl border border-app-border bg-app-elevated dark:bg-app-card">
              <div className="border-b border-app-border px-4 py-4">
                <h3 className="text-sm font-black text-brand-dark dark:text-brand-white">
                  {t('dashboard.overviewOwnedTitle')}
                </h3>
                <p className="mt-1 text-xs text-app-text-secondary">
                  {t('dashboard.overviewOwnedBody')}
                </p>
              </div>
              {renderOverviewTable(
                ownedOverviewRows,
                'dashboard.overviewOwnedEmpty',
                'dashboard.tableSubscribers',
              )}
            </article>

            <article className="overflow-hidden rounded-3xl border border-app-border bg-app-elevated dark:bg-app-card">
              <div className="border-b border-app-border px-4 py-4">
                <h3 className="text-sm font-black text-brand-dark dark:text-brand-white">
                  {t('dashboard.overviewJoinedTitle')}
                </h3>
                <p className="mt-1 text-xs text-app-text-secondary">
                  {t('dashboard.overviewJoinedBody')}
                </p>
              </div>
              {renderOverviewTable(partOfOverviewRows, 'dashboard.overviewJoinedEmpty')}
            </article>
          </section>

          <section className="grid gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black tracking-tight text-brand-dark dark:text-brand-white">
                  {t('dashboard.activityTitle')}
                </h2>
                <p className="mt-1 text-sm text-app-text-secondary">
                  {t('dashboard.activityDescription')}
                </p>
              </div>
              {dashboardSummaryQuery.isFetching || guestActivityQuery.isFetching ? (
                <RefreshCcw
                  size={14}
                  className="animate-spin text-app-text-secondary"
                  aria-hidden="true"
                />
              ) : null}
            </div>

            <div className="overflow-hidden rounded-3xl border border-app-border bg-app-elevated dark:bg-app-card">
              {renderActivityTable(activityRows)}
            </div>
          </section>
        </>
      )}
    </AppPageLayout>
  );
};
