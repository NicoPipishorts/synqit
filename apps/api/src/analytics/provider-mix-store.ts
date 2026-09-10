import { prisma } from '../db/prisma';

/**
 * Which services people actually use, and in which direction.
 *
 * None of this needs instrumenting: a transfer already records the lane it ran,
 * an event the service it was hosted on, and a subscription both the service
 * the list lives on and the one its follower took it into. The questions worth
 * asking are which lane runs most, which service hosts most parties, and who
 * subscribes across a service boundary — so the rows are ordered by volume and
 * the cross-service ones are marked rather than left to be spotted by eye.
 */

export type TransferLaneRow = {
  sourceProvider: string;
  destinationProvider: string;
  playlistCount: number;
  matchedCount: number;
  skippedCount: number;
};

export type EventProviderRow = {
  provider: string;
  eventCount: number;
  trackCount: number;
};

export type SubscriptionLaneRow = {
  sourceProvider: string;
  recipientProvider: string;
  subscriptionCount: number;
};

const asNumber = (value: unknown): number => Number(value ?? 0);

export const readProviderMix = async (params: {
  since: Date;
}): Promise<{
  transferLanes: TransferLaneRow[];
  eventProviders: EventProviderRow[];
  subscriptionLanes: SubscriptionLaneRow[];
}> => {
  const [lanes, events, subscriptions] = await Promise.all([
    prisma.$queryRaw<
      {
        source_provider: string;
        destination_provider: string;
        playlists: bigint;
        matched: bigint | null;
        skipped: bigint | null;
      }[]
    >`
      SELECT b.source_provider,
             b.destination_provider,
             COUNT(i.id) AS playlists,
             SUM(COALESCE(i.matched_count, 0)) AS matched,
             SUM(COALESCE(i.skipped_count, 0)) AS skipped
      FROM transfer_items i
      JOIN transfer_batches b ON b.id = i.batch_id
      WHERE b.created_at >= ${params.since}
      GROUP BY b.source_provider, b.destination_provider
      ORDER BY playlists DESC
    `,
    prisma.$queryRaw<{ provider: string; events: bigint; tracks: bigint }[]>`
      SELECT p.provider,
             COUNT(DISTINCT p.id) AS events,
             COUNT(t.id) AS tracks
      FROM playlists p
      LEFT JOIN playlist_tracks t ON t.event_id = p.id
      WHERE p.created_at >= ${params.since}
      GROUP BY p.provider
      ORDER BY events DESC
    `,
    prisma.$queryRaw<
      { source_provider: string; recipient_provider: string; subscriptions: bigint }[]
    >`
      SELECT s.provider AS source_provider,
             i.recipient_provider,
             COUNT(i.id) AS subscriptions
      FROM playlist_sync_imports i
      JOIN playlist_syncs s ON s.id = i.sync_id
      WHERE i.created_at >= ${params.since}
      GROUP BY s.provider, i.recipient_provider
      ORDER BY subscriptions DESC
    `,
  ]);

  return {
    transferLanes: lanes.map((row) => ({
      sourceProvider: row.source_provider,
      destinationProvider: row.destination_provider,
      playlistCount: asNumber(row.playlists),
      matchedCount: asNumber(row.matched),
      skippedCount: asNumber(row.skipped),
    })),
    eventProviders: events.map((row) => ({
      provider: row.provider,
      eventCount: asNumber(row.events),
      trackCount: asNumber(row.tracks),
    })),
    subscriptionLanes: subscriptions.map((row) => ({
      sourceProvider: row.source_provider,
      recipientProvider: row.recipient_provider,
      subscriptionCount: asNumber(row.subscriptions),
    })),
  };
};
