import { Link, useNavigate } from '@tanstack/react-router';
import { FormEvent, useState } from 'react';

import { callApi, toApiError } from '../lib/api';
import { storeAuth } from '../lib/auth';

export const AuthForm = ({
  endpoint,
  title,
}: {
  endpoint: '/v1/auth/register' | '/v1/auth/login';
  title: string;
}) => {
  const navigate = useNavigate();
  const isLogin = endpoint === '/v1/auth/login';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'error' | 'success' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus(null);
    setStatusType(null);

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
      setStatus(`Authenticated as ${auth.userEmail}. Redirecting...`);
      setStatusType('success');
      void navigate({ to: '/dashboard' });
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(apiError.message);
      setStatusType('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="relative mx-auto flex min-h-[calc(100svh-7rem)] w-full max-w-4xl items-center px-4 py-8 sm:min-h-[calc(100svh-8rem)] sm:px-6 sm:py-12 lg:px-8 lg:py-16">
      <div className="pointer-events-none absolute -left-10 top-8 h-44 w-44 rounded-full bg-brand-lime/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-8 bottom-8 h-48 w-48 rounded-full bg-brand-pink/20 blur-3xl" />

      <div className="relative grid w-full gap-6">
        <div className="mx-auto grid w-full max-w-xl gap-2 text-center">
          <h1 className="text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-4xl">
            {isLogin ? 'Welcome back to Synqit.' : 'Create your Synqit host account.'}
          </h1>
          <p className="text-sm text-app-text-secondary sm:text-base">
            {isLogin
              ? 'Sign in to create events, manage guest links, and moderate live tracks.'
              : 'Register once, connect your provider, and launch your first collaborative event playlist.'}
          </p>
          <Link to="/" className="text-sm font-semibold text-brand-pink hover:text-[#d12074]">
            Back to product overview
          </Link>
        </div>

        <form
          onSubmit={onSubmit}
          className="mx-auto grid w-full max-w-xl gap-5 rounded-3xl border border-app-border bg-app-elevated p-6 shadow-soft-lift dark:bg-app-card sm:p-8"
        >
          <div className="grid gap-1 text-center sm:text-left">
            <h2 className="text-2xl font-bold text-brand-dark dark:text-brand-white">{title}</h2>
            <p className="text-sm text-app-text-secondary">
              {isLogin
                ? 'Use your host credentials to continue.'
                : 'Use a valid email and a secure password.'}
            </p>
          </div>

          <label className="grid gap-2 text-sm font-medium">
            <span>Email</span>
            <input
              required
              type="email"
              autoComplete={isLogin ? 'username' : 'email'}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-app-border bg-app-bg px-3 py-2.5 text-app-text outline-none transition focus:border-brand-lime"
              placeholder="you@example.com"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            <span>Password</span>
            <input
              required
              minLength={8}
              type="password"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-app-border bg-app-bg px-3 py-2.5 text-app-text outline-none transition focus:border-brand-pink"
              placeholder="At least 8 characters"
            />
          </label>

          <button
            disabled={isSubmitting}
            type="submit"
            className="rounded-xl bg-brand-lime px-4 py-2.5 text-sm font-semibold text-brand-dark shadow-soft-lift transition hover:bg-[#b2e600] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#aee000] dark:hover:bg-[#9fd100]"
          >
            {isSubmitting ? 'Submitting...' : title}
          </button>

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
            {isLogin ? 'No account yet?' : 'Already have an account?'}{' '}
            <Link
              to={isLogin ? '/auth/register' : '/auth/login'}
              className="font-semibold text-brand-pink hover:text-[#d12074]"
            >
              {isLogin ? 'Create one' : 'Login'}
            </Link>
          </p>
        </form>
      </div>
    </section>
  );
};
