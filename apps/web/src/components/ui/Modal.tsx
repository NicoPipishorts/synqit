import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { CTAMobileIconLabel } from './cta';
import { IconButton } from './IconButton';
import { useI18n } from '../../hooks/useI18n';

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export const Modal = ({ open, title, onClose, children }: ModalProps) => {
  const { t } = useI18n();
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(min-width: 640px)').matches;
  });
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    setPortalContainer(document.body);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(min-width: 640px)');
    const onChange = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
    };

    setIsDesktop(mediaQuery.matches);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [open, onClose]);

  const panelInitial = isDesktop ? { y: 0 } : { y: '100%' };
  const panelAnimate = { y: 0 };
  const panelExit = isDesktop ? { y: 0 } : { y: '100%' };
  const panelTransition = isDesktop
    ? { duration: 0 }
    : { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const };

  if (!portalContainer) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center px-0 sm:items-center sm:px-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Close modal"
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
          />
          <motion.div
            initial={panelInitial}
            animate={panelAnimate}
            exit={panelExit}
            transition={panelTransition}
            className="relative z-10 max-h-[85svh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-app-border bg-app-elevated p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_30px_80px_-24px_rgba(0,0,0,0.55)] dark:bg-app-card sm:max-h-[90svh] sm:rounded-3xl sm:p-7"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-xl font-bold text-brand-dark dark:text-brand-white">{title}</h3>
              <div className="sm:hidden">
                <IconButton
                  onClick={onClose}
                  aria-label={t('modal.close')}
                  size="sm"
                  icon={<X size={16} aria-hidden="true" />}
                />
              </div>
              <button
                type="button"
                onClick={onClose}
                className="hidden rounded-lg border border-app-border px-2 py-1 text-xs font-semibold transition hover:border-brand-pink focus-ring-brand sm:inline-flex"
              >
                <CTAMobileIconLabel
                  icon={<X size={16} aria-hidden="true" />}
                  label={t('modal.close')}
                />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    portalContainer,
  );
};
