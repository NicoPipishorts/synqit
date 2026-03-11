import { Link } from '@tanstack/react-router';
import { FormEvent, useState } from 'react';

import { AuthPageLayout } from '../components/auth/AuthPageLayout';
import { CTAButton } from '../components/ui/cta';
import { useI18n } from '../hooks/useI18n';
import { trackAnalyticsEvent } from '../lib/analytics';
import { callApi, toApiError } from '../lib/api';
import { parseOkResponse } from '../lib/client-models';

export const ForgotPasswordPage = () => {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'error' | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus(null);
    setStatusType(null);
    trackAnalyticsEvent({
      eventName: 'auth_forgot_password_submit',
      target: 'auth',
    });

    try {
      await callApi(
        '/v1/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({ email }),
        },
        parseOkResponse,
      );
      setStatus(null);
      setStatusType('success');
      trackAnalyticsEvent({
        eventName: 'auth_forgot_password_success',
        target: 'auth',
      });
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(apiError.message);
      setStatusType('error');
      trackAnalyticsEvent({
        eventName: 'auth_forgot_password_failed',
        target: 'auth',
        properties: {
          code: apiError.code,
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPageLayout
      title={t('auth.forgotPasswordTitle')}
      description={t('auth.forgotPasswordDescription')}
    >
      <form
        onSubmit={onSubmit}
        className="mx-auto grid w-full max-w-xl gap-5 rounded-3xl border border-app-border bg-app-elevated p-6 shadow-soft-lift dark:bg-app-card sm:p-8"
      >
        {statusType === 'success' ? (
          <>
            <p className="rounded-lg border border-brand-lime/35 bg-brand-lime/10 px-3 py-2 text-center text-sm text-[#6d9600] dark:text-[#d5ff5c]">
              {t('auth.forgotPasswordSent')}
            </p>
            <p className="text-center text-sm text-app-text-secondary">
              <Link to="/auth/login" className="font-semibold text-brand-pink hover:text-[#d12074]">
                {t('auth.backToLogin')}
              </Link>
            </p>
          </>
        ) : (
          <>
            <label className="grid gap-2 text-sm font-medium">
              <span>{t('auth.email')}</span>
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-app-border bg-app-bg px-3 py-2.5 text-app-text outline-none transition focus:border-brand-lime"
                placeholder={t('auth.emailPlaceholder')}
              />
            </label>

            <CTAButton disabled={isSubmitting} type="submit" variant="primary">
              {isSubmitting ? t('auth.submitting') : t('auth.forgotPasswordSubmit')}
            </CTAButton>

            {status ? (
              <p className="rounded-lg border border-brand-pink/35 bg-brand-pink/10 px-3 py-2 text-center text-sm text-[#b41563] dark:text-[#ff8ac0]">
                {status}
              </p>
            ) : null}

            <p className="text-center text-sm text-app-text-secondary">
              <Link to="/auth/login" className="font-semibold text-brand-pink hover:text-[#d12074]">
                {t('auth.backToLogin')}
              </Link>
            </p>
          </>
        )}
      </form>
    </AuthPageLayout>
  );
};
