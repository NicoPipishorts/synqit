import { providerSchema } from '@synqit/shared';
import { randomUUID } from 'node:crypto';


import { prisma } from '../db/prisma';
import type { ProviderUsageRecord } from '../integrations/provider-usage';

/**
 * The usage counters, written on a buffer and read back for the admin panel.
 *
 * Counting must never sit in the path of the thing being counted, so calls land
 * in memory and a timer flushes them: one upsert per bucket per flush instead of
 * one write per provider call, and a guest searching during a party waits for
 * none of it.
 */

const FLUSH_INTERVAL_MS = 10_000;

type BucketKey = string;
type Bucket = ProviderUsageRecord & { day: Date };

const pending = new Map<BucketKey, Bucket>();
let flushTimer: NodeJS.Timeout | null = null;

const startOfUtcDay = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

export const bufferProviderUsage = (record: ProviderUsageRecord, now = new Date()): void => {
  const day = startOfUtcDay(now);
  const key = `${day.toISOString()}|${record.provider}|${record.domain}|${record.operation}`;
  const existing = pending.get(key);
  if (existing) {
    existing.requests += record.requests;
    existing.units += record.units;
    return;
  }
  pending.set(key, { ...record, day });
};

/** Writes what has piled up. Safe to call at any time; used by the tests too. */
export const flushProviderUsage = async (): Promise<void> => {
  if (pending.size === 0) {
    return;
  }
  const buckets = [...pending.values()];
  pending.clear();
  const now = new Date();

  for (const bucket of buckets) {
    try {
      await prisma.provider_api_usage.upsert({
        where: {
          day_provider_domain_operation: {
            day: bucket.day,
            provider: bucket.provider,
            domain: bucket.domain,
            operation: bucket.operation,
          },
        },
        create: {
          id: randomUUID(),
          day: bucket.day,
          provider: bucket.provider,
          domain: bucket.domain,
          operation: bucket.operation,
          request_count: bucket.requests,
          unit_count: bucket.units,
          created_at: now,
          updated_at: now,
        },
        update: {
          request_count: { increment: bucket.requests },
          unit_count: { increment: bucket.units },
          updated_at: now,
        },
      });
    } catch {
      // A counter that cannot be written is not worth a failed request; the
      // next flush carries on with the buckets that follow.
    }
  }
};

export const startProviderUsageFlusher = (): void => {
  if (flushTimer) {
    return;
  }
  flushTimer = setInterval(() => {
    void flushProviderUsage();
  }, FLUSH_INTERVAL_MS);
  flushTimer.unref?.();
};

export const stopProviderUsageFlusher = (): void => {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
};

export type ProviderUsageRow = {
  provider: string;
  domain: string;
  operation: string;
  requestCount: number;
  unitCount: number;
};

/** Usage over a window, one row per provider/domain/operation bucket. */
export const readProviderUsage = async (params: {
  since: Date;
}): Promise<{
  rows: ProviderUsageRow[];
  byDay: { day: string; requests: number; units: number }[];
}> => {
  const buckets = await prisma.provider_api_usage.groupBy({
    by: ['provider', 'domain', 'operation'],
    where: { day: { gte: startOfUtcDay(params.since) } },
    _sum: { request_count: true, unit_count: true },
  });

  const days = await prisma.provider_api_usage.groupBy({
    by: ['day'],
    where: { day: { gte: startOfUtcDay(params.since) } },
    _sum: { request_count: true, unit_count: true },
    orderBy: { day: 'asc' },
  });

  return {
    rows: buckets
      .filter((bucket) => providerSchema.safeParse(bucket.provider).success)
      .map((bucket) => ({
        provider: bucket.provider,
        domain: bucket.domain,
        operation: bucket.operation,
        requestCount: bucket._sum.request_count ?? 0,
        unitCount: bucket._sum.unit_count ?? 0,
      })),
    byDay: days.map((entry) => ({
      day: entry.day.toISOString().slice(0, 10),
      requests: entry._sum.request_count ?? 0,
      units: entry._sum.unit_count ?? 0,
    })),
  };
};
