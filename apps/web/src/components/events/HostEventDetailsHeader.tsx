import { EventProviderIcon } from './EventProviderIcon';
import { EventStatusIndicator } from './EventStatusIndicator';
import { useI18n } from '../../hooks/useI18n';
import { HostEvent } from '../../lib/events';
import { CircleChevronBackButton } from '../ui/CircleChevronBackButton';
import { CTAButton } from '../ui/cta';

type HostEventDetailsHeaderProps = {
  event: HostEvent | null;
  isWorking: boolean;
  onOpenCloseConfirm: () => void;
};

export const HostEventDetailsHeader = ({
  event,
  isWorking,
  onOpenCloseConfirm,
}: HostEventDetailsHeaderProps) => {
  const { t } = useI18n();

  return (
    <article>
      <div className="px-5 py-7 sm:px-8 sm:py-9">
        <div className="flex items-start gap-4">
          <CircleChevronBackButton to="/events" label={t('eventsPage.backToEvents')} />
          <div className="flex flex-1 items-start justify-between gap-3">
            <div className="grid flex-1 gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl">
                  {event?.name ?? t('eventsPage.loadingDetails')}
                </h1>
                {event ? <EventStatusIndicator status={event.status} mode="dot" /> : null}
              </div>
              {event ? (
                <div className="hidden sm:flex">
                  <CTAButton
                    disabled={isWorking || event.status !== 'open'}
                    onClick={onOpenCloseConfirm}
                    type="button"
                    variant="secondary"
                  >
                    {isWorking ? t('eventsPage.working') : t('eventsPage.closeEvent')}
                  </CTAButton>
                </div>
              ) : null}
            </div>
            {event ? (
              <div className="hidden sm:flex">
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
      {event ? (
        <div className="mt-3 flex items-center justify-between gap-3 px-4 sm:hidden dark:bg-app-elevated">
          <CTAButton
            disabled={isWorking || event.status !== 'open'}
            onClick={onOpenCloseConfirm}
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
