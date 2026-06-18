import {
  AnimatePresence,
  motion,
  type Variants,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

import { AccentInfoCard } from './components/marketing/AccentInfoCard';
import { HeroBackdrop, HostWorkspaceBackdrop } from './components/marketing/HeroMockup';
import {
  PhoneIcon3D,
  ShieldIcon3D,
  SparkIcon3D,
  SparkleIcon3D,
  SwapIcon3D,
} from './components/marketing/Icon3D';
import { MarketingPageShell } from './components/marketing/MarketingPageShell';
import { PricingTeaserCards } from './components/marketing/PricingTeaserCards';
import { RevealSection } from './components/marketing/RevealSection';
import { ScreenshotCarousel } from './components/marketing/ScreenshotCarousel';
import { SectionCta } from './components/marketing/SectionCta';
import { SectionHeading } from './components/marketing/SectionHeading';
import { SegmentedToggle } from './components/marketing/SegmentedToggle';
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

  const showcaseTabs = [
    { value: 'event' as const, label: t('home.offer.tabEvent'), activeVariant: 'lime' as const },
    { value: 'sync' as const, label: t('home.offer.tabSync'), activeVariant: 'pink' as const },
  ];

  const featureCards = [
    {
      icon: PhoneIcon3D,
      title: t('home.features.nativeTitle'),
      body: t('home.features.nativeShortBody'),
      accent: 'lime' as const,
    },
    {
      icon: SparkleIcon3D,
      title: t('home.features.magicLinkTitle'),
      body: t('home.features.magicLinkShortBody'),
      accent: 'pink' as const,
    },
    {
      icon: SwapIcon3D,
      title: t('home.features.crossPlatformTitle'),
      body: t('home.features.crossPlatformShortBody'),
      accent: 'lime' as const,
    },
    {
      icon: ShieldIcon3D,
      title: t('home.features.moderationTitle'),
      body: t('home.features.moderationShortBody'),
      accent: 'pink' as const,
    },
  ];

  const reasonCards = [
    {
      number: '01',
      icon: SparkIcon3D,
      title: t('home.why.reason1Title'),
      body: t('home.why.reason1Body'),
      accent: 'lime' as const,
    },
    {
      number: '02',
      icon: PhoneIcon3D,
      title: t('home.why.reason2Title'),
      body: t('home.why.reason2Body'),
      accent: 'pink' as const,
    },
    {
      number: '03',
      icon: SwapIcon3D,
      title: t('home.why.reason3Title'),
      body: t('home.why.reason3Body'),
      accent: 'lime' as const,
    },
    {
      number: '04',
      icon: ShieldIcon3D,
      title: t('home.why.reason4Title'),
      body: t('home.why.reason4Body'),
      accent: 'pink' as const,
    },
  ];

  return (
    <MarketingPageShell>
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
              <SegmentedToggle
                value={activeTab}
                onChange={setActiveTab}
                options={showcaseTabs}
                layoutId="showcase-tab-pill"
              />

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
          <div className="mt-10 flex justify-center">
            <HeroLink
              href={buildAppUrl('/auth/register')}
              variant={activeTab === 'event' ? 'lime' : 'pink'}
              size="sm"
            >
              {t(activeTab === 'event' ? 'home.offer.eventCta' : 'home.offer.syncCta')}
            </HeroLink>
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
          <div className="grid w-full lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center">
            <div className="px-6 sm:px-6 lg:px-8">
              <div className="ml-auto flex w-full max-w-2xl flex-col gap-8">
                <SectionHeading
                  title={t('home.features.title')}
                  description={t('home.features.description')}
                  titleClassName="text-shadow-section-title text-3xl font-black tracking-tight sm:text-4xl"
                  descriptionClassName="leading-relaxed"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  {featureCards.map((card) => (
                    <AccentInfoCard key={card.title} {...card} />
                  ))}
                </div>
                <SectionCta
                  href="/pricing"
                  variant="outline"
                  label={t('home.features.cta')}
                  className="justify-start"
                />
              </div>
            </div>
            <div className="relative min-h-104 overflow-hidden lg:min-h-216">
              <div className="pointer-events-none absolute inset-0 left-0 w-full lg:flex lg:items-center lg:justify-start">
                <div className="mx-auto w-[120%] -translate-x-[10%] scale-[1.06] sm:w-[205%] sm:translate-x-[8%] sm:scale-[1.14] lg:mx-0 lg:w-[235%] lg:translate-x-[10%] lg:scale-[1.18]">
                  <HostWorkspaceBackdrop />
                </div>
              </div>
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
            <SectionHeading
              title={t('home.why.title')}
              description={t('home.why.description')}
              titleClassName="text-shadow-section-title text-3xl font-black tracking-tight sm:text-4xl"
              descriptionClassName="leading-relaxed"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {reasonCards.map((card) => (
                <AccentInfoCard key={card.number} {...card} badge={card.number} size="lg" />
              ))}
            </div>
            <SectionCta
              href={buildAppUrl('/auth/register')}
              variant="lime"
              label={t('home.why.cta')}
            />
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
            <SectionHeading
              title={t('home.pricing.title')}
              description={t('home.pricing.description')}
              align="center"
              titleClassName="text-shadow-section-title text-3xl font-black tracking-tight sm:text-4xl"
              descriptionClassName="max-w-xl leading-relaxed"
            />
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
    </MarketingPageShell>
  );
};
