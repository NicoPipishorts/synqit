import { IconButton } from '@synqit/ui';
import { ExternalLink, Music2, Settings2 } from 'lucide-react';

import { EventMagicLinkRow } from './EventMagicLinkRow';
import { EventStatusIndicator } from './EventStatusIndicator';
import { useI18n } from '../../hooks/useI18n';
import { toApiAssetUrl } from '../../lib/apiAssetUrl';
import { getPublicEventPath, HostEvent } from '../../lib/events';
import { CTALink } from '../ui/cta';

type HostEventCardProps = {
  event: HostEvent;
};

export const HostEventCard = ({ event }: HostEventCardProps) => {
  const { t } = useI18n();
  const coverUrl = event.coverImageUrl ? toApiAssetUrl(event.coverImageUrl) : null;
  const isRevoked = event.magicLinkRevokedAt !== null;

  return (
    <div className="grid min-w-0 gap-4 overflow-hidden rounded-2xl border border-app-border bg-app-bg p-4 shadow-soft-lift transition duration-150 hover:border-brand-lime/40 dark:bg-app-card">
      <div className="flex min-w-0 items-start gap-3">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-lime/15 text-[#6d9600] dark:text-[#d5ff5c]"
          >
            <Music2 size={18} />
          </span>
        )}
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="min-w-0 truncate text-sm font-black text-brand-dark dark:text-brand-white">
              {event.name}
            </h2>
            <EventStatusIndicator
              status={event.status}
              closeReason={event.closeReason}
              connectionStatus={event.providerConnectionStatus}
              mode="pill"
            />
          </div>
          <p className="truncate text-xs text-app-text-secondary">
            {event.description || t('eventsPage.noDescription')}
          </p>
        </div>
      </div>

      <div className="flex w-full items-center gap-2">
        <CTALink
          to={`/playlists/${event.id}`}
          variant="secondary"
          className="flex-1 justify-center gap-1.5 px-4 py-2.5 text-sm"
        >
          <Settings2 size={14} aria-hidden="true" />
          {t('eventsPage.openEventPill')}
        </CTALink>
        {!isRevoked ? (
          <>
            <IconButton
              onClick={() =>
                window.open(getPublicEventPath(event.magicLinkToken), '_blank', 'noopener')
              }
              aria-label={t('eventsPage.magicLinkOpenHint')}
              size="sm"
              className="hover:border-brand-pink hover:text-brand-pink"
              icon={<ExternalLink size={14} aria-hidden="true" />}
            />
            <EventMagicLinkRow
              magicLinkToken={event.magicLinkToken}
              magicLinkRevokedAt={event.magicLinkRevokedAt}
              shareMode="compact"
            />
          </>
        ) : null}
      </div>

      {isRevoked ? (
        <p className="rounded-lg border border-app-border px-3 py-2 text-xs text-app-text-muted">
          {t('eventsPage.linkRevoked')}
        </p>
      ) : null}
    </div>
  );
};
