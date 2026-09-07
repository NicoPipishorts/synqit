import { JOBS, QUEUES, type TransferPlaylistJob } from '@synqit/shared';
import { Queue, type ConnectionOptions, type JobsOptions } from 'bullmq';

const DEFAULT_REDIS_URL = 'redis://localhost:6380';

const readRedisConnectionConfig = () => {
  const redisUrl = new URL(process.env.REDIS_URL ?? DEFAULT_REDIS_URL);
  const db = Number.parseInt(redisUrl.pathname.replace('/', ''), 10);
  const useTls = redisUrl.protocol === 'rediss:';

  return {
    host: redisUrl.hostname,
    port: redisUrl.port ? Number.parseInt(redisUrl.port, 10) : useTls ? 6380 : 6379,
    username: redisUrl.username ? decodeURIComponent(redisUrl.username) : undefined,
    password: redisUrl.password ? decodeURIComponent(redisUrl.password) : undefined,
    db: Number.isFinite(db) ? db : 0,
    tls: useTls ? {} : undefined,
  };
};

/**
 * Workers must not use `maxRetriesPerRequest`, and they block on Redis, so
 * they need the offline queue that the fire-and-forget producer disables.
 */
export const createTransfersConnection = (params?: { forWorker?: boolean }): ConnectionOptions =>
  ({
    ...readRedisConnectionConfig(),
    ...(params?.forWorker
      ? { maxRetriesPerRequest: null }
      : {
          enableOfflineQueue: false,
          connectTimeout: 1200,
          maxRetriesPerRequest: 1,
          // Give up rather than reconnect forever. Without this, enqueueing
          // against an unreachable Redis hangs the caller instead of failing,
          // and the route can never return its 503.
          retryStrategy: (attempt: number) => (attempt > 2 ? null : 200),
        }),
  }) as ConnectionOptions;

/**
 * A transfer touches the user's real library, so retries are conservative and
 * failures are kept for inspection rather than dropped. The job itself is
 * resumable, so an attempt that died mid-playlist tops it up instead of
 * duplicating it.
 */
export const TRANSFER_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: true,
  removeOnFail: false,
};

let cachedQueue: { redisUrl: string; queue: Queue } | null = null;

const getTransfersQueue = (): Queue => {
  const redisUrl = process.env.REDIS_URL ?? DEFAULT_REDIS_URL;
  if (cachedQueue && cachedQueue.redisUrl === redisUrl) {
    return cachedQueue.queue;
  }

  const stale = cachedQueue;
  cachedQueue = null;
  if (stale) {
    void stale.queue.close().catch(() => undefined);
  }

  const queue = new Queue(QUEUES.transfers, { connection: createTransfersConnection() });
  // Same reasoning as the worker: an unhandled 'error' event would become an
  // uncaught exception. Enqueue failures are surfaced to the caller instead.
  queue.on('error', () => undefined);
  cachedQueue = { redisUrl, queue };
  return queue;
};

/** Queues one playlist of a batch. One job per playlist keeps retries granular. */
export const enqueueTransferPlaylistJob = async (
  payload: TransferPlaylistJob,
): Promise<string | undefined> => {
  const job = await getTransfersQueue().add(JOBS.transferPlaylist, payload, {
    ...TRANSFER_JOB_OPTIONS,
    // The item id is the dedupe key: re-posting the same item is a no-op
    // rather than a second playlist in the user's library.
    jobId: payload.itemId,
  });
  return job.id;
};

/** Closes the shared queue connection; call during graceful shutdown. */
export const closeTransfersQueue = async (): Promise<void> => {
  const current = cachedQueue;
  cachedQueue = null;
  if (current) {
    await current.queue.close();
  }
};
