import type { Provider } from '@synqit/shared';

import { ProviderApiError } from './spotify-tracks';
import { isYoutubeQuotaError, YOUTUBE_QUOTA_MESSAGE } from './youtube-api';

// Kept local rather than read from the registry so this module stays free of
// provider clients. Exhaustive: a new Provider fails to compile until named.
const PROVIDER_LABELS: Record<Provider, string> = {
  spotify: 'Spotify',
  apple: 'Apple Music',
  tidal: 'TIDAL',
  youtube: 'YouTube Music',
};

type ProviderMappedError = {
  code: string;
  message: string;
};

const getDefaultMappedError = (error: ProviderApiError): ProviderMappedError | null => {
  const providerLabel = PROVIDER_LABELS[error.provider];

  if (isYoutubeQuotaError(error)) {
    return {
      code: 'provider_quota_exceeded',
      message: YOUTUBE_QUOTA_MESSAGE,
    };
  }

  if (error.statusCode === 401) {
    return {
      code: 'provider_token_invalid',
      message: `${providerLabel} authorization failed for this request. Reconnect ${providerLabel} and try again.`,
    };
  }

  if (error.statusCode === 403) {
    return {
      code: 'provider_forbidden',
      message: `${providerLabel} denied this operation for the connected account.`,
    };
  }

  if (error.statusCode === 404) {
    return {
      code: 'provider_resource_not_found',
      message: `${providerLabel} resource was not found.`,
    };
  }

  return null;
};

export const mapProviderApiError = (
  error: ProviderApiError,
  overrides?: Partial<Record<number, ProviderMappedError>>,
): ProviderMappedError => {
  const mapped = overrides?.[error.statusCode] ?? getDefaultMappedError(error);
  if (mapped) {
    return mapped;
  }

  return {
    code: 'provider_api_error',
    message: error.message,
  };
};
