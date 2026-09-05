import type { FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';

/**
 * Route-scoped rate limiters layered on top of the global per-IP limit from
 * @fastify/rate-limit.
 *
 * They are deliberately independent of that plugin: it runs at most one limiter
 * per request, so a second plugin limiter on a route would either be skipped or
 * replace the global IP limit. These run as preHandlers (after body parsing) so
 * keys can include the target account or magic-link token, which is what stops
 * credential stuffing and link abuse spread across many source IPs.
 *
 * Counters live in process memory (a fixed window per key), matching the
 * plugin's default store. Move them to Redis when the API runs more than one
 * replica.
 */

const parsePositiveInteger = (raw: string | undefined, fallback: number): number => {
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const readBodyString = (request: FastifyRequest, field: string): string => {
  const body = request.body;
  if (!body || typeof body !== 'object') {
    return '';
  }
  const value = (body as Record<string, unknown>)[field];
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
};

const readParamString = (request: FastifyRequest, field: string): string => {
  const params = request.params;
  if (!params || typeof params !== 'object') {
    return '';
  }
  const value = (params as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : '';
};

type WindowEntry = { count: number; resetAt: number };

const SWEEP_THRESHOLD = 10_000;

export type FixedWindowLimiterOptions = {
  max: number;
  windowMs: number;
  keyGenerator: (request: FastifyRequest) => string;
};

/** Builds a preHandler that allows `max` requests per key per fixed window. */
export const createFixedWindowLimiter = (
  options: FixedWindowLimiterOptions,
): preHandlerAsyncHookHandler => {
  const entries = new Map<string, WindowEntry>();

  const sweep = (now: number) => {
    if (entries.size < SWEEP_THRESHOLD) {
      return;
    }
    for (const [key, entry] of entries) {
      if (entry.resetAt <= now) {
        entries.delete(key);
      }
    }
  };

  return async (request, reply) => {
    const now = Date.now();
    sweep(now);

    const key = options.keyGenerator(request);
    const existing = entries.get(key);
    const entry =
      existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + options.windowMs };
    entry.count += 1;
    entries.set(key, entry);

    if (entry.count <= options.max) {
      return;
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    request.log.warn(
      { limiterKey: key, route: request.routeOptions?.url },
      'route rate limit exceeded',
    );
    void reply.header('Retry-After', String(retryAfterSeconds));
    return reply.status(429).send({
      code: 'rate_limited',
      message: 'Too many requests. Please wait before trying again.',
    });
  };
};

const MINUTE_MS = 60_000;

export type RouteRateLimiters = {
  /** Login, forgot-password, reset-password: keyed by IP + target email. */
  authAttempt: preHandlerAsyncHookHandler;
  /** Account creation: keyed by IP. */
  register: preHandlerAsyncHookHandler;
  /** Anonymous magic-link writes: keyed by IP + token. */
  publicWrite: preHandlerAsyncHookHandler;
  /** Analytics ingestion: keyed by IP. */
  analytics: preHandlerAsyncHookHandler;
};

/** Reads limits from env once per call; each route module builds its own set at registration. */
export const buildRouteRateLimiters = (): RouteRateLimiters => ({
  authAttempt: createFixedWindowLimiter({
    max: parsePositiveInteger(process.env.AUTH_RATE_LIMIT_MAX, 10),
    windowMs: 15 * MINUTE_MS,
    keyGenerator: (request) => `${request.ip}:${readBodyString(request, 'email')}`,
  }),
  register: createFixedWindowLimiter({
    max: parsePositiveInteger(process.env.REGISTER_RATE_LIMIT_MAX, 20),
    windowMs: 60 * MINUTE_MS,
    keyGenerator: (request) => request.ip,
  }),
  publicWrite: createFixedWindowLimiter({
    max: parsePositiveInteger(process.env.PUBLIC_WRITE_RATE_LIMIT_MAX, 60),
    windowMs: 15 * MINUTE_MS,
    keyGenerator: (request) => `${request.ip}:${readParamString(request, 'magicLinkToken')}`,
  }),
  analytics: createFixedWindowLimiter({
    max: parsePositiveInteger(process.env.ANALYTICS_RATE_LIMIT_MAX, 120),
    windowMs: MINUTE_MS,
    keyGenerator: (request) => request.ip,
  }),
});
