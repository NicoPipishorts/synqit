import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { ReactNode, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';

import { CTAButton } from './cta';

type SlideOverPanelProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  closeLabel?: string;
};

export const SlideOverPanel = ({
  open,
  title,
  onClose,
  children,
  closeLabel = 'Close',
}: SlideOverPanelProps) => {
  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  const mountNode = useMemo(() => {
    if (typeof document === 'undefined') {
      return null;
    }
    return document.body;
  }, []);

  if (!mountNode) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[120]">
          <motion.button
            type="button"
            aria-label={closeLabel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-brand-dark/35 backdrop-blur-[1px]"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-0 h-full w-full max-w-xl border-l border-app-border bg-app-bg p-4 shadow-2xl sm:p-5"
          >
            <div className="flex items-center justify-between gap-3 border-b border-app-border pb-3">
              <h3 className="truncate text-base font-black text-app-text sm:text-lg">{title}</h3>
              <CTAButton
                type="button"
                variant="secondary"
                onClick={onClose}
                className="h-9 w-9 px-0"
                aria-label={closeLabel}
              >
                <X size={14} aria-hidden="true" />
              </CTAButton>
            </div>
            <div className="mt-4 h-[calc(100%-3.5rem)] overflow-y-auto pr-1">{children}</div>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>,
    mountNode,
  );
};
