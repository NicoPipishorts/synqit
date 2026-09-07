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
  it('sends the external referrer and campaign parameters once per session', () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 202 }));
    // No beacon, so the payload arrives as a readable string on the fetch init.
    Object.defineProperty(navigator, 'sendBeacon', { value: undefined, configurable: true });
    Object.defineProperty(document, 'referrer', {
      value: 'https://www.google.com/search?q=playlist+sync',
      configurable: true,
    });
    window.history.replaceState({}, '', '/?utm_source=newsletter&utm_medium=email&ignored=1');

    const tracker = createAnalyticsTracker({
      baseUrl: '/api',
      source: 'site',
      sessionStorageKey: 'acq.session',
      allowLocal: true,
    });

    tracker.track({ eventName: 'site_page_view', target: 'marketing' });
    tracker.track({ eventName: 'site_cta_click', target: 'marketing' });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const bodyAt = (index: number) =>
      JSON.parse(String((fetchMock.mock.calls[index][1] as RequestInit).body));

    const first = bodyAt(0);
    expect(first.referrer).toBe('https://www.google.com/search?q=playlist+sync');
    expect(first.properties).toMatchObject({ utm_source: 'newsletter', utm_medium: 'email' });
    expect(first.properties.ignored).toBeUndefined();

    // The second event of the same session carries no acquisition data.
    const second = bodyAt(1);
    expect(second.referrer).toBeUndefined();
    expect(second.properties.utm_source).toBeUndefined();
  });

  it('treats a hop from our own site as internal rather than a referrer', () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 202 }));
    Object.defineProperty(navigator, 'sendBeacon', { value: undefined, configurable: true });
    Object.defineProperty(document, 'referrer', {
      value: `${window.location.origin}/pricing`,
      configurable: true,
    });
    window.history.replaceState({}, '', '/');

    createAnalyticsTracker({
      baseUrl: '/api',
      source: 'site',
      sessionStorageKey: 'internal.session',
      allowLocal: true,
    }).track({ eventName: 'site_page_view', target: 'marketing' });

    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.referrer).toBeUndefined();
  });
});
