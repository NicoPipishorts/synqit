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
      void navigate({ to: '/admin/dashboard' });
    } catch (error) {
      setStatus(toApiError(error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-16 sm:px-6 lg:px-8">
      <form
        onSubmit={onSubmit}
        className="mx-auto grid w-full max-w-lg gap-5 rounded-3xl border border-app-border bg-app-elevated p-6 shadow-soft-lift dark:bg-app-card sm:p-8"
      >
        <div className="grid gap-1 text-center">
          <h1 className="text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white">
            {t('admin.loginTitle')}
          </h1>
          <p className="text-sm text-app-text-secondary">{t('admin.loginSubtitle')}</p>
        </div>

        <label className="grid gap-2 text-sm font-medium">
          <span>{t('auth.email')}</span>
          <input
            required
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-app-border bg-app-bg px-3 py-2.5 text-app-text outline-none transition focus:border-brand-lime"
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
            className="w-full rounded-xl border border-app-border bg-app-bg px-3 py-2.5 text-app-text outline-none transition focus:border-brand-pink"
            placeholder={t('auth.passwordPlaceholder')}
          />
        </label>

        <CTAButton disabled={isSubmitting} type="submit" variant="primary">
          {isSubmitting ? t('auth.submitting') : t('admin.loginCta')}
        </CTAButton>

        {status ? (
          <p className="rounded-lg border border-brand-pink/35 bg-brand-pink/10 px-3 py-2 text-sm text-[#b41563] dark:text-[#ff8ac0]">
            {status}
          </p>
        ) : null}
      </form>
    </section>
  );
};
