import {
  adminCreateRegistrationInviteTokenRequestSchema,
  adminCreateRegistrationInviteTokenResponseSchema,
  adminRegistrationInviteTokenListResponseSchema,
  type AdminRegistrationInviteTokenSummary,
} from '@synqit/shared';
import { useNavigate } from '@tanstack/react-router';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import { CTAButton } from '../components/ui/cta';
import { useI18n } from '../hooks/useI18n';
import { useToast } from '../hooks/useToast';
import { callApi, toApiError } from '../lib/api';
import { clearAuth } from '../lib/auth';

export const AdminInvitesPage = () => {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [invites, setInvites] = useState<AdminRegistrationInviteTokenSummary[]>([]);
  const [email, setEmail] = useState('');
  const [inviteLocale, setInviteLocale] = useState<'en' | 'fr'>(locale === 'fr' ? 'fr' : 'en');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const formatDate = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [locale],
  );

  const groupedInvites = useMemo(() => {
    const groups = new Map<
      string,
      {
        email: string;
        invites: AdminRegistrationInviteTokenSummary[];
      }
    >();

    for (const invite of invites) {
      const key = invite.invitedEmail.trim().toLowerCase();
      const current = groups.get(key);
      if (current) {
        current.invites.push(invite);
        continue;
      }

      groups.set(key, {
        email: invite.invitedEmail,
        invites: [invite],
      });
    }

    const byNewest = (
      left: AdminRegistrationInviteTokenSummary,
      right: AdminRegistrationInviteTokenSummary,
    ) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();

    return Array.from(groups.values())
      .map((group) => {
        const sortedInvites = [...group.invites].sort(byNewest);
        const latestInvite = sortedInvites[0] ?? null;
        const resendInviteRecord =
          sortedInvites.find((invite) => invite.status !== 'used') ?? latestInvite;

        return {
          email: group.email,
          invites: sortedInvites,
          latestInvite,
          resendInviteRecord,
        };
      })
      .sort((left, right) => {
        const leftTime = left.latestInvite ? new Date(left.latestInvite.createdAt).getTime() : 0;
        const rightTime = right.latestInvite ? new Date(right.latestInvite.createdAt).getTime() : 0;
        return rightTime - leftTime;
      });
  }, [invites]);

  const formatOptionalDate = useCallback(
    (value: string | null): string => {
      if (!value) return '—';
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return '—';
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

  const loadInvites = useCallback(async () => {
    setIsLoading(true);
    setStatus(null);
    try {
      const result = await callApi('/v1/admin/invites', { method: 'GET' }, (payload) =>
        adminRegistrationInviteTokenListResponseSchema.parse(payload),
      );
      setInvites(result.tokens);
    } catch (error) {
      const message = handleAccessError(error);
      if (message) {
        setStatus(message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [handleAccessError]);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsSubmitting(true);
      setStatus(null);

      const payload = adminCreateRegistrationInviteTokenRequestSchema.parse({
        email,
        locale: inviteLocale,
      });

      try {
        await callApi(
          '/v1/admin/invites',
          {
            method: 'POST',
            body: JSON.stringify(payload),
          },
          (responsePayload) =>
            adminCreateRegistrationInviteTokenResponseSchema.parse(responsePayload),
        );
        setEmail('');
        const message = t('admin.inviteSent');
        setStatus(message);
        showToast(message, { variant: 'success' });
        await loadInvites();
      } catch (error) {
        const message = handleAccessError(error);
        if (message) {
          setStatus(message);
          showToast(message, { variant: 'error' });
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [email, handleAccessError, inviteLocale, loadInvites, showToast, t],
  );

  const resendInvite = useCallback(
    async (inviteId: string) => {
      setResendingInviteId(inviteId);
      setStatus(null);
      try {
        await callApi(
          `/v1/admin/invites/${inviteId}/resend`,
          {
            method: 'POST',
          },
          (payload) => adminCreateRegistrationInviteTokenResponseSchema.parse(payload),
        );
        const message = t('admin.inviteResent');
        setStatus(message);
        showToast(message, { variant: 'success' });
        await loadInvites();
      } catch (error) {
        const message = handleAccessError(error);
        if (message) {
          setStatus(message);
          showToast(message, { variant: 'error' });
        }
      } finally {
        setResendingInviteId(null);
      }
    },
    [handleAccessError, loadInvites, showToast, t],
  );

  return (
    <section className="grid content-start gap-6">
      <AdminSectionHeader
        title={t('admin.invitesTitle')}
        description={t('admin.registrationInvitesDescription')}
      />

      <article className="grid gap-5 rounded-3xl border border-app-border bg-app-elevated p-4 shadow-soft-lift sm:p-5 dark:bg-app-card">
        <div className="grid gap-1">
          <h2 className="text-lg font-black text-app-text">{t('admin.sendInviteTitle')}</h2>
          <p className="text-sm text-app-text-secondary">{t('admin.registrationInvitesHelp')}</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end"
        >
          <label className="grid gap-2 text-sm font-medium">
            <span>{t('auth.email')}</span>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-app-border bg-app-bg px-3 py-2.5 text-sm text-app-text outline-none transition focus:border-brand-lime"
              placeholder={t('admin.previewEmailPlaceholder')}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            <span>{t('admin.inviteLocaleLabel')}</span>
            <select
              value={inviteLocale}
              onChange={(event) => setInviteLocale(event.target.value === 'fr' ? 'fr' : 'en')}
              className="w-full rounded-xl border border-app-border bg-app-bg px-3 py-2.5 text-sm text-app-text outline-none transition focus:border-brand-lime"
            >
              <option value="en">English</option>
              <option value="fr">Français</option>
            </select>
          </label>
          <CTAButton
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="min-h-[42px] w-full sm:w-auto"
          >
            {isSubmitting ? t('admin.generatingInviteToken') : t('admin.sendInvite')}
          </CTAButton>
        </form>

        {isLoading ? (
          <p className="text-sm text-app-text-secondary">{t('admin.loadingInviteTokens')}</p>
        ) : groupedInvites.length === 0 ? (
          <p className="text-sm text-app-text-secondary">{t('admin.noInviteTokens')}</p>
        ) : (
          <>
            <div className="grid gap-3 md:hidden">
              {groupedInvites.map((group) => {
                const latestInvite = group.latestInvite;
                const resendInviteRecord = group.resendInviteRecord;
                const canResend = Boolean(latestInvite && latestInvite.status !== 'used');

                if (!latestInvite || !resendInviteRecord) {
                  return null;
                }

                return (
                  <div
                    key={group.email}
                    className="grid gap-3 rounded-2xl border border-app-border bg-app-surface p-4 dark:bg-app-card"
                  >
                    <div className="grid gap-1">
                      <p className="truncate text-sm font-black text-app-text">{group.email}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs font-semibold text-app-text-secondary">
                      <div className="grid gap-1">
                        <span>{t('admin.inviteTokenCreatedAt')}</span>
                        <span className="text-app-text">
                          {formatOptionalDate(latestInvite.createdAt)}
                        </span>
                      </div>
                      <div className="grid gap-1">
                        <span>{t('admin.inviteTokenExpiresAt')}</span>
                        <span className="text-app-text">
                          {formatOptionalDate(latestInvite.expiresAt)}
                        </span>
                      </div>
                      <div className="grid gap-1">
                        <span>{t('admin.inviteTokenLastSentAt')}</span>
                        <span className="text-app-text">
                          {formatOptionalDate(latestInvite.lastSentAt)}
                        </span>
                      </div>
                      <div className="grid gap-1">
                        <span>{t('admin.inviteTokenStatus')}</span>
                        <div className="flex flex-wrap items-center gap-2 text-app-text">
                          <span className="text-app-text-secondary">
                            {t('admin.inviteCount', { count: group.invites.length })}
                          </span>
                          <span>{t(`admin.inviteStatus.${latestInvite.status}` as never)}</span>
                        </div>
                      </div>
                    </div>
                    <CTAButton
                      type="button"
                      variant="secondary"
                      disabled={!canResend || resendingInviteId === resendInviteRecord.id}
                      onClick={() => void resendInvite(resendInviteRecord.id)}
                      className="w-full justify-center"
                    >
                      {resendingInviteId === resendInviteRecord.id
                        ? t('admin.sendingInvite')
                        : t('admin.resendInvite')}
                    </CTAButton>
                  </div>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto rounded-2xl border border-app-border md:block">
              <table className="w-full min-w-[940px] border-collapse text-left">
                <thead className="bg-app-surface dark:bg-app-card">
                  <tr className="border-b border-app-border text-[11px] uppercase tracking-wide text-app-text-secondary">
                    <th className="px-3 py-2 font-black">{t('auth.email')}</th>
                    <th className="px-3 py-2 font-black">{t('admin.inviteTokenCreatedAt')}</th>
                    <th className="px-3 py-2 font-black">{t('admin.inviteTokenExpiresAt')}</th>
                    <th className="px-3 py-2 font-black">{t('admin.inviteTokenLastSentAt')}</th>
                    <th className="px-3 py-2 font-black">{t('admin.inviteTokenStatus')}</th>
                    <th className="px-3 py-2 font-black">{t('admin.inviteActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedInvites.map((group) => {
                    const latestInvite = group.latestInvite;
                    const resendInviteRecord = group.resendInviteRecord;
                    const canResend = Boolean(latestInvite && latestInvite.status !== 'used');

                    if (!latestInvite || !resendInviteRecord) {
                      return null;
                    }

                    return (
                      <tr key={group.email} className="border-b border-app-border last:border-b-0">
                        <td className="px-3 py-2 text-sm font-bold text-app-text">{group.email}</td>
                        <td className="px-3 py-2 text-xs font-semibold text-app-text-secondary">
                          {formatOptionalDate(latestInvite.createdAt)}
                        </td>
                        <td className="px-3 py-2 text-xs font-semibold text-app-text-secondary">
                          {formatOptionalDate(latestInvite.expiresAt)}
                        </td>
                        <td className="px-3 py-2 text-xs font-semibold text-app-text-secondary">
                          {formatOptionalDate(latestInvite.lastSentAt)}
                        </td>
                        <td className="px-3 py-2 text-xs font-semibold text-app-text-secondary">
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{t('admin.inviteCount', { count: group.invites.length })}</span>
                            <span>{t(`admin.inviteStatus.${latestInvite.status}` as never)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <CTAButton
                            type="button"
                            variant="secondary"
                            disabled={!canResend || resendingInviteId === resendInviteRecord.id}
                            onClick={() => void resendInvite(resendInviteRecord.id)}
                          >
                            {resendingInviteId === resendInviteRecord.id
                              ? t('admin.sendingInvite')
                              : t('admin.resendInvite')}
                          </CTAButton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {status ? (
          <p className="rounded-lg border border-app-border bg-app-surface px-3 py-2 text-xs font-semibold text-app-text-secondary">
            {status}
          </p>
        ) : null}
      </article>
    </section>
  );
};
