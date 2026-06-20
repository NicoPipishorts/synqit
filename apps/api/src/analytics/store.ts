import { type AnalyticsEventName, type AnalyticsTarget } from '@synqit/shared';
import { randomUUID } from 'node:crypto';

import { prisma } from '../db/prisma';
import { type Prisma } from '../generated/prisma/client';

const toJsonValue = (value: Record<string, unknown>): Prisma.InputJsonValue => {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
};

export const analyticsStore = {
  async recordEvent(params: {
    userId: string | null;
    sessionId: string;
    eventName: AnalyticsEventName;
    target: AnalyticsTarget;
    path: string;
    locale: 'en' | 'fr' | null;
    source: 'web' | 'site';
    referrer: string | null;
    properties: Record<string, unknown>;
  }): Promise<void> {
    await prisma.analyticsEvents.create({
      data: {
        id: randomUUID(),
        user_id: params.userId,
        session_id: params.sessionId,
        event_name: params.eventName,
        target: params.target,
        page_path: params.path,
        locale: params.locale,
        source: params.source,
        referrer: params.referrer,
        properties: toJsonValue(params.properties),
        created_at: new Date(),
      },
    });
  },
};
