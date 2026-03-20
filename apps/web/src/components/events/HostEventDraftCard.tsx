import { Trash2 } from 'lucide-react';

import { useI18n } from '../../hooks/useI18n';
import { HostEventDraft } from '../../lib/events';
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
    <div className="grid gap-3 rounded-2xl border border-brand-pink/30 bg-app-surface p-4 shadow-soft-lift dark:bg-app-card">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 shrink-0 rounded-xl border border-dashed border-brand-pink/40 bg-brand-pink/5 dark:bg-brand-pink/10" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-black text-brand-dark dark:text-brand-white">
              {hasName ? draft.name : t('eventsPage.draftUntitled')}
            </h2>
            <span className="inline-flex h-5 items-center rounded-full border border-brand-pink/50 bg-brand-pink/10 px-2 text-[10px] font-black uppercase tracking-wide text-brand-pink">
              {t('eventsPage.draftBadge')}
            </span>
          </div>
          <p className="truncate text-xs text-app-text-secondary">
            {hasDescription ? draft.description : t('eventsPage.noDescription')}
          </p>
        </div>
      </div>

      <p className="rounded-xl border border-app-border bg-app-bg px-3 py-2 text-xs text-app-text-secondary dark:bg-app-elevated">
        {t('eventsPage.draftStepLabel', { step: draft.step })}
      </p>

      <div className="flex justify-end gap-2">
        <CTAButton
          type="button"
          variant="dangerSoft"
          onClick={() => onDelete(draft)}
          disabled={isDeleting}
          aria-label={t('eventsPage.deleteDraft')}
        >
          <CTAMobileIconLabel icon={<Trash2 size={14} />} label={t('eventsPage.deleteDraft')} />
        </CTAButton>
        <CTALink
          to={`/playlists/new?draftId=${encodeURIComponent(draft.id)}`}
          variant="secondary"
          disabled={isDeleting}
        >
          {t('eventsPage.continueDraft')}
        </CTALink>
      </div>
    </div>
  );
};
