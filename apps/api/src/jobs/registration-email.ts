import {
  JOBS,
  QUEUES,
  registrationInviteEmailJobSchema,
  registrationInviteEmailPreviewJobSchema,
  registrationConfirmationEmailPreviewJobSchema,
  registrationConfirmationEmailJobSchema,
  type EmailLocale,
} from '@synqit/shared';
import { Queue } from 'bullmq';
import { randomBytes } from 'node:crypto';

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

export const isRegistrationConfirmationEmailEnabled = (): boolean =>
  parseBoolean(process.env.AUTH_REGISTRATION_EMAIL_ENABLED, false);

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

export const enqueueRegistrationConfirmationEmail = async (params: {
  userId: string;
  toEmail: string;
  locale: EmailLocale;
}) => {
  const payload = registrationConfirmationEmailJobSchema.parse({
    userId: params.userId,
    toEmail: params.toEmail,
    locale: params.locale,
    webAppUrl: process.env.WEB_APP_URL ?? DEFAULT_WEB_APP_URL,
  });

  const queue = new Queue(QUEUES.notifications, { connection: createRedisConnection() });
  try {
    await queue.add(JOBS.sendRegistrationConfirmationEmail, payload, {
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

export const enqueueRegistrationInviteEmail = async (params: {
  inviteId: string;
  toEmail: string;
  locale: EmailLocale;
  inviteToken: string;
}) => {
  const webAppUrl = process.env.WEB_APP_URL ?? DEFAULT_WEB_APP_URL;
  const baseUrl = webAppUrl.replace(/\/+$/, '');
  const inviteUrl = `${baseUrl}/auth/register?email=${encodeURIComponent(
    params.toEmail,
  )}&inviteToken=${encodeURIComponent(params.inviteToken)}`;

  const payload = registrationInviteEmailJobSchema.parse({
    inviteId: params.inviteId,
    toEmail: params.toEmail,
    locale: params.locale,
    webAppUrl,
    inviteUrl,
  });

  const queue = new Queue(QUEUES.notifications, { connection: createRedisConnection() });
  try {
    await queue.add(JOBS.sendRegistrationInviteEmail, payload, {
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

export const enqueueRegistrationInviteEmailPreview = async (params: {
  toEmail: string;
  locale: EmailLocale;
}) => {
  const webAppUrl = process.env.WEB_APP_URL ?? DEFAULT_WEB_APP_URL;
  const baseUrl = webAppUrl.replace(/\/+$/, '');
  const previewToken = `synqit_inv_${randomBytes(18).toString('base64url')}`;
  const inviteUrl = `${baseUrl}/auth/register?email=${encodeURIComponent(
    params.toEmail,
  )}&inviteToken=${encodeURIComponent(previewToken)}`;

  const payload = registrationInviteEmailPreviewJobSchema.parse({
    toEmail: params.toEmail,
    locale: params.locale,
    webAppUrl,
    inviteUrl,
    requestedAt: new Date().toISOString(),
  });

  const queue = new Queue(QUEUES.notifications, { connection: createRedisConnection() });
  try {
    const job = await queue.add(JOBS.sendRegistrationInviteEmailPreview, payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1_000,
      },
      removeOnComplete: false,
      removeOnFail: false,
    });

    return job.id;
  } finally {
    await queue.close();
  }
};

export const enqueueRegistrationConfirmationEmailPreview = async (params: {
  toEmail: string;
  locale: EmailLocale;
}) => {
  const payload = registrationConfirmationEmailPreviewJobSchema.parse({
    toEmail: params.toEmail,
    locale: params.locale,
    webAppUrl: process.env.WEB_APP_URL ?? DEFAULT_WEB_APP_URL,
    requestedAt: new Date().toISOString(),
  });

  const queue = new Queue(QUEUES.notifications, { connection: createRedisConnection() });
  try {
    const job = await queue.add(JOBS.sendRegistrationConfirmationEmailPreview, payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1_000,
      },
      removeOnComplete: false,
      removeOnFail: false,
    });

    return job.id;
  } finally {
    await queue.close();
  }
};
