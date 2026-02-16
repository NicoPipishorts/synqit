import { eventListResponseSchema } from '@synqit/shared';
import { RefreshCcw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { HostEventCard } from '../components/events/HostEventCard';
import { CTAButton, CTALink } from '../components/ui/cta';
import { useI18n } from '../hooks/useI18n';
import { useToast } from '../hooks/useToast';
import { callApi, toApiError } from '../lib/api';
import { getAccessToken } from '../lib/auth';
import { getPublicEventUrl, HostEvent } from '../lib/events';

export const HostEventsPage = () => {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [events, setEvents] = useState<HostEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const setStatusAndToast = useCallback(
    (message: string, variant: 'success' | 'error' | 'info' = 'info') => {
      showToast(message, { variant });
    },
    [showToast],
  );

  const requireAccessToken = useCallback(
    (message: string): string | null => {
      const accessToken = getAccessToken();
      if (!accessToken) {
        setStatusAndToast(message, 'error');
        return null;
      }
      return accessToken;
    },
    [setStatusAndToast],
  );

  const loadEvents = useCallback(async () => {
    const accessToken = requireAccessToken(t('eventsPage.loginRequiredLoad'));
    if (!accessToken) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await callApi(
        '/v1/events',
        {
          method: 'GET',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (payload) => eventListResponseSchema.parse(payload),
      );

      setEvents(
        result.events.map((event) => ({
          id: event.id,
          name: event.name,
          description: event.description,
          provider: event.provider,
          status: event.status,
          magicLinkToken: event.magicLinkToken,
          magicLinkRevokedAt: event.magicLinkRevokedAt,
          updatedAt: event.updatedAt,
        })),
      );
    } catch (error) {
      const apiError = toApiError(error);
      setStatusAndToast(t('eventsPage.error', { message: apiError.message }), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [requireAccessToken, setStatusAndToast, t]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const copyMagicLink = async (magicLinkToken: string) => {
    const eventUrl = getPublicEventUrl(magicLinkToken);

    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      setStatusAndToast(t('eventsPage.copyFailed'), 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(eventUrl);
      setStatusAndToast(t('eventsPage.copySuccess'), 'success');
    } catch {
      setStatusAndToast(t('eventsPage.copyFailed'), 'error');
    }
  };

  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8">
      <div className="relative grid gap-6">
        <article>
          <div className="grid px-5 py-7 sm:px-8 sm:py-9">
            <div className="grid gap-1">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-2xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl">
                  {t('eventsPage.title')}
                </h1>
                <CTAButton
                  aria-label={t('eventsPage.refresh')}
                  disabled={isLoading}
                  onClick={() => void loadEvents()}
                  variant="secondary"
                  className="h-10 w-10 px-0 sm:h-auto sm:w-auto sm:px-3"
                >
                  <RefreshCcw
                    size={14}
                    aria-hidden="true"
                    className={`${isLoading ? 'animate-spin' : ''} sm:hidden`}
                  />
                  <span className="hidden sm:inline">
                    {isLoading ? t('eventsPage.loading') : t('eventsPage.refresh')}
                  </span>
                </CTAButton>
              </div>
              <p className="text-sm text-app-text-secondary sm:text-base">
                {t('eventsPage.description')}
              </p>
            </div>
          </div>
          <div className="py-4 justify-center flex">
            <CTALink
              to="/events/new"
              variant="primary"
              className="w-[90%] justify-center px-4 py-3 text-sm font-black sm:text-base"
            >
              {t('eventsPage.create')}
            </CTALink>
          </div>
        </article>

        {events.length === 0 ? (
          <article className="rounded-2xl border border-app-border bg-app-elevated p-6 text-center shadow-soft-lift dark:bg-app-card">
            <p className="text-base font-semibold text-brand-dark dark:text-brand-white">
              {t('eventsPage.emptyTitle')}
            </p>
            <p className="mt-2 text-sm text-app-text-secondary">{t('eventsPage.emptyBody')}</p>
            <div className="mt-4 flex justify-center">
              <CTALink to="/events/new" variant="primary">
                {t('eventsPage.create')}
              </CTALink>
            </div>
          </article>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {events.map((event) => (
              <HostEventCard
                key={event.id}
                event={event}
                onCopyMagicLink={(magicLinkToken) => void copyMagicLink(magicLinkToken)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
