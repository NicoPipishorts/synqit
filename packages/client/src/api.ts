import type { AuthStore } from './auth';
import { CSRF_HEADER_NAME, LOCALE_HEADER_NAME } from './constants';
import { type ParsedRefreshResponse, parseRefreshResponse, toApiError } from './models';

export type ApiClientOptions = {
  baseUrl: string;
  auth: AuthStore;
  /** Where to send the browser when the session cannot be recovered. */
  loginPath: string;
  /** Skip the redirect when the user is already on an auth page. */
  isOnLoginPage?: (pathname: string) => boolean;
  /** Locale sent as `x-synqit-locale` on every request. */
  getLocale?: () => string | null | undefined;
  /** Runs after a successful token refresh (web applies theme/locale/avatar from the snapshot). */
  onRefreshed?: (refresh: ParsedRefreshResponse) => void;
  /** Paths whose 401 must not trigger a refresh (login, register, refresh itself). */
  noRefreshPaths?: readonly string[];
};

export type ApiClient = ReturnType<typeof createApiClient>;

const DEFAULT_NO_REFRESH_PATHS = [
  '/v1/auth/login',
  '/v1/auth/register',
  '/v1/auth/refresh',
  '/v1/admin/auth/login',
  '/v1/admin/auth/refresh',
];

/**
 * JSON fetch wrapper for the cookie-session API: sends credentials, the CSRF
 * header on unsafe methods, the preferred locale, and transparently refreshes
 * the session once on 401 (single in-flight refresh shared across callers).
 */
export const createApiClient = ({
  baseUrl,
  auth,
  loginPath,
  isOnLoginPage = (pathname) => pathname.startsWith(loginPath),
  getLocale,
  onRefreshed,
  noRefreshPaths = DEFAULT_NO_REFRESH_PATHS,
}: ApiClientOptions) => {
  let refreshInFlight: Promise<boolean> | null = null;

  const redirectToLoginIfNeeded = (): void => {
    if (typeof window === 'undefined' || isOnLoginPage(window.location.pathname)) {
      return;
    }
    window.location.assign(loginPath);
  };

  const refreshSession = async (): Promise<boolean> => {
    if (refreshInFlight) {
      return refreshInFlight;
    }
    refreshInFlight = (async () => {
      try {
        const csrfToken = auth.getCsrfToken();
        const response = await fetch(`${baseUrl}${auth.refreshPath}`, {
          method: 'POST',
          credentials: 'include',
          headers: csrfToken ? { [CSRF_HEADER_NAME]: csrfToken } : undefined,
        });
        const payload = (await response.json().catch(() => ({}))) as unknown;
        if (!response.ok) {
          return false;
        }
        const parsed = parseRefreshResponse(payload);
        auth.setAccessToken(parsed.tokens.accessToken);
        onRefreshed?.(parsed);
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
    return refreshInFlight;
  };

  const callApi = async <TResponse>(
    path: string,
    init: RequestInit,
    parser: (payload: unknown) => TResponse,
  ): Promise<TResponse> => {
    const hasBody = init.body !== undefined && init.body !== null;
    const method = (init.method ?? 'GET').toUpperCase();
    const requiresCsrf = !['GET', 'HEAD', 'OPTIONS'].includes(method);

    const buildHeaders = (): Headers => {
      const headers = new Headers(init.headers ?? {});
      if (hasBody && !headers.has('content-type')) {
        headers.set('content-type', 'application/json');
      }
      const locale = getLocale?.();
      if (locale && !headers.has(LOCALE_HEADER_NAME)) {
        headers.set(LOCALE_HEADER_NAME, locale);
      }
      if (requiresCsrf) {
        const csrfToken = auth.getCsrfToken();
        if (csrfToken && !headers.has(CSRF_HEADER_NAME)) {
          headers.set(CSRF_HEADER_NAME, csrfToken);
        }
      }
      return headers;
    };

    const execute = async () => {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        credentials: 'include',
        headers: buildHeaders(),
      });
      const payload = (await response.json().catch(() => ({}))) as unknown;
      return { response, payload };
    };

    const first = await execute();
    if (first.response.ok) {
      return parser(first.payload);
    }

    if (first.response.status === 401 && !noRefreshPaths.includes(path)) {
      if (await refreshSession()) {
        const retry = await execute();
        if (retry.response.ok) {
          return parser(retry.payload);
        }
        if (retry.response.status === 401) {
          auth.clearAuth();
          redirectToLoginIfNeeded();
        }
        throw toApiError(retry.payload);
      }
      auth.clearAuth();
      redirectToLoginIfNeeded();
    }

    throw toApiError(first.payload);
  };

  return { callApi, refreshSession, baseUrl };
};
