import { Copy, Link2 } from 'lucide-react';

import { useI18n } from '../../hooks/useI18n';
import { getPublicEventPath } from '../../lib/events';

type EventMagicLinkRowProps = {
  magicLinkToken: string;
  magicLinkRevokedAt: string | null;
  onCopy: () => void;
  className?: string;
};

export const EventMagicLinkRow = ({
  magicLinkToken,
  magicLinkRevokedAt,
  onCopy,
  className,
}: EventMagicLinkRowProps) => {
  const { t } = useI18n();

  if (magicLinkRevokedAt) {
    return <span>{t('eventsPage.linkRevoked')}</span>;
  }

  return (
    <div
      className={`flex w-full items-center justify-between gap-4 sm:gap-5 ${className ?? ''}`.trim()}
    >
      <a
        href={getPublicEventPath(magicLinkToken)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 font-semibold text-brand-pink hover:text-[#d12074]"
      >
        <Link2 size={14} aria-hidden="true" />
        {t('eventsPage.magicLinkLabel')}
      </a>
      <button
        type="button"
        onClick={onCopy}
        aria-label={t('eventsPage.copyLinkAria')}
        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-app-border bg-app-surface text-app-text shadow-soft-lift transition hover:border-brand-lime dark:bg-app-elevated"
      >
        <Copy size={14} aria-hidden="true" />
      </button>
    </div>
  );
};
