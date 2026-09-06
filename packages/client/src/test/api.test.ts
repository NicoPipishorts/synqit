import { createApiClient } from '../api';
import { createAuthStore } from '../auth';

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const tokens = {
  accessToken: 'new-access',
  refreshToken: 'r',
  tokenType: 'Bearer',
  expiresInSeconds: 900,
};

describe('createApiClient', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = 'synqit_web_csrf=csrf-123';
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends credentials, JSON content type, locale and CSRF header on unsafe methods', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { ok: true }));
    const auth = createAuthStore({ baseUrl: '/api', scope: 'web' });
    const client = createApiClient({
      baseUrl: '/api',
      auth,
      loginPath: '/auth/login',
      getLocale: () => 'fr',
    });

    await client.callApi('/v1/things', { method: 'POST', body: '{}' }, (payload) => payload);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Headers;
    expect(url).toBe('/api/v1/things');
    expect(init.credentials).toBe('include');
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('x-synqit-locale')).toBe('fr');
    expect(headers.get('x-synqit-csrf-token')).toBe('csrf-123');
  });

  it('refreshes once on 401 and retries, sharing the refresh across callers', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/v1/auth/refresh')) {
        return jsonResponse(200, {
          tokens,
          snapshot: { avatarUrl: null, theme: 'dark', locale: 'en' },
        });
      }
      // first two data calls are unauthenticated, retries succeed
      const dataCalls = fetchMock.mock.calls.filter((call) =>
        String(call[0]).endsWith('/v1/data'),
      ).length;
      return dataCalls <= 2
        ? jsonResponse(401, { code: 'unauthorized', message: 'no' })
        : jsonResponse(200, { value: 42 });
    });
    const auth = createAuthStore({ baseUrl: '/api', scope: 'web' });
    const onRefreshed = vi.fn();
    const client = createApiClient({
      baseUrl: '/api',
      auth,
      loginPath: '/auth/login',
      onRefreshed,
    });

    const results = await Promise.all([
      client.callApi('/v1/data', { method: 'GET' }, (payload) => payload as { value: number }),
      client.callApi('/v1/data', { method: 'GET' }, (payload) => payload as { value: number }),
    ]);

    expect(results).toEqual([{ value: 42 }, { value: 42 }]);
    const refreshCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).endsWith('/v1/auth/refresh'),
    );
    expect(refreshCalls).toHaveLength(1);
    expect(onRefreshed).toHaveBeenCalledTimes(1);
    expect(auth.getAccessToken()).toBe('new-access');
  });

  it('clears the session and throws the API error when refresh fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      String(input).endsWith('/v1/auth/refresh')
        ? jsonResponse(401, { code: 'invalid_refresh', message: 'expired' })
        : jsonResponse(401, { code: 'unauthorized', message: 'Sign in again.' }),
    );
    const auth = createAuthStore({ baseUrl: '/api', scope: 'web' });
    auth.storeAuth({
      user: { id: 'u1', email: 'a@b.c', createdAt: 'now', avatarUrl: null },
      tokens,
    });
    const client = createApiClient({
      baseUrl: '/api',
      auth,
      loginPath: '/auth/login',
      isOnLoginPage: () => true, // avoid jsdom navigation
    });

    await expect(
      client.callApi('/v1/data', { method: 'GET' }, (payload) => payload),
    ).rejects.toEqual({
      code: 'unauthorized',
      message: 'Sign in again.',
    });
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('never tries to refresh the login endpoint itself', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(401, { code: 'invalid_credentials', message: 'bad' }));
    const auth = createAuthStore({ baseUrl: '/api', scope: 'web' });
    const client = createApiClient({ baseUrl: '/api', auth, loginPath: '/auth/login' });
    await expect(
      client.callApi('/v1/auth/login', { method: 'POST', body: '{}' }, (payload) => payload),
    ).rejects.toMatchObject({ code: 'invalid_credentials' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
