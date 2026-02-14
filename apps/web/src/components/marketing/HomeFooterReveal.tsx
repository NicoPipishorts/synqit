import { Link } from '@tanstack/react-router';

import { BrandLogo } from '../ui/BrandLogo';
import { HeroCtaLink } from '../ui/HeroCtaLink';

export const HomeFooterReveal = () => (
  <footer className="fixed inset-x-0 bottom-0 z-0 h-[22rem] bg-brand-dark text-brand-white dark:bg-brand-white dark:text-brand-dark sm:h-[24rem] lg:h-[26rem]">
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col justify-between px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr_1.2fr] lg:gap-10">
        <div className="grid content-start gap-3">
          <BrandLogo className="h-10 w-auto" />
          <p className="max-w-sm text-sm text-brand-white/80 dark:text-brand-dark/75 sm:text-base">
            Collaborative event playlists with one magic link and live host moderation.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <img
              src="/assets/logos/Providers/Spotify.png"
              alt="Spotify"
              className="h-7 w-auto"
              loading="lazy"
              decoding="async"
            />
            <img
              src="/assets/logos/Providers/AppleMusic.png"
              alt="Apple Music"
              className="h-7 w-auto"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>

        <div className="grid content-start gap-2 text-sm">
          <p className="text-xs font-black uppercase tracking-wide text-brand-white/50 dark:text-brand-dark/50">
            Product
          </p>
          <Link to="/" className="hover:text-brand-lime">
            Home
          </Link>
          <Link to="/auth/register" className="hover:text-brand-lime">
            Start as host
          </Link>
          <Link to="/auth/login" className="hover:text-brand-lime">
            Login
          </Link>
        </div>

        <div className="grid content-start gap-2 text-sm">
          <p className="text-xs font-black uppercase tracking-wide text-brand-white/50 dark:text-brand-dark/50">
            Platform
          </p>
          <Link to="/events" className="hover:text-brand-lime">
            Events
          </Link>
          <Link to="/providers" className="hover:text-brand-lime">
            Connections
          </Link>
          <Link to="/events/new" className="hover:text-brand-lime">
            Create event
          </Link>
        </div>

        <div className="rounded-2xl border border-brand-white/20 bg-brand-white/95 p-4 text-brand-dark dark:border-brand-dark/20 dark:bg-brand-dark dark:text-brand-white">
          <p className="text-xs font-black uppercase tracking-wide text-brand-dark/50 dark:text-brand-white/50">
            One Plan
          </p>
          <p className="mt-1 text-3xl font-black tracking-tight">Free MVP</p>
          <p className="mt-2 text-sm text-brand-dark/70 dark:text-brand-white/75">
            Launch host events and collect tracks instantly.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <HeroCtaLink to="/auth/register" variant="lime" size="sm">
              Get Started
            </HeroCtaLink>
            <HeroCtaLink to="/auth/login" variant="outline" size="sm">
              Dashboard
            </HeroCtaLink>
          </div>
        </div>
      </div>
      <div className="border-t border-brand-white/20 pt-3 text-xs text-brand-white/55 dark:border-brand-dark/20 dark:text-brand-dark/55">
        © {new Date().getFullYear()} Synqit
      </div>
    </div>
  </footer>
);
