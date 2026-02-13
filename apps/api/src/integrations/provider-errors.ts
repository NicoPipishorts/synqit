import { ProviderApiError } from './spotify-tracks';

type ProviderMappedError = {
  code: string;
  message: string;
};

const DEFAULT_PROVIDER_ERROR_BY_STATUS: Record<number, ProviderMappedError> = {
  401: {
    code: 'provider_token_invalid',
    message: 'Host Spotify session expired. Reconnect Spotify and try again.',
  },
  403: {
    code: 'provider_forbidden',
    message: 'Spotify denied this operation for the connected account.',
  },
  404: {
    code: 'provider_resource_not_found',
    message: 'Spotify resource was not found.',
  },
};

export const mapProviderApiError = (
  error: ProviderApiError,
  overrides?: Partial<Record<number, ProviderMappedError>>,
): ProviderMappedError => {
  const mapped =
    overrides?.[error.statusCode] ?? DEFAULT_PROVIDER_ERROR_BY_STATUS[error.statusCode];
  if (mapped) {
    return mapped;
  }

  return {
    code: 'provider_api_error',
    message: error.message,
  };
};
