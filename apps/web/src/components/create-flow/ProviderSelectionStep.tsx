import { providerSchema } from '@synqit/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

import { CREATE_FLOW_STEP_SLIDE_EASE, CREATE_FLOW_STEP_SLIDE_VARIANTS } from './flowMotion';
import type { Provider } from '../../lib/types';
import { EventProviderIcon } from '../events/EventProviderIcon';

export type ProviderIntegrationStatus = 'connected' | 'not_connected';

type ProviderSelectionStepProps = {
  body: string;
  isConnectingProvider: boolean;
  motionKey: string;
  provider: Provider | null;
  providerStatusByType: Record<Provider, ProviderIntegrationStatus>;
  providerLabels: Record<Provider, string>;
  stepDirection: 1 | -1;
  unselectAriaLabel: string;
  onProviderClear: () => void;
  onProviderSelect: (provider: Provider) => void;
};

export const ProviderSelectionStep = ({
  body,
  isConnectingProvider,
  motionKey,
  provider,
  providerLabels,
  providerStatusByType,
  stepDirection,
  unselectAriaLabel,
  onProviderClear,
  onProviderSelect,
}: ProviderSelectionStepProps) => {
  return (
    <motion.article
      key={motionKey}
      custom={stepDirection}
      variants={CREATE_FLOW_STEP_SLIDE_VARIANTS}
      initial="enter"
      animate="center"
      exit="exit"
      className="p-1 sm:p-2"
    >
      <p className="mx-auto max-w-[70%] text-center text-sm text-app-text-secondary sm:max-w-[50%]">
        {body}
      </p>
      <div className="mt-5 flex items-center justify-center gap-6 sm:gap-8">
        <AnimatePresence initial={false}>
          {providerSchema.options.map((value) => {
            const isSelected = provider === value;
            const isConnected = providerStatusByType[value] === 'connected';
            const isHidden = provider !== null && !isSelected;

            if (isHidden) return null;

            return (
              <motion.div
                key={value}
                layout
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.88 }}
                transition={{ duration: 0.22, ease: CREATE_FLOW_STEP_SLIDE_EASE }}
                className="relative inline-flex flex-col items-center"
              >
                <span className="relative inline-flex p-2 sm:p-3">
                  {!isSelected ? (
                    <button
                      type="button"
                      onClick={() => onProviderSelect(value)}
                      disabled={isConnectingProvider}
                      aria-label={providerLabels[value]}
                      className={`relative inline-flex items-center justify-center rounded-full transition motion-safe:hover:-translate-y-0.5 ${
                        isConnectingProvider ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                      }`}
                    >
                      <EventProviderIcon
                        provider={value}
                        sizeClassName="h-24 w-24 sm:h-24 sm:w-24"
                        imgClassName={isConnected ? '' : 'grayscale saturate-0 opacity-70'}
                      />
                    </button>
                  ) : (
                    <span className="relative inline-flex">
                      <EventProviderIcon
                        provider={value}
                        sizeClassName="h-24 w-24 sm:h-24 sm:w-24"
                        imgClassName={isConnected ? '' : 'grayscale saturate-0 opacity-70'}
                        className="ring-[3px] ring-brand-lime ring-offset-2 ring-offset-app-bg"
                      />
                    </span>
                  )}
                  <AnimatePresence initial={false} mode="wait">
                    {isSelected && isConnected ? (
                      <motion.span
                        key="check"
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.7 }}
                        transition={{ duration: 0.18, ease: CREATE_FLOW_STEP_SLIDE_EASE }}
                        className="absolute top-3.75 right-3.75 inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-app-text bg-brand-lime text-brand-dark shadow-sticker-sm"
                      >
                        <Check size={15} strokeWidth={4} aria-hidden="true" />
                      </motion.span>
                    ) : isSelected && !isConnected ? (
                      <motion.button
                        key="close"
                        type="button"
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.7 }}
                        transition={{ duration: 0.18, ease: CREATE_FLOW_STEP_SLIDE_EASE }}
                        onClick={onProviderClear}
                        aria-label={unselectAriaLabel}
                        className="absolute top-3.75 right-3.75 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-app-text bg-brand-pink text-white shadow-sticker-sm transition hover:opacity-80"
                      >
                        <X size={13} strokeWidth={3} aria-hidden="true" />
                      </motion.button>
                    ) : null}
                  </AnimatePresence>
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.article>
  );
};
