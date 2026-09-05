import { createContext, useContext } from 'react';

export type ToastVariant = 'success' | 'error' | 'info';

export type ToastOptions = {
  variant?: ToastVariant;
  durationMs?: number;
};

export type ToastContextValue = {
  showToast: (message: string, options?: ToastOptions) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider.');
  }

  return context;
};
