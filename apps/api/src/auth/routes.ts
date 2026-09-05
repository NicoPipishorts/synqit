import {
  authCredentialsSchema,
  authResponseSchema,
  authUserSchema,
  changePasswordRequestSchema,
  type EmailLocale,
  forgotPasswordRequestSchema,
  forgotPasswordResponseSchema,
  getPasswordCriteria,
  personalInfoResponseSchema,
  registerCredentialsSchema,
  refreshResponseSchema,
  resetPasswordRequestSchema,
  resetPasswordResponseSchema,
  updatePersonalInfoRequestSchema,
  updateUserPreferencesRequestSchema,
  userPreferencesResponseSchema,
} from '@synqit/shared';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import {
  buildAvatarUrl,
  createAvatarReadStream,
  deleteAvatarImage,
  resolveAvatarFile,
  saveAvatarImage,
} from './avatar-storage';
import {
  createOpaqueToken,
  createRefreshToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from './crypto';
import { loadAuthenticatedUser, requireJwtAuth } from './guards';
import {
  clearSessionCookies,
  getSessionRefreshTokenFromRequest,
  setSessionCookies,
} from './session-cookies';
import { authStore, UserRecord } from './store';
import {
  enqueuePasswordResetEmail,
  isPasswordResetEmailEnabled,
} from '../jobs/password-reset-email';
import {
  enqueueRegistrationConfirmationEmail,
  isRegistrationConfirmationEmailEnabled,
} from '../jobs/registration-email';
import { buildRouteRateLimiters } from '../security/rate-limits';

const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 60 * 15;
const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 30;
const DEFAULT_PASSWORD_RESET_TOKEN_TTL_MINUTES = 30;
const AVATAR_UPLOAD_ROUTE_BODY_LIMIT_BYTES = 12_000_000;

const parsePositiveNumber = (raw: string | undefined, fallback: number): number => {
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
};

const accessTokenTtlSeconds = parsePositiveNumber(
  process.env.ACCESS_TOKEN_TTL_SECONDS,
  DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
);
const refreshTokenTtlDays = parsePositiveNumber(
  process.env.REFRESH_TOKEN_TTL_DAYS,
  DEFAULT_REFRESH_TOKEN_TTL_DAYS,
);
const refreshTokenTtlMs = refreshTokenTtlDays * 24 * 60 * 60 * 1000;
const refreshTokenTtlSeconds = refreshTokenTtlDays * 24 * 60 * 60;
const passwordResetTokenTtlMinutes = parsePositiveNumber(
  process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES,
  DEFAULT_PASSWORD_RESET_TOKEN_TTL_MINUTES,
);
const passwordResetTokenTtlMs = passwordResetTokenTtlMinutes * 60 * 1000;
const avatarUploadRequestSchema = z.object({
  imageDataUrl: z.string().min(1),
});
const avatarPublicParamsSchema = z.object({
  fileName: z.string().min(1),
});
const emptyPersonalInfo = {
  displayName: null,
  firstName: null,
  lastName: null,
  birthDate: null,
  country: null,
} as const;

const getValidationErrorMessage = (details: unknown): string => {
  if (!details || typeof details !== 'object') {
    return 'Request payload is invalid.';
  }

  const typedDetails = details as {
    formErrors?: unknown;
    fieldErrors?: Record<string, unknown>;
  };

  if (Array.isArray(typedDetails.formErrors)) {
    const firstFormError = typedDetails.formErrors.find((entry) => typeof entry === 'string');
    if (typeof firstFormError === 'string' && firstFormError.trim().length > 0) {
      return firstFormError;
    }
  }

  if (typedDetails.fieldErrors && typeof typedDetails.fieldErrors === 'object') {
    for (const value of Object.values(typedDetails.fieldErrors)) {
      if (!Array.isArray(value)) {
        continue;
      }
      const firstFieldError = value.find((entry) => typeof entry === 'string');
      if (typeof firstFieldError === 'string' && firstFieldError.trim().length > 0) {
        return firstFieldError;
      }
    }
  }

  return 'Request payload is invalid.';
};

const getRegisterValidationMessage = (password: string, details: unknown): string => {
  const criteria = getPasswordCriteria(password);
  const missingCriteria: string[] = [];

  if (!criteria.length) {
    missingCriteria.push('at least 8 characters');
  }
  if (!criteria.case) {
    missingCriteria.push('uppercase and lowercase letters');
  }
  if (!criteria.number) {
    missingCriteria.push('a number');
  }
  if (!criteria.special) {
    missingCriteria.push('a special character');
  }

  if (missingCriteria.length > 0) {
    return `Password must include ${missingCriteria.join(', ')}.`;
  }

  return getValidationErrorMessage(details);
};

const sendValidationError = (reply: FastifyReply, details: unknown, message?: string) =>
  reply.status(400).send({
    code: 'validation_error',
    message: message ?? getValidationErrorMessage(details),
    details,
  });

const sendForgotPasswordAccepted = (reply: FastifyReply) =>
  reply.status(200).send(
    forgotPasswordResponseSchema.parse({
      ok: true,
    }),
  );

const formatPublicUser = (user: UserRecord) =>
  authUserSchema.parse({
    id: user.id,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    avatarUrl: buildAvatarUrl(user.avatarPath),
    role: user.role,
    adminPermissions: user.adminPermissions,
    accountState: user.accountState,
    isTestAccount: user.isTestAccount,
  });

const normalizeOptionalText = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeLocaleHeader = (headerValue: string | string[] | undefined): EmailLocale | null => {
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (typeof raw !== 'string') {
    return null;
  }

  const firstLocale = raw.split(',')[0]?.trim().toLowerCase();
  if (!firstLocale) {
    return null;
  }

  if (firstLocale.startsWith('fr')) {
    return 'fr';
  }

  if (firstLocale.startsWith('en')) {
    return 'en';
  }

  return null;
};

const resolveRequestEmailLocale = (request: FastifyRequest): EmailLocale => {
  const explicitLocale = normalizeLocaleHeader(request.headers['x-synqit-locale']);
  if (explicitLocale) {
    return explicitLocale;
  }

  const acceptLanguageLocale = normalizeLocaleHeader(request.headers['accept-language']);
  if (acceptLanguageLocale) {
    return acceptLanguageLocale;
  }

  return 'en';
};

const resolveUserPreferredEmailLocale = async (
  userId: string,
  request: FastifyRequest,
): Promise<EmailLocale> => {
  const preferences = await authStore.findUserPreferencesByUserId(userId);
  if (preferences?.locale === 'fr' || preferences?.locale === 'en') {
    return preferences.locale;
  }

  return resolveRequestEmailLocale(request);
};

const formatPersonalInfo = (
  value: {
    displayName: string | null;
    firstName: string | null;
    lastName: string | null;
    birthDate: string | null;
    country: string | null;
  } | null,
) =>
  personalInfoResponseSchema.parse({
    personalInfo: {
      displayName: value?.displayName ?? null,
      firstName: value?.firstName ?? null,
      lastName: value?.lastName ?? null,
      birthDate: value?.birthDate ?? null,
      country: value?.country ?? null,
    },
  });

const requireAuth = requireJwtAuth;

const readRefreshTokenFromRequest = (request: FastifyRequest): string | null => {
  const body =
    request.body && typeof request.body === 'object'
      ? (request.body as { refreshToken?: unknown })
      : null;

  if (body && typeof body.refreshToken === 'string' && body.refreshToken.trim().length > 0) {
    return body.refreshToken.trim();
  }

  return getSessionRefreshTokenFromRequest(request, 'web');
};

const issueTokens = async (app: FastifyInstance, user: UserRecord) => {
  const refreshToken = createRefreshToken();
  const refreshTokenHash = hashToken(refreshToken);

  await authStore.createRefreshToken({
    userId: user.id,
    tokenHash: refreshTokenHash,
    expiresAt: new Date(Date.now() + refreshTokenTtlMs),
  });

  const accessToken = app.jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    {
      expiresIn: accessTokenTtlSeconds,
    },
  );

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer' as const,
    expiresInSeconds: accessTokenTtlSeconds,
  };
};

export const registerAuthRoutes = async (app: FastifyInstance): Promise<void> => {
  const limiters = buildRouteRateLimiters();

  app.get('/public/avatars/:fileName', async (request, reply) => {
    const params = avatarPublicParamsSchema.safeParse(request.params);
    if (!params.success) {
      return sendValidationError(reply, params.error.flatten());
    }

    const resolved = await resolveAvatarFile(params.data.fileName);
    if (!resolved) {
      return reply.status(404).send({
        code: 'avatar_not_found',
        message: 'Avatar image not found.',
      });
    }

    // Allow avatar images to be embedded by the web app when API and web origins differ.
    reply.header('cross-origin-resource-policy', 'cross-origin');
    reply.header('cache-control', 'public, max-age=604800, immutable');
    return reply.type(resolved.contentType).send(createAvatarReadStream(resolved.filePath));
  });

  app.post('/auth/register', { preHandler: limiters.register }, async (request, reply) => {
    const parsed = registerCredentialsSchema.safeParse(request.body);
    if (!parsed.success) {
      const details = parsed.error.flatten();
      const password =
        request.body && typeof request.body === 'object' && 'password' in request.body
          ? request.body.password
          : undefined;
      return sendValidationError(
        reply,
        typeof password === 'string'
          ? { ...details, passwordCriteria: getPasswordCriteria(password) }
          : details,
        typeof password === 'string' ? getRegisterValidationMessage(password, details) : undefined,
      );
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const registrationResult = await authStore.registerUser({
      email: parsed.data.email,
      passwordHash,
    });
    if (registrationResult.kind !== 'created') {
      return reply.status(409).send({
        code: 'email_taken',
        message: 'An account already exists for that email.',
      });
    }

    const user = registrationResult.user;

    const tokens = await issueTokens(app, user);
    setSessionCookies(reply, 'web', {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenMaxAgeSeconds: accessTokenTtlSeconds,
      refreshTokenMaxAgeSeconds: refreshTokenTtlSeconds,
    });

    if (isRegistrationConfirmationEmailEnabled()) {
      try {
        await enqueueRegistrationConfirmationEmail({
          userId: user.id,
          toEmail: user.email,
          locale: resolveRequestEmailLocale(request),
        });
      } catch (error) {
        request.log.warn(
          {
            err: error,
            userId: user.id,
            email: user.email,
          },
          'failed to enqueue registration confirmation email',
        );
      }
    }

    return authResponseSchema.parse({
      user: formatPublicUser(user),
      tokens,
    });
  });

  app.post('/auth/login', { preHandler: limiters.authAttempt }, async (request, reply) => {
    const parsed = authCredentialsSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendValidationError(reply, parsed.error.flatten());
    }

    const passwordIdentity = await authStore.findPasswordIdentityByEmail(parsed.data.email);
    const user = passwordIdentity
      ? await authStore.findUserById(passwordIdentity.userId)
      : await authStore.findUserByEmail(parsed.data.email);
    if (!user) {
      return reply.status(401).send({
        code: 'invalid_credentials',
        message: 'Invalid email or password.',
      });
    }

    const passwordHash = passwordIdentity?.passwordHash ?? user.passwordHash;
    if (!passwordHash) {
      return reply.status(401).send({
        code: 'invalid_credentials',
        message: 'Invalid email or password.',
      });
    }

    if (user.isBlocked) {
      return reply.status(403).send({
        code: 'account_blocked',
        message: 'Your account is blocked.',
      });
    }

    const isPasswordValid = await verifyPassword(parsed.data.password, passwordHash);
    if (!isPasswordValid) {
      return reply.status(401).send({
        code: 'invalid_credentials',
        message: 'Invalid email or password.',
      });
    }

    if (!passwordIdentity) {
      await authStore.upsertPasswordIdentity({
        userId: user.id,
        email: user.email,
        passwordHash,
      });
    }

    const tokens = await issueTokens(app, user);
    setSessionCookies(reply, 'web', {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenMaxAgeSeconds: accessTokenTtlSeconds,
      refreshTokenMaxAgeSeconds: refreshTokenTtlSeconds,
    });

    return authResponseSchema.parse({
      user: formatPublicUser(user),
      tokens,
    });
  });

  app.post(
    '/auth/forgot-password',
    { preHandler: limiters.authAttempt },
    async (request, reply) => {
      const parsed = forgotPasswordRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error.flatten());
      }

      const user = await authStore.findUserByEmail(parsed.data.email);
      if (!user || !isPasswordResetEmailEnabled()) {
        return sendForgotPasswordAccepted(reply);
      }

      try {
        const resetToken = createOpaqueToken();
        const tokenRecord = await authStore.createPasswordResetToken({
          userId: user.id,
          tokenHash: hashToken(resetToken),
          expiresAt: new Date(Date.now() + passwordResetTokenTtlMs),
        });

        if (!tokenRecord) {
          request.log.warn({ userId: user.id }, 'password reset token storage unavailable');
          return sendForgotPasswordAccepted(reply);
        }

        await enqueuePasswordResetEmail({
          userId: user.id,
          toEmail: user.email,
          locale: await resolveUserPreferredEmailLocale(user.id, request),
          resetToken,
        });
      } catch (error) {
        request.log.warn(
          {
            err: error,
            userId: user.id,
            email: user.email,
          },
          'failed to enqueue password reset email',
        );
      }

      return sendForgotPasswordAccepted(reply);
    },
  );

  app.post('/auth/reset-password', { preHandler: limiters.authAttempt }, async (request, reply) => {
    const parsed = resetPasswordRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendValidationError(reply, parsed.error.flatten());
    }

    const tokenRecord = await authStore.findActivePasswordResetTokenByHash(
      hashToken(parsed.data.token),
    );
    if (!tokenRecord) {
      return reply.status(400).send({
        code: 'invalid_reset_token',
        message: 'Reset link is invalid or expired.',
      });
    }

    const user = await authStore.findUserById(tokenRecord.userId);
    if (!user) {
      await authStore.markPasswordResetTokenUsedById(tokenRecord.id);
      return reply.status(400).send({
        code: 'invalid_reset_token',
        message: 'Reset link is invalid or expired.',
      });
    }

    const nextPasswordHash = await hashPassword(parsed.data.newPassword);
    const updated = await authStore.updateUserPasswordById(user.id, nextPasswordHash);
    if (!updated) {
      return reply.status(500).send({
        code: 'password_update_failed',
        message: 'Unable to update password at this time.',
      });
    }

    const identityUpdated = await authStore.upsertPasswordIdentity({
      userId: user.id,
      email: user.email,
      passwordHash: nextPasswordHash,
    });
    if (!identityUpdated) {
      return reply.status(500).send({
        code: 'password_update_failed',
        message: 'Unable to update password at this time.',
      });
    }

    await authStore.markPasswordResetTokenUsedById(tokenRecord.id);
    await authStore.revokeAllRefreshTokensByUserId(user.id);

    return resetPasswordResponseSchema.parse({
      ok: true,
    });
  });

  app.post('/auth/refresh', async (request, reply) => {
    const refreshToken = readRefreshTokenFromRequest(request);
    if (!refreshToken) {
      clearSessionCookies(reply, 'web');
      return reply.status(401).send({
        code: 'invalid_refresh_token',
        message: 'Refresh token is invalid.',
      });
    }

    const oldTokenHash = hashToken(refreshToken);
    const tokenRecord = await authStore.findRefreshTokenByHash(oldTokenHash);
    if (!tokenRecord) {
      clearSessionCookies(reply, 'web');
      return reply.status(401).send({
        code: 'invalid_refresh_token',
        message: 'Refresh token is invalid.',
      });
    }

    if (tokenRecord.revokedAt || tokenRecord.expiresAt.getTime() <= Date.now()) {
      await authStore.revokeRefreshTokenByHash(oldTokenHash);
      clearSessionCookies(reply, 'web');
      return reply.status(401).send({
        code: 'invalid_refresh_token',
        message: 'Refresh token is invalid.',
      });
    }

    const user = await authStore.findUserById(tokenRecord.userId);
    if (!user) {
      await authStore.revokeRefreshTokenByHash(oldTokenHash);
      clearSessionCookies(reply, 'web');
      return reply.status(401).send({
        code: 'invalid_refresh_token',
        message: 'Refresh token is invalid.',
      });
    }

    if (user.isBlocked) {
      await authStore.revokeRefreshTokenByHash(oldTokenHash);
      clearSessionCookies(reply, 'web');
      return reply.status(403).send({
        code: 'account_blocked',
        message: 'Your account is blocked.',
      });
    }

    const nextRefreshToken = createRefreshToken();
    const nextRefreshTokenHash = hashToken(nextRefreshToken);
    const rotatedTokenRecord = await authStore.rotateRefreshToken({
      oldTokenHash,
      newTokenHash: nextRefreshTokenHash,
      expiresAt: new Date(Date.now() + refreshTokenTtlMs),
    });

    if (!rotatedTokenRecord) {
      clearSessionCookies(reply, 'web');
      return reply.status(401).send({
        code: 'invalid_refresh_token',
        message: 'Refresh token is invalid.',
      });
    }

    const accessToken = app.jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
      },
      {
        expiresIn: accessTokenTtlSeconds,
      },
    );

    const userPreferences = await authStore.findUserPreferencesByUserId(user.id);
    setSessionCookies(reply, 'web', {
      accessToken,
      refreshToken: nextRefreshToken,
      accessTokenMaxAgeSeconds: accessTokenTtlSeconds,
      refreshTokenMaxAgeSeconds: refreshTokenTtlSeconds,
    });

    return refreshResponseSchema.parse({
      tokens: {
        accessToken,
        refreshToken: nextRefreshToken,
        tokenType: 'Bearer',
        expiresInSeconds: accessTokenTtlSeconds,
      },
      snapshot: {
        avatarUrl: buildAvatarUrl(user.avatarPath),
        theme: userPreferences?.theme ?? null,
        locale: userPreferences?.locale ?? null,
      },
    });
  });

  app.post('/auth/logout', async (request, reply) => {
    const refreshToken = readRefreshTokenFromRequest(request);
    if (refreshToken) {
      await authStore.revokeRefreshTokenByHash(hashToken(refreshToken));
    }
    clearSessionCookies(reply, 'web');

    return reply.status(200).send({
      ok: true,
    });
  });

  app.post(
    '/auth/change-password',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const parsed = changePasswordRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error.flatten());
      }

      const user = await loadAuthenticatedUser(request, reply, { blockedBehavior: 'forbidden' });
      if (!user) {
        return;
      }

      const passwordIdentity = await authStore.findPasswordIdentityByUserId(user.id);
      const currentPasswordHash = passwordIdentity?.passwordHash ?? user.passwordHash;
      if (!currentPasswordHash) {
        return reply.status(400).send({
          code: 'password_not_available',
          message: 'Password authentication is not enabled for this account.',
        });
      }

      const isCurrentPasswordValid = await verifyPassword(
        parsed.data.currentPassword,
        currentPasswordHash,
      );
      if (!isCurrentPasswordValid) {
        return reply.status(401).send({
          code: 'invalid_credentials',
          message: 'Current password is invalid.',
        });
      }

      const nextPasswordHash = await hashPassword(parsed.data.newPassword);
      const updated = await authStore.updateUserPasswordById(user.id, nextPasswordHash);
      if (!updated) {
        return reply.status(500).send({
          code: 'password_update_failed',
          message: 'Unable to update password at this time.',
        });
      }

      await authStore.upsertPasswordIdentity({
        userId: user.id,
        email: user.email,
        passwordHash: nextPasswordHash,
      });

      return reply.status(200).send({
        ok: true,
      });
    },
  );

  app.post(
    '/auth/avatar',
    {
      preHandler: requireAuth,
      bodyLimit: AVATAR_UPLOAD_ROUTE_BODY_LIMIT_BYTES,
    },
    async (request, reply) => {
      const parsed = avatarUploadRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error.flatten());
      }

      const user = await loadAuthenticatedUser(request, reply, { blockedBehavior: 'forbidden' });
      if (!user) {
        return;
      }

      let nextAvatarPath: string;
      try {
        const stored = await saveAvatarImage({
          userId: user.id,
          imageDataUrl: parsed.data.imageDataUrl,
        });
        nextAvatarPath = stored.avatarPath;
      } catch (error) {
        const normalizedError = error as { message?: string };
        if (normalizedError.message === 'invalid_avatar_image') {
          return reply.status(400).send({
            code: 'invalid_avatar_image',
            message: 'Avatar must be a valid image under size limits.',
          });
        }

        request.log.error({ error }, 'avatar upload failed');
        return reply.status(500).send({
          code: 'avatar_upload_failed',
          message: 'Unable to store avatar at this time.',
        });
      }

      const updated = await authStore.updateUserAvatarPathById(user.id, nextAvatarPath);
      if (!updated) {
        await deleteAvatarImage(nextAvatarPath).catch(() => undefined);
        return reply.status(500).send({
          code: 'avatar_update_failed',
          message: 'Unable to update avatar at this time.',
        });
      }

      if (user.avatarPath && user.avatarPath !== nextAvatarPath) {
        await deleteAvatarImage(user.avatarPath).catch(() => undefined);
      }

      const refreshedUser = await authStore.findUserById(user.id);
      if (!refreshedUser) {
        return reply.status(500).send({
          code: 'avatar_update_failed',
          message: 'Unable to load updated avatar at this time.',
        });
      }

      return {
        user: formatPublicUser(refreshedUser),
      };
    },
  );

  app.delete(
    '/auth/avatar',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const user = await loadAuthenticatedUser(request, reply, { blockedBehavior: 'forbidden' });
      if (!user) {
        return;
      }

      const updated = await authStore.updateUserAvatarPathById(user.id, null);
      if (!updated) {
        return reply.status(500).send({
          code: 'avatar_update_failed',
          message: 'Unable to remove avatar at this time.',
        });
      }

      if (user.avatarPath) {
        await deleteAvatarImage(user.avatarPath).catch(() => undefined);
      }

      const refreshedUser = await authStore.findUserById(user.id);
      if (!refreshedUser) {
        return reply.status(500).send({
          code: 'avatar_update_failed',
          message: 'Unable to load updated avatar at this time.',
        });
      }

      return {
        user: formatPublicUser(refreshedUser),
      };
    },
  );

  app.get(
    '/auth/personal-info',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const user = await loadAuthenticatedUser(request, reply, { blockedBehavior: 'forbidden' });
      if (!user) {
        return;
      }

      const personalInfo = await authStore.findUserPersonalInfoByUserId(user.id);
      return formatPersonalInfo(personalInfo);
    },
  );

  app.put(
    '/auth/personal-info',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const parsed = updatePersonalInfoRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error.flatten());
      }

      const user = await loadAuthenticatedUser(request, reply, { blockedBehavior: 'forbidden' });
      if (!user) {
        return;
      }

      const normalized = {
        displayName: normalizeOptionalText(parsed.data.displayName),
        firstName: normalizeOptionalText(parsed.data.firstName),
        lastName: normalizeOptionalText(parsed.data.lastName),
        birthDate: normalizeOptionalText(parsed.data.birthDate),
        country: normalizeOptionalText(parsed.data.country),
      };
      const hasAnyValue = Object.values(normalized).some((value) => value !== null);

      if (!hasAnyValue) {
        await authStore.clearUserPersonalInfoByUserId(user.id);
        return formatPersonalInfo(emptyPersonalInfo);
      }

      const upserted = await authStore.upsertUserPersonalInfoByUserId(user.id, normalized);
      if (!upserted) {
        return reply.status(500).send({
          code: 'personal_info_update_failed',
          message: 'Unable to update personal info at this time.',
        });
      }

      return formatPersonalInfo(upserted);
    },
  );

  app.delete(
    '/auth/personal-info',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const user = await loadAuthenticatedUser(request, reply, { blockedBehavior: 'forbidden' });
      if (!user) {
        return;
      }

      await authStore.clearUserPersonalInfoByUserId(user.id);
      return formatPersonalInfo(emptyPersonalInfo);
    },
  );

  app.get(
    '/me',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const user = await loadAuthenticatedUser(request, reply, { blockedBehavior: 'forbidden' });
      if (!user) {
        return;
      }

      return formatPublicUser(user);
    },
  );

  app.get(
    '/auth/preferences',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const user = await loadAuthenticatedUser(request, reply, { blockedBehavior: 'forbidden' });
      if (!user) {
        return;
      }

      const prefs = await authStore.findUserPreferencesByUserId(user.id);
      return userPreferencesResponseSchema.parse({
        preferences: {
          theme: prefs?.theme ?? null,
          locale: prefs?.locale ?? null,
        },
      });
    },
  );

  app.put(
    '/auth/preferences',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const parsed = updateUserPreferencesRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error.flatten());
      }

      const user = await loadAuthenticatedUser(request, reply, { blockedBehavior: 'forbidden' });
      if (!user) {
        return;
      }

      const existing = await authStore.findUserPreferencesByUserId(user.id);
      const next = {
        theme: parsed.data.theme !== undefined ? parsed.data.theme : (existing?.theme ?? null),
        locale: parsed.data.locale !== undefined ? parsed.data.locale : (existing?.locale ?? null),
      };

      const upserted = await authStore.upsertUserPreferencesByUserId(user.id, next);
      if (!upserted) {
        return reply.status(500).send({
          code: 'preferences_update_failed',
          message: 'Unable to update preferences at this time.',
        });
      }

      return userPreferencesResponseSchema.parse({
        preferences: {
          theme: upserted.theme,
          locale: upserted.locale,
        },
      });
    },
  );
};
