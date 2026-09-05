type BrandLogoProps = {
  className?: string;
  /** Defaults to the full logo served from the shared public assets. */
  src?: string;
  alt?: string;
};

export const BrandLogo = ({
  className,
  src = '/assets/logos/logo-full.png',
  alt = 'Synqit',
}: BrandLogoProps) => (
  <img src={src} alt={alt} className={className ?? 'h-8 w-auto'} loading="eager" decoding="async" />
);
