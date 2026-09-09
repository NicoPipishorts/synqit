import { CONNECT_SERVICES, LINK_ONLY_SERVICES, ServiceLogo } from '@synqit/ui';
import { Link } from '@tanstack/react-router';
import { type Ref } from 'react';

import { useI18n } from '../../hooks/useI18n';
import { buildSiteUrl } from '../../lib/site-url';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { ThemeToggle } from '../ui/ThemeToggle';

type HomeFooterRevealProps = {
  /** Painted only when the page sheet's end is near, so unpainted scroll tiles never show it. */
  visible?: boolean;
  /** The shell measures the footer through this to size the spacer that reveals it. */
  ref?: Ref<HTMLElement>;
};

/** The legal pages live on the marketing site, in the order the footer lists them. */
const LEGAL_PATHS = ['/privacy', '/terms', '/cookies', '/legal-notice'] as const;

/**
 * The same footer the marketing site shows, so the two halves of the product do
 * not end on different notes. What differs is only where each link points: the
 * app's own routes go through the router, and the site's pages are cross-origin,
 * so they open in a new tab rather than dropping someone out of the app.
 */
export const HomeFooterReveal = ({ visible = true, ref }: HomeFooterRevealProps) => {
  const { t } = useI18n();

  const legalLinks = [
    { href: LEGAL_PATHS[0], label: t('footer.privacy') },
    { href: LEGAL_PATHS[1], label: t('footer.terms') },
    { href: LEGAL_PATHS[2], label: t('footer.cookies') },
    { href: LEGAL_PATHS[3], label: t('footer.legalNotice') },
  ];

  const siteLink = (path: string, label: string) => (
    <a
      key={path}
      href={buildSiteUrl(path)}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:text-brand-lime"
    >
      {label}
    </a>
  );

  const serviceRow = (
    <>
      {CONNECT_SERVICES.map((service) => (
        <ServiceLogo key={service.id} service={service.id} className="h-5 w-5 sm:h-6 sm:w-6" />
      ))}
      <span aria-hidden className="h-5 w-px bg-current opacity-20" />
      {LINK_ONLY_SERVICES.map((service) => (
        <ServiceLogo key={service.id} service={service.id} className="h-5 w-5 sm:h-6 sm:w-6" />
      ))}
    </>
  );

  const productLinks = (
    <>
      {siteLink('/', t('footer.home'))}
      {siteLink('/pricing', t('home.pricing.navLink'))}
      {siteLink('/faq', t('footer.faq'))}
      <Link to="/auth/register" className="hover:text-brand-lime">
        {t('footer.start')}
      </Link>
      <Link to="/auth/login" className="hover:text-brand-lime">
        {t('footer.login')}
      </Link>
    </>
  );

  const platformLinks = (
    <>
      <Link to="/playlists" className="hover:text-brand-lime">
        {t('footer.events')}
      </Link>
      <Link to="/profile/platforms" className="hover:text-brand-lime">
        {t('footer.connections')}
      </Link>
      <Link to="/playlists/new" className="hover:text-brand-lime">
        {t('footer.createEvent')}
      </Link>
    </>
  );

  return (
    <footer
      ref={ref}
      aria-hidden={!visible}
      className={`fixed inset-x-0 bottom-0 z-0 bg-brand-dark text-brand-white transition-opacity duration-300 dark:bg-brand-white dark:text-brand-dark sm:h-96 lg:h-104 ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-10 px-4 pb-28 pt-12 sm:justify-center sm:gap-12 sm:px-6 sm:py-14 lg:gap-14 lg:px-8 lg:py-16">
        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr] lg:gap-10">
          <div className="grid content-start gap-3">
            <p className="hidden max-w-sm text-sm text-brand-white/80 dark:text-brand-dark/75 sm:block sm:text-base">
              {t('footer.description')}
            </p>
            <div className="hidden flex-wrap items-center gap-3 sm:flex">{serviceRow}</div>
          </div>

          {/* Phones: the two link columns side by side, then the legal row, then
              the blurb and the service marks underneath them. */}
          <div className="grid gap-6 sm:hidden">
            <div className="flex justify-between gap-4 px-3 text-sm">
              <div className="grid content-start gap-2 text-left">
                <p className="text-xs font-black uppercase tracking-wide text-brand-white/50 dark:text-brand-dark/50">
                  {t('footer.product')}
                </p>
                {productLinks}
              </div>
              <div className="grid content-start gap-2 text-right">
                <p className="text-xs font-black uppercase tracking-wide text-brand-white/50 dark:text-brand-dark/50">
                  {t('footer.platform')}
                </p>
                {platformLinks}
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 px-3 text-sm">
              {legalLinks.map((link) => siteLink(link.href, link.label))}
            </div>

            <div className="mt-5 grid gap-3 px-2">
              <p className="max-w-sm text-center text-sm text-brand-white/80 dark:text-brand-dark/75">
                {t('footer.description')}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">{serviceRow}</div>
            </div>
          </div>

          <div className="hidden content-start gap-2 text-sm sm:grid">
            <p className="text-xs font-black uppercase tracking-wide text-brand-white/50 dark:text-brand-dark/50">
              {t('footer.product')}
            </p>
            {productLinks}
          </div>

          <div className="hidden content-start gap-2 text-sm sm:grid">
            <p className="text-xs font-black uppercase tracking-wide text-brand-white/50 dark:text-brand-dark/50">
              {t('footer.platform')}
            </p>
            {platformLinks}
          </div>

          <div className="hidden content-start gap-2 text-sm sm:grid">
            <p className="text-xs font-black uppercase tracking-wide text-brand-white/50 dark:text-brand-dark/50">
              {t('footer.legal')}
            </p>
            {legalLinks.map((link) => siteLink(link.href, link.label))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 border-brand-white/20 pt-5 dark:border-brand-dark/20 sm:border-t">
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
          <p className="text-xs text-brand-white/55 dark:text-brand-dark/55">
            {t('footer.copyright', { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>
    </footer>
  );
};
