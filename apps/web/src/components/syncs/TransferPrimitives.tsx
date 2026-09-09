import type { ProviderPlaylistTrack } from '@synqit/shared';
import { motion } from 'framer-motion';
import { Check, ChevronRight, LoaderCircle, Music2, X } from 'lucide-react';

import { CONNECTABLE_PROVIDERS, PROVIDER_LABELS } from '../../lib/providers';
import type { Provider } from '../../lib/types';
import { ProviderIcon } from '../providers/ProviderIcon';
import { CTAButton } from '../ui/cta';

// Building blocks shared by the provider-to-provider transfer flow and the
// link-based import flow: provider picker card, track rows, and the animated
// progress viewport.

export const TRANSFER_ROW_HEIGHT = 76;
export const TRANSFER_VISIBLE_ROWS = 5;

export type ProviderCardProps = {
  title: string;
  selectedProvider: Provider;
  providerStatusByType: Record<Provider, 'connected' | 'not_connected'>;
  isBusy: boolean;
  connectLabel: string;
  connectedLabel: string;
  notConnectedLabel: string;
  onSelect: (provider: Provider) => void;
  onConnect: (provider: Provider) => void;
};

export const formatDuration = (durationMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const ProviderCard = ({
  title,
  selectedProvider,
  providerStatusByType,
  isBusy,
  connectLabel,
  connectedLabel,
  notConnectedLabel,
  onSelect,
  onConnect,
}: ProviderCardProps) => (
  <article className="rounded-[1.9rem] border border-app-border bg-white/80 p-5 shadow-soft-lift dark:bg-app-elevated/80">
    <div className="flex items-start justify-between gap-4">
      <div className="grid gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-app-text-secondary">
          {title}
        </p>
        <p className="text-2xl font-black text-brand-dark dark:text-brand-white">
          {PROVIDER_LABELS[selectedProvider]}
        </p>
        <p className="text-sm text-app-text-secondary">
          {providerStatusByType[selectedProvider] === 'connected'
            ? connectedLabel
            : notConnectedLabel}
        </p>
      </div>
      <ProviderIcon provider={selectedProvider} sizeClassName="h-14 w-14 sm:h-16 sm:w-16" />
    </div>

    <div className="mt-5 grid gap-2">
      {CONNECTABLE_PROVIDERS.map((provider) => {
        const isSelected = selectedProvider === provider;
        const isConnected = providerStatusByType[provider] === 'connected';
        return (
          <div key={provider} className="flex gap-2">
            <CTAButton
              variant={isSelected ? 'primary' : 'secondary'}
              className="flex-1 justify-center rounded-xl"
              onClick={() => onSelect(provider)}
              disabled={isBusy}
            >
              {isSelected ? <Check size={14} aria-hidden="true" /> : null}
              {PROVIDER_LABELS[provider]}
            </CTAButton>
            {!isConnected ? (
              <CTAButton
                variant="ghost"
                className="rounded-xl"
                onClick={() => onConnect(provider)}
                disabled={isBusy}
              >
                {isBusy ? (
                  <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
                ) : null}
                {connectLabel}
              </CTAButton>
            ) : null}
          </div>
        );
      })}
    </div>
  </article>
);

export const PlaylistTrackRow = ({
  track,
  state = 'pending',
  compact = false,
}: {
  track: ProviderPlaylistTrack;
  state?: 'completed' | 'active' | 'pending' | 'skipped';
  compact?: boolean;
}) => (
  <div
    className={`flex min-w-0 items-center gap-3 rounded-2xl border px-3 py-3 transition ${
      state === 'completed'
        ? 'border-brand-lime/50 bg-brand-lime/10'
        : state === 'active'
          ? 'border-brand-pink/40 bg-brand-pink/8'
          : state === 'skipped'
            ? 'border-brand-pink/30 bg-brand-pink/5'
            : 'border-app-border bg-white/70 dark:bg-app-elevated/70'
    } ${compact ? '' : 'min-h-[4.5rem]'}`}
  >
    {track.artworkUrl ? (
      <img src={track.artworkUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
    ) : (
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-app-border text-app-text-secondary">
        <Music2 size={16} aria-hidden="true" />
      </span>
    )}
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-bold text-brand-dark dark:text-brand-white">
        {track.name}
      </p>
      <p className="truncate text-xs text-app-text-secondary">
        {track.artist} · {track.album}
      </p>
    </div>
    <div className="flex items-center gap-2">
      <span className="hidden text-xs text-app-text-secondary sm:inline">
        {formatDuration(track.durationMs)}
      </span>
      <span
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
          state === 'completed'
            ? 'border-brand-lime bg-brand-lime text-brand-dark'
            : state === 'active'
              ? 'border-brand-pink/50 bg-brand-pink/10 text-brand-pink'
              : state === 'skipped'
                ? 'border-brand-pink/30 bg-brand-pink/8 text-brand-pink'
                : 'border-app-border text-app-text-secondary'
        }`}
      >
        {state === 'completed' ? (
          <Check size={14} strokeWidth={3} aria-hidden="true" />
        ) : state === 'active' ? (
          <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
        ) : state === 'skipped' ? (
          <X size={14} strokeWidth={3} aria-hidden="true" />
        ) : (
          <ChevronRight size={14} aria-hidden="true" />
        )}
      </span>
    </div>
  </div>
);

export const TransferViewport = ({
  tracks,
  progressCount,
  matchedCount,
  transferComplete,
  isRunning = true,
}: {
  tracks: ProviderPlaylistTrack[];
  progressCount: number;
  matchedCount: number;
  transferComplete: boolean;
  /**
   * False while the list is only being previewed. Without it the first row
   * spins on a progress count of zero, and the step meant to ask "shall I
   * start?" looks like it already did.
   */
  isRunning?: boolean;
}) => {
  const viewportHeight = TRANSFER_ROW_HEIGHT * TRANSFER_VISIBLE_ROWS;
  const maxOffset = Math.max(0, tracks.length - TRANSFER_VISIBLE_ROWS) * TRANSFER_ROW_HEIGHT;
  const y = Math.min(Math.max(progressCount - 2, 0) * TRANSFER_ROW_HEIGHT, maxOffset);

  if (transferComplete) {
    return (
      <div className="max-h-[min(70svh,38rem)] min-w-0 overflow-y-auto scrollbar-none sm:rounded-[1.75rem] sm:border sm:border-app-border sm:bg-app-surface/70 sm:p-3">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
          {tracks.map((track, index) => (
            <PlaylistTrackRow
              key={`${track.providerTrackId}-${index}`}
              track={track}
              state={index < matchedCount ? 'completed' : 'skipped'}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 sm:rounded-[1.75rem] sm:border sm:border-app-border sm:bg-app-surface/70 sm:p-3">
      <div className="min-w-0 overflow-hidden" style={{ height: viewportHeight }}>
        <motion.div
          animate={{ y: -y }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2"
        >
          {tracks.map((track, index) => (
            <div
              key={`${track.providerTrackId}-${index}`}
              className="min-w-0"
              style={{ height: TRANSFER_ROW_HEIGHT }}
            >
              <PlaylistTrackRow
                track={track}
                state={
                  !isRunning
                    ? 'pending'
                    : index < progressCount
                      ? 'completed'
                      : index === progressCount
                        ? 'active'
                        : 'pending'
                }
              />
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};
