import { createAuthStore, getInitials } from '../auth';

const tokens = { accessToken: 'a', refreshToken: 'r', tokenType: 'Bearer', expiresInSeconds: 900 };
const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

describe('createAuthStore', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('stores a user snapshot, reports auth state, and clears', () => {
    const auth = createAuthStore({ baseUrl: '/api', scope: 'web' });
    expect(auth.isAuthenticated()).toBe(false);

    auth.storeAuth({
      user: {
        id: 'u1',
        email: 'jane.doe@example.com',
        createdAt: 'now',
        avatarUrl: null,
        role: 'admin',
        adminPermissions: [{ scope: 'users', level: 'read' }],
      },
      tokens,
    });
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.isAdminAuthenticated()).toBe(true);
    expect(auth.hasAdminPermission('users', 'read')).toBe(true);
    expect(auth.hasAdminPermission('users', 'write')).toBe(false);
    expect(auth.getAccessToken()).toBe('a');

    auth.updateStoredAuthUser({ avatarUrl: '/avatar.png' });
    expect(auth.loadAuth()?.avatarUrl).toBe('/avatar.png');

    auth.clearAuth();
    expect(auth.loadAuth()).toBeNull();
    expect(auth.getAccessToken()).toBeNull();
  });

  it('bootstraps from /me for web and from the wrapped admin payload for admin', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/v1/me')
        return jsonResponse(200, { id: 'u1', email: 'w@x.y', createdAt: 'now', avatarUrl: null });
      if (url === '/api/v1/admin/me')
        return jsonResponse(200, {
          user: {
            id: 'a1',
            email: 'ops@x.y',
            createdAt: 'now',
            avatarUrl: null,
            role: 'admin',
            adminPermissions: [],
          },
        });
      return jsonResponse(404, {});
    });
    const web = createAuthStore({ baseUrl: '/api', scope: 'web' });
    await web.bootstrapSession();
    expect(web.loadAuth()?.userEmail).toBe('w@x.y');

    localStorage.clear();
    const admin = createAuthStore({ baseUrl: '/api', scope: 'admin' });
    await admin.bootstrapSession();
    expect(admin.loadAuth()?.userEmail).toBe('ops@x.y');
    expect(admin.isAdminAuthenticated()).toBe(true);
  });

  it('falls back to refresh then clears when the session is gone', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(401, {}));
    const auth = createAuthStore({ baseUrl: '/api', scope: 'web' });
    auth.storeAuth({
      user: { id: 'u1', email: 'w@x.y', createdAt: 'now', avatarUrl: null },
      tokens,
    });
    await auth.bootstrapSession();
    expect(auth.isAuthenticated()).toBe(false);
  });
});

describe('getInitials', () => {
  it('derives initials from the local part', () => {
    expect(getInitials('jane.doe@example.com')).toBe('JD');
    expect(getInitials('madonna@example.com')).toBe('MA');
    expect(getInitials('')).toBe('U');
  });
});
