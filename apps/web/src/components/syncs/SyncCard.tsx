import type { SyncItem } from '@synqit/shared';
import {
  ArrowUpRight,
  Copy,
  Link2,
  ListMusic,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Share2,
} from 'lucide-react';
import { useState } from 'react';

import { useI18n } from '../../hooks/useI18n';
import { useToast } from '../../hooks/useToast';
import { CTAButton, CTALink } from '../ui/cta';
import { IconButton } from '../ui/IconButton';
import { Modal } from '../ui/Modal';

type SyncCardProps = {
  sync: SyncItem;
  detailTo?: string;
};

const buildSyncUrl = (token: string): string => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/sync/${token}`;
  }
  return `/sync/${token}`;
};

const buildSyncPath = (token: string): string => `/sync/${token}`;

const formatSyncTimestamp = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const formatSyncErrorMessage = (
  sync: SyncItem,
  t: ReturnType<typeof useI18n>['t'],
): string | null => {
  if (!sync.lastError) {
    return null;
  }

  if (sync.lastError === 'Forbidden') {
    return t('syncedListsPage.destinationPlaylistAccessError', {
      provider: sync.provider === 'spotify' ? 'Spotify' : 'Apple Music',
    });
  }

  return sync.lastError;
};

export const SyncCard = ({ sync, detailTo }: SyncCardProps) => {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);

  const isRevoked = sync.magicLinkRevokedAt !== null;
  const formattedLastSyncedAt = formatSyncTimestamp(sync.lastSyncedAt);
  const formattedLastError = formatSyncErrorMessage(sync, t);
  const syncUrl = buildSyncUrl(sync.magicLinkToken);
  const shareText = t('eventsPage.shareMessage', { url: syncUrl });
  const canUseNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copyLink = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      showToast(t('eventsPage.copyFailed'), { variant: 'error' });
      return;
    }
    try {
      await navigator.clipboard.writeText(syncUrl);
      showToast(t('eventsPage.copySuccess'), { variant: 'success' });
    } catch {
      showToast(t('eventsPage.copyFailed'), { variant: 'error' });
    }
  };

  const openMessagesShare = () => {
    if (typeof window === 'undefined') return;
    window.location.href = `sms:?body=${encodeURIComponent(shareText)}`;
    setIsShareSheetOpen(false);
  };

  const openWhatsAppShare = () => {
    if (typeof window === 'undefined') return;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      '_blank',
      'noopener,noreferrer',
    );
    setIsShareSheetOpen(false);
  };

  const openMailShare = () => {
    if (typeof window === 'undefined') return;
    window.location.href = `mailto:?subject=${encodeURIComponent(t('eventsPage.shareMailSubject'))}&body=${encodeURIComponent(shareText)}`;
    setIsShareSheetOpen(false);
  };

  const openNativeShare = async () => {
    if (!canUseNativeShare) return;
    try {
      await navigator.share({
        title: t('eventsPage.shareSheetTitle'),
        text: shareText,
        url: syncUrl,
      });
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== 'AbortError') {
        showToast(t('eventsPage.copyFailed'), { variant: 'error' });
      }
    } finally {
      setIsShareSheetOpen(false);
    }
  };

  return (
    <div className="grid min-w-0 gap-3 overflow-hidden rounded-2xl border border-app-border bg-app-surface p-4 shadow-soft-lift transition duration-150 hover:border-brand-lime/40 dark:bg-app-card">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-dashed border-app-border bg-app-bg dark:bg-app-elevated">
          <ListMusic size={18} className="text-app-text-secondary/40" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <h2 className="truncate text-sm font-black text-brand-dark dark:text-brand-white">
            {sync.name}
          </h2>
          {sync.trackCount !== null ? (
            <p className="truncate text-xs text-app-text-secondary">
              {t('syncCreatePage.trackCount', { count: sync.trackCount })}
            </p>
          ) : null}
          {!isRevoked && formattedLastError ? (
            <p className="truncate pt-1 text-[11px] text-[#b41563] dark:text-[#ff8ac0]">
              {formattedLastError}
            </p>
          ) : !isRevoked ? (
            <p className="truncate pt-1 text-[11px] text-app-text-secondary">
              {formattedLastSyncedAt
                ? t('syncedListsPage.lastSyncedAt', { date: formattedLastSyncedAt })
                : t('syncedListsPage.autoSyncActive')}
            </p>
          ) : null}
        </div>
        {detailTo ? (
          <CTALink
            to={detailTo}
            variant="ghost"
            className="group shrink-0 gap-1.5 rounded-xl px-2.5 py-1.5 text-xs hover:border-brand-pink hover:text-brand-pink"
          >
            <span className="hidden sm:inline">{t('syncedListsPage.manageList')}</span>
            <ArrowUpRight
              size={12}
              aria-hidden="true"
              className="transition duration-150 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </CTALink>
        ) : null}
      </div>

      {isRevoked ? (
        <p className="rounded-lg border border-app-border px-3 py-2 text-xs text-app-text-muted">
          {t('eventsPage.linkRevoked')}
        </p>
      ) : (
        <div className="flex w-full items-center justify-between gap-3">
          <a
            href={buildSyncPath(sync.magicLinkToken)}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex flex-1 min-w-0 items-center justify-between gap-3 rounded-xl border border-app-border bg-app-surface px-3 py-1 text-app-text shadow-soft-lift transition duration-150 hover:border-brand-pink focus-ring-brand dark:bg-app-elevated"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-brand-pink dark:bg-app-card">
                <Link2 size={14} aria-hidden="true" />
              </span>
              <span className="grid min-w-0 gap-0.5">
                <span className="truncate text-sm font-semibold">
                  {t('eventsPage.magicLinkOpenHint')}
                </span>
              </span>
            </span>
            <ArrowUpRight
              size={15}
              aria-hidden="true"
              className="shrink-0 text-app-text-secondary transition duration-150 ease-out group-hover:text-brand-pink sm:motion-safe:group-hover:translate-x-1 sm:motion-safe:group-hover:-translate-y-1"
            />
          </a>
          <div className="flex shrink-0 items-center gap-2">
            <IconButton
              onClick={() => setIsShareSheetOpen(true)}
              aria-label={t('eventsPage.shareLinkAria')}
              size="sm"
              className="hover:border-brand-pink hover:text-brand-pink"
              icon={<Share2 size={14} aria-hidden="true" />}
            />
          </div>
          <Modal
            open={isShareSheetOpen}
            title={t('eventsPage.shareSheetTitle')}
            onClose={() => setIsShareSheetOpen(false)}
            panelClassName="sm:max-w-3xl"
          >
            <div className="grid gap-5 pb-2 sm:gap-4 sm:pb-1">
              <p className="text-sm text-app-text-secondary">{t('eventsPage.shareSheetBody')}</p>
              <div className="flex gap-3 overflow-x-auto pb-2 pr-2 sm:grid sm:grid-flow-col sm:auto-cols-fr sm:gap-4 sm:overflow-visible sm:pb-1 sm:pr-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <CTAButton
                  className="h-auto min-w-20 shrink-0 flex-col gap-1.5 rounded-2xl border-0 bg-transparent px-1 py-0 text-[11px] font-semibold text-app-text hover:bg-transparent hover:text-brand-pink sm:min-w-19 sm:gap-2"
                  onClick={() => {
                    void copyLink();
                    setIsShareSheetOpen(false);
                  }}
                  variant="secondary"
                  aria-label={t('eventsPage.shareOptionCopy')}
                  withShadow={false}
                >
                  <span className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-app-border bg-app-surface shadow-soft-lift transition duration-150 hover:border-brand-lime motion-safe:hover:-translate-y-0.5 dark:bg-app-elevated sm:h-14 sm:w-14">
                    <Copy size={24} aria-hidden="true" className="sm:h-5.5 sm:w-5.5" />
                  </span>
                  <span>{t('eventsPage.shareOptionCopy')}</span>
                </CTAButton>
                <CTAButton
                  className="h-auto min-w-20 shrink-0 flex-col gap-1.5 rounded-2xl border-0 bg-transparent px-1 py-0 text-[11px] font-semibold text-app-text hover:bg-transparent hover:text-brand-pink sm:min-w-19 sm:gap-2"
                  onClick={openMessagesShare}
                  variant="secondary"
                  aria-label={t('eventsPage.shareOptionMessages')}
                  withShadow={false}
                >
                  <span className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-app-border bg-app-surface shadow-soft-lift transition duration-150 hover:border-brand-lime motion-safe:hover:-translate-y-0.5 dark:bg-app-elevated sm:h-14 sm:w-14">
                    <MessageCircle size={24} aria-hidden="true" className="sm:h-5.5 sm:w-5.5" />
                  </span>
                  <span>{t('eventsPage.shareOptionMessages')}</span>
                </CTAButton>
                <CTAButton
                  className="h-auto min-w-20 shrink-0 flex-col gap-1.5 rounded-2xl border-0 bg-transparent px-1 py-0 text-[11px] font-semibold text-app-text hover:bg-transparent hover:text-brand-pink sm:min-w-19 sm:gap-2"
                  onClick={openWhatsAppShare}
                  variant="secondary"
                  aria-label={t('eventsPage.shareOptionWhatsApp')}
                  withShadow={false}
                >
                  <span className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-app-border bg-app-surface shadow-soft-lift transition duration-150 hover:border-brand-lime motion-safe:hover:-translate-y-0.5 dark:bg-app-elevated sm:h-14 sm:w-14">
                    <Share2 size={24} aria-hidden="true" className="sm:h-5.5 sm:w-5.5" />
                  </span>
                  <span>{t('eventsPage.shareOptionWhatsApp')}</span>
                </CTAButton>
                <CTAButton
                  className="h-auto min-w-20 shrink-0 flex-col gap-1.5 rounded-2xl border-0 bg-transparent px-1 py-0 text-[11px] font-semibold text-app-text hover:bg-transparent hover:text-brand-pink sm:min-w-19 sm:gap-2"
                  onClick={openMailShare}
                  variant="secondary"
                  aria-label={t('eventsPage.shareOptionMail')}
                  withShadow={false}
                >
                  <span className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-app-border bg-app-surface shadow-soft-lift transition duration-150 hover:border-brand-lime motion-safe:hover:-translate-y-0.5 dark:bg-app-elevated sm:h-14 sm:w-14">
                    <Mail size={24} aria-hidden="true" className="sm:h-5.5 sm:w-5.5" />
                  </span>
                  <span>{t('eventsPage.shareOptionMail')}</span>
                </CTAButton>
                {canUseNativeShare ? (
                  <CTAButton
                    className="h-auto min-w-20 shrink-0 flex-col gap-1.5 rounded-2xl border-0 bg-transparent px-1 py-0 text-[11px] font-semibold text-app-text hover:bg-transparent hover:text-brand-pink sm:min-w-19 sm:gap-2"
                    onClick={() => {
                      void openNativeShare();
                    }}
                    variant="secondary"
                    aria-label={t('eventsPage.shareOptionMore')}
                    withShadow={false}
                  >
                    <span className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-app-border bg-app-surface shadow-soft-lift transition duration-150 hover:border-brand-lime motion-safe:hover:-translate-y-0.5 dark:bg-app-elevated sm:h-14 sm:w-14">
                      <MoreHorizontal size={24} aria-hidden="true" className="sm:h-5.5 sm:w-5.5" />
                    </span>
                    <span>{t('eventsPage.shareOptionMore')}</span>
                  </CTAButton>
                ) : null}
              </div>
            </div>
          </Modal>
        </div>
      )}
    </div>
  );
};
