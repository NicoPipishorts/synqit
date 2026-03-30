/**
 * True on touch-primary devices (phones / tablets).
 * `(hover: none)` is the most reliable cross-browser signal for this.
 * Evaluated once at module load — no re-render cost.
 */
export const isTouchDevice =
  typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;
