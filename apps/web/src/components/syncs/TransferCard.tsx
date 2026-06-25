import type { SyncItem } from '@synqit/shared';
import { ArrowLeftRight } from 'lucide-react';

import { useI18n } from '../../hooks/useI18n';
import { EventProviderIcon } from '../events/EventProviderIcon';

type TransferCardProps = {
  sync: SyncItem;
};

const formatTransferTimestamp = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

export const TransferCard = ({ sync }: TransferCardProps) => {
  const { t } = useI18n();
  const sourceLabel = sync.provider === 'spotify' ? 'Spotify' : 'Apple Music';
  const formattedDate = formatTransferTimestamp(sync.lastSyncedAt ?? sync.createdAt);

  return (
    <div className="grid min-w-0 gap-4 overflow-hidden rounded-2xl border border-app-border bg-app-bg p-4 shadow-soft-lift transition duration-150 hover:border-brand-pink/40 dark:bg-app-card">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-pink/15 text-brand-pink"
        >
          <ArrowLeftRight size={18} />
        </span>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="min-w-0 truncate text-sm font-black text-brand-dark dark:text-brand-white">
              {sync.name}
            </h2>
            <span className="shrink-0 rounded-full bg-brand-pink/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-pink">
              {t('transferDashboardPage.badge')}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-app-text-secondary">
            {t('transferDashboardPage.fromProvider', { provider: sourceLabel })}
            {sync.trackCount !== null
              ? ` · ${t('syncCreatePage.trackCount', { count: sync.trackCount })}`
              : ''}
          </p>
        </div>
        <EventProviderIcon provider={sync.provider} sizeClassName="h-8 w-8 shrink-0" />
      </div>

      {formattedDate ? (
        <p className="text-xs text-app-text-secondary">
          {t('transferDashboardPage.transferredAt', { date: formattedDate })}
        </p>
      ) : null}
    </div>
  );
};
