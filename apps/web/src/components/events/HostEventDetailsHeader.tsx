import { useI18n } from '../../hooks/useI18n';
import { EventProvider, EventStatus, ProviderConnectionStatus } from '../../lib/events';
import { CircleChevronBackButton } from '../ui/CircleChevronBackButton';

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
  onReopen?: () => void;
  showCloseAction?: boolean;
  showBackButton?: boolean;
  backTo?: string;
  backLabel?: string;
  statusMessage?: string;
};

export const HostEventDetailsHeader = ({
  showBackButton = true,
  backTo = '/playlists',
  backLabel,
}: HostEventDetailsHeaderProps) => {
  const { t } = useI18n();
  const resolvedBackLabel = backLabel ?? t('eventsPage.backToEvents');

  if (!showBackButton) return null;

  return (
    <div className="absolute left-4 top-4">
      <CircleChevronBackButton to={backTo} label={resolvedBackLabel} />
    </div>
  );
};
