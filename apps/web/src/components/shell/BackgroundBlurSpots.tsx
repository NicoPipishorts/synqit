import { useMemo } from 'react';

const BLUR_SPOT_COLORS = [
  'bg-brand-lime/20',
  'bg-brand-pink/20',
  'bg-sky-300/20',
  'bg-amber-300/15',
] as const;

export const BackgroundBlurSpots = () => {
  const blurSpots = useMemo(() => {
    return Array.from({ length: 10 }, (_, index) => {
      const size = 150 + Math.floor(Math.random() * 180);
      const blur = 72 + Math.floor(Math.random() * 48);
      const top = Math.floor(Math.random() * 95);
      const left = Math.floor(Math.random() * 100);
      const colorClass = BLUR_SPOT_COLORS[index % BLUR_SPOT_COLORS.length];

      return {
        id: `global-spot-${index}`,
        size,
        blur,
        top,
        left,
        colorClass,
      };
    });
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 top-[88px] z-0 sm:top-[124px]"
    >
      {blurSpots.map((spot) => (
        <span
          key={spot.id}
          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${spot.colorClass}`}
          style={{
            top: `${spot.top}%`,
            left: `${spot.left}%`,
            width: `${spot.size}px`,
            height: `${spot.size}px`,
            filter: `blur(${spot.blur}px)`,
          }}
        />
      ))}
    </div>
  );
};
