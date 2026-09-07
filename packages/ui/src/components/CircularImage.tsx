import { cn } from '../utils/cn';

type CircularImageProps = {
  src: string;
  alt: string;
  sizeClassName?: string;
  className?: string;
  imgClassName?: string;
};

export const CircularImage = ({
  src,
  alt,
  sizeClassName = 'h-10 w-10',
  className,
  imgClassName,
}: CircularImageProps) => (
  <span
    className={cn(
      'inline-flex items-center justify-center rounded-full border-2 border-app-text bg-app-elevated shadow-sticker-sm dark:bg-app-card',
      sizeClassName,
      className,
    )}
  >
    <img
      src={src}
      alt={alt}
      className={cn('h-full w-full rounded-full object-cover', imgClassName)}
    />
  </span>
);
