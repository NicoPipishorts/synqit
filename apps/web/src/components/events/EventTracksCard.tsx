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
        <CTAButton disabled={isLoadingTracks} onClick={onRefreshTracks} variant="secondary">
          {isLoadingTracks ? t('eventsPage.loadingTracks') : t('eventsPage.refreshTracks')}
        </CTAButton>
      </div>

      {isLoadingTracks ? (
        <p className="text-sm text-app-text-secondary">{t('eventsPage.loadingTracks')}</p>
      ) : tracks.length > 0 ? (
        <ul className="grid gap-2">
          {tracks.map((track) => (
            <li
              key={track.providerTrackId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm dark:bg-app-elevated"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-brand-dark dark:text-brand-white">
                  {track.name}
                </p>
                <p className="truncate text-xs text-app-text-secondary">
                  {track.artist} · {track.album}
                </p>
              </div>
              <CTAButton
                disabled={trackActionKey === track.providerTrackId}
                onClick={() => onRemoveTrack(track.providerTrackId)}
                variant="dangerSoft"
              >
                {trackActionKey === track.providerTrackId
                  ? t('eventsPage.removing')
                  : t('eventsPage.remove')}
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
