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

/** UTM keys we read off the landing URL, plus the ad-click ids worth keeping. */
const CAMPAIGN_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
] as const;

export type AnalyticsAcquisition = {
  /** External referrer URL, or null when the visit did not come from another site. */
  referrer: string | null;
  /** Campaign parameters found on the landing URL, e.g. `{ utm_source: 'newsletter' }`. */
  campaign: Record<string, string>;
};

const stripHostPrefix = (hostname: string): string =>
  hostname.replace(/^www\./, '').replace(/^app\./, '');

/**
 * True when `referrer` points somewhere outside our own site. Our marketing site
 * and the app live on sibling subdomains, so a hop between them is internal.
 */
const isExternalReferrer = (referrer: string, currentHostname: string): boolean => {
  try {
    const host = stripHostPrefix(new URL(referrer).hostname.toLowerCase());
    return host !== '' && host !== stripHostPrefix(currentHostname.toLowerCase());
  } catch {
    return false;
  }
};

/**
 * Reads acquisition data off the landing page. Must run while the entry URL is
 * still current — a client-side route change drops the campaign parameters.
 */
const readAcquisition = (): AnalyticsAcquisition => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { referrer: null, campaign: {} };
  }

  const raw = document.referrer ?? '';
  const referrer =
    raw && isExternalReferrer(raw, window.location.hostname) ? raw.slice(0, 512) : null;

  const campaign: Record<string, string> = {};
  try {
    const params = new URLSearchParams(window.location.search);
    for (const key of CAMPAIGN_PARAMS) {
      const value = params.get(key)?.trim();
      if (value) {
        campaign[key] = value.slice(0, 200);
      }
    }
  } catch {
    // A malformed query string is not worth failing a page view over.
  }

  return { referrer, campaign };
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
  // Read once, at construction, while the landing URL is still the current one.
  const acquisition = readAcquisition();
  const acquisitionStorageKey = `${sessionStorageKey}.acquisition`;

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

  /**
   * Returns the acquisition data on the first event of a session and nothing
   * afterwards, so where a visit came from is recorded once rather than
   * repeated on every page view.
   */
  const takeAcquisition = (): AnalyticsAcquisition | null => {
    if (!acquisition.referrer && Object.keys(acquisition.campaign).length === 0) {
      return null;
    }
    try {
      if (window.sessionStorage.getItem(acquisitionStorageKey)) {
        return null;
      }
      window.sessionStorage.setItem(acquisitionStorageKey, '1');
    } catch {
      // Storage blocked: sending it again is better than losing it entirely.
    }
    return acquisition;
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
    const entry = takeAcquisition();
    let payload: string;
    try {
      payload = JSON.stringify({
        eventName: params.eventName,
        target: params.target,
        sessionId,
        path: (params.pathOverride ?? currentPath()).slice(0, 512),
        locale: locale ?? undefined,
        source,
        referrer: entry?.referrer ?? undefined,
        properties:
          entry && Object.keys(entry.campaign).length > 0
            ? { ...(params.properties ?? {}), ...entry.campaign }
            : (params.properties ?? {}),
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
