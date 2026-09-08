type BrandLogoProps = {
  className?: string;
  /**
   * Defaults to the full logo served from the shared public assets. One lockup
   * for every surface — light, dark, and the marketing footer that inverts
   * against the theme — so there is nothing here to choose between.
   *
   * SVG, because the headers render it up to `h-20` and a raster mark is visibly
   * soft there. The PNG beside it is not a fallback — it exists for the worker's
   * email templates, which cannot use SVG (Gmail and Outlook strip it).
   */
  src?: string;
  alt?: string;
};

export const BrandLogo = ({
  className,
  src = '/assets/logos/logo-full.svg',
  alt = 'Synqit',
}: BrandLogoProps) => (
  <img src={src} alt={alt} className={className ?? 'h-8 w-auto'} loading="eager" decoding="async" />
);
