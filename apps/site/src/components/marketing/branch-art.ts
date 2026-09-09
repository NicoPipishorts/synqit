/**
 * Geometry for the hand-drawn vertical branch — the wavy line that runs from the
 * service deck down to the phone in the showcase, and from the hero's CTAs down
 * to the first section on a phone.
 *
 * Shared rather than copied so the two never drift: same wobble, same weight,
 * same head. Each place brings its own animation, because the showcase draws it
 * once per swipe while the hero loops it as a scroll cue.
 */
export const VERTICAL_BRANCH_D = 'M24 8 C12 24, 36 40, 24 56 C15 68, 33 76, 24 84 L24 96';

/** Where the line ends, so a head can be parked on the tip. */
export const VERTICAL_BRANCH_TIP = { x: 24, y: 96 } as const;

/**
 * Points along +x with its vertex on the origin, so the tip rides the path
 * instead of leaving a gap where the line stops. Small and solid with a concave
 * back: an open chevron reads as an oversized nib over this short a line.
 */
export const VERTICAL_ARROWHEAD_D = 'M3 0 L-8.5 -6.5 Q-5.5 0 -8.5 6.5 Z';

/** The viewBox both the showcase branch and the hero cue draw into. */
export const VERTICAL_BRANCH_VIEWBOX = { width: 48, height: 112 } as const;

/**
 * The hero's cue is drawn to fit, not scaled to fit.
 *
 * A fixed path stretched to a band gets a fatter stroke on a tall phone and a
 * thinner one on a short phone, and a fixed pixel length overshoots into the next
 * section on anything short. So the wobbles stay 48 apart with a 4-wide stroke on
 * every screen, and the line simply carries however many of them the space holds
 * before running straight into the tip.
 *
 * Each wobble is a full S. The last one arrives vertical — its second control
 * point sits above its end — so the straight run continues it without a kink. The
 * run is what absorbs the remainder, which also keeps the endpoint below the last
 * curve's end: pulling it above makes the stroke double back and poke a barb out
 * past the arrowhead.
 */
const WOBBLE = 48;
const START = 8;
/** Room below the tip for the head, which rides the path and overhangs its end. */
const HEAD_ROOM = 16;
const MIN_RUN = 12;

export type HeroCuePath = { d: string; height: number };

/** `null` when the band is too short to carry even one wobble — draw nothing. */
export const buildHeroCuePath = (available: number): HeroCuePath | null => {
  const usable = Math.round(available) - HEAD_ROOM;
  const span = usable - START;
  if (span < WOBBLE + MIN_RUN) {
    return null;
  }

  const wobbles = Math.max(1, Math.floor((span - MIN_RUN) / WOBBLE));
  let y = START;
  let d = `M24 ${START}`;
  for (let i = 0; i < wobbles; i += 1) {
    const last = i === wobbles - 1;
    d += last
      ? ` C12 ${y + 16}, 24 ${y + 36}, 24 ${y + WOBBLE}`
      : ` C12 ${y + 16}, 36 ${y + 32}, 24 ${y + WOBBLE}`;
    y += WOBBLE;
  }

  return { d: `${d} L24 ${usable}`, height: usable + HEAD_ROOM };
};

/** The viewBox is a fixed 48 wide; the height comes from the path that was built. */
export const HERO_CUE_WIDTH = 48;
