import { RefreshCcw } from 'lucide-react';

import { useI18n } from '../../hooks/useI18n';
import { EventTrackItem } from '../../lib/events';
import { AppSurfaceCard } from '../app/AppSurfaceCard';
import { CTAButton, CTAMobileIconLabel } from '../ui/cta';

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
    <AppSurfaceCard>
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
          <CTAMobileIconLabel
            icon={
              <RefreshCcw
                size={14}
                className={isLoadingTracks ? 'animate-spin' : ''}
                aria-hidden="true"
              />
            }
            label={isLoadingTracks ? t('eventsPage.loadingTracks') : t('eventsPage.refreshTracks')}
          />
        </CTAButton>
      </div>

      {isLoadingTracks ? (
        <p className="text-sm text-app-text-secondary">{t('eventsPage.loadingTracks')}</p>
      ) : tracks.length > 0 ? (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {tracks.map((track) => (
            <li
              key={track.providerTrackId}
              className="flex min-w-0 items-center gap-3 rounded-xl border border-app-border bg-app-bg px-3 py-2 text-sm shadow-soft-lift dark:bg-app-elevated"
            >
              {track.artworkUrl ? (
                <img
                  src={track.artworkUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 shrink-0 rounded-md object-cover"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-brand-dark dark:text-brand-white">
                  {track.name}
                </p>
                <p className="truncate text-xs text-app-text-secondary">
                  {track.artist} · {track.album}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-app-text-secondary">{t('eventsPage.noTracks')}</p>
      )}
    </AppSurfaceCard>
  );
};
