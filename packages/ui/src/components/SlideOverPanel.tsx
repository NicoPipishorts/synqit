import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { IconButton } from './IconButton';

type SlideOverPanelProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  closeLabel?: string;
};

/** Right-hand drawer for detail views; closes on Escape and backdrop click. */
export const SlideOverPanel = ({
  open,
  title,
  onClose,
  children,
  closeLabel = 'Close',
}: SlideOverPanelProps) => {
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      setMountNode(document.body);
    }
  }, []);

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

  if (!mountNode) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-label={title}>
          <motion.button
            type="button"
            aria-label={closeLabel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-brand-dark/45 backdrop-blur-[1px] dark:bg-black/65"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-0 h-full w-full max-w-xl border-l-2 border-app-text bg-app-bg p-4 shadow-[-6px_0_0_0_var(--syn-text)] sm:p-5"
          >
            <div className="flex items-center justify-between gap-3 border-b-2 border-app-text pb-3">
              <h3 className="truncate text-base font-black tracking-tight text-app-text sm:text-lg">
                {title}
              </h3>
              <IconButton
                onClick={onClose}
                aria-label={closeLabel}
                size="md"
                icon={<X size={16} aria-hidden="true" />}
              />
            </div>
            <div className="mt-4 h-[calc(100%-3.5rem)] overflow-y-auto pr-1">{children}</div>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>,
    mountNode,
  );
};
