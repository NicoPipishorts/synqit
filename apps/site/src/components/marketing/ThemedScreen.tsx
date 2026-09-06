import { motion, type MotionProps } from 'framer-motion';
import { type SyntheticEvent } from 'react';

// App screenshots come in a dark version (`<name>.png`) and, when available, a
// light one (`<name>-light.png`). Light mode shows the light grab and dark mode
// the dark one; a missing light file silently falls back to the dark grab.
export const lightVariant = (src: string) => src.replace(/\.png$/, '-light.png');

const fallbackToDark = (dark: string) => (event: SyntheticEvent<HTMLImageElement>) => {
  const img = event.currentTarget;
  if (!img.src.endsWith(dark.split('/').pop() ?? dark)) {
    img.src = dark;
  }
};

type ThemedScreenProps = {
  src: string;
  alt: string;
  hidden?: boolean;
  eager?: boolean;
  className?: string;
  style?: React.CSSProperties;
} & Pick<MotionProps, 'initial' | 'animate' | 'transition'>;

/** Two stacked <img>s (light / dark), both animated the same way. */
export const ThemedScreen = ({
  src,
  alt,
  hidden = false,
  eager = false,
  className,
  style,
  initial,
  animate,
  transition,
}: ThemedScreenProps) => {
  const shared = {
    alt,
    'aria-hidden': hidden || undefined,
    draggable: false,
    fetchPriority: eager ? ('high' as const) : ('auto' as const),
    decoding: 'async' as const,
    initial,
    animate,
    transition,
    style,
  };
  return (
    <>
      <motion.img
        {...shared}
        src={lightVariant(src)}
        onError={fallbackToDark(src)}
        className={`dark:hidden ${className ?? ''}`.trim()}
      />
      <motion.img {...shared} src={src} className={`hidden dark:block ${className ?? ''}`.trim()} />
    </>
  );
};
