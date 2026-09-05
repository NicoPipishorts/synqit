import { Sticker, type StickerTone } from '@synqit/ui';
import {
  AnimatePresence,
  motion,
  type MotionValue,
  type PanInfo,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type ComponentType, useEffect, useRef, useState } from 'react';

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
  },
  pink: {
    tape: 'bg-brand-pink/70',
    icon: 'bg-brand-pink text-brand-white',
    link: 'pink',
    sticker: 'pink',
    stroke: 'text-brand-pink',
    dot: 'bg-brand-pink',
    active: 'bg-[color-mix(in_srgb,#ff2e8b_12%,var(--syn-elevated))]',
  },
  ink: {
    tape: 'bg-brand-gradient opacity-80',
    icon: 'bg-brand-dark text-brand-lime dark:bg-brand-white dark:text-brand-dark',
    link: 'outline',
    sticker: 'ink',
    stroke: 'text-app-text',
    dot: 'bg-app-text',
    active: 'bg-[color-mix(in_srgb,var(--syn-text)_7%,var(--syn-elevated))]',
  },
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

// ─── Hand-drawn branch between a card and the phone (dot = phone end) ─────────

const Branch = ({
  tone,
  active,
  vertical = false,
  flip = false,
}: {
  tone: ServiceTone;
  active: boolean;
  vertical?: boolean;
  flip?: boolean;
}) => {
  const color = `${active ? TONE[tone].stroke : 'text-app-text/20'} transition-colors duration-300`;
  const stroke = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: active ? 4 : 3,
    strokeLinecap: 'round' as const,
    strokeDasharray: active ? undefined : '6 7',
  };
  if (vertical) {
    return (
      <svg aria-hidden="true" viewBox="0 0 32 96" className={`h-20 w-8 ${color}`}>
        <path d="M16 92 C 6 74, 27 56, 15 38 S 12 12, 16 6" {...stroke} />
        <circle cx="16" cy="6" r={active ? 5 : 3.5} fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 32"
      preserveAspectRatio="none"
      className={`h-8 w-full ${flip ? 'scale-x-[-1]' : ''} ${color}`}
    >
      <path d="M4 16 C 28 6, 52 27, 76 15 S 104 10, 116 16" {...stroke} />
      <circle cx="116" cy="16" r={active ? 5 : 3.5} fill="currentColor" />
    </svg>
  );
};

// ─── Phone playing the active flow ────────────────────────────────────────────

const FlowPhone = ({ service }: { service: Service }) => {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = service.images.length;
  const tone = TONE[service.tone];

  // New flow → back to its first screen.
  useEffect(() => {
    setStep(0);
  }, [service.id]);

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
      className="flex flex-col items-center gap-5"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.25}
        dragMomentum={false}
        onDragEnd={onDragEnd}
        style={{ touchAction: 'pan-y' }}
        className="relative aspect-[9/19.5] w-[15rem] cursor-grab overflow-hidden rounded-[2.4rem] border-2 border-app-text bg-app-card shadow-sticker active:cursor-grabbing sm:w-[16.5rem]"
      >
        {/* Every screen stays mounted; only opacity changes, so swaps never flash or slide. */}
        {service.images.map((src, i) => (
          <motion.img
            key={src + i}
            src={src}
            alt={i === safeStep ? caption : ''}
            aria-hidden={i !== safeStep}
            draggable={false}
            initial={false}
            animate={{ opacity: i === safeStep ? 1 : 0 }}
            transition={{ duration: 0.55, ease: 'easeInOut' }}
            style={{ zIndex: i === safeStep ? 2 : 1 }}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
        ))}
      </motion.div>

      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => goTo(safeStep - 1)}
            aria-label={t('home.how.prev')}
            className="focus-ring-brand inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-app-text bg-app-elevated shadow-sticker-sm transition hover:-translate-y-0.5 dark:bg-app-card"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <div className="flex items-center gap-1.5" role="tablist">
            {service.images.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === safeStep}
                aria-label={t(`${service.stepsKey}.step${i + 1}`)}
                onClick={() => goTo(i)}
                className={`h-2.5 rounded-full border border-app-text transition-all duration-300 ${
                  i === safeStep ? `w-7 ${tone.dot}` : 'w-2.5 bg-transparent hover:bg-app-text/30'
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => goTo(safeStep + 1)}
            aria-label={t('home.how.next')}
            className="focus-ring-brand inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-app-text bg-app-elevated shadow-sticker-sm transition hover:-translate-y-0.5 dark:bg-app-card"
          >
            <ChevronRight size={18} aria-hidden />
          </button>
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

// ─── Desktop: cards angled around the phone, pivoting with scroll ─────────────

const TILT_SPRING = { stiffness: 90, damping: 22, mass: 0.6 };

// Each card: [rotate at section entering, resting, leaving] and the same for y.
const CARD_MOTION = [
  { rotate: [-11, -4, 1], y: [90, 0, -50] },
  { rotate: [11, 4, -1], y: [90, 0, -50] },
  { rotate: [7, -2, -7], y: [70, 0, -40] },
];

const HOVER_SPRING = { stiffness: 260, damping: 22 };
// On hover the card swings past level in the opposite direction of its scroll tilt.
const HOVER_COUNTER = 1.5;
const HOVER_SCALE = 1.04;

const PivotCard = ({
  progress,
  index,
  children,
  className,
}: {
  progress: MotionValue<number>;
  index: number;
  children: React.ReactNode;
  className?: string;
}) => {
  const spec = CARD_MOTION[index];
  const rotate = useSpring(useTransform(progress, [0, 0.5, 1], spec.rotate), TILT_SPRING);
  const y = useSpring(useTransform(progress, [0, 0.5, 1], spec.y), TILT_SPRING);

  const hover = useMotionValue(0);
  const hoverAmount = useSpring(hover, HOVER_SPRING);
  const counterRotate = useTransform(
    [rotate, hoverAmount],
    ([r, h]) => -(r as number) * HOVER_COUNTER * (h as number),
  );
  const scale = useTransform(hoverAmount, [0, 1], [1, HOVER_SCALE]);

  return (
    <motion.div style={{ rotate, y }} className={className}>
      <motion.div
        className="h-full"
        style={{ rotate: counterRotate, scale }}
        onHoverStart={() => hover.set(1)}
        onHoverEnd={() => hover.set(0)}
      >
        {children}
      </motion.div>
    </motion.div>
  );
};

// ─── Mobile: swipe deck of the same cards, driving the phone below ────────────

const DECK_TILT = ['rotate-0', '-rotate-2', 'rotate-2'];

const ServiceDeck = ({
  services,
  active,
  onChange,
  hint,
}: {
  services: Service[];
  active: number;
  onChange: (index: number) => void;
  hint: string;
}) => {
  const total = services.length;
  const advance = (step: number) => onChange((active + step + total) % total);
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) advance(1);
    else if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) advance(-1);
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="grid w-full pt-4 [&>*]:col-start-1 [&>*]:row-start-1">
        {services.map((service, i) => {
          const depth = (i - active + total) % total;
          const isTop = depth === 0;
          return (
            <motion.div
              key={service.id}
              drag={isTop ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.6}
              dragMomentum={false}
              onDragEnd={isTop ? onDragEnd : undefined}
              animate={{
                x: 0,
                y: depth * -14,
                scale: 1 - depth * 0.05,
                opacity: depth > 2 ? 0 : 1,
              }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              style={{ zIndex: total - depth, touchAction: 'pan-y' }}
              className={`${DECK_TILT[depth] ?? ''} ${isTop ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
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
        <div className="flex items-center gap-2">
          {services.map((service, i) => (
            <button
              key={service.id}
              type="button"
              onClick={() => onChange(i)}
              aria-label={service.tag}
              aria-current={i === active}
              className={`h-2.5 rounded-full border border-app-text transition-all duration-300 ${
                i === active ? 'w-8 bg-app-text' : 'w-2.5 bg-transparent hover:bg-app-text/30'
              }`}
            />
          ))}
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-app-text-muted">{hint}</p>
      </div>
    </div>
  );
};

// ─── Public component ─────────────────────────────────────────────────────────

export const ServiceShowcase = ({ services, swipeHint }: ServiceShowcaseProps) => {
  const [active, setActive] = useState(0);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });
  const service = services[active];

  return (
    <div ref={sectionRef}>
      {/* ── Mobile / tablet: deck, then the phone ─────────────────────── */}
      <div className="flex flex-col items-center gap-12 lg:hidden">
        <div className="w-full">
          <ServiceDeck services={services} active={active} onChange={setActive} hint={swipeHint} />
        </div>
        <FlowPhone service={service} />
      </div>

      {/* ── Desktop: phone centre, cards angled left / right / below ────
          Rows: [spacer, side cards, spacer, bottom card]. The phone spans the first
          three rows, so the side cards share one row and stretch to equal height. */}
      <div className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_6rem_auto_6rem_minmax(0,1fr)] lg:grid-rows-[1fr_auto_1fr_auto] lg:gap-x-2">
        {([0, 1] as const).map((i) => {
          const card = (
            <ServiceCard
              service={services[i]}
              index={i}
              active={active === i}
              onSelect={() => setActive(i)}
            />
          );
          const cell = `col-start-${i === 0 ? 1 : 5} row-start-2 h-full w-full max-w-[22rem] ${
            i === 0 ? 'justify-self-end' : 'justify-self-start'
          }`;
          return isTouchDevice ? (
            <div key={services[i].id} className={`${cell} ${i === 0 ? '-rotate-3' : 'rotate-3'}`}>
              {card}
            </div>
          ) : (
            <PivotCard key={services[i].id} progress={scrollYProgress} index={i} className={cell}>
              {card}
            </PivotCard>
          );
        })}
        <div className="col-start-2 row-start-2 self-center">
          <Branch tone={services[0].tone} active={active === 0} />
        </div>
        <div className="col-start-3 row-span-3 row-start-1 self-center py-6">
          <FlowPhone service={service} />
        </div>
        <div className="col-start-4 row-start-2 self-center">
          <Branch tone={services[1].tone} active={active === 1} flip />
        </div>
        <div className="col-span-full row-start-4 flex flex-col items-center pt-2">
          <Branch tone={services[2].tone} active={active === 2} vertical />
          {isTouchDevice ? (
            <div className="mt-2 w-full max-w-[22rem] -rotate-2">
              <ServiceCard
                service={services[2]}
                index={2}
                active={active === 2}
                onSelect={() => setActive(2)}
              />
            </div>
          ) : (
            <PivotCard progress={scrollYProgress} index={2} className="mt-2 w-full max-w-[22rem]">
              <ServiceCard
                service={services[2]}
                index={2}
                active={active === 2}
                onSelect={() => setActive(2)}
              />
            </PivotCard>
          )}
        </div>
      </div>
    </div>
  );
};
