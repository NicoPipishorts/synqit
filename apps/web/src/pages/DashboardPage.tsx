import { authUserSchema, refreshTokenRequestSchema } from '@synqit/shared';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';

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
    if (!auth) {
      clearAuth();
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
  };

  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8">
      <div className="pointer-events-none absolute -left-10 top-20 h-44 w-44 rounded-full bg-brand-lime/15 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-16 h-52 w-52 rounded-full bg-brand-pink/15 blur-3xl" />

      <div className="relative grid gap-6">
        <article className="rounded-[2rem] border border-app-border bg-brand-gradient p-[1px] shadow-soft-lift">
          <div className="grid gap-5 rounded-[calc(2rem-1px)] bg-app-elevated px-5 py-8 dark:bg-app-card sm:px-8 sm:py-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <HeroPill variant="lime">{t('dashboard.pill')}</HeroPill>
              <p className="text-sm text-app-text-secondary">
                {auth
                  ? t('dashboard.sessionActive', { email: auth.userEmail })
                  : t('dashboard.noActiveSession')}
              </p>
            </div>
            <div className="grid gap-2">
              <h1 className="text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-4xl">
                {t('dashboard.title')}
              </h1>
              <p className="max-w-3xl text-sm text-app-text-secondary sm:text-base">
                {t('dashboard.description')}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Link
                to="/events"
                className="rounded-xl border border-app-border bg-app-bg px-4 py-3 text-sm font-semibold transition hover:border-brand-lime dark:bg-app-elevated"
              >
                {t('dashboard.ctaEvents')}
              </Link>
              <Link
                to="/providers"
                className="rounded-xl border border-app-border bg-app-bg px-4 py-3 text-sm font-semibold transition hover:border-brand-pink dark:bg-app-elevated"
              >
                {t('dashboard.ctaProviders')}
              </Link>
              <Link
                to="/events/new"
                className="rounded-xl bg-brand-lime px-4 py-3 text-sm font-semibold text-brand-dark shadow-soft-lift transition hover:bg-[#b2e600] dark:bg-[#aee000] dark:hover:bg-[#9fd100]"
              >
                {t('dashboard.ctaCreateEvent')}
              </Link>
            </div>
          </div>
        </article>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-brand-dark dark:text-brand-white">
                {t('dashboard.profileCardTitle')}
              </h2>
              <button
                disabled={isLoading}
                onClick={() => void loadProfile()}
                type="button"
                className="rounded-lg bg-brand-pink px-3 py-2 text-sm font-semibold text-brand-white transition hover:bg-[#d12074] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? t('dashboard.loading') : t('dashboard.loadProfile')}
              </button>
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
            <button
              onClick={() => void logout()}
              type="button"
              className="mt-4 rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm font-semibold transition hover:border-brand-pink dark:bg-app-elevated"
            >
              {t('dashboard.logout')}
            </button>
          </article>
        </div>
      </div>
    </section>
  );
};
