/**
 * Which kind of surface the logo sits on. The brand ships two lockups drawn for
 * the two grounds: `logo-full.svg` has a black mark for light surfaces, and
 * `logo-full-dark.svg` draws that same mark in lime for dark ones. Each is
 * near-invisible on the other's ground, so the choice is per-surface, not
 * per-theme — the marketing footer runs `bg-brand-dark` in light and
 * `dark:bg-brand-white` in dark, the inverse of everything else.
 *
 * - `auto` — the surface follows the theme (headers, cards). The default.
 * - `inverted` — the surface flips against the theme, like that footer.
 * - `dark` — always a dark surface whatever the theme, like the admin login
 *   panel's `bg-brand-dark` half.
 */
type BrandLogoSurface = 'auto' | 'inverted' | 'dark';

type BrandLogoProps = {
  className?: string;
  surface?: BrandLogoSurface;
  /**
   * Escape hatch for a one-off mark. Rendered on its own, without the light/dark
   * pair, so `surface` no longer applies.
   *
   * The PNGs beside these two are not fallbacks — they exist for the worker's
   * email templates, which cannot use SVG (Gmail and Outlook strip it).
   */
  src?: string;
  alt?: string;
};

const LIGHT_SURFACE_SRC = '/assets/logos/logo-full.svg';
const DARK_SURFACE_SRC = '/assets/logos/logo-full-dark.svg';

/** `hidden`/`dark:` pair that shows each file on the surface it was drawn for. */
const VISIBILITY: Record<BrandLogoSurface, { light: string; dark: string }> = {
  auto: { light: 'dark:hidden', dark: 'hidden dark:inline' },
  inverted: { light: 'hidden dark:inline', dark: 'dark:hidden' },
  dark: { light: 'hidden', dark: '' },
};

export const BrandLogo = ({ className, surface = 'auto', src, alt = 'Synqit' }: BrandLogoProps) => {
  const sizing = className ?? 'h-8 w-auto';

  if (src) {
    return <img src={src} alt={alt} className={sizing} loading="eager" decoding="async" />;
  }

  const visibility = VISIBILITY[surface];

  return (
    <>
      <img
        src={LIGHT_SURFACE_SRC}
        alt={alt}
        className={`${sizing} ${visibility.light}`.trim()}
        loading="eager"
        decoding="async"
      />
      <img
        src={DARK_SURFACE_SRC}
        alt={alt}
        className={`${sizing} ${visibility.dark}`.trim()}
        loading="eager"
        decoding="async"
      />
    </>
  );
};
