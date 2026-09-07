import { Sticker, TapeStrip, useToast } from '@synqit/ui';
import { Download, Share, Smartphone } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { useI18n } from '../../hooks/useI18n';
import { CTAButton } from '../ui/cta';
import { Modal } from '../ui/Modal';

const DISMISS_STORAGE_KEY = 'synqit.pwa-install-dismissed.v1';
const REPROMPT_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;

type PromptStorageState = {
  dismissedAt: number | null;
  installedAt: number | null;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
};

declare global {
  interface Navigator {
    standalone?: boolean;
  }
}

const isStandalone = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  return (
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  );
};

const isIosSafari = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(userAgent);
  const isSafari = /safari/.test(userAgent) && !/crios|fxios|edgios/.test(userAgent);
  return isIos && isSafari;
};

const loadPromptStorageState = (): PromptStorageState => {
  if (typeof window === 'undefined') {
    return {
      dismissedAt: null,
      installedAt: null,
    };
  }

  const rawValue = window.localStorage.getItem(DISMISS_STORAGE_KEY);
  if (!rawValue) {
    return {
      dismissedAt: null,
      installedAt: null,
    };
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Partial<PromptStorageState>;
    return {
      dismissedAt: typeof parsedValue.dismissedAt === 'number' ? parsedValue.dismissedAt : null,
      installedAt: typeof parsedValue.installedAt === 'number' ? parsedValue.installedAt : null,
    };
  } catch {
    return {
      dismissedAt: null,
      installedAt: null,
    };
  }
};

const persistPromptStorageState = (nextState: PromptStorageState): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(nextState));
};

const shouldShowPrompt = (): boolean => {
  const currentState = loadPromptStorageState();
  if (currentState.installedAt) {
    return false;
  }

  if (!currentState.dismissedAt) {
    return true;
  }

  return Date.now() - currentState.dismissedAt >= REPROMPT_INTERVAL_MS;
};

const persistDismissed = (): void => {
  const currentState = loadPromptStorageState();
  persistPromptStorageState({
    ...currentState,
    dismissedAt: Date.now(),
  });
};

const persistInstalled = (): void => {
  persistPromptStorageState({
    dismissedAt: null,
    installedAt: Date.now(),
  });
};

const PromptStep = ({
  index,
  icon,
  title,
  body,
}: {
  index: string;
  icon: ReactNode;
  title: string;
  body: string;
}) => (
  <div className="relative flex items-start gap-3 rounded-2xl border-2 border-app-border-strong bg-app-surface px-4 py-3 dark:bg-app-elevated">
    <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-app-text bg-brand-lime text-brand-dark">
      {icon}
    </div>
    <div className="grid gap-1">
      <div className="flex items-center gap-2">
        <Sticker tone="paper" className="px-2 py-0 text-[10px]">
          {index}
        </Sticker>
        <p className="text-sm font-black text-brand-dark dark:text-brand-white">{title}</p>
      </div>
      <p className="text-sm leading-5 text-app-text-secondary">{body}</p>
    </div>
  </div>
);

export const PwaInstallPrompt = () => {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(() => isStandalone());
  const [isOpen, setIsOpen] = useState(false);
  const [isPrompting, setIsPrompting] = useState(false);

  const showIosGuide = useMemo(() => !isInstalled && isIosSafari(), [isInstalled]);
  const canPromptInstall = !isInstalled && deferredPrompt !== null;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const maybeOpen = () => {
      if (shouldShowPrompt() && !isStandalone()) {
        setIsOpen(true);
      }
    };

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      maybeOpen();
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setIsOpen(false);
      persistInstalled();
      showToast(t('dashboard.pwa.installedSuccess'), { variant: 'success' });
    };

    setIsInstalled(isStandalone());
    if (isStandalone()) {
      persistInstalled();
      return;
    }

    if (showIosGuide) {
      maybeOpen();
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, [showIosGuide, showToast, t]);

  if (!canPromptInstall && !showIosGuide) {
    return null;
  }

  const closePrompt = () => {
    persistDismissed();
    setIsOpen(false);
  };

  const installApp = async () => {
    if (!deferredPrompt) {
      closePrompt();
      return;
    }

    try {
      setIsPrompting(true);
      await deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (result.outcome === 'accepted') {
        setIsOpen(false);
        showToast(t('dashboard.pwa.installAccepted'), { variant: 'success' });
        return;
      }

      closePrompt();
    } catch {
      showToast(t('dashboard.pwa.installFailed'), { variant: 'error' });
    } finally {
      setIsPrompting(false);
    }
  };

  return (
    <Modal open={isOpen} title={t('dashboard.pwa.title')} onClose={closePrompt}>
      <div className="grid gap-5">
        <div className="relative rounded-3xl border-2 border-app-text bg-brand-dark px-5 py-5 text-brand-white shadow-sticker-sm dark:bg-brand-white dark:text-brand-dark">
          <TapeStrip tone="pink" className="left-6" />
          <div className="flex items-start gap-4">
            <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-app-text bg-brand-lime text-brand-dark">
              <Smartphone size={22} />
            </div>
            <div className="grid gap-2">
              <Sticker tone="lime" tilt="-rotate-2">
                {t('dashboard.pwa.eyebrow')}
              </Sticker>
              <p className="text-xl font-black leading-tight tracking-tight">
                {t('dashboard.pwa.headline')}
              </p>
              <p className="max-w-md text-sm opacity-80">{t('dashboard.pwa.body')}</p>
            </div>
          </div>
        </div>

        {showIosGuide ? (
          <div className="grid gap-3">
            <PromptStep
              index="01"
              icon={<Share size={16} aria-hidden="true" />}
              title={t('dashboard.pwa.iosStepOneTitle')}
              body={t('dashboard.pwa.iosStepOneBody')}
            />
            <PromptStep
              index="02"
              icon={<Download size={16} aria-hidden="true" />}
              title={t('dashboard.pwa.iosStepTwoTitle')}
              body={t('dashboard.pwa.iosStepTwoBody')}
            />
            <PromptStep
              index="03"
              icon={<Smartphone size={16} aria-hidden="true" />}
              title={t('dashboard.pwa.iosStepThreeTitle')}
              body={t('dashboard.pwa.iosStepThreeBody')}
            />
          </div>
        ) : (
          <div className="grid gap-2 rounded-2xl border-2 border-dashed border-app-text/60 bg-app-surface px-4 py-4 dark:bg-app-elevated">
            <p className="text-sm font-bold text-brand-dark dark:text-brand-white">
              {t('dashboard.pwa.instantInstallTitle')}
            </p>
            <p className="text-sm leading-5 text-app-text-secondary">
              {t('dashboard.pwa.instantInstallBody')}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <CTAButton type="button" variant="secondary" onClick={closePrompt}>
            {t('dashboard.pwa.dismiss')}
          </CTAButton>
          {canPromptInstall ? (
            <CTAButton
              type="button"
              variant="primary"
              onClick={() => void installApp()}
              disabled={isPrompting}
            >
              {isPrompting ? t('dashboard.pwa.installing') : t('dashboard.pwa.install')}
            </CTAButton>
          ) : (
            <CTAButton type="button" variant="primary" onClick={closePrompt}>
              {t('dashboard.pwa.gotIt')}
            </CTAButton>
          )}
        </div>
      </div>
    </Modal>
  );
};
