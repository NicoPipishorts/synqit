import { createAnalyticsTracker, parseBooleanFlag } from '@synqit/client';

import { getCsrfToken, loadAuth } from './auth';
import { ANALYTICS_SESSION_STORAGE_KEY, API_URL } from './constants';
import { loadAnonymousPreferences } from './preferences';

const tracker = createAnalyticsTracker({
  baseUrl: API_URL,
  source: 'web',
  sessionStorageKey: ANALYTICS_SESSION_STORAGE_KEY,
  enabled: parseBooleanFlag(import.meta.env.VITE_ANALYTICS_ENABLED, true),
  allowLocal: parseBooleanFlag(import.meta.env.VITE_ANALYTICS_ALLOW_LOCAL, false),
  getLocale: () => loadAnonymousPreferences().locale,
  getCsrfToken,
  isAuthenticated: () => Boolean(loadAuth()),
});

export const trackAnalyticsEvent = tracker.track;

export const trackPageView = (path: string): void => tracker.trackPageView(path, 'app_page_view');
