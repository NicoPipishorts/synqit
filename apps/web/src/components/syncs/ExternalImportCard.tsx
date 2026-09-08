import type { ExternalImportItem } from '@synqit/shared';
import { Link2 } from 'lucide-react';

import { useI18n } from '../../hooks/useI18n';
import { ProviderIcon } from '../providers/ProviderIcon';

const formatTimestamp = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    date,
  );
};

const sourceLabel = (source: ExternalImportItem['source']): string =>
  source === 'deezer' ? 'Deezer' : 'YouTube';

/** Dashboard card for a playlist imported from a public Deezer or YouTube link. */
export const ExternalImportCard = ({ item }: { item: ExternalImportItem }) => {
  const { t } = useI18n();
  const formattedDate = formatTimestamp(item.completedAt ?? item.createdAt);
  const processed = item.matchedCount + item.skippedCount;

  return (
    <div className="grid min-w-0 gap-4 overflow-hidden rounded-2xl border border-app-border bg-app-bg p-4 shadow-soft-lift transition duration-150 hover:border-brand-pink/40 dark:bg-app-card">
      <div className="flex items-start gap-3">
        {item.coverImageUrl ? (
          <img
            src={item.coverImageUrl}
            alt=""
            className="h-11 w-11 shrink-0 rounded-xl object-cover"
            loading="lazy"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-pink/15 text-brand-pink"
          >
            <Link2 size={18} />
          </span>
        )}
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="min-w-0 truncate text-sm font-black text-brand-dark dark:text-brand-white">
              {item.name}
            </h2>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                item.status === 'failed'
                  ? 'bg-brand-pink/15 text-brand-pink'
                  : item.status === 'completed'
                    ? 'bg-brand-lime/20 text-[#6d9600] dark:text-[#d5ff5c]'
                    : 'bg-app-surface text-app-text-secondary'
              }`}
            >
              {item.status === 'failed'
                ? t('transferDashboardPage.statusFailed')
                : item.status === 'completed'
                  ? t('transferDashboardPage.linkBadge')
                  : t('transferDashboardPage.statusRunning', {
                      done: processed,
                      total: item.totalCount,
                    })}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-app-text-secondary">
            {t('transferDashboardPage.fromLink', { source: sourceLabel(item.source) })}
            {item.status === 'completed'
              ? ` · ${t('transferLinkPage.matchedCount', { count: item.matchedCount })}`
              : ''}
          </p>
        </div>
        <ProviderIcon provider={item.recipientProvider} sizeClassName="h-8 w-8 shrink-0" />
      </div>

      {item.status === 'failed' && item.lastError ? (
        <p className="text-xs text-brand-pink">{item.lastError}</p>
      ) : formattedDate ? (
        <p className="text-xs text-app-text-secondary">
          {t('transferDashboardPage.transferredAt', { date: formattedDate })}
        </p>
      ) : null}
    </div>
  );
};
