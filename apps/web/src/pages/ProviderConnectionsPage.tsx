import {
  integrationDisconnectResponseSchema,
  integrationListResponseSchema,
  oauthCallbackResponseSchema,
  oauthStartResponseSchema,
  providerSchema,
} from '@synqit/shared';
import { useCallback, useEffect, useState } from 'react';

import { callApi, toApiError } from '../lib/api';
import { getAccessToken } from '../lib/auth';
import {
  AppleDeveloperTokenResponse,
  ensureMusicKitInstance,
  loadMusicKitScript,
} from '../lib/musickit';
import { Provider } from '../lib/types';

export const ProviderConnectionsPage = () => {
  const [status, setStatus] = useState<string>('Not loaded.');
  const [selectedProvider, setSelectedProvider] = useState<Provider>('spotify');
  const [integrationStatusByProvider, setIntegrationStatusByProvider] = useState<
    Partial<Record<Provider, 'connected' | 'not_connected'>>
  >({});
  const [oauthState, setOauthState] = useState<string>('');
  const [authUrl, setAuthUrl] = useState<string>('');
  const [isMockMode, setIsMockMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadIntegrationStatus = useCallback(async () => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus('Login required to manage provider connections.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await callApi(
        '/v1/integrations',
        {
          method: 'GET',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (payload) => integrationListResponseSchema.parse(payload),
      );

      const nextStatusByProvider: Partial<Record<Provider, 'connected' | 'not_connected'>> = {};
      for (const provider of providerSchema.options) {
        const current = result.integrations.find((item) => item.provider === provider);
        nextStatusByProvider[provider] = current?.status ?? 'not_connected';
      }
      setIntegrationStatusByProvider(nextStatusByProvider);

      const selectedStatus = result.integrations.find((item) => item.provider === selectedProvider);
      if (!selectedStatus || selectedStatus.status === 'not_connected') {
        setStatus(`${selectedProvider} is not connected.`);
      } else {
        setStatus(
          `${selectedProvider} connected. Expires at: ${selectedStatus.expiresAt ?? 'unknown'}`,
        );
      }
    } catch (error) {
      const detailedMessage =
        error instanceof Error
          ? error.message
          : typeof error === 'object'
            ? JSON.stringify(error)
            : String(error);
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message} (${detailedMessage})`);
    } finally {
      setIsLoading(false);
    }
  }, [selectedProvider]);

  const connectAppleMusic = async () => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus('Login required to connect Apple Music.');
      return;
    }

    setIsLoading(true);
    setOauthState('');
    setAuthUrl('');
    setIsMockMode(false);
    try {
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

          throw new Error('Invalid Apple developer token response.');
        },
      );

      await loadMusicKitScript();
      const musicKit = await ensureMusicKitInstance({
        developerToken: tokenResponse.developerToken,
        appName: tokenResponse.musicKitIdentifier || 'synqit',
      });

      const musicUserToken = await musicKit.authorize();
      if (!musicUserToken) {
        throw new Error('Apple Music did not return a user token.');
      }

      const result = await callApi(
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
      setStatus(
        `${result.provider} connected at ${result.connectedAt}. Expires at: ${
          result.expiresAt ?? 'unknown'
        }`,
      );
      await loadIntegrationStatus();
    } catch (error) {
      const detailedMessage =
        error instanceof Error
          ? error.message
          : typeof error === 'object'
            ? JSON.stringify(error)
            : String(error);
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message} (${detailedMessage})`);
    } finally {
      setIsLoading(false);
    }
  };

  const startProviderConnect = async () => {
    if (selectedProvider === 'apple') {
      await connectAppleMusic();
      return;
    }

    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus('Login required to start provider connection.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await callApi(
        `/v1/auth/${selectedProvider}/start`,
        {
          method: 'GET',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (payload) => oauthStartResponseSchema.parse(payload),
      );

      setOauthState(result.state);
      setAuthUrl(result.authorizationUrl);
      const mockMode = result.authorizationUrl.includes(`/v1/auth/${selectedProvider}/callback?`);
      setIsMockMode(mockMode);
      setStatus(
        mockMode
          ? `${selectedProvider} connect started in mock mode. Use callback step to complete connection.`
          : `${selectedProvider} OAuth start created. Open authorization page, approve, then reload status.`,
      );
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const completeMockCallback = async () => {
    if (selectedProvider !== 'spotify') {
      setStatus('Mock callback is only used for Spotify fallback mode.');
      return;
    }

    if (!oauthState) {
      setStatus('Start OAuth first to generate state.');
      return;
    }

    setIsLoading(true);
    try {
      const query = new URLSearchParams({
        state: oauthState,
        code: 'demo-auth-code',
        response_mode: 'json',
      });
      const result = await callApi(
        `/v1/auth/${selectedProvider}/callback?${query.toString()}`,
        {
          method: 'GET',
        },
        (payload) => oauthCallbackResponseSchema.parse(payload),
      );
      setStatus(
        `${result.provider} connected at ${result.connectedAt}. Expires at: ${
          result.expiresAt ?? 'unknown'
        }`,
      );
      setOauthState('');
      await loadIntegrationStatus();
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const providerParam = params.get('provider');
    if (
      providerParam &&
      providerSchema.options.includes(providerParam as Provider) &&
      params.get('status') === 'connected'
    ) {
      setSelectedProvider(providerParam as Provider);
      setStatus(`${providerParam} OAuth completed. Loading latest connection state...`);
      void loadIntegrationStatus();
      params.delete('provider');
      params.delete('status');
      const nextQuery = params.toString();
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`,
      );
    }
  }, [loadIntegrationStatus]);

  const disconnectProvider = async () => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus('Login required to disconnect provider.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await callApi(
        `/v1/auth/${selectedProvider}/disconnect`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
        (payload) => integrationDisconnectResponseSchema.parse(payload),
      );
      setStatus(
        result.disconnected
          ? `${selectedProvider} disconnected.`
          : `${selectedProvider} was already disconnected.`,
      );
      await loadIntegrationStatus();
    } catch (error) {
      const apiError = toApiError(error);
      setStatus(`Error: ${apiError.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <h2>Provider Connections</h2>
      <label>
        Provider
        <select
          value={selectedProvider}
          onChange={(event) => {
            setSelectedProvider(event.target.value as Provider);
            setOauthState('');
            setAuthUrl('');
            setIsMockMode(false);
          }}
          style={{ marginLeft: '0.5rem' }}
        >
          {providerSchema.options.map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </select>
      </label>
      <p>{status}</p>
      <p>
        Status snapshot:{' '}
        {providerSchema.options
          .map((provider) => `${provider}: ${integrationStatusByProvider[provider] ?? 'unknown'}`)
          .join(' | ')}
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button disabled={isLoading} onClick={() => void loadIntegrationStatus()} type="button">
          {isLoading ? 'Loading...' : 'Load status'}
        </button>
        <button disabled={isLoading} onClick={() => void startProviderConnect()} type="button">
          {selectedProvider === 'apple' ? 'Connect Apple Music' : `Start ${selectedProvider} OAuth`}
        </button>
        {isMockMode && selectedProvider === 'spotify' ? (
          <button disabled={isLoading} onClick={() => void completeMockCallback()} type="button">
            Complete Callback (Mock)
          </button>
        ) : null}
        <button disabled={isLoading} onClick={() => void disconnectProvider()} type="button">
          Disconnect {selectedProvider}
        </button>
      </div>
      {authUrl ? (
        <p>
          {selectedProvider} authorize URL:{' '}
          <a href={authUrl} rel="noreferrer" target="_blank">
            Open authorization page
          </a>
        </p>
      ) : null}
      <p>Supported providers in v1: {providerSchema.options.join(', ')}</p>
    </div>
  );
};
