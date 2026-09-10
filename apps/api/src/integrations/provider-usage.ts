import type { Provider } from '@synqit/shared';
import { AsyncLocalStorage } from 'node:async_hooks';


/**
 * What a provider's API costs us, and who spent it.
 *
 * Two things are worth counting and only one of them is billed: every service
 * rate-limits by request, and YouTube alone charges published quota units — a
 * search costs 100 of a 10,000-unit day, an insert or delete 50, a list page 1.
 * So a request count is comparable across services and a unit count is only
 * meaningful where the service publishes one; for the others a unit is a
 * request, which keeps one column honest for every row.
 *
 * The spender is the part a log line cannot tell you afterwards. A search hit
 * during a party and a search hit while rebuilding a playlist look identical at
 * the HTTP layer, so the domain is carried in async context: set once where the
 * work starts, read wherever the call lands, with no parameter threaded through
 * the twenty functions in between.
 */

/** The part of the product a provider call was made for. */
export type UsageDomain =
  | 'events'
  | 'shared_list'
  | 'transfer'
  | 'link_import'
  | 'account'
  | 'other';

/** The kind of call, coarse enough to compare across services. */
export type UsageOperation = 'search' | 'write' | 'read' | 'auth';

export type ProviderUsageRecord = {
  provider: Provider;
  domain: UsageDomain;
  operation: UsageOperation;
  requests: number;
  units: number;
};

type UsageContext = { domain: UsageDomain };

const usageContext = new AsyncLocalStorage<UsageContext>();

/** Runs `fn` with everything it touches attributed to `domain`. */
export const withUsageDomain = <T>(domain: UsageDomain, fn: () => T): T =>
  usageContext.run({ domain }, fn);

export const currentUsageDomain = (): UsageDomain => usageContext.getStore()?.domain ?? 'other';

/**
 * YouTube's published costs. Everything else bills by request, so a unit is a
 * request and the two columns agree.
 */
const YOUTUBE_UNIT_COST: Record<UsageOperation, number> = {
  search: 100,
  write: 50,
  read: 1,
  auth: 1,
};

export const unitCostFor = (provider: Provider, operation: UsageOperation): number =>
  provider === 'youtube' ? YOUTUBE_UNIT_COST[operation] : 1;

type UsageSink = (record: ProviderUsageRecord) => void;

let sink: UsageSink = () => {};

/** Wired at startup, so this module stays free of a database import. */
export const setProviderUsageSink = (next: UsageSink): void => {
  sink = next;
};

/**
 * Counts one call. Never throws and never awaits: usage accounting must not be
 * able to fail a transfer or slow a guest's search.
 */
export const recordProviderCall = (params: {
  provider: Provider;
  operation: UsageOperation;
  /** Defaults to the ambient domain. */
  domain?: UsageDomain;
  /** For a call that stands for several, e.g. one insert per track. */
  requests?: number;
}): void => {
  const requests = Math.max(1, Math.round(params.requests ?? 1));
  const domain = params.domain ?? currentUsageDomain();
  try {
    sink({
      provider: params.provider,
      domain,
      operation: params.operation,
      requests,
      units: unitCostFor(params.provider, params.operation) * requests,
    });
  } catch {
    // Counting is never worth an error path of its own.
  }
};
