import type { Provider } from '@synqit/shared';
import {
  CircularImage,
  getServiceMarkSrc,
  isMonochromeServiceMark,
  MUSIC_SERVICES,
  ServiceLogo,
} from '@synqit/ui';

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
 *
 * Coloured marks fill the circle like an avatar. A monochrome mark (TIDAL) is a wide shape
 * with no background of its own: drawn full-bleed its tips touch the rim and read as
 * off-centre, and as a black PNG it vanishes on the dark card. So it goes through the masked
 * `ServiceLogo`, inset inside the same circle and painted with the text colour. Its box is
 * centred to the pixel, but three diamonds over one put the visual weight above the box
 * centre, so it is nudged down a little to read as centred.
 */
export const ProviderIcon = ({
  provider,
  sizeClassName = 'h-9 w-9',
  className,
  imgClassName,
}: ProviderIconProps) => {
  if (isMonochromeServiceMark(provider)) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full border-2 border-app-text bg-app-elevated text-app-text shadow-sticker-sm dark:bg-app-card ${sizeClassName} ${className ?? ''}`.trim()}
      >
        <ServiceLogo
          service={provider}
          alt={MUSIC_SERVICES[provider].name}
          className={`h-[68%] w-[68%] translate-y-[5%] ${imgClassName ?? ''}`.trim()}
        />
      </span>
    );
  }

  return (
    <CircularImage
      src={getServiceMarkSrc(provider)}
      alt={MUSIC_SERVICES[provider].name}
      sizeClassName={sizeClassName}
      className={`p-1 ${className ?? ''}`.trim()}
      imgClassName={imgClassName}
    />
  );
};
