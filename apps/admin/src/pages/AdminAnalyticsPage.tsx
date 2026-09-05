import {
  adminPermissionScopeSchema,
  analyticsTargetSchema,
  type AdminAnalyticsOverviewRange,
  type AdminAnalyticsOverviewResponse,
  type AdminAnalyticsUserDetailResponse,
  type AdminAnalyticsUserSummary,
  type AdminPermissionLevel,
  type AdminPermissionScope,
} from '@synqit/shared';
import { AccordionSection, SlideOverPanel } from '@synqit/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import {
  AnalyticsFilterDrawer,
  EMPTY_FILTERS,
  activeFilterCount,
  type AnalyticsFilters,
} from '../components/admin/AnalyticsFilterDrawer';
import { PermissionLevelSlider } from '../components/admin/PermissionLevelSlider';
import { CTAButton } from '../components/ui/cta';
import { useI18n } from '../hooks/useI18n';
import { isDisplayableAnalyticsPath } from '../lib/analytics-display';
import { callApi, toApiError } from '../lib/api';
import { clearAuth, hasAdminPermission } from '../lib/auth';
import {
  adminAnalyticsOverviewQueryOptions,
  adminQueryKeys,
  adminUserDetailQueryOptions,
  adminUsersQueryOptions,
} from '../lib/queries';

type AnalyticsUserSummary = AdminAnalyticsUserSummary;
type AnalyticsUserDetail = AdminAnalyticsUserDetailResponse['user'];
type AccessLevelUi = AdminPermissionLevel | 'none';

type AccessEditorState = {
  role: 'user' | 'admin';
  scopeLevels: Record<AdminPermissionScope, AccessLevelUi>;
};

const toAccessEditorState = (
  role: 'user' | 'admin',
  permissions: Array<{ scope: AdminPermissionScope; level: AdminPermissionLevel }>,
): AccessEditorState => {
  const nextScopeLevels = defaultScopeLevels();
  for (const permission of permissions) {
    nextScopeLevels[permission.scope] = permission.level;
  }

  return {
    role,
    scopeLevels: nextScopeLevels,
  };
};

const defaultScopeLevels = (): Record<AdminPermissionScope, AccessLevelUi> =>
  Object.fromEntries(adminPermissionScopeSchema.options.map((scope) => [scope, 'none'])) as Record<
    AdminPermissionScope,
    AccessLevelUi
  >;

const providerLabel = (provider: 'spotify' | 'apple'): string =>
  provider === 'spotify' ? 'Spotify' : 'Apple Music';

export const AdminAnalyticsPage = () => {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<AnalyticsFilters>({
    range: '24h',
    ...EMPTY_FILTERS,
  });
  const [draftFilters, setDraftFilters] = useState<AnalyticsFilters>(appliedFilters);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isSavingAccess, setIsSavingAccess] = useState(false);
  const [accessEditor, setAccessEditor] = useState<AccessEditorState | null>(null);

  const usersQuery = useQuery(adminUsersQueryOptions());
  const overviewQuery = useQuery(adminAnalyticsOverviewQueryOptions(appliedFilters));
  const detailQuery = useQuery({
    ...adminUserDetailQueryOptions(selectedUserId ?? ''),
    enabled: selectedUserId !== null,
  });
  const users: AnalyticsUserSummary[] = usersQuery.data?.users ?? [];
  const overview: AdminAnalyticsOverviewResponse | null = overviewQuery.data ?? null;
  const isLoadingUsers = usersQuery.isPending;
  const isLoadingOverview = overviewQuery.isPending;
  const selectedUserDetail: AnalyticsUserDetail | null =
    selectedUserId !== null ? (detailQuery.data?.user ?? null) : null;
  const isLoadingDetail = selectedUserId !== null && detailQuery.isPending;

  const scopes = useMemo(() => adminPermissionScopeSchema.options, []);
  const canManageAdmins = useMemo(() => hasAdminPermission('admin_users', 'write'), []);

  const formatDate = useMemo(() => {
    return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }, [locale]);

  const normalizeDate = useCallback(
    (value: string | null): string => {
      if (!value) {
        return '—';
      }
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return '—';
      }
      return formatDate.format(parsed);
    },
    [formatDate],
  );

  const handleAccessError = useCallback(
    (error: unknown): string | null => {
      const apiError = toApiError(error);
      if (apiError.code === 'unauthorized' || apiError.code === 'forbidden') {
        clearAuth();
        void navigate({ to: '/login' });
        return null;
      }
      return apiError.message;
    },
    [navigate],
  );

  const openUserDetails = useCallback((userId: string) => {
    setSelectedUserId(userId);
    setAccessEditor(null);
    setStatus(null);
  }, []);

  const refreshData = useCallback(async () => {
    setStatus(null);
    await queryClient.invalidateQueries({ queryKey: adminQueryKeys.all });
  }, [queryClient]);

  // Mirror server state into the access editor whenever a user detail loads.
  useEffect(() => {
    if (selectedUserId !== null && detailQuery.data) {
      setAccessEditor(
        toAccessEditorState(detailQuery.data.user.role, detailQuery.data.user.adminPermissions),
      );
    }
  }, [detailQuery.data, selectedUserId]);

  useEffect(() => {
    const error = usersQuery.error ?? overviewQuery.error ?? detailQuery.error;
    if (error) {
      const message = handleAccessError(error);
      if (message) {
        setStatus(message);
      }
    }
  }, [detailQuery.error, handleAccessError, overviewQuery.error, usersQuery.error]);

  const saveAccess = useCallback(async () => {
    if (!selectedUserDetail || !accessEditor) {
      return;
    }

    setIsSavingAccess(true);
    setStatus(null);
    try {
      const adminPermissions =
        accessEditor.role === 'admin'
          ? scopes
              .map((scope) => {
                const level = accessEditor.scopeLevels[scope];
                if (level === 'none') {
                  return null;
                }
                return { scope, level };
              })
              .filter(
                (value): value is { scope: AdminPermissionScope; level: AdminPermissionLevel } =>
                  value !== null,
              )
          : [];

      await callApi(
        `/v1/admin/users/${selectedUserDetail.userId}/access`,
        {
          method: 'PUT',
          body: JSON.stringify({
            role: accessEditor.role,
            adminPermissions,
          }),
        },
        (payload) => payload,
      );

      await refreshData();
      setStatus(t('admin.accessUpdated'));
    } catch (error) {
      const message = handleAccessError(error);
      if (message) {
        setStatus(message);
      }
    } finally {
      setIsSavingAccess(false);
    }
  }, [
    accessEditor,
    handleAccessError,
    openUserDetails,
    refreshData,
    scopes,
    selectedUserDetail,
    t,
  ]);

  const overviewRangeOptions = useMemo(
    () =>
      [
        { value: '24h', label: t('admin.analyticsRange24h') },
        { value: '7d', label: t('admin.analyticsRange7d') },
        { value: '14d', label: t('admin.analyticsRange14d') },
        { value: '30d', label: t('admin.analyticsRange30d') },
        { value: '45d', label: t('admin.analyticsRange45d') },
        { value: '90d', label: t('admin.analyticsRange90d') },
        { value: 'all', label: t('admin.analyticsRangeAll') },
      ] as const satisfies Array<{
        value: AdminAnalyticsOverviewRange;
        label: string;
      }>,
    [t],
  );

  const selectedOverviewRangeLabel =
    overviewRangeOptions.find((option) => option.value === appliedFilters.range)?.label ??
    overviewRangeOptions[0]?.label ??
    '';

  const featureOptions = useMemo(
    () =>
      analyticsTargetSchema.options.map((value) => ({
        value,
        label: value.charAt(0).toUpperCase() + value.slice(1),
      })),
    [],
  );
  const pageFilterOptions = useMemo(() => {
    const paths = new Set<string>();
    for (const row of overview?.pageViewsByPath ?? []) paths.add(row.path);
    for (const row of overview?.site.topPages ?? []) paths.add(row.path);
    return Array.from(paths).sort();
  }, [overview]);
  const appliedFilterCount = activeFilterCount(appliedFilters);

  const openFilterDrawer = () => {
    setDraftFilters(appliedFilters);
    setIsFilterDrawerOpen(true);
  };
  const applyDraftFilters = () => {
    setAppliedFilters(draftFilters);
    setIsFilterDrawerOpen(false);
  };
  const clearDraftFilters = () => {
    setDraftFilters((current) => ({ range: current.range, ...EMPTY_FILTERS }));
  };

  const topUsersByPlaylists = useMemo(
    () =>
      [...users]
        .sort(
          (a, b) =>
            b.eventPlaylistsCount +
            b.sharedPlaylistsCount -
            (a.eventPlaylistsCount + a.sharedPlaylistsCount),
        )
        .slice(0, 6),
    [users],
  );
  const summaryPageViews = useMemo(
    () => (overview?.pageViewsByPath ?? []).filter((row) => isDisplayableAnalyticsPath(row.path)),
    [overview],
  );
  const selectedUserPageViews = useMemo(
    () =>
      (selectedUserDetail?.pageViewsByPath ?? []).filter((row) =>
        isDisplayableAnalyticsPath(row.path, { appOnly: true }),
      ),
    [selectedUserDetail],
  );
  const maxPathViews = summaryPageViews.reduce((max, row) => Math.max(max, row.views), 0) || 1;
  const maxDayViews =
    overview?.pageViewsByDay.reduce((max, row) => Math.max(max, row.views), 0) ?? 1;

  const funnelStepLabels: Record<string, string> = {
    sessions: t('admin.analyticsFunnelSessions'),
    registered: t('admin.analyticsFunnelRegistered'),
    providerConnected: t('admin.analyticsFunnelProviderConnected'),
    eventCreated: t('admin.analyticsFunnelEventCreated'),
    shared: t('admin.analyticsFunnelShared'),
  };
  const funnelSteps = useMemo(() => {
    const entries = overview?.funnel ?? [];
    const first = entries[0]?.count ?? 0;
    return entries.map((entry, index) => {
      const previous = index === 0 ? entry.count : entries[index - 1].count;
      return {
        ...entry,
        widthPct: first > 0 ? Math.max(4, Math.round((entry.count / first) * 100)) : 0,
        conversionFromPrev: previous > 0 ? Math.round((entry.count / previous) * 100) : 0,
      };
    });
  }, [overview]);
  const isErrorEventName = (name: string) => /_(failed|blocked|warning)$/.test(name);
  const errorEvents = useMemo(
    () => (overview?.eventBreakdown ?? []).filter((row) => isErrorEventName(row.eventName)),
    [overview],
  );
  const maxEventCount =
    (overview?.eventBreakdown ?? []).reduce((max, row) => Math.max(max, row.count), 0) || 1;
  const maxActiveSessions =
    overview?.engagement.activeSessionsByDay.reduce((max, row) => Math.max(max, row.sessions), 0) ||
    1;
  const maxSiteTraffic =
    overview?.site.trafficByDay.reduce((max, row) => Math.max(max, row.views), 0) || 1;
  const maxSitePageViews =
    overview?.site.topPages.reduce((max, row) => Math.max(max, row.views), 0) || 1;
  const maxSiteSectionViews =
    overview?.site.topSections.reduce((max, row) => Math.max(max, row.views), 0) || 1;
  const maxSiteClicks =
    overview?.site.topClicks.reduce((max, row) => Math.max(max, row.clicks), 0) || 1;

  return (
    <section className="grid content-start gap-6">
      <AdminSectionHeader
        title={t('admin.analyticsOverviewTitle')}
        description={t('admin.portalSubtitle')}
      />

      <article className="grid gap-4 rounded-3xl border border-app-border bg-app-elevated p-4 shadow-soft-lift sm:p-5 dark:bg-app-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-black text-app-text">{t('admin.analyticsOverviewTitle')}</h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <CTAButton
              type="button"
              variant="secondary"
              onClick={() => void refreshData()}
              className="w-full justify-center sm:w-auto"
            >
              {t('admin.analyticsRefresh')}
            </CTAButton>
            <CTAButton
              type="button"
              variant="secondary"
              onClick={openFilterDrawer}
              aria-haspopup="dialog"
              className="w-full justify-center sm:w-auto"
            >
              {t('admin.analyticsFilterButton')}: {selectedOverviewRangeLabel}
              {appliedFilterCount > 0 ? (
                <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-lime px-1.5 text-[11px] font-black text-brand-dark">
                  {appliedFilterCount}
                </span>
              ) : null}
            </CTAButton>
          </div>
        </div>

        {isLoadingOverview || !overview ? (
          <p className="text-sm text-app-text-secondary">{t('admin.analyticsLoading')}</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-app-border bg-app-surface p-4 dark:bg-app-card">
                <p className="text-xs font-semibold text-app-text-secondary">
                  {t('admin.analyticsMetricNewUsers')}
                </p>
                <p className="text-2xl font-black text-app-text">{overview.totals.usersCount}</p>
              </div>
              <div className="rounded-2xl border border-app-border bg-app-surface p-4 dark:bg-app-card">
                <p className="text-xs font-semibold text-app-text-secondary">
                  {t('admin.analyticsMetricPageViews')}
                </p>
                <p className="text-2xl font-black text-app-text">
                  {overview.totals.pageViewsCount}
                </p>
              </div>
              <div className="rounded-2xl border border-app-border bg-app-surface p-4 dark:bg-app-card">
                <p className="text-xs font-semibold text-app-text-secondary">
                  {t('admin.analyticsMetricUniqueSessions')}
                </p>
                <p className="text-2xl font-black text-app-text">
                  {overview.totals.uniqueSessionsCount}
                </p>
              </div>
              <div className="rounded-2xl border border-app-border bg-app-surface p-4 dark:bg-app-card">
                <p className="text-xs font-semibold text-app-text-secondary">
                  {t('admin.analyticsMetricTrackedEvents')}
                </p>
                <p className="text-2xl font-black text-app-text">
                  {overview.totals.trackedEventsCount}
                </p>
              </div>
            </div>

            <div className="grid items-start gap-3 lg:grid-cols-2">
              <div className="grid content-start gap-2 rounded-2xl border border-app-border bg-app-surface p-4 dark:bg-app-card">
                <h3 className="text-sm font-black text-app-text">
                  {t('admin.analyticsPageViewsByPath')}
                </h3>
                {summaryPageViews.length === 0 ? (
                  <p className="text-xs font-semibold text-app-text-secondary">
                    {t('admin.analyticsEmpty')}
                  </p>
                ) : (
                  <div className="grid content-start gap-2">
                    {summaryPageViews.map((row) => {
                      const width = Math.max(6, Math.round((row.views / maxPathViews) * 100));
                      return (
                        <div
                          key={row.path}
                          className="grid gap-1 rounded-lg border border-app-border bg-app-bg p-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2 text-app-text-secondary">
                            <span className="truncate">{row.path}</span>
                            <span className="font-black text-app-text">{row.views}</span>
                          </div>
                          <span className="h-2 rounded-full bg-brand-pink/20">
                            <span
                              className="block h-2 rounded-full bg-brand-pink"
                              style={{ width: `${width}%` }}
                            />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid content-start gap-2 rounded-2xl border border-app-border bg-app-surface p-4 dark:bg-app-card">
                <h3 className="text-sm font-black text-app-text">
                  {t('admin.analyticsPageViewsByDay')}
                </h3>
                {overview.pageViewsByDay.length === 0 ? (
                  <p className="text-xs font-semibold text-app-text-secondary">
                    {t('admin.analyticsEmpty')}
                  </p>
                ) : (
                  <div className="grid content-start gap-2">
                    {overview.pageViewsByDay.map((row) => {
                      const width = Math.max(6, Math.round((row.views / maxDayViews) * 100));
                      return (
                        <div
                          key={row.day}
                          className="grid gap-1 rounded-lg border border-app-border bg-app-bg p-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2 text-app-text-secondary">
                            <span className="truncate">{row.day}</span>
                            <span className="font-black text-app-text">{row.views}</span>
                          </div>
                          <span className="h-2 rounded-full bg-brand-lime/20">
                            <span
                              className="block h-2 rounded-full bg-brand-lime"
                              style={{ width: `${width}%` }}
                            />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="grid content-start gap-2 rounded-2xl border border-app-border bg-app-surface p-4 dark:bg-app-card">
              <h3 className="text-sm font-black text-app-text">
                {t('admin.analyticsFunnelTitle')}
              </h3>
              {funnelSteps.length === 0 ? (
                <p className="text-xs font-semibold text-app-text-secondary">
                  {t('admin.analyticsEmpty')}
                </p>
              ) : (
                <div className="grid content-start gap-2">
                  {funnelSteps.map((entry, index) => (
                    <div
                      key={entry.step}
                      className="grid gap-1 rounded-lg border border-app-border bg-app-bg p-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2 text-app-text-secondary">
                        <span className="truncate font-semibold text-app-text">
                          {funnelStepLabels[entry.step] ?? entry.step}
                        </span>
                        <span className="flex items-center gap-2">
                          {index > 0 ? (
                            <span className="font-semibold text-app-text-secondary">
                              {entry.conversionFromPrev}%
                            </span>
                          ) : null}
                          <span className="font-black text-app-text">{entry.count}</span>
                        </span>
                      </div>
                      <span className="h-2 rounded-full bg-brand-lime/20">
                        <span
                          className="block h-2 rounded-full bg-brand-lime"
                          style={{ width: `${entry.widthPct}%` }}
                        />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid items-start gap-3 lg:grid-cols-2">
              <div className="grid content-start gap-2 rounded-2xl border border-app-border bg-app-surface p-4 dark:bg-app-card">
                <h3 className="text-sm font-black text-app-text">
                  {t('admin.analyticsEventBreakdownTitle')}
                </h3>
                {overview.eventBreakdown.length === 0 ? (
                  <p className="text-xs font-semibold text-app-text-secondary">
                    {t('admin.analyticsEmpty')}
                  </p>
                ) : (
                  <div className="grid max-h-80 content-start gap-2 overflow-y-auto pr-1">
                    {overview.eventBreakdown.map((row) => {
                      const width = Math.max(4, Math.round((row.count / maxEventCount) * 100));
                      const isError = isErrorEventName(row.eventName);
                      return (
                        <div
                          key={`${row.eventName}-${row.target}`}
                          className={`grid gap-1 rounded-lg border p-2 text-xs ${
                            isError
                              ? 'border-brand-pink/40 bg-brand-pink/5'
                              : 'border-app-border bg-app-bg'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-app-text-secondary">
                            <span className="truncate font-mono text-[11px] text-app-text">
                              {row.eventName}
                            </span>
                            <span className="flex items-center gap-2 whitespace-nowrap">
                              <span title={t('admin.analyticsEventSessions')}>{row.sessions}</span>
                              <span className="font-black text-app-text">{row.count}</span>
                            </span>
                          </div>
                          <span
                            className={`h-2 rounded-full ${isError ? 'bg-brand-pink/20' : 'bg-brand-pink/10'}`}
                          >
                            <span
                              className={`block h-2 rounded-full ${isError ? 'bg-brand-pink' : 'bg-app-text/40'}`}
                              style={{ width: `${width}%` }}
                            />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid content-start gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-app-border bg-app-surface p-4 dark:bg-app-card">
                    <p className="text-xs font-semibold text-app-text-secondary">
                      {t('admin.analyticsReturningSessions')}
                    </p>
                    <p className="text-2xl font-black text-app-text">
                      {overview.engagement.returningSessionsCount}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-app-border bg-app-surface p-4 dark:bg-app-card">
                    <p className="text-xs font-semibold text-app-text-secondary">
                      {t('admin.analyticsAvgEventsPerSession')}
                    </p>
                    <p className="text-2xl font-black text-app-text">
                      {overview.engagement.avgEventsPerSession}
                    </p>
                  </div>
                </div>
                <div className="grid content-start gap-2 rounded-2xl border border-app-border bg-app-surface p-4 dark:bg-app-card">
                  <h3 className="text-sm font-black text-app-text">
                    {t('admin.analyticsActiveSessionsByDay')}
                  </h3>
                  {overview.engagement.activeSessionsByDay.length === 0 ? (
                    <p className="text-xs font-semibold text-app-text-secondary">
                      {t('admin.analyticsEmpty')}
                    </p>
                  ) : (
                    <div className="grid content-start gap-2">
                      {overview.engagement.activeSessionsByDay.map((row) => {
                        const width = Math.max(
                          6,
                          Math.round((row.sessions / maxActiveSessions) * 100),
                        );
                        return (
                          <div
                            key={row.day}
                            className="grid gap-1 rounded-lg border border-app-border bg-app-bg p-2 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2 text-app-text-secondary">
                              <span className="truncate">{row.day}</span>
                              <span className="font-black text-app-text">{row.sessions}</span>
                            </div>
                            <span className="h-2 rounded-full bg-brand-lime/20">
                              <span
                                className="block h-2 rounded-full bg-brand-lime"
                                style={{ width: `${width}%` }}
                              />
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {errorEvents.length > 0 ? (
              <div className="grid content-start gap-2 rounded-2xl border border-brand-pink/40 bg-brand-pink/5 p-4">
                <h3 className="text-sm font-black text-app-text">
                  {t('admin.analyticsErrorHealthTitle')}
                </h3>
                <div className="grid content-start gap-2">
                  {errorEvents.map((row) => (
                    <div
                      key={`err-${row.eventName}-${row.target}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-brand-pink/30 bg-app-bg p-2 text-xs"
                    >
                      <span className="truncate font-mono text-[11px] text-app-text">
                        {row.eventName}
                      </span>
                      <span className="font-black text-[#b41563] dark:text-[#ff8ac0]">
                        {row.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid content-start gap-3 rounded-2xl border border-app-border bg-app-surface p-4 dark:bg-app-card">
              <h3 className="text-sm font-black text-app-text">{t('admin.analyticsSiteTitle')}</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-app-border bg-app-bg p-4">
                  <p className="text-xs font-semibold text-app-text-secondary">
                    {t('admin.analyticsSiteVisitors')}
                  </p>
                  <p className="text-2xl font-black text-app-text">
                    {overview.site.uniqueVisitors}
                  </p>
                </div>
                <div className="rounded-2xl border border-app-border bg-app-bg p-4">
                  <p className="text-xs font-semibold text-app-text-secondary">
                    {t('admin.analyticsSitePageViews')}
                  </p>
                  <p className="text-2xl font-black text-app-text">
                    {overview.site.pageViewsCount}
                  </p>
                </div>
                <div className="rounded-2xl border border-app-border bg-app-bg p-4">
                  <p className="text-xs font-semibold text-app-text-secondary">
                    {t('admin.analyticsSiteAvgTime')}
                  </p>
                  <p className="text-2xl font-black text-app-text">
                    {overview.site.avgEngagedSeconds}
                    {t('admin.analyticsSiteSecondsSuffix')}
                  </p>
                </div>
              </div>

              {overview.site.trafficByDay.length > 0 ? (
                <div className="grid content-start gap-2">
                  <h4 className="text-xs font-black uppercase tracking-wide text-app-text-secondary">
                    {t('admin.analyticsSiteTrafficByDay')}
                  </h4>
                  {overview.site.trafficByDay.map((row) => {
                    const width = Math.max(6, Math.round((row.views / maxSiteTraffic) * 100));
                    return (
                      <div
                        key={row.day}
                        className="grid gap-1 rounded-lg border border-app-border bg-app-bg p-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2 text-app-text-secondary">
                          <span className="truncate">{row.day}</span>
                          <span className="font-black text-app-text">{row.views}</span>
                        </div>
                        <span className="h-2 rounded-full bg-brand-lime/20">
                          <span
                            className="block h-2 rounded-full bg-brand-lime"
                            style={{ width: `${width}%` }}
                          />
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <div className="grid items-start gap-3 lg:grid-cols-3">
                {(
                  [
                    {
                      key: 'pages',
                      title: t('admin.analyticsSiteTopPages'),
                      rows: overview.site.topPages.map((row) => ({
                        label: row.path,
                        value: row.views,
                        max: maxSitePageViews,
                      })),
                    },
                    {
                      key: 'sections',
                      title: t('admin.analyticsSiteTopSections'),
                      rows: overview.site.topSections.map((row) => ({
                        label: row.section,
                        value: row.views,
                        max: maxSiteSectionViews,
                      })),
                    },
                    {
                      key: 'clicks',
                      title: t('admin.analyticsSiteTopClicks'),
                      rows: overview.site.topClicks.map((row) => ({
                        label: row.label,
                        value: row.clicks,
                        max: maxSiteClicks,
                      })),
                    },
                  ] as const
                ).map((column) => (
                  <div key={column.key} className="grid content-start gap-2">
                    <h4 className="text-xs font-black uppercase tracking-wide text-app-text-secondary">
                      {column.title}
                    </h4>
                    {column.rows.length === 0 ? (
                      <p className="text-xs font-semibold text-app-text-secondary">
                        {t('admin.analyticsEmpty')}
                      </p>
                    ) : (
                      column.rows.map((row) => {
                        const width = Math.max(6, Math.round((row.value / row.max) * 100));
                        return (
                          <div
                            key={`${column.key}-${row.label}`}
                            className="grid gap-1 rounded-lg border border-app-border bg-app-bg p-2 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2 text-app-text-secondary">
                              <span className="truncate">{row.label}</span>
                              <span className="font-black text-app-text">{row.value}</span>
                            </div>
                            <span className="h-2 rounded-full bg-brand-pink/15">
                              <span
                                className="block h-2 rounded-full bg-brand-pink"
                                style={{ width: `${width}%` }}
                              />
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-2 rounded-2xl border border-app-border bg-app-surface p-4 dark:bg-app-card">
              <h3 className="text-sm font-black text-app-text">{t('admin.analyticsTopHosts')}</h3>
              {isLoadingUsers ? (
                <p className="text-xs font-semibold text-app-text-secondary">
                  {t('admin.analyticsLoading')}
                </p>
              ) : topUsersByPlaylists.length === 0 ? (
                <p className="text-xs font-semibold text-app-text-secondary">
                  {t('admin.analyticsEmpty')}
                </p>
              ) : (
                <div className="grid gap-2">
                  {topUsersByPlaylists.map((user) => {
                    return (
                      <button
                        key={user.userId}
                        type="button"
                        onClick={() => void openUserDetails(user.userId)}
                        className="flex flex-col items-start gap-2 rounded-lg border border-app-border bg-app-bg p-3 text-left sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="min-w-0 truncate text-xs font-semibold text-app-text-secondary">
                          {user.email}
                        </span>
                        <div className="flex shrink-0 flex-wrap items-center gap-2 text-[11px] font-semibold text-app-text-secondary">
                          <span>
                            {user.eventPlaylistsCount} {t('admin.analyticsMetricEventsShort')}
                          </span>
                          <span>
                            {user.sharedPlaylistsCount} {t('admin.analyticsMetricSharedShort')}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {status ? (
              <p className="rounded-lg border border-app-border bg-app-surface px-3 py-2 text-xs font-semibold text-app-text-secondary">
                {status}
              </p>
            ) : null}
          </>
        )}
      </article>

      <AnalyticsFilterDrawer
        open={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        draft={draftFilters}
        onDraftChange={setDraftFilters}
        rangeOptions={overviewRangeOptions.map((option) => ({ ...option }))}
        featureOptions={featureOptions}
        pageOptions={pageFilterOptions}
        onApply={applyDraftFilters}
        onClear={clearDraftFilters}
      />

      <SlideOverPanel
        open={Boolean(selectedUserId)}
        onClose={() => {
          setSelectedUserId(null);
          setAccessEditor(null);
        }}
        title={selectedUserDetail?.email ?? t('admin.analyticsUserDetailTitle')}
        closeLabel={t('admin.analyticsDetailClose')}
      >
        {isLoadingDetail ? (
          <p className="text-sm text-app-text-secondary">{t('admin.analyticsDetailLoading')}</p>
        ) : selectedUserDetail ? (
          <div className="grid gap-4">
            <div className="grid gap-2 rounded-xl border border-app-border bg-app-elevated p-3 text-xs font-semibold text-app-text-secondary dark:bg-app-card">
              <div className="flex items-center justify-between gap-2">
                <span>{t('admin.analyticsColCreated')}</span>
                <span className="font-black text-app-text">
                  {normalizeDate(selectedUserDetail.createdAt)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>{t('admin.roleLabel')}</span>
                <span className="font-black text-app-text">{selectedUserDetail.role}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>{t('admin.analyticsMetricEventsShort')}</span>
                <span className="font-black text-app-text">
                  {selectedUserDetail.eventPlaylistsCount}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>{t('admin.analyticsMetricSharedShort')}</span>
                <span className="font-black text-app-text">
                  {selectedUserDetail.sharedPlaylistsCount}
                </span>
              </div>
            </div>

            {canManageAdmins && accessEditor ? (
              <AccordionSection title={t('admin.accessEditorTitle')}>
                <div className="flex flex-col gap-3 text-xs font-semibold uppercase tracking-wide text-app-text-secondary sm:flex-row sm:items-center sm:justify-between">
                  <span>{t('admin.roleLabel')}</span>
                  <div className="inline-grid grid-cols-2 rounded-lg border border-app-border bg-app-bg p-1">
                    <button
                      type="button"
                      onClick={() =>
                        setAccessEditor((current) =>
                          current ? { ...current, role: 'user' } : current,
                        )
                      }
                      className={`min-w-16 cursor-pointer rounded-md px-2 py-1 text-[11px] font-black uppercase tracking-wide transition ${
                        accessEditor.role === 'user'
                          ? 'bg-brand-lime text-brand-dark'
                          : 'text-app-text-secondary hover:bg-app-surface dark:hover:bg-app-card'
                      }`}
                    >
                      {t('admin.roleUser')}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAccessEditor((current) =>
                          current ? { ...current, role: 'admin' } : current,
                        )
                      }
                      className={`min-w-16 cursor-pointer rounded-md px-2 py-1 text-[11px] font-black uppercase tracking-wide transition ${
                        accessEditor.role === 'admin'
                          ? 'bg-brand-lime text-brand-dark'
                          : 'text-app-text-secondary hover:bg-app-surface dark:hover:bg-app-card'
                      }`}
                    >
                      {t('admin.roleAdmin')}
                    </button>
                  </div>
                </div>

                <div className="grid gap-2">
                  {scopes.map((scope) => (
                    <div
                      key={scope}
                      className="flex items-center justify-between gap-3 rounded-lg border border-app-border bg-app-bg px-2 py-2"
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-app-text-secondary">
                        {scope}
                      </span>
                      <PermissionLevelSlider
                        value={accessEditor.scopeLevels[scope]}
                        disabled={accessEditor.role !== 'admin'}
                        labels={{
                          none: t('admin.permissionNone'),
                          read: t('admin.permissionRead'),
                          write: t('admin.permissionWrite'),
                        }}
                        onChange={(next) =>
                          setAccessEditor((current) =>
                            current
                              ? {
                                  ...current,
                                  scopeLevels: {
                                    ...current.scopeLevels,
                                    [scope]: next,
                                  },
                                }
                              : current,
                          )
                        }
                      />
                    </div>
                  ))}
                </div>

                <CTAButton
                  type="button"
                  variant="primary"
                  onClick={() => void saveAccess()}
                  disabled={isSavingAccess}
                  className="self-end"
                >
                  {isSavingAccess ? t('admin.savingAccess') : t('admin.saveAccess')}
                </CTAButton>
              </AccordionSection>
            ) : null}

            <AccordionSection title={t('admin.analyticsUserPageViewsTitle')}>
              {selectedUserPageViews.length === 0 ? (
                <p className="text-xs font-semibold text-app-text-secondary">
                  {t('admin.analyticsUserNoPageViews')}
                </p>
              ) : (
                <div className="grid gap-2">
                  {selectedUserPageViews.map((row) => (
                    <div
                      key={row.path}
                      className="flex items-center justify-between gap-2 rounded-lg border border-app-border bg-app-bg px-2.5 py-2 text-xs"
                    >
                      <span className="truncate text-app-text-secondary">{row.path}</span>
                      <span className="font-black text-app-text">{row.views}</span>
                    </div>
                  ))}
                </div>
              )}
            </AccordionSection>

            <AccordionSection title={t('admin.analyticsUserEventsTitle')}>
              {selectedUserDetail.events.length === 0 ? (
                <p className="text-xs font-semibold text-app-text-secondary">
                  {t('admin.analyticsUserNoEvents')}
                </p>
              ) : (
                <div className="grid gap-2">
                  {selectedUserDetail.events.map((event) => (
                    <div
                      key={event.eventId}
                      className="grid gap-1 rounded-lg border border-app-border bg-app-bg px-2.5 py-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-black text-app-text">{event.name}</p>
                        <span className="rounded-full border border-app-border px-2 py-0.5 font-black uppercase tracking-wide text-app-text-secondary">
                          {event.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-app-text-secondary">
                        <span>{providerLabel(event.provider)}</span>
                        <span>
                          {t('admin.analyticsColTracks')}: {event.tracksCount}
                        </span>
                        <span>
                          {t('admin.analyticsColShared')}:{' '}
                          {event.shared
                            ? t('admin.analyticsSharedYes')
                            : t('admin.analyticsSharedNo')}
                        </span>
                        <span>{normalizeDate(event.updatedAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AccordionSection>
          </div>
        ) : (
          <p className="text-sm text-app-text-secondary">{t('admin.analyticsNoSelection')}</p>
        )}
      </SlideOverPanel>
    </section>
  );
};
