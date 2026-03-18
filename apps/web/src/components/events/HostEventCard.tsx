import { useNavigate } from '@tanstack/react-router';
import { type KeyboardEvent, type MouseEvent } from 'react';

import { EventMagicLinkRow } from './EventMagicLinkRow';
import { EventProviderIcon } from './EventProviderIcon';
import { EventStatusIndicator } from './EventStatusIndicator';
import { useI18n } from '../../hooks/useI18n';
import { HostEvent } from '../../lib/events';
import { AppSurfaceCard } from '../app/AppSurfaceCard';

type HostEventCardProps = {
  event: HostEvent;
};

export const HostEventCard = ({ event }: HostEventCardProps) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const eventDetailsPath = `/playlists/${event.id}`;

  const isNestedInteractiveTarget = (
    target: EventTarget | null,
    currentTarget: EventTarget | null,
  ) => {
    if (!(target instanceof Element) || !(currentTarget instanceof Element)) {
      return false;
    }

    const interactiveAncestor = target.closest(
      'a, button, input, select, textarea, summary, [role="button"], [role="link"]',
    );

    return interactiveAncestor !== null && interactiveAncestor !== currentTarget;
  };

  const openEventDetails = () => {
    void navigate({ to: eventDetailsPath });
  };

  const handleCardClick = (cardEvent: MouseEvent<HTMLElement>) => {
    if (isNestedInteractiveTarget(cardEvent.target, cardEvent.currentTarget)) {
      return;
    }
    openEventDetails();
  };

  const handleCardKeyDown = (cardEvent: KeyboardEvent<HTMLElement>) => {
    if (
      cardEvent.key !== 'Enter' ||
      isNestedInteractiveTarget(cardEvent.target, cardEvent.currentTarget)
    ) {
      return;
    }
    cardEvent.preventDefault();
    openEventDetails();
  };

  return (
    <AppSurfaceCard
      as="div"
      role="link"
      tabIndex={0}
      aria-label={t('eventsPage.openEventDetails')}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      className="cursor-pointer transition duration-150 hover:border-brand-lime motion-safe:hover:-translate-y-0.5 focus-ring-brand"
    >
      <div className="grid gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="grid min-w-0 flex-1 gap-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-xl font-bold text-brand-dark dark:text-brand-white">
                {event.name}
              </h2>
              <EventStatusIndicator
                status={event.status}
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

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-app-border bg-app-bg px-3 py-2 text-xs text-app-text-secondary dark:bg-app-elevated">
          <EventMagicLinkRow
            magicLinkToken={event.magicLinkToken}
            magicLinkRevokedAt={event.magicLinkRevokedAt}
          />
        </div>
      </div>
    </AppSurfaceCard>
  );
};
