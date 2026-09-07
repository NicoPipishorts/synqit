import {
  analyticsTrackRequestSchema,
  analyticsTrackResponseSchema,
  type EmailLocale,
} from '@synqit/shared';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { analyticsStore } from './store';
import { authStore } from '../auth/store';
import { buildRouteRateLimiters } from '../security/rate-limits';

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

const resolveOptionalLocale = (request: FastifyRequest): 'en' | 'fr' | null => {
  const explicitLocale = normalizeLocaleHeader(request.headers['x-synqit-locale']);
  if (explicitLocale) {
    return explicitLocale;
  }

  const acceptLanguageLocale = normalizeLocaleHeader(request.headers['accept-language']);
  if (acceptLanguageLocale) {
    return acceptLanguageLocale;
  }

  return null;
};

const sendValidationError = (reply: FastifyReply, details: unknown) =>
  reply.status(400).send({
    code: 'validation_error',
    message: 'Request payload is invalid.',
    details,
  });

const resolveOptionalUserId = async (request: FastifyRequest): Promise<string | null> => {
  const authHeader = request.headers.authorization;
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    await request.jwtVerify();
  } catch {
    return null;
  }

  if (
    !request.user ||
    typeof request.user !== 'object' ||
    !('sub' in request.user) ||
    typeof request.user.sub !== 'string'
  ) {
    return null;
  }

  const user = await authStore.findUserById(request.user.sub);
  return user ? user.id : null;
};

export const registerAnalyticsRoutes = async (app: FastifyInstance): Promise<void> => {
  const limiters = buildRouteRateLimiters();

  app.post('/analytics/events', { preHandler: limiters.analytics }, async (request, reply) => {
    const parsed = analyticsTrackRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendValidationError(reply, parsed.error.flatten());
    }

    const userId = await resolveOptionalUserId(request);

    try {
      await analyticsStore.recordEvent({
        userId,
        sessionId: parsed.data.sessionId,
        eventName: parsed.data.eventName,
        target: parsed.data.target,
        path: parsed.data.path,
        locale: parsed.data.locale ?? resolveOptionalLocale(request),
        source: parsed.data.source,
        // Prefer what the client captured: beacons reach us cross-origin, so the
        // `Referer` header is trimmed to our own origin and says nothing about
        // where the visitor actually came from. The header is only a fallback
        // for same-origin callers that send no explicit referrer.
        referrer:
          parsed.data.referrer ??
          (typeof request.headers.referer === 'string'
            ? request.headers.referer.slice(0, 512)
            : null),
        properties: parsed.data.properties,
      });
    } catch (error) {
      request.log.warn(
        {
          err: error,
          eventName: parsed.data.eventName,
          target: parsed.data.target,
        },
        'analytics event ingest failed',
      );
    }

    return reply.status(202).send(
      analyticsTrackResponseSchema.parse({
        ok: true,
      }),
    );
  });
};
