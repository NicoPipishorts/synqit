import { buildAppUrl } from '../../lib/app-url';
import { HeroLink } from '../ui/HeroLink';

type AppAuthActionsProps = {
  primaryLabel: string;
  secondaryLabel: string;
  size?: 'md' | 'sm';
  primaryVariant?: 'lime' | 'pink';
  className?: string;
};

export const AppAuthActions = ({
  primaryLabel,
  secondaryLabel,
  size = 'md',
  primaryVariant = 'lime',
  className,
}: AppAuthActionsProps) => (
  <div className={`flex flex-wrap items-center gap-3.5 ${className ?? ''}`.trim()}>
    <HeroLink href={buildAppUrl('/auth/register')} variant={primaryVariant} size={size}>
      {primaryLabel}
    </HeroLink>
    <HeroLink href={buildAppUrl('/auth/login')} variant="outline" size={size}>
      {secondaryLabel}
    </HeroLink>
  </div>
);
