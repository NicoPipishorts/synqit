import {
  adminAnalyticsOverviewResponseSchema,
  adminAnalyticsUserDetailResponseSchema,
  adminAnalyticsUsersListResponseSchema,
  adminPermissionScopeSchema,
  type AdminAnalyticsOverviewRange,
  type AdminAnalyticsOverviewResponse,
  type AdminAnalyticsUserDetailResponse,
  type AdminAnalyticsUserSummary,
  type AdminPermissionLevel,
  type AdminPermissionScope,
} from '@synqit/shared';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import { PermissionLevelSlider } from '../components/admin/PermissionLevelSlider';
import { AccordionSection } from '../components/ui/AccordionSection';
import { CTAButton } from '../components/ui/cta';
import { SlideOverPanel } from '../components/ui/SlideOverPanel';
import { useI18n } from '../hooks/useI18n';
import { isDisplayableAnalyticsPath } from '../lib/analytics-display';
import { callApi, toApiError } from '../lib/api';
import { clearAuth, hasAdminPermission } from '../lib/auth';

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
  const [users, setUsers] = useState<AnalyticsUserSummary[]>([]);
  const [overview, setOverview] = useState<AdminAnalyticsOverviewResponse | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [overviewRange, setOverviewRange] = useState<AdminAnalyticsOverviewRange>('24h');
  const [isRangeMenuOpen, setIsRangeMenuOpen] = useState(false);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState<AnalyticsUserDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSavingAccess, setIsSavingAccess] = useState(false);
  const [accessEditor, setAccessEditor] = useState<AccessEditorState | null>(null);
  const rangeMenuRef = useRef<HTMLDivElement | null>(null);

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

  const loadUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const result = await callApi(
        '/v1/admin/analytics/users',
        {
          method: 'GET',
        },
        (payload) => adminAnalyticsUsersListResponseSchema.parse(payload),
      );
      setUsers(result.users);
    } catch (error) {
      const message = handleAccessError(error);
      if (message) {
        setStatus(message);
      }
    } finally {
      setIsLoadingUsers(false);
    }
  }, [handleAccessError]);

  const loadOverview = useCallback(async () => {
    setIsLoadingOverview(true);
    try {
      const search = new URLSearchParams({
        range: overviewRange,
      });
      const result = await callApi(
        `/v1/admin/analytics/overview?${search.toString()}`,
        {
          method: 'GET',
        },
        (payload) => adminAnalyticsOverviewResponseSchema.parse(payload),
      );
      setOverview(result);
    } catch (error) {
      const message = handleAccessError(error);
      if (message) {
        setStatus(message);
      }
    } finally {
      setIsLoadingOverview(false);
    }
  }, [handleAccessError, overviewRange]);

  const openUserDetails = useCallback(
    async (userId: string) => {
      setSelectedUserId(userId);
      setSelectedUserDetail(null);
      setAccessEditor(null);
      setIsLoadingDetail(true);
      setStatus(null);

      try {
        const result = await callApi(
          `/v1/admin/analytics/users/${userId}`,
          {
            method: 'GET',
          },
          (payload) => adminAnalyticsUserDetailResponseSchema.parse(payload),
        );

        setSelectedUserDetail(result.user);
        setAccessEditor(toAccessEditorState(result.user.role, result.user.adminPermissions));
      } catch (error) {
        const message = handleAccessError(error);
        if (message) {
          setStatus(message);
        }
      } finally {
        setIsLoadingDetail(false);
      }
    },
    [handleAccessError],
  );

  const refreshData = useCallback(async () => {
    setStatus(null);
    await Promise.all([loadOverview(), loadUsers()]);
  }, [loadOverview, loadUsers]);

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

      await Promise.all([refreshData(), openUserDetails(selectedUserDetail.userId)]);
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

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (!isRangeMenuOpen) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (rangeMenuRef.current?.contains(target)) {
        return;
      }
      setIsRangeMenuOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isRangeMenuOpen]);

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
    overviewRangeOptions.find((option) => option.value === overviewRange)?.label ??
    overviewRangeOptions[0]?.label ??
    '';

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

  return (
    <section className="grid content-start gap-6">
      <AdminSectionHeader
        title={t('admin.analyticsOverviewTitle')}
        description={t('admin.portalSubtitle')}
      />

      <article className="grid gap-4 rounded-3xl border border-app-border bg-app-elevated p-4 shadow-soft-lift sm:p-5 dark:bg-app-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-black text-app-text">{t('admin.analyticsOverviewTitle')}</h2>
          <div
            ref={rangeMenuRef}
            className="relative flex flex-col gap-2 sm:flex-row sm:items-center"
          >
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
              onClick={() => setIsRangeMenuOpen((current) => !current)}
              aria-expanded={isRangeMenuOpen}
              aria-haspopup="menu"
              className="w-full justify-center sm:w-auto"
            >
              {t('admin.analyticsFilterButton')}: {selectedOverviewRangeLabel}
            </CTAButton>
            {isRangeMenuOpen ? (
              <div className="absolute inset-x-0 top-full z-20 mt-2 grid gap-1 rounded-xl border border-app-border bg-app-elevated p-1.5 shadow-soft-lift sm:left-auto sm:right-0 sm:min-w-52 dark:bg-app-card">
                {overviewRangeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOverviewRange(option.value);
                      setIsRangeMenuOpen(false);
                    }}
                    className={`cursor-pointer rounded-lg px-3 py-2 text-left text-xs font-black transition ${
                      overviewRange === option.value
                        ? 'bg-brand-lime text-brand-dark'
                        : 'text-app-text-secondary hover:bg-app-surface hover:text-app-text dark:hover:bg-app-bg'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
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

      <SlideOverPanel
        open={Boolean(selectedUserId)}
        onClose={() => {
          setSelectedUserId(null);
          setSelectedUserDetail(null);
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
