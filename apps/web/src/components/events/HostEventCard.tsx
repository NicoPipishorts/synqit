import { Link } from '@tanstack/react-router';

import { EventMagicLinkRow } from './EventMagicLinkRow';
import { EventProviderIcon } from './EventProviderIcon';
import { EventStatusIndicator } from './EventStatusIndicator';
import { useI18n } from '../../hooks/useI18n';
import { HostEvent } from '../../lib/events';

type HostEventCardProps = {
  event: HostEvent;
  onCopyMagicLink: (magicLinkToken: string) => void;
};

export const HostEventCard = ({ event, onCopyMagicLink }: HostEventCardProps) => {
  const { t } = useI18n();

  return (
    <article className="rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card">
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
            onCopy={() => void onCopyMagicLink(event.magicLinkToken)}
          />
        </div>

        <div className="flex justify-end">
          <Link
            to="/events/$eventId"
            params={{ eventId: event.id }}
            className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-app-border bg-app-surface px-3 py-2 text-xs font-extrabold leading-none text-app-text no-underline shadow-soft-lift transition focus-ring-brand hover:border-brand-lime disabled:cursor-not-allowed disabled:opacity-60 dark:border-app-border dark:bg-app-elevated dark:text-app-text"
          >
            {t('eventsPage.detailsCta')}
          </Link>
        </div>
      </div>
    </article>
  );
};
