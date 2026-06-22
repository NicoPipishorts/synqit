import { deleteAvatarImage } from '../auth/avatar-storage';
import { authStore } from '../auth/store';

type Logger = {
  info: (payload: unknown, message?: string) => void;
  error: (payload: unknown, message?: string) => void;
};

const DEFAULT_ACCOUNT_DELETION_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_ACCOUNT_DELETION_BATCH_SIZE = 25;

const clampInt = (raw: string | undefined, fallback: number, min: number, max: number): number => {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
};

const runAccountDeletionCycle = async (logger: Logger): Promise<void> => {
  const batchSize = clampInt(
    process.env.ACCOUNT_DELETION_BATCH_SIZE,
    DEFAULT_ACCOUNT_DELETION_BATCH_SIZE,
    1,
    500,
  );
  const dueUsers = await authStore.listUsersPendingDeletion(batchSize);
  if (dueUsers.length === 0) {
    return;
  }

  let purgedCount = 0;
  for (const user of dueUsers) {
    try {
      const result = await authStore.anonymizeUserForDeletionById(user.id);
      if (!result.ok) {
        continue;
      }
      if (result.avatarPath) {
        await deleteAvatarImage(result.avatarPath);
      }
      await authStore.createAdminAuditLog({
        actorUserId: null,
        actorEmail: 'system',
        targetUserId: user.id,
        targetEmail: user.email,
        action: 'user_deletion_purged',
        reason: user.deletionReason,
        metadata: {
          scheduledFor: user.deletionScheduledFor?.toISOString() ?? null,
        },
      });
      purgedCount += 1;
    } catch (error) {
      logger.error({ err: error, userId: user.id }, '[api][deletion] account purge failed');
    }
  }

  logger.info({ dueUsers: dueUsers.length, purgedCount }, '[api][deletion] account purge tick complete');
};

export const startAccountDeletionScheduler = (logger: Logger): (() => void) => {
  if (process.env.ACCOUNT_DELETION_ENABLED === 'false') {
    logger.info({ accountDeletionEnabled: false }, 'account deletion scheduler disabled');
    return () => undefined;
  }

  const checkIntervalMs = clampInt(
    process.env.ACCOUNT_DELETION_CHECK_INTERVAL_MS,
    DEFAULT_ACCOUNT_DELETION_CHECK_INTERVAL_MS,
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
      await runAccountDeletionCycle(logger);
    } catch (error) {
      logger.error({ err: error }, '[api][deletion] account deletion tick failed');
    } finally {
      isRunning = false;
    }
  };

  logger.info({ checkIntervalMs }, 'account deletion scheduler started');
  void tick();
  const intervalId = setInterval(() => {
    void tick();
  }, checkIntervalMs);

  return () => {
    clearInterval(intervalId);
  };
};
