import { JOBS, QUEUES, transferPlaylistJobSchema } from '@synqit/shared';
import { Worker } from 'bullmq';
import type { FastifyBaseLogger } from 'fastify';

import { importSyncForRecipient } from './import-engine';
import { syncsStore } from './store';
import { transfersStore } from './transfer-store';
import { mapProviderApiError } from '../integrations/provider-errors';
import { withUsageDomain } from '../integrations/provider-usage';
import { ProviderApiError } from '../integrations/spotify-tracks';
import { createTransfersConnection } from '../jobs/transfers-queue';

/**
 * One playlist at a time per process. Transfers are provider-API bound, and
 * the engine already runs its own search pool inside a single playlist —
 * stacking batches on top of that is how you get rate-limited.
 */
const TRANSFER_WORKER_CONCURRENCY = 1;

/** The slice of a BullMQ job the processor actually reads. */
type TransferJobLike = {
  data: unknown;
  attemptsMade: number;
  opts: { attempts?: number };
};

const describeError = (error: unknown): string => {
  if (error instanceof ProviderApiError) {
    return mapProviderApiError(error).message;
  }
  return error instanceof Error ? error.message : 'Transfer failed.';
};

/** Exported for the regression suite, which drives it without a live queue. */
export const processTransferPlaylistJob = async (job: TransferJobLike): Promise<void> =>
  withUsageDomain('transfer', () => runTransferPlaylistJob(job));

const runTransferPlaylistJob = async (job: TransferJobLike): Promise<void> => {
  const payload = transferPlaylistJobSchema.parse(job.data);
  const item = await transfersStore.findItem(payload.itemId);
  if (!item) {
    // The batch was deleted (or the user was) while the job sat in the queue.
    return;
  }
  if (item.status === 'completed') {
    return;
  }

  const { batch } = item;
  await transfersStore.markBatchRunning(batch.id);
  await transfersStore.updateItem({ itemId: item.id, status: 'running' });

  try {
    // Reuse the sync from a previous attempt so a retry does not create a
    // second playlist or a second entry in the user's transfer history.
    const sync =
      (item.syncId ? await syncsStore.findSyncById(item.syncId) : null) ??
      (await syncsStore.createSync({
        senderUserId: batch.userId,
        provider: batch.sourceProvider,
        providerPlaylistId: item.providerPlaylistId,
        name: item.name,
        trackCount: item.trackCount,
        syncMode: 'host_only',
        kind: 'transfer',
      }));

    if (item.syncId !== sync.id) {
      await transfersStore.updateItem({ itemId: item.id, status: 'running', syncId: sync.id });
    }

    const { matchedCount, skippedCount, tracks } = await importSyncForRecipient({
      sync,
      recipientUserId: batch.userId,
      recipientProvider: batch.destinationProvider,
    });

    // Keep what became of each song: the counts alone cannot say which ones
    // the destination had no match for, and re-reading both playlists later
    // would only guess.
    await transfersStore.replaceItemTracks({ itemId: item.id, tracks });

    await transfersStore.updateItem({
      itemId: item.id,
      status: 'completed',
      syncId: sync.id,
      matchedCount,
      skippedCount,
      errorMessage: null,
    });
  } catch (error) {
    const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    await transfersStore.updateItem({
      itemId: item.id,
      // Only give up once BullMQ is out of attempts; until then the item goes
      // back to queued so the UI shows it as still in flight.
      status: isFinalAttempt ? 'failed' : 'queued',
      errorMessage: describeError(error),
    });
    await transfersStore.refreshBatchStatus(batch.id);
    throw error;
  }

  await transfersStore.refreshBatchStatus(batch.id);
};

/**
 * Runs transfer jobs inside the API process, which is where Prisma, the
 * provider clients and token decryption already live. The standalone worker
 * has none of those, which is why this queue is separate from `sync`.
 */
export const startTransferWorker = (logger: FastifyBaseLogger): (() => Promise<void>) => {
  const worker = new Worker(
    QUEUES.transfers,
    async (job) => {
      if (job.name !== JOBS.transferPlaylist) {
        throw new Error(`Unknown transfer job name: ${job.name}`);
      }
      await processTransferPlaylistJob(job);
    },
    {
      connection: createTransfersConnection({ forWorker: true }),
      concurrency: TRANSFER_WORKER_CONCURRENCY,
    },
  );

  // A Worker holds a blocking Redis connection and emits 'error' when that
  // connection has trouble. Without a listener, Node turns an EventEmitter
  // 'error' into an uncaught exception — which would take the whole API down
  // over a transient Redis blip, not just transfers. Log and carry on; BullMQ
  // reconnects on its own.
  worker.on('error', (error) => {
    logger.error({ err: error }, 'transfer worker connection error');
  });

  worker.on('failed', (job, error) => {
    logger.error(
      {
        jobId: job?.id,
        itemId: (job?.data as { itemId?: string } | undefined)?.itemId,
        err: error,
      },
      'transfer job failed',
    );
  });

  return async () => {
    await worker.close();
  };
};
