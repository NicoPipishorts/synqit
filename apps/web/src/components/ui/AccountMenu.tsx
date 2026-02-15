import { refreshTokenRequestSchema } from '@synqit/shared';
import { Link } from '@tanstack/react-router';
import { UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { HeroCtaLink } from './HeroCtaLink';
import { useAuthSession } from '../../hooks/useAuthSession';
import { useI18n } from '../../hooks/useI18n';
import { useProfileSettings } from '../../hooks/useProfileSettings';
import { callApi } from '../../lib/api';
import { clearAuth, getInitials } from '../../lib/auth';

export const AccountMenu = () => {
  const { auth, setAuth } = useAuthSession();
  const { t } = useI18n();
  const { settings } = useProfileSettings();
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
        aria-label={t('accountMenu.ariaOpen')}
      >
        {(auth?.avatarUrl ?? settings.avatarDataUrl) ? (
          <img
            src={auth?.avatarUrl ?? settings.avatarDataUrl ?? undefined}
            alt={t('accountMenu.avatarAlt')}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : auth ? (
          getInitials(auth.userEmail)
        ) : (
          <UserRound size={20} aria-hidden="true" />
        )}
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
                  to="/profile"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg px-2 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  {t('accountMenu.profile')}
                </Link>
                <Link
                  to="/dashboard"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg px-2 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  {t('accountMenu.dashboard')}
                </Link>
                <Link
                  to="/events"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg px-2 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  {t('accountMenu.myEvents')}
                </Link>
                <Link
                  to="/events/new"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg px-2 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  {t('accountMenu.createEvent')}
                </Link>
                <button
                  type="button"
                  onClick={() => void logout()}
                  disabled={isBusy}
                  className="mt-1 rounded-lg bg-brand-dark px-3 py-2 text-left text-brand-white transition hover:bg-[#111111] disabled:opacity-60 dark:bg-brand-white dark:text-brand-dark"
                >
                  {isBusy ? t('accountMenu.loggingOut') : t('accountMenu.logout')}
                </button>
              </div>
            </>
          ) : (
            <div className="grid gap-2 text-sm">
              <p className="text-neutral-600 dark:text-neutral-300">
                {t('accountMenu.accountAccess')}
              </p>
              <HeroCtaLink
                to="/auth/login"
                variant="lime"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="text-center"
              >
                {t('accountMenu.login')}
              </HeroCtaLink>
              <Link
                to="/auth/register"
                onClick={() => setIsOpen(false)}
                className="rounded-lg border border-app-border px-3 py-2 transition hover:border-brand-lime dark:border-app-border"
              >
                {t('accountMenu.createAccount')}
              </Link>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
