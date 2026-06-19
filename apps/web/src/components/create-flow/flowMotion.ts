import type { Variants } from 'framer-motion';

export const CREATE_FLOW_STEP_SLIDE_EASE = [0.16, 1, 0.3, 1] as const;

export const CREATE_FLOW_BREADCRUMB_LAYOUT_TRANSITION = {
  type: 'spring',
  stiffness: 430,
  damping: 36,
  mass: 0.82,
} as const;

export const CREATE_FLOW_STEP_ACTIONS_LAYOUT_TRANSITION = {
  type: 'spring',
  stiffness: 420,
  damping: 34,
  mass: 0.8,
} as const;

export const CREATE_FLOW_STEP_SLIDE_VARIANTS: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? 52 : -52,
  }),
  center: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3,
      ease: CREATE_FLOW_STEP_SLIDE_EASE,
    },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? -52 : 52,
    transition: {
      duration: 0.22,
      ease: CREATE_FLOW_STEP_SLIDE_EASE,
    },
  }),
};
