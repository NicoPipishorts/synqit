import { useEffect, useRef, useState } from 'react';

import { buildHeroCuePath, HERO_CUE_WIDTH, VERTICAL_ARROWHEAD_D } from './branch-art';

/**
 * The line running from the hero's CTAs down toward the first section, on phones,
 * where the hero fills the viewport and nothing else shows the page carries on.
 *
 * A link, not decoration: it goes to the same anchor the secondary CTA does, so
 * the arrow is tappable and a keyboard or screen reader can take it.
 *
 * It measures the band the hero gives it and has the path built to that length,
 * rather than scaling one fixed drawing: the wobbles stay 48 apart with a 4-wide
 * stroke on every screen and the path simply carries as many as the band holds, so
 * a tall phone gets more of the same line rather than a stretched one. Scaling would thicken the stroke on a tall phone
 * and thin it on a short one; a fixed length overshot into the next section. This
 * way every screen gets the same wobble and the same stroke, and only the number
 * of wobbles changes. The svg is absolutely positioned so its own height can never
 * feed back into the band it is measuring.
 */
export const HeroScrollCue = ({ label }: { label: string }) => {
  const ref = useRef<HTMLAnchorElement | null>(null);
  const [available, setAvailable] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // The band is the length. It is already the gap between the CTAs and the next
    // section, so the line runs the whole of it — capping it against a share of the
    // viewport only left the arrowhead hanging short of the space it was given.
    const update = () => setAvailable(Math.round(node.getBoundingClientRect().height));
    update();

    // Both, not either: the observer catches the band changing for reasons the
    // window never hears about (the copy rewrapping, a font landing), and the
    // window events catch rotation and any resize the observer sleeps through.
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(node);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      observer?.disconnect();
    };
  }, []);

  const path = buildHeroCuePath(available);

  return (
    <a
      ref={ref}
      href="#how"
      aria-label={label}
      className="focus-ring-brand relative flex min-h-0 flex-1 justify-center text-app-text transition hover:text-brand-pink"
    >
      {path ? (
        <svg
          viewBox={`0 0 ${HERO_CUE_WIDTH} ${path.height}`}
          width={HERO_CUE_WIDTH}
          height={path.height}
          aria-hidden="true"
          className="absolute inset-x-0 top-0 mx-auto"
        >
          <path
            className="hero-cue-line"
            d={path.d}
            pathLength={1}
            fill="none"
            stroke="currentColor"
            strokeWidth={4}
            strokeLinecap="round"
          />
          {/* No transform: `offset-path` places and turns it, so the head is wherever
              the line currently reaches and pointed the way the line is heading. */}
          <g className="hero-cue-head" style={{ offsetPath: `path("${path.d}")` }}>
            <path
              d={VERTICAL_ARROWHEAD_D}
              fill="currentColor"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          </g>
        </svg>
      ) : null}
    </a>
  );
};
