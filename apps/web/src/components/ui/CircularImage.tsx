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
}: CircularImageProps) => {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border border-app-border bg-app-elevated shadow-soft-lift ${sizeClassName} ${className ?? ''}`.trim()}
    >
      <img
        src={src}
        alt={alt}
        className={`h-full w-full rounded-full object-cover ${imgClassName ?? ''}`.trim()}
      />
    </span>
  );
};
