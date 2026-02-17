import { PASSWORD_MIN_LENGTH, resetPasswordResponseSchema } from '@synqit/shared';
import { Link, useRouterState } from '@tanstack/react-router';
import { FormEvent, useMemo, useState } from 'react';

import { CTAButton } from '../components/ui/cta';
import { LanguageSwitcher } from '../components/ui/LanguageSwitcher';
import { PasswordField } from '../components/ui/PasswordField';
import { PasswordStrengthMeter } from '../components/ui/PasswordStrengthMeter';
import { useI18n } from '../hooks/useI18n';
import { trackAnalyticsEvent } from '../lib/analytics';
import { callApi, toApiError } from '../lib/api';

export const ResetPasswordPage = () => {
  const { t } = useI18n();
  const search = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const token = useMemo(() => new URLSearchParams(search).get('token')?.trim() ?? '', [search]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'error' | null>(null);

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
        (payload) => resetPasswordResponseSchema.parse(payload),
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
    <section className="relative mx-auto flex min-h-screen w-full max-w-4xl items-center px-4 py-0 sm:min-h-[calc(100svh-8rem)] sm:px-6 sm:py-12 lg:px-8 lg:py-16">
      <div className="pointer-events-none absolute -left-10 top-8 h-44 w-44 rounded-full bg-brand-lime/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-8 bottom-8 h-48 w-48 rounded-full bg-brand-pink/20 blur-3xl" />

      <div className="relative grid w-full gap-6">
        <div className="mx-auto grid w-full max-w-xl gap-2 text-center">
          <h1 className="text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-4xl">
            {t('auth.resetPasswordTitle')}
          </h1>
          <p className="text-sm text-app-text-secondary">{t('auth.resetPasswordDescription')}</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="mx-auto grid w-full max-w-xl gap-5 rounded-3xl border border-app-border bg-app-elevated p-6 shadow-soft-lift dark:bg-app-card sm:p-8"
        >
          <label className="grid gap-2 text-sm font-medium">
            <span>{t('profile.newPassword')}</span>
            <PasswordField
              required
              minLength={PASSWORD_MIN_LENGTH}
              autoComplete="new-password"
              value={newPassword}
              onChange={setNewPassword}
              placeholder={t('auth.passwordPlaceholder')}
              inputClassName="w-full rounded-xl border border-app-border bg-app-bg px-3 py-2.5 pr-10 text-app-text outline-none transition focus:border-brand-pink"
            />
            <PasswordStrengthMeter password={newPassword} showTooltip />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            <span>{t('profile.confirmPassword')}</span>
            <PasswordField
              required
              minLength={PASSWORD_MIN_LENGTH}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder={t('profile.confirmPassword')}
              inputClassName="w-full rounded-xl border border-app-border bg-app-bg px-3 py-2.5 pr-10 text-app-text outline-none transition focus:border-brand-pink"
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

          <p className="text-sm text-app-text-secondary">
            <Link to="/auth/login" className="font-semibold text-brand-pink hover:text-[#d12074]">
              {t('auth.backToLogin')}
            </Link>
          </p>
        </form>

        <div className="mx-auto flex w-full max-w-xl justify-center">
          <div className="flex items-center rounded-full border border-app-border/70 bg-app-elevated/90 px-2 py-1.5 shadow-soft-lift backdrop-blur-md dark:bg-app-card/90">
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </section>
  );
};
