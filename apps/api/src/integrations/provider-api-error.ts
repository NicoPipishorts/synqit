import type { Provider } from '@synqit/shared';

/**
 * Shared provider failure. Lives in its own module so throttling helpers can
 * inspect it without importing a provider client (which would be a cycle).
 */
export class ProviderApiError extends Error {
  provider: Provider;
  statusCode: number;
  details: unknown;
  /** Parsed `Retry-After`, when the provider sent one. Seconds. */
  retryAfterSeconds: number | null;

  constructor(params: {
    provider: Provider;
    statusCode: number;
    message: string;
    details?: unknown;
    retryAfterSeconds?: number | null;
  }) {
    super(params.message);
    this.name = 'ProviderApiError';
    this.provider = params.provider;
    this.statusCode = params.statusCode;
    this.details = params.details ?? null;
    this.retryAfterSeconds = params.retryAfterSeconds ?? null;
  }
}

/**
 * `Retry-After` is either a delay in seconds or an HTTP date. Anything we
 * cannot read becomes null so callers fall back to their own backoff.
 */
export const parseRetryAfterSeconds = (headerValue: string | null): number | null => {
  if (!headerValue) {
    return null;
  }

  const asSeconds = Number.parseInt(headerValue.trim(), 10);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return asSeconds;
  }

  const asDate = Date.parse(headerValue);
  if (Number.isNaN(asDate)) {
    return null;
  }

  return Math.max(0, Math.ceil((asDate - Date.now()) / 1000));
};
