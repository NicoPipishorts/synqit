import { dashboardSummaryResponseSchema } from '@synqit/shared';
import type { FastifyInstance } from 'fastify';

import { requireAuthenticatedUserId } from '../auth/guards';
import { eventsStore } from '../events/store';
import { syncsStore } from '../syncs/store';

const DAY_MS = 24 * 60 * 60 * 1000;

export const registerDashboardRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get('/dashboard/summary', async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply);
    if (!userId) return;

    const now = new Date();
    const since24h = new Date(now.getTime() - DAY_MS);
    const since7d = new Date(now.getTime() - 7 * DAY_MS);

    const [events, ownedSyncs, subscribedSyncs] = await Promise.all([
      eventsStore.listEventsByHost(userId),
      syncsStore.listSyncsBySender(userId),
      syncsStore.listSyncsByRecipient(userId),
    ]);

    const [
      ownedSyncSubscriberCounts,
      recentOwnedSyncImports,
      recentOwnedSyncSubscribers,
      recentSubscribedTrackActivity,
    ] = await Promise.all([
      syncsStore.countImportsBySyncIds(ownedSyncs.map((sync) => sync.id)),
      syncsStore.countRecentImportsBySyncIds({
        syncIds: ownedSyncs.map((sync) => sync.id),
        since: since24h,
      }),
      syncsStore.listRecentSubscribersBySyncIds({
        syncIds: ownedSyncs.map((sync) => sync.id),
        since: since24h,
      }),
      syncsStore.countRecentTrackActivityBySyncIds({
        syncIds: subscribedSyncs.map((sync) => sync.id),
        since: since7d,
      }),
    ]);

    return reply.send(
      dashboardSummaryResponseSchema.parse({
        ownerEventActivity: events
          .map((event) => ({
            eventId: event.id,
            name: event.name,
            addedTrackCount24h: event.tracks.filter((track) => track.addedAt >= since24h).length,
            latestActivityAt:
              event.tracks.find((track) => track.addedAt >= since24h)?.addedAt.toISOString() ??
              null,
            updatedAt: event.updatedAt.getTime(),
          }))
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map(({ updatedAt: _updatedAt, ...item }) => item),
        ownerSyncActivity: ownedSyncs
          .map((sync) => ({
            syncId: sync.id,
            name: sync.name,
            totalSubscriberCount: ownedSyncSubscriberCounts.get(sync.id) ?? 0,
            newSubscriberCount24h: recentOwnedSyncImports.get(sync.id) ?? 0,
            recentSubscribers: (recentOwnedSyncSubscribers.get(sync.id) ?? []).map(
              (subscriber) => ({
                userId: subscriber.recipientUserId,
                name: subscriber.name,
                subscribedAt: subscriber.subscribedAt.toISOString(),
              }),
            ),
            latestActivityAt:
              (recentOwnedSyncSubscribers.get(sync.id) ?? [])[0]?.subscribedAt.toISOString() ??
              null,
            updatedAt: sync.updatedAt.getTime(),
          }))
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map(({ updatedAt: _updatedAt, ...item }) => item),
        subscriberSyncActivity: subscribedSyncs
          .map((sync) => {
            const addedTrackCount7d = recentSubscribedTrackActivity.get(sync.id) ?? 0;
            const latestActivityAt =
              sync.lastSyncedAt && sync.lastSyncedAt >= since7d
                ? sync.lastSyncedAt.toISOString()
                : null;
            return {
              syncId: sync.id,
              name: sync.name,
              addedTrackCount7d,
              ownerAddedTracks7d: addedTrackCount7d > 0,
              latestActivityAt,
              updatedAt: sync.updatedAt.getTime(),
            };
          })
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map(({ updatedAt: _updatedAt, ...item }) => item),
      }),
    );
  });
};
