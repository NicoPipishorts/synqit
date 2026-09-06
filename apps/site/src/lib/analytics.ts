import { createAnalyticsTracker, parseBooleanFlag } from '@synqit/client';

import { getApiBaseUrl } from './api-url';

// Anonymous-only tracking for the marketing site. `text/plain` keeps the
// cross-origin beacon CORS-simple (no preflight, survives unload); the API
// registers a text/plain parser for this endpoint.

export type SiteAnalyticsEventName =
  | 'site_page_view'
  | 'site_section_viewed'
  | 'site_cta_click'
  | 'site_time_on_page';

const tracker = createAnalyticsTracker({
  baseUrl: getApiBaseUrl(),
  source: 'site',
  transport: 'text',
  sessionStorageKey: 'synqit.site.analytics.session.v1',
  enabled: parseBooleanFlag(import.meta.env.VITE_ANALYTICS_ENABLED, true),
  allowLocal: parseBooleanFlag(import.meta.env.VITE_ANALYTICS_ALLOW_LOCAL, false),
});

export const trackSiteEvent = (params: {
  eventName: SiteAnalyticsEventName;
  properties?: Record<string, unknown>;
  pathOverride?: string;
}): void => tracker.track({ ...params, target: 'marketing' });
