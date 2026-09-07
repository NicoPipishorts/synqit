import { Sticker, type StickerTone } from '@synqit/ui';
import {
  AnimatePresence,
  motion,
  type MotionValue,
  type PanInfo,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type ComponentType, type ReactNode, useEffect, useRef, useState } from 'react';

import { ThemedScreen } from './ThemedScreen';
import { useI18n } from '../../lib/i18n';
import { isTouchDevice } from '../../lib/motion';
import { HeroLink } from '../ui/HeroLink';

export type ServiceTone = 'lime' | 'pink' | 'ink';

export type Service = {
  id: string;
  tone: ServiceTone;
  icon: ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;
  tag: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  /** i18n key prefix for the phone steps, e.g. `home.how.event` (expects step1..N). */
  stepsKey: string;
  images: string[];
};

type ServiceShowcaseProps = {
  services: [Service, Service, Service];
  swipeHint: string;
};

const AUTOPLAY_MS = 3200;
const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 420;

const TONE: Record<
  ServiceTone,
  {
    tape: string;
    icon: string;
    link: 'lime' | 'pink' | 'outline';
    sticker: StickerTone;
    stroke: string;
    dot: string;
    active: string;
    ring: string;
    glow: string;
  }
> = {
  lime: {
    tape: 'bg-brand-lime/80',
    icon: 'bg-brand-lime text-brand-dark',
    link: 'lime',
    sticker: 'lime',
    stroke: 'text-brand-lime',
    dot: 'bg-brand-lime',
    active: 'bg-[color-mix(in_srgb,#c6ff00_14%,var(--syn-elevated))]',
    ring: 'border-brand-lime',
    glow: 'bg-brand-lime/40',
  },
  pink: {
    tape: 'bg-brand-pink/70',
    icon: 'bg-brand-pink text-brand-white',
    link: 'pink',
    sticker: 'pink',
    stroke: 'text-brand-pink',
    dot: 'bg-brand-pink',
    active: 'bg-[color-mix(in_srgb,#ff2e8b_12%,var(--syn-elevated))]',
    ring: 'border-brand-pink',
    glow: 'bg-brand-pink/35',
  },
  ink: {
    tape: 'bg-brand-gradient opacity-80',
    icon: 'bg-brand-dark text-brand-lime dark:bg-brand-white dark:text-brand-dark',
    link: 'outline',
    sticker: 'ink',
    stroke: 'text-app-text',
    dot: 'bg-app-text',
    active: 'bg-[color-mix(in_srgb,var(--syn-text)_7%,var(--syn-elevated))]',
    ring: 'border-app-text',
    glow: 'bg-app-text/20',
  },
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─── Shared controls ───────────────────────────────────────────────────────────

const ArrowButton = ({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className="focus-ring-brand inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-app-text bg-app-elevated shadow-sticker-sm transition hover:-translate-y-0.5 dark:bg-app-card"
  >
    {children}
  </button>
);

const Dots = ({
  labels,
  active,
  activeClass = 'bg-app-text',
  asTabs = false,
  onSelect,
}: {
  labels: string[];
  active: number;
  activeClass?: string;
  asTabs?: boolean;
  onSelect: (index: number) => void;
}) => (
  <div className="flex items-center gap-1.5" role={asTabs ? 'tablist' : undefined}>
    {labels.map((label, i) => (
      <button
        key={label + i}
        type="button"
        role={asTabs ? 'tab' : undefined}
        aria-selected={asTabs ? i === active : undefined}
        aria-current={asTabs ? undefined : i === active}
        aria-label={label}
        onClick={() => onSelect(i)}
        className={`h-2.5 rounded-full border border-app-text transition-all duration-300 ${
          i === active ? `w-7 ${activeClass}` : 'w-2.5 bg-transparent hover:bg-app-text/30'
        }`}
      />
    ))}
  </div>
);

// ─── Service card ──────────────────────────────────────────────────────────────

const ServiceCard = ({
  service,
  index,
  active,
  onSelect,
  className,
}: {
  service: Service;
  index: number;
  active: boolean;
  onSelect: () => void;
  className?: string;
}) => {
  const tone = TONE[service.tone];
  const Icon = service.icon;
  return (
    <article
      className={`relative flex h-full flex-col gap-5 rounded-3xl border-2 border-app-text p-6 transition-colors duration-300 sm:p-7 ${
        active ? `${tone.active} shadow-sticker` : 'bg-app-elevated shadow-sticker dark:bg-app-card'
      } ${className ?? ''}`.trim()}
    >
      <span
        aria-hidden="true"
        className={`absolute -top-3 left-8 h-5 w-16 -rotate-6 rounded-sm ${tone.tape}`}
      />
      {/* The text block is the selector; the CTA underneath stays a normal link. */}
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className="focus-ring-brand flex flex-1 flex-col gap-5 rounded-2xl text-left"
      >
        <span className="flex items-start justify-between gap-3">
          <Sticker tone={tone.sticker} tilt={active ? '-rotate-2' : '-rotate-1'}>
            0{index + 1} · {service.tag}
          </Sticker>
          <span
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 border-app-text ${tone.icon}`}
          >
            <Icon size={20} aria-hidden />
          </span>
        </span>
        <span className="flex flex-1 flex-col gap-2.5">
          <span className="text-2xl font-black leading-tight tracking-tight text-brand-dark dark:text-brand-white">
            {service.title}
          </span>
          <span className="text-sm leading-relaxed text-app-text-secondary sm:text-[15px]">
            {service.body}
          </span>
        </span>
      </button>
      <HeroLink href={service.href} variant={tone.link} size="sm" className="w-fit">
        {service.cta}
      </HeroLink>
    </article>
  );
};

// ─── Hand-drawn branch from the deck to the phone (dot = phone end) ────────────
// It redraws itself in the new colour whenever the active card changes, which is
// what ties a swipe on the deck to the screens playing in the phone.

const BRANCH = {
  horizontal: {
    viewBox: '0 0 120 32',
    d: 'M4 16 C 13 3, 23 29, 33 16 S 53 3, 63 16 S 83 29, 93 16 S 109 7, 116 16',
    dot: { cx: 116, cy: 16 },
    className: 'h-10 w-full',
  },
  vertical: {
    viewBox: '0 0 32 96',
    d: 'M16 4 C 6 22, 27 40, 15 58 S 12 84, 16 90',
    dot: { cx: 16, cy: 90 },
    className: 'h-14 w-8',
  },
} as const;

const Branch = ({
  tone,
  orientation,
  className,
}: {
  tone: ServiceTone;
  orientation: 'horizontal' | 'vertical';
  className?: string;
}) => {
  const shape = BRANCH[orientation];
  const reduce = prefersReducedMotion();
  return (
    <svg
      aria-hidden="true"
      viewBox={shape.viewBox}
      preserveAspectRatio="none"
      className={`${shape.className} ${TONE[tone].stroke} transition-colors duration-500 ${className ?? ''}`.trim()}
    >
      <motion.path
        key={tone}
        d={shape.d}
        fill="none"
        stroke="currentColor"
        strokeWidth={4}
        strokeLinecap="round"
        initial={reduce ? false : { pathLength: 0, opacity: 0.35 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
      />
      <motion.circle
        key={`${tone}-dot`}
        cx={shape.dot.cx}
        cy={shape.dot.cy}
        r={5}
        fill="currentColor"
        initial={reduce ? false : { scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4, type: 'spring', stiffness: 420, damping: 16 }}
        style={{ originX: `${shape.dot.cx}px`, originY: `${shape.dot.cy}px` }}
      />
    </svg>
  );
};

// ─── Phone playing the active flow ────────────────────────────────────────────

const FlowPhone = ({ service, index }: { service: Service; index: number }) => {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [flow, setFlow] = useState(service.id);
  // Bumped on every flow change so the halo replays — the cue that the screens
  // now belong to the card you just swiped to.
  const [pulse, setPulse] = useState(0);
  const total = service.images.length;
  const tone = TONE[service.tone];

  // New flow → back to its first screen, and flash the frame. Adjusting during
  // the render (not in an effect) keeps the phone from showing the new flow at
  // the old step index for a frame.
  if (flow !== service.id) {
    setFlow(service.id);
    setStep(0);
    if (!prefersReducedMotion()) setPulse((n) => n + 1);
  }

  useEffect(() => {
    if (paused || prefersReducedMotion()) return;
    const id = window.setInterval(() => {
      setStep((current) => (current + 1) % total);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [paused, total, service.id]);

  const goTo = (next: number) => setStep(((next % total) + total) % total);
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) goTo(step + 1);
    else if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) goTo(step - 1);
  };
  const safeStep = Math.min(step, total - 1);
  const caption = t(`${service.stepsKey}.step${safeStep + 1}`);

  return (
    <div
      className="flex flex-col items-center gap-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      {/* Which flow the phone is playing — it re-pops on every card change. */}
      <div className="flex min-h-8 items-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={service.id}
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.9 }}
            transition={{ duration: 0.22 }}
          >
            <Sticker tone={tone.sticker} tilt="-rotate-2">
              0{index + 1} · {service.tag}
            </Sticker>
          </motion.span>
        </AnimatePresence>
      </div>

      <div className="relative">
        {pulse > 0 && (
          <>
            <motion.span
              key={`glow-${pulse}`}
              aria-hidden="true"
              className={`pointer-events-none absolute -inset-4 rounded-[3.6rem] blur-2xl ${tone.glow}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.9, 0.35] }}
              transition={{ duration: 0.9, times: [0, 0.3, 1], ease: 'easeOut' }}
            />
            <motion.span
              key={`ring-${pulse}`}
              aria-hidden="true"
              className={`pointer-events-none absolute -inset-1.5 rounded-[3.2rem] border-[3px] ${tone.ring}`}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: [0, 1, 0], scale: [0.97, 1.03, 1.07] }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </>
        )}
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.25}
          dragMomentum={false}
          onDragEnd={onDragEnd}
          style={{ touchAction: 'pan-y' }}
          className="relative w-[15.5rem] cursor-grab rounded-[2.9rem] border-[3px] border-app-text bg-app-bg p-1.5 shadow-[6px_6px_0_0_var(--syn-text)] active:cursor-grabbing sm:w-[17rem]"
        >
          {/* Every screen stays mounted; only opacity changes, so swaps never flash or slide. */}
          <div className="relative aspect-[9/19.5] overflow-hidden rounded-[2.4rem] bg-app-card">
            {service.images.map((src, i) => (
              <ThemedScreen
                key={src + i}
                src={src}
                alt={i === safeStep ? caption : ''}
                hidden={i !== safeStep}
                initial={false}
                animate={{ opacity: i === safeStep ? 1 : 0 }}
                transition={{ duration: 0.55, ease: 'easeInOut' }}
                style={{ zIndex: i === safeStep ? 2 : 1 }}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              />
            ))}
          </div>
        </motion.div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-3">
          <ArrowButton label={t('home.how.prev')} onClick={() => goTo(safeStep - 1)}>
            <ChevronLeft size={18} aria-hidden />
          </ArrowButton>
          <Dots
            labels={service.images.map((_, i) => t(`${service.stepsKey}.step${i + 1}`))}
            active={safeStep}
            activeClass={tone.dot}
            asTabs
            onSelect={goTo}
          />
          <ArrowButton label={t('home.how.next')} onClick={() => goTo(safeStep + 1)}>
            <ChevronRight size={18} aria-hidden />
          </ArrowButton>
        </div>
        <div className="flex min-h-12 flex-col items-center text-center">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={`${service.id}-${safeStep}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="max-w-[16rem] text-sm font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-base"
            >
              {caption}
            </motion.p>
          </AnimatePresence>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-app-text-muted">
            {t('home.how.stepLabel', { n: safeStep + 1, total })}
          </p>
        </div>
      </div>
    </div>
  );
};

// ─── Scroll pivot (pointer devices only) ──────────────────────────────────────

const TILT_SPRING = { stiffness: 90, damping: 22, mass: 0.6 };

// [value at section entering, resting, leaving].
const DECK_PIVOT = { rotate: [-8, -1.5, 4], y: [80, 0, -50] };
const PHONE_PIVOT = { rotate: [4, 0.5, -3], y: [55, 0, -34] };

const Pivot = ({
  progress,
  spec,
  children,
  className,
}: {
  progress: MotionValue<number>;
  spec: { rotate: number[]; y: number[] };
  children: ReactNode;
  className?: string;
}) => {
  const rotate = useSpring(useTransform(progress, [0, 0.5, 1], spec.rotate), TILT_SPRING);
  const y = useSpring(useTransform(progress, [0, 0.5, 1], spec.y), TILT_SPRING);
  return (
    <motion.div style={{ rotate, y }} className={className}>
      {children}
    </motion.div>
  );
};

// ─── Deck of cards: swipe, arrows or dots pick the flow ───────────────────────

const DECK_DEPTH = [
  { x: 0, y: 0, rotate: 0, scale: 1 },
  { x: 12, y: -16, rotate: 2.5, scale: 0.96 },
  { x: 24, y: -30, rotate: -2, scale: 0.92 },
];

const HOVER_SPRING = { stiffness: 260, damping: 22 };

const ServiceDeck = ({
  services,
  active,
  onChange,
  hint,
  prevLabel,
  nextLabel,
}: {
  services: Service[];
  active: number;
  onChange: (index: number) => void;
  hint: string;
  prevLabel: string;
  nextLabel: string;
}) => {
  const total = services.length;
  const advance = (step: number) => onChange((active + step + total) % total);
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) advance(1);
    else if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) advance(-1);
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="grid w-full pt-8 [&>*]:col-start-1 [&>*]:row-start-1">
        {services.map((service, i) => {
          const depth = (i - active + total) % total;
          const isTop = depth === 0;
          const layer = DECK_DEPTH[depth] ?? DECK_DEPTH[DECK_DEPTH.length - 1];
          return (
            <motion.div
              key={service.id}
              drag={isTop ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.6}
              dragMomentum={false}
              onDragEnd={isTop ? onDragEnd : undefined}
              animate={{
                x: layer.x,
                y: layer.y,
                rotate: layer.rotate,
                scale: layer.scale,
                opacity: depth > 2 ? 0 : 1,
              }}
              whileHover={isTop ? { scale: 1.02 } : undefined}
              transition={{ type: 'spring', ...HOVER_SPRING }}
              style={{ zIndex: total - depth, touchAction: 'pan-y' }}
              className={isTop ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}
              aria-hidden={!isTop}
            >
              <ServiceCard
                service={service}
                index={i}
                active={isTop}
                onSelect={() => onChange(i)}
              />
            </motion.div>
          );
        })}
      </div>
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-3">
          <ArrowButton label={prevLabel} onClick={() => advance(-1)}>
            <ChevronLeft size={18} aria-hidden />
          </ArrowButton>
          <Dots
            labels={services.map((service) => service.tag)}
            active={active}
            onSelect={onChange}
          />
          <ArrowButton label={nextLabel} onClick={() => advance(1)}>
            <ChevronRight size={18} aria-hidden />
          </ArrowButton>
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-app-text-muted">{hint}</p>
      </div>
    </div>
  );
};

// ─── Public component ─────────────────────────────────────────────────────────

export const ServiceShowcase = ({ services, swipeHint }: ServiceShowcaseProps) => {
  const { t } = useI18n();
  const [active, setActive] = useState(0);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });
  const service = services[active];

  const deck = (
    <ServiceDeck
      services={services}
      active={active}
      onChange={setActive}
      hint={swipeHint}
      prevLabel={t('home.services.prev')}
      nextLabel={t('home.services.next')}
    />
  );
  const phone = <FlowPhone service={service} index={active} />;

  return (
    // One layout at every size: deck → branch → phone. Stacked on phones, side by
    // side from `lg`, so the whole story sits in one screenful.
    <div
      ref={sectionRef}
      className="flex flex-col items-center gap-3 lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(4rem,1fr)_auto] lg:items-center lg:gap-0"
    >
      <div className="w-full max-w-[23rem] lg:max-w-none lg:justify-self-start">
        {isTouchDevice ? (
          deck
        ) : (
          <Pivot progress={scrollYProgress} spec={DECK_PIVOT}>
            {deck}
          </Pivot>
        )}
      </div>

      <div className="flex w-full justify-center">
        <Branch tone={service.tone} orientation="vertical" className="lg:hidden" />
        <Branch tone={service.tone} orientation="horizontal" className="hidden lg:block" />
      </div>

      <div className="lg:justify-self-end">
        {isTouchDevice ? (
          phone
        ) : (
          <Pivot progress={scrollYProgress} spec={PHONE_PIVOT}>
            {phone}
          </Pivot>
        )}
      </div>
    </div>
  );
};
