import { ArrowUpRight, Music2, SquarePen } from 'lucide-react';

import { EventMagicLinkRow } from './EventMagicLinkRow';
import { EventStatusIndicator } from './EventStatusIndicator';
import { useI18n } from '../../hooks/useI18n';
import { toApiAssetUrl } from '../../lib/apiAssetUrl';
import { HostEvent } from '../../lib/events';
import { CTALink } from '../ui/cta';

type HostEventCardProps = {
  event: HostEvent;
};

export const HostEventCard = ({ event }: HostEventCardProps) => {
  const { t } = useI18n();
  const coverUrl = event.coverImageUrl ? toApiAssetUrl(event.coverImageUrl) : null;

  return (
    <div className="grid min-w-0 gap-3 rounded-2xl border border-app-border bg-app-surface p-4 shadow-soft-lift transition duration-150 hover:border-brand-lime/40 dark:bg-app-card">
      <div className="flex min-w-0 items-start gap-3">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-dashed border-app-border bg-app-bg dark:bg-app-elevated">
            <Music2 size={18} className="text-app-text-secondary/40" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center gap-2">
            <h2 className="min-w-0 truncate text-sm font-black text-brand-dark dark:text-brand-white">
              {event.name}
            </h2>
            <EventStatusIndicator
              status={event.status}
              closeReason={event.closeReason}
              connectionStatus={event.providerConnectionStatus}
              mode="dot"
            />
          </div>
          <p className="truncate text-xs text-app-text-secondary">
            {event.description || t('eventsPage.noDescription')}
          </p>
        </div>
        <CTALink
          to={`/playlists/${event.id}`}
          variant="ghost"
          className="group shrink-0 gap-1.5 rounded-xl px-2.5 py-1.5 text-xs hover:border-brand-pink hover:text-brand-pink"
        >
          <SquarePen size={12} aria-hidden="true" className="sm:hidden" />
          <span className="hidden sm:inline">{t('eventsPage.openEventPill')}</span>
          <ArrowUpRight
            size={12}
            aria-hidden="true"
            className="hidden sm:inline transition duration-150 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </CTALink>
      </div>

      <EventMagicLinkRow
        magicLinkToken={event.magicLinkToken}
        magicLinkRevokedAt={event.magicLinkRevokedAt}
        shareMode="modal"
      />
    </div>
  );
};
