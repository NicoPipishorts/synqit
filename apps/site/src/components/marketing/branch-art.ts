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
 * The hero's cue runs longer than the showcase's branch: it has a whole viewport
 * to cross rather than the gap between a card and a phone, and a short line reads
 * as a tick there instead of a journey.
 *
 * Three full wobbles of 48 each from y=8, then a straight run into the tip —
 * 190 units drawn, an eighth shorter than the four-wobble version it replaces,
 * which ran past where it needed to stop. Every
 * segment has to keep heading *down*: pulling the final `L` above the last curve's
 * end makes the stroke double back, which shows up as a barb past the arrowhead.
 * To shorten it, drop a wobble rather than move the endpoint. The last wobble's
 * second control point sits directly above its end, so the curve arrives vertical
 * and the straight run continues it without a kink.
 */
export const HERO_CUE_BRANCH_D =
  'M24 8 C12 24, 36 40, 24 56 C12 72, 36 88, 24 104 C12 120, 24 140, 24 152 L24 198';

export const HERO_CUE_TIP = { x: 24, y: 198 } as const;

/**
 * 1 user unit = 1px when rendered, so the stroke keeps the branch's weight. The
 * 16 below the tip is room for the head, which rides the path and overhangs its
 * end.
 */
export const HERO_CUE_VIEWBOX = { width: 48, height: 214 } as const;
