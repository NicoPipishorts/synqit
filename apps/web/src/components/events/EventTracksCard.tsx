import { ListMusic, RefreshCcw } from 'lucide-react';

import { AddedTrackRow, TrackSkeletonList } from './PublicTrackRow';
import { useI18n } from '../../hooks/useI18n';
import { EventTrackItem } from '../../lib/events';

type EventTracksCardProps = {
  tracks: EventTrackItem[];
  isLoadingTracks: boolean;
  onRefreshTracks: () => void;
};

export const EventTracksCard = ({
  tracks,
  isLoadingTracks,
  onRefreshTracks,
}: EventTracksCardProps) => {
  const { t } = useI18n();

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="pl-4 text-xs font-semibold text-app-text-secondary">
          {t('eventsPage.tracksTitle')} ({tracks.length})
        </p>
        <button
          type="button"
          aria-label={t('eventsPage.refreshTracks')}
          disabled={isLoadingTracks}
          onClick={onRefreshTracks}
          className="group flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-app-border bg-app-surface transition hover:border-brand-pink disabled:opacity-50 dark:bg-app-elevated"
        >
          <RefreshCcw
            size={13}
            aria-hidden="true"
            className={`transition-colors group-hover:text-brand-pink ${
              isLoadingTracks
                ? 'animate-spin'
                : 'group-hover:animate-[spin_0.4s_linear_reverse_0.5]'
            }`}
          />
        </button>
      </div>

      {isLoadingTracks ? (
        <TrackSkeletonList />
      ) : tracks.length > 0 ? (
        <ul className="grid gap-3">
          {tracks.map((track) => (
            <AddedTrackRow key={track.providerTrackId} track={track} />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <ListMusic size={32} className="text-app-text-secondary/40" aria-hidden="true" />
          <p className="text-sm font-semibold text-app-text-secondary">
            {t('eventsPage.noTracks')}
          </p>
        </div>
      )}
    </div>
  );
};
