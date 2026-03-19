import {
  ArrowUpRight,
  Copy,
  Link2,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Share2,
} from 'lucide-react';
import { useState } from 'react';

import { useI18n } from '../../hooks/useI18n';
import { useToast } from '../../hooks/useToast';
import { getPublicEventPath, getPublicEventUrl } from '../../lib/events';
import { CTAButton } from '../ui/cta';
import { IconButton } from '../ui/IconButton';
import { Modal } from '../ui/Modal';

type EventMagicLinkRowProps = {
  magicLinkToken: string;
  magicLinkRevokedAt: string | null;
  className?: string;
};

export const EventMagicLinkRow = ({
  magicLinkToken,
  magicLinkRevokedAt,
  className,
}: EventMagicLinkRowProps) => {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);

  const eventUrl = getPublicEventUrl(magicLinkToken);
  const shareText = t('eventsPage.shareMessage', { url: eventUrl });
  const canUseNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copyMagicLink = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      showToast(t('eventsPage.copyFailed'), { variant: 'error' });
      return;
    }
    try {
      await navigator.clipboard.writeText(eventUrl);
      showToast(t('eventsPage.copySuccess'), { variant: 'success' });
    } catch {
      showToast(t('eventsPage.copyFailed'), { variant: 'error' });
    }
  };

  const openMessagesShare = () => {
    if (typeof window === 'undefined') {
      return;
    }

    window.location.href = `sms:?body=${encodeURIComponent(shareText)}`;
    setIsShareSheetOpen(false);
  };

  const openWhatsAppShare = () => {
    if (typeof window === 'undefined') {
      return;
    }

    window.open(
      `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      '_blank',
      'noopener,noreferrer',
    );
    setIsShareSheetOpen(false);
  };

  const openMailShare = () => {
    if (typeof window === 'undefined') {
      return;
    }

    window.location.href = `mailto:?subject=${encodeURIComponent(t('eventsPage.shareMailSubject'))}&body=${encodeURIComponent(shareText)}`;
    setIsShareSheetOpen(false);
  };

  const openNativeShare = async () => {
    if (!canUseNativeShare) {
      return;
    }

    try {
      await navigator.share({
        title: t('eventsPage.shareSheetTitle'),
        text: shareText,
        url: eventUrl,
      });
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== 'AbortError') {
        showToast(t('eventsPage.copyFailed'), { variant: 'error' });
      }
    } finally {
      setIsShareSheetOpen(false);
    }
  };

  if (magicLinkRevokedAt) {
    return <span>{t('eventsPage.linkRevoked')}</span>;
  }

  return (
    <div
      className={`flex w-full items-center justify-between gap-3 sm:gap-5 ${className ?? ''}`.trim()}
    >
      <a
        href={getPublicEventPath(magicLinkToken)}
        target="_blank"
        rel="noreferrer"
        className="group inline-flex min-w-0 items-center gap-2 rounded-xl border border-app-border bg-app-surface px-3 py-1 text-app-text shadow-soft-lift transition duration-150 hover:border-brand-pink focus-ring-brand dark:bg-app-elevated"
      >
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center  text-brand-pink dark:bg-app-card">
          <Link2 size={14} aria-hidden="true" />
        </span>
        <span className="grid min-w-0 gap-0.5">
          <span className="truncate text-sm font-semibold">
            {t('eventsPage.magicLinkOpenHint')}
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
      >
        <div className="grid gap-5 pb-2 sm:gap-4 sm:pb-1">
          <p className="text-sm text-app-text-secondary">{t('eventsPage.shareSheetBody')}</p>
          <div className="flex gap-3 overflow-x-auto pb-2 pr-2 sm:gap-4 sm:pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <CTAButton
              className="h-auto min-w-20 shrink-0 flex-col gap-1.5 rounded-2xl border-0 bg-transparent px-1 py-0 text-[11px] font-semibold text-app-text hover:bg-transparent hover:text-brand-pink sm:min-w-19 sm:gap-2"
              onClick={() => {
                void copyMagicLink();
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
  );
};
