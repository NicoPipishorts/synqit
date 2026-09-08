import type { ProviderPlaylistItem } from '@synqit/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ListMusic, Music, Repeat2 } from 'lucide-react';

import { useI18n } from '../../hooks/useI18n';
import { PROVIDER_LABELS } from '../../lib/providers';
import { CTAButton } from '../ui/cta';

type SyncPlaylistPickerProps = {
  playlists: ProviderPlaylistItem[];
  selectedId: string | null;
  onSelect: (playlist: ProviderPlaylistItem) => void;
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  isLoadingMore: boolean;
};

export const SyncPlaylistPicker = ({
  playlists,
  selectedId,
  onSelect,
  isLoading,
  hasMore,
  onLoadMore,
  isLoadingMore,
}: SyncPlaylistPickerProps) => {
  const { t } = useI18n();

  if (isLoading) {
    return (
      <div className="grid gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl border-2 border-app-border-strong bg-app-elevated/60 p-3 animate-pulse"
          >
            <div className="h-10 w-10 shrink-0 rounded-lg bg-app-border" />
            <div className="grid flex-1 gap-1.5">
              <div className="h-3.5 w-2/3 rounded bg-app-border" />
              <div className="h-3 w-1/3 rounded bg-app-border" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (playlists.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-app-text-secondary">
        {t('syncCreatePage.stepPlaylistEmpty')}
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      <AnimatePresence initial={false}>
        {playlists.map((playlist) => {
          const isSelected = playlist.providerPlaylistId === selectedId;
          return (
            <motion.div
              key={playlist.providerPlaylistId}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="min-w-0"
            >
              <button
                type="button"
                onClick={() => onSelect(playlist)}
                className={`group flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition duration-150 select-none ${
                  isSelected
                    ? 'cursor-default border-app-text bg-brand-lime/15 shadow-sticker-sm'
                    : 'cursor-pointer border-app-border-strong bg-app-elevated/60 hover:border-app-text hover:bg-app-elevated dark:hover:bg-app-card'
                }`}
              >
                <div className="relative shrink-0">
                  {playlist.coverImageUrl ? (
                    <img
                      src={playlist.coverImageUrl}
                      alt=""
                      className="h-10 w-10 rounded-lg border-2 border-app-text object-cover"
                    />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-app-text bg-app-surface text-app-text-muted">
                      <ListMusic size={16} aria-hidden="true" />
                    </span>
                  )}
                  <span
                    className={`pointer-events-none absolute -right-1.5 -bottom-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-app-text bg-brand-lime text-brand-dark transition-all duration-150 ${
                      isSelected
                        ? 'opacity-100 scale-100'
                        : 'opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100'
                    }`}
                  >
                    <Music size={10} strokeWidth={2.5} aria-hidden="true" />
                  </span>
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="flex min-w-0 items-center gap-2">
                    <p
                      className={`min-w-0 flex-1 truncate text-sm font-bold transition-colors duration-150 ${isSelected ? 'text-brand-dark dark:text-brand-white' : 'text-brand-dark dark:text-brand-white'}`}
                    >
                      {playlist.name}
                    </p>
                    {playlist.origin ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-app-border/60 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-app-text-secondary">
                        <Repeat2 size={11} aria-hidden="true" />
                        {t('transferPage.originBadge', {
                          provider: PROVIDER_LABELS[playlist.origin.provider],
                        })}
                      </span>
                    ) : null}
                    {playlist.priorTransfer &&
                    playlist.priorTransfer.destinationProviders.length > 0 ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-300">
                        <Check size={11} strokeWidth={3} aria-hidden="true" />
                        {t('transferPage.alreadyTransferredBadge')}
                      </span>
                    ) : null}
                  </div>
                  {isSelected && playlist.trackCount !== null && (
                    <p className="max-w-full truncate text-xs text-app-text-secondary">
                      {t('syncCreatePage.trackCount', { count: playlist.trackCount })}
                    </p>
                  )}
                </div>
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {hasMore && (
        <div className="mt-2 flex justify-center">
          <CTAButton
            type="button"
            variant="secondary"
            onClick={onLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore
              ? t('syncCreatePage.stepPlaylistLoading')
              : t('syncCreatePage.stepPlaylistLoadMore')}
          </CTAButton>
        </div>
      )}
    </div>
  );
};
