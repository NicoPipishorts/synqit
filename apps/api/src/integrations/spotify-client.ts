import { decryptToken, encryptToken } from './crypto';
import { refreshSpotifyAccessToken } from './spotify';
import { ProviderApiError } from './spotify-tracks';
import { integrationStore } from './store';

class IntegrationError extends Error {
  code:
    | 'provider_not_connected'
    | 'token_decrypt_failed'
    | 'provider_token_refresh_failed'
    | 'provider_refresh_token_decrypt_failed';

  constructor(params: {
    code:
      | 'provider_not_connected'
      | 'token_decrypt_failed'
      | 'provider_token_refresh_failed'
      | 'provider_refresh_token_decrypt_failed';
    message: string;
  }) {
    super(params.message);
    this.name = 'IntegrationError';
    this.code = params.code;
  }
}

export const withSpotifyAccessTokenRetry = async <T>(params: {
  userId: string;
  run: (accessToken: string) => Promise<T>;
}): Promise<{ result: T; accessToken: string; refreshed: boolean }> => {
  const integration = await integrationStore.findIntegration({
    userId: params.userId,
    provider: 'spotify',
  });
  if (!integration) {
    throw new IntegrationError({
      code: 'provider_not_connected',
      message: 'Host provider is not connected.',
    });
  }

  let initialAccessToken: string;
  try {
    initialAccessToken = decryptToken(integration.accessToken);
  } catch {
    throw new IntegrationError({
      code: 'token_decrypt_failed',
      message: 'Stored provider token could not be decrypted.',
    });
  }

  try {
    const result = await params.run(initialAccessToken);
    return {
      result,
      accessToken: initialAccessToken,
      refreshed: false,
    };
  } catch (error) {
    if (!(error instanceof ProviderApiError) || error.statusCode !== 401) {
      throw error;
    }

    let storedRefreshToken: string;
    try {
      storedRefreshToken = decryptToken(integration.refreshToken);
    } catch {
      throw new IntegrationError({
        code: 'provider_refresh_token_decrypt_failed',
        message: 'Stored provider refresh token could not be decrypted.',
      });
    }

    let refreshedTokens: Awaited<ReturnType<typeof refreshSpotifyAccessToken>>;
    try {
      refreshedTokens = await refreshSpotifyAccessToken(storedRefreshToken);
    } catch (refreshError) {
      const message =
        refreshError instanceof Error ? refreshError.message : 'Provider token refresh failed.';
      throw new IntegrationError({
        code: 'provider_token_refresh_failed',
        message,
      });
    }

    const nextRefreshToken = refreshedTokens.refreshToken ?? storedRefreshToken;
    await integrationStore.upsertIntegration({
      userId: integration.userId,
      provider: 'spotify',
      accessToken: encryptToken(refreshedTokens.accessToken),
      refreshToken: encryptToken(nextRefreshToken),
      scopes: refreshedTokens.scopes.length > 0 ? refreshedTokens.scopes : integration.scopes,
      expiresAt: refreshedTokens.expiresAt,
    });

    const retryResult = await params.run(refreshedTokens.accessToken);
    return {
      result: retryResult,
      accessToken: refreshedTokens.accessToken,
      refreshed: true,
    };
  }
};

export { IntegrationError };
