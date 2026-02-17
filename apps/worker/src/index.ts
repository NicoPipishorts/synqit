import {
  JOBS,
  QUEUES,
  passwordResetEmailJobSchema,
  registrationConfirmationEmailJobSchema,
  registrationConfirmationEmailPreviewJobSchema,
} from '@synqit/shared';
import { Job, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { resolve } from 'node:path';

import { sendTransactionalEmail } from './email/provider';
import { renderPasswordResetTemplate } from './email/templates/password-reset';
import { renderRegistrationConfirmationTemplate } from './email/templates/registration-confirmation';

const loadEnvFileIfPresent = (filePath: string): void => {
  try {
    process.loadEnvFile(filePath);
  } catch (error) {
    const normalizedError = error as { code?: string } | undefined;
    if (normalizedError?.code !== 'ENOENT') {
      throw error;
    }
  }
};

// .env.local takes precedence when both files exist.
loadEnvFileIfPresent(resolve(process.cwd(), '.env.local'));
loadEnvFileIfPresent(resolve(process.cwd(), '.env'));

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6380';

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

const syncQueue = new Queue(QUEUES.sync, { connection });
const notificationsQueue = new Queue(QUEUES.notifications, { connection });

const processSyncJob = async (job: Job) => {
  switch (job.name) {
    case JOBS.pullPlaylists:
      return {
        ok: true,
        message: 'Pull playlists job placeholder completed',
        input: job.data,
      };
    default:
      throw new Error(`Unknown sync job name: ${job.name}`);
  }
};

const processNotificationsJob = async (job: Job) => {
  switch (job.name) {
    case JOBS.sendRegistrationConfirmationEmail: {
      const parsed = registrationConfirmationEmailJobSchema.safeParse(job.data);
      if (!parsed.success) {
        throw new Error(`Invalid registration email payload: ${parsed.error.message}`);
      }

      const template = renderRegistrationConfirmationTemplate({
        locale: parsed.data.locale,
        webAppUrl: parsed.data.webAppUrl,
        recipientEmail: parsed.data.toEmail,
      });

      await sendTransactionalEmail({
        to: parsed.data.toEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      return {
        ok: true,
        userId: parsed.data.userId,
        toEmail: parsed.data.toEmail,
      };
    }
    case JOBS.sendRegistrationConfirmationEmailPreview: {
      const parsed = registrationConfirmationEmailPreviewJobSchema.safeParse(job.data);
      if (!parsed.success) {
        throw new Error(`Invalid registration preview email payload: ${parsed.error.message}`);
      }

      const template = renderRegistrationConfirmationTemplate({
        locale: parsed.data.locale,
        webAppUrl: parsed.data.webAppUrl,
        recipientEmail: parsed.data.toEmail,
      });

      await sendTransactionalEmail({
        to: parsed.data.toEmail,
        subject: `[Preview] ${template.subject}`,
        html: template.html,
        text: template.text,
      });

      return {
        ok: true,
        preview: true,
        toEmail: parsed.data.toEmail,
        requestedAt: parsed.data.requestedAt,
      };
    }
    case JOBS.sendPasswordResetEmail: {
      const parsed = passwordResetEmailJobSchema.safeParse(job.data);
      if (!parsed.success) {
        throw new Error(`Invalid password reset email payload: ${parsed.error.message}`);
      }

      const template = renderPasswordResetTemplate({
        locale: parsed.data.locale,
        webAppUrl: parsed.data.webAppUrl,
        recipientEmail: parsed.data.toEmail,
        resetToken: parsed.data.resetToken,
      });

      await sendTransactionalEmail({
        to: parsed.data.toEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      return {
        ok: true,
        userId: parsed.data.userId,
        toEmail: parsed.data.toEmail,
      };
    }
    default:
      throw new Error(`Unknown notifications job name: ${job.name}`);
  }
};

const syncWorker = new Worker(QUEUES.sync, processSyncJob, { connection });

const notificationsWorker = new Worker(QUEUES.notifications, processNotificationsJob, {
  connection,
});

const bindWorkerEvents = (worker: Worker, workerLabel: string): void => {
  worker.on('completed', (job) => {
    console.log(`[worker:${workerLabel}] completed job=${job.id} name=${job.name}`);
  });

  worker.on('failed', (job, error) => {
    console.error(
      `[worker:${workerLabel}] failed job=${job?.id ?? 'n/a'} name=${job?.name ?? 'n/a'}`,
      error,
    );
  });
};

bindWorkerEvents(syncWorker, 'sync');
bindWorkerEvents(notificationsWorker, 'notifications');

const bootstrap = async () => {
  console.log('[worker] booted and waiting for jobs', {
    emailProvider: process.env.EMAIL_PROVIDER ?? 'log',
  });
};

const shutdown = async () => {
  await syncWorker.close();
  await notificationsWorker.close();
  await syncQueue.close();
  await notificationsQueue.close();
  await connection.quit();
};

process.on('SIGINT', () => {
  void shutdown().finally(() => process.exit(0));
});

process.on('SIGTERM', () => {
  void shutdown().finally(() => process.exit(0));
});

void bootstrap();
