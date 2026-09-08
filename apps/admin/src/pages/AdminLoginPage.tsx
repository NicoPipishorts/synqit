import { BrandLogo } from '@synqit/ui';
import { useNavigate } from '@tanstack/react-router';
import { FormEvent, useState } from 'react';

import { CTAButton } from '../components/ui/cta';
import { useI18n } from '../hooks/useI18n';
import { callApi, toApiError } from '../lib/api';
import { storeAuth } from '../lib/auth';

export const AdminLoginPage = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus(null);

    try {
      const result = await callApi(
        '/v1/admin/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        },
        (payload) => payload,
      );

      storeAuth(result);
      void navigate({ to: '/users' });
    } catch (error) {
      setStatus(toApiError(error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto grid min-h-screen w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden rounded-[2rem] border border-brand-white/10 bg-brand-dark p-8 text-brand-white shadow-soft-lift lg:grid">
          <div className="grid content-between gap-10">
            <div className="grid gap-5">
              <BrandLogo className="h-12 w-auto" surface="dark" />
              <div className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.24em] text-brand-white/55">
                  Synqit admin
                </span>
                <h1 className="max-w-xl text-4xl font-black tracking-tight">
                  Dedicated control plane for operations, analytics, and access.
                </h1>
                <p className="max-w-lg text-sm text-brand-white/75">{t('admin.loginSubtitle')}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-brand-white/12 bg-brand-white/8 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-white/55">
                Domain split
              </p>
              <p className="mt-2 text-sm text-brand-white/82">
                Keep public hosts and guests on the main app while operations use a dedicated admin
                portal.
              </p>
            </div>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="mx-auto grid w-full max-w-lg gap-5 rounded-[2rem] border border-app-border bg-app-elevated/96 p-6 shadow-soft-lift backdrop-blur dark:bg-app-card sm:p-8"
        >
          <div className="grid gap-4">
            <div className="inline-flex items-center gap-3 lg:hidden">
              <BrandLogo className="h-10 w-auto" />
              <span className="text-xs font-black uppercase tracking-[0.22em] text-app-text-muted">
                Synqit admin
              </span>
            </div>
            <div className="grid gap-1">
              <h2 className="text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white">
                {t('admin.loginTitle')}
              </h2>
              <p className="text-sm text-app-text-secondary">{t('admin.loginSubtitle')}</p>
            </div>
          </div>

          <label className="grid gap-2 text-sm font-medium">
            <span>{t('auth.email')}</span>
            <input
              required
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-app-border bg-app-bg px-3 py-3 text-app-text outline-none transition focus:border-brand-lime"
              placeholder={t('auth.emailPlaceholder')}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            <span>{t('auth.password')}</span>
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-app-border bg-app-bg px-3 py-3 text-app-text outline-none transition focus:border-brand-pink"
              placeholder={t('auth.passwordPlaceholder')}
            />
          </label>

          <CTAButton disabled={isSubmitting} type="submit" variant="primary" className="min-h-12">
            {isSubmitting ? t('auth.submitting') : t('admin.loginCta')}
          </CTAButton>

          {status ? (
            <p className="rounded-lg border border-brand-pink/35 bg-brand-pink/10 px-3 py-2 text-sm text-[#b41563] dark:text-[#ff8ac0]">
              {status}
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
};
