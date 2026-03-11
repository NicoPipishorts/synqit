const BLUR_SPOT_COLORS = [
  'bg-brand-lime/20',
  'bg-brand-pink/20',
  'bg-sky-300/20',
  'bg-amber-300/15',
] as const;

// Fixed positions avoid re-randomizing on every mount and keep the layout
// predictable across renders. 4 spots instead of 10 keeps compositor layer
// count low enough for iOS Safari to handle without hanging.
const BLUR_SPOTS = [
  { id: 'spot-0', size: 260, blur: 48, top: 15, left: 20, colorClass: BLUR_SPOT_COLORS[0] },
  { id: 'spot-1', size: 240, blur: 48, top: 70, left: 80, colorClass: BLUR_SPOT_COLORS[1] },
  { id: 'spot-2', size: 220, blur: 40, top: 40, left: 60, colorClass: BLUR_SPOT_COLORS[2] },
  { id: 'spot-3', size: 200, blur: 40, top: 80, left: 25, colorClass: BLUR_SPOT_COLORS[3] },
] as const;

export const BackgroundBlurSpots = () => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 top-[88px] z-0 sm:top-[124px]"
    >
      {BLUR_SPOTS.map((spot) => (
        <span
          key={spot.id}
          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${spot.colorClass}`}
          style={{
            top: `${spot.top}%`,
            left: `${spot.left}%`,
            width: `${spot.size}px`,
            height: `${spot.size}px`,
            filter: `blur(${spot.blur}px)`,
            willChange: 'transform',
          }}
        />
      ))}
    </div>
  );
};
