import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { IconButton } from './IconButton';
import { TapeStrip } from './TapeStrip';
import { cn } from '../utils/cn';

export type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Localised label for the close controls. */
  closeLabel: string;
  panelClassName?: string;
};

const DESKTOP_QUERY = '(min-width: 640px)';

/** Bottom sheet on small screens, centred dialog from `sm` up. Closes on Escape and backdrop click. */
export const Modal = ({
  open,
  title,
  onClose,
  children,
  closeLabel,
  panelClassName,
}: ModalProps) => {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(DESKTOP_QUERY).matches,
  );
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      setPortalContainer(document.body);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const mediaQuery = window.matchMedia(DESKTOP_QUERY);
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
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

  if (!portalContainer) {
    return null;
  }

  const panelInitial = isDesktop ? { y: 0 } : { y: '100%' };
  const panelExit = isDesktop ? { y: 0 } : { y: '100%' };
  const panelTransition = isDesktop
    ? { duration: 0 }
    : { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const };

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center px-0 sm:items-center sm:px-4"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            className="absolute inset-0 bg-brand-dark/55 backdrop-blur-[2px] dark:bg-black/70"
          />
          <motion.div
            initial={panelInitial}
            animate={{ y: 0 }}
            exit={panelExit}
            transition={panelTransition}
            className={cn(
              'relative z-10 flex max-h-[85svh] w-full max-w-lg flex-col rounded-t-3xl border-2 border-b-0 border-app-text bg-app-elevated dark:bg-app-card sm:max-h-[90svh] sm:rounded-3xl sm:border-b-2 sm:shadow-[6px_6px_0_0_var(--syn-text)]',
              panelClassName,
            )}
          >
            {/* Tape overhangs the panel edge, so it lives outside the scrolling wrapper. */}
            <TapeStrip tone="lime" className="hidden sm:block" />
            <div className="min-h-0 flex-1 overflow-y-auto rounded-[inherit] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-7">
              {/* grab handle on the phone sheet */}
              <div
                aria-hidden="true"
                className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-app-text/30 sm:hidden"
              />
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-xl font-black tracking-tight text-brand-dark dark:text-brand-white">
                  {title}
                </h3>
                <IconButton
                  onClick={onClose}
                  aria-label={closeLabel}
                  size="sm"
                  icon={<X size={16} aria-hidden="true" />}
                />
              </div>
              {children}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    portalContainer,
  );
};
