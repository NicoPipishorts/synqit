import { authUserSchema, refreshTokenRequestSchema } from '@synqit/shared';
import { useState } from 'react';

import { CTAButton, CTALink } from '../components/ui/cta';
import { HeroPill } from '../components/ui/HeroPill';
import { useI18n } from '../hooks/useI18n';
import { callApi, toApiError } from '../lib/api';
import { clearAuth, loadAuth } from '../lib/auth';
import { StoredAuth } from '../lib/types';

export const DashboardPage = () => {
  const { t } = useI18n();
  const [auth, setAuth] = useState<StoredAuth | null>(() => loadAuth());
  const [profile, setProfile] = useState<string>(t('dashboard.noProfileLoaded'));
  const [isLoading, setIsLoading] = useState(false);

  const loadProfile = async () => {
    if (!auth) {
      setProfile(t('dashboard.notLoggedIn'));
      return;
    }

    setIsLoading(true);
    try {
      const user = await callApi(
        '/v1/me',
        {
          method: 'GET',
          headers: {
            authorization: `Bearer ${auth.accessToken}`,
          },
        },
        (payload) => authUserSchema.parse(payload),
      );
      setProfile(t('dashboard.profileLoaded', { id: user.id, email: user.email }));
    } catch (error) {
      const apiError = toApiError(error);
      setProfile(t('dashboard.error', { message: apiError.message }));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    const redirectToLogin = () => {
      if (typeof window === 'undefined') {
        return;
      }
      if (window.location.pathname === '/auth/login') {
        return;
      }
      window.location.assign('/auth/login');
    };

    if (!auth) {
      clearAuth();
      redirectToLogin();
      return;
    }

    const refreshPayload = refreshTokenRequestSchema.parse({
      refreshToken: auth.refreshToken,
    });

    await callApi(
      '/v1/auth/logout',
      {
        method: 'POST',
        body: JSON.stringify(refreshPayload),
      },
      (payload) => payload,
    ).catch(() => undefined);

    clearAuth();
    setAuth(null);
    setProfile(t('dashboard.loggedOut'));
    redirectToLogin();
  };

  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8">
      <div className="pointer-events-none absolute -left-10 top-20 h-44 w-44 rounded-full bg-brand-lime/15 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-16 h-52 w-52 rounded-full bg-brand-pink/15 blur-3xl" />

      <div className="relative grid gap-6">
        <article>
          <div className="flex flex-wrap items-start justify-between gap-6 px-5 py-7 sm:px-8 sm:py-9">
            <div className="grid gap-2">
              <h1 className="text-2xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl">
                {t('dashboard.title')}
              </h1>
              <p className="text-sm text-app-text-secondary">
                {auth
                  ? t('dashboard.sessionActive', { email: auth.userEmail })
                  : t('dashboard.noActiveSession')}
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-[2rem] border border-app-border bg-brand-gradient p-[1px] shadow-soft-lift">
          <div className="grid gap-5 rounded-[calc(2rem-1px)] bg-app-elevated px-5 py-8 dark:bg-app-card sm:px-8 sm:py-10">
            <div className="flex flex-wrap items-center gap-3">
              <HeroPill variant="lime">{t('dashboard.pill')}</HeroPill>
            </div>
            <p className="max-w-3xl text-sm text-app-text-secondary sm:text-base">
              {t('dashboard.description')}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <CTALink to="/events" variant="secondary">
                {t('dashboard.ctaEvents')}
              </CTALink>
              <CTALink to="/providers" variant="secondary">
                {t('dashboard.ctaProviders')}
              </CTALink>
              <CTALink to="/events/new" variant="primary">
                {t('dashboard.ctaCreateEvent')}
              </CTALink>
            </div>
          </div>
        </article>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-brand-dark dark:text-brand-white">
                {t('dashboard.profileCardTitle')}
              </h2>
              <CTAButton
                disabled={isLoading}
                onClick={() => void loadProfile()}
                type="button"
                variant="danger"
              >
                {isLoading ? t('dashboard.loading') : t('dashboard.loadProfile')}
              </CTAButton>
            </div>
            <p className="mt-3 rounded-xl border border-app-border bg-app-bg px-3 py-3 text-sm text-app-text-secondary dark:bg-app-elevated">
              {profile}
            </p>
          </article>

          <article className="rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card">
            <h2 className="text-xl font-bold text-brand-dark dark:text-brand-white">
              {t('dashboard.sessionCardTitle')}
            </h2>
            <p className="mt-2 text-sm text-app-text-secondary">
              {auth ? t('dashboard.sessionActiveBody') : t('dashboard.sessionInactiveBody')}
            </p>
            <CTAButton
              onClick={() => void logout()}
              type="button"
              variant="secondary"
              className="mt-4"
            >
              {t('dashboard.logout')}
            </CTAButton>
          </article>
        </div>
      </div>
    </section>
  );
};
