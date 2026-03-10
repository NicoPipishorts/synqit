import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import { CTAButton } from '../components/ui/cta';
import { useI18n } from '../hooks/useI18n';
import { callApi, toApiError } from '../lib/api';
import { clearAuth } from '../lib/auth';

export const AdminEmailsPage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [previewEmail, setPreviewEmail] = useState('');
  const [previewLocale, setPreviewLocale] = useState<'en' | 'fr'>('en');
  const [isSendingPreview, setIsSendingPreview] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<string | null>(null);
  const [resetPreviewEmail, setResetPreviewEmail] = useState('');
  const [resetPreviewLocale, setResetPreviewLocale] = useState<'en' | 'fr'>('en');
  const [isSendingResetPreview, setIsSendingResetPreview] = useState(false);
  const [resetPreviewStatus, setResetPreviewStatus] = useState<string | null>(null);

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
      const apiError = toApiError(error);
      if (apiError.code === 'unauthorized' || apiError.code === 'forbidden') {
        clearAuth();
        void navigate({ to: '/login' });
        return;
      }
      setPreviewStatus(apiError.message);
    } finally {
      setIsSendingPreview(false);
    }
  };

  const sendResetPreview = async () => {
    if (!resetPreviewEmail) {
      return;
    }

    setIsSendingResetPreview(true);
    setResetPreviewStatus(null);
    try {
      const result = await callApi(
        '/v1/admin/email/preview/password-reset',
        {
          method: 'POST',
          body: JSON.stringify({
            toEmail: resetPreviewEmail,
            locale: resetPreviewLocale,
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
      setResetPreviewStatus(
        jobId ? t('admin.resetPreviewQueuedWithJob', { jobId }) : t('admin.resetPreviewQueued'),
      );
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.code === 'unauthorized' || apiError.code === 'forbidden') {
        clearAuth();
        void navigate({ to: '/login' });
        return;
      }
      setResetPreviewStatus(apiError.message);
    } finally {
      setIsSendingResetPreview(false);
    }
  };

  return (
    <section className="grid content-start gap-6">
      <AdminSectionHeader
        title={t('admin.emailPreviewTitle')}
        description={t('admin.portalSubtitle')}
      />

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

      <article className="grid gap-4 rounded-3xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card">
        <h2 className="text-lg font-black text-app-text">{t('admin.passwordResetPreviewTitle')}</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <input
            type="email"
            value={resetPreviewEmail}
            onChange={(event) => setResetPreviewEmail(event.target.value)}
            placeholder={t('admin.previewEmailPlaceholder')}
            className="w-full rounded-xl border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text outline-none transition focus:border-brand-lime"
          />
          <select
            value={resetPreviewLocale}
            onChange={(event) => setResetPreviewLocale(event.target.value === 'fr' ? 'fr' : 'en')}
            className="rounded-xl border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text"
          >
            <option value="en">EN</option>
            <option value="fr">FR</option>
          </select>
          <CTAButton
            type="button"
            variant="secondary"
            onClick={() => void sendResetPreview()}
            disabled={isSendingResetPreview}
          >
            {isSendingResetPreview ? t('admin.sendingResetPreview') : t('admin.sendResetPreview')}
          </CTAButton>
        </div>
        {resetPreviewStatus ? (
          <p className="rounded-lg border border-app-border bg-app-surface px-3 py-2 text-xs font-semibold text-app-text-secondary">
            {resetPreviewStatus}
          </p>
        ) : null}
      </article>
    </section>
  );
};
