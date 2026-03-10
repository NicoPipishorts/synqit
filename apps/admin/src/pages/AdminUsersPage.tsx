import {
  adminAnalyticsUserDetailResponseSchema,
  adminAnalyticsUsersListResponseSchema,
  adminPermissionScopeSchema,
  type AdminAnalyticsUserDetailResponse,
  type AdminAnalyticsUserSummary,
  type AdminPermissionLevel,
  type AdminPermissionScope,
} from '@synqit/shared';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import { PermissionLevelSlider } from '../components/admin/PermissionLevelSlider';
import { AccordionSection } from '../components/ui/AccordionSection';
import { CTAButton } from '../components/ui/cta';
import { SlideOverPanel } from '../components/ui/SlideOverPanel';
import { useI18n } from '../hooks/useI18n';
import { callApi, toApiError } from '../lib/api';
import { clearAuth } from '../lib/auth';

type AnalyticsUserSummary = AdminAnalyticsUserSummary;
type AnalyticsUserDetail = AdminAnalyticsUserDetailResponse['user'];
type AccessLevelUi = AdminPermissionLevel | 'none';

type AccessEditorState = {
  role: 'user' | 'admin';
  scopeLevels: Record<AdminPermissionScope, AccessLevelUi>;
};

const defaultScopeLevels = (): Record<AdminPermissionScope, AccessLevelUi> => ({
  dashboard: 'none',
  users: 'none',
  events: 'none',
  integrations: 'none',
  emails: 'none',
  analytics: 'none',
});

const providerLabel = (provider: 'spotify' | 'apple'): string =>
  provider === 'spotify' ? 'Spotify' : 'Apple Music';

export const AdminUsersPage = () => {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AnalyticsUserSummary[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [usersStatus, setUsersStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState<AnalyticsUserDetail | null>(null);
  const [accessEditor, setAccessEditor] = useState<AccessEditorState | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const scopes = useMemo(() => adminPermissionScopeSchema.options, []);

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
    setUsersStatus(null);
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
        setUsersStatus(message);
      }
    } finally {
      setIsLoadingUsers(false);
    }
  }, [handleAccessError]);

  const openUserDetails = useCallback(
    async (userId: string) => {
      setSelectedUserId(userId);
      setSelectedUserDetail(null);
      setAccessEditor(null);
      setIsLoadingDetail(true);
      setUsersStatus(null);

      try {
        const result = await callApi(
          `/v1/admin/analytics/users/${userId}`,
          {
            method: 'GET',
          },
          (payload) => adminAnalyticsUserDetailResponseSchema.parse(payload),
        );

        const nextScopeLevels = defaultScopeLevels();
        for (const permission of result.user.adminPermissions) {
          nextScopeLevels[permission.scope] = permission.level;
        }

        setSelectedUserDetail(result.user);
        setAccessEditor({
          role: result.user.role,
          scopeLevels: nextScopeLevels,
        });
      } catch (error) {
        const message = handleAccessError(error);
        if (message) {
          setUsersStatus(message);
        }
      } finally {
        setIsLoadingDetail(false);
      }
    },
    [handleAccessError],
  );

  const saveAccess = useCallback(async () => {
    if (!selectedUserDetail || !accessEditor) {
      return;
    }

    setIsSaving(true);
    setUsersStatus(null);
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

      await Promise.all([loadUsers(), openUserDetails(selectedUserDetail.userId)]);
      setUsersStatus(t('admin.accessUpdated'));
    } catch (error) {
      const message = handleAccessError(error);
      if (message) {
        setUsersStatus(message);
      }
    } finally {
      setIsSaving(false);
    }
  }, [accessEditor, handleAccessError, loadUsers, openUserDetails, scopes, selectedUserDetail, t]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return users;
    }
    return users.filter((user) => user.email.toLowerCase().includes(query));
  }, [searchQuery, users]);

  return (
    <section className="grid gap-5">
      <AdminSectionHeader
        eyebrow={t('admin.portalTitle')}
        title={t('admin.usersTitle')}
        description={t('admin.portalSubtitle')}
      />

      <article className="grid gap-4 rounded-3xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
          <h2 className="text-lg font-black text-app-text">{t('admin.usersTitle')}</h2>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t('admin.analyticsSearchPlaceholder')}
            className="w-full rounded-xl border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text outline-none transition focus:border-brand-lime sm:w-72"
          />
          <CTAButton type="button" variant="secondary" onClick={() => void loadUsers()}>
            {t('admin.analyticsRefresh')}
          </CTAButton>
        </div>

        {isLoadingUsers ? (
          <p className="text-sm text-app-text-secondary">{t('admin.loadingUsers')}</p>
        ) : filteredUsers.length === 0 ? (
          <p className="text-sm text-app-text-secondary">{t('admin.analyticsEmpty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-app-border">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead className="bg-app-surface dark:bg-app-card">
                <tr className="border-b border-app-border text-[11px] uppercase tracking-wide text-app-text-secondary">
                  <th className="px-3 py-2 font-black">{t('auth.email')}</th>
                  <th className="px-3 py-2 font-black">{t('admin.roleLabel')}</th>
                  <th className="px-3 py-2 font-black">{t('admin.analyticsColCreated')}</th>
                  <th className="px-3 py-2 font-black">
                    {t('admin.analyticsMetricEventPlaylists')}
                  </th>
                  <th className="px-3 py-2 font-black">
                    {t('admin.analyticsMetricSharedPlaylists')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user.userId}
                    className="cursor-pointer border-b border-app-border last:border-b-0 hover:bg-app-surface/70 dark:hover:bg-app-card"
                    onClick={() => void openUserDetails(user.userId)}
                  >
                    <td className="max-w-[18rem] truncate px-3 py-2 text-sm font-black text-app-text">
                      {user.email}
                    </td>
                    <td className="px-3 py-2 text-xs font-semibold text-app-text-secondary">
                      {user.role}
                    </td>
                    <td className="px-3 py-2 text-xs font-semibold text-app-text-secondary">
                      {normalizeDate(user.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-xs font-semibold text-app-text-secondary">
                      {user.eventPlaylistsCount}
                    </td>
                    <td className="px-3 py-2 text-xs font-semibold text-app-text-secondary">
                      {user.sharedPlaylistsCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {usersStatus ? (
          <p className="rounded-lg border border-app-border bg-app-surface px-3 py-2 text-xs font-semibold text-app-text-secondary">
            {usersStatus}
          </p>
        ) : null}
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
                <span>{t('admin.analyticsMetricEventPlaylists')}</span>
                <span className="font-black text-app-text">
                  {selectedUserDetail.eventPlaylistsCount}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>{t('admin.analyticsMetricSharedPlaylists')}</span>
                <span className="font-black text-app-text">
                  {selectedUserDetail.sharedPlaylistsCount}
                </span>
              </div>
            </div>

            {accessEditor ? (
              <AccordionSection title={t('admin.accessEditorTitle')}>
                <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-app-text-secondary">
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
                  disabled={isSaving}
                  className="self-end"
                >
                  {isSaving ? t('admin.savingAccess') : t('admin.saveAccess')}
                </CTAButton>
              </AccordionSection>
            ) : null}

            <AccordionSection title={t('admin.analyticsUserPageViewsTitle')}>
              {selectedUserDetail.pageViewsByPath.length === 0 ? (
                <p className="text-xs font-semibold text-app-text-secondary">
                  {t('admin.analyticsUserNoPageViews')}
                </p>
              ) : (
                <div className="grid gap-2">
                  {selectedUserDetail.pageViewsByPath.map((row) => (
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
          <p className="text-sm text-app-text-secondary">{t('admin.noUserSelected')}</p>
        )}
      </SlideOverPanel>
    </section>
  );
};
