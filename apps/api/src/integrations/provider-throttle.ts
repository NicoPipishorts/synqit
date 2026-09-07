import { ProviderApiError } from './provider-api-error';

const DEFAULT_MAX_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 400;
const MAX_BACKOFF_MS = 20_000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const isRetryableProviderError = (error: unknown): error is ProviderApiError =>
  error instanceof ProviderApiError && (error.statusCode === 429 || error.statusCode >= 500);

const backoffDelayMs = (error: ProviderApiError, attempt: number): number => {
  if (error.retryAfterSeconds !== null) {
    return Math.min(error.retryAfterSeconds * 1000, MAX_BACKOFF_MS);
  }

  // Exponential with jitter, so a batch that trips a rate limit does not
  // resume in lockstep across every in-flight request.
  const exponential = BASE_BACKOFF_MS * 2 ** attempt;
  return Math.min(exponential + Math.random() * BASE_BACKOFF_MS, MAX_BACKOFF_MS);
};

/**
 * Retries a provider call on rate limits and 5xx, honouring `Retry-After`.
 * Every other failure (401, 403, 404, a malformed payload) is thrown straight
 * through — those do not get better by trying again.
 */
export const withProviderRetry = async <T>(
  run: () => Promise<T>,
  options?: { maxAttempts?: number },
): Promise<T> => {
  const maxAttempts = Math.max(1, options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);

  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (!isRetryableProviderError(error) || attempt === maxAttempts - 1) {
        throw error;
      }
      await sleep(backoffDelayMs(error, attempt));
    }
  }

  throw lastError;
};

/**
 * Runs `task` over `items` with at most `limit` in flight. Results keep input
 * order, which matters here: playlist order is derived from it.
 */
export const mapWithConcurrency = async <Item, Result>(
  items: readonly Item[],
  limit: number,
  task: (item: Item, index: number) => Promise<Result>,
): Promise<Result[]> => {
  const results = new Array<Result>(items.length);
  const workerCount = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;

  const runWorker = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index]!, index);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, runWorker));
  return results;
};

/** Splits `items` into consecutive chunks of at most `size`. */
export const chunk = <Item>(items: readonly Item[], size: number): Item[][] => {
  const chunks: Item[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};
