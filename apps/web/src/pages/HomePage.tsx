import { Link } from '@tanstack/react-router';
import { motion, type Variants } from 'framer-motion';

import { PlatformPreview } from '../components/marketing/PlatformPreview';
import { BrandLogo } from '../components/ui/BrandLogo';
import { HeroCtaLink } from '../components/ui/HeroCtaLink';
import { HeroPill } from '../components/ui/HeroPill';

const SECTION_REVEAL_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 42 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.92,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

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

export const HomePage = () => (
  <div className="mx-auto grid w-full max-w-6xl gap-36 px-4 py-14 sm:gap-44 sm:px-6 sm:py-10 lg:gap-56 lg:px-8 lg:py-14">
    <div className="fixed left-4 top-4 z-20 sm:left-6 sm:top-6">
      <Link to="/" aria-label="Synqit home" className="inline-flex">
        <BrandLogo className="h-10 w-auto sm:h-20" />
      </Link>
    </div>
    <motion.section
      initial="hidden"
      animate="visible"
      variants={SECTION_REVEAL_VARIANTS}
      className="relative flex min-h-[calc(100svh-7rem)] items-center overflow-hidden rounded-4xl border border-app-border bg-app-elevated px-5 py-14 shadow-soft-lift dark:bg-app-card sm:min-h-[calc(100svh-8rem)] sm:px-8 sm:py-16 lg:px-12 lg:py-20"
    >
      <div className="pointer-events-none absolute -left-12 top-12 h-40 w-40 rounded-full bg-brand-pink/20 blur-2xl" />
      <div className="pointer-events-none absolute -right-14 -top-14 h-52 w-52 rounded-full bg-brand-lime/25 blur-3xl" />

      <div className="relative grid w-full items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div className="grid gap-7">
          <div className="flex flex-wrap items-center gap-2">
            <HeroPill variant="lime">Shared Playlist MVP</HeroPill>
            <HeroPill variant="pink">Magic Link Guest Flow</HeroPill>
          </div>
          <h1 className="max-w-4xl text-4xl font-black leading-tight tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl lg:text-6xl">
            Collaborative event playlists, without forcing guests to sign up.
          </h1>
          <p className="max-w-2xl text-base text-neutral-700 dark:text-neutral-300 sm:text-lg">
            Synqit gives hosts a shareable link. Guests open it, search songs, and contribute in
            seconds while tracks land directly in the host provider playlist.
          </p>
          <div className="flex flex-wrap items-center gap-3.5">
            <HeroCtaLink to="/auth/register" variant="lime">
              Start as host
            </HeroCtaLink>
            <HeroCtaLink to="/auth/login" variant="outline">
              Login
            </HeroCtaLink>
          </div>
          <p className="text-xs text-app-text-muted sm:text-sm">
            Built for fast guest contribution on mobile, tablet, and desktop.
          </p>
        </div>

        <div className="grid gap-5 rounded-2xl border border-app-border bg-app-bg/80 p-4 backdrop-blur sm:p-5 dark:bg-app-elevated/70">
          <PlatformPreview />
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Quick share', 'Magic link'],
              ['Guest friction', 'Zero login'],
              ['Track routing', 'Host provider'],
              ['Setup time', '< 1 minute'],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-app-border bg-app-elevated px-3 py-2 dark:bg-app-card"
              >
                <p className="text-xs text-app-text-muted">{label}</p>
                <p className="text-sm font-semibold">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.section>

    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      variants={SECTION_REVEAL_VARIANTS}
      className="grid gap-9 lg:gap-10"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-bold text-brand-dark dark:text-brand-white sm:text-3xl">
          Why hosts choose Synqit for event playlists
        </h2>
        <p className="max-w-2xl text-sm text-app-text-secondary sm:text-base">
          Structured for clarity and speed: create, share, collect tracks, moderate.
        </p>
      </div>
      <motion.div
        variants={GRID_STAGGER_VARIANTS}
        className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6"
      >
        {[
          { value: '1 link', label: 'Guest entry point' },
          { value: '< 30s', label: 'Typical guest add flow' },
          { value: '2 providers', label: 'Spotify + Apple Music' },
          { value: 'Host control', label: 'Edit, revoke, close' },
        ].map((item) => (
          <motion.article
            key={item.label}
            variants={GRID_ITEM_VARIANTS}
            className="rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card"
          >
            <p className="text-2xl font-black tracking-tight">{item.value}</p>
            <p className="mt-1 text-sm text-app-text-secondary">{item.label}</p>
          </motion.article>
        ))}
      </motion.div>
    </motion.section>

    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      variants={SECTION_REVEAL_VARIANTS}
      className="grid gap-9 lg:gap-10"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-bold text-brand-dark dark:text-brand-white sm:text-3xl">
          How it works
        </h2>
        <HeroPill variant="lime">Mobile-first flow</HeroPill>
      </div>
      <motion.div variants={GRID_STAGGER_VARIANTS} className="grid gap-5 lg:grid-cols-3 lg:gap-6">
        {[
          {
            step: '01',
            title: 'Host sets up event',
            body: 'Connect provider, create the event playlist, and generate a magic link.',
          },
          {
            step: '02',
            title: 'Guests add tracks',
            body: 'Guests open the link and contribute songs from the host provider catalog.',
          },
          {
            step: '03',
            title: 'Host curates live',
            body: 'Host reviews tracks, removes items, and closes the event when ready.',
          },
        ].map((item) => (
          <motion.article
            key={item.step}
            variants={GRID_ITEM_VARIANTS}
            className="rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:bg-app-card"
          >
            <p className="text-xs font-black tracking-wider text-app-text-muted">{item.step}</p>
            <h3 className="mt-2 text-lg font-semibold">{item.title}</h3>
            <p className="mt-2 text-sm text-app-text-secondary">{item.body}</p>
          </motion.article>
        ))}
      </motion.div>
    </motion.section>

    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      variants={SECTION_REVEAL_VARIANTS}
      className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6"
    >
      {[
        {
          title: 'Host-first setup',
          body: 'Connect provider, create event, copy the magic link in under a minute.',
        },
        {
          title: 'Guest-friendly',
          body: 'Guests open the link, search tracks, and contribute without account creation.',
        },
        {
          title: 'Provider aligned',
          body: 'Tracks are searched against and added to the host provider account directly.',
        },
      ].map((item) => (
        <motion.article
          key={item.title}
          variants={GRID_ITEM_VARIANTS}
          className="rounded-2xl border border-app-border bg-app-elevated p-5 shadow-soft-lift dark:border-app-border dark:bg-app-card"
        >
          <h3 className="text-lg font-semibold">{item.title}</h3>
          <p className="mt-2 text-sm text-app-text-secondary">{item.body}</p>
        </motion.article>
      ))}
    </motion.section>

    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      variants={SECTION_REVEAL_VARIANTS}
      className="rounded-[2rem] border border-app-border bg-brand-gradient p-[1px] shadow-soft-lift"
    >
      <div className="rounded-[calc(2rem-1px)] bg-app-elevated px-5 py-12 dark:bg-app-card sm:px-8 sm:py-14">
        <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="grid gap-3">
            <HeroPill variant="pink">Ready to test your first event?</HeroPill>
            <h2 className="text-2xl font-bold text-brand-dark dark:text-brand-white sm:text-3xl">
              Launch a host event and start collecting tracks today.
            </h2>
            <p className="max-w-2xl text-sm text-app-text-secondary sm:text-base">
              Start with your own account, connect your provider, and share one link with guests.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <HeroCtaLink to="/auth/register" variant="lime">
              Create host account
            </HeroCtaLink>
            <HeroCtaLink to="/auth/login" variant="outline">
              I already have an account
            </HeroCtaLink>
          </div>
        </div>
      </div>
    </motion.section>
  </div>
);
