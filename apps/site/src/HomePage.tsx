import {
  AnimatePresence,
  motion,
  type Variants,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import {
  ArrowLeftRight,
  type LucideIcon,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Wand2,
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { HeroBackdrop } from './components/marketing/HeroMockup';
import { HomeFooterReveal } from './components/marketing/HomeFooterReveal';
import { PricingTeaserCards } from './components/marketing/PricingTeaserCards';
import { RevealSection } from './components/marketing/RevealSection';
import { ScreenshotCarousel } from './components/marketing/ScreenshotCarousel';
import { SurfaceCard } from './components/marketing/SurfaceCard';
import { HeroLink } from './components/ui/HeroLink';
import { buildAppUrl } from './lib/app-url';
import { useI18n } from './lib/i18n';
import { isTouchDevice } from './lib/motion';

// ─── Animation variants ────────────────────────────────────────────────────────

const STAGGER: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } },
};

const TAB_SLIDE: Variants = {
  enter: (d: number) => ({ x: `${d * 40}%`, opacity: 0 }),
  center: { x: '0%', opacity: 1 },
  exit: (d: number) => ({ x: `${d * -40}%`, opacity: 0 }),
};

const FADE_UP: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

// Rotating above-the-fold taglines: event playlist ↔ existing/shared playlist.
const HERO_VARIANTS = [
  { title: 'home.hero.title', description: 'home.hero.description' },
  { title: 'home.hero.titleSync', description: 'home.hero.descriptionSync' },
] as const;

const HERO_ROTATE_MS = 12000;

// ─── Offer tabs ────────────────────────────────────────────────────────────────

type OfferTab = 'event' | 'sync';

const CARD_ACCENTS = {
  lime: {
    badge: 'bg-brand-lime/15 text-[#7aa300] dark:bg-brand-lime/10 dark:text-brand-lime',
    text: 'text-[#7aa300] dark:text-brand-lime',
    glow: 'bg-[radial-gradient(circle_at_top_right,rgba(198,255,0,0.18),transparent_58%)]',
    line: 'from-brand-lime/70 via-brand-lime/25 to-transparent',
    panel:
      'bg-[linear-gradient(165deg,rgba(198,255,0,0.12)_0%,rgba(255,255,255,0)_48%)] dark:bg-[linear-gradient(165deg,rgba(198,255,0,0.10)_0%,rgba(255,255,255,0)_48%)]',
  },
  pink: {
    badge: 'bg-brand-pink/15 text-[#b41563] dark:bg-brand-pink/10 dark:text-brand-pink',
    text: 'text-[#b41563] dark:text-brand-pink',
    glow: 'bg-[radial-gradient(circle_at_top_right,rgba(255,46,139,0.16),transparent_58%)]',
    line: 'from-brand-pink/70 via-brand-pink/25 to-transparent',
    panel:
      'bg-[linear-gradient(165deg,rgba(255,46,139,0.10)_0%,rgba(255,255,255,0)_48%)] dark:bg-[linear-gradient(165deg,rgba(255,46,139,0.08)_0%,rgba(255,255,255,0)_48%)]',
  },
} as const;

const EVENT_IMAGES = [
  '/assets/presentation/Events-step-1.png',
  '/assets/presentation/Events-step-2-1.png',
  '/assets/presentation/Events-step-2-2.png',
  '/assets/presentation/Events-step-3.png',
  '/assets/presentation/Events-step-4-1.png',
  '/assets/presentation/Events-step-4-2.png',
];

const SYNC_IMAGES = [
  '/assets/presentation/Sync-step-1.png',
  '/assets/presentation/Sync-step-2-1.png',
  '/assets/presentation/Sync-step-2-2.png',
  '/assets/presentation/Sync-step-3.png',
];

// ─── Why reason card ───────────────────────────────────────────────────────────

const ReasonCard = ({
  number,
  icon: Icon,
  title,
  body,
  accent,
}: {
  number: string;
  icon: LucideIcon;
  title: string;
  body: string;
  accent: 'lime' | 'pink';
}) => (
  <SurfaceCard className={`h-full border-app-border/80 p-6 ${CARD_ACCENTS[accent].panel}`}>
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${CARD_ACCENTS[accent].glow}`}
    />
    <div className="relative z-10 flex h-full flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <span
          className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset ring-white/35 dark:ring-white/8 ${CARD_ACCENTS[accent].badge}`}
        >
          <Icon size={21} aria-hidden="true" />
        </span>
        <div
          aria-hidden="true"
          className={`mt-6 h-px min-w-8 flex-1 bg-gradient-to-r ${CARD_ACCENTS[accent].line}`}
        />
        <span
          className={`rounded-full border border-current/12 bg-app-bg/70 px-3 py-1 text-[11px] font-black tracking-[0.24em] uppercase backdrop-blur-sm ${CARD_ACCENTS[accent].text}`}
        >
          {number}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3">
        <p className="max-w-[18rem] text-lg font-black leading-tight text-brand-dark dark:text-brand-white">
          {title}
        </p>
        <p className="text-sm leading-relaxed text-app-text-secondary">{body}</p>
      </div>
    </div>
  </SurfaceCard>
);

// ─── Feature card ──────────────────────────────────────────────────────────────

const FeatureCard = ({
  icon: Icon,
  title,
  body,
  accent,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  accent: 'lime' | 'pink';
}) => (
  <SurfaceCard className={`h-full border-app-border/80 p-5 ${CARD_ACCENTS[accent].panel}`}>
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${CARD_ACCENTS[accent].glow}`}
    />
    <div className="relative z-10 flex h-full flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <span
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset ring-white/35 dark:ring-white/8 ${CARD_ACCENTS[accent].badge}`}
        >
          <Icon size={20} aria-hidden="true" />
        </span>
        <div
          aria-hidden="true"
          className={`mt-[1.375rem] min-w-8 flex-1 self-start h-px bg-gradient-to-r ${CARD_ACCENTS[accent].line}`}
        />
      </div>
      <div className="flex flex-1 flex-col gap-3">
        <p className="text-lg font-black leading-tight text-brand-dark dark:text-brand-white">
          {title}
        </p>
        <p className="text-sm leading-relaxed text-app-text-secondary">{body}</p>
      </div>
    </div>
  </SurfaceCard>
);

// ─── CTA offer card ────────────────────────────────────────────────────────────

const CtaOfferCard = ({
  accent,
  title,
  body,
  action,
}: {
  accent: 'lime' | 'pink';
  title: string;
  body: string;
  action: string;
}) => (
  <div
    className={`flex flex-col items-center gap-4 rounded-2xl border p-6 text-center ${
      accent === 'lime'
        ? 'border-brand-lime/30 bg-brand-lime/5'
        : 'border-brand-pink/30 bg-brand-pink/5'
    }`}
  >
    <div className="flex flex-col gap-1">
      <p className="font-black text-brand-dark dark:text-brand-white">{title}</p>
      <p className="text-sm leading-relaxed text-app-text-secondary">{body}</p>
    </div>
    <HeroLink href={buildAppUrl('/auth/register')} variant={accent} size="sm">
      {action}
    </HeroLink>
  </div>
);

// ─── Page ──────────────────────────────────────────────────────────────────────

export const HomePage = () => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<OfferTab>('event');
  const [heroVariant, setHeroVariant] = useState(0);
  const heroImageRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress: heroScrollProgress } = useScroll({
    target: heroImageRef,
    offset: ['start start', 'end start'],
  });
  const heroTilt = useSpring(useTransform(heroScrollProgress, [0, 1], [0, 16]), {
    stiffness: 120,
    damping: 18,
  });
  const heroShift = useSpring(useTransform(heroScrollProgress, [0, 1], [0, 30]), {
    stiffness: 120,
    damping: 18,
  });
  const heroScale = useSpring(useTransform(heroScrollProgress, [0, 1], [1, 0.965]), {
    stiffness: 120,
    damping: 18,
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      setHeroVariant((index) => (index + 1) % HERO_VARIANTS.length);
    }, HERO_ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  const eventSteps = [
    t('home.offer.eventStep1'),
    t('home.offer.eventStep2'),
    t('home.offer.eventStep3'),
    t('home.offer.eventStep4'),
    t('home.offer.eventStep5'),
    t('home.offer.eventStep6'),
  ];

  const syncSteps = [
    t('home.offer.syncStep1'),
    t('home.offer.syncStep2'),
    t('home.offer.syncStep3'),
    t('home.offer.syncStep4'),
  ];

  return (
    <div className="relative bg-brand-dark dark:bg-brand-white">
      <HomeFooterReveal />

      {/* main card — rounded bottom, scrolls over footer */}
      <div className="relative z-10 overflow-hidden rounded-b-[2.75rem] bg-app-bg shadow-[0_28px_64px_-20px_rgba(0,0,0,0.55)] dark:shadow-[0_30px_70px_-20px_rgba(0,0,0,0.72)] sm:rounded-b-[3.5rem] lg:rounded-b-[4.5rem]">
        <div className="relative z-10 mx-auto w-full  ">
          {/* ── Hero ──────────────────────────────────────────────────────── */}
          <RevealSection
            revealOnScroll={false}
            trackId="hero"
            className="relative flex min-h-svh flex-col justify-center pb-12 pt-32 sm:min-h-[calc(100svh-6rem)] sm:pb-20 sm:pt-40"
          >
            <motion.div
              initial={isTouchDevice ? false : 'hidden'}
              animate="visible"
              variants={STAGGER}
              className="relative grid w-full items-center gap-8 lg:grid-cols-2 lg:gap-12"
            >
              <motion.div
                ref={heroImageRef}
                variants={FADE_UP}
                className="order-2 relative flex min-h-80 justify-center overflow-hidden sm:h-[52svh] lg:order-1 lg:h-[75svh] lg:min-h-140 lg:justify-end"
                style={{ perspective: '1400px' }}
              >
                <motion.div
                  className="h-full w-[175%] shrink-0 sm:w-[150%] lg:w-[125%]"
                  style={{
                    x: heroShift,
                    rotateY: heroTilt,
                    scale: heroScale,
                    transformStyle: 'preserve-3d',
                    transformOrigin: 'center center',
                  }}
                >
                  <HeroBackdrop />
                </motion.div>
              </motion.div>

              <motion.div
                variants={FADE_UP}
                className="order-1 relative flex w-full flex-col items-center justify-center gap-4 px-4 text-center sm:min-h-[280px] sm:gap-6 sm:px-0 lg:order-2 lg:min-h-[75svh]"
              >
                <div
                  aria-hidden="true"
                  className="absolute left-1/2 top-1/2 hidden h-[78%] w-[min(38rem,48vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-app-bg blur-[96px] lg:block"
                />
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={heroVariant}
                    initial={{ opacity: 0, y: -28 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 28 }}
                    transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                    className="relative flex w-full flex-col items-center gap-4 sm:gap-6"
                  >
                    <h1 className="max-w-xs whitespace-normal text-3xl font-black leading-[1.06] tracking-tight text-brand-dark dark:text-brand-white sm:max-w-xl sm:text-5xl lg:text-6xl">
                      {t(HERO_VARIANTS[heroVariant].title)}
                    </h1>
                    <p className="max-w-xs text-sm leading-relaxed text-app-text-secondary sm:max-w-xl sm:text-lg">
                      {t(HERO_VARIANTS[heroVariant].description)}
                    </p>
                  </motion.div>
                </AnimatePresence>

                <div className="relative flex flex-col items-center gap-3 sm:gap-4">
                  <div className="flex w-full items-center justify-center gap-2 sm:w-auto sm:gap-3">
                    <HeroLink
                      href={buildAppUrl('/auth/register')}
                      variant="lime"
                      size="sm"
                      className="min-h-9 px-3 py-2 text-xs sm:min-h-11 sm:px-5 sm:py-3 sm:text-base"
                    >
                      {t('home.hero.ctaEvent')}
                    </HeroLink>
                    <HeroLink
                      href={buildAppUrl('/auth/register')}
                      variant="outline"
                      size="sm"
                      className="min-h-9 px-3 py-2 text-xs sm:min-h-11 sm:px-5 sm:py-3 sm:text-base"
                    >
                      {t('home.hero.ctaSync')}
                    </HeroLink>
                  </div>
                  {/* platform compatibility */}
                  <div className="mt-4 flex items-center gap-3 sm:mt-6">
                    <span className="text-xs text-app-text-muted">{t('home.hero.worksWith')}</span>
                    <img
                      src="/assets/logos/Providers/Spotify.png"
                      alt="Spotify"
                      className="h-7 w-7 rounded-xl object-contain sm:h-10 sm:w-10"
                    />
                    <img
                      src="/assets/logos/Providers/AppleMusic.png"
                      alt="Apple Music"
                      className="h-7 w-7 rounded-xl object-contain sm:h-10 sm:w-10"
                    />
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </RevealSection>

          <div>
            {/* ── Offer tabs + screenshots ───────────────────────────────────── */}
            <RevealSection
              trackId="showcase"
              className="relative overflow-hidden border-t border-app-border/60 bg-[linear-gradient(135deg,rgba(198,255,0,0.08)_0%,transparent_42%,rgba(255,46,139,0.06)_100%)] py-24 sm:py-32 lg:py-36"
            >
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#c6ff00,#ff2e8b,#7dd3fc)]"
              />
              <div className="mx-auto w-full max-w-6xl px-6 sm:px-6 lg:px-8">
                <div className="mb-12 flex flex-col items-center gap-6">
                  {/* tab switcher with sliding pill */}
                  <div className="relative flex rounded-full border border-app-border bg-app-elevated p-1 shadow-soft-lift dark:bg-app-card">
                    {/* sliding background pill */}
                    <motion.div
                      layout
                      layoutId="tab-pill"
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                      className={`absolute inset-y-1 rounded-full ${activeTab === 'event' ? 'bg-brand-lime' : 'bg-brand-pink'}`}
                      style={{
                        left: activeTab === 'event' ? '4px' : '50%',
                        right: activeTab === 'event' ? '50%' : '4px',
                      }}
                    />
                    {(['event', 'sync'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`relative z-10 rounded-full px-5 py-2 text-sm font-black tracking-tight transition-colors duration-200 focus-visible:outline-none ${
                          activeTab === tab
                            ? tab === 'event'
                              ? 'text-brand-dark'
                              : 'text-brand-white'
                            : 'text-app-text-muted hover:text-app-text'
                        }`}
                      >
                        {t(`home.offer.tab${tab === 'event' ? 'Event' : 'Sync'}`)}
                      </button>
                    ))}
                  </div>

                  {/* tab description */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.22 }}
                      className="max-w-lg text-center"
                    >
                      <h2 className="text-2xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-3xl">
                        {t(`home.offer.${activeTab}Title`)}
                      </h2>
                      <p className="mt-3 text-sm leading-relaxed text-app-text-secondary sm:text-base">
                        {t(`home.offer.${activeTab}Description`)}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              {/* screenshot carousel — full-bleed; slides in from left (event) or right (sync) */}
              <div className="flex w-full justify-center overflow-hidden">
                <AnimatePresence mode="popLayout" custom={activeTab === 'event' ? -1 : 1}>
                  <motion.div
                    key={activeTab}
                    custom={activeTab === 'event' ? -1 : 1}
                    variants={TAB_SLIDE}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.15, ease: [0.25, 0, 0, 1] }}
                    style={{ willChange: 'transform, opacity' }}
                    className="w-full"
                  >
                    {activeTab === 'event' ? (
                      <ScreenshotCarousel steps={eventSteps} images={EVENT_IMAGES} accent="lime" />
                    ) : (
                      <ScreenshotCarousel steps={syncSteps} images={SYNC_IMAGES} accent="pink" />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </RevealSection>

            {/* ── Features ──────────────────────────────────────────────────── */}
            <RevealSection
              trackId="features"
              className="relative overflow-hidden border-t border-app-border/60 bg-[linear-gradient(145deg,rgba(198,255,0,0.14)_0%,rgba(245,245,245,0.72)_46%,rgba(125,211,252,0.12)_100%)] py-24 dark:bg-[linear-gradient(145deg,rgba(198,255,0,0.10)_0%,rgba(26,26,26,0.88)_46%,rgba(125,211,252,0.10)_100%)] sm:py-32 lg:py-36"
            >
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#c6ff00,#7dd3fc,#c6ff00)]"
              />
              <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 sm:px-6 lg:px-8">
                <div className="flex flex-col gap-3">
                  <h2 className="text-shadow-section-title text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-4xl">
                    {t('home.features.title')}
                  </h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <FeatureCard
                    icon={Smartphone}
                    title={t('home.features.nativeTitle')}
                    body={t('home.features.nativeBody')}
                    accent="lime"
                  />
                  <FeatureCard
                    icon={Wand2}
                    title={t('home.features.magicLinkTitle')}
                    body={t('home.features.magicLinkBody')}
                    accent="pink"
                  />
                  <FeatureCard
                    icon={ArrowLeftRight}
                    title={t('home.features.crossPlatformTitle')}
                    body={t('home.features.crossPlatformBody')}
                    accent="lime"
                  />
                  <FeatureCard
                    icon={ShieldCheck}
                    title={t('home.features.moderationTitle')}
                    body={t('home.features.moderationBody')}
                    accent="pink"
                  />
                </div>
              </div>
            </RevealSection>

            {/* ── Why Synqit ────────────────────────────────────────────────── */}
            <RevealSection
              trackId="why"
              className="relative overflow-hidden border-t border-app-border/60 bg-[linear-gradient(160deg,rgba(255,46,139,0.08)_0%,transparent_45%,rgba(198,255,0,0.07)_100%)] py-24 sm:py-32 lg:py-36"
            >
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#ff2e8b,#c6ff00,#ff2e8b)]"
              />
              <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 sm:px-6 lg:px-8">
                <div className="flex flex-col gap-3">
                  <h2 className="text-shadow-section-title text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-4xl">
                    {t('home.why.title')}
                  </h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ReasonCard
                    number="01"
                    icon={Zap}
                    accent="lime"
                    title={t('home.why.reason1Title')}
                    body={t('home.why.reason1Body')}
                  />
                  <ReasonCard
                    number="02"
                    icon={ArrowLeftRight}
                    accent="pink"
                    title={t('home.why.reason2Title')}
                    body={t('home.why.reason2Body')}
                  />
                  <ReasonCard
                    number="03"
                    icon={RefreshCw}
                    accent="lime"
                    title={t('home.why.reason3Title')}
                    body={t('home.why.reason3Body')}
                  />
                  <ReasonCard
                    number="04"
                    icon={SlidersHorizontal}
                    accent="pink"
                    title={t('home.why.reason4Title')}
                    body={t('home.why.reason4Body')}
                  />
                </div>
              </div>
            </RevealSection>

            {/* ── Pricing teaser ────────────────────────────────────────────── */}
            <RevealSection
              trackId="pricing"
              className="relative overflow-hidden border-t border-app-border/60 bg-[linear-gradient(140deg,rgba(125,211,252,0.14)_0%,rgba(245,245,245,0.70)_48%,rgba(255,46,139,0.10)_100%)] py-24 dark:bg-[linear-gradient(140deg,rgba(125,211,252,0.10)_0%,rgba(26,26,26,0.88)_48%,rgba(255,46,139,0.09)_100%)] sm:py-32 lg:py-36"
            >
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#7dd3fc,#ff2e8b,#c6ff00)]"
              />
              <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 px-6 text-center sm:px-6 lg:px-8">
                <h2 className="text-shadow-section-title text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-4xl">
                  {t('home.pricing.title')}
                </h2>
                <p className="max-w-xl text-sm leading-relaxed text-app-text-secondary sm:text-base">
                  {t('home.pricing.description')}
                </p>
                <PricingTeaserCards />
                <HeroLink href="/pricing" variant="lime" size="sm">
                  {t('home.pricing.teaserCta')}
                </HeroLink>
              </div>
            </RevealSection>

            {/* ── Final CTA ──────────────────────────────────────────────────── */}
            <RevealSection
              trackId="final_cta"
              className="relative overflow-hidden border-t border-app-border/60 bg-[linear-gradient(180deg,rgba(198,255,0,0.08)_0%,transparent_42%,rgba(255,46,139,0.08)_100%)] px-4 pb-32 pt-24 sm:px-0 sm:pb-44 sm:pt-32 lg:pb-48 lg:pt-36"
            >
              <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-brand-gradient" />
              <div className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-[2rem] border border-app-border bg-brand-gradient p-[1px] shadow-soft-lift">
                <div className="relative overflow-hidden rounded-[calc(2rem-1px)] bg-app-elevated px-6 py-14 dark:bg-app-card sm:px-10 sm:py-16">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        'radial-gradient(ellipse at center, rgba(198,255,0,0.07) 0%, transparent 65%)',
                    }}
                  />
                  <div className="relative flex flex-col items-center gap-8 text-center">
                    <div className="flex flex-col gap-3">
                      <h2 className="text-2xl font-black leading-tight tracking-tight text-brand-dark dark:text-brand-white sm:text-3xl lg:text-4xl">
                        {t('home.finalCta.title')}
                      </h2>
                    </div>
                    <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
                      <CtaOfferCard
                        accent="lime"
                        title={t('home.finalCta.eventCtaTitle')}
                        body={t('home.finalCta.eventCtaBody')}
                        action={t('home.finalCta.eventCtaAction')}
                      />
                      <CtaOfferCard
                        accent="pink"
                        title={t('home.finalCta.syncCtaTitle')}
                        body={t('home.finalCta.syncCtaBody')}
                        action={t('home.finalCta.syncCtaAction')}
                      />
                    </div>
                    <HeroLink href={buildAppUrl('/auth/login')} variant="outline" size="sm">
                      {t('home.finalCta.login')}
                    </HeroLink>
                  </div>
                </div>
              </div>
            </RevealSection>
          </div>
        </div>
      </div>

      {/* footer reveal spacer */}
      <div aria-hidden className="h-[30rem] sm:h-96 lg:h-104" />
    </div>
  );
};
