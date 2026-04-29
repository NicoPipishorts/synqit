import { Check, LoaderCircle, Plus } from 'lucide-react';

import { useI18n } from '../../hooks/useI18n';
import { SearchTrackResult } from '../../hooks/usePublicEvent';
import { EventTrackItem } from '../../lib/events';

type ArtworkProps = { url: string | null; fallbackLabel: string };

const TrackArtwork = ({ url, fallbackLabel }: ArtworkProps) =>
  url ? (
    <img
      src={url}
      alt=""
      width={44}
      height={44}
      className="h-11 w-11 shrink-0 rounded-md object-cover"
    />
  ) : (
    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-app-border text-xs text-app-text-secondary">
      {fallbackLabel}
    </span>
  );

type SearchTrackRowProps = {
  track: SearchTrackResult;
  isAdded: boolean;
  isAdding: boolean;
  onAdd: () => void;
};

export const SearchTrackRow = ({ track, isAdded, isAdding, onAdd }: SearchTrackRowProps) => {
  const { t } = useI18n();
  return (
    <li className="min-w-0">
      <button
        type="button"
        aria-label={
          isAdding
            ? t('eventPublicPage.adding')
            : isAdded
              ? t('eventPublicPage.alreadyAdded')
              : t('eventPublicPage.add')
        }
        disabled={isAdding || isAdded}
        onClick={onAdd}
        className={`group flex min-w-0 w-full max-w-full cursor-pointer items-center gap-3 rounded-xl border bg-app-bg px-3 py-3 shadow-soft-lift transition duration-150 dark:bg-app-elevated disabled:pointer-events-none ${
          isAdded
            ? 'border-app-border opacity-60'
            : 'border-app-border hover:border-brand-pink hover:bg-app-surface dark:hover:bg-app-card'
        }`}
      >
        <TrackArtwork url={track.artworkUrl} fallbackLabel={t('eventPublicPage.notAvailable')} />
        <div className="min-w-0 flex-1 overflow-hidden text-left">
          <p className="max-w-full truncate text-sm font-bold text-brand-dark dark:text-brand-white">
            {track.name}
          </p>
          <p className="max-w-full truncate text-xs text-app-text-secondary">
            {track.artist} · {track.album}
          </p>
        </div>
        {isAdding ? (
          <LoaderCircle
            size={16}
            className="shrink-0 animate-spin text-app-text-secondary"
            aria-hidden="true"
          />
        ) : isAdded ? (
          <Check
            size={18}
            strokeWidth={3}
            className="shrink-0 text-brand-dark dark:text-brand-white"
            aria-hidden="true"
          />
        ) : (
          <Plus
            size={18}
            aria-hidden="true"
            className="shrink-0 text-app-text-secondary transition-transform duration-150 ease-out group-hover:scale-125 group-hover:text-brand-pink active:scale-95"
          />
        )}
      </button>
    </li>
  );
};

type AddedTrackRowProps = { track: EventTrackItem };

export const AddedTrackRow = ({ track }: AddedTrackRowProps) => (
  <li className="flex min-w-0 max-w-full items-center gap-3 rounded-xl border border-app-border bg-app-bg px-3 py-3 shadow-soft-lift dark:bg-app-elevated">
    {track.artworkUrl ? (
      <img
        src={track.artworkUrl}
        alt=""
        width={44}
        height={44}
        className="h-11 w-11 shrink-0 rounded-md object-cover"
      />
    ) : null}
    <div className="min-w-0 flex-1 overflow-hidden">
      <p className="max-w-full truncate text-sm font-bold text-brand-dark dark:text-brand-white">
        {track.name}
      </p>
      <p className="max-w-full truncate text-xs text-app-text-secondary">
        {track.artist} · {track.album}
      </p>
    </div>
  </li>
);

type TrackSkeletonListProps = { count?: number; withAddButton?: boolean };

export const TrackSkeletonList = ({ count = 7, withAddButton = false }: TrackSkeletonListProps) => (
  <ul className="grid gap-3">
    {Array.from({ length: count }).map((_, i) => (
      <li
        key={i}
        className="flex min-w-0 items-center gap-3 rounded-xl border border-app-border bg-app-bg px-3 py-3 shadow-soft-lift dark:bg-app-elevated"
      >
        <div className="h-11 w-11 shrink-0 animate-pulse rounded-md bg-app-border" />
        <div className="grid min-w-0 flex-1 gap-1.5">
          <div className="h-3.5 w-3/4 animate-pulse rounded bg-app-border" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-app-border" />
        </div>
        {withAddButton ? (
          <div className="h-5 w-5 shrink-0 animate-pulse rounded-full bg-app-border" />
        ) : null}
      </li>
    ))}
  </ul>
);
