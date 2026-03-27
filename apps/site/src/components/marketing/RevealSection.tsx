import { motion, type Variants } from 'framer-motion';
import { type ReactNode } from 'react';

const SECTION_REVEAL_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
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
  if (revealOnScroll) {
    return (
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
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
