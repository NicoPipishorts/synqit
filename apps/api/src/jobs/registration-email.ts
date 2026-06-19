import {
  JOBS,
  registrationConfirmationEmailPreviewJobSchema,
  registrationConfirmationEmailJobSchema,
  type EmailLocale,
} from '@synqit/shared';

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

export const isRegistrationConfirmationEmailEnabled = (): boolean =>
  parseBoolean(process.env.AUTH_REGISTRATION_EMAIL_ENABLED, false);

export const enqueueRegistrationConfirmationEmail = async (params: {
  userId: string;
  toEmail: string;
  locale: EmailLocale;
}) => {
  const payload = registrationConfirmationEmailJobSchema.parse({
    userId: params.userId,
    toEmail: params.toEmail,
    locale: params.locale,
    webAppUrl: resolveWebAppUrl(),
  });

  await enqueueNotificationJob(
    JOBS.sendRegistrationConfirmationEmail,
    payload,
    NOTIFICATION_JOB_OPTIONS,
  );
};

export const enqueueRegistrationConfirmationEmailPreview = async (params: {
  toEmail: string;
  locale: EmailLocale;
}) => {
  const payload = registrationConfirmationEmailPreviewJobSchema.parse({
    toEmail: params.toEmail,
    locale: params.locale,
    webAppUrl: resolveWebAppUrl(),
    requestedAt: new Date().toISOString(),
  });

  return enqueueNotificationJob(
    JOBS.sendRegistrationConfirmationEmailPreview,
    payload,
    NOTIFICATION_PREVIEW_JOB_OPTIONS,
  );
};
