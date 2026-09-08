import type { SyncItem } from '@synqit/shared';
import { TapeStrip } from '@synqit/ui';
import { ArrowLeftRight } from 'lucide-react';

import { useI18n } from '../../hooks/useI18n';
import { PROVIDER_LABELS } from '../../lib/providers';
import { ProviderIcon } from '../providers/ProviderIcon';

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
  const sourceLabel = PROVIDER_LABELS[sync.provider];
  const formattedDate = formatTransferTimestamp(sync.lastSyncedAt ?? sync.createdAt);

  return (
    <div className="relative grid min-w-0 gap-4 rounded-3xl border-2 border-app-text bg-app-elevated p-4 shadow-sticker transition duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[6px_6px_0_0_var(--syn-text)] dark:bg-app-card">
      <TapeStrip tone="gradient" />
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-app-text bg-app-text text-app-bg"
        >
          <ArrowLeftRight size={18} />
        </span>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="min-w-0 truncate text-sm font-black text-brand-dark dark:text-brand-white">
              {sync.name}
            </h2>
            <span className="shrink-0 rounded-full border border-app-text bg-brand-pink px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-brand-white">
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
        <ProviderIcon provider={sync.provider} sizeClassName="h-8 w-8 shrink-0" />
      </div>

      {formattedDate ? (
        <p className="text-xs text-app-text-secondary">
          {t('transferDashboardPage.transferredAt', { date: formattedDate })}
        </p>
      ) : null}
    </div>
  );
};
