import { EventProvider, getEventProviderAsset } from '../../lib/events';
import { CircularImage } from '../ui/CircularImage';

type EventProviderIconProps = {
  provider: EventProvider;
  sizeClassName?: string;
  className?: string;
};

export const EventProviderIcon = ({
  provider,
  sizeClassName = 'h-9 w-9',
  className,
}: EventProviderIconProps) => {
  const { src, alt } = getEventProviderAsset(provider);

  return (
    <CircularImage
      src={src}
      alt={alt}
      sizeClassName={sizeClassName}
      className={`p-1 ${className ?? ''}`.trim()}
    />
  );
};
