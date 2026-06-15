import {
  JOBS,
  weeklyRecapEmailJobSchema,
  weeklyRecapEmailPreviewJobSchema,
  type EmailLocale,
  type WeeklyRecapEmailJob,
} from '@synqit/shared';

import {
  NOTIFICATION_JOB_OPTIONS,
  NOTIFICATION_PREVIEW_JOB_OPTIONS,
  enqueueNotificationJob,
  resolveWebAppUrl,
} from './notifications-queue';

export const enqueueWeeklyRecapEmail = async (payload: WeeklyRecapEmailJob): Promise<void> => {
  const parsed = weeklyRecapEmailJobSchema.parse(payload);
  await enqueueNotificationJob(JOBS.sendWeeklyRecapEmail, parsed, NOTIFICATION_JOB_OPTIONS);
};

export const enqueueWeeklyRecapEmailPreview = async (params: {
  toEmail: string;
  locale: EmailLocale;
}): Promise<string | undefined> => {
  const payload = weeklyRecapEmailPreviewJobSchema.parse({
    toEmail: params.toEmail,
    locale: params.locale,
    webAppUrl: resolveWebAppUrl(),
    requestedAt: new Date().toISOString(),
  });

  return enqueueNotificationJob(
    JOBS.sendWeeklyRecapEmailPreview,
    payload,
    NOTIFICATION_PREVIEW_JOB_OPTIONS,
  );
};
