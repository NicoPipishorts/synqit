import { JOBS, QUEUES, passwordResetEmailJobSchema, type EmailLocale } from '@synqit/shared';
import { Queue } from 'bullmq';

const DEFAULT_REDIS_URL = 'redis://localhost:6380';
const DEFAULT_WEB_APP_URL = 'http://127.0.0.1:5173';

const parseBoolean = (raw: string | undefined, fallback: boolean): boolean => {
  if (!raw) {
    return fallback;
  }

  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
};

export const isPasswordResetEmailEnabled = (): boolean =>
  parseBoolean(process.env.AUTH_PASSWORD_RESET_EMAIL_ENABLED, true);

const createRedisConnection = () =>
  ({
    ...readRedisConnectionConfig(),
    enableOfflineQueue: false,
    connectTimeout: 1200,
    maxRetriesPerRequest: 1,
  }) as const;

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

export const enqueuePasswordResetEmail = async (params: {
  userId: string;
  toEmail: string;
  locale: EmailLocale;
  resetToken: string;
}) => {
  const payload = passwordResetEmailJobSchema.parse({
    userId: params.userId,
    toEmail: params.toEmail,
    locale: params.locale,
    resetToken: params.resetToken,
    webAppUrl: process.env.WEB_APP_URL ?? DEFAULT_WEB_APP_URL,
  });

  const queue = new Queue(QUEUES.notifications, { connection: createRedisConnection() });
  try {
    await queue.add(JOBS.sendPasswordResetEmail, payload, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 2_000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });
  } finally {
    await queue.close();
  }
};
