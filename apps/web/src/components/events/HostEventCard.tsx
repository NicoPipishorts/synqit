import { IconButton, TapeStrip } from '@synqit/ui';
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
    <div className="relative grid min-w-0 gap-4 rounded-3xl border-2 border-app-text bg-app-elevated p-4 shadow-sticker transition duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[6px_6px_0_0_var(--syn-text)] dark:bg-app-card">
      <TapeStrip tone="lime" />
      <div className="flex min-w-0 items-start gap-3">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            className="h-12 w-12 shrink-0 rounded-xl border-2 border-app-text object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-app-text bg-brand-lime text-brand-dark"
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
        <p className="rounded-xl border border-dashed border-app-text/40 px-3 py-2 text-xs text-app-text-muted">
          {t('eventsPage.linkRevoked')}
        </p>
      ) : null}
    </div>
  );
};
