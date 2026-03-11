import { Trash2 } from 'lucide-react';

import { EventProviderIcon } from './EventProviderIcon';
import { useI18n } from '../../hooks/useI18n';
import { HostEventDraft } from '../../lib/events';
import { AppSurfaceCard } from '../app/AppSurfaceCard';
import { CTAButton, CTALink, CTAMobileIconLabel } from '../ui/cta';

type HostEventDraftCardProps = {
  draft: HostEventDraft;
  onDelete: (draft: HostEventDraft) => void;
  isDeleting: boolean;
};

export const HostEventDraftCard = ({ draft, onDelete, isDeleting }: HostEventDraftCardProps) => {
  const { t } = useI18n();
  const hasName = draft.name.trim().length > 0;
  const hasDescription = draft.description.trim().length > 0;

  return (
    <AppSurfaceCard>
      <div className="grid gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="grid min-w-0 flex-1 gap-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-xl font-bold text-brand-dark dark:text-brand-white">
                {hasName ? draft.name : t('eventsPage.draftUntitled')}
              </h2>
              <span className="inline-flex h-6 items-center rounded-full border border-brand-pink/60 bg-brand-pink/10 px-2 text-[11px] font-black uppercase tracking-wide text-brand-pink">
                {t('eventsPage.draftBadge')}
              </span>
            </div>
            <p className="h-5 truncate text-sm text-app-text-secondary">
              {hasDescription ? draft.description : t('eventsPage.noDescription')}
            </p>
          </div>
          <div className="flex shrink-0 items-start">
            {draft.provider ? (
              <EventProviderIcon provider={draft.provider} sizeClassName="h-9 w-9" />
            ) : (
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-app-border bg-app-elevated text-xs font-black text-app-text-secondary dark:bg-app-card">
                ?
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-app-border bg-app-bg px-3 py-2 text-xs text-app-text-secondary dark:bg-app-elevated">
          {t('eventsPage.draftStepLabel', { step: draft.step })}
        </div>

        <div className="flex justify-end gap-2">
          <CTAButton
            type="button"
            variant="dangerSoft"
            onClick={() => onDelete(draft)}
            disabled={isDeleting}
            className="cursor-pointer"
            aria-label={t('eventsPage.deleteDraft')}
          >
            <CTAMobileIconLabel icon={<Trash2 size={14} />} label={t('eventsPage.deleteDraft')} />
          </CTAButton>
          <CTALink
            to={`/playlists/new?draftId=${encodeURIComponent(draft.id)}`}
            variant="secondary"
            className="cursor-pointer"
            disabled={isDeleting}
          >
            {t('eventsPage.continueDraft')}
          </CTALink>
        </div>
      </div>
    </AppSurfaceCard>
  );
};
