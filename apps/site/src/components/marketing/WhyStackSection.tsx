import { motion, type MotionValue, useScroll, useSpring, useTransform } from 'framer-motion';
import { type ComponentType, useRef } from 'react';

import { AccentInfoCard, type AccentTone } from './AccentInfoCard';
import { DesktopShareBackdrop, MobileShareBackdrop } from './HeroMockup';
import { type Icon3DProps } from './Icon3D';
import { SectionCta } from './SectionCta';
import { SectionHeading } from './SectionHeading';
import { isTouchDevice } from '../../lib/motion';

export type StackReason = {
  number: string;
  icon: ComponentType<Icon3DProps>;
  title: string;
  body: string;
  accent: AccentTone;
};

type WhyStackSectionProps = {
  title: string;
  description: string;
  cards: StackReason[];
  ctaHref: string;
  ctaLabel: string;
};

const SECTION_SHELL =
  'relative overflow-hidden border-t border-app-border/60 bg-[linear-gradient(160deg,rgba(255,46,139,0.08)_0%,transparent_45%,rgba(198,255,0,0.07)_100%)]';

const AccentBar = () => (
  <div
    aria-hidden="true"
    className="absolute inset-x-0 top-0 z-20 h-1 bg-[linear-gradient(90deg,#ff2e8b,#c6ff00,#ff2e8b)]"
  />
);

const REVEAL_SPRING = { stiffness: 160, damping: 24, mass: 0.4 };
const CARD_START = 0.24;
const CARD_STEP = 0.18;

const StackCard = ({
  progress,
  index,
  total: _total,
  card,
}: {
  progress: MotionValue<number>;
  index: number;
  total: number;
  card: StackReason;
}) => {
  const start = CARD_START + index * CARD_STEP;
  const y = useSpring(
    useTransform(progress, [start, start + CARD_STEP * 0.52], [184, 0]),
    REVEAL_SPRING,
  );
  const opacity = useSpring(
    useTransform(progress, [start, start + CARD_STEP * 0.34, start + CARD_STEP], [0, 1, 1]),
    REVEAL_SPRING,
  );
  const scale = useSpring(
    useTransform(progress, [start, start + CARD_STEP * 0.52], [0.985, 1]),
    REVEAL_SPRING,
  );
  const top = `${index * 1.1}rem`;

  return (
    <motion.div
      style={{ y, opacity, scale, top, zIndex: index + 1 }}
      className="absolute inset-x-0"
    >
      <AccentInfoCard
        accent={card.accent}
        icon={card.icon}
        title={card.title}
        body={card.body}
        badge={card.number}
        size="lg"
        className="min-h-[13.75rem]"
      />
    </motion.div>
  );
};

const Mockup = () => (
  <div className="relative hidden min-h-[38rem] overflow-hidden lg:block lg:min-h-[56rem]">
    <div className="pointer-events-none absolute inset-0 flex items-center justify-start">
      <div className="w-[188%] -translate-x-[30%] scale-[1.16]">
        <DesktopShareBackdrop />
      </div>
    </div>
  </div>
);

export const WhyStackSection = ({
  title,
  description,
  cards,
  ctaHref,
  ctaLabel,
}: WhyStackSectionProps) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ['start start', 'end end'],
  });
  const total = cards.length;
  const ctaStart = CARD_START + total * CARD_STEP - 0.02;
  const ctaY = useSpring(
    useTransform(scrollYProgress, [ctaStart, ctaStart + 0.08], [28, 0]),
    REVEAL_SPRING,
  );
  const ctaOpacity = useSpring(
    useTransform(scrollYProgress, [ctaStart, ctaStart + 0.05, 1], [0, 1, 1]),
    REVEAL_SPRING,
  );
  const headingY = useSpring(useTransform(scrollYProgress, [0, 0.12], [22, 0]), REVEAL_SPRING);
  const headingOpacity = useSpring(
    useTransform(scrollYProgress, [0, 0.06, 0.3], [0, 1, 1]),
    REVEAL_SPRING,
  );

  // Touch / small screens: skip the scroll-pinning (janky on mobile). Render a
  // plain heading → stacked list → CTA in normal flow.
  if (isTouchDevice) {
    return (
      <section className={`${SECTION_SHELL} py-20`}>
        <AccentBar />
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 sm:px-6">
          <SectionHeading
            title={title}
            description={description}
            titleClassName="text-shadow-section-title text-3xl font-black tracking-tight sm:text-4xl"
            descriptionClassName="leading-relaxed"
          />
          <div className="flex flex-col gap-4">
            {cards.map((card) => (
              <AccentInfoCard key={card.number} {...card} badge={card.number} size="lg" />
            ))}
          </div>
          <SectionCta href={ctaHref} variant="lime" label={ctaLabel} className="justify-start" />
          <div className="relative mt-2">
            <div className="mx-auto w-full max-w-sm">
              <MobileShareBackdrop />
            </div>
          </div>
        </div>
      </section>
    );
  }

  // The track is taller than the viewport; the inner stage is `sticky` + `h-dvh`,
  // so it pins for (trackHeight - 100dvh) of scroll while we scrub the sequence.
  const trackVh = 388;

  return (
    <section ref={trackRef} className="relative" style={{ height: `${trackVh}vh` }}>
      <div className={`${SECTION_SHELL} sticky top-0 flex h-[94dvh] items-center`}>
        <AccentBar />
        <div className="grid w-full gap-8 pl-0 pr-6 lg:grid-cols-[minmax(0,1.14fr)_minmax(0,0.86fr)] lg:items-center lg:pr-8">
          <Mockup />
          <div className="flex w-full max-w-[40rem] flex-col justify-center gap-6 self-center py-8">
            <motion.div style={{ y: headingY, opacity: headingOpacity }}>
              <SectionHeading
                title={title}
                description={description}
                titleClassName="text-shadow-section-title text-3xl font-black tracking-tight sm:text-4xl"
                descriptionClassName="leading-relaxed"
              />
            </motion.div>
            <div className="relative min-h-[20.5rem]">
              {cards.map((card, i) => (
                <StackCard
                  key={card.number}
                  progress={scrollYProgress}
                  index={i}
                  total={total}
                  card={card}
                />
              ))}
            </div>
            <motion.div style={{ y: ctaY, opacity: ctaOpacity }}>
              <SectionCta
                href={ctaHref}
                variant="lime"
                label={ctaLabel}
                className="justify-start"
              />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};
