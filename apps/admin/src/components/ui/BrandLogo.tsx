type BrandLogoProps = {
  className?: string;
};

export const BrandLogo = ({ className }: BrandLogoProps) => (
  <img
    src="/assets/logos/logo-full.png"
    alt="Synqit"
    className={className ?? 'h-8 w-auto'}
    loading="eager"
    decoding="async"
  />
);
