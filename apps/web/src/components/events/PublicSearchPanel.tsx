import { LoaderCircle, Search, X } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';

import { SearchTrackRow, TrackSkeletonList } from './PublicTrackRow';
import { useI18n } from '../../hooks/useI18n';
import { SearchTrackResult } from '../../hooks/usePublicEvent';
import { CTAButton } from '../ui/cta';

type Props = {
  searchQuery: string;
  searchStatus: string;
  searchResults: SearchTrackResult[];
  hasSearched: boolean;
  hasMoreSearchResults: boolean;
  isSearching: boolean;
  isLoadingMoreSearchResults: boolean;
  addingTrackId: string | null;
  addedTrackIds: Set<string>;
  isEventOpen: boolean;
  onSearch: (e: FormEvent<HTMLFormElement>) => void;
  onQueryChange: (value: string) => void;
  onClearSearch: () => void;
  onAddTrack: (track: SearchTrackResult) => void;
  onLoadMore: () => void;
};

export const PublicSearchPanel = ({
  searchQuery,
  searchStatus,
  searchResults,
  hasSearched,
  hasMoreSearchResults,
  isSearching,
  isLoadingMoreSearchResults,
  addingTrackId,
  addedTrackIds,
  isEventOpen,
  onSearch,
  onQueryChange,
  onClearSearch,
  onAddTrack,
  onLoadMore,
}: Props) => {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activePreviewTrackId, setActivePreviewTrackId] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      audioRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!searchResults.some((track) => track.providerTrackId === activePreviewTrackId)) {
      audioRef.current?.pause();
      setActivePreviewTrackId(null);
      setIsPreviewPlaying(false);
      setPreviewProgress(0);
    }
  }, [activePreviewTrackId, searchResults]);

  const togglePreview = async (track: SearchTrackResult) => {
    if (!track.previewUrl) {
      return;
    }

    const currentAudio = audioRef.current;
    if (
      currentAudio &&
      activePreviewTrackId === track.providerTrackId &&
      currentAudio.src === track.previewUrl
    ) {
      if (currentAudio.paused) {
        await currentAudio.play();
      } else {
        currentAudio.pause();
      }
      return;
    }

    if (currentAudio) {
      currentAudio.pause();
    }

    const nextAudio = new Audio(track.previewUrl);
    nextAudio.addEventListener('timeupdate', () => {
      const duration = nextAudio.duration || 30;
      setPreviewProgress(duration > 0 ? nextAudio.currentTime / duration : 0);
    });
    nextAudio.addEventListener('ended', () => {
      setIsPreviewPlaying(false);
      setPreviewProgress(1);
    });
    nextAudio.addEventListener('pause', () => setIsPreviewPlaying(false));
    nextAudio.addEventListener('play', () => setIsPreviewPlaying(true));
    audioRef.current = nextAudio;
    setActivePreviewTrackId(track.providerTrackId);
    setPreviewProgress(0);
    try {
      await nextAudio.play();
    } catch {
      setActivePreviewTrackId(null);
      setIsPreviewPlaying(false);
      setPreviewProgress(0);
    }
  };

  return (
    <div className="grid gap-3">
      {/* Search input */}
      <form onSubmit={onSearch}>
        <label className="relative flex items-center text-sm">
          <input
            placeholder={t('eventPublicPage.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => onQueryChange(e.target.value)}
            minLength={2}
            maxLength={120}
            className="w-full rounded-xl border border-app-border bg-app-bg py-2.5 pl-4 pr-10 text-app-text outline-none transition focus:border-brand-lime dark:bg-app-elevated"
          />
          <span className="absolute right-0 flex h-full items-center pr-3">
            {isSearching ? (
              <LoaderCircle
                size={16}
                className="animate-spin text-app-text-secondary"
                aria-hidden="true"
              />
            ) : searchQuery ? (
              <button
                type="button"
                aria-label={t('eventPublicPage.clear')}
                onClick={onClearSearch}
                className="text-app-text-secondary transition hover:text-app-text"
              >
                <X size={16} aria-hidden="true" />
              </button>
            ) : (
              <button
                type="submit"
                aria-label={t('eventPublicPage.search')}
                disabled={!isEventOpen}
                className="text-app-text-secondary transition hover:text-app-text disabled:opacity-40"
              >
                <Search size={16} aria-hidden="true" />
              </button>
            )}
          </span>
        </label>
      </form>

      {/* Status line */}
      {searchStatus ? (
        <p className="pl-4 text-xs font-semibold text-app-text-secondary">{searchStatus}</p>
      ) : null}

      {/* Results */}
      {isSearching ? (
        <TrackSkeletonList withAddButton />
      ) : searchResults.length > 0 ? (
        <>
          <ul className="grid gap-3">
            {searchResults.map((track) => (
              <SearchTrackRow
                key={track.providerTrackId}
                track={track}
                isAdded={addedTrackIds.has(track.providerTrackId)}
                isAdding={addingTrackId === track.providerTrackId}
                canPreview={!!track.previewUrl}
                isPreviewActive={activePreviewTrackId === track.providerTrackId}
                isPreviewPlaying={
                  activePreviewTrackId === track.providerTrackId && isPreviewPlaying
                }
                previewProgress={
                  activePreviewTrackId === track.providerTrackId ? previewProgress : 0
                }
                onTogglePreview={() => void togglePreview(track)}
                onAdd={() => onAddTrack(track)}
              />
            ))}
          </ul>
          {hasMoreSearchResults ? (
            <div className="flex justify-center pt-1">
              <CTAButton
                type="button"
                variant="secondary"
                disabled={isLoadingMoreSearchResults}
                onClick={onLoadMore}
              >
                {isLoadingMoreSearchResults
                  ? t('eventPublicPage.loadingMoreResults')
                  : t('eventPublicPage.loadMoreResults')}
              </CTAButton>
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Search size={32} className="text-app-text-secondary/40" aria-hidden="true" />
          <p className="text-sm font-semibold text-app-text-secondary">
            {hasSearched ? t('eventPublicPage.noResults') : t('eventPublicPage.searchHint')}
          </p>
        </div>
      )}
    </div>
  );
};
