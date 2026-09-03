import { ApiError, refreshResponseSchema } from '@synqit/shared';

import { clearAuth, getCsrfToken, setAccessToken } from './auth';
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
  const method = (init.method ?? 'GET').toUpperCase();
  const requiresCsrf = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
  const buildHeaders = (): Headers => {
    const headers = new Headers(init.headers ?? {});
    const preferredLocale = loadAnonymousPreferences().locale;
    if (hasBody && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
    if (preferredLocale && !headers.has('x-synqit-locale')) {
      headers.set('x-synqit-locale', preferredLocale);
    }
    if (requiresCsrf) {
      const csrfToken = getCsrfToken();
      if (csrfToken && !headers.has('x-synqit-csrf-token')) {
        headers.set('x-synqit-csrf-token', csrfToken);
      }
    }
    return headers;
  };

  const execute = async () => {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: buildHeaders(),
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

  const refreshAccessToken = async (): Promise<boolean> => {
    if (refreshInFlightPromise) {
      return refreshInFlightPromise;
    }

    refreshInFlightPromise = (async () => {
      try {
        const csrfToken = getCsrfToken();
        const refreshResponse = await fetch(`${API_URL}/v1/admin/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: csrfToken ? { 'x-synqit-csrf-token': csrfToken } : undefined,
        });
        const refreshPayload = (await refreshResponse.json().catch(() => ({}))) as unknown;
        if (!refreshResponse.ok) {
          return false;
        }

        const parsedRefresh = refreshResponseSchema.parse(refreshPayload);
        setAccessToken(parsedRefresh.tokens.accessToken);
        return true;
      } catch {
        return false;
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
      const retryAttempt = await execute();
      if (retryAttempt.response.ok) {
        return parser(retryAttempt.payload);
      }

      if (retryAttempt.response.status === 401) {
        setAccessToken(null);
        clearAuth();
        redirectToLoginIfNeeded();
      }
      throw toApiError(retryAttempt.payload);
    }

    clearAuth();
    setAccessToken(null);
    redirectToLoginIfNeeded();
  }

  throw toApiError(firstAttempt.payload);
};

let refreshInFlightPromise: Promise<boolean> | null = null;
