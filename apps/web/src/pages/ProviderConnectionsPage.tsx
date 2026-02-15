import {
  eventListResponseSchema,
  integrationDisconnectResponseSchema,
  integrationListResponseSchema,
  oauthCallbackResponseSchema,
  oauthStartResponseSchema,
  providerSchema,
} from '@synqit/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ctaClassName } from '../components/ui/cta';
import { useI18n } from '../hooks/useI18n';
import { useToast } from '../hooks/useToast';
import { callApi, toApiError } from '../lib/api';
import { getAccessToken } from '../lib/auth';
import {
  AppleDeveloperTokenResponse,
  ensureMusicKitInstance,
  loadMusicKitScript,
} from '../lib/musickit';
import { Provider } from '../lib/types';

type ProviderIntegrationState = {
  status: 'connected' | 'not_connected';
  connectedAt: string | null;
  expiresAt: string | null;
};

type ProviderAction = 'connect' | 'refresh' | 'disconnect';

const PROVIDER_META: Record<Provider, { label: string; iconPath: string }> = {
  spotify: {
    label: 'Spotify',
    iconPath: '/assets/logos/Providers/Spotify.png',
  },
  apple: {
    label: 'Apple Music',
    iconPath: '/assets/logos/Providers/AppleMusic.png',
  },
};

const createInitialIntegrationMap = (): Record<Provider, ProviderIntegrationState> => {
  return {
    spotify: {
      status: 'not_connected',
      connectedAt: null,
      expiresAt: null,
    },
    apple: {
      status: 'not_connected',
      connectedAt: null,
      expiresAt: null,
    },
  };
};

const createInitialEventCountMap = (): Record<Provider, number> => {
  return {
    spotify: 0,
    apple: 0,
  };
};

export const ProviderConnectionsPage = () => {
  const { t, locale } = useI18n();
  const { showToast } = useToast();
  const [integrationByProvider, setIntegrationByProvider] = useState<
    Record<Provider, ProviderIntegrationState>
  >(() => createInitialIntegrationMap());
  const [eventCountByProvider, setEventCountByProvider] = useState<Record<Provider, number>>(() =>
    createInitialEventCountMap(),
  );
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);
  const [activeActionByProvider, setActiveActionByProvider] = useState<
    Partial<Record<Provider, ProviderAction>>
  >({});

  const formatDateTime = useCallback(
    (value: string | null): string | null => {
      if (!value) {
        return null;
      }

      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return null;
      }

      return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
    },
    [locale],
  );

  const loadSnapshot = useCallback(async () => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      return;
    }

    setIsLoadingSnapshot(true);
    try {
      const [integrationResult, eventResult] = await Promise.all([
        callApi(
          '/v1/integrations',
          {
            method: 'GET',
            headers: {
              authorization: `Bearer ${accessToken}`,
            },
          },
          (payload) => integrationListResponseSchema.parse(payload),
        ),
        callApi(
          '/v1/events',
          {
            method: 'GET',
            headers: {
              authorization: `Bearer ${accessToken}`,
            },
          },
          (payload) => eventListResponseSchema.parse(payload),
        ),
      ]);

      const nextIntegrationByProvider = createInitialIntegrationMap();
      for (const provider of providerSchema.options) {
        const integration = integrationResult.integrations.find(
          (item) => item.provider === provider,
        );
        nextIntegrationByProvider[provider] = {
          status: integration?.status ?? 'not_connected',
          connectedAt: integration?.connectedAt ?? null,
          expiresAt: integration?.expiresAt ?? null,
        };
      }

      const nextEventCountByProvider = createInitialEventCountMap();
      for (const event of eventResult.events) {
        nextEventCountByProvider[event.provider] += 1;
      }

      setIntegrationByProvider(nextIntegrationByProvider);
      setEventCountByProvider(nextEventCountByProvider);
    } catch (error) {
      const apiError = toApiError(error);
      showToast(t('profile.connectionsLoadError', { message: apiError.message }), {
        variant: 'error',
      });
    } finally {
      setIsLoadingSnapshot(false);
    }
  }, [showToast, t]);

  const connectAppleMusic = useCallback(async () => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      throw new Error('missing_access_token');
    }

    const tokenResponse = await callApi(
      '/v1/auth/apple/developer-token',
      {
        method: 'GET',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      },
      (payload) => {
        const value = payload as Partial<AppleDeveloperTokenResponse>;
        if (
          value &&
          value.provider === 'apple' &&
          typeof value.developerToken === 'string' &&
          typeof value.musicKitIdentifier === 'string'
        ) {
          return value as AppleDeveloperTokenResponse;
        }

        throw new Error('invalid_apple_developer_token_response');
      },
    );

    await loadMusicKitScript();
    const musicKit = await ensureMusicKitInstance({
      developerToken: tokenResponse.developerToken,
      appName: tokenResponse.musicKitIdentifier || 'synqit',
    });

    const musicUserToken = await musicKit.authorize();
    if (!musicUserToken) {
      throw new Error('apple_music_user_token_missing');
    }

    await callApi(
      '/v1/auth/apple/connect',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          musicUserToken,
        }),
      },
      (payload) => oauthCallbackResponseSchema.parse(payload),
    );
  }, []);

  const startSpotifyOauth = useCallback(async () => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      throw new Error('missing_access_token');
    }

    const result = await callApi(
      '/v1/auth/spotify/start',
      {
        method: 'GET',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      },
      (payload) => oauthStartResponseSchema.parse(payload),
    );

    window.location.assign(result.authorizationUrl);
  }, []);

  const runProviderAction = useCallback(
    async (provider: Provider, action: ProviderAction) => {
      const accessToken = getAccessToken();
      if (!accessToken) {
        showToast(t('profile.notLoggedIn'), { variant: 'error' });
        return;
      }

      setActiveActionByProvider((current) => ({
        ...current,
        [provider]: action,
      }));

      try {
        if (action === 'disconnect') {
          await callApi(
            `/v1/auth/${provider}/disconnect`,
            {
              method: 'POST',
              headers: {
                authorization: `Bearer ${accessToken}`,
              },
            },
            (payload) => integrationDisconnectResponseSchema.parse(payload),
          );
          showToast(
            t('profile.connectionRemoved', {
              provider: PROVIDER_META[provider].label,
            }),
            { variant: 'success' },
          );
          await loadSnapshot();
          return;
        }

        if (provider === 'apple') {
          await connectAppleMusic();
          showToast(
            t('profile.connectionConnected', {
              provider: PROVIDER_META[provider].label,
            }),
            { variant: 'success' },
          );
          await loadSnapshot();
          return;
        }

        await startSpotifyOauth();
      } catch (error) {
        const normalized = error as { message?: string };
        if (normalized.message === 'missing_access_token') {
          showToast(t('profile.notLoggedIn'), { variant: 'error' });
        } else {
          const apiError = toApiError(error);
          showToast(t('profile.connectionsLoadError', { message: apiError.message }), {
            variant: 'error',
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
    [connectAppleMusic, loadSnapshot, showToast, startSpotifyOauth, t],
  );

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const providerParam = params.get('provider');
    const status = params.get('status');
    if (!providerParam || !status) {
      return;
    }

    if (providerSchema.options.includes(providerParam as Provider)) {
      const providerLabel = PROVIDER_META[providerParam as Provider].label;
      if (status === 'connected') {
        showToast(t('profile.connectionConnected', { provider: providerLabel }), {
          variant: 'success',
        });
      } else {
        showToast(t('profile.connectionFailed', { provider: providerLabel }), {
          variant: 'error',
        });
      }
      void loadSnapshot();
    }

    params.delete('provider');
    params.delete('status');
    const nextQuery = params.toString();
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`,
    );
  }, [loadSnapshot, showToast, t]);

  const providerCards = useMemo(() => {
    return providerSchema.options.map((provider) => {
      const integration = integrationByProvider[provider];
      const isConnected = integration.status === 'connected';
      const isBusy = Boolean(activeActionByProvider[provider]);
      const connectedAt = formatDateTime(integration.connectedAt);
      const expiresAt = formatDateTime(integration.expiresAt);
      const eventsLinked = eventCountByProvider[provider] ?? 0;
      const providerMeta = PROVIDER_META[provider];

      return {
        provider,
        providerMeta,
        isConnected,
        isBusy,
        connectedAt,
        expiresAt,
        eventsLinked,
      };
    });
  }, [activeActionByProvider, eventCountByProvider, formatDateTime, integrationByProvider]);

  const connectedProviderCards = useMemo(() => {
    return providerCards.filter((card) => card.isConnected);
  }, [providerCards]);

  return (
    <div className="grid gap-5">
      <article className="rounded-2xl border border-app-border bg-app-bg p-5 shadow-soft-lift dark:bg-app-elevated">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-brand-dark dark:text-brand-white">
            {t('profile.connectionsServicesTitle')}
          </h2>
          <button
            type="button"
            onClick={() => void loadSnapshot()}
            disabled={isLoadingSnapshot}
            className={ctaClassName('secondary')}
          >
            {isLoadingSnapshot ? t('dashboard.loading') : t('profile.connectionsReload')}
          </button>
        </div>
        <p className="mt-2 text-sm text-app-text-secondary">
          {t('profile.connectionsServicesHint')}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {providerCards.map(({ provider, providerMeta, isConnected, isBusy }) => (
            <button
              key={provider}
              type="button"
              disabled={isConnected || isBusy}
              onClick={() => {
                if (!isConnected) {
                  void runProviderAction(provider, 'connect');
                }
              }}
              className={`grid min-w-28 gap-1 rounded-xl border border-app-border bg-app-elevated px-4 py-3 text-left shadow-soft-lift transition dark:bg-app-card ${
                isConnected
                  ? 'cursor-default grayscale'
                  : 'hover:border-brand-lime hover:shadow-glow-lime'
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
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void runProviderAction(provider, 'refresh')}
                    className={ctaClassName('secondary')}
                  >
                    {t('profile.connectionRefresh')}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void runProviderAction(provider, 'disconnect')}
                    className={ctaClassName('dangerSoft')}
                  >
                    {t('profile.connectionRemove')}
                  </button>
                </div>
              </article>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
};
