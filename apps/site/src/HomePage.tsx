import { motion, type Variants } from 'framer-motion';

import { AppAuthActions } from './components/marketing/AppAuthActions';
import { HomeFooterReveal } from './components/marketing/HomeFooterReveal';
import { PlatformPreview } from './components/marketing/PlatformPreview';
import { RevealSection } from './components/marketing/RevealSection';
import { SectionHeading } from './components/marketing/SectionHeading';
import { SurfaceCard } from './components/marketing/SurfaceCard';
import { BlurSpotLayer } from './components/ui/BlurSpotLayer';
import { HeroPill } from './components/ui/HeroPill';
import { useI18n } from './lib/i18n';

const GRID_STAGGER_VARIANTS: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.12,
    },
  },
};

const GRID_ITEM_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.72,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

export const HomePage = () => {
  const { t } = useI18n();

  return (
    <div className="relative bg-brand-dark dark:bg-brand-white">
      <HomeFooterReveal />

      <div className="relative z-10 overflow-hidden rounded-b-[2.75rem] bg-app-bg shadow-[0_28px_64px_-20px_rgba(0,0,0,0.55)] dark:shadow-[0_30px_70px_-20px_rgba(0,0,0,0.72)] sm:rounded-b-[3.5rem] lg:rounded-b-[4.5rem]">
        <div className="mx-auto grid w-full max-w-6xl gap-36 px-4 pb-24 pt-24 sm:gap-44 sm:px-6 sm:pb-24 sm:pt-10 lg:gap-56 lg:px-8 lg:pb-28 lg:pt-30">
          <RevealSection
            revealOnScroll={false}
            className="relative flex min-h-[calc(100svh-7rem)] items-center overflow-hidden rounded-4xl border border-app-border bg-app-elevated px-5 py-14 shadow-soft-lift dark:bg-app-card sm:min-h-[calc(100svh-8rem)] sm:px-8 sm:py-16 lg:px-12 lg:py-20"
          >
            <BlurSpotLayer
              filterId="hero-blur-filter"
              spots={[
                { id: 'hero-spot-0', size: 180, top: 15, left: -5, color: 'rgba(255,46,139,0.22)' },
                { id: 'hero-spot-1', size: 220, top: -5, left: 105, color: 'rgba(198,255,0,0.25)' },
              ]}
              className="pointer-events-none absolute inset-0"
            />

            <div className="relative grid w-full items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
              <div className="grid gap-7">
                <div className="flex flex-wrap items-center gap-2">
                  <HeroPill variant="lime">{t('home.hero.pillMvp')}</HeroPill>
                  <HeroPill variant="pink">{t('home.hero.pillMagicLink')}</HeroPill>
                </div>
                <h1 className="max-w-4xl text-4xl font-black leading-tight tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl lg:text-6xl">
                  {t('home.hero.title')}
                </h1>
                <p className="max-w-2xl text-base text-neutral-700 dark:text-neutral-300 sm:text-lg">
                  {t('home.hero.description')}
                </p>
                <AppAuthActions
                  primaryLabel={t('home.hero.ctaStart')}
                  secondaryLabel={t('home.hero.ctaLogin')}
                />
                <p className="text-xs text-app-text-muted sm:text-sm">{t('home.hero.helper')}</p>
              </div>

              <div className="grid gap-5 rounded-2xl border border-app-border bg-app-bg/80 p-4 backdrop-blur sm:p-5 dark:bg-app-elevated/70">
                <PlatformPreview />
                <div className="grid grid-cols-2 gap-3">
                  {[
                    [t('home.metrics.quickShare'), t('home.metrics.quickShareValue')],
                    [t('home.metrics.friction'), t('home.metrics.frictionValue')],
                    [t('home.metrics.routing'), t('home.metrics.routingValue')],
                    [t('home.metrics.setup'), t('home.metrics.setupValue')],
                  ].map(([label, value]) => (
                    <SurfaceCard key={label} className="rounded-xl px-3 py-2 shadow-none">
                      <p className="text-xs text-app-text-muted">{label}</p>
                      <p className="text-sm font-semibold">{value}</p>
                    </SurfaceCard>
                  ))}
                </div>
              </div>
            </div>
          </RevealSection>

          <RevealSection className="grid gap-9 lg:gap-10">
            <SectionHeading title={t('home.why.title')} description={t('home.why.description')} />
            <motion.div
              variants={GRID_STAGGER_VARIANTS}
              className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6"
            >
              {[
                { value: t('home.why.stat1Value'), label: t('home.why.stat1Label') },
                { value: t('home.why.stat2Value'), label: t('home.why.stat2Label') },
                { value: t('home.why.stat3Value'), label: t('home.why.stat3Label') },
                { value: t('home.why.stat4Value'), label: t('home.why.stat4Label') },
              ].map((item) => (
                <motion.div key={item.label} variants={GRID_ITEM_VARIANTS}>
                  <SurfaceCard>
                    <p className="text-2xl font-black tracking-tight">{item.value}</p>
                    <p className="mt-1 text-sm text-app-text-secondary">{item.label}</p>
                  </SurfaceCard>
                </motion.div>
              ))}
            </motion.div>
          </RevealSection>

          <RevealSection className="grid gap-9 lg:gap-10">
            <SectionHeading
              title={t('home.how.title')}
              aside={<HeroPill variant="lime">{t('home.how.pill')}</HeroPill>}
            />
            <motion.div
              variants={GRID_STAGGER_VARIANTS}
              className="grid gap-5 lg:grid-cols-3 lg:gap-6"
            >
              {[
                {
                  step: '01',
                  title: t('home.how.step1'),
                  body: t('home.how.step1Body'),
                },
                {
                  step: '02',
                  title: t('home.how.step2'),
                  body: t('home.how.step2Body'),
                },
                {
                  step: '03',
                  title: t('home.how.step3'),
                  body: t('home.how.step3Body'),
                },
              ].map((item) => (
                <motion.div key={item.step} variants={GRID_ITEM_VARIANTS}>
                  <SurfaceCard>
                    <p className="text-xs font-black tracking-wider text-app-text-muted">
                      {item.step}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm text-app-text-secondary">{item.body}</p>
                  </SurfaceCard>
                </motion.div>
              ))}
            </motion.div>
          </RevealSection>

          <RevealSection className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {[
              {
                title: t('home.cards.hostTitle'),
                body: t('home.cards.hostBody'),
              },
              {
                title: t('home.cards.guestTitle'),
                body: t('home.cards.guestBody'),
              },
              {
                title: t('home.cards.providerTitle'),
                body: t('home.cards.providerBody'),
              },
            ].map((item) => (
              <motion.div key={item.title} variants={GRID_ITEM_VARIANTS}>
                <SurfaceCard>
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm text-app-text-secondary">{item.body}</p>
                </SurfaceCard>
              </motion.div>
            ))}
          </RevealSection>

          <RevealSection className="rounded-[2rem] border border-app-border bg-brand-gradient p-[1px] shadow-soft-lift">
            <div className="rounded-[calc(2rem-1px)] bg-app-elevated px-5 py-12 dark:bg-app-card sm:px-8 sm:py-14">
              <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="grid gap-3">
                  <HeroPill variant="pink">{t('home.finalCta.pill')}</HeroPill>
                  <h2 className="text-2xl font-bold text-brand-dark dark:text-brand-white sm:text-3xl">
                    {t('home.finalCta.title')}
                  </h2>
                  <p className="max-w-2xl text-sm text-app-text-secondary sm:text-base">
                    {t('home.finalCta.description')}
                  </p>
                </div>
                <AppAuthActions
                  primaryLabel={t('home.finalCta.create')}
                  secondaryLabel={t('home.finalCta.login')}
                />
              </div>
            </div>
          </RevealSection>
        </div>
      </div>

      <div aria-hidden className="h-[28rem] sm:h-[24rem] lg:h-[26rem]" />
    </div>
  );
};
