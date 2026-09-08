import { HERO_CUE_BRANCH_D, HERO_CUE_VIEWBOX, VERTICAL_ARROWHEAD_D } from './branch-art';

/**
 * The line running from the hero's CTAs down toward the first section, on phones,
 * where the hero fills the viewport and nothing else shows the page carries on.
 *
 * Same artwork as the branch from the service deck to the phone in the showcase,
 * only longer — the page uses one arrow, not two that nearly match. It draws once
 * on arrival and stays. Its tail hangs past what the hero's centring measures, so
 * the line reaches down the page without dragging the copy up with it.
 */
export const HeroScrollCue = ({ label }: { label: string }) => {
  const { width, height } = HERO_CUE_VIEWBOX;

  return (
    <a
      href="#how"
      aria-label={label}
      className="focus-ring-brand -mb-45 mt-1 block w-12 text-app-text transition hover:text-brand-pink sm:hidden"
    >
      <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="h-60 w-12">
        <path
          className="hero-cue-line"
          d={HERO_CUE_BRANCH_D}
          pathLength={1}
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
          strokeLinecap="round"
        />
        {/* No transform: `offset-path` places and turns it, so the head is wherever
            the line currently reaches and pointed the way the line is heading. */}
        <g className="hero-cue-head" style={{ offsetPath: `path("${HERO_CUE_BRANCH_D}")` }}>
          <path
            d={VERTICAL_ARROWHEAD_D}
            fill="currentColor"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </a>
  );
};
