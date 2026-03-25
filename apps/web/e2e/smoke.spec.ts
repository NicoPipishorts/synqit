import { expect, Page, test } from '@playwright/test';

const AUTH_STORAGE_KEY = 'synqit.auth.v1';
const TEST_AUTH = {
  accessToken: 'e2e-access-token',
  refreshToken: 'e2e-refresh-token',
  userId: '00000000-0000-4000-8000-000000000001',
  userEmail: 'regression+e2e@synqit.test',
  avatarUrl: null,
};

type ApiCounters = {
  integrations: number;
  events: number;
  drafts: number;
  syncs: number;
  dashboardSummary: number;
  tracks: number;
};

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
    syncMode: 'source_only',
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
    syncMode: 'source_only',
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

// 20 tracks for event-1, 5 for event-2 → 25 total activity rows → 2 pages of 15
const mockTracksByEventId = {
  'event-1': Array.from({ length: 20 }, (_, index) => ({
    providerTrackId: `event-1-track-${index + 1}`,
    name: `Track ${String(index + 1).padStart(2, '0')}`,
    artist: `Artist ${index + 1}`,
    album: `Album ${index + 1}`,
    durationMs: 200000,
    artworkUrl: null,
    addedAt: new Date(now - index * 1000 * 30).toISOString(),
    addedBy: 'guest',
  })),
  'event-2': Array.from({ length: 5 }, (_, index) => ({
    providerTrackId: `event-2-track-${index + 1}`,
    name: `After Track ${String(index + 1).padStart(2, '0')}`,
    artist: `After Artist ${index + 1}`,
    album: `After Album ${index + 1}`,
    durationMs: 200000,
    artworkUrl: null,
    addedAt: new Date(now - (index + 30) * 1000 * 30).toISOString(),
    addedBy: 'guest',
  })),
} as const;

const setAuthenticatedSession = async (page: Page) => {
  await page.addInitScript(
    (payload: { key: string; auth: typeof TEST_AUTH }) => {
      window.localStorage.setItem(payload.key, JSON.stringify(payload.auth));
    },
    {
      key: AUTH_STORAGE_KEY,
      auth: TEST_AUTH,
    },
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
  };

  await page.route('**/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method().toUpperCase();
    const normalizedPath = url.pathname.replace(/^\/api/, '');

    if (normalizedPath === '/v1/integrations' && method === 'GET') {
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

    if (normalizedPath === '/v1/playlists' && method === 'GET') {
      counters.events += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          events: mockEvents,
        }),
      });
      return;
    }

    if (normalizedPath === '/v1/playlists/drafts' && method === 'GET') {
      counters.drafts += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          drafts: mockDrafts,
        }),
      });
      return;
    }

    if (normalizedPath === '/v1/syncs' && method === 'GET') {
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

    if (normalizedPath === '/v1/dashboard/summary' && method === 'GET') {
      counters.dashboardSummary += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDashboardSummary),
      });
      return;
    }

    const trackMatch = normalizedPath.match(/^\/v1\/playlists\/([^/]+)\/tracks$/);
    if (trackMatch && method === 'GET') {
      counters.tracks += 1;
      if (options?.trackDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.trackDelayMs));
      }
      const eventId = trackMatch[1] as keyof typeof mockTracksByEventId;
      const tracks = mockTracksByEventId[eventId] ?? [];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tracks }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'not_found',
        message: `${method} ${normalizedPath} is not mocked in smoke test.`,
      }),
    });
  });

  return counters;
};

test.describe('web smoke regressions', () => {
  test('dashboard shows role-based activity summary', async ({ page }) => {
    await setAuthenticatedSession(page);
    await installApiMocks(page);

    await page.goto('/dashboard');

    const overviewSection = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Playlists overview' }) });
    const activitySection = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Activity' }) });

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Playlists overview' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible();
    await expect(overviewSection.getByText('Owned by you')).toBeVisible();
    await expect(overviewSection.getByText('Part of')).toBeVisible();
    await expect(
      overviewSection.getByRole('link', { name: /Launch Party/i }).first(),
    ).toBeVisible();
    await expect(
      overviewSection.getByRole('link', { name: /Roadtrip Blend/i }).first(),
    ).toBeVisible();
    await expect(activitySection.getByText('Jane Smith subscribed')).toBeVisible();
    await expect(activitySection.getByText('4 songs added in the last 7 days')).toBeVisible();
  });

  test('dashboard snapshot is reused when navigating away and back', async ({ page }) => {
    await setAuthenticatedSession(page);
    const counters = await installApiMocks(page);

    await page.goto('/dashboard');
    await expect(page.getByText('Jane Smith subscribed')).toBeVisible();

    // Wait until all expected API calls have completed before snapshotting counters
    await expect.poll(() => counters.drafts).toBeGreaterThanOrEqual(1);
    await expect.poll(() => counters.syncs).toBeGreaterThanOrEqual(1);
    await expect.poll(() => counters.dashboardSummary).toBeGreaterThanOrEqual(1);
    const baselineCounters = { ...counters };

    await page.locator('header nav a[href="/profile"]').first().click();
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();

    await page.locator('header nav a[href="/dashboard"]').first().click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Jane Smith subscribed')).toBeVisible();

    // All counters must be unchanged — cache was served, no new network requests fired
    expect(counters.integrations).toBe(baselineCounters.integrations);
    expect(counters.drafts).toBe(baselineCounters.drafts);
    expect(counters.syncs).toBe(baselineCounters.syncs);
    expect(counters.dashboardSummary).toBe(baselineCounters.dashboardSummary);
  });

  test('profile and events pages render core private-route content', async ({ page }) => {
    await setAuthenticatedSession(page);
    await installApiMocks(page);

    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await expect(page.getByText('Site preferences')).toBeVisible();

    const themeLabelBox = await page.getByText('Theme', { exact: true }).boundingBox();
    const languageLabelBox = await page.getByText('Language', { exact: true }).boundingBox();
    expect(themeLabelBox).not.toBeNull();
    expect(languageLabelBox).not.toBeNull();
    expect(Math.abs((themeLabelBox?.y ?? 0) - (languageLabelBox?.y ?? 0))).toBeLessThan(8);

    await page.goto('/playlists');
    await expect(page.getByRole('heading', { name: 'My events' })).toBeVisible();
    await expect(page.getByText('Launch Party')).toBeVisible();
    await expect(page.getByText('Draft', { exact: true })).toBeVisible();
  });
});
