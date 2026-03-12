import { motion, type Variants } from 'framer-motion';

import { AppAuthActions } from './components/marketing/AppAuthActions';
import { HomeFooterReveal } from './components/marketing/HomeFooterReveal';
import { RevealSection } from './components/marketing/RevealSection';
import { HeroPill } from './components/ui/HeroPill';
import { useI18n } from './lib/i18n';

// ─── Animation variants ────────────────────────────────────────────────────────

const STAGGER: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } },
};

const FADE_UP: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

// ─── Phone mockup ──────────────────────────────────────────────────────────────

type PhoneAccent = 'lime' | 'pink';

const PHONE_ACCENT: Record<
  PhoneAccent,
  { border: string; glow: string; dot: string; bar: string; track: string; btnActive: string }
> = {
  lime: {
    border: 'border-brand-lime/30',
    glow: 'shadow-[0_0_48px_-8px_rgba(198,255,0,0.25)]',
    dot: 'bg-brand-lime',
    bar: 'bg-brand-lime/60',
    track: 'bg-brand-lime/20',
    btnActive: 'bg-brand-lime',
  },
  pink: {
    border: 'border-brand-pink/30',
    glow: 'shadow-[0_0_48px_-8px_rgba(255,46,139,0.25)]',
    dot: 'bg-brand-pink',
    bar: 'bg-brand-pink/60',
    track: 'bg-brand-pink/20',
    btnActive: 'bg-brand-pink',
  },
};

type PhoneMockupProps = {
  accent?: PhoneAccent;
  label: string;
  rows?: number;
  showSearch?: boolean;
};

const PhoneMockup = ({
  accent = 'lime',
  label,
  rows = 4,
  showSearch = false,
}: PhoneMockupProps) => {
  const c = PHONE_ACCENT[accent];
  return (
    <div
      aria-hidden="true"
      className={`relative flex w-[200px] flex-col overflow-hidden rounded-[2.2rem] border-2 bg-app-elevated dark:bg-app-card ${c.border} ${c.glow}`}
      style={{ height: 400 }}
    >
      {/* notch */}
      <div className="mx-auto mt-3.5 h-4 w-20 rounded-full bg-app-surface/80" />
      {/* status bar */}
      <div className="mt-2.5 flex items-center justify-between px-5">
        <div className={`h-1.5 w-8 rounded-full ${c.bar}`} />
        <div className="flex items-center gap-1">
          <div className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
          <div className={`h-1.5 w-1.5 rounded-full ${c.dot} opacity-50`} />
          <div className={`h-1.5 w-1.5 rounded-full ${c.dot} opacity-20`} />
        </div>
      </div>
      {/* body */}
      <div className="mt-4 flex flex-1 flex-col gap-2.5 overflow-hidden px-4">
        <div className="h-3.5 w-2/3 rounded-md bg-app-text/20" />
        {showSearch && (
          <div className="mt-1 flex h-8 items-center gap-2 rounded-xl border border-app-border bg-app-surface/70 px-3">
            <div className="h-2 w-2 rounded-full bg-app-text/20" />
            <div className="h-2 w-3/4 rounded bg-app-text/15" />
          </div>
        )}
        <div className="mt-1 flex flex-col gap-2">
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 rounded-xl bg-app-surface/60 px-3 py-2"
            >
              <div className={`h-7 w-7 shrink-0 rounded-lg ${c.track}`} />
              <div className="flex flex-1 flex-col gap-1">
                <div className="h-2 w-3/4 rounded-sm bg-app-text/20" />
                <div className="h-1.5 w-1/2 rounded-sm bg-app-text/[0.12]" />
              </div>
              <div
                className={`h-6 w-6 shrink-0 rounded-full ${i === 0 ? c.btnActive : 'bg-app-border/60'}`}
              />
            </div>
          ))}
        </div>
      </div>
      {/* label badge */}
      <div className="mb-4 flex justify-center">
        <span
          className={`rounded-full px-3 py-1 text-[10px] font-bold tracking-wide ${
            accent === 'lime'
              ? 'bg-brand-lime/15 text-[#7aa300] dark:text-brand-lime'
              : 'bg-brand-pink/15 text-[#b41563] dark:text-brand-pink'
          }`}
        >
          {label}
        </span>
      </div>
    </div>
  );
};

// ─── Stat badge ────────────────────────────────────────────────────────────────

const StatBadge = ({ value, label }: { value: string; label: string }) => (
  <div className="flex flex-col gap-0.5 rounded-2xl border border-app-border bg-app-elevated/80 px-4 py-3 shadow-soft-lift backdrop-blur-sm dark:bg-app-card/80">
    <span className="text-xl font-black tracking-tight text-brand-dark dark:text-brand-white">
      {value}
    </span>
    <span className="text-xs text-app-text-muted">{label}</span>
  </div>
);

// ─── Step row ──────────────────────────────────────────────────────────────────

const StepRow = ({
  number,
  title,
  body,
  accent = 'lime',
}: {
  number: string;
  title: string;
  body: string;
  accent?: PhoneAccent;
}) => (
  <div className="flex gap-4">
    <div
      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${
        accent === 'lime'
          ? 'bg-brand-lime/15 text-[#7aa300] dark:text-brand-lime'
          : 'bg-brand-pink/15 text-[#b41563] dark:text-brand-pink'
      }`}
    >
      {number}
    </div>
    <div className="flex flex-col gap-0.5 pt-0.5">
      <p className="font-black text-brand-dark dark:text-brand-white">{title}</p>
      <p className="text-sm leading-relaxed text-app-text-secondary">{body}</p>
    </div>
  </div>
);

// ─── Page ──────────────────────────────────────────────────────────────────────

export const HomePage = () => {
  const { t } = useI18n();

  return (
    <div className="relative bg-brand-dark dark:bg-brand-white">
      <HomeFooterReveal />

      {/* main card — rounded bottom, scrolls over footer */}
      <div className="relative z-10 overflow-hidden rounded-b-[2.75rem] bg-app-bg shadow-[0_28px_64px_-20px_rgba(0,0,0,0.55)] dark:shadow-[0_30px_70px_-20px_rgba(0,0,0,0.72)] sm:rounded-b-[3.5rem] lg:rounded-b-[4.5rem]">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* ── Hero ──────────────────────────────────────────────────────── */}
          <RevealSection
            revealOnScroll={false}
            className="relative flex min-h-[calc(100svh-7rem)] flex-col items-center justify-center overflow-hidden px-2 pb-20 pt-36 sm:pb-24 sm:pt-44"
          >
            {/* radial glow behind hero */}
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
              initial="hidden"
              animate="visible"
              variants={STAGGER}
              className="relative flex max-w-3xl flex-col items-center gap-6 text-center"
            >
              <motion.h1
                variants={FADE_UP}
                className="text-4xl font-black leading-[1.08] tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl lg:text-6xl"
              >
                {t('home.hero.title')}
              </motion.h1>

              <motion.p
                variants={FADE_UP}
                className="max-w-xl text-base leading-relaxed text-app-text-secondary sm:text-lg"
              >
                {t('home.hero.description')}
              </motion.p>

              <motion.div variants={FADE_UP}>
                <AppAuthActions
                  primaryLabel={t('home.hero.ctaStart')}
                  secondaryLabel={t('home.hero.ctaLogin')}
                />
              </motion.div>

              <motion.p variants={FADE_UP} className="text-xs text-app-text-muted sm:text-sm">
                {t('home.hero.helper')}
              </motion.p>
            </motion.div>

            {/* phone trio */}
            <motion.div
              initial={{ opacity: 0, y: 44 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="relative mt-16 flex items-end justify-center gap-4 sm:gap-6"
            >
              <div className="hidden translate-y-8 opacity-70 sm:block">
                <PhoneMockup accent="lime" label={t('home.how.step1')} rows={3} />
              </div>
              <PhoneMockup accent="pink" label={t('home.how.step2')} rows={4} showSearch />
              <div className="hidden translate-y-8 opacity-70 sm:block">
                <PhoneMockup accent="lime" label={t('home.how.step3')} rows={3} />
              </div>
            </motion.div>
          </RevealSection>

          {/* ── Stats ─────────────────────────────────────────────────────── */}
          <RevealSection className="py-14 sm:py-16">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatBadge
                value={t('home.metrics.quickShareValue')}
                label={t('home.metrics.quickShare')}
              />
              <StatBadge
                value={t('home.metrics.frictionValue')}
                label={t('home.metrics.friction')}
              />
              <StatBadge value={t('home.metrics.routingValue')} label={t('home.metrics.routing')} />
              <StatBadge value={t('home.metrics.setupValue')} label={t('home.metrics.setup')} />
            </div>
          </RevealSection>

          {/* ── How it works — steps left / phone right ────────────────────── */}
          <RevealSection className="py-16 sm:py-24">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <div className="flex flex-col gap-8">
                <div className="flex flex-col gap-3">
                  <HeroPill variant="lime">{t('home.how.pill')}</HeroPill>
                  <h2 className="text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-4xl">
                    {t('home.how.title')}
                  </h2>
                </div>
                <div className="flex flex-col gap-6">
                  <StepRow
                    number="01"
                    title={t('home.how.step1')}
                    body={t('home.how.step1Body')}
                    accent="lime"
                  />
                  <StepRow
                    number="02"
                    title={t('home.how.step2')}
                    body={t('home.how.step2Body')}
                    accent="pink"
                  />
                  <StepRow
                    number="03"
                    title={t('home.how.step3')}
                    body={t('home.how.step3Body')}
                    accent="lime"
                  />
                </div>
                <div className="hidden sm:block">
                  <AppAuthActions
                    primaryLabel={t('home.hero.ctaStart')}
                    secondaryLabel={t('home.hero.ctaLogin')}
                    size="sm"
                  />
                </div>
              </div>

              <div className="flex justify-center lg:justify-end">
                <div className="relative">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-10 rounded-full blur-3xl"
                    style={{
                      background:
                        'radial-gradient(circle, rgba(255,46,139,0.18) 0%, transparent 70%)',
                    }}
                  />
                  <PhoneMockup accent="pink" label={t('home.how.step2')} rows={5} showSearch />
                </div>
              </div>
            </div>
          </RevealSection>

          {/* ── Why — phone left / stats right ────────────────────────────── */}
          <RevealSection className="py-16 sm:py-24">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <div className="flex justify-center lg:justify-start">
                <div className="relative">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-10 rounded-full blur-3xl"
                    style={{
                      background:
                        'radial-gradient(circle, rgba(198,255,0,0.18) 0%, transparent 70%)',
                    }}
                  />
                  <PhoneMockup accent="lime" label={t('home.how.step1')} rows={4} />
                </div>
              </div>

              <div className="flex flex-col gap-8">
                <div className="flex flex-col gap-3">
                  <h2 className="text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-4xl">
                    {t('home.why.title')}
                  </h2>
                  <p className="max-w-md text-sm leading-relaxed text-app-text-secondary sm:text-base">
                    {t('home.why.description')}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: t('home.why.stat1Value'), label: t('home.why.stat1Label') },
                    { value: t('home.why.stat2Value'), label: t('home.why.stat2Label') },
                    { value: t('home.why.stat3Value'), label: t('home.why.stat3Label') },
                    { value: t('home.why.stat4Value'), label: t('home.why.stat4Label') },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="flex flex-col gap-1 rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card"
                    >
                      <span className="text-2xl font-black tracking-tight text-brand-dark dark:text-brand-white">
                        {s.value}
                      </span>
                      <span className="text-xs text-app-text-muted">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </RevealSection>

          {/* ── Feature cards ──────────────────────────────────────────────── */}
          <RevealSection className="py-16 sm:py-20">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={STAGGER}
              className="grid gap-4 sm:grid-cols-3 sm:gap-5"
            >
              {[
                { title: t('home.cards.hostTitle'), body: t('home.cards.hostBody'), accent: true },
                {
                  title: t('home.cards.guestTitle'),
                  body: t('home.cards.guestBody'),
                  accent: false,
                },
                {
                  title: t('home.cards.providerTitle'),
                  body: t('home.cards.providerBody'),
                  accent: false,
                },
              ].map((card) => (
                <motion.article
                  key={card.title}
                  variants={FADE_UP}
                  className={`rounded-2xl border p-6 shadow-soft-lift ${
                    card.accent
                      ? 'border-brand-lime/25 bg-brand-lime/5 dark:bg-brand-lime/[0.04]'
                      : 'border-app-border bg-app-elevated dark:bg-app-card'
                  }`}
                >
                  <h3
                    className={`mb-2 font-black ${
                      card.accent
                        ? 'text-[#7aa300] dark:text-brand-lime'
                        : 'text-brand-dark dark:text-brand-white'
                    }`}
                  >
                    {card.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-app-text-secondary">{card.body}</p>
                </motion.article>
              ))}
            </motion.div>
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
                <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div className="grid gap-4">
                    <HeroPill variant="pink">{t('home.finalCta.pill')}</HeroPill>
                    <h2 className="text-2xl font-black leading-tight tracking-tight text-brand-dark dark:text-brand-white sm:text-3xl lg:text-4xl">
                      {t('home.finalCta.title')}
                    </h2>
                    <p className="max-w-xl text-sm leading-relaxed text-app-text-secondary sm:text-base">
                      {t('home.finalCta.description')}
                    </p>
                  </div>
                  <AppAuthActions
                    primaryLabel={t('home.finalCta.create')}
                    secondaryLabel={t('home.finalCta.login')}
                    primaryVariant="pink"
                  />
                </div>
              </div>
            </div>
          </RevealSection>
        </div>
      </div>

      {/* footer reveal spacer */}
      <div aria-hidden className="h-[28rem] sm:h-[24rem] lg:h-[26rem]" />
    </div>
  );
};
