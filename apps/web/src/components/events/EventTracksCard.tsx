import { LoaderCircle, RefreshCcw, Trash2 } from 'lucide-react';

import { useI18n } from '../../hooks/useI18n';
import { EventTrackItem } from '../../lib/events';
import { CTAButton } from '../ui/cta';

type EventTracksCardProps = {
  tracks: EventTrackItem[];
  isLoadingTracks: boolean;
  trackActionKey: string | null;
  onRefreshTracks: () => void;
  onRemoveTrack: (providerTrackId: string) => void;
};

export const EventTracksCard = ({
  tracks,
  isLoadingTracks,
  trackActionKey,
  onRefreshTracks,
  onRemoveTrack,
}: EventTracksCardProps) => {
  const { t } = useI18n();

  return (
    <article className="rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-brand-dark dark:text-brand-white">
          {t('eventsPage.tracksTitle')}
        </h2>
        <CTAButton
          aria-label={t('eventsPage.refreshTracks')}
          className="h-9 w-9 px-0 sm:h-auto sm:w-auto sm:px-3"
          disabled={isLoadingTracks}
          onClick={onRefreshTracks}
          variant="secondary"
        >
          <RefreshCcw
            size={14}
            className={`${isLoadingTracks ? 'animate-spin' : ''} sm:hidden`}
            aria-hidden="true"
          />
          <span className="hidden sm:inline">
            {isLoadingTracks ? t('eventsPage.loadingTracks') : t('eventsPage.refreshTracks')}
          </span>
        </CTAButton>
      </div>

      {isLoadingTracks ? (
        <p className="text-sm text-app-text-secondary">{t('eventsPage.loadingTracks')}</p>
      ) : tracks.length > 0 ? (
        <ul className="grid min-w-0 gap-2">
          {tracks.map((track) => (
            <li
              key={track.providerTrackId}
              className="flex min-w-0 items-center justify-between gap-3 overflow-hidden rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm dark:bg-app-elevated"
            >
              <div className="w-0 min-w-0 flex-1 overflow-hidden">
                <p className="block max-w-full truncate font-semibold text-brand-dark dark:text-brand-white">
                  {track.name}
                </p>
                <p className="block max-w-full truncate text-xs text-app-text-secondary">
                  {track.artist} · {track.album}
                </p>
              </div>
              <CTAButton
                aria-label={t('eventsPage.remove')}
                disabled={trackActionKey === track.providerTrackId}
                onClick={() => onRemoveTrack(track.providerTrackId)}
                variant="dangerSoft"
                className="h-9 w-9 shrink-0 px-0 sm:h-auto sm:w-auto sm:px-3"
              >
                {trackActionKey === track.providerTrackId ? (
                  <>
                    <LoaderCircle size={14} className="animate-spin sm:hidden" aria-hidden="true" />
                    <span className="hidden sm:inline">{t('eventsPage.removing')}</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} className="sm:hidden" aria-hidden="true" />
                    <span className="hidden sm:inline">{t('eventsPage.remove')}</span>
                  </>
                )}
              </CTAButton>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-app-text-secondary">{t('eventsPage.noTracks')}</p>
      )}
    </article>
  );
};
