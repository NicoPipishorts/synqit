import { EnvValidationError, providerSchema } from '@synqit/shared';
import type { FastifyInstance } from 'fastify';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';

import { createRefreshToken, hashPassword, hashToken } from './auth/crypto';
import { authStore } from './auth/store';
import { loadApiConfig } from './config';
import { closeDatabase } from './db';
import { prisma } from './db/prisma';
import { eventsStore } from './events/store';
import { buildServer } from './index';
import { decryptToken, encryptToken } from './integrations/crypto';
import { notificationRunsStore } from './jobs/notification-runs-store';
import { closeTransfersQueue } from './jobs/transfers-queue';
import { buildWeeklyRecapDigests } from './jobs/weekly-recap-digests';
import { syncsStore } from './syncs/store';

const TEST_EMAIL_PREFIX = 'regression+';
const TEST_PASSWORD = 'Password123!';
// Bootstrap keys and metrics tokens must be >= 32 chars and not look like placeholders.
const REGRESSION_BOOTSTRAP_KEY = 'regression-bootstrap-key-0123456789abcdef';
const REGRESSION_METRICS_TOKEN = 'regression-metrics-token-0123456789abcdef';
const STRONG_TEST_SECRET = 'regression-strong-secret-0123456789abcdefghij';
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

const getSetCookieHeaders = (response: { headers: Record<string, unknown> }): string[] => {
  const value = response.headers['set-cookie'];
  if (Array.isArray(value)) {
    return value.map(String);
  }
  return value ? [String(value)] : [];
};

const getCookieHeader = (response: {
  cookies?: Array<{ name: string; value: string }>;
  headers: Record<string, unknown>;
}): string => {
  if (Array.isArray(response.cookies) && response.cookies.length > 0) {
    return response.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
  }

  return getSetCookieHeaders(response)
    .flatMap((cookie) => cookie.split(/,(?=\s*[^;=]+=[^;]+)/))
    .map((cookie) => cookie.split(';', 1)[0])
    .join('; ');
};

const getCookieValue = (
  response: { cookies?: Array<{ name: string; value: string }>; headers: Record<string, unknown> },
  name: string,
): string | null => {
  if (Array.isArray(response.cookies)) {
    const match = response.cookies.find((cookie) => cookie.name === name);
    if (match) {
      return match.value;
    }
  }

  for (const cookie of getSetCookieHeaders(response)) {
    for (const segment of cookie.split(/,(?=\s*[^;=]+=[^;]+)/)) {
      const [pair] = segment.split(';', 1);
      const separatorIndex = pair.indexOf('=');
      if (separatorIndex <= 0) {
        continue;
      }

      if (pair.slice(0, separatorIndex) !== name) {
        continue;
      }

      const rawValue = pair.slice(separatorIndex + 1);
      try {
        return decodeURIComponent(rawValue);
      } catch {
        return rawValue;
      }
    }
  }

  return null;
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

const createUserAndLogin = async (app: FastifyInstance, email: string) => {
  const user = await authStore.createUser({
    email,
    passwordHash: await hashPassword(TEST_PASSWORD),
  });
  assert.ok(user);

  const refreshToken = createRefreshToken();
  await authStore.createRefreshToken({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
  const accessToken = app.jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    {
      expiresIn: 60 * 15,
    },
  );

  return {
    user: { id: user.id, email: user.email },
    tokens: { accessToken, refreshToken },
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
  let previousRegistrationEmailEnabled: string | undefined;
  let previousPasswordResetEmailEnabled: string | undefined;
  let previousRateLimitMax: string | undefined;
  const previousOpsEnv: Record<string, string | undefined> = {};
  const OPS_ENV_KEYS = [
    'ADMIN_BOOTSTRAP_ENABLED',
    'METRICS_TOKEN',
    'API_DOCS_ENABLED',
    'REGISTER_RATE_LIMIT_MAX',
    'PUBLIC_WRITE_RATE_LIMIT_MAX',
    'ANALYTICS_RATE_LIMIT_MAX',
  ] as const;

  before(async () => {
    previousRegistrationEmailEnabled = process.env.AUTH_REGISTRATION_EMAIL_ENABLED;
    previousPasswordResetEmailEnabled = process.env.AUTH_PASSWORD_RESET_EMAIL_ENABLED;
    previousRateLimitMax = process.env.RATE_LIMIT_MAX;
    for (const key of OPS_ENV_KEYS) {
      previousOpsEnv[key] = process.env[key];
    }

    // Exercise the hardened operational surfaces: bootstrap on, metrics behind a
    // token, docs off (the production defaults, minus the bootstrap switch).
    process.env.ADMIN_BOOTSTRAP_ENABLED = 'true';
    process.env.METRICS_TOKEN = REGRESSION_METRICS_TOKEN;
    process.env.API_DOCS_ENABLED = 'false';
    // The suite registers dozens of accounts and fires many events from one IP;
    // relax the per-IP limiters. The per-account login limiter keeps its default
    // and is exercised directly below.
    process.env.REGISTER_RATE_LIMIT_MAX = '1000';
    process.env.PUBLIC_WRITE_RATE_LIMIT_MAX = '1000';
    process.env.ANALYTICS_RATE_LIMIT_MAX = '1000';

    // Regression must never enqueue real emails, even if local env enables them.
    process.env.AUTH_REGISTRATION_EMAIL_ENABLED = 'false';
    process.env.AUTH_PASSWORD_RESET_EMAIL_ENABLED = 'false';

    process.env.SPOTIFY_CLIENT_ID = 'replace-me';
    process.env.SPOTIFY_CLIENT_SECRET = 'replace-me';
    process.env.SPOTIFY_SCOPES =
      process.env.SPOTIFY_SCOPES ??
      'playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public';
    process.env.APPLE_TEAM_ID = 'replace-me';
    process.env.APPLE_KEY_ID = 'replace-me';
    process.env.APPLE_MUSICKIT_IDENTIFIER = 'replace-me';
    process.env.APPLE_PRIVATE_KEY_P8 = 'replace-me';
    process.env.RATE_LIMIT_MAX = '1000';

    app = await buildServer();
  });

  beforeEach(async () => {
    await cleanupTestData();
  });

  after(async () => {
    await closeTransfersQueue().catch(() => undefined);
    if (previousRegistrationEmailEnabled === undefined) {
      delete process.env.AUTH_REGISTRATION_EMAIL_ENABLED;
    } else {
      process.env.AUTH_REGISTRATION_EMAIL_ENABLED = previousRegistrationEmailEnabled;
    }
    if (previousPasswordResetEmailEnabled === undefined) {
      delete process.env.AUTH_PASSWORD_RESET_EMAIL_ENABLED;
    } else {
      process.env.AUTH_PASSWORD_RESET_EMAIL_ENABLED = previousPasswordResetEmailEnabled;
    }
    if (previousRateLimitMax === undefined) {
      delete process.env.RATE_LIMIT_MAX;
    } else {
      process.env.RATE_LIMIT_MAX = previousRateLimitMax;
    }
    for (const key of OPS_ENV_KEYS) {
      if (previousOpsEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previousOpsEnv[key];
      }
    }

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
    const loginSetCookies = getSetCookieHeaders(loginGoodResponse);
    assert.ok(loginSetCookies.some((value) => value.startsWith('synqit_web_access=')));
    assert.ok(loginSetCookies.some((value) => value.startsWith('synqit_web_refresh=')));
    assert.ok(loginSetCookies.some((value) => value.startsWith('synqit_web_csrf=')));
    const loginGoodBody = parseBody(loginGoodResponse.body) as {
      tokens: { accessToken: string; refreshToken: string };
    };
    const sessionCookieHeader = getCookieHeader(loginGoodResponse);
    const csrfToken = getCookieValue(loginGoodResponse, 'synqit_web_csrf');
    assert.ok(csrfToken);

    const meResponse = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: authHeader(loginGoodBody.tokens.accessToken),
    });
    assert.equal(meResponse.statusCode, 200);
    const meBody = parseBody(meResponse.body) as { email: string };
    assert.equal(meBody.email, email);

    const cookieRefreshResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      headers: {
        cookie: sessionCookieHeader,
        'x-synqit-csrf-token': csrfToken,
      },
    });
    assert.equal(cookieRefreshResponse.statusCode, 200);
    const cookieRefreshBody = parseBody(cookieRefreshResponse.body) as {
      tokens: { refreshToken: string };
    };
    const cookieRefreshSetCookies = getSetCookieHeaders(cookieRefreshResponse);
    assert.ok(cookieRefreshSetCookies.some((value) => value.startsWith('synqit_web_csrf=')));

    const refreshResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: {
        refreshToken: cookieRefreshBody.tokens.refreshToken,
      },
    });
    assert.equal(refreshResponse.statusCode, 200);
    const refreshSetCookies = getSetCookieHeaders(refreshResponse);
    assert.ok(refreshSetCookies.some((value) => value.startsWith('synqit_web_access=')));
    assert.ok(refreshSetCookies.some((value) => value.startsWith('synqit_web_refresh=')));
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

    const cookieRefreshWithoutCsrfResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      headers: {
        cookie: sessionCookieHeader,
      },
    });
    assert.equal(cookieRefreshWithoutCsrfResponse.statusCode, 403);

    const logoutResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      payload: {
        refreshToken: refreshBody.tokens.refreshToken,
      },
    });
    assert.equal(logoutResponse.statusCode, 200);
    const logoutSetCookies = getSetCookieHeaders(logoutResponse);
    assert.ok(logoutSetCookies.some((value) => value.startsWith('synqit_web_access=')));
    assert.ok(logoutSetCookies.some((value) => value.startsWith('synqit_web_refresh=')));

    const cookieLogoutResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: {
        cookie: sessionCookieHeader,
        'x-synqit-csrf-token': csrfToken,
      },
    });
    assert.equal(cookieLogoutResponse.statusCode, 200);

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
    const body = parseBody(response.body) as { code?: string; message?: string };
    assert.equal(body.code, 'validation_error');
    assert.match(body.message ?? '', /special character/i);
  });

  it('auth: forgot/reset password flow updates credentials and invalidates old refresh tokens', async () => {
    const email = `${TEST_EMAIL_PREFIX}${randomUUID()}@synqit.test`;
    const registerBody = await registerUser(app, email);

    const previousResetEmailEnabled = process.env.AUTH_PASSWORD_RESET_EMAIL_ENABLED;
    const previousRedisUrl = process.env.REDIS_URL;
    process.env.AUTH_PASSWORD_RESET_EMAIL_ENABLED = 'true';
    process.env.REDIS_URL = 'not-a-valid-redis-url';
    try {
      const forgotResponse = await app.inject({
        method: 'POST',
        url: '/v1/auth/forgot-password',
        payload: {
          email,
        },
      });
      assert.equal(forgotResponse.statusCode, 200);
    } finally {
      if (previousResetEmailEnabled === undefined) {
        delete process.env.AUTH_PASSWORD_RESET_EMAIL_ENABLED;
      } else {
        process.env.AUTH_PASSWORD_RESET_EMAIL_ENABLED = previousResetEmailEnabled;
      }
      if (previousRedisUrl === undefined) {
        delete process.env.REDIS_URL;
      } else {
        process.env.REDIS_URL = previousRedisUrl;
      }
    }

    const resetToken = `reset-${randomUUID()}-${Date.now()}`;
    const tokenRecord = await authStore.createPasswordResetToken({
      userId: registerBody.user.id,
      tokenHash: hashToken(resetToken),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    assert.ok(tokenRecord);

    const resetResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/reset-password',
      payload: {
        token: resetToken,
        newPassword: UPDATED_TEST_PASSWORD,
      },
    });
    assert.equal(resetResponse.statusCode, 200);

    const refreshedTokenRecord = await prisma.$queryRaw<Array<{ used_at: Date | null }>>`
      SELECT used_at
      FROM "password_reset_tokens"
      WHERE id = ${tokenRecord!.id}
      LIMIT 1
    `;
    assert.equal(refreshedTokenRecord.length, 1);
    assert.ok(refreshedTokenRecord[0]?.used_at);

    const oldLoginResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {
        email,
        password: TEST_PASSWORD,
      },
    });
    assert.equal(oldLoginResponse.statusCode, 401);

    const newLoginResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {
        email,
        password: UPDATED_TEST_PASSWORD,
      },
    });
    assert.equal(newLoginResponse.statusCode, 200);

    const refreshAfterResetResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: {
        refreshToken: registerBody.tokens.refreshToken,
      },
    });
    assert.equal(refreshAfterResetResponse.statusCode, 401);
  });

  it('analytics: ingests events with optional user attribution', async () => {
    const email = `${TEST_EMAIL_PREFIX}${randomUUID()}@synqit.test`;
    const registerBody = await registerUser(app, email);

    const anonymousSessionId = `session-${randomUUID()}`;
    const anonymousResponse = await app.inject({
      method: 'POST',
      url: '/v1/analytics/events',
      payload: {
        eventName: 'app_page_view',
        target: 'navigation',
        sessionId: anonymousSessionId,
        path: '/auth/login',
        source: 'web',
        properties: {
          from: 'regression-test',
        },
      },
    });
    assert.equal(anonymousResponse.statusCode, 202);

    const authenticatedSessionId = `session-${randomUUID()}`;
    const authenticatedResponse = await app.inject({
      method: 'POST',
      url: '/v1/analytics/events',
      headers: authHeader(registerBody.tokens.accessToken),
      payload: {
        eventName: 'event_create_submitted',
        target: 'events',
        sessionId: authenticatedSessionId,
        path: '/playlists/new',
        source: 'web',
        properties: {
          provider: 'spotify',
        },
      },
    });
    assert.equal(authenticatedResponse.statusCode, 202);

    const rows = await prisma.analyticsEvents.findMany({
      where: {
        session_id: {
          in: [anonymousSessionId, authenticatedSessionId],
        },
      },
      select: {
        session_id: true,
        event_name: true,
        target: true,
        user_id: true,
      },
    });

    assert.equal(rows.length, 2);
    const anonymousRow = rows.find((row) => row.session_id === anonymousSessionId);
    assert.ok(anonymousRow);
    assert.equal(anonymousRow?.event_name, 'app_page_view');
    assert.equal(anonymousRow?.target, 'navigation');
    assert.equal(anonymousRow?.user_id, null);

    const authenticatedRow = rows.find((row) => row.session_id === authenticatedSessionId);
    assert.ok(authenticatedRow);
    assert.equal(authenticatedRow?.event_name, 'event_create_submitted');
    assert.equal(authenticatedRow?.target, 'events');
    assert.equal(authenticatedRow?.user_id, registerBody.user.id);
  });

  it('analytics: validates payload and resolves locale header fallback', async () => {
    const invalidPayloadResponse = await app.inject({
      method: 'POST',
      url: '/v1/analytics/events',
      payload: {
        eventName: 'not_a_real_event',
        target: 'navigation',
        sessionId: `session-${randomUUID()}`,
        path: '/dashboard',
        source: 'web',
      },
    });
    assert.equal(invalidPayloadResponse.statusCode, 400);
    const invalidBody = parseBody(invalidPayloadResponse.body) as { code?: string };
    assert.equal(invalidBody.code, 'validation_error');

    const localeSessionId = `session-${randomUUID()}`;
    const localeResponse = await app.inject({
      method: 'POST',
      url: '/v1/analytics/events',
      headers: {
        'x-synqit-locale': 'fr-FR',
      },
      payload: {
        eventName: 'app_page_view',
        target: 'navigation',
        sessionId: localeSessionId,
        path: '/profile',
        source: 'web',
      },
    });
    assert.equal(localeResponse.statusCode, 202);

    const localeRow = await prisma.analyticsEvents.findFirst({
      where: {
        session_id: localeSessionId,
      },
      select: {
        locale: true,
      },
    });
    assert.ok(localeRow);
    assert.equal(localeRow?.locale, 'fr');
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
      url: '/v1/playlists',
      headers: authHeader(accessToken),
    });
    assert.equal(eventsResponse.statusCode, 401);
  });

  it('security: login attempts are throttled per account', async () => {
    const email = `${TEST_EMAIL_PREFIX}${randomUUID()}@synqit.test`;
    await registerUser(app, email);

    const attempt = () =>
      app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email, password: 'definitely-wrong-password' },
      });

    // Default AUTH_RATE_LIMIT_MAX is 10 per IP + email per 15 minutes.
    for (let index = 0; index < 10; index += 1) {
      const response = await attempt();
      assert.equal(response.statusCode, 401, `attempt ${index + 1} should still be evaluated`);
    }

    const throttled = await attempt();
    assert.equal(throttled.statusCode, 429);
    assert.equal((parseBody(throttled.body) as { code: string }).code, 'rate_limited');

    // A different account from the same IP is unaffected.
    const otherEmail = `${TEST_EMAIL_PREFIX}${randomUUID()}@synqit.test`;
    await registerUser(app, otherEmail);
    const otherResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: otherEmail, password: TEST_PASSWORD },
    });
    assert.equal(otherResponse.statusCode, 200);
  });

  it('security: super admin identity requires a full email match', async () => {
    const superEmail = `${TEST_EMAIL_PREFIX}fullmatch@synqit.test`;
    await createUserAndLogin(app, superEmail);

    const previousEnv = {
      ADMIN_SUPER_USERS: process.env.ADMIN_SUPER_USERS,
      ADMIN_BOOTSTRAP_KEY: process.env.ADMIN_BOOTSTRAP_KEY,
      ADMIN_BOOTSTRAP_ALLOW_WHEN_SUPER_ADMIN_EXISTS:
        process.env.ADMIN_BOOTSTRAP_ALLOW_WHEN_SUPER_ADMIN_EXISTS,
    };
    const promote = () =>
      app.inject({
        method: 'POST',
        url: '/v1/admin/bootstrap/promote',
        headers: { 'x-admin-bootstrap-key': REGRESSION_BOOTSTRAP_KEY },
        payload: { email: superEmail },
      });
    const scopesOf = (body: string) =>
      (
        parseBody(body) as { user: { adminPermissions: { scope: string }[] } }
      ).user.adminPermissions.map((permission) => permission.scope);

    try {
      process.env.ADMIN_BOOTSTRAP_KEY = REGRESSION_BOOTSTRAP_KEY;
      process.env.ADMIN_BOOTSTRAP_ALLOW_WHEN_SUPER_ADMIN_EXISTS = 'true';

      // Local-part only: previously matched any domain, now grants standard permissions.
      process.env.ADMIN_SUPER_USERS = `${TEST_EMAIL_PREFIX}fullmatch`;
      const localPartResponse = await promote();
      assert.equal(localPartResponse.statusCode, 200);
      assert.ok(!scopesOf(localPartResponse.body).includes('admin_users'));

      // Same local part on another domain must not match either.
      process.env.ADMIN_SUPER_USERS = `${TEST_EMAIL_PREFIX}fullmatch@evil.example`;
      const otherDomainResponse = await promote();
      assert.equal(otherDomainResponse.statusCode, 200);
      assert.ok(!scopesOf(otherDomainResponse.body).includes('admin_users'));

      // Full email match grants super admin permissions.
      process.env.ADMIN_SUPER_USERS = superEmail;
      const fullMatchResponse = await promote();
      assert.equal(fullMatchResponse.statusCode, 200);
      assert.ok(scopesOf(fullMatchResponse.body).includes('admin_users'));

      // Config validation refuses local-part entries in strict mode.
      assert.throws(
        () =>
          loadApiConfig({
            NODE_ENV: 'production',
            DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
            JWT_ACCESS_SECRET: STRONG_TEST_SECRET,
            TOKEN_ENC_KEY: STRONG_TEST_SECRET,
            METRICS_TOKEN: REGRESSION_METRICS_TOKEN,
            ADMIN_SUPER_USERS: 'shamanproto',
          }),
        (error: unknown) =>
          error instanceof EnvValidationError && error.variable === 'ADMIN_SUPER_USERS',
      );
    } finally {
      for (const [key, value] of Object.entries(previousEnv)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
      await prisma.admin_audit_logs.deleteMany({
        where: { action: { in: ['admin_bootstrap_promote', 'admin_bootstrap_rejected'] } },
      });
    }
  });

  it('security: analytics properties are bounded in keys and size', async () => {
    const base = {
      eventName: 'app_page_view',
      target: 'navigation',
      sessionId: `session-${randomUUID()}`,
      path: '/dashboard',
      source: 'web',
    };

    const tooManyKeys = Object.fromEntries(
      Array.from({ length: 21 }, (_, index) => [`key_${index}`, index]),
    );
    const tooManyKeysResponse = await app.inject({
      method: 'POST',
      url: '/v1/analytics/events',
      payload: { ...base, properties: tooManyKeys },
    });
    assert.equal(tooManyKeysResponse.statusCode, 400);

    const tooLargeResponse = await app.inject({
      method: 'POST',
      url: '/v1/analytics/events',
      payload: { ...base, properties: { blob: 'x'.repeat(2_100) } },
    });
    assert.equal(tooLargeResponse.statusCode, 400);

    const okResponse = await app.inject({
      method: 'POST',
      url: '/v1/analytics/events',
      payload: { ...base, properties: { provider: 'spotify', step: 2 } },
    });
    assert.equal(okResponse.statusCode, 202);
  });

  it('config: env validation rejects missing and weak secrets in strict mode', () => {
    const baseEnv = {
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      JWT_ACCESS_SECRET: STRONG_TEST_SECRET,
      TOKEN_ENC_KEY: STRONG_TEST_SECRET,
      ADMIN_SUPER_USERS: 'ops@synqit.test',
    };
    const isEnvError = (variable: string) => (error: unknown) =>
      error instanceof EnvValidationError && error.variable === variable;

    // Missing secrets are always fatal, strict or not.
    assert.throws(
      () => loadApiConfig({ ...baseEnv, JWT_ACCESS_SECRET: undefined }),
      isEnvError('JWT_ACCESS_SECRET'),
    );
    assert.throws(
      () => loadApiConfig({ ...baseEnv, DATABASE_URL: undefined }),
      isEnvError('DATABASE_URL'),
    );

    // Placeholders and short values are warnings in dev...
    const lenient = loadApiConfig({ ...baseEnv, TOKEN_ENC_KEY: 'replace-me' });
    assert.equal(lenient.strictSecrets, false);
    assert.equal(lenient.docsEnabled, true);
    assert.ok(lenient.warnings.some((warning) => warning.includes('TOKEN_ENC_KEY')));

    // ...and fatal in production or when SECRETS_STRICT=true.
    assert.throws(
      () => loadApiConfig({ ...baseEnv, NODE_ENV: 'production', TOKEN_ENC_KEY: 'replace-me' }),
      isEnvError('TOKEN_ENC_KEY'),
    );
    assert.throws(
      () => loadApiConfig({ ...baseEnv, SECRETS_STRICT: 'true', JWT_ACCESS_SECRET: 'short' }),
      isEnvError('JWT_ACCESS_SECRET'),
    );
    assert.throws(
      () => loadApiConfig({ ...baseEnv, NODE_ENV: 'production', METRICS_TOKEN: 'replace-me' }),
      isEnvError('METRICS_TOKEN'),
    );

    // Production requires an explicit super admin list of full emails.
    assert.throws(
      () => loadApiConfig({ ...baseEnv, NODE_ENV: 'production', ADMIN_SUPER_USERS: undefined }),
      isEnvError('ADMIN_SUPER_USERS'),
    );

    // Production defaults: docs off, metrics disabled (with a warning) until a token exists.
    const production = loadApiConfig({ ...baseEnv, NODE_ENV: 'production' });
    assert.equal(production.strictSecrets, true);
    assert.equal(production.docsEnabled, false);
    assert.equal(production.metricsToken, null);
    assert.ok(production.warnings.some((warning) => warning.includes('METRICS_TOKEN')));

    const productionWithDocs = loadApiConfig({
      ...baseEnv,
      NODE_ENV: 'production',
      API_DOCS_ENABLED: 'true',
      METRICS_TOKEN: REGRESSION_METRICS_TOKEN,
    });
    assert.equal(productionWithDocs.docsEnabled, true);
    assert.equal(productionWithDocs.metricsToken, REGRESSION_METRICS_TOKEN);
  });

  it('config: TOKEN_ENC_KEY rotation decrypts old tokens via TOKEN_ENC_KEY_PREVIOUS', () => {
    const previousKey = process.env.TOKEN_ENC_KEY;
    const previousPreviousKey = process.env.TOKEN_ENC_KEY_PREVIOUS;
    const oldSecret = `${STRONG_TEST_SECRET}-old`;
    const newSecret = `${STRONG_TEST_SECRET}-new`;
    try {
      process.env.TOKEN_ENC_KEY = oldSecret;
      delete process.env.TOKEN_ENC_KEY_PREVIOUS;
      const encryptedWithOld = encryptToken('provider-access-token');
      assert.equal(decryptToken(encryptedWithOld), 'provider-access-token');

      // Rotate: new key active, old key kept for reads only.
      process.env.TOKEN_ENC_KEY = newSecret;
      assert.throws(
        () => decryptToken(encryptedWithOld),
        'old ciphertext must not decrypt without the previous key',
      );

      process.env.TOKEN_ENC_KEY_PREVIOUS = oldSecret;
      assert.equal(decryptToken(encryptedWithOld), 'provider-access-token');

      const encryptedWithNew = encryptToken('refreshed-token');
      delete process.env.TOKEN_ENC_KEY_PREVIOUS;
      assert.equal(decryptToken(encryptedWithNew), 'refreshed-token', 'new writes use the new key');
    } finally {
      if (previousKey === undefined) {
        delete process.env.TOKEN_ENC_KEY;
      } else {
        process.env.TOKEN_ENC_KEY = previousKey;
      }
      if (previousPreviousKey === undefined) {
        delete process.env.TOKEN_ENC_KEY_PREVIOUS;
      } else {
        process.env.TOKEN_ENC_KEY_PREVIOUS = previousPreviousKey;
      }
    }
  });

  it('ops: /metrics requires the bearer token and /docs is not mounted when disabled', async () => {
    const anonymousMetricsResponse = await app.inject({ method: 'GET', url: '/metrics' });
    assert.equal(anonymousMetricsResponse.statusCode, 401);

    const wrongTokenResponse = await app.inject({
      method: 'GET',
      url: '/metrics',
      headers: { authorization: 'Bearer not-the-token' },
    });
    assert.equal(wrongTokenResponse.statusCode, 401);

    const metricsResponse = await app.inject({
      method: 'GET',
      url: '/metrics',
      headers: { authorization: `Bearer ${REGRESSION_METRICS_TOKEN}` },
    });
    assert.equal(metricsResponse.statusCode, 200);
    assert.match(metricsResponse.body, /synqit_http_requests_total/);

    const docsResponse = await app.inject({ method: 'GET', url: '/docs' });
    assert.equal(docsResponse.statusCode, 404);
    const docsJsonResponse = await app.inject({ method: 'GET', url: '/docs/json' });
    assert.equal(docsJsonResponse.statusCode, 404);

    const healthResponse = await app.inject({ method: 'GET', url: '/healthz' });
    assert.equal(healthResponse.statusCode, 200);
  });

  it('admin: bootstrap is gated, key-checked, audited, and locks once a super admin exists', async () => {
    const superAdminEmail = `${TEST_EMAIL_PREFIX}bootstrap-super@synqit.test`;
    const otherEmail = `${TEST_EMAIL_PREFIX}${randomUUID()}@synqit.test`;
    await createUserAndLogin(app, superAdminEmail);
    await createUserAndLogin(app, otherEmail);

    const previousEnv = {
      ADMIN_BOOTSTRAP_ENABLED: process.env.ADMIN_BOOTSTRAP_ENABLED,
      ADMIN_BOOTSTRAP_KEY: process.env.ADMIN_BOOTSTRAP_KEY,
      ADMIN_BOOTSTRAP_ALLOW_WHEN_SUPER_ADMIN_EXISTS:
        process.env.ADMIN_BOOTSTRAP_ALLOW_WHEN_SUPER_ADMIN_EXISTS,
      ADMIN_SUPER_USERS: process.env.ADMIN_SUPER_USERS,
    };
    const restoreEnv = () => {
      for (const [key, value] of Object.entries(previousEnv)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    };

    const promote = (email: string, key: string | undefined) =>
      app.inject({
        method: 'POST',
        url: '/v1/admin/bootstrap/promote',
        headers: key ? { 'x-admin-bootstrap-key': key } : undefined,
        payload: { email },
      });
    const codeOf = (body: string) => (parseBody(body) as { code: string }).code;

    try {
      process.env.ADMIN_SUPER_USERS = superAdminEmail;
      process.env.ADMIN_BOOTSTRAP_KEY = REGRESSION_BOOTSTRAP_KEY;
      delete process.env.ADMIN_BOOTSTRAP_ALLOW_WHEN_SUPER_ADMIN_EXISTS;

      // Disabled by default: the route hides itself.
      process.env.ADMIN_BOOTSTRAP_ENABLED = 'false';
      const disabledResponse = await promote(superAdminEmail, REGRESSION_BOOTSTRAP_KEY);
      assert.equal(disabledResponse.statusCode, 404);
      assert.equal(codeOf(disabledResponse.body), 'admin_bootstrap_disabled');

      process.env.ADMIN_BOOTSTRAP_ENABLED = 'true';

      // A placeholder or short key is refused even if the caller knows it.
      process.env.ADMIN_BOOTSTRAP_KEY = 'replace-me';
      const weakKeyResponse = await promote(superAdminEmail, 'replace-me');
      assert.equal(weakKeyResponse.statusCode, 503);
      assert.equal(codeOf(weakKeyResponse.body), 'admin_bootstrap_not_configured');

      process.env.ADMIN_BOOTSTRAP_KEY = REGRESSION_BOOTSTRAP_KEY;
      const wrongKeyResponse = await promote(
        superAdminEmail,
        'definitely-not-the-right-key-000000',
      );
      assert.equal(wrongKeyResponse.statusCode, 403);
      const missingKeyResponse = await promote(superAdminEmail, undefined);
      assert.equal(missingKeyResponse.statusCode, 403);

      // First super admin promotion succeeds and is audited.
      const promotedResponse = await promote(superAdminEmail, REGRESSION_BOOTSTRAP_KEY);
      assert.equal(promotedResponse.statusCode, 200);
      const promotedAudit = await prisma.admin_audit_logs.findFirst({
        where: { action: 'admin_bootstrap_promote', target_email: superAdminEmail },
      });
      assert.ok(promotedAudit, 'expected an audit log row for the bootstrap promotion');
      const rejectedAudit = await prisma.admin_audit_logs.findFirst({
        where: { action: 'admin_bootstrap_rejected', reason: 'invalid_key' },
      });
      assert.ok(rejectedAudit, 'expected rejected bootstrap attempts to be audited');

      // Once a super admin exists, bootstrap locks itself.
      const lockedResponse = await promote(otherEmail, REGRESSION_BOOTSTRAP_KEY);
      assert.equal(lockedResponse.statusCode, 409);
      assert.equal(codeOf(lockedResponse.body), 'admin_bootstrap_locked');

      // ...unless explicitly re-enabled by the operator.
      process.env.ADMIN_BOOTSTRAP_ALLOW_WHEN_SUPER_ADMIN_EXISTS = 'true';
      const reenabledResponse = await promote(otherEmail, REGRESSION_BOOTSTRAP_KEY);
      assert.equal(reenabledResponse.statusCode, 200);
    } finally {
      restoreEnv();
      await prisma.admin_audit_logs.deleteMany({
        where: { action: { in: ['admin_bootstrap_promote', 'admin_bootstrap_rejected'] } },
      });
    }
  });

  it('admin: login requires admin role and RBAC blocks unauthorized actions', async () => {
    const hostEmail = `${TEST_EMAIL_PREFIX}${randomUUID()}@synqit.test`;
    await registerUser(app, hostEmail);

    const nonAdminLoginResponse = await app.inject({
      method: 'POST',
      url: '/v1/admin/auth/login',
      payload: {
        email: hostEmail,
        password: TEST_PASSWORD,
      },
    });
    assert.equal(nonAdminLoginResponse.statusCode, 403);

    const previousBootstrapKey = process.env.ADMIN_BOOTSTRAP_KEY;
    const previousSuperUsers = process.env.ADMIN_SUPER_USERS;
    const superAdminEmail = `${TEST_EMAIL_PREFIX}super-admin@synqit.test`;
    process.env.ADMIN_BOOTSTRAP_KEY = REGRESSION_BOOTSTRAP_KEY;
    process.env.ADMIN_SUPER_USERS = superAdminEmail;
    try {
      await createUserAndLogin(app, superAdminEmail);

      const bootstrapResponse = await app.inject({
        method: 'POST',
        url: '/v1/admin/bootstrap/promote',
        headers: {
          'x-admin-bootstrap-key': process.env.ADMIN_BOOTSTRAP_KEY,
        },
        payload: {
          email: superAdminEmail,
        },
      });
      assert.equal(bootstrapResponse.statusCode, 200);

      const adminLoginResponse = await app.inject({
        method: 'POST',
        url: '/v1/admin/auth/login',
        payload: {
          email: superAdminEmail,
          password: TEST_PASSWORD,
        },
      });
      assert.equal(adminLoginResponse.statusCode, 200);
      const adminLoginBody = parseBody(adminLoginResponse.body) as {
        tokens: { accessToken: string };
      };

      const usersResponse = await app.inject({
        method: 'GET',
        url: '/v1/admin/users',
        headers: authHeader(adminLoginBody.tokens.accessToken),
      });
      assert.equal(usersResponse.statusCode, 200);

      const limitedEmail = `${TEST_EMAIL_PREFIX}${randomUUID()}@synqit.test`;
      const limitedUser = await registerUser(app, limitedEmail);
      const grantLimitedAdminResponse = await app.inject({
        method: 'PUT',
        url: `/v1/admin/users/${limitedUser.user.id}/access`,
        headers: authHeader(adminLoginBody.tokens.accessToken),
        payload: {
          role: 'admin',
          adminPermissions: [
            {
              scope: 'dashboard',
              level: 'read',
            },
          ],
        },
      });
      assert.equal(grantLimitedAdminResponse.statusCode, 200);

      const limitedAdminLoginResponse = await app.inject({
        method: 'POST',
        url: '/v1/admin/auth/login',
        payload: {
          email: limitedEmail,
          password: TEST_PASSWORD,
        },
      });
      assert.equal(limitedAdminLoginResponse.statusCode, 200);
      const limitedAdminLoginBody = parseBody(limitedAdminLoginResponse.body) as {
        tokens: { accessToken: string };
      };

      const forbiddenPreviewResponse = await app.inject({
        method: 'POST',
        url: '/v1/admin/email/preview',
        headers: authHeader(limitedAdminLoginBody.tokens.accessToken),
        payload: {
          toEmail: `${TEST_EMAIL_PREFIX}${randomUUID()}@synqit.test`,
          locale: 'en',
        },
      });
      assert.equal(forbiddenPreviewResponse.statusCode, 403);

      const forbiddenResetPreviewResponse = await app.inject({
        method: 'POST',
        url: '/v1/admin/email/preview/password-reset',
        headers: authHeader(limitedAdminLoginBody.tokens.accessToken),
        payload: {
          toEmail: `${TEST_EMAIL_PREFIX}${randomUUID()}@synqit.test`,
          locale: 'en',
        },
      });
      assert.equal(forbiddenResetPreviewResponse.statusCode, 403);
    } finally {
      if (previousBootstrapKey === undefined) {
        delete process.env.ADMIN_BOOTSTRAP_KEY;
      } else {
        process.env.ADMIN_BOOTSTRAP_KEY = previousBootstrapKey;
      }
      if (previousSuperUsers === undefined) {
        delete process.env.ADMIN_SUPER_USERS;
      } else {
        process.env.ADMIN_SUPER_USERS = previousSuperUsers;
      }
    }
  });

  it('admin: reset user flow deletes a user account so the email can register again', async () => {
    const superAdminEmail = `${TEST_EMAIL_PREFIX}super-admin-reset@synqit.test`;
    const targetEmail = `${TEST_EMAIL_PREFIX}${randomUUID()}@synqit.test`;
    await createUserAndLogin(app, superAdminEmail);
    const targetUser = await createUserAndLogin(app, targetEmail);

    const previousBootstrapKey = process.env.ADMIN_BOOTSTRAP_KEY;
    const previousSuperUsers = process.env.ADMIN_SUPER_USERS;
    process.env.ADMIN_BOOTSTRAP_KEY = REGRESSION_BOOTSTRAP_KEY;
    process.env.ADMIN_SUPER_USERS = superAdminEmail;

    try {
      const bootstrapResponse = await app.inject({
        method: 'POST',
        url: '/v1/admin/bootstrap/promote',
        headers: {
          'x-admin-bootstrap-key': process.env.ADMIN_BOOTSTRAP_KEY,
        },
        payload: {
          email: superAdminEmail,
        },
      });
      assert.equal(bootstrapResponse.statusCode, 200);

      const adminLoginResponse = await app.inject({
        method: 'POST',
        url: '/v1/admin/auth/login',
        payload: {
          email: superAdminEmail,
          password: TEST_PASSWORD,
        },
      });
      assert.equal(adminLoginResponse.statusCode, 200);
      const adminLoginBody = parseBody(adminLoginResponse.body) as {
        tokens: { accessToken: string };
      };

      const markTestAccountResponse = await app.inject({
        method: 'PUT',
        url: `/v1/admin/users/${targetUser.user.id}/test-account`,
        headers: authHeader(adminLoginBody.tokens.accessToken),
        payload: {
          isTestAccount: true,
        },
      });
      assert.equal(markTestAccountResponse.statusCode, 200);

      const resetResponse = await app.inject({
        method: 'POST',
        url: `/v1/admin/users/${targetUser.user.id}/reset-user-flow`,
        headers: authHeader(adminLoginBody.tokens.accessToken),
      });
      assert.equal(resetResponse.statusCode, 200);

      const deletedMeResponse = await app.inject({
        method: 'GET',
        url: '/v1/me',
        headers: authHeader(targetUser.tokens.accessToken),
      });
      assert.equal(deletedMeResponse.statusCode, 401);

      const loginAfterResetResponse = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: {
          email: targetEmail,
          password: TEST_PASSWORD,
        },
      });
      assert.equal(loginAfterResetResponse.statusCode, 401);

      const registerAgainResponse = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: {
          email: targetEmail,
          password: TEST_PASSWORD,
        },
      });
      assert.equal(registerAgainResponse.statusCode, 200);
    } finally {
      if (previousBootstrapKey === undefined) {
        delete process.env.ADMIN_BOOTSTRAP_KEY;
      } else {
        process.env.ADMIN_BOOTSTRAP_KEY = previousBootstrapKey;
      }
      if (previousSuperUsers === undefined) {
        delete process.env.ADMIN_SUPER_USERS;
      } else {
        process.env.ADMIN_SUPER_USERS = previousSuperUsers;
      }
    }
  });

  it('admin: analytics events list and details return event metrics', async () => {
    const hostEmail = `${TEST_EMAIL_PREFIX}${randomUUID()}@synqit.test`;
    const hostUser = await registerUser(app, hostEmail);

    await connectProvider(app, {
      provider: 'spotify',
      accessToken: hostUser.tokens.accessToken,
    });

    const createEventResponse = await app.inject({
      method: 'POST',
      url: '/v1/playlists',
      headers: authHeader(hostUser.tokens.accessToken),
      payload: {
        provider: 'spotify',
        name: 'Analytics Event Test',
        description: 'Validate admin analytics list and detail endpoints.',
      },
    });
    assert.equal(createEventResponse.statusCode, 200);
    const createEventBody = parseBody(createEventResponse.body) as {
      event: { id: string; magicLinkToken: string };
    };

    const addTrackResponse = await app.inject({
      method: 'POST',
      url: `/v1/playlists/link/${createEventBody.event.magicLinkToken}/tracks`,
      payload: {
        providerTrackId: 'analytics-track-1',
        name: 'Analytics Track',
        artist: 'Synqit',
        album: 'Regression',
        durationMs: 180000,
        artworkUrl: null,
      },
    });
    assert.equal(addTrackResponse.statusCode, 200);

    const pageViewPublicResponse = await app.inject({
      method: 'POST',
      url: '/v1/analytics/events',
      payload: {
        eventName: 'app_page_view',
        target: 'navigation',
        sessionId: `session-${randomUUID()}`,
        path: `/playlist/${createEventBody.event.magicLinkToken}`,
        source: 'web',
      },
    });
    assert.equal(pageViewPublicResponse.statusCode, 202);

    const pageViewHostResponse = await app.inject({
      method: 'POST',
      url: '/v1/analytics/events',
      headers: authHeader(hostUser.tokens.accessToken),
      payload: {
        eventName: 'app_page_view',
        target: 'navigation',
        sessionId: `session-${randomUUID()}`,
        path: '/dashboard',
        source: 'web',
      },
    });
    assert.equal(pageViewHostResponse.statusCode, 202);

    const actionEventResponse = await app.inject({
      method: 'POST',
      url: '/v1/analytics/events',
      payload: {
        eventName: 'event_create_succeeded',
        target: 'events',
        sessionId: `session-${randomUUID()}`,
        path: '/playlists/new',
        source: 'web',
        properties: {
          eventId: createEventBody.event.id,
        },
      },
    });
    assert.equal(actionEventResponse.statusCode, 202);

    const adminEmail = `${TEST_EMAIL_PREFIX}${randomUUID()}@synqit.test`;
    await registerUser(app, adminEmail);

    await syncsStore.createSync({
      senderUserId: hostUser.user.id,
      provider: 'spotify',
      providerPlaylistId: `analytics-shared-${randomUUID()}`,
      name: 'Analytics Shared Sync',
      trackCount: 8,
      syncMode: 'host_only',
    });

    const previousBootstrapKey = process.env.ADMIN_BOOTSTRAP_KEY;
    const previousAllowWhenSuperAdminExists =
      process.env.ADMIN_BOOTSTRAP_ALLOW_WHEN_SUPER_ADMIN_EXISTS;
    process.env.ADMIN_BOOTSTRAP_KEY = REGRESSION_BOOTSTRAP_KEY;
    // This test only needs an admin; a super admin may already exist in the local DB.
    process.env.ADMIN_BOOTSTRAP_ALLOW_WHEN_SUPER_ADMIN_EXISTS = 'true';
    try {
      const bootstrapResponse = await app.inject({
        method: 'POST',
        url: '/v1/admin/bootstrap/promote',
        headers: {
          'x-admin-bootstrap-key': process.env.ADMIN_BOOTSTRAP_KEY,
        },
        payload: {
          email: adminEmail,
        },
      });
      assert.equal(bootstrapResponse.statusCode, 200);

      const adminLoginResponse = await app.inject({
        method: 'POST',
        url: '/v1/admin/auth/login',
        payload: {
          email: adminEmail,
          password: TEST_PASSWORD,
        },
      });
      assert.equal(adminLoginResponse.statusCode, 200);
      const adminLoginBody = parseBody(adminLoginResponse.body) as {
        tokens: { accessToken: string };
      };

      const listResponse = await app.inject({
        method: 'GET',
        url: '/v1/admin/analytics/playlists',
        headers: authHeader(adminLoginBody.tokens.accessToken),
      });
      assert.equal(listResponse.statusCode, 200);
      const listBody = parseBody(listResponse.body) as {
        events: Array<{ eventId: string; name: string }>;
      };
      const matched = listBody.events.find((event) => event.eventId === createEventBody.event.id);
      assert.ok(matched);
      assert.equal(matched?.name, 'Analytics Event Test');

      const usersListResponse = await app.inject({
        method: 'GET',
        url: '/v1/admin/analytics/users',
        headers: authHeader(adminLoginBody.tokens.accessToken),
      });
      assert.equal(usersListResponse.statusCode, 200);
      const usersListBody = parseBody(usersListResponse.body) as {
        users: Array<{
          userId: string;
          eventPlaylistsCount: number;
          sharedPlaylistsCount: number;
        }>;
      };
      const hostSummary = usersListBody.users.find((user) => user.userId === hostUser.user.id);
      assert.ok(hostSummary);
      assert.ok((hostSummary?.eventPlaylistsCount ?? 0) >= 1);
      assert.ok((hostSummary?.sharedPlaylistsCount ?? 0) >= 1);

      // Seed public-site (source='site') events directly so the overview `site`
      // block has data. Inserted via Prisma (not the HTTP endpoint) to avoid the
      // request rate limit the full suite runs close to.
      const siteSessionId = `site-session-${randomUUID()}`;
      await prisma.analyticsEvents.createMany({
        data: [
          {
            id: randomUUID(),
            user_id: null,
            session_id: siteSessionId,
            event_name: 'site_page_view',
            target: 'marketing',
            page_path: '/',
            locale: null,
            source: 'site',
            referrer: null,
            properties: {},
            created_at: new Date(),
          },
          {
            id: randomUUID(),
            user_id: null,
            session_id: siteSessionId,
            event_name: 'site_time_on_page',
            target: 'marketing',
            page_path: '/',
            locale: null,
            source: 'site',
            referrer: null,
            properties: { engagedMs: 4000 },
            created_at: new Date(),
          },
        ],
      });

      const overviewResponse = await app.inject({
        method: 'GET',
        url: '/v1/admin/analytics/overview',
        headers: authHeader(adminLoginBody.tokens.accessToken),
      });
      assert.equal(overviewResponse.statusCode, 200);
      const overviewBody = parseBody(overviewResponse.body) as {
        totals: {
          usersCount: number;
          eventPlaylistsCount: number;
          sharedPlaylistsCount: number;
          pageViewsCount: number;
        };
        pageViewsByPath: Array<{ path: string; views: number }>;
        funnel: Array<{ step: string; count: number }>;
        eventBreakdown: Array<{
          eventName: string;
          target: string;
          count: number;
          sessions: number;
        }>;
        engagement: {
          returningSessionsCount: number;
          avgEventsPerSession: number;
          activeSessionsByDay: Array<{ day: string; sessions: number }>;
        };
        site: {
          uniqueVisitors: number;
          pageViewsCount: number;
          avgEngagedSeconds: number;
          trafficByDay: Array<{ day: string; views: number }>;
          topPages: Array<{ path: string; views: number }>;
          topSections: Array<{ section: string; views: number }>;
          topClicks: Array<{ label: string; clicks: number }>;
        };
      };
      assert.ok(overviewBody.totals.usersCount >= 1);
      assert.ok(overviewBody.totals.eventPlaylistsCount >= 1);
      assert.ok(overviewBody.totals.sharedPlaylistsCount >= 1);
      assert.ok(overviewBody.totals.pageViewsCount >= 1);
      assert.ok(overviewBody.pageViewsByPath.length >= 1);
      // New analytics blocks: funnel steps in fixed order, event breakdown, engagement.
      assert.deepEqual(
        overviewBody.funnel.map((entry) => entry.step),
        ['sessions', 'registered', 'providerConnected', 'eventCreated', 'shared'],
      );
      assert.ok(overviewBody.funnel.every((entry) => entry.count >= 0));
      assert.ok(overviewBody.eventBreakdown.length >= 1);
      assert.ok(
        overviewBody.eventBreakdown.some((row) => row.eventName === 'app_page_view'),
        'event breakdown should include app_page_view',
      );
      assert.ok(overviewBody.engagement.avgEventsPerSession >= 0);
      assert.ok(Array.isArray(overviewBody.engagement.activeSessionsByDay));
      // Public-site block reflects the seeded site_page_view + site_time_on_page.
      assert.ok(overviewBody.site.pageViewsCount >= 1);
      assert.ok(overviewBody.site.uniqueVisitors >= 1);
      assert.ok(overviewBody.site.avgEngagedSeconds >= 1);
      assert.ok(overviewBody.site.topPages.some((row) => row.path === '/'));

      const overviewAllTimeResponse = await app.inject({
        method: 'GET',
        url: '/v1/admin/analytics/overview?range=all',
        headers: authHeader(adminLoginBody.tokens.accessToken),
      });
      assert.equal(overviewAllTimeResponse.statusCode, 200);

      const overviewInvalidRangeResponse = await app.inject({
        method: 'GET',
        url: '/v1/admin/analytics/overview?range=2d',
        headers: authHeader(adminLoginBody.tokens.accessToken),
      });
      assert.equal(overviewInvalidRangeResponse.statusCode, 400);

      const userDetailResponse = await app.inject({
        method: 'GET',
        url: `/v1/admin/analytics/users/${hostUser.user.id}`,
        headers: authHeader(adminLoginBody.tokens.accessToken),
      });
      assert.equal(userDetailResponse.statusCode, 200);
      const userDetailBody = parseBody(userDetailResponse.body) as {
        user: {
          userId: string;
          eventPlaylistsCount: number;
          sharedPlaylistsCount: number;
          events: Array<{ eventId: string; shared: boolean }>;
          pageViewsByPath: Array<{ path: string; views: number }>;
        };
      };
      assert.equal(userDetailBody.user.userId, hostUser.user.id);
      assert.ok(userDetailBody.user.eventPlaylistsCount >= 1);
      assert.ok(userDetailBody.user.sharedPlaylistsCount >= 1);
      assert.ok(userDetailBody.user.pageViewsByPath.some((view) => view.path === '/dashboard'));
      assert.ok(
        userDetailBody.user.events.some(
          (event) => event.eventId === createEventBody.event.id && event.shared,
        ),
      );

      const detailResponse = await app.inject({
        method: 'GET',
        url: `/v1/admin/analytics/playlists/${createEventBody.event.id}`,
        headers: authHeader(adminLoginBody.tokens.accessToken),
      });
      assert.equal(detailResponse.statusCode, 200);
      const detailBody = parseBody(detailResponse.body) as {
        event: {
          eventId: string;
          tracksCount: number;
          analytics: {
            publicPageViews: number;
            trackedEventActions: number;
          };
          recentTracks: Array<{ name: string }>;
        };
      };
      assert.equal(detailBody.event.eventId, createEventBody.event.id);
      assert.equal(detailBody.event.tracksCount, 1);
      assert.ok(detailBody.event.analytics.publicPageViews >= 1);
      assert.ok(detailBody.event.analytics.trackedEventActions >= 1);
      assert.ok(detailBody.event.recentTracks.some((track) => track.name === 'Analytics Track'));
    } finally {
      if (previousBootstrapKey === undefined) {
        delete process.env.ADMIN_BOOTSTRAP_KEY;
      } else {
        process.env.ADMIN_BOOTSTRAP_KEY = previousBootstrapKey;
      }
      if (previousAllowWhenSuperAdminExists === undefined) {
        delete process.env.ADMIN_BOOTSTRAP_ALLOW_WHEN_SUPER_ADMIN_EXISTS;
      } else {
        process.env.ADMIN_BOOTSTRAP_ALLOW_WHEN_SUPER_ADMIN_EXISTS =
          previousAllowWhenSuperAdminExists;
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
      url: '/v1/playlists/drafts',
      headers: authHeader(accessToken),
    });
    assert.equal(initialDraftListResponse.statusCode, 200);
    const initialDraftListBody = parseBody(initialDraftListResponse.body) as {
      drafts: Array<{ id: string }>;
    };
    assert.equal(initialDraftListBody.drafts.length, 0);

    const createDraftResponse = await app.inject({
      method: 'POST',
      url: '/v1/playlists/drafts',
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
      url: `/v1/playlists/drafts/${draftId}`,
      headers: authHeader(accessToken),
    });
    assert.equal(getDraftResponse.statusCode, 200);

    const updateDraftResponse = await app.inject({
      method: 'PATCH',
      url: `/v1/playlists/drafts/${draftId}`,
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
      url: '/v1/playlists/drafts',
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
      url: `/v1/playlists/drafts/${draftId}`,
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
      url: `/v1/playlists/drafts/${draftId}`,
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
      url: '/v1/playlists',
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
      url: `/v1/playlists/${eventId}`,
      headers: authHeader(hostAccessToken),
      payload: {
        name: 'Regression Event Updated',
        description: 'Updated description',
      },
    });
    assert.equal(updateEventResponse.statusCode, 200);

    const addTrackResponse = await app.inject({
      method: 'POST',
      url: `/v1/playlists/link/${firstMagicLinkToken}/tracks`,
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
      url: `/v1/playlists/link/${firstMagicLinkToken}/tracks`,
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
      url: `/v1/playlists/${eventId}/tracks`,
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
      url: `/v1/playlists/${eventId}/tracks/mock-track-1`,
      headers: authHeader(hostAccessToken),
    });
    assert.equal(removeTrackResponse.statusCode, 200);

    const revokeMagicLinkResponse = await app.inject({
      method: 'POST',
      url: `/v1/playlists/${eventId}/magic-link/revoke`,
      headers: authHeader(hostAccessToken),
    });
    assert.equal(revokeMagicLinkResponse.statusCode, 200);

    const revokedLinkResponse = await app.inject({
      method: 'GET',
      url: `/v1/playlists/link/${firstMagicLinkToken}`,
    });
    assert.equal(revokedLinkResponse.statusCode, 410);

    const regenerateMagicLinkResponse = await app.inject({
      method: 'POST',
      url: `/v1/playlists/${eventId}/magic-link/regenerate`,
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
      url: `/v1/playlists/${eventId}/close`,
      headers: authHeader(hostAccessToken),
    });
    assert.equal(closeEventResponse.statusCode, 200);

    const closedEventAddTrackResponse = await app.inject({
      method: 'POST',
      url: `/v1/playlists/link/${secondMagicLinkToken}/tracks`,
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

    const reopenEventResponse = await app.inject({
      method: 'POST',
      url: `/v1/playlists/${eventId}/reopen`,
      headers: authHeader(hostAccessToken),
    });
    assert.equal(reopenEventResponse.statusCode, 200);

    const reopenedEventAddTrackResponse = await app.inject({
      method: 'POST',
      url: `/v1/playlists/link/${secondMagicLinkToken}/tracks`,
      payload: {
        providerTrackId: 'mock-track-2',
        name: 'Golden Hour',
        artist: 'Summer Static',
        album: 'Sunset Signals',
        durationMs: 187000,
        artworkUrl: null,
      },
    });
    assert.equal(reopenedEventAddTrackResponse.statusCode, 200);

    const deleteEventResponse = await app.inject({
      method: 'DELETE',
      url: `/v1/playlists/${eventId}`,
      headers: authHeader(hostAccessToken),
    });
    assert.equal(deleteEventResponse.statusCode, 200);

    const deletedEventGetResponse = await app.inject({
      method: 'GET',
      url: `/v1/playlists/${eventId}`,
      headers: authHeader(hostAccessToken),
    });
    assert.equal(deletedEventGetResponse.statusCode, 404);
  });

  it('events: logged-in guests can track a magic-link playlist and see it on the dashboard', async () => {
    const hostEmail = `${TEST_EMAIL_PREFIX}tracked-host-${randomUUID()}@synqit.test`;
    const guestEmail = `${TEST_EMAIL_PREFIX}tracked-guest-${randomUUID()}@synqit.test`;
    const host = await createUserAndLogin(app, hostEmail);
    const guest = await createUserAndLogin(app, guestEmail);

    await connectProvider(app, {
      provider: 'spotify',
      accessToken: host.tokens.accessToken,
    });

    const event = await eventsStore.createEvent({
      hostUserId: host.user.id,
      provider: 'spotify',
      providerPlaylistId: `tracked-event-${randomUUID()}`,
      name: 'Tracked Event Playlist',
      description: 'Dashboard tracking regression test.',
    });

    await eventsStore.addTrackToEvent({
      eventId: event.id,
      providerTrackId: 'tracked-mock-track-1',
      name: 'Tracked Song',
      artist: 'Regression Artist',
      album: 'Dashboard Suite',
      durationMs: 180000,
      artworkUrl: null,
      addedBy: 'guest',
    });

    const beforeTrackResponse = await app.inject({
      method: 'GET',
      url: `/v1/playlists/link/${event.magicLinkToken}`,
      headers: authHeader(guest.tokens.accessToken),
    });
    assert.equal(beforeTrackResponse.statusCode, 200);
    const beforeTrackBody = parseBody(beforeTrackResponse.body) as {
      event: { isOwner: boolean; isTracked: boolean };
    };
    assert.equal(beforeTrackBody.event.isOwner, false);
    assert.equal(beforeTrackBody.event.isTracked, false);

    const visitedDashboardResponse = await app.inject({
      method: 'GET',
      url: '/v1/dashboard/summary',
      headers: authHeader(guest.tokens.accessToken),
    });
    assert.equal(visitedDashboardResponse.statusCode, 200);
    const visitedDashboardBody = parseBody(visitedDashboardResponse.body) as {
      trackedEventActivity: Array<{ eventId: string }>;
      visitedEventActivity: Array<{
        eventId: string;
        magicLinkToken: string;
        addedTrackCount24h: number;
      }>;
    };
    assert.equal(visitedDashboardBody.trackedEventActivity.length, 0);
    assert.equal(visitedDashboardBody.visitedEventActivity.length, 1);
    assert.equal(visitedDashboardBody.visitedEventActivity[0]?.eventId, event.id);
    assert.equal(
      visitedDashboardBody.visitedEventActivity[0]?.magicLinkToken,
      event.magicLinkToken,
    );
    assert.equal(visitedDashboardBody.visitedEventActivity[0]?.addedTrackCount24h, 1);

    const trackResponse = await app.inject({
      method: 'POST',
      url: `/v1/playlists/link/${event.magicLinkToken}/track`,
      headers: authHeader(guest.tokens.accessToken),
    });
    assert.equal(trackResponse.statusCode, 200);

    const afterTrackResponse = await app.inject({
      method: 'GET',
      url: `/v1/playlists/link/${event.magicLinkToken}`,
      headers: authHeader(guest.tokens.accessToken),
    });
    assert.equal(afterTrackResponse.statusCode, 200);
    const afterTrackBody = parseBody(afterTrackResponse.body) as {
      event: { isTracked: boolean };
    };
    assert.equal(afterTrackBody.event.isTracked, true);

    const dashboardResponse = await app.inject({
      method: 'GET',
      url: '/v1/dashboard/summary',
      headers: authHeader(guest.tokens.accessToken),
    });
    assert.equal(dashboardResponse.statusCode, 200);
    const dashboardBody = parseBody(dashboardResponse.body) as {
      trackedEventActivity: Array<{
        eventId: string;
        magicLinkToken: string;
        addedTrackCount24h: number;
      }>;
      visitedEventActivity: Array<{ eventId: string }>;
    };
    assert.equal(dashboardBody.trackedEventActivity.length, 1);
    assert.equal(dashboardBody.trackedEventActivity[0]?.eventId, event.id);
    assert.equal(dashboardBody.trackedEventActivity[0]?.magicLinkToken, event.magicLinkToken);
    assert.equal(dashboardBody.trackedEventActivity[0]?.addedTrackCount24h, 1);
    assert.equal(dashboardBody.visitedEventActivity.length, 0);

    const untrackResponse = await app.inject({
      method: 'DELETE',
      url: `/v1/playlists/link/${event.magicLinkToken}/track`,
      headers: authHeader(guest.tokens.accessToken),
    });
    assert.equal(untrackResponse.statusCode, 200);
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
      url: '/v1/playlists',
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
      url: `/v1/playlists/link/${createEventBody.event.magicLinkToken}/tracks`,
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
      url: `/v1/playlists/${createEventBody.event.id}/tracks`,
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
      url: `/v1/playlists/${createEventBody.event.id}/tracks/mock-track-2`,
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
            scope:
              'playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public',
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
        url: '/v1/playlists',
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
        url: `/v1/playlists/link/${magicLinkToken}/tracks`,
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
        url: `/v1/playlists/${eventId}`,
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

  it('events: apple empty playlists stay open when Apple returns no related tracks', async () => {
    const previousAppleTeamId = process.env.APPLE_TEAM_ID;
    const previousAppleKeyId = process.env.APPLE_KEY_ID;
    const previousAppleMusicKitIdentifier = process.env.APPLE_MUSICKIT_IDENTIFIER;
    const previousApplePrivateKey = process.env.APPLE_PRIVATE_KEY_P8;
    const originalFetch = globalThis.fetch;
    const providerPlaylistId = `apple-empty-${randomUUID()}`;

    process.env.APPLE_TEAM_ID = 'regression-apple-team';
    process.env.APPLE_KEY_ID = 'regression-apple-key';
    process.env.APPLE_MUSICKIT_IDENTIFIER = 'regression.apple.musickit';
    process.env.APPLE_PRIVATE_KEY_P8 = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgcmlwtQ8qUxntutB5
lgguoZvlw7ncEM42tKbuZJWm7r6hRANCAATakZ0Vb/rR6MNtqGzEuoAOJUtOJrTn
oZ+xDXftVNIci2hGnCpfyhh4VEn2INUhDRWfbhJT8bsKLDWBNkKQfhC3
-----END PRIVATE KEY-----`;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = typeof input === 'string' ? input : input.toString();
      const method = (init?.method ?? 'GET').toUpperCase();

      if (
        requestUrl === 'https://api.music.apple.com/v1/me/library/playlists' &&
        method === 'POST'
      ) {
        return new Response(
          JSON.stringify({
            data: [{ id: providerPlaylistId }],
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
          `https://api.music.apple.com/v1/me/library/playlists/${encodeURIComponent(providerPlaylistId)}/tracks?limit=100` &&
        method === 'GET'
      ) {
        return new Response(
          JSON.stringify({
            errors: [
              {
                id: 'empty-playlist',
                title: 'No related resources',
                detail: 'No related resources found for tracks',
                status: '404',
                code: '40403',
              },
            ],
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

      const connectResponse = await app.inject({
        method: 'POST',
        url: '/v1/auth/apple/connect',
        headers: authHeader(hostAccessToken),
        payload: {
          musicUserToken: 'mock-apple-user-token-1234567890',
        },
      });
      assert.equal(connectResponse.statusCode, 200);

      const createEventResponse = await app.inject({
        method: 'POST',
        url: '/v1/playlists',
        headers: authHeader(hostAccessToken),
        payload: {
          provider: 'apple',
          name: 'Apple Empty Playlist Event',
          description: 'Event should stay open for empty Apple playlists.',
        },
      });
      assert.equal(createEventResponse.statusCode, 200);
      const createEventBody = parseBody(createEventResponse.body) as {
        event: { id: string; status: string };
      };
      assert.equal(createEventBody.event.status, 'open');

      const hostTracksResponse = await app.inject({
        method: 'GET',
        url: `/v1/playlists/${createEventBody.event.id}/tracks`,
        headers: authHeader(hostAccessToken),
      });
      assert.equal(hostTracksResponse.statusCode, 200);
      const hostTracksBody = parseBody(hostTracksResponse.body) as {
        tracks: Array<unknown>;
      };
      assert.equal(hostTracksBody.tracks.length, 0);

      const hostEventResponse = await app.inject({
        method: 'GET',
        url: `/v1/playlists/${createEventBody.event.id}`,
        headers: authHeader(hostAccessToken),
      });
      assert.equal(hostEventResponse.statusCode, 200);
      const hostEventBody = parseBody(hostEventResponse.body) as {
        event: { status: string };
      };
      assert.equal(hostEventBody.event.status, 'open');
    } finally {
      globalThis.fetch = originalFetch;
      process.env.APPLE_TEAM_ID = previousAppleTeamId;
      process.env.APPLE_KEY_ID = previousAppleKeyId;
      process.env.APPLE_MUSICKIT_IDENTIFIER = previousAppleMusicKitIdentifier;
      process.env.APPLE_PRIVATE_KEY_P8 = previousApplePrivateKey;
    }
  });

  it('events: apple add-track upstream failures return a retryable message without closing the event', async () => {
    const previousAppleTeamId = process.env.APPLE_TEAM_ID;
    const previousAppleKeyId = process.env.APPLE_KEY_ID;
    const previousAppleMusicKitIdentifier = process.env.APPLE_MUSICKIT_IDENTIFIER;
    const previousApplePrivateKey = process.env.APPLE_PRIVATE_KEY_P8;
    const originalFetch = globalThis.fetch;
    const providerPlaylistId = `apple-update-failure-${randomUUID()}`;

    process.env.APPLE_TEAM_ID = 'regression-apple-team';
    process.env.APPLE_KEY_ID = 'regression-apple-key';
    process.env.APPLE_MUSICKIT_IDENTIFIER = 'regression.apple.musickit';
    process.env.APPLE_PRIVATE_KEY_P8 = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgcmlwtQ8qUxntutB5
lgguoZvlw7ncEM42tKbuZJWm7r6hRANCAATakZ0Vb/rR6MNtqGzEuoAOJUtOJrTn
oZ+xDXftVNIci2hGnCpfyhh4VEn2INUhDRWfbhJT8bsKLDWBNkKQfhC3
-----END PRIVATE KEY-----`;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = typeof input === 'string' ? input : input.toString();
      const method = (init?.method ?? 'GET').toUpperCase();

      if (
        requestUrl === 'https://api.music.apple.com/v1/me/library/playlists' &&
        method === 'POST'
      ) {
        return new Response(
          JSON.stringify({
            data: [{ id: providerPlaylistId }],
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
          `https://api.music.apple.com/v1/me/library/playlists/${encodeURIComponent(providerPlaylistId)}/tracks` &&
        method === 'POST'
      ) {
        return new Response(
          JSON.stringify({
            errors: [
              {
                id: 'apple-update-failure',
                title: 'Upstream Service Error',
                detail: 'Unable to update tracks',
                status: '500',
                code: '50001',
              },
            ],
          }),
          {
            status: 500,
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

      const connectResponse = await app.inject({
        method: 'POST',
        url: '/v1/auth/apple/connect',
        headers: authHeader(hostAccessToken),
        payload: {
          musicUserToken: 'mock-apple-user-token-1234567890',
        },
      });
      assert.equal(connectResponse.statusCode, 200);

      const createEventResponse = await app.inject({
        method: 'POST',
        url: '/v1/playlists',
        headers: authHeader(hostAccessToken),
        payload: {
          provider: 'apple',
          name: 'Apple Update Failure Event',
          description: 'Event should stay open when Apple fails to update tracks.',
        },
      });
      assert.equal(createEventResponse.statusCode, 200);
      const createEventBody = parseBody(createEventResponse.body) as {
        event: { id: string; magicLinkToken: string; status: string };
      };
      assert.equal(createEventBody.event.status, 'open');

      const addTrackResponse = await app.inject({
        method: 'POST',
        url: `/v1/playlists/link/${createEventBody.event.magicLinkToken}/tracks`,
        payload: {
          providerTrackId: '1440650719',
          name: 'Failure Song',
          artist: 'Any Artist',
          album: 'Any Album',
          durationMs: 180000,
          artworkUrl: null,
        },
      });
      assert.equal(addTrackResponse.statusCode, 502);
      const addTrackBody = parseBody(addTrackResponse.body) as { code: string; message: string };
      assert.equal(addTrackBody.code, 'provider_playlist_update_failed');
      assert.equal(
        addTrackBody.message,
        'Apple Music could not update this playlist right now. Please try again in a moment.',
      );

      const hostEventResponse = await app.inject({
        method: 'GET',
        url: `/v1/playlists/${createEventBody.event.id}`,
        headers: authHeader(hostAccessToken),
      });
      assert.equal(hostEventResponse.statusCode, 200);
      const hostEventBody = parseBody(hostEventResponse.body) as {
        event: { status: string };
      };
      assert.equal(hostEventBody.event.status, 'open');
    } finally {
      globalThis.fetch = originalFetch;
      process.env.APPLE_TEAM_ID = previousAppleTeamId;
      process.env.APPLE_KEY_ID = previousAppleKeyId;
      process.env.APPLE_MUSICKIT_IDENTIFIER = previousAppleMusicKitIdentifier;
      process.env.APPLE_PRIVATE_KEY_P8 = previousApplePrivateKey;
    }
  });

  it('events: apple guest search uses the host storefront instead of the configured default', async () => {
    const previousAppleTeamId = process.env.APPLE_TEAM_ID;
    const previousAppleKeyId = process.env.APPLE_KEY_ID;
    const previousAppleMusicKitIdentifier = process.env.APPLE_MUSICKIT_IDENTIFIER;
    const previousApplePrivateKey = process.env.APPLE_PRIVATE_KEY_P8;
    const previousAppleStorefront = process.env.APPLE_STOREFRONT;
    const originalFetch = globalThis.fetch;
    const providerPlaylistId = `apple-search-storefront-${randomUUID()}`;
    let lastSearchUrl: string | null = null;

    process.env.APPLE_TEAM_ID = 'regression-apple-team';
    process.env.APPLE_KEY_ID = 'regression-apple-key';
    process.env.APPLE_MUSICKIT_IDENTIFIER = 'regression.apple.musickit';
    process.env.APPLE_STOREFRONT = 'us';
    process.env.APPLE_PRIVATE_KEY_P8 = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgcmlwtQ8qUxntutB5
lgguoZvlw7ncEM42tKbuZJWm7r6hRANCAATakZ0Vb/rR6MNtqGzEuoAOJUtOJrTn
oZ+xDXftVNIci2hGnCpfyhh4VEn2INUhDRWfbhJT8bsKLDWBNkKQfhC3
-----END PRIVATE KEY-----`;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = typeof input === 'string' ? input : input.toString();
      const method = (init?.method ?? 'GET').toUpperCase();

      if (
        requestUrl === 'https://api.music.apple.com/v1/me/library/playlists' &&
        method === 'POST'
      ) {
        return new Response(
          JSON.stringify({
            data: [{ id: providerPlaylistId }],
          }),
          {
            status: 201,
            headers: {
              'content-type': 'application/json',
            },
          },
        );
      }

      if (requestUrl === 'https://api.music.apple.com/v1/me/storefront' && method === 'GET') {
        return new Response(
          JSON.stringify({
            data: [{ id: 'fr' }],
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          },
        );
      }

      if (
        requestUrl.startsWith('https://api.music.apple.com/v1/catalog/fr/search?') &&
        method === 'GET'
      ) {
        lastSearchUrl = requestUrl;
        return new Response(
          JSON.stringify({
            results: {
              songs: {
                data: [
                  {
                    id: 'queen-fr-track',
                    attributes: {
                      name: 'Bohemian Rhapsody',
                      artistName: 'Queen',
                      albumName: 'A Night at the Opera',
                      durationInMillis: 354000,
                      artwork: {
                        url: 'https://image-cdn/{w}x{h}bb.jpg',
                      },
                    },
                  },
                ],
              },
            },
          }),
          {
            status: 200,
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

      const connectResponse = await app.inject({
        method: 'POST',
        url: '/v1/auth/apple/connect',
        headers: authHeader(hostAccessToken),
        payload: {
          musicUserToken: 'mock-apple-user-token-1234567890',
        },
      });
      assert.equal(connectResponse.statusCode, 200);

      const createEventResponse = await app.inject({
        method: 'POST',
        url: '/v1/playlists',
        headers: authHeader(hostAccessToken),
        payload: {
          provider: 'apple',
          name: 'Apple Storefront Search Event',
          description: 'Search should use the host storefront.',
        },
      });
      assert.equal(createEventResponse.statusCode, 200);
      const createEventBody = parseBody(createEventResponse.body) as {
        event: { magicLinkToken: string };
      };

      const searchResponse = await app.inject({
        method: 'GET',
        url: `/v1/playlists/link/${createEventBody.event.magicLinkToken}/search?q=queen`,
      });
      assert.equal(searchResponse.statusCode, 200);
      const searchBody = parseBody(searchResponse.body) as {
        results: Array<{ providerTrackId: string }>;
      };
      assert.equal(searchBody.results[0]?.providerTrackId, 'queen-fr-track');
      assert.match(lastSearchUrl ?? '', /\/v1\/catalog\/fr\/search\?/);
    } finally {
      globalThis.fetch = originalFetch;
      process.env.APPLE_TEAM_ID = previousAppleTeamId;
      process.env.APPLE_KEY_ID = previousAppleKeyId;
      process.env.APPLE_MUSICKIT_IDENTIFIER = previousAppleMusicKitIdentifier;
      process.env.APPLE_PRIVATE_KEY_P8 = previousApplePrivateKey;
      process.env.APPLE_STOREFRONT = previousAppleStorefront;
    }
  });

  it('dashboard: subscribed sync summary serializes latest activity timestamps', async () => {
    const ownerEmail = `${TEST_EMAIL_PREFIX}dashboard-owner-${randomUUID()}@synqit.test`;
    const subscriberEmail = `${TEST_EMAIL_PREFIX}dashboard-subscriber-${randomUUID()}@synqit.test`;

    const owner = await registerUser(app, ownerEmail);
    const subscriber = await registerUser(app, subscriberEmail);

    const sync = await syncsStore.createSync({
      senderUserId: owner.user.id,
      provider: 'spotify',
      providerPlaylistId: 'dashboard-summary-playlist',
      name: 'Dashboard Summary Sync',
      trackCount: 12,
      syncMode: 'host_only',
    });

    const lastSyncedAt = new Date();

    await syncsStore.upsertImport({
      syncId: sync.id,
      recipientUserId: subscriber.user.id,
      recipientProvider: 'apple',
      recipientProviderPlaylistId: 'subscriber-copy-playlist',
      status: 'active',
      matchedCount: 12,
      skippedCount: 0,
      lastSyncedAt,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/dashboard/summary',
      headers: authHeader(subscriber.tokens.accessToken),
    });

    assert.equal(response.statusCode, 200);
    const body = parseBody(response.body) as {
      subscriberSyncActivity: Array<{
        syncId: string;
        latestActivityAt: string | null;
      }>;
    };

    assert.equal(body.subscriberSyncActivity.length, 1);
    assert.equal(body.subscriberSyncActivity[0]?.syncId, sync.id);
    assert.equal(body.subscriberSyncActivity[0]?.latestActivityAt, lastSyncedAt.toISOString());
  });

  it('syncs: create resolves missing track count before persisting', async () => {
    const email = `${TEST_EMAIL_PREFIX}sync-owner-${randomUUID()}@synqit.test`;
    const user = await registerUser(app, email);

    await connectProvider(app, {
      provider: 'spotify',
      accessToken: user.tokens.accessToken,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/syncs',
      headers: authHeader(user.tokens.accessToken),
      payload: {
        provider: 'spotify',
        providerPlaylistId: 'mock-playlist-1',
        name: 'Mock Shared Playlist',
        trackCount: null,
        syncMode: 'host_only',
      },
    });

    assert.equal(response.statusCode, 201);
    const body = parseBody(response.body) as {
      sync: { providerPlaylistId: string; trackCount: number | null };
      magicLinkUrl: string;
    };

    assert.equal(body.sync.providerPlaylistId, 'mock-playlist-1');
    assert.equal(body.sync.trackCount, 24);
    assert.match(body.magicLinkUrl, /\/sync\//);
  });

  it('syncs: provider-playlists flags round-trip origin from prior transfers', async () => {
    const email = `${TEST_EMAIL_PREFIX}sync-origin-${randomUUID()}@synqit.test`;
    const user = await registerUser(app, email);

    await connectProvider(app, {
      provider: 'spotify',
      accessToken: user.tokens.accessToken,
    });

    // Simulate a prior Apple -> Spotify transfer whose Spotify copy is one of
    // the listed mock playlists.
    const originSync = await syncsStore.createSync({
      senderUserId: user.user.id,
      provider: 'apple',
      providerPlaylistId: 'apple-origin-playlist',
      name: 'My Apple Original',
      trackCount: 10,
      syncMode: 'host_only',
    });
    await syncsStore.upsertImport({
      syncId: originSync.id,
      recipientUserId: user.user.id,
      recipientProvider: 'spotify',
      recipientProviderPlaylistId: 'mock-playlist-1',
      status: 'completed',
      matchedCount: 10,
      skippedCount: 0,
      lastSyncedAt: new Date(),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/syncs/provider-playlists?provider=spotify',
      headers: authHeader(user.tokens.accessToken),
    });

    assert.equal(response.statusCode, 200);
    const body = parseBody(response.body) as {
      playlists: Array<{
        providerPlaylistId: string;
        origin: { provider: string; syncName: string } | null;
      }>;
    };

    const flagged = body.playlists.find((p) => p.providerPlaylistId === 'mock-playlist-1');
    assert.deepEqual(flagged?.origin, { provider: 'apple', syncName: 'My Apple Original' });

    const untouched = body.playlists.find((p) => p.providerPlaylistId === 'mock-playlist-2');
    assert.equal(untouched?.origin, null);
  });

  it('syncs: kind defaults to shared and persists transfer, surfaced in listing', async () => {
    const email = `${TEST_EMAIL_PREFIX}sync-kind-${randomUUID()}@synqit.test`;
    const user = await registerUser(app, email);

    await connectProvider(app, {
      provider: 'spotify',
      accessToken: user.tokens.accessToken,
    });

    const sharedResponse = await app.inject({
      method: 'POST',
      url: '/v1/syncs',
      headers: authHeader(user.tokens.accessToken),
      payload: {
        provider: 'spotify',
        providerPlaylistId: 'mock-playlist-1',
        name: 'Shared List',
        trackCount: null,
        syncMode: 'host_only',
      },
    });
    assert.equal(sharedResponse.statusCode, 201);
    assert.equal(
      (parseBody(sharedResponse.body) as { sync: { kind: string } }).sync.kind,
      'shared',
    );

    const transferResponse = await app.inject({
      method: 'POST',
      url: '/v1/syncs',
      headers: authHeader(user.tokens.accessToken),
      payload: {
        provider: 'spotify',
        providerPlaylistId: 'mock-playlist-2',
        name: 'Moved Playlist',
        trackCount: null,
        syncMode: 'host_only',
        kind: 'transfer',
      },
    });
    assert.equal(transferResponse.statusCode, 201);
    assert.equal(
      (parseBody(transferResponse.body) as { sync: { kind: string } }).sync.kind,
      'transfer',
    );

    const listResponse = await app.inject({
      method: 'GET',
      url: '/v1/syncs',
      headers: authHeader(user.tokens.accessToken),
    });
    assert.equal(listResponse.statusCode, 200);
    const list = parseBody(listResponse.body) as {
      ownedSyncs: Array<{ name: string; kind: string }>;
    };
    assert.equal(list.ownedSyncs.find((s) => s.name === 'Shared List')?.kind, 'shared');
    assert.equal(list.ownedSyncs.find((s) => s.name === 'Moved Playlist')?.kind, 'transfer');
  });

  it('syncs: provider-playlists flags a source already transferred elsewhere', async () => {
    const email = `${TEST_EMAIL_PREFIX}sync-retransfer-${randomUUID()}@synqit.test`;
    const user = await registerUser(app, email);

    await connectProvider(app, {
      provider: 'spotify',
      accessToken: user.tokens.accessToken,
    });

    // Prior transfer: this Spotify playlist was already sent to Apple.
    const transfer = await syncsStore.createSync({
      senderUserId: user.user.id,
      provider: 'spotify',
      providerPlaylistId: 'mock-playlist-1',
      name: 'Moved Once',
      trackCount: 8,
      syncMode: 'host_only',
      kind: 'transfer',
    });
    await syncsStore.upsertImport({
      syncId: transfer.id,
      recipientUserId: user.user.id,
      recipientProvider: 'apple',
      recipientProviderPlaylistId: 'apple-copy-1',
      status: 'completed',
      matchedCount: 8,
      skippedCount: 0,
      lastSyncedAt: new Date(),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/syncs/provider-playlists?provider=spotify',
      headers: authHeader(user.tokens.accessToken),
    });

    assert.equal(response.statusCode, 200);
    const body = parseBody(response.body) as {
      playlists: Array<{
        providerPlaylistId: string;
        priorTransfer: { destinationProviders: string[]; lastTransferredAt: string | null } | null;
      }>;
    };

    const flagged = body.playlists.find((p) => p.providerPlaylistId === 'mock-playlist-1');
    assert.deepEqual(flagged?.priorTransfer?.destinationProviders, ['apple']);
    assert.ok(flagged?.priorTransfer?.lastTransferredAt);

    const untouched = body.playlists.find((p) => p.providerPlaylistId === 'mock-playlist-2');
    assert.equal(untouched?.priorTransfer, null);
  });

  it('syncs: apple-to-apple import reuses source track ids instead of searching', async () => {
    const previousAppleTeamId = process.env.APPLE_TEAM_ID;
    const previousAppleKeyId = process.env.APPLE_KEY_ID;
    const previousAppleMusicKitIdentifier = process.env.APPLE_MUSICKIT_IDENTIFIER;
    const previousApplePrivateKey = process.env.APPLE_PRIVATE_KEY_P8;
    const originalFetch = globalThis.fetch;
    const sourcePlaylistId = `apple-source-sync-${randomUUID()}`;
    const recipientPlaylistId = `apple-recipient-sync-${randomUUID()}`;
    const addedTrackIds: string[] = [];
    let addTrackRequestCount = 0;

    process.env.APPLE_TEAM_ID = 'regression-apple-team';
    process.env.APPLE_KEY_ID = 'regression-apple-key';
    process.env.APPLE_MUSICKIT_IDENTIFIER = 'regression.apple.musickit';
    process.env.APPLE_PRIVATE_KEY_P8 = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgcmlwtQ8qUxntutB5
lgguoZvlw7ncEM42tKbuZJWm7r6hRANCAATakZ0Vb/rR6MNtqGzEuoAOJUtOJrTn
oZ+xDXftVNIci2hGnCpfyhh4VEn2INUhDRWfbhJT8bsKLDWBNkKQfhC3
-----END PRIVATE KEY-----`;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = typeof input === 'string' ? input : input.toString();
      const method = (init?.method ?? 'GET').toUpperCase();

      if (
        requestUrl ===
          `https://api.music.apple.com/v1/me/library/playlists/${encodeURIComponent(sourcePlaylistId)}/tracks?limit=100` &&
        method === 'GET'
      ) {
        return new Response(
          JSON.stringify({
            data: Array.from({ length: 9 }, (_, index) => ({
              id: `library-song-${index + 1}`,
              attributes: {
                name: `Track ${index + 1}`,
                artistName: `Artist ${index + 1}`,
                albumName: 'Source Album',
                durationInMillis: 180000 + index,
                playParams: {
                  catalogId: `catalog-song-${index + 1}`,
                },
              },
            })),
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          },
        );
      }

      if (
        requestUrl === 'https://api.music.apple.com/v1/me/library/playlists' &&
        method === 'POST'
      ) {
        return new Response(
          JSON.stringify({
            data: [{ id: recipientPlaylistId }],
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
          `https://api.music.apple.com/v1/me/library/playlists/${encodeURIComponent(recipientPlaylistId)}/tracks` &&
        method === 'POST'
      ) {
        const rawBody = typeof init?.body === 'string' ? init.body : '';
        const body = JSON.parse(rawBody) as {
          data?: Array<{ id?: string }>;
        };
        // Adds are batched, so record every id in the request body.
        addTrackRequestCount += 1;
        const trackIds = (body.data ?? []).map((entry) => entry.id);
        assert.ok(trackIds.length > 0);
        for (const trackId of trackIds) {
          assert.ok(trackId);
          addedTrackIds.push(trackId);
        }
        return new Response(null, { status: 204 });
      }

      if (requestUrl.includes('/v1/catalog/')) {
        throw new Error(
          `Unexpected Apple catalog search during same-provider import: ${requestUrl}`,
        );
      }

      throw new Error(`Unexpected provider request in regression test: ${method} ${requestUrl}`);
    }) as typeof fetch;

    try {
      const ownerEmail = `${TEST_EMAIL_PREFIX}apple-sync-owner-${randomUUID()}@synqit.test`;
      const subscriberEmail = `${TEST_EMAIL_PREFIX}apple-sync-subscriber-${randomUUID()}@synqit.test`;

      const owner = await registerUser(app, ownerEmail);
      const subscriber = await registerUser(app, subscriberEmail);

      const ownerConnectResponse = await app.inject({
        method: 'POST',
        url: '/v1/auth/apple/connect',
        headers: authHeader(owner.tokens.accessToken),
        payload: {
          musicUserToken: 'mock-owner-apple-user-token',
        },
      });
      assert.equal(ownerConnectResponse.statusCode, 200);

      const subscriberConnectResponse = await app.inject({
        method: 'POST',
        url: '/v1/auth/apple/connect',
        headers: authHeader(subscriber.tokens.accessToken),
        payload: {
          musicUserToken: 'mock-subscriber-apple-user-token',
        },
      });
      assert.equal(subscriberConnectResponse.statusCode, 200);

      const sync = await syncsStore.createSync({
        senderUserId: owner.user.id,
        provider: 'apple',
        providerPlaylistId: sourcePlaylistId,
        name: 'Apple Direct Import Sync',
        trackCount: 9,
        syncMode: 'host_only',
      });

      const importResponse = await app.inject({
        method: 'POST',
        url: `/v1/syncs/link/${sync.magicLinkToken}/import`,
        headers: authHeader(subscriber.tokens.accessToken),
        payload: {
          recipientProvider: 'apple',
        },
      });

      assert.equal(importResponse.statusCode, 200);
      const importBody = parseBody(importResponse.body) as {
        matchedCount: number;
        skippedCount: number;
      };
      assert.equal(importBody.matchedCount, 9);
      assert.equal(importBody.skippedCount, 0);
      assert.deepEqual(
        addedTrackIds,
        Array.from({ length: 9 }, (_, index) => `catalog-song-${index + 1}`),
      );
      // One request for the whole playlist, not one per track.
      assert.equal(addTrackRequestCount, 1);
    } finally {
      globalThis.fetch = originalFetch;
      process.env.APPLE_TEAM_ID = previousAppleTeamId;
      process.env.APPLE_KEY_ID = previousAppleKeyId;
      process.env.APPLE_MUSICKIT_IDENTIFIER = previousAppleMusicKitIdentifier;
      process.env.APPLE_PRIVATE_KEY_P8 = previousApplePrivateKey;
    }
  });

  it('dashboard: subscriber sync activity dedupes historical track rows by provider track id', async () => {
    const ownerEmail = `${TEST_EMAIL_PREFIX}dedupe-owner-${randomUUID()}@synqit.test`;
    const subscriberEmail = `${TEST_EMAIL_PREFIX}dedupe-subscriber-${randomUUID()}@synqit.test`;

    const owner = await registerUser(app, ownerEmail);
    const subscriber = await registerUser(app, subscriberEmail);

    const sync = await syncsStore.createSync({
      senderUserId: owner.user.id,
      provider: 'spotify',
      providerPlaylistId: 'dedupe-dashboard-playlist',
      name: 'Dedupe Dashboard Sync',
      trackCount: 2,
      syncMode: 'host_only',
    });

    await syncsStore.upsertImport({
      syncId: sync.id,
      recipientUserId: subscriber.user.id,
      recipientProvider: 'apple',
      recipientProviderPlaylistId: 'subscriber-copy-playlist',
      status: 'active',
      matchedCount: 2,
      skippedCount: 0,
      lastSyncedAt: new Date(),
    });

    const seenAt = new Date();
    await prisma.playlist_sync_track_activity.createMany({
      data: [
        {
          id: randomUUID(),
          sync_id: sync.id,
          track_fingerprint: 'run around|blues traveler|0',
          provider_track_id: 'run around|blues traveler|0',
          name: 'Run-Around',
          artist: 'Blues Traveler',
          album: 'Four',
          artwork_url: null,
          first_seen_at: seenAt,
          created_at: seenAt,
          updated_at: seenAt,
        },
        {
          id: randomUUID(),
          sync_id: sync.id,
          track_fingerprint: 'run around|blues traveler|140',
          provider_track_id: 'spotify-track-run-around',
          name: 'Run-Around',
          artist: 'Blues Traveler',
          album: 'Four',
          artwork_url: null,
          first_seen_at: seenAt,
          created_at: seenAt,
          updated_at: seenAt,
        },
        {
          id: randomUUID(),
          sync_id: sync.id,
          track_fingerprint: 'hook|blues traveler|0',
          provider_track_id: 'hook|blues traveler|0',
          name: 'Hook',
          artist: 'Blues Traveler',
          album: 'Four',
          artwork_url: null,
          first_seen_at: seenAt,
          created_at: seenAt,
          updated_at: seenAt,
        },
        {
          id: randomUUID(),
          sync_id: sync.id,
          track_fingerprint: 'hook|blues traveler|145',
          provider_track_id: 'spotify-track-hook',
          name: 'Hook',
          artist: 'Blues Traveler',
          album: 'Four',
          artwork_url: null,
          first_seen_at: seenAt,
          created_at: seenAt,
          updated_at: seenAt,
        },
      ],
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/dashboard/summary',
      headers: authHeader(subscriber.tokens.accessToken),
    });

    assert.equal(response.statusCode, 200);
    const body = parseBody(response.body) as {
      subscriberSyncActivity: Array<{
        syncId: string;
        addedTrackCount7d: number;
      }>;
    };

    assert.equal(body.subscriberSyncActivity.length, 1);
    assert.equal(body.subscriberSyncActivity[0]?.syncId, sync.id);
    assert.equal(body.subscriberSyncActivity[0]?.addedTrackCount7d, 2);
  });

  it('syncs: track activity recording dedupes repeated provider tracks across metadata changes', async () => {
    const ownerEmail = `${TEST_EMAIL_PREFIX}activity-owner-${randomUUID()}@synqit.test`;
    const owner = await createUserAndLogin(app, ownerEmail);

    const sync = await syncsStore.createSync({
      senderUserId: owner.user.id,
      provider: 'apple',
      providerPlaylistId: 'dedupe-apple-playlist',
      name: 'Apple Dedupe Sync',
      trackCount: 1,
      syncMode: 'host_only',
    });

    const firstSeenAt = new Date();
    await syncsStore.recordTrackActivity({
      syncId: sync.id,
      seenAt: firstSeenAt,
      bootstrapSeenAt: firstSeenAt,
      tracks: [
        {
          providerTrackId: 'apple-track-1',
          name: 'Song A',
          artist: 'Artist A',
          album: 'Album A',
          durationMs: 0,
          artworkUrl: null,
        },
      ],
    });

    await syncsStore.recordTrackActivity({
      syncId: sync.id,
      seenAt: new Date(firstSeenAt.getTime() + 60_000),
      tracks: [
        {
          providerTrackId: 'apple-track-1',
          name: 'Song A',
          artist: 'Artist A',
          album: 'Album A',
          durationMs: 182000,
          artworkUrl: null,
        },
      ],
    });

    const activityRows = await prisma.playlist_sync_track_activity.findMany({
      where: {
        sync_id: sync.id,
      },
    });

    assert.equal(activityRows.length, 1);
    assert.equal(activityRows[0]?.provider_track_id, 'apple-track-1');
  });

  it('recap: aggregates new songs for owners, subscribers, hosts, and followers; skips visitors and stale activity', async () => {
    const now = new Date();
    const within7d = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const olderThan7d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const owner = await createUserAndLogin(
      app,
      `${TEST_EMAIL_PREFIX}recap-owner-${randomUUID()}@synqit.test`,
    );
    const subscriber = await createUserAndLogin(
      app,
      `${TEST_EMAIL_PREFIX}recap-sub-${randomUUID()}@synqit.test`,
    );
    const host = await createUserAndLogin(
      app,
      `${TEST_EMAIL_PREFIX}recap-host-${randomUUID()}@synqit.test`,
    );
    const follower = await createUserAndLogin(
      app,
      `${TEST_EMAIL_PREFIX}recap-follower-${randomUUID()}@synqit.test`,
    );
    const visitor = await createUserAndLogin(
      app,
      `${TEST_EMAIL_PREFIX}recap-visitor-${randomUUID()}@synqit.test`,
    );
    const staleOwner = await createUserAndLogin(
      app,
      `${TEST_EMAIL_PREFIX}recap-stale-${randomUUID()}@synqit.test`,
    );

    // Owner has a synced playlist with two new songs in the window; the
    // subscriber imports it and should see the same activity.
    const sync = await syncsStore.createSync({
      senderUserId: owner.user.id,
      provider: 'apple',
      providerPlaylistId: `recap-sync-${randomUUID()}`,
      name: 'Recap Sync',
      trackCount: 2,
      syncMode: 'host_only',
    });
    await syncsStore.recordTrackActivity({
      syncId: sync.id,
      seenAt: within7d,
      bootstrapSeenAt: within7d,
      tracks: [
        { providerTrackId: 'recap-a', name: 'Song A', artist: 'Artist A', album: 'Album A' },
        { providerTrackId: 'recap-b', name: 'Song B', artist: 'Artist B', album: 'Album B' },
      ],
    });
    await syncsStore.upsertImport({
      syncId: sync.id,
      recipientUserId: subscriber.user.id,
      recipientProvider: 'spotify',
      recipientProviderPlaylistId: `recap-sub-copy-${randomUUID()}`,
      status: 'active',
      matchedCount: 2,
      skippedCount: 0,
      lastSyncedAt: within7d,
    });

    // Host runs an event playlist that gains a guest track; a follower tracks it,
    // a visitor only views it (and must not be emailed).
    const event = await eventsStore.createEvent({
      hostUserId: host.user.id,
      provider: 'spotify',
      providerPlaylistId: `recap-event-${randomUUID()}`,
      name: 'Recap Event',
      description: 'Recap regression event.',
    });
    await eventsStore.addTrackToEvent({
      eventId: event.id,
      providerTrackId: 'recap-event-track-1',
      name: 'Guest Song',
      artist: 'Guest Artist',
      album: 'Guest Album',
      durationMs: 180000,
      artworkUrl: null,
      addedBy: 'guest',
    });
    await eventsStore.trackEvent({ eventId: event.id, userId: follower.user.id });
    await eventsStore.recordEventVisit({ eventId: event.id, userId: visitor.user.id });

    // Stale owner's only activity is outside the window -> no recap.
    const staleSync = await syncsStore.createSync({
      senderUserId: staleOwner.user.id,
      provider: 'apple',
      providerPlaylistId: `recap-stale-sync-${randomUUID()}`,
      name: 'Stale Sync',
      trackCount: 1,
      syncMode: 'host_only',
    });
    await syncsStore.recordTrackActivity({
      syncId: staleSync.id,
      seenAt: olderThan7d,
      bootstrapSeenAt: olderThan7d,
      tracks: [
        { providerTrackId: 'stale-a', name: 'Old Song', artist: 'Old Artist', album: 'Old Album' },
      ],
    });

    const digests = await buildWeeklyRecapDigests({ now, windowDays: 7 });
    const byUser = new Map(digests.map((digest) => [digest.userId, digest]));

    const ownerDigest = byUser.get(owner.user.id);
    assert.ok(ownerDigest, 'owner should receive a recap');
    const ownedEntry = ownerDigest.playlists.find((p) => p.kind === 'owned_sync');
    assert.ok(ownedEntry);
    assert.equal(ownedEntry.newTrackCount, 2);
    assert.match(ownedEntry.url, new RegExp(`/sync/${sync.magicLinkToken}$`));

    const subscriberDigest = byUser.get(subscriber.user.id);
    assert.ok(subscriberDigest, 'subscriber should receive a recap');
    const subscribedEntry = subscriberDigest.playlists.find((p) => p.kind === 'subscribed_sync');
    assert.ok(subscribedEntry);
    assert.equal(subscribedEntry.newTrackCount, 2);

    const hostDigest = byUser.get(host.user.id);
    assert.ok(hostDigest, 'host should receive a recap');
    const hostedEntry = hostDigest.playlists.find((p) => p.kind === 'hosted_event');
    assert.ok(hostedEntry);
    assert.equal(hostedEntry.newTrackCount, 1);

    const followerDigest = byUser.get(follower.user.id);
    assert.ok(followerDigest, 'follower should receive a recap');
    const followedEntry = followerDigest.playlists.find((p) => p.kind === 'followed_event');
    assert.ok(followedEntry);
    assert.equal(followedEntry.newTrackCount, 1);

    // The visitor never followed the event, and the stale owner has no recent
    // songs, so neither should receive a recap.
    assert.equal(byUser.has(visitor.user.id), false);
    assert.equal(byUser.has(staleOwner.user.id), false);
  });

  it('transfers: rejects a batch whose source and destination match', async () => {
    const email = `${TEST_EMAIL_PREFIX}transfer-same-${randomUUID()}@synqit.test`;
    const user = await registerUser(app, email);
    await connectProvider(app, { provider: 'spotify', accessToken: user.tokens.accessToken });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/transfers',
      headers: authHeader(user.tokens.accessToken),
      payload: {
        sourceProvider: 'spotify',
        destinationProvider: 'spotify',
        playlists: [{ providerPlaylistId: 'playlist-1', name: 'Same provider', trackCount: 3 }],
      },
    });

    assert.equal(response.statusCode, 400);
    assert.equal((parseBody(response.body) as { code: string }).code, 'invalid_request');
  });

  it('transfers: requires both providers to be connected', async () => {
    const email = `${TEST_EMAIL_PREFIX}transfer-unconnected-${randomUUID()}@synqit.test`;
    const user = await registerUser(app, email);
    // Source only; the destination is deliberately left unconnected.
    await connectProvider(app, { provider: 'spotify', accessToken: user.tokens.accessToken });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/transfers',
      headers: authHeader(user.tokens.accessToken),
      payload: {
        sourceProvider: 'spotify',
        destinationProvider: 'apple',
        playlists: [{ providerPlaylistId: 'playlist-1', name: 'Needs both', trackCount: 3 }],
      },
    });

    assert.equal(response.statusCode, 400);
    assert.equal((parseBody(response.body) as { code: string }).code, 'provider_not_connected');
  });

  it('transfers: rejects the same playlist selected twice', async () => {
    const email = `${TEST_EMAIL_PREFIX}transfer-dupe-${randomUUID()}@synqit.test`;
    const user = await registerUser(app, email);
    await connectProvider(app, { provider: 'spotify', accessToken: user.tokens.accessToken });
    await connectProvider(app, { provider: 'apple', accessToken: user.tokens.accessToken });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/transfers',
      headers: authHeader(user.tokens.accessToken),
      payload: {
        sourceProvider: 'spotify',
        destinationProvider: 'apple',
        playlists: [
          { providerPlaylistId: 'playlist-1', name: 'One', trackCount: 3 },
          { providerPlaylistId: 'playlist-1', name: 'One again', trackCount: 3 },
        ],
      },
    });

    assert.equal(response.statusCode, 400);
  });

  it('transfers: queues a batch and reports it back with one item per playlist', async () => {
    const email = `${TEST_EMAIL_PREFIX}transfer-batch-${randomUUID()}@synqit.test`;
    const user = await registerUser(app, email);
    await connectProvider(app, { provider: 'spotify', accessToken: user.tokens.accessToken });
    await connectProvider(app, { provider: 'apple', accessToken: user.tokens.accessToken });

    const createResponse = await app.inject({
      method: 'POST',
      url: '/v1/transfers',
      headers: authHeader(user.tokens.accessToken),
      payload: {
        sourceProvider: 'spotify',
        destinationProvider: 'apple',
        playlists: [
          { providerPlaylistId: 'playlist-a', name: 'Playlist A', trackCount: 12 },
          { providerPlaylistId: 'playlist-b', name: 'Playlist B', trackCount: null },
        ],
      },
    });

    assert.equal(createResponse.statusCode, 202);
    const created = parseBody(createResponse.body) as {
      batch: {
        id: string;
        status: string;
        sourceProvider: string;
        destinationProvider: string;
        items: Array<{
          name: string;
          status: string;
          position: number;
          matchedCount: number | null;
        }>;
      };
    };

    assert.equal(created.batch.status, 'queued');
    assert.equal(created.batch.sourceProvider, 'spotify');
    assert.equal(created.batch.destinationProvider, 'apple');
    assert.equal(created.batch.items.length, 2);
    // Items keep the submitted order so the UI can show a stable list.
    assert.deepEqual(
      created.batch.items.map((item) => item.name),
      ['Playlist A', 'Playlist B'],
    );
    assert.deepEqual(
      created.batch.items.map((item) => item.position),
      [0, 1],
    );
    assert.ok(created.batch.items.every((item) => item.status === 'queued'));
    assert.ok(created.batch.items.every((item) => item.matchedCount === null));

    const readResponse = await app.inject({
      method: 'GET',
      url: `/v1/transfers/${created.batch.id}`,
      headers: authHeader(user.tokens.accessToken),
    });
    assert.equal(readResponse.statusCode, 200);
    const read = parseBody(readResponse.body) as { batch: { id: string; items: unknown[] } };
    assert.equal(read.batch.id, created.batch.id);
    assert.equal(read.batch.items.length, 2);
  });

  it('transfers: a batch is not readable by another user', async () => {
    const ownerEmail = `${TEST_EMAIL_PREFIX}transfer-owner-${randomUUID()}@synqit.test`;
    const otherEmail = `${TEST_EMAIL_PREFIX}transfer-other-${randomUUID()}@synqit.test`;
    const owner = await registerUser(app, ownerEmail);
    const other = await registerUser(app, otherEmail);
    await connectProvider(app, { provider: 'spotify', accessToken: owner.tokens.accessToken });
    await connectProvider(app, { provider: 'apple', accessToken: owner.tokens.accessToken });

    const createResponse = await app.inject({
      method: 'POST',
      url: '/v1/transfers',
      headers: authHeader(owner.tokens.accessToken),
      payload: {
        sourceProvider: 'spotify',
        destinationProvider: 'apple',
        playlists: [{ providerPlaylistId: 'playlist-private', name: 'Private', trackCount: 1 }],
      },
    });
    assert.equal(createResponse.statusCode, 202);
    const batchId = (parseBody(createResponse.body) as { batch: { id: string } }).batch.id;

    const readResponse = await app.inject({
      method: 'GET',
      url: `/v1/transfers/${batchId}`,
      headers: authHeader(other.tokens.accessToken),
    });
    assert.equal(readResponse.statusCode, 404);
  });

  it('recap: claims a notification period only once', async () => {
    const periodKey = `test-${randomUUID()}`;
    try {
      const first = await notificationRunsStore.claimPeriod({ kind: 'weekly_recap', periodKey });
      const second = await notificationRunsStore.claimPeriod({ kind: 'weekly_recap', periodKey });
      assert.equal(first, true);
      assert.equal(second, false);
    } finally {
      await prisma.notification_runs.deleteMany({
        where: { kind: 'weekly_recap', period_key: periodKey },
      });
    }
  });
});
