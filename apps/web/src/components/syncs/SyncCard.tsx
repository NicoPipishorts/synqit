import type { SyncItem } from '@synqit/shared';
import {
  Copy,
  ExternalLink,
  ListMusic,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Settings2,
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
  role?: 'owner' | 'subscriber';
};

const ROLE_ACCENT = {
  owner: 'bg-brand-lime/15 text-[#6d9600] dark:text-[#d5ff5c]',
  subscriber: 'bg-purple-400/15 text-purple-700 dark:text-purple-300',
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

export const SyncCard = ({ sync, detailTo, role }: SyncCardProps) => {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);

  const isOwner = role ? role === 'owner' : Boolean(detailTo);
  const accent = ROLE_ACCENT[isOwner ? 'owner' : 'subscriber'];
  const roleLabel = isOwner ? t('dashboard.roleOwner') : t('dashboard.roleSubscriber');
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
    <div className="grid min-w-0 gap-4 overflow-hidden rounded-2xl border border-app-border bg-app-surface p-4 shadow-soft-lift transition duration-150 hover:border-brand-lime/40 dark:bg-app-card">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent}`}
        >
          <ListMusic size={18} />
        </span>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="min-w-0 truncate text-sm font-black text-brand-dark dark:text-brand-white">
              {sync.name}
            </h2>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${accent}`}
            >
              {roleLabel}
            </span>
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-app-text-secondary">
            {sync.trackCount !== null ? (
              <span className="shrink-0">
                {t('syncCreatePage.trackCount', { count: sync.trackCount })}
              </span>
            ) : null}
            {!isRevoked && formattedLastError ? (
              <span className="inline-flex min-w-0 items-center gap-1 text-[#b41563] dark:text-[#ff8ac0]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
                <span className="truncate">{formattedLastError}</span>
              </span>
            ) : !isRevoked ? (
              <span className="inline-flex min-w-0 items-center gap-1 text-[#6d9600] dark:text-[#d5ff5c]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
                <span className="truncate">
                  {formattedLastSyncedAt
                    ? t('syncedListsPage.lastSyncedAt', { date: formattedLastSyncedAt })
                    : t('syncedListsPage.autoSyncActive')}
                </span>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {isRevoked ? (
        <p className="rounded-lg border border-app-border px-3 py-2 text-xs text-app-text-muted">
          {t('eventsPage.linkRevoked')}
        </p>
      ) : (
        <div className="flex w-full items-center gap-2">
          {detailTo ? (
            <CTALink
              to={detailTo}
              variant="primary"
              className="flex-1 justify-center gap-1.5 px-4 py-2.5 text-sm"
            >
              <Settings2 size={14} aria-hidden="true" />
              {t('syncedListsPage.manageList')}
            </CTALink>
          ) : (
            <CTAButton
              type="button"
              variant="primary"
              className="flex-1 justify-center gap-1.5 px-4 py-2.5 text-sm"
              onClick={() => window.open(buildSyncPath(sync.magicLinkToken), '_blank', 'noopener')}
            >
              {t('syncedListsPage.openList')}
              <ExternalLink size={14} aria-hidden="true" />
            </CTAButton>
          )}
          {detailTo ? (
            <IconButton
              onClick={() => window.open(buildSyncPath(sync.magicLinkToken), '_blank', 'noopener')}
              aria-label={t('syncedListsPage.openList')}
              size="sm"
              className="hover:border-brand-pink hover:text-brand-pink"
              icon={<ExternalLink size={14} aria-hidden="true" />}
            />
          ) : null}
          <IconButton
            onClick={() => setIsShareSheetOpen(true)}
            aria-label={t('eventsPage.shareLinkAria')}
            size="sm"
            className="hover:border-brand-pink hover:text-brand-pink"
            icon={<Share2 size={14} aria-hidden="true" />}
          />
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
