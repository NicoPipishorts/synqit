import { QUEUES } from '@synqit/shared';
import { Queue, type JobsOptions } from 'bullmq';

const DEFAULT_REDIS_URL = 'redis://localhost:6380';
const DEFAULT_WEB_APP_URL = 'http://127.0.0.1:5173';

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

const createConnection = () =>
  ({
    ...readRedisConnectionConfig(),
    enableOfflineQueue: false,
    connectTimeout: 1200,
    maxRetriesPerRequest: 1,
  }) as const;

/** Retry/backoff defaults for transactional notification jobs. */
export const NOTIFICATION_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2_000 },
  removeOnComplete: true,
  removeOnFail: false,
};

/** Preview jobs are kept around (removeOnComplete: false) so they can be inspected. */
export const NOTIFICATION_PREVIEW_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1_000 },
  removeOnComplete: false,
  removeOnFail: false,
};

export const resolveWebAppUrl = (): string => process.env.WEB_APP_URL ?? DEFAULT_WEB_APP_URL;

/**
 * Adds a job to the shared notifications queue, opening and closing a
 * short-lived connection per enqueue. Centralizes Redis connection handling so
 * individual email producers stay thin.
 */
export const enqueueNotificationJob = async (
  jobName: string,
  payload: unknown,
  options: JobsOptions,
): Promise<string | undefined> => {
  const queue = new Queue(QUEUES.notifications, { connection: createConnection() });
  try {
    const job = await queue.add(jobName, payload, options);
    return job.id;
  } finally {
    await queue.close();
  }
};
