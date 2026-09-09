import {
  providerSchema,
  transferBatchStatusSchema,
  transferItemStatusSchema,
  transferTrackStatusSchema,
  type Provider,
  type TransferBatchStatus,
  type TransferDetails,
  type TransferItemStatus,
  type TransferPlaylistSelection,
  type TransferTrackStatus,
} from '@synqit/shared';
import { randomUUID } from 'node:crypto';

import { prisma } from '../db/prisma';

export type TransferItemRecord = {
  id: string;
  batchId: string;
  providerPlaylistId: string;
  name: string;
  trackCount: number | null;
  position: number;
  status: TransferItemStatus;
  syncId: string | null;
  matchedCount: number | null;
  skippedCount: number | null;
  errorMessage: string | null;
};

export type TransferTrackInput = {
  position: number;
  sourceProviderTrackId: string;
  name: string;
  artist: string;
  album: string;
  artworkUrl: string | null;
  durationMs: number | null;
  status: TransferTrackStatus;
  destinationProviderTrackId: string | null;
};

export type TransferBatchRecord = {
  id: string;
  userId: string;
  sourceProvider: Provider;
  destinationProvider: Provider;
  status: TransferBatchStatus;
  createdAt: Date;
  completedAt: Date | null;
  items: TransferItemRecord[];
};

type TransferItemRow = {
  id: string;
  batch_id: string;
  provider_playlist_id: string;
  name: string;
  track_count: number | null;
  position: number;
  status: string;
  sync_id: string | null;
  matched_count: number | null;
  skipped_count: number | null;
  error_message: string | null;
};

type TransferBatchRow = {
  id: string;
  user_id: string;
  source_provider: string;
  destination_provider: string;
  status: string;
  created_at: Date;
  completed_at: Date | null;
  transfer_items: TransferItemRow[];
};

const mapItemRow = (row: TransferItemRow): TransferItemRecord => ({
  id: row.id,
  batchId: row.batch_id,
  providerPlaylistId: row.provider_playlist_id,
  name: row.name,
  trackCount: row.track_count,
  position: row.position,
  status: transferItemStatusSchema.parse(row.status),
  syncId: row.sync_id,
  matchedCount: row.matched_count,
  skippedCount: row.skipped_count,
  errorMessage: row.error_message,
});

const mapBatchRow = (row: TransferBatchRow): TransferBatchRecord => ({
  id: row.id,
  userId: row.user_id,
  sourceProvider: providerSchema.parse(row.source_provider),
  destinationProvider: providerSchema.parse(row.destination_provider),
  status: transferBatchStatusSchema.parse(row.status),
  createdAt: row.created_at,
  completedAt: row.completed_at,
  items: [...row.transfer_items].sort((a, b) => a.position - b.position).map(mapItemRow),
});

export const transfersStore = {
  async createBatch(params: {
    userId: string;
    sourceProvider: Provider;
    destinationProvider: Provider;
    playlists: readonly TransferPlaylistSelection[];
  }): Promise<TransferBatchRecord> {
    const now = new Date();
    const batchId = randomUUID();

    const row = await prisma.transfer_batches.create({
      data: {
        id: batchId,
        user_id: params.userId,
        source_provider: params.sourceProvider,
        destination_provider: params.destinationProvider,
        status: 'queued',
        created_at: now,
        updated_at: now,
        transfer_items: {
          create: params.playlists.map((playlist, index) => ({
            id: randomUUID(),
            provider_playlist_id: playlist.providerPlaylistId,
            name: playlist.name,
            track_count: playlist.trackCount,
            position: index,
            status: 'queued',
            created_at: now,
            updated_at: now,
          })),
        },
      },
      include: { transfer_items: true },
    });

    return mapBatchRow(row as unknown as TransferBatchRow);
  },

  async findBatch(params: {
    batchId: string;
    userId: string;
  }): Promise<TransferBatchRecord | null> {
    const row = await prisma.transfer_batches.findFirst({
      where: { id: params.batchId, user_id: params.userId },
      include: { transfer_items: true },
    });
    return row ? mapBatchRow(row as unknown as TransferBatchRow) : null;
  },

  async findItem(
    itemId: string,
  ): Promise<(TransferItemRecord & { batch: TransferBatchRecord }) | null> {
    const row = await prisma.transfer_items.findUnique({
      where: { id: itemId },
      include: { transfer_batches: { include: { transfer_items: true } } },
    });
    if (!row) {
      return null;
    }
    const typed = row as unknown as TransferItemRow & { transfer_batches: TransferBatchRow | null };
    if (!typed.transfer_batches) {
      // The batch went while the job sat in the queue. Treat it as gone rather
      // than reading an id off nothing.
      return null;
    }
    return { ...mapItemRow(typed), batch: mapBatchRow(typed.transfer_batches) };
  },

  async updateItem(params: {
    itemId: string;
    status: TransferItemStatus;
    syncId?: string | null;
    matchedCount?: number | null;
    skippedCount?: number | null;
    errorMessage?: string | null;
  }): Promise<void> {
    await prisma.transfer_items.updateMany({
      where: { id: params.itemId },
      data: {
        status: params.status,
        ...(params.syncId !== undefined ? { sync_id: params.syncId } : {}),
        ...(params.matchedCount !== undefined ? { matched_count: params.matchedCount } : {}),
        ...(params.skippedCount !== undefined ? { skipped_count: params.skippedCount } : {}),
        ...(params.errorMessage !== undefined ? { error_message: params.errorMessage } : {}),
        updated_at: new Date(),
      },
    });
  },

  async markBatchRunning(batchId: string): Promise<void> {
    await prisma.transfer_batches.updateMany({
      where: { id: batchId, status: 'queued' },
      data: { status: 'running', updated_at: new Date() },
    });
  },

  /**
   * Recomputes the batch status from its items. Called after every item
   * finishes, so the last one to complete is the one that closes the batch —
   * no separate coordinator job, and it stays correct if items run in any
   * order or get retried.
   */
  async refreshBatchStatus(batchId: string): Promise<TransferBatchStatus> {
    const items = await prisma.transfer_items.findMany({
      where: { batch_id: batchId },
      select: { status: true },
    });

    const statuses = items.map((item) => item.status);
    if (statuses.length === 0) {
      // Nothing left to summarise: the batch and its items are gone.
      return 'completed';
    }
    const settled = statuses.every((status) => status === 'completed' || status === 'failed');

    let status: TransferBatchStatus;
    if (!settled) {
      status = statuses.some((entry) => entry !== 'queued') ? 'running' : 'queued';
    } else if (statuses.every((entry) => entry === 'failed')) {
      status = 'failed';
    } else if (statuses.some((entry) => entry === 'failed')) {
      status = 'partial';
    } else {
      status = 'completed';
    }

    // updateMany, not update: a deleted batch is a no-op, not a crash that
    // fails the worker on every retry of a job nobody is waiting for.
    await prisma.transfer_batches.updateMany({
      where: { id: batchId },
      data: {
        status,
        completed_at: settled ? new Date() : null,
        updated_at: new Date(),
      },
    });

    return status;
  },

  /**
   * Replaces an item's per-track results. A retry re-runs the whole playlist,
   * so the last run is the truth rather than something to merge into.
   */
  async replaceItemTracks(params: {
    itemId: string;
    tracks: readonly TransferTrackInput[];
  }): Promise<void> {
    const now = new Date();
    await prisma.$transaction([
      prisma.transfer_item_tracks.deleteMany({ where: { transfer_item_id: params.itemId } }),
      prisma.transfer_item_tracks.createMany({
        data: params.tracks.map((track) => ({
          id: randomUUID(),
          transfer_item_id: params.itemId,
          position: track.position,
          source_provider_track_id: track.sourceProviderTrackId,
          name: track.name,
          artist: track.artist,
          album: track.album,
          artwork_url: track.artworkUrl,
          duration_ms: track.durationMs,
          status: track.status,
          destination_provider_track_id: track.destinationProviderTrackId,
          created_at: now,
        })),
      }),
    ]);
  },

  /**
   * One transferred playlist, by the sync it produced, with the per-track
   * outcome. `tracks` is empty for transfers made before those were recorded.
   */
  async findDetailsBySyncId(params: {
    syncId: string;
    userId: string;
  }): Promise<TransferDetails | null> {
    const row = await prisma.transfer_items.findFirst({
      where: { sync_id: params.syncId, transfer_batches: { user_id: params.userId } },
      orderBy: { updated_at: 'desc' },
      include: {
        transfer_batches: true,
        transfer_item_tracks: { orderBy: { position: 'asc' } },
      },
    });
    if (!row) {
      return null;
    }

    return {
      syncId: params.syncId,
      name: row.name,
      sourceProvider: providerSchema.parse(row.transfer_batches.source_provider),
      destinationProvider: providerSchema.parse(row.transfer_batches.destination_provider),
      status: transferItemStatusSchema.parse(row.status),
      trackCount: row.track_count,
      matchedCount: row.matched_count,
      skippedCount: row.skipped_count,
      errorMessage: row.error_message,
      transferredAt: (row.transfer_batches.completed_at ?? row.updated_at).toISOString(),
      tracks: row.transfer_item_tracks.map((track) => ({
        position: track.position,
        name: track.name,
        artist: track.artist,
        album: track.album,
        artworkUrl: track.artwork_url,
        durationMs: track.duration_ms,
        status: transferTrackStatusSchema.parse(track.status),
      })),
    };
  },

  /** Lifetime playlists this user has transferred. The metering counter. */
  async countTransferredPlaylists(userId: string): Promise<number> {
    return prisma.transfer_items.count({
      where: { status: 'completed', transfer_batches: { user_id: userId } },
    });
  },
};
