import { ApiError, refreshResponseSchema } from '@synqit/shared';

import { clearAuth, loadAuth, updateStoredAuthTokens } from './auth';
import { API_URL } from './constants';
import { loadAnonymousPreferences } from './preferences';

export const toApiError = (value: unknown): ApiError => {
  if (value instanceof Error) {
    return {
      code: 'client_error',
      message: value.message,
    };
  }

  if (
    value &&
    typeof value === 'object' &&
    'code' in value &&
    typeof value.code === 'string' &&
    'message' in value &&
    typeof value.message === 'string'
  ) {
    return value as ApiError;
  }

  return {
    code: 'unknown_error',
    message: 'Unexpected error.',
  };
};

export const callApi = async <TResponse>(
  path: string,
  init: RequestInit,
  parser: (payload: unknown) => TResponse,
): Promise<TResponse> => {
  const hasBody = init.body !== undefined && init.body !== null;
  const buildHeaders = (overrideAccessToken?: string): Headers => {
    const headers = new Headers(init.headers ?? {});
    const preferredLocale = loadAnonymousPreferences().locale;
    if (hasBody && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
    if (preferredLocale && !headers.has('x-synqit-locale')) {
      headers.set('x-synqit-locale', preferredLocale);
    }
    if (overrideAccessToken) {
      headers.set('authorization', `Bearer ${overrideAccessToken}`);
    }
    return headers;
  };

  const execute = async (overrideAccessToken?: string) => {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: buildHeaders(overrideAccessToken),
    });
    const payload = (await response.json().catch(() => ({}))) as unknown;
    return { response, payload };
  };

  const shouldTryRefresh = (statusCode: number): boolean =>
    statusCode === 401 &&
    path !== '/v1/auth/login' &&
    path !== '/v1/auth/register' &&
    path !== '/v1/auth/refresh' &&
    path !== '/v1/admin/auth/login';

  const redirectToLoginIfNeeded = (): void => {
    if (typeof window === 'undefined') {
      return;
    }
    if (window.location.pathname.startsWith('/login')) {
      return;
    }
    window.location.assign('/login');
  };

  const refreshAccessToken = async (): Promise<string | null> => {
    if (refreshInFlightPromise) {
      return refreshInFlightPromise;
    }

    refreshInFlightPromise = (async () => {
      const currentAuth = loadAuth();
      if (!currentAuth) {
        return null;
      }

      try {
        const refreshResponse = await fetch(`${API_URL}/v1/auth/refresh`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            refreshToken: currentAuth.refreshToken,
          }),
        });
        const refreshPayload = (await refreshResponse.json().catch(() => ({}))) as unknown;
        if (!refreshResponse.ok) {
          return null;
        }

        const parsedRefresh = refreshResponseSchema.parse(refreshPayload);
        updateStoredAuthTokens({
          accessToken: parsedRefresh.tokens.accessToken,
          refreshToken: parsedRefresh.tokens.refreshToken,
        });

        return parsedRefresh.tokens.accessToken;
      } catch {
        return null;
      } finally {
        refreshInFlightPromise = null;
      }
    })();

    return refreshInFlightPromise;
  };

  const firstAttempt = await execute();
  if (firstAttempt.response.ok) {
    return parser(firstAttempt.payload);
  }

  if (shouldTryRefresh(firstAttempt.response.status)) {
    const refreshedAccessToken = await refreshAccessToken();
    if (refreshedAccessToken) {
      const retryAttempt = await execute(refreshedAccessToken);
      if (retryAttempt.response.ok) {
        return parser(retryAttempt.payload);
      }

      if (retryAttempt.response.status === 401) {
        clearAuth();
        redirectToLoginIfNeeded();
      }
      throw toApiError(retryAttempt.payload);
    }

    clearAuth();
    redirectToLoginIfNeeded();
  }

  throw toApiError(firstAttempt.payload);
};

let refreshInFlightPromise: Promise<string | null> | null = null;
