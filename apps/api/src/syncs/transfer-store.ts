import {
  providerSchema,
  transferBatchStatusSchema,
  transferItemStatusSchema,
  type Provider,
  type TransferBatchStatus,
  type TransferItemStatus,
  type TransferPlaylistSelection,
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
    const typed = row as unknown as TransferItemRow & { transfer_batches: TransferBatchRow };
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
    await prisma.transfer_items.update({
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

    await prisma.transfer_batches.update({
      where: { id: batchId },
      data: {
        status,
        completed_at: settled ? new Date() : null,
        updated_at: new Date(),
      },
    });

    return status;
  },

  /** Lifetime playlists this user has transferred. The metering counter. */
  async countTransferredPlaylists(userId: string): Promise<number> {
    return prisma.transfer_items.count({
      where: { status: 'completed', transfer_batches: { user_id: userId } },
    });
  },
};
