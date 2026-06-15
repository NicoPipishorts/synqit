import {
  weeklyRecapEmailJobSchema,
  type WeeklyRecapEmailJob,
  type WeeklyRecapPlaylist,
} from '@synqit/shared';

import { resolveWebAppUrl } from './notifications-queue';
import { authStore } from '../auth/store';
import { eventsStore } from '../events/store';
import { syncsStore } from '../syncs/store';

const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_WINDOW_DAYS = 7;

const resolveLinkBaseUrl = (): string => process.env.EVENT_LINK_BASE_URL ?? resolveWebAppUrl();

const buildSyncLink = (magicLinkToken: string): string =>
  new URL(`/sync/${magicLinkToken}`, resolveLinkBaseUrl()).toString();

const buildEventLink = (magicLinkToken: string): string =>
  new URL(`/playlist/${magicLinkToken}`, resolveLinkBaseUrl()).toString();

const countEventTracksSince = (tracks: { addedAt: Date }[], since: Date): number =>
  tracks.filter((track) => track.addedAt >= since).length;

/**
 * Builds one fully-formed recap payload per user that has at least one new song
 * across the playlists they own, subscribe to, host, or follow. Users with no
 * new activity in the window are omitted (empty recaps are skipped). Kept pure
 * (no enqueue / no scheduling) so it can be unit-tested directly.
 */
export const buildWeeklyRecapDigests = async (params?: {
  now?: Date;
  windowDays?: number;
}): Promise<WeeklyRecapEmailJob[]> => {
  const now = params?.now ?? new Date();
  const windowDays = params?.windowDays ?? DEFAULT_WINDOW_DAYS;
  const since = new Date(now.getTime() - windowDays * DAY_MS);
  const webAppUrl = resolveWebAppUrl();

  const [senderIds, recipientIds, hostIds, followerIds] = await Promise.all([
    syncsStore.listDistinctSenderUserIds(),
    syncsStore.listDistinctRecipientUserIds(),
    eventsStore.listDistinctHostUserIds(),
    eventsStore.listDistinctFollowerUserIds(),
  ]);

  const candidateIds = Array.from(
    new Set([...senderIds, ...recipientIds, ...hostIds, ...followerIds]),
  );
  if (candidateIds.length === 0) {
    return [];
  }

  const recipients = await authStore.listEmailRecipientsByIds(candidateIds);
  const digests: WeeklyRecapEmailJob[] = [];

  for (const recipient of recipients) {
    const playlists = await buildPlaylistEntriesForUser({ userId: recipient.userId, since });
    if (playlists.length === 0) {
      continue;
    }

    const totalNewTracks = playlists.reduce((sum, item) => sum + item.newTrackCount, 0);

    digests.push(
      weeklyRecapEmailJobSchema.parse({
        userId: recipient.userId,
        toEmail: recipient.email,
        locale: recipient.locale,
        webAppUrl,
        windowDays,
        totalNewTracks,
        playlists,
      }),
    );
  }

  return digests;
};

const buildPlaylistEntriesForUser = async (params: {
  userId: string;
  since: Date;
}): Promise<WeeklyRecapPlaylist[]> => {
  const { userId, since } = params;

  const [ownedSyncs, subscribedSyncs, hostedEvents, trackedEvents] = await Promise.all([
    syncsStore.listSyncsBySender(userId),
    syncsStore.listSyncsByRecipient(userId),
    eventsStore.listEventsByHost(userId),
    eventsStore.listTrackedEventsByUser(userId),
  ]);

  const syncTrackCounts = await syncsStore.countRecentTrackActivityBySyncIds({
    syncIds: Array.from(
      new Set([...ownedSyncs.map((s) => s.id), ...subscribedSyncs.map((s) => s.id)]),
    ),
    since,
  });

  const playlists: WeeklyRecapPlaylist[] = [];

  for (const sync of ownedSyncs) {
    const newTrackCount = syncTrackCounts.get(sync.id) ?? 0;
    if (newTrackCount > 0) {
      playlists.push({
        kind: 'owned_sync',
        name: sync.name,
        url: buildSyncLink(sync.magicLinkToken),
        newTrackCount,
      });
    }
  }

  for (const sync of subscribedSyncs) {
    const newTrackCount = syncTrackCounts.get(sync.id) ?? 0;
    if (newTrackCount > 0) {
      playlists.push({
        kind: 'subscribed_sync',
        name: sync.name,
        url: buildSyncLink(sync.magicLinkToken),
        newTrackCount,
      });
    }
  }

  for (const event of hostedEvents) {
    const newTrackCount = countEventTracksSince(event.tracks, since);
    if (newTrackCount > 0) {
      playlists.push({
        kind: 'hosted_event',
        name: event.name,
        url: buildEventLink(event.magicLinkToken),
        newTrackCount,
      });
    }
  }

  for (const { event } of trackedEvents) {
    // Skip events the user also hosts; those are already covered above.
    if (event.hostUserId === userId) {
      continue;
    }
    const newTrackCount = countEventTracksSince(event.tracks, since);
    if (newTrackCount > 0) {
      playlists.push({
        kind: 'followed_event',
        name: event.name,
        url: buildEventLink(event.magicLinkToken),
        newTrackCount,
      });
    }
  }

  return playlists;
};
