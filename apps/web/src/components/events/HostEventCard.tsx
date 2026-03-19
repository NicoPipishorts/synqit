import { EventMagicLinkRow } from './EventMagicLinkRow';
import { EventProviderIcon } from './EventProviderIcon';
import { EventStatusIndicator } from './EventStatusIndicator';
import { useI18n } from '../../hooks/useI18n';
import { HostEvent } from '../../lib/events';
import { AppSurfaceCard } from '../app/AppSurfaceCard';
import { CTALink } from '../ui/cta';

type HostEventCardProps = {
  event: HostEvent;
};

export const HostEventCard = ({ event }: HostEventCardProps) => {
  const { t } = useI18n();

  return (
    <AppSurfaceCard>
      <div className="grid gap-5">
        <div className="flex items-start justify-between gap-2">
          <div className="grid min-w-0 flex-1 gap-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-xl font-bold text-brand-dark dark:text-brand-white">
                {event.name}
              </h2>
              <EventStatusIndicator
                status={event.status}
                closeReason={event.closeReason}
                connectionStatus={event.providerConnectionStatus}
                mode="responsive"
              />
            </div>
            <p className="h-5 truncate text-sm text-app-text-secondary">
              {event.description || t('eventsPage.noDescription')}
            </p>
          </div>
          <div className="flex shrink-0 items-start">
            <EventProviderIcon provider={event.provider} sizeClassName="h-9 w-9" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-app-text-secondary dark:bg-app-elevated">
          <EventMagicLinkRow
            magicLinkToken={event.magicLinkToken}
            magicLinkRevokedAt={event.magicLinkRevokedAt}
          />
        </div>

        <div className="flex justify-end sm:mt-4">
          <CTALink
            to={`/playlists/${event.id}`}
            variant="ghost"
            className=" hover:border-brand-pink hover:text-brand-pink"
          >
            {t('eventsPage.openEventPill')}
          </CTALink>
        </div>
      </div>
    </AppSurfaceCard>
  );
};
