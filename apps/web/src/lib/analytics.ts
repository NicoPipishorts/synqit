import { loadAuth } from './auth';
import { API_URL, ANALYTICS_SESSION_STORAGE_KEY } from './constants';
import { loadAnonymousPreferences } from './preferences';

type AnalyticsProperties = Record<string, unknown>;
type AnalyticsEventName = string;
type AnalyticsTarget = string;

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

const createSessionId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `anon-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};

const getSessionId = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const existing = window.sessionStorage.getItem(ANALYTICS_SESSION_STORAGE_KEY);
    if (existing && existing.length >= 8) {
      return existing;
    }

    const generated = createSessionId();
    window.sessionStorage.setItem(ANALYTICS_SESSION_STORAGE_KEY, generated);
    return generated;
  } catch {
    return createSessionId();
  }
};

const getCurrentPath = (): string => {
  if (typeof window === 'undefined') {
    return '/';
  }

  const currentPath = `${window.location.pathname}${window.location.search}`;
  return currentPath.slice(0, 512) || '/';
};

const enqueueViaFetch = (params: {
  body: string;
  accessToken: string | null;
  locale: 'en' | 'fr' | null;
}) => {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };

  if (params.locale) {
    headers['x-synqit-locale'] = params.locale;
  }
  if (params.accessToken) {
    headers.authorization = `Bearer ${params.accessToken}`;
  }

  void fetch(`${API_URL}/v1/analytics/events`, {
    method: 'POST',
    headers,
    body: params.body,
    keepalive: true,
  }).catch(() => undefined);
};

const enqueueViaBeacon = (body: string): boolean => {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
    return false;
  }

  try {
    return navigator.sendBeacon(
      `${API_URL}/v1/analytics/events`,
      new Blob([body], { type: 'application/json' }),
    );
  } catch {
    return false;
  }
};

export const trackAnalyticsEvent = (params: {
  eventName: AnalyticsEventName;
  target: AnalyticsTarget;
  properties?: AnalyticsProperties;
  pathOverride?: string;
}): void => {
  if (!isAnalyticsEnabled || typeof window === 'undefined') {
    return;
  }

  const sessionId = getSessionId();
  if (!sessionId) {
    return;
  }

  const locale = loadAnonymousPreferences().locale ?? null;
  const accessToken = loadAuth()?.accessToken ?? null;

  let payload: string;
  try {
    payload = JSON.stringify({
      eventName: params.eventName,
      target: params.target,
      sessionId,
      path: (params.pathOverride ?? getCurrentPath()).slice(0, 512),
      locale: locale ?? undefined,
      source: 'web',
      properties: params.properties ?? {},
    });
  } catch {
    return;
  }

  if (!accessToken && enqueueViaBeacon(payload)) {
    return;
  }

  enqueueViaFetch({
    body: payload,
    accessToken,
    locale,
  });
};

let lastTrackedPagePath: string | null = null;

export const trackPageView = (path: string): void => {
  if (lastTrackedPagePath === path) {
    return;
  }

  lastTrackedPagePath = path;
  trackAnalyticsEvent({
    eventName: 'app_page_view',
    target: 'navigation',
    pathOverride: path,
  });
};
