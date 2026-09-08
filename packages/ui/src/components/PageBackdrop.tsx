// Page-wide background texture shared by the site and the app: soft colour washes, a halftone dot grid and a
// paper grain. Everything is plain CSS backgrounds (no blur filters), so it
// stays cheap on phones and never creates extra compositing layers.
//
// No blend modes here, deliberately. These layers span the whole page sheet —
// north of 7000px on a phone — and `mix-blend-mode` on a layer that tall forces
// the compositor into a separate render surface and a readback of everything
// beneath it, which cannot go down the fast path. Scroll quicker than the
// rasteriser and the tiles it has not caught up with paint white. The grain is
// monochrome at a tenth of an alpha, so plain compositing lands within a shade
// of what multiply and screen were doing anyway.

const grain = (rgb: string, alpha: number) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 ${rgb}  0 0 0 0 ${rgb}  0 0 0 0 ${rgb}  0 0 0 ${alpha} 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`,
  )}")`;

const GRAIN_LIGHT = grain('0', 0.1);
const GRAIN_DARK = grain('1', 0.1);

// Colour washes, top to bottom, alternating sides. Positions are in % of the
// full page height so they follow the content rather than the viewport.
const WASHES_LIGHT = [
  'radial-gradient(42rem circle at 88% 22%, rgba(255,46,139,0.16), transparent 68%)',
  'radial-gradient(38rem circle at 6% 40%, rgba(125,211,252,0.26), transparent 68%)',
  'radial-gradient(46rem circle at 92% 58%, rgba(198,255,0,0.30), transparent 68%)',
  'radial-gradient(40rem circle at 10% 78%, rgba(255,46,139,0.14), transparent 68%)',
  'radial-gradient(36rem circle at 70% 92%, rgba(125,211,252,0.22), transparent 68%)',
].join(', ');

const WASHES_DARK = [
  'radial-gradient(42rem circle at 88% 22%, rgba(255,46,139,0.14), transparent 68%)',
  'radial-gradient(38rem circle at 6% 40%, rgba(125,211,252,0.12), transparent 68%)',
  'radial-gradient(46rem circle at 92% 58%, rgba(198,255,0,0.14), transparent 68%)',
  'radial-gradient(40rem circle at 10% 78%, rgba(255,46,139,0.12), transparent 68%)',
  'radial-gradient(36rem circle at 70% 92%, rgba(125,211,252,0.10), transparent 68%)',
].join(', ');

export const PageBackdrop = () => (
  <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
    {/* colour washes */}
    <div className="absolute inset-0 dark:hidden" style={{ backgroundImage: WASHES_LIGHT }} />
    <div className="absolute inset-0 hidden dark:block" style={{ backgroundImage: WASHES_DARK }} />
    {/* dot grid, fading out towards the far bottom where the CTA card and seam live */}
    <div className="bg-halftone absolute inset-0 opacity-80 [mask-image:linear-gradient(to_bottom,black_0%,black_85%,transparent_100%)]" />
    {/* paper grain */}
    <div className="absolute inset-0 dark:hidden" style={{ backgroundImage: GRAIN_LIGHT }} />
    <div className="absolute inset-0 hidden dark:block" style={{ backgroundImage: GRAIN_DARK }} />
  </div>
);
