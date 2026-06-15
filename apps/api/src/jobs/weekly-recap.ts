import { notificationRunsStore } from './notification-runs-store';
import { buildWeeklyRecapDigests, DEFAULT_WINDOW_DAYS } from './weekly-recap-digests';
import { enqueueWeeklyRecapEmail } from './weekly-recap-email';

type Logger = {
  info: (payload: unknown, message?: string) => void;
  error: (payload: unknown, message?: string) => void;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_SEND_DAY = 1; // Monday (0 = Sunday .. 6 = Saturday)
const DEFAULT_SEND_HOUR_UTC = 9;
const WEEKLY_RECAP_KIND = 'weekly_recap';

const clampInt = (raw: string | undefined, fallback: number, min: number, max: number): number => {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
};

const startOfIsoWeekUTC = (date: Date): Date => {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = day.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const shiftToMonday = weekday === 0 ? -6 : 1 - weekday;
  day.setUTCDate(day.getUTCDate() + shiftToMonday);
  return day;
};

export const isoWeekKey = (date: Date): string => {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = (target.getUTCDay() + 6) % 7; // Monday = 0
  target.setUTCDate(target.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstThursdayDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDayNum + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

const scheduledSendTimeForWeek = (now: Date): Date => {
  const sendDay = clampInt(process.env.WEEKLY_RECAP_SEND_DAY, DEFAULT_SEND_DAY, 0, 6);
  const sendHour = clampInt(process.env.WEEKLY_RECAP_SEND_HOUR_UTC, DEFAULT_SEND_HOUR_UTC, 0, 23);
  const monday = startOfIsoWeekUTC(now);
  // Days from Monday to the configured weekday (Sunday counts as end of week).
  const offsetFromMonday = sendDay === 0 ? 6 : sendDay - 1;
  const target = new Date(monday.getTime());
  target.setUTCDate(target.getUTCDate() + offsetFromMonday);
  target.setUTCHours(sendHour, 0, 0, 0);
  return target;
};

const runWeeklyRecapIfDue = async (logger: Logger): Promise<void> => {
  const now = new Date();
  if (now < scheduledSendTimeForWeek(now)) {
    return;
  }

  const periodKey = isoWeekKey(now);
  const claimed = await notificationRunsStore.claimPeriod({
    kind: WEEKLY_RECAP_KIND,
    periodKey,
  });
  if (!claimed) {
    return;
  }

  const windowDays = clampInt(process.env.WEEKLY_RECAP_WINDOW_DAYS, DEFAULT_WINDOW_DAYS, 1, 90);
  logger.info({ periodKey, windowDays }, '[api][recap] weekly recap run started');

  const digests = await buildWeeklyRecapDigests({ now, windowDays });
  let enqueued = 0;
  for (const digest of digests) {
    try {
      await enqueueWeeklyRecapEmail(digest);
      enqueued += 1;
    } catch (error) {
      logger.error(
        { err: error, userId: digest.userId },
        '[api][recap] failed to enqueue weekly recap email',
      );
    }
  }

  logger.info(
    { periodKey, eligibleUsers: digests.length, enqueued },
    '[api][recap] weekly recap run complete',
  );
};

export const startWeeklyRecapScheduler = (logger: Logger): (() => void) => {
  if (process.env.WEEKLY_RECAP_ENABLED !== 'true') {
    logger.info({ weeklyRecapEnabled: false }, 'weekly recap scheduler disabled');
    return () => undefined;
  }

  const checkIntervalMs = clampInt(
    process.env.WEEKLY_RECAP_CHECK_INTERVAL_MS,
    DEFAULT_CHECK_INTERVAL_MS,
    60_000,
    24 * 60 * 60 * 1000,
  );

  let isRunning = false;
  const tick = async () => {
    if (isRunning) {
      return;
    }
    isRunning = true;
    try {
      await runWeeklyRecapIfDue(logger);
    } catch (error) {
      logger.error({ err: error }, '[api][recap] weekly recap tick failed');
    } finally {
      isRunning = false;
    }
  };

  logger.info({ checkIntervalMs }, 'weekly recap scheduler started');
  void tick();
  const intervalId = setInterval(() => {
    void tick();
  }, checkIntervalMs);

  return () => {
    clearInterval(intervalId);
  };
};
