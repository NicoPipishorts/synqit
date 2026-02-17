import {
  adminPermissionScopeSchema,
  adminUserListResponseSchema,
  type AdminUserListResponse,
  type AdminPermissionLevel,
  type AdminPermissionScope,
} from '@synqit/shared';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

import { CTAButton } from '../components/ui/cta';
import { useI18n } from '../hooks/useI18n';
import { callApi, toApiError } from '../lib/api';
import { clearAuth, updateStoredAuthUser } from '../lib/auth';

type AccessLevelUi = AdminPermissionLevel | 'none';

type AccessEditorState = {
  userId: string;
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

export const AdminPortalPage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUserListResponse['users']>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [usersStatus, setUsersStatus] = useState<string | null>(null);
  const [editor, setEditor] = useState<AccessEditorState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [previewEmail, setPreviewEmail] = useState('');
  const [previewLocale, setPreviewLocale] = useState<'en' | 'fr'>('en');
  const [isSendingPreview, setIsSendingPreview] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<string | null>(null);

  const scopes = useMemo(() => adminPermissionScopeSchema.options, []);

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    setUsersStatus(null);
    try {
      const meResult = await callApi(
        '/v1/admin/me',
        {
          method: 'GET',
        },
        (payload) => payload,
      );
      const meUser = (meResult as { user?: unknown }).user;
      if (meUser && typeof meUser === 'object') {
        const maybeRole = (meUser as { role?: unknown }).role;
        if (maybeRole === 'admin') {
          updateStoredAuthUser({
            role: 'admin',
            adminPermissions:
              ((meUser as { adminPermissions?: unknown }).adminPermissions as
                | {
                    scope: AdminPermissionScope;
                    level: AdminPermissionLevel;
                  }[]
                | undefined) ?? [],
          });
        }
      }

      const result = await callApi(
        '/v1/admin/users',
        {
          method: 'GET',
        },
        (payload) => adminUserListResponseSchema.parse(payload),
      );
      setUsers(result.users);
      if (!editor && result.users.length > 0) {
        const first = result.users[0];
        const scopeLevels = defaultScopeLevels();
        for (const permission of first.adminPermissions) {
          scopeLevels[permission.scope] = permission.level;
        }
        setEditor({
          userId: first.id,
          role: first.role,
          scopeLevels,
        });
      }
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.code === 'unauthorized' || apiError.code === 'forbidden') {
        clearAuth();
        void navigate({ to: '/admin/login' });
        return;
      }
      setUsersStatus(apiError.message);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectUser = (userId: string) => {
    const target = users.find((user) => user.id === userId);
    if (!target) {
      return;
    }
    const scopeLevels = defaultScopeLevels();
    for (const permission of target.adminPermissions) {
      scopeLevels[permission.scope] = permission.level;
    }
    setEditor({
      userId: target.id,
      role: target.role,
      scopeLevels,
    });
  };

  const saveAccess = async () => {
    if (!editor) {
      return;
    }

    setIsSaving(true);
    setUsersStatus(null);
    try {
      const adminPermissions =
        editor.role === 'admin'
          ? scopes
              .map((scope) => {
                const level = editor.scopeLevels[scope];
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
        `/v1/admin/users/${editor.userId}/access`,
        {
          method: 'PUT',
          body: JSON.stringify({
            role: editor.role,
            adminPermissions,
          }),
        },
        (payload) => payload,
      );
      setUsersStatus(t('admin.accessUpdated'));
      await loadUsers();
    } catch (error) {
      setUsersStatus(toApiError(error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const sendPreview = async () => {
    if (!previewEmail) {
      return;
    }

    setIsSendingPreview(true);
    setPreviewStatus(null);
    try {
      const result = await callApi(
        '/v1/admin/email/preview',
        {
          method: 'POST',
          body: JSON.stringify({
            toEmail: previewEmail,
            locale: previewLocale,
          }),
        },
        (payload) => payload,
      );
      const jobId =
        result &&
        typeof result === 'object' &&
        'jobId' in result &&
        typeof result.jobId === 'string'
          ? result.jobId
          : null;
      setPreviewStatus(
        jobId ? t('admin.previewQueuedWithJob', { jobId }) : t('admin.previewQueued'),
      );
    } catch (error) {
      setPreviewStatus(toApiError(error).message);
    } finally {
      setIsSendingPreview(false);
    }
  };

  return (
    <section className="mx-auto grid min-h-screen w-full max-w-6xl gap-5 px-4 pb-10 pt-28 sm:px-6 sm:pt-32 lg:px-8">
      <header className="grid gap-1">
        <h1 className="text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white">
          {t('admin.portalTitle')}
        </h1>
        <p className="text-sm font-semibold text-app-text-secondary">{t('admin.portalSubtitle')}</p>
      </header>

      <article className="grid gap-4 rounded-3xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card">
        <h2 className="text-lg font-black text-app-text">{t('admin.emailPreviewTitle')}</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <input
            type="email"
            value={previewEmail}
            onChange={(event) => setPreviewEmail(event.target.value)}
            placeholder={t('admin.previewEmailPlaceholder')}
            className="w-full rounded-xl border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text outline-none transition focus:border-brand-lime"
          />
          <select
            value={previewLocale}
            onChange={(event) => setPreviewLocale(event.target.value === 'fr' ? 'fr' : 'en')}
            className="rounded-xl border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text"
          >
            <option value="en">EN</option>
            <option value="fr">FR</option>
          </select>
          <CTAButton
            type="button"
            variant="secondary"
            onClick={() => void sendPreview()}
            disabled={isSendingPreview}
          >
            {isSendingPreview ? t('admin.sendingPreview') : t('admin.sendPreview')}
          </CTAButton>
        </div>
        {previewStatus ? (
          <p className="rounded-lg border border-app-border bg-app-surface px-3 py-2 text-xs font-semibold text-app-text-secondary">
            {previewStatus}
          </p>
        ) : null}
      </article>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <article className="flex min-h-[30rem] flex-col gap-4 rounded-3xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card lg:h-[36rem]">
          <h2 className="text-lg font-black text-app-text">{t('admin.usersTitle')}</h2>
          {isLoadingUsers ? (
            <p className="text-sm text-app-text-secondary">{t('admin.loadingUsers')}</p>
          ) : (
            <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-app-border bg-app-surface dark:bg-app-card">
              <div className="grid grid-cols-[1fr_auto] border-b border-app-border px-3 py-2 text-[11px] font-black uppercase tracking-wide text-app-text-secondary">
                <span>{t('auth.email')}</span>
                <span>{t('admin.roleLabel')}</span>
              </div>
              <div className="min-h-0 max-h-full overflow-y-auto">
                {users.map((user) => {
                  const active = editor?.userId === user.id;
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => selectUser(user.id)}
                      className={`grid w-full cursor-pointer grid-cols-[1fr_auto] items-center gap-2 border-b border-app-border px-3 py-3 text-left transition last:border-b-0 ${
                        active
                          ? 'bg-brand-lime/10'
                          : 'bg-transparent hover:bg-app-elevated dark:hover:bg-app-elevated/70'
                      }`}
                    >
                      <span className="truncate text-sm font-black text-app-text">
                        {user.email}
                      </span>
                      <span className="rounded-full border border-app-border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-app-text-secondary">
                        {user.role}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {usersStatus ? (
            <p className="rounded-lg border border-app-border bg-app-surface px-3 py-2 text-xs font-semibold text-app-text-secondary">
              {usersStatus}
            </p>
          ) : null}
        </article>

        <article className="flex min-h-[30rem] flex-col gap-4 rounded-3xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card lg:h-[36rem]">
          <h2 className="text-lg font-black text-app-text">{t('admin.accessEditorTitle')}</h2>
          {!editor ? (
            <p className="text-sm text-app-text-secondary">{t('admin.noUserSelected')}</p>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="grid gap-4">
                <label className="grid gap-2 text-sm font-semibold">
                  <span>{t('admin.roleLabel')}</span>
                  <select
                    value={editor.role}
                    onChange={(event) =>
                      setEditor((current) =>
                        current
                          ? {
                              ...current,
                              role: event.target.value === 'admin' ? 'admin' : 'user',
                            }
                          : current,
                      )
                    }
                    className="rounded-xl border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text"
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </label>

                <div className="grid gap-2">
                  {scopes.map((scope) => (
                    <label
                      key={scope}
                      className="grid gap-1 text-xs font-semibold uppercase tracking-wide"
                    >
                      <span className="text-app-text-secondary">{scope}</span>
                      <select
                        value={editor.scopeLevels[scope]}
                        disabled={editor.role !== 'admin'}
                        onChange={(event) =>
                          setEditor((current) =>
                            current
                              ? {
                                  ...current,
                                  scopeLevels: {
                                    ...current.scopeLevels,
                                    [scope]: event.target.value as AccessLevelUi,
                                  },
                                }
                              : current,
                          )
                        }
                        className="rounded-lg border border-app-border bg-app-bg px-2.5 py-2 text-sm font-semibold text-app-text disabled:opacity-60"
                      >
                        <option value="none">none</option>
                        <option value="read">read</option>
                        <option value="write">write</option>
                      </select>
                    </label>
                  ))}
                </div>

                <CTAButton
                  type="button"
                  variant="primary"
                  onClick={() => void saveAccess()}
                  disabled={isSaving}
                >
                  {isSaving ? t('admin.savingAccess') : t('admin.saveAccess')}
                </CTAButton>
              </div>
            </div>
          )}
        </article>
      </div>
    </section>
  );
};
