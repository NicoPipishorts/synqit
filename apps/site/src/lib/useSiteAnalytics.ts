import { useEffect, useRef } from 'react';

import { trackSiteEvent } from './analytics';

// Fires `site_page_view` on route changes and accumulates visibility-aware
// "engaged" time, flushed as `site_time_on_page` when the tab is hidden, the
// page unloads, or the visitor navigates to another route.
export const useSiteAnalytics = (pathname: string): void => {
  const accumulatedMsRef = useRef(0);
  const segmentStartRef = useRef<number | null>(null);
  const trackedPathRef = useRef(pathname);
  const lastViewedPathRef = useRef<string | null>(null);

  const startSegmentRef = useRef<() => void>(() => {});
  const flushRef = useRef<() => void>(() => {});

  startSegmentRef.current = () => {
    const isVisible = typeof document === 'undefined' || document.visibilityState === 'visible';
    if (segmentStartRef.current === null && isVisible) {
      segmentStartRef.current = Date.now();
    }
  };

  flushRef.current = () => {
    if (segmentStartRef.current !== null) {
      accumulatedMsRef.current += Date.now() - segmentStartRef.current;
      segmentStartRef.current = null;
    }
    const engagedMs = Math.round(accumulatedMsRef.current);
    accumulatedMsRef.current = 0;
    if (engagedMs > 0) {
      trackSiteEvent({
        eventName: 'site_time_on_page',
        properties: { engagedMs },
        pathOverride: trackedPathRef.current,
      });
    }
  };

  useEffect(() => {
    startSegmentRef.current();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushRef.current();
      } else {
        startSegmentRef.current();
      }
    };
    const onPageHide = () => flushRef.current();

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      flushRef.current();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  useEffect(() => {
    if (trackedPathRef.current !== pathname) {
      flushRef.current();
      trackedPathRef.current = pathname;
      startSegmentRef.current();
    }

    if (lastViewedPathRef.current !== pathname) {
      lastViewedPathRef.current = pathname;
      trackSiteEvent({ eventName: 'site_page_view', pathOverride: pathname });
    }
  }, [pathname]);
};
