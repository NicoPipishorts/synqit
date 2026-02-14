import { ReactNode, useEffect } from 'react';

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export const Modal = ({ open, title, onClose, children }: ModalProps) => {
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

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center px-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Close modal"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
      />
      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-app-border bg-app-elevated p-6 shadow-[0_30px_80px_-24px_rgba(0,0,0,0.55)] dark:bg-app-card sm:p-7">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-xl font-bold text-brand-dark dark:text-brand-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-app-border px-2 py-1 text-xs font-semibold transition hover:border-brand-pink"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
