import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  ToastContext,
  type ToastContextValue,
  type ToastOptions,
  type ToastVariant,
} from '../hooks/useToast';

type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
};

const DEFAULT_DURATION_MS = 3600;
const DEFAULT_ERROR_DURATION_MS = 5500;

const TOAST_CLASSES: Record<ToastVariant, string> = {
  success: 'bg-brand-lime text-brand-dark',
  error: 'bg-brand-pink text-brand-white',
  info: 'bg-app-elevated text-app-text dark:bg-app-card',
};

const ToastIcon = ({ variant }: { variant: ToastVariant }) => {
  if (variant === 'success') {
    return <CheckCircle2 size={18} aria-hidden="true" />;
  }
  if (variant === 'error') {
    return <XCircle size={18} aria-hidden="true" />;
  }
  return <Info size={18} aria-hidden="true" />;
};

type ToastProviderProps = {
  children: ReactNode;
  /** Accessible label for the per-toast dismiss button. */
  dismissLabel?: string;
};

export const ToastProvider = ({
  children,
  dismissLabel = 'Dismiss notification',
}: ToastProviderProps) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const timeoutByIdRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((toastId: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));

    const timeoutId = timeoutByIdRef.current.get(toastId);
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      timeoutByIdRef.current.delete(toastId);
    }
  }, []);

  const showToast = useCallback((message: string, options?: ToastOptions) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const variant = options?.variant ?? 'info';
    setToasts((current) => [...current, { id, message, variant }]);

    const durationMs =
      options?.durationMs ??
      (variant === 'error' ? DEFAULT_ERROR_DURATION_MS : DEFAULT_DURATION_MS);

    const timeoutId = window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
      timeoutByIdRef.current.delete(id);
    }, durationMs);

    timeoutByIdRef.current.set(id, timeoutId);
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const timeoutById = timeoutByIdRef.current;
    return () => {
      for (const timeoutId of timeoutById.values()) {
        window.clearTimeout(timeoutId);
      }
      timeoutById.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {isMounted
        ? createPortal(
            <div className="pointer-events-none fixed bottom-6 left-1/2 z-[2147483647] flex w-[min(92vw,26rem)] -translate-x-1/2 flex-col gap-2">
              {toasts.map((toast) => (
                <div
                  key={toast.id}
                  className={`pointer-events-auto flex items-center gap-3 rounded-2xl border-2 border-app-text px-3.5 py-3 shadow-sticker ${TOAST_CLASSES[toast.variant]}`}
                  role="status"
                  aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
                >
                  <div className="shrink-0">
                    <ToastIcon variant={toast.variant} />
                  </div>
                  <p className="flex-1 text-sm font-bold leading-5">{toast.message}</p>
                  <button
                    type="button"
                    onClick={() => dismissToast(toast.id)}
                    className="shrink-0 rounded-full border-2 border-current/50 p-1.5 transition hover:bg-black/10 dark:hover:bg-white/10"
                    aria-label={dismissLabel}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
};
