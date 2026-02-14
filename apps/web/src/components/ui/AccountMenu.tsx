import { refreshTokenRequestSchema } from '@synqit/shared';
import { Link } from '@tanstack/react-router';
import { UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { HeroCtaLink } from './HeroCtaLink';
import { useAuthSession } from '../../hooks/useAuthSession';
import { callApi } from '../../lib/api';
import { clearAuth, getInitials } from '../../lib/auth';

export const AccountMenu = () => {
  const { auth, setAuth } = useAuthSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current) {
        return;
      }
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const logout = async () => {
    if (!auth) {
      clearAuth();
      setIsOpen(false);
      return;
    }

    setIsBusy(true);
    try {
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
    } finally {
      clearAuth();
      setAuth(null);
      setIsOpen(false);
      setIsBusy(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((previousValue) => !previousValue)}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-app-border bg-app-elevated text-sm font-bold text-brand-dark shadow-soft-lift transition hover:border-brand-pink dark:border-app-border dark:bg-app-elevated dark:text-brand-white dark:shadow-glow-pink"
        aria-label="Open account menu"
      >
        {auth ? getInitials(auth.userEmail) : <UserRound size={20} aria-hidden="true" />}
      </button>
      {isOpen ? (
        <div className="absolute right-0 z-30 mt-2 w-64 rounded-2xl border border-app-border bg-app-elevated p-3 shadow-xl dark:border-app-border dark:bg-app-card">
          {auth ? (
            <>
              <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                {auth.userEmail}
              </p>
              <div className="mt-2 grid gap-1 text-sm">
                <Link
                  to="/dashboard"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg px-2 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Dashboard
                </Link>
                <Link
                  to="/providers"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg px-2 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Connections
                </Link>
                <Link
                  to="/events"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg px-2 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  My Events
                </Link>
                <Link
                  to="/events/new"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg px-2 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Create Event
                </Link>
                <button
                  type="button"
                  onClick={() => void logout()}
                  disabled={isBusy}
                  className="mt-1 rounded-lg bg-brand-dark px-3 py-2 text-left text-brand-white transition hover:bg-[#111111] disabled:opacity-60 dark:bg-brand-white dark:text-brand-dark"
                >
                  {isBusy ? 'Logging out...' : 'Logout'}
                </button>
              </div>
            </>
          ) : (
            <div className="grid gap-2 text-sm">
              <p className="text-neutral-600 dark:text-neutral-300">Account access</p>
              <HeroCtaLink
                to="/auth/login"
                variant="lime"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="text-center"
              >
                Login
              </HeroCtaLink>
              <Link
                to="/auth/register"
                onClick={() => setIsOpen(false)}
                className="rounded-lg border border-app-border px-3 py-2 transition hover:border-brand-lime dark:border-app-border"
              >
                Create account
              </Link>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
