import { expect, Page, test } from '@playwright/test';

// ---------------------------------------------------------------------------
// Auth fixtures
// ---------------------------------------------------------------------------

const AUTH_STORAGE_KEY = 'synqit.auth.v1';
const TEST_AUTH = {
  accessToken: 'e2e-access-token',
  refreshToken: 'e2e-refresh-token',
  userId: '00000000-0000-4000-8000-000000000001',
  userEmail: 'regression+e2e@synqit.test',
  avatarUrl: null,
};

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const now = Date.now();

const mockEvents = [
  {
    id: 'event-1',
    hostUserId: TEST_AUTH.userId,
    provider: 'spotify',
    providerConnectionStatus: 'connected',
    providerPlaylistId: 'playlist-1',
    status: 'open',
    name: 'Launch Party',
    description: 'Main launch event',
    magicLinkToken: 'magic-token-1',
    magicLinkRevokedAt: null,
    createdAt: new Date(now - 1000 * 60 * 60).toISOString(),
    updatedAt: new Date(now - 1000 * 60 * 2).toISOString(),
    closedAt: null,
  },
  {
    id: 'event-2',
    hostUserId: TEST_AUTH.userId,
    provider: 'apple',
    providerConnectionStatus: 'connected',
    providerPlaylistId: 'playlist-2',
    status: 'open',
    name: 'After Party',
    description: 'Second event',
    magicLinkToken: 'magic-token-2',
    magicLinkRevokedAt: null,
    createdAt: new Date(now - 1000 * 60 * 50).toISOString(),
    updatedAt: new Date(now - 1000 * 60 * 5).toISOString(),
    closedAt: null,
  },
] as const;

const mockDrafts = [
  {
    id: '00000000-0000-4000-8000-000000000010',
    hostUserId: TEST_AUTH.userId,
    provider: 'spotify',
    name: 'Draft Event',
    description: 'Draft description',
    step: 2,
    createdAt: new Date(now - 1000 * 60 * 40).toISOString(),
    updatedAt: new Date(now - 1000 * 60 * 10).toISOString(),
  },
] as const;

const mockOwnedSyncs = [
  {
    id: 'sync-1',
    senderUserId: TEST_AUTH.userId,
    provider: 'spotify',
    providerPlaylistId: 'spotify-shared-1',
    name: 'Roadtrip Blend',
    trackCount: 42,
    syncMode: 'host_only',
    autoSyncEnabled: true,
    lastSyncedAt: new Date(now - 1000 * 60 * 15).toISOString(),
    lastError: null,
    magicLinkToken: 'sync-magic-token-1',
    magicLinkRevokedAt: null,
    createdAt: new Date(now - 1000 * 60 * 90).toISOString(),
    updatedAt: new Date(now - 1000 * 60 * 2).toISOString(),
  },
] as const;

const mockSubscribedSyncs = [
  {
    id: 'sync-2',
    senderUserId: '00000000-0000-4000-8000-000000000099',
    provider: 'apple',
    providerPlaylistId: 'apple-shared-2',
    name: 'Shared Weekly',
    trackCount: 18,
    syncMode: 'host_only',
    autoSyncEnabled: true,
    lastSyncedAt: new Date(now - 1000 * 60 * 30).toISOString(),
    lastError: null,
    magicLinkToken: 'sync-magic-token-2',
    magicLinkRevokedAt: null,
    createdAt: new Date(now - 1000 * 60 * 120).toISOString(),
    updatedAt: new Date(now - 1000 * 60 * 4).toISOString(),
  },
] as const;

const mockDashboardSummary = {
  ownerEventActivity: [
    {
      eventId: 'event-1',
      name: 'Launch Party',
      addedTrackCount24h: 20,
      latestActivityAt: new Date(now - 1000 * 60).toISOString(),
    },
    {
      eventId: 'event-2',
      name: 'After Party',
      addedTrackCount24h: 5,
      latestActivityAt: new Date(now - 1000 * 60 * 5).toISOString(),
    },
  ],
  ownerSyncActivity: [
    {
      syncId: 'sync-1',
      name: 'Roadtrip Blend',
      totalSubscriberCount: 12,
      newSubscriberCount24h: 2,
      latestActivityAt: new Date(now - 1000 * 60 * 2).toISOString(),
      recentSubscribers: [
        {
          userId: '00000000-0000-4000-8000-000000000020',
          name: 'Jane Smith',
          subscribedAt: new Date(now - 1000 * 90).toISOString(),
        },
        {
          userId: '00000000-0000-4000-8000-000000000021',
          name: 'John Doe',
          subscribedAt: new Date(now - 1000 * 60 * 3).toISOString(),
        },
      ],
    },
  ],
  subscriberSyncActivity: [
    {
      syncId: 'sync-2',
      name: 'Shared Weekly',
      addedTrackCount7d: 4,
      ownerAddedTracks7d: true,
      latestActivityAt: new Date(now - 1000 * 60 * 4).toISOString(),
    },
  ],
} as const;

const mockTracksEvent1 = Array.from({ length: 5 }, (_, i) => ({
  providerTrackId: `event-1-track-${i + 1}`,
  name: `Track ${String(i + 1).padStart(2, '0')}`,
  artist: `Artist ${i + 1}`,
  album: `Album ${i + 1}`,
  durationMs: 200_000,
  artworkUrl: null,
  addedAt: new Date(now - i * 1000 * 30).toISOString(),
  addedBy: 'guest',
}));

const mockTracksEvent2 = Array.from({ length: 3 }, (_, i) => ({
  providerTrackId: `event-2-track-${i + 1}`,
  name: `After Track ${String(i + 1).padStart(2, '0')}`,
  artist: `After Artist ${i + 1}`,
  album: `After Album ${i + 1}`,
  durationMs: 200_000,
  artworkUrl: null,
  addedAt: new Date(now - (i + 30) * 1000 * 30).toISOString(),
  addedBy: 'guest',
}));

const mockEventDetail = {
  ...mockEvents[0],
  coverImageUrl: null,
  closeReason: null,
};

const mockSyncDetail = {
  ...mockOwnedSyncs[0],
  subscriberCount: 12,
  subscriberPlatformStats: [
    { provider: 'spotify', count: 8 },
    { provider: 'apple', count: 4 },
  ],
  tracks: mockTracksEvent1,
};

const mockSyncPublic = {
  id: 'sync-2',
  provider: 'apple',
  syncMode: 'host_only',
  name: 'Roadtrip Blend',
  trackCount: 18,
  isRevoked: false,
  isOwner: false,
  isSubscribed: false,
  subscriberCount: 12,
  tracks: mockTracksEvent1.map((track) => ({
    name: track.name,
    artist: track.artist,
    album: track.album,
    artworkUrl: track.artworkUrl,
  })),
} as const;

const mockPreferences = {
  theme: 'system',
  locale: 'en',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ApiCounters = {
  integrations: number;
  events: number;
  drafts: number;
  syncs: number;
  dashboardSummary: number;
  tracks: number;
  preferences: number;
};

const setAuthenticatedSession = async (page: Page) => {
  await page.addInitScript(
    (payload: { key: string; auth: typeof TEST_AUTH }) => {
      window.localStorage.setItem(payload.key, JSON.stringify(payload.auth));
    },
    { key: AUTH_STORAGE_KEY, auth: TEST_AUTH },
  );
};

const installApiMocks = async (page: Page, options?: { trackDelayMs?: number }) => {
  const counters: ApiCounters = {
    integrations: 0,
    events: 0,
    drafts: 0,
    syncs: 0,
    dashboardSummary: 0,
    tracks: 0,
    preferences: 0,
  };

  await page.route('**/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method().toUpperCase();
    const path = url.pathname.replace(/^\/api/, '');

    // Preferences (loaded by AppShell on every authenticated page)
    if (path === '/v1/auth/preferences' && method === 'GET') {
      counters.preferences += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ preferences: mockPreferences }),
      });
      return;
    }

    if (path === '/v1/integrations' && method === 'GET') {
      counters.integrations += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          integrations: [
            {
              provider: 'spotify',
              status: 'connected',
              connectedAt: new Date(now - 1000 * 60 * 60).toISOString(),
              expiresAt: null,
            },
            {
              provider: 'apple',
              status: 'connected',
              connectedAt: new Date(now - 1000 * 60 * 60).toISOString(),
              expiresAt: null,
            },
          ],
        }),
      });
      return;
    }

    if (path === '/v1/playlists/drafts' && method === 'GET') {
      counters.drafts += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ drafts: mockDrafts }),
      });
      return;
    }

    // Match /v1/playlists/{id}/tracks before the list route
    const trackMatch = path.match(/^\/v1\/playlists\/([^/]+)\/tracks$/);
    if (trackMatch && method === 'GET') {
      counters.tracks += 1;
      if (options?.trackDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.trackDelayMs));
      }
      const tracks =
        trackMatch[1] === 'event-1'
          ? mockTracksEvent1
          : trackMatch[1] === 'event-2'
            ? mockTracksEvent2
            : [];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tracks }),
      });
      return;
    }

    // Match /v1/playlists/{id} before the list route
    const eventDetailMatch = path.match(/^\/v1\/playlists\/([^/]+)$/);
    if (eventDetailMatch && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          event: mockEventDetail,
          magicLinkUrl: 'https://synqit.test/playlist/magic-token-1',
        }),
      });
      return;
    }

    if (path === '/v1/playlists' && method === 'GET') {
      counters.events += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ events: mockEvents }),
      });
      return;
    }

    // Match /v1/syncs/{id} before the list route
    const syncDetailMatch = path.match(/^\/v1\/syncs\/([^/]+)$/);
    if (syncDetailMatch && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sync: mockSyncDetail }),
      });
      return;
    }

    if (path === '/v1/syncs' && method === 'GET') {
      counters.syncs += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ownedSyncs: mockOwnedSyncs,
          subscribedSyncs: mockSubscribedSyncs,
        }),
      });
      return;
    }

    if (path === '/v1/dashboard/summary' && method === 'GET') {
      counters.dashboardSummary += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDashboardSummary),
      });
      return;
    }

    // Fallback — fail loudly so missing mocks are caught immediately
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'not_mocked',
        message: `${method} ${path} is not mocked in smoke test.`,
      }),
    });
  });

  return counters;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('web smoke regressions', () => {
  // ── Dashboard ─────────────────────────────────────────────────────────────

  test('dashboard shows role-based overview and activity feed', async ({ page }) => {
    await setAuthenticatedSession(page);
    await installApiMocks(page);
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Playlists overview' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible();

    // Section labels
    await expect(page.getByText('Owned by you')).toBeVisible();
    await expect(page.getByText('Part of')).toBeVisible();

    // Owned playlists appear in the overview
    await expect(page.getByText('Launch Party').first()).toBeVisible();
    await expect(page.getByText('Roadtrip Blend').first()).toBeVisible();

    // Subscribed sync appears in "Part of"
    await expect(page.getByText('Shared Weekly').first()).toBeVisible();

    // Activity feed entries
    await expect(page.getByText('Jane Smith subscribed')).toBeVisible();
    await expect(page.getByText('4 songs added in the last 7 days')).toBeVisible();
  });

  test('dashboard snapshot is reused when navigating away and back', async ({ page }) => {
    await setAuthenticatedSession(page);
    const counters = await installApiMocks(page);

    await page.goto('/dashboard');
    await expect(page.getByText('Jane Smith subscribed')).toBeVisible();

    // Wait until all dashboard API calls have completed before snapshotting
    await expect.poll(() => counters.drafts).toBeGreaterThanOrEqual(1);
    await expect.poll(() => counters.syncs).toBeGreaterThanOrEqual(1);
    await expect.poll(() => counters.dashboardSummary).toBeGreaterThanOrEqual(1);
    const snapshot = { ...counters };

    await page.locator('header nav a[href="/profile"]').first().click();
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();

    await page.locator('header nav a[href="/dashboard"]').first().click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Jane Smith subscribed')).toBeVisible();

    // dashboardSummary is dashboard-only — must not have been re-fetched
    expect(counters.dashboardSummary).toBe(snapshot.dashboardSummary);
    // drafts staleTime covers the round-trip — must not re-fetch
    expect(counters.drafts).toBe(snapshot.drafts);
  });

  // ── Playlists (event list) ─────────────────────────────────────────────────

  test('playlists page lists open events and draft', async ({ page }) => {
    await setAuthenticatedSession(page);
    await installApiMocks(page);
    await page.goto('/playlists');

    await expect(page.getByRole('heading', { name: 'My events' })).toBeVisible();
    await expect(page.getByText('Launch Party')).toBeVisible();
    await expect(page.getByText('After Party')).toBeVisible();
    // Draft card is present
    await expect(page.getByText('Draft Event')).toBeVisible();
  });

  test('playlists page resume-draft button points to draft when draft exists', async ({ page }) => {
    await setAuthenticatedSession(page);
    await installApiMocks(page);
    await page.goto('/playlists');

    await expect(page.getByRole('heading', { name: 'My events' })).toBeVisible();

    // The create/resume CTA in the header should link to the draft
    const resumeLink = page.getByRole('link', { name: /Resume/i }).first();
    await expect(resumeLink).toBeVisible();
    await expect(resumeLink).toHaveAttribute('href', `/playlists/new?draftId=${mockDrafts[0].id}`);
  });

  // ── Event details ──────────────────────────────────────────────────────────

  test('event detail page renders event name and tracks tab', async ({ page }) => {
    await setAuthenticatedSession(page);
    await installApiMocks(page);
    await page.goto(`/playlists/event-1`);

    await expect(page.getByRole('heading', { name: 'Launch Party' })).toBeVisible();
    // Tracks tab is present
    await expect(
      page
        .getByRole('tab', { name: /tracks/i })
        .or(page.getByText(/tracks/i))
        .first(),
    ).toBeVisible();
  });

  // ── Synced lists ───────────────────────────────────────────────────────────

  test('synced lists page shows owned and subscribed syncs', async ({ page }) => {
    await setAuthenticatedSession(page);
    await installApiMocks(page);
    await page.goto('/synced-lists');

    await expect(page.getByRole('heading', { name: 'My synced playlists' })).toBeVisible();
    await expect(page.getByText('Shared by you')).toBeVisible();
    await expect(page.getByText('Roadtrip Blend')).toBeVisible();
    await expect(page.getByText('Subscribed by you')).toBeVisible();
    await expect(page.getByText('Shared Weekly')).toBeVisible();
  });

  test('sync detail page renders sync name and overview', async ({ page }) => {
    await setAuthenticatedSession(page);
    await installApiMocks(page);
    await page.goto('/synced-lists/sync-1');

    await expect(page.getByRole('heading', { name: 'Roadtrip Blend' })).toBeVisible();
    await expect(page.getByText('Sync overview')).toBeVisible();
  });

  // ── Profile pages ──────────────────────────────────────────────────────────

  test('profile page renders preferences and navigation cards', async ({ page }) => {
    await setAuthenticatedSession(page);
    await installApiMocks(page);
    await page.goto('/profile');

    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await expect(page.getByText('Site preferences')).toBeVisible();
    // Nav cards
    await expect(page.getByRole('heading', { name: /personal info/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /platforms/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /security/i })).toBeVisible();
  });

  test('profile platforms page renders connected services section', async ({ page }) => {
    await setAuthenticatedSession(page);
    await installApiMocks(page);
    await page.goto('/profile/platforms');

    await expect(page.getByRole('heading', { name: 'Services' })).toBeVisible();
    await expect(page.getByText('Spotify').first()).toBeVisible();
    await expect(page.getByText('Apple Music').first()).toBeVisible();
  });

  test('profile security page renders change password section', async ({ page }) => {
    await setAuthenticatedSession(page);
    await installApiMocks(page);
    await page.goto('/profile/security');

    await expect(page.getByRole('heading', { name: /security/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Change password' })).toBeVisible();
  });

  // ── Auth pages (unauthenticated) ───────────────────────────────────────────

  test('login page renders email and password fields', async ({ page }) => {
    await page.goto('/auth/login');

    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
  });

  test('register page renders email and password fields', async ({ page }) => {
    await page.goto('/auth/register');

    await expect(page.getByText('Sign me up')).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Register' })).toBeVisible();
  });

  test('forgot password page renders email field', async ({ page }) => {
    await page.goto('/auth/forgot-password');

    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /reset|send/i })).toBeVisible();
  });

  // ── Public pages (no auth) ─────────────────────────────────────────────────

  test('public event page renders event name and track search', async ({ page }) => {
    // Public page — no auth, but tracks endpoint is still called
    await page.route('**/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
      const method = route.request().method().toUpperCase();

      const linkTrackMatch = path.match(/^\/v1\/playlists\/link\/([^/]+)\/tracks$/);
      if (linkTrackMatch && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ tracks: mockTracksEvent1 }),
        });
        return;
      }

      const linkMatch = path.match(/^\/v1\/playlists\/link\/([^/]+)$/);
      if (linkMatch && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            event: { ...mockEventDetail, name: 'Launch Party' },
            magicLinkUrl: 'https://synqit.test/playlist/magic-token-1',
          }),
        });
        return;
      }

      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'not_mocked', message: `${method} ${path} not mocked` }),
      });
    });

    await page.goto('/playlist/magic-token-1');
    await expect(page.getByRole('heading', { name: 'Launch Party' })).toBeVisible();
  });

  test('public sync page renders sync name and subscribe button', async ({ page }) => {
    await page.route('**/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
      const method = route.request().method().toUpperCase();

      if (path.startsWith('/v1/syncs/link/') && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            sync: mockSyncPublic,
          }),
        });
        return;
      }

      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'not_mocked', message: `${method} ${path} not mocked` }),
      });
    });

    await page.goto('/sync/sync-magic-token-2');
    await expect(page.getByRole('heading', { name: 'Roadtrip Blend' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Subscribe' })).toBeVisible();
  });

  // ── Redirect guards ────────────────────────────────────────────────────────

  test('unauthenticated user is redirected to login from dashboard', async ({ page }) => {
    // No setAuthenticatedSession — no token in localStorage
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('authenticated user is redirected away from login', async ({ page }) => {
    await setAuthenticatedSession(page);
    await installApiMocks(page);
    await page.goto('/auth/login');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
