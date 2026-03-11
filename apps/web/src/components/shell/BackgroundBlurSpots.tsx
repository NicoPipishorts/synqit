import { useRef } from 'react';

const SPOT_COLORS = [
  'rgba(198,255,0,0.22)',
  'rgba(255,46,139,0.22)',
  'rgba(125,211,252,0.22)',
  'rgba(252,211,77,0.18)',
];

function randomSpots(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `spot-${i}`,
    size: 190 + Math.floor(Math.random() * 100),
    top: 5 + Math.floor(Math.random() * 88),
    left: Math.floor(Math.random() * 100),
    color: SPOT_COLORS[i % SPOT_COLORS.length],
  }));
}

// Reusable spot layer used by both BackgroundBlurSpots and AuthBlurSpots.
// All spots share a single SVG filter so the browser composites one GPU layer
// regardless of spot count — dramatically cheaper than per-element filter:blur().
export const BlurSpotLayer = ({
  filterId,
  spots,
  className,
}: {
  filterId: string;
  spots: { id: string; size: number; top: number; left: number; color: string }[];
  className?: string;
}) => (
  <div aria-hidden="true" className={className}>
    <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
      <defs>
        <filter id={filterId}>
          <feGaussianBlur stdDeviation="45" />
        </filter>
      </defs>
    </svg>
    <div style={{ filter: `url(#${filterId})`, position: 'absolute', inset: 0 }}>
      {spots.map((spot) => (
        <span
          key={spot.id}
          style={{
            position: 'absolute',
            top: `${spot.top}%`,
            left: `${spot.left}%`,
            width: `${spot.size}px`,
            height: `${spot.size}px`,
            borderRadius: '50%',
            backgroundColor: spot.color,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
    </div>
  </div>
);

export const BackgroundBlurSpots = () => {
  // useRef keeps positions stable across re-renders without causing re-randomization
  const spots = useRef(randomSpots(6)).current;

  return (
    <BlurSpotLayer
      filterId="bg-blur-filter"
      spots={spots}
      className="pointer-events-none absolute inset-x-0 bottom-0 top-[88px] z-0 sm:top-[124px]"
    />
  );
};
