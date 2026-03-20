import { providerSchema } from '@synqit/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouterState } from '@tanstack/react-router';
import { RefreshCcw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useI18n } from '../../hooks/useI18n';
import { useToast } from '../../hooks/useToast';
import { trackAnalyticsEvent } from '../../lib/analytics';
import { toApiError } from '../../lib/api';
import { connectAppleMusic } from '../../lib/appleMusic';
import { openProviderOauthPopup, ProviderOauthPopupResult } from '../../lib/providerOauthPopup';
import {
  disconnectProvider,
  fetchIntegrationsSnapshot,
  IntegrationsSnapshot,
  queryKeys,
} from '../../lib/queries';
import { Provider } from '../../lib/types';
import { CTAButton, CTAMobileIconLabel } from '../ui/cta';

type ProviderAction = 'connect' | 'refresh' | 'disconnect';

const PROVIDER_META: Record<Provider, { label: string; iconPath: string }> = {
  spotify: { label: 'Spotify', iconPath: '/assets/logos/Providers/Spotify.png' },
  apple: { label: 'Apple Music', iconPath: '/assets/logos/Providers/AppleMusic.png' },
};

export const ProviderConnections = () => {
  const search = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const { t, locale } = useI18n();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [activeActionByProvider, setActiveActionByProvider] = useState<
    Partial<Record<Provider, ProviderAction>>
  >({});

  const formatDateTime = useCallback(
    (value: string | null): string | null => {
      if (!value) return null;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
    },
    [locale],
  );

  const redirectTo = useMemo(() => {
    const rawValue = new URLSearchParams(search).get('redirectTo')?.trim();
    if (!rawValue || !rawValue.startsWith('/') || rawValue.startsWith('//')) {
      return null;
    }
    if (rawValue.startsWith('/auth/') || rawValue === '/profile/platforms') {
      return null;
    }
    return rawValue;
  }, [search]);

  const redirectAfterConnect = useCallback(() => {
    if (!redirectTo || typeof window === 'undefined') {
      return;
    }
    window.location.assign(redirectTo);
  }, [redirectTo]);

  // ---------------------------------------------------------------------------
  // Query
  // ---------------------------------------------------------------------------

  const snapshotQuery = useQuery({
    queryKey: queryKeys.integrations.list(),
    queryFn: fetchIntegrationsSnapshot,
    staleTime: 60_000,
    select: (data): IntegrationsSnapshot => {
      trackAnalyticsEvent({
        eventName: 'providers_snapshot_loaded',
        target: 'providers',
        properties: {
          connectedCount: Object.values(data.byProvider).filter((i) => i.status === 'connected')
            .length,
          totalProviders: providerSchema.options.length,
        },
      });
      return data;
    },
  });

  const integrationByProvider = useMemo(
    () =>
      snapshotQuery.data?.byProvider ?? {
        spotify: { status: 'not_connected', connectedAt: null, expiresAt: null },
        apple: { status: 'not_connected', connectedAt: null, expiresAt: null },
      },
    [snapshotQuery.data],
  );
  const eventCountByProvider = useMemo(
    () =>
      snapshotQuery.data?.eventCountByProvider ?? {
        spotify: 0,
        apple: 0,
      },
    [snapshotQuery.data],
  );

  // ---------------------------------------------------------------------------
  // Disconnect mutation
  // ---------------------------------------------------------------------------

  const disconnectMutation = useMutation({
    mutationFn: (provider: Provider) => disconnectProvider(provider),
    onSuccess: (_data, provider) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all() });
      showToast(t('profile.connectionRemoved', { provider: PROVIDER_META[provider].label }), {
        variant: 'success',
      });
      trackAnalyticsEvent({
        eventName: 'provider_disconnect_succeeded',
        target: 'providers',
        properties: { provider },
      });
    },
    onError: (error, provider) => {
      const apiError = toApiError(error);
      showToast(t('profile.connectionsLoadError', { message: apiError.message }), {
        variant: 'error',
      });
      trackAnalyticsEvent({
        eventName: 'provider_disconnect_failed',
        target: 'providers',
        properties: { provider, code: apiError.code },
      });
    },
    onSettled: (_data, _error, provider) => {
      setActiveActionByProvider((current) => {
        const next = { ...current };
        delete next[provider];
        return next;
      });
    },
  });

  // ---------------------------------------------------------------------------
  // Connect action (Apple Music + Spotify OAuth popup)
  // ---------------------------------------------------------------------------

  const runProviderAction = useCallback(
    async (provider: Provider, action: ProviderAction) => {
      setActiveActionByProvider((current) => ({ ...current, [provider]: action }));

      if (action === 'disconnect') {
        disconnectMutation.mutate(provider);
        return;
      }

      trackAnalyticsEvent({
        eventName: 'provider_connect_started',
        target: 'providers',
        properties: { provider, action },
      });

      try {
        let popupResult: ProviderOauthPopupResult | null = null;

        if (provider === 'apple') {
          await connectAppleMusic();
        } else {
          const token = (await import('../../lib/auth')).getAccessToken();
          if (!token) throw new Error('missing_access_token');
          popupResult = await openProviderOauthPopup({
            provider: 'spotify',
            accessToken: token,
            nextPath: '/auth/provider-connected',
          });
        }

        await queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all() });

        const snapshot = queryClient.getQueryData<IntegrationsSnapshot>(
          queryKeys.integrations.list(),
        );
        const isConnected =
          snapshot?.byProvider[provider].status === 'connected' || popupResult === 'connected';

        if (isConnected) {
          showToast(t('profile.connectionConnected', { provider: PROVIDER_META[provider].label }), {
            variant: 'success',
          });
          trackAnalyticsEvent({
            eventName: 'provider_connect_succeeded',
            target: 'providers',
            properties: { provider, action },
          });
          redirectAfterConnect();
        } else if (
          popupResult === 'blocked' ||
          popupResult === 'error' ||
          popupResult === 'timeout'
        ) {
          showToast(t('profile.connectionFailed', { provider: PROVIDER_META[provider].label }), {
            variant: 'error',
          });
          trackAnalyticsEvent({
            eventName: 'provider_connect_failed',
            target: 'providers',
            properties: { provider, action, popupResult },
          });
        }
      } catch (error) {
        const normalized = error as { message?: string };
        if (normalized.message === 'missing_access_token') {
          showToast(t('profile.notLoggedIn'), { variant: 'error' });
        } else {
          const apiError = toApiError(error);
          showToast(t('profile.connectionsLoadError', { message: apiError.message }), {
            variant: 'error',
          });
          trackAnalyticsEvent({
            eventName: 'provider_connect_failed',
            target: 'providers',
            properties: { provider, action, code: apiError.code },
          });
        }
      } finally {
        setActiveActionByProvider((current) => {
          const next = { ...current };
          delete next[provider];
          return next;
        });
      }
    },
    [disconnectMutation, queryClient, redirectAfterConnect, showToast, t],
  );

  // Handle provider/status query params written by the OAuth callback page
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const providerParam = params.get('provider');
    const status = params.get('status');
    if (!providerParam || !status) return;

    if (providerSchema.options.includes(providerParam as Provider)) {
      const providerLabel = PROVIDER_META[providerParam as Provider].label;
      if (status === 'connected') {
        showToast(t('profile.connectionConnected', { provider: providerLabel }), {
          variant: 'success',
        });
        redirectAfterConnect();
      } else {
        showToast(t('profile.connectionFailed', { provider: providerLabel }), {
          variant: 'error',
        });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all() });
    }

    params.delete('provider');
    params.delete('status');
    const nextQuery = params.toString();
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`,
    );
  }, [queryClient, redirectAfterConnect, showToast, t]);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const providerCards = useMemo(
    () =>
      providerSchema.options.map((provider) => {
        const integration = integrationByProvider[provider];
        return {
          provider,
          providerMeta: PROVIDER_META[provider],
          isConnected: integration.status === 'connected',
          isBusy: Boolean(activeActionByProvider[provider]),
          connectedAt: formatDateTime(integration.connectedAt),
          expiresAt: formatDateTime(integration.expiresAt),
          eventsLinked: eventCountByProvider[provider] ?? 0,
        };
      }),
    [activeActionByProvider, eventCountByProvider, formatDateTime, integrationByProvider],
  );

  const connectedProviderCards = useMemo(
    () => providerCards.filter((card) => card.isConnected),
    [providerCards],
  );

  const hasConnectedProvider = connectedProviderCards.length > 0;

  const isRefreshing = snapshotQuery.isFetching;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="grid gap-5">
      <article className="rounded-2xl border border-app-border bg-app-bg p-5 shadow-soft-lift dark:bg-app-elevated">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-brand-dark dark:text-brand-white">
            {t('profile.connectionsServicesTitle')}
          </h2>
          <CTAButton
            type="button"
            onClick={() =>
              void queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all() })
            }
            disabled={isRefreshing}
            variant="secondary"
            aria-label={t('profile.connectionsReload')}
          >
            <CTAMobileIconLabel
              icon={
                <RefreshCcw
                  size={14}
                  className={isRefreshing ? 'animate-spin' : ''}
                  aria-hidden="true"
                />
              }
              label={isRefreshing ? t('dashboard.loading') : t('profile.connectionsReload')}
            />
          </CTAButton>
        </div>
        <p className="mt-2 text-sm text-app-text-secondary">
          {hasConnectedProvider
            ? t('profile.connectionsServicesHintConnected')
            : t('profile.connectionsServicesHint')}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {providerCards
            .filter(({ isConnected }) => !hasConnectedProvider || isConnected)
            .map(({ provider, providerMeta, isConnected, isBusy }) => (
              <button
                key={provider}
                type="button"
                disabled={isConnected || isBusy}
                onClick={() => {
                  if (!isConnected) {
                    void runProviderAction(provider, 'connect');
                  }
                }}
                className={`grid min-w-38 sm:min-w-40 gap-1 rounded-xl border border-app-border bg-app-elevated px-4 py-3 text-left shadow-soft-lift transition dark:bg-app-card ${
                  isConnected
                    ? 'cursor-default grayscale'
                    : 'hover:border-brand-lime hover:shadow-glow-lime cursor-pointer'
                } ${isBusy ? 'opacity-60' : ''}`}
              >
                <img
                  src={providerMeta.iconPath}
                  alt={providerMeta.label}
                  className="h-10 w-10 rounded-full object-cover"
                />
                <p className="text-sm font-semibold text-app-text">{providerMeta.label}</p>
                <p className="text-xs text-app-text-secondary">
                  {isConnected
                    ? t('profile.connectionConnectedTag')
                    : t('profile.connectionTapToConnect')}
                </p>
              </button>
            ))}
        </div>
      </article>

      {connectedProviderCards.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {connectedProviderCards.map(
            ({ provider, providerMeta, isBusy, connectedAt, expiresAt, eventsLinked }) => (
              <article
                key={provider}
                className="flex flex-col rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={providerMeta.iconPath}
                      alt={providerMeta.label}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                    <h3 className="text-lg font-bold text-brand-dark dark:text-brand-white">
                      {providerMeta.label}
                    </h3>
                  </div>
                  <span className="rounded-full border border-brand-lime/40 bg-brand-lime/15 px-2.5 py-1 text-xs font-semibold text-[#6d9600] dark:text-[#d5ff5c]">
                    {t('profile.connectionConnectedTag')}
                  </span>
                </div>

                <div className="mt-3 grid gap-1 text-sm text-app-text-secondary">
                  <p>{t('profile.connectionsEventsLinked', { count: eventsLinked })}</p>
                  <p>
                    {connectedAt
                      ? t('profile.connectionLinkedAt', { date: connectedAt })
                      : t('profile.connectionLinkedAtEmpty')}
                  </p>
                  <p>
                    {expiresAt
                      ? t('profile.connectionExpiresAt', { date: expiresAt })
                      : t('profile.connectionExpiresAtEmpty')}
                  </p>
                </div>

                <div className="mt-auto flex flex-wrap justify-end gap-2 pt-4">
                  <CTAButton
                    type="button"
                    disabled={isBusy}
                    onClick={() => void runProviderAction(provider, 'refresh')}
                    variant="secondary"
                    aria-label={t('profile.connectionRefresh')}
                  >
                    <CTAMobileIconLabel
                      icon={<RefreshCcw size={14} aria-hidden="true" />}
                      label={t('profile.connectionRefresh')}
                    />
                  </CTAButton>
                  <CTAButton
                    type="button"
                    disabled={isBusy}
                    onClick={() => void runProviderAction(provider, 'disconnect')}
                    variant="dangerSoft"
                    aria-label={t('profile.connectionRemove')}
                  >
                    <CTAMobileIconLabel
                      icon={<Trash2 size={14} aria-hidden="true" />}
                      label={t('profile.connectionRemove')}
                    />
                  </CTAButton>
                </div>
              </article>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
};
