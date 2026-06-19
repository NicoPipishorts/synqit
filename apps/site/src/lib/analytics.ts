import { getApiBaseUrl } from './api-url';

// Mirrors the web app's analytics client (apps/web/src/lib/analytics.ts) but
// tailored to the marketing site: anonymous-only, cross-origin transport via
// `text/plain` beacons (CORS-safelisted → no preflight, survives unload).

export type SiteAnalyticsEventName =
  | 'site_page_view'
  | 'site_section_viewed'
  | 'site_cta_click'
  | 'site_time_on_page';

type AnalyticsProperties = Record<string, unknown>;

const SESSION_STORAGE_KEY = 'synqit.site.analytics.session.v1';

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
};

const isAnalyticsEnabled = parseBoolean(import.meta.env.VITE_ANALYTICS_ENABLED, true);
const isLocalAnalyticsAllowed = parseBoolean(import.meta.env.VITE_ANALYTICS_ALLOW_LOCAL, false);

let inMemorySessionId: string | null = null;

const createSessionId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `anon-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};

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

const getSessionId = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing && existing.length >= 8) {
      return existing;
    }

    const generated = createSessionId();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, generated);
    return generated;
  } catch {
    if (!inMemorySessionId) {
      inMemorySessionId = createSessionId();
    }
    return inMemorySessionId;
  }
};

const getCurrentPath = (): string => {
  if (typeof window === 'undefined') {
    return '/';
  }

  const currentPath = `${window.location.pathname}${window.location.search}`;
  return currentPath.slice(0, 512) || '/';
};

const dispatch = (body: string): void => {
  const url = `${getApiBaseUrl()}/v1/analytics/events`;

  // `text/plain` keeps the request CORS-simple (no preflight) so the beacon
  // fires cross-origin and on unload. The API registers a text/plain parser.
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      if (navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }))) {
        return;
      }
    } catch {
      // Fall through to fetch.
    }
  }

  void fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body,
    keepalive: true,
  }).catch(() => undefined);
};

export const trackSiteEvent = (params: {
  eventName: SiteAnalyticsEventName;
  properties?: AnalyticsProperties;
  pathOverride?: string;
}): void => {
  if (!isAnalyticsEnabled || typeof window === 'undefined') {
    return;
  }
  if (isLocalOrigin() && !isLocalAnalyticsAllowed) {
    return;
  }

  const sessionId = getSessionId();
  if (!sessionId) {
    return;
  }

  let payload: string;
  try {
    payload = JSON.stringify({
      eventName: params.eventName,
      target: 'marketing',
      sessionId,
      path: (params.pathOverride ?? getCurrentPath()).slice(0, 512),
      source: 'site',
      properties: params.properties ?? {},
    });
  } catch {
    return;
  }

  dispatch(payload);
};
