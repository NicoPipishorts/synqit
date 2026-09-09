import { PageBackdrop } from '@synqit/ui';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import { HomeFooterReveal } from '../marketing/HomeFooterReveal';

// True once the bottom spacer (where the fixed footer shows through) is within a
// screen of the viewport. Until then the footer stays unpainted, so tiles Safari
// has not rasterised yet mid-scroll cannot show it through the page sheet.
const useNearBottom = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => setNear(entries.some((entry) => entry.isIntersecting)),
      { rootMargin: '0px 0px 40% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, near };
};

// Bottom corner radius of the page sheet per breakpoint, matching the rounded-b-*
// classes below: 2.75rem / 3.5rem / 4.5rem.
const cornerRadius = (width: number) => (width >= 1024 ? 72 : width >= 640 ? 56 : 44);

/**
 * The spacer has to be at least as tall as the footer plus the corner overlap it
 * is tucked under, or the footer's top never clears the sheet. Measured rather
 * than guessed, so it keeps up as rows are added to the footer — the phone
 * layout has no fixed height at all.
 */
const useFooterHeight = () => {
  const ref = useRef<HTMLElement | null>(null);
  const [height, setHeight] = useState(0);
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 0 : window.innerWidth));

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => {
      setHeight(Math.round(node.getBoundingClientRect().height));
      setWidth(window.innerWidth);
    };
    update();
    window.addEventListener('resize', update);
    if (typeof ResizeObserver === 'undefined') {
      return () => window.removeEventListener('resize', update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => {
      window.removeEventListener('resize', update);
      observer.disconnect();
    };
  }, []);

  return { ref, height, width };
};

/** Page sheet + backdrop + reveal footer used by the guest-facing magic-link pages. */
export const PublicPageShell = ({ children }: { children: ReactNode }) => {
  const { ref, near } = useNearBottom();
  const { ref: footerRef, height: footerHeight, width } = useFooterHeight();

  return (
    <div className="relative">
      <div className="relative z-10 min-h-[calc(100svh+4.5rem)] overflow-hidden rounded-b-[2.75rem] bg-app-bg shadow-[0_28px_64px_-20px_rgba(0,0,0,0.55)] dark:shadow-[0_30px_70px_-20px_rgba(0,0,0,0.72)] sm:min-h-[calc(100svh+5.5rem)] sm:rounded-b-[3.5rem] lg:min-h-[calc(100svh+7rem)] lg:rounded-b-[4.5rem]">
        <PageBackdrop />
        {children}
      </div>

      <HomeFooterReveal ref={footerRef} visible={near} />
      {/* Dark spacer tucked under the sheet's rounded corners; the footer shows through it. */}
      <div
        ref={ref}
        aria-hidden
        style={footerHeight > 0 ? { height: footerHeight + cornerRadius(width) } : undefined}
        className="-mt-[2.75rem] h-[calc(35rem+2.75rem)] bg-brand-dark dark:bg-brand-white sm:-mt-[3.5rem] sm:h-[calc(24rem+3.5rem)] lg:-mt-[4.5rem] lg:h-[calc(26rem+4.5rem)]"
      />
    </div>
  );
};
