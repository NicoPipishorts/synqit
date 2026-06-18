import { motion, type Variants } from 'framer-motion';
import { type ReactNode, useCallback, useRef } from 'react';

import { trackSiteEvent } from '../../lib/analytics';
import { isTouchDevice } from '../../lib/motion';

const SECTION_REVEAL_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 32, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

// Returns a callback ref that fires `site_section_viewed` once, the first time
// the section scrolls into view. Works for both the animated and touch branches.
const useSectionViewRef = (trackId?: string) => {
  const hasFiredRef = useRef(false);

  return useCallback(
    (node: HTMLElement | null) => {
      if (!node || !trackId || hasFiredRef.current) {
        return;
      }

      const fire = () => {
        if (hasFiredRef.current) {
          return;
        }
        hasFiredRef.current = true;
        trackSiteEvent({ eventName: 'site_section_viewed', properties: { section: trackId } });
      };

      if (typeof IntersectionObserver === 'undefined') {
        fire();
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            fire();
            observer.disconnect();
          }
        },
        { threshold: 0.3 },
      );
      observer.observe(node);
    },
    [trackId],
  );
};

type RevealSectionProps = {
  children: ReactNode;
  className?: string;
  revealOnScroll?: boolean;
  trackId?: string;
};

export const RevealSection = ({
  children,
  className,
  revealOnScroll = true,
  trackId,
}: RevealSectionProps) => {
  const sectionViewRef = useSectionViewRef(trackId);

  if (isTouchDevice) {
    return (
      <section ref={sectionViewRef} className={className}>
        {children}
      </section>
    );
  }

  if (revealOnScroll) {
    return (
      <motion.section
        ref={sectionViewRef}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1, margin: '0px 0px -10% 0px' }}
        variants={SECTION_REVEAL_VARIANTS}
        className={className}
      >
        {children}
      </motion.section>
    );
  }

  return (
    <motion.section
      ref={sectionViewRef}
      initial="hidden"
      animate="visible"
      variants={SECTION_REVEAL_VARIANTS}
      className={className}
    >
      {children}
    </motion.section>
  );
};
