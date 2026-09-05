import {
  adminAnalyticsUserDetailResponseSchema,
  adminPermissionScopeSchema,
  type AdminAnalyticsUserDetailResponse,
  type AdminPermissionLevel,
  type AdminPermissionScope,
} from '@synqit/shared';
import { useNavigate, useParams, useRouterState } from '@tanstack/react-router';
import { AlertTriangle, KeyRound, RotateCcw, Shield, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AdminDetailCard } from '../components/admin/AdminDetailCard';
import { PermissionLevelSlider } from '../components/admin/PermissionLevelSlider';
import { CTAButton } from '../components/ui/cta';
import { Modal } from '../components/ui/Modal';
import { useI18n } from '../hooks/useI18n';
import { useToast } from '../hooks/useToast';
import { isDisplayableAnalyticsPath } from '../lib/analytics-display';
import { callApi, toApiError } from '../lib/api';
import { clearAuth, hasAdminPermission, loadAuth } from '../lib/auth';

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

const UserOverviewSection = ({
  userDetail,
  normalizeDate,
  pageViewsCount,
  t,
}: {
  userDetail: AnalyticsUserDetail;
  normalizeDate: (value: string | null) => string;
  pageViewsCount: number;
  t: (key: string) => string;
}) => (
  <div className="grid gap-4">
    <AdminDetailCard title="Profile">
      <div className="grid gap-6 text-sm text-app-text-secondary md:grid-cols-2">
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
            <span className="font-black text-app-text">{normalizeDate(userDetail.createdAt)}</span>
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
            <span>Blocked at</span>
            <span className="font-black text-app-text">{normalizeDate(userDetail.blockedAt)}</span>
          </div>
        </div>
      </div>
    </AdminDetailCard>

    <AdminDetailCard title="Quick view">
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-app-border bg-app-bg px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-app-text-secondary">
              {t('admin.analyticsMetricEventsShort')}
            </p>
            <p className="mt-2 text-2xl font-black text-app-text">
              {userDetail.eventPlaylistsCount}
            </p>
          </div>
          <div className="rounded-2xl border border-app-border bg-app-bg px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-app-text-secondary">
              {t('admin.analyticsMetricSharedShort')}
            </p>
            <p className="mt-2 text-2xl font-black text-app-text">
              {userDetail.sharedPlaylistsCount}
            </p>
          </div>
          <div className="rounded-2xl border border-app-border bg-app-bg px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-app-text-secondary">
              Page views
            </p>
            <p className="mt-2 text-2xl font-black text-app-text">{pageViewsCount}</p>
          </div>
        </div>

        <p className="text-sm text-app-text-secondary">
          Use the section nav to drill into security actions, admin access, playlists, and app
          activity.
        </p>
      </div>
    </AdminDetailCard>
  </div>
);

const UserSecuritySection = ({
  userDetail,
  canToggleTestAccount,
  canRequestDeletion,
  canResetUserFlow,
  canToggleBlockedState,
  blockActionLabel,
  isSendingPasswordReset,
  isUpdatingTestAccount,
  isResettingUserFlow,
  onOpenBlock,
  onSendPasswordReset,
  onOpenDelete,
  onOpenReset,
  onToggleTestAccount,
}: {
  userDetail: AnalyticsUserDetail;
  canToggleTestAccount: boolean;
  canRequestDeletion: boolean;
  canResetUserFlow: boolean;
  canToggleBlockedState: boolean;
  blockActionLabel: string;
  isSendingPasswordReset: boolean;
  isUpdatingTestAccount: boolean;
  isResettingUserFlow: boolean;
  onOpenBlock: () => void;
  onSendPasswordReset: () => void;
  onOpenDelete: () => void;
  onOpenReset: () => void;
  onToggleTestAccount: () => void;
}) => (
  <AdminDetailCard title="Security actions">
    <div className="grid gap-4">
      <div className="rounded-2xl border border-brand-pink/40 bg-brand-pink/10 px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl border border-brand-pink/45 bg-brand-pink/15 p-2 text-brand-pink">
            <Shield size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-app-text">High-impact account controls</p>
            <p className="mt-1 text-sm text-app-text-secondary">
              Blocking removes access immediately. Reset registration flow is for eligible test
              accounts only.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-app-border bg-app-bg px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-app-text-secondary">
            Password
          </p>
          <p className="mt-2 text-sm text-app-text-secondary">
            Sends a reset email without changing account data or access rights.
          </p>
          <div className="mt-3 flex">
            <CTAButton
              type="button"
              variant="secondary"
              onClick={onSendPasswordReset}
              disabled={isSendingPasswordReset}
            >
              <KeyRound size={14} aria-hidden="true" />
              {isSendingPasswordReset ? 'Sending reset email...' : 'Reset password'}
            </CTAButton>
          </div>
        </div>

        <div className="rounded-2xl border border-app-border bg-app-bg px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-app-text-secondary">
            Registration
          </p>
          <p className="mt-2 text-sm text-app-text-secondary">
            Restarts signup from zero and releases the email for a new registration.
          </p>
          {canResetUserFlow ? (
            <div className="mt-3 flex">
              <CTAButton
                type="button"
                variant="dangerSoft"
                onClick={onOpenReset}
                disabled={isResettingUserFlow}
              >
                <RotateCcw size={14} aria-hidden="true" />
                {isResettingUserFlow ? 'Resetting...' : 'Reset registration flow'}
              </CTAButton>
            </div>
          ) : (
            <p className="mt-3 text-sm text-app-text-secondary">
              Reset registration flow is available only for eligible test accounts.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-app-border bg-app-bg px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-app-text-secondary">
            Testing
          </p>
          <p className="mt-2 text-sm text-app-text-secondary">
            Test users can use the registration reset flow. Production users cannot.
          </p>
          {canToggleTestAccount ? (
            <div className="mt-3 flex items-center gap-3">
              <CTAButton
                type="button"
                variant={userDetail.isTestAccount ? 'secondary' : 'primary'}
                onClick={onToggleTestAccount}
                disabled={isUpdatingTestAccount}
              >
                {isUpdatingTestAccount
                  ? 'Saving...'
                  : userDetail.isTestAccount
                    ? 'Remove test user'
                    : 'Set as test user'}
              </CTAButton>
              <span className="text-xs font-semibold uppercase tracking-wide text-app-text-secondary">
                {userDetail.isTestAccount ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          ) : (
            <p className="mt-3 text-sm text-app-text-secondary">
              Test-user controls are unavailable for this account.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-app-border bg-app-bg px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-app-text-secondary">
            Deletion
          </p>
          <p className="mt-2 text-sm text-app-text-secondary">
            Schedules deletion, blocks access, and later purges identity data.
          </p>
          {canRequestDeletion ? (
            <div className="mt-3 flex">
              <CTAButton type="button" variant="dangerSoft" onClick={onOpenDelete}>
                <Trash2 size={14} aria-hidden="true" />
                Delete account
              </CTAButton>
            </div>
          ) : (
            <p className="mt-3 text-sm text-app-text-secondary">
              {userDetail.role === 'admin'
                ? 'Admin accounts cannot be deleted from this flow.'
                : 'Delete account is unavailable for this user.'}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-app-border bg-app-bg px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-app-text-secondary">
            Access control
          </p>
          <p className="mt-2 text-sm text-app-text-secondary">
            Immediately blocks or restores access without deleting account history.
          </p>
          {canToggleBlockedState ? (
            <div className="mt-3 flex">
              <CTAButton
                type="button"
                variant={userDetail.isBlocked ? 'secondary' : 'danger'}
                onClick={onOpenBlock}
              >
                <AlertTriangle size={14} aria-hidden="true" />
                {blockActionLabel}
              </CTAButton>
            </div>
          ) : (
            <p className="mt-3 text-sm text-app-text-secondary">
              Security actions are unavailable for this account.
            </p>
          )}
        </div>
      </div>
    </div>
  </AdminDetailCard>
);

const UserAccessSection = ({
  accessEditor,
  canManageAdmins,
  canViewAdminAccess,
  isSavingAccess,
  scopes,
  updateAccessEditor,
  saveAccess,
  userDetail,
  t,
}: {
  accessEditor: AccessEditorState | null;
  canManageAdmins: boolean;
  canViewAdminAccess: boolean;
  isSavingAccess: boolean;
  scopes: AdminPermissionScope[];
  updateAccessEditor: (updater: (current: AccessEditorState) => AccessEditorState) => void;
  saveAccess: () => Promise<void>;
  userDetail: AnalyticsUserDetail;
  t: (key: string) => string;
}) => (
  <AdminDetailCard title={t('admin.accessEditorTitle')}>
    {!canViewAdminAccess ? (
      <p className="text-sm text-app-text-secondary">
        Only admins with `admin_users` access can view admin rights.
      </p>
    ) : accessEditor ? (
      <div className="grid gap-6">
        <div className="flex flex-col gap-4 rounded-lg border border-app-border bg-app-bg px-4 py-3 text-xs font-semibold uppercase tracking-wide text-app-text-secondary lg:flex-row lg:items-center lg:justify-between">
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
              disabled={!canManageAdmins}
              onClick={() => updateAccessEditor((current) => ({ ...current, role: 'user' }))}
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
              disabled={!canManageAdmins}
              onClick={() => updateAccessEditor((current) => ({ ...current, role: 'admin' }))}
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

        <div className="grid gap-2 xl:grid-cols-2">
          {scopes.map((scope) => (
            <div
              key={scope}
              className="flex flex-col gap-3 rounded-lg border border-app-border bg-app-bg px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide text-app-text-secondary">
                {scope}
              </span>
              <PermissionLevelSlider
                value={accessEditor.scopeLevels[scope]}
                disabled={!canManageAdmins || accessEditor.role !== 'admin'}
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
        {canManageAdmins ? (
          <div className="flex justify-end">
            <CTAButton
              type="button"
              variant="primary"
              onClick={() => void saveAccess()}
              disabled={
                isSavingAccess ||
                areAccessEditorsEqual(
                  accessEditor,
                  toAccessEditorState(userDetail.role, userDetail.adminPermissions),
                )
              }
            >
              {isSavingAccess ? t('admin.savingAccess') : t('admin.saveAccess')}
            </CTAButton>
          </div>
        ) : null}
      </div>
    ) : (
      <p className="text-sm text-app-text-secondary">{t('admin.noUserSelected')}</p>
    )}
  </AdminDetailCard>
);

const UserPlaylistsSection = ({
  userDetail,
  normalizeDate,
  t,
}: {
  userDetail: AnalyticsUserDetail;
  normalizeDate: (value: string | null) => string;
  t: (key: string) => string;
}) => (
  <AdminDetailCard title="Playlists">
    {userDetail.events.length === 0 ? (
      <p className="text-sm text-app-text-secondary">{t('admin.analyticsUserNoEvents')}</p>
    ) : (
      <div className="grid gap-3 lg:grid-cols-2">
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
            <div className="grid gap-x-3 gap-y-1 text-app-text-secondary sm:grid-cols-2">
              <span>{providerLabel(event.provider)}</span>
              <span className="sm:text-right">
                {t('admin.analyticsColTracks')}: {event.tracksCount}
              </span>
              <span>
                {t('admin.analyticsColShared')}:{' '}
                {event.shared ? t('admin.analyticsSharedYes') : t('admin.analyticsSharedNo')}
              </span>
              <span className="sm:text-right">{normalizeDate(event.updatedAt)}</span>
            </div>
          </div>
        ))}
      </div>
    )}
  </AdminDetailCard>
);

const UserActivitySection = ({
  appPageViews,
  pageViewsCount,
  t,
}: {
  appPageViews: Array<{ path: string; views: number }>;
  pageViewsCount: number;
  t: (key: string) => string;
}) => (
  <div className="grid gap-4">
    <AdminDetailCard title="Usage summary">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-app-border bg-app-bg px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-app-text-secondary">
            Unique pages
          </p>
          <p className="mt-2 text-2xl font-black text-app-text">{appPageViews.length}</p>
        </div>
        <div className="rounded-2xl border border-app-border bg-app-bg px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-app-text-secondary">
            Total page views
          </p>
          <p className="mt-2 text-2xl font-black text-app-text">{pageViewsCount}</p>
        </div>
        <div className="rounded-2xl border border-app-border bg-app-bg px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-app-text-secondary">
            Top route
          </p>
          <p className="mt-2 truncate text-sm font-black text-app-text">
            {appPageViews[0]?.path ?? '—'}
          </p>
        </div>
      </div>
    </AdminDetailCard>

    <AdminDetailCard title="Visited pages">
      {appPageViews.length === 0 ? (
        <p className="text-sm text-app-text-secondary">{t('admin.analyticsUserNoPageViews')}</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {appPageViews.map((row) => (
            <div
              key={row.path}
              className="flex flex-col gap-2 rounded-lg border border-app-border bg-app-bg px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="truncate text-app-text-secondary">{row.path}</span>
              <span className="shrink-0 font-black text-app-text">{row.views}</span>
            </div>
          ))}
        </div>
      )}
    </AdminDetailCard>
  </div>
);

export const AdminUserDetailsPage = () => {
  const { t, locale } = useI18n();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { userId } = useParams({ from: '/users/$userId' });

  const [userDetail, setUserDetail] = useState<AnalyticsUserDetail | null>(null);
  const [accessEditor, setAccessEditor] = useState<AccessEditorState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAccess, setIsSavingAccess] = useState(false);
  const [isSendingPasswordReset, setIsSendingPasswordReset] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isUpdatingBlockedState, setIsUpdatingBlockedState] = useState(false);
  const [isUpdatingTestAccount, setIsUpdatingTestAccount] = useState(false);
  const [isRequestingDeletion, setIsRequestingDeletion] = useState(false);
  const [isResettingUserFlow, setIsResettingUserFlow] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const scopes = useMemo(() => adminPermissionScopeSchema.options, []);
  const currentAdminUserId = useMemo(() => loadAuth()?.userId ?? null, []);
  const canViewAdminAccess = useMemo(() => hasAdminPermission('admin_users', 'read'), []);
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

      setUserDetail(result.user);
      setAccessEditor(toAccessEditorState(result.user.role, result.user.adminPermissions));
    } catch (error) {
      const message = handleAccessError(error);
      if (message) {
        setStatus(message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [handleAccessError, userId]);

  const saveAccess = useCallback(async () => {
    if (
      !userDetail ||
      !accessEditor ||
      !canManageAdmins ||
      areAccessEditorsEqual(
        accessEditor,
        toAccessEditorState(userDetail.role, userDetail.adminPermissions),
      )
    ) {
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

      const result = await callApi(
        `/v1/admin/users/${userDetail.userId}/access`,
        {
          method: 'PUT',
          body: JSON.stringify({
            role: accessEditor.role,
            adminPermissions,
          }),
        },
        (payload) =>
          payload as {
            ok: true;
            user: {
              role: 'user' | 'admin';
              adminPermissions: Array<{
                scope: AdminPermissionScope;
                level: AdminPermissionLevel;
              }>;
            };
          },
      );

      const persistedAccess = toAccessEditorState(result.user.role, result.user.adminPermissions);
      setAccessEditor(persistedAccess);
      setUserDetail((current) =>
        current
          ? {
              ...current,
              role: result.user.role,
              adminPermissions: result.user.adminPermissions,
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
    } finally {
      setIsSavingAccess(false);
    }
  }, [accessEditor, canManageAdmins, handleAccessError, scopes, showToast, t, userDetail]);

  const updateAccessEditor = useCallback(
    (updater: (current: AccessEditorState) => AccessEditorState) => {
      setAccessEditor((current) => (current ? updater(current) : current));
    },
    [],
  );

  const appPageViews = useMemo(() => {
    if (!userDetail) {
      return [];
    }

    return userDetail.pageViewsByPath.filter((row) =>
      isDisplayableAnalyticsPath(row.path, { appOnly: true }),
    );
  }, [userDetail]);

  const pageViewsCount = useMemo(
    () => appPageViews.reduce((total, row) => total + row.views, 0),
    [appPageViews],
  );

  const canToggleBlockedState = Boolean(
    userDetail && currentAdminUserId && userDetail.userId !== currentAdminUserId,
  );
  const canRequestDeletion = Boolean(
    canManageAdmins &&
    userDetail?.role !== 'admin' &&
    currentAdminUserId &&
    userDetail?.userId !== currentAdminUserId,
  );
  const canToggleTestAccount = Boolean(
    canManageAdmins && userDetail?.role !== 'admin' && currentAdminUserId,
  );
  const canResetUserFlow = Boolean(
    canManageAdmins &&
    userDetail?.isTestAccount &&
    userDetail?.role !== 'admin' &&
    currentAdminUserId &&
    userDetail?.userId !== currentAdminUserId,
  );
  const blockActionLabel = userDetail?.isBlocked ? 'Reactivate account' : 'Block account';
  const blockModalTitle = userDetail?.isBlocked ? 'Reactivate account?' : 'Block account?';
  const blockModalMessage = userDetail?.isBlocked
    ? 'This will restore access to login, refresh sessions, and use the customer app again.'
    : 'This will immediately prevent the account from refreshing sessions and accessing the customer app.';
  const deleteModalTitle = 'Delete account?';
  const deleteModalMessage =
    'This will schedule the account for deletion, revoke refresh tokens, and block access during the deletion window.';
  const resetModalTitle = 'Reset registration flow?';
  const resetModalMessage =
    'This will remove the local account so the same email can register again from scratch. Existing local history will be lost.';

  const sendPasswordReset = useCallback(async () => {
    if (!userDetail) {
      return;
    }

    setIsSendingPasswordReset(true);
    setStatus(null);

    try {
      await callApi(
        '/v1/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({
            email: userDetail.email,
          }),
        },
        (payload) => payload,
      );

      const message = `Password reset email requested for ${userDetail.email}.`;
      setStatus(message);
      showToast(message, { variant: 'success' });
    } catch (error) {
      const message = handleAccessError(error);
      if (message) {
        setStatus(message);
        showToast(message, { variant: 'error' });
      }
    } finally {
      setIsSendingPasswordReset(false);
    }
  }, [handleAccessError, showToast, userDetail]);

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

  const requestDeletion = useCallback(async () => {
    if (!userDetail || !canRequestDeletion) {
      return;
    }

    setIsRequestingDeletion(true);
    setStatus(null);

    try {
      const result = await callApi(
        `/v1/admin/users/${userDetail.userId}/request-deletion`,
        {
          method: 'POST',
          body: JSON.stringify({
            reason: 'Requested from admin user detail view.',
          }),
        },
        (payload) =>
          payload as {
            ok: true;
            scheduled: true;
            deletionScheduledFor: string;
          },
      );

      const message = `Account scheduled for deletion on ${normalizeDate(result.deletionScheduledFor)}.`;
      setStatus(message);
      showToast(message, { variant: 'success' });
      setIsDeleteModalOpen(false);
      await loadUserDetail();
    } catch (error) {
      const message = handleAccessError(error);
      if (message) {
        setStatus(message);
        showToast(message, { variant: 'error' });
      }
    } finally {
      setIsRequestingDeletion(false);
    }
  }, [canRequestDeletion, handleAccessError, loadUserDetail, normalizeDate, showToast, userDetail]);

  const toggleTestAccount = useCallback(async () => {
    if (!userDetail || !canToggleTestAccount) {
      return;
    }

    const nextIsTestAccount = !userDetail.isTestAccount;
    setIsUpdatingTestAccount(true);
    setStatus(null);

    try {
      await callApi(
        `/v1/admin/users/${userDetail.userId}/test-account`,
        {
          method: 'PUT',
          body: JSON.stringify({
            isTestAccount: nextIsTestAccount,
          }),
        },
        (payload) => payload,
      );

      setUserDetail((current) =>
        current
          ? {
              ...current,
              isTestAccount: nextIsTestAccount,
            }
          : current,
      );
      const message = nextIsTestAccount
        ? 'User is now eligible for registration reset.'
        : 'User is no longer eligible for registration reset.';
      setStatus(message);
      showToast(message, { variant: 'success' });
    } catch (error) {
      const message = handleAccessError(error);
      if (message) {
        setStatus(message);
        showToast(message, { variant: 'error' });
      }
    } finally {
      setIsUpdatingTestAccount(false);
    }
  }, [canToggleTestAccount, handleAccessError, showToast, userDetail]);

  const resetUserFlow = useCallback(async () => {
    if (!userDetail || !canResetUserFlow) {
      return;
    }

    setIsResettingUserFlow(true);
    setStatus(null);

    try {
      const result = await callApi(
        `/v1/admin/users/${userDetail.userId}/reset-user-flow`,
        {
          method: 'POST',
        },
        (payload) =>
          payload as {
            ok: true;
            reset: true;
            releasedEmail: string;
          },
      );

      const message = `Registration flow reset. ${result.releasedEmail} can register again.`;
      setStatus(message);
      showToast(message, { variant: 'success' });
      setIsResetModalOpen(false);
      void navigate({ to: '/users' });
    } catch (error) {
      const message = handleAccessError(error);
      if (message) {
        setStatus(message);
        showToast(message, { variant: 'error' });
      }
    } finally {
      setIsResettingUserFlow(false);
    }
  }, [canResetUserFlow, handleAccessError, navigate, showToast, userDetail]);

  useEffect(() => {
    void loadUserDetail();
  }, [loadUserDetail]);

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
        <p className="text-sm text-app-text-secondary">{status ?? t('admin.noUserSelected')}</p>
      </section>
    );
  }

  const section = pathname.endsWith('/access')
    ? 'access'
    : pathname.endsWith('/security')
      ? 'security'
      : pathname.endsWith('/playlists')
        ? 'playlists'
        : pathname.endsWith('/activity')
          ? 'activity'
          : 'overview';
  const sectionTitle =
    section === 'overview'
      ? 'Overview'
      : section === 'security'
        ? 'Security'
        : section === 'access'
          ? 'Access'
          : section === 'playlists'
            ? 'Playlists'
            : 'Activity';
  const sectionDescription =
    section === 'overview'
      ? 'Identity, account state, and quick actions.'
      : section === 'security'
        ? 'Password reset, block, deletion, and registration reset controls.'
        : section === 'access'
          ? 'Admin role and permission scopes.'
          : section === 'playlists'
            ? 'Owned playlists and sync state.'
            : 'Visited app routes and usage volume.';

  return (
    <section className="grid content-start gap-6">
      <div className="grid gap-4 rounded-3xl border border-app-border bg-app-elevated p-4 shadow-soft-lift sm:p-5 dark:bg-app-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-row justify-center items-end ">
              <h1 className="mt-4 min-w-0 truncate text-2xl font-black tracking-tight text-brand-dark sm:text-3xl dark:text-brand-white">
                {getUserTitle(userDetail)}
              </h1>{' '}
              <div className="flex flex-wrap items-center pl-3 pb-1">
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${
                    userDetail.isBlocked
                      ? 'border border-brand-pink/50 bg-brand-pink/10 text-[#b41563] dark:text-[#ff8ac0]'
                      : 'border border-brand-lime/40 bg-brand-lime/14 text-brand-dark'
                  }`}
                >
                  {userDetail.isBlocked ? 'Blocked' : 'Active'}
                </span>
              </div>
            </div>
            <p className="mt-1 truncate text-sm font-semibold text-app-text-secondary">
              {userDetail.email}
            </p>
          </div>
        </div>
      </div>

      <p className="px-1 text-sm text-app-text-secondary">
        {sectionTitle} · {sectionDescription}
      </p>

      {section === 'overview' ? (
        <UserOverviewSection
          userDetail={userDetail}
          normalizeDate={normalizeDate}
          pageViewsCount={pageViewsCount}
          t={t}
        />
      ) : null}

      {section === 'security' ? (
        <UserSecuritySection
          userDetail={userDetail}
          canToggleTestAccount={canToggleTestAccount}
          canRequestDeletion={canRequestDeletion}
          canResetUserFlow={canResetUserFlow}
          canToggleBlockedState={canToggleBlockedState}
          blockActionLabel={blockActionLabel}
          isSendingPasswordReset={isSendingPasswordReset}
          isUpdatingTestAccount={isUpdatingTestAccount}
          isResettingUserFlow={isResettingUserFlow}
          onOpenBlock={() => setIsBlockModalOpen(true)}
          onSendPasswordReset={() => void sendPasswordReset()}
          onOpenDelete={() => setIsDeleteModalOpen(true)}
          onOpenReset={() => setIsResetModalOpen(true)}
          onToggleTestAccount={() => void toggleTestAccount()}
        />
      ) : null}

      {section === 'access' ? (
        <UserAccessSection
          accessEditor={accessEditor}
          canManageAdmins={canManageAdmins}
          canViewAdminAccess={canViewAdminAccess}
          isSavingAccess={isSavingAccess}
          scopes={scopes}
          updateAccessEditor={updateAccessEditor}
          saveAccess={saveAccess}
          userDetail={userDetail}
          t={t}
        />
      ) : null}

      {section === 'playlists' ? (
        <UserPlaylistsSection userDetail={userDetail} normalizeDate={normalizeDate} t={t} />
      ) : null}

      {section === 'activity' ? (
        <UserActivitySection appPageViews={appPageViews} pageViewsCount={pageViewsCount} t={t} />
      ) : null}

      {status ? (
        <p className="rounded-lg border border-app-border bg-app-surface px-3 py-2 text-xs font-semibold text-app-text-secondary">
          {status}
        </p>
      ) : null}

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
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <CTAButton
              type="button"
              variant="secondary"
              onClick={() => setIsBlockModalOpen(false)}
              disabled={isUpdatingBlockedState}
              className="w-full justify-center sm:w-auto"
            >
              Cancel
            </CTAButton>
            <CTAButton
              type="button"
              variant={userDetail.isBlocked ? 'primary' : 'danger'}
              onClick={() => void toggleBlockedState()}
              disabled={isUpdatingBlockedState}
              className="w-full justify-center sm:w-auto"
            >
              {isUpdatingBlockedState ? 'Working...' : blockActionLabel}
            </CTAButton>
          </div>
        </div>
      </Modal>

      <Modal
        open={isDeleteModalOpen}
        title={deleteModalTitle}
        onClose={() => {
          if (!isRequestingDeletion) {
            setIsDeleteModalOpen(false);
          }
        }}
      >
        <div className="grid gap-5">
          <p className="text-sm text-app-text-secondary">{deleteModalMessage}</p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <CTAButton
              type="button"
              variant="secondary"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isRequestingDeletion}
              className="w-full justify-center sm:w-auto"
            >
              Cancel
            </CTAButton>
            <CTAButton
              type="button"
              variant="danger"
              onClick={() => void requestDeletion()}
              disabled={isRequestingDeletion}
              className="w-full justify-center sm:w-auto"
            >
              {isRequestingDeletion ? 'Scheduling deletion...' : 'Confirm deletion'}
            </CTAButton>
          </div>
        </div>
      </Modal>

      <Modal
        open={isResetModalOpen}
        title={resetModalTitle}
        onClose={() => {
          if (!isResettingUserFlow) {
            setIsResetModalOpen(false);
          }
        }}
      >
        <div className="grid gap-5">
          <p className="text-sm text-app-text-secondary">{resetModalMessage}</p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <CTAButton
              type="button"
              variant="secondary"
              onClick={() => setIsResetModalOpen(false)}
              disabled={isResettingUserFlow}
              className="w-full justify-center sm:w-auto"
            >
              Cancel
            </CTAButton>
            <CTAButton
              type="button"
              variant="danger"
              onClick={() => void resetUserFlow()}
              disabled={isResettingUserFlow}
              className="w-full justify-center sm:w-auto"
            >
              {isResettingUserFlow ? 'Resetting...' : 'Confirm reset'}
            </CTAButton>
          </div>
        </div>
      </Modal>
    </section>
  );
};
