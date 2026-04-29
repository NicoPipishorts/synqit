import type { ProviderPlaylistItem } from '@synqit/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { ListMusic, Music } from 'lucide-react';

import { useI18n } from '../../hooks/useI18n';
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
            className="flex items-center gap-3 rounded-xl border border-app-border bg-app-elevated/60 p-3 animate-pulse"
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
                className={`group flex w-full items-center gap-3 rounded-xl border p-3 text-left bg-app-elevated/60 transition-colors duration-150 dark:hover:bg-app-card select-none ${
                  isSelected
                    ? 'cursor-default border-brand-pink'
                    : 'cursor-pointer border-app-border hover:border-brand-pink'
                }`}
              >
                <div className="relative shrink-0">
                  {playlist.coverImageUrl ? (
                    <img
                      src={playlist.coverImageUrl}
                      alt=""
                      className="h-10 w-10 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-app-border text-app-text-muted">
                      <ListMusic size={16} aria-hidden="true" />
                    </span>
                  )}
                  <span
                    className={`pointer-events-none absolute -right-1.5 -bottom-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-pink text-white shadow-sm transition-all duration-150 ${
                      isSelected
                        ? 'opacity-100 scale-100'
                        : 'opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100'
                    }`}
                  >
                    <Music size={10} strokeWidth={2.5} aria-hidden="true" />
                  </span>
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p
                    className={`max-w-full truncate text-sm font-bold transition-colors duration-150 ${isSelected ? 'text-brand-pink' : 'text-brand-dark dark:text-brand-white group-hover:text-brand-pink'}`}
                  >
                    {playlist.name}
                  </p>
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
