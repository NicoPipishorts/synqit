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
    tracks: 0,
  };

  await page.route('**/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method().toUpperCase();

    if (url.pathname === '/v1/integrations' && method === 'GET') {
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

    if (url.pathname === '/v1/events' && method === 'GET') {
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

    if (url.pathname === '/v1/events/drafts' && method === 'GET') {
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

    const trackMatch = url.pathname.match(/^\/v1\/events\/([^/]+)\/tracks$/);
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
        message: `${method} ${url.pathname} is not mocked in smoke test.`,
      }),
    });
  });

  return counters;
};

test.describe('web smoke regressions', () => {
  test('dashboard shows songs loader and paginated activity', async ({ page }) => {
    await setAuthenticatedSession(page);
    await installApiMocks(page, { trackDelayMs: 300 });

    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Loading songs...')).toBeVisible();
    await expect(page.getByText('Track 01')).toBeVisible();
    await expect(page.getByText('Page 1 / 2')).toBeVisible();

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Page 2 / 2')).toBeVisible();
    await expect(page.getByText('Track 16')).toBeVisible();
  });

  test('dashboard snapshot is reused when navigating away and back', async ({ page }) => {
    await setAuthenticatedSession(page);
    const counters = await installApiMocks(page);

    await page.goto('/dashboard');
    await expect(page.getByText('Track 01')).toBeVisible();
    await expect.poll(() => counters.integrations).toBeGreaterThanOrEqual(1);
    await expect.poll(() => counters.events).toBeGreaterThanOrEqual(1);
    await expect.poll(() => counters.tracks).toBeGreaterThanOrEqual(2);
    await page.waitForTimeout(120);
    const baselineCounters = { ...counters };

    await page.locator('header nav a[href="/profile"]').first().click();
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();

    await page.locator('header nav a[href="/dashboard"]').first().click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Track 01')).toBeVisible();
    await page.waitForTimeout(120);

    // Dashboard cache should prevent refetch while still inside TTL window.
    expect(counters.integrations).toBe(baselineCounters.integrations);
    expect(counters.events).toBe(baselineCounters.events);
    expect(counters.tracks).toBe(baselineCounters.tracks);
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

    await page.goto('/events');
    await expect(page.getByRole('heading', { name: 'My events' })).toBeVisible();
    await expect(page.getByText('Launch Party')).toBeVisible();
    await expect(page.getByText('Draft', { exact: true })).toBeVisible();
  });
});
