import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { useState } from 'react';

import { HomeFooterReveal } from './components/marketing/HomeFooterReveal';
import { RevealSection } from './components/marketing/RevealSection';
import { ScreenshotCarousel } from './components/marketing/ScreenshotCarousel';
import { SurfaceCard } from './components/marketing/SurfaceCard';
import { HeroLink } from './components/ui/HeroLink';
import { HeroPill } from './components/ui/HeroPill';
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

// ─── Why reason card ───────────────────────────────────────────────────────────

const ReasonCard = ({
  number,
  title,
  body,
  accent,
}: {
  number: string;
  title: string;
  body: string;
  accent: 'lime' | 'pink';
}) => (
  <SurfaceCard className="flex flex-col gap-3 p-6">
    <span
      className={`text-xs font-black tracking-widest uppercase ${
        accent === 'lime'
          ? 'text-[#7aa300] dark:text-brand-lime'
          : 'text-[#b41563] dark:text-brand-pink'
      }`}
    >
      {number}
    </span>
    <p className="font-black text-brand-dark dark:text-brand-white">{title}</p>
    <p className="text-sm leading-relaxed text-app-text-secondary">{body}</p>
  </SurfaceCard>
);

// ─── Feature card ──────────────────────────────────────────────────────────────

const FeatureCard = ({ title, body }: { title: string; body: string }) => (
  <SurfaceCard className="flex flex-col gap-2 p-5">
    <p className="font-black text-brand-dark dark:text-brand-white">{title}</p>
    <p className="text-sm leading-relaxed text-app-text-secondary">{body}</p>
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

  const eventSteps = [
    t('home.offer.eventStep1'),
    t('home.offer.eventStep2'),
    t('home.offer.eventStep2'),
    t('home.offer.eventStep3'),
    t('home.offer.eventStep4'),
    t('home.offer.eventStep5'),
  ];

  const syncSteps = [
    t('home.offer.syncStep1'),
    t('home.offer.syncStep2'),
    t('home.offer.syncStep2'),
    t('home.offer.syncStep3'),
  ];

  return (
    <div className="relative bg-brand-dark dark:bg-brand-white">
      <HomeFooterReveal />

      {/* main card — rounded bottom, scrolls over footer */}
      <div className="relative z-10 overflow-hidden rounded-b-[2.75rem] bg-app-bg shadow-[0_28px_64px_-20px_rgba(0,0,0,0.55)] dark:shadow-[0_30px_70px_-20px_rgba(0,0,0,0.72)] sm:rounded-b-[3.5rem] lg:rounded-b-[4.5rem]">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* ── Hero ──────────────────────────────────────────────────────── */}
          <RevealSection
            revealOnScroll={false}
            className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-2 pb-20 pt-36 sm:min-h-[calc(100svh-7rem)] sm:pb-24 sm:pt-44"
          >
            {/* radial glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
            >
              <div
                className="h-[700px] w-[700px] rounded-full opacity-[0.13] blur-[130px] dark:opacity-[0.1]"
                style={{
                  background: 'radial-gradient(circle, #c6ff00 0%, #ff2e8b 55%, transparent 80%)',
                }}
              />
            </div>

            <motion.div
              initial={isTouchDevice ? false : 'hidden'}
              animate="visible"
              variants={STAGGER}
              className="relative flex max-w-3xl flex-col items-center gap-6 text-center"
            >
              <motion.h1
                variants={FADE_UP}
                className="whitespace-pre-line text-4xl font-black leading-[1.06] tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl lg:text-7xl"
              >
                {t('home.hero.title')}
              </motion.h1>

              <motion.p
                variants={FADE_UP}
                className="max-w-lg text-base leading-relaxed text-app-text-secondary sm:text-lg"
              >
                {t('home.hero.description')}
              </motion.p>

              <motion.div variants={FADE_UP} className="flex flex-col items-center gap-4">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
                  <HeroLink
                    href={buildAppUrl('/auth/register')}
                    variant="lime"
                    size="sm"
                    className="sm:min-h-11 sm:px-5 sm:py-3 sm:text-base"
                  >
                    {t('home.hero.ctaEvent')}
                  </HeroLink>
                  <HeroLink
                    href={buildAppUrl('/auth/register')}
                    variant="pink"
                    size="sm"
                    className="sm:min-h-11 sm:px-5 sm:py-3 sm:text-base"
                  >
                    {t('home.hero.ctaSync')}
                  </HeroLink>
                </div>
                {/* platform compatibility */}
                <div className="flex items-center gap-3 mt-4 sm:mt-6 opacity-50">
                  <span className="text-xs text-app-text-muted">{t('home.hero.worksWith')}</span>
                  <img
                    src="/assets/logos/Providers/Spotify.png"
                    alt="Spotify"
                    className="h-7 w-7 sm:w-10 sm:h-10 rounded-xl object-contain"
                  />
                  <img
                    src="/assets/logos/Providers/AppleMusic.png"
                    alt="Apple Music"
                    className="h-7 w-7 sm:w-10 sm:h-10 rounded-xl object-contain"
                  />
                </div>
              </motion.div>
            </motion.div>
          </RevealSection>

          {/* ── Offer tabs + screenshots ───────────────────────────────────── */}
          <RevealSection className="py-16 sm:py-24">
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

            {/* screenshot carousel — slides in from left (event) or right (sync) */}
            <div className="flex justify-center overflow-hidden">
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
          <RevealSection className="py-16 sm:py-24">
            <div className="flex flex-col gap-10">
              <div className="flex flex-col gap-3">
                <HeroPill variant="lime">{t('home.features.pill')}</HeroPill>
                <h2 className="text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-4xl">
                  {t('home.features.title')}
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <FeatureCard
                  title={t('home.features.nativeTitle')}
                  body={t('home.features.nativeBody')}
                />
                <FeatureCard
                  title={t('home.features.magicLinkTitle')}
                  body={t('home.features.magicLinkBody')}
                />
                <FeatureCard
                  title={t('home.features.crossPlatformTitle')}
                  body={t('home.features.crossPlatformBody')}
                />
                <FeatureCard
                  title={t('home.features.moderationTitle')}
                  body={t('home.features.moderationBody')}
                />
              </div>
            </div>
          </RevealSection>

          {/* ── Why Synqit ────────────────────────────────────────────────── */}
          <RevealSection className="py-16 sm:py-24">
            <div className="flex flex-col gap-10">
              <div className="flex flex-col gap-3">
                <HeroPill variant="pink">{t('home.why.pill')}</HeroPill>
                <h2 className="text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-4xl">
                  {t('home.why.title')}
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <ReasonCard
                  number="01"
                  accent="lime"
                  title={t('home.why.reason1Title')}
                  body={t('home.why.reason1Body')}
                />
                <ReasonCard
                  number="02"
                  accent="pink"
                  title={t('home.why.reason2Title')}
                  body={t('home.why.reason2Body')}
                />
                <ReasonCard
                  number="03"
                  accent="lime"
                  title={t('home.why.reason3Title')}
                  body={t('home.why.reason3Body')}
                />
                <ReasonCard
                  number="04"
                  accent="pink"
                  title={t('home.why.reason4Title')}
                  body={t('home.why.reason4Body')}
                />
              </div>
            </div>
          </RevealSection>

          {/* ── Final CTA ──────────────────────────────────────────────────── */}
          <RevealSection className="pb-28 pt-4 sm:pb-36 sm:pt-4">
            <div className="relative overflow-hidden rounded-[2rem] border border-app-border bg-brand-gradient p-[1px] shadow-soft-lift">
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
                    <HeroPill variant="pink">{t('home.finalCta.pill')}</HeroPill>
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

      {/* footer reveal spacer */}
      <div aria-hidden className="h-100 sm:h-96 lg:h-104" />
    </div>
  );
};
