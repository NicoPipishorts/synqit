import { EventMagicLinkRow } from './EventMagicLinkRow';
import { useI18n } from '../../hooks/useI18n';
import { HostEvent } from '../../lib/events';
import { AppSurfaceCard } from '../app/AppSurfaceCard';
import { CTAButton } from '../ui/cta';

type EventMagicLinkCardProps = {
  event: HostEvent;
  isWorking: boolean;
  formatDateTime: (value: string) => string;
  onCopy: () => void;
  onRevoke: () => void;
  onRegenerate: () => void;
};

export const EventMagicLinkCard = ({
  event,
  isWorking,
  formatDateTime,
  onCopy,
  onRevoke,
  onRegenerate,
}: EventMagicLinkCardProps) => {
  const { t } = useI18n();

  return (
    <AppSurfaceCard>
      <span className="text-xs sm:text-sm text-app-text-secondary pl-2 sm:pl-3">
        {t('eventsPage.lastUpdated')} {formatDateTime(event.updatedAt)}
      </span>
      <div className="grid gap-2 rounded-xl border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text-secondary dark:bg-app-elevated">
        <EventMagicLinkRow
          magicLinkToken={event.magicLinkToken}
          magicLinkRevokedAt={event.magicLinkRevokedAt}
          onCopy={onCopy}
          className="items-center"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <CTAButton
          disabled={isWorking || Boolean(event.magicLinkRevokedAt)}
          onClick={onRevoke}
          variant="secondary"
        >
          {isWorking ? t('eventsPage.working') : t('eventsPage.revokeLink')}
        </CTAButton>
        <CTAButton disabled={isWorking} onClick={onRegenerate} variant="secondary">
          {isWorking ? t('eventsPage.working') : t('eventsPage.regenerateLink')}
        </CTAButton>
      </div>
    </AppSurfaceCard>
  );
};
