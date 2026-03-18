import { Copy, Link2, Mail, MessageCircle, MoreHorizontal, Share2 } from 'lucide-react';
import { useState } from 'react';

import { useI18n } from '../../hooks/useI18n';
import { useToast } from '../../hooks/useToast';
import { getPublicEventPath, getPublicEventUrl } from '../../lib/events';
import { CTAButton } from '../ui/cta';
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
        className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate font-semibold text-brand-pink hover:text-[#d12074]"
      >
        <Link2 size={14} aria-hidden="true" className="shrink-0" />
        <span className="truncate">{t('eventsPage.magicLinkLabel')}</span>
      </a>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => setIsShareSheetOpen(true)}
          aria-label={t('eventsPage.shareLinkAria')}
          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-app-border bg-app-surface text-app-text shadow-soft-lift transition hover:border-brand-lime dark:bg-app-elevated"
        >
          <Share2 size={14} aria-hidden="true" />
        </button>
      </div>
      <Modal
        open={isShareSheetOpen}
        title={t('eventsPage.shareSheetTitle')}
        onClose={() => setIsShareSheetOpen(false)}
      >
        <div className="grid gap-4">
          <p className="text-sm text-app-text-secondary">{t('eventsPage.shareSheetBody')}</p>
          <div className="flex gap-4 overflow-x-auto pb-1 pr-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <CTAButton
              className="h-auto min-w-19 shrink-0 flex-col gap-2 rounded-2xl border-0 bg-transparent px-1 py-0 text-[11px] font-semibold text-app-text hover:bg-transparent hover:text-brand-pink"
              onClick={() => {
                void copyMagicLink();
                setIsShareSheetOpen(false);
              }}
              variant="secondary"
              aria-label={t('eventsPage.shareOptionCopy')}
              withShadow={false}
            >
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-app-border bg-app-surface shadow-soft-lift transition duration-150 hover:border-brand-lime motion-safe:hover:-translate-y-0.5 dark:bg-app-elevated">
                <Copy size={20} aria-hidden="true" />
              </span>
              <span>{t('eventsPage.shareOptionCopy')}</span>
            </CTAButton>
            <CTAButton
              className="h-auto min-w-19 shrink-0 flex-col gap-2 rounded-2xl border-0 bg-transparent px-1 py-0 text-[11px] font-semibold text-app-text hover:bg-transparent hover:text-brand-pink"
              onClick={openMessagesShare}
              variant="secondary"
              aria-label={t('eventsPage.shareOptionMessages')}
              withShadow={false}
            >
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-app-border bg-app-surface shadow-soft-lift transition duration-150 hover:border-brand-lime motion-safe:hover:-translate-y-0.5 dark:bg-app-elevated">
                <MessageCircle size={20} aria-hidden="true" />
              </span>
              <span>{t('eventsPage.shareOptionMessages')}</span>
            </CTAButton>
            <CTAButton
              className="h-auto min-w-19 shrink-0 flex-col gap-2 rounded-2xl border-0 bg-transparent px-1 py-0 text-[11px] font-semibold text-app-text hover:bg-transparent hover:text-brand-pink"
              onClick={openWhatsAppShare}
              variant="secondary"
              aria-label={t('eventsPage.shareOptionWhatsApp')}
              withShadow={false}
            >
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-app-border bg-app-surface shadow-soft-lift transition duration-150 hover:border-brand-lime motion-safe:hover:-translate-y-0.5 dark:bg-app-elevated">
                <Share2 size={20} aria-hidden="true" />
              </span>
              <span>{t('eventsPage.shareOptionWhatsApp')}</span>
            </CTAButton>
            <CTAButton
              className="h-auto min-w-19 shrink-0 flex-col gap-2 rounded-2xl border-0 bg-transparent px-1 py-0 text-[11px] font-semibold text-app-text hover:bg-transparent hover:text-brand-pink"
              onClick={openMailShare}
              variant="secondary"
              aria-label={t('eventsPage.shareOptionMail')}
              withShadow={false}
            >
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-app-border bg-app-surface shadow-soft-lift transition duration-150 hover:border-brand-lime motion-safe:hover:-translate-y-0.5 dark:bg-app-elevated">
                <Mail size={20} aria-hidden="true" />
              </span>
              <span>{t('eventsPage.shareOptionMail')}</span>
            </CTAButton>
            {canUseNativeShare ? (
              <CTAButton
                className="h-auto min-w-19 shrink-0 flex-col gap-2 rounded-2xl border-0 bg-transparent px-1 py-0 text-[11px] font-semibold text-app-text hover:bg-transparent hover:text-brand-pink"
                onClick={() => {
                  void openNativeShare();
                }}
                variant="secondary"
                aria-label={t('eventsPage.shareOptionMore')}
                withShadow={false}
              >
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-app-border bg-app-surface shadow-soft-lift transition duration-150 hover:border-brand-lime motion-safe:hover:-translate-y-0.5 dark:bg-app-elevated">
                  <MoreHorizontal size={20} aria-hidden="true" />
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
