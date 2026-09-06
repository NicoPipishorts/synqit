import { createAnalyticsTracker } from '../analytics';

describe('createAnalyticsTracker', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('posts JSON with credentials for the app and de-duplicates page views', () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 202 }));
    Object.defineProperty(navigator, 'sendBeacon', { value: undefined, configurable: true });
    const tracker = createAnalyticsTracker({
      baseUrl: '/api',
      source: 'web',
      sessionStorageKey: 'test.session',
      allowLocal: true,
      getLocale: () => 'fr',
      getCsrfToken: () => 'csrf',
      isAuthenticated: () => true,
    });

    tracker.trackPageView('/dashboard');
    tracker.trackPageView('/dashboard');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/analytics/events');
    expect(init.credentials).toBe('include');
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      eventName: 'app_page_view',
      target: 'navigation',
      source: 'web',
      path: '/dashboard',
      locale: 'fr',
    });
    expect(body.sessionId.length).toBeGreaterThanOrEqual(8);
    expect((init.headers as Record<string, string>)['x-synqit-csrf-token']).toBe('csrf');
  });

  it('uses text/plain beacons for the site so cross-origin sends skip preflight', () => {
    const beacon = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const tracker = createAnalyticsTracker({
      baseUrl: 'https://app.example.com/api',
      source: 'site',
      transport: 'text',
      sessionStorageKey: 'site.session',
      allowLocal: true,
    });

    tracker.track({
      eventName: 'site_cta_click',
      target: 'marketing',
      properties: { cta: 'hero' },
    });
    expect(beacon).toHaveBeenCalledTimes(1);
    expect((beacon.mock.calls[0][1] as Blob).type).toBe('text/plain');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stays silent when disabled or on a local origin without allowLocal', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    createAnalyticsTracker({
      baseUrl: '/api',
      source: 'web',
      sessionStorageKey: 'k',
      enabled: false,
      allowLocal: true,
    }).track({ eventName: 'x', target: 'y' });
    createAnalyticsTracker({ baseUrl: '/api', source: 'web', sessionStorageKey: 'k' }).track({
      eventName: 'x',
      target: 'y',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
