import { EventProviderIcon } from './EventProviderIcon';
import { EventStatusIndicator } from './EventStatusIndicator';
import { useI18n } from '../../hooks/useI18n';
import { EventProvider, EventStatus, ProviderConnectionStatus } from '../../lib/events';
import { CircleChevronBackButton } from '../ui/CircleChevronBackButton';
import { CTAButton } from '../ui/cta';

type EventHeaderData = {
  name: string;
  status: EventStatus;
  providerConnectionStatus: ProviderConnectionStatus;
  provider: EventProvider;
  description?: string;
};

type HostEventDetailsHeaderProps = {
  event: EventHeaderData | null;
  isWorking?: boolean;
  onOpenCloseConfirm?: () => void;
  showCloseAction?: boolean;
  showBackButton?: boolean;
  backTo?: string;
  backLabel?: string;
  statusMessage?: string;
};

export const HostEventDetailsHeader = ({
  event,
  isWorking = false,
  onOpenCloseConfirm,
  showCloseAction = true,
  showBackButton = true,
  backTo = '/playlists',
  backLabel,
  statusMessage,
}: HostEventDetailsHeaderProps) => {
  const { t } = useI18n();
  const resolvedBackLabel = backLabel ?? t('eventsPage.backToEvents');
  const canShowCloseAction = Boolean(showCloseAction && event && onOpenCloseConfirm);
  const desktopProviderClassName = canShowCloseAction ? 'hidden sm:flex' : 'flex';

  return (
    <article>
      <div className="px-5 py-7 sm:px-8 sm:py-9">
        <div className="flex items-start gap-4">
          {showBackButton ? (
            <CircleChevronBackButton to={backTo} label={resolvedBackLabel} />
          ) : null}
          <div className="flex flex-1 items-start justify-between gap-3">
            <div className="grid flex-1 gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl">
                  {event?.name ?? t('eventsPage.loadingDetails')}
                </h1>
                {event ? (
                  <EventStatusIndicator
                    status={event.status}
                    connectionStatus={event.providerConnectionStatus}
                    mode="responsive"
                    dotSize="md"
                  />
                ) : null}
              </div>
              {event?.description ? (
                <p className="text-sm text-app-text-secondary sm:text-base">{event.description}</p>
              ) : null}
              {statusMessage ? (
                <p className="text-sm font-semibold text-brand-pink">{statusMessage}</p>
              ) : null}
              {event && canShowCloseAction ? (
                <div className="hidden sm:flex">
                  <CTAButton
                    disabled={isWorking || event.status !== 'open'}
                    onClick={() => onOpenCloseConfirm?.()}
                    type="button"
                    variant="secondary"
                  >
                    {isWorking ? t('eventsPage.working') : t('eventsPage.closeEvent')}
                  </CTAButton>
                </div>
              ) : null}
            </div>
            {event ? (
              <div className={desktopProviderClassName}>
                <EventProviderIcon
                  provider={event.provider}
                  sizeClassName="h-14 w-14 sm:h-16 sm:w-16 lg:h-[4.5rem] lg:w-[4.5rem]"
                  className="dark:shadow-glow-pink"
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {event && canShowCloseAction ? (
        <div className="mt-3 flex items-center justify-between gap-3 px-4 sm:hidden dark:bg-app-elevated">
          <CTAButton
            disabled={isWorking || event.status !== 'open'}
            onClick={() => onOpenCloseConfirm?.()}
            type="button"
            variant="secondary"
          >
            {isWorking ? t('eventsPage.working') : t('eventsPage.closeEvent')}
          </CTAButton>
          <EventProviderIcon
            provider={event.provider}
            sizeClassName="h-14 w-14"
            className="dark:shadow-glow-pink"
          />
        </div>
      ) : null}
    </article>
  );
};
