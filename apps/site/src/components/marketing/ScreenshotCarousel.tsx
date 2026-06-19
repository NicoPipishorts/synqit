import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { useState } from 'react';

type ScreenshotCarouselProps = {
  steps: string[];
  images: string[];
  accent: 'lime' | 'pink';
};

const ACCENT = {
  lime: {
    dotActive: 'bg-brand-lime',
    dotInactive: 'bg-brand-lime/25',
    label: 'bg-brand-lime/15 text-[#7aa300] dark:text-brand-lime',
    activeBorder: 'border-brand-lime/60',
    glow: 'shadow-[0_0_60px_-10px_rgba(198,255,0,0.22)]',
    arrow:
      'border-brand-lime/40 text-[#7aa300] hover:border-brand-lime/70 hover:bg-brand-lime/10 dark:text-brand-lime',
  },
  pink: {
    dotActive: 'bg-brand-pink',
    dotInactive: 'bg-brand-pink/25',
    label: 'bg-brand-pink/15 text-[#b41563] dark:text-brand-pink',
    activeBorder: 'border-brand-pink/60',
    glow: 'shadow-[0_0_60px_-10px_rgba(255,46,139,0.22)]',
    arrow:
      'border-brand-pink/40 text-[#b41563] hover:border-brand-pink/70 hover:bg-brand-pink/10 dark:text-brand-pink',
  },
};

const SWIPE_THRESHOLD = 50;
const SWIPE_VELOCITY = 400;

// ─── Breadcrumb dots (shared) ────────────────────────────────────────────────

const Dots = ({
  steps,
  active,
  accent,
  onSelect,
}: {
  steps: string[];
  active: number;
  accent: 'lime' | 'pink';
  onSelect: (i: number) => void;
}) => {
  const c = ACCENT[accent];
  return (
    <div className="flex items-center gap-2">
      {steps.map((step, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          aria-label={step}
          className={`rounded-full transition-all duration-300 focus-visible:outline-none ${
            i === active
              ? `h-2.5 w-8 ${c.dotActive}`
              : `h-2.5 w-2.5 ${c.dotInactive} hover:opacity-70`
          }`}
        />
      ))}
    </div>
  );
};

// ─── Mobile: swipeable single card ───────────────────────────────────────────

const MobileSwipe = ({ steps, images, accent }: ScreenshotCarouselProps) => {
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
              src={images[active]}
              alt={steps[active]}
              className="pointer-events-none h-full w-full object-cover"
              draggable={false}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <Dots
        steps={steps}
        active={active}
        accent={accent}
        onSelect={(i) => goTo(i, i > active ? 1 : -1)}
      />
    </div>
  );
};

// ─── Tablet / desktop: centered peek slider with arrows ──────────────────────

// Phone-mockup footprint (matches the mobile card's w-70).
const ITEM_W = 252;
const GAP = 28;

const ArrowButton = ({
  direction,
  disabled,
  accent,
  onClick,
}: {
  direction: 'prev' | 'next';
  disabled: boolean;
  accent: 'lime' | 'pink';
  onClick: () => void;
}) => {
  const c = ACCENT[accent];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === 'prev' ? 'Previous step' : 'Next step'}
      className={`flex h-18 w-18 shrink-0 items-center justify-center rounded-full border shadow-soft-lift transition-all duration-200 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30  ${c.arrow}`}
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-8 w-8 ${direction === 'prev' ? 'rotate-180' : ''}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m9 6 6 6-6 6" />
      </svg>
    </button>
  );
};

const DesktopSlider = ({ steps, images, accent }: ScreenshotCarouselProps) => {
  const [active, setActive] = useState(0);
  const c = ACCENT[accent];

  const goTo = (next: number) => {
    if (next < 0 || next >= steps.length) return;
    setActive(next);
  };

  return (
    <div className="flex w-full flex-col items-center gap-8">
      <div className="flex w-full items-center justify-center gap-3 px-4 sm:gap-5 sm:px-6">
        <ArrowButton
          direction="prev"
          disabled={active === 0}
          accent={accent}
          onClick={() => goTo(active - 1)}
        />

        {/* viewport — full width; clips so neighbouring steps peek in on each side */}
        <div className="relative w-full flex-1 overflow-hidden py-4">
          <div className="relative left-1/2">
            <motion.div
              className="flex"
              style={{ gap: GAP }}
              animate={{ x: -(active * (ITEM_W + GAP) + ITEM_W / 2) }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            >
              {images.map((src, i) => {
                const isActive = i === active;
                return (
                  <motion.button
                    key={i}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-label={steps[i]}
                    className="relative shrink-0 cursor-pointer focus-visible:outline-none"
                    style={{ width: ITEM_W, aspectRatio: '9 / 19.5' }}
                    animate={{ opacity: isActive ? 1 : 0.4, scale: isActive ? 1 : 0.88 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                  >
                    {/* faded logo underneath each frame */}
                    <div className="absolute inset-0 flex items-center justify-center rounded-[2.2rem]">
                      <img
                        src="/assets/logos/logo-full.png"
                        alt=""
                        className="h-14 w-auto opacity-10"
                        draggable={false}
                      />
                    </div>
                    <div
                      className={`absolute inset-0 overflow-hidden rounded-[2.2rem] border-2 transition-colors duration-300 ${
                        isActive ? `${c.activeBorder} ${c.glow}` : 'border-app-border/60'
                      } bg-app-elevated dark:bg-app-card`}
                    >
                      <img
                        src={src}
                        alt={steps[i]}
                        className="pointer-events-none h-full w-full object-cover"
                        draggable={false}
                      />
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          </div>
        </div>

        <ArrowButton
          direction="next"
          disabled={active === steps.length - 1}
          accent={accent}
          onClick={() => goTo(active + 1)}
        />
      </div>

      {/* active step caption */}
      <div className="flex min-h-7 items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.span
            key={active}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className={`rounded-full px-4 py-1.5 text-sm font-black tracking-tight ${c.label}`}
          >
            {steps[active]}
          </motion.span>
        </AnimatePresence>
      </div>

      <Dots steps={steps} active={active} accent={accent} onSelect={goTo} />
    </div>
  );
};

// ─── Public component ────────────────────────────────────────────────────────

export const ScreenshotCarousel = (props: ScreenshotCarouselProps) => (
  <>
    {/* mobile: keep the swipeable card */}
    <div className="flex w-full justify-center md:hidden">
      <MobileSwipe {...props} />
    </div>
    {/* tablet & desktop: centered peek slider */}
    <div className="hidden w-full md:block">
      <DesktopSlider {...props} />
    </div>
  </>
);
