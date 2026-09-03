import { Link } from '@tanstack/react-router';
import { UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { CTAButton, CTALink } from './cta';
import { HeroCtaLink } from './HeroCtaLink';
import { NotificationDot } from './NotificationDot';
import { useAuthSession } from '../../hooks/useAuthSession';
import { useI18n } from '../../hooks/useI18n';
import { useProfileCompletion } from '../../hooks/useProfileCompletion';
import { useProfileSettings } from '../../hooks/useProfileSettings';
import { trackAnalyticsEvent } from '../../lib/analytics';
import { callApi } from '../../lib/api';
import { clearAuth, getInitials } from '../../lib/auth';

export const AccountMenu = () => {
  const { auth, setAuth } = useAuthSession();
  const { t } = useI18n();
  const { settings } = useProfileSettings();
  const { showPersonalInfoPrompt } = useProfileCompletion(auth);
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
      setIsOpen(false);
      redirectToLogin();
      return;
    }

    setIsBusy(true);
    trackAnalyticsEvent({
      eventName: 'auth_logout',
      target: 'auth',
    });
    try {
      await callApi(
        '/v1/auth/logout',
        {
          method: 'POST',
        },
        (payload) => payload,
      ).catch(() => undefined);
    } finally {
      clearAuth();
      setAuth(null);
      setIsOpen(false);
      setIsBusy(false);
      redirectToLogin();
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((previousValue) => !previousValue)}
        className="relative flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border border-app-border bg-app-elevated text-sm font-bold text-brand-dark shadow-soft-lift transition hover:border-brand-pink dark:border-app-border dark:bg-app-elevated dark:text-brand-white dark:shadow-glow-pink sm:h-16 sm:w-16 lg:h-[4.5rem] lg:w-[4.5rem]"
        aria-label={t('accountMenu.ariaOpen')}
      >
        {(auth?.avatarUrl ?? settings.avatarDataUrl) ? (
          <img
            src={auth?.avatarUrl ?? settings.avatarDataUrl ?? undefined}
            alt={t('accountMenu.avatarAlt')}
            className="h-12 w-12 rounded-full object-cover sm:h-14 sm:w-14 lg:h-16 lg:w-16"
          />
        ) : auth ? (
          getInitials(auth.userEmail)
        ) : (
          <UserRound size={20} aria-hidden="true" />
        )}
        {showPersonalInfoPrompt ? (
          <>
            <NotificationDot className="absolute right-1 top-1 h-3.5 w-3.5 sm:right-1.5 sm:top-1.5" />
            <span className="sr-only">{t('profile.personalInfoIncompleteBadge')}</span>
          </>
        ) : null}
      </button>
      {isOpen ? (
        <div className="absolute right-0 z-30 mt-2 w-64 rounded-2xl border border-app-border bg-app-elevated p-3 shadow-xl dark:border-app-border dark:bg-app-card">
          {auth ? (
            <>
              <div className="mt-2 grid gap-1 text-sm">
                <Link
                  to="/dashboard"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg px-2 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  {t('accountMenu.dashboard')}
                </Link>
                <Link
                  to="/playlists"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg px-2 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  {t('accountMenu.myEvents')}
                </Link>
                <Link
                  to="/synced-lists"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg px-2 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  {t('accountMenu.syncedLists')}
                </Link>
                <Link
                  to="/profile"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <span>{t('accountMenu.profile')}</span>
                  {showPersonalInfoPrompt ? (
                    <span className="inline-flex items-center gap-2">
                      <NotificationDot className="h-2.5 w-2.5 ring-0" />
                      <span className="sr-only">{t('profile.personalInfoIncompleteBadge')}</span>
                    </span>
                  ) : null}
                </Link>
                <CTAButton
                  type="button"
                  onClick={() => void logout()}
                  disabled={isBusy}
                  variant="danger"
                  className="mt-1 w-full justify-start"
                >
                  {isBusy ? t('accountMenu.loggingOut') : t('accountMenu.logout')}
                </CTAButton>
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
              <CTALink to="/auth/register" variant="secondary" onClick={() => setIsOpen(false)}>
                {t('accountMenu.createAccount')}
              </CTALink>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
