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

// Hand-drawn marker stroke hugging the sheet's bottom edge and wrapping its
// rounded corners. Measured from the real container width so nothing distorts.
const MarkerSeam = ({ width }: { width: number }) => {
  if (width <= 0) return null;
  const radius = cornerRadius(width);
  const height = radius + SIDE_RUN + OUTER_MARGIN + 8;
  const main = buildEdgePath(width, radius, height, 1.6);
  const second = buildEdgePath(width, radius, height - 5, 1.2);
  const pencil = buildEdgePath(width, radius, height - 4, 0.7);

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
      <defs>
        <filter id="marker-rough" x="-2%" y="-10%" width="104%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05 0.9" numOctaves="2" seed="5" />
          <feDisplacementMap
            in="SourceGraphic"
            scale="3"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" filter="url(#marker-rough)">
        <path d={second} stroke="var(--color-brand-lime)" strokeWidth={9} opacity={0.6} />
        <path d={main} stroke="var(--color-brand-lime)" strokeWidth={11} />
        <path d={pencil} stroke="var(--syn-text)" strokeWidth={2} opacity={0.7} />
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

export const MarketingPageShell = ({ children, contentClassName }: MarketingPageShellProps) => {
  const { ref, width } = useElementWidth();

  return (
    <div className="relative bg-brand-dark dark:bg-brand-white">
      <div ref={ref} className="relative z-10">
        <div className="relative overflow-clip rounded-b-[2.75rem] bg-app-bg shadow-[0_34px_64px_-20px_rgba(0,0,0,0.55)] sm:rounded-b-[3.5rem] lg:rounded-b-[4.5rem]">
          <div className={contentClassName ?? 'relative z-10 mx-auto w-full'}>{children}</div>
        </div>
        <MarkerSeam width={width} />
      </div>

      {/* Phones: footer in flow right under the sheet. md+: fixed footer + spacer that reveals it. */}
      <HomeFooterReveal />
      <div aria-hidden className="hidden md:block md:h-96 lg:h-104" />
    </div>
  );
};
