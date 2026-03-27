import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { useState } from 'react';

type ScreenshotCarouselProps = {
  steps: string[];
  imageSrc: string;
  accent: 'lime' | 'pink';
};

const ACCENT = {
  lime: {
    dotActive: 'bg-brand-lime',
    dotInactive: 'bg-brand-lime/25',
    label: 'bg-brand-lime/15 text-[#7aa300] dark:text-brand-lime',
    activeBorder: 'border-brand-lime/60',
    glow: 'shadow-[0_0_60px_-10px_rgba(198,255,0,0.22)]',
  },
  pink: {
    dotActive: 'bg-brand-pink',
    dotInactive: 'bg-brand-pink/25',
    label: 'bg-brand-pink/15 text-[#b41563] dark:text-brand-pink',
    activeBorder: 'border-brand-pink/60',
    glow: 'shadow-[0_0_60px_-10px_rgba(255,46,139,0.22)]',
  },
};

const SWIPE_THRESHOLD = 50;
const SWIPE_VELOCITY = 400;

export const ScreenshotCarousel = ({ steps, imageSrc, accent }: ScreenshotCarouselProps) => {
  const [active, setActive] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const c = ACCENT[accent];

  const goTo = (next: number, d: 1 | -1) => {
    if (next < 0 || next >= steps.length) return;
    setDir(d);
    setActive(next);
  };

  const handleDragEnd = (_: never, info: PanInfo) => {
    if (info.offset.x < -SWIPE_THRESHOLD || info.velocity.x < -SWIPE_VELOCITY) {
      goTo(active + 1, 1);
    } else if (info.offset.x > SWIPE_THRESHOLD || info.velocity.x > SWIPE_VELOCITY) {
      goTo(active - 1, -1);
    }
  };

  const variants = {
    enter: (d: number) => ({ x: d * 320, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d * -320, opacity: 0 }),
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* wrapper — no overflow-hidden so card slides outside bounds */}
      <div className="relative w-70" style={{ aspectRatio: '9 / 19.5' }}>
        {/* faded logo always underneath */}
        <div className="absolute inset-0 flex items-center justify-center rounded-[2.2rem]">
          <img
            src="/assets/logos/logo-full.png"
            alt=""
            className="h-14 w-auto opacity-10"
            draggable={false}
          />
        </div>

        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={active}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={
              active === 0
                ? { left: 0.5, right: 0.08 }
                : active === steps.length - 1
                  ? { left: 0.08, right: 0.5 }
                  : 0.5
            }
            dragMomentum={false}
            onDragEnd={handleDragEnd}
            style={{ touchAction: 'pan-y' }}
            className={`absolute inset-0 cursor-grab overflow-hidden rounded-[2.2rem] border-2 active:cursor-grabbing ${c.activeBorder} ${c.glow} bg-app-elevated dark:bg-app-card`}
          >
            <img
              src={imageSrc}
              alt={steps[active]}
              className="pointer-events-none h-full w-full object-cover"
              draggable={false}
            />
            <div className="absolute bottom-4 left-0 right-0 flex justify-center">
              <AnimatePresence mode="wait">
                <motion.span
                  key={active}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className={`rounded-full px-3 py-1 text-[10px] font-bold tracking-wide ${c.label}`}
                >
                  {steps[active]}
                </motion.span>
              </AnimatePresence>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* breadcrumb dots */}
      <div className="flex items-center gap-2">
        {steps.map((step, i) => (
          <button
            key={i}
            onClick={() => goTo(i, i > active ? 1 : -1)}
            aria-label={step}
            className={`rounded-full transition-all duration-300 focus-visible:outline-none ${
              i === active
                ? `h-2.5 w-8 ${c.dotActive}`
                : `h-2.5 w-2.5 ${c.dotInactive} hover:opacity-70`
            }`}
          />
        ))}
      </div>
    </div>
  );
};
