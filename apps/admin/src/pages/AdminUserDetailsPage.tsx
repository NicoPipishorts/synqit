import {
  adminAnalyticsUserDetailResponseSchema,
  adminPermissionScopeSchema,
  type AdminAnalyticsUserDetailResponse,
  type AdminPermissionLevel,
  type AdminPermissionScope,
} from '@synqit/shared';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AdminDetailCard } from '../components/admin/AdminDetailCard';
import { PermissionLevelSlider } from '../components/admin/PermissionLevelSlider';
import { CTAButton } from '../components/ui/cta';
import { Modal } from '../components/ui/Modal';
import { useI18n } from '../hooks/useI18n';
import { useToast } from '../hooks/useToast';
import { callApi, toApiError } from '../lib/api';
import { clearAuth, loadAuth } from '../lib/auth';

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

const APP_ROUTE_PREFIXES = [
  '/',
  '/auth',
  '/dashboard',
  '/profile',
  '/providers',
  '/playlists',
  '/playlist',
  '/synced-lists',
  '/events',
  '/event',
] as const;

const getUserTitle = (user: AnalyticsUserDetail): string => {
  const displayName = user.personalInfo.displayName?.trim();
  if (displayName) {
    return displayName;
  }

  const fullName = [user.personalInfo.firstName?.trim(), user.personalInfo.lastName?.trim()]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (fullName) {
    return fullName;
  }

  const username = user.email.split('@')[0]?.trim();
  if (username) {
    return username;
  }

  return user.email;
};

const areAccessEditorsEqual = (
  a: AccessEditorState | null,
  b: AccessEditorState | null,
): boolean => {
  if (!a || !b) {
    return a === b;
  }

  if (a.role !== b.role) {
    return false;
  }

  return adminPermissionScopeSchema.options.every(
    (scope) => a.scopeLevels[scope] === b.scopeLevels[scope],
  );
};

export const AdminUserDetailsPage = () => {
  const { t, locale } = useI18n();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { userId } = useParams({ from: '/users/$userId' });

  const [userDetail, setUserDetail] = useState<AnalyticsUserDetail | null>(null);
  const [accessEditor, setAccessEditor] = useState<AccessEditorState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAccess, setIsSavingAccess] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [isUpdatingBlockedState, setIsUpdatingBlockedState] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const scopes = useMemo(() => adminPermissionScopeSchema.options, []);
  const currentAdminUserId = useMemo(() => loadAuth()?.userId ?? null, []);
  const persistedAccessRef = useRef<AccessEditorState | null>(null);
  const queuedAccessRef = useRef<AccessEditorState | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const isSavingAccessRef = useRef(false);

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

  const loadUserDetail = useCallback(async () => {
    setIsLoading(true);
    setStatus(null);

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

      setUserDetail(result.user);
      const nextAccessEditor = {
        role: result.user.role,
        scopeLevels: nextScopeLevels,
      };
      setAccessEditor(nextAccessEditor);
      persistedAccessRef.current = nextAccessEditor;
    } catch (error) {
      const message = handleAccessError(error);
      if (message) {
        setStatus(message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [handleAccessError, userId]);

  const flushPendingAccessSave = useCallback(
    async (nextAccessEditor: AccessEditorState) => {
      if (!userDetail || isSavingAccessRef.current) {
        return;
      }

      if (areAccessEditorsEqual(nextAccessEditor, persistedAccessRef.current)) {
        queuedAccessRef.current = null;
        return;
      }

      isSavingAccessRef.current = true;
      setIsSavingAccess(true);
      setStatus(null);
      try {
        const adminPermissions =
          nextAccessEditor.role === 'admin'
            ? scopes
                .map((scope) => {
                  const level = nextAccessEditor.scopeLevels[scope];
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
          `/v1/admin/users/${userDetail.userId}/access`,
          {
            method: 'PUT',
            body: JSON.stringify({
              role: nextAccessEditor.role,
              adminPermissions,
            }),
          },
          (payload) => payload,
        );

        persistedAccessRef.current = nextAccessEditor;
        setUserDetail((current) =>
          current
            ? {
                ...current,
                role: nextAccessEditor.role,
                adminPermissions,
              }
            : current,
        );
        setStatus(t('admin.accessUpdated'));
        showToast(t('admin.accessUpdated'), { variant: 'success' });
      } catch (error) {
        const message = handleAccessError(error);
        if (message) {
          setStatus(message);
          showToast(message, { variant: 'error' });
        }
        setAccessEditor(persistedAccessRef.current);
      } finally {
        isSavingAccessRef.current = false;
        setIsSavingAccess(false);
        const queuedAccess = queuedAccessRef.current;
        if (queuedAccess && !areAccessEditorsEqual(queuedAccess, persistedAccessRef.current)) {
          queuedAccessRef.current = null;
          void flushPendingAccessSave(queuedAccess);
        }
      }
    },
    [handleAccessError, scopes, showToast, t, userDetail],
  );

  const scheduleAccessSave = useCallback(
    (nextAccessEditor: AccessEditorState) => {
      queuedAccessRef.current = nextAccessEditor;

      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = window.setTimeout(() => {
        saveTimeoutRef.current = null;
        const queuedAccess = queuedAccessRef.current;
        if (!queuedAccess) {
          return;
        }
        queuedAccessRef.current = null;
        void flushPendingAccessSave(queuedAccess);
      }, 220);
    },
    [flushPendingAccessSave],
  );

  const updateAccessEditor = useCallback(
    (updater: (current: AccessEditorState) => AccessEditorState) => {
      setAccessEditor((current) => {
        if (!current) {
          return current;
        }

        const next = updater(current);
        scheduleAccessSave(next);
        return next;
      });
    },
    [scheduleAccessSave],
  );

  const appPageViews = useMemo(() => {
    if (!userDetail) {
      return [];
    }

    return userDetail.pageViewsByPath.filter((row) =>
      APP_ROUTE_PREFIXES.some((prefix) =>
        prefix === '/'
          ? row.path === '/'
          : row.path === prefix || row.path.startsWith(`${prefix}/`),
      ),
    );
  }, [userDetail]);

  const canToggleBlockedState = Boolean(
    userDetail && currentAdminUserId && userDetail.userId !== currentAdminUserId,
  );
  const blockActionLabel = userDetail?.isBlocked ? 'Reactivate account' : 'Block account';
  const blockModalTitle = userDetail?.isBlocked ? 'Reactivate account?' : 'Block account?';
  const blockModalMessage = userDetail?.isBlocked
    ? 'This will restore access to login, refresh sessions, and use the customer app again.'
    : 'This will immediately prevent the account from refreshing sessions and accessing the customer app.';

  const toggleBlockedState = useCallback(async () => {
    if (!userDetail || !canToggleBlockedState) {
      return;
    }

    const nextBlocked = !userDetail.isBlocked;
    setIsUpdatingBlockedState(true);
    setStatus(null);

    try {
      await callApi(
        `/v1/admin/users/${userDetail.userId}/block`,
        {
          method: 'PUT',
          body: JSON.stringify({
            blocked: nextBlocked,
          }),
        },
        (payload) => payload,
      );

      setUserDetail((current) =>
        current
          ? {
              ...current,
              isBlocked: nextBlocked,
              blockedAt: nextBlocked ? new Date().toISOString() : null,
            }
          : current,
      );
      const message = nextBlocked ? 'Account blocked.' : 'Account reactivated.';
      setStatus(message);
      showToast(message, { variant: 'success' });
      setIsBlockModalOpen(false);
    } catch (error) {
      const message = handleAccessError(error);
      if (message) {
        setStatus(message);
        showToast(message, { variant: 'error' });
      }
    } finally {
      setIsUpdatingBlockedState(false);
    }
  }, [canToggleBlockedState, handleAccessError, showToast, userDetail]);

  useEffect(() => {
    void loadUserDetail();
  }, [loadUserDetail]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <section className="grid content-start gap-6">
        <p className="text-sm text-app-text-secondary">{t('admin.analyticsDetailLoading')}</p>
      </section>
    );
  }

  if (!userDetail) {
    return (
      <section className="grid content-start gap-6">
        <div className="flex items-center gap-3">
          <CTAButton
            type="button"
            variant="secondary"
            onClick={() => void navigate({ to: '/users' })}
          >
            <ArrowLeft size={14} aria-hidden="true" />
            {t('admin.analyticsDetailClose')}
          </CTAButton>
        </div>
        <p className="text-sm text-app-text-secondary">{status ?? t('admin.noUserSelected')}</p>
      </section>
    );
  }

  return (
    <section className="grid content-start gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CTAButton
            type="button"
            variant="secondary"
            onClick={() => void navigate({ to: '/users' })}
          >
            <ArrowLeft size={14} aria-hidden="true" />
            {t('admin.analyticsDetailClose')}
          </CTAButton>
          <h1 className="text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white">
            {getUserTitle(userDetail)}
          </h1>
        </div>
        {canToggleBlockedState ? (
          <CTAButton
            type="button"
            variant={userDetail.isBlocked ? 'secondary' : 'danger'}
            onClick={() => setIsBlockModalOpen(true)}
          >
            {blockActionLabel}
          </CTAButton>
        ) : null}
      </div>

      <article className="grid gap-6 rounded-3xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card">
        <div className="grid gap-4">
          <AdminDetailCard title="User / roles">
            <div className="grid grid-cols-2 gap-6 text-sm text-app-text-secondary">
              <div className="grid content-start gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span>{t('auth.email')}</span>
                  <span className="font-black text-app-text">{userDetail.email}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Display name</span>
                  <span className="font-black text-app-text">
                    {userDetail.personalInfo.displayName?.trim() || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>First name</span>
                  <span className="font-black text-app-text">
                    {userDetail.personalInfo.firstName?.trim() || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Last name</span>
                  <span className="font-black text-app-text">
                    {userDetail.personalInfo.lastName?.trim() || '—'}
                  </span>
                </div>
              </div>

              <div className="grid content-start gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span>{t('admin.analyticsColCreated')}</span>
                  <span className="font-black text-app-text">
                    {normalizeDate(userDetail.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>{t('admin.roleLabel')}</span>
                  <span className="font-black capitalize text-app-text">{userDetail.role}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Account status</span>
                  <span className="font-black text-app-text">
                    {userDetail.isBlocked ? 'Blocked' : 'Active'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>{t('admin.analyticsMetricEventPlaylists')}</span>
                  <span className="font-black text-app-text">{userDetail.eventPlaylistsCount}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>{t('admin.analyticsMetricSharedPlaylists')}</span>
                  <span className="font-black text-app-text">
                    {userDetail.sharedPlaylistsCount}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Blocked at</span>
                  <span className="font-black text-app-text">
                    {normalizeDate(userDetail.blockedAt)}
                  </span>
                </div>
              </div>
            </div>
          </AdminDetailCard>

          <AdminDetailCard title={t('admin.accessEditorTitle')}>
            {accessEditor ? (
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2 flex items-center justify-between gap-4 rounded-lg border border-app-border bg-app-bg px-4 py-3 text-xs font-semibold uppercase tracking-wide text-app-text-secondary">
                  <div className="flex items-center gap-3">
                    <span>{t('admin.roleLabel')}</span>
                    {isSavingAccess ? (
                      <span className="text-[11px] font-black text-app-text-secondary">
                        {t('admin.savingAccess')}
                      </span>
                    ) : null}
                  </div>
                  <div className="inline-grid grid-cols-2 rounded-lg border border-app-border bg-app-bg p-1">
                    <button
                      type="button"
                      onClick={() =>
                        updateAccessEditor((current) => ({ ...current, role: 'user' }))
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
                        updateAccessEditor((current) => ({ ...current, role: 'admin' }))
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

                <div className="col-span-2 grid grid-cols-2 gap-2">
                  {scopes.map((scope) => (
                    <div
                      key={scope}
                      className="flex items-center justify-between gap-3 rounded-lg border border-app-border bg-app-bg px-3 py-3"
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
                          updateAccessEditor((current) => ({
                            ...current,
                            scopeLevels: {
                              ...current.scopeLevels,
                              [scope]: next,
                            },
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-app-text-secondary">{t('admin.noUserSelected')}</p>
            )}
          </AdminDetailCard>

          <AdminDetailCard title="Playlists">
            {userDetail.events.length === 0 ? (
              <p className="text-sm text-app-text-secondary">{t('admin.analyticsUserNoEvents')}</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {userDetail.events.map((event) => (
                  <div
                    key={event.eventId}
                    className={`grid content-start gap-1 rounded-lg border px-3 py-3 text-sm ${
                      event.provider === 'spotify'
                        ? 'border-brand-lime/45 bg-brand-lime/12'
                        : 'border-brand-pink/40 bg-brand-pink/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-black text-app-text">{event.name}</p>
                      <span className="rounded-full border border-app-border px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-app-text-secondary">
                        {event.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-app-text-secondary">
                      <span>{providerLabel(event.provider)}</span>
                      <span className="text-right">
                        {t('admin.analyticsColTracks')}: {event.tracksCount}
                      </span>
                      <span>
                        {t('admin.analyticsColShared')}:{' '}
                        {event.shared
                          ? t('admin.analyticsSharedYes')
                          : t('admin.analyticsSharedNo')}
                      </span>
                      <span className="text-right">{normalizeDate(event.updatedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AdminDetailCard>

          <AdminDetailCard title="Visited pages">
            {appPageViews.length === 0 ? (
              <p className="text-sm text-app-text-secondary">
                {t('admin.analyticsUserNoPageViews')}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {appPageViews.map((row) => (
                  <div
                    key={row.path}
                    className="flex items-center justify-between gap-3 rounded-lg border border-app-border bg-app-bg px-3 py-3 text-sm"
                  >
                    <span className="truncate text-app-text-secondary">{row.path}</span>
                    <span className="shrink-0 font-black text-app-text">{row.views}</span>
                  </div>
                ))}
              </div>
            )}
          </AdminDetailCard>
        </div>

        {status ? (
          <p className="rounded-lg border border-app-border bg-app-surface px-3 py-2 text-xs font-semibold text-app-text-secondary">
            {status}
          </p>
        ) : null}
      </article>

      <Modal
        open={isBlockModalOpen}
        title={blockModalTitle}
        onClose={() => {
          if (!isUpdatingBlockedState) {
            setIsBlockModalOpen(false);
          }
        }}
      >
        <div className="grid gap-5">
          <p className="text-sm text-app-text-secondary">{blockModalMessage}</p>
          <div className="flex justify-end gap-3">
            <CTAButton
              type="button"
              variant="secondary"
              onClick={() => setIsBlockModalOpen(false)}
              disabled={isUpdatingBlockedState}
            >
              Cancel
            </CTAButton>
            <CTAButton
              type="button"
              variant={userDetail.isBlocked ? 'primary' : 'danger'}
              onClick={() => void toggleBlockedState()}
              disabled={isUpdatingBlockedState}
            >
              {isUpdatingBlockedState ? 'Working...' : blockActionLabel}
            </CTAButton>
          </div>
        </div>
      </Modal>
    </section>
  );
};
