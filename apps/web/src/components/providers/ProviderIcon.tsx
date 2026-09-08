import type { Provider } from '@synqit/shared';
import { CircularImage, getServiceMarkSrc, MUSIC_SERVICES } from '@synqit/ui';

type ProviderIconProps = {
  provider: Provider;
  sizeClassName?: string;
  className?: string;
  imgClassName?: string;
};

/**
 * Round brand mark for a connected service, used by the event, sync and transfer surfaces.
 * The mark and the accessible name come from the shared catalogue, so a new provider needs
 * no change here.
 */
export const ProviderIcon = ({
  provider,
  sizeClassName = 'h-9 w-9',
  className,
  imgClassName,
}: ProviderIconProps) => (
  <CircularImage
    src={getServiceMarkSrc(provider)}
    alt={MUSIC_SERVICES[provider].name}
    sizeClassName={sizeClassName}
    className={`p-1 ${className ?? ''}`.trim()}
    imgClassName={imgClassName}
  />
);
