import { JOBS, QUEUES } from '@synqit/shared';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';


const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

const syncQueue = new Queue(QUEUES.sync, { connection });

const worker = new Worker(
  QUEUES.sync,
  async (job) => {
    switch (job.name) {
      case JOBS.pullPlaylists:
        return {
          ok: true,
          message: 'Pull playlists job placeholder completed',
          input: job.data,
        };
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  },
  { connection },
);

worker.on('completed', (job) => {
  console.log(`[worker] completed job=${job.id} name=${job.name}`);
});

worker.on('failed', (job, error) => {
  console.error(`[worker] failed job=${job?.id ?? 'n/a'} name=${job?.name ?? 'n/a'}`, error);
});

const bootstrap = async () => {
  console.log('[worker] booted and waiting for jobs');

  await syncQueue.add(
    JOBS.pullPlaylists,
    {
      userId: 'seed-user',
      provider: 'spotify',
    },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    },
  );
};

const shutdown = async () => {
  await worker.close();
  await syncQueue.close();
  await connection.quit();
};

process.on('SIGINT', () => {
  void shutdown().finally(() => process.exit(0));
});

process.on('SIGTERM', () => {
  void shutdown().finally(() => process.exit(0));
});

void bootstrap();
