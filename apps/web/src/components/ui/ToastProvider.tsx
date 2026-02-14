import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { ToastContext, ToastContextValue } from '../../hooks/useToast';

type Toast = {
  id: string;
  message: string;
  variant: 'success' | 'error' | 'info';
};

const DEFAULT_DURATION_MS = 3600;
const DEFAULT_ERROR_DURATION_MS = 5500;

const getToastClasses = (variant: 'success' | 'error' | 'info'): string => {
  if (variant === 'success') {
    return 'border-brand-lime/40 bg-brand-lime/10 text-[#587700] dark:text-[#d5ff63]';
  }

  if (variant === 'error') {
    return 'border-brand-pink/40 bg-brand-pink/10 text-[#a91159] dark:text-[#ffb4d9]';
  }

  return 'border-app-border bg-app-elevated text-app-text dark:bg-app-card';
};

const ToastIcon = ({ variant }: { variant: 'success' | 'error' | 'info' }) => {
  if (variant === 'success') {
    return <CheckCircle2 size={18} aria-hidden="true" />;
  }
  if (variant === 'error') {
    return <XCircle size={18} aria-hidden="true" />;
  }
  return <Info size={18} aria-hidden="true" />;
};

export const ToastProvider = ({ children }: PropsWithChildren) => {
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

  const showToast = useCallback(
    (
      message: string,
      options?: { variant?: 'success' | 'error' | 'info'; durationMs?: number },
    ) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const variant = options?.variant ?? 'info';
      const toast: Toast = {
        id,
        message,
        variant,
      };

      setToasts((current) => [...current, toast]);

      const durationMs =
        options?.durationMs ??
        (variant === 'error' ? DEFAULT_ERROR_DURATION_MS : DEFAULT_DURATION_MS);

      const timeoutId = window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== id));
        timeoutByIdRef.current.delete(id);
      }, durationMs);

      timeoutByIdRef.current.set(id, timeoutId);
    },
    [],
  );

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

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
    }),
    [showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {isMounted
        ? createPortal(
            <div className="pointer-events-none fixed bottom-6 left-1/2 z-[9999] flex w-[min(92vw,26rem)] -translate-x-1/2 flex-col gap-2">
              {toasts.map((toast) => (
                <div
                  key={toast.id}
                  className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-3.5 py-3 shadow-xl backdrop-blur ${getToastClasses(toast.variant)}`}
                  role="status"
                  aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
                >
                  <div className="shrink-0">
                    <ToastIcon variant={toast.variant} />
                  </div>
                  <p className="flex-1 text-sm font-medium leading-5">{toast.message}</p>
                  <button
                    type="button"
                    onClick={() => dismissToast(toast.id)}
                    className="shrink-0 rounded-md border border-current/20 p-1.5 transition hover:bg-black/5 dark:hover:bg-white/10"
                    aria-label="Dismiss notification"
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
