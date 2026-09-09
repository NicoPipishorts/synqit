import { HERO_CUE_BRANCH_D, HERO_CUE_VIEWBOX, VERTICAL_ARROWHEAD_D } from './branch-art';

/**
 * The line running from the hero's CTAs down toward the first section, on phones,
 * where the hero fills the viewport and nothing else shows the page carries on.
 *
 * Same artwork as the branch from the service deck to the phone in the showcase,
 * only longer — the page uses one arrow, not two that nearly match.
 *
 * It sizes itself to the band the hero gives it rather than to a pixel count: the
 * band is a share of the viewport, the svg fills its height, and the viewBox does
 * the rest, so the line and its stroke scale together and a tall phone and a short
 * one get the same drawing rather than the same number of pixels. Sizing it in
 * pixels put the tip through the next section's heading on anything short.
 */
export const HeroScrollCue = ({ label }: { label: string }) => {
  const { width, height } = HERO_CUE_VIEWBOX;

  return (
    <a
      href="#how"
      aria-label={label}
      className="focus-ring-brand flex h-[clamp(4.5rem,19svh,10.5rem)] shrink-0 items-center justify-center text-app-text transition hover:text-brand-pink"
    >
      <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="h-full w-auto">
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
