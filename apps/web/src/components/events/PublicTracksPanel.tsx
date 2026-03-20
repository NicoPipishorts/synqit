import { ListMusic, RefreshCcw } from 'lucide-react';

import { AddedTrackRow, TrackSkeletonList } from './PublicTrackRow';
import { useI18n } from '../../hooks/useI18n';
import { EventTrackItem } from '../../lib/events';
import { CTAButton } from '../ui/cta';

type Props = {
  tracks: EventTrackItem[];
  visibleCount: number;
  isLoading: boolean;
  isProviderPlaylistMissing: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
};

export const PublicTracksPanel = ({
  tracks,
  visibleCount,
  isLoading,
  isProviderPlaylistMissing,
  onRefresh,
  onLoadMore,
}: Props) => {
  const { t } = useI18n();

  return (
    <div className="grid gap-3">
      {!isProviderPlaylistMissing ? (
        <div className="flex items-center justify-between gap-2">
          <p className="pl-4 text-xs font-semibold text-app-text-secondary">
            {t('eventPublicPage.currentTracks', { count: tracks.length })}
          </p>
          <button
            type="button"
            aria-label={t('eventPublicPage.refresh')}
            disabled={isLoading}
            onClick={onRefresh}
            className="group flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-app-border bg-app-surface transition hover:border-brand-pink disabled:opacity-50 dark:bg-app-elevated"
          >
            <RefreshCcw
              size={13}
              aria-hidden="true"
              className={`transition-colors group-hover:text-brand-pink ${
                isLoading ? 'animate-spin' : 'group-hover:animate-[spin_0.4s_linear_reverse_0.5]'
              }`}
            />
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <TrackSkeletonList />
      ) : tracks.length > 0 ? (
        <>
          <ul className="grid gap-3">
            {tracks.slice(0, visibleCount).map((track) => (
              <AddedTrackRow key={`${track.providerTrackId}-${track.addedAt}`} track={track} />
            ))}
          </ul>
          {tracks.length > visibleCount ? (
            <div className="flex justify-center pt-1">
              <CTAButton type="button" variant="secondary" onClick={onLoadMore}>
                {t('eventPublicPage.loadMoreTracks')}
              </CTAButton>
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <ListMusic size={32} className="text-app-text-secondary/40" aria-hidden="true" />
          <p className="text-sm font-semibold text-app-text-secondary">
            {isProviderPlaylistMissing
              ? t('eventPublicPage.statusPlaylistDeleted')
              : t('eventPublicPage.noTracksYet')}
          </p>
        </div>
      )}
    </div>
  );
};
