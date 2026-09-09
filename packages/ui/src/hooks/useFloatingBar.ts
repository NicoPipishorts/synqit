import { useEffect, type RefObject } from 'react';

/**
 * Floating bars (bottom docks, sticky action bars) registered here are treated
 * as unusable viewport space by popovers, so a menu never opens underneath one.
 */
const floatingBars = new Set<HTMLElement>();

export type ViewportObstructions = { top: number; bottom: number };

/** Registers a floating bar for as long as the component is mounted. */
export const useFloatingBar = (ref: RefObject<HTMLElement | null>) => {
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return undefined;
    }
    floatingBars.add(element);
    return () => {
      floatingBars.delete(element);
    };
  }, [ref]);
};

/**
 * Pixels of viewport covered by floating bars at each edge, measured live.
 * Bars hidden at the current breakpoint measure as an empty rect and count for
 * nothing.
 */
export const getViewportObstructions = (): ViewportObstructions => {
  const obstructions: ViewportObstructions = { top: 0, bottom: 0 };
  if (typeof window === 'undefined') {
    return obstructions;
  }

  for (const bar of floatingBars) {
    if (!bar.isConnected) {
      floatingBars.delete(bar);
      continue;
    }
    const rect = bar.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      continue;
    }
    const spaceBelow = window.innerHeight - rect.bottom;
    if (rect.top <= spaceBelow) {
      obstructions.top = Math.max(obstructions.top, rect.bottom);
    } else {
      obstructions.bottom = Math.max(obstructions.bottom, window.innerHeight - rect.top);
    }
  }

  return obstructions;
};
