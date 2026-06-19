import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';

import {
  CREATE_FLOW_BREADCRUMB_LAYOUT_TRANSITION,
  CREATE_FLOW_STEP_SLIDE_EASE,
} from './flowMotion';

type CreateFlowStepBreadcrumbItem<TStep extends number> = {
  value: TStep;
  label: string;
};

type CreateFlowStepBreadcrumbsProps<TStep extends number> = {
  activeLayoutId: string;
  currentStep: TStep;
  items: readonly CreateFlowStepBreadcrumbItem<TStep>[];
  layoutGroupId: string;
  canOpenStep: (step: TStep) => boolean;
  onStepChange: (step: TStep) => void;
};

export const CreateFlowStepBreadcrumbs = <TStep extends number>({
  activeLayoutId,
  currentStep,
  items,
  layoutGroupId,
  canOpenStep,
  onStepChange,
}: CreateFlowStepBreadcrumbsProps<TStep>) => {
  return (
    <LayoutGroup id={layoutGroupId}>
      <div className="mt-2 mb-5 flex w-full flex-wrap items-center justify-center gap-2 sm:gap-3">
        {items.map((item) => {
          const isActive = currentStep === item.value;
          const isClickable = canOpenStep(item.value);

          return (
            <motion.button
              key={item.value}
              type="button"
              layout
              transition={CREATE_FLOW_BREADCRUMB_LAYOUT_TRANSITION}
              disabled={!isClickable || isActive}
              onClick={() => onStepChange(item.value)}
              className={`relative inline-flex items-center justify-center overflow-hidden rounded-full border text-xs font-black transition sm:text-sm ${
                isActive ? 'h-8 px-3 sm:h-9 sm:px-3.5' : 'h-8 w-8 sm:h-9 sm:w-9'
              } ${
                isActive
                  ? 'border-brand-lime/50 text-brand-dark dark:text-brand-white'
                  : isClickable
                    ? 'cursor-pointer border-app-border bg-app-elevated text-app-text hover:border-brand-lime dark:bg-app-card'
                    : 'cursor-not-allowed border-app-border bg-app-bg text-app-text-secondary opacity-60 dark:bg-app-elevated'
              }`}
            >
              {isActive ? (
                <motion.span
                  layoutId={activeLayoutId}
                  transition={CREATE_FLOW_BREADCRUMB_LAYOUT_TRANSITION}
                  className="absolute inset-0 rounded-full bg-brand-lime/10"
                />
              ) : null}
              <span className="relative z-10 inline-flex items-center">
                <span>{isActive ? `0${item.value}` : item.value}</span>
                <AnimatePresence initial={false}>
                  {isActive ? (
                    <motion.span
                      key={`label-${item.value}`}
                      initial={{ width: 0, opacity: 0, x: -6 }}
                      animate={{ width: 'auto', opacity: 1, x: 0 }}
                      exit={{ width: 0, opacity: 0, x: 6 }}
                      transition={{ duration: 0.22, ease: CREATE_FLOW_STEP_SLIDE_EASE }}
                      className="ml-1 overflow-hidden whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </span>
            </motion.button>
          );
        })}
      </div>
    </LayoutGroup>
  );
};
