import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import { AuthPageLayout } from '../components/auth/AuthPageLayout';
import { CTAButton, CTALink } from '../components/ui/cta';
import { PasswordField } from '../components/ui/PasswordField';
import { PasswordStrengthMeter } from '../components/ui/PasswordStrengthMeter';
import { useI18n } from '../hooks/useI18n';
import { trackAnalyticsEvent } from '../lib/analytics';
import { callApi, toApiError } from '../lib/api';
import { PASSWORD_MIN_LENGTH, parseOkResponse } from '../lib/client-models';

export const ResetPasswordPage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const search = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const token = useMemo(() => new URLSearchParams(search).get('token')?.trim() ?? '', [search]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    if (statusType !== 'success') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void navigate({ to: '/auth/login' });
    }, 1800);

    return () => window.clearTimeout(timeoutId);
  }, [navigate, statusType]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setStatusType(null);

    if (!token) {
      setStatus(t('auth.resetPasswordInvalidToken'));
      setStatusType('error');
      trackAnalyticsEvent({
        eventName: 'auth_reset_password_failed',
        target: 'auth',
        properties: {
          reason: 'missing_token',
        },
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatus(t('profile.passwordMismatch'));
      setStatusType('error');
      trackAnalyticsEvent({
        eventName: 'auth_reset_password_failed',
        target: 'auth',
        properties: {
          reason: 'mismatch',
        },
      });
      return;
    }

    trackAnalyticsEvent({
      eventName: 'auth_reset_password_submit',
      target: 'auth',
    });

    setIsSubmitting(true);
    try {
      await callApi(
        '/v1/auth/reset-password',
        {
          method: 'POST',
          body: JSON.stringify({
            token,
            newPassword,
          }),
        },
        parseOkResponse,
      );
      setStatus(t('auth.resetPasswordSuccess'));
      setStatusType('success');
      setNewPassword('');
      setConfirmPassword('');
      trackAnalyticsEvent({
        eventName: 'auth_reset_password_success',
        target: 'auth',
      });
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(apiError.message);
      setStatusType('error');
      trackAnalyticsEvent({
        eventName: 'auth_reset_password_failed',
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
      title={t('auth.resetPasswordTitle')}
      description={t('auth.resetPasswordDescription')}
    >
      <form onSubmit={onSubmit} autoComplete="on" className="mx-auto grid w-full max-w-xl gap-5">
        {statusType === 'success' ? (
          <>
            <p className="rounded-lg border border-brand-lime/35 bg-brand-lime/10 px-3 py-2 text-center text-sm text-[#6d9600] dark:text-[#d5ff5c]">
              {t('auth.resetPasswordSuccess')}
            </p>
            <div className="flex justify-center">
              <CTALink to="/auth/login" variant="secondary">
                {t('auth.backToLogin')}
              </CTALink>
            </div>
          </>
        ) : (
          <>
            <label className="grid gap-2 text-sm font-medium">
              <span>{t('profile.newPassword')}</span>
              <PasswordField
                id="reset-password-new"
                name="newPassword"
                required
                minLength={PASSWORD_MIN_LENGTH}
                autoComplete="new-password"
                value={newPassword}
                onChange={setNewPassword}
                placeholder={t('auth.passwordPlaceholder')}
                inputClassName="w-full rounded-xl border border-app-border bg-app-bg px-3 py-2.5 pr-10 text-base leading-6 text-app-text shadow-soft-lift outline-none transition focus:border-brand-pink"
              />
              <PasswordStrengthMeter password={newPassword} showTooltip />
            </label>

            <label className="grid gap-2 text-sm font-medium">
              <span>{t('profile.confirmPassword')}</span>
              <PasswordField
                id="reset-password-confirm"
                name="confirmPassword"
                required
                minLength={PASSWORD_MIN_LENGTH}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder={t('profile.confirmPassword')}
                inputClassName="w-full rounded-xl border border-app-border bg-app-bg px-3 py-2.5 pr-10 text-base leading-6 text-app-text shadow-soft-lift outline-none transition focus:border-brand-pink"
              />
            </label>

            <CTAButton disabled={isSubmitting} type="submit" variant="primary">
              {isSubmitting ? t('auth.submitting') : t('auth.resetPasswordSubmit')}
            </CTAButton>

            {status ? (
              <p
                className={`rounded-lg border px-3 py-2 text-sm ${
                  statusType === 'error'
                    ? 'border-brand-pink/35 bg-brand-pink/10 text-[#b41563] dark:text-[#ff8ac0]'
                    : 'border-brand-lime/35 bg-brand-lime/10 text-[#6d9600] dark:text-[#d5ff5c]'
                }`}
              >
                {status}
              </p>
            ) : null}

            <p className="text-center text-sm text-app-text-secondary">
              <Link
                to="/auth/login"
                className="text-base font-bold text-brand-pink hover:text-[#d12074]"
              >
                {t('auth.backToLogin')}
              </Link>
            </p>
          </>
        )}
      </form>
    </AuthPageLayout>
  );
};
