import type { SyncItem } from '@synqit/shared';
import { Link2, RefreshCcw, ShieldBan } from 'lucide-react';

import { SyncMagicLinkRow } from './SyncMagicLinkRow';
import { useI18n } from '../../hooks/useI18n';
import { AppSurfaceCard } from '../app/AppSurfaceCard';
import { CTAButton } from '../ui/cta';

type SyncMagicLinkCardProps = {
  sync: SyncItem;
  isWorking: boolean;
  onRevoke: () => void;
  onRegenerate: () => void;
};

export const SyncMagicLinkCard = ({
  sync,
  isWorking,
  onRevoke,
  onRegenerate,
}: SyncMagicLinkCardProps) => {
  const { t } = useI18n();
  const isRevoked = Boolean(sync.magicLinkRevokedAt);

  return (
    <AppSurfaceCard className="relative overflow-hidden">
      <div className="pointer-events-none absolute right-7 top-3 opacity-5 ">
        <Link2 className="h-16 w-16 text-brand-pink sm:h-20 sm:w-20" aria-hidden="true" />
      </div>

      <div className="grid gap-4">
        <div className="grid rounded-2xl border border-app-border bg-linear-to-br from-brand-pink/10 via-app-bg to-brand-lime/10 p-4 dark:from-brand-pink/12 dark:via-app-card dark:to-brand-lime/8">
          <div className="grid gap-3">
            <h2 className="text-xl font-black tracking-tight text-brand-dark dark:text-brand-white">
              {t('syncedListsPage.shareCardTitle')}
            </h2>
            <p className="text-sm text-app-text-secondary md:truncate md:whitespace-nowrap">
              {t('syncedListsPage.shareCardBody')}
            </p>
          </div>
        </div>

        <SyncMagicLinkRow
          magicLinkToken={sync.magicLinkToken}
          magicLinkRevokedAt={sync.magicLinkRevokedAt}
          className="items-center"
          shareMode="inline"
        />

        <div className="grid gap-2 sm:grid-cols-2">
          <CTAButton
            disabled={isWorking || isRevoked}
            onClick={onRevoke}
            variant="dangerSoft"
            className="justify-center"
          >
            <ShieldBan size={14} aria-hidden="true" />
            {isWorking ? t('eventsPage.working') : t('eventsPage.revokeLink')}
          </CTAButton>
          <CTAButton
            disabled={isWorking}
            onClick={onRegenerate}
            variant="secondary"
            className="justify-center"
          >
            <RefreshCcw size={14} aria-hidden="true" className={isWorking ? 'animate-spin' : ''} />
            {isWorking ? t('eventsPage.working') : t('eventsPage.regenerateLink')}
          </CTAButton>
        </div>
      </div>
    </AppSurfaceCard>
  );
};
