import { decryptToken, encryptToken } from './crypto';
import { ProviderApiError } from './provider-api-error';
import { IntegrationError } from './spotify-client';
import { integrationStore } from './store';
import { isYoutubeOauthLiveMode, refreshYoutubeAccessToken } from './youtube';

/**
 * Runs a YouTube Data API call with the user's stored access token, refreshing
 * once on a 401 and persisting the renewed token. Mirrors
 * `withSpotifyAccessTokenRetry`; Google tokens last an hour, so the refresh
 * path is the common case rather than the exception.
 */
export const withYoutubeAccessTokenRetry = async <T>(params: {
  userId: string;
  run: (accessToken: string) => Promise<T>;
}): Promise<{ result: T; accessToken: string; refreshed: boolean }> => {
  if (!isYoutubeOauthLiveMode()) {
    throw new IntegrationError({
      code: 'provider_auth_not_configured',
      message:
        'YouTube Music auth is not configured. Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET.',
    });
  }

  const integration = await integrationStore.findIntegration({
    userId: params.userId,
    provider: 'youtube',
  });
  if (!integration) {
    throw new IntegrationError({
      code: 'provider_not_connected',
      message: 'Host provider is not connected.',
    });
  }

  let accessToken: string;
  try {
    accessToken = decryptToken(integration.accessToken);
  } catch {
    throw new IntegrationError({
      code: 'token_decrypt_failed',
      message: 'Stored provider token could not be decrypted.',
    });
  }

  try {
    const result = await params.run(accessToken);
    return { result, accessToken, refreshed: false };
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

    let refreshed: Awaited<ReturnType<typeof refreshYoutubeAccessToken>>;
    try {
      refreshed = await refreshYoutubeAccessToken(storedRefreshToken);
    } catch (refreshError) {
      throw new IntegrationError({
        code: 'provider_token_refresh_failed',
        message:
          refreshError instanceof Error ? refreshError.message : 'Provider token refresh failed.',
      });
    }

    await integrationStore.upsertIntegration({
      userId: integration.userId,
      provider: 'youtube',
      accessToken: encryptToken(refreshed.accessToken),
      refreshToken: encryptToken(refreshed.refreshToken ?? storedRefreshToken),
      scopes: refreshed.scopes.length > 0 ? refreshed.scopes : integration.scopes,
      expiresAt: refreshed.expiresAt,
    });

    const retryResult = await params.run(refreshed.accessToken);
    return { result: retryResult, accessToken: refreshed.accessToken, refreshed: true };
  }
};
