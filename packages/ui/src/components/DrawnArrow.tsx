import { animate, motion, useMotionValue } from 'framer-motion';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { cn } from '../utils/cn';

/**
 * The hand-drawn branch the marketing site runs between its cards, in a form
 * the app can reuse: a wavy line that draws itself with a chevron riding the
 * tip and settling on arrival. Replays whenever `replayKey` changes, so a
 * picker can hand it the current selection and let the line answer.
 *
 * The line is measured and drawn in pixel units (1 user unit = 1px) rather
 * than stretched from a fixed viewBox: the column it sits in is elastic, and
 * scaling a viewBox into it would shrink the arrowhead into a blob against the
 * fixed stroke weight.
 */

const HEIGHT = 48;
const MID = 24;
const AMPLITUDE = 8;
/** Curve that eases the last wave back to level before the head. */
const RUN_IN = 16;
/**
 * Dead-straight stretch after it. Without this the line is still turning where
 * the head sits, and a head facing that tangent reads as hooked onto the end
 * rather than square on it — however exactly its vertex is placed.
 */
const RUN_FLAT = 12;
const TAIL_ROOM = 6;
const HEAD_ROOM = 12;
/**
 * Drawn with its vertex on the origin and the arms trailing behind, then placed
 * by hand on the line's tip. CSS `offset-path` would ride the head by the
 * centre of its own box, which is half a head behind the vertex — the chevron
 * ends up floating past the end of the line, and `offset-anchor` did not move
 * it back.
 */
const ARROWHEAD_D = 'M-11 -7 L0 0 L-11 7';

const buildWave = (width: number): string => {
  const from = TAIL_ROOM;
  const to = Math.max(from + 40, width - HEAD_ROOM);
  const waveTo = to - RUN_IN - RUN_FLAT;
  const span = waveTo - from;
  const humps = Math.max(2, Math.round(span / 46));
  const step = span / humps;

  let d = `M${from} ${MID}`;
  for (let index = 0; index < humps; index += 1) {
    const x0 = from + index * step;
    const x1 = x0 + step;
    const peak = MID + (index % 2 === 0 ? -1 : 1) * AMPLITUDE * 1.33;
    d += ` C${(x0 + step * 0.36).toFixed(1)} ${peak.toFixed(1)}, ${(x1 - step * 0.36).toFixed(1)} ${peak.toFixed(1)}, ${x1.toFixed(1)} ${MID}`;
  }
  // Carry the last arch's exit into level before the head: a tangent that only
  // turns level at the final point still reads as arriving at an angle.
  const exit = (humps - 1) % 2 === 0 ? 1 : -1;
  const flatFrom = waveTo + RUN_IN;
  d += ` C${(waveTo + RUN_IN * 0.45).toFixed(1)} ${(MID + exit * 6).toFixed(1)}, ${(flatFrom - RUN_IN * 0.25).toFixed(1)} ${MID}, ${flatFrom.toFixed(1)} ${MID}`;
  d += ` L${to} ${MID}`;
  return d;
};

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export type DrawnArrowProps = {
  /** Changing this redraws the line. */
  replayKey?: string | number;
  /** Accessible name; omit to leave the arrow decorative. */
  label?: string;
  /** Any CSS colour, e.g. a service's own. Defaults to the inherited one. */
  color?: string;
  /** Sets the width: the line is measured, so it draws to whatever it is given. */
  className?: string;
};

export const DrawnArrow = ({ replayKey, label, color, className }: DrawnArrowProps) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const lineRef = useRef<SVGPathElement | null>(null);
  const headRef = useRef<SVGGElement | null>(null);
  const [measured, setMeasured] = useState(0);

  useEffect(() => {
    const node = svgRef.current;
    if (!node) {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      setMeasured(Math.round(entry.contentRect.width));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const width = Math.max(measured, 96);
  const path = buildWave(width);

  // One source of truth for the line and the head, so the head can never drift
  // off the tip the way two separately timed animations would.
  const progress = useMotionValue(1);
  const settle = useMotionValue(1);

  /** Puts the head's vertex on the point the line has drawn to, facing along it. */
  const placeHead = (value: number) => {
    const line = lineRef.current;
    const head = headRef.current;
    if (!line || !head) {
      return;
    }
    const length = line.getTotalLength();
    if (length === 0) {
      return;
    }
    const at = line.getPointAtLength(length * value);
    // A point just behind gives the tangent to face along.
    const behind = line.getPointAtLength(Math.max(0, length * value - 1));
    const angle = (Math.atan2(at.y - behind.y, at.x - behind.x) * 180) / Math.PI;
    head.setAttribute('transform', `translate(${at.x} ${at.y}) rotate(${angle})`);
  };

  useEffect(() => {
    const unsubscribe = progress.on('change', placeHead);
    if (prefersReducedMotion()) {
      progress.set(1);
      placeHead(1);
      return unsubscribe;
    }
    progress.set(0);
    placeHead(0);
    settle.set(1);
    const runs = [
      animate(progress, 1, { duration: 0.55, ease: [0.32, 0.8, 0.36, 1] }),
      animate(settle, [1, 1.25, 0.95, 1.05, 1], { delay: 0.45, duration: 0.5 }),
    ];
    return () => {
      runs.forEach((run) => run.stop());
      unsubscribe();
    };
    // placeHead reads refs only; re-running it on every render would restart
    // the draw.
     
  }, [replayKey, progress, settle]);

  // The column is elastic: when it resizes the line is rebuilt, so the head has
  // to be replaced on the new geometry rather than left on the old one's tip.
  useLayoutEffect(() => {
    placeHead(progress.get());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return (
    <svg
      ref={svgRef}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      viewBox={`0 0 ${width} ${HEIGHT}`}
      style={color ? { color } : undefined}
      className={cn('h-12 text-app-text', className)}
    >
      <motion.path
        ref={lineRef}
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={3.5}
        strokeLinecap="round"
        style={{ pathLength: progress }}
      />
      <g ref={headRef}>
        <motion.path
          d={ARROWHEAD_D}
          fill="none"
          stroke="currentColor"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          // Without fill-box the origin is the middle of the viewBox, so the
          // pulse would swing the head across the drawing instead of breathing
          // in place.
          style={{ scale: settle, transformBox: 'fill-box', transformOrigin: 'center' }}
        />
      </g>
    </svg>
  );
};
