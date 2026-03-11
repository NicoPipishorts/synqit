// All spots are children of a single container that holds the SVG blur filter.
// The browser composites exactly one layer regardless of spot count,
// which is dramatically cheaper than per-element filter:blur() on iOS Safari.
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
