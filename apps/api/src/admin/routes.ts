import { QUEUES, emailLocaleSchema } from '@synqit/shared';
import { Queue } from 'bullmq';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { enqueueRegistrationConfirmationEmailPreview } from '../jobs/registration-email';

const DEFAULT_REDIS_URL = 'redis://localhost:6380';

const previewEmailRequestSchema = z.object({
  toEmail: z.string().email(),
  locale: emailLocaleSchema.optional().default('en'),
});

const previewJobParamsSchema = z.object({
  jobId: z.string().min(1),
});

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
    enableOfflineQueue: false,
    connectTimeout: 1_200,
    maxRetriesPerRequest: 1,
  } as const;
};

const requireAdminKey = (request: FastifyRequest, reply: FastifyReply): boolean => {
  const expectedKey = process.env.ADMIN_EMAIL_PREVIEW_KEY?.trim();
  if (!expectedKey) {
    reply.status(503).send({
      code: 'admin_email_preview_not_configured',
      message: 'Admin preview email key is not configured.',
    });
    return false;
  }

  const providedKey = request.headers['x-admin-key'];
  if (typeof providedKey !== 'string' || providedKey.trim() !== expectedKey) {
    reply.status(403).send({
      code: 'forbidden',
      message: 'Admin key is invalid.',
    });
    return false;
  }

  return true;
};

export const registerAdminRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post('/admin/email/preview', async (request, reply) => {
    if (!requireAdminKey(request, reply)) {
      return;
    }

    const parsed = previewEmailRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        code: 'validation_error',
        message: 'Request payload is invalid.',
        details: parsed.error.flatten(),
      });
    }

    try {
      const jobId = await enqueueRegistrationConfirmationEmailPreview({
        toEmail: parsed.data.toEmail,
        locale: parsed.data.locale,
      });

      return reply.status(202).send({
        ok: true,
        queued: true,
        jobId: String(jobId),
      });
    } catch (error) {
      request.log.error({ err: error }, 'failed to enqueue preview registration email');
      return reply.status(500).send({
        code: 'email_preview_enqueue_failed',
        message: 'Unable to enqueue preview email at this time.',
      });
    }
  });

  app.get('/admin/email/jobs/:jobId', async (request, reply) => {
    if (!requireAdminKey(request, reply)) {
      return;
    }

    const params = previewJobParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        code: 'validation_error',
        message: 'Request params are invalid.',
        details: params.error.flatten(),
      });
    }

    const queue = new Queue(QUEUES.notifications, { connection: readRedisConnectionConfig() });
    try {
      const job = await queue.getJob(params.data.jobId);
      if (!job) {
        return reply.status(404).send({
          code: 'job_not_found',
          message: 'Job not found.',
        });
      }

      const state = await job.getState();
      return reply.status(200).send({
        ok: true,
        jobId: String(job.id),
        name: job.name,
        state,
        failedReason: job.failedReason ?? null,
        finishedOn: job.finishedOn ?? null,
        processedOn: job.processedOn ?? null,
      });
    } catch (error) {
      request.log.error({ err: error }, 'failed to query preview email job');
      return reply.status(500).send({
        code: 'email_job_status_failed',
        message: 'Unable to query email job status at this time.',
      });
    } finally {
      await queue.close();
    }
  });
};
