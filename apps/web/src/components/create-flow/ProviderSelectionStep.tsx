import { AnimatePresence, motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

import { CREATE_FLOW_STEP_SLIDE_EASE, CREATE_FLOW_STEP_SLIDE_VARIANTS } from './flowMotion';
import type { Provider } from '../../lib/types';
import { ProviderIcon } from '../providers/ProviderIcon';

export type ProviderIntegrationStatus = 'connected' | 'not_connected';

type ProviderSelectionStepProps<P extends Provider> = {
  body: string;
  isConnectingProvider: boolean;
  motionKey: string;
  /** The services to offer, in display order. Event flows pass a narrower list than sync flows. */
  providers: readonly P[];
  provider: P | null;
  providerStatusByType: Record<Provider, ProviderIntegrationStatus>;
  providerLabels: Record<Provider, string>;
  stepDirection: 1 | -1;
  unselectAriaLabel: string;
  onProviderClear: () => void;
  onProviderSelect: (provider: P) => void;
};

export const ProviderSelectionStep = <P extends Provider>({
  body,
  isConnectingProvider,
  motionKey,
  providers,
  provider,
  providerLabels,
  providerStatusByType,
  stepDirection,
  unselectAriaLabel,
  onProviderClear,
  onProviderSelect,
}: ProviderSelectionStepProps<P>) => {
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
      {/* Four marks in a row are 456px wide before the gaps, so a phone cut the
          outer two off. They wrap two-up until one is picked, at which point
          the lone survivor centres itself. */}
      <div
        className={`mt-5 gap-6 sm:flex sm:items-center sm:justify-center sm:gap-8 ${
          provider === null
            ? 'grid grid-cols-2 place-items-center'
            : // Wrapping matters for the moment in between: the others are still
              // fading out when this switches, and four in a row overflow a phone.
              'flex flex-wrap justify-center'
        }`}
      >
        <AnimatePresence initial={false}>
          {providers.map((value) => {
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
                      <ProviderIcon
                        provider={value}
                        sizeClassName="h-24 w-24 sm:h-24 sm:w-24"
                        imgClassName={isConnected ? '' : 'grayscale saturate-0 opacity-70'}
                      />
                    </button>
                  ) : (
                    <span className="relative inline-flex">
                      <ProviderIcon
                        provider={value}
                        sizeClassName="h-24 w-24 sm:h-24 sm:w-24"
                        imgClassName={isConnected ? '' : 'grayscale saturate-0 opacity-70'}
                        className="ring-[3px] ring-brand-lime ring-offset-2 ring-offset-app-bg"
                      />
                    </span>
                  )}
                  <AnimatePresence initial={false} mode="wait">
                    {isSelected && isConnected ? (
                      // The check doubles as the way back: with several services
                      // connected, picking one hides the others, so the badge has
                      // to undo the pick or the first click would be final.
                      <motion.button
                        key="check"
                        type="button"
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.7 }}
                        transition={{ duration: 0.18, ease: CREATE_FLOW_STEP_SLIDE_EASE }}
                        onClick={onProviderClear}
                        aria-label={unselectAriaLabel}
                        className="absolute top-3.75 right-3.75 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-app-text bg-brand-lime text-brand-dark shadow-sticker-sm transition hover:bg-brand-pink hover:text-white"
                      >
                        <Check size={15} strokeWidth={4} aria-hidden="true" />
                      </motion.button>
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
