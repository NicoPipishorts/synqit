import { CSRF_HEADER_NAME, LOCALE_HEADER_NAME } from './constants';

export type AnalyticsSource = 'web' | 'site';

export type AnalyticsTrackerOptions = {
  /** API origin or same-origin prefix, e.g. `/api` or `https://app.example.com/api`. */
  baseUrl: string;
  source: AnalyticsSource;
  /** sessionStorage key for the anonymous session id. */
  sessionStorageKey: string;
  /**
   * `json` sends `application/json` with credentials (same-origin app).
   * `text` sends `text/plain` so cross-origin beacons skip CORS preflight (site).
   */
  transport?: 'json' | 'text';
  enabled?: boolean;
  /** Track from localhost too (off by default so dev sessions stay out of the data). */
  allowLocal?: boolean;
  getLocale?: () => string | null | undefined;
  getCsrfToken?: () => string | null;
  /** Authenticated requests need credentials, so they use fetch instead of a beacon. */
  isAuthenticated?: () => boolean;
};

export type AnalyticsTrackParams = {
  eventName: string;
  target: string;
  properties?: Record<string, unknown>;
  pathOverride?: string;
};

export type AnalyticsTracker = ReturnType<typeof createAnalyticsTracker>;

const isLocalOrigin = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  const hostname = window.location.hostname.trim().toLowerCase();
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname.endsWith('.local')
  );
};

const createSessionId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `anon-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

const currentPath = (): string => {
  if (typeof window === 'undefined') {
    return '/';
  }
  return `${window.location.pathname}${window.location.search}`.slice(0, 512) || '/';
};

/** Fire-and-forget event tracker for the in-house analytics endpoint. */
export const createAnalyticsTracker = ({
  baseUrl,
  source,
  sessionStorageKey,
  transport = 'json',
  enabled = true,
  allowLocal = false,
  getLocale,
  getCsrfToken,
  isAuthenticated = () => false,
}: AnalyticsTrackerOptions) => {
  const endpoint = `${baseUrl}/v1/analytics/events`;
  let inMemorySessionId: string | null = null;
  let lastTrackedPagePath: string | null = null;

  const getSessionId = (): string | null => {
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      const existing = window.sessionStorage.getItem(sessionStorageKey);
      if (existing && existing.length >= 8) {
        return existing;
      }
      const generated = createSessionId();
      window.sessionStorage.setItem(sessionStorageKey, generated);
      return generated;
    } catch {
      inMemorySessionId ??= createSessionId();
      return inMemorySessionId;
    }
  };

  const sendBeacon = (body: string): boolean => {
    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
      return false;
    }
    try {
      const type = transport === 'text' ? 'text/plain' : 'application/json';
      return navigator.sendBeacon(endpoint, new Blob([body], { type }));
    } catch {
      return false;
    }
  };

  const sendFetch = (body: string, locale: string | null | undefined): void => {
    const headers: Record<string, string> = {
      'content-type': transport === 'text' ? 'text/plain' : 'application/json',
    };
    if (locale) {
      headers[LOCALE_HEADER_NAME] = locale;
    }
    const csrfToken = getCsrfToken?.();
    if (csrfToken) {
      headers[CSRF_HEADER_NAME] = csrfToken;
    }
    void fetch(endpoint, {
      method: 'POST',
      credentials: transport === 'json' ? 'include' : undefined,
      headers,
      body,
      keepalive: true,
    }).catch(() => undefined);
  };

  const track = (params: AnalyticsTrackParams): void => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }
    if (isLocalOrigin() && !allowLocal) {
      return;
    }
    const sessionId = getSessionId();
    if (!sessionId) {
      return;
    }

    const locale = getLocale?.() ?? null;
    let payload: string;
    try {
      payload = JSON.stringify({
        eventName: params.eventName,
        target: params.target,
        sessionId,
        path: (params.pathOverride ?? currentPath()).slice(0, 512),
        locale: locale ?? undefined,
        source,
        properties: params.properties ?? {},
      });
    } catch {
      return;
    }

    if (!isAuthenticated() && sendBeacon(payload)) {
      return;
    }
    sendFetch(payload, locale);
  };

  /** De-duplicates consecutive views of the same path (router effects re-fire). */
  const trackPageView = (
    path: string,
    eventName = `${source === 'site' ? 'site' : 'app'}_page_view`,
  ): void => {
    if (lastTrackedPagePath === path) {
      return;
    }
    lastTrackedPagePath = path;
    track({
      eventName,
      target: source === 'site' ? 'marketing' : 'navigation',
      pathOverride: path,
    });
  };

  return { track, trackPageView, getSessionId };
};
