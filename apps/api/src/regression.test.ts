import { providerSchema } from '@synqit/shared';
import type { FastifyInstance } from 'fastify';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';

import { closeDatabase } from './db';
import { prisma } from './db/prisma';
import { buildServer } from './index';

const TEST_EMAIL_PREFIX = 'regression+';
const TEST_PASSWORD = 'Password123!';
const UPDATED_TEST_PASSWORD = 'NewPassword456@';
const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+lm7YAAAAASUVORK5CYII=';

const authHeader = (accessToken: string): Record<string, string> => ({
  authorization: `Bearer ${accessToken}`,
});

const parseBody = (rawBody: string): unknown => {
  try {
    return JSON.parse(rawBody);
  } catch {
    return rawBody;
  }
};

const cleanupTestData = async (): Promise<void> => {
  await prisma.users.deleteMany({
    where: {
      email: {
        startsWith: TEST_EMAIL_PREFIX,
      },
    },
  });
};

const registerUser = async (app: FastifyInstance, email: string) => {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: {
      email,
      password: TEST_PASSWORD,
    },
  });

  assert.equal(response.statusCode, 200);
  return parseBody(response.body) as {
    user: { id: string; email: string };
    tokens: { accessToken: string; refreshToken: string };
  };
};

const connectProvider = async (
  app: FastifyInstance,
  params: { provider: (typeof providerSchema.options)[number]; accessToken: string },
) => {
  const startResponse = await app.inject({
    method: 'GET',
    url: `/v1/auth/${params.provider}/start`,
    headers: authHeader(params.accessToken),
  });
  assert.equal(startResponse.statusCode, 200);
  const startBody = parseBody(startResponse.body) as {
    state: string;
    authorizationUrl: string;
  };
  assert.ok(startBody.state);
  assert.ok(startBody.authorizationUrl);

  const callbackResponse = await app.inject({
    method: 'GET',
    url: `/v1/auth/${params.provider}/callback?state=${encodeURIComponent(startBody.state)}&code=test-code&response_mode=json`,
  });
  assert.equal(callbackResponse.statusCode, 200);
  const callbackBody = parseBody(callbackResponse.body) as { ok: boolean };
  assert.equal(callbackBody.ok, true);
};

describe('API regression', () => {
  let app: FastifyInstance;

  before(async () => {
    process.env.SPOTIFY_CLIENT_ID = 'replace-me';
    process.env.SPOTIFY_CLIENT_SECRET = 'replace-me';
    process.env.SPOTIFY_SCOPES =
      process.env.SPOTIFY_SCOPES ??
      'playlist-read-private playlist-modify-private playlist-modify-public';
    process.env.APPLE_TEAM_ID = 'replace-me';
    process.env.APPLE_KEY_ID = 'replace-me';
    process.env.APPLE_MUSICKIT_IDENTIFIER = 'replace-me';
    process.env.APPLE_PRIVATE_KEY_P8 = 'replace-me';

    app = await buildServer();
  });

  beforeEach(async () => {
    await cleanupTestData();
  });

  after(async () => {
    await cleanupTestData();
    await app.close();
    await prisma.$disconnect();
    await closeDatabase();
  });

  it('auth: register/login/refresh/logout flow works', async () => {
    const email = `${TEST_EMAIL_PREFIX}${randomUUID()}@synqit.test`;

    const registerBody = await registerUser(app, email);
    assert.equal(registerBody.user.email, email);
    assert.ok(registerBody.tokens.accessToken);
    assert.ok(registerBody.tokens.refreshToken);

    const loginBadResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {
        email,
        password: 'wrong-password',
      },
    });
    assert.equal(loginBadResponse.statusCode, 401);

    const loginGoodResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {
        email,
        password: TEST_PASSWORD,
      },
    });
    assert.equal(loginGoodResponse.statusCode, 200);
    const loginGoodBody = parseBody(loginGoodResponse.body) as {
      tokens: { accessToken: string; refreshToken: string };
    };

    const meResponse = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: authHeader(loginGoodBody.tokens.accessToken),
    });
    assert.equal(meResponse.statusCode, 200);
    const meBody = parseBody(meResponse.body) as { email: string };
    assert.equal(meBody.email, email);

    const refreshResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: {
        refreshToken: loginGoodBody.tokens.refreshToken,
      },
    });
    assert.equal(refreshResponse.statusCode, 200);
    const refreshBody = parseBody(refreshResponse.body) as {
      tokens: { refreshToken: string };
    };

    const oldRefreshAgainResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: {
        refreshToken: loginGoodBody.tokens.refreshToken,
      },
    });
    assert.equal(oldRefreshAgainResponse.statusCode, 401);

    const logoutResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      payload: {
        refreshToken: refreshBody.tokens.refreshToken,
      },
    });
    assert.equal(logoutResponse.statusCode, 200);

    const refreshAfterLogoutResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: {
        refreshToken: refreshBody.tokens.refreshToken,
      },
    });
    assert.equal(refreshAfterLogoutResponse.statusCode, 401);
  });

  it('auth: register rejects weak passwords', async () => {
    const email = `${TEST_EMAIL_PREFIX}${randomUUID()}@synqit.test`;

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email,
        password: 'password123',
      },
    });

    assert.equal(response.statusCode, 400);
    const body = parseBody(response.body) as { code?: string };
    assert.equal(body.code, 'validation_error');
  });

  it('auth: deleted users cannot access protected integrations/events routes', async () => {
    const email = `${TEST_EMAIL_PREFIX}${randomUUID()}@synqit.test`;
    const registerBody = await registerUser(app, email);
    const accessToken = registerBody.tokens.accessToken;

    await prisma.users.delete({
      where: {
        id: registerBody.user.id,
      },
    });

    const meResponse = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: authHeader(accessToken),
    });
    assert.equal(meResponse.statusCode, 401);

    const integrationsResponse = await app.inject({
      method: 'GET',
      url: '/v1/integrations',
      headers: authHeader(accessToken),
    });
    assert.equal(integrationsResponse.statusCode, 401);

    const eventsResponse = await app.inject({
      method: 'GET',
      url: '/v1/events',
      headers: authHeader(accessToken),
    });
    assert.equal(eventsResponse.statusCode, 401);
  });

  it('admin: preview email endpoint requires admin key configuration', async () => {
    const previousAdminPreviewKey = process.env.ADMIN_EMAIL_PREVIEW_KEY;
    delete process.env.ADMIN_EMAIL_PREVIEW_KEY;

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/admin/email/preview',
        payload: {
          toEmail: `${TEST_EMAIL_PREFIX}${randomUUID()}@synqit.test`,
          locale: 'en',
        },
      });

      assert.equal(response.statusCode, 503);
      const body = parseBody(response.body) as { code?: string };
      assert.equal(body.code, 'admin_email_preview_not_configured');
    } finally {
      if (previousAdminPreviewKey === undefined) {
        delete process.env.ADMIN_EMAIL_PREVIEW_KEY;
      } else {
        process.env.ADMIN_EMAIL_PREVIEW_KEY = previousAdminPreviewKey;
      }
    }
  });

  it('auth: register succeeds even if registration email enqueue fails', async () => {
    const previousRegistrationEmailFlag = process.env.AUTH_REGISTRATION_EMAIL_ENABLED;
    const previousRedisUrl = process.env.REDIS_URL;
    process.env.AUTH_REGISTRATION_EMAIL_ENABLED = 'true';
    process.env.REDIS_URL = 'not-a-valid-redis-url';

    try {
      const email = `${TEST_EMAIL_PREFIX}${randomUUID()}@synqit.test`;
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        headers: {
          'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8',
        },
        payload: {
          email,
          password: TEST_PASSWORD,
        },
      });

      assert.equal(response.statusCode, 200);
      const body = parseBody(response.body) as { user?: { email: string } };
      assert.equal(body.user?.email, email);
    } finally {
      if (previousRegistrationEmailFlag === undefined) {
        delete process.env.AUTH_REGISTRATION_EMAIL_ENABLED;
      } else {
        process.env.AUTH_REGISTRATION_EMAIL_ENABLED = previousRegistrationEmailFlag;
      }
      if (previousRedisUrl === undefined) {
        delete process.env.REDIS_URL;
      } else {
        process.env.REDIS_URL = previousRedisUrl;
      }
    }
  });

  it('auth: login works via password identity when users.password_hash is null', async () => {
    const email = `${TEST_EMAIL_PREFIX}${randomUUID()}@synqit.test`;
    const registerBody = await registerUser(app, email);

    const identityRows = await prisma.$queryRaw<Array<{ password_hash: string | null }>>`
      SELECT password_hash
      FROM "user_auth_identities"
      WHERE user_id = ${registerBody.user.id}
        AND provider = 'password'
      LIMIT 1
    `;
    assert.equal(identityRows.length, 1);
    assert.ok(identityRows[0]?.password_hash);

    await prisma.users.update({
      where: { id: registerBody.user.id },
      data: {
        password_hash: null,
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {
        email,
        password: TEST_PASSWORD,
      },
    });

    assert.equal(loginResponse.statusCode, 200);
  });

  it('auth: personal info, avatar, and password change flows work', async () => {
    const email = `${TEST_EMAIL_PREFIX}${randomUUID()}@synqit.test`;
    const registerBody = await registerUser(app, email);
    const accessToken = registerBody.tokens.accessToken;

    const initialPersonalInfoResponse = await app.inject({
      method: 'GET',
      url: '/v1/auth/personal-info',
      headers: authHeader(accessToken),
    });
    assert.equal(initialPersonalInfoResponse.statusCode, 200);
    const initialPersonalInfoBody = parseBody(initialPersonalInfoResponse.body) as {
      personalInfo: {
        displayName: string | null;
        firstName: string | null;
        lastName: string | null;
        birthDate: string | null;
        country: string | null;
      };
    };
    assert.deepEqual(initialPersonalInfoBody.personalInfo, {
      displayName: null,
      firstName: null,
      lastName: null,
      birthDate: null,
      country: null,
    });

    const updatePersonalInfoResponse = await app.inject({
      method: 'PUT',
      url: '/v1/auth/personal-info',
      headers: authHeader(accessToken),
      payload: {
        displayName: 'Regression Host',
        firstName: 'Regression',
        lastName: 'Tester',
        birthDate: '1990-05-12',
        country: 'France',
      },
    });
    assert.equal(updatePersonalInfoResponse.statusCode, 200);
    const updatePersonalInfoBody = parseBody(updatePersonalInfoResponse.body) as {
      personalInfo: {
        displayName: string | null;
        firstName: string | null;
        lastName: string | null;
        birthDate: string | null;
        country: string | null;
      };
    };
    assert.deepEqual(updatePersonalInfoBody.personalInfo, {
      displayName: 'Regression Host',
      firstName: 'Regression',
      lastName: 'Tester',
      birthDate: '1990-05-12',
      country: 'France',
    });

    const clearPersonalInfoResponse = await app.inject({
      method: 'DELETE',
      url: '/v1/auth/personal-info',
      headers: authHeader(accessToken),
    });
    assert.equal(clearPersonalInfoResponse.statusCode, 200);
    const clearPersonalInfoBody = parseBody(clearPersonalInfoResponse.body) as {
      personalInfo: {
        displayName: string | null;
        firstName: string | null;
        lastName: string | null;
        birthDate: string | null;
        country: string | null;
      };
    };
    assert.deepEqual(clearPersonalInfoBody.personalInfo, {
      displayName: null,
      firstName: null,
      lastName: null,
      birthDate: null,
      country: null,
    });

    const uploadAvatarResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/avatar',
      headers: authHeader(accessToken),
      payload: {
        imageDataUrl: TINY_PNG_DATA_URL,
      },
    });
    assert.equal(uploadAvatarResponse.statusCode, 200);
    const uploadAvatarBody = parseBody(uploadAvatarResponse.body) as {
      user: { avatarUrl: string | null };
    };
    assert.ok(uploadAvatarBody.user.avatarUrl);

    const avatarUrl = new URL(uploadAvatarBody.user.avatarUrl as string);
    const avatarPublicResponse = await app.inject({
      method: 'GET',
      url: avatarUrl.pathname,
    });
    assert.equal(avatarPublicResponse.statusCode, 200);
    assert.equal(avatarPublicResponse.headers['content-type'], 'image/png');

    const removeAvatarResponse = await app.inject({
      method: 'DELETE',
      url: '/v1/auth/avatar',
      headers: authHeader(accessToken),
    });
    assert.equal(removeAvatarResponse.statusCode, 200);
    const removeAvatarBody = parseBody(removeAvatarResponse.body) as {
      user: { avatarUrl: string | null };
    };
    assert.equal(removeAvatarBody.user.avatarUrl, null);

    const wrongCurrentPasswordResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/change-password',
      headers: authHeader(accessToken),
      payload: {
        currentPassword: 'WrongPassword999!',
        newPassword: UPDATED_TEST_PASSWORD,
      },
    });
    assert.equal(wrongCurrentPasswordResponse.statusCode, 401);

    const changePasswordResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/change-password',
      headers: authHeader(accessToken),
      payload: {
        currentPassword: TEST_PASSWORD,
        newPassword: UPDATED_TEST_PASSWORD,
      },
    });
    assert.equal(changePasswordResponse.statusCode, 200);

    const loginWithOldPasswordResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {
        email,
        password: TEST_PASSWORD,
      },
    });
    assert.equal(loginWithOldPasswordResponse.statusCode, 401);

    const loginWithNewPasswordResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {
        email,
        password: UPDATED_TEST_PASSWORD,
      },
    });
    assert.equal(loginWithNewPasswordResponse.statusCode, 200);
  });

  it('events: draft CRUD flow works', async () => {
    const email = `${TEST_EMAIL_PREFIX}${randomUUID()}@synqit.test`;
    const registerBody = await registerUser(app, email);
    const accessToken = registerBody.tokens.accessToken;

    const initialDraftListResponse = await app.inject({
      method: 'GET',
      url: '/v1/events/drafts',
      headers: authHeader(accessToken),
    });
    assert.equal(initialDraftListResponse.statusCode, 200);
    const initialDraftListBody = parseBody(initialDraftListResponse.body) as {
      drafts: Array<{ id: string }>;
    };
    assert.equal(initialDraftListBody.drafts.length, 0);

    const createDraftResponse = await app.inject({
      method: 'POST',
      url: '/v1/events/drafts',
      headers: authHeader(accessToken),
      payload: {
        provider: 'spotify',
        name: 'Draft Event',
        description: 'Draft description',
        step: 2,
      },
    });
    assert.equal(createDraftResponse.statusCode, 200);
    const createDraftBody = parseBody(createDraftResponse.body) as {
      draft: {
        id: string;
        provider: string | null;
        name: string;
        description: string;
        step: number;
      };
    };
    assert.equal(createDraftBody.draft.provider, 'spotify');
    assert.equal(createDraftBody.draft.name, 'Draft Event');
    assert.equal(createDraftBody.draft.description, 'Draft description');
    assert.equal(createDraftBody.draft.step, 2);

    const draftId = createDraftBody.draft.id;
    assert.ok(draftId);

    const getDraftResponse = await app.inject({
      method: 'GET',
      url: `/v1/events/drafts/${draftId}`,
      headers: authHeader(accessToken),
    });
    assert.equal(getDraftResponse.statusCode, 200);

    const updateDraftResponse = await app.inject({
      method: 'PATCH',
      url: `/v1/events/drafts/${draftId}`,
      headers: authHeader(accessToken),
      payload: {
        name: 'Draft Event Updated',
        description: 'Updated description',
        step: 3,
      },
    });
    assert.equal(updateDraftResponse.statusCode, 200);
    const updateDraftBody = parseBody(updateDraftResponse.body) as {
      draft: {
        name: string;
        description: string;
        step: number;
      };
    };
    assert.equal(updateDraftBody.draft.name, 'Draft Event Updated');
    assert.equal(updateDraftBody.draft.description, 'Updated description');
    assert.equal(updateDraftBody.draft.step, 3);

    const draftListAfterUpdateResponse = await app.inject({
      method: 'GET',
      url: '/v1/events/drafts',
      headers: authHeader(accessToken),
    });
    assert.equal(draftListAfterUpdateResponse.statusCode, 200);
    const draftListAfterUpdateBody = parseBody(draftListAfterUpdateResponse.body) as {
      drafts: Array<{ id: string }>;
    };
    assert.equal(draftListAfterUpdateBody.drafts.length, 1);
    assert.equal(draftListAfterUpdateBody.drafts[0]?.id, draftId);

    const deleteDraftResponse = await app.inject({
      method: 'DELETE',
      url: `/v1/events/drafts/${draftId}`,
      headers: authHeader(accessToken),
    });
    assert.equal(deleteDraftResponse.statusCode, 200);
    const deleteDraftBody = parseBody(deleteDraftResponse.body) as {
      ok: boolean;
      id: string;
    };
    assert.equal(deleteDraftBody.ok, true);
    assert.equal(deleteDraftBody.id, draftId);

    const getDeletedDraftResponse = await app.inject({
      method: 'GET',
      url: `/v1/events/drafts/${draftId}`,
      headers: authHeader(accessToken),
    });
    assert.equal(getDeletedDraftResponse.statusCode, 404);
  });

  it('integrations: oauth state, connect, list, disconnect', async () => {
    const email = `${TEST_EMAIL_PREFIX}${randomUUID()}@synqit.test`;
    const registerBody = await registerUser(app, email);

    const initialListResponse = await app.inject({
      method: 'GET',
      url: '/v1/integrations',
      headers: authHeader(registerBody.tokens.accessToken),
    });
    assert.equal(initialListResponse.statusCode, 200);
    const initialListBody = parseBody(initialListResponse.body) as {
      integrations: Array<{ provider: string; status: string }>;
    };
    for (const provider of providerSchema.options) {
      const current = initialListBody.integrations.find((item) => item.provider === provider);
      assert.ok(current);
      assert.equal(current?.status, 'not_connected');
    }

    const startResponse = await app.inject({
      method: 'GET',
      url: '/v1/auth/spotify/start',
      headers: authHeader(registerBody.tokens.accessToken),
    });
    assert.equal(startResponse.statusCode, 200);
    const startBody = parseBody(startResponse.body) as { state: string };
    assert.ok(startBody.state);

    const oauthState = await prisma.oauth_states.findUnique({
      where: { state: startBody.state },
    });
    assert.ok(oauthState);

    const callbackResponse = await app.inject({
      method: 'GET',
      url: `/v1/auth/spotify/callback?state=${encodeURIComponent(startBody.state)}&code=test-code&response_mode=json`,
    });
    assert.equal(callbackResponse.statusCode, 200);

    const connectedListResponse = await app.inject({
      method: 'GET',
      url: '/v1/integrations',
      headers: authHeader(registerBody.tokens.accessToken),
    });
    assert.equal(connectedListResponse.statusCode, 200);
    const connectedListBody = parseBody(connectedListResponse.body) as {
      integrations: Array<{ provider: string; status: string }>;
    };
    assert.equal(
      connectedListBody.integrations.find((item) => item.provider === 'spotify')?.status,
      'connected',
    );
    assert.equal(
      connectedListBody.integrations.find((item) => item.provider === 'apple')?.status,
      'not_connected',
    );

    const disconnectResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/spotify/disconnect',
      headers: authHeader(registerBody.tokens.accessToken),
    });
    assert.equal(disconnectResponse.statusCode, 200);
    const disconnectBody = parseBody(disconnectResponse.body) as { disconnected: boolean };
    assert.equal(disconnectBody.disconnected, true);
  });

  it('events: host and guest flow with magic link and tracks', async () => {
    const email = `${TEST_EMAIL_PREFIX}${randomUUID()}@synqit.test`;
    const registerBody = await registerUser(app, email);
    const hostAccessToken = registerBody.tokens.accessToken;

    await connectProvider(app, {
      provider: 'spotify',
      accessToken: hostAccessToken,
    });

    const createEventResponse = await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: authHeader(hostAccessToken),
      payload: {
        name: 'Regression Event',
        description: 'Event for API regression tests',
      },
    });
    assert.equal(createEventResponse.statusCode, 200);
    const createEventBody = parseBody(createEventResponse.body) as {
      event: { id: string; magicLinkToken: string; name: string };
    };
    assert.equal(createEventBody.event.name, 'Regression Event');

    const eventId = createEventBody.event.id;
    const firstMagicLinkToken = createEventBody.event.magicLinkToken;
    assert.ok(eventId);
    assert.ok(firstMagicLinkToken);

    const updateEventResponse = await app.inject({
      method: 'PATCH',
      url: `/v1/events/${eventId}`,
      headers: authHeader(hostAccessToken),
      payload: {
        name: 'Regression Event Updated',
        description: 'Updated description',
      },
    });
    assert.equal(updateEventResponse.statusCode, 200);

    const addTrackResponse = await app.inject({
      method: 'POST',
      url: `/v1/events/link/${firstMagicLinkToken}/tracks`,
      payload: {
        providerTrackId: 'mock-track-1',
        name: 'Midnight Drive',
        artist: 'Neon Avenue',
        album: 'City Lights',
        durationMs: 203000,
        artworkUrl: null,
      },
    });
    assert.equal(addTrackResponse.statusCode, 200);

    const addDuplicateTrackResponse = await app.inject({
      method: 'POST',
      url: `/v1/events/link/${firstMagicLinkToken}/tracks`,
      payload: {
        providerTrackId: 'mock-track-1',
        name: 'Midnight Drive',
        artist: 'Neon Avenue',
        album: 'City Lights',
        durationMs: 203000,
        artworkUrl: null,
      },
    });
    assert.equal(addDuplicateTrackResponse.statusCode, 409);

    const hostTracksResponse = await app.inject({
      method: 'GET',
      url: `/v1/events/${eventId}/tracks`,
      headers: authHeader(hostAccessToken),
    });
    assert.equal(hostTracksResponse.statusCode, 200);
    const hostTracksBody = parseBody(hostTracksResponse.body) as {
      tracks: Array<{ providerTrackId: string }>;
    };
    assert.equal(hostTracksBody.tracks.length, 1);
    assert.equal(hostTracksBody.tracks[0]?.providerTrackId, 'mock-track-1');

    const removeTrackResponse = await app.inject({
      method: 'DELETE',
      url: `/v1/events/${eventId}/tracks/mock-track-1`,
      headers: authHeader(hostAccessToken),
    });
    assert.equal(removeTrackResponse.statusCode, 200);

    const revokeMagicLinkResponse = await app.inject({
      method: 'POST',
      url: `/v1/events/${eventId}/magic-link/revoke`,
      headers: authHeader(hostAccessToken),
    });
    assert.equal(revokeMagicLinkResponse.statusCode, 200);

    const revokedLinkResponse = await app.inject({
      method: 'GET',
      url: `/v1/events/link/${firstMagicLinkToken}`,
    });
    assert.equal(revokedLinkResponse.statusCode, 410);

    const regenerateMagicLinkResponse = await app.inject({
      method: 'POST',
      url: `/v1/events/${eventId}/magic-link/regenerate`,
      headers: authHeader(hostAccessToken),
    });
    assert.equal(regenerateMagicLinkResponse.statusCode, 200);
    const regenerateMagicLinkBody = parseBody(regenerateMagicLinkResponse.body) as {
      event: { magicLinkToken: string };
    };
    const secondMagicLinkToken = regenerateMagicLinkBody.event.magicLinkToken;
    assert.ok(secondMagicLinkToken);
    assert.notEqual(secondMagicLinkToken, firstMagicLinkToken);

    const closeEventResponse = await app.inject({
      method: 'POST',
      url: `/v1/events/${eventId}/close`,
      headers: authHeader(hostAccessToken),
    });
    assert.equal(closeEventResponse.statusCode, 200);

    const closedEventAddTrackResponse = await app.inject({
      method: 'POST',
      url: `/v1/events/link/${secondMagicLinkToken}/tracks`,
      payload: {
        providerTrackId: 'mock-track-2',
        name: 'Golden Hour',
        artist: 'Summer Static',
        album: 'Sunset Signals',
        durationMs: 187000,
        artworkUrl: null,
      },
    });
    assert.equal(closedEventAddTrackResponse.statusCode, 409);

    const deleteEventResponse = await app.inject({
      method: 'DELETE',
      url: `/v1/events/${eventId}`,
      headers: authHeader(hostAccessToken),
    });
    assert.equal(deleteEventResponse.statusCode, 200);

    const deletedEventGetResponse = await app.inject({
      method: 'GET',
      url: `/v1/events/${eventId}`,
      headers: authHeader(hostAccessToken),
    });
    assert.equal(deletedEventGetResponse.statusCode, 404);
  });

  it('events: apple host flow supports guest add/remove with provider selection', async () => {
    const email = `${TEST_EMAIL_PREFIX}${randomUUID()}@synqit.test`;
    const registerBody = await registerUser(app, email);
    const hostAccessToken = registerBody.tokens.accessToken;

    await connectProvider(app, {
      provider: 'apple',
      accessToken: hostAccessToken,
    });

    const createEventResponse = await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: authHeader(hostAccessToken),
      payload: {
        provider: 'apple',
        name: 'Apple Event',
        description: 'Apple provider event flow test',
      },
    });
    assert.equal(createEventResponse.statusCode, 200);
    const createEventBody = parseBody(createEventResponse.body) as {
      event: { id: string; provider: string; magicLinkToken: string };
    };
    assert.equal(createEventBody.event.provider, 'apple');
    assert.ok(createEventBody.event.magicLinkToken);

    const addTrackResponse = await app.inject({
      method: 'POST',
      url: `/v1/events/link/${createEventBody.event.magicLinkToken}/tracks`,
      payload: {
        providerTrackId: 'mock-track-2',
        name: 'Golden Hour',
        artist: 'Summer Static',
        album: 'Sunset Signals',
        durationMs: 187000,
        artworkUrl: null,
      },
    });
    assert.equal(addTrackResponse.statusCode, 200);

    const hostTracksResponse = await app.inject({
      method: 'GET',
      url: `/v1/events/${createEventBody.event.id}/tracks`,
      headers: authHeader(hostAccessToken),
    });
    assert.equal(hostTracksResponse.statusCode, 200);
    const hostTracksBody = parseBody(hostTracksResponse.body) as {
      tracks: Array<{ providerTrackId: string }>;
    };
    assert.equal(hostTracksBody.tracks.length, 1);
    assert.equal(hostTracksBody.tracks[0]?.providerTrackId, 'mock-track-2');

    const removeTrackResponse = await app.inject({
      method: 'DELETE',
      url: `/v1/events/${createEventBody.event.id}/tracks/mock-track-2`,
      headers: authHeader(hostAccessToken),
    });
    assert.equal(removeTrackResponse.statusCode, 200);
  });

  it('events: missing provider playlist is reconciled by closing the event', async () => {
    const previousClientId = process.env.SPOTIFY_CLIENT_ID;
    const previousClientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    const previousTokenUrl = process.env.SPOTIFY_TOKEN_URL;
    const originalFetch = globalThis.fetch;
    const providerPlaylistId = `missing-playlist-${randomUUID()}`;

    process.env.SPOTIFY_CLIENT_ID = 'regression-live-client-id';
    process.env.SPOTIFY_CLIENT_SECRET = 'regression-live-client-secret';
    process.env.SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = typeof input === 'string' ? input : input.toString();
      const method = (init?.method ?? 'GET').toUpperCase();

      if (requestUrl === process.env.SPOTIFY_TOKEN_URL && method === 'POST') {
        return new Response(
          JSON.stringify({
            access_token: 'mock-access-token',
            token_type: 'Bearer',
            scope: 'playlist-read-private playlist-modify-private playlist-modify-public',
            expires_in: 3600,
            refresh_token: 'mock-refresh-token',
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          },
        );
      }

      if (requestUrl === 'https://api.spotify.com/v1/me/playlists' && method === 'POST') {
        return new Response(
          JSON.stringify({
            id: providerPlaylistId,
          }),
          {
            status: 201,
            headers: {
              'content-type': 'application/json',
            },
          },
        );
      }

      if (
        requestUrl ===
          `https://api.spotify.com/v1/playlists/${encodeURIComponent(providerPlaylistId)}/items` &&
        method === 'POST'
      ) {
        return new Response(
          JSON.stringify({
            error: {
              status: 404,
              message: 'Not found.',
            },
          }),
          {
            status: 404,
            headers: {
              'content-type': 'application/json',
            },
          },
        );
      }

      throw new Error(`Unexpected provider request in regression test: ${method} ${requestUrl}`);
    }) as typeof fetch;

    try {
      const email = `${TEST_EMAIL_PREFIX}${randomUUID()}@synqit.test`;
      const registerBody = await registerUser(app, email);
      const hostAccessToken = registerBody.tokens.accessToken;

      await connectProvider(app, {
        provider: 'spotify',
        accessToken: hostAccessToken,
      });

      const createEventResponse = await app.inject({
        method: 'POST',
        url: '/v1/events',
        headers: authHeader(hostAccessToken),
        payload: {
          name: 'Missing Playlist Regression Event',
          description: 'Event used to verify missing playlist reconciliation.',
        },
      });
      assert.equal(createEventResponse.statusCode, 200);
      const createEventBody = parseBody(createEventResponse.body) as {
        event: { id: string; magicLinkToken: string };
      };
      const eventId = createEventBody.event.id;
      const magicLinkToken = createEventBody.event.magicLinkToken;

      const addTrackResponse = await app.inject({
        method: 'POST',
        url: `/v1/events/link/${magicLinkToken}/tracks`,
        payload: {
          providerTrackId: 'spotify-track-missing-playlist',
          name: 'Any Song',
          artist: 'Any Artist',
          album: 'Any Album',
          durationMs: 180000,
          artworkUrl: null,
        },
      });
      assert.equal(addTrackResponse.statusCode, 409);
      const addTrackBody = parseBody(addTrackResponse.body) as { code: string };
      assert.equal(addTrackBody.code, 'provider_playlist_missing');

      const hostEventResponse = await app.inject({
        method: 'GET',
        url: `/v1/events/${eventId}`,
        headers: authHeader(hostAccessToken),
      });
      assert.equal(hostEventResponse.statusCode, 200);
      const hostEventBody = parseBody(hostEventResponse.body) as {
        event: { status: string };
      };
      assert.equal(hostEventBody.event.status, 'closed');
    } finally {
      globalThis.fetch = originalFetch;
      process.env.SPOTIFY_CLIENT_ID = previousClientId;
      process.env.SPOTIFY_CLIENT_SECRET = previousClientSecret;
      process.env.SPOTIFY_TOKEN_URL = previousTokenUrl;
    }
  });
});
