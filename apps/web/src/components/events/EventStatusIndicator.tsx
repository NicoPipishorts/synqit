import { useI18n } from '../../hooks/useI18n';
import { EventStatus } from '../../lib/events';

type EventStatusIndicatorProps = {
  status: EventStatus;
  mode?: 'dot' | 'responsive' | 'pill';
  dotSize?: 'sm' | 'md';
};

export const EventStatusIndicator = ({
  status,
  mode = 'responsive',
  dotSize = 'sm',
}: EventStatusIndicatorProps) => {
  const { t } = useI18n();
  const isOpen = status === 'open';
  const label = isOpen ? t('eventsPage.statusOpen') : t('eventsPage.statusClosed');
  const dotClass = isOpen ? 'bg-brand-lime' : 'bg-brand-pink';
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
          isOpen
            ? 'border border-brand-lime/40 bg-brand-lime/15 text-[#6d9600] dark:text-[#d5ff5c]'
            : 'border border-brand-pink/40 bg-brand-pink/15 text-[#b41563] dark:text-[#ff8ac0]'
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
          isOpen
            ? 'border border-brand-lime/40 bg-brand-lime/15 text-[#6d9600] dark:text-[#d5ff5c]'
            : 'border border-brand-pink/40 bg-brand-pink/15 text-[#b41563] dark:text-[#ff8ac0]'
        }`}
      >
        {label}
      </span>
    </>
  );
};
