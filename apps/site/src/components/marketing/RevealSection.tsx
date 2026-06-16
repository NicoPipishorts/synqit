import { motion, type Variants } from 'framer-motion';
import { type ReactNode } from 'react';

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

type RevealSectionProps = {
  children: ReactNode;
  className?: string;
  revealOnScroll?: boolean;
};

export const RevealSection = ({
  children,
  className,
  revealOnScroll = true,
}: RevealSectionProps) => {
  if (isTouchDevice) {
    return <section className={className}>{children}</section>;
  }

  if (revealOnScroll) {
    return (
      <motion.section
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
      initial="hidden"
      animate="visible"
      variants={SECTION_REVEAL_VARIANTS}
      className={className}
    >
      {children}
    </motion.section>
  );
};
