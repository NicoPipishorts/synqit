import { isEventProvider, providerSchema } from '@synqit/shared';
import {
  CONNECT_SERVICES,
  LINK_SERVICES,
  MUSIC_SERVICES,
  ServiceChip,
  ServiceLogo,
  useToast,
} from '@synqit/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouterState } from '@tanstack/react-router';
import { RefreshCcw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useI18n } from '../../hooks/useI18n';
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
import { CTAButton, CTALink, CTAMobileIconLabel } from '../ui/cta';

type ProviderAction = 'connect' | 'refresh' | 'disconnect';

/** Names come from the shared catalogue so every surface agrees; marks come from ServiceLogo. */
const PROVIDER_META: Record<Provider, { label: string }> = Object.fromEntries(
  providerSchema.options.map((provider) => [provider, { label: MUSIC_SERVICES[provider].name }]),
) as Record<Provider, { label: string }>;

/**
 * Providers we actually offer a connect card for. The catalogue holds back any service whose
 * brand mark we do not have yet, so this can be shorter than `providerSchema.options`.
 */
const CONNECTABLE_PROVIDERS: Provider[] = providerSchema.options.filter((provider) =>
  CONNECT_SERVICES.some((service) => service.id === provider),
);

const snapshotFetchOptions = {
  queryKey: queryKeys.integrations.snapshot(),
  queryFn: fetchIntegrationsSnapshot,
} as const;

export const ProviderConnections = () => {
  const search = useRouterState({ select: (s) => s.location.searchStr });
  const { t, locale } = useI18n();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [busyProviders, setBusyProviders] = useState<Partial<Record<Provider, ProviderAction>>>({});

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const setBusy = useCallback((provider: Provider, action: ProviderAction) => {
    setBusyProviders((prev) => ({ ...prev, [provider]: action }));
  }, []);

  const clearBusy = useCallback((provider: Provider) => {
    setBusyProviders((prev) => {
      const next = { ...prev };
      delete next[provider];
      return next;
    });
  }, []);

  const refreshSnapshot = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all() }),
      queryClient.fetchQuery(snapshotFetchOptions),
    ]);
  }, [queryClient]);

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
    const raw = new URLSearchParams(search).get('redirectTo')?.trim();
    if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
    if (raw.startsWith('/auth/') || raw === '/profile/platforms') return null;
    return raw;
  }, [search]);

  const redirectAfterConnect = useCallback(() => {
    if (redirectTo) window.location.assign(redirectTo);
  }, [redirectTo]);

  // ---------------------------------------------------------------------------
  // Query
  // ---------------------------------------------------------------------------

  const snapshotQuery = useQuery({
    ...snapshotFetchOptions,
    staleTime: 0,
  });

  useEffect(() => {
    if (!snapshotQuery.data) return;
    trackAnalyticsEvent({
      eventName: 'providers_snapshot_loaded',
      target: 'providers',
      properties: {
        connectedCount: Object.values(snapshotQuery.data.byProvider).filter(
          (i) => i.status === 'connected',
        ).length,
        totalProviders: CONNECTABLE_PROVIDERS.length,
      },
    });
  }, [snapshotQuery.data]);

  const snapshot = snapshotQuery.data;

  // ---------------------------------------------------------------------------
  // Disconnect mutation
  // ---------------------------------------------------------------------------

  const disconnectMutation = useMutation({
    mutationFn: (provider: Provider) => disconnectProvider(provider),
    onMutate: (provider) => setBusy(provider, 'disconnect'),
    onSuccess: async (_data, provider) => {
      await refreshSnapshot();
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
    onSettled: (_data, _error, provider) => clearBusy(provider),
  });

  // ---------------------------------------------------------------------------
  // Connect / refresh action
  // ---------------------------------------------------------------------------

  const runConnectAction = useCallback(
    async (provider: Provider, action: 'connect' | 'refresh') => {
      setBusy(provider, action);
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
          popupResult = await openProviderOauthPopup({
            provider,
            nextPath: '/auth/provider-connected',
          });
        }

        const fresh = await refreshSnapshot().then(() =>
          queryClient.getQueryData<IntegrationsSnapshot>(snapshotFetchOptions.queryKey),
        );
        const isConnected =
          fresh?.byProvider[provider].status === 'connected' || popupResult === 'connected';

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
        const apiError = toApiError(error);
        showToast(t('profile.connectionsLoadError', { message: apiError.message }), {
          variant: 'error',
        });
        trackAnalyticsEvent({
          eventName: 'provider_connect_failed',
          target: 'providers',
          properties: { provider, action, code: apiError.code },
        });
      } finally {
        clearBusy(provider);
      }
    },
    [clearBusy, queryClient, redirectAfterConnect, refreshSnapshot, setBusy, showToast, t],
  );

  // ---------------------------------------------------------------------------
  // OAuth callback query params (written by the callback page)
  // ---------------------------------------------------------------------------

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
      void refreshSnapshot();
    }

    params.delete('provider');
    params.delete('status');
    const nextQuery = params.toString();
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`,
    );
  }, [queryClient, redirectAfterConnect, refreshSnapshot, showToast, t]);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const providerCards = useMemo(
    () =>
      CONNECTABLE_PROVIDERS.map((provider) => {
        const integration = snapshot?.byProvider[provider] ?? {
          status: 'not_connected' as const,
          connectedAt: null,
          expiresAt: null,
        };
        return {
          provider,
          meta: PROVIDER_META[provider],
          isConnected: integration.status === 'connected',
          isBusy: Boolean(busyProviders[provider]),
          connectedAt: formatDateTime(integration.connectedAt),
          expiresAt: formatDateTime(integration.expiresAt),
          // Only event-capable services can have events pointed at them.
          eventsLinked: isEventProvider(provider)
            ? (snapshot?.eventCountByProvider[provider] ?? 0)
            : 0,
        };
      }),
    [busyProviders, formatDateTime, snapshot],
  );

  const connectedCards = providerCards.filter((c) => c.isConnected);
  const isRefreshing = snapshotQuery.isFetching;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="grid gap-5">
      <article className="relative rounded-3xl border-2 border-app-text bg-app-elevated p-5 shadow-sticker dark:bg-app-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-brand-dark dark:text-brand-white">
            {t('profile.connectionsServicesTitle')}
          </h2>
          <CTAButton
            type="button"
            onClick={() => void refreshSnapshot()}
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
          {t('profile.connectionsServicesHint')}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {providerCards.map(({ provider, meta, isConnected, isBusy }) => (
            <button
              key={provider}
              type="button"
              disabled={isConnected || isBusy}
              onClick={() => {
                if (!isConnected) void runConnectAction(provider, 'connect');
              }}
              className={`grid min-w-38 gap-1 rounded-2xl border-2 border-app-text bg-app-elevated px-4 py-3 text-left shadow-sticker-sm transition motion-safe:hover:-translate-y-0.5 sm:min-w-40 dark:bg-app-card ${
                isConnected
                  ? 'cursor-default grayscale'
                  : 'cursor-pointer hover:border-brand-lime hover:shadow-glow-lime'
              } ${isBusy ? 'opacity-60' : ''}`}
            >
              <ServiceLogo service={provider} alt="" className="h-10 w-10 text-app-text" />
              <p className="text-sm font-semibold text-app-text">{meta.label}</p>
              <p className="text-xs text-app-text-secondary">
                {isConnected
                  ? t('profile.connectionConnectedTag')
                  : t('profile.connectionTapToConnect')}
              </p>
            </button>
          ))}
        </div>
      </article>

      {connectedCards.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {connectedCards.map(
            ({ provider, meta, isBusy, connectedAt, expiresAt, eventsLinked }) => (
              <article
                key={provider}
                className="relative flex flex-col rounded-3xl border-2 border-app-text bg-app-elevated p-5 shadow-sticker dark:bg-app-card"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <ServiceLogo service={provider} alt="" className="h-12 w-12 text-app-text" />
                    <h3 className="text-lg font-bold text-brand-dark dark:text-brand-white">
                      {meta.label}
                    </h3>
                  </div>
                  <span className="rounded-full border-2 border-app-text bg-brand-lime px-2.5 py-0.5 text-[11px] font-black uppercase tracking-[0.1em] text-brand-dark shadow-sticker-sm">
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
                    onClick={() => void runConnectAction(provider, 'refresh')}
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
                    onClick={() => disconnectMutation.mutate(provider)}
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

      {/* The two link-only services have no account to connect; say so here,
          where people come looking for a "connect Deezer" button. */}
      <article className="grid gap-4 rounded-3xl border-2 border-dashed border-app-border p-5 sm:p-6">
        <div className="flex flex-wrap gap-2">
          {LINK_SERVICES.map((service) => (
            <ServiceChip key={service.id} service={service.id} />
          ))}
        </div>
        <div className="grid gap-1">
          <h3 className="text-lg font-bold text-brand-dark dark:text-brand-white">
            {t('profile.linkSourcesTitle')}
          </h3>
          <p className="text-sm text-app-text-secondary">{t('profile.linkSourcesBody')}</p>
        </div>
        <div className="flex justify-end">
          <CTALink to="/transfer/link" variant="secondary">
            {t('profile.linkSourcesCta')}
          </CTALink>
        </div>
      </article>
    </div>
  );
};
