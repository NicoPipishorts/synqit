import { PageBackdrop } from '@synqit/ui';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import { HomeFooterReveal } from './HomeFooterReveal';

type MarketingPageShellProps = {
  children: ReactNode;
  contentClassName?: string;
};

// Bottom corner radius of the page sheet per breakpoint (matches the rounded-b-*
// classes below): 2.75rem / 3.5rem / 4.5rem.
const cornerRadius = (width: number) => (width >= 1024 ? 72 : width >= 640 ? 56 : 44);

// How far the marker runs up the sides past the corners, and how much room the
// svg keeps below the stroke's centreline (the half that hangs over the footer).
const SIDE_RUN = 28;
const OUTER_MARGIN = 18;

// Deterministic wobble, so the stroke never changes between renders.
const wobble = (i: number, amp: number) =>
  (Math.sin(i * 12.9898) * 0.5 + Math.sin(i * 78.233) * 0.5) * amp;

// Traces the sheet's bottom edge: down the left side, around the left corner,
// along the bottom, around the right corner, up the right side.
const buildEdgePath = (width: number, radius: number, height: number, amp: number) => {
  const edgeY = height - OUTER_MARGIN;
  const points: [number, number][] = [];
  const push = (x: number, y: number, i: number) => {
    points.push([x + wobble(i, amp), y + wobble(i + 0.37, amp)]);
  };

  let i = 0;
  // left side run
  const sideSteps = 3;
  for (let s = 0; s <= sideSteps; s++, i++) {
    push(0, edgeY - radius - SIDE_RUN + (SIDE_RUN * s) / sideSteps, i);
  }
  // left corner (180° → 90°)
  const arcSteps = 9;
  for (let s = 1; s <= arcSteps; s++, i++) {
    const a = Math.PI - (Math.PI / 2) * (s / arcSteps);
    push(radius + radius * Math.cos(a), edgeY - radius + radius * Math.sin(a), i);
  }
  // bottom run
  const bottomSteps = Math.max(8, Math.round((width - radius * 2) / 90));
  for (let s = 1; s < bottomSteps; s++, i++) {
    push(radius + ((width - radius * 2) * s) / bottomSteps, edgeY, i);
  }
  // right corner (90° → 0°)
  for (let s = 0; s <= arcSteps; s++, i++) {
    const a = Math.PI / 2 - (Math.PI / 2) * (s / arcSteps);
    push(width - radius + radius * Math.cos(a), edgeY - radius + radius * Math.sin(a), i);
  }
  // right side run
  for (let s = 1; s <= sideSteps; s++, i++) {
    push(width, edgeY - radius - (SIDE_RUN * s) / sideSteps, i);
  }

  return points
    .map(([x, y], idx) => `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ');
};

// Highlighter stroke hugging the sheet's bottom edge and wrapping its rounded
// corners. Measured from the real container width so nothing distorts.
const MarkerSeam = ({ width }: { width: number }) => {
  if (width <= 0) return null;
  const radius = cornerRadius(width);
  const height = radius + SIDE_RUN + OUTER_MARGIN + 8;
  const main = buildEdgePath(width, radius, height, 0.6);
  const second = buildEdgePath(width, radius, height - 4, 0.5);

  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="pointer-events-none absolute left-0 z-20"
      // The stroke's centreline is OUTER_MARGIN above the svg's bottom; hanging the svg
      // that far below the sheet puts the line exactly on the edge: half white, half footer.
      style={{ bottom: -OUTER_MARGIN, overflow: 'visible' }}
    >
      {/* Two soft highlighter passes, no roughening: smooth like the title highlight. */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={second} stroke="var(--color-brand-lime)" strokeWidth={10} opacity={0.55} />
        <path d={main} stroke="var(--color-brand-lime)" strokeWidth={14} opacity={0.92} />
      </g>
    </svg>
  );
};

const useElementWidth = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => setWidth(Math.round(node.getBoundingClientRect().width));
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
};

// True once the bottom spacer (the area the fixed footer shows through) is within
// a screen of the viewport, so the footer is only painted when it is about to be seen.
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

// The spacer has to be at least as tall as the footer plus the corner overlap it
// is tucked under, or the footer's top simply never clears the sheet — it was
// hard-coded at 35rem while the footer stood 41rem, so its logo, blurb and
// service row sat behind the sheet at every scroll position. Measured instead of
// guessed, so it keeps up as rows are added to the footer.
const useFooterHeight = () => {
  const ref = useRef<HTMLElement | null>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => setHeight(Math.round(node.getBoundingClientRect().height));
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, height };
};

export const MarketingPageShell = ({ children, contentClassName }: MarketingPageShellProps) => {
  const { ref, width } = useElementWidth();
  const { ref: spacerRef, near } = useNearBottom();
  const { ref: footerRef, height: footerHeight } = useFooterHeight();

  return (
    <div className="relative">
      <div ref={ref} className="relative z-10">
        <div className="relative overflow-clip rounded-b-[2.75rem] bg-app-bg shadow-[0_34px_64px_-20px_rgba(0,0,0,0.55)] sm:rounded-b-[3.5rem] lg:rounded-b-[4.5rem]">
          <PageBackdrop />
          <div className={contentClassName ?? 'relative z-10 mx-auto w-full'}>{children}</div>
        </div>
        <MarkerSeam width={width} />
      </div>

      {/* Fixed footer behind the sheet, revealed as the spacer scrolls into view. The
          spacer carries the dark surface so the sheet's rounded corners cut into it. */}
      <HomeFooterReveal ref={footerRef} visible={near} />
      <div
        ref={spacerRef}
        aria-hidden
        style={footerHeight > 0 ? { height: footerHeight + cornerRadius(width) } : undefined}
        className="-mt-[2.75rem] h-[calc(35rem+2.75rem)] bg-brand-dark dark:bg-brand-white sm:-mt-[3.5rem] sm:h-[calc(24rem+3.5rem)] lg:-mt-[4.5rem] lg:h-[calc(26rem+4.5rem)]"
      />
    </div>
  );
};
