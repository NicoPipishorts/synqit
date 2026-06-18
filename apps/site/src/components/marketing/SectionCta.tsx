import { HeroLink } from '../ui/HeroLink';

type SectionCtaProps = {
  href: string;
  variant: 'lime' | 'pink' | 'outline';
  label: string;
  className?: string;
};

export const SectionCta = ({ href, variant, label, className }: SectionCtaProps) => (
  <div className={className ?? 'flex justify-center'}>
    <HeroLink href={href} variant={variant} size="sm">
      {label}
    </HeroLink>
  </div>
);
