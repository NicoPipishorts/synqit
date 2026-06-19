import {
  dashboardSummaryResponseSchema,
  dashboardTopFollowersResponseSchema,
} from '@synqit/shared';
import type { FastifyInstance } from 'fastify';

import { requireAuthenticatedUserId } from '../auth/guards';
import { eventsStore } from '../events/store';
import { syncsStore } from '../syncs/store';

const DAY_MS = 24 * 60 * 60 * 1000;
const TOP_FOLLOWERS_LIMIT = 10;

export const registerDashboardRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get('/dashboard/summary', async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply);
    if (!userId) return;

    const now = new Date();
    const since24h = new Date(now.getTime() - DAY_MS);
    const since7d = new Date(now.getTime() - 7 * DAY_MS);

    const [events, trackedEvents, visitedEvents, ownedSyncs, subscribedSyncs] = await Promise.all([
      eventsStore.listEventsByHost(userId),
      eventsStore.listTrackedEventsByUser(userId),
      eventsStore.listVisitedEventsByUser(userId),
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
        trackedEventActivity: trackedEvents
          .map(({ event, trackedAt }) => ({
            eventId: event.id,
            magicLinkToken: event.magicLinkToken,
            name: event.name,
            addedTrackCount24h: event.tracks.filter((track) => track.addedAt >= since24h).length,
            latestActivityAt:
              event.tracks.find((track) => track.addedAt >= since24h)?.addedAt.toISOString() ??
              null,
            updatedAt: Math.max(event.updatedAt.getTime(), trackedAt.getTime()),
          }))
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map(({ updatedAt: _updatedAt, ...item }) => item),
        visitedEventActivity: visitedEvents
          .filter(({ event }) => event.hostUserId !== userId)
          .filter(
            ({ event }) =>
              !trackedEvents.some((trackedEvent) => trackedEvent.event.id === event.id),
          )
          .map(({ event, visitedAt }) => ({
            eventId: event.id,
            magicLinkToken: event.magicLinkToken,
            name: event.name,
            addedTrackCount24h: event.tracks.filter((track) => track.addedAt >= since24h).length,
            latestActivityAt:
              event.tracks.find((track) => track.addedAt >= since24h)?.addedAt.toISOString() ??
              null,
            updatedAt: Math.max(event.updatedAt.getTime(), visitedAt.getTime()),
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

  app.get('/dashboard/top-followers', async (request, reply) => {
    const userId = await requireAuthenticatedUserId(request, reply);
    if (!userId) return;

    const ownedSyncs = await syncsStore.listSyncsBySender(userId);
    const { followers, totalCount } = await syncsStore.listTopSubscribersBySyncIds({
      syncIds: ownedSyncs.map((sync) => sync.id),
      limit: TOP_FOLLOWERS_LIMIT,
    });

    return reply.send(
      dashboardTopFollowersResponseSchema.parse({
        followers: followers.map((follower) => ({
          userId: follower.userId,
          name: follower.name,
          avatarUrl: follower.avatarUrl,
          subscriptionCount: follower.subscriptionCount,
          latestSubscribedAt: follower.latestSubscribedAt.toISOString(),
        })),
        totalCount,
      }),
    );
  });
};
