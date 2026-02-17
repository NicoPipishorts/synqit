import { forgotPasswordResponseSchema } from '@synqit/shared';
import { Link } from '@tanstack/react-router';
import { FormEvent, useState } from 'react';

import { CTAButton } from '../components/ui/cta';
import { LanguageSwitcher } from '../components/ui/LanguageSwitcher';
import { useI18n } from '../hooks/useI18n';
import { callApi, toApiError } from '../lib/api';

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

    try {
      await callApi(
        '/v1/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({ email }),
        },
        (payload) => forgotPasswordResponseSchema.parse(payload),
      );
      setStatus(null);
      setStatusType('success');
    } catch (error) {
      setStatus(toApiError(error).message);
      setStatusType('error');
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
            {t('auth.forgotPasswordTitle')}
          </h1>
          <p className="text-sm text-app-text-secondary">{t('auth.forgotPasswordDescription')}</p>
        </div>

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
                <Link
                  to="/auth/login"
                  className="font-semibold text-brand-pink hover:text-[#d12074]"
                >
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
                <Link
                  to="/auth/login"
                  className="font-semibold text-brand-pink hover:text-[#d12074]"
                >
                  {t('auth.backToLogin')}
                </Link>
              </p>
            </>
          )}
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
