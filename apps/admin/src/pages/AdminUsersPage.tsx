import {
  adminAnalyticsUsersListResponseSchema,
  type AdminAnalyticsUserSummary,
} from '@synqit/shared';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import { CTAButton } from '../components/ui/cta';
import { useI18n } from '../hooks/useI18n';
import { callApi, toApiError } from '../lib/api';
import { clearAuth } from '../lib/auth';

type AnalyticsUserSummary = AdminAnalyticsUserSummary;

export const AdminUsersPage = () => {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AnalyticsUserSummary[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [usersStatus, setUsersStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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
    <section className="grid content-start gap-6">
      <AdminSectionHeader title={t('admin.usersTitle')} description={t('admin.portalSubtitle')} />

      <article className="grid gap-4 rounded-3xl border border-app-border bg-app-elevated p-4 shadow-soft-lift sm:p-5 dark:bg-app-card">
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
          <>
            <div className="grid gap-3 md:hidden">
              {filteredUsers.map((user) => (
                <button
                  key={user.userId}
                  type="button"
                  className="grid gap-3 rounded-2xl border border-app-border bg-app-surface p-4 text-left dark:bg-app-card"
                  onClick={() =>
                    void navigate({ to: '/users/$userId', params: { userId: user.userId } })
                  }
                >
                  <div className="grid gap-1">
                    <p className="truncate text-sm font-black text-app-text">{user.email}</p>
                    <p className="text-xs font-semibold uppercase tracking-wide text-app-text-secondary">
                      {user.role}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs font-semibold text-app-text-secondary">
                    <div className="grid gap-1">
                      <span>{t('admin.analyticsColCreated')}</span>
                      <span className="text-app-text">{normalizeDate(user.createdAt)}</span>
                    </div>
                    <div className="grid gap-1">
                      <span>{t('admin.analyticsMetricEventsShort')}</span>
                      <span className="text-app-text">{user.eventPlaylistsCount}</span>
                    </div>
                    <div className="grid gap-1">
                      <span>{t('admin.analyticsMetricSharedShort')}</span>
                      <span className="text-app-text">{user.sharedPlaylistsCount}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="hidden overflow-x-auto rounded-2xl border border-app-border md:block">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead className="bg-app-surface dark:bg-app-card">
                  <tr className="border-b border-app-border text-[11px] uppercase tracking-wide text-app-text-secondary">
                    <th className="px-3 py-2 font-black">{t('auth.email')}</th>
                    <th className="px-3 py-2 font-black">{t('admin.roleLabel')}</th>
                    <th className="px-3 py-2 font-black">{t('admin.analyticsColCreated')}</th>
                    <th className="px-3 py-2 font-black">
                      {t('admin.analyticsMetricEventsShort')}
                    </th>
                    <th className="px-3 py-2 font-black">
                      {t('admin.analyticsMetricSharedShort')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.userId}
                      className="cursor-pointer border-b border-app-border last:border-b-0 hover:bg-app-surface/70 dark:hover:bg-app-card"
                      onClick={() =>
                        void navigate({ to: '/users/$userId', params: { userId: user.userId } })
                      }
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
          </>
        )}

        {usersStatus ? (
          <p className="rounded-lg border border-app-border bg-app-surface px-3 py-2 text-xs font-semibold text-app-text-secondary">
            {usersStatus}
          </p>
        ) : null}
      </article>
    </section>
  );
};
