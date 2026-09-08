import {
  CONNECT_SERVICES,
  LINK_SERVICES,
  ServiceLogo,
  Sticker,
  type StickerTone,
} from '@synqit/ui';
import { motion, type Variants } from 'framer-motion';
import { ArrowDown, ArrowLeftRight, ArrowRight, PartyPopper, Share2 } from 'lucide-react';
import { type ReactNode } from 'react';

import { HeroScreens } from './components/marketing/HeroScreens';
import { HeroScrollCue } from './components/marketing/HeroScrollCue';
import { HighlightedText } from './components/marketing/HighlightedText';
import { MarketingPageShell } from './components/marketing/MarketingPageShell';
import { RevealSection } from './components/marketing/RevealSection';
import { ServiceCompatibility } from './components/marketing/ServiceCompatibility';
import { type Service, ServiceShowcase } from './components/marketing/ServiceShowcase';
import { HeroLink } from './components/ui/HeroLink';
import { buildAppUrl } from './lib/app-url';
import { useI18n } from './lib/i18n';
import { isTouchDevice } from './lib/motion';
import { useIsPhone } from './lib/viewport';

// ─── Animation variants ────────────────────────────────────────────────────────

const STAGGER: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const FADE_UP: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

// ─── Static content ────────────────────────────────────────────────────────────

const SHOT = '/assets/presentation';

// Screens that rotate inside the hero phone (captions reuse the flow-step copy).
const HERO_SCREENS = [
  { src: `${SHOT}/Events-step-1.png`, captionKey: 'home.how.event.step1' },
  { src: `${SHOT}/Events-step-3.png`, captionKey: 'home.how.event.step4' },
  { src: `${SHOT}/Sync-step-2-2.png`, captionKey: 'home.how.share.step3' },
  { src: `${SHOT}/Events-step-4-2.png`, captionKey: 'home.how.event.step6' },
  { src: `${SHOT}/Sync-step-3.png`, captionKey: 'home.how.share.step4' },
];

// ─── Small building blocks ─────────────────────────────────────────────────────

const Container = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={`mx-auto w-full max-w-6xl px-5 sm:px-6 lg:px-8 ${className ?? ''}`.trim()}>
    {children}
  </div>
);

const SectionIntro = ({
  eyebrow,
  title,
  tone = 'paper',
  align = 'left',
  titleClassName = '',
}: {
  eyebrow: string;
  title: ReactNode;
  tone?: StickerTone;
  align?: 'left' | 'center';
  /**
   * Widen a title that would otherwise break awkwardly. Titles are capped at
   * `max-w-2xl` so a long one wraps into a readable block; pass an `sm:max-w-*`
   * to let a specific one run the full column on a wide screen. Phones are too
   * narrow for any of them to fit on one line, so they still wrap there.
   */
  titleClassName?: string;
}) => (
  <div
    className={`flex flex-col gap-4 ${align === 'center' ? 'items-center text-center' : 'items-start'}`}
  >
    <Sticker tone={tone} tilt="-rotate-2">
      {eyebrow}
    </Sticker>
    <h2
      className={`max-w-2xl text-pretty text-3xl font-black text-display-heavy leading-[1.02] tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl ${titleClassName}`}
    >
      {title}
    </h2>
  </div>
);

// ─── Page ──────────────────────────────────────────────────────────────────────

export const HomePage = () => {
  const { t } = useI18n();
  const isPhone = useIsPhone();
  const registerHref = buildAppUrl('/auth/register');
  const vibeWords = t('home.vibe.words')
    .split('|')
    .map((word) => word.trim())
    .filter(Boolean);

  // Transfer has no phone captures yet, so it reuses the provider and playlist
  // screens from the sharing flow.
  const services: [Service, Service, Service] = [
    {
      id: 'event',
      tone: 'lime',
      icon: PartyPopper,
      tag: t('home.services.event.tag'),
      title: t('home.services.event.title'),
      body: t('home.services.event.body'),
      cta: t('home.services.event.cta'),
      href: registerHref,
      stepsKey: 'home.how.event',
      images: [
        `${SHOT}/Events-step-1.png`,
        `${SHOT}/Events-step-2-1.png`,
        `${SHOT}/Events-step-2-2.png`,
        `${SHOT}/Events-step-3.png`,
        `${SHOT}/Events-step-4-1.png`,
        `${SHOT}/Events-step-4-2.png`,
      ],
    },
    {
      id: 'share',
      tone: 'pink',
      icon: Share2,
      tag: t('home.services.share.tag'),
      title: t('home.services.share.title'),
      body: t('home.services.share.body'),
      cta: t('home.services.share.cta'),
      href: registerHref,
      stepsKey: 'home.how.share',
      images: [
        `${SHOT}/Sync-step-1.png`,
        `${SHOT}/Sync-step-2-1.png`,
        `${SHOT}/Sync-step-2-2.png`,
        `${SHOT}/Sync-step-3.png`,
      ],
    },
    {
      id: 'transfer',
      tone: 'ink',
      icon: ArrowLeftRight,
      tag: t('home.services.transfer.tag'),
      title: t('home.services.transfer.title'),
      body: t('home.services.transfer.body'),
      cta: t('home.services.transfer.cta'),
      href: buildAppUrl('/transfer'),
      stepsKey: 'home.how.transfer',
      images: [`${SHOT}/Sync-step-1.png`, `${SHOT}/Sync-step-2-1.png`, `${SHOT}/Sync-step-2-2.png`],
    },
  ];

  return (
    <MarketingPageShell>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <RevealSection
        revealOnScroll={false}
        trackId="hero"
        className="relative flex min-h-svh items-center overflow-visible pb-24 pt-16 sm:block sm:min-h-0 sm:overflow-hidden sm:pb-24 sm:pt-40"
      >
        <Container>
          <motion.div
            initial={isTouchDevice ? false : 'hidden'}
            animate="visible"
            variants={STAGGER}
            className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-6"
          >
            <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:gap-7 sm:text-left">
              <motion.div variants={FADE_UP}>
                <Sticker tone="paper" tilt="-rotate-2">
                  {t('home.hero.eyebrow')}
                </Sticker>
              </motion.div>
              <motion.h1
                variants={FADE_UP}
                className="text-[3.25rem] font-black text-display-heavy leading-[0.98] tracking-tight text-balance text-brand-dark dark:text-brand-white sm:text-6xl lg:text-[4.25rem]"
              >
                <HighlightedText value={t('home.hero.title')} />
              </motion.h1>
              <motion.p
                variants={FADE_UP}
                className="max-w-md text-base leading-relaxed text-app-text-secondary sm:text-lg"
              >
                {t('home.hero.description')}
              </motion.p>
              <motion.div
                variants={FADE_UP}
                className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:mt-0 sm:justify-start sm:gap-4"
              >
                <HeroLink href={registerHref} variant="lime" size="hero">
                  {t('home.hero.ctaPrimary')}
                </HeroLink>
                <a
                  href="#how"
                  className="focus-ring-brand inline-flex items-center gap-1.5 rounded-full py-2 text-xs font-bold text-app-text underline decoration-brand-pink decoration-2 underline-offset-4 transition hover:text-brand-pink sm:text-base"
                >
                  {t('home.hero.ctaSecondary')}
                  <ArrowDown
                    size={16}
                    aria-hidden
                    className="hidden motion-safe:animate-bounce sm:block"
                  />
                </a>
              </motion.div>
              <motion.div variants={FADE_UP}>
                <HeroScrollCue label={t('home.hero.ctaSecondary')} />
              </motion.div>
            </div>

            {/* Skipped on phones: above the fold there is no room for it beside the
                copy, and mounting it pre-warms ten screenshots and starts a swap
                timer — all of it upfront work for something nobody sees there. */}
            {isPhone ? null : (
              <motion.div
                variants={FADE_UP}
                className="relative mx-auto flex w-full max-w-[19rem] justify-center py-6 sm:max-w-sm lg:max-w-md lg:py-10"
              >
                <div
                  aria-hidden="true"
                  className="absolute left-[4%] top-[12%] h-[55%] w-[70%] rounded-full bg-brand-lime/35 blur-3xl dark:bg-brand-lime/20"
                />
                <div
                  aria-hidden="true"
                  className="absolute bottom-[8%] right-[0%] h-[45%] w-[62%] rounded-full bg-brand-pink/30 blur-3xl dark:bg-brand-pink/20"
                />
                <HeroScreens
                  images={HERO_SCREENS.map((screen) => screen.src)}
                  captions={HERO_SCREENS.map((screen) => t(screen.captionKey))}
                  className="relative z-10 w-[13.5rem] sm:w-[15.5rem] lg:w-[17.5rem]"
                />
              </motion.div>
            )}
          </motion.div>
        </Container>
      </RevealSection>

      {/* ── Services + how it works (one interactive section) ─────────── */}
      {/* The showcase is tall, so the anchor lands tight under the fixed navbar rather
          than a full section-padding below it: that reclaimed space is what brings the
          phone's lower half into the first screen. */}
      <RevealSection
        id="how"
        trackId="services"
        className="relative scroll-mt-12 pb-16 pt-2 sm:py-24"
      >
        <Container className="flex flex-col gap-4">
          <SectionIntro
            eyebrow={t('home.services.eyebrow')}
            title=<HighlightedText value={t('home.services.title')} />
          />
          <p className="max-w-xl text-sm leading-relaxed text-app-text-secondary sm:text-base">
            {t('home.how.lead')}
          </p>
        </Container>
        <div className="mx-auto mt-8 w-full max-w-6xl px-5 sm:px-6 lg:mt-12 lg:px-8">
          <ServiceShowcase services={services} swipeHint={t('home.services.swipeHint')} />
        </div>

        {/* The marquee's band from lower down, held still and tilted the other way:
            this one is a fact list, and two bands leaning the same way would read
            as one repeated element rather than two beats of the page. */}
        <div className="-mx-6 mt-12 rotate-1 border-y-2 border-app-text bg-brand-dark py-3 text-brand-white dark:bg-brand-white dark:text-brand-dark sm:mt-16">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-8 sm:gap-x-7">
            <span className="text-xs font-black uppercase tracking-[0.22em] sm:text-sm">
              {t('home.compatStrip.label')}
            </span>
            {/* Smaller and closer together on a phone: the row grows with every
                service added, and at h-7 five of them already dominate the band. */}
            <span className="flex items-center gap-2 sm:gap-3">
              {[...CONNECT_SERVICES, ...LINK_SERVICES].map((service) => (
                <ServiceLogo
                  key={service.id}
                  service={service.id}
                  className="h-5 w-5 sm:h-7 sm:w-7"
                />
              ))}
            </span>
            <a
              href="/faq#matrix"
              className="focus-ring-brand group inline-flex items-center gap-1.5 rounded-full text-xs font-black uppercase tracking-[0.16em] underline decoration-brand-pink decoration-2 underline-offset-4 transition hover:text-brand-pink sm:text-sm"
            >
              {t('home.compatStrip.cta')}
              <ArrowRight
                size={14}
                aria-hidden
                className="transition group-hover:translate-x-0.5"
              />
            </a>
          </div>
        </div>
      </RevealSection>

      {/* ── Which services, and what each one can do ──────────────────── */}
      <RevealSection
        id="services"
        trackId="compatibility"
        className="relative scroll-mt-24 py-16 sm:py-24"
      >
        <Container className="flex flex-col gap-4">
          <SectionIntro
            eyebrow={t('home.compat.eyebrow')}
            title=<HighlightedText value={t('home.compat.title')} />
            tone="lime"
            // The French title needs ~860px at this size, so 2xl broke it mid-phrase.
            titleClassName="sm:max-w-4xl"
          />
          <p className="max-w-xl text-sm leading-relaxed text-app-text-secondary sm:text-base">
            {t('home.compat.lead')}
          </p>
        </Container>
        <Container className="mt-10 lg:mt-14">
          <ServiceCompatibility />
          {/* Centred under the two cards: it answers both of them, so hanging it
              off the left edge made it read as a footnote to the first one. */}
          <div className="mt-8 flex justify-center">
            <a
              href="/faq#matrix"
              className="focus-ring-brand inline-flex items-center gap-1 rounded-full text-sm font-bold text-app-text underline decoration-brand-pink decoration-2 underline-offset-4 transition hover:text-brand-pink"
            >
              {t('home.compat.seeAll')}
              <ArrowRight size={14} aria-hidden />
            </a>
          </div>
        </Container>
      </RevealSection>

      {/* ── Statement + marquee ───────────────────────────────────────── */}
      <section className="relative py-12 sm:py-20">
        <Container>
          <p className="text-center text-2xl font-black text-display-heavy leading-tight tracking-tight text-brand-dark dark:text-brand-white sm:text-4xl lg:text-5xl">
            <HighlightedText value={t('home.vibe.statement')} />
          </p>
        </Container>
        <div className="mt-10 -mx-6 -rotate-1 border-y-2 border-app-text bg-brand-dark py-3 text-brand-white dark:bg-brand-white dark:text-brand-dark sm:mt-14">
          <div className="overflow-hidden">
            <div aria-hidden="true" className="flex w-max motion-safe:animate-marquee">
              {[...vibeWords, ...vibeWords].map((word, i) => (
                <span
                  key={`${word}-${i}`}
                  className="flex items-center gap-5 whitespace-nowrap px-2.5 text-sm font-black uppercase tracking-[0.22em] sm:text-base"
                >
                  {word}
                  <span className={i % 2 === 0 ? 'text-brand-lime' : 'text-brand-pink'}>✦</span>
                </span>
              ))}
            </div>
            <ul className="sr-only">
              {vibeWords.map((word) => (
                <li key={word}>{word}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Pricing teaser ────────────────────────────────────────────── */}
      <RevealSection trackId="pricing" className="relative py-16 sm:py-24">
        <Container className="max-w-4xl">
          <div className="rounded-3xl border-2 border-app-text bg-app-elevated p-6 shadow-sticker dark:bg-app-card sm:p-10">
            <h2 className="text-center text-2xl font-black text-display-heavy leading-tight tracking-tight text-brand-dark dark:text-brand-white sm:text-4xl">
              <HighlightedText value={t('home.pricing.teaserTitle')} />
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-3 rounded-2xl border border-app-border bg-app-surface p-5">
                <Sticker tone="lime" tilt="-rotate-1">
                  {t('home.pricing.teaserEvents')}
                </Sticker>
                <p className="text-sm leading-relaxed text-app-text-secondary">
                  {t('home.pricing.teaserEventsBody')}
                </p>
              </div>
              <div className="flex flex-col gap-3 rounded-2xl border border-app-border bg-app-surface p-5">
                <Sticker tone="pink" tilt="rotate-1">
                  {t('home.pricing.teaserSharing')}
                </Sticker>
                <p className="text-sm leading-relaxed text-app-text-secondary">
                  {t('home.pricing.teaserSharingBody')}
                </p>
              </div>
              <div className="flex flex-col gap-3 rounded-2xl border border-app-border bg-app-surface p-5 sm:col-span-2 lg:col-span-1">
                <Sticker tone="ink" tilt="-rotate-1">
                  {t('home.pricing.teaserTransfer')}
                </Sticker>
                <p className="text-sm leading-relaxed text-app-text-secondary">
                  {t('home.pricing.teaserTransferBody')}
                </p>
              </div>
            </div>
            <div className="mt-8 flex justify-center">
              <HeroLink href="/pricing" variant="outline" size="sm">
                {t('home.pricing.teaserCta')}
              </HeroLink>
            </div>
          </div>
        </Container>
      </RevealSection>

      {/* ── Final CTA ─────────────────────────────────────────────────── */}
      <RevealSection trackId="final_cta" className="relative pb-28 pt-6 sm:pb-32 sm:pt-10">
        <Container className="max-w-5xl">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-brand-dark px-6 py-14 text-center text-brand-white dark:bg-brand-white dark:text-brand-dark sm:px-12 sm:py-20">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(rgba(254,254,254,0.16)_1px,transparent_1px)] [background-size:14px_14px] dark:[background-image:radial-gradient(rgba(34,34,34,0.16)_1px,transparent_1px)]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-10 -top-10 h-48 w-48 rounded-full bg-brand-lime/35 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-12 -right-8 h-52 w-52 rounded-full bg-brand-pink/40 blur-3xl"
            />
            <h2 className="relative text-3xl font-black text-display-heavy leading-[1.02] tracking-tight sm:text-5xl">
              <HighlightedText value={t('home.finalCta.title')} />
            </h2>
            <div className="relative mt-8 flex flex-col items-center gap-4">
              <HeroLink href={registerHref} variant="lime" size="md">
                {t('home.finalCta.cta')}
              </HeroLink>
              <a
                href={buildAppUrl('/auth/login')}
                className="focus-ring-brand rounded-full text-sm font-bold underline decoration-2 underline-offset-4 opacity-80 transition hover:opacity-100"
              >
                {t('home.finalCta.login')}
              </a>
            </div>
          </div>
        </Container>
      </RevealSection>
    </MarketingPageShell>
  );
};
