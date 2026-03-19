import { useId } from 'react';

export const DotPatternOverlay = ({ className = '' }: { className?: string }) => {
  const patternId = useId();
  const vignetteId = useId();

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`.trim()}
    >
      <svg
        className="absolute inset-0 h-full w-full text-brand-dark/12 dark:text-brand-white/10"
        width="100%"
        height="100%"
        viewBox="0 0 1200 1200"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id={patternId} width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.6" fill="currentColor" />
          </pattern>
          <radialGradient id={vignetteId} cx="50%" cy="42%" r="68%">
            <stop offset="0%" stopColor="white" stopOpacity="0.95" />
            <stop offset="62%" stopColor="white" stopOpacity="0.3" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
        <rect width="100%" height="100%" fill={`url(#${vignetteId})`} />
      </svg>
    </div>
  );
};
