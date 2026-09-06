import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

import { lightVariant, ThemedScreen } from './ThemedScreen';

type HeroScreensProps = {
  /** Phone screenshots (9:19.5), shown in order and looped. */
  images: string[];
  /** Accessible captions, one per image. */
  captions: string[];
  intervalMs?: number;
  className?: string;
};

// Phone tilt per screen: the frame swings to a new angle with every swap.
const TILTS = [-3, 2.5, -4.5, 3.5, -2];
const LIFTS = [0, -8, 4, -6, 2];

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Framed phone that crossfades through real app screens. Images are pre-warmed
// so the first swap never flashes; reduced-motion users get a single still.
export const HeroScreens = ({
  images,
  captions,
  intervalMs = 3600,
  className,
}: HeroScreensProps) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    images.forEach((src) => {
      for (const variant of [src, lightVariant(src)]) {
        const img = new Image();
        img.src = variant;
      }
    });
  }, [images]);

  useEffect(() => {
    if (images.length < 2 || prefersReducedMotion()) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % images.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [images.length, intervalMs]);

  const still = prefersReducedMotion();

  return (
    <motion.div
      animate={
        still ? undefined : { rotate: TILTS[index % TILTS.length], y: LIFTS[index % LIFTS.length] }
      }
      initial={{ rotate: TILTS[0], y: LIFTS[0] }}
      transition={{ type: 'spring', stiffness: 55, damping: 15, mass: 0.9 }}
      className={`relative rounded-[2.9rem] border-[3px] border-app-text bg-app-bg p-1.5 shadow-[6px_6px_0_0_var(--syn-text)] ${className ?? ''}`.trim()}
    >
      <div className="relative aspect-[9/19.5] overflow-hidden rounded-[2.4rem] bg-app-card">
        {images.map((src, i) => (
          <ThemedScreen
            key={src}
            src={src}
            alt={i === index ? (captions[i] ?? '') : ''}
            hidden={i !== index}
            eager={i === 0}
            initial={false}
            animate={{ opacity: i === index ? 1 : 0, scale: i === index ? 1 : 1.03 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
            style={{ zIndex: i === index ? 2 : 1 }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ))}
      </div>
    </motion.div>
  );
};
