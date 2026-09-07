import { Check, LoaderCircle, Pause, Play, Plus } from 'lucide-react';

import { useI18n } from '../../hooks/useI18n';
import { SearchTrackResult } from '../../hooks/usePublicEvent';
import { EventTrackItem } from '../../lib/events';

type ArtworkProps = { url: string | null; fallbackLabel: string };

type SearchTrackRowProps = {
  track: SearchTrackResult;
  isAdded: boolean;
  isAdding: boolean;
  isPreviewActive: boolean;
  isPreviewPlaying: boolean;
  previewProgress: number;
  canPreview: boolean;
  onTogglePreview: () => void;
  onAdd: () => void;
};

const PREVIEW_RING_RADIUS = 18;
const PREVIEW_RING_CIRCUMFERENCE = 2 * Math.PI * PREVIEW_RING_RADIUS;

const TrackArtwork = ({
  url,
  fallbackLabel,
  canPreview,
  isPreviewActive,
  isPreviewPlaying,
  previewProgress,
  onTogglePreview,
}: ArtworkProps & {
  canPreview: boolean;
  isPreviewActive: boolean;
  isPreviewPlaying: boolean;
  previewProgress: number;
  onTogglePreview: () => void;
}) => {
  const { t } = useI18n();
  const actionLabel = isPreviewPlaying
    ? t('eventPublicPage.pausePreview')
    : t('eventPublicPage.playPreview');
  const ringOffset = PREVIEW_RING_CIRCUMFERENCE * (1 - Math.min(Math.max(previewProgress, 0), 1));

  return (
    <div className="relative h-11 w-11 shrink-0">
      {url ? (
        <img
          src={url}
          alt=""
          width={44}
          height={44}
          className="h-11 w-11 rounded-lg border-2 border-app-text object-cover"
        />
      ) : (
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg border-2 border-app-text bg-app-surface text-xs text-app-text-secondary">
          {fallbackLabel}
        </span>
      )}
      {canPreview ? (
        <button
          type="button"
          aria-label={actionLabel}
          aria-pressed={isPreviewPlaying}
          onClick={onTogglePreview}
          className="absolute inset-0 flex items-center justify-center rounded-lg bg-brand-dark/60 text-brand-white transition hover:bg-brand-dark/72"
        >
          <svg
            aria-hidden="true"
            className="absolute inset-0 h-full w-full -rotate-90"
            viewBox="0 0 44 44"
          >
            <circle
              cx="22"
              cy="22"
              r={PREVIEW_RING_RADIUS}
              fill="none"
              stroke="rgba(255,255,255,0.28)"
              strokeWidth="2"
            />
            <circle
              cx="22"
              cy="22"
              r={PREVIEW_RING_RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={PREVIEW_RING_CIRCUMFERENCE}
              strokeDashoffset={isPreviewActive ? ringOffset : PREVIEW_RING_CIRCUMFERENCE}
            />
          </svg>
          {isPreviewPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
        </button>
      ) : null}
    </div>
  );
};

export const SearchTrackRow = ({
  track,
  isAdded,
  isAdding,
  isPreviewActive,
  isPreviewPlaying,
  previewProgress,
  canPreview,
  onTogglePreview,
  onAdd,
}: SearchTrackRowProps) => {
  const { t } = useI18n();
  return (
    <li className="min-w-0">
      <div
        className={`group flex min-w-0 w-full max-w-full items-center gap-3 rounded-2xl border-2 bg-app-elevated px-3 py-3 transition duration-150 dark:bg-app-card ${
          isAdded
            ? 'border-app-border-strong opacity-60'
            : 'border-app-border-strong hover:border-app-text hover:shadow-sticker-sm motion-safe:hover:-translate-y-0.5'
        }`}
      >
        <TrackArtwork
          url={track.artworkUrl}
          fallbackLabel={t('eventPublicPage.notAvailable')}
          canPreview={canPreview}
          isPreviewActive={isPreviewActive}
          isPreviewPlaying={isPreviewPlaying}
          previewProgress={previewProgress}
          onTogglePreview={onTogglePreview}
        />
        <div className="min-w-0 flex-1 overflow-hidden text-left">
          <p className="max-w-full truncate text-sm font-bold text-brand-dark dark:text-brand-white">
            {track.name}
          </p>
          <p className="max-w-full truncate text-xs text-app-text-secondary">
            {track.artist} · {track.album}
          </p>
        </div>
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
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-app-text bg-app-surface text-app-text shadow-sticker-sm transition hover:bg-brand-lime hover:text-brand-dark disabled:border-app-border-strong disabled:bg-transparent disabled:shadow-none disabled:pointer-events-none dark:bg-app-elevated"
        >
          {isAdding ? (
            <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
          ) : isAdded ? (
            <Check
              size={18}
              strokeWidth={3}
              className="text-brand-dark dark:text-brand-white"
              aria-hidden="true"
            />
          ) : (
            <Plus
              size={18}
              aria-hidden="true"
              className="transition-transform duration-150 ease-out active:scale-95"
            />
          )}
        </button>
      </div>
    </li>
  );
};

type AddedTrackRowProps = { track: EventTrackItem };

export const AddedTrackRow = ({ track }: AddedTrackRowProps) => (
  <li className="flex min-w-0 max-w-full items-center gap-3 rounded-2xl border-2 border-app-border-strong bg-app-elevated px-3 py-3 dark:bg-app-card">
    {track.artworkUrl ? (
      <img
        src={track.artworkUrl}
        alt=""
        width={44}
        height={44}
        className="h-11 w-11 shrink-0 rounded-lg border-2 border-app-text object-cover"
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
        className="flex min-w-0 items-center gap-3 rounded-2xl border-2 border-app-border-strong bg-app-elevated px-3 py-3 dark:bg-app-card"
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
