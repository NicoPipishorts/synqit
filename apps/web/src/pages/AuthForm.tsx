import { Link, useRouterState } from '@tanstack/react-router';
import { FormEvent, useMemo, useState } from 'react';

import { AuthPageLayout } from '../components/auth/AuthPageLayout';
import { CTAButton } from '../components/ui/cta';
import { PasswordField } from '../components/ui/PasswordField';
import { PasswordStrengthMeter } from '../components/ui/PasswordStrengthMeter';
import { useI18n } from '../hooks/useI18n';
import { trackAnalyticsEvent } from '../lib/analytics';
import { callApi, toApiError } from '../lib/api';
import { storeAuth } from '../lib/auth';
import { PASSWORD_MIN_LENGTH } from '../lib/client-models';

export const AuthForm = ({ endpoint }: { endpoint: '/v1/auth/register' | '/v1/auth/login' }) => {
  const search = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const { t } = useI18n();
  const isLogin = endpoint === '/v1/auth/login';
  const title = isLogin ? t('auth.loginTitle') : t('auth.registerTitle');
  const prefilledEmail = useMemo(
    () => new URLSearchParams(search).get('email')?.trim() ?? '',
    [search],
  );
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'error' | 'success' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const redirectTo = useMemo(() => {
    const rawValue = new URLSearchParams(search).get('redirectTo')?.trim();
    if (!rawValue || !rawValue.startsWith('/') || rawValue.startsWith('//')) {
      return '/dashboard';
    }
    if (rawValue.startsWith('/auth/')) {
      return '/dashboard';
    }
    return rawValue;
  }, [search]);

  const authRouteHref = (path: '/auth/login' | '/auth/register') => {
    const params = new URLSearchParams();
    if (redirectTo !== '/dashboard') {
      params.set('redirectTo', redirectTo);
    }
    if (prefilledEmail) {
      params.set('email', prefilledEmail);
    }
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus(null);
    setStatusType(null);
    trackAnalyticsEvent({
      eventName: isLogin ? 'auth_login_submit' : 'auth_register_submit',
      target: 'auth',
    });

    try {
      const result = await callApi(
        endpoint,
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        },
        (payload) => payload,
      );

      const auth = storeAuth(result);
      setStatus(t('auth.authenticated', { email: auth.userEmail }));
      setStatusType('success');
      trackAnalyticsEvent({
        eventName: isLogin ? 'auth_login_success' : 'auth_register_success',
        target: 'auth',
      });
      window.location.assign(redirectTo);
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(apiError.message);
      setStatusType('error');
      trackAnalyticsEvent({
        eventName: isLogin ? 'auth_login_failed' : 'auth_register_failed',
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
    <AuthPageLayout title={isLogin ? t('auth.welcomeBack') : t('auth.createHost')}>
      <form onSubmit={onSubmit} autoComplete="on" className="mx-auto grid w-full max-w-xl gap-5">
        <label htmlFor="auth-email" className="grid gap-2 text-sm font-medium">
          <span>{t('auth.email')}</span>
          <input
            id="auth-email"
            name="email"
            required
            type="email"
            inputMode="email"
            autoComplete={isLogin ? 'username' : 'email'}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-app-border bg-app-bg px-3 py-2.5 text-base leading-6 text-app-text shadow-soft-lift outline-none transition focus:border-brand-lime"
            placeholder={t('auth.emailPlaceholder')}
          />
        </label>

        <label htmlFor="auth-password" className="grid gap-2 text-sm font-medium">
          <span>{t('auth.password')}</span>
          <PasswordField
            id="auth-password"
            name="password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            value={password}
            onChange={setPassword}
            inputClassName="w-full rounded-xl border border-app-border bg-app-bg px-3 py-2.5 pr-10 text-base leading-6 text-app-text shadow-soft-lift outline-none transition focus:border-brand-pink"
            placeholder={t('auth.passwordPlaceholder')}
          />
          {!isLogin ? <PasswordStrengthMeter password={password} showTooltip /> : null}
        </label>
        {isLogin ? (
          <div className="flex justify-end">
            <Link
              to="/auth/forgot-password"
              className="text-xs text-base font-bold text-brand-pink hover:text-[#d12074]"
            >
              {t('auth.forgotPassword')}
            </Link>
          </div>
        ) : null}

        <CTAButton disabled={isSubmitting} type="submit" variant="primary">
          {isSubmitting ? t('auth.submitting') : title}
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

        <div className="flex flex-col items-center gap-2 border-t border-app-border pt-5 text-center">
          <p className="text-base font-semibold text-app-text">
            {isLogin ? t('auth.noAccount') : t('auth.alreadyAccount')}
          </p>
          <Link
            to={authRouteHref(isLogin ? '/auth/register' : '/auth/login')}
            className="text-base font-bold text-brand-pink hover:text-[#d12074]"
          >
            {isLogin ? t('auth.createOne') : t('auth.loginTitle')}
          </Link>
        </div>
      </form>
    </AuthPageLayout>
  );
};
