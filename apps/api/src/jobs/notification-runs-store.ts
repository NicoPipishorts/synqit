import { randomUUID } from 'node:crypto';

import { prisma } from '../db/prisma';

const isUniqueConstraintError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';

export const notificationRunsStore = {
  /**
   * Atomically claims a notification period. The unique (kind, period_key) row is
   * the lock: the first caller inserts and wins; concurrent callers / restarts hit
   * the unique constraint and get `false`, guaranteeing at most one run per period.
   */
  async claimPeriod(params: { kind: string; periodKey: string }): Promise<boolean> {
    const now = new Date();
    try {
      await prisma.notification_runs.create({
        data: {
          id: randomUUID(),
          kind: params.kind,
          period_key: params.periodKey,
          claimed_at: now,
          created_at: now,
        },
      });
      return true;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return false;
      }
      throw error;
    }
  },
};
