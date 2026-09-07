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
              className={`relative inline-flex items-center justify-center overflow-hidden rounded-full border-2 text-xs font-black uppercase tracking-[0.08em] transition sm:text-sm ${
                isActive ? 'h-9 px-3.5 sm:h-10 sm:px-4' : 'h-9 w-9 sm:h-10 sm:w-10'
              } ${
                isActive
                  ? 'border-app-text text-brand-dark shadow-sticker-sm'
                  : isClickable
                    ? 'cursor-pointer border-app-text bg-app-elevated text-app-text shadow-sticker-sm hover:bg-brand-lime hover:text-brand-dark dark:bg-app-card'
                    : 'cursor-not-allowed border-dashed border-app-text/40 bg-transparent text-app-text-muted'
              }`}
            >
              {isActive ? (
                <motion.span
                  layoutId={activeLayoutId}
                  transition={CREATE_FLOW_BREADCRUMB_LAYOUT_TRANSITION}
                  className="absolute inset-0 rounded-full bg-brand-lime"
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
