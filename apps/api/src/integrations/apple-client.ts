import { getAppleDeveloperToken, isAppleLiveMode } from './apple';
import { decryptToken } from './crypto';
import { IntegrationError } from './spotify-client';
import { ProviderApiError } from './spotify-tracks';
import { integrationStore } from './store';

export const withAppleMusicUserToken = async <T>(params: {
  userId: string;
  run: (context: { developerToken: string; musicUserToken: string }) => Promise<T>;
}): Promise<T> => {
  if (!isAppleLiveMode()) {
    throw new IntegrationError({
      code: 'provider_auth_not_configured',
      message:
        'Apple Music auth is not configured. Set APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_MUSICKIT_IDENTIFIER, and APPLE_PRIVATE_KEY_P8.',
    });
  }

  const integration = await integrationStore.findIntegration({
    userId: params.userId,
    provider: 'apple',
  });
  if (!integration) {
    throw new IntegrationError({
      code: 'provider_not_connected',
      message: 'Host provider is not connected.',
    });
  }

  let musicUserToken: string;
  try {
    musicUserToken = decryptToken(integration.accessToken);
  } catch {
    throw new IntegrationError({
      code: 'token_decrypt_failed',
      message: 'Stored provider token could not be decrypted.',
    });
  }

  const getDeveloperTokenOrThrow = async (forceRefresh?: boolean): Promise<string> => {
    try {
      return await getAppleDeveloperToken({
        forceRefresh,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Apple developer token generation failed.';
      throw new IntegrationError({
        code: 'provider_auth_not_configured',
        message,
      });
    }
  };

  const initialDeveloperToken = await getDeveloperTokenOrThrow(false);

  try {
    return await params.run({
      developerToken: initialDeveloperToken,
      musicUserToken,
    });
  } catch (error) {
    if (!(error instanceof ProviderApiError) || error.statusCode !== 401) {
      throw error;
    }

    const refreshedDeveloperToken = await getDeveloperTokenOrThrow(true);
    return params.run({
      developerToken: refreshedDeveloperToken,
      musicUserToken,
    });
  }
};
