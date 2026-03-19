import { useI18n } from '../../hooks/useI18n';
import { EventCloseReason, EventStatus, ProviderConnectionStatus } from '../../lib/events';

type EventStatusIndicatorProps = {
  status: EventStatus;
  closeReason?: EventCloseReason | null;
  connectionStatus?: ProviderConnectionStatus;
  mode?: 'dot' | 'responsive' | 'pill';
  dotSize?: 'sm' | 'md';
};

export const EventStatusIndicator = ({
  status,
  closeReason = null,
  connectionStatus = 'connected',
  mode = 'responsive',
  dotSize = 'sm',
}: EventStatusIndicatorProps) => {
  const { t } = useI18n();
  const isClosed = status === 'closed';
  const isDeleted = isClosed && closeReason === 'provider_playlist_missing';
  const isDisconnected = !isClosed && connectionStatus === 'not_connected';
  const label = isDeleted
    ? t('eventsPage.statusDeleted')
    : isClosed
      ? t('eventsPage.statusClosed')
      : isDisconnected
        ? t('eventsPage.statusDisconnected')
        : t('eventsPage.statusOpen');
  const dotClass = isClosed ? 'bg-brand-pink' : isDisconnected ? 'bg-amber-400' : 'bg-brand-lime';
  const dotSizeClass = dotSize === 'md' ? 'h-3 w-3' : 'h-2.5 w-2.5';

  if (mode === 'dot') {
    return (
      <span
        className={`inline-flex shrink-0 rounded-full ${dotSizeClass} ${dotClass}`}
        aria-label={label}
        title={label}
      />
    );
  }

  if (mode === 'pill') {
    return (
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
          isClosed
            ? 'border border-brand-pink/40 bg-brand-pink/15 text-[#b41563] dark:text-[#ff8ac0]'
            : isDisconnected
              ? 'border border-amber-400/45 bg-amber-400/15 text-amber-700 dark:text-amber-300'
              : 'border border-brand-lime/40 bg-brand-lime/15 text-[#6d9600] dark:text-[#d5ff5c]'
        }`}
      >
        {label}
      </span>
    );
  }

  return (
    <>
      <span
        className={`inline-flex shrink-0 rounded-full sm:hidden ${dotSizeClass} ${dotClass}`}
        aria-label={label}
        title={label}
      />
      <span
        className={`hidden rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide sm:inline-flex ${
          isClosed
            ? 'border border-brand-pink/40 bg-brand-pink/15 text-[#b41563] dark:text-[#ff8ac0]'
            : isDisconnected
              ? 'border border-amber-400/45 bg-amber-400/15 text-amber-700 dark:text-amber-300'
              : 'border border-brand-lime/40 bg-brand-lime/15 text-[#6d9600] dark:text-[#d5ff5c]'
        }`}
      >
        {label}
      </span>
    </>
  );
};
