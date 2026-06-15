import {
  JOBS,
  passwordResetEmailJobSchema,
  passwordResetEmailPreviewJobSchema,
  type EmailLocale,
} from '@synqit/shared';
import { randomBytes } from 'node:crypto';

import {
  NOTIFICATION_JOB_OPTIONS,
  NOTIFICATION_PREVIEW_JOB_OPTIONS,
  enqueueNotificationJob,
  resolveWebAppUrl,
} from './notifications-queue';

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
    webAppUrl: resolveWebAppUrl(),
  });

  await enqueueNotificationJob(JOBS.sendPasswordResetEmail, payload, NOTIFICATION_JOB_OPTIONS);
};

export const enqueuePasswordResetEmailPreview = async (params: {
  toEmail: string;
  locale: EmailLocale;
}) => {
  const payload = passwordResetEmailPreviewJobSchema.parse({
    toEmail: params.toEmail,
    locale: params.locale,
    webAppUrl: resolveWebAppUrl(),
    resetToken: randomBytes(24).toString('hex'),
    requestedAt: new Date().toISOString(),
  });

  return enqueueNotificationJob(
    JOBS.sendPasswordResetEmailPreview,
    payload,
    NOTIFICATION_PREVIEW_JOB_OPTIONS,
  );
};
